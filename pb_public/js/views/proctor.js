// Raumaufsicht: Übersicht der Raumaufsichten und Steuerkonsole eines Raums
import { D, byId, upd, create, del, log, demoApi } from "../data.js?v=9.1";
import { icon, esc, modal, confirmBox, toast, statusChip, STATUS, isDistance, windowState, endTime, plannedEnd, fmtTime, fmtDateTime, parseDate, toPb, isConnected, isOffline, isActive, isFinished, isCollectable, connState as connOf, connChip, timeBadges, pager, bindPager, ddHtml, bindDd, mmss } from "../ui.js?v=9.1";
import { navigate, redraw, session, directHelp } from "../app.js?v=9.1";
import { me, canSeeRoom, visibleRooms, visibleCourses, canManageCourse, courseOf, roomCandidates, personName, orgShort, orgsLabel, KIND, members } from "../access.js?v=9.1";
import * as CR from "./creation.js?v=9.1";
import { seatCmp, LAYOUTS, layoutOf, isVirtual, seatMap, seatCount, validSeat, freeSeats, seatScheme, describe, gridStyle, posStyle, previewHtml, layoutIcon, venuesOf, venueConflict, conflictText } from "../seats.js?v=9.1";

const MR = { status: "", q: "" }; // Filter „Mein Raum“ (Großraum)
const pending = new Set();
const S = { ov: { page: 1, per: 9, q: "", filters: [] }, tn: { page: 1, per: 10, sort: "seat", dir: 1, sel: new Set() }, sv: { sel: new Set(), page: 1, per: 5 }, pr: { page: 1, per: 10, q: "", filters: ["participant", "seat", "action"], dir: -1 } };
const ROOM_STATE = { CREATED: ["In Vorbereitung", "gray"], RUNNING: ["Prüfung läuft", "cyan"], PAUSED: ["Prüfung pausiert", "yellowb"], TERMINATED: ["Prüfung beendet", "green"] };
const DIST_STATE = { before: ["Distanz · geplant", "gray"], open: ["Distanz · Zeitraum läuft", "cyan"], after: ["Distanz · Zeitraum beendet", "green"] };
const stateBadge = (r) => { const x = isDistance(r) ? DIST_STATE[windowState(r)] : ROOM_STATE[r.state]; return `<span class="badge ${x?.[1] || "gray"}">${x?.[0] || r.state}</span>`; };
let tick = null;
const connState = new Map();

const inRoom = (room) => D.participants.filter((p) => p.room === room.id);
// Ab dieser Zahl von Teilnehmenden wird kein Sitzplan mehr gezeigt: „Mein Raum“ ist ausgegraut, die Steuerung erfolgt im Reiter „Teilnehmende“
// (40 ≈ größter üblicher Klassen- bzw. Prüfungsraum; darüber wird der Sitzplan unübersichtlich)
export const PLAN_MAX = 40;
export const isLargeRoom = (room) => inRoom(room).length > PLAN_MAX;
const actor = () => session.userName();

// ---------- Übersicht ----------
export function overview() {
  return {
    shell: "staff", rail: "schule", title: "Übersicht Raumaufsicht",
    render() {
      const st = S.ov;
      const p = me();
      let rows = visibleRooms(p).map((r) => ({ r, c: courseOf(r), sup: D.supervisors.filter((s) => s.room === r.id).length, tn: D.participants.filter((x) => x.room === r.id).length }));
      if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(({ r }) => (r.name + " " + r.exam_name).toLowerCase().includes(q)); }
      if (st.filters.includes("running")) rows = rows.filter(({ r }) => r.state === "RUNNING" || r.state === "PAUSED");
      if (st.filters.includes("today")) rows = rows.filter(({ r }) => parseDate(r.planned_start)?.toDateString() === new Date().toDateString());
      if (st.filters.includes("exam")) rows = rows.filter(({ r }) => r.exam_name.includes("FA230"));
      const page = rows.slice((st.page - 1) * st.per, st.page * st.per);
      const scope = !p ? "" : p.kind === "schuladmin" ? `Prüfungs-Raumaufsichten Ihrer Schule (${esc(orgShort(p.org))})` : session.role === "aufsicht" ? "Raumaufsichten, in denen Sie als Aufsichtsperson eingetragen sind, sowie eigene" : "Raumaufsichten, die Ihr Konto betreffen (Eigentümer, Aufsichtsperson oder Lehrkraft des Unterrichts)";
      return `<div class="pagehead"><div><h1>Übersicht Raumaufsicht</h1>${p ? `<div class="sub">${esc(personName(p))} · ${scope}</div>` : ""}</div></div>
      <div class="row between wrap mb"><div class="row">${visibleCourses(p).length ? `<button class="btn" data-new>${icon("plus")} Neue Raumaufsicht erstellen</button>` : ""}${p?.kind === "schuladmin" ? `<a class="btn" href="#/app/raeume">${icon("door-open")} Prüfungsräume verwalten</a>` : ""}</div>
        <div class="row">${ddHtml("f", "Filtern nach", [["today", "Prüfungsdatum: heute"], ["running", "Status: läuft/pausiert"], ["exam", "Prüfungskurs: FA230"]], st.filters, st)}<div class="search"><input class="input" style="width:240px" placeholder="Suche" data-q value="${esc(st.q)}">${icon("search")}</div></div></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Raumname</th><th>Kurs / Prüfung</th><th>Ebene</th><th>Schule</th><th class="num">Aufsichten</th><th class="num">Teilnehmende</th><th class="num">Sitzplätze</th><th>Start</th><th>Ende</th><th>Status</th><th>Erstelldatum</th><th></th></tr></thead>
      <tbody>${page.length ? page.map(({ r, c, sup, tn }) => `<tr class="rowlink" data-href="#/app/raum/${r.id}/meinraum" tabindex="0"><td><b>${esc(r.name)}</b><div class="xs muted">${r.venue ? `Schulraum${byId("venues", r.venue)?.building ? " · " + esc(byId("venues", r.venue).building) : ""}` : isDistance(r) ? `Distanzunterricht · bis ${fmtDateTime(parseDate(r.window_to))}` : `ohne realen Raum · ${esc(LAYOUTS[layoutOf(r)].label)}`}</div></td><td>${esc(r.exam_name || "–")}</td><td>${c ? `<span class="badge ${c.kind === "pruefung" ? "purple" : "cyan"}">${KIND[c.kind]}</span>` : "–"}</td><td>${esc(orgShort(r.org))}</td><td class="num">${sup}</td><td class="num">${tn}</td><td class="num">${seatCount(r)}</td><td>${fmtDateTime(parseDate(r.planned_start))}</td><td>${fmtTime(plannedEnd(r))}</td><td>${stateBadge(r)}</td><td>${esc(r.created_label)}</td><td><a class="linkarrow" href="#/app/raum/${r.id}/meinraum">${icon("arrow-right")} Zur Raumaufsicht</a></td></tr>`).join("") : `<tr><td colspan="12"><div class="empty">${icon("search")}<div>Keine Raumaufsichten für Ihr Konto</div></div></td></tr>`}</tbody></table>
      ${pager(rows.length, st.page, st.per, [5, 9, 20])}</div>`;
    },
    mount(el) {
      const st = S.ov;
      bindPager(el, st, redraw);
      bindDd(el, st, (k, v) => { st.filters = v; st.page = 1; }, redraw);
      const q = el.querySelector("[data-q]"); q.oninput = () => { st.q = q.value; st.page = 1; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); };
      const nb = el.querySelector("[data-new]"); if (nb) nb.onclick = () => newRoomDialog();
    },
  };
}
// ---------- Prüfungsräume der Schule (Schuladministration) ----------
// Reale Räume sind organisationsspezifisch; sie stehen bei Prüfungs-Raumaufsichten der Schule zur Auswahl
const VS = { q: "" };
const venueUse = (v) => D.rooms.filter((r) => r.venue === v.id);
export function venues() {
  return {
    shell: "staff", rail: "raeume", title: "Prüfungsräume",
    render() {
      const p = me();
      if (p?.kind !== "schuladmin") return `<div class="empty">${icon("lock")} Prüfungsräume verwaltet die Schuladministration.</div>`;
      let list = venuesOf(p.org);
      if (VS.q) { const q = VS.q.toLowerCase(); list = list.filter((v) => (v.name + " " + v.building).toLowerCase().includes(q)); }
      const now = Date.now();
      return `<div class="pagehead"><div><h1>Prüfungsräume</h1><div class="sub">${esc(personName(p))} · ${esc(byId("orgs", p.org)?.name || "")}</div></div></div>
      <div class="notice info small mb">${icon("info")}<span>Prüfungsräume gehören zu Ihrer Schule (${esc(orgShort(p.org))}). Sie stehen beim Anlegen einer Prüfungs-Raumaufsicht zur Auswahl; ein Raum kann je Zeitraum nur einmal belegt werden. Im Unterricht wird ohne reale Räume gearbeitet.</span></div>
      <div class="row between wrap mb"><button class="btn primary" data-vnew>${icon("plus")} Prüfungsraum anlegen</button><div class="search"><input class="input" style="width:240px" placeholder="Suche" data-vq value="${esc(VS.q)}" aria-label="Prüfungsräume durchsuchen">${icon("search")}</div></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Raum</th><th>Gebäude / Lage</th><th>Anordnung</th><th class="num">Sitzplätze</th><th>Belegungen</th><th></th></tr></thead><tbody>${list.length ? list.map((v) => {
        const use = venueUse(v); const next = use.filter((r) => r.state !== "TERMINATED" && (parseDate(r.planned_start)?.getTime() || 0) > now - 6 * 3600000).sort((a, b) => String(a.planned_start).localeCompare(String(b.planned_start)))[0];
        return `<tr data-vrow="${v.id}"><td><b>${esc(v.name)}</b></td><td>${esc(v.building || "–")}</td><td>${layoutIcon(layoutOf(v))} <span class="small">${esc(LAYOUTS[layoutOf(v)].label)}</span></td><td class="num">${seatCount(v)}</td><td class="small">${use.length ? `${use.length} Raumaufsicht${use.length === 1 ? "" : "en"}${next ? `<div class="xs muted">nächste: ${esc(next.exam_name || next.name)}, ${fmtDateTime(parseDate(next.planned_start))}</div>` : ""}` : `<span class="muted">nicht belegt</span>`}</td>
          <td class="row" style="justify-content:flex-end"><button class="iconbtn" data-vedit="${v.id}" title="Bearbeiten" aria-label="${esc(v.name)} bearbeiten">${icon("pencil")}</button><button class="iconbtn" data-vdel="${v.id}" title="${use.length ? "Raum ist verplant – Löschen nicht möglich" : "Löschen"}" aria-label="${esc(v.name)} löschen" ${use.length ? "disabled" : ""}>${icon("trash-2")}</button></td></tr>`;
      }).join("") : `<tr><td colspan="6"><div class="empty small">Noch keine Prüfungsräume angelegt.</div></td></tr>`}</tbody></table></div>`;
    },
    mount(el) {
      const q = el.querySelector("[data-vq]"); if (q) q.oninput = () => { VS.q = q.value; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-vq]"); n.focus(); n.setSelectionRange(pos, pos); };
      const nb = el.querySelector("[data-vnew]"); if (nb) nb.onclick = () => venueDialog();
      el.querySelectorAll("[data-vedit]").forEach((b) => (b.onclick = () => venueDialog(byId("venues", b.dataset.vedit))));
      el.querySelectorAll("[data-vdel]").forEach((b) => (b.onclick = async () => {
        const v = byId("venues", b.dataset.vdel); if (!v || venueUse(v).length) return;
        if (!(await confirmBox("Prüfungsraum löschen?", `„${esc(v.name)}“ wird aus der Liste der Prüfungsräume Ihrer Schule entfernt.`, "Löschen"))) return;
        await del("venues", v.id); toast("Prüfungsraum gelöscht", v.name);
      }));
    },
  };
}
async function venueDialog(v0) {
  const p = me(); if (!p) return;
  const used = v0 ? venueUse(v0).filter((r) => r.state !== "CREATED") : [];
  const v = { name: v0?.name || "", building: v0?.building || "", layout: layoutOf(v0 || {}), capacity: v0 ? seatCount(v0) : 24, cols: v0?.cols || 6, group_size: v0?.group_size || 4 };
  const res = await modal({
    title: v0 ? "Prüfungsraum bearbeiten" : "Prüfungsraum anlegen", size: "wide",
    body: `<div class="grid2"><div class="field"><label class="lbl" for="vn">Raumbezeichnung</label><input id="vn" class="input" data-vf="name" value="${esc(v.name)}" placeholder="z. B. Raum 305"></div>
      <div class="field"><label class="lbl" for="vb">Gebäude / Lage</label><input id="vb" class="input" data-vf="building" value="${esc(v.building)}" placeholder="z. B. Hauptgebäude, 3. OG"></div></div>
      ${used.length ? `<div class="notice warn small mb">${icon("triangle-alert")}<span>Der Raum wird in laufenden oder beendeten Raumaufsichten genutzt. Änderungen gelten nur für künftige Planungen.</span></div>` : ""}
      <h3 class="mt">Sitzordnung</h3><div data-vseat>${seatingForm(v)}</div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${v0 ? "Speichern" : "Anlegen"}</button>`,
    onMount: (m, close) => {
      bindSeating(m.querySelector("[data-vseat]"), v);
      m.querySelector("[data-ok]").onclick = () => {
        const name = m.querySelector('[data-vf="name"]').value.trim(), building = m.querySelector('[data-vf="building"]').value.trim();
        if (!name) { toast("Bezeichnung fehlt", "Bitte geben Sie eine Raumbezeichnung ein.", "error"); return; }
        if (D.venues.some((x) => x.org === p.org && x.id !== v0?.id && x.name.toLowerCase() === name.toLowerCase())) { toast("Raum existiert bereits", `An Ihrer Schule gibt es bereits „${name}“.`, "error"); return; }
        close({ name, building, ...seatingValues(v) });
      };
    },
  });
  if (!res) return;
  const rec = { org: p.org, name: res.name, building: res.building, layout: res.layout, capacity: res.capacity, cols: res.cols, rows: res.rows || Math.ceil(res.capacity / Math.max(1, res.cols || 1)), group_size: res.group_size };
  if (v0) {
    await upd("venues", v0.id, rec);
    // geplante (noch nicht gestartete) Raumaufsichten übernehmen die neue Sitzordnung
    for (const r of venueUse(v0).filter((r) => r.state === "CREATED")) await upd("rooms", r.id, { name: rec.name, capacity: rec.capacity, rows: rec.rows, cols: rec.cols, layout: rec.layout, group_size: rec.group_size });
    toast("Prüfungsraum gespeichert", rec.name);
  } else { await create("venues", rec); toast("Prüfungsraum angelegt", `${rec.name} · ${rec.capacity} Plätze`); }
}
// ---------- Sitzordnung (Unterricht) ----------
// Formular für Anzahl der Sitzplätze und Anordnung mit Live-Vorschau; v wird beim Bearbeiten fortgeschrieben
export const seatingValues = (v) => { const L = LAYOUTS[v.layout] ? v.layout : "reihen"; const cap = Math.max(1, Math.min(200, Math.round(+v.capacity) || 1)); const cols = L === "reihen" || L === "versetzt" ? Math.max(1, Math.min(12, Math.round(+v.cols) || 5)) : 0; return { layout: L, capacity: cap, cols, rows: cols ? Math.ceil(cap / cols) : 0, group_size: L === "gruppen" ? (+v.group_size === 6 ? 6 : 4) : 0 }; };
function seatingDep(v, dis) {
  if (v.layout === "reihen" || v.layout === "versetzt") return `<div class="field"><label class="lbl" for="sf-cols">Plätze je Reihe</label><input id="sf-cols" class="input" type="number" min="1" max="12" data-s="cols" value="${esc(v.cols || 5)}" ${dis}></div>`;
  if (v.layout === "gruppen") return `<div class="field"><label class="lbl" for="sf-gs">Plätze je Tischgruppe</label><select id="sf-gs" class="select" data-s="group_size" ${dis}><option value="4" ${+v.group_size !== 6 ? "selected" : ""}>4 Plätze</option><option value="6" ${+v.group_size === 6 ? "selected" : ""}>6 Plätze</option></select></div>`;
  return `<div class="field"><span class="lbl">Verteilung</span><p class="xs muted" style="margin:6px 0 0">Die Plätze werden gleichmäßig auf die linke, hintere und rechte Seite verteilt.</p></div>`;
}
export function seatingForm(v, locked = false) {
  const dis = locked ? "disabled" : "";
  return `<div class="seating"><div class="seating-l">
    <div class="field"><label class="lbl" for="sf-cap">Anzahl der Sitzplätze</label><input id="sf-cap" class="input" type="number" min="1" max="200" data-s="capacity" value="${esc(v.capacity)}" ${dis}></div>
    <fieldset class="layoutpick" ${dis}><legend class="lbl">Anordnung</legend>${Object.entries(LAYOUTS).map(([k, o]) => `<label class="lp ${v.layout === k ? "on" : ""}"><input type="radio" name="sf-layout" value="${k}" data-s="layout" ${v.layout === k ? "checked" : ""} ${dis}>${layoutIcon(k)}<span><b>${o.label}</b><span class="xs muted">${o.hint}</span></span></label>`).join("")}</fieldset>
    <div data-sdep>${seatingDep(v, dis)}</div></div>
    <div class="seating-r"><span class="lbl">Vorschau <span class="xs muted" data-sdesc>${esc(describe(seatingValues(v)))}</span></span><div data-sprev>${previewHtml(seatingValues(v))}</div></div></div>`;
}
export function bindSeating(host, v) {
  const upd = () => { const sv = seatingValues(v); host.querySelector("[data-sprev]").innerHTML = previewHtml(sv); host.querySelector("[data-sdesc]").textContent = describe(sv); };
  const bind = () => host.querySelectorAll("[data-s]").forEach((inp) => {
    const k = inp.dataset.s;
    inp.oninput = inp.onchange = () => {
      if (k === "layout") { if (!inp.checked) return; v.layout = inp.value; host.querySelectorAll(".lp").forEach((l) => l.classList.toggle("on", l.querySelector("input").checked)); host.querySelector("[data-sdep]").innerHTML = seatingDep(v, ""); bind(); }
      else v[k] = inp.value;
      upd();
    };
  });
  bind();
}

// Raumaufsicht erstellen (Task 32 Unterricht / Task 21 Prüfung): immer zu einem Kurs, den das Konto verwaltet
//  - Unterricht: ohne realen Raum, Sitzplätze und Anordnung frei wählbar
//  - Prüfung: realer Raum der Schule, Doppelbelegungen im selben Zeitraum sind ausgeschlossen
export async function newRoomDialog(courseId = "") {
  const p = me();
  const courses = visibleCourses(p).filter((c) => canManageCourse(c, p));
  if (!courses.length) { toast("Kein Kurs verfügbar", "Raumaufsichten werden zu einem Kurs erstellt. Kopieren Sie zuerst eine Prüfung aus dem Katalog bzw. öffnen Sie eine Prüfung Ihrer Schule.", "info"); return; }
  const d = new Date(Date.now() + 86400000); const ds = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const pick = courses.find((c) => c.id === courseId) || courses[0];
  const tnCount = (c) => new Set(members(c).filter((m) => m.role === "teilnehmer").map((m) => m.person)).size;
  const d2 = new Date(d.getTime() + 6 * 86400000); const ds2 = new Date(d2.getTime() - d2.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const v = { course: pick.id, name: "", date: ds, time: "08:30", duration_min: 90, venue: "", mode: "praesenz", wto: ds2, wtoT: "20:00", repeatable: false, show_horizon: false, seat: { capacity: tnCount(pick) || 24, layout: "reihen", cols: 5, group_size: 4 } };
  const orgOf = (c) => p?.org || c.org || "";
  const planOf = () => ({ planned_start: toPb(new Date(`${v.date}T${v.time || "08:00"}`)), duration_min: +v.duration_min || 0 });
  const body = (m) => {
    const c = byId("courses", v.course); const lesson = c.kind === "unterricht"; const dist = lesson && v.mode === "distanz";
    const venues = lesson ? [] : venuesOf(orgOf(c));
    const opts = venues.map((x) => { const hit = venueConflict(x.id, planOf()); return `<option value="${x.id}" ${x.id === v.venue ? "selected" : ""} ${hit ? "disabled" : ""}>${esc(x.name)} · ${seatCount(x)} Plätze${hit ? ` – ${esc(conflictText(hit))}` : ""}</option>`; }).join("");
    if (!lesson && v.venue && venueConflict(v.venue, planOf())) v.venue = "";
    const ven = byId("venues", v.venue);
    m.querySelector("[data-nr]").innerHTML = `<div class="nrgrid">
      <div class="field"><label class="lbl" for="nr-c">${courses.some((x) => x.kind === "pruefung") && courses.some((x) => x.kind === "unterricht") ? "Kurs" : p?.kind === "schuladmin" ? "Prüfung" : "Unterricht (Kurs)"}</label><select id="nr-c" class="select" data-v="course">${courses.map((x) => `<option value="${x.id}" ${x.id === v.course ? "selected" : ""}>${esc(x.title)}</option>`).join("")}</select></div>
      ${lesson ? `<div class="field"><label class="lbl" for="nr-n">Bezeichnung</label><input id="nr-n" class="input" data-v="name" value="${esc(v.name)}" placeholder="z. B. Klassenarbeit ${esc(c.title.replace(/^Zentrale /, ""))} · Gruppe A"></div>`
        : `<div class="field"><label class="lbl" for="nr-v">Prüfungsraum</label><select id="nr-v" class="select" data-v="venue"><option value="">Raum auswählen</option>${opts}</select></div>`}
      ${lesson ? `<fieldset class="field modepick"><legend class="lbl">Durchführung</legend><label class="radio"><input type="radio" name="nr-mode" data-v="mode" value="praesenz" ${v.mode !== "distanz" ? "checked" : ""}> ${icon("school")} Präsenz <span class="xs muted">– Lehrkraft startet, pausiert und sammelt ein</span></label><label class="radio"><input type="radio" name="nr-mode" data-v="mode" value="distanz" ${v.mode === "distanz" ? "checked" : ""}> ${icon("house")} Distanz <span class="xs muted">– fester Zeitraum, Start durch die Schüler:innen</span></label></fieldset>` : ""}
      ${dist ? `<div class="field"><label class="lbl" for="nr-d">Zeitraum von</label><div class="inline-fields"><input id="nr-d" class="input" type="date" data-v="date" value="${v.date}"><input class="input" type="time" data-v="time" value="${v.time}" aria-label="Uhrzeit von"></div></div>
      <div class="field"><label class="lbl" for="nr-wt">Zeitraum bis</label><div class="inline-fields"><input id="nr-wt" class="input" type="date" data-v="wto" value="${v.wto}"><input class="input" type="time" data-v="wtoT" value="${v.wtoT}" aria-label="Uhrzeit bis"></div></div>`
      : `<div class="field"><label class="lbl" for="nr-d">Datum</label><input id="nr-d" class="input" type="date" data-v="date" value="${v.date}"></div>
      <div class="field"><label class="lbl" for="nr-t">Frühester Start</label><input id="nr-t" class="input" type="time" data-v="time" value="${v.time}"></div>`}
      <div class="field"><label class="lbl" for="nr-du">Bearbeitungszeit (Minuten)</label><input id="nr-du" class="input" type="number" min="5" data-v="duration_min" value="${v.duration_min}"></div></div>
      ${dist ? `<div class="card pad mb"><label class="checkbox"><input type="checkbox" data-vc="repeatable" ${v.repeatable ? "checked" : ""}> Mehrfach durchlaufbar <span class="xs muted">(z. B. zur Prüfungsvorbereitung)</span></label><label class="checkbox mt-s"><input type="checkbox" data-vc="show_horizon" ${v.show_horizon ? "checked" : ""}> Erwartungshorizont nach Abschluss anzeigen</label>
        <p class="xs muted" style="margin:8px 0 0">Im Distanzunterricht entscheiden die Teilnehmenden innerhalb des Zeitraums, wann sie die Einheit bearbeiten. Es gibt keine direkte Steuerung durch die Lehrkraft (kein Starten, Sperren, Pausieren oder Einsammeln) und keine Sitzordnung. Nach Ablauf der Bearbeitungszeit bzw. des Zeitraums wird automatisch abgegeben.</p></div>`
      : lesson ? `<div data-seathost>${seatingForm(v.seat)}</div>`
        : `<div class="notice info small mb">${icon("info")}<span>Reale Räume Ihrer Schule können je Zeitraum nur <b>einmal</b> belegt werden (Bearbeitungszeit zzgl. 30 Minuten). Belegte Räume sind ausgegraut.</span></div>
          ${ven ? `<div class="seating"><div class="seating-l small"><b>${esc(ven.name)}</b>${ven.building ? ` · ${esc(ven.building)}` : ""}<br>${esc(describe(ven))}</div><div class="seating-r">${previewHtml(ven)}</div></div>` : `<p class="small muted">Wählen Sie einen freien Raum aus.</p>`}`}
      <p class="xs muted mt-s">${p?.kind === "lehrkraft" ? (dist ? "Sie werden als betreuende Lehrkraft eingetragen." : "Sie werden automatisch als Aufsichtsperson eingetragen.") : "Aufsichtspersonen und Teilnehmende ordnen Sie anschließend aus den Mitgliedern der Prüfung Ihrer Schule zu."}</p>`;
    m.querySelectorAll("[data-v]").forEach((f) => (f.onchange = () => { v[f.dataset.v] = f.value; if (f.dataset.v === "mode") { if (!f.checked) return; v.mode = f.value; body(m); return; } if (["course", "date", "time", "duration_min", "venue"].includes(f.dataset.v)) { if (f.dataset.v === "course") { v.venue = ""; v.seat.capacity = tnCount(byId("courses", v.course)) || v.seat.capacity; } body(m); } }));
    m.querySelectorAll('[data-v="name"]').forEach((f) => (f.oninput = () => { v.name = f.value; f.style.borderColor = ""; }));
    m.querySelectorAll("[data-vc]").forEach((f) => (f.onchange = () => (v[f.dataset.vc] = f.checked)));
    const host = m.querySelector("[data-seathost]"); if (host) bindSeating(host, v.seat);
  };
  const ok = await modal({ title: "Neue Raumaufsicht erstellen", size: "wide", body: `<div data-nr></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Raumaufsicht erstellen</button>`,
    onMount: (m, close) => { body(m); m.querySelector("[data-ok]").onclick = () => {
      const c = byId("courses", v.course);
      if (c.kind === "unterricht" && !v.name.trim()) { const f = m.querySelector('[data-v="name"]'); f.style.borderColor = "var(--red)"; f.focus(); return; }
      if (c.kind === "unterricht" && v.mode === "distanz" && !(new Date(`${v.wto}T${v.wtoT || "20:00"}`) > new Date(`${v.date}T${v.time || "08:00"}`))) { toast("Zeitraum ungültig", "Das Ende des Zeitraums muss nach dem Beginn liegen.", "error"); return; }
      if (c.kind !== "unterricht") { if (!v.venue) { const f = m.querySelector('[data-v="venue"]'); f.style.borderColor = "var(--red)"; f.focus(); return; } const hit = venueConflict(v.venue, planOf()); if (hit) { toast("Raum bereits belegt", conflictText(hit), "error"); return; } }
      close(true); } } });
  if (!ok) return;
  const c = byId("courses", v.course);
  const start = new Date(`${v.date}T${v.time}`);
  const distMode = c.kind === "unterricht" && v.mode === "distanz";
  const place = distMode ? { name: v.name.trim(), venue: "", layout: "reihen", capacity: Math.max(30, tnCount(c)), cols: 5, rows: Math.ceil(Math.max(30, tnCount(c)) / 5), group_size: 0, mode: "distanz", window_from: toPb(start), window_to: toPb(new Date(`${v.wto}T${v.wtoT || "20:00"}`)), repeatable: !!v.repeatable, show_horizon: !!v.show_horizon, start_earliest: "", start_latest: "" }
    : c.kind === "unterricht" ? { name: v.name.trim(), venue: "", mode: "praesenz", ...seatingValues(v.seat) } : (() => { const x = byId("venues", v.venue); return { name: x.name, venue: x.id, capacity: x.capacity, rows: x.rows, cols: x.cols, layout: x.layout || "reihen", group_size: +x.group_size || 0 }; })();
  let r;
  try { r = await create("rooms", { ...place, exam_name: c.title, exam_code: c.exam_code || "", course: c.id, org: orgOf(c), owner: p?.id || "", state: "CREATED", planned_start: toPb(start), start_earliest: v.time, start_latest: fmtTime(new Date(start.getTime() + 30 * 60000)), duration_min: +v.duration_min, global_extra: 0, paused_total_s: 0, created_label: fmtDateTime(new Date()), ...place }); }
  catch (e) { toast("Raumaufsicht nicht erstellt", e?.response?.message || e?.message || "", "error"); return; }
  log(r.id, null, "Raumaufsicht wurde angelegt", `${c.title} (${KIND[c.kind]}) · ${distMode ? `Distanz ${fmtDateTime(parseDate(r.window_from))}–${fmtDateTime(parseDate(r.window_to))}` : describe(r)}${r.venue ? "" : " · ohne realen Raum"}`, "system", actor());
  if (p?.kind === "lehrkraft") { const to = fmtTime(new Date(start.getTime() + (+v.duration_min + 30) * 60000)); await create("supervisors", { lastname: p.lastname, firstname: p.firstname, short: p.short || "", username: p.username, person: p.id, room: r.id, present: false, from: v.time, to, periods: [{ from: v.time, to }] }); }
  toast("Raumaufsicht erstellt", `${r.name} wurde angelegt. Ordnen Sie jetzt die Teilnehmenden zu.`);
  navigate(`#/app/raum/${r.id}/teilnehmende`);
}

// ---------- Raum ----------
export function room(id, tab) {
  const r = byId("rooms", id);
  if (!r) return { shell: "staff", rail: "schule", title: "Raum", render: () => `<div class="empty">Raum nicht gefunden. <a href="#/app/raumaufsicht">Zur Übersicht</a></div>` };
  if (!canSeeRoom(r)) return { shell: "staff", rail: "schule", title: "Kein Zugriff", render: () => `<div class="empty">${icon("lock")}<h2>Kein Zugriff auf diese Raumaufsicht</h2><p>Die Raumaufsicht betrifft Ihr Konto bzw. Ihre Organisation nicht.</p><a class="btn" href="#/app/raumaufsicht">Zur Übersicht</a></div>` };
  // Unterricht: kein Prüfungsprotokoll (nur bei Prüfungen)
  const lesson = courseOf(r)?.kind === "unterricht";
  const dist = isDistance(r);
  const tabs = [["pruefung", dist ? "Einstellungen" : "Prüfung"], ["meinraum", "Mein Raum"], ["teilnehmende", "Teilnehmende"], ["aufsicht", dist ? "Lehrkräfte" : "Aufsichtspersonen"], ...(lesson ? [] : [["protokoll", "Prüfungsprotokoll"]])];
  if (lesson && tab === "protokoll") tab = "meinraum";
  if (tab === "meinraum" && (isLargeRoom(r) || dist)) tab = "teilnehmende";
  const planOff = (room) => isLargeRoom(room) || isDistance(room);
  return {
    shell: "staff", rail: "schule", title: r.name,
    render() {
      const room = byId("rooms", id) || r;
      const ended = room.state === "TERMINATED";
      const body = { pruefung: tabPruefung, meinraum: tabMeinRaum, teilnehmende: tabTeilnehmende, aufsicht: tabAufsicht, protokoll: tabProtokoll }[tab] || tabMeinRaum;
      return `<div class="breadcrumb"><a href="#/app/raumaufsicht">Übersicht Raumaufsicht</a>${icon("chevron-right")}<b>${esc(room.name)}</b></div><div class="pagehead"><div><h1>${esc(room.name)}</h1><div class="sub">${esc(room.exam_name || "Noch keine Prüfung zugeordnet")}</div>
        <div class="row mt-s small">${stateBadge(room)}${dist ? `<span>Zeitraum: <b>${fmtDateTime(parseDate(room.window_from))} – ${fmtDateTime(parseDate(room.window_to))}</b></span><span>Bearbeitungszeit: <b>${room.duration_min} Min.</b></span>${room.repeatable ? `<span class="badge gray">${icon("rotate-ccw")} mehrfach durchlaufbar</span>` : ""}${room.show_horizon ? `<span class="badge gray">${icon("file-text")} Erwartungshorizont nach Abschluss</span>` : ""}` : `<span>Geplanter Start: <b>${fmtDateTime(parseDate(room.planned_start))}</b></span>`}${room.started_at ? `<span>Gestartet: <b>${fmtTime(parseDate(room.started_at))}</b></span>` : ""}${room.global_extra ? `<span class="badge yellowb">+${room.global_extra} Min. global</span>` : ""}</div></div>
        <div class="actions-bar">
          ${lesson ? "" : `<button class="btn" data-incident>${icon("message-square-warning", "red")} Besondere Vorkommnisse</button>`}
          ${tab === "protokoll" ? `<button class="btn" data-download ${room.state === "TERMINATED" ? "" : `disabled title="Erst nach Beendigung der Prüfung verfügbar"`}>${icon("download")} Protokoll herunterladen (PDF)</button>${room.state === "TERMINATED" ? "" : `<span class="xs muted" style="align-self:center">Download nach Prüfungsende</span>`}` : ""}
          ${dist ? `<span class="xs muted" style="align-self:center;max-width:340px">${icon("info")} Distanzunterricht: Die Schüler:innen starten selbst – kein Starten, Sperren, Pausieren oder Einsammeln durch die Lehrkraft.</span>` : tab !== "aufsicht" && tab !== "protokoll" ? `${room.state === "CREATED" ? `<button class="btn primary" data-start>${icon("play")} Prüfung starten</button>` : room.state === "RUNNING" ? `<button class="btn primary" data-pause>${icon("pause")} Prüfung pausieren</button>` : room.state === "PAUSED" ? `<button class="btn primary" data-resume>${icon("play")} Prüfung fortsetzen</button>` : ""}
          <button class="btn" data-collect ${room.state === "RUNNING" || room.state === "PAUSED" ? "" : "disabled"}>${icon("download")} Prüfung einsammeln</button>
          <button class="btn" data-end ${ended || room.state === "CREATED" ? "disabled" : ""}>${icon("log-in")} Prüfung beenden</button>` : ""}
        </div></div>
      <nav class="tabs">${tabs.map(([k, l]) => k === "meinraum" && planOff(room) ? `<span class="tabdis" aria-disabled="true" title="${isDistance(room) ? "Distanzunterricht: kein Sitzplan" : `Mehr als ${PLAN_MAX} Teilnehmende: kein Sitzplan – Steuerung im Reiter „Teilnehmende“`}">${l}</span>` : `<a href="#/app/raum/${id}/${k}" class="${k === tab ? "active" : ""}">${l}</a>`).join("")}</nav>
      ${body(room)}`;
    },
    mount(el) {
      const room = byId("rooms", id);
      const on = (sel, fn) => { const b = el.querySelector(sel); if (b) b.onclick = fn; };
      on("[data-incident]", () => incident(room));
      on("[data-start]", () => startExam(room));
      on("[data-pause]", () => pauseExam(room));
      on("[data-resume]", () => resumeExam(room));
      on("[data-collect]", () => collect(room));
      on("[data-end]", () => endExam(room));
      on("[data-download]", () => downloadProtocol(room));
      ({ pruefung: bindPruefung, meinraum: bindMeinRaum, teilnehmende: bindTeilnehmende, aufsicht: bindAufsicht, protokoll: bindProtokoll }[tab] || bindMeinRaum)(el, room);
      clearInterval(tick);
      tick = setInterval(() => {
        // Restzeiten aktualisieren, Verbindungsabbrüche melden
        document.querySelectorAll("[data-left]").forEach((s) => { const p = byId("participants", s.dataset.left); const e = endTime(byId("rooms", id), p); if (!e) { s.textContent = ""; return; } const ms = e - Date.now(); s.textContent = ms > 0 ? "Rest " + mmss(ms) : "Zeit abgelaufen +" + mmss(-ms); s.classList.toggle("over", ms <= 0); });
        const rm = byId("rooms", id);
        if (rm && rm.state === "RUNNING") inRoom(rm).filter((p) => p.simulated).forEach((p) => {
          // Prüflinge ohne eigenes Browserfenster (Simulation): Zeitablauf und Wiederverbindung hier fortschreiben
          const e = endTime(rm, p); const ms = e ? e - Date.now() : 1;
          if (ms <= 0 && p.status === "laeuft" && !pending.has(p.id)) { pending.add(p.id); upd("participants", p.id, { status: "zeit_beendet" }).then(() => log(rm.id, p, "Bearbeitungszeit abgelaufen", "Prüfung läuft weiter, neue Aufgaben gesperrt", "system")).finally(() => pending.delete(p.id)); }
        });
        // Simulierter Verbindungsabbruch endet nach Ablauf auch dann, wenn der Prüfling kein eigenes Fenster geöffnet hat
        if (rm) inRoom(rm).forEach((p) => {
          if (!p.offline_until || pending.has(p.id)) return;
          const over = Date.now() - parseDate(p.offline_until);
          if (over < (p.simulated ? 0 : 4000)) return; // ein geöffnetes Prüflingsfenster meldet sich selbst zurück
          pending.add(p.id);
          upd("participants", p.id, { offline_until: "" }).then(() => log(rm.id, p, "Verbindung wiederhergestellt", "automatisch nach simuliertem Abbruch", "system")).finally(() => pending.delete(p.id));
        });
        if (rm && (rm.state === "RUNNING" || rm.state === "PAUSED")) inRoom(rm).forEach((p) => {
          const c = isConnected(p); const prev = connState.get(p.id);
          if (prev === true && !c && isActive(p.status)) toast("Verbindungsprobleme", `${p.lastname}, ${p.firstname} (Platz ${p.seat}) ist nicht mehr verbunden.`, "error", { ms: 8000 });
          if (prev === false && c && isActive(p.status)) toast("Verbindung wiederhergestellt", `${p.lastname}, ${p.firstname} (Platz ${p.seat}) arbeitet weiter.`, "info", { ms: 5000 });
          connState.set(p.id, c);
          document.querySelectorAll(`[data-conn="${p.id}"]`).forEach((ic) => {
            if (ic.classList.contains("connchip")) { const t = document.createElement("span"); t.innerHTML = connChip(p, ic.hasAttribute("data-compact")); const n = t.firstChild; if (ic.hasAttribute("data-compact")) n.setAttribute("data-compact", ""); ic.replaceWith(n); }
            else { const k = connOf(p).key; ic.className = "connico " + (k === "ok" ? "on" : k === "none" ? "none" : "off"); ic.title = connOf(p).label; ic.innerHTML = icon(connOf(p).icon); }
          });
        });
      }, 2000);
    },
    unmount() { clearInterval(tick); },
    onHeartbeat() {},
  };
}

// ---------- Aktionen ----------
async function startExam(room) {
  const cat = byId("catalog", courseOf(room)?.catalog);
  if (cat?.status && cat.status !== "veroeffentlicht") { toast("Prüfungsinhalt noch nicht freigegeben", `${CR.contentInfo(cat)?.text || ""}. Der Start ist ab dem Prüfungsstart (${fmtDateTime(CR.startAt(cat))} Uhr) möglich.`, "error", { ms: 9000 }); return; }
  const ps = inRoom(room);
  const ready = ps.filter((p) => p.present && p.status === "wartend_bestaetigt");
  const notReady = ps.filter((p) => !(p.present && p.status === "wartend_bestaetigt") && !isFinished(p.status));
  const ok = await confirmBox("Prüfung starten", `<p>Die Prüfung wird für <b>${ready.length}</b> anwesende und bestätigte Teilnehmende gestartet.</p>${notReady.length ? `<p>${notReady.length} Teilnehmende sind noch nicht bereit (nicht eingeloggt, Bestätigung offen oder nicht anwesend). Sie starten automatisch, sobald sie bereit sind und als anwesend markiert wurden.</p>` : ""}`, "Prüfung starten", "Abbrechen", false);
  if (!ok) return;
  const now = toPb();
  await upd("rooms", room.id, { state: "RUNNING", started_at: now, paused_total_s: 0 });
  for (const p of ready) await upd("participants", p.id, { status: "laeuft", started_at: now });
  log(room.id, null, "Prüfung wurde gestartet", `${ready.length} Teilnehmende`, "aktion", actor());
  toast("Prüfung gestartet", `Die Prüfung läuft für ${ready.length} Teilnehmende.`);
}
async function pauseExam(room) {
  if (!(await confirmBox("Prüfung pausieren", "Die Prüfung wird für alle Teilnehmenden im Raum pausiert. Die Bearbeitungszeit wird angehalten.", "Pausieren", "Abbrechen", false))) return;
  await upd("rooms", room.id, { state: "PAUSED", paused_at: toPb() });
  log(room.id, null, "Prüfung wurde pausiert", "", "aktion", actor());
  toast("Prüfung pausiert", "Die Bearbeitungszeit ist für alle angehalten.", "info");
}
async function resumeExam(room) {
  const add = Math.round((Date.now() - parseDate(room.paused_at).getTime()) / 1000);
  await upd("rooms", room.id, { state: "RUNNING", paused_at: "", paused_total_s: (room.paused_total_s || 0) + add });
  log(room.id, null, "Prüfung wurde fortgesetzt", `Pause: ${Math.round(add / 60)} Min.`, "aktion", actor());
  toast("Prüfung fortgesetzt");
}
async function collect(room) {
  const act = inRoom(room).filter((p) => isCollectable(p.status)).sort((a, b) => seatCmp(a.seat, b.seat));
  if (!act.length) { toast("Keine aktiven Teilnehmenden", "Es gibt keine Prüfungen zum Einsammeln.", "info"); return; }
  const v = await modal({ title: "Prüfung einsammeln", warn: true, size: "wide",
    body: `<p>Die Prüfung wird für folgende Teilnehmende unwiderruflich eingesammelt und beendet:</p>
    <div class="tablewrap" style="max-height:340px"><table class="tbl"><thead><tr><th><input type="checkbox" data-all checked aria-label="Alle"></th><th>Nachname</th><th>Vorname</th><th>Anmeldename</th><th>Sitzplatz</th><th>Status</th><th>Restzeit</th></tr></thead>
    <tbody>${act.map((p) => { const e = endTime(room, p); return `<tr><td><input type="checkbox" data-p="${p.id}" checked></td><td>${esc(p.lastname)}</td><td>${esc(p.firstname)}</td><td>${esc(p.username)}</td><td>${esc(p.seat)}</td><td>${statusChip(p.status)}</td><td>${p.status === "abgegeben" ? "abgegeben" : e ? (e - Date.now() > 0 ? mmss(e - Date.now()) : "abgelaufen") : "–"}</td></tr>`; }).join("")}</tbody></table></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Prüfung einsammeln</button>`,
    onMount: (m, close) => { m.querySelector("[data-all]").onchange = (e) => m.querySelectorAll("[data-p]").forEach((c) => (c.checked = e.target.checked)); m.querySelector("[data-ok]").onclick = () => close([...m.querySelectorAll("[data-p]:checked")].map((c) => c.dataset.p)); } });
  if (!v || !v.length) return;
  for (const pid of v) { const p = byId("participants", pid); await upd("participants", pid, { status: "eingesammelt", finished_at: toPb() }); log(room.id, p, "Prüfung eingesammelt", "", "aktion"); }
  toast("Prüfung eingesammelt", `${v.length} Prüfung${v.length > 1 ? "en wurden" : " wurde"} eingesammelt.`);
}
async function endExam(room) {
  const act = inRoom(room).filter((p) => isActive(p.status) && p.status !== "zeit_beendet");
  const ok = await confirmBox("Prüfung beenden", `<p>Sind Sie sicher, dass Sie die Prüfung für alle Teilnehmenden beenden möchten?</p>${act.length ? `<p>Es gibt noch <b>${act.length}</b> Teilnehmende, deren Bearbeitungszeit nicht abgelaufen ist.</p>` : ""}`, "Prüfung beenden");
  if (!ok) return;
  for (const p of inRoom(room)) if ((isCollectable(p.status) || p.status.startsWith("wartend")) ) await upd("participants", p.id, { status: "beendet", finished_at: p.finished_at || toPb() });
  await upd("rooms", room.id, { state: "TERMINATED" });
  log(room.id, null, "Prüfung wurde beendet", "", "aktion", actor());
  toast("Prüfung beendet", "Die Prüfung wurde für alle Teilnehmenden beendet.");
}
async function incident(room) {
  const v = await modal({ title: "Besondere Vorkommnisse", headIcon: icon("message-square-warning", "lg"),
    body: `<div class="field"><label class="lbl">Kommentar (verpflichtend)</label><textarea class="input" data-c placeholder="z. B. Feueralarm, Stromausfall …"></textarea></div>
      <div class="field"><label class="lbl">Globale Zeitverlängerung (optional)</label><select class="select" data-t><option value="0">-- Minuten</option>${[5, 10, 15, 20, 30].map((m) => `<option value="${m}">${m} Minuten</option>`).join("")}</select></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const c = m.querySelector("[data-c]").value.trim(); if (!c) { m.querySelector("[data-c]").style.borderColor = "var(--red)"; return; } close({ c, t: +m.querySelector("[data-t]").value }); }) });
  if (!v) return;
  if (v.t) await upd("rooms", room.id, { global_extra: (room.global_extra || 0) + v.t });
  log(room.id, null, "Besonderes Vorkommnis", v.c + (v.t ? ` (globale Zeitverlängerung +${v.t} Min.)` : ""), "vorkommnis", actor());
  toast("Das besondere Vorkommnis wurde erfolgreich dokumentiert und im Prüfungsprotokoll gespeichert.");
}
async function setPresent(room, p, val) {
  const patch = { present: val };
  if (val && (room.state === "RUNNING") && p.status === "wartend_bestaetigt") { patch.status = "laeuft"; patch.started_at = toPb(); }
  await upd("participants", p.id, patch);
  log(room.id, p, val ? "Anwesenheit festgestellt" : "Anwesenheit entfernt", "", "aktion");
}

// ---------- Tab Prüfung ----------
const dtLocal = (d) => (d ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
function tabDistanz(room) {
  const locked = windowState(room) === "after";
  return `<div style="max-width:620px"><div class="notice info mb">${icon("house")}<span><b>Distanzunterricht.</b> Die Teilnehmenden bearbeiten die Einheit innerhalb des Zeitraums selbstständig und starten sie selbst. Es gibt keine direkte Steuerung durch die Lehrkraft und keine Sitzordnung.</span></div>
  <div class="field"><label class="lbl" for="ds-n">Bezeichnung</label><input id="ds-n" class="input" data-d="name" value="${esc(room.name)}"></div>
  <div class="grid2"><div class="field"><label class="lbl" for="ds-f">Zeitraum von</label><input id="ds-f" class="input" type="datetime-local" data-d="window_from" value="${dtLocal(parseDate(room.window_from))}"></div>
  <div class="field"><label class="lbl" for="ds-t">Zeitraum bis</label><input id="ds-t" class="input" type="datetime-local" data-d="window_to" value="${dtLocal(parseDate(room.window_to))}"></div></div>
  <div class="field"><label class="lbl" for="ds-du">Bearbeitungszeit (Minuten)</label><input id="ds-du" class="input" type="number" min="5" data-d="duration_min" value="${room.duration_min}"><p class="xs muted" style="margin:4px 0 0">Beginnt mit dem Start durch die Teilnehmenden und endet spätestens mit dem Ende des Zeitraums.</p></div>
  <div class="field"><label class="checkbox"><input type="checkbox" data-dc="repeatable" ${room.repeatable ? "checked" : ""}> Mehrfach durchlaufbar (z. B. zur Prüfungsvorbereitung)</label></div>
  <div class="field"><label class="checkbox"><input type="checkbox" data-dc="show_horizon" ${room.show_horizon ? "checked" : ""}> Erwartungshorizont nach Abschluss anzeigen</label></div>
  ${locked ? `<p class="xs muted">Der Zeitraum ist beendet. Sie können ihn verlängern, indem Sie das Ende neu festlegen.</p>` : ""}
  <div class="row end mt"><button class="btn" data-dsave>${icon("save")} Speichern</button><a class="btn primary" href="#/app/raum/${room.id}/teilnehmende">${icon("arrow-right")} Teilnehmende bearbeiten</a></div></div>`;
}
function bindDistanz(el, room) {
  const b = el.querySelector("[data-dsave]"); if (!b) return;
  b.onclick = async () => {
    const o = {}; el.querySelectorAll("[data-d]").forEach((f) => (o[f.dataset.d] = f.value));
    const a = new Date(o.window_from), z = new Date(o.window_to);
    if (!o.name.trim() || isNaN(a) || isNaN(z) || z <= a) { toast("Angaben prüfen", "Bezeichnung und ein gültiger Zeitraum (Ende nach Beginn) sind erforderlich.", "error"); return; }
    const patch = { name: o.name.trim(), window_from: toPb(a), window_to: toPb(z), planned_start: toPb(a), duration_min: Math.max(5, +o.duration_min || 45) };
    el.querySelectorAll("[data-dc]").forEach((f) => (patch[f.dataset.dc] = f.checked));
    await upd("rooms", room.id, patch); log(room.id, null, "Einstellungen der Distanzeinheit geändert", `${fmtDateTime(a)}–${fmtDateTime(z)}`, "aktion", actor()); toast("Einstellungen gespeichert");
  };
}
function tabPruefung(room) {
  if (isDistance(room)) return tabDistanz(room);
  const exams = [...new Set(D.rooms.map((r) => r.exam_name).filter(Boolean))];
  const ps = parseDate(room.planned_start); const ds = ps ? new Date(ps.getTime() - ps.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : "";
  const locked = room.state !== "CREATED";
  return `<div style="max-width:${isVirtual(room) ? 760 : 520}px">${locked ? `<div class="notice warn mb">${icon("lock")}<span><span>Die Prüfung wurde bereits gestartet. Einstellungen sind schreibgeschützt.</span></span></div>` : ""}
  <div class="field"><label class="lbl">Zugeordnete Prüfung</label><select class="select" data-f="exam_name" ${locked ? "disabled" : ""}><option value="">Prüfung auswählen</option>${exams.map((e) => `<option ${e === room.exam_name ? "selected" : ""}>${esc(e)}</option>`).join("")}</select></div>
  <div class="field"><label class="lbl">Frühester Prüfungsstartzeitpunkt</label><div class="inline-fields"><input class="input" type="date" data-f="date" value="${ds}" ${locked ? "disabled" : ""}><input class="input" type="time" data-f="start_earliest" value="${esc(room.start_earliest)}" ${locked ? "disabled" : ""}></div></div>
  <div class="field"><label class="lbl">Spätester Prüfungsstartzeitpunkt</label><div class="inline-fields"><input class="input" type="date" value="${ds}" disabled><input class="input" type="time" data-f="start_latest" value="${esc(room.start_latest)}" ${locked ? "disabled" : ""}></div></div>
  <div class="field"><label class="lbl">Zugeordnete Bearbeitungszeit (Minuten)</label><input class="input" type="number" data-f="duration_min" value="${room.duration_min}" ${locked ? "disabled" : ""}></div>
  <div class="field"><label class="lbl">Geplantes Bearbeitungszeitende</label><input class="input" readonly value="${fmtTime(plannedEnd(room))} Uhr"></div>
  ${placeSection(room, locked)}
  <div class="field"><label class="checkbox"><input type="checkbox" data-lock ${room.lockdown ? "checked" : ""}> Vollbildmodus erzwingen</label><p class="xs muted" style="margin:4px 0 0 28px">Die Bearbeitung ist nur im Vollbildmodus möglich. Tab- oder Fensterwechsel werden nicht protokolliert.</p></div>
  <div class="row end mt">${locked ? "" : `<button class="btn" data-save>${icon("save")} Speichern</button>`}<a class="btn primary" href="#/app/raum/${room.id}/teilnehmende">${icon("arrow-right")} Teilnehmende bearbeiten</a></div></div>`;
}
// Raum bzw. Sitzordnung in den Einstellungen
const SEAT_EDIT = new Map(); // Raum-ID -> bearbeitete Sitzordnung (Unterricht)
function placeSection(room, locked) {
  if (isVirtual(room)) {
    const v = SEAT_EDIT.get(room.id) || { capacity: seatCount(room) || room.capacity, layout: layoutOf(room), cols: room.cols || 5, group_size: room.group_size || 4 };
    SEAT_EDIT.set(room.id, v);
    return `<div class="field"><label class="lbl" for="pl-n">Bezeichnung</label><input id="pl-n" class="input" data-f="name" value="${esc(room.name)}" ${locked ? "disabled" : ""}></div>
    <h3 class="mt">Sitzordnung <span class="badge cyan">ohne realen Raum</span></h3><p class="xs muted">Im Unterricht legen Sie Anzahl und Anordnung der Sitzplätze selbst fest. Bereits zugeordnete Teilnehmende ohne passenden Platz erscheinen unter „Ohne gültigen Sitzplatz“.</p>
    <div data-seathost>${seatingForm(v, locked)}</div>`;
  }
  const ps = parseDate(room.planned_start);
  const vs = venuesOf(room.org);
  return `<div class="field"><label class="lbl" for="pl-v">Zugeordneter Prüfungsraum</label><select id="pl-v" class="select" data-f="venue" ${locked ? "disabled" : ""}>${room.venue ? "" : `<option value="">Raum auswählen</option>`}${vs.map((x) => { const hit = venueConflict(x.id, room, room.id); return `<option value="${x.id}" ${x.id === room.venue ? "selected" : ""} ${hit && x.id !== room.venue ? "disabled" : ""}>${esc(x.name)} · ${seatCount(x)} Plätze${hit ? ` – ${esc(conflictText(hit))}` : ""}</option>`; }).join("")}</select>
    <p class="xs muted" style="margin:4px 0 0">${esc(describe(room))}. Ein realer Raum kann je Zeitraum nur einmal belegt werden${ps ? "" : ""}.</p></div>`;
}
function bindPruefung(el, room) {
  if (isDistance(room)) return bindDistanz(el, room);
  const host = el.querySelector("[data-seathost]"); if (host && room.state === "CREATED") bindSeating(host, SEAT_EDIT.get(room.id));
  const lk = el.querySelector("[data-lock]"); if (lk) lk.onchange = async () => { await upd("rooms", room.id, { lockdown: lk.checked }); log(room.id, null, lk.checked ? "Vollbildmodus erzwungen" : "Vollbildmodus nicht erzwungen", "", "aktion", actor()); toast("Einstellung gespeichert"); };
  const s = el.querySelector("[data-save]"); if (!s) return;
  s.onclick = async () => {
    const o = {}; el.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value));
    const planned = new Date(`${o.date}T${o.start_earliest || "08:00"}`);
    const patch = { exam_name: o.exam_name, start_earliest: o.start_earliest, start_latest: o.start_latest, duration_min: +o.duration_min, planned_start: toPb(planned) };
    if (isVirtual(room)) { if (!o.name?.trim()) { toast("Bezeichnung fehlt", "Bitte geben Sie eine Bezeichnung ein.", "error"); return; } Object.assign(patch, { name: o.name.trim() }, seatingValues(SEAT_EDIT.get(room.id))); }
    else if (o.venue) { const x = byId("venues", o.venue); const hit = venueConflict(o.venue, patch, room.id); if (hit) { toast("Raum bereits belegt", conflictText(hit), "error"); return; } Object.assign(patch, { venue: x.id, name: x.name, capacity: x.capacity, rows: x.rows, cols: x.cols, layout: x.layout || "reihen", group_size: +x.group_size || 0 }); }
    try { await upd("rooms", room.id, patch); } catch (e) { toast("Nicht gespeichert", e?.response?.message || e?.message || "", "error"); return; }
    SEAT_EDIT.delete(room.id);
    log(room.id, null, "Prüfungseinstellungen geändert", "", "aktion", actor());
    toast("Einstellungen gespeichert");
  };
}

export async function simulateOffline(room, p, secs = 20) {
  await upd("participants", p.id, { offline_until: toPb(new Date(Date.now() + secs * 1000)) });
  log(room.id, p, "Verbindung unterbrochen", `Simulation, ${secs} s`, "system");
  toast("Verbindungsabbruch simuliert", `${p.lastname}, ${p.firstname} ist für ${secs} Sekunden offline. Danach geht es automatisch weiter (wird protokolliert).`, "info");
}

// ---------- Tab Mein Raum ----------
function seatCard(room, p, seat, compact = false) {
  if (!p) return compact ? `<div class="seat empty mini"><span class="no">${seat}</span></div>` : `<div class="seat empty"><div class="sh" style="border:none"><span class="no">${seat}</span></div><div class="sb"><span class="small">frei</span><button class="btn sm" data-addseat="${seat}">${icon("plus")} zuordnen</button></div></div>`;
  const c = isConnected(p);
  const e = isActive(p.status) && endTime(room, p);
  const flags = "";
  if (compact) return `<button class="seat mini ${p.present ? "" : "absent"} ${MR.status && p.status !== MR.status ? "dim" : ""} ${MR.q && !(p.lastname + " " + p.firstname + " " + p.username).toLowerCase().includes(MR.q.toLowerCase()) ? "dim" : ""}" data-details="${p.id}" title="${esc(p.lastname)}, ${esc(p.firstname)} – ${esc(STATUS[p.status])}${c ? "" : " – nicht verbunden"}">
    <span class="row between" style="width:100%"><span class="no">${esc(seat)}</span><span class="connico ${connOf(p).key === "ok" ? "on" : connOf(p).key === "none" ? "none" : "off"}" data-conn="${p.id}" title="${connOf(p).label}">${icon(connOf(p).icon)}</span></span>
    <span class="st-dot st-${p.status}"></span><span class="nm">${esc(p.lastname)}</span>${flags ? `<span class="row" style="gap:2px">${flags}</span>` : ""}${p.nta ? `<span class="xs" title="Nachteilsausgleich">NTA+${p.nta}′</span>` : ""}${p.extra_time ? `<span class="xs" title="Zusatzzeit">ZZ+${p.extra_time}′</span>` : ""}</button>`;
  return `<div class="seat ${p.present ? "" : "absent"}"><div class="sh"><span class="no">${esc(seat)}</span>
    <label class="toggle" title="Anwesenheit"><input type="checkbox" data-present="${p.id}" ${p.present ? "checked" : ""} ${room.state === "TERMINATED" ? "disabled" : ""} aria-label="Anwesenheit ${esc(p.lastname)}"><span></span></label>
    ${connChip(p, true).replace("<span ", "<span data-compact ")}</div>${connOf(p).key === "lost" ? `<div class="seatwarn">${icon("wifi-off")} ${esc(connOf(p).short)}</div>` : ""}
    <div class="sb">${statusChip(p.status)}<span class="nm">${esc(p.lastname)}, ${esc(p.firstname)}</span>${e ? `<span class="timeleft" data-left="${p.id}"></span>` : ""}<span class="row wrap" style="gap:4px;justify-content:center">${timeBadges(p)}${flags}</span></div>
    <div class="sf"><button class="btn block sm" data-details="${p.id}">${icon("arrow-right")} Details</button></div></div>`;
}
function tabMeinRaum(room) {
  const ps = inRoom(room);
  if (!ps.length) return `<div class="row between mb"><button class="btn" data-addtn>${icon("plus")} Teilnehmende hinzufügen</button></div><div class="card empty">${icon("users")}<h3>Diesem Raum sind noch keine Teilnehmenden zugeordnet</h3><p>Fügen Sie Teilnehmende hinzu, um den Sitzplan zu füllen.</p><button class="btn primary" data-addtn>${icon("plus")} Teilnehmende hinzufügen</button></div>`;
  const compact = seatCount(room) > 60;
  const map = seatMap(room, compact);
  const bySeat = Object.fromEntries(ps.map((p) => [p.seat, p]));
  const counts = {}; ps.forEach((p) => (counts[p.status] = (counts[p.status] || 0) + 1));
  const off = ps.filter((p) => isActive(p.status) && !isConnected(p)).length;
  let grid = "";
  for (const st of map.seats) grid += seatCard(room, bySeat[st.id], st.id, compact).replace(' class="seat', ` style="${posStyle(st)}" class="seat`);
  const unseated = ps.filter((p) => !validSeat(room, p.seat));
  return `<p class="row small">${icon("info")} <span>${seatScheme(room)} ${isVirtual(room) ? `<span class="badge cyan">${esc(describe(room))} · ohne realen Raum</span>` : ""}</span></p>
  <div class="row between wrap mb"><div class="row wrap"><button class="btn" data-addtn>${icon("plus")} Teilnehmende hinzufügen</button><button class="btn ghost sm" data-simulate title="Simuliert die Anmeldung der übrigen Teilnehmenden">${icon("users")} Demo: übrige Teilnehmende anmelden</button></div>
    <div class="row wrap"><div class="legend small">${Object.entries(counts).map(([s, n]) => `<button class="legend-btn ${MR.status === s ? "on" : ""}" data-fst="${s}" title="Nach Status filtern">${statusChip(s)} ${n}</button>`).join("")}${off ? `<span class="badge red">${icon("radio")} ${off} nicht verbunden</span>` : ""}</div><button class="helpbtn" data-symbols aria-label="Hilfe zur Symbolik"><span class="q">?</span></button></div></div>
  ${compact ? `<div class="notice info small mb">${icon("users")}<span><b>Großraum mit ${ps.length} Teilnehmenden:</b> kompakte Sitzplanansicht. Platz anklicken für Details, Status in der Legende antippen zum Hervorheben.</span></div>
    <div class="row wrap mb"><div class="search"><input class="input" style="width:260px" data-mrq placeholder="Name oder Anmeldename suchen" value="${esc(MR.q)}" aria-label="Teilnehmende im Sitzplan suchen">${icon("search")}</div>${MR.status || MR.q ? `<button class="btn ghost sm" data-mrclear>${icon("x")} Hervorhebung aufheben</button>` : ""}</div>` : ""}
  <div class="seatgrid ${compact ? "compact" : ""} lay-${map.layout}" style="${gridStyle(map)}">${grid}</div>
  ${unseated.length ? `<h3 class="mt-l">Ohne gültigen Sitzplatz</h3><div class="seatgrid mt-s" style="--cols:5">${unseated.map((p) => seatCard(room, p, p.seat || "–")).join("")}</div>` : ""}
  <div class="tafel">Tafel</div>`;
}
function bindMeinRaum(el, room) {
  el.querySelectorAll("[data-present]").forEach((t) => (t.onchange = () => setPresent(room, byId("participants", t.dataset.present), t.checked)));
  el.querySelectorAll("[data-details]").forEach((b) => (b.onclick = () => detailsModal(room, byId("participants", b.dataset.details))));
  el.querySelectorAll("[data-addtn]").forEach((b) => (b.onclick = () => addParticipants(room)));
  el.querySelectorAll("[data-addseat]").forEach((b) => (b.onclick = () => addParticipants(room, b.dataset.addseat)));
  const sim = el.querySelector("[data-simulate]");
  if (sim) sim.onclick = async () => { const r = await demoApi.simulateLogin(room.id); toast("Simulation", `${r.count} Teilnehmende haben sich angemeldet.`, "info"); };
  const sy = el.querySelector("[data-symbols]"); if (sy) sy.onclick = symbolHelp;
  el.querySelectorAll("[data-fst]").forEach((b) => (b.onclick = () => { MR.status = MR.status === b.dataset.fst ? "" : b.dataset.fst; redraw(); }));
  const q = el.querySelector("[data-mrq]"); if (q) q.oninput = () => { MR.q = q.value; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-mrq]"); n.focus(); n.setSelectionRange(pos, pos); };
  const mc = el.querySelector("[data-mrclear]"); if (mc) mc.onclick = () => { MR.status = ""; MR.q = ""; redraw(); };
}
function symbolHelp() {
  directHelp(`<div class="tablewrap mt"><table class="tbl"><thead><tr><th>Symbolik</th><th>Beschreibung</th></tr></thead><tbody>
  <tr><td><span class="connchip ok">${icon("wifi")}angemeldet · verbunden</span></td><td>Der Prüfling ist angemeldet und sendet regelmäßig Lebenszeichen (alle 10 s).</td></tr>
  <tr><td><span class="connchip lost">${icon("wifi-off")}angemeldet · keine Verbindung</span></td><td>Der Prüfling ist angemeldet, aber seit mehr als 30 s ohne Lebenszeichen (Netz getrennt, Browser geschlossen) oder ein Verbindungsabbruch wird simuliert. Er arbeitet nach Wiederverbindung ohne neue Anmeldung weiter.</td></tr>
  <tr><td><span class="connchip none">${icon("user-round-x")}nicht angemeldet</span></td><td>Der Prüfling hat sich noch nicht angemeldet.</td></tr>
  <tr><td><span class="timebadge nta">NTA +15 Min.</span> <span class="timebadge zz">Zusatzzeit +5 Min.</span> <span class="timebadge gz">Raum +10 Min.</span></td><td>Zeitgutschriften werden getrennt ausgewiesen: Nachteilsausgleich, individuelle Zusatzzeit und Zusatzzeit für den gesamten Raum.</td></tr>
  <tr><td><label class="toggle"><input type="checkbox" checked disabled><span></span></label></td><td>Der Prüfling ist anwesend.</td></tr>
  <tr><td><label class="toggle"><input type="checkbox" disabled><span></span></label></td><td>Der Prüfling ist nicht anwesend.</td></tr>
  ${Object.keys(STATUS).map((s) => `<tr><td>${statusChip(s)}</td><td>${{ nicht_eingeloggt: "Hat sich noch nicht angemeldet.", wartend: "Im Wartebereich, Bestätigungen offen.", wartend_bestaetigt: "Im Wartebereich, Belehrung und Gesundheitsabfrage bestätigt.", laeuft: "Bearbeitet die Prüfung.", pausiert: "Prüfung individuell pausiert.", gesperrt: "Zugang durch die Aufsicht gesperrt.", eingesammelt: "Prüfung durch die Aufsicht eingesammelt.", zeit_beendet: "Bearbeitungszeit abgelaufen – Prüfung läuft weiter, neue Aufgaben gesperrt.", abgegeben: "Prüfling hat selbst abgegeben – Bearbeitung gesperrt, Abschluss durch die Aufsicht.", beendet: "Prüfung beendet.", nicht_teilnahme: "Gesundheitsabfrage nicht bestätigt." }[s]}</td></tr>`).join("")}
  </tbody></table></div>`);
}
async function detailsModal(room, p) {
  const others = D.rooms.filter((r) => r.id !== room.id);
  const taken = new Set(inRoom(room).map((x) => x.seat));
  const free = freeSeats(room, taken);
  const e = endTime(room, p) || plannedEnd(room, p);
  const act = isActive(p.status); const dist = isDistance(room);
  const v = await modal({ title: `<span class="row" style="justify-content:space-between;width:100%"><label class="toggle" ${dist ? "hidden" : ""}><input type="checkbox" data-pres ${p.present ? "checked" : ""}><span></span></label>${connChip(p)}<span>${esc(p.seat || "–")}</span></span>`, size: "narrow",
    body: `<div style="text-align:center"><h3>${esc(p.lastname)}, ${esc(p.firstname)}</h3><div class="small">Anmeldename: <b>${esc(p.username)}</b></div><div class="mt-s">${statusChip(p.status)}</div></div>
    ${dist ? `<div class="notice info small mt">${icon("house")}<span>Distanzunterricht: keine Steuerung durch die Lehrkraft. ${p.started_at ? `Gestartet ${fmtDateTime(parseDate(p.started_at))}` : "Noch nicht gestartet"} · Durchlauf ${p.attempt || 1}.</span></div>` : ""}
    <div class="row mt" style="justify-content:center;gap:16px;${dist ? "display:none" : ""}">
      <button class="btn" style="flex-direction:column;width:110px;height:86px;background:var(--bg-soft)" data-value="pause" ${act ? "" : "disabled"}>${icon(p.status === "pausiert" ? "play" : "pause", "xl")}${p.status === "pausiert" ? "Fortsetzen" : "Pausieren"}</button>
      <button class="btn" style="flex-direction:column;width:110px;height:86px;background:var(--bg-soft)" data-value="lock" ${act ? "" : "disabled"}>${icon(p.status === "gesperrt" ? "lock" : "ban", "xl")}${p.status === "gesperrt" ? "Entsperren" : "Sperren"}</button>
      <button class="btn" style="flex-direction:column;width:110px;height:86px;background:var(--bg-soft)" data-value="collect" ${act ? "" : "disabled"}>${icon("download", "xl")}Einsammeln</button></div>
    <p class="small" style="text-align:center">Individuelles Bearbeitungszeitende: <b>${fmtTime(e)} Uhr</b>${timeBadges(p, room) ? `<br><span class="row wrap mt-s" style="justify-content:center;gap:4px">inkl. ${timeBadges(p, room)}</span>` : ""}</p>
    ${connOf(p).key === "lost" ? `<div class="notice warn small">${icon("wifi-off")}<span>${esc(connOf(p).label)} – ${esc(connOf(p).tip)}</span></div>` : ""}
    ${p.status === "abgegeben" ? `<div class="notice success small">${icon("flag")}<span>Prüfling hat selbst abgegeben – Bearbeitung gesperrt. Final abschließen durch Einsammeln oder Prüfung beenden.</span></div>` : ""}
    ${p.status === "zeit_beendet" ? `<div class="notice warn small">${icon("alarm-clock")}<span>Bearbeitungszeit abgelaufen – Prüfung läuft weiter, neue Aufgaben sind gesperrt. Ende durch Einsammeln.</span></div>` : ""}
    <div class="field"><label class="lbl">Zusatzzeit (individuell, z. B. nach Störung)</label><select class="select" data-f="extra_time">${[0, 5, 10, 15, 20, 30].map((m) => `<option value="${m}" ${m === (p.extra_time || 0) ? "selected" : ""}>${m ? m + " Minuten" : "-- Minuten"}</option>`).join("")}</select></div>
    <div class="field"><label class="lbl">Kommentar</label><textarea class="input" data-f="comment" maxlength="150" placeholder="Hier Kommentar eingeben (max. 150 Zeichen)">${esc(p.comment)}</textarea></div>
    <div class="field"><label class="lbl">Nachteilsausgleich (NTA, vorab genehmigt)</label>${room.state !== "CREATED" ? `<p class="xs muted" style="margin:0 0 4px">${icon("lock")} Nur vor dem Prüfungsstart änderbar. Für Störungen während der Prüfung nutzen Sie die Zusatzzeit.</p>` : ""}<select class="select" data-f="nta" ${room.state !== "CREATED" ? "disabled" : ""}>${[0, 10, 15, 20, 30, 45].map((m) => `<option value="${m}" ${m === (p.nta || 0) ? "selected" : ""}>${m ? m + " Minuten" : "-- Minuten"}</option>`).join("")}</select></div>
    <div class="field" ${dist ? "hidden" : ""}><label class="lbl">Sitzplatz ändern</label><select class="select" data-f="seat"><option value="${esc(p.seat)}">${esc(p.seat || "–")} (aktuell)</option>${free.map((s) => `<option>${s}</option>`).join("")}</select></div>
    <div class="field"><label class="lbl">Versetzung in anderen Raum</label><select class="select" data-f="move"><option value="">Raum auswählen</option>${others.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join("")}</select></div>`,
    footer: `<details class="demo-tests"><summary class="xs muted">Testfälle (Demo)</summary><div class="row wrap mt-s"><button class="btn xs" data-value="offline">${icon("radio")} Verbindungsabbruch 20 s</button></div></details><button class="btn primary block" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      m.querySelector("[data-pres]").onchange = (ev) => setPresent(room, p, ev.target.checked);
      m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value)); close(o); };
    } });
  if (!v) return;
  if (v === "pause") { const to = p.status === "pausiert" ? "laeuft" : "pausiert"; await upd("participants", p.id, { status: to }); log(room.id, p, to === "pausiert" ? "Prüfung für Teilnehmende/n pausiert" : "Prüfung für Teilnehmende/n fortgesetzt", "", "aktion"); toast(to === "pausiert" ? "Prüfung pausiert" : "Prüfung fortgesetzt", `${p.lastname}, ${p.firstname}`, "info"); return; }
  if (v === "lock") { const to = p.status === "gesperrt" ? "laeuft" : "gesperrt"; await upd("participants", p.id, { status: to }); log(room.id, p, to === "gesperrt" ? "Teilnehmende/r wurde gesperrt" : "Teilnehmende/r wurde entsperrt", "", "vorkommnis"); toast(to === "gesperrt" ? "Teilnehmende/r gesperrt" : "Teilnehmende/r entsperrt", `${p.lastname}, ${p.firstname}`, "info"); return; }
  if (v === "offline") { await simulateOffline(room, p); return; }
  if (v === "collect") { if (await confirmBox("Prüfung einsammeln", `Die Prüfung von ${esc(p.firstname)} ${esc(p.lastname)} wird unwiderruflich eingesammelt.`, "Einsammeln")) { await upd("participants", p.id, { status: "eingesammelt", finished_at: toPb() }); log(room.id, p, "Prüfung eingesammelt", "", "aktion"); toast("Prüfung eingesammelt", `${p.lastname}, ${p.firstname}`); } return; }
  const ntaLocked = room.state !== "CREATED"; if (ntaLocked) v.nta = p.nta || 0; // NTA nur vor Prüfungsstart
  const patch = { extra_time: +v.extra_time, comment: v.comment, seat: v.seat, ...(ntaLocked ? {} : { nta: +v.nta }) };
  const changes = [];
  if (+v.extra_time !== (p.extra_time || 0)) changes.push(`Zusatzzeit ${v.extra_time} Min.`);
  if (+v.nta !== (p.nta || 0)) changes.push(`Nachteilsausgleich ${v.nta} Min.`);
  if (v.seat !== p.seat) changes.push(`Sitzplatz ${p.seat} → ${v.seat}`);
  if (v.comment !== p.comment) changes.push("Kommentar geändert");
  if (v.move) { patch.room = v.move; patch.seat = ""; changes.push("Versetzung nach " + byId("rooms", v.move)?.name); }
  await upd("participants", p.id, patch);
  if (changes.length) log(room.id, p, "Teilnehmerdetails geändert", changes.join(", "), "aktion");
  toast("Änderungen gespeichert", `${p.lastname}, ${p.firstname}`);
}
async function addParticipants(room, seat) {
  // Kandidaten: Teilnehmende des Kurses (bei Prüfungen: Personen der Schule des Raums), die noch keinem Raum dieses Kurses zugeordnet sind
  const c = courseOf(room);
  const assigned = new Set(D.participants.filter((x) => x.room && (x.room === room.id || (c && byId("rooms", x.room)?.course === c.id))).map((x) => x.person).filter(Boolean));
  const fromCourse = c ? roomCandidates(room, "teilnehmer").filter((x) => !assigned.has(x.id)).map((x) => ({ id: "p:" + x.id, lastname: x.lastname, firstname: x.firstname, username: x.username, group_name: D.groups.filter((g) => (g.members || []).includes(x.id) && g.source !== "kurs").map((g) => g.name).join(", "), org: orgShort(x.org) })) : [];
  const legacy = c ? [] : D.participants.filter((x) => !x.room);
  const cand = [...fromCourse, ...legacy.map((x) => ({ id: x.id, lastname: x.lastname, firstname: x.firstname, username: x.username, group_name: x.group_name, org: x.org }))].sort((a, b) => a.lastname.localeCompare(b.lastname));
  const used = inRoom(room).length;
  const v = await modal({ title: "Teilnehmende hinzufügen", size: "wide",
    body: `<div class="row between wrap mb"><div class="notice success small">${icon("circle-check")}<span>Es sind aktuell <b>${used} von ${seatCount(room)} Sitzplätzen</b> belegt.</span></div>
      <div class="search" style="width:300px"><input class="input" data-s placeholder="Suchen …" title="Sie können nach folgenden Parametern suchen: Vorname, Nachname, Anmeldename, Gruppe oder Organisation">${icon("search")}</div></div>
      <p class="xs muted">${c ? `Zur Auswahl stehen die Teilnehmenden des Kurses „${esc(c.title)}“${c.kind === "pruefung" ? " Ihrer Schule" : ""}, die noch keiner Raumaufsicht dieses Kurses zugeordnet sind. Weitere Personen fügen Sie im Kurs unter „Mitglieder“ hinzu.` : "Sie können nach Vorname, Nachname, Anmeldename, Gruppe oder Organisation suchen."}</p>
      <div class="tablewrap" style="max-height:340px"><table class="tbl"><thead><tr><th><input type="checkbox" data-all aria-label="Alle auswählen"></th><th>Nachname</th><th>Vorname</th><th>Anmeldename</th><th>Gruppe</th><th>Organisation</th></tr></thead>
      <tbody>${cand.length ? cand.map((p) => `<tr data-row="${esc((p.lastname + " " + p.firstname + " " + p.username + " " + p.group_name + " " + p.org).toLowerCase())}"><td><input type="checkbox" data-p="${p.id}"></td><td>${esc(p.lastname)}</td><td>${esc(p.firstname)}</td><td>${esc(p.username)}</td><td>${esc(p.group_name)}</td><td>${esc(p.org)}</td></tr>`).join("") : `<tr><td colspan="6"><div class="empty">Keine weiteren Teilnehmenden verfügbar${c ? ` – fügen Sie im Kurs <a href="#/app/kurs/${c.id}/mitglieder">Mitglieder</a> hinzu` : ""}</div></td></tr>`}</tbody></table></div>`,
    footer: `<button class="btn ghost" data-allbtn>Alle Teilnehmenden hinzufügen</button><span class="grow"></span><button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Teilnehmende hinzufügen</button>`,
    onMount: (m, close) => {
      const s = m.querySelector("[data-s]");
      s.oninput = () => m.querySelectorAll("[data-row]").forEach((r) => (r.style.display = r.dataset.row.includes(s.value.toLowerCase()) ? "" : "none"));
      const all = m.querySelector("[data-all]"); if (all) all.onchange = () => m.querySelectorAll("[data-p]").forEach((c) => { if (c.closest("tr").style.display !== "none") c.checked = all.checked; });
      m.querySelector("[data-allbtn]").onclick = () => close(cand.map((p) => p.id));
      m.querySelector("[data-ok]").onclick = () => close([...m.querySelectorAll("[data-p]:checked")].map((c) => c.dataset.p));
    } });
  if (!v || !v.length) return;
  const seats = seatCount(room);
  if (used + v.length > seats) {
    modal({ title: isVirtual(room) ? "Zu wenige Sitzplätze" : "Zu viele Teilnehmende für den Raum", warn: true, size: "narrow", body: `<p>Sie haben ${v.length} Teilnehmende ausgewählt, es sind jedoch nur noch <b>${Math.max(0, seats - used)}</b> Sitzplätze frei.</p><p>${isVirtual(room) ? "Erhöhen Sie die Anzahl der Sitzplätze im Reiter „Prüfung“ oder reduzieren Sie die Auswahl." : "Bitte reduzieren Sie die Auswahl oder wählen Sie im Reiter „Prüfung“ einen größeren freien Raum."}</p>`, footer: `<button class="btn primary" data-close>Verstanden</button>` });
    return;
  }
  const taken = new Set(inRoom(room).map((x) => x.seat));
  const free = freeSeats(room, taken);
  if (seat) { free.splice(free.indexOf(seat), 1); free.unshift(seat); }
  for (const [i, key] of v.entries()) {
    let p;
    if (key.startsWith("p:")) {
      // Person aus dem Kurs: vorhandene freie Teilnahme wiederverwenden oder neu anlegen
      const pe = byId("persons", key.slice(2));
      const free0 = D.participants.find((x) => x.person === pe.id && !x.room);
      const data = { room: room.id, seat: free[i] || "", status: "nicht_eingeloggt", present: false };
      p = free0 ? await upd("participants", free0.id, data) : await create("participants", { ...data, lastname: pe.lastname, firstname: pe.firstname, username: pe.username, person: pe.id, org: byId("orgs", pe.org)?.name || "", group_name: D.groups.filter((g) => (g.members || []).includes(pe.id) && g.source !== "kurs").map((g) => g.name)[0] || "", extra_time: 0, nta: 0, comment: "", health: "", cheat_ack: false, bookmarks: [], violations: 0 });
    } else { p = byId("participants", key); await upd("participants", key, { room: room.id, seat: free[i] || "", status: "nicht_eingeloggt", present: false }); }
    log(room.id, p, "Teilnehmende/r zur Raumaufsicht hinzugefügt", "Platz " + (free[i] || "–"), "aktion");
  }
  toast("Teilnehmende hinzugefügt", `${v.length} Teilnehmende wurden dem Raum hinzugefügt.`);
}

// ---------- Tab Teilnehmende ----------
function tabTeilnehmende(room) {
  const st = S.tn; const all = inRoom(room); const big = isLargeRoom(room); const dist = isDistance(room);
  const ps = all.filter((p) => (!st.status || p.status === st.status) && (!st.q || (p.lastname + " " + p.firstname + " " + p.username + " " + p.seat).toLowerCase().includes(st.q.toLowerCase())));
  const counts = {}; all.forEach((p) => (counts[p.status] = (counts[p.status] || 0) + 1));
  const off = all.filter((p) => isActive(p.status) && !isConnected(p)).length;
  const key = { seat: (p) => p.seat, lastname: (p) => p.lastname, firstname: (p) => p.firstname, status: (p) => p.status, end: (p) => (endTime(room, p) || plannedEnd(room, p))?.getTime() || 0 }[st.sort] || ((p) => p.seat);
  const cmp = (x, y) => (typeof x === "number" ? x - y : st.sort === "seat" ? seatCmp(x, y) : String(x).localeCompare(String(y), "de", { numeric: true }));
  const sorted = [...ps].sort((a, b) => cmp(key(a), key(b)) * st.dir);
  const page = sorted.slice((st.page - 1) * st.per, st.page * st.per);
  const th = (k, l) => `<th class="sortable" data-sort="${k}">${icon(st.sort === k ? (st.dir > 0 ? "chevron-up" : "chevron-down") : "list")} ${l}</th>`;
  return `${dist ? `<div class="notice info small mb">${icon("house")}<span><b>Distanzunterricht:</b> Die Teilnehmenden starten die Einheit innerhalb des Zeitraums selbst. Sie sehen hier Status und Fortschritt; eine Steuerung (Start, Sperre, Pause, Einsammeln) ist nicht vorgesehen.</span></div>` : ""}${big ? `<div class="notice info small mb">${icon("users")}<span><b>Großraum mit ${all.length} Teilnehmenden:</b> Ab ${PLAN_MAX + 1} Teilnehmenden wird kein Sitzplan angezeigt („Mein Raum“ ist ausgegraut). Anwesenheit, Verbindung, Status und Details steuern Sie hier in der Liste – mit Suche und Statusfilter.</span></div>
  <div class="row between wrap mb"><div class="row wrap"><div class="search"><input class="input" style="width:260px" data-tnq placeholder="Name, Anmeldename oder Platz" value="${esc(st.q || "")}" aria-label="Teilnehmende suchen">${icon("search")}</div><button class="btn ghost sm" data-simulate>${icon("users")} Demo: übrige Teilnehmende anmelden</button></div>
    <div class="legend small">${Object.entries(counts).map(([k, n]) => `<button class="legend-btn ${st.status === k ? "on" : ""}" data-tnst="${k}" title="Nach Status filtern">${statusChip(k)} ${n}</button>`).join("")}${off ? `<span class="badge red">${icon("radio")} ${off} nicht verbunden</span>` : ""}</div></div>` : ""}
  <div class="row between wrap mb"><div class="row wrap"><button class="btn" data-addtn>${icon("plus")} Teilnehmende hinzufügen</button><div class="notice success small">${icon("circle-check")}<span>${dist ? `<b>${all.length} Teilnehmende</b> zugeordnet · ${all.filter((p) => isFinished(p.status)).length} abgeschlossen · ${all.filter((p) => isActive(p.status)).length} in Bearbeitung` : `Es sind aktuell <b>${all.length} von ${seatCount(room)} Sitzplätzen</b> im Raum belegt.`}</span></div></div>
    <div class="row wrap"><button class="btn" data-delgrp ${ps.length ? "" : "disabled"}>${icon("users")} Gruppe entfernen</button><button class="btn" data-deltn ${st.sel.size ? "" : "disabled"}>${icon("trash-2")} Ausgewählte entfernen${st.sel.size ? ` (${st.sel.size})` : ""}</button></div></div>
  ${ps.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th><input type="checkbox" data-all aria-label="Alle auswählen"></th>${th("lastname", "Name")}${dist ? "<th>Durchlauf</th><th>Start</th>" : `${th("seat", "Platz")}<th>Anwesend</th>`}<th>Anmeldung / Verbindung</th>${th("status", "Status")}<th>Zeitgutschrift</th>${th("end", "Ende")}<th><span class="sr-only">Details</span></th></tr></thead>
  <tbody>${page.map((p) => `<tr><td><input type="checkbox" data-sel="${p.id}" ${st.sel.has(p.id) ? "checked" : ""} aria-label="${esc(p.lastname)} auswählen"></td><td><b>${esc(p.lastname)}, ${esc(p.firstname)}</b><div class="sub">${esc(p.username)}</div></td><td>${dist ? `<span class="xs muted">${(p.attempt || 1) > 1 || isFinished(p.status) ? `Durchlauf ${p.attempt || 1}` : "–"}</span>` : esc(p.seat)}</td>
    <td>${dist ? `<span class="xs muted">${p.started_at ? "gestartet " + fmtDateTime(parseDate(p.started_at)) : "noch nicht gestartet"}</span>` : `<label class="toggle"><input type="checkbox" data-present="${p.id}" ${p.present ? "checked" : ""} aria-label="Anwesenheit ${esc(p.lastname)}"><span></span></label>`}</td>
    <td>${connChip(p)}</td>
    <td>${statusChip(p.status)}</td><td><span class="row wrap" style="gap:3px">${timeBadges(p, room) || "–"}</span></td><td class="nowrap">${fmtTime(endTime(room, p) || plannedEnd(room, p))} Uhr</td>
    <td class="nowrap"><button class="iconbtn" data-rmtn="${p.id}" title="Aus der Raumaufsicht entfernen" aria-label="${esc(p.lastname)}, ${esc(p.firstname)} aus der Raumaufsicht entfernen">${icon("trash-2")}</button><button class="iconbtn" data-details="${p.id}" title="Teilnehmerdetails" aria-label="Teilnehmerdetails ${esc(p.lastname)}">${icon("arrow-right")}</button></td></tr>`).join("")}</tbody></table>${pager(ps.length, st.page, st.per, [5, 10, 25, 100])}</div>`
  : `<div class="tablewrap"><div class="empty">${icon("users")}<h3>Keine Einträge</h3><p>Diesem Raum sind noch keine Teilnehmenden zugeordnet.</p></div></div>`}`;
}
function bindTeilnehmende(el, room) {
  const st = S.tn;
  bindPager(el, st, redraw);
  el.querySelectorAll("[data-sort]").forEach((h) => (h.onclick = () => { if (st.sort === h.dataset.sort) st.dir *= -1; else { st.sort = h.dataset.sort; st.dir = 1; } redraw(); }));
  el.querySelectorAll("[data-sel]").forEach((c) => (c.onchange = () => { c.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); redraw(); }));
  const all = el.querySelector("[data-all]"); if (all) all.onchange = () => { el.querySelectorAll("[data-sel]").forEach((c) => (all.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel))); redraw(); };
  el.querySelectorAll("[data-present]").forEach((t) => (t.onchange = () => setPresent(room, byId("participants", t.dataset.present), t.checked)));
  el.querySelectorAll("[data-details]").forEach((b) => (b.onclick = () => detailsModal(room, byId("participants", b.dataset.details))));
  el.querySelectorAll("[data-addtn]").forEach((b) => (b.onclick = () => addParticipants(room)));
  const d = el.querySelector("[data-deltn]");
  if (d) d.onclick = () => removeParticipants(room, [...st.sel].map((id) => byId("participants", id)).filter(Boolean));
  el.querySelectorAll("[data-rmtn]").forEach((b) => (b.onclick = () => removeParticipants(room, [byId("participants", b.dataset.rmtn)].filter(Boolean))));
  const g = el.querySelector("[data-delgrp]"); if (g) g.onclick = () => removeGroupDialog(room);
  el.querySelectorAll("[data-tnst]").forEach((b) => (b.onclick = () => { st.status = st.status === b.dataset.tnst ? "" : b.dataset.tnst; st.page = 1; redraw(); }));
  const q = el.querySelector("[data-tnq]"); if (q) q.oninput = () => { st.q = q.value; st.page = 1; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-tnq]"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
  const sim = el.querySelector("[data-simulate]"); if (sim) sim.onclick = async () => { const r = await demoApi.simulateLogin(room.id); toast("Simulation", `${r.count} Teilnehmende haben sich angemeldet.`, "info"); };
}

// Teilnehmende einzeln, als Auswahl oder als ganze Gruppe (Klasse/Kurs) aus der Raumaufsicht entfernen
async function removeParticipants(room, list, title = "Teilnehmende entfernen") {
  if (!list.length) return;
  const ok = await confirmBox(title, `<p>${list.length === 1 ? "Folgende Person wird" : `Folgende ${list.length} Teilnehmende werden`} aus der Raumaufsicht entfernt:</p><ul style="max-height:220px;overflow:auto">${list.map((p) => `<li>${esc(p.lastname)}, ${esc(p.firstname)}${p.seat ? ` (Platz ${esc(p.seat)})` : ""}</li>`).join("")}</ul>${room.state !== "CREATED" ? `<div class="notice warn">${icon("triangle-alert")}<span>Die Prüfung wurde bereits gestartet. Bisherige Eingaben bleiben erhalten; die Entfernung wird protokolliert.</span></div>` : ""}<p class="small muted">Die Personen bleiben Mitglieder des Kurses und können später wieder zugeordnet werden.</p>`, "Entfernen");
  if (!ok) return;
  for (const p of list) { await upd("participants", p.id, { room: "", seat: "", present: false, status: "nicht_eingeloggt" }); log(room.id, p, "Teilnehmende/r aus der Raumaufsicht entfernt", "", "aktion"); }
  S.tn.sel.clear(); toast("Teilnehmende entfernt", `${list.length} Teilnehmende wurden aus der Raumaufsicht entfernt.`);
}
async function removeGroupDialog(room) {
  const ps = inRoom(room);
  const gs = D.groups.map((g) => ({ g, l: ps.filter((p) => p.person && (g.members || []).includes(p.person)) })).filter((x) => x.l.length).sort((a, b) => a.g.name.localeCompare(b.g.name));
  if (!gs.length) { toast("Keine Gruppen", "Die zugeordneten Teilnehmenden gehören keiner Klasse bzw. keinem Kurs an.", "info"); return; }
  const v = await modal({ title: "Gruppe aus der Raumaufsicht entfernen", size: "narrow",
    body: `<p class="small">Alle Teilnehmenden der gewählten Klasse bzw. des Kurses werden aus dieser Raumaufsicht entfernt.</p>${gs.map((x, i) => `<label class="checkbox" style="display:flex;margin:8px 0"><input type="radio" name="rg" value="${x.g.id}" ${i ? "" : "checked"}> <b>${esc(x.g.name)}</b>&nbsp;<span class="muted small">${x.l.length} in diesem Raum${x.g.source === "kurs" ? " · eigene Gruppe" : ""}</span></label>`).join("")}`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Weiter</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close(m.querySelector("[name=rg]:checked")?.value)) });
  if (!v) return;
  const x = gs.find((y) => y.g.id === v);
  await removeParticipants(room, x.l, `Gruppe „${x.g.name}“ entfernen`);
}

// ---------- Tab Aufsichtspersonen ----------
// Mehrere Aufsichtszeiträume je Person (z. B. Aufsicht mit Unterbrechung); ältere Daten: from/to als ein Zeitraum
export const periodsOf = (s) => (s?.periods?.length ? s.periods : s?.from ? [{ from: s.from, to: s.to }] : []);
async function periodsDialog(room, s) {
  let rows = periodsOf(s).map((p) => ({ ...p })); if (!rows.length) rows.push({ from: room.start_earliest || "", to: "" });
  const v = await modal({ title: "Aufsichtszeiträume festlegen", size: "narrow",
    body: `<p><b>${esc(s.lastname)}, ${esc(s.firstname)}</b> (${esc(s.short)})</p><p class="xs muted">Übernimmt die Person die Aufsicht mehrfach mit Unterbrechung, legen Sie je Einsatz einen eigenen Zeitraum an. Im Prüfungsprotokoll erhält jeder Zeitraum ein Unterschriftsfeld.</p><div data-rows></div>
      <button class="btn sm" data-addp>${icon("plus")} Zeitraum hinzufügen</button><div class="xs mt-s" style="color:var(--red)" data-err></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount(m, close) {
      const read = () => { rows = [...m.querySelectorAll("[data-row]")].map((r) => ({ from: r.querySelector("[data-from]").value, to: r.querySelector("[data-to]").value })); };
      const draw = () => {
        m.querySelector("[data-rows]").innerHTML = rows.map((p, i) => `<div class="row" data-row style="gap:8px;align-items:flex-end;margin-bottom:8px"><span class="badge gray" style="margin-bottom:10px">${i + 1}</span><div class="grow"><label class="lbl">Von</label><input class="input" type="time" data-from value="${esc(p.from)}" aria-label="Zeitraum ${i + 1} von"></div><div class="grow"><label class="lbl">Bis</label><input class="input" type="time" data-to value="${esc(p.to)}" aria-label="Zeitraum ${i + 1} bis"></div><button class="iconbtn" data-rm="${i}" aria-label="Zeitraum ${i + 1} entfernen" title="Zeitraum entfernen" ${rows.length < 2 ? "disabled" : ""}>${icon("trash-2")}</button></div>`).join("");
        m.querySelectorAll("[data-rm]").forEach((x) => (x.onclick = () => { read(); rows.splice(+x.dataset.rm, 1); draw(); }));
      };
      m.querySelector("[data-addp]").onclick = () => { read(); const last = rows[rows.length - 1]; rows.push({ from: last?.to || "", to: "" }); draw(); };
      m.querySelector("[data-ok]").onclick = () => {
        read(); const err = m.querySelector("[data-err]");
        const list = rows.filter((p) => p.from || p.to).sort((a, b) => a.from.localeCompare(b.from));
        if (list.some((p) => !p.from)) { err.textContent = "Bitte für jeden Zeitraum eine Startzeit angeben."; return; }
        if (list.some((p) => p.to && p.to <= p.from)) { err.textContent = "Das Ende eines Zeitraums muss nach dessen Beginn liegen."; return; }
        for (let i = 1; i < list.length; i++) if (!list[i - 1].to || list[i].from < list[i - 1].to) { err.textContent = "Die Zeiträume dürfen sich nicht überschneiden."; return; }
        close(list);
      };
      draw();
    } });
  if (!v) return;
  await upd("supervisors", s.id, { periods: v, from: v[0]?.from || "", to: v[v.length - 1]?.to || "" });
  const txt = v.map((p) => `${p.from} – ${p.to || "offen"} Uhr`).join(", ");
  log(room.id, null, `Aufsichtszeiträume ${s.lastname} festgelegt`, txt, "aktion", s.username);
  toast("Aufsichtszeiträume gespeichert", `${s.lastname}: ${txt}`);
}
function tabAufsicht(room) {
  const st = S.sv; const list = D.supervisors.filter((s) => s.room === room.id);
  const page = list.slice((st.page - 1) * st.per, st.page * st.per);
  return `<div class="row between mb"><button class="btn" data-addsv>${icon("plus")} Aufsichtspersonen hinzufügen</button><button class="btn" data-delsv ${st.sel.size ? "" : "disabled"}>${icon("trash-2")} Aufsichtspersonen löschen</button></div>
  <div class="tablewrap">${list.length ? `<table class="tbl"><thead><tr><th><input type="checkbox" data-all aria-label="Alle"></th><th>Nachname</th><th>Vorname</th><th>Kürzel</th><th>Anmeldename</th><th>Anwesenheit</th><th>Aufsichtszeiträume</th><th></th></tr></thead>
  <tbody>${page.map((s) => `<tr><td><input type="checkbox" data-sel="${s.id}" ${st.sel.has(s.id) ? "checked" : ""}></td><td>${esc(s.lastname)}</td><td>${esc(s.firstname)}</td><td>${esc(s.short)}</td><td>${esc(s.username)}</td><td><label class="toggle"><input type="checkbox" data-svp="${s.id}" ${s.present ? "checked" : ""}><span></span></label></td><td>${periodsOf(s).length ? periodsOf(s).map((p) => `<div class="nowrap">${esc(p.from || "–")} – ${esc(p.to || "offen")} Uhr</div>`).join("") : "–"}</td><td><button class="linkarrow" data-period="${s.id}">${icon("arrow-right")} Zeiträume festlegen</button></td></tr>`).join("")}</tbody></table>${pager(list.length, st.page, st.per, [5, 10])}`
  : `<div class="empty">${icon("users")}<h3>Keine Einträge</h3><p>Noch keine Aufsichtspersonen zugeordnet.</p></div>`}</div>`;
}
function bindAufsicht(el, room) {
  const st = S.sv;
  bindPager(el, st, redraw);
  el.querySelectorAll("[data-sel]").forEach((c) => (c.onchange = () => { c.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel); redraw(); }));
  const all = el.querySelector("[data-all]"); if (all) all.onchange = () => { el.querySelectorAll("[data-sel]").forEach((c) => (all.checked ? st.sel.add(c.dataset.sel) : st.sel.delete(c.dataset.sel))); redraw(); };
  el.querySelectorAll("[data-svp]").forEach((t) => (t.onchange = () => { const s = byId("supervisors", t.dataset.svp); upd("supervisors", s.id, { present: t.checked }); log(room.id, null, `Anwesenheit Aufsicht ${s.lastname}: ${t.checked ? "anwesend" : "abwesend"}`, "", "aktion", s.username); }));
  el.querySelectorAll("[data-period]").forEach((b) => (b.onclick = () => periodsDialog(room, byId("supervisors", b.dataset.period))));
  el.querySelector("[data-addsv]").onclick = async () => {
    // Aufsichtspersonen aus dem Kurs: Prüfung → Rolle „Raumaufsicht“ (Schule des Raums), Unterricht → Lehrkräfte des Kurses
    const c = courseOf(room);
    const have = new Set(D.supervisors.filter((s) => s.room === room.id).map((s) => s.person || s.lastname));
    const cand = roomCandidates(room, "aufsicht").filter((pe) => !have.has(pe.id));
    const v = await modal({ title: "Aufsichtspersonen hinzufügen", size: "wide", body: `<p class="xs muted">${c?.kind === "pruefung" ? `Zur Auswahl stehen Personen mit der Rolle „Raumaufsicht“ in der Prüfung „${esc(c.title)}“ (Schule ${esc(orgShort(room.org))}). Weitere ordnet die Schuladministration unter Prüfungen › Mitglieder zu.` : c ? `Zur Auswahl stehen die Lehrkräfte des Unterrichts „${esc(c.title)}“ (Besitzer und Mitbetreuung).` : ""}</p>
      <div class="tablewrap"><table class="tbl"><thead><tr><th></th><th>Nachname</th><th>Vorname</th><th>Kürzel</th><th>Schule</th></tr></thead><tbody>${cand.length ? cand.map((pe) => `<tr><td><input type="checkbox" data-i="${pe.id}" aria-label="${esc(personName(pe))}"></td><td>${esc(pe.lastname)}</td><td>${esc(pe.firstname)}</td><td>${esc(pe.short || "")}</td><td>${esc(c?.kind === "pruefung" ? orgShort(room.org) : orgsLabel(pe))}</td></tr>`).join("") : `<tr><td colspan="5"><div class="empty small">Keine weiteren Personen verfügbar${c ? ` – Mitglieder verwalten Sie im <a href="#/app/kurs/${c.id}/mitglieder">Kurs</a>` : ""}</div></td></tr>`}</tbody></table></div>`,
      footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Aufsichtspersonen hinzufügen</button>`, onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close([...m.querySelectorAll("[data-i]:checked")].map((x) => byId("persons", x.dataset.i)))) });
    if (!v || !v.length) return;
    for (const pe of v) { await create("supervisors", { lastname: pe.lastname, firstname: pe.firstname, short: pe.short || "", username: pe.username, person: pe.id, room: room.id, present: false, from: room.start_earliest, to: "", periods: [{ from: room.start_earliest || "", to: "" }] }); log(room.id, null, `Aufsichtsperson ${pe.lastname}, ${pe.firstname} hinzugefügt`, "", "aktion", actor()); }
    toast("Aufsichtsperson hinzugefügt", v.map((x) => x.lastname).join(", "));
  };
  el.querySelector("[data-delsv]").onclick = async () => {
    const list = [...st.sel].map((id) => byId("supervisors", id)).filter(Boolean);
    if (!(await confirmBox("Aufsichtspersonen löschen", list.map((s) => `${esc(s.lastname)}, ${esc(s.firstname)}`).join("<br>"), "Löschen"))) return;
    const { del } = await import("../data.js?v=9.1");
    for (const s of list) { await del("supervisors", s.id); log(room.id, null, `Aufsichtsperson ${s.lastname} entfernt`, "", "aktion", actor()); }
    st.sel.clear(); toast("Aufsichtspersonen entfernt");
  };
}

// ---------- Tab Prüfungsprotokoll ----------
function protocolRows(room) {
  const st = S.pr;
  let rows = D.protocol.filter((x) => x.room === room.id).sort((a, b) => (a.ts > b.ts ? 1 : -1) * st.dir);
  if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter((r) => st.filters.some((f) => String(r[f] || "").toLowerCase().includes(q)) || (st.filters.includes("participant") && r.username.toLowerCase().includes(q))); }
  return rows;
}
function tabProtokoll(room) {
  const st = S.pr; const rows = protocolRows(room);
  const page = rows.slice((st.page - 1) * st.per, st.page * st.per);
  return `<div class="row between wrap mb">${ddHtml("pf", "Filtern nach", [["participant", "Betroffene Benutzer"], ["seat", "Sitzplatz"], ["action", "Aktion"], ["comment", "Kommentar"]], st.filters, st)}<div class="search"><input class="input" style="width:260px" placeholder="Suchen" data-q value="${esc(st.q)}">${icon("search")}</div></div>
  <div class="tablewrap"><table class="tbl"><thead><tr><th class="sortable" data-tsort>${icon(st.dir > 0 ? "chevron-up" : "chevron-down")} Zeitstempel</th><th>Teilnehmende</th><th>Anmeldename</th><th>Sitzplatz</th><th>Aktion</th><th>Kommentar</th></tr></thead>
  <tbody>${page.length ? page.map((r) => `<tr><td class="nowrap">${fmtDateTime(parseDate(r.ts))}</td><td>${esc(r.participant)}</td><td>${esc(r.username)}</td><td>${esc(r.seat)}</td><td>${r.kind === "vorkommnis" ? `<span class="badge red">${icon("message-square-warning")} </span> ` : ""}${esc(r.action)}</td><td><button class="iconbtn" data-cmt="${r.id}" aria-label="Kommentar bearbeiten">${icon("pencil")}</button> ${esc(r.comment)}</td></tr>`).join("") : `<tr><td colspan="6"><div class="empty">Keine Einträge</div></td></tr>`}</tbody></table>${pager(rows.length, st.page, st.per, [5, 10, 25, 50])}</div>`;
}
function bindProtokoll(el, room) {
  const st = S.pr;
  bindPager(el, st, redraw);
  bindDd(el, st, (k, v) => { st.filters = v; }, redraw);
  el.querySelector("[data-tsort]").onclick = () => { st.dir *= -1; redraw(); };
  const q = el.querySelector("[data-q]"); q.oninput = () => { st.q = q.value; st.page = 1; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); };
  el.querySelectorAll("[data-cmt]").forEach((b) => (b.onclick = async () => {
    const r = byId("protocol", b.dataset.cmt);
    const v = await modal({ title: "Kommentar bearbeiten", size: "narrow", body: `<label class="lbl">Kommentar</label><textarea class="input" data-c>${esc(r.comment)}</textarea>`, footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`, onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close(m.querySelector("[data-c]").value)) });
    if (v !== null && v !== undefined) { await upd("protocol", r.id, { comment: v }); toast("Kommentar gespeichert"); }
  }));
}
function downloadProtocol(room) { import("./protocolpdf.js?v=9.1").then((m) => m.protocolPdf(room)); }

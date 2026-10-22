// Ergebnisse (Task 28/30/36) und Prüfungseinsicht (Task 37/38)
import { D, byId, upd, setting, setSetting } from "../data.js?v=8.4";
import { icon, esc, toast, confirmBox, brand, modal } from "../ui.js?v=8.4";
import { EXAM, ALL_SUBTASKS, TOTAL_POINTS, CORRECTORS } from "../scenario.js?v=8.4";
import { navigate, redraw, session } from "../app.js?v=8.4";
import { grading, stPoints, candidates, fmtP } from "./correction.js?v=8.4";
import { linearGrade, fmtNote, noteBucket, overall, approvalState, keyTable, dkThreshold } from "../grades.js?v=8.4";
import { me, courseOf, courseOfParticipant, canCorrect, isTeacherOf, thirdRequested, orgShort } from "../access.js?v=8.4";
import { roPaper, fitRoPapers } from "./kmode.js?v=8.4";

// Endpunkte je Teilaufgabe: Endbeurteilung (falls angefordert und erfasst), sonst Mittelwert Erst/Zweit, sonst Erstkorrektur
export function finalPoints(pid, st) {
  const v = (c) => stPoints(grading(pid, c), st);
  const p = byId("participants", pid); const third = thirdRequested(courseOfParticipant(p), p);
  const d = third ? v(3) : null, a = v(1), b = v(2);
  if (d !== null) return { v: d, src: "EB" };
  if (a !== null && b !== null) return { v: Math.round(((a + b) / 2) * 2) / 2, src: "Ø EK/ZK" };
  if (a !== null) return { v: a, src: "EK" };
  return { v: null, src: "" };
}
export function totals(pid) {
  let sum = 0, complete = true; const per = {};
  ALL_SUBTASKS.forEach((s) => { const f = finalPoints(pid, s.no); per[s.no] = f; if (f.v === null) complete = false; else sum += f.v; });
  const o = overall(byId("participants", pid));
  return { sum, complete: o.note !== null, per, ek: o.ek.pts, zk: o.zk.pts, dk: o.dk.pts, note: o.note, o };
}
export const grade = (pts) => linearGrade(pts);
const GRADE_TXT = { 1: "sehr gut", 2: "gut", 3: "befriedigend", 4: "ausreichend", 5: "mangelhaft", 6: "ungenügend" };

// Teilnehmende der Ergebnisübersicht (rechtebasiert): Schuladministration – Prüfungen der eigenen Schule;
// Korrektor:in – Prüflinge der eigenen Korrektorengruppen; Lehrkraft – Teilnehmende des eigenen Unterrichts
export function resultParticipants() {
  const pe = me(); const role = session.role;
  const withSubs = new Set(D.items.filter((i) => i.submission && i.participant).map((i) => i.participant));
  return D.participants.filter((p) => {
    if (!withSubs.has(p.id)) return false; const r = byId("rooms", p.room); const c = courseOf(r); if (!c) return false;
    if (!pe) return c.kind === "pruefung";
    if (role === "schuladmin" || pe.kind === "schuladmin") return c.kind === "pruefung" && r.org === pe.org;
    if (role === "lehrkraft") return c.kind === "unterricht" && isTeacherOf(c, pe.id);
    return c.kind === "pruefung" && [1, 2, 3].some((st) => canCorrect(c, p, st, pe.id));
  }).sort((a, b) => a.lastname.localeCompare(b.lastname));
}
const stCell = (r, a) => `<td class="num">${r.pts === null ? "–" : fmtP(r.pts)}${r.any && !r.complete ? `<div class="xs muted">unvollständig</div>` : ""}</td><td class="num">${r.note === null ? "–" : `<b>${fmtNote(r.note)}</b>`}${a && a.of && r.any ? `<div class="xs ${a.final ? "" : "muted"}">${a.final ? "final" : `${a.n}/${a.of} freigegeben`}</div>` : ""}</td>`;

// ---------- Ergebnisübersicht ----------
export function overview() {
  return {
    shell: "staff", rail: "ergebnisse", title: "Ergebnisse",
    render() {
      const pe = me(); const adm = pe?.kind === "schuladmin"; const lesson = session.role === "lehrkraft";
      const ps = resultParticipants();
      const rows = ps.map((p) => ({ p, t: totals(p.id), a1: approvalState(p, 1), a2: approvalState(p, 2), a3: approvalState(p, 3) }));
      const done = rows.filter((r) => r.t.note !== null);
      const notes = done.map((r) => r.t.note);
      const avgN = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;
      const avg = done.length ? done.reduce((a, r) => a + r.t.sum, 0) / done.length : null;
      const dist = [1, 2, 3, 4, 5, 6].map((g) => notes.filter((x) => noteBucket(x) === g).length);
      const maxD = Math.max(1, ...dist);
      const pass = done.length ? Math.round((notes.filter((g) => g <= 4.0 + 1e-9).length / done.length) * 100) : null;
      const rec = rows.filter((r) => r.t.o.recommend && !r.t.o.third);
      const released = !!setting("einsicht", {}).released;
      const course = ps.map((p) => courseOfParticipant(p)).find(Boolean);
      const stStats = ALL_SUBTASKS.map((s) => { const vals = ps.map((p) => finalPoints(p.id, s.no).v).filter((x) => x !== null); const m = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; return { s, n: vals.length, m, pct: m === null ? 0 : Math.round((m / s.points) * 100), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null }; });
      const head = lesson
        ? `<tr><th>Name</th><th>Vorname</th><th>Anmeldename</th><th class="num">Punkte</th><th class="num">Note</th><th>Status</th><th></th></tr>`
        : `<tr><th rowspan="2">Name</th><th rowspan="2">Vorname</th><th rowspan="2">Anmeldename</th><th colspan="2" class="ctr"><i class="cdot" style="background:${CORRECTORS[1].color}"></i> Erstkorrektur</th><th colspan="2" class="ctr"><i class="cdot" style="background:${CORRECTORS[2].color}"></i> Zweitkorrektur</th><th colspan="2" class="ctr"><i class="cdot" style="background:${CORRECTORS[3].color}"></i> Endbeurteilung</th><th rowspan="2" class="num">Gesamtnote</th><th rowspan="2">Hinweis</th>${adm ? `<th rowspan="2">Drittkorrektur</th>` : ""}<th rowspan="2"></th></tr>
           <tr><th class="num">Punkte</th><th class="num">Note</th><th class="num">Punkte</th><th class="num">Note</th><th class="num">Punkte</th><th class="num">Note</th></tr>`;
      const body = rows.map(({ p, t, a1, a2, a3 }) => {
        const o = t.o;
        if (lesson) return `<tr><td>${esc(p.lastname)}</td><td>${esc(p.firstname)}</td><td>${esc(p.username)}</td>${stCell(o.ek, a1)}<td>${o.ek.complete ? (a1.final ? `<span class="badge green">final</span>` : `<span class="badge cyan">bewertet</span>`) : `<span class="badge gray">offen</span>`}</td><td><a class="linkarrow" href="#/app/einsicht/${p.id}">${icon("eye")} Einsicht</a></td></tr>`;
        const both = a1.final && a2.final;
        const hint = o.third ? `<span class="badge purple">Drittkorrektur angefordert</span>` : o.recommend ? `<span class="badge yellowb" title="Abweichung der Noten aus Erst- und Zweitkorrektur: ${fmtNote(o.diff)}">${icon("triangle-alert")} Drittkorrektur empfohlen (Δ ${fmtNote(o.diff)})</span>` : o.diff !== null ? `<span class="xs muted">Δ ${fmtNote(o.diff)}</span>` : "";
        const act = !adm ? "" : `<td>${o.third ? (o.dk.any ? `<span class="xs muted">läuft</span>` : `<button class="btn sm ghost" data-dk="${p.id}" data-on="0">${icon("x")} zurücknehmen</button>`) : `<button class="btn sm ${o.recommend ? "primary" : ""}" data-dk="${p.id}" data-on="1" ${both ? "" : `disabled title="Erst nach Abschluss (finaler Freigabe) von Erst- und Zweitkorrektur"`}>${icon("file-pen-line")} anfordern</button>`}</td>`;
        return `<tr class="${o.recommend && !o.third ? "recrow" : ""}"><td>${esc(p.lastname)}</td><td>${esc(p.firstname)}</td><td>${esc(p.username)}</td>${stCell(o.ek, a1)}${stCell(o.zk, a2)}${o.third ? stCell(o.dk, a3) : `<td class="num muted" title="Nicht angefordert">–</td><td class="num muted" title="Nicht angefordert">–</td>`}<td class="num">${o.note === null ? "–" : `<b class="big-note">${fmtNote(o.note)}</b><div class="xs muted">${esc(o.src)}</div>`}</td><td>${hint}</td>${act}<td><a class="iconbtn" href="#/app/einsicht/${p.id}" title="Prüfungseinsicht" aria-label="Prüfungseinsicht ${esc(p.lastname)}">${icon("eye")}</a></td></tr>`;
      }).join("");
      return `<div class="pagehead"><div><h1>Ergebnisse</h1><div class="sub">${lesson ? "Unterricht · eine Korrektur je Teilnehmende/r" : `${esc(EXAM.name)}${adm ? ` · Prüflinge Ihrer Schule (${esc(orgShort(pe.org))})` : " · Prüflinge Ihrer Korrektorengruppen"}`}</div></div>
        <div class="row wrap"><button class="btn" data-key>${icon("sigma")} Notenschlüssel</button><a class="btn" href="#/app/korrektur">${icon("file-pen-line")} Zur Korrektur</a><button class="btn" data-csv>${icon("download")} CSV exportieren</button>
        ${adm ? `<button class="btn ${released ? "" : "primary"}" data-einsicht>${icon(released ? "lock" : "eye")} ${released ? "Einsicht-Freigabe zurückziehen" : "Prüfungseinsicht freigeben"}</button>` : ""}</div></div>
      ${released ? `<div class="notice success mb">${icon("circle-check")}<span>Die Prüfungseinsicht ist freigegeben. Prüflinge sehen Punkte, Begründungen und Korrekturzeichen nach Prüfungsende.</span></div>` : ""}
      ${adm && rec.length ? `<div class="notice warn mb">${icon("triangle-alert")}<span><b>Drittkorrektur empfohlen</b> für ${rec.length} Prüfling${rec.length === 1 ? "" : "e"}: Die Noten aus Erst- und Zweitkorrektur weichen um mindestens ${fmtNote(dkThreshold(course))} Notenstufen voneinander ab. Ob eine Endbeurteilung erfolgt, entscheiden Sie. Ohne Drittkorrektur gilt der Mittelwert.</span></div>` : ""}
      <div class="statgrid">
        <div class="stat"><div class="small muted">Prüflinge mit Abgaben</div><div class="v">${ps.length}</div></div>
        <div class="stat"><div class="small muted">Mit Gesamtnote</div><div class="v">${done.length}</div><div class="xs muted">${ps.length - done.length} offen</div></div>
        <div class="stat"><div class="small muted">Ø Punkte</div><div class="v">${avg === null ? "–" : fmtP(Math.round(avg * 10) / 10)}</div><div class="xs muted">von ${TOTAL_POINTS}</div></div>
        <div class="stat"><div class="small muted">Ø Note</div><div class="v">${avgN === null ? "–" : fmtNote(Math.round(avgN * 10) / 10)}</div></div>
        <div class="stat"><div class="small muted">Bestehensquote</div><div class="v">${pass === null ? "–" : pass + " %"}</div><div class="xs muted">Note 4,0 oder besser</div></div>
      </div>
      <h2 class="mt-l mb">Ergebnisübersicht</h2>
      <div class="tablewrap"><table class="tbl restbl"><thead>${head}</thead><tbody>${body || `<tr><td colspan="13"><div class="empty">Keine Ergebnisse für Ihr Konto</div></td></tr>`}</tbody></table></div>
      <p class="xs muted mt-s">Noten nach <b>linearem Notenschlüssel</b> bezogen auf ${TOTAL_POINTS} Punkte: Note = 6 − 5 · Punkte / ${TOTAL_POINTS}, auf eine Nachkommastelle abgerundet. ${lesson ? "Im Unterricht gibt es genau eine Korrektur." : "Gesamtnote: Mittelwert der Noten aus Erst- und Zweitkorrektur; wurde eine Drittkorrektur angefordert, entscheidet die Endbeurteilung. Werte stammen aus den Korrekturen und aktualisieren sich automatisch."}</p>
      <div class="resgrid mt-l">
        <section class="card pad"><h3>Notenspiegel</h3><p class="xs muted">Prüflinge mit Gesamtnote (n = ${done.length}), gerundet auf ganze Noten</p>
          <div class="barchart" role="img" aria-label="Notenspiegel: ${dist.map((n, i) => `Note ${i + 1}: ${n}`).join(", ")}">
            ${dist.map((n, i) => `<div class="bcol" tabindex="0" data-tip="Note ${i + 1} (${GRADE_TXT[i + 1]}): ${n} Prüfling${n === 1 ? "" : "e"}"><span class="bval">${n}</span><div class="bar" style="height:${(n / maxD) * 100}%"></div><span class="blab">${i + 1}</span></div>`).join("")}
          </div><div class="xs muted" style="text-align:center">Note</div></section>
        <section class="card pad"><h3>Aufgabenstatistik</h3><p class="xs muted">Durchschnittlich erreichte Punkte je Teilaufgabe (Endpunkte)</p>
          <table class="tbl small"><thead><tr><th>Teilaufgabe</th><th class="num">Ø Punkte</th><th style="width:40%">Erreichungsgrad</th><th class="num">min–max</th><th class="num">n</th></tr></thead><tbody>
          ${stStats.map((x) => `<tr><td>${x.s.no} ${esc(x.s.title)}</td><td class="num">${x.m === null ? "–" : fmtP(Math.round(x.m * 10) / 10)} / ${x.s.points}</td><td><div class="hbar" data-tip="${x.pct} % der Maximalpunkte"><i style="width:${x.pct}%"></i></div><span class="xs">${x.m === null ? "" : x.pct + " %"}</span></td><td class="num">${x.min === null ? "–" : fmtP(x.min) + "–" + fmtP(x.max)}</td><td class="num">${x.n}</td></tr>`).join("")}</tbody></table></section>
      </div>`;
    },
    mount(el) {
      el.querySelector("[data-key]").onclick = () => keyDialog();
      el.querySelector("[data-csv]").onclick = () => {
        const head = ["Nachname", "Vorname", "Anmeldename", "EK Punkte", "EK Note", "ZK Punkte", "ZK Note", "Endbeurteilung Punkte", "Endbeurteilung Note", "Gesamtnote", "Drittkorrektur"];
        const n = (x) => (x === null || x === undefined ? "" : String(x).replace(".", ","));
        const lines = resultParticipants().map((p) => { const o = overall(p); return [p.lastname, p.firstname, p.username, n(o.ek.pts), n(o.ek.note), n(o.zk.pts), n(o.zk.note), n(o.third ? o.dk.pts : null), n(o.third ? o.dk.note : null), n(o.note), o.third ? "angefordert" : o.recommend ? "empfohlen" : ""]; });
        const csv = [head, ...lines].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); a.download = "Ergebnisuebersicht_FA230.csv"; a.click();
        toast("CSV exportiert", a.download, "info");
      };
      el.querySelectorAll("[data-dk]").forEach((b) => (b.onclick = async () => {
        const p = byId("participants", b.dataset.dk); const c = courseOfParticipant(p); const on = b.dataset.on === "1";
        if (on && !(await confirmBox("Drittkorrektur anfordern", `<p>Für <b>${esc(p.lastname)}, ${esc(p.firstname)}</b> wird eine Endbeurteilung (Drittkorrektur) angefordert. Die zugewiesene Korrektorengruppe der Endbeurteilung erhält Zugriff; ihre Note wird zur Gesamtnote.</p>`, "Anfordern", "Abbrechen", false))) return;
        const third = { ...(c.third || {}) }; if (on) third[p.id] = { requested: true, by: me()?.id || "", at: new Date().toISOString() }; else delete third[p.id];
        await upd("courses", c.id, { third });
        toast(on ? "Drittkorrektur angefordert" : "Anforderung zurückgenommen", `${p.lastname}, ${p.firstname}`, on ? "success" : "info");
      }));
      const ei = el.querySelector("[data-einsicht]");
      if (ei) ei.onclick = async () => {
        const rel = !!setting("einsicht", {}).released;
        if (!rel && !(await confirmBox("Prüfungseinsicht freigeben", "Prüflinge können nach Prüfungsende ihre Punkte, Begründungen und die Korrekturzeichen aller Korrekturen einsehen. Interne Kommentare bleiben verborgen.", "Freigeben", "Abbrechen", false))) return;
        await setSetting("einsicht", { released: !rel }); toast(rel ? "Einsicht-Freigabe zurückgezogen" : "Prüfungseinsicht freigegeben");
      };
    },
  };
}
// Notenschlüssel (linear, angepasst an die Maximalpunktzahl)
// Notenschlüssel-Tabelle: Maximalpunktzahl wählbar (Schlüssel wird linear angepasst), Schrittweite ganze oder halbe Punkte
function keyHtml(max, step) {
  const rows = keyTable(max, step); const per = Math.ceil(rows.length / 6);
  const cols = Array.from({ length: Math.ceil(rows.length / per) }, (_, i) => rows.slice(i * per, (i + 1) * per));
  return `<div class="keygrid">${cols.map((c) => `<table class="tbl compact"><thead><tr><th class="num">Punkte</th><th class="num">Note</th></tr></thead><tbody>${c.map(([p, n]) => `<tr><td class="num">${fmtP(p)}</td><td class="num">${fmtNote(n)}</td></tr>`).join("")}</tbody></table>`).join("")}</div>`;
}
function keyDialog() {
  modal({ title: "Notenschlüssel (linear)", size: "wide",
    body: `<p class="small">Note = 6 − 5 · Punkte / Maximalpunkte, auf eine Nachkommastelle zugunsten des Prüflings abgerundet. Bei 100 Punkten entspricht dies dem Schlüssel „Notenschlüssel 100 P“ (100 P → 1,0; 50 P → 3,5; 20 P → 5,0; 0 P → 6,0); bei anderer Maximalpunktzahl wird er linear angepasst. Diese Prüfung hat <b>${TOTAL_POINTS} Punkte</b>.</p>
    <div class="row wrap mb" style="gap:16px;align-items:flex-end"><div class="field" style="margin:0"><label class="lbl" for="kmax">Maximalpunktzahl</label><input id="kmax" class="input" type="number" min="1" max="500" step="1" value="${TOTAL_POINTS}" data-kmax style="width:120px"></div>
      <div class="field" style="margin:0"><label class="lbl" for="kstep">Schrittweite</label><select id="kstep" class="select" data-kstep><option value="0.5">halbe Punkte</option><option value="1">ganze Punkte</option></select></div></div>
    <div data-ktab>${keyHtml(TOTAL_POINTS, 0.5)}</div>`,
    footer: `<button class="btn primary" data-close>Schließen</button>`,
    onMount: (m) => { const upd8 = () => { const mx = Math.max(1, Math.min(500, +m.querySelector("[data-kmax]").value || TOTAL_POINTS)); m.querySelector("[data-ktab]").innerHTML = keyHtml(mx, +m.querySelector("[data-kstep]").value); }; m.querySelector("[data-kmax]").oninput = upd8; m.querySelector("[data-kstep]").onchange = upd8; } });
}

// ---------- Prüfungseinsicht ----------
export function einsichtView(pid, { participantView = false } = {}) {
  const p = byId("participants", pid);
  if (!p) return { redirect: "#/app/ergebnisse" };
  const open = new Set([ALL_SUBTASKS[0].no]);
  const body = () => {
    const t = totals(pid);
    return `<div class="pagehead"><div><h1>Prüfungseinsicht</h1><div class="sub">${esc(p.lastname)}, ${esc(p.firstname)} · ${esc(EXAM.name)}</div></div>
      <div class="stat" style="min-width:220px"><div class="small muted">Ergebnis</div><div class="v">${t.note !== null ? `Note ${fmtNote(t.note)}` : "noch offen"}</div>${t.note !== null ? `<div class="small">${GRADE_TXT[noteBucket(t.note)]} · ${esc(t.o.src)}${t.complete ? ` · ${fmtP(t.sum)} / ${TOTAL_POINTS} Endpunkte` : ""}</div>` : ""}</div></div>
    <div class="row wrap small mb" style="gap:16px">${[1, 2, 3].map((c) => `<span class="row" style="gap:6px"><i class="cdot" style="background:${CORRECTORS[c].color}"></i>${CORRECTORS[c].label} (${CORRECTORS[c].side === "right" ? "rechter Rand" : "linker Rand"})</span>`).join("")}</div>
    ${EXAM.tasks.map((task) => `<h2 class="mt mb">Aufgabe ${task.no} ${esc(task.title)} <span class="badge cyan">${fmtP(task.subtasks.reduce((a, s) => a + (t.per[s.no].v || 0), 0))} / ${task.points} P</span></h2>
      ${task.subtasks.map((s) => { const f = t.per[s.no]; const notes = [3, 2, 1].map((c) => ({ c, n: grading(pid, c)?.notes?.[s.no] })).filter((x) => x.n); return `<details class="einsicht card" data-st="${s.no}" ${open.has(s.no) ? "open" : ""}><summary><span class="grow"><b>${s.no} ${esc(s.title)}</b></span>${[1, 2, 3].map((c) => { const v = stPoints(grading(pid, c), s.no); return v === null ? "" : `<span class="xs" style="color:${CORRECTORS[c].color}">${CORRECTORS[c].short} ${fmtP(v)}</span>`; }).join(" ")}<span class="badge ${f.v === null ? "gray" : "green"}">${f.v === null ? "offen" : `${fmtP(f.v)} / ${s.points} P`}</span>${icon("chevron-down")}</summary>
        <div class="einsicht-b">${notes.length ? notes.map((x) => `<div class="notice info small" style="border-left:3px solid ${CORRECTORS[x.c].color};padding-left:10px"><span><b>Begründung ${esc(CORRECTORS[x.c].short)}:</b> ${esc(x.n)}</span></div>`).join("") : ""}<div data-paper-slot="${s.no}"></div></div></details>`; }).join("")}`).join("")}`;
  };
  const mountPapers = (el) => {
    el.querySelectorAll("details.einsicht").forEach((d) => {
      const fill = () => { const slot = d.querySelector("[data-paper-slot]"); if (d.open && !slot.innerHTML) { slot.innerHTML = roPaper(pid, d.dataset.st, 0.78); fitRoPapers(slot); } };
      d.addEventListener("toggle", () => { if (d.open) open.add(d.dataset.st); else open.delete(d.dataset.st); fill(); });
      fill();
    });
  };
  if (participantView) return {
    title: "Prüfungseinsicht",
    render: () => `<header class="topbar">${brand()}<span class="bold">${esc(p.firstname)} ${esc(p.lastname)}</span></header><div class="tn-page"><div class="breadcrumb"><a href="#/tn">${icon("arrow-left")} Zurück</a></div>${body()}</div>`,
    mount: (el) => mountPapers(el),
  };
  return {
    shell: "staff", rail: "ergebnisse", title: "Prüfungseinsicht",
    render: () => `<div class="breadcrumb"><a href="#/app/ergebnisse">Ergebnisse</a>${icon("chevron-right")}<b>Prüfungseinsicht</b></div>${body()}`,
    mount: (el) => mountPapers(el),
  };
}

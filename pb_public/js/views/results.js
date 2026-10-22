// Ergebnisse (Task 28/30/36) und Prüfungseinsicht (Task 37/38)
import { D, byId, upd, log } from "../data.js?v=8.7";
import { icon, esc, toast, confirmBox, brand, modal, statusChip, fmtTime, fmtDateTime, parseDate } from "../ui.js?v=8.7";
import { EXAM, ALL_SUBTASKS, TOTAL_POINTS, CORRECTORS, categoryList, CATEGORY_SYSTEMS } from "../scenario.js?v=8.7";
import { navigate, redraw, session } from "../app.js?v=8.7";
import { store } from "../ui.js?v=8.7";
import { grading, stPoints, candidates, fmtP } from "./correction.js?v=8.7";
import { keyThresholds, gradingKeyLabel, linearGrade, fmtNote, noteBucket, overall, approvalState, keyTable, dkThreshold } from "../grades.js?v=8.7";
import { me, courseOf, courseOfParticipant, canCorrect, isTeacherOf, thirdRequested, orgShort, personName, einsichtCandidates } from "../access.js?v=8.7";
import { roPaper, fitRoPapers } from "./kmode.js?v=8.7";
import { contentScope } from "../content.js?v=8.7";

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
      const CS = contentScope(resultParticipants()); const ps = CS.ps;
      const rows = ps.map((p) => ({ p, t: totals(p.id), a1: approvalState(p, 1), a2: approvalState(p, 2), a3: approvalState(p, 3) }));
      const done = rows.filter((r) => r.t.note !== null);
      const notes = done.map((r) => r.t.note);
      const avgN = notes.length ? notes.reduce((a, b) => a + b, 0) / notes.length : null;
      const avg = done.length ? done.reduce((a, r) => a + r.t.sum, 0) / done.length : null;
      const dist = [1, 2, 3, 4, 5, 6].map((g) => notes.filter((x) => noteBucket(x) === g).length);
      const maxD = Math.max(1, ...dist);
      const pass = done.length ? Math.round((notes.filter((g) => g <= 4.0 + 1e-9).length / done.length) * 100) : null;
      const rec = rows.filter((r) => r.t.o.recommend && !r.t.o.third);
      // Prüfung: keine Freigabe der Einsicht – sie findet in Präsenz mit einer Person der Rolle „Prüfungseinsicht“ statt

      const lessonRooms = lesson ? [...new Set(ps.map((p) => p.room))].map((id) => byId("rooms", id)).filter(Boolean) : [];
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
        <div class="row wrap">${CS.select}<button class="btn" data-key>${icon("sigma")} Notenschlüssel</button><a class="btn" href="#/app/korrektur">${icon("file-pen-line")} Zur Korrektur</a><button class="btn" data-csv>${icon("download")} CSV exportieren</button>
        </div></div>
      ${adm ? `<div class="notice info small mb">${icon("eye")}<span><b>Prüfungseinsicht in Präsenz:</b> Prüflinge erhalten keinen eigenständigen Zugriff. Die Einsicht findet vor Ort statt – eine Person mit der Rolle „Prüfungseinsicht“ (Prüfungen › Mitglieder) meldet sich an und bleibt während der Einsicht dabei. Gezeigt werden nur Endnote und Abgabe mit Korrekturzeichen.</span></div>` : ""}
      ${lesson && lessonRooms.length ? `<div class="card pad mb"><h3>Freigabe der Korrektur für die Schüler:innen</h3><p class="xs muted">Nach der Freigabe sehen die Schüler:innen einer Durchführung ihre eigene Korrektur und ihr Ergebnis (Punkte, Note, Begründung und Korrekturzeichen).</p>
        <div class="col" style="gap:6px">${lessonRooms.map((r) => `<div class="row between wrap"><span><b>${esc(r.name)}</b> <span class="xs muted">${r.mode === "distanz" ? "Distanz" : "Präsenz"} · ${ps.filter((p) => p.room === r.id).length} mit Abgabe</span></span><label class="checkbox"><input type="checkbox" data-relroom="${r.id}" ${r.released ? "checked" : ""}> Korrektur und Ergebnisse freigegeben</label></div>`).join("")}</div></div>` : ""}
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
      <p class="xs muted mt-s">${keyThresholds() ? `Noten nach <b>${esc(gradingKeyLabel())}</b> bezogen auf ${TOTAL_POINTS} Punkte.` : `Noten nach <b>linearem Notenschlüssel</b> bezogen auf ${TOTAL_POINTS} Punkte: Note = 6 − 5 · Punkte / ${TOTAL_POINTS}, auf eine Nachkommastelle abgerundet.`} ${lesson ? "Im Unterricht gibt es genau eine Korrektur." : "Gesamtnote: Mittelwert der Noten aus Erst- und Zweitkorrektur; wurde eine Drittkorrektur angefordert, entscheidet die Endbeurteilung. Werte stammen aus den Korrekturen und aktualisieren sich automatisch."}</p>
      <div class="resgrid mt-l">
        <section class="card pad"><h3>Notenspiegel</h3><p class="xs muted">Prüflinge mit Gesamtnote (n = ${done.length}), gerundet auf ganze Noten</p>
          <div class="barchart" role="img" aria-label="Notenspiegel: ${dist.map((n, i) => `Note ${i + 1}: ${n}`).join(", ")}">
            ${dist.map((n, i) => `<div class="bcol" tabindex="0" data-tip="Note ${i + 1} (${GRADE_TXT[i + 1]}): ${n} Prüfling${n === 1 ? "" : "e"}"><span class="bval">${n}</span><div class="bar" style="height:${(n / maxD) * 100}%"></div><span class="blab">${i + 1}</span></div>`).join("")}
          </div><div class="xs muted" style="text-align:center">Note</div></section>
        <section class="card pad"><h3>Aufgabenstatistik</h3><p class="xs muted">Durchschnittlich erreichte Punkte je Teilaufgabe (Endpunkte)</p>
          <table class="tbl small"><thead><tr><th>Teilaufgabe</th><th class="num">Ø Punkte</th><th style="width:40%">Erreichungsgrad</th><th class="num">min–max</th><th class="num">n</th></tr></thead><tbody>
          ${stStats.map((x) => `<tr><td>${x.s.no} ${esc(x.s.title)}</td><td class="num">${x.m === null ? "–" : fmtP(Math.round(x.m * 10) / 10)} / ${x.s.points}</td><td><div class="hbar" data-tip="${x.pct} % der Maximalpunkte"><i style="width:${x.pct}%"></i></div><span class="xs">${x.m === null ? "" : x.pct + " %"}</span></td><td class="num">${x.min === null ? "–" : fmtP(x.min) + "–" + fmtP(x.max)}</td><td class="num">${x.n}</td></tr>`).join("")}</tbody></table></section>
      </div>${categoryCard(ps)}`;
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
      el.querySelectorAll("[data-relroom]").forEach((cb) => (cb.onchange = async () => { const r = byId("rooms", cb.dataset.relroom); await upd("rooms", r.id, { released: cb.checked }); toast(cb.checked ? "Korrektur freigegeben" : "Freigabe zurückgezogen", r.name); }));
    },
  };
}
// Auswertung nach dem im Prüfungseditor gewählten Kategoriensystem (Grundlage: Kriterienpunkte der Erstkorrektur)
function categoryCard(ps) {
  const cats = categoryList(); if (!cats.length) return "";
  const rows = cats.map((cat) => {
    let got = 0, max = 0, n = 0;
    ps.forEach((p) => { const g = grading(p.id, 1); if (!g) return; n++;
      ALL_SUBTASKS.forEach((s) => s.criteria.forEach(([, m, c], i) => { if (c !== cat) return; max += m; got += +(g.points?.[s.no]?.[i] || 0); })); });
    const pct = max ? Math.round((got / max) * 100) : null;
    return `<tr><td>${esc(cat)}</td><td class="num">${ALL_SUBTASKS.reduce((a, s) => a + s.criteria.filter((k) => k[2] === cat).reduce((b, k) => b + k[1], 0), 0)}</td><td style="width:40%"><div class="hbar"><i style="width:${pct || 0}%"></i></div><span class="xs">${pct === null ? "–" : pct + " %"}</span></td></tr>`;
  }).join("");
  return `<section class="card pad mt-l"><h3>Auswertung nach Kategorien</h3><p class="xs muted">Kategoriensystem des Inhalts: ${esc(CATEGORY_SYSTEMS[EXAM.categories?.system]?.label || "")} · Erreichungsgrad auf Basis der Erstkorrektur</p>
    <table class="tbl small"><thead><tr><th>Kategorie</th><th class="num">Max. Punkte je Arbeit</th><th>Erreichungsgrad</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}
// Notenschlüssel (linear, angepasst an die Maximalpunktzahl)
// Notenschlüssel-Tabelle: Maximalpunktzahl wählbar (Schlüssel wird linear angepasst), Schrittweite ganze oder halbe Punkte
function keyHtml(max, step) {
  const rows = keyTable(max, step); const per = Math.ceil(rows.length / 6);
  const cols = Array.from({ length: Math.ceil(rows.length / per) }, (_, i) => rows.slice(i * per, (i + 1) * per));
  return `<div class="keygrid">${cols.map((c) => `<table class="tbl compact"><thead><tr><th class="num">Punkte</th><th class="num">Note</th></tr></thead><tbody>${c.map(([p, n]) => `<tr><td class="num">${fmtP(p)}</td><td class="num">${fmtNote(n)}</td></tr>`).join("")}</tbody></table>`).join("")}</div>`;
}
function keyDialog() {
  const th = keyThresholds();
  modal({ title: th ? `Notenschlüssel: ${gradingKeyLabel()}` : "Notenschlüssel (linear)", size: "wide",
    body: th ? `<p class="small">Im Prüfungseditor festgelegt: <b>${esc(gradingKeyLabel())}</b>. Note 1 ab ${th[0]} %, 2 ab ${th[1]} %, 3 ab ${th[2]} %, 4 ab ${th[3]} %, 5 ab ${th[4]} % der Maximalpunkte, darunter 6. Dieser Inhalt hat <b>${TOTAL_POINTS} Punkte</b>.</p>
    <div class="row wrap mb" style="gap:16px;align-items:flex-end"><div class="field" style="margin:0"><label class="lbl" for="kmax">Maximalpunktzahl</label><input id="kmax" class="input" type="number" min="1" max="500" step="1" value="${TOTAL_POINTS}" data-kmax style="width:120px"></div>
      <div class="field" style="margin:0"><label class="lbl" for="kstep">Schrittweite</label><select id="kstep" class="select" data-kstep><option value="0.5">halbe Punkte</option><option value="1">ganze Punkte</option></select></div></div>
    <div data-ktab>${keyHtml(TOTAL_POINTS, 0.5)}</div>` : `<p class="small">Note = 6 − 5 · Punkte / Maximalpunkte, auf eine Nachkommastelle zugunsten des Prüflings abgerundet. Bei 100 Punkten entspricht dies dem Schlüssel „Notenschlüssel 100 P“ (100 P → 1,0; 50 P → 3,5; 20 P → 5,0; 0 P → 6,0); bei anderer Maximalpunktzahl wird er linear angepasst. Diese Prüfung hat <b>${TOTAL_POINTS} Punkte</b>.</p>
    <div class="row wrap mb" style="gap:16px;align-items:flex-end"><div class="field" style="margin:0"><label class="lbl" for="kmax">Maximalpunktzahl</label><input id="kmax" class="input" type="number" min="1" max="500" step="1" value="${TOTAL_POINTS}" data-kmax style="width:120px"></div>
      <div class="field" style="margin:0"><label class="lbl" for="kstep">Schrittweite</label><select id="kstep" class="select" data-kstep><option value="0.5">halbe Punkte</option><option value="1">ganze Punkte</option></select></div></div>
    <div data-ktab>${keyHtml(TOTAL_POINTS, 0.5)}</div>`,
    footer: `<button class="btn primary" data-close>Schließen</button>`,
    onMount: (m) => { const upd8 = () => { const mx = Math.max(1, Math.min(500, +m.querySelector("[data-kmax]").value || TOTAL_POINTS)); m.querySelector("[data-ktab]").innerHTML = keyHtml(mx, +m.querySelector("[data-kstep]").value); }; m.querySelector("[data-kmax]").oninput = upd8; m.querySelector("[data-kstep]").onchange = upd8; } });
}

// ---------- Prüfungseinsicht ----------
// Ansichten: Personal (vollständig), Prüfling (nur Endnote und Abgabe mit Korrekturzeichen – ohne Punkte, Begründungen und Kommentare),
// Schüler:in im Unterricht (eigene Korrektur und Ergebnisse: Punkte je Teilaufgabe, Note, Begründung und Korrekturzeichen)
export function einsichtView(pid, { participantView = false, kind = "", presence = null } = {}) {
  const p = byId("participants", pid);
  if (!p) return { redirect: participantView ? "#/tn" : "#/app/ergebnisse" };
  const room = byId("rooms", p.room); const c = courseOf(room); const lesson = c?.kind === "unterricht";
  const limited = !!presence || (participantView && kind === "pruefung"); // Prüfling: eingeschränkte Einsicht (in Präsenz)
  const showPts = !limited, showNotes = !limited;
  const stages = lesson ? [1] : [1, 2, 3];
  const open = new Set([ALL_SUBTASKS[0].no]);
  const title = lesson ? (participantView ? "Korrektur und Ergebnis" : "Einsicht Unterricht") : "Prüfungseinsicht";
  const body = () => {
    const t = totals(pid); const note = lesson ? t.o.ek.note : t.note;
    const sum = lesson ? t.o.ek.pts : t.sum;
    return `<div class="pagehead"><div><h1>${title}</h1><div class="sub">${esc(p.lastname)}, ${esc(p.firstname)} · ${esc(room?.exam_name || EXAM.name)}${lesson && room ? ` · ${esc(room.name)}` : ""}</div></div>
      <div class="stat" style="min-width:220px"><div class="small muted">${limited ? "Endnote" : "Ergebnis"}</div><div class="v">${note !== null && note !== undefined ? `Note ${fmtNote(note)}` : "noch offen"}</div>${note !== null && note !== undefined ? `<div class="small">${GRADE_TXT[noteBucket(note)]}${limited ? "" : `${lesson ? "" : ` · ${esc(t.o.src)}`}${sum !== null && sum !== undefined ? ` · ${fmtP(sum)} / ${TOTAL_POINTS} Punkte` : ""}`}</div>` : ""}</div></div>
    ${limited ? `<div class="notice info small mb">${icon("info")}<span>Prüfungseinsicht in Präsenz. Sie sehen Ihre <b>Endnote</b> und Ihre <b>Abgaben mit den Korrekturzeichen</b>. Punkte je Teilaufgabe, Begründungen, Bemerkungen und der Erwartungshorizont sind nicht Bestandteil der Einsicht.</span></div>` : ""}
    ${participantView && lesson ? `<div class="notice info small mb">${icon("info")}<span>Ihre Lehrkraft hat die Korrektur freigegeben. Sie sehen nur Ihre eigenen Ergebnisse.</span></div>` : ""}
    <div class="row wrap small mb" style="gap:16px">${stages.map((k) => `<span class="row" style="gap:6px"><i class="cdot" style="background:${CORRECTORS[k].color}"></i>${lesson ? "Korrektur der Lehrkraft" : CORRECTORS[k].label} (${CORRECTORS[k].side === "right" ? "rechter Rand" : "linker Rand"})</span>`).join("")}</div>
    ${EXAM.tasks.map((task) => `<h2 class="mt mb">Aufgabe ${task.no} ${esc(task.title)}${showPts ? ` <span class="badge cyan">${fmtP(task.subtasks.reduce((a, s) => a + ((lesson ? stPoints(grading(pid, 1), s.no) : t.per[s.no].v) || 0), 0))} / ${task.points} P</span>` : ""}</h2>
      ${task.subtasks.map((s) => { const f = lesson ? { v: stPoints(grading(pid, 1), s.no) } : t.per[s.no]; const notes = showNotes ? stages.slice().reverse().map((k) => ({ c: k, n: grading(pid, k)?.notes?.[s.no] })).filter((x) => x.n) : [];
        return `<details class="einsicht card" data-st="${s.no}" ${open.has(s.no) ? "open" : ""}><summary><span class="grow"><b>${s.no} ${esc(s.title)}</b></span>${showPts && !lesson ? stages.map((k) => { const v = stPoints(grading(pid, k), s.no); return v === null ? "" : `<span class="xs" style="color:${CORRECTORS[k].color}">${CORRECTORS[k].short} ${fmtP(v)}</span>`; }).join(" ") : ""}${showPts ? `<span class="badge ${f.v === null ? "gray" : "green"}">${f.v === null ? "offen" : `${fmtP(f.v)} / ${s.points} P`}</span>` : ""}${icon("chevron-down")}</summary>
        <div class="einsicht-b">${notes.map((x) => `<div class="notice info small" style="border-left:3px solid ${CORRECTORS[x.c].color};padding-left:10px"><span><b>Begründung${lesson ? "" : " " + esc(CORRECTORS[x.c].short)}:</b> ${esc(x.n)}</span></div>`).join("")}<div data-paper-slot="${s.no}"></div></div></details>`; }).join("")}`).join("")}`;
  };
  const mountPapers = (el) => {
    el.querySelectorAll("details.einsicht").forEach((d) => {
      const fill = () => { const slot = d.querySelector("[data-paper-slot]"); if (d.open && !slot.innerHTML) { slot.innerHTML = roPaper(pid, d.dataset.st, 0.78); fitRoPapers(slot); } };
      d.addEventListener("toggle", () => { if (d.open) open.add(d.dataset.st); else open.delete(d.dataset.st); fill(); });
      fill();
    });
  };
  if (presence) return { title, body, mountPapers };
  if (participantView) return {
    title,
    render: () => `<header class="topbar">${brand()}<span class="bold">${esc(p.firstname)} ${esc(p.lastname)}</span></header><div class="tn-page"><div class="breadcrumb"><a href="#/tn">${icon("arrow-left")} Zurück</a></div>${body()}</div>`,
    mount: (el) => mountPapers(el),
  };
  return {
    shell: "staff", rail: "ergebnisse", title,
    render: () => `<div class="breadcrumb"><a href="#/app/ergebnisse">Ergebnisse</a>${icon("chevron-right")}<b>${title}</b></div>${body()}`,
    mount: (el) => mountPapers(el),
  };
}

// ---------- Prüfungseinsicht in Präsenz (Rolle „Prüfungseinsicht“) ----------
// Prüflinge erhalten keinen eigenständigen Zugriff. Die begleitende Person meldet sich an, startet die Einsicht am Gerät vor Ort
// und bleibt während der gesamten Einsicht dabei; Beginn und Ende werden im Prüfungsprotokoll festgehalten.
const EI = { q: "" };
const lastEinsicht = (p) => [...D.protocol].filter((x) => x.username === p.username && x.room === p.room && x.action === "Prüfungseinsicht beendet").sort((a, b) => String(b.ts).localeCompare(String(a.ts)))[0];
export function einsichtList() {
  return {
    shell: "staff", rail: "einsicht", title: "Prüfungseinsicht",
    render() {
      const pe = me();
      if (session.role !== "einsicht" || !pe) return `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Die Prüfungseinsicht begleiten Personen mit der Rolle „Prüfungseinsicht“.</p></div>`;
      let list = einsichtCandidates(pe);
      if (EI.q) { const q = EI.q.toLowerCase(); list = list.filter((x) => (x.lastname + " " + x.firstname + " " + x.username + " " + x.group_name).toLowerCase().includes(q)); }
      list.sort((a, b) => a.lastname.localeCompare(b.lastname));
      return `<div class="pagehead"><div><h1>Prüfungseinsicht</h1><div class="sub">${esc(personName(pe))} · Rolle Prüfungseinsicht</div></div></div>
      <div class="notice info mb">${icon("eye")}<span><b>Die Einsicht findet immer in Präsenz statt.</b> Der Prüfling kommt vor Ort; Sie starten die Einsicht und bleiben während der gesamten Einsicht dabei. Gezeigt werden <b>nur die Endnote und die Abgabe mit Korrekturzeichen</b> – keine Punkte je Teilaufgabe, Begründungen, Bemerkungen oder Kommentare. Beginn und Ende werden protokolliert.</span></div>
      <div class="row end mb"><div class="search"><input class="input" style="width:260px" data-eiq placeholder="Name, Anmeldename oder Klasse" value="${esc(EI.q)}" aria-label="Prüflinge suchen">${icon("search")}</div></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>Anmeldename</th><th>Klasse</th><th>Prüfung / Raum</th><th>Status</th><th>Letzte Einsicht</th><th></th></tr></thead><tbody>${list.length ? list.map((x) => { const r = byId("rooms", x.room); const le = lastEinsicht(x);
        return `<tr class="rowlink" data-eistart="${x.id}" tabindex="0"><td><b>${esc(x.lastname)}, ${esc(x.firstname)}</b></td><td>${esc(x.username)}</td><td>${esc(x.group_name || "")}</td><td>${esc(r?.exam_name || "")}<div class="xs muted">${esc(r?.name || "")}</div></td><td>${statusChip(x.status)}</td><td class="small">${le ? fmtDateTime(parseDate(le.ts)) : "–"}</td><td><button class="btn sm primary" data-eistart="${x.id}">${icon("eye")} Einsicht beginnen</button></td></tr>`; }).join("")
        : `<tr><td colspan="7"><div class="empty small">Keine Prüflinge mit abgeschlossener Prüfung in Ihren Prüfungen.</div></td></tr>`}</tbody></table></div>`;
    },
    mount(el) {
      const q = el.querySelector("[data-eiq]"); if (q) q.oninput = () => { EI.q = q.value; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-eiq]"); n.focus(); n.setSelectionRange(pos, pos); };
      el.querySelectorAll("[data-eistart]").forEach((b) => (b.onclick = async (e) => {
        e.stopPropagation(); const x = byId("participants", b.dataset.eistart); if (!x) return;
        const ok = await confirmBox("Prüfungseinsicht in Präsenz beginnen", `<p>Einsicht für <b>${esc(x.firstname)} ${esc(x.lastname)}</b> (${esc(x.username)}).</p><ul><li>Der Prüfling ist vor Ort anwesend und hat sich ausgewiesen.</li><li>Ich bleibe während der gesamten Einsicht dabei.</li><li>Es werden keine Kopien, Fotos oder Notizen der Abgabe angefertigt.</li></ul>`, "Einsicht beginnen", "Abbrechen", false);
        if (!ok) return;
        const pe = me(); store.set("einsicht." + x.id, Date.now());
        await log(x.room, x, "Prüfungseinsicht begonnen", `in Präsenz · begleitet von ${personName(pe)}`, "aktion", pe?.username || "");
        navigate(`#/app/pruefungseinsicht/${x.id}`);
      }));
    },
  };
}
export function einsichtSession(pid) {
  const pe = me(); const x = byId("participants", pid);
  if (session.role !== "einsicht" || !pe || !x || !einsichtCandidates(pe).some((c) => c.id === pid)) return { redirect: "#/app/pruefungseinsicht" };
  const since = store.get("einsicht." + pid, Date.now());
  const v = einsichtView(pid, { presence: { by: pe } });
  return {
    title: "Prüfungseinsicht in Präsenz",
    render: () => `<div class="einsichtbar" role="region" aria-label="Prüfungseinsicht in Präsenz">${icon("eye")}<b>Prüfungseinsicht in Präsenz</b><span>Prüfling: <b>${esc(x.firstname)} ${esc(x.lastname)}</b></span><span>begleitet von <b>${esc(personName(pe))}</b></span><span class="badge">seit ${fmtTime(new Date(since))} Uhr</span><span class="grow"></span><button class="btn sm" data-eiend>${icon("log-in")} Einsicht beenden</button></div>
      <header class="topbar">${brand()}<span class="bold">${esc(x.firstname)} ${esc(x.lastname)}</span></header><div class="tn-page">${v.body()}</div>`,
    mount(el) {
      v.mountPapers(el);
      el.querySelector("[data-eiend]").onclick = async () => {
        if (!(await confirmBox("Einsicht beenden", "Die Prüfungseinsicht wird beendet und im Prüfungsprotokoll vermerkt.", "Beenden", "Abbrechen", false))) return;
        const mins = Math.max(1, Math.round((Date.now() - since) / 60000));
        await log(x.room, x, "Prüfungseinsicht beendet", `in Präsenz · begleitet von ${personName(pe)} · Dauer ca. ${mins} Min.`, "aktion", pe?.username || "");
        store.del("einsicht." + pid); toast("Prüfungseinsicht beendet", `${x.lastname}, ${x.firstname}`); navigate("#/app/pruefungseinsicht");
      };
    },
  };
}

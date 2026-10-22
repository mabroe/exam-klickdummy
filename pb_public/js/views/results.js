// Ergebnisse (Task 28/30/36) und Prüfungseinsicht (Task 37/38)
import { D, byId, setting, setSetting } from "../data.js?v=8.2";
import { icon, esc, toast, confirmBox, brand } from "../ui.js?v=8.2";
import { EXAM, ALL_SUBTASKS, TOTAL_POINTS, CORRECTORS } from "../scenario.js?v=8.2";
import { navigate, redraw, session } from "../app.js?v=8.2";
import { grading, stPoints, candidates, fmtP } from "./correction.js?v=8.2";
import { roPaper, fitRoPapers } from "./kmode.js?v=8.2";

// Endpunkte je Teilaufgabe: Drittkorrektur, sonst Mittelwert Erst/Zweit, sonst Erstkorrektur
export function finalPoints(pid, st) {
  const v = (c) => stPoints(grading(pid, c), st);
  const d = v(3), a = v(1), b = v(2);
  if (d !== null) return { v: d, src: "DK" };
  if (a !== null && b !== null) return { v: Math.round(((a + b) / 2) * 2) / 2, src: "Ø EK/ZK" };
  if (a !== null) return { v: a, src: "EK" };
  return { v: null, src: "" };
}
export function totals(pid) {
  let sum = 0, complete = true; const per = {};
  ALL_SUBTASKS.forEach((s) => { const f = finalPoints(pid, s.no); per[s.no] = f; if (f.v === null) complete = false; else sum += f.v; });
  const corr = (c) => { const g = grading(pid, c); if (!g) return null; let t = 0, any = false; ALL_SUBTASKS.forEach((s) => { const x = stPoints(g, s.no); if (x !== null) { t += x; any = true; } }); return any ? t : null; };
  return { sum, complete, per, ek: corr(1), zk: corr(2), dk: corr(3) };
}
export const grade = (pts) => { const pct = (pts / TOTAL_POINTS) * 100; return pct >= 92 ? 1 : pct >= 81 ? 2 : pct >= 67 ? 3 : pct >= 50 ? 4 : pct >= 30 ? 5 : 6; };
const GRADE_TXT = { 1: "sehr gut", 2: "gut", 3: "befriedigend", 4: "ausreichend", 5: "mangelhaft", 6: "ungenügend" };

// ---------- Ergebnisübersicht ----------
export function overview() {
  return {
    shell: "staff", rail: "ergebnisse", title: "Ergebnisse",
    render() {
      const ps = candidates();
      const rows = ps.map((p) => ({ p, t: totals(p.id) }));
      const done = rows.filter((r) => r.t.complete);
      const avg = done.length ? done.reduce((a, r) => a + r.t.sum, 0) / done.length : null;
      const grades = done.map((r) => grade(r.t.sum));
      const dist = [1, 2, 3, 4, 5, 6].map((g) => grades.filter((x) => x === g).length);
      const maxD = Math.max(1, ...dist);
      const pass = done.length ? Math.round((grades.filter((g) => g <= 4).length / done.length) * 100) : null;
      const released = !!setting("einsicht", {}).released;
      const stStats = ALL_SUBTASKS.map((s) => { const vals = ps.map((p) => finalPoints(p.id, s.no).v).filter((x) => x !== null); const m = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null; return { s, n: vals.length, m, pct: m === null ? 0 : Math.round((m / s.points) * 100), min: vals.length ? Math.min(...vals) : null, max: vals.length ? Math.max(...vals) : null }; });
      return `<div class="pagehead"><div><h1>Ergebnisse</h1><div class="sub">${esc(EXAM.name)} · Gruppe FA230a</div></div>
        <div class="row wrap"><a class="btn" href="#/app/korrektur">${icon("file-pen-line")} Zur Korrektur</a><button class="btn" data-csv>${icon("download")} CSV exportieren</button>
        <button class="btn ${released ? "" : "primary"}" data-einsicht>${icon(released ? "lock" : "eye")} ${released ? "Einsicht-Freigabe zurückziehen" : "Prüfungseinsicht freigeben"}</button></div></div>
      ${released ? `<div class="notice success mb">${icon("circle-check")}<span>Die Prüfungseinsicht ist freigegeben. Prüflinge sehen Punkte, Begründungen und Korrekturzeichen nach Prüfungsende.</span></div>` : ""}
      <div class="statgrid">
        <div class="stat"><div class="small muted">Prüflinge mit Abgaben</div><div class="v">${ps.length}</div></div>
        <div class="stat"><div class="small muted">Vollständig bewertet</div><div class="v">${done.length}</div><div class="xs muted">${ps.length - done.length} offen</div></div>
        <div class="stat"><div class="small muted">Ø Punkte</div><div class="v">${avg === null ? "–" : fmtP(Math.round(avg * 10) / 10)}</div><div class="xs muted">von ${TOTAL_POINTS}</div></div>
        <div class="stat"><div class="small muted">Ø Note</div><div class="v">${grades.length ? (grades.reduce((a, b) => a + b, 0) / grades.length).toFixed(1).replace(".", ",") : "–"}</div></div>
        <div class="stat"><div class="small muted">Bestehensquote</div><div class="v">${pass === null ? "–" : pass + " %"}</div><div class="xs muted">Note 4 oder besser</div></div>
      </div>
      <div class="resgrid mt-l">
        <section class="card pad"><h3>Notenspiegel</h3><p class="xs muted">Nur vollständig bewertete Prüflinge (n = ${done.length})</p>
          <div class="barchart" role="img" aria-label="Notenspiegel: ${dist.map((n, i) => `Note ${i + 1}: ${n}`).join(", ")}">
            ${dist.map((n, i) => `<div class="bcol" tabindex="0" data-tip="Note ${i + 1} (${GRADE_TXT[i + 1]}): ${n} Prüfling${n === 1 ? "" : "e"}"><span class="bval">${n}</span><div class="bar" style="height:${(n / maxD) * 100}%"></div><span class="blab">${i + 1}</span></div>`).join("")}
          </div><div class="xs muted" style="text-align:center">Note</div></section>
        <section class="card pad"><h3>Aufgabenstatistik</h3><p class="xs muted">Durchschnittlich erreichte Punkte je Teilaufgabe (Endpunkte)</p>
          <table class="tbl small"><thead><tr><th>Teilaufgabe</th><th class="num">Ø Punkte</th><th style="width:40%">Erreichungsgrad</th><th class="num">min–max</th><th class="num">n</th></tr></thead><tbody>
          ${stStats.map((x) => `<tr><td>${x.s.no} ${esc(x.s.title)}</td><td class="num">${x.m === null ? "–" : fmtP(Math.round(x.m * 10) / 10)} / ${x.s.points}</td><td><div class="hbar" data-tip="${x.pct} % der Maximalpunkte"><i style="width:${x.pct}%"></i></div><span class="xs">${x.m === null ? "" : x.pct + " %"}</span></td><td class="num">${x.min === null ? "–" : fmtP(x.min) + "–" + fmtP(x.max)}</td><td class="num">${x.n}</td></tr>`).join("")}</tbody></table></section>
      </div>
      <h2 class="mt-l mb">Ergebnisliste</h2>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Name</th><th>Vorname</th>${[1, 2, 3].map((c) => `<th class="num"><i class="cdot" style="background:${CORRECTORS[c].color}"></i> ${CORRECTORS[c].short}</th>`).join("")}<th class="num">Endpunkte</th><th class="num">Note</th><th>Hinweis</th><th></th></tr></thead><tbody>
      ${rows.map(({ p, t }) => { const dev = t.ek !== null && t.zk !== null && Math.abs(t.ek - t.zk) >= TOTAL_POINTS * 0.1; return `<tr><td>${esc(p.lastname)}</td><td>${esc(p.firstname)}</td><td class="num">${t.ek === null ? "–" : fmtP(t.ek)}</td><td class="num">${t.zk === null ? "–" : fmtP(t.zk)}</td><td class="num">${t.dk === null ? "–" : fmtP(t.dk)}</td><td class="num"><b>${t.complete ? fmtP(t.sum) : "–"}</b></td><td class="num">${t.complete ? grade(t.sum) : "–"}</td><td>${dev && t.dk === null ? `<span class="badge yellowb">${icon("triangle-alert")} Abweichung ≥ 10 % – Drittkorrektur</span>` : !t.complete ? `<span class="badge gray">Bewertung offen</span>` : ""}</td><td><a class="linkarrow" href="#/app/einsicht/${p.id}">${icon("eye")} Einsicht</a></td></tr>`; }).join("")}</tbody></table></div>
      <p class="xs muted mt-s">Endpunkte: Drittkorrektur, falls vorhanden; sonst Mittelwert aus Erst- und Zweitkorrektur (auf halbe Punkte gerundet); sonst Erstkorrektur. Notenschlüssel: ab 92 % = 1, 81 % = 2, 67 % = 3, 50 % = 4, 30 % = 5.</p>`;
    },
    mount(el) {
      el.querySelector("[data-csv]").onclick = () => {
        const head = ["Nachname", "Vorname", "Anmeldename", ...ALL_SUBTASKS.map((s) => "TA " + s.no), "EK gesamt", "ZK gesamt", "DK gesamt", "Endpunkte", "Note"];
        const lines = candidates().map((p) => { const t = totals(p.id); const n = (x) => (x === null || x === undefined ? "" : String(x).replace(".", ",")); return [p.lastname, p.firstname, p.username, ...ALL_SUBTASKS.map((s) => n(t.per[s.no].v)), n(t.ek), n(t.zk), n(t.dk), t.complete ? n(t.sum) : "", t.complete ? grade(t.sum) : ""]; });
        const csv = [head, ...lines].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(";")).join("\n");
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })); a.download = "Ergebnisse_FA230.csv"; a.click();
        toast("CSV exportiert", a.download, "info");
      };
      el.querySelector("[data-einsicht]").onclick = async () => {
        const rel = !!setting("einsicht", {}).released;
        if (!rel && !(await confirmBox("Prüfungseinsicht freigeben", "Prüflinge können nach Prüfungsende ihre Punkte, Begründungen und die Korrekturzeichen aller Korrekturen einsehen. Interne Kommentare bleiben verborgen.", "Freigeben", "Abbrechen", false))) return;
        await setSetting("einsicht", { released: !rel }); toast(rel ? "Einsicht-Freigabe zurückgezogen" : "Prüfungseinsicht freigegeben");
      };
    },
  };
}

// ---------- Prüfungseinsicht ----------
export function einsichtView(pid, { participantView = false } = {}) {
  const p = byId("participants", pid);
  if (!p) return { redirect: "#/app/ergebnisse" };
  const open = new Set([ALL_SUBTASKS[0].no]);
  const body = () => {
    const t = totals(pid);
    return `<div class="pagehead"><div><h1>Prüfungseinsicht</h1><div class="sub">${esc(p.lastname)}, ${esc(p.firstname)} · ${esc(EXAM.name)}</div></div>
      <div class="stat" style="min-width:220px"><div class="small muted">Ergebnis</div><div class="v">${t.complete ? `${fmtP(t.sum)} / ${TOTAL_POINTS}` : "noch offen"}</div>${t.complete ? `<div class="small">Note ${grade(t.sum)} (${GRADE_TXT[grade(t.sum)]})</div>` : ""}</div></div>
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

// Korrekturmodus mit Randkorrektur, Unterstreichungen, Stifteingabe (Tablet) und Vergleichsansicht
//  - Erstkorrektur: rot, rechter Rand · Zweitkorrektur: grün, linker Rand · Drittkorrektur (Endbeurteilung): braun, linker Rand außen
//  - Unterstreichen horizontal (einfach, doppelt, gekringelt) und vertikal (Randstrich)
//  - Stift: Gesten für Linien, handschriftliche Korrekturzeichen werden erkannt und an den Rand gesetzt
import { D, byId, setting, setSetting, createWithFile, fileUrl, del } from "../data.js?v=8.2";
import { icon, esc, toast, popMenu, store, uid, modal, confirmBox } from "../ui.js?v=8.2";
import { EXAM, ALL_SUBTASKS, subtask, SIGNS, CORRECTORS, ALL_SIGN_KEYS } from "../scenario.js?v=8.2";
import { navigate, redraw, session } from "../app.js?v=8.2";
import { grading, stPoints, saveGrading, candidates, corr, corrName, fmtP, commentsDrawer, favoritesDrawer, lessonMode } from "./correction.js?v=8.2";
import { recognizeSign, classifyGesture, decide, glyphStrokes, packSample, setUserSamples } from "../ink.js?v=8.2";

const PW = 900, ML = 110, MR = 790;               // Papierbreite, Textspalte links/rechts
const VX = { 1: MR + 8, 2: ML - 8, 3: ML - 16 };    // Randstrich je Korrektor
const SX = { 1: MR + 14, 2: 56, 3: 4 };             // Randzeichen je Korrektor (linke Kante)
const MW = { 1: PW - MR - 18, 2: ML - 60, 3: 48 };    // verfügbare Randbreite je Korrektor
const LH = 21.7;                                     // Zeilenhöhe des Dokuments (14 px × 1,55)
const K = {
  autoFit: true, tool: "select", sign: null, hstyle: "single", sel: null, zoom: 1, sideOpen: !store.lget("tablet", false), scroll: 0, flash: null,
  get tablet() { return !!store.lget("tablet", false); }, set tablet(v) { store.lset("tablet", v); document.body.classList.toggle("tablet", !!v); },
};
document.body.classList.toggle("tablet", K.tablet);
window.__ink = { glyphStrokes, recognizeSign, classifyGesture, decide }; // für automatisierte Tests

// ---------- Persönliche Schriftproben je Korrektor (Einlernen und Lernen aus Korrekturen) ----------
const inkKey = (c) => "ink." + c;
const samplesOf = (c) => setting(inkKey(c), {}) || {};
function loadSamples(c) { setUserSamples(samplesOf(c)); }
async function learn(c, sign, strokes) {
  const all = { ...samplesOf(c) }; all[sign] = [...(all[sign] || []), packSample(strokes)].slice(-5);
  await setSetting(inkKey(c), all); setUserSamples(all);
}
// Kleines Auswahlfenster am geschriebenen Zeichen
function inkPop(x, y, html, bind) {
  document.querySelector(".inkpop")?.remove();
  const el = document.createElement("div"); el.className = "inkpop"; el.innerHTML = html;
  Object.assign(el.style, { left: Math.max(8, Math.min(x, window.innerWidth - 340)) + "px", top: Math.max(8, Math.min(y, window.innerHeight - 140)) + "px" });
  document.body.appendChild(el); bind(el);
  const off = (e) => { if (!el.contains(e.target)) { el.remove(); document.removeEventListener("pointerdown", off, true); } };
  setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
  return el;
}
async function trainDialog(own) {
  const keys = ALL_SIGN_KEYS;
  await modal({ title: "Handschrift einlernen", size: "wide", headIcon: icon("pen-tool", "lg"),
    body: `<p class="small">Schreiben Sie jedes Korrekturzeichen ein- bis zweimal so, wie Sie es beim Korrigieren schreiben. Die Proben werden für <b>${esc(CORRECTORS[own].label)}</b> gespeichert und verbessern die Erkennung deutlich. Auch jede Auswahl einer Alternative nach der Erkennung wird als Probe gelernt.</p>
      <div class="train"><div class="train-keys" data-tkeys></div><div><div class="row between"><b data-cur></b><span class="xs muted" data-cnt></span></div><canvas class="train-pad" width="460" height="230" data-pad aria-label="Schreibfeld"></canvas>
      <div class="row between mt-s"><button class="btn sm ghost" data-clr>${icon("eraser")} Feld leeren</button><button class="btn sm primary" data-save>${icon("save")} Probe speichern</button></div><div class="xs muted mt-s" data-res></div></div></div>`,
    footer: `<button class="btn ghost" data-reset>${icon("trash-2")} Alle Proben löschen</button><span class="grow"></span><button class="btn primary" data-close>Fertig</button>`,
    onMount(m) {
      let cur = keys[0], strokes = [], drawing = null;
      const pad = m.querySelector("[data-pad]"), c2 = pad.getContext("2d");
      const drawKeys = () => { const S = samplesOf(own); m.querySelector("[data-tkeys]").innerHTML = keys.map((k) => `<button class="tkey ${k === cur ? "on" : ""}" data-k="${esc(k)}" title="${esc(signTitle(k))}">${esc(k)}<i>${(S[k] || []).length || ""}</i></button>`).join(""); m.querySelector("[data-cur]").textContent = signTitle(cur); m.querySelector("[data-cnt]").textContent = `${(S[cur] || []).length} von max. 5 Proben gespeichert`; m.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => { cur = b.dataset.k; clr(); drawKeys(); })); };
      const clr = () => { strokes = []; c2.clearRect(0, 0, pad.width, pad.height); c2.strokeStyle = "#ddd"; c2.beginPath(); c2.moveTo(10, 170); c2.lineTo(450, 170); c2.stroke(); m.querySelector("[data-res]").textContent = ""; };
      const pt = (e) => { const r = pad.getBoundingClientRect(); return { x: ((e.clientX - r.left) * pad.width) / r.width, y: ((e.clientY - r.top) * pad.height) / r.height }; };
      pad.onpointerdown = (e) => { try { pad.setPointerCapture(e.pointerId); } catch (_) {} drawing = [pt(e)]; strokes.push(drawing); };
      pad.onpointermove = (e) => { if (!drawing) return; const p = pt(e), l = drawing[drawing.length - 1]; c2.strokeStyle = colorOf(own); c2.lineWidth = 3; c2.lineCap = "round"; c2.beginPath(); c2.moveTo(l.x, l.y); c2.lineTo(p.x, p.y); c2.stroke(); drawing.push(p); };
      pad.onpointerup = () => { drawing = null; };
      m.querySelector("[data-clr]").onclick = clr;
      m.querySelector("[data-save]").onclick = async () => {
        const st = strokes.filter((x) => x.length > 1); if (!st.length) return;
        const r = recognizeSign(st)[0];
        await learn(own, cur, st);
        m.querySelector("[data-res]").textContent = `Gespeichert. Vor dem Einlernen erkannt: ${r ? r.sign + " (" + Math.round(r.score * 100) + " %)" : "–"}`;
        const i = keys.indexOf(cur); strokes = []; setTimeout(() => { if ((samplesOf(own)[cur] || []).length >= 2 && i < keys.length - 1) cur = keys[i + 1]; clr(); drawKeys(); }, 700);
      };
      m.querySelector("[data-reset]").onclick = async () => { if (await confirmBox("Proben löschen", "Alle eingelernten Schriftproben dieser Korrekturrolle werden gelöscht.", "Löschen")) { await setSetting(inkKey(own), {}); setUserSamples({}); drawKeys(); } };
      clr(); drawKeys();
    } });
}

const signTitle = (k) => { for (const g of SIGNS) for (const [s, t] of g.items) if (s === k) return `${s}: ${t}`; return k; };
const colorOf = (c) => CORRECTORS[c]?.color || "#333";

// ---------- Dokumentdarstellung ----------
const companyMini = () => `<div style="display:inline-flex;gap:8px;align-items:center;border:2px solid #333;padding:4px 8px;font-weight:700">FunSport<br><span style="font-size:9px;font-weight:400">Innovations GmbH</span></div>`;
const sheetTable = () => `<table><tr><th>Pos.</th><th>Bezeichnung</th><th>BatteryWorld</th><th>InnovaTech</th></tr><tr><td>1</td><td>Listeneinkaufspreis (300 Stk.)</td><td>34.500,00 €</td><td>33.900,00 €</td></tr><tr><td>2</td><td>– Rabatt</td><td>3.450,00 €</td><td>1.695,00 €</td></tr><tr><td>3</td><td>Zieleinkaufspreis</td><td>31.050,00 €</td><td>32.205,00 €</td></tr><tr><td>4</td><td>– Skonto</td><td>621,00 €</td><td>966,15 €</td></tr><tr><td>5</td><td>+ Bezugskosten</td><td>450,00 €</td><td>0,00 €</td></tr><tr><td><b>6</b></td><td><b>Bezugspreis</b></td><td><b>30.879,00 €</b></td><td><b>31.238,85 €</b></td></tr></table>`;
const calcTable = () => `<table><tr><th>Pos.</th><th>Bezeichnung</th><th>Menge</th><th>Einzelpreis</th><th>Gesamtpreis</th></tr><tr><td>1</td><td>Lithium-Batterie-Pack LBP-36V</td><td>300</td><td>115,00 €</td><td>34.500,00 €</td></tr><tr><td>2</td><td>Rabatt 10 %</td><td></td><td></td><td>−3.450,00 €</td></tr><tr><td>3</td><td>Skonto 2 %</td><td></td><td></td><td>−621,00 €</td></tr><tr><td>4</td><td>Fracht/Verpackung</td><td></td><td></td><td>450,00 €</td></tr><tr><td></td><td><b>Bezugspreis</b></td><td></td><td></td><td><b>30.879,00 €</b></td></tr></table>`;
function paperFor(it, p) {
  const name = `${p.firstname} ${p.lastname}`;
  if (it.kind === "mail") {
    const body = it.data.html ? it.data.html.replace(/<blockquote[\s\S]*<\/blockquote>/, "") : esc(it.data.body).replace(/\n/g, "<br>");
    return `<div class="letterhead"><div><div class="sender-line">${esc(EXAM.company.name)} · Sportparkallee 12 · 70173 Stuttgart</div><div class="mt-s">An: ${esc(it.data.to)}</div></div><div style="text-align:right">${companyMini()}<div style="font-size:12px;margin-top:10px">Von: ${esc(it.data.from)}<br>${esc(it.data.from_mail)}<br>Datum: ${esc(it.data.date)}</div></div></div>
    <p><b>${esc(it.data.subject)}</b></p><div class="ptext">${body}</div>
    ${(it.data.attachments || []).map((a) => `<div style="margin-top:28px"><b>Anhang: ${esc(a)}</b>${a.toLowerCase().includes("vergleich") ? sheetTable() : ""}</div>`).join("")}`;
  }
  if (it.kind === "ticket") return `<div class="letterhead"><b>${icon("ticket")} Ticket #${esc(it.data.no)} – ${esc(it.data.subject)}</b><span style="font-size:12px">${esc(name)} · Status: ${esc(it.data.status)}</span></div><p style="color:#555;font-size:13px"><b>Anfrage:</b> ${esc(it.data.desc || "")}</p><h3>Lösung</h3><div class="ptext">${it.data.solution || "<p><i>keine Lösung eingetragen</i></p>"}</div>`;
  if (it.kind === "file" && it.file) { const u = fileUrl(it); const img = /^(PNG|JPG|JPEG|GIF|WEBP)$/i.test(it.data.format || "");
    return `<div class="letterhead"><b>${esc(it.data.name)}</b><span style="font-size:12px">${esc(name)} · ${esc(it.data.changed)} · <a href="${u}?download=1" download>herunterladen</a></span></div>${img ? `<img src="${u}" alt="${esc(it.data.name)}" style="max-width:100%">` : /^PDF$/i.test(it.data.format || "") ? `<iframe src="${u}" title="${esc(it.data.name)}" style="width:100%;height:900px;border:1px solid #ddd"></iframe>` : `<p>Hochgeladene Datei (${esc(it.data.format)}, ${esc(it.data.size)}). Eine Vorschau ist für dieses Format nicht verfügbar – bitte herunterladen.</p>`}`; }
  if (it.kind === "file") return `<div class="letterhead"><b>${esc(it.data.name)}</b><span style="font-size:12px">${esc(name)} · ${esc(it.data.changed)}</span></div><h3>Bezugskalkulation 300 Lithium-Batterie-Packs</h3>${calcTable()}<p style="margin-top:20px">Ergebnis: Das Angebot der BatteryWorld GmbH ist unter Berücksichtigung aller Konditionen günstiger, da der Bezugspreis um 359,85 € niedriger liegt. Zusätzlich ist die Lieferzeit kürzer.</p>`;
  if (it.kind === "event") return `<h3>Termin: ${esc(it.data.title)}</h3><p>Tag ${+it.data.day + 1} der Woche, ${esc(it.data.start)} – ${esc(it.data.end)} Uhr<br>Ort: ${esc(it.data.location || "–")}</p><p>${esc(it.data.desc || "")}</p>`;
  if (it.kind === "code") return `<div class="letterhead"><b>${icon("file-code")} ${esc(it.data.name)}</b><span style="font-size:12px">${esc(name)} · Entwicklungsumgebung</span></div><pre class="kcode">${(it.data.code || "").split("\n").map((l, i) => `<span class="ln">${i + 1}</span>${esc(l) || " "}`).join("\n")}</pre>`;
  return `<div class="letterhead"><b>Notiz: ${esc(it.data.title || "")}</b><span style="font-size:12px">${esc(name)}</span></div><div>${it.data.html || ""}</div>`;
}

// ---------- Markierungen zeichnen ----------
function waves(x1, x2, y) { let d = `M${x1},${y}`; let up = true; for (let x = x1; x < x2; x += 7) { d += ` Q${x + 3.5},${y + (up ? -3.2 : 3.2)} ${Math.min(x + 7, x2)},${y}`; up = !up; } return d; }
function annotations(pid, st, own, all = false) {
  // Es werden stets alle vorhandenen Korrekturen angezeigt (EK rechts rot, ZK links grün, DK links außen braun)
  const list = D.gradings.filter((g) => g.participant === pid).flatMap((g) => (g.marks?.[st] || []).map((m) => ({ ...m, c: g.corrector, mine: g.corrector === own })));
  let svg = "", signs = "";
  const signList = { 1: [], 2: [], 3: [] };
  list.sort((a, b) => (a.ay || a.y || a.y1 || 0) - (b.ay || b.y || b.y1 || 0)).forEach((m) => {
    const col = colorOf(m.c); const sel = K.sel === m.id;
    const common = `data-mid="${m.id}" data-mine="${m.mine ? 1 : 0}" class="ann ${sel ? "sel" : ""} ${m.mine ? "mine" : ""}"`;
    if (m.type === "hline") {
      const y = m.y + 3;
      const d = m.style === "wavy" ? waves(m.x1, m.x2, y) : `M${m.x1},${y} L${m.x2},${y}` + (m.style === "double" ? ` M${m.x1},${y + 4} L${m.x2},${y + 4}` : "");
      svg += `<g ${common}><path d="${d}" stroke="${col}" stroke-width="${sel ? 2.6 : 1.8}" fill="none"/><path d="M${m.x1},${y + 2} L${m.x2},${y + 2}" stroke="transparent" stroke-width="14"/></g>`;
    } else if (m.type === "vline") {
      const x = VX[m.c];
      svg += `<g ${common}><path d="M${x},${m.y1} L${x},${m.y2}" stroke="${col}" stroke-width="${sel ? 3.2 : 2.4}"/><path d="M${x},${m.y1} L${x},${m.y2}" stroke="transparent" stroke-width="16"/></g>`;
    } else if (m.type === "sign") {
      signList[m.c]?.push({ m, common, col });
    }
  });
  // Korrekturzeichen derselben Zeile: kommasepariert nebeneinander, Umbruch erst wenn die Randbreite voll ist
  for (const c of [1, 2, 3]) {
    const groups = [];
    signList[c].forEach((x) => { const key = Math.round(x.m.ay / LH); const g = groups.find((q) => q.key === key); if (g) g.items.push(x); else groups.push({ key, y: x.m.ay, items: [x] }); });
    let bottom = -Infinity;
    groups.sort((a, b) => a.y - b.y).forEach((g) => {
      g.items.sort((a, b) => a.m.ax - b.m.ax);
      const top = Math.max(g.y - 10, bottom + 2);
      const len = g.items.reduce((n, x) => n + x.m.sign.length + 2, -2);
      const rows = Math.max(1, Math.ceil((len * 9.2) / MW[c]));
      bottom = top + rows * 19;
      signs += `<div class="ksgroup ${CORRECTORS[c].side}" style="left:${SX[c]}px;top:${top}px;width:${MW[c]}px;color:${g.items[0].col}">${g.items.map((x, k) => `<span ${x.common} data-ax="${x.m.ax}" data-ay="${x.m.ay}" data-sy="${top + 10}" data-c="${c}" role="button" tabindex="0" title="${esc(signTitle(x.m.sign))} · ${esc(CORRECTORS[c].label)} – klicken, um die markierte Stelle anzuzeigen">${esc(x.m.sign)}</span>${k < g.items.length - 1 ? `<i class="kscomma">, </i>` : ""}`).join("")}</div>`;
    });
  }
  return { svg, signs, list };
}

function shortcutHelp() {
  const rows = [["1 … 9", "Favorisiertes Korrekturzeichen wählen"], ["U", "Unterstreichen (erneut drücken: einfach → doppelt → gekringelt)"], ["V", "Vertikaler Randstrich"], ["P", "Stift"], ["E", "Radierer"], ["S / Esc", "Auswählen"], ["Entf", "Ausgewählte Markierung löschen"], ["Alt + ← / →", "Vorheriger / nächster Prüfling"], ["N", "Nächste Teilaufgabe"], ["B", "Bewertungsbereich ein-/ausklappen"], ["Umschalt + F", "Korrekturfläche maximieren"], ["+ / −", "Zoom"], ["?", "Diese Übersicht"]];
  modal({ title: "Tastenkürzel im Korrekturmodus", body: `<table class="tbl"><tbody>${rows.map(([a, b]) => `<tr><td class="nowrap">${a.split(" ").map((x) => (/^[+/…→←]$|^\/$/.test(x) ? x : `<kbd>${x}</kbd>`)).join(" ")}</td><td>${b}</td></tr>`).join("")}</tbody></table>`, footer: `<button class="btn primary" data-close>Schließen</button>` });
}

// ---------- Hervorhebung der zu einem Randzeichen gehörenden Textstelle ----------
export function highlightSign(span) {
  const paper = span.closest(".kpaper2"); if (!paper) return;
  paper.querySelectorAll(".khilite").forEach((x) => x.remove());
  const ax = +span.dataset.ax, ay = +span.dataset.ay, sy = +span.dataset.sy, c = +span.dataset.c, col = colorOf(c);
  const box = document.createElement("div"); box.className = "khilite";
  Object.assign(box.style, { left: Math.max(ML - 4, ax - 14) + "px", top: ay - 13 + "px", width: "150px", height: "26px", background: col + "22", outline: `2px solid ${col}`, boxShadow: `0 0 0 4px ${col}22` });
  paper.appendChild(box);
  const svg = paper.querySelector("svg"); if (svg) {
    const sp = span.getBoundingClientRect(), pr = paper.getBoundingClientRect(), zz = pr.width / PW || 1;
    const sx = CORRECTORS[c].side === "right" ? (sp.left - pr.left) / zz - 2 : (sp.right - pr.left) / zz + 2;
    const ln = document.createElementNS("http://www.w3.org/2000/svg", "path");
    ln.setAttribute("d", `M${sx},${sy} L${ax},${ay}`); ln.setAttribute("stroke", col); ln.setAttribute("stroke-width", "1.6"); ln.setAttribute("stroke-dasharray", "4 3"); ln.setAttribute("fill", "none"); ln.setAttribute("class", "khilite");
    svg.appendChild(ln); setTimeout(() => ln.remove(), 2700);
  }
  setTimeout(() => box.remove(), 2700);
  const wrap = paper.closest("[data-wrap], .kpaper-wrap"); const z = parseFloat((paper.style.transform.match(/scale\(([\d.]+)\)/) || [0, 1])[1]);
  if (wrap && wrap.scrollHeight > wrap.clientHeight) { const top = ay * z - wrap.clientHeight / 2; if (Math.abs(wrap.scrollTop - top) > wrap.clientHeight / 2 - 40) wrap.scrollTo({ top, behavior: "smooth" }); }
}
// Schreibgeschützte Ansichten (Prüfungseinsicht, Vergleich): Klick auf Randzeichen
document.addEventListener("click", (e) => { const s = e.target.closest("[data-ro-sizer] .ksigns [data-mid]"); if (s) highlightSign(s); });

// ---------- Schreibgeschützte Papierdarstellung (Prüfungseinsicht) ----------
export function roPaper(pid, st, zoom = 0.8) {
  const p = byId("participants", pid);
  const subs = D.items.filter((i) => i.participant === pid && i.submission === st);
  const ann = annotations(pid, st, 0, true);
  return `<div class="kpaper-wrap ro"><div class="ksizer" data-ro-sizer data-zoom="${zoom}"><div class="kpaper2 tool-ro" style="width:${PW}px;transform:scale(${zoom})">
    <div class="kmargin l"></div><div class="kmargin r"></div>
    <div class="kcontent">${subs.length ? subs.map((it) => paperFor(it, p)).join('<hr class="ksep">') : `<div class="empty">${icon("file")}<p>Keine Abgabe zu dieser Teilaufgabe.</p></div>`}</div>
    <svg class="kann" width="${PW}" height="100">${ann.svg}</svg><div class="ksigns">${ann.signs}</div></div></div></div>`;
}
export function fitRoPapers(root) {
  root.querySelectorAll("[data-ro-sizer]").forEach((sz) => {
    const z = +sz.dataset.zoom; const paper = sz.firstElementChild; if (!paper.offsetParent) return;
    paper.style.height = "auto"; const H = Math.max(500, paper.scrollHeight);
    paper.style.height = H + "px"; paper.querySelector("svg").setAttribute("height", H);
    sz.style.width = PW * z + "px"; sz.style.height = H * z + "px";
  });
}

// ---------- Ansicht ----------
export function mode(pid, st, q, compare) {
  const p = byId("participants", pid); const s = subtask(st);
  if (!p || !s) return { redirect: "#/app/korrektur" };
  const ps = candidates();
  const own = corr();
  let pen = null; // Stiftzustand
  return {
    shell: "staff", rail: "ergebnisse", title: compare ? "Vergleichsansicht" : "Korrekturmodus",
    freeze: () => !!(pen && (pen.strokes.length || pen.drawing)),
    render() {
      const g = grading(pid, own);
      const locked = compare || !!g?.released;
      const subs = D.items.filter((i) => i.participant === pid && i.submission === st);
      const cmts = D.comments.filter((x) => x.participant === pid && x.subtask === st);
      const idx = ps.findIndex((x) => x.id === pid);
      const favs = setting("favorites", ["Uv", "Ug", "r", "(r)", "f"]);
      const v = g?.points?.[st] || [];
      const nd = !!g?.not_done?.[st];
      const sum = stPoints(g, st);
      const kf = D.kfiles.filter((f) => f.participant === pid && f.subtask === st);
      const ann = annotations(pid, st, own);
      const tb = (tool, ic, label, extra = "") => `<button class="tbtn ${K.tool === tool ? "on" : ""}" data-tool="${tool}" title="${label}" aria-pressed="${K.tool === tool}" ${locked ? "disabled" : ""} ${extra}>${icon(ic)}<span>${label}</span></button>`;
      const HS = { single: "einfach", double: "doppelt", wavy: "gekringelt" };
      return `<div class="kmode-bar">
        ${compare ? `<button class="btn" data-closetab>${icon("x")} Vergleich schließen</button>` : `<a class="btn" href="#/app/korrektur">${icon("arrow-left")} Zurück zur Übersicht</a>`}
        <select class="select" data-st aria-label="Teilaufgabe">${ALL_SUBTASKS.map((x) => `<option value="${x.no}" ${x.no === st ? "selected" : ""}>Aufgabe ${x.no} ${esc(x.title)}</option>`).join("")}</select>
        <select class="select" data-p aria-label="Prüfling">${ps.map((x) => `<option value="${x.id}" ${x.id === pid ? "selected" : ""}>${esc(x.lastname)}, ${esc(x.firstname)}</option>`).join("")}</select>
        <button class="btn icon" data-prev ${idx <= 0 ? "disabled" : ""} aria-label="Vorheriger Prüfling" title="Vorheriger Prüfling">${icon("arrow-left")}</button><button class="btn icon" data-next ${idx >= ps.length - 1 ? "disabled" : ""} aria-label="Nächster Prüfling" title="Nächster Prüfling">${icon("arrow-right")}</button>
        <span class="grow"></span>
        ${compare ? "" : `<button class="btn primary" data-cmp>${icon("external-link")} Vergleichen</button>`}
        <button class="btn primary" data-horizon>${icon("file-text")} Erwartungshorizont</button>
        ${compare ? "" : `<button class="btn primary icon" data-cmts aria-label="Kommentare" title="Kommentare" style="position:relative">${icon("message-square", "lg")}${cmts.length ? `<span class="cbadge">${cmts.length}</span>` : ""}</button>`}
        <button class="btn icon ${K.tablet ? "primary" : ""}" data-tablet title="Tablet-Ansicht mit Stifteingabe" aria-pressed="${K.tablet}">${icon("tablet")}</button>
        <button class="btn icon" data-focus title="Korrekturfläche maximieren" aria-pressed="${document.body.classList.contains("kfocus")}">${icon(document.body.classList.contains("kfocus") ? "minimize" : "maximize")}</button>
      </div>
      <div class="row wrap mb" style="align-items:baseline;gap:12px"><h1 class="ktitle">${compare ? "Vergleichsansicht" : esc(EXAM.name)}</h1><span class="sub" style="font-size:19px">${esc(p.lastname)}, ${esc(p.firstname)} · Teilaufgabe ${esc(st)} ${esc(s.title)}</span>
        <span class="badge" style="background:${colorOf(own)};color:#fff">${esc(corrName(own))}</span>
        ${(() => { const n = ps.filter((x) => stPoints(grading(x.id, own), st) !== null).length; return `<span class="small row" style="gap:6px" title="Fortschritt dieser Teilaufgabe über alle Prüflinge">bewertet ${n}/${ps.length} <span class="miniprogress" style="width:90px"><i style="width:${ps.length ? (n / ps.length) * 100 : 0}%"></i></span></span>`; })()}
        ${compare ? "" : `<button class="btn ghost sm" data-keys title="Tastenkürzel (?)">${icon("circle-question-mark")} Tastenkürzel</button>`}${compare ? `<span class="badge gray">${icon("lock")} schreibgeschützt</span>` : ""}${g?.released && !compare ? `<span class="badge green">${icon("lock")} freigegeben</span>` : ""}</div>
      <div class="kgrid ${K.sideOpen ? "" : "sideclosed"}">
        <section class="kdoc">
          ${locked ? "" : `<div class="ktools">
            <div class="cats">${SIGNS.map((grp, gi) => `<button class="btn ghost sm" data-cat="${gi}">${esc(grp.group)} ${icon("chevron-down")}</button>`).join("")}<span class="grow"></span><button class="btn ghost sm" data-favs>Favoriten verwalten ${icon("settings")}</button></div>
            <div class="toolrow">
              ${tb("select", "mouse-pointer-2", "Auswählen")}
              <span class="tsep"></span>
              <div class="signs">${favs.map((f) => `<button class="sign ${K.tool === "sign" && K.sign === f ? "on" : ""}" data-sign="${esc(f)}" title="${esc(signTitle(f))}" style="${K.tool === "sign" && K.sign === f ? `background:${colorOf(own)};border-color:${colorOf(own)}` : ""}">${esc(f)}</button>`).join("")}${K.tool === "sign" && K.sign && !favs.includes(K.sign) ? `<button class="sign on" data-sign="${esc(K.sign)}" style="background:${colorOf(own)}">${esc(K.sign)}</button>` : ""}</div>
              <span class="tsep"></span>
              ${tb("hline", "underline", "Unterstreichen")}<button class="btn ghost sm" data-hstyle title="Art der Unterstreichung">${HS[K.hstyle]} ${icon("chevron-down")}</button>
              ${tb("vline", "move-vertical", "Vertikal")}
              <span class="tsep"></span>
              ${tb("pen", "pen-tool", "Stift")}<button class="btn ghost sm" data-train title="Eigene Handschrift für die Zeichenerkennung einlernen" ${locked ? "disabled" : ""}>${icon("graduation-cap")} Einlernen</button>${tb("eraser", "eraser", "Radierer")}
              <span class="grow"></span>
              <button class="iconbtn boxed" data-delmark ${K.sel ? "" : "disabled"} aria-label="Markierung löschen" title="Ausgewählte Markierung löschen (Entf)">${icon("trash-2", "lg")}</button><button class="iconbtn boxed" data-zoom="-1" aria-label="Verkleinern">${icon("zoom-out", "lg")}</button><button class="iconbtn boxed" data-zoom="1" aria-label="Vergrößern">${icon("zoom-in", "lg")}</button>
            </div>
            <div class="row wrap xs muted" style="margin-top:6px;gap:14px">${hint()}<span class="grow"></span>${(lessonMode() ? [1] : [1, 2, 3]).map((c) => `<span class="row" style="gap:4px"><i class="cdot" style="background:${colorOf(c)}"></i>${lessonMode() ? "Korrektur" : CORRECTORS[c].short} ${CORRECTORS[c].side === "right" ? "rechts" : c === 3 ? "links außen" : "links"}</span>`).join("")}</div>
          </div>`}
          ${locked ? `<div class="ktools row wrap xs" style="gap:14px">${icon("lock")} Schreibgeschützte Ansicht – Markierungen aller Korrekturen werden angezeigt.<span class="grow"></span>${(lessonMode() ? [1] : [1, 2, 3]).map((c) => `<span class="row" style="gap:4px"><i class="cdot" style="background:${colorOf(c)}"></i>${CORRECTORS[c].label}</span>`).join("")}<button class="iconbtn boxed" data-zoom="-1" aria-label="Verkleinern">${icon("zoom-out")}</button><button class="iconbtn boxed" data-zoom="1" aria-label="Vergrößern">${icon("zoom-in")}</button></div>` : ""}
          <div class="kpaper-wrap" data-wrap><div class="ksizer" data-sizer><div class="kpaper2 tool-${locked ? "ro" : K.tool}" data-paper style="width:${PW}px;transform:scale(${K.zoom})">
            <div class="kmargin l"></div><div class="kmargin r"></div>
            <div class="kcontent">${subs.length ? subs.map((it) => paperFor(it, p)).join('<hr class="ksep">') : `<div class="empty">${icon("file")}<h3>Keine Abgabe</h3><p>Zu dieser Teilaufgabe wurde nichts als Abgabe markiert.</p><p>Wählen Sie ggf. „Aufgabe nicht bearbeitet“.</p></div>`}</div>
            <svg class="kann" data-svg width="${PW}" height="100">${ann.svg}<g data-temp></g></svg>
            <div class="ksigns">${ann.signs}</div>
            <canvas class="kink" data-ink width="${PW}" height="100"></canvas>
          </div></div></div>
        </section>
        <aside class="kside ${K.sideOpen ? "" : "closed"}"><button class="tab" data-side aria-label="Bewertungsbereich ${K.sideOpen ? "einklappen" : "ausklappen"}" title="Bewertungsbereich ${K.sideOpen ? "einklappen" : "ausklappen"}">${icon(K.sideOpen ? "chevron-right" : "chevron-left", "lg")}<span>Bewertungsansichten</span></button>
          <div class="body">
            <div class="sec"><div class="row between"><h3>Punktezahl</h3>${compare ? `<span class="xs muted">${esc(corrName(own))}</span>` : ""}</div>
              <label class="checkbox card pad" style="padding:10px 14px;margin:12px 0"><input type="checkbox" data-nd ${nd ? "checked" : ""} ${locked ? "disabled" : ""}> Aufgabe nicht bearbeitet</label>
              <div class="crit small bold"><span></span><span>VP</span><span>Max.</span></div>
              ${s.criteria.map(([name, max], i) => `<div class="crit"><span class="row" style="gap:4px">${locked || nd ? "" : `<button class="iconbtn" style="width:28px;height:28px" data-bst="${i}" title="Bewertungsbaustein für „${esc(name)}“" aria-label="Bewertungsbaustein für ${esc(name)}">${icon("list")}</button>`}${esc(name)}</span><select class="select" data-crit="${i}" ${locked || nd ? "disabled" : ""}><option value="">–</option>${Array.from({ length: max * 2 + 1 }, (_, k) => k / 2).map((x) => `<option value="${x}" ${v[i] !== undefined && v[i] !== null && +v[i] === x ? "selected" : ""}>${String(x).replace(".", ",")}</option>`).join("")}</select><span>${max}</span></div>`).join("")}
              <div class="ptotal">Punkte gesamt: ${sum === null ? "–" : fmtP(sum)} / ${s.points}</div>
              ${[1, 2, 3].filter((c) => c !== own && grading(pid, c) && stPoints(grading(pid, c), st) !== null).map((c) => `<div class="xs" style="color:${colorOf(c)}">${esc(CORRECTORS[c].label)}: ${fmtP(stPoints(grading(pid, c), st))} P</div>`).join("")}
              <span class="xs muted" data-saved></span>
            </div>
            <div class="sec"><h3>Begründung</h3><p class="xs muted">Wird in der Prüfungseinsicht angezeigt. Bausteine (${icon("list")}) ergänzen Text und Punkte.</p>
              <textarea class="input" data-notes rows="4" ${locked ? "readonly" : ""} placeholder="Begründung der Bewertung …">${esc(g?.notes?.[st] || "")}</textarea></div>
            <div class="sec"><h3>Hochgeladene Dateien</h3>
              <div class="bold small mt-s">Korrektur</div><div class="kfiles">${kf.length ? kf.map((f) => `<div class="kfile">${icon("file")}<a href="${fileUrl(f)}?download=1" download="${esc(f.name)}" title="${esc(f.name)}">${esc(f.name)}</a><span class="xs" style="color:${colorOf(f.corrector)}">${CORRECTORS[f.corrector]?.short || ""}</span>${!locked && f.corrector === own ? `<button class="iconbtn" style="width:26px;height:26px" data-delkf="${f.id}" aria-label="Datei löschen" title="Datei löschen">${icon("trash-2")}</button>` : ""}</div>`).join("") : `<div class="small muted">keine</div>`}</div>
              <div class="bold small mt">Teilnehmender</div>${subs.flatMap((it) => it.kind === "file" ? [`<span class="doclink">${icon("file")} ${it.file ? `<a href="${fileUrl(it)}?download=1" download>${esc(it.data.name)}</a>` : esc(it.data.name)}</span>`] : it.kind === "code" ? [`<span class="doclink">${icon("file-code")} ${esc(it.data.name)}</span>`] : (it.data.attachments || []).map((a) => `<span class="doclink">${icon("paperclip")} ${esc(a)}</span>`)).join("") || `<div class="small muted">keine</div>`}
              ${locked ? "" : `<div class="bold small mt">Dateiupload (Korrektur)</div><p class="xs muted" style="margin:2px 0 6px">z. B. Korrekturbogen, Nebenrechnung oder Gutachten – max. 20 MB. Sichtbar für alle Korrigierenden.</p><label class="btn block">${icon("upload")} Datei auswählen<input type="file" hidden data-upload></label>`}
            </div>
            <div class="sec"><h3>Aufgabenstellung</h3><p class="small">${esc(s.text)}</p><button class="link small" data-horizon>${icon("external-link")} Erwartungshorizont öffnen</button></div>
            ${!compare ? `<div class="sec"><button class="btn primary block" data-nextst>${icon("arrow-right")} Nächste Teilaufgabe</button></div>` : ""}
          </div></aside>
      </div>`;

      function hint() {
        const h = { select: "Klicken Sie auf eine Markierung, um sie auszuwählen (Entf löscht).", sign: `Korrekturzeichen „${K.sign}“ aktiv – in den Text klicken. Das Zeichen erscheint am ${CORRECTORS[own].side === "right" ? "rechten" : "linken"} Rand.`, hline: `Im Text ziehen, um ${HS[K.hstyle]} zu unterstreichen.`, vline: "Senkrecht ziehen, um eine Textpassage am Rand zu markieren.", pen: "Stift: waagerecht = unterstreichen, zwei Striche = doppelt, Wellenlinie = gekringelt, senkrecht = Randstrich, Zeichen schreiben = Korrekturzeichen.", eraser: "Markierung antippen, um sie zu löschen." };
        return `${icon("info")} ${esc(h[K.tool] || "")}`;
      }
    },
    mount(el) {
      this._off?.();
      const g0 = grading(pid, own);
      const locked = compare || !!g0?.released;
      const go = (np, ns) => navigate(`#/app/${compare ? "vergleich" : "korrektur"}/${np}/${ns}`);
      const q$ = (x) => el.querySelector(x);
      q$("[data-st]").onchange = (e) => go(pid, e.target.value);
      q$("[data-p]").onchange = (e) => go(e.target.value, st);
      const idx = ps.findIndex((x) => x.id === pid);
      q$("[data-prev]") && (q$("[data-prev]").onclick = () => go(ps[idx - 1].id, st));
      q$("[data-next]") && (q$("[data-next]").onclick = () => go(ps[idx + 1].id, st));
      el.querySelectorAll("[data-horizon]").forEach((b) => (b.onclick = () => window.open(`#/erwartung/${st}`, "_blank")));
      const ct = q$("[data-closetab]"); if (ct) ct.onclick = () => { window.close(); setTimeout(() => navigate(`#/app/korrektur/${pid}/${st}`), 150); };
      const cmp = q$("[data-cmp]");
      if (cmp) cmp.onclick = () => {
        const others = ps.filter((x) => x.id !== pid && D.items.some((i) => i.participant === x.id && i.submission === st));
        if (!others.length) return toast("Kein Vergleich möglich", "Kein anderer Prüfling hat diese Teilaufgabe abgegeben.", "info");
        popMenu(cmp, [{ header: `Vergleich mit anderem Prüfling (Teilaufgabe ${st})` }, ...others.map((x) => { const pt = stPoints(grading(x.id, own), st); return { label: `${x.lastname}, ${x.firstname}${pt !== null ? ` · ${fmtP(pt)} P` : ""}`, icon: "external-link", run: () => window.open(`#/app/vergleich/${x.id}/${st}`, "_blank") }; })]);
      };
      const cm = q$("[data-cmts]"); if (cm) cm.onclick = () => commentsDrawer(pid, st);
      q$("[data-side]").onclick = () => { K.sideOpen = !K.sideOpen; redraw(); };
      q$("[data-tablet]").onclick = () => { K.tablet = !K.tablet; if (K.tablet) { K.tool = "pen"; K.sideOpen = false; toast("Tablet-Ansicht aktiv", "Stifteingabe: Gesten für Linien und handschriftliche Korrekturzeichen. Mit dem Finger verschieben Sie das Dokument.", "info"); } redraw(); };
      q$("[data-focus]").onclick = () => { const on = !document.body.classList.contains("kfocus"); document.body.classList.toggle("kfocus", on); K.sideOpen = !on; redraw(); };
      el.querySelectorAll("[data-zoom]").forEach((b) => (b.onclick = () => { K.autoFit = false; K.zoom = Math.max(0.5, Math.min(1.8, +(K.zoom + (+b.dataset.zoom) * 0.1).toFixed(2))); redraw(); }));
      const nst = q$("[data-nextst]");
      if (nst) nst.onclick = () => { const i = ALL_SUBTASKS.findIndex((x) => x.no === st); if (i < ALL_SUBTASKS.length - 1) go(pid, ALL_SUBTASKS[i + 1].no); else { const np = ps[idx + 1]; if (np) go(np.id, ALL_SUBTASKS[0].no); else navigate("#/app/korrektur"); } };

      // Papiergröße an Inhalt anpassen, Scrollposition erhalten
      const wrap = q$("[data-wrap]"), paper = q$("[data-paper]"), svg = q$("[data-svg]"), ink = q$("[data-ink]");
      const H = Math.max(1100, paper.scrollHeight);
      paper.style.height = H + "px"; svg.setAttribute("height", H); ink.height = H;
      if (K.autoFit) { // Papier an die verfügbare Breite anpassen, damit beide Korrekturränder sichtbar sind
        const z = +Math.min(1, (wrap.clientWidth - 40) / PW).toFixed(2); if (Math.abs(z - K.zoom) > 0.02) { K.zoom = z; setTimeout(redraw, 0); } }
      const sizer = q$("[data-sizer]"); sizer.style.width = PW * K.zoom + "px"; sizer.style.height = H * K.zoom + "px";
      wrap.scrollTop = K.scroll; wrap.onscroll = () => (K.scroll = wrap.scrollTop);

      // Bewertung (auch bei gesperrter Ansicht nichts speichern)
      if (!locked) {
        el.querySelectorAll("[data-crit]").forEach((sel) => (sel.onchange = async () => {
          const g = grading(pid); const points = { ...(g?.points || {}) };
          const arr = [...(points[st] || s.criteria.map(() => null))];
          arr[+sel.dataset.crit] = sel.value === "" ? null : +sel.value;
          if (arr.some((x) => x !== null)) points[st] = arr.map((x) => x ?? 0); else delete points[st];
          sel.blur(); await saveGrading(pid, { points }); flash();
        }));
        const LEVELS = [["vollständig erfüllt", 1], ["überwiegend erfüllt", 0.75], ["teilweise erfüllt", 0.5], ["kaum erfüllt", 0.25], ["nicht erfüllt", 0]];
        el.querySelectorAll("[data-bst]").forEach((b) => (b.onclick = () => {
          const i = +b.dataset.bst; const [name, max] = s.criteria[i];
          popMenu(b, [{ header: name }, ...LEVELS.map(([l, f]) => { const pts = Math.round(max * f * 2) / 2; return { label: `${l} (${String(pts).replace(".", ",")} P)`, run: async () => {
            const g = grading(pid); const points = { ...(g?.points || {}) }; const arr = [...(points[st] || s.criteria.map(() => 0))]; arr[i] = pts; points[st] = arr;
            const notes = { ...(g?.notes || {}) }; const line = `${name}: ${l}.`; notes[st] = notes[st] ? notes[st].replace(new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: .*$`, "m"), line) : line; if (!notes[st].includes(line)) notes[st] += "\n" + line;
            await saveGrading(pid, { points, notes }); flash();
          } }; })], { align: "left" });
        }));
        const nt = q$("[data-notes]");
        if (nt) {
          const saveNotes = async () => { const g = grading(pid); if ((g?.notes?.[st] || "") === nt.value) return; await saveGrading(pid, { notes: { ...(g?.notes || {}), [st]: nt.value } }); flash("✓ Begründung automatisch gespeichert " + new Date().toLocaleTimeString("de-DE")); };
          nt.onchange = saveNotes; nt.onblur = saveNotes;
          const iv = setInterval(() => { if (!nt.isConnected) return clearInterval(iv); saveNotes(); }, 15000); // automatische Zwischenspeicherung
          const prevOff = this._off; this._off = () => { clearInterval(iv); prevOff?.(); };
        }
        q$("[data-nd]").onchange = async (e) => { const g = grading(pid); const nd = { ...(g?.not_done || {}) }; if (e.target.checked) nd[st] = true; else delete nd[st]; await saveGrading(pid, { not_done: nd }); flash(); };
        const up = q$("[data-upload]");
        if (up) up.onchange = async () => {
          const f = up.files[0]; if (!f) return;
          if (f.size > 20 * 1048576) return toast("Datei zu groß", "Maximal 20 MB sind erlaubt.", "error");
          try { await createWithFile("kfiles", { participant: pid, subtask: st, corrector: own, name: f.name }, f); toast("Datei hochgeladen", f.name); redraw(); }
          catch (e) { toast("Hochladen fehlgeschlagen", e?.message || "", "error"); }
        };
        el.querySelectorAll("[data-delkf]").forEach((b) => (b.onclick = async () => { const f = byId("kfiles", b.dataset.delkf); if (f && (await confirmBox("Datei löschen", `Möchten Sie „${esc(f.name)}“ löschen?`, "Löschen"))) { await del("kfiles", f.id); redraw(); } }));
        el.querySelectorAll("[data-tool]").forEach((b) => (b.onclick = () => { K.tool = b.dataset.tool; if (K.tool !== "sign") K.sign = null; redraw(); }));
        el.querySelectorAll("[data-sign]").forEach((b) => (b.onclick = () => { if (K.tool === "sign" && K.sign === b.dataset.sign) { K.tool = "select"; K.sign = null; } else { K.tool = "sign"; K.sign = b.dataset.sign; } redraw(); }));
        el.querySelectorAll("[data-cat]").forEach((b) => (b.onclick = () => popMenu(b, SIGNS[+b.dataset.cat].items.map(([k, t]) => ({ label: `${k} – ${t}`, run: () => { K.tool = "sign"; K.sign = k; redraw(); } })), { align: "left" })));
        q$("[data-favs]").onclick = favoritesDrawer;
        const tr = q$("[data-train]"); if (tr) tr.onclick = () => trainDialog(own);
        q$("[data-hstyle]").onclick = (e) => popMenu(e.currentTarget, [["single", "einfach unterstreichen"], ["double", "doppelt unterstreichen"], ["wavy", "unterkringeln (Wellenlinie)"]].map(([k, l]) => ({ label: l, icon: "underline", run: () => { K.hstyle = k; K.tool = "hline"; redraw(); } })), { align: "left" });
        q$("[data-delmark]").onclick = () => removeMark(K.sel);
      }
      const kb = q$("[data-keys]"); if (kb) kb.onclick = shortcutHelp;
      loadSamples(own);
      const onKey = (e) => {
        if (document.querySelector(".backdrop, .drawer, .popmenu")) return;
        if (e.target.matches("input,textarea,select") || e.target.isContentEditable) return;
        const k = e.key;
        if ((k === "Delete" || k === "Backspace") && K.sel) { e.preventDefault(); removeMark(K.sel); return; }
        if (k === "Escape") { K.sel = null; K.tool = "select"; K.sign = null; redraw(); return; }
        if (e.altKey && (k === "ArrowLeft" || k === "ArrowRight")) { e.preventDefault(); q$(k === "ArrowLeft" ? "[data-prev]" : "[data-next]")?.click(); return; }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (k === "?") { shortcutHelp(); return; }
        if (k === "b" || k === "B") { K.sideOpen = !K.sideOpen; redraw(); return; }
        if (k === "f" && e.shiftKey) { q$("[data-focus]")?.click(); return; }
        if (k === "+" || k === "-") { q$(`[data-zoom="${k === "+" ? 1 : -1}"]`)?.click(); return; }
        if (k === "n" || k === "N") { q$("[data-nextst]")?.click(); return; }
        if (locked) return;
        const favs = setting("favorites", ["Uv", "Ug", "r", "(r)", "f"]);
        if (/^[1-9]$/.test(k) && favs[+k - 1]) { K.tool = "sign"; K.sign = favs[+k - 1]; redraw(); return; }
        if (k === "u" || k === "U") { if (K.tool === "hline") K.hstyle = { single: "double", double: "wavy", wavy: "single" }[K.hstyle]; K.tool = "hline"; redraw(); return; }
        const t = { v: "vline", V: "vline", p: "pen", P: "pen", e: "eraser", E: "eraser", s: "select", S: "select" }[k];
        if (t) { K.tool = t; redraw(); }
      };
      document.addEventListener("keydown", onKey); const offNotes = this._off; this._off = () => { document.removeEventListener("keydown", onKey); offNotes?.(); };
      // Randzeichen angeklickt (auch mit Tastatur): markierte Stelle hervorheben
      el.querySelectorAll(".ksigns [data-mid]").forEach((s) => s.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); highlightSign(s); } }));
      if (K.flash) { const s = el.querySelector(`.ksigns [data-mid="${K.flash}"]`); K.flash = null; if (s) highlightSign(s); }

      // ---------- Zeiger-Interaktion auf dem Papier ----------
      const cap = (e) => { try { paper.setPointerCapture(e.pointerId); } catch (_) {} };
      const pt = (e) => { const r = paper.getBoundingClientRect(); return { x: (e.clientX - r.left) / K.zoom, y: (e.clientY - r.top) / K.zoom }; };
      const temp = svg.querySelector("[data-temp]");
      const ctx2 = ink.getContext("2d");
      let drag = null, pan = null, penTimer = null;
      pen = { strokes: [], drawing: false };
      const col = colorOf(own);

      paper.addEventListener("pointerdown", (e) => {
        const sg = e.target.closest(".ksigns [data-mid]");
        if (sg && (locked || K.tool !== "eraser")) {
          if (!locked && K.tool === "select") { K.sel = sg.dataset.mine === "1" ? sg.dataset.mid : null; K.flash = sg.dataset.mid; redraw(); return; }
          highlightSign(sg); return; // Zeichen setzen o. Ä. nicht auslösen
        }
        if (locked) return;
        // Finger verschiebt im Stiftmodus das Dokument (Handballenerkennung)
        if (e.pointerType === "touch" && (K.tablet || K.tool === "pen")) { pan = { y: e.clientY, x: e.clientX, st: wrap.scrollTop, sl: wrap.scrollLeft }; cap(e); return; }
        if (e.pointerType === "pen" && K.tool !== "pen" && K.tool !== "eraser") { K.tool = "pen"; if (!K.tablet) { K.tablet = true; K.sideOpen = false; toast("Stift erkannt", "Tablet-Ansicht mit Stifteingabe wurde aktiviert.", "info"); redraw(); return; } }
        const p0 = pt(e); const hit = e.target.closest("[data-mid]");
        if (K.tool === "eraser") { if (hit && hit.dataset.mine === "1") removeMark(hit.dataset.mid); return; }
        if (K.tool === "select") { K.sel = hit && hit.dataset.mine === "1" ? hit.dataset.mid : null; if (hit && hit.dataset.mine !== "1") toast("Markierung einer anderen Korrektur", "Nur eigene Markierungen können bearbeitet werden.", "info"); redraw(); return; }
        if (K.tool === "pen") { clearTimeout(penTimer); pen.drawing = true; pen.cur = [{ ...p0, t: e.timeStamp }]; pen.strokes.push(pen.cur); cap(e); ctx2.strokeStyle = col; ctx2.lineWidth = 2.2; ctx2.lineCap = "round"; ctx2.lineJoin = "round"; return; }
        drag = { p0, p1: p0 }; cap(e);
      });
      paper.addEventListener("pointermove", (e) => {
        if (pan) { wrap.scrollTop = pan.st - (e.clientY - pan.y); wrap.scrollLeft = pan.sl - (e.clientX - pan.x); return; }
        if (pen.drawing) { const p1 = pt(e); const last = pen.cur[pen.cur.length - 1]; ctx2.beginPath(); ctx2.moveTo(last.x, last.y); ctx2.lineTo(p1.x, p1.y); ctx2.stroke(); pen.cur.push({ ...p1, t: e.timeStamp }); return; }
        if (!drag) return;
        drag.p1 = pt(e);
        const { p0, p1 } = drag;
        if (K.tool === "hline") temp.innerHTML = `<path d="M${Math.min(p0.x, p1.x)},${p0.y + 3} L${Math.max(p0.x, p1.x)},${p0.y + 3}" stroke="${col}" stroke-width="2" stroke-dasharray="4 3"/>`;
        if (K.tool === "vline") temp.innerHTML = `<path d="M${VX[own]},${Math.min(p0.y, p1.y)} L${VX[own]},${Math.max(p0.y, p1.y)}" stroke="${col}" stroke-width="2.4" stroke-dasharray="4 3"/>`;
      });
      paper.addEventListener("pointerup", async (e) => {
        if (pan) { pan = null; return; }
        if (pen.drawing) { pen.drawing = false; clearTimeout(penTimer); penTimer = setTimeout(finishGesture, 900); return; }
        if (!drag) return;
        const { p0, p1 } = drag; drag = null; temp.innerHTML = "";
        if (K.tool === "sign" && K.sign && Math.hypot(p1.x - p0.x, p1.y - p0.y) < 6) await addMark({ type: "sign", sign: K.sign, ax: clampX(p0.x), ay: p0.y });
        if (K.tool === "hline" && Math.abs(p1.x - p0.x) > 10) await addMark({ type: "hline", style: K.hstyle, x1: clampX(Math.min(p0.x, p1.x)), x2: clampX(Math.max(p0.x, p1.x)), y: p0.y });
        if (K.tool === "vline" && Math.abs(p1.y - p0.y) > 10) await addMark({ type: "vline", y1: Math.min(p0.y, p1.y), y2: Math.max(p0.y, p1.y) });
      });
      paper.addEventListener("pointercancel", () => { drag = null; pan = null; pen.drawing = false; });

      const clampX = (x) => Math.max(ML, Math.min(MR, x));
      async function finishGesture() {
        const strokes = pen.strokes.filter((s) => s.length > 1); pen.strokes = [];
        const clear = () => ctx2.clearRect(0, 0, ink.width, ink.height);
        if (!strokes.length) { clear(); return; }
        const gst = classifyGesture(strokes);
        if (gst.type === "hline") { clear(); await addMark({ type: "hline", style: gst.style, x1: clampX(gst.x1), x2: clampX(gst.x2), y: gst.y }, `${{ single: "Einfache Unterstreichung", double: "Doppelte Unterstreichung", wavy: "Unterkringelung" }[gst.style]} erkannt`); return; }
        if (gst.type === "vline") { clear(); await addMark({ type: "vline", y1: gst.y1, y2: gst.y2 }, "Randstrich erkannt"); return; }
        const res = recognizeSign(strokes, ALL_SIGN_KEYS);
        const best = res[0]; const b = gst.bbox;
        const anchor = { ax: clampX(b.minX < ML || b.maxX > MR ? (CORRECTORS[own].side === "right" ? MR : ML) : b.minX), ay: b.cy };
        const pr = paper.getBoundingClientRect(); const px = pr.left + b.maxX * K.zoom + 12, py = pr.top + b.minY * K.zoom - 8;
        const dec = decide(res);
        if (dec === "accept") {
          clear();
          const id = await addMark({ type: "sign", sign: best.sign, ...anchor });
          // Bestätigung mit schneller Korrekturmöglichkeit; eine gewählte Alternative wird als Schriftprobe gelernt
          inkPop(px, py, `<div class="xs muted">Erkannt</div><div class="row" style="gap:6px"><b class="inkbig" style="color:${colorOf(own)}">${esc(best.sign)}</b><span class="xs">${esc(signTitle(best.sign).split(": ")[1] || "")}</span></div><div class="xs muted mt-s">Anderes Zeichen gemeint?</div><div class="row wrap" style="gap:4px">${res.slice(1, 5).map((x) => `<button class="btn xs" data-alt="${esc(x.sign)}">${esc(x.sign)}</button>`).join("")}<button class="btn xs" data-more>${icon("ellipsis-vertical")}</button><button class="btn xs ghost" data-undo>${icon("undo-2")} Rückgängig</button></div>`, (el) => {
            const t = setTimeout(() => el.remove(), 6000); el.onpointerenter = () => clearTimeout(t);
            el.querySelectorAll("[data-alt]").forEach((x) => (x.onclick = async () => { el.remove(); await changeSign(id, x.dataset.alt); await learn(own, x.dataset.alt, strokes); toast(`Geändert in „${x.dataset.alt}“`, "Ihre Schreibweise wurde gelernt.", "success", { ms: 2500 }); }));
            el.querySelector("[data-more]").onclick = (e) => popMenu(e.currentTarget, ALL_SIGN_KEYS.map((k) => ({ label: signTitle(k), run: async () => { el.remove(); await changeSign(id, k); await learn(own, k, strokes); } })), { align: "left" });
            el.querySelector("[data-undo]").onclick = () => { el.remove(); removeMark(id, true); };
          });
        } else if (dec === "ask") {
          // Unsicher: Auswahl der wahrscheinlichsten zulässigen Zeichen statt Ablehnung
          inkPop(px, py, `<div class="small bold">Welches Korrekturzeichen meinten Sie?</div><div class="row wrap mt-s" style="gap:4px">${res.slice(0, 4).map((x, i) => `<button class="btn sm ${i === 0 ? "primary" : ""}" data-pick="${esc(x.sign)}" title="${esc(signTitle(x.sign))}">${esc(x.sign)}</button>`).join("")}<button class="btn sm" data-more>${icon("ellipsis-vertical")}</button></div><div class="row between mt-s"><span class="xs muted">Auswahl wird als Schriftprobe gelernt</span><button class="btn xs ghost" data-drop>${icon("x")} Verwerfen</button></div>`, (el) => {
            const pick = async (k) => { el.remove(); clear(); await addMark({ type: "sign", sign: k, ...anchor }); await learn(own, k, strokes); };
            el.querySelectorAll("[data-pick]").forEach((x) => (x.onclick = () => pick(x.dataset.pick)));
            el.querySelector("[data-more]").onclick = (e) => popMenu(e.currentTarget, ALL_SIGN_KEYS.map((k) => ({ label: signTitle(k), run: () => pick(k) })), { align: "left" });
            el.querySelector("[data-drop]").onclick = () => { el.remove(); clear(); };
          });
          const watch = setInterval(() => { if (!document.querySelector(".inkpop")) { clear(); clearInterval(watch); } }, 400);
        } else {
          setTimeout(clear, 900);
          toast("Kein zulässiges Korrekturzeichen erkannt", `Nur vorgegebene Korrekturzeichen sind erlaubt (${ALL_SIGN_KEYS.join(", ")}). Tipp: Über „Einlernen“ lernt die Erkennung Ihre Handschrift.`, "error", { ms: 6000 });
        }
      }
      async function changeSign(id, sign) {
        const g = grading(pid); const marks = { ...(g?.marks || {}) };
        marks[st] = (marks[st] || []).map((x) => (x.id === id ? { ...x, sign } : x));
        await saveGrading(pid, { marks });
      }
      async function addMark(m, msg, alts) {
        const g = grading(pid); const marks = { ...(g?.marks || {}) };
        const id = uid();
        marks[st] = [...(marks[st] || []), { id, ...round(m) }];
        await saveGrading(pid, { marks });
        if (msg) toast(msg, alts?.length ? `Alternativen: ${alts.join(", ")}` : "", "success", { ms: 3500, action: { label: "Rückgängig", run: () => removeMark(id, true) } });
        return id;
      }
      async function removeMark(id, silent) {
        if (!id) return;
        const g = grading(pid); if (!g) return;
        const marks = { ...(g.marks || {}) }; marks[st] = (marks[st] || []).filter((m) => m.id !== id);
        if (K.sel === id) K.sel = null;
        await saveGrading(pid, { marks });
        if (!silent) toast("Markierung gelöscht", "", "info", { ms: 1800 });
      }
      const round = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, typeof v === "number" ? Math.round(v * 10) / 10 : v]));
      function flash(t) { setTimeout(() => { const x = document.querySelector("[data-saved]"); if (x) x.textContent = t || "✓ automatisch gespeichert"; }, 120); }
    },
    unmount() { this._off && this._off(); },
  };
}

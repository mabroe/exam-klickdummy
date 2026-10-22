// Prüfungseditor: Prüfungen bzw. Unterrichtsinhalte (Lernerfolgskontrollen) erstellen und bearbeiten
//  - Allgemein: Kopfdaten, Ausgangssituation, Unternehmensprofil, Prüfungsinformationen
//  - Bewertung: Notenschlüssel und Kategoriensystem (einmalig je Inhalt)
//  - Aufgaben: Aufgaben mit Anwendungen und bereitgestellten Materialien (Dateien, E-Mails, Termine, Tickets, Code, ERP),
//    Teilaufgaben mit Fragetyp, Arbeitsauftrag, Bewertungsraster und Erwartungshorizont (auch mit Bildern)
//  - Aufgabensteuerung: Regeln (Bedingungen mit UND/ODER, Aktionen)
//  - Prüfen: Vollständigkeit und Übersicht, Speichern, Vorschau
import { D, byId, upd, create } from "../data.js?v=8.7";
import { icon, esc, toast, confirmBox, modal, store } from "../ui.js?v=8.7";
import { navigate, redraw, session } from "../app.js?v=8.7";
import { me, personName } from "../access.js?v=8.7";
import { useContent, normalizeContent, ALL_TOOLS, QTYPES, APP_TOOLS, INLINE_TYPES, GRADING_KEYS, CATEGORY_SYSTEMS, categoryList } from "../scenario.js?v=8.7";
import { hasOwnContent, contentFromDefault, FOLDER } from "../content.js?v=8.7";
import { rulesEditor, bindRulesEditor, validateRules } from "./ruleeditor.js?v=8.7";
import { condText } from "../rules.js?v=8.7";

const clone = (o) => JSON.parse(JSON.stringify(o));
const rid = () => Math.random().toString(36).slice(2, 12);
const DRAFTS = new Map(); // Katalog-ID -> Entwurf { cat, content, rules, dirty, tab, sel, mk }
let rev = 0;

// ---------- Berechtigung ----------
export const isAuthor = () => session.role === "autor";
export function canEdit(cat) {
  if (!cat) return false;
  if (isAuthor()) return true;
  const p = me();
  return session.role === "lehrkraft" && !!p && cat.editor_by === p.id && cat.kind !== "Prüfung";
}
export const canCreate = () => isAuthor() || session.role === "lehrkraft";

// ---------- Neuer Inhalt ----------
export function blankContent(title, duration = 45) {
  return {
    name: title, duration_min: duration, ausgangssituation: "",
    company: { name: "", allgemein: "", adresse: "", rechtliches: "", kontakt: "", vorlagen: "" },
    info: { title: "Prüfungsinformationen", items: [["Bearbeitungszeit", `${duration} Minuten zzgl. individueller Zusatzzeit`], ["Abgabe", "Markieren Sie Ihre Ergebnisse als Abgabe der jeweiligen Teilaufgabe. Antworten direkt in der Aufgabe gelten automatisch als Abgabe."]] },
    gradingKey: { type: "linear" }, categories: { system: "none", list: [] }, signatures: {},
    tasks: [newTask(1)],
  };
}
const newTask = (n) => ({ title: `Aufgabe ${n}`, situation: "", tools: ALL_TOOLS.map((x) => x[0]), materials: [], subtasks: [newSub()] });
const newSub = (type = "freitext") => ({ title: "Neue Teilaufgabe", type, tool: type === "app" ? "files" : type, text: "", options: type === "single" || type === "multiple" ? [{ text: "", correct: true }, { text: "", correct: false }] : [], criteria: [["Inhalt", 5, ""]], horizon: [["", "5 P"]], images: [] });
export async function newContentDialog() {
  const author = isAuthor();
  const v = await modal({ title: "Neuen Inhalt erstellen", size: "narrow",
    body: `<div class="field"><label class="lbl" for="nc-t">Titel</label><input id="nc-t" class="input" data-f="title" placeholder="z. B. Lernerfolgskontrolle Tabellenkalkulation"></div>
      <div class="field"><label class="lbl" for="nc-k">Art</label><select id="nc-k" class="select" data-f="kind">${author ? `<option>Prüfung</option>` : ""}<option ${author ? "" : "selected"}>Lernerfolgskontrolle</option></select>${author ? "" : `<p class="xs muted" style="margin:4px 0 0">Prüfungen erstellt die Koordinierungsstelle (Rolle Prüfungserstellung).</p>`}</div>
      <div class="grid2"><div class="field"><label class="lbl" for="nc-b">Ausbildungsberuf</label><input id="nc-b" class="input" data-f="beruf" value="Kaufmann/-frau für Büromanagement"></div><div class="field"><label class="lbl" for="nc-f">Fach / Lernfeld</label><input id="nc-f" class="input" data-f="fach" value="Informationsverarbeitung"></div></div>
      <div class="field"><label class="lbl" for="nc-d">Bearbeitungszeit (Minuten)</label><input id="nc-d" class="input" type="number" min="5" data-f="dur" value="45"></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Erstellen und im Editor öffnen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value.trim())); if (!o.title) { m.querySelector("[data-f=title]").style.borderColor = "var(--red)"; return; } close(o); }) });
  if (!v) return;
  const p = me(); const dur = Math.max(5, +v.dur || 45);
  const rec = await create("catalog", { title: v.title, kind: v.kind, beruf: v.beruf, fach: v.fach, jahr: String(new Date().getFullYear()), description: "", duration: `${dur} Minuten`, creator: author ? "Koordinierungsstelle (IBBW)" : personName(p), tags: [v.kind === "Prüfung" ? "Prüfungen" : "Lernerfolgskontrolle", "Editor"], contents: [], mine: !author, copied_from: "", image: Math.floor(Math.random() * 4), content: blankContent(v.title, dur), rules: [], editor_by: author ? "autor" : p?.id || "" });
  for (let i = 0; i < 40 && !byId("catalog", rec.id); i++) await new Promise((r) => setTimeout(r, 50)); // Realtime-Spiegel abwarten
  toast("Inhalt angelegt", v.title); navigate(`#/app/editor/${rec.id}/allgemein`);
}

// ---------- Entwurf ----------
function draftOf(cat) {
  if (!DRAFTS.has(cat.id)) {
    const content = hasOwnContent(cat) ? clone(cat.content) : contentFromDefault();
    content.name = content.name || cat.title; content.duration_min = content.duration_min || parseInt(cat.duration) || 90;
    DRAFTS.set(cat.id, { id: cat.id, cat: { title: cat.title, kind: cat.kind, beruf: cat.beruf, fach: cat.fach, jahr: cat.jahr, description: cat.description || "" }, content: normalizeContent(content), rules: clone(cat.rules || []), dirty: !hasOwnContent(cat) ? false : false, sel: "t0", mk: "file", fromDefault: !hasOwnContent(cat) });
  }
  return DRAFTS.get(cat.id);
}
const activate = (E) => { normalizeContent(E.content); useContent(E.content, `draft:${E.id}:${++rev}`); };
const pts = (v) => (Math.round((+v || 0) * 10) / 10).toLocaleString("de-DE");
const hzSum = (s) => (s.horizon || []).reduce((a, h) => a + (parseFloat(String(h[1]).replace(",", ".")) || 0), 0);
const getPath = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
function setPath(o, p, v) { const ks = p.split("."); const last = ks.pop(); const t = ks.reduce((x, k) => x[k], o); t[last] = v; }

// ---------- Prüfung der Vollständigkeit ----------
export function validate(E) {
  const out = []; const c = E.content;
  const err = (text, sel, tab = "aufgaben") => out.push({ lvl: "error", text, sel, tab });
  const warn = (text, sel, tab = "aufgaben") => out.push({ lvl: "warn", text, sel, tab });
  if (!E.cat.title.trim()) err("Titel fehlt.", null, "allgemein");
  if (!c.tasks.length) err("Mindestens eine Aufgabe ist erforderlich.");
  if (!c.ausgangssituation.trim()) warn("Ausgangssituation des Inhalts ist leer.", null, "allgemein");
  const th = c.gradingKey?.type === "eigen" ? c.gradingKey.thresholds || [] : null;
  if (th && !(th.length === 5 && th.every((x, i) => +x > 0 && +x <= 100 && (i === 0 || +x < +th[i - 1])))) err("Eigene Notenstufen: fünf absteigende Prozentgrenzen zwischen 1 und 100 angeben.", null, "bewertung");
  if (c.categories?.system === "eigen" && !categoryList(c.categories).length) err("Eigenes Kategoriensystem: mindestens eine Kategorie angeben.", null, "bewertung");
  const cats = categoryList(c.categories);
  c.tasks.forEach((t, ti) => {
    const sel = `t${ti}`;
    if (!t.title.trim()) err(`Aufgabe ${t.no}: Titel fehlt.`, sel);
    if (!t.subtasks.length) err(`Aufgabe ${t.no}: keine Teilaufgaben.`, sel);
    if (!t.situation.trim()) warn(`Aufgabe ${t.no}: Ausgangssituation der Aufgabe ist leer.`, sel);
    const fileNames = t.materials.filter((m) => m.kind === "file").map((m) => m.data?.name);
    t.materials.filter((m) => m.kind === "mail").forEach((m) => (m.data?.attachments || []).forEach((a) => { if (!fileNames.includes(a)) warn(`Aufgabe ${t.no}: E-Mail „${m.data.subject}“ verweist auf die fehlende Datei „${a}“.`, sel); }));
    const need = { mail: "mail", files: "files", editor: "editor", calendar: "calendar", tickets: "tickets", ide: "ide", erp: "erp" };
    t.subtasks.forEach((s, si) => {
      const ss = `t${ti}.s${si}`;
      if (!s.title.trim()) err(`${s.no}: Titel fehlt.`, ss);
      if (!s.text.trim()) err(`${s.no}: Arbeitsauftrag fehlt.`, ss);
      if (s.type === "app" && !t.tools.includes(need[s.tool])) err(`${s.no}: Die Anwendung „${APP_TOOLS[s.tool]}“ ist in Aufgabe ${t.no} nicht freigeschaltet.`, ss);
      if (s.type === "single" || s.type === "multiple") {
        const n = s.options.filter((o) => o.text.trim()).length, k = s.options.filter((o) => o.correct).length;
        if (n < 2) err(`${s.no}: mindestens zwei Antwortoptionen angeben.`, ss);
        if (s.type === "single" && k !== 1) err(`${s.no}: Single Choice benötigt genau eine richtige Antwort.`, ss);
        if (s.type === "multiple" && k < 1) err(`${s.no}: Multiple Choice benötigt mindestens eine richtige Antwort.`, ss);
      }
      if (!s.criteria.length || !(s.points > 0)) err(`${s.no}: Bewertungsraster ohne Punkte.`, ss);
      if (s.criteria.some((k) => !String(k[0]).trim())) warn(`${s.no}: Kriterium ohne Bezeichnung.`, ss);
      if (cats.length && s.criteria.some((k) => !k[2])) warn(`${s.no}: Kriterien ohne Kategorie.`, ss);
      if (!s.horizon.some((h) => String(h[0]).trim()) && !s.images.length) err(`${s.no}: Erwartungshorizont fehlt.`, ss);
      else if (Math.abs(hzSum(s) - s.points) > 0.01) warn(`${s.no}: Punkte im Erwartungshorizont (${pts(hzSum(s))}) weichen vom Bewertungsraster (${pts(s.points)}) ab.`, ss);
    });
  });
  validateRules(E.rules).forEach((n) => err(`Aufgabensteuerung: „${n}“ benötigt Namen, Bedingung und Aktion.`, null, "steuerung"));
  const nos = new Set(c.tasks.flatMap((t) => [t.no, ...t.subtasks.map((s) => s.no)]));
  E.rules.forEach((r) => (r.groups || []).forEach((g) => (g.conditions || []).forEach((x) => { const ref = x.subtask || x.task; if (ref && !nos.has(String(ref))) warn(`Aufgabensteuerung: „${r.name}“ verweist auf ${x.subtask ? "Teilaufgabe" : "Aufgabe"} ${ref}, die es nicht gibt.`, null, "steuerung"); })));
  return out;
}

// ---------- Ansicht ----------
const TABS = [["allgemein", "Allgemein"], ["bewertung", "Notenschlüssel und Kategorien"], ["aufgaben", "Aufgaben"], ["steuerung", "Aufgabensteuerung"], ["pruefen", "Prüfen und speichern"]];
const MK = [["file", "folder", "Dateien"], ["mail", "mail", "E-Mails"], ["event", "calendar", "Termine"], ["ticket", "ticket", "Tickets"], ["code", "code-xml", "Code-Vorlagen"], ["erp", "package", "ERP-Stammdaten"]];
const DAYS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

export function editor(id, tab = "allgemein") {
  const cat = byId("catalog", id);
  if (!cat) return { redirect: "#/app/katalog" };
  if (!canEdit(cat)) return { shell: "staff", rail: "katalog", title: "Editor", render: () => `<div class="empty">${icon("lock")}<h2>Keine Bearbeitung möglich</h2><p>Prüfungen bearbeitet die Koordinierungsstelle (Rolle „Prüfungserstellung“). Lehrkräfte bearbeiten eigene Unterrichtsinhalte.</p><a class="btn" href="#/app/katalog">Zum Katalog</a></div>` };
  const E = draftOf(cat); activate(E);
  if (!TABS.some(([k]) => k === tab)) tab = "allgemein";
  return {
    shell: "staff", rail: "katalog", title: "Editor – " + E.cat.title,
    render() {
      const total = E.content.tasks.reduce((a, t) => a + t.points, 0); const used = D.courses.filter((c) => c.catalog === id).length;
      const issues = validate(E); const nErr = issues.filter((x) => x.lvl === "error").length;
      return `<div class="edwrap"><div class="breadcrumb"><a href="#/app/katalog">Katalog</a>${icon("chevron-right")}<a href="#/app/katalog/${id}">${esc(cat.title)}</a>${icon("chevron-right")}<b>Editor</b></div>
      <div class="pagehead"><div><h1>${icon("pencil")} ${esc(E.cat.title || "Ohne Titel")}</h1><div class="row mt-s small wrap"><span class="badge ${E.cat.kind === "Prüfung" ? "purple" : "cyan"}">${esc(E.cat.kind)}</span><span>${E.content.tasks.length} Aufgaben · ${E.content.tasks.reduce((a, t) => a + t.subtasks.length, 0)} Teilaufgaben · <b>${pts(total)} Punkte</b> · ${E.content.duration_min} Min.</span>
        ${used ? `<span class="badge yellowb" title="Kurse, die diesen Inhalt nutzen">${icon("users")} in ${used} Kurs${used === 1 ? "" : "en"} verwendet</span>` : ""}${E.dirty ? `<span class="badge yellowb" data-dirty>ungespeicherte Änderungen</span>` : `<span class="badge green" data-dirty>gespeichert</span>`}${nErr ? `<a class="badge red" href="#/app/editor/${id}/pruefen">${nErr} Fehler</a>` : ""}</div></div>
        <div class="actions-bar"><button class="btn" data-preview>${icon("eye")} Vorschau</button><button class="btn primary" data-save>${icon("save")} Speichern</button></div></div>
      ${E.fromDefault ? `<div class="notice info small mb">${icon("info")}<span>Dieser Inhalt nutzt bisher die Musterprüfung. Beim Speichern wird er als eigener Inhalt dieses Katalogeintrags abgelegt (inkl. der bereitgestellten Materialien).</span></div>` : ""}
      ${used ? `<div class="notice warn small mb">${icon("triangle-alert")}<span>Änderungen wirken auf alle Kurse mit diesem Inhalt. Bereits angemeldete Teilnehmende behalten ihre kopierten Materialien.</span></div>` : ""}
      <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/app/editor/${id}/${k}" class="${k === tab ? "active" : ""}">${l}${k === "aufgaben" ? ` <span class="badge gray">${E.content.tasks.length}</span>` : k === "steuerung" ? ` <span class="badge gray">${E.rules.length}</span>` : ""}</a>`).join("")}</nav>
      ${{ allgemein: tabGeneral, bewertung: tabGrading, aufgaben: tabTasks, steuerung: () => rulesEditor(E.rules), pruefen: tabCheck }[tab](E, issues)}</div>`;
    },
    mount(el) { bindEditor(el, E, cat, tab); },
  };
}

// ---------- Reiter ----------
const fld = (path, label, v, { area = 0, type = "text", ph = "", cls = "", num = false } = {}) => `<div class="field ${cls}"><label class="lbl">${label}</label>${area ? `<textarea class="input" rows="${area}" data-ep="${path}" placeholder="${esc(ph)}">${esc(v ?? "")}</textarea>` : `<input class="input" type="${type}" data-ep="${path}" ${num ? "data-enum" : ""} value="${esc(v ?? "")}" placeholder="${esc(ph)}">`}</div>`;
function tabGeneral(E) {
  const c = E.content;
  return `<div class="edgrid2"><section class="card pad"><h3>Kopfdaten</h3>
    ${fld("cat.title", "Titel", E.cat.title)}
    <div class="grid2"><div class="field"><label class="lbl">Art</label><select class="select" data-ep="cat.kind" ${isAuthor() ? "" : "disabled"}><option ${E.cat.kind === "Prüfung" ? "selected" : ""}>Prüfung</option><option ${E.cat.kind !== "Prüfung" ? "selected" : ""}>Lernerfolgskontrolle</option></select></div>
      ${fld("content.duration_min", "Bearbeitungszeit (Minuten)", c.duration_min, { type: "number", num: true })}</div>
    <div class="grid2">${fld("cat.beruf", "Ausbildungsberuf", E.cat.beruf)}${fld("cat.fach", "Fach / Lernfeld", E.cat.fach)}</div>
    ${fld("cat.jahr", "Jahr", E.cat.jahr)}
    ${fld("cat.description", "Beschreibung im Katalog", E.cat.description, { area: 3 })}</section>
  <section class="card pad"><h3>Ausgangssituation und Unternehmen</h3>
    ${fld("content.ausgangssituation", "Ausgangssituation (gilt für alle Aufgaben)", c.ausgangssituation, { area: 6, ph: "Beschreiben Sie die betriebliche Situation, in der die Teilnehmenden arbeiten …" })}
    ${fld("content.company.name", "Unternehmen", c.company.name)}
    ${fld("content.company.allgemein", "Unternehmensprofil", c.company.allgemein, { area: 3 })}
    <div class="grid2">${fld("content.company.adresse", "Adresse (mehrzeilig)", c.company.adresse, { area: 3 })}${fld("content.company.kontakt", "Kontakt", c.company.kontakt, { area: 3 })}</div>
    <div class="grid2">${fld("content.company.rechtliches", "Rechtliches", c.company.rechtliches, { area: 2 })}${fld("content.company.vorlagen", "Vorlagen", c.company.vorlagen, { area: 2 })}</div></section></div>
  <section class="card pad mt"><div class="row between"><h3>Prüfungsinformationen (Dashboard der Teilnehmenden)</h3><button class="btn sm" data-ea="addInfo">${icon("plus")} Eintrag</button></div>
    ${(c.info.items || []).map((it, i) => `<div class="edrow"><input class="input" style="max-width:240px" data-ep="content.info.items.${i}.0" value="${esc(it[0])}" aria-label="Bezeichnung"><input class="input grow" data-ep="content.info.items.${i}.1" value="${esc(it[1])}" aria-label="Text"><button class="iconbtn" data-ea="delInfo" data-arg="${i}" aria-label="Eintrag entfernen">${icon("trash-2")}</button></div>`).join("") || `<p class="small muted">Keine Einträge.</p>`}</section>`;
}
function tabGrading(E) {
  const c = E.content; const gk = c.gradingKey?.type || "linear"; const cs = c.categories?.system || "none";
  const th = gk === "linear" ? null : (c.gradingKey.thresholds || GRADING_KEYS[gk].thresholds);
  const sample = [100, 90, 75, 60, 50, 40, 25, 0].map((p) => { let n; if (!th) n = Math.max(1, Math.floor((6 - (5 * p) / 100) * 10 + 1e-9) / 10); else { const i = th.findIndex((t) => p >= +t); n = i < 0 ? 6 : i + 1; } return `<td class="num">${p} %</td><td class="num"><b>${n.toFixed(1).replace(".", ",")}</b></td>`; });
  return `<div class="notice info small mb">${icon("info")}<span>Notenschlüssel und Kategoriensystem werden <b>einmalig für den gesamten Inhalt</b> festgelegt. Sie gelten für Korrektur, Ergebnisse und Einsicht aller Kurse, die diesen Inhalt nutzen.</span></div>
  <div class="edgrid2"><section class="card pad"><h3>Notenschlüssel</h3><div class="optcards">${Object.entries(GRADING_KEYS).map(([k, o]) => `<label class="optcard ${gk === k ? "on" : ""}"><input type="radio" name="gk" data-ea="gk" value="${k}" ${gk === k ? "checked" : ""}><span><b>${o.label}</b><span class="xs muted">${o.hint}</span></span></label>`).join("")}</div>
    ${gk === "eigen" ? `<div class="row wrap mt-s" style="gap:8px">${[1, 2, 3, 4, 5].map((n, i) => `<label class="small">Note ${n} ab <input class="input" style="width:70px" type="number" min="1" max="100" data-ep="content.gradingKey.thresholds.${i}" data-enum value="${esc((c.gradingKey.thresholds || [])[i] ?? "")}"> %</label>`).join("")}</div>` : ""}
    <div class="tablewrap mt"><table class="tbl compact"><thead><tr>${sample.map(() => "<th>Anteil</th><th>Note</th>").slice(0, 4).join("")}</tr></thead><tbody><tr>${sample.slice(0, 4).join("")}</tr><tr>${sample.slice(4).join("")}</tr></tbody></table></div></section>
  <section class="card pad"><h3>Kategoriensystem</h3><p class="xs muted">Die Kriterien der Bewertungsraster werden einer Kategorie zugeordnet; die Ergebnisse zeigen den Erreichungsgrad je Kategorie.</p><div class="optcards">${Object.entries(CATEGORY_SYSTEMS).map(([k, o]) => `<label class="optcard ${cs === k ? "on" : ""}"><input type="radio" name="cs" data-ea="cs" value="${k}" ${cs === k ? "checked" : ""}><span><b>${o.label}</b><span class="xs muted">${o.list.length ? o.list.join(" · ") : k === "eigen" ? "Kategorien selbst festlegen" : "Kriterien ohne Kategorie"}</span></span></label>`).join("")}</div>
    ${cs === "eigen" ? `<div class="field mt-s"><label class="lbl">Kategorien (eine je Zeile)</label><textarea class="input" rows="4" data-ea="catlist">${esc((c.categories.list || []).join("\n"))}</textarea></div>` : ""}</section></div>`;
}
function tree(E) {
  const [ti, si] = selOf(E);
  return `<aside class="edtree" aria-label="Aufgabenstruktur"><div class="row between"><b>Aufbau</b><button class="btn xs" data-ea="addTask">${icon("plus")} Aufgabe</button></div>
    <ol>${E.content.tasks.map((t, i) => `<li><button class="edn ${ti === i && si < 0 ? "on" : ""}" data-sel="t${i}"><span class="grow">${t.no} ${esc(t.title || "Ohne Titel")}</span><span class="badge gray">${pts(t.points)}</span></button>
      <ol>${t.subtasks.map((s, j) => `<li><button class="edn sub ${ti === i && si === j ? "on" : ""}" data-sel="t${i}.s${j}"><span class="grow">${s.no} ${esc(s.title || "Ohne Titel")}</span><span class="xs muted">${esc(qShort(s))}</span></button></li>`).join("")}
      <li><button class="btn xs ghost" data-ea="addSub" data-arg="${i}">${icon("plus")} Teilaufgabe</button></li></ol></li>`).join("")}</ol></aside>`;
}
const qShort = (s) => (s.type === "app" ? ({ mail: "E-Mail", files: "Datei", editor: "Notiz", calendar: "Termin", tickets: "Ticket", ide: "Code", erp: "ERP" }[s.tool] || "Anwendung") : { upload: "Upload", freitext: "Freitext", kurz: "Kurzantwort", single: "Single Choice", multiple: "Multiple Choice" }[s.type]);
function selOf(E) { const m = /^t(\d+)(?:\.s(\d+))?$/.exec(E.sel || "t0") || [0, 0]; const ti = Math.min(+m[1] || 0, E.content.tasks.length - 1); const t = E.content.tasks[ti]; const si = m[2] !== undefined && t && +m[2] < t.subtasks.length ? +m[2] : -1; return [ti, si]; }
function tabTasks(E) {
  const [ti, si] = selOf(E); const t = E.content.tasks[ti];
  if (!t) return `<div class="empty">${icon("list")}<h3>Noch keine Aufgaben</h3><button class="btn primary" data-ea="addTask">${icon("plus")} Aufgabe anlegen</button></div>`;
  return `<div class="edlayout">${tree(E)}<div class="edpanel">${si < 0 ? taskPanel(E, t, ti) : subPanel(E, t, ti, t.subtasks[si], si)}</div></div>`;
}
const moveBtns = (kind, arg, first, last) => `<button class="iconbtn" data-ea="${kind}Up" data-arg="${arg}" ${first ? "disabled" : ""} title="Nach oben" aria-label="Nach oben">${icon("chevron-up")}</button><button class="iconbtn" data-ea="${kind}Down" data-arg="${arg}" ${last ? "disabled" : ""} title="Nach unten" aria-label="Nach unten">${icon("chevron-down")}</button><button class="iconbtn" data-ea="${kind}Dup" data-arg="${arg}" title="Duplizieren" aria-label="Duplizieren">${icon("copy")}</button><button class="iconbtn" data-ea="${kind}Del" data-arg="${arg}" title="Löschen" aria-label="Löschen">${icon("trash-2")}</button>`;
function taskPanel(E, t, ti) {
  const base = `content.tasks.${ti}`; const n = E.content.tasks.length;
  return `<div class="row between"><h2>Aufgabe ${t.no}</h2><div class="row">${moveBtns("task", ti, ti === 0, ti === n - 1)}</div></div>
    ${fld(base + ".title", "Titel der Aufgabe", t.title)}
    ${fld(base + ".situation", "Ausgangssituation der Aufgabe", t.situation, { area: 5, ph: "Situation, auf die sich die Teilaufgaben beziehen …" })}
    <div class="field"><span class="lbl">Anwendungen in dieser Aufgabe</span><div class="chips">${ALL_TOOLS.map(([k, ic, l]) => `<label class="chipcheck ${t.tools.includes(k) ? "on" : ""}"><input type="checkbox" data-ea="tool" data-arg="${ti}" value="${k}" ${t.tools.includes(k) ? "checked" : ""}>${icon(ic)} ${l}</label>`).join("")}</div><p class="xs muted" style="margin:4px 0 0">Nur diese Anwendungen stehen den Teilnehmenden in der Aufgabe zur Verfügung (Werkzeugkacheln und Taskleiste).</p></div>
    <h3 class="mt">Bereitgestellte Materialien</h3><p class="xs muted">Diese Inhalte sind beim Start bereits vorhanden und werden jeder Teilnahme beim ersten Login bereitgestellt.</p>
    <nav class="tabs small">${MK.map(([k, ic, l]) => `<button class="${E.mk === k ? "active" : ""}" data-ea="mk" data-arg="${k}">${icon(ic)} ${l} <span class="badge gray">${t.materials.filter((m) => m.kind === k).length}</span></button>`).join("")}</nav>
    ${materialList(E, t, ti)}`;
}
function materialList(E, t, ti) {
  const k = E.mk; const list = t.materials.map((m, i) => ({ m, i })).filter((x) => x.m.kind === k);
  const files = t.materials.filter((m) => m.kind === "file").map((m) => m.data?.name).filter(Boolean);
  const mp = (i, f) => `content.tasks.${ti}.materials.${i}.data.${f}`;
  const f = (i, key, label, v, o = {}) => fld(mp(i, key), label, v, o);
  const row = ({ m, i }) => {
    const d = m.data || {};
    const head = { file: `${icon("file")} ${esc(d.name || "Datei")}`, mail: `${icon("mail")} ${esc(d.subject || "(ohne Betreff)")} <span class="xs muted">von ${esc(d.from || "")}</span>`, event: `${icon("calendar")} ${esc(d.title || "Termin")} <span class="xs muted">${DAYS[+d.day || 0]}, ${esc(d.start || "")}–${esc(d.end || "")}</span>`, ticket: `${icon("ticket")} #${esc(d.no || "")} ${esc(d.subject || "")}`, code: `${icon("file-code")} ${esc(d.name || "")}`, erp: `${icon("package")} ${esc(d.type === "lieferant" ? "Lieferant" : d.type === "bestellung" ? "Bestellung" : "Artikel")} ${esc(d.nr || "")} ${esc(d.name || "")}` }[m.kind];
    let body = "";
    if (m.kind === "file") body = `<div class="grid2">${f(i, "name", "Dateiname", d.name)}${f(i, "path", "Ordner", d.path || "Bereitgestellte Dateien")}</div><div class="row wrap" style="gap:10px"><label class="btn sm">${icon("upload")} Datei ${d.url ? "ersetzen" : "hochladen"}<input type="file" hidden data-ea="fileUp" data-arg="${ti}.${i}"></label><span class="xs muted">${d.url ? `${esc(d.format || "")} · ${esc(d.size || "")}${String(d.url).startsWith("data:") ? " · im Inhalt gespeichert" : ` · ${esc(d.url)}`}` : "Noch keine Datei – nur Platzhalter (Dateiname)."}</span></div>`;
    if (m.kind === "mail") body = `<div class="grid2">${f(i, "from", "Absender (Name)", d.from)}${f(i, "from_mail", "Absender (E-Mail)", d.from_mail)}</div><div class="grid2">${f(i, "to", "An", d.to)}${f(i, "date", "Datum", d.date, { ph: "13.10.2025 09:22" })}</div>${f(i, "subject", "Betreff", d.subject)}${f(i, "body", "Text", d.body, { area: 6 })}
      <div class="field"><span class="lbl">Anhänge (Dateien dieser Aufgabe)</span><div class="chips">${files.length ? files.map((n) => `<label class="chipcheck ${(d.attachments || []).includes(n) ? "on" : ""}"><input type="checkbox" data-ea="att" data-arg="${ti}.${i}" value="${esc(n)}" ${(d.attachments || []).includes(n) ? "checked" : ""}>${icon("paperclip")} ${esc(n)}</label>`).join("") : `<span class="xs muted">Legen Sie zuerst Dateien an.</span>`}</div></div>`;
    if (m.kind === "event") body = `${f(i, "title", "Titel", d.title)}<div class="grid3"><div class="field"><label class="lbl">Tag</label><select class="select" data-ep="${mp(i, "day")}" data-enum>${DAYS.map((x, k2) => `<option value="${k2}" ${+d.day === k2 ? "selected" : ""}>${x}</option>`).join("")}</select></div>${f(i, "start", "Beginn", d.start, { type: "time" })}${f(i, "end", "Ende", d.end, { type: "time" })}</div><div class="grid2">${f(i, "location", "Ort", d.location)}${f(i, "desc", "Beschreibung", d.desc)}</div>`;
    if (m.kind === "ticket") body = `<div class="grid3">${f(i, "no", "Nummer", d.no)}${f(i, "requester", "Anfordernde Stelle", d.requester)}<div class="field"><label class="lbl">Priorität</label><select class="select" data-ep="${mp(i, "prio")}">${["niedrig", "mittel", "hoch"].map((x) => `<option ${d.prio === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div><div class="grid2">${f(i, "subject", "Betreff", d.subject)}<div class="field"><label class="lbl">Status</label><select class="select" data-ep="${mp(i, "status")}">${["offen", "in Bearbeitung", "geschlossen"].map((x) => `<option ${d.status === x ? "selected" : ""}>${x}</option>`).join("")}</select></div></div>${f(i, "desc", "Beschreibung", d.desc, { area: 4 })}`;
    if (m.kind === "code") body = `<div class="grid2">${f(i, "name", "Dateiname", d.name)}<div class="field"><label class="lbl">Sprache</label><select class="select" data-ep="${mp(i, "lang")}">${[["python", "Python"], ["javascript", "JavaScript"], ["text", "Text"]].map(([v, l]) => `<option value="${v}" ${d.lang === v ? "selected" : ""}>${l}</option>`).join("")}</select></div></div><div class="field"><label class="lbl">Code-Vorlage</label><textarea class="input mono" rows="8" data-ep="${mp(i, "code")}">${esc(d.code || "")}</textarea></div>`;
    if (m.kind === "erp") body = d.type === "lieferant" ? `<div class="grid3">${f(i, "nr", "Lieferanten-Nr.", d.nr)}${f(i, "name", "Name", d.name)}${f(i, "ort", "Ort", d.ort)}</div><div class="grid2">${f(i, "mail", "E-Mail", d.mail)}${f(i, "zahlung", "Zahlungsbedingungen", d.zahlung)}</div>`
      : d.type === "bestellung" ? `<p class="small muted">Bestellung ${esc(d.nr)} vom ${esc(d.datum || "")} (${(d.pos || []).length} Positionen) – wird unverändert bereitgestellt.</p>`
      : `<div class="grid3">${f(i, "nr", "Artikel-Nr.", d.nr)}${f(i, "name", "Bezeichnung", d.name)}${f(i, "gruppe", "Gruppe", d.gruppe)}</div><div class="grid3">${f(i, "bestand", "Bestand", d.bestand, { type: "number", num: true })}${f(i, "melde", "Meldebestand", d.melde, { type: "number", num: true })}${f(i, "hoechst", "Höchstbestand", d.hoechst, { type: "number", num: true })}</div><div class="grid3">${f(i, "einheit", "Einheit", d.einheit)}${f(i, "ek", "Einkaufspreis (€)", d.ek, { type: "number", num: true })}${f(i, "lieferant", "Lieferanten-Nr.", d.lieferant)}</div>`;
    return `<details class="edmat" ${E.openMat === `${ti}.${i}` ? "open" : ""} data-mat="${ti}.${i}"><summary><span class="grow">${head}</span><button class="iconbtn" data-ea="matDel" data-arg="${ti}.${i}" title="Entfernen" aria-label="Material entfernen">${icon("trash-2")}</button></summary><div class="edmat-b">${body}</div></details>`;
  };
  const addLabel = { file: "Datei", mail: "E-Mail", event: "Termin", ticket: "Ticket", code: "Code-Vorlage", erp: "Artikel" }[k];
  return `<div class="mt-s">${list.map(row).join("") || `<p class="small muted">Keine ${MK.find((x) => x[0] === k)[2]} in dieser Aufgabe.</p>`}
    <div class="row mt-s" style="gap:8px"><button class="btn sm" data-ea="matAdd" data-arg="${ti}">${icon("plus")} ${addLabel} hinzufügen</button>${k === "erp" ? `<button class="btn sm" data-ea="matAdd" data-arg="${ti}" data-sub="lieferant">${icon("plus")} Lieferant hinzufügen</button>` : ""}${k === "file" ? `<label class="btn sm ghost">${icon("upload")} Dateien hochladen<input type="file" hidden multiple data-ea="filesNew" data-arg="${ti}"></label>` : ""}</div></div>`;
}
function subPanel(E, t, ti, s, si) {
  const base = `content.tasks.${ti}.subtasks.${si}`; const cats = categoryList(E.content.categories);
  const typeSel = `<select class="select" data-ea="qtype" data-arg="${ti}.${si}">${["Anwendung", "Direkt in der Aufgabe"].map((g) => `<optgroup label="${g}">${Object.entries(QTYPES).filter(([, o]) => o.group === g).map(([k, o]) => `<option value="${k}" ${s.type === k ? "selected" : ""}>${o.label}</option>`).join("")}</optgroup>`).join("")}</select>`;
  const hz = hzSum(s);
  return `<div class="row between"><h2>Teilaufgabe ${s.no}</h2><div class="row">${moveBtns("sub", `${ti}.${si}`, si === 0, si === t.subtasks.length - 1)}</div></div>
    ${fld(base + ".title", "Titel", s.title)}
    <div class="grid2"><div class="field"><label class="lbl">Fragetyp</label>${typeSel}</div>
      ${s.type === "app" ? `<div class="field"><label class="lbl">Anwendung und Abgabe</label><select class="select" data-ep="${base}.tool" data-erender>${Object.entries(APP_TOOLS).map(([k, l]) => `<option value="${k}" ${s.tool === k ? "selected" : ""} ${t.tools.includes(k) ? "" : "disabled"}>${l}${t.tools.includes(k) ? "" : " (in Aufgabe nicht freigeschaltet)"}</option>`).join("")}</select></div>` : `<div class="field"><span class="lbl">Abgabe</span><p class="small" style="margin:6px 0 0">${s.type === "upload" ? "Datei wird direkt in der Aufgabe hochgeladen (Ordner „Dateiupload“)." : "Die Antwort wird direkt in der Aufgabe erfasst und gilt automatisch als Abgabe."}</p></div>`}</div>
    ${fld(base + ".text", "Arbeitsauftrag", s.text, { area: 4, ph: "Was sollen die Teilnehmenden tun? Woran erkennt man die Abgabe?" })}
    ${s.type === "single" || s.type === "multiple" ? `<section class="edsec"><div class="row between"><h3>Antwortoptionen</h3><button class="btn xs" data-ea="optAdd" data-arg="${ti}.${si}">${icon("plus")} Option</button></div>
      ${s.options.map((o, k) => `<div class="edrow"><span class="optletter">${String.fromCharCode(65 + k)}</span><input class="input grow" data-ep="${base}.options.${k}.text" value="${esc(o.text)}" placeholder="Antwortoption" aria-label="Option ${String.fromCharCode(65 + k)}"><label class="checkbox small"><input type="${s.type === "single" ? "radio" : "checkbox"}" name="corr-${ti}-${si}" data-ea="optCorrect" data-arg="${ti}.${si}.${k}" ${o.correct ? "checked" : ""}> richtig</label><button class="iconbtn" data-ea="optDel" data-arg="${ti}.${si}.${k}" aria-label="Option entfernen">${icon("x")}</button></div>`).join("")}</section>` : ""}
    <section class="edsec"><div class="row between"><h3>Bewertungsraster <span class="badge cyan">${pts(s.points)} Punkte</span></h3><button class="btn xs" data-ea="critAdd" data-arg="${ti}.${si}">${icon("plus")} Kriterium</button></div>
      <table class="tbl compact"><thead><tr><th>Kriterium</th>${cats.length ? "<th>Kategorie</th>" : ""}<th class="num" style="width:110px">Max. Punkte</th><th></th></tr></thead><tbody>${s.criteria.map((k, i) => `<tr><td><input class="input" data-ep="${base}.criteria.${i}.0" value="${esc(k[0])}" aria-label="Kriterium"></td>${cats.length ? `<td><select class="select" data-ep="${base}.criteria.${i}.2"><option value="">–</option>${cats.map((c) => `<option ${k[2] === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></td>` : ""}<td><input class="input" type="number" min="0" step="0.5" data-ep="${base}.criteria.${i}.1" data-enum data-erender value="${esc(k[1])}" aria-label="Maximalpunkte"></td><td><button class="iconbtn" data-ea="critDel" data-arg="${ti}.${si}.${i}" aria-label="Kriterium entfernen">${icon("x")}</button></td></tr>`).join("")}</tbody></table></section>
    <section class="edsec"><div class="row between"><h3>Erwartungshorizont ${Math.abs(hz - s.points) > 0.01 ? `<span class="badge yellowb" title="Summe der Punkte im Erwartungshorizont">${pts(hz)} von ${pts(s.points)} P</span>` : `<span class="badge green">${pts(hz)} P</span>`}</h3><button class="btn xs" data-ea="hzAdd" data-arg="${ti}.${si}">${icon("plus")} Erwartung</button></div>
      ${s.horizon.map((h, i) => `<div class="edrow"><textarea class="input grow" rows="2" data-ep="${base}.horizon.${i}.0" placeholder="Erwartete Leistung" aria-label="Erwartung">${esc(h[0])}</textarea><input class="input" style="width:90px" data-ep="${base}.horizon.${i}.1" value="${esc(h[1])}" placeholder="2 P" aria-label="Punkte"><button class="iconbtn" data-ea="hzDel" data-arg="${ti}.${si}.${i}" aria-label="Erwartung entfernen">${icon("x")}</button></div>`).join("")}
      <div class="mt-s"><span class="lbl">Bilder zum Erwartungshorizont</span><div class="edimgs">${s.images.map((im, i) => `<figure><img src="${esc(im.src)}" alt="${esc(im.caption || "Abbildung")}"><input class="input sm" data-ep="${base}.images.${i}.caption" value="${esc(im.caption || "")}" placeholder="Bildunterschrift" aria-label="Bildunterschrift"><button class="iconbtn" data-ea="imgDel" data-arg="${ti}.${si}.${i}" aria-label="Bild entfernen">${icon("trash-2")}</button></figure>`).join("")}
        <label class="edimgadd">${icon("image")}<span class="xs">Bild hinzufügen<br><span class="muted">PNG, JPG (z. B. Skizze, Musterlösung)</span></span><input type="file" hidden accept="image/*" multiple data-ea="imgAdd" data-arg="${ti}.${si}"></label></div></div></section>`;
}
function tabCheck(E, issues) {
  const c = E.content;
  const tools = (t) => t.tools.map((k) => ALL_TOOLS.find((x) => x[0] === k)?.[2]).filter(Boolean).join(", ");
  const mats = (t) => MK.map(([k, , l]) => { const n = t.materials.filter((m) => m.kind === k).length; return n ? `${n} ${l}` : ""; }).filter(Boolean).join(" · ") || "–";
  return `<div class="edgrid2"><section class="card pad"><h3>Prüfung der Vollständigkeit</h3>
    ${issues.length ? `<ul class="edissues">${issues.map((x) => `<li class="${x.lvl}">${icon(x.lvl === "error" ? "circle-x" : "triangle-alert")} <button class="link" data-goto="${x.tab}|${x.sel || ""}">${esc(x.text)}</button></li>`).join("")}</ul>` : `<div class="notice success">${icon("circle-check")}<span>Alles vollständig.</span></div>`}
    <p class="xs muted mt">Fehler verhindern das Speichern nicht, die Durchführung mit unvollständigen Teilaufgaben ist aber nicht sinnvoll. Hinweise sind Empfehlungen.</p></section>
  <section class="card pad"><h3>Bewertung</h3><div class="kv">${icon("sigma")}<div><div class="small">Notenschlüssel</div><span class="v">${esc(GRADING_KEYS[c.gradingKey?.type || "linear"].label)}</span></div></div><div class="kv">${icon("list")}<div><div class="small">Kategoriensystem</div><span class="v">${esc(CATEGORY_SYSTEMS[c.categories?.system || "none"].label)}${categoryList(c.categories).length ? `: ${esc(categoryList(c.categories).join(", "))}` : ""}</span></div></div>
    <div class="kv">${icon("workflow")}<div><div class="small">Aufgabensteuerung</div><span class="v">${E.rules.length} Regel${E.rules.length === 1 ? "" : "n"}</span>${E.rules.slice(0, 4).map((r) => `<div class="xs muted">${esc(r.name)}: ${esc((r.groups?.[0]?.conditions || []).map((x) => condText(x, E.rules)).join(" … "))}</div>`).join("")}</div></div></section></div>
  <h3 class="mt-l">Übersicht</h3><div class="tablewrap"><table class="tbl"><thead><tr><th>Aufgabe</th><th>Teilaufgaben und Fragetypen</th><th>Anwendungen</th><th>Materialien</th><th class="num">Punkte</th></tr></thead><tbody>
    ${c.tasks.map((t) => `<tr><td><b>${t.no} ${esc(t.title)}</b></td><td class="small">${t.subtasks.map((s) => `${s.no} ${esc(s.title)} <span class="muted">(${esc(qShort(s))}, ${pts(s.points)} P)</span>`).join("<br>")}</td><td class="small">${esc(tools(t))}</td><td class="small">${esc(mats(t))}</td><td class="num">${pts(t.points)}</td></tr>`).join("")}
    <tr><td colspan="4"><b>Gesamt</b></td><td class="num"><b>${pts(c.tasks.reduce((a, t) => a + t.points, 0))}</b></td></tr></tbody></table></div>
  <div class="row end mt"><button class="btn" data-preview>${icon("eye")} Vorschau</button><button class="btn primary" data-save>${icon("save")} Speichern</button></div>`;
}

// ---------- Bedienung ----------
function readFile(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); }); }
async function imageData(file) {
  const url = await readFile(file);
  return new Promise((res) => { const im = new Image(); im.onload = () => { const s = Math.min(1, 1200 / Math.max(im.width, im.height)); const cv = document.createElement("canvas"); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); const g = cv.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(im, 0, 0, cv.width, cv.height); res(cv.toDataURL("image/jpeg", 0.85)); }; im.onerror = () => res(url); im.src = url; });
}
const fileMeta = (file) => ({ name: file.name, format: (file.name.split(".").pop() || "").toUpperCase(), size: (file.size / 1048576).toFixed(1).replace(".", ",") + " MB", changed: new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" }) });
const MAX_FILE = 2 * 1048576;
function newMaterial(kind, sub) {
  const id = rid();
  if (kind === "file") return { id, kind, folder: FOLDER.file, data: { name: "Neue_Datei.pdf", format: "PDF", size: "–", changed: "", path: "Bereitgestellte Dateien" } };
  if (kind === "mail") return { id, kind, folder: FOLDER.mail, data: { from: "", from_mail: "", to: "azubi@unternehmen.de", subject: "Neue E-Mail", date: new Date().toLocaleDateString("de-DE") + " 09:00", body: "", attachments: [] } };
  if (kind === "event") return { id, kind, folder: FOLDER.event, data: { title: "Neuer Termin", day: 0, start: "09:00", end: "10:00", location: "", desc: "", editable: false } };
  if (kind === "ticket") return { id, kind, folder: FOLDER.ticket, data: { no: String(4800 + Math.floor(Math.random() * 100)), subject: "Neues Ticket", requester: "", prio: "mittel", status: "offen", created: new Date().toLocaleString("de-DE").slice(0, 17), desc: "", answers: [] } };
  if (kind === "code") return { id, kind, folder: FOLDER.code, data: { name: "vorlage.py", lang: "python", code: "# Vorlage\n" } };
  return { id, kind: "erp", folder: FOLDER.erp, data: sub === "lieferant" ? { type: "lieferant", nr: "70100", name: "", ort: "", mail: "", zahlung: "30 Tage netto" } : { type: "artikel", nr: "100900", name: "", gruppe: "Zukaufteile", einheit: "Stk.", bestand: 0, melde: 0, hoechst: 0, ek: 0, lieferant: "" } };
}
function bindEditor(el, E, cat, tab) {
  const id = cat.id;
  const markDirty = () => { if (!E.dirty) { E.dirty = true; const b = el.querySelector("[data-dirty]"); if (b) { b.className = "badge yellowb"; b.textContent = "ungespeicherte Änderungen"; } } };
  // Neuzeichnen verzögert: ein „change“ beim Verlassen eines Felds (blur durch Navigation) darf das laufende Rendern nicht stören
  const rr = () => setTimeout(() => { if (!el.isConnected) return; activate(E); const y = window.scrollY; redraw(); window.scrollTo(0, y); }, 0);
  // Felder
  el.querySelectorAll("[data-ep]").forEach((f) => {
    const apply = () => { setPath(E, f.dataset.ep, f.hasAttribute("data-enum") ? (f.value === "" ? 0 : +f.value) : f.value); markDirty(); };
    if (f.tagName === "SELECT") f.onchange = () => { apply(); rr(); };
    else { f.oninput = apply; f.onchange = () => { apply(); if (f.hasAttribute("data-erender") || /\.(title|criteria\.\d+\.1|horizon\.\d+\.1)$/.test(f.dataset.ep)) rr(); }; }
  });
  el.querySelectorAll("[data-sel]").forEach((b) => (b.onclick = () => { E.sel = b.dataset.sel; rr(); }));
  el.querySelectorAll("details.edmat").forEach((d) => d.addEventListener("toggle", () => { if (d.open) E.openMat = d.dataset.mat; else if (E.openMat === d.dataset.mat) E.openMat = null; }));
  el.querySelectorAll("[data-goto]").forEach((b) => (b.onclick = () => { const [t, s] = b.dataset.goto.split("|"); if (s) E.sel = s; navigate(`#/app/editor/${id}/${t}`); }));
  const T = (i) => E.content.tasks[+i];
  const act = async (b, ev) => {
    const a = b.dataset.ea; const arg = b.dataset.arg || ""; const [x, y, z] = arg.split(".").map((v) => (v === "" ? v : +v));
    const tasks = E.content.tasks; const swap = (arr, i, j) => { [arr[i], arr[j]] = [arr[j], arr[i]]; };
    switch (a) {
      case "addInfo": E.content.info.items.push(["", ""]); break;
      case "delInfo": E.content.info.items.splice(x, 1); break;
      case "gk": E.content.gradingKey = { type: b.value, ...(b.value === "eigen" ? { thresholds: [...(E.content.gradingKey?.thresholds || GRADING_KEYS.eigen.thresholds)] } : {}) }; break;
      case "cs": E.content.categories = { system: b.value, list: b.value === "eigen" ? E.content.categories?.list || [] : [] }; break;
      case "catlist": E.content.categories.list = b.value.split("\n").map((s) => s.trim()).filter(Boolean); markDirty(); return; // ohne Neuzeichnen (Eingabe)
      case "addTask": tasks.push(newTask(tasks.length + 1)); E.sel = `t${tasks.length - 1}`; if (tab !== "aufgaben") { activate(E); markDirty(); navigate(`#/app/editor/${id}/aufgaben`); return; } break;
      case "addSub": T(x).subtasks.push(newSub()); E.sel = `t${x}.s${T(x).subtasks.length - 1}`; break;
      case "taskUp": swap(tasks, x, x - 1); E.sel = `t${x - 1}`; break;
      case "taskDown": swap(tasks, x, x + 1); E.sel = `t${x + 1}`; break;
      case "taskDup": tasks.splice(x + 1, 0, clone(tasks[x])); E.sel = `t${x + 1}`; break;
      case "taskDel": if (tasks.length < 2) { toast("Mindestens eine Aufgabe", "", "info"); return; } if (!(await confirmBox("Aufgabe löschen", `Aufgabe ${tasks[x].no} „${esc(tasks[x].title)}“ mit allen Teilaufgaben und Materialien wird entfernt.`, "Löschen"))) return; tasks.splice(x, 1); E.sel = "t0"; break;
      case "subUp": swap(T(x).subtasks, y, y - 1); E.sel = `t${x}.s${y - 1}`; break;
      case "subDown": swap(T(x).subtasks, y, y + 1); E.sel = `t${x}.s${y + 1}`; break;
      case "subDup": T(x).subtasks.splice(y + 1, 0, clone(T(x).subtasks[y])); E.sel = `t${x}.s${y + 1}`; break;
      case "subDel": if (!(await confirmBox("Teilaufgabe löschen", `Teilaufgabe ${T(x).subtasks[y].no} wird entfernt.`, "Löschen"))) return; T(x).subtasks.splice(y, 1); E.sel = `t${x}`; break;
      case "tool": { const t = T(x); t.tools = b.checked ? [...new Set([...t.tools, b.value])] : t.tools.filter((k) => k !== b.value); break; }
      case "mk": E.mk = arg; rr(); return;
      case "matAdd": { const m = newMaterial(E.mk, b.dataset.sub); T(x).materials.push(m); E.openMat = `${x}.${T(x).materials.length - 1}`; break; }
      case "matDel": ev?.preventDefault(); T(x).materials.splice(y, 1); break;
      case "att": { const d = T(x).materials[y].data; d.attachments = b.checked ? [...new Set([...(d.attachments || []), b.value])] : (d.attachments || []).filter((n) => n !== b.value); break; }
      case "fileUp": case "filesNew": {
        const files = [...(b.files || [])]; if (!files.length) return;
        for (const file of files) {
          if (file.size > MAX_FILE) { toast("Datei zu groß", `${file.name}: im Klickdummy höchstens 2 MB je Datei.`, "error"); continue; }
          const data = { ...fileMeta(file), url: await readFile(file) };
          if (a === "fileUp") { const m = T(x).materials[y]; const old = m.data.name; Object.assign(m.data, data); T(x).materials.forEach((mm) => { if (mm.kind === "mail" && (mm.data.attachments || []).includes(old)) mm.data.attachments = mm.data.attachments.map((n) => (n === old ? data.name : n)); }); }
          else T(x).materials.push({ id: rid(), kind: "file", folder: FOLDER.file, data: { ...data, path: "Bereitgestellte Dateien" } });
        }
        toast("Datei übernommen", files.map((f) => f.name).join(", "));
        break;
      }
      case "qtype": { const s = T(x).subtasks[y]; s.type = b.value; s.tool = s.type === "app" ? (T(x).tools.find((k) => APP_TOOLS[k]) || "files") : s.type; if ((s.type === "single" || s.type === "multiple") && s.options.length < 2) s.options = [{ text: "", correct: true }, { text: "", correct: false }]; if (s.type === "single" && s.options.filter((o) => o.correct).length !== 1) s.options.forEach((o, i) => (o.correct = i === 0)); break; }
      case "optAdd": T(x).subtasks[y].options.push({ text: "", correct: false }); break;
      case "optDel": T(x).subtasks[y].options.splice(z, 1); break;
      case "optCorrect": { const s = T(x).subtasks[y]; if (s.type === "single") s.options.forEach((o, i) => (o.correct = i === z)); else s.options[z].correct = b.checked; break; }
      case "critAdd": T(x).subtasks[y].criteria.push(["", 1, ""]); break;
      case "critDel": T(x).subtasks[y].criteria.splice(z, 1); break;
      case "hzAdd": T(x).subtasks[y].horizon.push(["", "1 P"]); break;
      case "hzDel": T(x).subtasks[y].horizon.splice(z, 1); break;
      case "imgAdd": { const files = [...(b.files || [])]; for (const file of files) T(x).subtasks[y].images.push({ src: await imageData(file), caption: file.name.replace(/\.[^.]+$/, "") }); break; }
      case "imgDel": T(x).subtasks[y].images.splice(z, 1); break;
      default: return;
    }
    markDirty(); rr();
  };
  el.querySelectorAll("[data-ea]").forEach((b) => {
    const kind = b.tagName === "INPUT" && (b.type === "file" || b.type === "checkbox" || b.type === "radio") || b.tagName === "SELECT" || b.tagName === "TEXTAREA" ? "change" : "click";
    b.addEventListener(kind, (ev) => { if (kind === "click") { ev.preventDefault(); ev.stopPropagation(); } act(b, ev); });
    if (b.tagName === "TEXTAREA") b.addEventListener("input", () => act(b));
  });
  if (tab === "steuerung") bindRulesEditor(el, E.rules, rr, markDirty);
  el.querySelectorAll("[data-save]").forEach((b) => (b.onclick = () => save(E, cat)));
  el.querySelectorAll("[data-preview]").forEach((b) => (b.onclick = async () => { if (E.dirty && !(await save(E, cat))) return; store.set("pvfrom", { editor: id }); navigate(`#/app/vorschau/${id}/dashboard`); }));
}
export async function save(E, cat) {
  normalizeContent(E.content);
  const c = E.content; c.name = E.cat.title;
  const subCount = c.tasks.reduce((a, t) => a + t.subtasks.length, 0);
  const types = [...new Set(c.tasks.flatMap((t) => t.subtasks.map((s) => qShort(s))))];
  const patch = { ...E.cat, duration: `${c.duration_min} Minuten`, content: c, rules: E.rules, contents: [`${c.tasks.length} Aufgaben mit ${subCount} Teilaufgaben (${types.join(", ")})`, c.ausgangssituation ? "Ausgangssituation mit Unternehmensprofil" : "", "Bewertungsraster und Erwartungshorizont je Teilaufgabe", E.rules.length ? `Aufgabensteuerung mit ${E.rules.length} Regeln` : ""].filter(Boolean) };
  if (!cat.editor_by) patch.editor_by = isAuthor() ? "autor" : me()?.id || "";
  try { await upd("catalog", cat.id, patch); } catch (e) { toast("Nicht gespeichert", e?.response?.message || e?.message || "", "error"); return false; }
  E.dirty = false; E.fromDefault = false;
  toast("Inhalt gespeichert", `${c.tasks.length} Aufgaben · ${subCount} Teilaufgaben`);
  redraw(); return true;
}

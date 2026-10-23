// Fensterverwaltung im Prüfungsmodus
// Werkzeuge: Dateien, Mail, Kalender, Notizen, Taschenrechner, Entwicklungsumgebung (IDE)
// - mehrere Fenster je Kategorie (z. B. jede geöffnete E-Mail, jede Notiz)
// - Klick außerhalb eines Fensters minimiert alle sichtbaren Fenster
// - Wiederherstellen über die Taskleiste (Dock); bei mehreren Fenstern Auswahlliste
import { onChange, fileUrl } from "../data.js?v=9.2";
import { icon, esc, modal, confirmBox, toast, popMenu, uid } from "../ui.js?v=9.2";
import { EXAM, subtask } from "../scenario.js?v=9.2";
import { isOffice, officeHtml, downloadUrl } from "../docs.js?v=9.2";

let ctx = null;
export const setCtx = (c) => { ctx = c; };
export const CATS = {
  files: { title: "Dateien", icon: "folder", w: 660, h: 540 },
  mail: { title: "Mail", icon: "mail", w: 760, h: 600 },
  calendar: { title: "Kalender", icon: "calendar", w: 820, h: 560 },
  editor: { title: "Notizen", icon: "notepad-text", w: 720, h: 600 },
  calc: { title: "Taschenrechner", icon: "calculator", w: 330, h: 540 },
  ide: { title: "Entwicklungsumgebung", icon: "code-xml", w: 1000, h: 660 },
  tickets: { title: "Tickets", icon: "ticket", w: 860, h: 600 },
  erp: { title: "ERP-System", icon: "package", w: 1080, h: 620 },
};
const WINS = new Map();
let zTop = 10, cascade = 0;
// Arbeitsmaterialien sind aufgabenspezifisch: Werkzeuge zeigen nur Elemente der aktuellen Aufgabe
let curTask = null;
export const itemTask = (i) => String(i?.data?.task || (i?.submission ? i.submission.split(".")[0] : "1"));
export const getTask = () => curTask;
// Jede Aufgabe hat eigene Fenster: Fenster anderer Aufgaben bleiben erhalten, sind aber ausgeblendet.
// Auf Dashboard und Abgaben (keine Aufgabe) sind alle Werkzeuge gesperrt.
export function setTask(t) { t = t ? String(t) : null; if (t === curTask) return; saveAll(); curTask = t; document.querySelector(".winchooser")?.remove(); WINS.forEach((w) => place(w, w.task === curTask)); onDockChange(); }
const allItems = () => (ctx ? ctx.items() : []);
const items = () => allItems().filter((i) => !curTask || itemTask(i) === curTask);
const addItem = (kind, folder, data, sub = "") => ctx.add(kind, folder, { ...data, task: curTask || data.task || "1" }, sub);
// Fenstergebunden: Elemente gehören immer zur Aufgabe des Fensters (auch wenn beim Speichern schon eine andere Aufgabe geöffnet ist)
const addItemW = (w, kind, folder, data, sub = "") => ctx.add(kind, folder, { ...data, task: w?.task || curTask || data.task || "1" }, sub);
// Automatische Zwischenspeicherung aller Freitextfenster (alle 15 s, beim Verlassen des Fensters, beim Minimieren)
export const AUTOSAVE_MS = 15000;
const saveAll = () => WINS.forEach((w) => w.autosave && w.autosave().catch?.(() => {}));
setInterval(saveAll, AUTOSAVE_MS);
const stamp = () => new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
function showSaved(w, txt) { const s = document.querySelector(`#win-${cssId(w.key)} [data-autosaved]`); if (s) s.textContent = txt || "Automatisch gespeichert " + stamp(); }
// Speichervorgänge eines Fensters nacheinander ausführen (verhindert doppelte Datensätze bei Autosave + Speichern)
const serial = (w, fn) => (w.q = (w.q || Promise.resolve()).then(fn, fn));
function rekey(w, key) { const el = document.getElementById("win-" + cssId(w.key)); WINS.delete(w.key); w.key = key; WINS.set(key, w); if (el) el.id = "win-" + cssId(key); }
let onDockChange = () => {};
export const setDockListener = (fn) => { onDockChange = fn; };

function layer() {
  let l = document.getElementById("winlayer");
  if (!l) { l = document.createElement("div"); l.id = "winlayer"; document.body.appendChild(l); }
  return l;
}
const mine = () => [...WINS.values()].filter((w) => w.task === curTask);
export const instances = (cat) => mine().filter((w) => w.cat === cat);
export const isOpen = (cat) => instances(cat).length > 0;
export const anyOpen = () => mine().length > 0;
export function closeTaskWindows() { mine().forEach((w) => close(w.key)); }
export const dockState = (cat) => { const ins = instances(cat); return { count: ins.length, visible: ins.some((w) => !w.min), minimized: ins.filter((w) => w.min).length }; };
export function closeAll() { saveAll(); [...WINS.keys()].forEach(close); }
export function minimizeAll() { let n = 0; WINS.forEach((w) => { if (!w.min) { w.autosave?.(); w.min = true; n++; place(w); } }); if (n) onDockChange(); }
export function restore() { WINS.forEach((w) => place(w)); }

function titleOf(w) {
  const it = (id) => items().find((i) => i.id === id);
  if (w.kind === "read") return "Mail – " + (it(w.mailId)?.data.subject || "E-Mail");
  if (w.kind === "compose") return w.draft?.subject ? "Entwurf – " + w.draft.subject : "Neue E-Mail";
  if (w.kind === "note") return "Notiz – " + (it(w.noteId)?.data.title || "Neue Notiz");
  if (w.kind === "file") return "Datei – " + (it(w.fileId)?.data.name || "");
  if (w.kind === "ticket") return "Ticket #" + (it(w.ticketId)?.data.no || "") + " – " + (it(w.ticketId)?.data.subject || "");
  return CATS[w.cat].title;
}

// opts: { mailId, compose:{…}, noteId, newNote, fileId, subtask }
export function open(cat, opts = {}) {
  if (!curTask) { toast("Werkzeuge nur in einer Aufgabe verfügbar", "Öffnen Sie eine Aufgabe, um mit E-Mails, Dateien, Tickets und weiteren Werkzeugen zu arbeiten.", "info"); return null; }
  let key = cat, kind = "main";
  if (cat === "mail" && opts.mailId) { key = "mail:" + opts.mailId; kind = "read"; }
  if (cat === "mail" && opts.compose) { key = "mail:c:" + (opts.compose.draftId || uid()); kind = "compose"; }
  if (cat === "editor" && (opts.noteId || opts.newNote)) { key = "editor:" + (opts.noteId || "n" + uid()); kind = "note"; }
  if (cat === "files" && opts.fileId) { key = "files:" + opts.fileId; kind = "file"; }
  if (cat === "tickets" && opts.ticketId) { key = "tickets:" + opts.ticketId; kind = "ticket"; }
  key = curTask + "|" + key;
  let w = WINS.get(key);
  if (!w) {
    const m = CATS[cat];
    const off = (cascade++ % 6) * 28;
    w = { key, cat, kind, task: curTask, x: Math.max(8, Math.min(120 + off, window.innerWidth - m.w - 20)), y: 104 + off, w: Math.min(m.w, window.innerWidth - 24), h: Math.min(m.h, window.innerHeight - 200), tab: cat === "files" ? "provided" : cat === "calendar" ? "week" : "inbox" };
    if (kind === "read") { w.mailId = opts.mailId; markRead(items().find((i) => i.id === opts.mailId)); }
    if (kind === "compose") w.draft = { to: "", subject: "", html: "", attachments: [], ...opts.compose };
    if (kind === "note") w.noteId = opts.noteId || null;
    if (kind === "file") w.fileId = opts.fileId;
    if (kind === "ticket") w.ticketId = opts.ticketId;
    WINS.set(key, w);
  }
  if (opts.subtask) w.defSt = opts.subtask;
  w.min = false; w.z = ++zTop;
  place(w, true);
  onDockChange();
  focusWin(w);
  return w;
}
export function focusWin(w) {
  setTimeout(() => {
    const el = document.getElementById("win-" + cssId(w.key)); if (!el || w.min) return;
    const f = el.querySelector(".win-b input:not([type=file]), .win-b textarea, .win-b [contenteditable], .win-b select, .win-b button, .win-b [tabindex='0']");
    (f || el).focus({ preventScroll: true });
  }, 30);
}
function close(key) { const w = WINS.get(key); if (!w) return; w.autosave?.(); WINS.delete(key); document.getElementById("win-" + cssId(key))?.remove(); onDockChange(); }
const cssId = (k) => k.replace(/[^a-zA-Z0-9_-]/g, "_");

// Klick auf ein Dock-Symbol
export function dockClick(cat, anchor, opts) {
  const ins = instances(cat);
  if (!ins.length) return open(cat, opts);
  if (ins.length === 1) {
    const w = ins[0];
    if (w.min || w.z < zTop) { w.min = false; w.z = ++zTop; place(w); focusWin(w); } else { w.min = true; place(w); }
    onDockChange(); return;
  }
  chooser(anchor, cat);
}
function chooser(anchor, cat) {
  document.querySelector(".winchooser")?.remove();
  const ins = instances(cat).sort((a, b) => b.z - a.z);
  const el = document.createElement("div");
  el.className = "menu winchooser";
  const extra = cat === "mail" ? "Neue E-Mail" : cat === "editor" ? "Neue Notiz" : null;
  el.innerHTML = `<div class="hd">${CATS[cat].title}: ${ins.length} Fenster</div>${ins.map((w) => `<button data-k="${esc(w.key)}">${icon(w.min ? "app-window" : "maximize")}<span class="grow">${esc(titleOf(w))}</span><span class="xs muted">${w.min ? "minimiert" : "geöffnet"}</span></button>`).join("")}
    <div class="sep"></div>${extra ? `<button data-new>${icon("plus")} ${extra}</button>` : ""}<button data-minall>${icon("minus")} Alle minimieren</button><button data-closeall>${icon("x")} Alle schließen</button>`;
  const r = anchor.getBoundingClientRect();
  Object.assign(el.style, { position: "fixed", left: Math.max(8, Math.min(r.left, window.innerWidth - 340)) + "px", bottom: window.innerHeight - r.top + 8 + "px", top: "auto", minWidth: "320px", zIndex: 6000 });
  el.onclick = (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.k) { const w = WINS.get(b.dataset.k); w.min = false; w.z = ++zTop; place(w); focusWin(w); }
    if (b.hasAttribute("data-new")) open(cat, cat === "mail" ? { compose: {} } : { newNote: true });
    if (b.hasAttribute("data-minall")) instances(cat).forEach((w) => { w.min = true; place(w); });
    if (b.hasAttribute("data-closeall")) instances(cat).forEach((w) => close(w.key));
    el.remove(); onDockChange();
  };
  el.setAttribute("role", "menu");
  el.addEventListener("keydown", (e) => {
    const bs = [...el.querySelectorAll("button")]; const i = bs.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length].focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length].focus(); }
    if (e.key === "Escape") { el.remove(); anchor.focus(); }
  });
  document.body.appendChild(el);
  setTimeout(() => el.querySelector("button")?.focus(), 0);
  const off = (e) => { if (!el.contains(e.target)) { el.remove(); document.removeEventListener("pointerdown", off, true); } };
  setTimeout(() => document.addEventListener("pointerdown", off, true), 0);
}

// Klick außerhalb der Fenster → minimieren
let outsideBound = false;
export function bindOutsideMinimize() {
  if (outsideBound) return; outsideBound = true;
  document.addEventListener("pointerdown", (e) => {
    if (!WINS.size) return;
    const t = e.target;
    if (!document.getElementById("tnpage")) return; // nur im Prüfungsmodus
    if (t.closest(".win, .dock, .backdrop, .toasts, .popmenu, .menu, .winchooser, .drawer, .drawer-back, .rolepill, .fullgray, .hlpop, .guidepanel")) return;
    minimizeAll(); // jeder Klick neben ein Fenster (Seite, Kopfzeile, Hintergrund) minimiert alle sichtbaren Fenster
  }, true);
  // Tastatur: F6 wechselt zwischen Fenstern und Seite, Alt+1…6 öffnet Werkzeuge
  document.addEventListener("keydown", (e) => {
    if (!ctx || document.querySelector(".backdrop")) return;
    if (e.key === "F6") {
      e.preventDefault();
      const vis = mine().filter((w) => !w.min).sort((a, b) => a.z - b.z);
      const targets = [...vis.map((w) => document.getElementById("win-" + cssId(w.key))), document.getElementById("tnpage")].filter(Boolean);
      const cur = targets.findIndex((t) => t.contains(document.activeElement));
      const next = targets[(cur + (e.shiftKey ? -1 : 1) + targets.length) % targets.length];
      if (next.id === "tnpage") { next.setAttribute("tabindex", "-1"); next.focus(); } else { const w = vis.find((x) => "win-" + cssId(x.key) === next.id); w.z = ++zTop; next.style.zIndex = w.z; focusWin(w); }
    }
    const ORDER = ["files", "mail", "calendar", "editor", "tickets", "erp", "calc", "ide"];
    if (e.altKey && /^[1-8]$/.test(e.key)) { e.preventDefault(); const cat = ORDER[+e.key - 1]; const ins = instances(cat); if (ins.length) { const w = ins.sort((a, b) => b.z - a.z)[0]; w.min = false; w.z = ++zTop; place(w); focusWin(w); onDockChange(); } else open(cat); }
  });
}

function place(w, rebuild = false) {
  const id = "win-" + cssId(w.key);
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("section");
    el.id = id; el.className = "win"; el.dataset.cat = w.cat; el.setAttribute("role", "dialog");
    el.innerHTML = `<div class="win-h">${icon(CATS[w.cat].icon, "lg")}<span class="wt"></span><span class="wtask"></span><span class="sp"></span>
      <button data-wmin aria-label="Minimieren" title="Minimieren">${icon("minus")}</button><button data-wmax aria-label="Maximieren" title="Maximieren">${icon("square")}</button><button data-wclose aria-label="Schließen" title="Schließen">${icon("x", "lg")}</button></div><div class="win-b"></div>`;
    layer().appendChild(el);
    el.querySelector("[data-wmin]").onclick = () => { w.autosave?.(); w.min = true; place(w); onDockChange(); };
    el.addEventListener("focusout", (e) => { const r = e.relatedTarget; if (r && (el.contains(r) || r.closest(".popmenu, .backdrop, .winchooser"))) return; w.autosave?.(); });
    el.querySelector("[data-wmax]").onclick = () => { w.max = !w.max; place(w); };
    el.querySelector("[data-wclose]").onclick = () => close(w.key);
    el.addEventListener("pointerdown", () => { if (w.z !== zTop) { w.z = ++zTop; el.style.zIndex = w.z; } });
    el.tabIndex = -1;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !document.querySelector(".backdrop, .popmenu, .winchooser")) { e.preventDefault(); w.min = true; place(w); onDockChange(); document.querySelector(`.dock [data-dock="${w.cat}"]`)?.focus(); }
    });
    dragify(el, w);
    new ResizeObserver(() => { if (!w.max && !w.min && el.offsetWidth) { w.w = el.offsetWidth; w.h = el.offsetHeight; } }).observe(el);
    rebuild = true;
  }
  Object.assign(el.style, { left: w.x + "px", top: w.y + "px", width: w.w + "px", height: w.h + "px", zIndex: w.z });
  el.classList.toggle("min", !!w.min); el.classList.toggle("max", !!w.max); el.classList.toggle("othertask", w.task !== curTask);
  el.querySelector(".wt").textContent = titleOf(w);
  el.querySelector(".wtask").textContent = w.task ? "Aufgabe " + w.task : "";
  el.setAttribute("aria-label", titleOf(w));
  if (rebuild) drawBody(w);
}
function dragify(el, w) {
  el.querySelector(".win-h").addEventListener("pointerdown", (e) => {
    if (e.target.closest("button") || w.max) return;
    const sx = e.clientX - w.x, sy = e.clientY - w.y;
    const mv = (ev) => { w.x = Math.max(0, Math.min(window.innerWidth - 120, ev.clientX - sx)); w.y = Math.max(84, Math.min(window.innerHeight - 60, ev.clientY - sy)); el.style.left = w.x + "px"; el.style.top = w.y + "px"; };
    const up = () => { document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up); };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  });
}
const RENDER = { tickets: (w) => (w.kind === "ticket" ? ticketWin(w) : ticketsWin(w)), files: (w) => (w.kind === "file" ? fileWin(w) : filesWin(w)), mail: (w) => (w.kind === "read" ? mailRead(w) : w.kind === "compose" ? composeWin(w) : mailWin(w)), calendar: calWin, editor: (w) => (w.kind === "note" ? noteWin(w) : notesWin(w)), calc: calcWin, ide: ideWin, erp: (w) => erpWin(w) };
function drawBody(w) {
  const el = document.getElementById("win-" + cssId(w.key)); if (!el) return;
  const body = el.querySelector(".win-b");
  el.querySelector(".win-f")?.remove();
  const r = RENDER[w.cat](w);
  body.innerHTML = r.html;
  body.className = "win-b" + (r.cls ? " " + r.cls : "");
  if (r.footer) { const f = document.createElement("div"); f.className = "win-f"; f.innerHTML = r.footer; el.appendChild(f); }
  el.querySelector(".wt").textContent = titleOf(w);
  r.bind && r.bind(el);
}
const redraw = (w) => drawBody(w);
export function refreshWindows() {
  WINS.forEach((w) => {
    if (w.task !== curTask) return; // ausgeblendete Fenster anderer Aufgaben erst beim Zurückkehren neu zeichnen
    const el = document.getElementById("win-" + cssId(w.key));
    const a = document.activeElement;
    if (el && a && el.contains(a) && (a.matches("input,textarea,select") || a.isContentEditable)) return;
    if (w.kind === "read" && !allItems().some((i) => i.id === w.mailId)) return close(w.key);
    drawBody(w);
  });
}
onChange((c) => { if (c === "items" || c === "_reset") refreshWindows(); });

// ---------- Abgabe-Markierung ----------
const stOptions = (sel) => EXAM.tasks.filter((t) => !curTask || t.no === curTask).map((t) => `<optgroup label="Aufgabe ${t.no} ${esc(t.title)}">${t.subtasks.map((s) => `<option value="${s.no}" ${s.no === sel ? "selected" : ""}>${s.no} ${esc(s.title)}</option>`).join("")}</optgroup>`).join("");
const LABEL = { file: "Datei", mail: "E-Mail", event: "Termin", note: "Notiz", code: "Code-Datei", ticket: "Ticket", erp: "ERP-Beleg", answer: "Antwort in der Aufgabe" };
export async function markDialog(item, kindLabel, defSt) {
  const v = await modal({ title: `${kindLabel} als Abgabe markieren`, warn: true, size: "narrow",
    body: `<p>Wählen Sie die Teilaufgabe, für die <b>${esc(item.data.name || item.data.subject || item.data.title || kindLabel)}</b> als Abgabe markiert werden soll.</p>
      <select class="select" data-st><option value="">Teilaufgabe auswählen</option>${stOptions(item.submission || defSt || "")}</select>`,
    footer: `${item.submission ? `<button class="btn danger" data-value="__rm">Markierung entfernen</button>` : ""}<button class="btn" data-value="__no">Nicht markieren</button><button class="btn primary" data-ok>Markieren</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const s = m.querySelector("[data-st]").value; if (!s) { m.querySelector("[data-st]").style.borderColor = "var(--red)"; return; } close(s); }) });
  if (!v || v === "__no") return null;
  if (v === "__rm") { await ctx.upd(item.id, { submission: "" }); toast("Markierung entfernt", "", "info"); return ""; }
  await ctx.upd(item.id, { submission: v });
  toast(`${kindLabel} als Abgabe markiert`, `Zugeordnet zu Teilaufgabe ${v} ${subtask(v)?.title || ""}`);
  return v;
}
const markChip = (it) => `<button class="markchip ${it.submission ? "on" : ""}" data-mark="${it.id}" title="${it.submission ? "Abgabe zu " + it.submission : "Als Abgabe markieren"}">${icon("circle-check")}${it.submission ? esc(it.submission) : icon("chevron-down")}</button>`;
function bindMarks(el, w) { el.querySelectorAll("[data-mark]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); const it = items().find((i) => i.id === b.dataset.mark); markDialog(it, LABEL[it.kind], w.defSt); })); }

export function itemLine(it) {
  const ic = { file: "file", mail: "mail", event: "calendar", note: "notepad-text", code: "file-code", ticket: "ticket", erp: "package", answer: "square-pen" }[it.kind];
  const t = it.kind === "answer" ? answerSummary(it) : it.kind === "mail" ? it.data.subject : it.kind === "event" ? it.data.title : it.kind === "note" ? it.data.title || "Notiz" : it.kind === "ticket" ? "#" + it.data.no + " " + it.data.subject : it.data.name;
  return `<div class="row small" style="padding:4px 0">${icon(ic)} <span class="grow">${esc(t)}</span><span class="muted">${LABEL[it.kind]}</span></div>`;
}
export const answerSummary = (it) => { const d = it.data || {}; return d.type === "single" || d.type === "multiple" ? `Auswahl: ${(d.choice || []).map((i) => String.fromCharCode(65 + i)).join(", ") || "–"}` : (d.text || "").slice(0, 80) || "–"; };
export function itemPreview(it) {
  if (it.kind === "answer") return `<div class="row">${icon("square-pen")}<div><b>Antwort zu ${esc(it.data?.st || "")}</b><div class="small muted">${esc(answerSummary(it))}</div></div></div>`;
  if (it.kind === "erp") return `<div class="row">${icon("package")}<div><b>${esc(erpTitle(it))}</b><div class="small muted">${esc(erpSummary(it))}</div></div></div>`;
  if (it.kind === "mail") return `<div class="row between small"><span>Von: ${esc(it.data.from_mail || it.data.from)}</span><span>${esc(it.data.date)}</span></div><div class="small">An: ${esc(it.data.to)}</div><div class="bold small mt-s">Betreff: ${esc(it.data.subject)}</div><div class="small muted">${esc((it.data.body || "").slice(0, 160))} …</div>${(it.data.attachments || []).map((a) => `<span class="attach mt-s">${icon("paperclip")} ${esc(a)}</span> `).join("")}`;
  if (it.kind === "file") return `<div class="row">${icon("file")}<div><b>${esc(it.data.name)}</b><div class="small muted">Format: ${esc(it.data.format)} · Größe: ${esc(it.data.size)} · Geändert: ${esc(it.data.changed)}</div></div></div>`;
  if (it.kind === "event") return `<div class="row">${icon("calendar")}<div><b>${esc(it.data.title)}</b><div class="small muted">${dayDate(it.data.day)}, ${esc(it.data.start)} – ${esc(it.data.end)} Uhr · ${esc(it.data.location || "")}</div></div></div>`;
  if (it.kind === "ticket") return `<div class="row">${icon("ticket")}<div><b>Ticket #${esc(it.data.no)} – ${esc(it.data.subject)}</b><div class="small muted">Status: ${esc(it.data.status)} · Lösung: ${esc(htmlToText(it.data.solution || "").slice(0, 160) || "–")}</div></div></div>`;
  if (it.kind === "code") return `<div class="row">${icon("file-code")}<b>${esc(it.data.name)}</b></div><pre class="codemini">${esc((it.data.code || "").split("\n").slice(0, 6).join("\n"))}</pre>`;
  return `<div><b>${esc(it.data.title || "Notiz")}</b><div class="small muted">${esc((it.data.html || "").replace(/<[^>]+>/g, " ").slice(0, 180))}</div></div>`;
}

// ---------- Dateien ----------
function filesWin(w) {
  const all = items().filter((i) => i.kind === "file");
  const list = all.filter((f) => f.folder === (w.tab === "provided" ? "provided" : "own"));
  let html = `<div class="row between wrap"><div class="tabs small" style="margin-bottom:12px"><button data-ftab="provided" class="${w.tab === "provided" ? "active" : ""}">Bereitgestellte Dateien</button><button data-ftab="own" class="${w.tab === "own" ? "active" : ""}">Eigene Dateien</button></div>${w.notice ? `<div class="notice success small">${icon("circle-check")}<span>${esc(w.notice)}</span></div>` : ""}</div>`;
  const row = (f, own) => `<div class="filerow" style="margin-left:${own ? 24 : 30}px">${own ? markChip(f) : icon("file")}<div><button class="fname linkbtn" data-view="${f.id}">${esc(f.data.name)}</button><div class="small muted">Format: ${esc(f.data.format)} · Größe: ${esc(f.data.size)} · Geändert: ${esc(f.data.changed)}</div></div><button class="iconbtn" data-fmenu="${f.id}" aria-label="Aktionen">${icon("ellipsis-vertical")}</button></div>`;
  if (w.tab === "provided") {
    const groups = {}; list.forEach((f) => (groups[f.data.path || "Bereitgestellte Dateien"] ||= []).push(f));
    html += Object.entries(groups).map(([g, fs]) => `<div class="bold row mt-s">${icon("chevron-down")} ${icon("folder")} ${esc(g)}</div>${fs.map((f) => row(f, false)).join("")}`).join("");
  } else {
    const rootL = list.filter((f) => !f.data.path);
    const sub = (title, hint, l) => `<div class="bold row mt-s" style="margin-left:24px">${icon("chevron-down")} ${icon("folder")} ${title} <span class="xs muted" style="font-weight:400">${hint}</span></div>` + (l.length ? l.map((f) => row(f, true).replace("margin-left:24px", "margin-left:48px").replace(`Format: ${esc(f.data.format)}`, `${f.data.fromSubject ? `Aus E-Mail „${esc(f.data.fromSubject)}“ · ` : f.data.direct ? `Abgabe ${esc(f.submission || "")} · ` : ""}Format: ${esc(f.data.format)}`)).join("") : `<div class="xs muted" style="margin-left:52px">leer</div>`);
    html += `<div class="bold row">${icon("chevron-down")} ${icon("folder")} Eigene Dateien</div>` + (rootL.length ? rootL.map((f) => row(f, true)).join("") : `<div class="empty small">${icon("folder")}<div>Noch keine eigenen Dateien</div></div>`) +
      sub("E-Mail-Anlagen", "automatisch aus empfangenen E-Mails", list.filter((f) => f.data.path === "E-Mail-Anlagen")) +
      sub("Dateiupload", "direkt in Aufgaben als Abgabe hochgeladen", list.filter((f) => f.data.path === "Dateiupload")) +
      `<h3 class="mt">Dateien hochladen</h3><div class="uploadbox mt-s"><label class="btn">${icon("upload")} Datei auswählen<input type="file" hidden data-upload></label><span class="small">Erlaubte Formate: PDF, JPG, PNG, CSV, XLSX, DOCX – Maximalgröße: 20 MB</span></div>`;
  }
  return { html, bind(el) {
    el.querySelectorAll("[data-ftab]").forEach((b) => (b.onclick = () => { w.tab = b.dataset.ftab; w.notice = ""; redraw(w); }));
    el.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => open("files", { fileId: b.dataset.view })));
    bindMarks(el, w);
    el.querySelectorAll("[data-fmenu]").forEach((b) => (b.onclick = () => {
      const f = all.find((x) => x.id === b.dataset.fmenu);
      popMenu(b, f.folder === "provided" ? [
        { label: "Öffnen", icon: "eye", run: () => open("files", { fileId: f.id }) },
        { label: "In eigene Dateien kopieren", icon: "copy", run: async () => { await addItemW(w, "file", "own", { ...f.data, changed: today() }); w.tab = "own"; w.notice = "Datei wurde in „Eigene Dateien“ kopiert."; redraw(w); } },
        { label: "Herunterladen", icon: "download", run: () => download(f) },
      ] : [
        { label: "Öffnen", icon: "eye", run: () => open("files", { fileId: f.id }) },
        { label: "Umbenennen", icon: "pen-line", run: () => renameFile(f) },
        { label: f.submission ? "Abgabe-Markierung ändern" : "Als Abgabe markieren", icon: "circle-check", run: () => markDialog(f, "Datei", w.defSt) },
        { label: "Herunterladen", icon: "download", run: () => download(f) },
        "-",
        { label: "Löschen", icon: "trash-2", run: async () => { if (await confirmBox("Datei löschen", `Möchten Sie „${esc(f.data.name)}“ wirklich löschen?`, "Löschen")) ctx.del(f.id); } },
      ]);
    }));
    const up = el.querySelector("[data-upload]");
    if (up) up.onchange = async () => {
      const file = up.files[0]; if (!file) return;
      const ext = (file.name.split(".").pop() || "").toUpperCase();
      if (file.size > 20 * 1048576) { toast("Datei zu groß", "Maximal 20 MB sind erlaubt.", "error"); return; }
      const meta = { name: file.name, format: ext, size: (file.size / 1048576).toFixed(1).replace(".", ",") + " MB", changed: today(), task: curTask || "1" };
      let rec;
      try { rec = ctx.addFile ? await ctx.addFile(meta, file) : await addItemW(w, "file", "own", meta); }
      catch (e) { toast("Hochladen fehlgeschlagen", e?.message || "", "error"); return; }
      const st = await markDialog(rec, "Datei", w.defSt);
      w.notice = st ? "Die Datei wurde erfolgreich hochgeladen und als Abgabe markiert." : "Die Datei wurde erfolgreich hochgeladen.";
      redraw(w);
    };
  } };
}
function fileWin(w) {
  const f = allItems().find((i) => i.id === w.fileId);
  if (!f) return { html: `<div class="empty">Datei nicht gefunden</div>` };
  const url = fileUrl(f);
  const isImg = /^(PNG|JPG|JPEG|GIF|WEBP|SVG)$/i.test(f.data.format || "");
  const prev = url && isImg ? `<img src="${url}" alt="${esc(f.data.name)}" style="max-width:100%;max-height:360px;border:1px solid var(--line)">`
    : url && /^PDF$/i.test(f.data.format || "") ? `<iframe src="${url}" title="${esc(f.data.name)}" style="width:100%;min-width:320px;height:380px;border:1px solid var(--line)"></iframe>`
    : url && isOffice(f.data.name) ? `<div class="officeprev" data-office="${url}" data-oname="${esc(f.data.name)}">Lade Vorschau …</div>`
    : url && /^(TXT|CSV|PY|JS|MD)$/i.test(f.data.format || "") ? `<pre data-txt="${url}" style="width:100%;min-width:320px;max-height:360px;overflow:auto;border:1px solid var(--line);background:#fff;padding:10px;font-size:13px;white-space:pre-wrap">Lade Vorschau …</pre>`
    : `<div class="card" style="width:240px;aspect-ratio:1/1.3;display:grid;place-items:center;background:var(--bg-soft);text-align:center">${icon("file-text", "xl")}<div class="small">${esc(f.data.format)}-Vorschau<br><span class="muted xs">${url ? "keine Vorschau – bitte herunterladen" : "(bereitgestellte Demo-Datei)"}</span></div></div>`;
  return { html: `<div class="row" style="align-items:flex-start;gap:24px;flex-wrap:wrap"><div style="flex:1 1 320px">${prev}</div>
    <div class="col" style="gap:6px"><div><b>Name:</b> ${esc(f.data.name)}</div><div><b>Format:</b> ${esc(f.data.format)}</div><div><b>Größe:</b> ${esc(f.data.size)}</div><div><b>Geändert:</b> ${esc(f.data.changed)}</div><div><b>Ordner:</b> ${f.folder === "provided" ? "Bereitgestellte Dateien" : "Eigene Dateien"}</div><div><b>Abgabe:</b> ${f.submission ? "Teilaufgabe " + esc(f.submission) : "nicht markiert"}</div>${url ? `<a class="btn sm mt-s" href="${url}?download=1" download>${icon("download")} Herunterladen</a>` : ""}</div></div>`,
    footer: (url ? `<button class="btn sm ghost" data-dl>${icon("download")} Herunterladen</button>` : "") + (f.data?.direct ? `<span class="xs muted">Direkt in der Aufgabe hochgeladene Abgabe ${esc(f.submission)}</span>` : f.folder === "own" ? `<button class="btn sm" data-mk>${icon("circle-check")} ${f.submission ? "Markierung ändern" : "Als Abgabe markieren"}</button>` : `<button class="btn sm" data-cp>${icon("copy")} In eigene Dateien kopieren</button>`),
    bind(el) {
      const op = el.querySelector("[data-office]"); if (op) officeHtml(op.dataset.office, op.dataset.oname).then((h) => (op.innerHTML = h)).catch(() => (op.textContent = "Vorschau nicht verfügbar – bitte herunterladen"));
      const dl = el.querySelector("[data-dl]"); if (dl) dl.onclick = () => download(f);
      const tx = el.querySelector("[data-txt]"); if (tx) fetch(tx.dataset.txt).then((r) => r.text()).then((t) => (tx.textContent = t.slice(0, 20000))).catch(() => (tx.textContent = "Vorschau nicht verfügbar"));
      const mk = el.querySelector("[data-mk]"); if (mk) mk.onclick = () => markDialog(f, "Datei", w.defSt);
      const cp = el.querySelector("[data-cp]"); if (cp) cp.onclick = async () => { await addItemW(w, "file", "own", { ...f.data, changed: today() }); toast("In eigene Dateien kopiert", f.data.name); };
    } };
}
async function renameFile(f) {
  const v = await modal({ title: "Datei umbenennen", size: "narrow", body: `<label class="lbl">Dateiname</label><input class="input" data-n value="${esc(f.data.name)}">`, footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close(m.querySelector("[data-n]").value.trim())) });
  if (v) ctx.upd(f.id, { data: { ...f.data, name: v, changed: today() } });
}
const today = () => new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
function download(f) { const u = fileUrl(f); if (!u) return toast("Download im Klickdummy simuliert", f.data.name + " ist eine Demo-Datei ohne Inhalt.", "info"); downloadUrl(u, f.data.name); }

// ---------- Mail ----------
function markRead(m) { if (m && m.folder === "inbox" && !m.data.read) ctx.upd(m.id, { data: { ...m.data, read: true } }); }
const FOLDERS = [["inbox", "Posteingang"], ["draft", "Entwürfe"], ["sent", "Gesendet"], ["deleted", "Gelöscht"]];
// Signaturen je Ausgangssituation (Aufgabe), einfügbar im Verfassen-Fenster
const sigList = (task) => (EXAM.signatures?.[task] || EXAM.signatures?.["1"] || []);
const sigHtml = (txt) => `<p class="sig">${esc(txt.replace(/\{name\}/g, `${ctx.p.firstname} ${ctx.p.lastname}`).replace(/\{mail\}/g, `${ctx.p.username || "azubi"}@azubi.funsport-innovations.de`)).replace(/\n/g, "<br>")}</p>`;
const signature = () => `<p><br></p>`;
function mailWin(w) {
  const mails = items().filter((i) => i.kind === "mail");
  const list = mails.filter((m) => m.folder === w.tab);
  const cnt = (f) => mails.filter((m) => m.folder === f).length;
  return { html: `<div class="tabs small" style="margin-bottom:10px">${FOLDERS.map(([k, l]) => `<button data-mtab="${k}" class="${w.tab === k ? "active" : ""}">${l}${k === "inbox" ? ` <span class="badge gray">${mails.filter((m) => m.folder === "inbox" && !m.data.read).length || ""}</span>` : cnt(k) ? ` <span class="muted xs">(${cnt(k)})</span>` : ""}</button>`).join("")}</div>
    ${list.length ? `<div class="card">${list.map((m) => `<div class="mailrow ${m.folder === "inbox" && !m.data.read ? "unread" : ""}" data-read="${m.id}">
      <div class="row" style="align-items:flex-start">${m.folder === "sent" ? markChip(m) : icon("circle-user", "lg")}<div><div>${esc(m.folder === "sent" || m.folder === "draft" ? "An: " + m.data.to : m.data.from + " (" + m.data.from_mail + ")")}</div><div class="subj bold">${esc(m.data.subject || "(kein Betreff)")}</div><div class="muted">${esc((m.data.body || "").slice(0, 70))} …</div>${(m.data.attachments || []).length ? `<span class="attach mt-s">${icon("paperclip")} ${esc(m.data.attachments[0])}</span>` : ""}</div></div>
      <div class="small" style="text-align:right">${esc(m.data.date)}<br><button class="iconbtn" data-trash="${m.id}" aria-label="Löschen">${icon("trash-2")}</button></div></div>`).join("")}</div>`
      : `<div class="empty">${icon("mail")}<div>${w.tab === "inbox" ? "Der Posteingang ist leer" : "Keine E-Mails in diesem Ordner"}</div></div>`}
    <p class="xs muted mt-s">Jede geöffnete E-Mail erscheint in einem eigenen Fenster. Klicken Sie außerhalb, wird es minimiert und bleibt in der Taskleiste.</p>`,
    footer: `<button class="btn primary sm" data-new>${icon("pen-line")} Neue E-Mail schreiben</button>`,
    bind(el) {
      el.querySelectorAll("[data-mtab]").forEach((b) => (b.onclick = () => { w.tab = b.dataset.mtab; redraw(w); }));
      el.querySelectorAll("[data-read]").forEach((r) => (r.onclick = (e) => {
        if (e.target.closest("button")) return;
        const m = mails.find((x) => x.id === r.dataset.read);
        if (m.folder === "draft") open("mail", { compose: { ...m.data, draftId: m.id }, subtask: w.defSt });
        else open("mail", { mailId: m.id, subtask: w.defSt });
      }));
      el.querySelectorAll("[data-trash]").forEach((b) => (b.onclick = async (e) => { e.stopPropagation(); const m = mails.find((x) => x.id === b.dataset.trash); if (m.folder === "deleted") { if (await confirmBox("Endgültig löschen", "Die E-Mail wird endgültig gelöscht.", "Löschen")) ctx.del(m.id); } else ctx.upd(m.id, { folder: "deleted", data: { ...m.data, prev: m.folder } }); }));
      bindMarks(el, w);
      el.querySelector("[data-new]").onclick = () => open("mail", { compose: { html: signature() }, subtask: w.defSt });
    } };
}
function mailRead(w) {
  const m = allItems().find((x) => x.id === w.mailId);
  if (!m) return { html: `<div class="empty">E-Mail nicht gefunden</div>` };
  const quote = `<blockquote style="border-left:3px solid #ccc;margin:12px 0;padding-left:10px;color:#555">${esc(m.data.body || "").replace(/\n/g, "<br>")}</blockquote>`;
  return { html: `<div class="row between" style="align-items:flex-start"><div class="row">${icon("circle-user", "xl")}<div><div>${esc(m.data.from)} (${esc(m.data.from_mail)})</div><div class="small muted">An: ${esc(m.data.to)}</div></div></div><span class="small">${esc(m.data.date)}</span></div>
    <h3 class="mt">${esc(m.data.subject)}</h3>
    ${m.data.html ? `<div class="mt" style="white-space:pre-line;font-size:14px">${m.data.html}</div>` : `<div class="hltools mt" role="toolbar" aria-label="Textmarkierung">${icon("highlighter")}<span class="xs muted">Text auswählen, dann Farbe wählen:</span>${HL.map(([k, l]) => `<button type="button" class="hlbtn hl-${k}" data-hl="${k}" title="${l} markieren" aria-label="Auswahl ${l} markieren"></button>`).join("")}<button type="button" class="btn xs ghost" data-hl="none" title="Markierung der Auswahl entfernen">${icon("eraser")} Entfernen</button><span class="grow"></span><button type="button" class="btn xs ghost" data-hlclear ${hlRanges(m).length ? "" : "disabled"}>${icon("trash-2")} Alle Markierungen löschen</button></div>
    <div class="mt mailbody" data-mbody style="white-space:pre-line;font-size:14px">${hlHtml(m.data.body || "", hlRanges(m))}</div>`}
    <div class="row wrap mt">${(m.data.attachments || []).map((a) => { const f = attachmentFile(m, a); return f ? `<button class="attach" data-openatt="${f.id}" title="Anhang öffnen">${icon("paperclip")} ${esc(a)}</button>` : `<span class="attach">${icon("paperclip")} ${esc(a)}</span>`; }).join("")}${m.folder === "inbox" && (m.data.attachments || []).length ? `<span class="xs muted" style="align-self:center">Anlagen liegen auch unter „Eigene Dateien › E-Mail-Anlagen“.</span>` : ""}</div>
    ${m.folder === "sent" ? `<div class="notice ${m.submission ? "success" : "info"} mt">${icon(m.submission ? "circle-check" : "info")}<span>${m.submission ? `Als Abgabe für Teilaufgabe ${esc(m.submission)} markiert.` : "Diese E-Mail ist nicht als Abgabe markiert."}</span></div>` : ""}`,
    footer: `${m.folder === "deleted" ? `<button class="btn sm" data-restore>${icon("rotate-ccw")} Wiederherstellen</button>` : `<button class="btn sm ghost" data-delmail>${icon("trash-2")} Löschen</button>`}
      ${m.folder === "sent" ? `<button class="btn sm" data-markmail>${icon("circle-check")} ${m.submission ? "Markierung ändern" : "Als Abgabe markieren"}</button>` : ""}
      <button class="btn sm" data-fwd>Weiterleiten</button><button class="btn sm primary" data-reply>${icon("reply")} Antworten</button>`,
    bind(el) {
      const q = (s) => el.querySelector(s);
      bindHighlights(el, m, w);
      q("[data-delmail]") && (q("[data-delmail]").onclick = () => { ctx.upd(m.id, { folder: "deleted", data: { ...m.data, prev: m.folder } }); close(w.key); toast("E-Mail gelöscht", "Sie finden sie im Ordner „Gelöscht“.", "info"); });
      q("[data-restore]") && (q("[data-restore]").onclick = () => { ctx.upd(m.id, { folder: m.data.prev || "inbox" }); close(w.key); });
      q("[data-markmail]") && (q("[data-markmail]").onclick = () => markDialog(m, "E-Mail", w.defSt));
      el.querySelectorAll("[data-openatt]").forEach((b) => (b.onclick = () => open("files", { fileId: b.dataset.openatt, subtask: w.defSt })));
      q("[data-reply]").onclick = () => open("mail", { compose: { to: m.data.from_mail, subject: (m.data.subject.startsWith("AW:") ? "" : "AW: ") + m.data.subject, html: signature() + quote, attachments: [] }, subtask: w.defSt });
      q("[data-fwd]").onclick = () => open("mail", { compose: { to: "", subject: "WG: " + m.data.subject, html: "<p><br></p>" + quote, attachments: [...(m.data.attachments || [])] }, subtask: w.defSt });
    } };
}
// ---------- Textmarkierung in E-Mails (Selbstorganisation, wird nicht bewertet) ----------
// Gespeichert je Prüfling und E-Mail als Element kind "hl" (data: { mail, ranges: [{ s, e, c }] }); bleibt während der Prüfung erhalten
const HL = [["y", "Gelb"], ["g", "Grün"], ["r", "Rot"]];
let pop = null; const hidePop = () => { pop?.remove(); pop = null; };
document.addEventListener("mousedown", (e) => { if (pop && !pop.contains(e.target)) hidePop(); }, { capture: true });
const hlItem = (m) => allItems().find((i) => i.kind === "hl" && i.data?.mail === m.id);
const hlRanges = (m) => hlItem(m)?.data?.ranges || [];
function hlHtml(text, ranges) {
  const col = new Array(text.length).fill(""); ranges.forEach((r) => { for (let i = Math.max(0, r.s); i < Math.min(text.length, r.e); i++) col[i] = r.c; });
  let out = "", i = 0;
  while (i < text.length) { const c = col[i]; let j = i; while (j < text.length && col[j] === c) j++; const seg = esc(text.slice(i, j)); out += c ? `<mark class="hlm hl-${c}">${seg}</mark>` : seg; i = j; }
  return out;
}
const toRanges = (col) => { const r = []; let i = 0; while (i < col.length) { if (!col[i]) { i++; continue; } let j = i; while (j < col.length && col[j] === col[i]) j++; r.push({ s: i, e: j, c: col[i] }); i = j; } return r; };
function textOffset(root, node, off) {
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n, pos = 0;
  while ((n = w.nextNode())) { if (n === node) return pos + off; pos += n.textContent.length; }
  if (node === root) { let p = 0; for (let k = 0; k < off; k++) p += root.childNodes[k].textContent.length; return p; }
  return pos;
}
function bindHighlights(el, m, w) {
  const body = el.querySelector("[data-mbody]"); if (!body) return;
  const text = m.data.body || "";
  const save = async (ranges) => { const it = hlItem(m); if (it) await ctx.upd(it.id, { data: { ...it.data, ranges } }); else await addItemW(w, "hl", "hl", { mail: m.id, ranges }); };
  const apply = async (c) => {
    const sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed) { toast("Bitte zuerst Text auswählen", "Markieren Sie mit der Maus eine Textpassage in der E-Mail.", "info"); return; }
    const r = sel.getRangeAt(0); if (!body.contains(r.commonAncestorContainer)) return;
    let s0 = textOffset(body, r.startContainer, r.startOffset), e0 = textOffset(body, r.endContainer, r.endOffset); if (e0 < s0) [s0, e0] = [e0, s0];
    if (e0 <= s0) return;
    const col = new Array(text.length).fill(""); hlRanges(m).forEach((x) => { for (let i = x.s; i < Math.min(text.length, x.e); i++) col[i] = x.c; });
    for (let i = s0; i < Math.min(text.length, e0); i++) col[i] = c === "none" ? "" : c;
    sel.removeAllRanges(); hidePop(); await save(toRanges(col)); redraw(w);
  };
  el.querySelectorAll("[data-hl]").forEach((b) => { b.addEventListener("mousedown", (e) => e.preventDefault()); b.onclick = () => apply(b.dataset.hl); });
  const cl = el.querySelector("[data-hlclear]"); if (cl) cl.onclick = async () => { if (!(await confirmBox("Alle Markierungen löschen", "Alle farbigen Markierungen in dieser E-Mail werden entfernt.", "Löschen"))) return; await save([]); redraw(w); };
  // „Markieren“-Leiste erscheint nach der Textauswahl
  body.addEventListener("mouseup", () => setTimeout(() => {
    const sel = window.getSelection(); hidePop();
    if (!sel.rangeCount || sel.isCollapsed || !body.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
    const rc = sel.getRangeAt(0).getBoundingClientRect();
    pop = document.createElement("div"); pop.className = "hlpop"; pop.setAttribute("role", "toolbar"); pop.setAttribute("aria-label", "Auswahl markieren");
    pop.innerHTML = `<span class="xs">Markieren</span>${HL.map(([k, l]) => `<button type="button" class="hlbtn hl-${k}" data-c="${k}" title="${l}" aria-label="${l} markieren"></button>`).join("")}<button type="button" class="iconbtn" data-c="none" title="Markierung entfernen" aria-label="Markierung entfernen">${icon("eraser")}</button>`;
    document.body.appendChild(pop);
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, rc.left + rc.width / 2 - pop.offsetWidth / 2)) + "px";
    pop.style.top = Math.max(8, rc.top - pop.offsetHeight - 8) + "px";
    pop.querySelectorAll("[data-c]").forEach((b) => { b.addEventListener("mousedown", (e) => e.preventDefault()); b.onclick = () => apply(b.dataset.c); });
  }, 0));
}
// Datei zu einem E-Mail-Anhang: Verweis des Entwurfs, abgelegte E-Mail-Anlage oder gleichnamige Datei
export function attachmentFile(m, name) {
  const all = allItems(); const ref = m.data.attach_refs?.[name];
  return (ref && all.find((i) => i.id === ref)) || all.find((i) => i.kind === "file" && i.data?.fromMail === m.id && i.data.name === name) || all.find((i) => i.kind === "file" && i.folder === "own" && i.data.name === name) || all.find((i) => i.kind === "file" && i.data.name === name) || null;
}
function rteToolbar() {
  const b = (cmd, ic, t) => `<button type="button" data-cmd="${cmd}" title="${t}" aria-label="${t}">${icon(ic)}</button>`;
  return `<div class="rte-toolbar">${b("undo", "undo-2", "Rückgängig")}${b("redo", "redo-2", "Wiederholen")}<span style="width:10px"></span>${b("bold", "bold", "Fett")}${b("italic", "italic", "Kursiv")}${b("underline", "underline", "Unterstrichen")}<span style="width:10px"></span>${b("justifyLeft", "align-left", "Links")}${b("justifyCenter", "align-center", "Zentriert")}${b("justifyRight", "align-right", "Rechts")}${b("justifyFull", "align-justify", "Blocksatz")}<span style="width:10px"></span>${b("insertUnorderedList", "list", "Aufzählung")}${b("insertOrderedList", "list-ordered", "Nummerierung")}${b("hiliteColor", "highlighter", "Hervorheben")}</div>`;
}
function bindRte(el) { el.querySelectorAll("[data-cmd]").forEach((b) => b.addEventListener("mousedown", (e) => { e.preventDefault(); const c = b.dataset.cmd; document.execCommand(c, false, c === "hiliteColor" ? "#fff35a" : null); })); }
function composeWin(w) {
  const d = w.draft;
  return { html: `<div class="field"><label class="lbl">An</label><input class="input" data-to value="${esc(d.to)}" placeholder="name@beispiel.de"></div>
    <div class="field"><label class="lbl">Betreff</label><input class="input" data-subj value="${esc(d.subject)}"></div>
    <label class="lbl">Nachricht</label>${rteToolbar()}<div class="rte" contenteditable="true" data-body>${d.html || "<p><br></p>"}</div>
    <div class="row wrap mt-s">${(d.attachments || []).map((a, i) => `<span class="attach">${icon("paperclip")} ${esc(a)} <button class="iconbtn" style="width:22px;height:22px" data-rmatt="${i}" aria-label="Anhang entfernen">${icon("trash-2")}</button></span>`).join("")}<button class="attach dashed" data-attach>${icon("plus")} Dateien anhängen</button><button class="attach dashed" data-sig>${icon("signature")} Signatur einfügen</button></div>`,
    footer: `<button class="btn sm ghost" data-discard>${icon("trash-2")} Verwerfen</button><span class="grow xs muted" data-autosaved aria-live="off">${d.savedAt ? "Automatisch gespeichert " + d.savedAt : "Wird automatisch als Entwurf gespeichert"}</span><button class="btn sm ghost" data-savedraft>${icon("save")} Als Entwurf speichern</button><button class="btn primary" data-send>${icon("send")} Senden</button>`,
    bind(el) {
      const collect = () => { d.to = el.querySelector("[data-to]").value; d.subject = el.querySelector("[data-subj]").value; d.html = el.querySelector("[data-body]").innerHTML; };
      bindRte(el);
      el.querySelector("[data-subj]").oninput = () => { d.subject = el.querySelector("[data-subj]").value; el.querySelector(".wt").textContent = titleOf(w); };
      el.querySelectorAll("[data-rmatt]").forEach((b) => (b.onclick = () => { collect(); d.attachments.splice(+b.dataset.rmatt, 1); redraw(w); }));
      el.querySelector("[data-attach]").onclick = (e) => {
        collect();
        const files = items().filter((i) => i.kind === "file" || i.kind === "code");
        const pick = (f) => ({ label: f.data.name, icon: f.kind === "code" ? "file-code" : "file", run: () => { d.attachments.push(f.data.name); (d.attach_refs ||= {})[f.data.name] = f.id; redraw(w); } });
        popMenu(e.currentTarget, [{ header: "Eigene Dateien" }, ...files.filter((f) => f.folder === "own" && f.data.path !== "E-Mail-Anlagen").map(pick), { header: "E-Mail-Anlagen" }, ...files.filter((f) => f.folder === "own" && f.data.path === "E-Mail-Anlagen").map(pick), { header: "Entwicklungsumgebung" }, ...files.filter((f) => f.folder === "ide").map(pick), { header: "Bereitgestellte Dateien" }, ...files.filter((f) => f.folder === "provided").map(pick)], { align: "left" });
      };
      el.querySelector("[data-sig]").onclick = (e) => {
        collect();
        popMenu(e.currentTarget, [{ header: `Signaturen – Aufgabe ${w.task}` }, ...sigList(w.task).map(([label, txt]) => ({ label, icon: "signature", run: () => {
          const body = el.querySelector("[data-body]"); body.querySelectorAll("p.sig").forEach((x) => x.remove());
          const q = body.querySelector("blockquote, .quote"); const tmp = document.createElement("div"); tmp.innerHTML = sigHtml(txt);
          if (q) body.insertBefore(tmp.firstChild, q); else body.appendChild(tmp.firstChild);
          d.html = body.innerHTML; toast("Signatur eingefügt", label, "info");
        } }))], { align: "left" });
      };
      const asData = () => ({ from: `${ctx.p.firstname} ${ctx.p.lastname}`, from_mail: (ctx.p.username || "azubi") + "@azubi.funsport-innovations.de", to: d.to, subject: d.subject, html: d.html, body: htmlToText(d.html), attachments: d.attachments, attach_refs: Object.fromEntries(Object.entries(d.attach_refs || {}).filter(([k]) => (d.attachments || []).includes(k))), date: new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) });
      w.autosave = async () => {
        if (w.sent || !document.getElementById("win-" + cssId(w.key))) return;
        collect(); const sig = JSON.stringify([d.to, d.subject, d.html, d.attachments]);
        if (sig === w.lastSig) return; const empty = !d.to && !d.subject && htmlToText(d.html).length < 2;
        if (!w.lastSig && empty) { w.lastSig = sig; return; }
        w.lastSig = sig;
        await serial(w, async () => { if (w.sent) return; if (d.draftId) await ctx.upd(d.draftId, { data: asData() }); else { const r = await addItemW(w, "mail", "draft", asData()); d.draftId = r.id; } });
        d.savedAt = stamp(); showSaved(w);
      };
      if (!w.lastSig) { collect(); w.lastSig = d.draftId ? JSON.stringify([d.to, d.subject, d.html, d.attachments]) : ""; }
      el.querySelector("[data-discard]").onclick = async () => { if (await confirmBox("Entwurf verwerfen", "Die E-Mail wird nicht gesendet und verworfen.", "Verwerfen")) { w.sent = true; if (d.draftId) ctx.del(d.draftId); close(w.key); } };
      el.querySelector("[data-savedraft]").onclick = async () => { collect(); await serial(w, async () => { if (d.draftId) await ctx.upd(d.draftId, { data: asData() }); else { const r = await addItemW(w, "mail", "draft", asData()); d.draftId = r.id; } }); toast("Entwurf gespeichert", "", "info"); };
      el.querySelector("[data-send]").onclick = async () => {
        collect();
        if (!d.to.includes("@")) { el.querySelector("[data-to]").style.borderColor = "var(--red)"; toast("Bitte Empfänger angeben", "", "error"); return; }
        w.sent = true;
        const rec = await serial(w, () => (d.draftId ? ctx.upd(d.draftId, { folder: "sent", data: asData() }) : addItemW(w, "mail", "sent", asData())));
        close(w.key);
        toast("E-Mail gesendet");
        await markDialog(rec, "E-Mail", w.defSt);
      };
    } };
}
const htmlToText = (h) => { const d = document.createElement("div"); d.innerHTML = (h || "").replace(/<br\s*\/?>/g, "\n").replace(/<\/p>/g, "\n"); return d.textContent.trim(); };

// ---------- Kalender ----------
function monday() { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0); return d; }
export function dayDate(i, offset = 0) { const d = monday(); d.setDate(d.getDate() + i + offset * 7); return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); }
const DAYS = ["Mo", "Di", "Mi", "Do", "Fr"];
const toMin = (t) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + m; };
function calWin(w) {
  w.week ||= 0;
  const evs = items().filter((i) => i.kind === "event");
  const weekEvs = w.week === 0 ? evs : [];
  const range = `${dayDate(0, w.week).slice(0, 6)}–${dayDate(4, w.week)}`;
  let html = `<div class="tabs small" style="margin-bottom:10px"><button data-ctab="week" class="${w.tab === "week" ? "active" : ""}">Kalenderansicht</button><button data-ctab="list" class="${w.tab === "list" ? "active" : ""}">Terminliste</button></div>`;
  if (w.tab === "list") {
    html += evs.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Abgabe</th><th>Datum</th><th>Zeit</th><th>Titel</th><th>Ort</th></tr></thead><tbody>${evs.map((e) => `<tr data-evt="${e.id}" style="cursor:pointer"><td>${e.data.editable ? markChip(e) : `<span class="muted xs">bereitgestellt</span>`}</td><td>${dayDate(e.data.day)}</td><td>${e.data.allday ? "ganztägig" : esc(e.data.start) + " – " + esc(e.data.end)}</td><td><b>${esc(e.data.title)}</b></td><td>${esc(e.data.location || "")}</td></tr>`).join("")}</tbody></table></div>` : `<div class="empty">${icon("calendar")}<div>Es sind noch keine Termine angelegt</div></div>`;
  } else {
    const hours = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
    html += `<div class="row between mb"><div class="row"><button class="iconbtn" data-wk="-1" aria-label="Vorherige Woche">${icon("chevron-left")}</button><button class="iconbtn" data-wk="1" aria-label="Nächste Woche">${icon("chevron-right")}</button><button class="btn primary sm" data-wk="0">${icon("calendar")} Heute</button><span class="attach">${range}</span><span class="attach">Arbeitswoche</span></div><button class="btn primary sm icon" data-newevt title="Neuer Termin" aria-label="Neuer Termin">${icon("calendar-plus")}</button></div>
    <div style="border:1px solid var(--line);font-size:12px">
      <div style="display:grid;grid-template-columns:48px repeat(5,1fr);background:#fafafa;border-bottom:1px solid var(--line)"><div></div>${DAYS.map((d, i) => `<div style="padding:6px;text-align:center;font-weight:700;border-left:1px solid var(--line-2)">${d}. ${dayDate(i, w.week).slice(0, 6)}</div>`).join("")}</div>
      <div style="display:grid;grid-template-columns:48px repeat(5,1fr);border-bottom:1px solid var(--line);min-height:26px"><div class="muted" style="padding:4px;font-size:10px">ganzt.</div>${DAYS.map((_, i) => `<div style="border-left:1px solid var(--line-2)">${weekEvs.filter((e) => e.data.allday && e.data.day === i).map((e) => `<div class="evt allday ${e.submission ? "sub" : ""}" data-evt="${e.id}">${esc(e.data.title)}</div>`).join("")}</div>`).join("")}</div>
      <div style="position:relative;display:grid;grid-template-columns:48px repeat(5,1fr)">
        ${hours.map((h) => `<div class="muted" style="height:38px;border-bottom:1px solid var(--line-2);padding:2px 4px;font-size:11px">${String(h).padStart(2, "0")}:00</div>${DAYS.map((_, i) => `<div data-slot="${i}|${h}" style="height:38px;border-bottom:1px solid var(--line-2);border-left:1px solid var(--line-2);cursor:copy"></div>`).join("")}`).join("")}
        ${weekEvs.filter((e) => !e.data.allday).map((e) => { const top = ((toMin(e.data.start) - 7 * 60) / 60) * 38; const hgt = Math.max(22, ((toMin(e.data.end) - toMin(e.data.start)) / 60) * 38 - 2); return `<div class="evt ${e.submission ? "sub" : ""}" data-evt="${e.id}" style="top:${top}px;height:${hgt}px;left:calc(48px + (100% - 48px) * ${e.data.day} / 5 + 3px);width:calc((100% - 48px) / 5 - 6px)">${e.submission ? icon("circle-check") + " " : ""}${esc(e.data.title)}<br><span style="font-weight:400">${esc(e.data.start)}–${esc(e.data.end)}</span></div>`; }).join("")}
      </div></div><p class="muted xs mt-s">Tipp: Klicken Sie in einen freien Zeitslot, um einen Termin anzulegen.</p>`;
  }
  return { html, bind(el) {
    el.querySelectorAll("[data-ctab]").forEach((b) => (b.onclick = () => { w.tab = b.dataset.ctab; redraw(w); }));
    el.querySelectorAll("[data-wk]").forEach((b) => (b.onclick = () => { const v = +b.dataset.wk; w.week = v === 0 ? 0 : w.week + v; redraw(w); }));
    el.querySelectorAll("[data-evt]").forEach((b) => (b.onclick = (e) => { if (e.target.closest("[data-mark]")) return; eventDialog(evs.find((x) => x.id === b.dataset.evt), {}, w); }));
    el.querySelectorAll("[data-slot]").forEach((b) => (b.onclick = () => { const [d, h] = b.dataset.slot.split("|").map(Number); eventDialog(null, { day: d, start: `${String(h).padStart(2, "0")}:00`, end: `${String(h + 1).padStart(2, "0")}:00` }, w); }));
    const ne = el.querySelector("[data-newevt]"); if (ne) ne.onclick = () => eventDialog(null, { day: 0, start: "10:00", end: "11:00" }, w);
    bindMarks(el, w);
  } };
}
async function eventDialog(ev, preset, w) {
  const isNew = !ev; const d = ev ? ev.data : { title: "", location: "", desc: "", editable: true, ...preset };
  const ro = ev && !d.editable;
  const v = await modal({ title: isNew ? "Neuer Termin" : ro ? "Termindetails" : "Termin bearbeiten", headIcon: icon("calendar", "lg"),
    body: `${ro ? `<div class="notice warn mb">${icon("lock")}<span>Dieser Termin wurde bereitgestellt und kann nicht bearbeitet werden.</span></div>` : ""}
    <div class="field"><label class="lbl">Titel</label><input class="input" data-f="title" value="${esc(d.title)}" ${ro ? "readonly" : ""}></div>
    <div class="field" style="display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:10px"><div><label class="lbl">Tag</label><select class="select" data-f="day" ${ro ? "disabled" : ""}>${DAYS.map((x, i) => `<option value="${i}" ${+d.day === i ? "selected" : ""}>${x}, ${dayDate(i)}</option>`).join("")}</select></div>
      <div><label class="lbl">Beginn</label><input class="input" type="time" data-f="start" value="${esc(d.start)}" ${ro ? "readonly" : ""}></div><div><label class="lbl">Ende</label><input class="input" type="time" data-f="end" value="${esc(d.end)}" ${ro ? "readonly" : ""}></div></div>
    <div class="field"><label class="lbl">Ort</label><input class="input" data-f="location" value="${esc(d.location || "")}" ${ro ? "readonly" : ""}></div>
    <div class="field"><label class="lbl">Beschreibung</label><textarea class="input" data-f="desc" ${ro ? "readonly" : ""}>${esc(d.desc || "")}</textarea></div>
    ${ro ? "" : `<div class="field"><label class="lbl">Als Abgabe markieren</label><select class="select" data-f="submission"><option value="">nicht als Abgabe markieren</option>${stOptions(ev?.submission || (isNew ? w?.defSt || "" : ""))}</select></div>`}`,
    footer: ro ? `<button class="btn primary" data-close>Schließen</button>` : `${isNew ? "" : `<button class="btn danger" data-value="del">${icon("trash-2")} Löschen</button>`}<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => { const ok = m.querySelector("[data-ok]"); if (ok) ok.onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value)); if (!o.title.trim()) { m.querySelector('[data-f="title"]').style.borderColor = "var(--red)"; return; } close(o); }; } });
  if (!v) return;
  if (v === "del") { if (await confirmBox("Termin löschen", "Möchten Sie den Termin wirklich löschen?", "Löschen")) ctx.del(ev.id); return; }
  const data = { ...d, title: v.title, day: +v.day, start: v.start, end: v.end, location: v.location, desc: v.desc, editable: true };
  if (isNew) await addItemW(w, "event", "calendar", data, v.submission); else await ctx.upd(ev.id, { data, submission: v.submission });
  toast(isNew ? "Termin angelegt" : "Termin gespeichert", v.submission ? `Als Abgabe für Teilaufgabe ${v.submission} markiert.` : "");
}

// ---------- Notizen ----------
function notesWin(w) {
  const notes = items().filter((i) => i.kind === "note");
  return { html: notes.length ? notes.map((n) => `<div class="filerow">${markChip(n)}<div><button class="fname linkbtn" data-note="${n.id}">${esc(n.data.title || "Notiz")}</button><div class="small muted">${esc((n.data.html || "").replace(/<[^>]+>/g, " ").slice(0, 90))}</div></div><button class="iconbtn" data-note="${n.id}" aria-label="Öffnen">${icon("arrow-up-right")}</button></div>`).join("") : `<div class="empty">${icon("notepad-text")}<div>Noch keine Notizen</div></div>`,
    footer: `<button class="btn primary sm" data-newnote>${icon("plus")} Neue Notiz</button>`,
    bind(el) {
      bindMarks(el, w);
      el.querySelectorAll("[data-note]").forEach((b) => (b.onclick = () => open("editor", { noteId: b.dataset.note, subtask: w.defSt })));
      el.querySelector("[data-newnote]").onclick = () => open("editor", { newNote: true, subtask: w.defSt });
    } };
}
function noteWin(w) {
  const n = allItems().find((x) => x.id === w.noteId);
  const d = n ? n.data : { title: "", html: "" };
  return { html: `<div class="row wrap mb"><input class="input grow" style="width:auto" data-title placeholder="Titel der Notiz" value="${esc(d.title)}">${n ? markChip(n) : ""}</div>
    ${rteToolbar()}<div class="rte" style="min-height:300px" contenteditable="true" data-body>${d.html || "<p><br></p>"}</div>`,
    footer: `${n ? `<button class="btn sm ghost" data-delnote>${icon("trash-2")} Löschen</button>` : ""}<span class="grow muted xs" data-autosaved>${w.savedAt ? "Automatisch gespeichert " + w.savedAt : n ? "Gespeichert – Änderungen werden automatisch gesichert" : "Wird automatisch gespeichert"}</span><button class="btn primary" data-save>${icon("save")} Eingabe speichern</button>`,
    bind(el) {
      bindRte(el); bindMarks(el, w);
      const dn = el.querySelector("[data-delnote]"); if (dn) dn.onclick = async () => { if (await confirmBox("Notiz löschen", "Die Notiz wird gelöscht.", "Löschen")) { w.deleted = true; await ctx.del(n.id); close(w.key); } };
      const sigOf = () => JSON.stringify([el.querySelector("[data-title]").value, el.querySelector("[data-body]").innerHTML]);
      if (w.lastSig === undefined) w.lastSig = n ? sigOf() : JSON.stringify(["", "<p><br></p>"]);
      w.autosave = async () => {
        if (w.deleted || !el.isConnected) return;
        const sig = sigOf(); if (sig === w.lastSig) return; w.lastSig = sig;
        const title = el.querySelector("[data-title]").value.trim(), html = el.querySelector("[data-body]").innerHTML;
        await serial(w, async () => {
          if (w.deleted) return;
          const cur = allItems().find((x) => x.id === w.noteId);
          const data = { ...(cur?.data || {}), title: title || cur?.data.title || "Notiz " + (items().filter((i) => i.kind === "note").length + (cur ? 0 : 1)), html };
          if (cur) await ctx.upd(cur.id, { data }); else { const rec = await addItemW(w, "note", "notes", data); w.noteId = rec.id; rekey(w, w.task + "|editor:" + rec.id); }
        });
        w.savedAt = stamp(); showSaved(w);
      };
      el.querySelector("[data-save]").onclick = async (ev) => {
        const btn = ev.currentTarget; if (w.saving) return; w.saving = true; btn.disabled = true;
        try { await saveNote(); } finally { w.saving = false; btn.disabled = false; }
      };
      const saveNote = async () => {
        const title = el.querySelector("[data-title]").value.trim(), html = el.querySelector("[data-body]").innerHTML; const sig = sigOf();
        let created = null;
        await serial(w, async () => {
          const cur = allItems().find((x) => x.id === w.noteId);
          const data = { ...(cur?.data || {}), title: title || cur?.data.title || "Notiz " + (items().filter((i) => i.kind === "note").length + 1), html };
          if (cur) await ctx.upd(cur.id, { data }); else { created = await addItemW(w, "note", "notes", data); w.noteId = created.id; rekey(w, w.task + "|editor:" + created.id); }
          w.lastSig = sig;
        });
        redraw(w);
        if (n) toast("Eingabe gespeichert"); else { toast("Notiz gespeichert"); const rec = allItems().find((x) => x.id === w.noteId); if (rec && !rec.submission) await markDialog(rec, "Notiz", w.defSt); }
      };
    } };
}

// ---------- Ticketsystem ----------
const PRIO = { hoch: "red", mittel: "amber", niedrig: "gray" };
const TSTAT = ["offen", "in Bearbeitung", "gelöst", "geschlossen"];
function ticketsWin(w) {
  w.tab ||= "alle";
  const all = items().filter((i) => i.kind === "ticket");
  const list = w.tab === "offen" ? all.filter((t) => !["gelöst", "geschlossen"].includes(t.data.status)) : all;
  return { html: `<div class="tabs small" style="margin-bottom:10px"><button data-ttab="alle" class="${w.tab === "alle" ? "active" : ""}">Alle Tickets <span class="muted xs">(${all.length})</span></button><button data-ttab="offen" class="${w.tab === "offen" ? "active" : ""}">Offen</button></div>
    ${list.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Abgabe</th><th>Nr.</th><th>Betreff</th><th>Anfragende</th><th>Priorität</th><th>Status</th></tr></thead><tbody>${list.map((t) => `<tr data-ticket="${t.id}" style="cursor:pointer"><td>${markChip(t)}</td><td>#${esc(t.data.no)}</td><td><b>${esc(t.data.subject)}</b><div class="xs muted">${esc(t.data.created || "")}</div></td><td>${esc(t.data.requester || "")}</td><td><span class="badge ${PRIO[t.data.prio] || "gray"}">${esc(t.data.prio || "–")}</span></td><td>${esc(t.data.status)}</td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">${icon("ticket")}<div>Für diese Aufgabe liegen keine Tickets vor</div></div>`}`,
    footer: `<button class="btn primary sm" data-newticket>${icon("plus")} Neues Ticket</button>`,
    bind(el) {
      el.querySelector("[data-newticket]").onclick = () => newTicket(w);
      el.querySelectorAll("[data-ttab]").forEach((b) => (b.onclick = () => { w.tab = b.dataset.ttab; redraw(w); }));
      el.querySelectorAll("[data-ticket]").forEach((r) => (r.onclick = (e) => { if (e.target.closest("[data-mark]")) return; open("tickets", { ticketId: r.dataset.ticket, subtask: w.defSt }); }));
      bindMarks(el, w);
    } };
}
async function newTicket(w) {
  const v = await modal({ title: "Neues Ticket", headIcon: icon("ticket", "lg"),
    body: `<div class="field"><label class="lbl">Betreff</label><input class="input" data-f="subject" placeholder="Kurze Beschreibung des Anliegens"></div>
      <div class="field" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div><label class="lbl">Priorität</label><select class="select" data-f="prio"><option>niedrig</option><option selected>mittel</option><option>hoch</option></select></div><div><label class="lbl">Anfragende Person</label><input class="input" data-f="requester" value="${esc(ctx.p.firstname + " " + ctx.p.lastname)}"></div></div>
      <div class="field"><label class="lbl">Beschreibung</label><textarea class="input" rows="5" data-f="desc"></textarea></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Ticket anlegen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value.trim())); if (!o.subject) { m.querySelector('[data-f="subject"]').style.borderColor = "var(--red)"; return; } close(o); }) });
  if (!v) return;
  const used = new Set(items().filter((i) => i.kind === "ticket").map((i) => +i.data.no));
  let no = 4800 + Math.floor(Math.random() * 150); while (used.has(no)) no++;
  const rec = await addItemW(w, "ticket", "tickets", { no: String(no), subject: v.subject, desc: v.desc, prio: v.prio, requester: v.requester, status: "offen", created: new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }), answers: [], own: true });
  toast("Ticket angelegt", `#${no} ${v.subject}`);
  open("tickets", { ticketId: rec.id, subtask: w.defSt });
}
function ticketWin(w) {
  const t = items().find((i) => i.id === w.ticketId) || allItems().find((i) => i.id === w.ticketId);
  if (!t) return { html: `<div class="empty">Ticket nicht gefunden</div>` };
  const d = t.data;
  return { html: `<div class="row between wrap"><div><div class="xs muted">Ticket #${esc(d.no)} · erstellt ${esc(d.created || "")} · von ${esc(d.requester || "")}</div><h3 style="margin:4px 0">${esc(d.subject)}</h3></div><div class="row"><span class="badge ${PRIO[d.prio] || "gray"}">Priorität ${esc(d.prio || "–")}</span>${markChip(t)}</div></div>
    ${d.desc ? `<div class="card pad soft mt-s" style="white-space:pre-line">${esc(d.desc)}</div>` : ""}
    ${(d.answers || []).map((a) => `<div class="card pad mt-s"><div class="xs muted">${esc(a.by)} · ${esc(a.at)}</div><div style="white-space:pre-line">${esc(a.text)}</div></div>`).join("")}
    <div class="row wrap mt" style="gap:12px"><label class="lbl" style="margin:0">Status</label><select class="select" style="width:auto" data-tstatus>${TSTAT.map((x) => `<option ${x === d.status ? "selected" : ""}>${x}</option>`).join("")}</select></div>
    <label class="lbl mt">Lösung / Antwort an die anfragende Person</label>${rteToolbar()}<div class="rte" style="min-height:200px" contenteditable="true" data-sol aria-label="Lösung zum Ticket">${d.solution || "<p><br></p>"}</div>`,
    footer: `<span class="grow xs muted" data-autosaved>${w.savedAt ? "Automatisch gespeichert " + w.savedAt : "Die Lösung wird automatisch gespeichert"}</span><button class="btn sm" data-tmk>${icon("circle-check")} ${t.submission ? "Abgabe " + esc(t.submission) : "Als Abgabe markieren"}</button><button class="btn primary sm" data-tsave>${icon("save")} Lösung speichern</button>`,
    bind(el) {
      bindRte(el); bindMarks(el, w);
      const sol = el.querySelector("[data-sol]"), stat = el.querySelector("[data-tstatus]");
      const sigOf = () => JSON.stringify([sol.innerHTML, stat.value]);
      if (w.lastSig === undefined) w.lastSig = sigOf();
      w.autosave = async () => {
        if (!el.isConnected) return; const sig = sigOf(); if (sig === w.lastSig) return; w.lastSig = sig;
        const cur = allItems().find((i) => i.id === t.id); if (!cur) return;
        await ctx.upd(cur.id, { data: { ...cur.data, solution: sol.innerHTML, status: stat.value } }); w.savedAt = stamp(); showSaved(w);
      };
      stat.onchange = () => w.autosave();
      el.querySelector("[data-tsave]").onclick = async () => { w.lastSig = ""; await w.autosave(); toast("Lösung gespeichert", "Ticket #" + d.no); };
      el.querySelector("[data-tmk]").onclick = async () => { await w.autosave(); markDialog(allItems().find((i) => i.id === t.id), "Ticket", w.defSt); };
    } };
}

// ---------- Taschenrechner ----------
function calcWin(w) {
  w.expr ??= ""; w.hist ??= [];
  const keys = [["C", "clear"], ["⌫", "back"], ["(", "("], [")", ")"], ["7", "7"], ["8", "8"], ["9", "9"], ["÷", "/"], ["4", "4"], ["5", "5"], ["6", "6"], ["×", "*"], ["1", "1"], ["2", "2"], ["3", "3"], ["−", "-"], ["0", "0"], [",", "."], ["%", "%"], ["+", "+"]];
  const disp = w.expr.replace(/\*/g, "×").replace(/\//g, "÷").replace(/\./g, ",") || "0";
  return { cls: "calc", html: `<div class="calc-disp" tabindex="0" data-disp aria-live="polite"><div class="xs muted">${esc(w.last || "")}</div><div class="cur">${esc(disp)}</div></div>
    <div class="calc-keys">${keys.map(([l, k]) => `<button data-k="${esc(k)}" class="${/[0-9.]/.test(k) ? "num" : k === "clear" ? "clr" : "op"}">${l}</button>`).join("")}<button data-k="=" class="eq">=</button></div>
    <div class="calc-hist"><div class="row between"><b class="small">Verlauf</b>${w.hist.length ? `<button class="link xs" data-hclear>leeren</button>` : ""}</div>${w.hist.slice(-5).reverse().map((h) => `<button class="calc-h" data-use="${esc(h.r)}">${esc(h.e)} = <b>${esc(h.r)}</b></button>`).join("") || `<div class="xs muted">Noch keine Berechnungen</div>`}</div>`,
    footer: `<button class="btn sm ghost" data-copy>${icon("copy")} Ergebnis kopieren</button>`,
    bind(el) {
      const press = (k) => {
        if (k === "clear") w.expr = "", w.last = "";
        else if (k === "back") w.expr = w.expr.slice(0, -1);
        else if (k === "=") {
          const src = w.expr.replace(/%/g, "/100");
          if (!/^[0-9+\-*/(). ]+$/.test(src)) { w.last = "Ungültige Eingabe"; }
          else { try { const r = Function(`"use strict";return (${src})`)(); const rs = Number.isFinite(r) ? String(Math.round(r * 1e10) / 1e10) : "Fehler"; const e = w.expr.replace(/\*/g, "×").replace(/\//g, "÷").replace(/\./g, ","); w.hist.push({ e, r: rs.replace(".", ",") }); w.last = e + " ="; w.expr = rs === "Fehler" ? "" : rs; } catch { w.last = "Syntaxfehler"; } }
        } else w.expr += k;
        redraw(w); el.querySelector("[data-disp]").focus();
      };
      el.querySelectorAll("[data-k]").forEach((b) => (b.onclick = () => press(b.dataset.k)));
      el.querySelectorAll("[data-use]").forEach((b) => (b.onclick = () => { w.expr += b.dataset.use.replace(",", "."); redraw(w); }));
      const hc = el.querySelector("[data-hclear]"); if (hc) hc.onclick = () => { w.hist = []; redraw(w); };
      el.querySelector("[data-copy]").onclick = () => { navigator.clipboard?.writeText(w.expr.replace(".", ",")).catch(() => {}); toast("Ergebnis kopiert", w.expr.replace(".", ",") || "0", "info"); };
      el.querySelector("[data-disp]").onkeydown = (e) => {
        const map = { Enter: "=", "=": "=", Backspace: "back", Escape: "clear", ",": "." };
        const k = map[e.key] || (/^[0-9+\-*/().%]$/.test(e.key) ? e.key : null);
        if (k) { e.preventDefault(); press(k); }
      };
    } };
}

// ---------- Entwicklungsumgebung (simuliert) ----------
const LANG = (n) => (/\.py$/.test(n) ? "python" : /\.js$/.test(n) ? "javascript" : "text");
const LANG_LABEL = { python: "Python (Simulation im Browser)", javascript: "JavaScript (wird ausgeführt)", text: "Text" };
function ideWin(w) {
  const files = items().filter((i) => i.kind === "code");
  w.open ??= []; w.out ??= [];
  w.open = w.open.filter((id) => files.some((f) => f.id === id));
  if (!w.active || !files.some((f) => f.id === w.active)) { w.active = (files.find((f) => f.data.name.endsWith(".py")) || files[0])?.id; }
  if (w.active && !w.open.includes(w.active)) w.open.push(w.active);
  const f = files.find((x) => x.id === w.active);
  const lines = (f?.data.code || "").split("\n").length;
  return { cls: "ide", html: `<div class="ide-grid">
    <aside class="ide-files"><div class="row between"><b class="xs">PROJEKT</b><button class="iconbtn" data-newfile title="Neue Datei" aria-label="Neue Datei">${icon("plus")}</button></div>
      ${files.map((x) => `<div class="ide-file ${x.id === w.active ? "on" : ""}"><button class="linkbtn" data-file="${x.id}">${icon("file-code")} ${esc(x.data.name)}</button>${markChip(x)}</div>`).join("")}
      <p class="xs muted mt">Markieren Sie Ihre Lösungsdatei über das Häkchen als Abgabe.</p></aside>
    <section class="ide-main"><div class="ide-tabs">${w.open.map((id) => { const x = files.find((y) => y.id === id); return `<span class="ide-tab ${id === w.active ? "on" : ""}"><button class="linkbtn" data-file="${id}">${esc(x.data.name)}</button><button class="iconbtn" data-closetab="${id}" aria-label="Tab schließen">${icon("x")}</button></span>`; }).join("")}</div>
      ${f ? `<div class="ide-bar"><span class="xs">${LANG_LABEL[LANG(f.data.name)]}</span><span class="grow"></span><span class="xs muted" data-saved>gespeichert</span><button class="btn xs" data-mk>${icon("circle-check")} ${f.submission ? "Abgabe " + esc(f.submission) : "Als Abgabe markieren"}</button><button class="btn xs primary" data-run ${LANG(f.data.name) === "text" ? "disabled" : ""}>${icon("play")} Ausführen</button></div>
      <div class="ide-editor"><pre class="ide-gutter" aria-hidden="true">${Array.from({ length: Math.max(lines, 1) }, (_, i) => i + 1).join("\n")}</pre><textarea data-code spellcheck="false" aria-label="Quelltext ${esc(f.data.name)}">${esc(f.data.code)}</textarea></div>` : `<div class="empty">Keine Datei geöffnet</div>`}
      <div class="ide-console"><div class="row between"><b class="xs">KONSOLE</b><button class="link xs" data-clear>leeren</button></div><pre data-out>${w.out.map((o) => `<span class="${o.t}">${esc(o.s)}</span>`).join("\n")}</pre></div>
    </section></div>`,
    bind(el) {
      bindMarks(el, w);
      el.querySelectorAll("[data-file]").forEach((b) => (b.onclick = () => { w.active = b.dataset.file; redraw(w); }));
      el.querySelectorAll("[data-closetab]").forEach((b) => (b.onclick = () => { w.open = w.open.filter((x) => x !== b.dataset.closetab); if (w.active === b.dataset.closetab) w.active = w.open[0] || null; redraw(w); }));
      el.querySelector("[data-clear]").onclick = () => { w.out = []; redraw(w); };
      el.querySelector("[data-newfile]").onclick = async () => {
        const n = await modal({ title: "Neue Datei", size: "narrow", body: `<label class="lbl">Dateiname</label><input class="input" data-n placeholder="z. B. loesung.py">`, footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Anlegen</button>`, onMount: (m, c) => (m.querySelector("[data-ok]").onclick = () => c(m.querySelector("[data-n]").value.trim())) });
        if (!n) return;
        const r = await addItemW(w, "code", "ide", { name: n, lang: LANG(n), code: LANG(n) === "python" ? "# " + n + "\n" : LANG(n) === "javascript" ? "// " + n + "\n" : "" });
        w.active = r.id; redraw(w);
      };
      if (!f) return;
      const ta = el.querySelector("[data-code]"), gut = el.querySelector(".ide-gutter");
      let t = null;
      const save = () => { clearTimeout(t); t = setTimeout(async () => { await ctx.upd(f.id, { data: { ...f.data, code: ta.value } }); const s = el.querySelector("[data-saved]"); if (s) s.textContent = "gespeichert"; }, 700); };
      ta.oninput = () => { gut.textContent = Array.from({ length: ta.value.split("\n").length }, (_, i) => i + 1).join("\n"); const s = el.querySelector("[data-saved]"); if (s) s.textContent = "ungespeichert …"; save(); };
      ta.onscroll = () => (gut.scrollTop = ta.scrollTop);
      ta.onkeydown = (e) => {
        if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("    ", s, ta.selectionEnd, "end"); ta.oninput(); }
        if (e.key === "Enter") { const s = ta.selectionStart; const line = ta.value.slice(0, s).split("\n").pop(); let ind = line.match(/^\s*/)[0]; if (/[:{]\s*$/.test(line)) ind += "    "; e.preventDefault(); ta.setRangeText("\n" + ind, s, ta.selectionEnd, "end"); ta.oninput(); }
        if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); el.querySelector("[data-run]")?.click(); }
      };
      el.querySelector("[data-mk]").onclick = () => markDialog(f, "Code-Datei", w.defSt || "1.3");
      const run = el.querySelector("[data-run]");
      if (run) run.onclick = async () => {
        clearTimeout(t); await ctx.upd(f.id, { data: { ...f.data, code: ta.value } });
        w.out.push({ t: "cmd", s: `$ ${LANG(f.data.name) === "python" ? "python" : "node"} ${f.data.name}` });
        const res = await execute(LANG(f.data.name), ta.value);
        w.out.push(...res, { t: "cmd", s: "" });
        w.out = w.out.slice(-80);
        redraw(w);
        const pre = document.getElementById("win-" + cssId(w.key))?.querySelector("[data-out]"); if (pre) pre.scrollTop = pre.scrollHeight;
      };
    } };
}

function execute(lang, code) {
  return new Promise((resolve) => {
    let js = code;
    if (lang === "python") { try { js = py2js(code); } catch (e) { resolve([{ t: "err", s: e.message }]); return; } }
    const worker = new Worker(URL.createObjectURL(new Blob([`
      const fmt = (v) => v === true ? "True" : v === false ? "False" : v === null || v === undefined ? "None" : Array.isArray(v) ? "[" + v.map(fmt).join(", ") + "]" : typeof v === "object" ? JSON.stringify(v) : String(v);
      const __print = (...a) => postMessage({ t: "out", s: a.map(fmt).join(" ") });
      const console = { log: (...a) => postMessage({ t: "out", s: a.map((v) => typeof v === "object" ? JSON.stringify(v) : String(v)).join(" ") }), error: (...a) => postMessage({ t: "err", s: a.join(" ") }) };
      const __iter = (x) => typeof x === "number" ? [] : x; const range = (a, b, s = 1) => { if (b === undefined) { b = a; a = 0; } const r = []; for (let i = a; s > 0 ? i < b : i > b; i += s) r.push(i); return r; };
      const len = (x) => x.length, str = (x) => fmt(x), int = (x) => parseInt(x, 10), float = (x) => parseFloat(x), abs = Math.abs, min = Math.min, max = Math.max, round = (x, n = 0) => Math.round(x * 10 ** n) / 10 ** n, input = () => "";
      const __floordiv = (a, b) => Math.floor(a / b);
      try { ${"(function(){\n"}` + js.replace(/<\/script>/g, "") + `${"\n})();"} postMessage({ t: "done" }); } catch (e) { postMessage({ t: "err", s: (e.name || "Fehler") + ": " + e.message }); postMessage({ t: "done" }); }
    `], { type: "text/javascript" })));
    const out = [];
    const timer = setTimeout(() => { worker.terminate(); out.push({ t: "err", s: "Abbruch: Zeitlimit von 3 Sekunden überschritten (Endlosschleife?)" }); resolve(out); }, 3000);
    worker.onmessage = (e) => { if (e.data.t === "done") { clearTimeout(timer); worker.terminate(); if (lang === "python") out.push({ t: "info", s: "Hinweis: Python wird im Klickdummy vereinfacht simuliert." }); resolve(out); } else out.push(e.data); };
    worker.onerror = (e) => { clearTimeout(timer); out.push({ t: "err", s: e.message }); resolve(out); };
  });
}
// Python → JavaScript: vereinfachte Simulation (def, if/elif/else, for, while, return, print, f-Strings)
export function py2js(src) {
  const lines = []; src.split("\n").forEach((raw, no) => { const code = raw.replace(/\t/g, "    ").replace(/#(?=(?:[^"']|"[^"]*"|'[^']*')*$).*$/, "").trimEnd(); if (code.trim()) lines.push({ ind: code.match(/^ */)[0].length, s: code.trim(), no: no + 1 }); });
  const out = []; const stack = []; const scopes = [new Set()]; const fnAt = [];
  const ex = (e) => e.replace(/f"([^"]*)"/g, (_, s) => "`" + s.replace(/\{([^}]+)\}/g, "${$1}") + "`").replace(/f'([^']*)'/g, (_, s) => "`" + s.replace(/\{([^}]+)\}/g, "${$1}") + "`").replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false").replace(/\bNone\b/g, "null").replace(/\band\b/g, "&&").replace(/\bor\b/g, "||").replace(/\bnot\s+/g, "!").replace(/(\w+|\))\s*\/\/\s*(\w+|\()/g, "__floordiv($1,$2)");
  lines.forEach((l, i) => {
    while (stack.length && l.ind <= stack[stack.length - 1]) { stack.pop(); out.push("}"); if (fnAt.length && fnAt[fnAt.length - 1] === stack.length) { fnAt.pop(); scopes.pop(); } }
    let m; const s = l.s;
    const opens = (h) => { const next = lines[i + 1]; if (!next || next.ind <= l.ind) throw new SyntaxError(`IndentationError: eingerückter Block erwartet (Zeile ${l.no + 1})`); out.push(h + " {"); stack.push(l.ind); };
    if ((m = s.match(/^def\s+(\w+)\s*\((.*)\)\s*:$/))) { opens(`function ${m[1]}(${m[2]})`); fnAt.push(stack.length - 1); scopes.push(new Set(m[2].split(",").map((x) => x.trim().split("=")[0]).filter(Boolean))); }
    else if ((m = s.match(/^if\s+(.+):$/))) opens(`if (${ex(m[1])})`);
    else if ((m = s.match(/^elif\s+(.+):$/))) opens(`else if (${ex(m[1])})`);
    else if (/^else\s*:$/.test(s)) opens("else");
    else if ((m = s.match(/^for\s+(\w+)\s+in\s+(.+):$/))) opens(`for (var ${m[1]} of __iter(${ex(m[2])}))`);
    else if ((m = s.match(/^while\s+(.+):$/))) opens(`while (${ex(m[1])})`);
    else if (/:$/.test(s)) throw new SyntaxError(`Nicht unterstützte Anweisung (Zeile ${l.no}): ${s}`);
    else if (s === "pass") out.push(";");
    else if ((m = s.match(/^([A-Za-z_]\w*)\s*=(?!=)/)) && !scopes[scopes.length - 1].has(m[1])) { scopes[scopes.length - 1].add(m[1]); out.push("var " + ex(s) + ";"); }
    else out.push(ex(s).replace(/^print\(/, "__print(") + ";");
  });
  while (stack.length) { stack.pop(); out.push("}"); }
  return out.join("\n");
}

// ---------- ERP-System (vereinfacht): Artikel, Lieferanten, Bestellungen ----------
// Stammdaten je Aufgabe (beim ersten Login kopiert); Prüflinge legen Lieferanten und Bestellungen an und können Bestellungen als Abgabe markieren
const eur = (v) => (+v || 0).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const erpAll = (w) => allItems().filter((i) => i.kind === "erp" && itemTask(i) === w.task);
const erpOf = (w, type) => erpAll(w).filter((i) => i.data.type === type);
const supplierName = (w, nr) => erpOf(w, "lieferant").find((x) => x.data.nr === nr)?.data.name || nr || "–";
const articleOf = (w, nr) => erpOf(w, "artikel").find((x) => x.data.nr === nr);
export const erpTitle = (it) => it.data.type === "buchung" ? `Buchungssatz ${it.data.nr}` : it.data.type === "bestellung" ? `Bestellung ${it.data.nr}` : it.data.type === "lieferant" ? `Lieferant ${it.data.nr} ${it.data.name}` : it.data.type === "konto" ? `Konto ${it.data.nr} ${it.data.name}` : it.data.type === "beleg" ? `Beleg ${it.data.nr}` : `Artikel ${it.data.nr}`;
// Buchungssatz als Text: „6000 Aufwendungen für Rohstoffe 1.880,00 € / 2600 Vorsteuer 357,20 € an 4400 Verbindlichkeiten 2.237,20 €“
export const bookingText = (d, kname = (nr) => nr) => `${(d.soll || []).map((x) => `${x.konto} ${kname(x.konto)} ${eur(x.betrag)}`).join(" / ")} an ${(d.haben || []).map((x) => `${x.konto} ${kname(x.konto)} ${eur(x.betrag)}`).join(" / ")}`;
const sumOf = (l) => Math.round((l || []).reduce((a, x) => a + (+x.betrag || 0), 0) * 100) / 100;
export const erpSum = (it) => (it.data.pos || []).reduce((a, p) => a + (+p.menge || 0) * (+p.preis || 0), 0);
export function erpSummary(it) {
  if (it.data.type === "bestellung") return `${it.data.datum} · ${it.data.lieferant_name || it.data.lieferant} · ${(it.data.pos || []).length} Position(en) · ${eur(erpSum(it))} · ${it.data.status}`;
  if (it.data.type === "lieferant") return `${it.data.ort || ""} · ${it.data.mail || ""}`;
  if (it.data.type === "buchung") return `${it.data.datum} · ${it.data.beleg ? "Beleg " + it.data.beleg + " · " : ""}${bookingText(it.data)}`;
  return it.data.name;
}
function erpWin(w) {
  const fibu = erpOf(w, "konto").length > 0;
  w.tab = ["artikel", "lieferanten", "bestellungen", ...(fibu ? ["buchungen", "konten"] : [])].includes(w.tab) ? w.tab : "artikel";
  const tabs = `<div class="tabs small" style="margin-bottom:12px">${[["artikel", "package", "Artikel / Lager"], ["lieferanten", "building-2", "Lieferanten"], ["bestellungen", "clipboard-list", "Bestellungen"], ...(fibu ? [["buchungen", "book-text", "Buchungen"], ["konten", "list", "Kontenplan / Salden"]] : [])].map(([k, ic, l]) => `<button data-etab="${k}" class="${w.tab === k ? "active" : ""}">${icon(ic)} ${l}</button>`).join("")}</div>`;
  let body = "", foot = "";
  if (w.tab === "artikel") {
    const l = erpOf(w, "artikel");
    body = `<div class="tablewrap"><table class="tbl compact erp"><thead><tr><th>Art.-Nr.</th><th>Bezeichnung</th><th>Gruppe</th><th class="num">Bestand</th><th class="num">Meldebestand</th><th class="num">Höchstbestand</th><th class="num">EK-Preis</th><th>Status</th><th></th></tr></thead><tbody>${l.map((a) => { const low = +a.data.bestand < +a.data.melde; return `<tr><td>${esc(a.data.nr)}</td><td><b>${esc(a.data.name)}</b><div class="xs muted">${a.data.lieferant ? "Lieferant: " + esc(supplierName(w, a.data.lieferant)) : "kein Stammlieferant"}</div></td><td>${esc(a.data.gruppe)}</td><td class="num">${a.data.bestand} ${esc(a.data.einheit || "")}</td><td class="num">${a.data.melde}</td><td class="num">${a.data.hoechst}</td><td class="num">${a.data.ek ? eur(a.data.ek) : "–"}</td><td>${low ? `<span class="badge red">unter Meldebestand</span>` : `<span class="badge green">ausreichend</span>`}</td><td>${a.data.ek ? `<button class="btn sm ${low ? "primary" : ""}" data-order="${a.id}">${icon("plus")} Bestellen</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="xs muted mt-s">Bestellvorschlag: Liegt der Bestand unter dem Meldebestand, wird bis zum Höchstbestand aufgefüllt (Bestellmenge = Höchstbestand − Bestand).</p>`;
  } else if (w.tab === "lieferanten") {
    const l = erpOf(w, "lieferant");
    body = `<div class="tablewrap"><table class="tbl compact erp"><thead><tr><th>Lief.-Nr.</th><th>Name</th><th>Ort</th><th>E-Mail</th><th>Zahlungsbedingungen</th><th></th></tr></thead><tbody>${l.map((x) => `<tr><td>${esc(x.data.nr)}</td><td><b>${esc(x.data.name)}</b>${x.data.own ? ` <span class="badge cyan">neu angelegt</span>` : ""}</td><td>${esc(x.data.ort || "")}</td><td>${esc(x.data.mail || "")}</td><td>${esc(x.data.zahlung || "")}</td><td>${x.data.own ? markChip(x) : ""}</td></tr>`).join("")}</tbody></table></div>`;
    foot = `<button class="btn primary sm" data-newsup>${icon("plus")} Lieferant anlegen</button>`;
  } else if (w.tab === "buchungen") {
    const l = erpOf(w, "buchung").sort((a, b) => (a.data.nr > b.data.nr ? -1 : 1)); const bel = erpOf(w, "beleg");
    const kn = (nr) => erpOf(w, "konto").find((k) => k.data.nr === nr)?.data.name || "";
    body = `<h4 style="margin:0 0 6px">Zu buchende Belege</h4><div class="tablewrap"><table class="tbl compact erp"><thead><tr><th>Beleg</th><th>Art</th><th>Datum</th><th>Partner</th><th>Text</th><th class="num">Netto</th><th class="num">USt</th><th class="num">Brutto</th><th></th></tr></thead><tbody>${bel.map((b) => { const ust = Math.round(b.data.netto * b.data.ust) / 100; const booked = l.some((x) => x.data.beleg === b.data.nr); return `<tr><td><b>${esc(b.data.nr)}</b></td><td class="small">${esc(b.data.art)}</td><td>${esc(b.data.datum)}</td><td class="small">${esc(b.data.partner)}</td><td class="small">${esc(b.data.text)}</td><td class="num">${eur(b.data.netto)}</td><td class="num">${eur(ust)}</td><td class="num"><b>${eur(b.data.netto + ust)}</b></td><td>${booked ? `<span class="badge green">gebucht</span>` : `<button class="btn sm" data-book="${b.id}">${icon("plus")} Buchen</button>`}</td></tr>`; }).join("") || `<tr><td colspan="9" class="muted small">Keine Belege.</td></tr>`}</tbody></table></div>
      <h4 style="margin:14px 0 6px">Buchungssätze (Grundbuch)</h4><div class="tablewrap"><table class="tbl compact erp"><thead><tr><th>Nr.</th><th>Datum</th><th>Beleg</th><th>Buchungssatz</th><th>Text</th><th>Abgabe</th></tr></thead><tbody>${l.map((b) => `<tr><td>${esc(b.data.nr)}</td><td>${esc(b.data.datum)}</td><td>${esc(b.data.beleg || "–")}</td><td class="small">${(b.data.soll || []).map((x) => `<div><b>S</b> ${esc(x.konto)} ${esc(kn(x.konto))} · ${eur(x.betrag)}</div>`).join("")}${(b.data.haben || []).map((x) => `<div style="padding-left:18px"><b>an H</b> ${esc(x.konto)} ${esc(kn(x.konto))} · ${eur(x.betrag)}</div>`).join("")}</td><td class="small">${esc(b.data.text || "")}</td><td>${markChip(b)}</td></tr>`).join("") || `<tr><td colspan="6" class="muted small">Noch keine Buchungen.</td></tr>`}</tbody></table></div>`;
    foot = `<button class="btn primary sm" data-book>${icon("plus")} Buchungssatz erfassen</button>`;
  } else if (w.tab === "konten") {
    const l = erpOf(w, "konto").sort((a, b) => a.data.nr.localeCompare(b.data.nr)); const bk = erpOf(w, "buchung");
    const sal = (nr) => { const s1 = bk.reduce((a, b) => a + sumOf((b.data.soll || []).filter((x) => x.konto === nr)), 0); const h1 = bk.reduce((a, b) => a + sumOf((b.data.haben || []).filter((x) => x.konto === nr)), 0); return [s1, h1]; };
    body = `<div class="tablewrap"><table class="tbl compact erp"><thead><tr><th>Konto</th><th>Bezeichnung</th><th>Art</th><th class="num">Soll</th><th class="num">Haben</th><th class="num">Saldo</th></tr></thead><tbody>${l.map((k) => { const [so, ha] = sal(k.data.nr); return `<tr><td><b>${esc(k.data.nr)}</b></td><td>${esc(k.data.name)}</td><td class="small">${esc(k.data.art)}</td><td class="num">${so ? eur(so) : "–"}</td><td class="num">${ha ? eur(ha) : "–"}</td><td class="num">${so || ha ? `<b>${eur(Math.abs(so - ha))}</b> ${so >= ha ? "S" : "H"}` : "–"}</td></tr>`; }).join("")}</tbody></table></div><p class="xs muted mt-s">Vereinfachter Kontenplan (Industriekontenrahmen). Salden aus den erfassten Buchungssätzen.</p>`;
  } else {
    const l = erpOf(w, "bestellung").sort((a, b) => (a.data.nr > b.data.nr ? -1 : 1));
    body = `<div class="tablewrap"><table class="tbl compact erp"><thead><tr><th>Bestell-Nr.</th><th>Datum</th><th>Lieferant</th><th>Positionen</th><th class="num">Summe</th><th>Status</th><th>Abgabe</th></tr></thead><tbody>${l.map((b) => `<tr><td><button class="linkbtn" data-showord="${b.id}">${esc(b.data.nr)}</button></td><td>${esc(b.data.datum)}</td><td>${esc(supplierName(w, b.data.lieferant))}</td><td class="small">${(b.data.pos || []).map((p) => `${p.menge} × ${esc(articleOf(w, p.artikel)?.data.name || p.artikel)}`).join("<br>")}</td><td class="num">${eur(erpSum(b))}</td><td><span class="badge ${b.data.status === "geliefert" ? "green" : b.data.status === "angelegt" ? "cyan" : "gray"}">${esc(b.data.status)}</span></td><td>${b.data.own ? markChip(b) : ""}</td></tr>`).join("")}</tbody></table></div>`;
    foot = `<button class="btn primary sm" data-order>${icon("plus")} Neue Bestellung</button>`;
  }
  return { html: tabs + body, footer: `<span class="grow xs muted">ERP-System (vereinfacht) · Aufgabe ${esc(w.task)} · eigene Lieferanten und Bestellungen lassen sich als Abgabe markieren</span>${foot}`,
    bind(el) {
      el.querySelectorAll("[data-etab]").forEach((b) => (b.onclick = () => { w.tab = b.dataset.etab; redraw(w); }));
      bindMarks(el, w);
      el.querySelectorAll("[data-order]").forEach((b) => (b.onclick = () => erpOrder(w, b.dataset.order)));
      const ns = el.querySelector("[data-newsup]"); if (ns) ns.onclick = () => erpSupplier(w);
      el.querySelectorAll("[data-book]").forEach((b) => (b.onclick = () => erpBooking(w, b.dataset.book || "")));
      el.querySelectorAll("[data-showord]").forEach((b) => (b.onclick = () => erpShow(w, erpAll(w).find((x) => x.id === b.dataset.showord))));
    } };
}
async function erpSupplier(w) {
  const nums = erpOf(w, "lieferant").map((x) => +x.data.nr || 0); const nr = String(Math.max(70000, ...nums) + 10);
  const v = await modal({ title: "Lieferant anlegen", size: "narrow", body: `<div class="field"><label class="lbl" for="es-n">Name</label><input id="es-n" class="input" data-f="name" autofocus></div><div class="field"><label class="lbl" for="es-o">Ort</label><input id="es-o" class="input" data-f="ort"></div><div class="field"><label class="lbl" for="es-m">E-Mail</label><input id="es-m" class="input" data-f="mail"></div><div class="field"><label class="lbl" for="es-z">Zahlungsbedingungen</label><input id="es-z" class="input" data-f="zahlung" placeholder="z. B. 30 Tage netto"></div><p class="xs muted">Lieferantennummer: ${nr}</p>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Anlegen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value.trim())); if (!o.name) { m.querySelector('[data-f="name"]').style.borderColor = "var(--red)"; return; } close(o); }) });
  if (!v) return;
  const rec = await addItemW(w, "erp", "erp", { type: "lieferant", nr, own: true, ...v });
  toast("Lieferant angelegt", `${nr} ${v.name}`); redraw(w);
  await markDialog(rec, "ERP-Beleg", w.defSt);
}
async function erpOrder(w, artId = "") {
  const arts = erpOf(w, "artikel").filter((a) => +a.data.ek > 0); const sups = erpOf(w, "lieferant");
  const a0 = arts.find((a) => a.id === artId) || arts[0];
  const sugg = (a) => Math.max(1, +a.data.bestand < +a.data.melde ? +a.data.hoechst - +a.data.bestand : +a.data.hoechst - +a.data.bestand);
  const v = await modal({ title: "Neue Bestellung", size: "narrow",
    body: `<div class="field"><label class="lbl" for="eo-a">Artikel</label><select id="eo-a" class="select" data-a>${arts.map((a) => `<option value="${a.id}" ${a === a0 ? "selected" : ""}>${esc(a.data.nr)} · ${esc(a.data.name)}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="eo-l">Lieferant</label><select id="eo-l" class="select" data-l>${sups.map((x) => `<option value="${esc(x.data.nr)}" ${x.data.nr === a0?.data.lieferant ? "selected" : ""}>${esc(x.data.nr)} · ${esc(x.data.name)}</option>`).join("")}</select></div>
      <div class="nrgrid"><div class="field"><label class="lbl" for="eo-m">Menge</label><input id="eo-m" class="input" type="number" min="1" data-m value="${a0 ? sugg(a0) : 1}"></div><div class="field"><label class="lbl" for="eo-p">Einzelpreis (€)</label><input id="eo-p" class="input" type="number" step="0.01" min="0" data-p value="${a0 ? a0.data.ek : 0}"></div></div>
      <div class="field"><label class="lbl" for="eo-t">Liefertermin</label><input id="eo-t" class="input" type="date" data-t></div>
      <p class="small" data-sum></p><p class="xs muted" data-hint></p>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Bestellung anlegen</button>`,
    onMount: (m, close) => {
      const A = m.querySelector("[data-a]"), M = m.querySelector("[data-m]"), P = m.querySelector("[data-p]");
      const upd = () => { const a = arts.find((x) => x.id === A.value); m.querySelector("[data-sum]").innerHTML = `Bestellwert: <b>${eur((+M.value || 0) * (+P.value || 0))}</b>`; m.querySelector("[data-hint]").textContent = a ? `Bestand ${a.data.bestand}, Meldebestand ${a.data.melde}, Höchstbestand ${a.data.hoechst} – Vorschlag: ${sugg(a)} ${a.data.einheit || ""}` : ""; };
      A.onchange = () => { const a = arts.find((x) => x.id === A.value); if (a) { M.value = sugg(a); P.value = a.data.ek; if (a.data.lieferant) m.querySelector("[data-l]").value = a.data.lieferant; } upd(); };
      M.oninput = P.oninput = upd; upd();
      m.querySelector("[data-ok]").onclick = () => { if (!(+M.value > 0)) { M.style.borderColor = "var(--red)"; return; } close({ art: A.value, lief: m.querySelector("[data-l]").value, menge: +M.value, preis: +P.value, termin: m.querySelector("[data-t]").value }); };
    } });
  if (!v) return;
  const a = arts.find((x) => x.id === v.art); const n = erpOf(w, "bestellung").length + 1;
  const rec = await addItemW(w, "erp", "erp", { type: "bestellung", own: true, nr: "BE-2025-" + String(500 + n).padStart(4, "0"), datum: new Date().toLocaleDateString("de-DE"), lieferant: v.lief, lieferant_name: supplierName(w, v.lief), pos: [{ artikel: a.data.nr, name: a.data.name, menge: v.menge, preis: v.preis }], termin: v.termin ? v.termin.split("-").reverse().join(".") : "", status: "angelegt" });
  w.tab = "bestellungen"; toast("Bestellung angelegt", `${rec.data.nr} · ${eur(v.menge * v.preis)}`); redraw(w);
  await markDialog(rec, "ERP-Beleg", w.defSt);
}
// Buchungssatz erfassen: ein- oder mehrteilig (zusammengesetzter Buchungssatz), Summe Soll = Summe Haben
async function erpBooking(w, belegId = "") {
  const ks = erpOf(w, "konto").sort((a, b) => a.data.nr.localeCompare(b.data.nr)); const bel = erpOf(w, "beleg"); const b0 = bel.find((x) => x.id === belegId);
  const kopt = (sel) => `<option value="">Konto wählen</option>${ks.map((k) => `<option value="${esc(k.data.nr)}" ${k.data.nr === sel ? "selected" : ""}>${esc(k.data.nr)} ${esc(k.data.name)}</option>`).join("")}`;
  const line = (side, i) => `<div class="row" style="gap:6px;margin:4px 0" data-line="${side}"><select class="select" data-k aria-label="${side === "S" ? "Sollkonto" : "Habenkonto"} ${i + 1}">${kopt("")}</select><input class="input" type="number" step="0.01" min="0" data-b placeholder="Betrag €" style="width:140px" aria-label="Betrag"><button type="button" class="iconbtn" data-rml aria-label="Zeile entfernen">${icon("x")}</button></div>`;
  const v = await modal({ title: "Buchungssatz erfassen", size: "wide",
    body: `<div class="grid3"><div class="field"><label class="lbl" for="bk-d">Buchungsdatum</label><input id="bk-d" class="input" data-d value="${esc(b0?.data.datum || new Date().toLocaleDateString("de-DE"))}"></div>
      <div class="field"><label class="lbl" for="bk-b">Beleg</label><select id="bk-b" class="select" data-bel><option value="">ohne Beleg</option>${bel.map((x) => `<option value="${esc(x.data.nr)}" ${x === b0 ? "selected" : ""}>${esc(x.data.nr)} · ${esc(x.data.art)} ${esc(x.data.partner)}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="bk-t">Buchungstext</label><input id="bk-t" class="input" data-t value="${esc(b0 ? b0.data.text : "")}"></div></div>
      ${b0 ? `<p class="small">Beleg ${esc(b0.data.nr)}: netto ${eur(b0.data.netto)}, USt ${b0.data.ust} %, brutto ${eur(b0.data.netto * (1 + b0.data.ust / 100))}</p>` : ""}
      <div class="nrgrid"><div><span class="lbl">Soll</span><div data-side="S">${line("S", 0)}</div><button type="button" class="btn xs" data-addl="S">${icon("plus")} Sollkonto</button></div>
      <div><span class="lbl">an Haben</span><div data-side="H">${line("H", 0)}</div><button type="button" class="btn xs" data-addl="H">${icon("plus")} Habenkonto</button></div></div>
      <p class="small" data-bal></p>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Buchen</button>`,
    onMount: (m, close) => {
      const lines = (side) => [...m.querySelectorAll(`[data-side="${side}"] [data-line]`)].map((r) => ({ konto: r.querySelector("[data-k]").value, betrag: Math.round((+r.querySelector("[data-b]").value || 0) * 100) / 100 })).filter((x) => x.konto || x.betrag);
      const bal = () => { const s1 = sumOf(lines("S")), h1 = sumOf(lines("H")); const el = m.querySelector("[data-bal]"); el.innerHTML = `Summe Soll <b>${eur(s1)}</b> · Summe Haben <b>${eur(h1)}</b> ${s1 && Math.abs(s1 - h1) < 0.005 ? `<span class="badge green">ausgeglichen</span>` : `<span class="badge yellowb">Differenz ${eur(Math.abs(s1 - h1))}</span>`}`; };
      const wire = () => { m.querySelectorAll("[data-b],[data-k]").forEach((x) => (x.oninput = x.onchange = bal)); m.querySelectorAll("[data-rml]").forEach((x) => (x.onclick = () => { const side = x.closest("[data-side]"); if (side.querySelectorAll("[data-line]").length > 1) x.closest("[data-line]").remove(); bal(); })); };
      m.querySelectorAll("[data-addl]").forEach((b) => (b.onclick = () => { const side = m.querySelector(`[data-side="${b.dataset.addl}"]`); side.insertAdjacentHTML("beforeend", line(b.dataset.addl, side.children.length)); wire(); }));
      wire(); bal();
      m.querySelector("[data-ok]").onclick = () => {
        const S = lines("S"), H = lines("H");
        if (!S.length || !H.length || [...S, ...H].some((x) => !x.konto || !(x.betrag > 0))) return toast("Buchungssatz unvollständig", "Je Zeile Konto und Betrag angeben (mindestens ein Soll- und ein Habenkonto).", "error");
        if (Math.abs(sumOf(S) - sumOf(H)) > 0.005) return toast("Soll und Haben nicht ausgeglichen", `Differenz ${eur(Math.abs(sumOf(S) - sumOf(H)))}`, "error");
        close({ soll: S, haben: H, datum: m.querySelector("[data-d]").value.trim(), beleg: m.querySelector("[data-bel]").value, text: m.querySelector("[data-t]").value.trim() });
      };
    } });
  if (!v) return;
  const n = erpOf(w, "buchung").length + 1;
  const rec = await addItemW(w, "erp", "erp", { type: "buchung", own: true, nr: "BS-" + String(n).padStart(4, "0"), ...v, konten: Object.fromEntries([...v.soll, ...v.haben].map((x) => [x.konto, ks.find((k) => k.data.nr === x.konto)?.data.name || ""])) });
  w.tab = "buchungen"; toast("Buchungssatz erfasst", `${rec.data.nr} · ${eur(sumOf(v.soll))}`); redraw(w);
  await markDialog(rec, "ERP-Beleg", w.defSt);
}
function erpShow(w, b) {
  if (!b) return;
  modal({ title: `Bestellung ${esc(b.data.nr)}`, body: `<p><b>Lieferant:</b> ${esc(supplierName(w, b.data.lieferant))}<br><b>Datum:</b> ${esc(b.data.datum)}${b.data.termin ? `<br><b>Liefertermin:</b> ${esc(b.data.termin)}` : ""}<br><b>Status:</b> ${esc(b.data.status)}</p>
    <table class="tbl compact"><thead><tr><th>Artikel</th><th class="num">Menge</th><th class="num">Einzelpreis</th><th class="num">Gesamt</th></tr></thead><tbody>${(b.data.pos || []).map((p) => `<tr><td>${esc(p.name || articleOf(w, p.artikel)?.data.name || p.artikel)}</td><td class="num">${p.menge}</td><td class="num">${eur(p.preis)}</td><td class="num">${eur(p.menge * p.preis)}</td></tr>`).join("")}<tr><td colspan="3"><b>Summe</b></td><td class="num"><b>${eur(erpSum(b))}</b></td></tr></tbody></table>`,
    footer: `${b.data.own ? `<button class="btn" data-value="mark">${icon("circle-check")} ${b.submission ? "Markierung ändern" : "Als Abgabe markieren"}</button>` : ""}<button class="btn primary" data-close>Schließen</button>` }).then((r) => { if (r === "mark") markDialog(b, "ERP-Beleg", w.defSt); });
}

// Erstellungsprozess einer Prüfung (Instanz OPE) – Tasks 2–6, 8, 12, 14–18, 46, 47
//  Status: Vorbereitung (Aufgabenerstellung) → Kommission/Review → Lektorat und Prüflösen → Review → final freigegeben (gesperrt bis
//  Prüfungsstart) → veröffentlicht. Die Koordinierungsstelle legt die Prüfung an, setzt die Rahmendaten und weist die Personen zu;
//  danach erledigen Aufgabenerstellung, Kommission, Kommissionsvorsitz, Beratung, Lektorat und Prüflösung ihre Aufgaben.
import { D, byId, upd, create } from "../data.js?v=8.8";
import { icon, esc, toast, confirmBox, modal, store, fmtDateTime, parseDate } from "../ui.js?v=8.8";
import { navigate, redraw, session } from "../app.js?v=8.8";
import { me, personName, orgShort, orgsLabel } from "../access.js?v=8.8";
import { blankContent, validate as validateContent } from "./editor.js?v=8.8";
import { normalizeContent } from "../scenario.js?v=8.8";

// ---------- Modell ----------
export const ESTATUS = {
  vorbereitung: { label: "Vorbereitung", long: "Vorbereitung – Aufgabenerstellung", color: "gray", nr: 1 },
  review: { label: "Kommission / Review", long: "Kommission / Review", color: "cyan", nr: 2 },
  lektorat: { label: "Lektorat und Prüflösen", long: "Lektorat und Prüflösen", color: "purple", nr: 3 },
  gesperrt: { label: "Gesperrt", long: "Final freigegeben – gesperrt bis zum Prüfungsstart", color: "yellowb", nr: 4 },
  veroeffentlicht: { label: "Veröffentlicht", long: "Veröffentlicht (zum Prüfungstermin)", color: "green", nr: 5 },
};
export const EROLES = {
  aufgabenerstellung: { label: "Aufgabenerstellung", req: true, hint: "erstellt die Aufgaben im Editor (Task 46)" },
  kommission: { label: "Kommission", req: true, hint: "arbeitet Aufgabenentwürfe ein, legt den Unternehmenspool fest (Tasks 14, 15)" },
  vorsitz: { label: "Kommissionsvorsitz", req: true, single: true, hint: "gibt die Prüfung final frei (Task 12)" },
  beratung: { label: "Beratung", hint: "sieht die Aufgabenentwürfe ein (Task 16)" },
  lektorat: { label: "Lektorat", hint: "lektoriert die Prüfung (Task 17)" },
  pruefloesung: { label: "Prüflösung", hint: "löst die Prüfung im Teilnahmemodus (Task 18)" },
};
const ROLE_ICON = { koordination: "building-2", aufgabenerstellung: "pencil", kommission: "users", vorsitz: "user", beratung: "eye", lektorat: "file-text", pruefloesung: "circle-check" };
export const META = [
  ["titel", "Prüfungstitel", "text", true], ["art", "Prüfungsart", "select:Abschlussprüfung Teil 1|Abschlussprüfung Teil 2|Zwischenprüfung|Musterprüfung", true],
  ["beruf", "Ausbildungsberuf", "text", true], ["bereich", "Prüfungsbereich / Fach", "text", true], ["code", "Prüfungskennung", "text", true],
  ["termin", "Prüfungstermin (Start Prüfungszeitraum)", "datetime-local", true], ["dauer", "Bearbeitungszeit (Minuten)", "number", true],
  ["erstellung_von", "Start Erstellungszeitraum", "date", true], ["erstellung_bis", "Ende Erstellungszeitraum", "date", true],
  ["kommission_bis", "Ende Kommissionszeitraum", "date", true], ["lektorat_bis", "Ende Lektorat", "date", false], ["pruefloesung_bis", "Ende Prüflösung", "date", false],
  ["hilfsmittel", "Zugelassene Hilfsmittel", "text", false], ["hinweise", "Hinweise für den Erstellungsprozess", "textarea", false],
];
// Unternehmenspool (Task 14): Unternehmen, auf das sich die Ausgangssituation bezieht
export const POOL = [
  { id: "funsport", name: "FunSport Innovations GmbH", branche: "Sportartikel / E-Mobilität", allgemein: "Die FunSport Innovations GmbH entwickelt und vertreibt Funsport-Produkte, u. a. das E-Skateboard „Speedster“. 35 Beschäftigte.", adresse: "FunSport Innovations GmbH\nSportparkallee 12\n70173 Stuttgart", kontakt: "Telefon 0711 123456-0\ninfo@funsport-innovations.de", rechtliches: "GmbH · Amtsgericht Stuttgart HRB 765432" },
  { id: "muster", name: "Muster Handels GmbH", branche: "Großhandel Bürobedarf", allgemein: "Die Muster Handels GmbH beliefert Unternehmen und Behörden in Baden-Württemberg mit Büro- und Schulbedarf. 120 Beschäftigte, eigener Onlineshop.", adresse: "Muster Handels GmbH\nLindenring 4\n68159 Mannheim", kontakt: "Telefon 0621 445500\nservice@muster-handels.example", rechtliches: "GmbH · Amtsgericht Mannheim HRB 112233" },
  { id: "nordwerk", name: "NordWerk Maschinenbau AG", branche: "Maschinen- und Anlagenbau", allgemein: "Die NordWerk Maschinenbau AG fertigt Verpackungsmaschinen für die Lebensmittelindustrie. 480 Beschäftigte an zwei Standorten.", adresse: "NordWerk Maschinenbau AG\nIndustriestraße 20\n89077 Ulm", kontakt: "Telefon 0731 90880\ninfo@nordwerk.example", rechtliches: "AG · Amtsgericht Ulm HRB 445566" },
];

export const inProcess = (cat) => !!cat?.status;
export const isKS = (p = me()) => p?.kind === "koordination";
export const team = (cat) => ({ aufgabenerstellung: [], kommission: [], vorsitz: [], beratung: [], lektorat: [], pruefloesung: [], ...(cat?.team || {}) });
export function rolesOf(cat, p = me()) {
  if (!p || !cat) return [];
  const t = team(cat); const r = Object.keys(EROLES).filter((k) => (t[k] || []).includes(p.id));
  return isKS(p) ? ["koordination", ...r] : r;
}
export const canEditContent = (cat, p = me()) => { const r = rolesOf(cat, p); return (cat.status === "vorbereitung" && r.includes("aufgabenerstellung")) || (cat.status === "review" && (r.includes("kommission") || r.includes("vorsitz"))); };
export const metaMissing = (cat) => META.filter(([k, , , req]) => req && !String(cat?.meta?.[k] ?? "").trim()).map(([, l]) => l);
export const teamMissing = (cat) => Object.entries(EROLES).filter(([k, d]) => d.req && !(team(cat)[k] || []).length).map(([, d]) => d.label);
const optionalAssigned = (cat) => ["lektorat", "pruefloesung"].filter((k) => (team(cat)[k] || []).length);
const hist = (cat) => cat.history || [];
export const hasEvent = (cat, ev) => hist(cat).some((h) => h.ev === ev);
const openFeedback = (cat) => (cat.feedback || []).filter((f) => !f.resolved && f.kind !== "pruefloesung-ergebnis");
const roleName = (k) => (k === "koordination" ? "Koordinierungsstelle" : EROLES[k]?.label || k);
const myName = () => (me() ? personName(me()) : "Koordinierungsstelle");
const fmtD = (v) => { const d = parseDate(v) || (v ? new Date(v) : null); return d && !isNaN(d) ? (String(v).length <= 10 ? d.toLocaleDateString("de-DE") : fmtDateTime(d)) : "–"; };
const entry = (ev, text, extra = {}) => ({ at: new Date().toISOString(), by: myName(), ev, text, ...extra });

async function setStatus(cat, to, ev, text, patch = {}) {
  const from = cat.status;
  await upd("catalog", cat.id, { status: to, history: [...hist(cat), entry(ev, text, { from, to })], ...patch });
  toast(`Status: ${ESTATUS[to].label}`, text);
}
const log = (cat, ev, text, patch = {}) => upd("catalog", cat.id, { history: [...hist(cat), entry(ev, text)], ...patch });

// ---------- Prüfung anlegen (Koordinierungsstelle) ----------
export async function newExamDialog() {
  const v = await modal({ title: "Neue Prüfung anlegen", size: "narrow",
    body: `<p class="small">Die Prüfung wird im Status <b>Vorbereitung</b> angelegt. Anschließend legen Sie die Rahmendaten fest und weisen die Personen im Erstellungsprozess zu.</p>
      <div class="field"><label class="lbl" for="ne-t">Prüfungstitel</label><input id="ne-t" class="input" data-f="titel" placeholder="z. B. AP Teil 1 Kaufleute für Büromanagement Frühjahr 2027"></div>
      <div class="field"><label class="lbl" for="ne-b">Ausbildungsberuf</label><input id="ne-b" class="input" data-f="beruf" value="Kaufmann/-frau für Büromanagement"></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("plus")} Prüfung anlegen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value.trim())); if (!o.titel) { m.querySelector("[data-f=titel]").style.borderColor = "var(--red)"; return; } close(o); }) });
  if (!v) return;
  const p = me();
  const rec = await create("catalog", { title: v.titel, kind: "Prüfung", beruf: v.beruf, fach: "", jahr: String(new Date().getFullYear() + 1), description: "", duration: "90 Minuten", creator: "Koordinierungsstelle (IBBW)", tags: ["Prüfungen", "Erstellungsprozess"], contents: [], mine: false, copied_from: "", image: Math.floor(Math.random() * 4),
    content: blankContent(v.titel, 90), rules: [], editor_by: "prozess", status: "vorbereitung", meta: { titel: v.titel, beruf: v.beruf, art: "Abschlussprüfung Teil 1", dauer: 90 }, team: { koordination: p ? [p.id] : [] }, history: [{ at: new Date().toISOString(), by: myName(), ev: "angelegt", text: "Neue Prüfung angelegt (Status Vorbereitung)", to: "vorbereitung" }], feedback: [], reviews: {} });
  for (let i = 0; i < 40 && !byId("catalog", rec.id); i++) await new Promise((r) => setTimeout(r, 50));
  toast("Prüfung angelegt", v.titel); navigate(`#/app/erstellung/${rec.id}/rahmendaten`);
}

// ---------- Übersicht ----------
export function list() {
  return {
    shell: "staff", rail: "erstellung", title: "Prüfungserstellung",
    render() {
      const p = me();
      const all = D.catalog.filter(inProcess).filter((c) => isKS(p) || rolesOf(c, p).length).sort((a, b) => String(b.created).localeCompare(String(a.created)));
      return `<div class="pagehead"><div><h1>Prüfungserstellung</h1><div class="sub">${esc(myName())}${isKS(p) ? " · Koordinierungsstelle" : " · Prüfungen, an deren Erstellung Sie beteiligt sind"}</div></div>
        ${isKS(p) ? `<div class="actions-bar"><button class="btn primary" data-newexam>${icon("plus")} Neue Prüfung anlegen</button></div>` : ""}</div>
      <div class="notice info small mb">${icon("info")}<span>Ablauf: <b>Vorbereitung</b> (Rahmendaten, Personen, Aufgabenerstellung) → <b>Kommission/Review</b> → <b>Lektorat und Prüflösen</b> (optional) → Review → <b>final freigegeben</b> (gesperrt bis zum Prüfungsstart) → <b>veröffentlicht</b>.</span></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Prüfung</th><th>Status</th><th>Ihre Rollen</th><th>Prüfungstermin</th><th>Offene Aufgabe</th></tr></thead><tbody>${all.length ? all.map((c) => { const t = myTasks(c, p).find((x) => !x.done); return `<tr class="rowlink" data-href="#/app/erstellung/${c.id}/uebersicht" tabindex="0"><td><b>${esc(c.title)}</b><div class="xs muted">${esc(c.meta?.code || "")} ${esc(c.meta?.art || "")}</div></td><td>${statusBadge(c)}</td><td class="small">${rolesOf(c, p).map(roleName).join(", ") || "–"}</td><td class="small">${fmtD(c.meta?.termin)}</td><td class="small">${t ? `<b>${esc(t.title)}</b>${t.due ? `<div class="xs muted">fällig ${esc(t.due)}</div>` : ""}` : `<span class="muted">keine</span>`}</td></tr>`; }).join("")
        : `<tr><td colspan="5"><div class="empty small">${isKS(p) ? "Noch keine Prüfung im Erstellungsprozess. Legen Sie eine neue Prüfung an." : "Sie sind derzeit keiner Prüfung im Erstellungsprozess zugewiesen."}</div></td></tr>`}</tbody></table></div>`;
    },
    mount(el) { const b = el.querySelector("[data-newexam]"); if (b) b.onclick = () => newExamDialog(); },
  };
}
export const statusBadge = (c) => `<span class="badge ${ESTATUS[c.status]?.color || "gray"}">${esc(ESTATUS[c.status]?.label || c.status)}</span>`;

// ---------- Aufgaben je Rolle ----------
// liefert die Aufgaben der Person in der Prüfung (Task-Nummern nach Workflow OPE), jeweils mit Erledigt-Status und Aktionen
export function myTasks(c, p = me()) {
  const r = rolesOf(c, p); const s = c.status; const out = [];
  const add = (t, title, done, acts = [], due = "") => out.push({ t, title, done, acts, due });
  const rv = c.reviews || {};
  if (r.includes("koordination")) {
    add(2, "Prüfungsmetadaten (Rahmendaten) setzen", !metaMissing(c).length, [["go", "rahmendaten", "Rahmendaten öffnen"]], fmtD(c.meta?.erstellung_von));
    add(4, "Personen im Erstellungsprozess zuweisen", !teamMissing(c).length, [["go", "personen", "Personen zuweisen"]], fmtD(c.meta?.erstellung_von));
    if (s === "gesperrt") { add(8, "Prüfungsfreigabe aufheben (bei Bedarf)", false, [["unlock", "", "Freigabe aufheben"]]); add(47, "Zum Prüfungstermin veröffentlichen und Schulen zuordnen", false, [["publish", "", "Veröffentlichen"]], fmtD(c.meta?.termin)); }
    if (s !== "vorbereitung") add(6, "Erstellungsprozess einsehen", true, [["go", "verlauf", "Verlauf öffnen"]]);
  }
  if (r.includes("kommission") || r.includes("vorsitz")) {
    add(14, "Unternehmenspool festlegen", !!c.meta?.pool, ["vorbereitung", "review"].includes(s) ? [["go", "unternehmen", "Unternehmenspool"]] : [], fmtD(c.meta?.erstellung_bis));
    if (s === "review") {
      const opt = optionalAssigned(c); const fb = openFeedback(c).length;
      add(15, "Aufgabenentwürfe einarbeiten und weiterreichen", false, [["editor", "", "Im Editor einarbeiten"], ["preview", "", "Vorschau"], ...(fb ? [["go", "anmerkungen", `Anmerkungen (${fb} offen)`]] : []), ...(opt.length && !hasEvent(c, "lektorat-ende") ? [["tolektorat", "", "An Lektorat und Prüflösung übergeben"]] : []), ["back", "", "Zurück an die Aufgabenerstellung"]], fmtD(c.meta?.kommission_bis));
    }
  }
  if (r.includes("vorsitz") && s === "review") add(12, "Prüfung final freigeben", false, [["release", "", "Final freigeben (sperren)"]], fmtD(c.meta?.kommission_bis));
  if (r.includes("aufgabenerstellung")) add(46, "Aufgaben erstellen", s !== "vorbereitung", s === "vorbereitung" ? [["editor", "", "Aufgaben im Editor erstellen"], ["preview", "", "Vorschau"], ["toreview", "", "An die Kommission übergeben"]] : [], fmtD(c.meta?.erstellung_bis));
  if (r.includes("beratung")) add(16, "Aufgabenentwürfe einsehen", hasEvent(c, "beratung-eingesehen"), ["vorbereitung", "review"].includes(s) ? [["consult", "", "Aufgabenentwürfe einsehen"], ["go", "anmerkungen", "Hinweis an die Kommission"]] : []);
  if (r.includes("lektorat")) add(17, "Prüfung lektorieren", !!rv.lektorat?.done || (s !== "lektorat" && hasEvent(c, "lektorat-abgeschlossen")), s === "lektorat" && !rv.lektorat?.done ? [["preview", "", "Prüfung ansehen"], ["go", "anmerkungen", "Anmerkungen erfassen"], ["donelek", "", "Lektorat abschließen"]] : [], fmtD(c.meta?.lektorat_bis));
  if (r.includes("pruefloesung")) add(18, "Prüfung prüflösen", !!rv.pruefloesung?.done || (s !== "lektorat" && hasEvent(c, "pruefloesung-abgeschlossen")), s === "lektorat" && !rv.pruefloesung?.done ? [["preview", "", "Im Teilnahmemodus lösen"], ["go", "anmerkungen", "Ergebnis erfassen"], ["donepl", "", "Prüflösung abschließen"]] : [], fmtD(c.meta?.pruefloesung_bis));
  return out;
}

// ---------- Detailseite ----------
const TABS = [["uebersicht", "Übersicht"], ["rahmendaten", "Rahmendaten"], ["personen", "Personen"], ["unternehmen", "Unternehmenspool"], ["anmerkungen", "Anmerkungen"], ["verlauf", "Verlauf"]];
export function detail(id, tab = "uebersicht") {
  const c0 = byId("catalog", id);
  if (!c0 || !inProcess(c0)) return { redirect: "#/app/erstellung" };
  if (!isKS() && !rolesOf(c0).length) return { shell: "staff", rail: "erstellung", title: "Kein Zugriff", render: () => `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Sie sind dieser Prüfung im Erstellungsprozess nicht zugewiesen.</p><a class="btn" href="#/app/erstellung">Zur Übersicht</a></div>` };
  if (!TABS.some(([k]) => k === tab)) tab = "uebersicht";
  return {
    shell: "staff", rail: "erstellung", title: c0.title,
    render() {
      const c = byId("catalog", id); const r = rolesOf(c);
      const cont = normalizeContent(JSON.parse(JSON.stringify(c.content || { tasks: [] })));
      const pts = cont.tasks.reduce((a, t) => a + t.points, 0); const subs = cont.tasks.reduce((a, t) => a + t.subtasks.length, 0);
      const order = ["vorbereitung", "review", "lektorat", "gesperrt", "veroeffentlicht"];
      return `<div class="breadcrumb"><a href="#/app/erstellung">Prüfungserstellung</a>${icon("chevron-right")}<b>${esc(c.title)}</b></div>
      <div class="pagehead"><div><h1>${esc(c.title)}</h1><div class="row mt-s small wrap">${statusBadge(c)}<span>${esc(c.meta?.code || "")} · Prüfungstermin <b>${fmtD(c.meta?.termin)}</b> · ${cont.tasks.length} Aufgaben, ${subs} Teilaufgaben, ${pts} Punkte</span><span class="badge gray">Ihre Rollen: ${r.map(roleName).join(", ") || "–"}</span></div></div>
        <div class="actions-bar">${(r.length || isKS()) ? `<button class="btn" data-act="preview">${icon("eye")} Vorschau</button>` : ""}${canEditContent(c) ? `<button class="btn primary" data-act="editor">${icon("pencil")} Im Editor bearbeiten</button>` : ""}</div></div>
      <ol class="estepper">${order.map((k, i) => { const cur = order.indexOf(c.status); return `<li class="${i < cur ? "done" : i === cur ? "cur" : ""}"><span class="dot">${i < cur ? icon("check") : i + 1}</span><span>${ESTATUS[k].label}</span></li>`; }).join("")}</ol>
      <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/app/erstellung/${id}/${k}" class="${k === tab ? "active" : ""}">${l}${k === "anmerkungen" && openFeedback(c).length ? ` <span class="badge yellowb">${openFeedback(c).length}</span>` : ""}</a>`).join("")}</nav>
      ${{ uebersicht: tabOverview, rahmendaten: tabMeta, personen: tabTeam, unternehmen: tabPool, anmerkungen: tabFeedback, verlauf: tabHistory }[tab](c, r, cont)}`;
    },
    mount(el) { if (tab === "verlauf") store.lset("erstVerlauf." + id, true); bindDetail(el, id, tab); },
  };
}
function tabOverview(c, r, cont) {
  const tasks = myTasks(c);
  const t = team(c);
  const issues = validateContent({ cat: { title: c.title }, content: cont, rules: c.rules || [] }).filter((x) => x.lvl === "error").length;
  return `<div class="edgrid2"><section class="card pad"><h3>${icon("list-checks")} Ihre Aufgaben</h3>
    ${tasks.length ? tasks.map((x) => `<div class="etask ${x.done ? "done" : ""}"><div class="row between"><b>${x.done ? icon("circle-check") : icon("circle")} Task ${x.t}: ${esc(x.title)}</b>${x.due && x.due !== "–" ? `<span class="xs muted">fällig ${esc(x.due)}</span>` : ""}</div>
      ${x.acts.length ? `<div class="row wrap mt-s" style="gap:6px">${x.acts.map(([a, arg, l]) => `<button class="btn sm ${["toreview", "tolektorat", "release", "donelek", "donepl", "publish"].includes(a) ? "primary" : ""}" data-act="${a}" data-arg="${arg}">${esc(l)}</button>`).join("")}</div>` : ""}</div>`).join("") : `<p class="small muted">In diesem Status haben Sie keine Aufgaben.</p>`}
    ${c.status === "lektorat" ? `<div class="notice info small mt">${icon("clock")}<span>Warten auf Abschluss von ${["lektorat", "pruefloesung"].filter((k) => t[k].length && !(c.reviews || {})[k]?.done).map((k) => EROLES[k].label).join(" und ") || "–"}. Danach geht die Prüfung automatisch zurück an die Kommission.</span></div>` : ""}
    ${c.status === "gesperrt" ? `<div class="notice warn small mt">${icon("lock")}<span>Die Prüfung ist final freigegeben und bis zum Prüfungsstart (${fmtD(c.meta?.termin)}) <b>gesperrt</b>. Inhalte können nicht mehr bearbeitet werden; nur die Koordinierungsstelle kann die Freigabe aufheben.</span></div>` : ""}</section>
  <section class="card pad"><h3>${icon("users")} Stand des Erstellungsprozesses</h3>
    ${Object.entries(EROLES).map(([k, d]) => { const ps = t[k] || []; const done = { aufgabenerstellung: hasEvent(c, "review-start"), beratung: hasEvent(c, "beratung-eingesehen"), lektorat: hasEvent(c, "lektorat-abgeschlossen"), pruefloesung: hasEvent(c, "pruefloesung-abgeschlossen"), vorsitz: ["gesperrt", "veroeffentlicht"].includes(c.status), kommission: hasEvent(c, "lektorat-start") || ["gesperrt", "veroeffentlicht"].includes(c.status) }[k];
      return `<div class="kv">${icon(ROLE_ICON[k])}<div class="grow"><div class="small">${d.label}${d.req ? "" : " (optional)"}</div><span class="v">${ps.length ? ps.map((id) => esc(personName(byId("persons", id)))).join(", ") : `<span class="muted">nicht zugewiesen</span>`}</span></div>${ps.length ? (done ? `<span class="badge green">${icon("check")} erledigt</span>` : `<span class="badge gray">offen</span>`) : ""}</div>`; }).join("")}
    <div class="kv">${icon("file-text")}<div><div class="small">Inhalt</div><span class="v">${cont.tasks.length} Aufgaben · ${cont.tasks.reduce((a, x) => a + x.subtasks.length, 0)} Teilaufgaben${issues ? ` · <span class="badge red">${issues} offene Fehler im Editor</span>` : ""}</span></div></div>
    <div class="kv">${icon("building-2")}<div><div class="small">Unternehmen</div><span class="v">${esc(POOL.find((x) => x.id === c.meta?.pool)?.name || "noch nicht festgelegt")}</span></div></div>
    <div class="kv">${icon("message-square-warning")}<div><div class="small">Anmerkungen</div><span class="v">${(c.feedback || []).filter((f) => f.kind !== "pruefloesung-ergebnis").length} gesamt · ${openFeedback(c).length} offen</span></div></div></section></div>`;
}
const metaField = (c, [k, l, type, req], ro) => {
  const v = c.meta?.[k] ?? ""; const dis = ro ? "disabled" : "";
  if (type.startsWith("select:")) return `<div class="field"><label class="lbl">${l}${req ? " *" : ""}</label><select class="select" data-meta="${k}" ${dis}>${type.slice(7).split("|").map((o) => `<option ${o === v ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  if (type === "textarea") return `<div class="field" style="grid-column:1/-1"><label class="lbl">${l}</label><textarea class="input" rows="3" data-meta="${k}" ${dis}>${esc(v)}</textarea></div>`;
  return `<div class="field"><label class="lbl">${l}${req ? " *" : ""}</label><input class="input" type="${type}" data-meta="${k}" value="${esc(v)}" ${dis}></div>`;
};
function tabMeta(c, r) {
  const ro = !r.includes("koordination") || ["gesperrt", "veroeffentlicht"].includes(c.status); const miss = metaMissing(c);
  return `<section class="card pad" style="max-width:980px"><div class="row between"><h3>Rahmendaten (Prüfungsmetadaten, Task 2/3)</h3>${miss.length ? `<span class="badge yellowb">${miss.length} Pflichtfelder offen</span>` : `<span class="badge green">${icon("check")} vollständig</span>`}</div>
    ${ro ? `<p class="xs muted">Die Rahmendaten pflegt die Koordinierungsstelle${["gesperrt", "veroeffentlicht"].includes(c.status) ? "; nach der finalen Freigabe sind sie schreibgeschützt" : ""}.</p>` : `<p class="xs muted">Pflichtfelder (*) müssen vor der Übergabe an die Kommission befüllt sein. Fristen erscheinen als Fälligkeit bei den beteiligten Rollen.</p>`}
    <div class="metagrid">${META.map((m) => metaField(c, m, ro)).join("")}</div>
    ${ro ? "" : `<div class="row end mt"><button class="btn primary" data-act="savemeta">${icon("save")} Rahmendaten speichern</button></div>`}</section>`;
}
function tabTeam(c, r) {
  const ro = !r.includes("koordination") || ["gesperrt", "veroeffentlicht"].includes(c.status); const t = team(c);
  return `<div class="notice info small mb">${icon("info")}<span>Pflichtrollen: <b>Aufgabenerstellung</b>, <b>Kommission</b> und <b>Kommissionsvorsitz</b>. Beratung, Lektorat und Prüflösung sind optional. Personen können mehrere Rollen haben; der Kommissionsvorsitz ist eine Person.</span></div>
    <div class="edgrid2">${Object.entries(EROLES).map(([k, d]) => `<section class="card pad"><div class="row between"><h3>${icon(ROLE_ICON[k])} ${d.label} ${d.req ? `<span class="badge ${t[k].length ? "green" : "yellowb"}">Pflicht</span>` : `<span class="badge gray">optional</span>`}</h3>${ro ? "" : `<button class="btn sm" data-addrole="${k}">${icon("user-round-plus")} Person zuweisen</button>`}</div><p class="xs muted">${esc(d.hint)}</p>
      ${t[k].length ? `<ul class="plist">${t[k].map((pid) => { const pe = byId("persons", pid); return `<li>${icon("user")} <span class="grow">${esc(personName(pe))} <span class="xs muted">${esc(pe?.org ? orgsLabel(pe) : "IBBW")}</span></span>${ro ? "" : `<button class="iconbtn" data-rmrole="${k}" data-pid="${pid}" aria-label="Zuweisung entfernen">${icon("x")}</button>`}</li>`; }).join("")}</ul>` : `<p class="small muted">Niemand zugewiesen.</p>`}</section>`).join("")}</div>`;
}
function tabPool(c, r) {
  const can = (r.includes("kommission") || r.includes("vorsitz") || r.includes("koordination")) && ["vorbereitung", "review"].includes(c.status);
  return `<p class="small">Die Kommission legt das Unternehmen fest, auf das sich die Ausgangssituation der Prüfung bezieht (Task 14). Das Unternehmensprofil wird in den Inhalt übernommen und kann im Editor angepasst werden.</p>
    <div class="poolgrid">${POOL.map((u) => `<label class="optcard ${c.meta?.pool === u.id ? "on" : ""}"><input type="radio" name="pool" data-pool="${u.id}" ${c.meta?.pool === u.id ? "checked" : ""} ${can ? "" : "disabled"}><span><b>${esc(u.name)}</b><span class="xs muted">${esc(u.branche)}</span><span class="small">${esc(u.allgemein)}</span><span class="xs muted" style="white-space:pre-line">${esc(u.adresse)}</span></span></label>`).join("")}</div>
    ${can ? "" : `<p class="xs muted mt-s">Festlegen können Kommission und Kommissionsvorsitz in Vorbereitung und Review.</p>`}`;
}
function tabFeedback(c, r, cont) {
  const s = c.status; const subs = cont.tasks.flatMap((t) => t.subtasks);
  const canLek = r.includes("lektorat") && s === "lektorat" && !c.reviews?.lektorat?.done;
  const canPl = r.includes("pruefloesung") && s === "lektorat" && !c.reviews?.pruefloesung?.done;
  const canBer = r.includes("beratung") && ["vorbereitung", "review"].includes(s);
  const canResolve = (r.includes("kommission") || r.includes("vorsitz")) && s === "review";
  const kind = canLek ? "lektorat" : canPl ? "pruefloesung" : canBer ? "beratung" : "";
  const fb = c.feedback || [];
  const res = fb.find((f) => f.kind === "pruefloesung-ergebnis");
  return `${kind ? `<section class="card pad mb"><h3>${kind === "lektorat" ? "Anmerkung des Lektorats erfassen" : kind === "pruefloesung" ? "Anmerkung aus der Prüflösung erfassen" : "Hinweis an die Kommission"}</h3>
      <div class="row wrap" style="gap:10px;align-items:flex-end"><div class="field" style="margin:0;min-width:220px"><label class="lbl">Bezug</label><select class="select" data-fbst><option value="">gesamte Prüfung</option>${subs.map((x) => `<option value="${x.no}">Teilaufgabe ${x.no} ${esc(x.title)}</option>`).join("")}</select></div>
      <div class="field grow" style="margin:0"><label class="lbl">Anmerkung</label><textarea class="input" rows="2" data-fbtext placeholder="${kind === "lektorat" ? "z. B. Formulierung im Arbeitsauftrag missverständlich, Rechtschreibung …" : kind === "pruefloesung" ? "z. B. Angabe fehlt, Zeitbedarf zu hoch, Lösung nicht eindeutig …" : "Hinweis zu den Aufgabenentwürfen …"}"></textarea></div><button class="btn primary" data-act="addfb" data-arg="${kind}">${icon("plus")} Hinzufügen</button></div></section>` : ""}
    ${canPl ? `<section class="card pad mb"><h3>Ergebnis der Prüflösung</h3><p class="xs muted">Lösen Sie die Prüfung im Teilnahmemodus („Im Teilnahmemodus lösen“) und halten Sie Ihr Ergebnis fest.</p>
      <div class="row wrap" style="gap:12px;align-items:flex-end"><div class="field" style="margin:0"><label class="lbl">Benötigte Bearbeitungszeit (Minuten)</label><input class="input" type="number" min="1" data-plmin value="${esc(res?.minutes || "")}" style="width:140px"></div>
      <div class="field" style="margin:0"><label class="lbl">Gesamteinschätzung</label><select class="select" data-plgrade>${["lösbar in der vorgesehenen Zeit", "lösbar, Zeit knapp", "nur mit Anpassungen lösbar"].map((o) => `<option ${res?.text === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      <button class="btn" data-act="plresult">${icon("save")} Ergebnis speichern</button></div></section>` : ""}
    ${res ? `<div class="notice ${/Anpassungen/.test(res.text) ? "warn" : "success"} small mb">${icon("circle-check")}<span><b>Prüflösung (${esc(res.by)}):</b> ${esc(res.text)} · benötigte Zeit ${esc(res.minutes)} Min. (vorgesehen ${esc(c.meta?.dauer || "–")} Min.)</span></div>` : ""}
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Von</th><th>Bezug</th><th>Anmerkung</th><th>Status</th></tr></thead><tbody>${fb.filter((f) => f.kind !== "pruefloesung-ergebnis").length ? fb.filter((f) => f.kind !== "pruefloesung-ergebnis").map((f) => `<tr><td class="small"><b>${esc({ lektorat: "Lektorat", pruefloesung: "Prüflösung", beratung: "Beratung" }[f.kind] || f.kind)}</b><div class="xs muted">${esc(f.by)} · ${fmtDateTime(new Date(f.at))}</div></td><td class="small">${f.st ? `Teilaufgabe ${esc(f.st)}` : "gesamte Prüfung"}</td><td>${esc(f.text)}</td>
      <td>${f.resolved ? `<span class="badge green">${icon("check")} eingearbeitet</span><div class="xs muted">${esc(f.resolved_by || "")}</div>` : canResolve ? `<button class="btn xs" data-resolve="${f.id}">${icon("check")} Als eingearbeitet markieren</button>` : `<span class="badge yellowb">offen</span>`}</td></tr>`).join("") : `<tr><td colspan="4"><div class="empty small">Noch keine Anmerkungen.</div></td></tr>`}</tbody></table></div>`;
}
function tabHistory(c) {
  return `<p class="small">Erstellungsprozess einsehen (Task 6): alle Statuswechsel und Abschlüsse mit Zeitpunkt und Person.</p><ol class="timeline">${[...hist(c)].reverse().map((h) => `<li><span class="xs muted">${fmtDateTime(new Date(h.at))}</span><div><b>${esc(h.text)}</b>${h.from ? ` <span class="xs muted">(${esc(ESTATUS[h.from]?.label || h.from)} → ${esc(ESTATUS[h.to]?.label || h.to)})</span>` : ""}<div class="xs muted">${esc(h.by)}</div></div></li>`).join("")}</ol>`;
}

// ---------- Aktionen ----------
async function pickPerson(c, role) {
  const t = team(c); const have = new Set(t[role]);
  const cand = D.persons.filter((p) => ["lehrkraft", "fachexperte", "koordination"].includes(p.kind) && !have.has(p.id)).sort((a, b) => a.lastname.localeCompare(b.lastname));
  const v = await modal({ title: `${EROLES[role].label}: Person zuweisen`, size: "wide",
    body: `<div class="search mb"><input class="input" data-s placeholder="Name suchen" aria-label="Person suchen">${icon("search")}</div><div class="tablewrap" style="max-height:380px;overflow:auto"><table class="tbl compact"><thead><tr><th></th><th>Name</th><th>Organisation</th><th>Weitere Rollen in dieser Prüfung</th></tr></thead><tbody>${cand.map((p) => `<tr data-row="${esc((p.lastname + " " + p.firstname).toLowerCase())}"><td><input type="${EROLES[role].single ? "radio" : "checkbox"}" name="pp" data-i="${p.id}" aria-label="${esc(personName(p))}"></td><td>${esc(personName(p))}</td><td>${esc(p.org ? orgsLabel(p) : "IBBW")}</td><td class="xs muted">${Object.keys(EROLES).filter((k) => t[k].includes(p.id)).map((k) => EROLES[k].label).join(", ")}</td></tr>`).join("")}</tbody></table></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Zuweisen</button>`,
    onMount: (m, close) => { const s = m.querySelector("[data-s]"); s.oninput = () => m.querySelectorAll("[data-row]").forEach((tr) => (tr.hidden = !tr.dataset.row.includes(s.value.toLowerCase()))); m.querySelector("[data-ok]").onclick = () => close([...m.querySelectorAll("[data-i]:checked")].map((x) => x.dataset.i)); } });
  if (!v || !v.length) return;
  const nt = { ...t, [role]: EROLES[role].single ? v.slice(0, 1) : [...t[role], ...v] };
  await upd("catalog", c.id, { team: nt, history: [...hist(c), entry("team", `${EROLES[role].label}: ${v.map((id) => personName(byId("persons", id))).join(", ")} zugewiesen`)] });
  toast("Person zugewiesen", EROLES[role].label);
}
async function publishDialog(c) {
  const orgs = D.orgs;
  const v = await modal({ title: "Prüfung zum Prüfungstermin veröffentlichen", size: "narrow",
    body: `<p class="small">Die Prüfung wird zum Prüfungstermin (${fmtD(c.meta?.termin)}) veröffentlicht und den ausgewählten Schulen zugeordnet (Task 47). Die Schuladministration ordnet danach Teilnehmende, Raumaufsichten und Korrektoren zu.</p>
      <fieldset class="field" style="border:0;padding:0"><legend class="lbl">Schulen</legend>${orgs.map((o) => `<label class="checkbox"><input type="checkbox" data-o="${o.id}" checked> ${esc(o.name)} (${esc(o.short)})</label>`).join("")}</fieldset>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("send")} Veröffentlichen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close([...m.querySelectorAll("[data-o]:checked")].map((x) => x.dataset.o))) });
  if (!v) return;
  const course = await create("courses", { title: c.title, kind: "pruefung", catalog: c.id, org: "", orgs: v, owner: "", members: [], groups: [], status: "veröffentlicht", exam_code: c.meta?.code || "", description: `Prüfung der Koordinierungsstelle · ${c.meta?.art || ""} · Prüfungstermin ${fmtD(c.meta?.termin)}`, corrections: [], third: {}, korr_end: "", dk_threshold: 1 });
  await setStatus(c, "veroeffentlicht", "veroeffentlicht", `Zum Prüfungstermin veröffentlicht und ${v.length} Schule(n) zugeordnet (${v.map((id) => orgShort(id)).join(", ")})`, { meta: { ...(c.meta || {}), course: course.id } });
}
function bindDetail(el, id, tab) {
  const C = () => byId("catalog", id);
  el.querySelectorAll("[data-act]").forEach((b) => (b.onclick = async () => {
    const c = C(); const a = b.dataset.act;
    if (a === "go") return navigate(`#/app/erstellung/${id}/${b.dataset.arg}`);
    if (a === "editor") return navigate(`#/app/editor/${id}/aufgaben`);
    if (a === "preview") { store.set("pvfrom", { erstellung: id }); return navigate(`#/app/vorschau/${id}/dashboard`); }
    if (a === "consult") { if (!hasEvent(c, "beratung-eingesehen")) await log(c, "beratung-eingesehen", "Beratung hat die Aufgabenentwürfe eingesehen (Task 16)"); store.set("pvfrom", { erstellung: id }); return navigate(`#/app/vorschau/${id}/dashboard`); }
    if (a === "savemeta") {
      const meta = { ...(c.meta || {}) }; el.querySelectorAll("[data-meta]").forEach((f) => (meta[f.dataset.meta] = f.type === "number" ? (f.value === "" ? "" : +f.value) : f.value.trim()));
      const content = { ...(c.content || {}), name: meta.titel || c.title, duration_min: +meta.dauer || c.content?.duration_min || 90 };
      if (meta.hilfsmittel) content.info = { title: "Prüfungsinformationen", items: [["Bearbeitungszeit", `${meta.dauer || 90} Minuten zzgl. individueller Zusatzzeit`], ["Zugelassene Hilfsmittel", meta.hilfsmittel], ...((content.info?.items || []).filter((x) => !["Bearbeitungszeit", "Zugelassene Hilfsmittel"].includes(x[0])))] };
      const first = !metaMissing({ meta }).length && metaMissing(c).length;
      await upd("catalog", id, { meta, title: meta.titel || c.title, beruf: meta.beruf || c.beruf, fach: meta.bereich || c.fach, duration: `${meta.dauer || 90} Minuten`, jahr: meta.termin ? String(new Date(meta.termin).getFullYear()) : c.jahr, content, history: first ? [...hist(c), entry("metadaten", "Prüfungsmetadaten vollständig gesetzt (Task 2)")] : hist(c) });
      return toast("Rahmendaten gespeichert", metaMissing({ meta }).length ? `Noch offen: ${metaMissing({ meta }).join(", ")}` : "Alle Pflichtfelder sind befüllt.");
    }
    if (a === "toreview") {
      const errs = validateContent({ cat: { title: c.title }, content: normalizeContent(JSON.parse(JSON.stringify(c.content))), rules: c.rules || [] }).filter((x) => x.lvl === "error");
      if (teamMissing(c).length || metaMissing(c).length) return toast("Übergabe nicht möglich", `Die Koordinierungsstelle muss zuerst ${[...metaMissing(c).length ? ["die Rahmendaten"] : [], ...teamMissing(c).length ? [`die Rollen ${teamMissing(c).join(", ")}`] : []].join(" und ")} festlegen.`, "error");
      if (!(await confirmBox("An die Kommission übergeben", `<p>Die Aufgabenentwürfe werden an die Kommission übergeben (Statuswechsel Nr. 1 → <b>Kommission/Review</b>). Die Aufgabenerstellung kann danach nicht mehr bearbeiten.</p>${errs.length ? `<div class="notice warn small">${icon("triangle-alert")}<span>Der Editor meldet noch ${errs.length} Fehler (z. B. ${esc(errs[0].text)}).</span></div>` : ""}`, "Übergeben", "Abbrechen", false))) return;
      return setStatus(c, "review", "review-start", "Aufgabenentwürfe an die Kommission übergeben (Task 46)");
    }
    if (a === "back") { if (!(await confirmBox("Zurück an die Aufgabenerstellung", "Die Prüfung geht zurück in die Vorbereitung; die Aufgabenerstellung kann wieder bearbeiten.", "Zurückgeben", "Abbrechen", false))) return; return setStatus(c, "vorbereitung", "zurueck", "Von der Kommission an die Aufgabenerstellung zurückgegeben"); }
    if (a === "tolektorat") { const opt = optionalAssigned(c); if (!(await confirmBox("An Lektorat und Prüflösung übergeben", `Die Prüfung geht an ${opt.map((k) => EROLES[k].label).join(" und ")} (Statuswechsel Nr. 3). Inhalte sind in dieser Zeit für die Kommission gesperrt.`, "Übergeben", "Abbrechen", false))) return; return setStatus(c, "lektorat", "lektorat-start", `An ${opt.map((k) => EROLES[k].label).join(" und ")} übergeben (Task 15)`, { reviews: {} }); }
    if (a === "donelek" || a === "donepl") {
      const k = a === "donelek" ? "lektorat" : "pruefloesung";
      if (k === "pruefloesung" && !(c.feedback || []).some((f) => f.kind === "pruefloesung-ergebnis")) return toast("Ergebnis fehlt", "Bitte zuerst unter „Anmerkungen“ das Ergebnis der Prüflösung speichern.", "error");
      if (!(await confirmBox(`${EROLES[k].label} abschließen`, `Ihre Anmerkungen werden an die Kommission übergeben.`, "Abschließen", "Abbrechen", false))) return;
      const reviews = { ...(c.reviews || {}), [k]: { done: true, by: myName(), at: new Date().toISOString() } };
      const h = [...hist(c), entry(`${k}-abgeschlossen`, `${EROLES[k].label} abgeschlossen (Task ${k === "lektorat" ? 17 : 18})`)];
      const pending = optionalAssigned(c).filter((x) => !reviews[x]?.done);
      if (!pending.length) { await upd("catalog", id, { reviews, history: [...h, { ...entry("lektorat-ende", "Lektorat und Prüflösen abgeschlossen – zurück an die Kommission (Statuswechsel Nr. 4)"), from: "lektorat", to: "review" }], status: "review" }); return toast("Status: Kommission / Review", "Lektorat und Prüflösen abgeschlossen."); }
      await upd("catalog", id, { reviews, history: h }); return toast(`${EROLES[k].label} abgeschlossen`, `Es fehlt noch: ${pending.map((x) => EROLES[x].label).join(", ")}`);
    }
    if (a === "release") {
      const opt = optionalAssigned(c); const open = openFeedback(c).length;
      if (opt.length && !hasEvent(c, "lektorat-ende")) return toast("Freigabe noch nicht möglich", `${opt.map((k) => EROLES[k].label).join(" und ")} ${opt.length > 1 ? "sind" : "ist"} zugewiesen – übergeben Sie die Prüfung zuerst an Lektorat und Prüflösung.`, "error");
      if (!(await confirmBox("Prüfung final freigeben", `<p>Die Prüfung wird final freigegeben (Statuswechsel Nr. 5 → <b>gesperrt</b>) und ist bis zum Prüfungsstart (${fmtD(c.meta?.termin)}) für Änderungen gesperrt.</p>${open ? `<div class="notice warn small">${icon("triangle-alert")}<span>${open} Anmerkung(en) sind noch nicht als eingearbeitet markiert.</span></div>` : ""}`, "Final freigeben", "Abbrechen", false))) return;
      return setStatus(c, "gesperrt", "freigegeben", "Prüfung final freigegeben – gesperrt bis zum Prüfungsstart (Task 12)");
    }
    if (a === "unlock") { if (!(await confirmBox("Prüfungsfreigabe aufheben", "Die Prüfung geht zurück an die Kommission (Review) und kann wieder bearbeitet werden (Task 8).", "Freigabe aufheben", "Abbrechen", false))) return; return setStatus(c, "review", "freigabe-aufgehoben", "Prüfungsfreigabe durch die Koordinierungsstelle aufgehoben (Task 8)"); }
    if (a === "publish") return publishDialog(c);
    if (a === "addfb") {
      const text = el.querySelector("[data-fbtext]").value.trim(); if (!text) return toast("Anmerkung fehlt", "", "error");
      const f = { id: Math.random().toString(36).slice(2, 10), kind: b.dataset.arg, by: myName(), at: new Date().toISOString(), st: el.querySelector("[data-fbst]").value, text, resolved: false };
      await upd("catalog", id, { feedback: [...(c.feedback || []), f] }); return toast("Anmerkung erfasst");
    }
    if (a === "plresult") {
      const minutes = +el.querySelector("[data-plmin]").value; if (!minutes) return toast("Bearbeitungszeit fehlt", "", "error");
      const f = { id: "pl", kind: "pruefloesung-ergebnis", by: myName(), at: new Date().toISOString(), minutes, text: el.querySelector("[data-plgrade]").value, resolved: true };
      await upd("catalog", id, { feedback: [...(c.feedback || []).filter((x) => x.kind !== "pruefloesung-ergebnis"), f] }); return toast("Ergebnis der Prüflösung gespeichert");
    }
  }));
  el.querySelectorAll("[data-addrole]").forEach((b) => (b.onclick = () => pickPerson(C(), b.dataset.addrole)));
  el.querySelectorAll("[data-rmrole]").forEach((b) => (b.onclick = async () => { const c = C(); const t = team(c); const k = b.dataset.rmrole; await upd("catalog", id, { team: { ...t, [k]: t[k].filter((x) => x !== b.dataset.pid) }, history: [...hist(c), entry("team", `${EROLES[k].label}: ${personName(byId("persons", b.dataset.pid))} entfernt`)] }); }));
  el.querySelectorAll("[data-pool]").forEach((r) => (r.onchange = async () => {
    const c = C(); const u = POOL.find((x) => x.id === r.dataset.pool);
    const content = { ...(c.content || {}), company: { ...(c.content?.company || {}), name: u.name, allgemein: u.allgemein, adresse: u.adresse, kontakt: u.kontakt, rechtliches: u.rechtliches } };
    await upd("catalog", id, { meta: { ...(c.meta || {}), pool: u.id }, content, history: [...hist(c), entry("pool", `Unternehmenspool festgelegt: ${u.name} (Task 14)`)] });
    toast("Unternehmenspool festgelegt", u.name);
  }));
  el.querySelectorAll("[data-resolve]").forEach((b) => (b.onclick = async () => { const c = C(); await upd("catalog", id, { feedback: (c.feedback || []).map((f) => (f.id === b.dataset.resolve ? { ...f, resolved: true, resolved_by: myName() } : f)) }); toast("Als eingearbeitet markiert"); }));
}

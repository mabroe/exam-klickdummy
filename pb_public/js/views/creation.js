// Erstellungsprozess einer Prüfung (Instanz OPE) – Tasks 2–6, 8, 12, 14–18, 46, 47
//  Status: Vorbereitung (Aufgabenerstellung) → Kommission/Review → Lektorat und Prüflösen → Review → final freigegeben (verschlüsselt und
//  weggesperrt) → Begutachtung durch die Schulen (konfigurierbarer Vorlauf vor Prüfungsstart, Fehlerbehebung mit direkter Freigabe) →
//  Prüfungsstart. Übernimmt die Kommission die Aufgabenerstellung, beginnt die Prüfung direkt im Status Kommission/Review.
//  Datenschutz (DSGVO): Personen im Erstellungsprozess sieht nur die zuordnende Stelle (Koordinierungsstelle). Die Aufgabenerstellung kennt
//  sich untereinander, ebenso die Kommission (inkl. Vorsitz). Die Aufgabenerstellung sieht keine Rahmendaten und nur den ausgewählten
//  Unternehmenspool. Anmerkungen sehen Koordinierungsstelle und Kommission/Vorsitz (Beratung, Lektorat, Prüflösung nur die eigenen), den
//  Verlauf nur die Koordinierungsstelle. Organisationen werden erst nach der finalen Freigabe ausgewählt.
import { D, byId, upd, create } from "../data.js?v=9.0";
import { icon, esc, toast, confirmBox, modal, store, fmtDateTime, parseDate } from "../ui.js?v=9.0";
import { navigate, redraw } from "../app.js?v=9.0";
import { me, personName, orgShort, orgsLabel } from "../access.js?v=9.0";
import { blankContent, validate as validateContent } from "./editor.js?v=9.0";
import { normalizeContent } from "../scenario.js?v=9.0";
import { seal, unseal, fingerprint } from "../vault.js?v=9.0";
import { berufPicker, bindBerufPicker, berufMeta, berufById, berufByName, fbName, poolsFor, poolById, savePool, poolForm, readPoolForm } from "../masterdata.js?v=9.0";
import { lockedBy, acquire, release } from "../locks.js?v=9.0";

// ---------- Modell ----------
export const ESTATUS = {
  vorbereitung: { label: "Vorbereitung", long: "Vorbereitung – Aufgabenerstellung", color: "gray", nr: 1 },
  review: { label: "Kommission / Review", long: "Kommission / Review", color: "cyan", nr: 2 },
  lektorat: { label: "Lektorat und Prüflösen", long: "Lektorat und Prüflösen", color: "purple", nr: 3 },
  gesperrt: { label: "Verschlüsselt", long: "Final freigegeben – verschlüsselt und weggesperrt", color: "yellowb", nr: 4 },
  begutachtung: { label: "Begutachtung", long: "Begutachtung durch die Schulen vor Prüfungsstart", color: "orange", nr: 5 },
  veroeffentlicht: { label: "Prüfungsstart", long: "Prüfungsstart erreicht – Inhalt für die Durchführung freigegeben", color: "green", nr: 6 },
};
export const EROLES = {
  aufgabenerstellung: { label: "Aufgabenerstellung", req: true, hint: "erstellt die Aufgaben im Editor (Task 46)" },
  kommission: { label: "Kommission", req: true, hint: "arbeitet Aufgabenentwürfe ein, legt den Unternehmenspool fest (Tasks 14, 15)", group: true },
  vorsitz: { label: "Kommissionsvorsitz", req: true, single: true, hint: "gibt die Prüfung final frei (Task 12)", group: true },
  beratung: { label: "Beratung", hint: "sieht die Aufgabenentwürfe ein (Task 16)" },
  lektorat: { label: "Lektorat", hint: "lektoriert die Prüfung (Task 17)" },
  pruefloesung: { label: "Prüflösung", hint: "löst die Prüfung im Teilnahmemodus (Task 18)" },
};
const ROLE_ICON = { koordination: "building-2", aufgabenerstellung: "pencil", kommission: "users", vorsitz: "user", beratung: "eye", lektorat: "file-text", pruefloesung: "circle-check" };
// [Feld, Bezeichnung, Typ, Pflicht]; Ausbildungsberuf, Prüfungstitel und Prüfungsjahr über die Auswahl (berufPicker)
export const META = [
  ["art", "Prüfungsart", "select:Abschlussprüfung Teil 1|Abschlussprüfung Teil 2|Abschlussprüfung|Zwischenprüfung|Musterprüfung", true],
  ["bereich", "Prüfungsbereich / Fach", "text", false], ["code", "Prüfungskennung", "text", true],
  ["termin", "Prüfungstermin (Start Prüfungszeitraum)", "datetime-local", true], ["dauer", "Bearbeitungszeit (Minuten)", "number", true],
  ["einsicht_h", "Begutachtung durch die Schulen ab … vor Prüfungsstart", "select:2 Stunden|12 Stunden|24 Stunden|48 Stunden|72 Stunden", true],
  ["erstellung_von", "Start Erstellungszeitraum", "date", "aufgaben"], ["erstellung_bis", "Ende Erstellungszeitraum", "date", "aufgaben"],
  ["kommission_bis", "Ende Kommissionszeitraum", "date", true], ["lektorat_bis", "Ende Lektorat", "date", false], ["pruefloesung_bis", "Ende Prüflösung", "date", false],
  ["hilfsmittel", "Zugelassene Hilfsmittel", "text", false], ["hinweise", "Hinweise für den Erstellungsprozess", "textarea", false],
];
export const byCommission = (c) => !!c?.meta?.kommission_erstellt;
const isReq = (c, req) => (req === "aufgaben" ? !byCommission(c) : !!req);

export const inProcess = (cat) => !!cat?.status;
// ---------- Zeitsteuerung (Prüfungsrumpf) ----------
export const startAt = (c) => new Date(c?.meta?.start_override || c?.meta?.termin || 0);
export const reviewHours = (c) => parseInt(c?.meta?.einsicht_h) || 24;
export const unlockAt = (c) => (c?.meta?.unlock_override ? new Date(c.meta.unlock_override) : new Date(startAt(c).getTime() - reviewHours(c) * 3600000));
export const examCourse = (c) => byId("courses", c?.meta?.course) || D.courses.find((x) => x.kind === "pruefung" && x.catalog === c?.id);
export const isSealed = (c) => c?.status === "gesperrt";
export const released = (c) => ["gesperrt", "begutachtung", "veroeffentlicht"].includes(c?.status);
// Wer darf den Inhalt sehen? Entwurf: Personen im Erstellungsprozess; verschlüsselt: niemand; Begutachtung: Koordinierungsstelle,
// Kommission, Vorsitz sowie Schuladministration und Korrektor:innen der teilnehmenden Schulen; ab Prüfungsstart: wie bisher
export function schoolReviewer(c, p = me()) {
  const course = examCourse(c); if (!course || !p) return false;
  if (p.kind === "schuladmin") return (course.orgs || []).includes(p.org);
  return (course.corrections || []).some((a) => (a.correctors || []).includes(p.id));
}
export function canViewContent(c, p = me()) {
  if (!c?.status) return true;
  const r = rolesOf(c, p);
  if (["vorbereitung", "review", "lektorat"].includes(c.status)) return r.length > 0;
  if (c.status === "gesperrt") return false;
  if (c.status === "begutachtung") return r.includes("koordination") || r.includes("kommission") || r.includes("vorsitz") || schoolReviewer(c, p);
  return true;
}
export function contentInfo(c) {
  if (!c?.status) return null;
  if (c.status === "veroeffentlicht") return { key: "frei", text: "Inhalt für die Durchführung freigegeben", badge: "green" };
  if (c.status === "begutachtung") return { key: "begutachtung", text: `Begutachtung durch die Schulen bis Prüfungsstart ${fmtDateTime(startAt(c))} Uhr`, badge: "orange" };
  if (c.status === "gesperrt") return { key: "versiegelt", text: `Inhalt verschlüsselt – Begutachtung ab ${fmtDateTime(unlockAt(c))} Uhr`, badge: "yellowb" };
  return { key: "entwurf", text: "Inhalt in Erstellung – für Schulen nicht einsehbar", badge: "gray" };
}
export const isKS = (p = me()) => p?.kind === "koordination";
export const team = (cat) => ({ aufgabenerstellung: [], kommission: [], vorsitz: [], beratung: [], lektorat: [], pruefloesung: [], ...(cat?.team || {}) });
export function rolesOf(cat, p = me()) {
  if (!p || !cat) return [];
  const t = team(cat); const r = Object.keys(EROLES).filter((k) => (t[k] || []).includes(p.id));
  return isKS(p) ? ["koordination", ...r] : r;
}
export const canEditContent = (cat, p = me()) => { const r = rolesOf(cat, p); return (cat.status === "vorbereitung" && r.includes("aufgabenerstellung")) || (cat.status === "review" && (r.includes("kommission") || r.includes("vorsitz"))) || (cat.status === "begutachtung" && startAt(cat) > Date.now() && (r.includes("koordination") || r.includes("kommission") || r.includes("vorsitz"))); };
export const metaMissing = (cat) => [...(!cat?.meta?.beruf_id && !cat?.meta?.beruf ? ["Ausbildungsberuf"] : []), ...(!cat?.meta?.ptitel && !cat?.meta?.titel ? ["Prüfungstitel"] : []), ...(!cat?.meta?.jahr ? ["Prüfungsjahr"] : []),
  ...META.filter(([k, , , req]) => isReq(cat, req) && !String(cat?.meta?.[k] ?? "").trim()).map(([, l]) => l)];
export const teamMissing = (cat) => Object.entries(EROLES).filter(([k, d]) => d.req && !(k === "aufgabenerstellung" && byCommission(cat)) && !(team(cat)[k] || []).length).map(([, d]) => d.label);
const optionalAssigned = (cat) => ["lektorat", "pruefloesung"].filter((k) => (team(cat)[k] || []).length);
const hist = (cat) => cat.history || [];
export const hasEvent = (cat, ev) => hist(cat).some((h) => h.ev === ev);
const openFeedback = (cat) => (cat.feedback || []).filter((f) => !f.resolved && f.kind !== "pruefloesung-ergebnis");
const roleName = (k) => (k === "koordination" ? "Koordinierungsstelle" : EROLES[k]?.label || k);
const myName = () => (me() ? personName(me()) : "Koordinierungsstelle");
const fmtD = (v) => { const d = parseDate(v) || (v ? new Date(v) : null); return d && !isNaN(d) ? (String(v).length <= 10 ? d.toLocaleDateString("de-DE") : fmtDateTime(d)) : "–"; };
const entry = (ev, text, extra = {}) => ({ at: new Date().toISOString(), by: myName(), ev, text, ...extra });
export const fachbereichOf = (c) => c?.meta?.fachbereich || berufById(c?.meta?.beruf_id)?.fb || berufByName(c?.meta?.beruf || c?.beruf)?.fb || "";

// ---------- Sichtbarkeit (DSGVO) ----------
const CIRCLE = { aufgabenerstellung: ["aufgabenerstellung"], kommission: ["kommission", "vorsitz"], vorsitz: ["kommission", "vorsitz"] };
// Darf die Person die Namen der Rolle `role` sehen?
export function seesNames(c, role, p = me()) {
  const r = rolesOf(c, p); if (r.includes("koordination")) return true;
  return r.some((x) => (CIRCLE[x] || []).includes(role));
}
export function canSeeTab(c, tab, p = me()) {
  const r = rolesOf(c, p); const ks = r.includes("koordination"); const kom = r.includes("kommission") || r.includes("vorsitz");
  const review = r.some((x) => ["beratung", "lektorat", "pruefloesung"].includes(x));
  switch (tab) {
    case "uebersicht": return true;
    case "rahmendaten": return ks || kom || review;
    case "organisationen": case "personen": case "verlauf": return ks;
    case "unternehmen": return ks || kom || r.includes("aufgabenerstellung");
    case "anmerkungen": return ks || kom || review;
    default: return false;
  }
}
const seesAllFeedback = (c, p = me()) => { const r = rolesOf(c, p); return r.includes("koordination") || r.includes("kommission") || r.includes("vorsitz"); };
const fbVisible = (c, f, p = me()) => seesAllFeedback(c, p) || (f.pid ? f.pid === p?.id : f.by === myName());
const fbAuthor = (c, f, p = me()) => (rolesOf(c, p).includes("koordination") || f.pid === p?.id || (f.pid ? false : f.by === myName()) ? f.by : "");

async function setStatus(cat, to, ev, text, patch = {}) {
  const from = cat.status;
  await upd("catalog", cat.id, { status: to, history: [...hist(cat), entry(ev, text, { from, to })], ...patch });
  toast(`Status: ${ESTATUS[to].label}`, text);
}
const log = (cat, ev, text, patch = {}) => upd("catalog", cat.id, { history: [...hist(cat), entry(ev, text)], ...patch });

// ---------- Prüfung anlegen (Koordinierungsstelle) ----------
export async function newExamDialog() {
  const st = { beruf_id: "bm", jahr: String(new Date().getFullYear() + 1), _by: "name" };
  st.ptitel = berufById(st.beruf_id)?.titel?.[0] || "";
  const v = await modal({ title: "Neue Prüfung anlegen", size: "wide",
    body: `<p class="small">Wählen Sie den Ausbildungsberuf (nach Name oder Berufsnummer), den hinterlegten Prüfungstitel und das Prüfungsjahr. Die Prüfung wird im Status <b>Vorbereitung</b> angelegt; anschließend legen Sie die Rahmendaten fest und weisen die Personen zu.</p>
      <div data-bphost></div>
      <div class="field"><label class="lbl" for="ne-a">Prüfungsart</label><select id="ne-a" class="select" data-f="art">${META[0][2].slice(7).split("|").map((o) => `<option>${o}</option>`).join("")}</select></div>
      <label class="checkbox" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-f="kommission_erstellt"><span><b>Die Kommission übernimmt die Aufgabenerstellung</b><br><span class="xs muted">Es wird keine Aufgabenerstellung zugewiesen; die Prüfung startet direkt im Status Kommission/Review. Start und Ende des Erstellungszeitraums entfallen.</span></span></label>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("plus")} Prüfung anlegen</button>`,
    onMount: (m, close) => {
      const host = m.querySelector("[data-bphost]");
      const draw = (s) => { Object.assign(st, s); host.innerHTML = berufPicker(st, { id: "ne" }); bindBerufPicker(host, st, draw); const q = host.querySelector("[data-bq]"); if (s._q !== undefined && q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } };
      draw(st);
      m.querySelector("[data-ok]").onclick = () => {
        if (!st.beruf_id || !st.ptitel || !st.jahr) { toast("Angaben fehlen", "Bitte Ausbildungsberuf, Prüfungstitel und Prüfungsjahr wählen.", "error"); return; }
        const art = m.querySelector("[data-f=art]").value; const kom = m.querySelector("[data-f=kommission_erstellt]").checked;
        close({ ...berufMeta(st), art, kommission_erstellt: kom });
      };
    } });
  if (!v) return;
  const p = me(); const start = v.kommission_erstellt ? "review" : "vorbereitung";
  const title = v.titel;
  const rec = await create("catalog", { title, kind: "Prüfung", beruf: v.beruf, fach: "", jahr: v.jahr, description: "", duration: "90 Minuten", creator: "Koordinierungsstelle (IBBW)", tags: ["Prüfungen", "Erstellungsprozess"], contents: [], mine: false, copied_from: "", image: Math.floor(Math.random() * 4), release: null,
    content: blankContent(title, 90), rules: [], editor_by: "prozess", status: start, meta: { ...v, dauer: 90, einsicht_h: "24 Stunden", orgs: [], version: 1 }, team: { koordination: p ? [p.id] : [] },
    history: [{ at: new Date().toISOString(), by: myName(), ev: "angelegt", text: v.kommission_erstellt ? "Neue Prüfung angelegt – die Kommission übernimmt die Aufgabenerstellung (Start im Status Kommission/Review)" : "Neue Prüfung angelegt (Status Vorbereitung)", to: start }], feedback: [], reviews: {} });
  for (let i = 0; i < 40 && !byId("catalog", rec.id); i++) await new Promise((r) => setTimeout(r, 50));
  toast("Prüfung angelegt", title); navigate(`#/app/erstellung/${rec.id}/rahmendaten`);
}

// ---------- Übersicht ----------
export function list() {
  return {
    shell: "staff", rail: "erstellung", title: "Prüfungserstellung",
    render() {
      const p = me();
      const all = D.catalog.filter(inProcess).filter((c) => isKS(p) || rolesOf(c, p).length).sort((a, b) => String(b.created).localeCompare(String(a.created)));
      return `<div class="pagehead"><div><h1>Prüfungserstellung</h1><div class="sub">${esc(myName())}${isKS(p) ? " · Koordinierungsstelle" : " · Prüfungen, an deren Erstellung Sie beteiligt sind"}</div></div>
        ${isKS(p) ? `<div class="actions-bar"><a class="btn" href="#/app/stammdaten">${icon("database")} Stammdaten</a><button class="btn primary" data-newexam>${icon("plus")} Neue Prüfung anlegen</button></div>` : ""}</div>
      <div class="notice info small mb">${icon("info")}<span>Ablauf: <b>Vorbereitung</b> (Rahmendaten, Personen, Unternehmenspool, Aufgabenerstellung) → <b>Kommission/Review</b> → <b>Lektorat und Prüflösen</b> (optional) → Review → <b>final freigegeben</b>: verschlüsselt und weggesperrt → Organisationen zuordnen → <b>Begutachtung</b> durch die Schulen (Vorlauf laut Prüfungsrumpf) → <b>Prüfungsstart</b>. Übernimmt die Kommission die Aufgabenerstellung, beginnt die Prüfung direkt im Review.</span></div>
      <div class="tablewrap"><table class="tbl"><thead><tr><th>Prüfung</th><th>Status</th><th>Ihre Rollen</th><th>Prüfungstermin</th><th>Nächster Schritt</th></tr></thead><tbody>${all.length ? all.map((c) => { const t = myTasks(c, p).find((x) => !x.done); const rd = canSeeTab(c, "rahmendaten", p); const act = t?.acts.find(([a]) => a !== "go") || t?.acts[0];
        return `<tr class="rowlink" data-href="#/app/erstellung/${c.id}/uebersicht" tabindex="0"><td><b>${esc(c.title)}</b><div class="xs muted">${rd ? `${esc(c.meta?.code || "")} ${esc(c.meta?.art || "")}` : esc(c.meta?.beruf || c.beruf || "")}</div></td><td>${statusBadge(c)}</td><td class="small">${rolesOf(c, p).map(roleName).join(", ") || "–"}</td><td class="small">${rd ? fmtD(c.meta?.termin) : `<span class="muted" title="Rahmendaten sind für die Aufgabenerstellung nicht einsehbar">–</span>`}</td>
        <td class="small">${t ? `<b>${esc(t.title)}</b>${t.due && t.due !== "–" ? `<div class="xs muted">fällig ${esc(t.due)}</div>` : ""}${act ? `<div class="mt-s"><button class="btn xs ${act[0] === "go" ? "" : "primary"}" data-lact="${act[0]}" data-arg="${act[1]}" data-id="${c.id}">${esc(act[2])}</button></div>` : ""}` : `<span class="muted">keine</span>`}</td></tr>`; }).join("")
        : `<tr><td colspan="5"><div class="empty small">${isKS(p) ? "Noch keine Prüfung im Erstellungsprozess. Legen Sie eine neue Prüfung an." : "Sie sind derzeit keiner Prüfung im Erstellungsprozess zugewiesen."}</div></td></tr>`}</tbody></table></div>`;
    },
    mount(el) { const b = el.querySelector("[data-newexam]"); if (b) b.onclick = () => newExamDialog(); el.querySelectorAll("[data-lact]").forEach((x) => (x.onclick = () => runAction(x.dataset.id, x.dataset.lact, x.dataset.arg, el))); },
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
    if (["vorbereitung", "review"].includes(s)) add(14, "Unternehmenspool festlegen (mit der Kommission)", !!c.meta?.pool, [["go", "unternehmen", "Unternehmenspool"]]);
    if (s === "gesperrt") { add(8, "Prüfungsfreigabe aufheben (bei Bedarf)", false, [["unlock", "", "Freigabe aufheben"]]); add("–", `Warten auf Begutachtungszeitraum (ab ${fmtDateTime(unlockAt(c))} Uhr)`, false, [["demounlock", "", "Demo: Begutachtungszeitraum jetzt beginnen"]]); }
    if (released(c)) add(47, "Organisationen der Prüfung zuordnen", !!(c.meta?.orgs || []).length, s !== "veroeffentlicht" ? [["go", "organisationen", "Organisationen zuordnen"]] : []);
    if (s === "begutachtung") add("–", `Prüfungsstart ${fmtDateTime(startAt(c))} Uhr`, false, [["demostart", "", "Demo: Prüfungsstart jetzt"]]);
    if (s !== "vorbereitung") add(6, "Erstellungsprozess einsehen", true, [["go", "verlauf", "Verlauf öffnen"]]);
  }
  if (r.includes("kommission") || r.includes("vorsitz")) {
    if (!r.includes("koordination")) add(14, "Unternehmenspool festlegen", !!c.meta?.pool, ["vorbereitung", "review"].includes(s) ? [["go", "unternehmen", "Unternehmenspool"]] : [], fmtD(c.meta?.erstellung_bis));
    if (s === "review") {
      const opt = optionalAssigned(c); const fb = openFeedback(c).length;
      add(15, byCommission(c) ? "Aufgaben erstellen, einarbeiten und weiterreichen" : "Aufgabenentwürfe einarbeiten und weiterreichen", false, [["editor", "", "Im Editor bearbeiten"], ["preview", "", "Vorschau"], ...(fb ? [["go", "anmerkungen", `Anmerkungen (${fb} offen)`]] : []), ...(opt.length && !hasEvent(c, "lektorat-ende") ? [["tolektorat", "", "An Lektorat und Prüflösung übergeben"]] : []), ...(byCommission(c) ? [] : [["back", "", "Zurück an die Aufgabenerstellung"]])], fmtD(c.meta?.kommission_bis));
    }
  }
  if (r.includes("vorsitz") && s === "review") add(12, "Prüfung final freigeben", false, [["release", "", "Final freigeben (verschlüsseln)"]], fmtD(c.meta?.kommission_bis));
  if (s === "begutachtung" && (r.includes("koordination") || r.includes("kommission") || r.includes("vorsitz"))) add(r.includes("koordination") ? 50 : 49, "Gemeldete Fehler vor Prüfungsbeginn beheben (direkte Freigabe)", hasEvent(c, "korrektur-freigegeben"), startAt(c) > Date.now() ? [["editor", "", "Im Editor korrigieren"], ["preview", "", "Vorschau"]] : [], fmtDateTime(startAt(c)));
  if (r.includes("aufgabenerstellung")) add(46, "Aufgaben erstellen", s !== "vorbereitung", s === "vorbereitung" ? [["editor", "", "Aufgaben im Editor erstellen"], ["preview", "", "Vorschau"], ["toreview", "", "An die Kommission übergeben"]] : [], fmtD(c.meta?.erstellung_bis));
  if (r.includes("beratung")) add(16, "Aufgabenentwürfe einsehen", hasEvent(c, "beratung-eingesehen"), ["vorbereitung", "review"].includes(s) ? [["consult", "", "Aufgabenentwürfe einsehen"], ["go", "anmerkungen", "Hinweis an die Kommission"]] : []);
  if (r.includes("lektorat")) add(17, "Prüfung lektorieren", !!rv.lektorat?.done || (s !== "lektorat" && hasEvent(c, "lektorat-abgeschlossen")), s === "lektorat" && !rv.lektorat?.done ? [["preview", "", "Prüfung ansehen"], ["go", "anmerkungen", "Anmerkungen erfassen"], ["donelek", "", "Lektorat abschließen"]] : [], fmtD(c.meta?.lektorat_bis));
  if (r.includes("pruefloesung")) add(18, "Prüfung prüflösen", !!rv.pruefloesung?.done || (s !== "lektorat" && hasEvent(c, "pruefloesung-abgeschlossen")), s === "lektorat" && !rv.pruefloesung?.done ? [["preview", "", "Im Teilnahmemodus lösen"], ["go", "anmerkungen", "Ergebnis erfassen"], ["donepl", "", "Prüflösung abschließen"]] : [], fmtD(c.meta?.pruefloesung_bis));
  return out;
}
// Statuswechsel und Arbeitsschritte, die überall angezeigt werden (Kopfbereich der Prüfung und Editor)
export const STATUS_ACTS = ["toreview", "tolektorat", "back", "release", "unlock", "donelek", "donepl", "demounlock", "demostart"];
export function processActions(c, p = me(), { inEditor = false } = {}) {
  const seen = new Set(); const out = [];
  myTasks(c, p).filter((t) => !t.done).forEach((t) => t.acts.forEach((a) => { if (seen.has(a[0] + a[1])) return; if (inEditor && !STATUS_ACTS.includes(a[0]) && a[0] !== "preview") return; seen.add(a[0] + a[1]); out.push(a); }));
  return out;
}
const actBtn = ([a, arg, l], attr = "data-act") => `<button class="btn sm ${STATUS_ACTS.includes(a) && !a.startsWith("demo") ? "primary" : a.startsWith("demo") ? "ghost" : ""}" ${attr}="${a}" data-arg="${arg}">${icon({ toreview: "send", tolektorat: "send", back: "undo-2", release: "lock", unlock: "lock-open", donelek: "circle-check", donepl: "circle-check", editor: "pencil", preview: "eye", consult: "eye", go: "arrow-right" }[a] || "clock")} ${esc(l)}</button>`;
export function actionBar(c, opts = {}) {
  const acts = processActions(c, me(), opts); if (!acts.length) return "";
  const status = acts.filter(([a]) => STATUS_ACTS.includes(a)); const rest = acts.filter(([a]) => !STATUS_ACTS.includes(a));
  return `<div class="nextbar" role="region" aria-label="Nächste Schritte"><span class="nb-l">${icon("list-checks")} <b>Nächste Schritte</b> <span class="xs muted">Status ${esc(ESTATUS[c.status]?.label || "")}</span></span><span class="row wrap" style="gap:6px">${[...status, ...rest].map((a) => actBtn(a, opts.inEditor ? "data-pact" : "data-act")).join("")}</span></div>`;
}

// ---------- Detailseite ----------
const TABS = [["uebersicht", "Übersicht"], ["rahmendaten", "Rahmendaten und Prüfungsrumpf"], ["personen", "Personen"], ["unternehmen", "Unternehmenspool"], ["organisationen", "Organisationen"], ["anmerkungen", "Anmerkungen"], ["verlauf", "Verlauf"]];
const MD = new Map(); // ungespeicherte Rahmendaten je Prüfung { meta, base }
export function detail(id, tab = "uebersicht") {
  const c0 = byId("catalog", id);
  if (!c0 || !inProcess(c0)) return { redirect: "#/app/erstellung" };
  if (!isKS() && !rolesOf(c0).length) return { shell: "staff", rail: "erstellung", title: "Kein Zugriff", render: () => `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Sie sind dieser Prüfung im Erstellungsprozess nicht zugewiesen.</p><a class="btn" href="#/app/erstellung">Zur Übersicht</a></div>` };
  if (!TABS.some(([k]) => k === tab) || !canSeeTab(c0, tab)) tab = "uebersicht";
  return {
    shell: "staff", rail: "erstellung", title: c0.title,
    render() {
      const c = byId("catalog", id); const r = rolesOf(c);
      const cont = normalizeContent(JSON.parse(JSON.stringify(c.content || { tasks: [] })));
      const pts = cont.tasks.reduce((a, t) => a + t.points, 0); const subs = cont.tasks.reduce((a, t) => a + t.subtasks.length, 0);
      const order = ["vorbereitung", "review", "lektorat", "gesperrt", "begutachtung", "veroeffentlicht"];
      const rd = canSeeTab(c, "rahmendaten");
      return `<div class="breadcrumb"><a href="#/app/erstellung">Prüfungserstellung</a>${icon("chevron-right")}<b>${esc(c.title)}</b></div>
      <div class="pagehead"><div><h1>${esc(c.title)}</h1><div class="row mt-s small wrap">${statusBadge(c)}<span>${rd ? `${esc(c.meta?.code || "")} · Prüfungstermin <b>${fmtD(c.meta?.termin)}</b> · ` : `${esc(c.meta?.beruf || c.beruf || "")} · `}${isSealed(c) ? `Inhalt verschlüsselt (${esc(c.sealed?.alg || "")}, Fingerabdruck ${esc(fingerprint(c.sealed))})` : `${cont.tasks.length} Aufgaben, ${subs} Teilaufgaben, ${pts} Punkte`}</span>${byCommission(c) ? `<span class="badge cyan">${icon("users")} Kommission erstellt die Aufgaben</span>` : ""}<span class="badge gray">Ihre Rollen: ${r.map(roleName).join(", ") || "–"}</span></div></div>
        <div class="actions-bar">${canViewContent(c) ? `<button class="btn" data-act="preview" data-arg="">${icon("eye")} Vorschau</button>` : isSealed(c) ? `<span class="badge yellowb">${icon("lock")} verschlüsselt</span>` : ""}${canEditContent(c) ? `<button class="btn primary" data-act="editor" data-arg="">${icon("pencil")} Im Editor bearbeiten</button>` : ""}</div></div>
      <ol class="estepper">${order.map((k, i) => { const cur = order.indexOf(c.status); return `<li class="${i < cur ? "done" : i === cur ? "cur" : ""}"><span class="dot">${i < cur ? icon("check") : i + 1}</span><span>${ESTATUS[k].label}</span></li>`; }).join("")}</ol>
      ${actionBar(c)}
      <nav class="tabs">${TABS.filter(([k]) => canSeeTab(c, k)).map(([k, l]) => { const n = (c.feedback || []).filter((f) => f.kind !== "pruefloesung-ergebnis" && !f.resolved && fbVisible(c, f)).length; return `<a href="#/app/erstellung/${id}/${k}" class="${k === tab ? "active" : ""}">${l}${k === "anmerkungen" && n ? ` <span class="badge yellowb">${n}</span>` : ""}</a>`; }).join("")}</nav>
      ${{ uebersicht: tabOverview, rahmendaten: tabMeta, organisationen: tabOrgs, personen: tabTeam, unternehmen: tabPool, anmerkungen: tabFeedback, verlauf: tabHistory }[tab](c, r, cont)}`;
    },
    mount(el) {
      bindDetail(el, id, tab);
      // Bearbeitungssperre für die Rahmendaten (mehrere Personen der Koordinierungsstelle)
      const c = byId("catalog", id);
      if (tab === "rahmendaten" && metaEditable(c, rolesOf(c)) && !lockedBy(id, "rahmendaten")) acquire(id, "rahmendaten", "Koordinierungsstelle").then((ok) => { if (!ok) redraw(); });
    },
    unmount() { if (tab === "rahmendaten") release(id, "rahmendaten"); },
  };
}
function tabOverview(c, r, cont) {
  const tasks = myTasks(c);
  const t = team(c);
  const issues = validateContent({ cat: { title: c.title }, content: cont, rules: c.rules || [] }).filter((x) => x.lvl === "error").length;
  const pool = poolById(c.meta?.pool);
  return `<div class="edgrid2"><section class="card pad"><h3>${icon("list-checks")} Ihre Aufgaben</h3>
    ${tasks.length ? tasks.map((x) => `<div class="etask ${x.done ? "done" : ""}"><div class="row between"><b>${x.done ? icon("circle-check") : icon("circle")} ${typeof x.t === "number" ? `Task ${x.t}: ` : ""}${esc(x.title)}</b>${x.due && x.due !== "–" ? `<span class="xs muted">fällig ${esc(x.due)}</span>` : ""}</div>
      ${x.acts.length ? `<div class="row wrap mt-s" style="gap:6px">${x.acts.map((a) => actBtn(a)).join("")}</div>` : ""}</div>`).join("") : `<p class="small muted">In diesem Status haben Sie keine Aufgaben.</p>`}
    ${r.includes("aufgabenerstellung") && c.status === "vorbereitung" && !pool ? `<div class="notice warn small mt">${icon("triangle-alert")}<span>Noch kein Unternehmenspool festgelegt. Die Kommission bzw. die Koordinierungsstelle legt ihn fest.</span></div>` : ""}
    ${c.status === "lektorat" ? `<div class="notice info small mt">${icon("clock")}<span>Warten auf Abschluss von ${["lektorat", "pruefloesung"].filter((k) => t[k].length && !(c.reviews || {})[k]?.done).map((k) => EROLES[k].label).join(" und ") || "–"}. Danach geht die Prüfung automatisch zurück an die Kommission.</span></div>` : ""}
    ${c.status === "gesperrt" ? `<div class="notice warn small mt">${icon("lock")}<span>Die Prüfung ist final freigegeben, <b>verschlüsselt</b> (${esc(c.sealed?.alg || "")}) und sicher weggesperrt. Niemand kann den Inhalt einsehen. Laut Prüfungsrumpf wird sie <b>${reviewHours(c)} Stunden vor Prüfungsstart</b> (${fmtDateTime(unlockAt(c))} Uhr) automatisch entschlüsselt und den Schulen zur Begutachtung bereitgestellt.${r.includes("koordination") ? " Jetzt ordnen Sie die teilnehmenden Schulen zu." : ""}</span></div>` : ""}
    ${c.status === "begutachtung" ? `<div class="notice info small mt">${icon("eye")}<span><b>Begutachtung bis zum Prüfungsstart</b> (${fmtDateTime(startAt(c))} Uhr): Schuladministration und Korrektor:innen der teilnehmenden Schulen sehen die Prüfung ein und melden Fehler außerhalb des Portals an die Koordinierungsstelle bzw. Prüfungskommission. Korrekturen im Editor werden direkt freigegeben (ohne erneuten Freigabeprozess)${c.meta?.version > 1 ? ` – aktuell Version ${c.meta.version}` : ""}.</span></div>` : ""}</section>
  <section class="card pad"><h3>${icon("users")} Stand des Erstellungsprozesses</h3>
    ${Object.entries(EROLES).filter(([k]) => !(k === "aufgabenerstellung" && byCommission(c))).map(([k, d]) => { const ps = t[k] || []; const done = { aufgabenerstellung: hasEvent(c, "review-start"), beratung: hasEvent(c, "beratung-eingesehen"), lektorat: hasEvent(c, "lektorat-abgeschlossen"), pruefloesung: hasEvent(c, "pruefloesung-abgeschlossen"), vorsitz: released(c), kommission: hasEvent(c, "lektorat-start") || released(c) }[k];
      const names = seesNames(c, k) ? ps.map((id) => esc(personName(byId("persons", id)))).join(", ") : ps.includes(me()?.id) ? `Sie${ps.length > 1 ? ` und ${ps.length - 1} weitere Person${ps.length > 2 ? "en" : ""}` : ""}` : `zugewiesen <span class="xs muted" title="Namen sieht nur die zuordnende Stelle (Datenschutz)">(Namen nicht einsehbar)</span>`;
      return `<div class="kv">${icon(ROLE_ICON[k])}<div class="grow"><div class="small">${d.label}${d.req ? "" : " (optional)"}</div><span class="v">${ps.length ? names : `<span class="muted">nicht zugewiesen</span>`}</span></div>${ps.length ? (done ? `<span class="badge green">${icon("check")} erledigt</span>` : `<span class="badge gray">offen</span>`) : ""}</div>`; }).join("")}
    <div class="kv">${icon("file-text")}<div><div class="small">Inhalt</div><span class="v">${isSealed(c) ? `verschlüsselt · ${Math.round((c.sealed?.bytes || 0) / 1024)} KB` : `${cont.tasks.length} Aufgaben · ${cont.tasks.reduce((a, x) => a + x.subtasks.length, 0)} Teilaufgaben${issues ? ` · <span class="badge red">${issues} offene Fehler im Editor</span>` : ""}`}</span></div></div>
    ${canSeeTab(c, "unternehmen") ? `<div class="kv">${icon("building-2")}<div><div class="small">Unternehmenspool</div><span class="v">${esc(pool?.name || "noch nicht festgelegt")}</span></div></div>` : ""}
    ${r.includes("koordination") ? `<div class="kv">${icon("school")}<div><div class="small">Organisationen</div><span class="v">${(c.meta?.orgs || []).length ? (c.meta.orgs || []).map((o) => esc(orgShort(o))).join(", ") : `<span class="muted">${released(c) ? "noch nicht zugeordnet" : "Auswahl nach der finalen Freigabe"}</span>`}</span></div></div>` : ""}
    ${canSeeTab(c, "anmerkungen") ? `<div class="kv">${icon("message-square-warning")}<div><div class="small">Anmerkungen${seesAllFeedback(c) ? "" : " (eigene)"}</div><span class="v">${(c.feedback || []).filter((f) => f.kind !== "pruefloesung-ergebnis" && fbVisible(c, f)).length} gesamt · ${openFeedback(c).filter((f) => fbVisible(c, f)).length} offen</span></div></div>` : ""}</section></div>`;
}
const metaField = (c, m, [k, l, type, req], ro) => {
  const v = m?.[k] ?? ""; const dis = ro ? "disabled" : ""; const star = isReq(c, req) ? " *" : "";
  if (type.startsWith("select:")) return `<div class="field"><label class="lbl">${l}${star}</label><select class="select" data-meta="${k}" ${dis}>${type.slice(7).split("|").map((o) => `<option ${o === v || (k === "einsicht_h" && parseInt(o) === parseInt(v)) ? "selected" : ""}>${o}</option>`).join("")}</select></div>`;
  if (type === "textarea") return `<div class="field" style="grid-column:1/-1"><label class="lbl">${l}</label><textarea class="input" rows="3" data-meta="${k}" ${dis}>${esc(v)}</textarea></div>`;
  return `<div class="field"><label class="lbl">${l}${star}</label><input class="input" type="${type}" data-meta="${k}" value="${esc(v)}" ${dis}></div>`;
};
const metaEditable = (c, r) => r.includes("koordination") && c.status !== "veroeffentlicht";
function tabMeta(c, r) {
  const lock = lockedBy(c.id, "rahmendaten");
  const fin = released(c); const canEdit = metaEditable(c, r) && !lock;
  const ro = !canEdit || fin; const roRumpf = !canEdit || c.status === "veroeffentlicht";
  const st = MD.get(c.id); if (st && st.base !== c.updated && !st.dirty) MD.delete(c.id);
  const m = MD.get(c.id)?.meta || { ...(c.meta || {}), beruf_id: c.meta?.beruf_id || berufByName(c.meta?.beruf || c.beruf)?.id || "", ptitel: c.meta?.ptitel || "", jahr: c.meta?.jahr || c.jahr || "" };
  const miss = metaMissing(c);
  return `<section class="card pad" style="max-width:1000px"><div class="row between"><h3>Rahmendaten (Prüfungsmetadaten, Task 2/3)</h3>${miss.length ? `<span class="badge yellowb" title="${esc(miss.join(", "))}">${miss.length} Pflichtfelder offen</span>` : `<span class="badge green">${icon("check")} vollständig</span>`}</div>
    ${lock ? `<div class="notice warn small">${icon("lock")}<span><b>Gesperrt:</b> Die Rahmendaten werden gerade von ${esc(lock.self ? "Ihnen in einem anderen Fenster" : lock.name)} bearbeitet. Sie können sie ansehen; die Bearbeitung ist möglich, sobald die Sperre aufgehoben ist.</span></div>` : ""}
    ${!r.includes("koordination") ? `<p class="xs muted">Die Rahmendaten pflegt die Koordinierungsstelle; Sie sehen sie schreibgeschützt.</p>` : fin ? `<p class="xs muted">Nach der finalen Freigabe sind die Prüfungsmetadaten schreibgeschützt; Prüfungstermin und Vorlauf der Begutachtung bleiben bis zum Prüfungsstart anpassbar.</p>` : `<p class="xs muted">Pflichtfelder (*) müssen vor der Übergabe an die Kommission befüllt sein. Fristen erscheinen als Fälligkeit bei den beteiligten Rollen.</p>`}
    <h4 class="mt">Ausbildungsberuf, Prüfungstitel und Prüfungsjahr</h4><div data-bphost>${berufPicker(m, { ro, id: "md" })}</div>
    <h4 class="mt">Erstellung</h4>
    <label class="checkbox" style="display:flex;gap:8px;align-items:flex-start"><input type="checkbox" data-meta-cb="kommission_erstellt" ${m.kommission_erstellt ? "checked" : ""} ${ro || c.status !== "vorbereitung" ? "disabled" : ""}><span><b>Die Kommission übernimmt die Aufgabenerstellung</b><br><span class="xs muted">Keine Rolle Aufgabenerstellung; die Prüfung wechselt beim Speichern direkt in den Status Kommission/Review. Start und Ende des Erstellungszeitraums sind dann nicht erforderlich.${c.status !== "vorbereitung" ? " Nur in der Vorbereitung änderbar." : ""}</span></span></label>
    <h4 class="mt">Prüfungsrumpf und Durchführungskonfiguration</h4><p class="xs muted">Prüfungstermin, Bearbeitungszeit und der Vorlauf für die Begutachtung steuern, wann der verschlüsselte Inhalt automatisch für die Schulen zur Begutachtung bereitsteht (z. B. 24 Stunden vor Prüfungsstart) und wann er für die Durchführung freigegeben wird.</p>
    <div class="metagrid">${META.filter(([k]) => ["termin", "dauer", "einsicht_h", "hilfsmittel"].includes(k)).map((f) => metaField(c, m, f, ["termin", "einsicht_h"].includes(f[0]) ? roRumpf : ro)).join("")}</div>
    <h4 class="mt">Prüfungsmetadaten und Fristen im Erstellungsprozess</h4>
    <div class="metagrid">${META.filter(([k]) => !["termin", "dauer", "einsicht_h", "hilfsmittel"].includes(k)).filter(([k]) => !(m.kommission_erstellt && ["erstellung_von", "erstellung_bis"].includes(k))).map((f) => metaField(c, m, f, ro)).join("")}</div>
    ${roRumpf ? "" : `<div class="row end mt"><button class="btn primary" data-act="savemeta" data-arg="">${icon("save")} Rahmendaten speichern</button></div>`}</section>`;
}
function tabOrgs(c, r) {
  const can = r.includes("koordination") && ["gesperrt", "begutachtung"].includes(c.status); const sel = new Set(c.meta?.orgs || []); const course = examCourse(c);
  const bid = c.meta?.beruf_id || berufByName(c.meta?.beruf || c.beruf)?.id || ""; const b = berufById(bid);
  const orgs = [...D.orgs].sort((a, x) => a.name.localeCompare(x.name));
  return `<div class="notice info small mb">${icon("info")}<span><b>Organisationen der Prüfung (Task 47):</b> Die teilnehmenden Schulen werden <b>nach der finalen Freigabe</b> ausgewählt – in der Regel ca. <b>2 Monate vor der Prüfungsdurchführung</b>. Die Schuladministrationen werden automatisch hinzugefügt und organisieren die Prüfung an ihrer Schule; sie sehen keine anderen beteiligten Schulen. Den Inhalt sehen sie erst im Begutachtungszeitraum.</span></div>
    ${!released(c) ? `<div class="notice warn small mb">${icon("lock")}<span>Die Auswahl der Organisationen ist erst möglich, wenn der Kommissionsvorsitz die Prüfung final freigegeben hat (Status „Verschlüsselt“).</span></div>` : ""}
    <section class="card pad" style="max-width:1000px"><div class="row between wrap"><h3>Teilnehmende Schulen <span class="badge gray" data-orgcount>${sel.size} ausgewählt</span></h3>
      <div class="row wrap" style="gap:8px"><div class="search" style="width:280px"><input class="input" data-orgq placeholder="Schule, Kürzel oder Ort suchen" aria-label="Schulen suchen">${icon("search")}</div>
      ${b ? `<label class="checkbox small"><input type="checkbox" data-orgberuf checked> nur Schulen mit „${esc(b.name)}“</label>` : ""}</div></div>
      <div class="tablewrap mt-s" style="max-height:440px;overflow:auto"><table class="tbl compact"><thead><tr><th>${can ? `<input type="checkbox" data-orgall aria-label="Alle angezeigten auswählen">` : ""}</th><th>Schule</th><th>Ort</th><th>Ausbildungsberufe</th><th>Schuladministration</th></tr></thead><tbody>
      ${orgs.map((o) => { const admins = D.persons.filter((p) => p.kind === "schuladmin" && p.org === o.id); const has = !bid || (o.berufe || []).includes(bid);
        return `<tr data-orgrow="${esc((o.name + " " + o.short + " " + o.city).toLowerCase())}" data-hasberuf="${has ? 1 : 0}" ${b && !has && !sel.has(o.id) ? "hidden" : ""}><td><input type="checkbox" data-org="${o.id}" ${sel.has(o.id) ? "checked" : ""} ${can ? "" : "disabled"} aria-label="${esc(o.name)}"></td><td><b>${esc(o.name)}</b> <span class="xs muted">${esc(o.short)}</span></td><td class="small">${esc(o.city || "")}</td>
        <td class="xs">${(o.berufe || []).map((x) => `<span class="badge ${x === bid ? "green" : "gray"}" title="${esc(berufById(x)?.name || x)}">${esc(berufById(x)?.nr || x)}</span>`).join(" ")}</td><td class="xs">${admins.map((a) => esc(personName(a))).join(", ") || "–"}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="xs muted mt-s" data-orgempty hidden>Keine Schule gefunden.</p>
    ${can ? `<div class="row end mt"><button class="btn primary" data-act="saveorgs" data-arg="">${icon("save")} Organisationen zuordnen</button></div>` : ""}
    ${course ? `<p class="small mt">${icon("check")} Prüfung an den Schulen angelegt: <b>${esc(course.title)}</b> · ${(course.members || []).filter((m) => m.role === "schuladmin").length} Schuladministration(en) · ${(course.members || []).filter((m) => m.role === "teilnehmer").length + (course.groups || []).length} Teilnehmenden-Zuordnungen · ${D.rooms.filter((x) => x.course === course.id).length} Raumaufsichten</p>` : ""}</section>`;
}
function commissionCard(c, ro) {
  const t = team(c); const fb = fachbereichOf(c); const all = D.groups.filter((g) => g.kind === "kommission"); const gs = fb && all.some((g) => g.fachbereich === fb) ? all.filter((g) => g.fachbereich === fb || g.id === t.kommission_group) : all; const g = byId("groups", t.kommission_group);
  return `<section class="card pad" style="grid-column:1/-1"><div class="row between wrap"><h3>${icon("users")} Kommission und Kommissionsvorsitz <span class="badge ${t.vorsitz.length ? "green" : "yellowb"}">Pflicht</span></h3></div>
    <p class="xs muted">Es wird genau <b>eine Kommission</b> (Gruppe) ${fb ? `des Fachbereichs <b>${esc(fbName(fb))}</b> ` : ""}ausgewählt. Ihr Vorsitz wird automatisch als Kommissionsvorsitz eingetragen.${byCommission(c) ? " Die Kommission übernimmt bei dieser Prüfung auch die Aufgabenerstellung." : ""}</p>
    <div class="row wrap" style="gap:10px;align-items:flex-end"><div class="field" style="margin:0;min-width:320px"><label class="lbl" for="kgsel">Kommission</label><select id="kgsel" class="select" data-kgroup ${ro ? "disabled" : ""}><option value="">Kommission wählen</option>${gs.map((x) => `<option value="${x.id}" ${x.id === t.kommission_group ? "selected" : ""}>${esc(x.name)} (${(x.members || []).length} Mitglieder)</option>`).join("")}</select></div></div>
    ${g ? `<div class="edgrid2 mt-s"><div><div class="small">Kommissionsvorsitz</div><ul class="plist"><li>${icon("user")} <span class="grow">${esc(personName(byId("persons", g.chair)))} <span class="xs muted">${esc(orgsLabel(byId("persons", g.chair)))}</span></span><span class="badge cyan">Vorsitz</span></li></ul></div>
      <div><div class="small">Kommission</div><ul class="plist">${(g.members || []).filter((id) => id !== g.chair).map((id) => `<li>${icon("user")} <span class="grow">${esc(personName(byId("persons", id)))} <span class="xs muted">${esc(orgsLabel(byId("persons", id)))}</span></span></li>`).join("")}</ul></div></div>` : `<p class="small muted mt-s">Noch keine Kommission ausgewählt.</p>`}</section>`;
}
function tabTeam(c, r) {
  const ro = !r.includes("koordination") || released(c); const t = team(c);
  return `<div class="notice info small mb">${icon("shield-check")}<span>Pflichtrollen: ${byCommission(c) ? "" : "<b>Aufgabenerstellung</b> und "}eine <b>Kommission</b> (mit Vorsitz). Beratung, Lektorat und Prüflösung sind optional. <b>Datenschutz:</b> Die Zuordnung sieht nur die Koordinierungsstelle. Die Aufgabenerstellung sieht nur ihre eigenen Mitglieder, die Kommission nur Kommission und Vorsitz; die übrigen Rollen sehen keine Namen.</span></div>
    <div class="edgrid2">${commissionCard(c, ro)}${Object.entries(EROLES).filter(([, d]) => !d.group).map(([k, d]) => { const off = k === "aufgabenerstellung" && byCommission(c);
      return `<section class="card pad ${off ? "muted" : ""}"><div class="row between"><h3>${icon(ROLE_ICON[k])} ${d.label} ${off ? `<span class="badge gray">entfällt</span>` : d.req ? `<span class="badge ${t[k].length ? "green" : "yellowb"}">Pflicht</span>` : `<span class="badge gray">optional</span>`}</h3>${ro || off ? "" : `<button class="btn sm" data-addrole="${k}">${icon("user-round-plus")} Person zuweisen</button>`}</div><p class="xs muted">${off ? "Die Kommission übernimmt die Aufgabenerstellung." : esc(d.hint)}</p>
      ${t[k].length ? `<ul class="plist">${t[k].map((pid) => { const pe = byId("persons", pid); return `<li>${icon("user")} <span class="grow">${esc(personName(pe))} <span class="xs muted">${esc(pe?.org ? orgsLabel(pe) : "IBBW")}</span></span>${ro ? "" : `<button class="iconbtn" data-rmrole="${k}" data-pid="${pid}" aria-label="Zuweisung entfernen">${icon("x")}</button>`}</li>`; }).join("")}</ul>` : `<p class="small muted">Niemand zugewiesen.</p>`}</section>`; }).join("")}</div>`;
}
const poolCard = (u, sel, can) => `<label class="optcard ${sel ? "on" : ""}"><input type="radio" name="pool" data-pool="${u.id}" ${sel ? "checked" : ""} ${can ? "" : "disabled"}><span><b>${esc(u.name)}</b><span class="xs muted">${esc(u.branche || "")} · ${esc(fbName(u.fachbereich))}</span><span class="small">${esc(u.allgemein || "")}</span><span class="xs muted" style="white-space:pre-line">${esc(u.adresse || "")}</span></span></label>`;
function tabPool(c, r) {
  const sel = c.meta?.pool; const fb = fachbereichOf(c);
  const can = (r.includes("kommission") || r.includes("vorsitz") || r.includes("koordination")) && ["vorbereitung", "review"].includes(c.status);
  if (!r.includes("koordination") && !r.includes("kommission") && !r.includes("vorsitz")) {
    const u = poolById(sel);
    return `<p class="small">Unternehmen, auf das sich die Ausgangssituation der Prüfung bezieht. Sie sehen ausschließlich den für diese Prüfung ausgewählten Unternehmenspool.</p>${u ? `<div class="poolgrid">${poolCard(u, true, false)}</div>` : `<div class="empty small">${icon("building-2")}<p>Noch kein Unternehmenspool festgelegt. Die Kommission bzw. die Koordinierungsstelle wählt ihn aus oder legt einen neuen an.</p></div>`}`;
  }
  const list = poolsFor(fb);
  return `<div class="row between wrap"><p class="small" style="margin:0">Kommission oder Koordinierungsstelle legen das Unternehmen fest, auf das sich die Ausgangssituation bezieht (Task 14). Zur Auswahl stehen nur Unternehmenspools des Fachbereichs <b>${esc(fbName(fb) || "–")}</b>. Passt keiner, wird für die Prüfung ein neuer Unternehmenspool angelegt.</p>${can ? `<button class="btn primary sm" data-newpool>${icon("plus")} Neuen Unternehmenspool anlegen</button>` : ""}</div>
    ${!fb ? `<div class="notice warn small mt">${icon("triangle-alert")}<span>Für die Auswahl muss zuerst der Ausbildungsberuf in den Rahmendaten festgelegt sein.</span></div>` : ""}
    ${!sel ? `<div class="notice warn small mt">${icon("triangle-alert")}<span>Noch kein Unternehmenspool ausgewählt. Wählen Sie einen vorhandenen Pool oder legen Sie einen neuen an – ohne Unternehmenspool ist keine finale Freigabe möglich.</span></div>` : ""}
    <div class="poolgrid mt">${list.map((u) => poolCard(u, sel === u.id, can)).join("") || `<div class="empty small">Für diesen Fachbereich ist noch kein Unternehmenspool vorhanden.</div>`}</div>
    ${can ? "" : `<p class="xs muted mt-s">Festlegen können Kommission, Kommissionsvorsitz und Koordinierungsstelle in Vorbereitung und Review.</p>`}`;
}
function tabFeedback(c, r, cont) {
  const s = c.status; const subs = cont.tasks.flatMap((t) => t.subtasks);
  const canLek = r.includes("lektorat") && s === "lektorat" && !c.reviews?.lektorat?.done;
  const canPl = r.includes("pruefloesung") && s === "lektorat" && !c.reviews?.pruefloesung?.done;
  const canBer = r.includes("beratung") && ["vorbereitung", "review"].includes(s);
  const canResolve = (r.includes("kommission") || r.includes("vorsitz")) && s === "review";
  const kind = canLek ? "lektorat" : canPl ? "pruefloesung" : canBer ? "beratung" : "";
  const fb = (c.feedback || []).filter((f) => fbVisible(c, f));
  const res = fb.find((f) => f.kind === "pruefloesung-ergebnis");
  const all = seesAllFeedback(c);
  return `${all ? "" : `<div class="notice info small mb">${icon("shield-check")}<span>Sie sehen nur Ihre eigenen Anmerkungen. Alle Anmerkungen sehen Koordinierungsstelle und Kommission/Kommissionsvorsitz.</span></div>`}
    ${kind ? `<section class="card pad mb"><h3>${kind === "lektorat" ? "Anmerkung des Lektorats erfassen" : kind === "pruefloesung" ? "Anmerkung aus der Prüflösung erfassen" : "Hinweis an die Kommission"}</h3>
      <div class="row wrap" style="gap:10px;align-items:flex-end"><div class="field" style="margin:0;min-width:220px"><label class="lbl">Bezug</label><select class="select" data-fbst><option value="">gesamte Prüfung</option>${subs.map((x) => `<option value="${x.no}">Teilaufgabe ${x.no} ${esc(x.title)}</option>`).join("")}</select></div>
      <div class="field grow" style="margin:0"><label class="lbl">Anmerkung</label><textarea class="input" rows="2" data-fbtext placeholder="${kind === "lektorat" ? "z. B. Formulierung im Arbeitsauftrag missverständlich, Rechtschreibung …" : kind === "pruefloesung" ? "z. B. Angabe fehlt, Zeitbedarf zu hoch, Lösung nicht eindeutig …" : "Hinweis zu den Aufgabenentwürfen …"}"></textarea></div><button class="btn primary" data-act="addfb" data-arg="${kind}">${icon("plus")} Hinzufügen</button></div></section>` : ""}
    ${canPl ? `<section class="card pad mb"><h3>Ergebnis der Prüflösung</h3><p class="xs muted">Lösen Sie die Prüfung im Teilnahmemodus („Im Teilnahmemodus lösen“) und halten Sie Ihr Ergebnis fest.</p>
      <div class="row wrap" style="gap:12px;align-items:flex-end"><div class="field" style="margin:0"><label class="lbl">Benötigte Bearbeitungszeit (Minuten)</label><input class="input" type="number" min="1" data-plmin value="${esc(res?.minutes || "")}" style="width:140px"></div>
      <div class="field" style="margin:0"><label class="lbl">Gesamteinschätzung</label><select class="select" data-plgrade>${["lösbar in der vorgesehenen Zeit", "lösbar, Zeit knapp", "nur mit Anpassungen lösbar"].map((o) => `<option ${res?.text === o ? "selected" : ""}>${o}</option>`).join("")}</select></div>
      <button class="btn" data-act="plresult" data-arg="">${icon("save")} Ergebnis speichern</button></div></section>` : ""}
    ${res ? `<div class="notice ${/Anpassungen/.test(res.text) ? "warn" : "success"} small mb">${icon("circle-check")}<span><b>Prüflösung${fbAuthor(c, res) ? ` (${esc(fbAuthor(c, res))})` : ""}:</b> ${esc(res.text)} · benötigte Zeit ${esc(res.minutes)} Min.${canSeeTab(c, "rahmendaten") ? ` (vorgesehen ${esc(c.meta?.dauer || "–")} Min.)` : ""}</span></div>` : ""}
    <div class="tablewrap"><table class="tbl"><thead><tr><th>Von</th><th>Bezug</th><th>Anmerkung</th><th>Status</th></tr></thead><tbody>${fb.filter((f) => f.kind !== "pruefloesung-ergebnis").length ? fb.filter((f) => f.kind !== "pruefloesung-ergebnis").map((f) => `<tr><td class="small"><b>${esc({ lektorat: "Lektorat", pruefloesung: "Prüflösung", beratung: "Beratung" }[f.kind] || f.kind)}</b><div class="xs muted">${fbAuthor(c, f) ? esc(fbAuthor(c, f)) + " · " : ""}${fmtDateTime(new Date(f.at))}</div></td><td class="small">${f.st ? `Teilaufgabe ${esc(f.st)}` : "gesamte Prüfung"}</td><td>${esc(f.text)}</td>
      <td>${f.resolved ? `<span class="badge green">${icon("check")} eingearbeitet</span>` : canResolve ? `<button class="btn xs" data-resolve="${f.id}">${icon("check")} Als eingearbeitet markieren</button>` : `<span class="badge yellowb">offen</span>`}</td></tr>`).join("") : `<tr><td colspan="4"><div class="empty small">Noch keine Anmerkungen.</div></td></tr>`}</tbody></table></div>`;
}
function tabHistory(c) {
  // Einsichtnahmen im Rahmen der Begutachtung werden nicht protokolliert (übersichtlicher Verlauf)
  return `<p class="small">Erstellungsprozess einsehen (Task 6): Statuswechsel, Zuweisungen und Abschlüsse mit Zeitpunkt und Person. Nur für die Koordinierungsstelle sichtbar.</p><ol class="timeline">${[...hist(c)].filter((h) => h.ev !== "begutachtet").reverse().map((h) => `<li><span class="xs muted">${fmtDateTime(new Date(h.at))}</span><div><b>${esc(h.text)}</b>${h.from ? ` <span class="xs muted">(${esc(ESTATUS[h.from]?.label || h.from)} → ${esc(ESTATUS[h.to]?.label || h.to)})</span>` : ""}<div class="xs muted">${esc(h.by)}</div></div></li>`).join("")}</ol>`;
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
// Organisationen zuordnen (Task 47): Prüfung an den Schulen anlegen bzw. aktualisieren, Schuladministrationen automatisch hinzufügen
async function saveOrgs(c, orgs) {
  const admins = D.persons.filter((p) => p.kind === "schuladmin" && orgs.includes(p.org)).map((p) => p.id);
  let course = examCourse(c);
  if (course) {
    const keep = (course.members || []).filter((m) => m.role !== "schuladmin");
    await upd("courses", course.id, { orgs, title: c.title, members: [...keep, ...admins.map((pid) => ({ person: pid, role: "schuladmin" }))] });
  } else {
    course = await create("courses", { title: c.title, kind: "pruefung", catalog: c.id, org: "", orgs, owner: "", members: admins.map((pid) => ({ person: pid, role: "schuladmin" })), groups: [], status: "in Vorbereitung", exam_code: c.meta?.code || "", description: `Prüfung der Koordinierungsstelle · ${c.meta?.art || ""} · Prüfungstermin ${fmtD(c.meta?.termin)}`, corrections: [], third: {}, korr_end: "", dk_threshold: 1 });
  }
  await upd("catalog", c.id, { meta: { ...(c.meta || {}), orgs, course: course.id }, history: [...hist(c), entry("orgs", `Organisationen zugeordnet: ${orgs.map(orgShort).join(", ") || "keine"} – Schuladministration automatisch hinzugefügt (Task 47)`)] });
  toast("Organisationen zugeordnet", `${orgs.length} Schule(n), ${admins.length} Schuladministration(en) hinzugefügt`);
}
async function selectPool(c, u) {
  const content = isSealed(c) ? c.content : { ...(c.content || {}), company: { ...(c.content?.company || {}), name: u.name, allgemein: u.allgemein || "", adresse: u.adresse || "", kontakt: u.kontakt || "", rechtliches: u.rechtliches || "" } };
  await upd("catalog", c.id, { meta: { ...(c.meta || {}), pool: u.id }, content, history: [...hist(c), entry("pool", `Unternehmenspool festgelegt: ${u.name} (Task 14)`)] });
  toast("Unternehmenspool festgelegt", u.name);
}
export async function newPoolDialog(fb, after) {
  const v = await modal({ title: "Neuen Unternehmenspool anlegen", size: "wide", body: `<p class="small">Der Unternehmenspool wird dem Fachbereich zugeordnet und kann nur von Prüfungen dieses Fachbereichs ausgewählt werden.</p>${poolForm({}, { fbSelect: !fb, fb })}`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("plus")} Anlegen${after ? " und auswählen" : ""}</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = readPoolForm(m); if (!o.name) { m.querySelector("[data-pf=name]").style.borderColor = "var(--red)"; return; } close(o); }) });
  if (!v) return null;
  const u = await savePool({ ...v, fachbereich: fb || v.fachbereich, by: myName(), at: new Date().toISOString() });
  toast("Unternehmenspool angelegt", `${u.name} · ${fbName(u.fachbereich)}`);
  if (after) await after(u);
  return u;
}

// ---------- Zeitgesteuerte Statuswechsel ----------
// Begutachtungszeitraum erreicht → entschlüsseln und für die Schulen bereitstellen; Prüfungsstart erreicht → für die Durchführung freigeben
const busy = new Set();
export async function autoAdvance(force = false) {
  const now = Date.now();
  for (const c of D.catalog.filter((x) => x.status === "gesperrt" || x.status === "begutachtung")) {
    if (busy.has(c.id)) continue;
    try {
      if (c.status === "gesperrt" && unlockAt(c).getTime() <= now && c.sealed && c.vault) {
        busy.add(c.id); const box = await unseal(c.sealed, c.vault);
        await upd("catalog", c.id, { status: "begutachtung", content: box.content, rules: box.rules || [], sealed: null, vault: null, history: [...hist(c), { at: new Date().toISOString(), by: "System (Zeitsteuerung)", ev: "begutachtung", text: `Begutachtungszeitraum erreicht (${reviewHours(c)} h vor Prüfungsstart) – Prüfung entschlüsselt und für die Schulen zur Begutachtung bereitgestellt`, from: "gesperrt", to: "begutachtung" }] });
        if (force) toast("Begutachtung freigeschaltet", "Die Prüfung ist entschlüsselt und für die Schulen einsehbar.");
      } else if (c.status === "begutachtung" && startAt(c).getTime() <= now) {
        busy.add(c.id);
        await upd("catalog", c.id, { status: "veroeffentlicht", history: [...hist(c), { at: new Date().toISOString(), by: "System (Zeitsteuerung)", ev: "veroeffentlicht", text: "Prüfungsstart erreicht – Inhalt für die Durchführung freigegeben", from: "begutachtung", to: "veroeffentlicht" }] });
        const course = examCourse(c); if (course) await upd("courses", course.id, { status: "veröffentlicht" });
        if (force) toast("Prüfungsstart", "Der Inhalt ist für die Durchführung freigegeben.");
      }
    } catch (e) { console.warn("[Zeitsteuerung]", e); } finally { busy.delete(c.id); }
  }
}
// Begutachtung durch Schulleitung/Korrektor:innen: wird nicht im Verlauf protokolliert (sonst unübersichtliche Liste) –
// nur lokal im Browser vermerkt (für die Klickstrecke)
export function noteReview(c, p = me()) {
  if (c?.status !== "begutachtung" || !p || !schoolReviewer(c, p)) return;
  store.lset(`begutachtet.${c.id}.${p.id}`, true);
}
export const reviewedBy = (c, p) => !!store.lget(`begutachtet.${c?.id}.${p?.id}`, false);

// Aktion ausführen (Übersicht, Detailseite, Editor); el liefert Formulareingaben der Detailseite
export async function runAction(id, a, arg = "", el = document) {
  const c = byId("catalog", id); if (!c) return;
  if (a === "go") return navigate(`#/app/erstellung/${id}/${arg}`);
  if (a === "editor") return navigate(`#/app/editor/${id}/aufgaben`);
  if (a === "preview") { store.set("pvfrom", { erstellung: id }); return navigate(`#/app/vorschau/${id}/dashboard`); }
  if (a === "consult") { if (!hasEvent(c, "beratung-eingesehen")) await log(c, "beratung-eingesehen", "Beratung hat die Aufgabenentwürfe eingesehen (Task 16)"); store.set("pvfrom", { erstellung: id }); return navigate(`#/app/vorschau/${id}/dashboard`); }
  if (a === "savemeta") {
    const st = MD.get(id); const meta = { ...(c.meta || {}), ...(st?.meta || {}) }; delete meta._by; delete meta._q;
    el.querySelectorAll("[data-meta]").forEach((f) => (meta[f.dataset.meta] = f.type === "number" ? (f.value === "" ? "" : +f.value) : f.value.trim()));
    const cb = el.querySelector("[data-meta-cb=kommission_erstellt]"); if (cb && !cb.disabled) meta.kommission_erstellt = cb.checked;
    const bp = el.querySelector("[data-bpick]"); if (bp && !bp.querySelector("[data-bsel]").disabled) Object.assign(meta, { beruf_id: bp.querySelector("[data-bsel]").value, ptitel: bp.querySelector("[data-bt]").value, zeitraum: bp.querySelector("[data-bz]").value, jahr: bp.querySelector("[data-bj]").value });
    Object.assign(meta, berufMeta(meta)); if (!meta.titel) meta.titel = c.title;
    if (lockedBy(id, "rahmendaten")) return toast("Gesperrt", "Die Rahmendaten werden gerade von einer anderen Person bearbeitet.", "error");
    const content = isSealed(c) ? c.content : { ...(c.content || {}), name: meta.titel || c.title, duration_min: +meta.dauer || c.content?.duration_min || 90 };
    if (!isSealed(c) && meta.hilfsmittel) content.info = { title: "Prüfungsinformationen", items: [["Bearbeitungszeit", `${meta.dauer || 90} Minuten zzgl. individueller Zusatzzeit`], ["Zugelassene Hilfsmittel", meta.hilfsmittel], ...((content.info?.items || []).filter((x) => !["Bearbeitungszeit", "Zugelassene Hilfsmittel"].includes(x[0])))] };
    const probe = { ...c, meta }; const first = !metaMissing(probe).length && metaMissing(c).length;
    const toKom = meta.kommission_erstellt && !c.meta?.kommission_erstellt && c.status === "vorbereitung";
    const h = [...hist(c), ...(first ? [entry("metadaten", "Prüfungsmetadaten vollständig gesetzt (Task 2)")] : []), ...(toKom ? [entry("review-start", "Die Kommission übernimmt die Aufgabenerstellung – Start im Status Kommission/Review", { from: "vorbereitung", to: "review" })] : [])];
    const tm = toKom ? { team: { ...team(c), aufgabenerstellung: [] } } : {};
    await upd("catalog", id, { meta, title: meta.titel || c.title, beruf: meta.beruf || c.beruf, fach: meta.bereich || c.fach, duration: `${meta.dauer || 90} Minuten`, jahr: meta.jahr || c.jahr, ...(isSealed(c) ? {} : { content }), history: h, ...(toKom ? { status: "review" } : {}), ...tm });
    MD.delete(id);
    if (toKom) toast("Status: Kommission / Review", "Die Kommission übernimmt die Aufgabenerstellung.");
    return toast("Rahmendaten gespeichert", metaMissing(probe).length ? `Noch offen: ${metaMissing(probe).join(", ")}` : "Alle Pflichtfelder sind befüllt.");
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
    if (!c.meta?.pool) return toast("Freigabe noch nicht möglich", "Es ist kein Unternehmenspool ausgewählt. Wählen Sie einen vorhandenen Pool oder legen Sie einen neuen an (Reiter „Unternehmenspool“).", "error");
    if (!(await confirmBox("Prüfung final freigeben", `<p>Die Prüfung wird final freigegeben (Statuswechsel Nr. 5 → <b>verschlüsselt</b>) und ist bis zum Begutachtungszeitraum vor dem Prüfungsstart (${fmtD(c.meta?.termin)}) weggesperrt.</p>${open ? `<div class="notice warn small">${icon("triangle-alert")}<span>${open} Anmerkung(en) sind noch nicht als eingearbeitet markiert.</span></div>` : ""}`, "Final freigeben", "Abbrechen", false))) return;
    // Inhalt und Aufgabensteuerung verschlüsseln; im Datensatz verbleibt nur ein Platzhalter
    const box = await seal({ content: c.content, rules: c.rules || [] });
    const placeholder = { name: c.title, duration_min: c.content?.duration_min || 90, sealed: true, tasks: [] };
    await setStatus(c, "gesperrt", "freigegeben", `Prüfung final freigegeben, verschlüsselt (${box.sealed.alg}) und weggesperrt – Fingerabdruck ${fingerprint(box.sealed)} (Task 12)`, { sealed: box.sealed, vault: box.vault, content: placeholder, rules: [] });
    return;
  }
  if (a === "unlock") { if (!(await confirmBox("Prüfungsfreigabe aufheben", "Die Prüfung wird entschlüsselt und geht zurück an die Kommission (Review); sie muss danach erneut final freigegeben werden (Task 8).", "Freigabe aufheben", "Abbrechen", false))) return; const box = await unseal(c.sealed, c.vault); return setStatus(c, "review", "freigabe-aufgehoben", "Prüfungsfreigabe durch die Koordinierungsstelle aufgehoben und entschlüsselt (Task 8)", { content: box.content, rules: box.rules || [], sealed: null, vault: null }); }
  if (a === "demounlock") { await upd("catalog", id, { meta: { ...(c.meta || {}), unlock_override: new Date().toISOString() } }); await autoAdvance(true); return; }
  if (a === "demostart") { if (!(await confirmBox("Prüfungsstart simulieren", "Der Prüfungsstart wird für die Demo auf jetzt gesetzt. Der Inhalt wird für die Durchführung freigegeben; danach sind keine Korrekturen am Inhalt mehr möglich.", "Prüfungsstart jetzt", "Abbrechen", false))) return; await upd("catalog", id, { meta: { ...(c.meta || {}), start_override: new Date().toISOString() } }); await autoAdvance(true); return; }
  if (a === "saveorgs") { if (!["gesperrt", "begutachtung"].includes(c.status)) return toast("Noch nicht möglich", "Organisationen werden nach der finalen Freigabe zugeordnet.", "error"); return saveOrgs(c, [...el.querySelectorAll("[data-org]:checked")].map((x) => x.dataset.org)); }
  if (a === "addfb") {
    const text = el.querySelector("[data-fbtext]").value.trim(); if (!text) return toast("Anmerkung fehlt", "", "error");
    const f = { id: Math.random().toString(36).slice(2, 10), kind: arg, by: myName(), pid: me()?.id || "", at: new Date().toISOString(), st: el.querySelector("[data-fbst]").value, text, resolved: false };
    await upd("catalog", id, { feedback: [...(c.feedback || []), f] }); return toast("Anmerkung erfasst");
  }
  if (a === "plresult") {
    const minutes = +el.querySelector("[data-plmin]").value; if (!minutes) return toast("Bearbeitungszeit fehlt", "", "error");
    const f = { id: "pl", kind: "pruefloesung-ergebnis", by: myName(), pid: me()?.id || "", at: new Date().toISOString(), minutes, text: el.querySelector("[data-plgrade]").value, resolved: true };
    await upd("catalog", id, { feedback: [...(c.feedback || []).filter((x) => x.kind !== "pruefloesung-ergebnis"), f] }); return toast("Ergebnis der Prüflösung gespeichert");
  }
}
function bindDetail(el, id, tab) {
  const C = () => byId("catalog", id);
  el.querySelectorAll("[data-act]").forEach((b) => (b.onclick = () => runAction(id, b.dataset.act, b.dataset.arg || "", el)));
  el.querySelectorAll("[data-addrole]").forEach((b) => (b.onclick = () => pickPerson(C(), b.dataset.addrole)));
  const kg = el.querySelector("[data-kgroup]"); if (kg) kg.onchange = async () => {
    const c = C(); const g = byId("groups", kg.value); const t = team(c);
    const nt = { ...t, kommission_group: g?.id || "", kommission: g ? (g.members || []).filter((x) => x !== g.chair) : [], vorsitz: g?.chair ? [g.chair] : [] };
    await upd("catalog", id, { team: nt, history: [...hist(c), entry("team", g ? `Kommission „${g.name}“ zugewiesen – Vorsitz: ${personName(byId("persons", g.chair))}` : "Kommission entfernt")] });
    toast(g ? "Kommission zugewiesen" : "Kommission entfernt", g ? `Vorsitz: ${personName(byId("persons", g.chair))}` : "");
  };
  el.querySelectorAll("[data-rmrole]").forEach((b) => (b.onclick = async () => { const c = C(); const t = team(c); const k = b.dataset.rmrole; await upd("catalog", id, { team: { ...t, [k]: t[k].filter((x) => x !== b.dataset.pid) }, history: [...hist(c), entry("team", `${EROLES[k].label}: ${personName(byId("persons", b.dataset.pid))} entfernt`)] }); }));
  el.querySelectorAll("[data-pool]").forEach((r) => (r.onchange = () => { const u = poolById(r.dataset.pool); if (u) selectPool(C(), u); }));
  const np = el.querySelector("[data-newpool]"); if (np) np.onclick = () => newPoolDialog(fachbereichOf(C()), (u) => selectPool(C(), u));
  el.querySelectorAll("[data-resolve]").forEach((b) => (b.onclick = async () => { const c = C(); await upd("catalog", id, { feedback: (c.feedback || []).map((f) => (f.id === b.dataset.resolve ? { ...f, resolved: true, resolved_by: myName() } : f)) }); toast("Als eingearbeitet markiert"); }));
  // Rahmendaten: Auswahl Ausbildungsberuf / Prüfungstitel / Prüfungsjahr (ungespeicherter Stand bleibt beim Neuzeichnen erhalten)
  const host = el.querySelector("[data-bphost]");
  if (host && tab === "rahmendaten") {
    const c = C(); const cur = () => { const st = MD.get(id); const m = { ...(st?.meta || { ...(c.meta || {}), beruf_id: c.meta?.beruf_id || berufByName(c.meta?.beruf || c.beruf)?.id || "" }) }; el.querySelectorAll("[data-meta]").forEach((f) => (m[f.dataset.meta] = f.type === "number" ? (f.value === "" ? "" : +f.value) : f.value)); const cb = el.querySelector("[data-meta-cb]"); if (cb) m.kommission_erstellt = cb.checked; return m; };
    bindBerufPicker(host, cur(), (s) => { MD.set(id, { meta: { ...cur(), ...s }, base: C().updated, dirty: true }); redraw(); const q = document.querySelector("[data-bq]"); if (s._q !== undefined && q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } });
    const cb = el.querySelector("[data-meta-cb]"); if (cb) cb.onchange = () => { MD.set(id, { meta: cur(), base: C().updated, dirty: true }); redraw(); };
    el.querySelectorAll("[data-meta]").forEach((f) => f.addEventListener("change", () => MD.set(id, { meta: cur(), base: C().updated, dirty: true })));
  }
  // Organisationen: Suche und Filter nach Ausbildungsberuf
  const oq = el.querySelector("[data-orgq]");
  if (oq) {
    const ob = el.querySelector("[data-orgberuf]");
    const filt = () => { const q = oq.value.toLowerCase().trim(); let n = 0; el.querySelectorAll("[data-orgrow]").forEach((tr) => { const cb = tr.querySelector("[data-org]"); const vis = (!q || tr.dataset.orgrow.includes(q)) && (!ob || !ob.checked || tr.dataset.hasberuf === "1" || cb.checked); tr.hidden = !vis; if (vis) n++; }); el.querySelector("[data-orgempty]").hidden = n > 0; };
    oq.oninput = filt; if (ob) ob.onchange = filt;
    const cnt = () => (el.querySelector("[data-orgcount]").textContent = `${el.querySelectorAll("[data-org]:checked").length} ausgewählt`);
    el.querySelectorAll("[data-org]").forEach((x) => x.addEventListener("change", cnt));
    const all = el.querySelector("[data-orgall]"); if (all) all.onchange = () => { el.querySelectorAll("[data-orgrow]").forEach((tr) => { if (!tr.hidden) tr.querySelector("[data-org]").checked = all.checked; }); cnt(); };
  }
}

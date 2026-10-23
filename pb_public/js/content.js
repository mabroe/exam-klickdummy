// Aktiven Prüfungs-/Kursinhalt bestimmen: Katalogeintrag (Vorschau, Editor), Teilnahme (Prüfling, Korrektur, Einsicht) oder Kurs
import { D, byId } from "./data.js?v=9.3";
import { useContent, defaultContent } from "./scenario.js?v=9.3";

export const hasOwnContent = (cat) => !!(cat?.content && Array.isArray(cat.content.tasks) && cat.content.tasks.length);
export const catalogOfCourse = (c) => byId("catalog", c?.catalog);
export const catalogOfParticipant = (p) => catalogOfCourse(byId("courses", byId("rooms", p?.room)?.course));
// Verschlüsselte Prüfung: kein Inhalt verfügbar (Platzhalter statt Rückfall auf die Musterprüfung)
const SEALED = { name: "Inhalt verschlüsselt", tasks: [{ title: "Inhalt verschlüsselt", situation: "", tools: [], materials: [], subtasks: [] }] };
export function useCatalog(cat) {
  if (cat?.content?.sealed || cat?.status === "gesperrt") return useContent(SEALED, `sealed:${cat.id}`);
  if (hasOwnContent(cat)) return useContent(cat.content, `${cat.id}@${cat.updated || ""}`);
  return useContent(null, "default");
}
export const useParticipant = (p) => useCatalog(catalogOfParticipant(p));
export const useCourse = (c) => useCatalog(catalogOfCourse(c));

// Bereitgestellte Materialien eines Inhalts (werden beim ersten Login je Teilnahme kopiert)
//  - eigener Inhalt: content.tasks[].materials
//  - Musterprüfung: globale Elemente (participant = "")
// Relative Zeitangaben (E-Mails, Tickets: „vor n Tagen, Stunden, Minuten“; Termine: „n Tage nach Prüfungsbeginn“) werden beim
// Bereitstellen in ein Datum umgerechnet – Bezug ist der Beginn der Bearbeitung (erster Login) bzw. der Aufruf der Vorschau
const p2 = (n) => String(n).padStart(2, "0");
const fmtDT = (d) => `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
export function resolveTimes(kind, data, base = new Date()) {
  if (data?.relmode !== "rel") return data;
  const out = { ...data };
  if (kind === "event") {
    const t = new Date(base.getTime() + (+data.rel_d || 0) * 86400000); out.day = Math.min(4, (t.getDay() + 6) % 7); out.date = t.toLocaleDateString("de-DE");
  } else {
    const t = new Date(base.getTime() - (((+data.rel_d || 0) * 24 + (+data.rel_h || 0)) * 60 + (+data.rel_m || 0)) * 60000);
    if (kind === "mail") out.date = fmtDT(t);
    if (kind === "ticket") out.created = fmtDT(t).replace(" ", ", ");
  }
  return out;
}
export const relLabel = (kind, d) => (d?.relmode !== "rel" ? "" : kind === "event" ? `${+d.rel_d || 0} Tag(e) nach Prüfungsbeginn` : `vor ${+d.rel_d || 0} T ${+d.rel_h || 0} h ${+d.rel_m || 0} min`);
export function materialsOf(cat, base = new Date()) {
  if (cat?.status && !["veroeffentlicht", "begutachtung"].includes(cat.status) && cat.editor_by === "prozess") return []; // Inhalt (noch) nicht freigegeben
  if (!hasOwnContent(cat)) return D.items.filter((i) => i.participant === "").map((i) => ({ kind: i.kind, folder: i.folder, data: { ...i.data } }));
  const out = [];
  for (const t of cat.content.tasks || []) {
    const files = (t.materials || []).filter((m) => m.kind === "file");
    for (const m of t.materials || []) {
      const data = { ...(m.data || {}), task: t.no };
      if (m.kind === "mail") data.attach_urls = Object.fromEntries((data.attachments || []).map((a) => [a, files.find((f) => f.data?.name === a)?.data?.url || ""]));
      out.push({ kind: m.kind, folder: m.folder || FOLDER[m.kind] || m.kind, data: resolveTimes(m.kind, data, base) });
    }
  }
  return out;
}
export const FOLDER = { file: "provided", mail: "inbox", event: "calendar", ticket: "tickets", code: "ide", erp: "erp", note: "notes" };

// Musterprüfung als bearbeitbarer Inhalt (Editor): Aufgaben plus globale Materialien je Aufgabe
export function contentFromDefault() {
  const c = defaultContent();
  const globals = D.items.filter((i) => i.participant === "");
  c.tasks.forEach((t) => { t.materials = globals.filter((i) => String(i.data?.task || "1") === t.no).map((i) => ({ id: i.id, kind: i.kind, folder: i.folder, data: { ...i.data } })); });
  return c;
}

// Kontext aus der Route ableiten (vor dem Rendern einer Ansicht)
export function syncForRoute(path, session) {
  let m;
  if ((m = path.match(/^app\/vorschau\/([^/]+)/))) return useCatalog(byId("catalog", m[1]));
  if ((m = path.match(/^app\/(?:korrektur|vergleich)\/([^/]+)\//)) || (m = path.match(/^app\/(?:einsicht|pruefungseinsicht)\/([^/]+)$/))) return useParticipant(byId("participants", m[1]));
  if (/^tn/.test(path)) return useParticipant(byId("participants", session.pid));
  if (/^erwartung\//.test(path)) { const pid = sessionStorage.getItem("cbw.lastKorrP"); return useParticipant(byId("participants", pid ? JSON.parse(pid) : "")); }
  if ((m = path.match(/^app\/kurs\/([^/]+)/))) return useCourse(byId("courses", m[1]));
  if (/^app\/editor/.test(path)) return false; // der Editor aktiviert seinen Entwurf selbst
  return useContent(null, "default");
}

// Übersichten (Korrektur, Ergebnisse) mit Teilnahmen unterschiedlicher Inhalte: Auswahl des Inhalts, Spalten folgen dem Inhalt
const keyOf = (cat) => (hasOwnContent(cat) ? cat.id : "default");
export function contentScope(ps) {
  const groups = new Map();
  ps.forEach((p) => { const cat = catalogOfParticipant(p); const k = keyOf(cat); if (!groups.has(k)) groups.set(k, { key: k, cat, ps: [], label: hasOwnContent(cat) ? cat.title : "Musterprüfung FA230 (Standardinhalt)" }); groups.get(k).ps.push(p); });
  const list = [...groups.values()];
  let sel = null; try { sel = JSON.parse(sessionStorage.getItem("cbw.contentSel") || "null"); } catch {}
  const g = list.find((x) => x.key === sel) || list[0];
  if (g) useCatalog(g.cat); else useContent(null, "default");
  const select = list.length > 1 ? `<label class="row small" style="gap:6px">Inhalt <select class="select" style="width:auto" data-contentsel>${list.map((x) => `<option value="${x.key}" ${x === g ? "selected" : ""}>${x.label.replace(/[<>&"]/g, "")} (${x.ps.length})</option>`).join("")}</select></label>` : "";
  return { ps: g ? g.ps : [], select };
}

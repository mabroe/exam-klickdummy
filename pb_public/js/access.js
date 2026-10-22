// Konten, Kursmitgliedschaften und Sichtbarkeitsregeln
//  - Lehrkraft (Unterrichtsebene): sieht Raumaufsichten, die ihren Account betreffen – Eigentümer, Aufsichtsperson oder
//    Besitzer/Mitbetreuung des Unterrichtskurses
//  - Raumaufsicht (Prüfungsebene): sieht nur Raumaufsichten, in denen sie als Aufsichtsperson eingetragen ist
//  - Schuladministration (Prüfungsebene): sieht die Prüfungs-Raumaufsichten ihrer Organisation
import { D, byId } from "./data.js?v=8.6";
import { store, isFinished } from "./ui.js?v=8.6";

export const me = () => byId("persons", store.get("person"));
export const orgOf = (p) => byId("orgs", p?.org);
// Lehrkräfte können mehreren Organisationen angehören (org = Stammschule, orgs = weitere)
export const orgIds = (p) => (p ? [p.org, ...((p.orgs || []).filter((o) => o && o !== p.org))] : []);
export const inOrg = (p, orgId) => !!orgId && orgIds(p).includes(orgId);
export const sameOrg = (a, b) => { const B = orgIds(b); return orgIds(a).some((o) => B.includes(o)); };
export const orgsLabel = (p) => orgIds(p).map((o) => byId("orgs", o)?.short || "–").join(" · ");
export const orgName = (id) => byId("orgs", id)?.name || "–";
export const orgShort = (id) => byId("orgs", id)?.short || "–";
export const personName = (p) => (p ? `${p.lastname}, ${p.firstname}` : "–");
export const courseOf = (room) => byId("courses", room?.course);
export const KIND = { unterricht: "Unterricht", pruefung: "Prüfung" };
export const ROLE_LABEL = { besitzer: "Besitzer", mitbetreuung: "Mitbetreuung", teilnehmer: "Teilnehmende", raumaufsicht: "Raumaufsicht", korrektor: "Korrektor:in", pruefungseinsicht: "Prüfungseinsicht" };
export const STAGE_LABEL = { 1: "Erstkorrektur", 2: "Zweitkorrektur", 3: "Drittkorrektur" };

// Alle Mitglieder eines Kurses, Gruppen aufgelöst: [{ person, role, stage, via }]
export function members(c) {
  if (!c) return [];
  const out = (c.members || []).map((m) => ({ ...m, via: "" }));
  for (const g of c.groups || []) {
    const gr = byId("groups", g.group); if (!gr) continue;
    for (const pid of gr.members || []) if (!out.some((m) => m.person === pid && m.role === g.role)) out.push({ person: pid, role: g.role, via: gr.name });
  }
  return out;
}
export const rolesIn = (c, pid) => members(c).filter((m) => m.person === pid);
export const hasRole = (c, pid, ...roles) => rolesIn(c, pid).some((m) => roles.includes(m.role));
export const isTeacherOf = (c, pid) => c?.kind === "unterricht" && (c.owner === pid || hasRole(c, pid, "besitzer", "mitbetreuung"));

// Kurse, die eine Person verwalten darf
export function canManageCourse(c, p = me()) {
  if (!c || !p) return false;
  if (p.kind === "schuladmin") return c.kind === "pruefung" && (c.orgs || []).includes(p.org);
  if (p.kind === "lehrkraft") return isTeacherOf(c, p.id);
  return false;
}
export function visibleCourses(p = me()) {
  if (!p) return [];
  if (p.kind === "schuladmin") return D.courses.filter((c) => c.kind === "pruefung" && (c.orgs || []).includes(p.org));
  if (p.kind === "lehrkraft") return D.courses.filter((c) => isTeacherOf(c, p.id));
  return [];
}
export const supervisesRoom = (room, pid) => D.supervisors.some((s) => s.room === room.id && s.person === pid);
export function canSeeRoom(room, p = me()) {
  if (!room) return false;
  if (!p) return false; // ohne Konto keine Raumaufsichten (Anmeldung über die Personenwahl)
  const c = courseOf(room);
  if (p.kind === "schuladmin") return room.org === p.org && (!c || c.kind === "pruefung");
  if (p.kind === "lehrkraft") return room.owner === p.id || supervisesRoom(room, p.id) || isTeacherOf(c, p.id);
  return false;
}
export const visibleRooms = (p = me()) => D.rooms.filter((r) => canSeeRoom(r, p));
// Darf Teilnehmende/Aufsichten zuordnen (Eigentümer, Schuladmin der Organisation, Lehrkraft des Unterrichtskurses, Aufsichtsperson)
export const canManageRoom = (room, p = me()) => canSeeRoom(room, p);
// Teilnehmende und Aufsichten, die einer Raumaufsicht zugeordnet werden können (aus den Kursmitgliedern)
export function roomCandidates(room, kind, p = me()) {
  const c = courseOf(room); if (!c) return [];
  const roles = kind === "teilnehmer" ? ["teilnehmer"] : c.kind === "pruefung" ? ["raumaufsicht"] : ["besitzer", "mitbetreuung"];
  const ids = [...new Set(members(c).filter((m) => roles.includes(m.role)).map((m) => m.person))];
  let list = ids.map((id) => byId("persons", id)).filter(Boolean);
  if (c.kind === "pruefung" && room.org) list = list.filter((x) => inOrg(x, room.org)); // Prüfung: nur Personen der Organisation des Raums
  return list.sort((a, b) => a.lastname.localeCompare(b.lastname));
}
// Unterricht: genau eine korrigierende Lehrkraft (Standard: Besitzer); sie kann die Korrektur an eine andere Lehrkraft des Kurses weitergeben
export const lessonCorrector = (c) => (c?.corrector && isTeacherOf(c, c.corrector) ? c.corrector : c?.owner || "");
export const lessonTeachers = (c) => [...new Set(members(c).filter((m) => ["besitzer", "mitbetreuung"].includes(m.role)).map((m) => m.person).concat(c?.owner ? [c.owner] : []))].map((id) => byId("persons", id)).filter(Boolean);
// ---------- Korrektur (Prüfung): Korrektorengruppen je Korrekturstufe ----------
// course.corrections = [{ id, stage: 1|2|3, kind: "group"|"person", target: Gruppen- bzw. Personen-ID, correctors: [Personen-IDs], org }]
//  - Zuweisung für eine Prüflingsgruppe (Klasse/Kurs) oder einzelne Prüflinge; Einzelzuweisung hat Vorrang
//  - alle Mitglieder einer Korrektorengruppe sehen die gesamte Leistung und erfassen gemeinsam eine Bewertung je Stufe
//  - Endbeurteilung (Stufe 3) wirkt nur, wenn die Schuladministration sie für den Prüfling angefordert hat (course.third)
export const assignments = (c) => (c?.corrections || []).filter((a) => a && a.stage);
export const courseOfParticipant = (p) => courseOf(byId("rooms", p?.room));
export function assignmentFor(c, p, stage) {
  if (!c || !p) return null;
  const l = assignments(c).filter((a) => +a.stage === +stage);
  return l.find((a) => a.kind === "person" && a.target === p.person) || l.find((a) => a.kind === "group" && (byId("groups", a.target)?.members || []).includes(p.person)) || null;
}
export const thirdRequested = (c, p) => !!(c?.third || {})[p?.id]?.requested;
export function correctorsFor(c, p, stage) {
  if (!c) return [];
  if (c.kind === "unterricht") return +stage === 1 && lessonCorrector(c) ? [lessonCorrector(c)] : [];
  return assignmentFor(c, p, stage)?.correctors || [];
}
export function canCorrect(c, p, stage, pid) {
  if (!c || !pid) return false;
  if (c.kind === "pruefung" && +stage === 3 && !thirdRequested(c, p)) return false;
  return correctorsFor(c, p, stage).includes(pid);
}
// Stufen, in denen eine Person in einem Kurs korrigiert
export function correctorStages(c, pid) {
  if (!c) return [];
  if (c.kind === "unterricht") return lessonCorrector(c) === pid ? [1] : [];
  return [...new Set(assignments(c).filter((a) => (a.correctors || []).includes(pid)).map((a) => +a.stage))].sort();
}
// Kompatibilität: niedrigste Stufe der Person im Kurs (0 = keine)
export const correctorStage = (c, pid) => correctorStages(c, pid)[0] || 0;
// Korrekturzeitraum (Freigaben können nur bis zum Ende zurückgezogen werden)
export const correctionOver = (c) => { if (!c?.korr_end) return false; const d = new Date(c.korr_end + "T23:59:59"); return Date.now() > d.getTime(); };
// Freigabestand der gemeinsamen Bewertung eines Prüflings in einer Stufe
export function approvalStateFor(c, p, stage) {
  const assignment = c?.kind === "pruefung" ? assignmentFor(c, p, stage) : null;
  const group = correctorsFor(c, p, stage);
  const g = D.gradings.find((x) => x.participant === p.id && +x.corrector === +stage);
  const ok = (g?.approvals || []).filter((x) => group.includes(x));
  return { assignment, group, n: ok.length, of: group.length, final: group.length > 0 && ok.length === group.length };
}

// ---------- Einsicht der eigenen Ergebnisse ----------
//  - Prüfung: keine Freigabe und kein eigenständiger Zugriff – die Einsicht findet immer in Präsenz statt; eine Person mit der Rolle
//    „Prüfungseinsicht“ (Kursmitglied der Prüfung, Schule des Prüfungsraums) meldet sich an und bleibt während der Einsicht dabei.
//    Inhalt: Endnote und Abgabe mit Korrekturzeichen
//  - Unterricht: nach Freigabe der Durchführung durch die Lehrkraft; Inhalt: Korrektur und Ergebnisse (Punkte, Note, Begründung, Korrekturzeichen)
export function einsichtFor(p) {
  const room = byId("rooms", p?.room); const c = courseOf(room);
  if (!p || !c || c.kind !== "unterricht" || !isFinished(p.status) || p.status === "nicht_teilnahme" || !room.released) return null;
  return "unterricht";
}
// Personen mit der Rolle „Prüfungseinsicht“ und die Prüflinge, deren Einsicht sie begleiten dürfen
export const einsichtCourses = (pe = me()) => (pe ? D.courses.filter((c) => c.kind === "pruefung" && hasRole(c, pe.id, "pruefungseinsicht")) : []);
export const einsichtPersons = () => D.persons.filter((pe) => einsichtCourses(pe).length);
export function einsichtCandidates(pe = me()) {
  const cs = new Set(einsichtCourses(pe).map((c) => c.id));
  return D.participants.filter((x) => { const r = byId("rooms", x.room); return r && cs.has(r.course) && inOrg(pe, r.org) && isFinished(x.status) && x.status !== "nicht_teilnahme"; });
}

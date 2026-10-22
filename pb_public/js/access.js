// Konten, Kursmitgliedschaften und Sichtbarkeitsregeln
//  - Lehrkraft (Unterrichtsebene): sieht Raumaufsichten, die ihren Account betreffen – Eigentümer, Aufsichtsperson oder
//    Besitzer/Mitbetreuung des Unterrichtskurses
//  - Raumaufsicht (Prüfungsebene): sieht nur Raumaufsichten, in denen sie als Aufsichtsperson eingetragen ist
//  - Schuladministration (Prüfungsebene): sieht die Prüfungs-Raumaufsichten ihrer Organisation
import { D, byId } from "./data.js?v=8.2";
import { store } from "./ui.js?v=8.2";

export const me = () => byId("persons", store.get("person"));
export const orgOf = (p) => byId("orgs", p?.org);
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
  if (c.kind === "pruefung" && room.org) list = list.filter((x) => x.org === room.org); // Prüfung: nur Personen der Organisation des Raums
  return list.sort((a, b) => a.lastname.localeCompare(b.lastname));
}
// Unterricht: genau eine korrigierende Lehrkraft (Standard: Besitzer); sie kann die Korrektur an eine andere Lehrkraft des Kurses weitergeben
export const lessonCorrector = (c) => (c?.corrector && isTeacherOf(c, c.corrector) ? c.corrector : c?.owner || "");
export const lessonTeachers = (c) => [...new Set(members(c).filter((m) => ["besitzer", "mitbetreuung"].includes(m.role)).map((m) => m.person).concat(c?.owner ? [c.owner] : []))].map((id) => byId("persons", id)).filter(Boolean);
// Korrekturberechtigung: Prüfung → Korrektor:in mit Stufe, Unterricht → die korrigierende Lehrkraft des Kurses (eine Korrektur)
export function correctorStage(c, pid) {
  if (!c) return 0;
  if (c.kind === "unterricht") return lessonCorrector(c) === pid ? 1 : 0;
  return rolesIn(c, pid).filter((m) => m.role === "korrektor").map((m) => +m.stage || 1)[0] || 0;
}

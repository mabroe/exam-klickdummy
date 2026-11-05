// Konten, Kursmitgliedschaften und Sichtbarkeitsregeln
//  - Lehrkraft (Unterrichtsebene): sieht Raumaufsichten, die ihren Account betreffen – Eigentümer, Aufsichtsperson oder
//    Besitzer/Mitbetreuung des Unterrichtskurses
//  - Raumaufsicht (Prüfungsebene): sieht nur Raumaufsichten, in denen sie als Aufsichtsperson eingetragen ist
//  - Schuladministration (Prüfungsebene): sieht die Prüfungs-Raumaufsichten ihrer Organisation
import { D, byId } from "./data.js?v=10.0";
import { store, isFinished } from "./ui.js?v=10.0";

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
// ---------- Kammern und externe Prüflinge ----------
//  - Kammern sind eigene Organisationen (orgs.type = "kammer"); Schulen gehören einem Kammerbezirk an (orgs.bezirk)
//  - Kammeradministration (persons.kind "kammeradmin") verwaltet ihre externen Prüflinge (kind "extern", mit Prüflingsnummer und NTA)
//    und vergibt Rollen innerhalb der Kammer (Personen kind "kammer": Raumaufsicht, Korrektur, Prüfungseinsicht)
//  - Zuordnung je Prüfling und Prüfung in course.ext[personId] = { art, school, status, hist }
//    Art 1: Kammer prüft selbst · Art 2: Durchführung und Korrektur an der Schule · Art 3: nur Durchführung an der Schule, Korrektur durch die Kammer
//    Art 4: Kammer prüft selbst, Korrektur durch bereite Lehrkräfte der Schulen (pseudonymisiert)
//    Status bei Art 2/3: vorgeschlagen → angenommen | abgelehnt (Annahme immer durch die Schuladministration)
export const isAdm = (p) => p?.kind === "schuladmin" || p?.kind === "kammeradmin";
export const isKammerOrg = (id) => byId("orgs", id)?.type === "kammer";
export const isExtern = (pe) => pe?.kind === "extern";
export const ART = {
  1: { short: "Kammer", label: "Kammer prüft selbst", text: "Durchführung und Korrektur durch die Kammer" },
  2: { short: "Schule: Durchführung + Korrektur", label: "Durchführung und Korrektur an der Schule", text: "Die Schule führt durch und korrigiert" },
  3: { short: "Schule: nur Durchführung", label: "Nur Durchführung an der Schule", text: "Die Schule führt durch, die Kammer korrigiert" },
  4: { short: "Kammer, Korrektur Lehrkräfte", label: "Kammer prüft, Korrektur durch Lehrkräfte der Schulen", text: "Durchführung durch die Kammer, Korrektur durch bereite Lehrkräfte (pseudonymisiert)" },
};
export const EXT_STATUS = { vorgeschlagen: ["Annahme durch die Schule offen", "yellowb"], angenommen: ["von der Schule angenommen", "green"], abgelehnt: ["von der Schule abgelehnt", "red"], kammer: ["bei der Kammer", "cyan"] };
export const extOf = (c, pid) => (c?.ext || {})[pid] || null;
export const atSchool = (e) => !!e && [2, 3].includes(+e.art);
export const extAccepted = (e) => !!e && atSchool(e) && e.status === "angenommen";
export const extPerson = (p) => { const pe = byId("persons", p?.person); return isExtern(pe) ? pe : null; };
export const extEntryP = (p) => { const pe = extPerson(p); return pe ? extOf(byId("courses", byId("rooms", p.room)?.course), pe.id) || {} : null; };
// Organisation, die einen Prüfling korrigiert: Schule des Raums bzw. bei externen Prüflingen Schule (Art 2) oder Kammer
export function correctionOrg(c, p) {
  const pe = extPerson(p); if (!pe) return byId("rooms", p?.room)?.org || "";
  const e = extOf(c, pe.id); return extAccepted(e) && +e.art === 2 ? e.school : pe.org;
}
// Pseudonymisierung (Art 4): Lehrkräfte der Schulen sehen externe Prüflinge nur mit Prüflingsnummer
export const masked = (p, viewer = me()) => { const e = extEntryP(p); return !!e && +e.art === 4 && !!viewer && !isKammerOrg(viewer.org) && viewer.kind !== "kammeradmin"; };
export const pnrOf = (p) => extPerson(p)?.pnr || "–";
export const maskP = (p) => (p && masked(p) ? { ...p, lastname: "Prüfling", firstname: pnrOf(p), username: pnrOf(p), seat: "–", group_name: "", masked: true } : p);
// Externe Prüflinge, die eine Schule für eine Prüfung angenommen hat
export const extForSchool = (c, orgId) => Object.entries(c?.ext || {}).filter(([, e]) => e.school === orgId && atSchool(e)).map(([pid, e]) => ({ pid, e, pe: byId("persons", pid) })).filter((x) => x.pe);
export const KIND = { unterricht: "Unterricht", pruefung: "Prüfung" };
export const ROLE_LABEL = { besitzer: "Besitzer", mitbetreuung: "Mitbetreuung", teilnehmer: "Teilnehmende", raumaufsicht: "Raumaufsicht", korrektor: "Korrektor:in", pruefungseinsicht: "Prüfungseinsicht", schuladmin: "Schuladministration" };
export const STAGE_LABEL = { 1: "Erstkorrektur", 2: "Zweitkorrektur", 3: "Drittkorrektur" };

// Alle Mitglieder eines Kurses, Gruppen aufgelöst: [{ person, role, stage, via }]
export function members(c) {
  if (!c) return [];
  const out = (c.members || []).map((m) => ({ ...m, via: "" }));
  // Gruppen zählen mit dem Stand beim Hinzufügen (g.members); spätere Änderungen der Gruppe werden erst nach Übernahme wirksam
  for (const g of c.groups || []) {
    const gr = byId("groups", g.group); if (!gr && !g.members) continue;
    for (const pid of g.members || gr?.members || []) if (!out.some((m) => m.person === pid && m.role === g.role)) out.push({ person: pid, role: g.role, via: gr?.name || g.name || "Gruppe", group: g.group });
  }
  return out;
}
// Abweichung zwischen dem übernommenen Stand einer Kursgruppe und dem aktuellen Stand der Gruppe (Schulverwaltung bzw. eigene Gruppe)
export function groupDiff(g) {
  const gr = byId("groups", g?.group); if (!gr || !g.base) return null;
  const live = gr.members || []; const base = g.base || [];
  const added = live.filter((x) => !base.includes(x)), removed = base.filter((x) => !live.includes(x));
  if (!added.length && !removed.length) return null;
  const key = [...live].sort().join(",");
  return { added, removed, key, ignored: g.ignored === key };
}
export const groupSnapshot = (gr, role) => ({ group: gr.id, role, name: gr.name, members: [...(gr.members || [])], base: [...(gr.members || [])], at: new Date().toISOString() });
export const rolesIn = (c, pid) => members(c).filter((m) => m.person === pid);
export const hasRole = (c, pid, ...roles) => rolesIn(c, pid).some((m) => roles.includes(m.role));
export const isTeacherOf = (c, pid) => c?.kind === "unterricht" && (c.owner === pid || hasRole(c, pid, "besitzer", "mitbetreuung"));

// Kurse, die eine Person verwalten darf
export function canManageCourse(c, p = me()) {
  if (!c || !p) return false;
  if (isAdm(p)) return c.kind === "pruefung" && (c.orgs || []).includes(p.org);
  if (p.kind === "lehrkraft") return isTeacherOf(c, p.id);
  return false;
}
export function visibleCourses(p = me()) {
  if (!p) return [];
  if (isAdm(p)) return D.courses.filter((c) => c.kind === "pruefung" && (c.orgs || []).includes(p.org));
  if (p.kind === "lehrkraft") return D.courses.filter((c) => isTeacherOf(c, p.id));
  return [];
}
export const supervisesRoom = (room, pid) => D.supervisors.some((s) => s.room === room.id && s.person === pid);
export function canSeeRoom(room, p = me()) {
  if (!room) return false;
  if (!p) return false; // ohne Konto keine Raumaufsichten (Anmeldung über die Personenwahl)
  const c = courseOf(room);
  if (isAdm(p)) return room.org === p.org && (!c || c.kind === "pruefung");
  if (p.kind === "kammer") return supervisesRoom(room, p.id);
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
  if (c.kind === "pruefung" && room.org) {
    // Prüfung: nur Personen der Organisation des Raums; externe Prüflinge der Kammer nur nach Annahme durch die Schule (Art 2/3)
    // bzw. in Räumen der Kammer bei Art 1/4 – an keiner anderen Prüfung der Schule auswählbar
    if (kind !== "teilnehmer") list = list.filter((x) => inOrg(x, room.org));
    else if (isKammerOrg(room.org)) list = list.filter((x) => isExtern(x) && x.org === room.org && [1, 4].includes(+extOf(c, x.id)?.art));
    else list = list.filter((x) => (isExtern(x) ? extAccepted(extOf(c, x.id)) && extOf(c, x.id).school === room.org : inOrg(x, room.org)));
  }
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
  // nur Zuweisungen der Organisation, die den Prüfling korrigiert (Schule bzw. bei externen Prüflingen Schule oder Kammer)
  const resp = c.kind === "pruefung" ? correctionOrg(c, p) : "";
  const l = assignments(c).filter((a) => +a.stage === +stage && (!a.org || !resp || a.org === resp));
  return l.find((a) => a.kind === "person" && a.target === p.person) || l.find((a) => a.kind === "group" && (byId("groups", a.target)?.members || []).includes(p.person)) || null;
}
// Drittkorrektur: ausdrücklich angefordert oder – bei empfohlener Drittkorrektur (Notenabweichung EK/ZK ab Schwelle) – automatisch
// angefordert, solange die Schuladministration sie nicht zurückgenommen hat (third[p] = { withdrawn: true })
let recommendFn = null;
export const setDkRecommend = (fn) => (recommendFn = fn);
export const thirdState = (c, p) => { const t = (c?.third || {})[p?.id] || {}; const rec = c?.kind === "pruefung" && !!recommendFn?.(c, p); return { explicit: !!t.requested, withdrawn: !!t.withdrawn, recommended: rec, auto: rec && !t.requested && !t.withdrawn }; };
export const thirdRequested = (c, p) => { const s = thirdState(c, p); return s.explicit || s.auto; };
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
  // Externe Prüflinge: Einsicht immer bei der Kammer (auch wenn die Schule durchgeführt und korrigiert hat)
  return D.participants.filter((x) => { const r = byId("rooms", x.room); if (!r || !cs.has(r.course) || !isFinished(x.status) || x.status === "nicht_teilnahme") return false; const ext = extPerson(x); return ext ? inOrg(pe, ext.org) : inOrg(pe, r.org); });
}

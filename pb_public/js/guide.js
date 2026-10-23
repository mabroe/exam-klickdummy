// Testbare Klickstrecken (Leitfaden) entlang der Workflows
//  - Prüfungserstellung: Koordinierungsstelle, Aufgabenerstellung, Kommission, Vorsitz, Beratung, Lektorat, Prüflösung (Tasks 2–18, 46, 47)
//  - Unterricht: Lehrkraft (Tasks 31–36, 34 als Schüler:in)
//  - Prüfung: Schuladministration (Tasks 52, 24, 21), Raumaufsicht (Task 22/23)
// Der Fortschritt wird aus den Daten erkannt; der Leitfaden kann jederzeit ein- und ausgeklappt werden.
import { D, byId, onChange } from "./data.js?v=9.0";
import { icon, esc, store, toast } from "./ui.js?v=9.0";
import { members, personName, inOrg } from "./access.js?v=9.0";
import { navigate, render } from "./app.js?v=9.0";
import * as CR from "./views/creation.js?v=9.0";

const KEY = "guide";
const st = () => store.lget(KEY, null);
const save = (v) => store.lset(KEY, v);
// Pausierte Klickstrecken behalten ihren Fortschritt und lassen sich an derselben Stelle fortsetzen
export const active = () => !!st() && !st().paused;
const P = (u) => D.persons.find((p) => p.username === u);
const asPerson = (u, role, extra = {}) => ({ person: P(u)?.id, role, extra });
function loginAs(a) {
  if (!a) return;
  if (a.role === "tn") { store.set("person", ""); store.set("role", "tn"); store.set("pid", a.pid); return; }
  store.set("person", a.person || ""); store.set("role", a.role); Object.entries(a.extra || {}).forEach(([k, v]) => store.set(k, v));
}

// ---------- Unterricht ----------
function lesson(s) {
  const L = P("a.eggert");
  const course = D.courses.filter((c) => c.owner === L?.id && !s.base.courses.includes(c.id)).sort((a, b) => (a.created > b.created ? -1 : 1))[0];
  const ms = course ? members(course) : [];
  const room = course && D.rooms.filter((r) => r.course === course.id).sort((a, b) => (a.created > b.created ? -1 : 1))[0];
  const tns = room ? D.participants.filter((p) => p.room === room.id) : [];
  const lk = asPerson("a.eggert", "lehrkraft");
  const mitb = ms.find((m) => m.role === "mitbetreuung");
  // Lehrkraft ohne Bezug zum Kurs (zum Prüfen der Sichtbarkeit)
  const other = ["l.voigt", "i.morawetz", "g.ohm"].map(P).find((x) => x && !ms.some((m) => m.person === x.id));
  return [
    { t: 31, title: "Prüfung aus dem Katalog kopieren", text: "Als Lehrkraft Amir Eggert den Katalog öffnen, z. B. „FA230 - Musterprüfung“ wählen und „Kopieren“. Die Kopie gehört Ihnen und erscheint unter „Mein Unterricht“.", as: lk, go: "#/app/katalog", done: !!course },
    { t: 31, title: "Schüler:innen hinzufügen", text: "Im Kurs unter „Mitglieder und Gruppen“ eine Klasse aus der Schulverwaltung (z. B. WG12a) oder einzelne Schüler:innen als Teilnehmende hinzufügen.", as: lk, go: course && `#/app/kurs/${course.id}/mitglieder`, done: ms.some((m) => m.role === "teilnehmer") },
    { t: 31, title: "Weitere Lehrkraft hinzufügen", text: "„Lehrkraft hinzufügen“: Die Lehrkraft erhält die Mitbetreuung mit denselben Rechten. (optional)", optional: true, as: lk, go: course && `#/app/kurs/${course.id}/mitglieder`, done: !!mitb },
    { t: 31, title: "Eigene Gruppe anlegen", text: "„Eigene Gruppe anlegen“, z. B. für Nachschreibende. (optional)", optional: true, as: lk, go: course && `#/app/kurs/${course.id}/mitglieder`, done: !!course && (course.groups || []).some((g) => byId("groups", g.group)?.source === "kurs") },
    { t: 32, title: "Raumaufsicht mit Sitzordnung erstellen", text: "„Raumaufsicht erstellen“ (Kurs oder Übersicht Raumaufsicht). Im Unterricht wird kein realer Raum gebucht: Bezeichnung, Anzahl der Sitzplätze und Anordnung (Reihen, versetzt, U-Form, Gruppentische) frei wählen – die Vorschau zeigt den Sitzplan. Sie werden automatisch als Aufsichtsperson eingetragen.", as: lk, go: course && `#/app/kurs/${course.id}/raumaufsichten`, done: !!room },
    { t: 32, title: "Teilnehmende der Raumaufsicht zuordnen", text: "Im Reiter „Teilnehmende“ bzw. „Mein Raum“ die Kursmitglieder zuordnen – es stehen nur Teilnehmende dieses Kurses zur Auswahl.", as: lk, go: room && `#/app/raum/${room.id}/teilnehmende`, done: tns.length > 0 },
    { t: "–", title: "Sichtbarkeit prüfen", text: `Melden Sie sich als Lehrkraft ohne Bezug zum Kurs (${esc(personName(other))}) an: Diese Raumaufsicht erscheint dort nicht.${mitb ? ` Als ${esc(personName(byId("persons", mitb.person)))} (Mitbetreuung) ist sie dagegen sichtbar.` : ""} Danach als Amir Eggert weiter.`, manual: true, as: other ? asPerson(other.username, "lehrkraft") : lk, go: "#/app/raumaufsicht", done: !!s.manual?.vis },
    { t: 33, title: "Raumaufsicht durchführen: Prüfung starten", text: "Als Amir Eggert im Reiter „Mein Raum“ Anwesenheit setzen und „Prüfung starten“.", as: lk, go: room && `#/app/raum/${room.id}/meinraum`, done: !!room && room.state !== "CREATED" },
    { t: 34, title: "Als Schüler:in teilnehmen", text: `In einem zweiten Browserfenster (oder hier) als ${tns[0] ? esc(tns[0].firstname + " " + tns[0].lastname) : "Schüler:in"} anmelden, Belehrung und Gesundheitsabfrage bestätigen und eine Abgabe markieren.`, as: tns[0] ? { role: "tn", pid: tns[0].id } : null, go: "#/tn", done: tns.some((p) => ["laeuft", "zeit_beendet", "abgegeben", "eingesammelt", "beendet"].includes(p.status)) },
    { t: 33, title: "Einsammeln und beenden", text: "Als Amir Eggert „Prüfung einsammeln“ und „Prüfung beenden“. (Im Unterricht gibt es kein Prüfungsprotokoll.)", as: lk, go: room && `#/app/raum/${room.id}/meinraum`, done: room?.state === "TERMINATED" },
    { t: 35, title: "Korrigieren", text: "Im Unterricht gibt es genau eine Korrektur. In der Korrekturübersicht erscheinen nur Arbeiten aus Kursen, die Sie korrigieren. (optional)", optional: true, as: { ...lk, extra: { corrector: 1 } }, go: "#/app/korrektur", done: tns.some((p) => D.gradings.some((g) => g.participant === p.id)) },
    { t: 35, title: "Korrektur weitergeben", text: "„Korrektur weitergeben“ in der Korrekturübersicht: Die Korrektur geht an eine andere Lehrkraft des Kurses (z. B. die Mitbetreuung). Bisherige Bewertungen bleiben erhalten. (optional)", optional: true, as: { ...lk, extra: { corrector: 1 } }, go: "#/app/korrektur", done: !!course?.corrector && course.corrector !== course.owner },
  ];
}

// ---------- Prüfung ----------
function exam(s) {
  const K = P("m.hinrichs");
  const c = byId("courses", s.base.course) || D.courses.find((x) => x.title === "FA230 - Musterprüfung");
  const own = c ? members(c).filter((m) => inOrg(byId("persons", m.person), K?.org)) : [];
  const cnt = (role) => new Set(own.filter((m) => m.role === role).map((m) => m.person)).size;
  const korr = JSON.stringify(c?.corrections || []);
  const room = D.rooms.filter((r) => r.course === c?.id && !s.base.rooms.includes(r.id)).sort((a, b) => (a.created > b.created ? -1 : 1))[0];
  const sup = room && D.supervisors.find((x) => x.room === room.id && x.person);
  const supP = sup && byId("persons", sup.person);
  const ad = asPerson("m.hinrichs", "schuladmin");
  return [
    { t: 52, title: "Prüfung öffnen, Teilnehmende zuordnen", text: "Als Schuladmin Marit Hinrichs (AFS) unter „Prüfungen“ die „FA230 - Musterprüfung“ öffnen und Teilnehmende hinzufügen – einzeln oder als Klasse (z. B. WG12a). Sie sehen und bearbeiten nur Personen Ihrer Schule.", as: ad, go: c && `#/app/kurs/${c.id}/mitglieder`, done: cnt("teilnehmer") > s.base.tn },
    { t: 52, title: "Raumaufsicht (Person) zuordnen", text: "„Raumaufsicht hinzufügen“, z. B. Ilyas Morawetz.", as: ad, go: c && `#/app/kurs/${c.id}/mitglieder`, done: cnt("raumaufsicht") > s.base.ra },
    { t: 24, title: "Korrektorengruppen zuweisen", text: "Reiter „Korrektoren“: je Korrekturstufe eine Korrektorengruppe (mehrere Personen) für eine Klasse oder einzelne Prüflinge zuweisen oder eine bestehende Gruppe bearbeiten.", as: ad, go: c && `#/app/kurs/${c.id}/korrektoren`, done: korr !== s.base.korr },
    { t: 21, title: "Raumaufsicht erstellen", text: "Reiter „Raumaufsichten“ › „Raumaufsicht erstellen“ und einen freien Raum der Schule wählen (z. B. Raum 305). Räume, die im selben Zeitraum bereits belegt sind (z. B. Raum 123 heute), sind gesperrt – so werden Doppelbelegungen verhindert.", as: ad, go: c && `#/app/kurs/${c.id}/raumaufsichten`, done: !!room },
    { t: 21, title: "Aufsichtspersonen zuordnen", text: "Im Reiter „Aufsichtspersonen“ die zugeordneten Raumaufsichten Ihrer Schule eintragen und Zeiträume festlegen.", as: ad, go: room && `#/app/raum/${room.id}/aufsicht`, done: !!sup },
    { t: 21, title: "Teilnehmende der Raumaufsicht zuordnen", text: "Im Reiter „Teilnehmende“ die Teilnehmenden der Prüfung Ihrer Schule zuordnen.", as: ad, go: room && `#/app/raum/${room.id}/teilnehmende`, done: !!room && D.participants.some((p) => p.room === room.id) },
    { t: "–", title: "Sichtbarkeit prüfen", text: `Als Schuladmin der anderen Schule (Ilka Ammermann, BTS) anmelden: Diese Raumaufsicht ist nicht sichtbar. ${supP ? `Als ${esc(personName(supP))} (Raumaufsicht) sehen Sie nur Ihre Raumaufsichten.` : ""}`, manual: true, as: asPerson("i.ammermann", "schuladmin"), go: "#/app/raumaufsicht", done: !!s.manual?.vis },
    { t: 22, title: "Raumaufsicht durchführen", text: `Als zugeordnete Raumaufsicht${supP ? " " + esc(personName(supP)) : ""} anmelden, Anwesenheit setzen und die Prüfung starten.`, as: supP ? { person: supP.id, role: "aufsicht" } : ad, go: room && `#/app/raum/${room.id}/meinraum`, done: !!room && room.state !== "CREATED" },
    { t: 23, title: "Prüfung beenden, Protokoll herunterladen", text: "Einsammeln und beenden; danach im Reiter „Prüfungsprotokoll“ das PDF herunterladen.", as: supP ? { person: supP.id, role: "aufsicht" } : ad, go: room && `#/app/raum/${room.id}/protokoll`, done: room?.state === "TERMINATED" },
    { t: 28, title: "Ergebnisse prüfen, Drittkorrektur entscheiden", text: "Als Schuladmin unter „Ergebnisse“ die Punkte und Noten von Erst-, Zweitkorrektur und Endbeurteilung einsehen. Bei größerer Abweichung ist eine Drittkorrektur empfohlen – Sie entscheiden und fordern sie an. (optional)", optional: true, as: ad, go: "#/app/ergebnisse", done: !!c && Object.values(c.third || {}).some((x) => x.requested) },
  ];
}

// ---------- Prüfungserstellung (Instanz OPE) ----------
// Koordinierungsstelle legt die Prüfung an, setzt Rahmendaten und Personen; danach erledigen die Rollen ihre Aufgaben bis zur Sperre zum Prüfungsstart
function creation(s) {
  const KS = P("l.brandauer");
  const c = D.catalog.filter((x) => x.status && !s.base.catalog.includes(x.id)).sort((a, b) => (a.created > b.created ? -1 : 1))[0];
  const t = CR.team(c);
  const who = (role, sugg) => { const id = t[role]?.[0]; const pe = id ? byId("persons", id) : P(sugg); return pe ? { person: pe.id, role: "autor" } : null; };
  const nm = (role, sugg) => { const id = t[role]?.[0]; return esc(personName(id ? byId("persons", id) : P(sugg))); };
  const ks = { person: KS?.id, role: "autor" };
  const go = (tab) => (c ? `#/app/erstellung/${c.id}/${tab}` : "#/app/erstellung");
  const ev = (e) => !!c && CR.hasEvent(c, e);
  const st = c?.status || "";
  const after = (...xs) => xs.includes(st);
  const subsWithText = c ? (c.content?.tasks || []).flatMap((x) => x.subtasks || []).filter((x) => String(x.text || "").trim()).length : 0;
  const has = (role) => (t[role] || []).length > 0;
  const fb = (c?.feedback || []).filter((f) => f.kind !== "pruefloesung-ergebnis");
  const course = c && CR.examCourse(c); const HI = P("m.hinrichs"); const sa = { person: HI?.id, role: "schuladmin" };
  const afsTn = course ? (course.members || []).some((m) => m.role === "teilnehmer" && byId("persons", m.person)?.org === HI?.org) || (course.groups || []).some((g) => byId("groups", g.group)?.org === HI?.org) : false;
  const kg = byId("groups", t.kommission_group);
  return [
    { t: 38, title: "Neue Prüfung anlegen", text: "Als Koordinierungsstelle (Lisette Brandauer) unter „Erstellung“ auf „Neue Prüfung anlegen“ klicken: <b>Ausbildungsberuf</b> (nach Name oder Berufsnummer), den hinterlegten <b>Prüfungstitel</b> und das <b>Prüfungsjahr</b> wählen. Die Prüfung startet im Status <b>Vorbereitung</b> – oder direkt im Review, wenn die Kommission die Aufgabenerstellung übernimmt.", as: ks, go: "#/app/erstellung", done: !!c },
    { t: 2, title: "Rahmendaten und Prüfungsrumpf festlegen", text: "Reiter „Rahmendaten und Prüfungsrumpf“: Prüfungstermin, Bearbeitungszeit und den <b>Vorlauf der Begutachtung</b> (z. B. 24 Stunden vor Prüfungsstart) sowie Prüfungsart, Kennung und Fristen eintragen und speichern. Öffnet eine zweite Person der Koordinierungsstelle (Malin Tessendorf) die Rahmendaten gleichzeitig, sind sie für sie gesperrt.", as: ks, go: go("rahmendaten"), done: !!c && !CR.metaMissing(c).length },
    { t: 4, title: "Kommission und Aufgabenerstellung zuweisen", text: "Reiter „Personen“: <b>eine Kommission</b> wählen (z. B. „Prüfungskommission Büromanagement“ – ihr Vorsitz Ayla Steinhoff wird automatisch Kommissionsvorsitz) und die <b>Aufgabenerstellung</b> zuweisen (z. B. Lina Voigt).", as: ks, go: go("personen"), done: !!c && !CR.teamMissing(c).length },
    { t: 4, title: "Optionale Rollen: Beratung, Lektorat, Prüflösung", text: "Ebenfalls im Reiter „Personen“: <b>Beratung</b> (z. B. Ilyas Morawetz), <b>Lektorat</b> (z. B. Dorian Kowalczyk) und <b>Prüflösung</b> (z. B. Niklas Dähne). (optional)", optional: true, as: ks, go: go("personen"), done: has("beratung") || has("lektorat") || has("pruefloesung") },
    { t: 14, title: "Kommission: Unternehmenspool festlegen", text: `Als Kommission (${nm("kommission", "g.ohm")}) im Reiter „Unternehmenspool“ ein Unternehmen des Fachbereichs wählen – oder „Neuen Unternehmenspool anlegen“. Die Aufgabenerstellung sieht nur den ausgewählten Pool.`, as: who("kommission", "g.ohm"), go: go("unternehmen"), done: !!c?.meta?.pool },
    { t: 46, title: "Aufgabenerstellung: Aufgaben im Editor erstellen", text: `Als Aufgabenerstellung (${nm("aufgabenerstellung", "l.voigt")}) „Im Editor bearbeiten“: Aufgaben und Teilaufgaben mit Fragetyp, Arbeitsauftrag, Bewertungsraster und Erwartungshorizont anlegen und speichern.`, as: who("aufgabenerstellung", "l.voigt"), go: c ? `#/app/editor/${c.id}/aufgaben` : "#/app/erstellung", done: subsWithText > 0 || after("review", "lektorat", "gesperrt", "begutachtung", "veroeffentlicht") },
    { t: 46, title: "Aufgabenentwürfe an die Kommission übergeben", text: "„An die Kommission übergeben“ (Statuswechsel Nr. 1 → Kommission/Review) – direkt im Editor oder in der Leiste „Nächste Schritte“ der Prüfung.", as: who("aufgabenerstellung", "l.voigt"), go: c ? `#/app/editor/${c.id}/aufgaben` : go("uebersicht"), done: ev("review-start") },
    { t: 16, title: "Beratung: Aufgabenentwürfe einsehen", text: `Als Beratung (${nm("beratung", "i.morawetz")}) „Aufgabenentwürfe einsehen“ (Vorschau, nur lesend) und ggf. einen Hinweis an die Kommission geben. (optional)`, optional: true, as: who("beratung", "i.morawetz"), go: go("uebersicht"), done: !has("beratung") || ev("beratung-eingesehen") },
    { t: 15, title: "Kommission: Aufgabenentwürfe einarbeiten und weiterreichen", text: `Als Kommission (${nm("kommission", "g.ohm")}) die Entwürfe im Editor einarbeiten und „An Lektorat und Prüflösung übergeben“ (Statuswechsel Nr. 3). Ohne Lektorat/Prüflösung geht es direkt zur finalen Freigabe.`, as: who("kommission", "g.ohm"), go: go("uebersicht"), done: ev("lektorat-start") || (!has("lektorat") && !has("pruefloesung") && after("gesperrt", "begutachtung", "veroeffentlicht")) },
    { t: 17, title: "Lektorat: Prüfung lektorieren", text: `Als Lektorat (${nm("lektorat", "d.kowalczyk")}) die Prüfung ansehen, unter „Anmerkungen“ Hinweise je Teilaufgabe erfassen und „Lektorat abschließen“.`, as: who("lektorat", "d.kowalczyk"), go: go("anmerkungen"), done: !has("lektorat") || ev("lektorat-abgeschlossen") },
    { t: 18, title: "Prüflösung: Prüfung prüflösen", text: `Als Prüflösung (${nm("pruefloesung", "n.daehne")}) „Im Teilnahmemodus lösen“, danach benötigte Zeit und Einschätzung speichern und „Prüflösung abschließen“. Danach geht die Prüfung automatisch zurück an die Kommission (Nr. 4).`, as: who("pruefloesung", "n.daehne"), go: go("anmerkungen"), done: !has("pruefloesung") || ev("pruefloesung-abgeschlossen") },
    { t: 15, title: "Kommission: Anmerkungen einarbeiten", text: `Als Kommission (${nm("kommission", "g.ohm")}) die Anmerkungen im Editor einarbeiten und im Reiter „Anmerkungen“ als eingearbeitet markieren.`, as: who("kommission", "g.ohm"), go: go("anmerkungen"), done: (ev("lektorat-ende") || after("gesperrt", "begutachtung", "veroeffentlicht") || (!has("lektorat") && !has("pruefloesung"))) && fb.every((f) => f.resolved) },
    { t: 12, title: "Kommissionsvorsitz: final freigeben – verschlüsseln", text: `Als Kommissionsvorsitz (${nm("vorsitz", kg ? byId("persons", kg.chair)?.username : "a.steinhoff")}) „Final freigeben (verschlüsseln)“ (Statuswechsel Nr. 5). Inhalt und Aufgabensteuerung werden <b>verschlüsselt und weggesperrt</b>; niemand kann sie mehr einsehen.`, as: who("vorsitz", "a.steinhoff"), go: go("uebersicht"), done: after("gesperrt", "begutachtung", "veroeffentlicht") },
    { t: 47, title: "Organisationen der Prüfung zuordnen", text: "Nach der finalen Freigabe im Reiter „Organisationen“ die teilnehmenden Schulen suchen und wählen (z. B. AFS und BTS; gefiltert nach dem Ausbildungsberuf). Die Schuladministrationen werden automatisch hinzugefügt – üblicherweise ca. 2 Monate vor der Durchführung.", as: ks, go: go("organisationen"), done: !!(c?.meta?.orgs || []).length && !!course },
    { t: 52, title: "Schule: Prüfung organisieren (ohne Inhalt)", text: "Als Schuladministration Marit Hinrichs (AFS) unter „Prüfungen“ die neue Prüfung öffnen und Teilnehmende zuordnen (z. B. Klasse FA230a). Der <b>Inhalt ist nicht einsehbar</b>, andere beteiligte Schulen sind nicht sichtbar – die Organisation läuft trotzdem schon.", as: sa, go: course ? `#/app/kurs/${course.id}/mitglieder` : "#/app/kurse", done: afsTn },
    { t: 21, title: "Schule: Raumaufsicht vorbereiten", text: "Reiter „Raumaufsichten“ › „Raumaufsicht erstellen“ mit einem Prüfungsraum der Schule. Gestartet werden kann erst ab Prüfungsstart. (optional)", optional: true, as: sa, go: course ? `#/app/kurs/${course.id}/raumaufsichten` : "#/app/kurse", done: !!course && D.rooms.some((r) => r.course === course.id) },
    { t: "–", title: "Begutachtungszeitraum erreicht", text: "Laut Prüfungsrumpf wird die Prüfung automatisch vor dem Prüfungsstart entschlüsselt. Für die Demo als Koordinierungsstelle in der „Übersicht“ „Demo: Begutachtungszeitraum jetzt beginnen“ – den Verlauf zeigt der Reiter „Verlauf“.", as: ks, go: go("uebersicht"), done: after("begutachtung", "veroeffentlicht") },
    { t: 48, title: "Schule: Prüfung begutachten", text: "Als Schuladministration Marit Hinrichs (Schulleitung) die Prüfung öffnen und „Prüfung begutachten“ (Vorschau). Auch zugewiesene Korrektor:innen sehen die Prüfung jetzt. Fehler werden außerhalb des Portals an die Koordinierungsstelle gemeldet. Die Einsichtnahme wird nicht im Verlauf protokolliert.", as: sa, go: course ? `#/app/kurs/${course.id}/mitglieder` : "#/app/kurse", done: !!c && (CR.reviewedBy(c, HI) || after("veroeffentlicht")) },
    { t: 50, title: "Gemeldete Fehler beheben und direkt freigeben", text: `Als Koordinierungsstelle oder Kommission die Prüfung im Editor korrigieren und speichern – die Korrektur wird <b>direkt freigegeben</b>, ohne erneuten Freigabeprozess. (optional)`, optional: true, as: ks, go: c ? `#/app/editor/${c.id}/aufgaben` : "#/app/erstellung", done: ev("korrektur-freigegeben") },
    { t: "–", title: "Prüfungsstart: Inhalt für die Durchführung freigegeben", text: "Zum Prüfungstermin wird der Inhalt automatisch freigegeben; danach können die Raumaufsichten starten. Für die Demo als Koordinierungsstelle „Demo: Prüfungsstart jetzt“.", as: ks, go: go("uebersicht"), done: st === "veroeffentlicht" },
  ];
}

const NAMES = { unterricht: "Klickstrecke Unterricht (Lehrkraft)", pruefung: "Klickstrecke Prüfung (Schuladministration)", erstellung: "Klickstrecke Prüfungserstellung bis Prüfungsstart" };
// Übersprungene optionale Schritte gelten als erledigt
const steps = (s) => { const l = s.kind === "unterricht" ? lesson(s) : s.kind === "erstellung" ? creation(s) : exam(s); (s.skip || []).forEach((i) => { if (l[i]) l[i].done = true; }); return l; };

const curStep = (list) => { const i = list.findIndex((x) => !x.done && !x.optional); return i >= 0 ? i : list.findIndex((x) => !x.done); };
export function start(kind, fresh = false) {
  const old = st();
  if (old && old.kind === kind && !fresh) {
    // fortsetzen: am aktuellen Schritt weitermachen
    old.paused = false; old.open = true; save(old);
    const list = steps(old); const x = list[curStep(list)] || list[list.length - 1];
    loginAs(x.as); toast(NAMES[kind] + " fortgesetzt", `Weiter mit Schritt ${list.indexOf(x) + 1}: ${x.title}`, "info");
    navigate(x.go || "#/app/kurse"); render(); return;
  }
  const base = { courses: D.courses.map((c) => c.id), rooms: D.rooms.map((r) => r.id), catalog: D.catalog.map((c) => c.id) };
  if (kind === "pruefung") {
    const c = D.courses.find((x) => x.title === "FA230 - Musterprüfung"); const K = P("m.hinrichs");
    const own = members(c).filter((m) => inOrg(byId("persons", m.person), K?.org));
    Object.assign(base, { course: c?.id, tn: new Set(own.filter((m) => m.role === "teilnehmer").map((m) => m.person)).size, ra: new Set(own.filter((m) => m.role === "raumaufsicht").map((m) => m.person)).size, korr: JSON.stringify(c?.corrections || []) });
  }
  save({ kind, base, manual: {}, open: true });
  const first = steps(st())[0];
  loginAs(first.as); toast(NAMES[kind] + " gestartet", "Der Leitfaden unten rechts zeigt den nächsten Schritt.", "info");
  navigate(first.go || "#/app/kurse"); render();
}
// Laufende Klickstrecke: Stand für die Startseite und Fortsetzen an der letzten Stelle
export function status() {
  const s = st(); if (!s) return null;
  const list = steps(s); const done = list.filter((x) => x.done).length;
  let cur = list.findIndex((x) => !x.done && !x.optional); if (cur < 0) cur = list.findIndex((x) => !x.done);
  return { kind: s.kind, name: NAMES[s.kind], done, total: list.length, cur, step: cur >= 0 ? list[cur] : null, paused: !!s.paused };
}
export function resume() {
  const s = st(); if (!s) return; const x = status().step;
  s.open = true; s.paused = false; save(s); store.set("guideOpenTn", true);
  if (x) { loginAs(x.as); navigate(x.go || "#/app/kurse"); } else navigate("#/app/kurse");
  render();
}
export function stop() { const s = st(); if (s) { s.paused = true; save(s); } document.querySelector(".guidepanel")?.remove(); }
export function discard() { store.lset(KEY, null); document.querySelector(".guidepanel")?.remove(); }

export function mountPanel() {
  const s = st(); const old = document.querySelector(".guidepanel");
  if (!s || s.paused || !location.hash.replace(/^#\/?/, "")) { old?.remove(); return; }
  const list = steps(s); const done = list.filter((x) => x.done).length; const cur = list.findIndex((x) => !x.done && !x.optional) >= 0 ? list.findIndex((x) => !x.done && !x.optional) : list.findIndex((x) => !x.done);
  // Prüflingsansicht: Leitfaden eingeklappt, damit er keine Bedienelemente verdeckt (pro Tab aufklappbar)
  if (store.get("role") === "tn" && !store.get("guideOpenTn")) s.open = false;
  const el = old || document.createElement("aside");
  el.className = "guidepanel" + (s.open ? "" : " closed"); el.setAttribute("aria-label", "Klickstrecke");
  el.innerHTML = `<button class="gp-head" data-gtoggle aria-expanded="${s.open}">${icon("list-checks")}<span class="grow"><b>${esc(NAMES[s.kind])}</b><span class="xs">${done} von ${list.length} Schritten erledigt</span></span>${icon(s.open ? "chevron-down" : "chevron-up")}</button>
    ${s.open ? `<div class="gp-bar"><i style="width:${Math.round((done / list.length) * 100)}%"></i></div><ol class="gp-steps">${list.map((x, i) => (!s.full && i !== cur && !(!x.done && x.optional && i < cur)) ? "" : `<li class="${x.done ? "done" : ""} ${i === cur ? "cur" : ""}"><div class="gp-row"><span class="gp-ico">${x.done ? icon("check") : i + 1}</span><span class="grow"><b>${esc(x.title)}</b>${x.optional ? ' <span class="xs muted">optional</span>' : ""}<span class="xs muted"> · Task ${x.t}</span></span></div>
      ${i === cur || (!x.done && x.optional && i < cur) ? `<p class="small">${x.text}</p><div class="row wrap" style="gap:6px">${x.go ? `<button class="btn primary xs" data-ggo="${i}">${icon("arrow-right")} ${x.as ? "Anmelden und öffnen" : "Öffnen"}</button>` : ""}${x.manual ? `<button class="btn xs" data-gman>${icon("check")} Geprüft</button>` : ""}${x.optional ? `<button class="btn xs ghost" data-gskip="${i}">überspringen</button>` : ""}</div>` : ""}</li>`).join("")}</ol>
    ${done === list.length || cur < 0 || list.every((x) => x.done || x.optional) ? `<div class="notice success small">${icon("circle-check")}<span>Klickstrecke abgeschlossen${done < list.length ? " – optionale Schritte sind noch offen" : ""}.</span></div>` : ""}<div class="row between gp-foot"><button class="link xs" data-gfull>${s.full ? "Nur aktuellen Schritt" : `Alle Schritte anzeigen`}</button><a class="xs" href="#/">Personen wechseln</a><button class="link xs" data-gstop title="Die Klickstrecke wird angehalten und kann auf der Startseite an derselben Stelle fortgesetzt werden">Pausieren</button></div>` : ""}`;
  if (!old) document.body.appendChild(el);
  el.querySelector("[data-gtoggle]").onclick = () => { if (store.get("role") === "tn") { store.set("guideOpenTn", !store.get("guideOpenTn")); const v = st(); v.open = true; save(v); } else { const v = st(); v.open = !v.open; save(v); } mountPanel(); };
  el.querySelectorAll("[data-ggo]").forEach((b) => (b.onclick = () => { const x = steps(st())[+b.dataset.ggo]; loginAs(x.as); if (location.hash === x.go) render(); else navigate(x.go); }));
  const man = el.querySelector("[data-gman]"); if (man) man.onclick = () => { const v = st(); v.manual.vis = true; save(v); mountPanel(); };
  el.querySelectorAll("[data-gskip]").forEach((b) => (b.onclick = () => { const v = st(); (v.skip ||= []).push(+b.dataset.gskip); save(v); mountPanel(); }));
  const fu = el.querySelector("[data-gfull]"); if (fu) fu.onclick = () => { const v = st(); v.full = !v.full; save(v); mountPanel(); };
  const stp = el.querySelector("[data-gstop]"); if (stp) stp.onclick = () => { stop(); render(); };
}
onChange(() => { if (active()) setTimeout(mountPanel, 50); });

// Testbare Klickstrecken (Leitfaden) entlang der Workflows
//  - Prüfungserstellung: Koordinierungsstelle, Aufgabenerstellung, Kommission, Vorsitz, Beratung, Lektorat, Prüflösung (Tasks 2–18, 46, 47)
//  - Unterricht: Lehrkraft (Tasks 31–36, 34 als Schüler:in)
//  - Prüfung: Schuladministration (Tasks 52, 24, 21), Raumaufsicht (Task 22/23)
// Der Fortschritt wird aus den Daten erkannt; der Leitfaden kann jederzeit ein- und ausgeklappt werden.
import { D, byId, onChange } from "./data.js?v=10.0";
import { icon, esc, store, toast } from "./ui.js?v=10.0";
import { members, personName, inOrg } from "./access.js?v=10.0";
import { navigate, render } from "./app.js?v=10.0";
import * as CR from "./views/creation.js?v=10.0";

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
  if (a.role !== "schueler") store.del("portal");
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
    { t: 34, title: "Als Schüler:in teilnehmen", text: `In einem zweiten Browserfenster (oder hier) als ${tns[0] ? esc(tns[0].firstname + " " + tns[0].lastname) : "Schüler:in"} anmelden (im Unterricht ohne Belehrung und Gesundheitsabfrage – direkt bereit; im Wartebereich steht die Demo zur Verfügung) und eine Abgabe markieren.`, as: tns[0] ? { role: "tn", pid: tns[0].id } : null, go: "#/tn", done: tns.some((p) => ["laeuft", "zeit_beendet", "abgegeben", "eingesammelt", "beendet"].includes(p.status)) },
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
  const list = [
    { t: 38, title: "Neue Prüfung anlegen", text: "Als Koordinierungsstelle (Lisette Brandauer) unter „Erstellung“ auf „Neue Prüfung anlegen“ klicken: <b>Ausbildungsberuf</b> (nach Name oder Berufsnummer), den hinterlegten <b>Prüfungstitel</b> und das <b>Prüfungsjahr</b> wählen. Die Prüfung startet im Status <b>Vorbereitung</b> – oder direkt im Review, wenn die Kommission die Aufgabenerstellung übernimmt.", as: ks, go: "#/app/erstellung", done: !!c },
    { t: 2, title: "Rahmendaten und Prüfungsrumpf festlegen", text: "Reiter „Rahmendaten und Prüfungsrumpf“: Prüfungstermin, Bearbeitungszeit und den <b>Vorlauf der Begutachtung</b> (z. B. 24 Stunden vor Prüfungsstart) sowie Prüfungsart, Kennung und Fristen eintragen und speichern. Öffnet eine zweite Person der Koordinierungsstelle (Malin Tessendorf) die Rahmendaten gleichzeitig, sind sie für sie gesperrt.", as: ks, go: go("rahmendaten"), done: !!c && !CR.metaMissing(c).length },
    { t: 4, title: "Kommission und Aufgabenerstellung zuweisen", text: "Reiter „Personen“: <b>eine Kommission</b> wählen (z. B. „Prüfungskommission Büromanagement“ – ihr Vorsitz Ayla Steinhoff wird automatisch Kommissionsvorsitz) und die <b>Aufgabenerstellung</b> zuweisen (z. B. Lina Voigt).", as: ks, go: go("personen"), done: !!c && !CR.teamMissing(c).length },
    { t: 4, title: "Optionale Rollen: Beratung, Lektorat, Prüflösung", text: "Ebenfalls im Reiter „Personen“: <b>Beratung</b> (z. B. Ilyas Morawetz), <b>Lektorat</b> (z. B. Dorian Kowalczyk) und <b>Prüflösung</b> (z. B. Niklas Dähne). (optional)", optional: true, as: ks, go: go("personen"), done: has("beratung") || has("lektorat") || has("pruefloesung") },
    { t: 14, role: "kommission", title: "Kommission: Unternehmenspool festlegen", text: `Als Kommission (${nm("kommission", "g.ohm")}) im Reiter „Unternehmenspool“ ein Unternehmen des Fachbereichs wählen – oder „Neuen Unternehmenspool anlegen“. Die Aufgabenerstellung sieht nur den ausgewählten Pool.`, as: who("kommission", "g.ohm"), go: go("unternehmen"), done: !!c?.meta?.pool },
    { t: 46, role: "aufgabenerstellung", title: "Aufgabenerstellung: Aufgaben im Editor erstellen", text: `Als Aufgabenerstellung (${nm("aufgabenerstellung", "l.voigt")}) „Im Editor bearbeiten“: Aufgaben und Teilaufgaben mit Fragetyp, Arbeitsauftrag, Bewertungsraster und Erwartungshorizont anlegen und speichern.`, as: who("aufgabenerstellung", "l.voigt"), go: c ? `#/app/editor/${c.id}/aufgaben` : "#/app/erstellung", done: subsWithText > 0 || after("review", "lektorat", "gesperrt", "begutachtung", "veroeffentlicht") },
    { t: 46, role: "aufgabenerstellung", title: "Aufgabenentwürfe an die Kommission übergeben", text: "„An die Kommission übergeben“ (Statuswechsel Nr. 1 → Kommission/Review) – direkt im Editor oder in der Leiste „Nächste Schritte“ der Prüfung.", as: who("aufgabenerstellung", "l.voigt"), go: c ? `#/app/editor/${c.id}/aufgaben` : go("uebersicht"), done: ev("review-start") },
    { t: 16, title: "Beratung: Aufgabenentwürfe einsehen", text: `Als Beratung (${nm("beratung", "i.morawetz")}) „Aufgabenentwürfe einsehen“ (Vorschau, nur lesend) und ggf. einen Hinweis an die Kommission geben. (optional)`, optional: true, as: who("beratung", "i.morawetz"), go: go("uebersicht"), done: !has("beratung") || ev("beratung-eingesehen") },
    { t: 15, role: "kommission", title: "Kommission: Aufgabenentwürfe einarbeiten und weiterreichen", text: `Als Kommission (${nm("kommission", "g.ohm")}) die Entwürfe im Editor einarbeiten und „An Lektorat und Prüflösung übergeben“ (Statuswechsel Nr. 3). Ohne Lektorat/Prüflösung geht es direkt zur finalen Freigabe.`, as: who("kommission", "g.ohm"), go: go("uebersicht"), done: ev("lektorat-start") || (!has("lektorat") && !has("pruefloesung") && after("gesperrt", "begutachtung", "veroeffentlicht")) },
    { t: 17, title: "Lektorat: Prüfung lektorieren", text: `Als Lektorat (${nm("lektorat", "d.kowalczyk")}) die Prüfung ansehen, unter „Anmerkungen“ Hinweise je Teilaufgabe erfassen und „Lektorat abschließen“.`, as: who("lektorat", "d.kowalczyk"), go: go("anmerkungen"), done: !has("lektorat") || ev("lektorat-abgeschlossen") },
    { t: 18, title: "Prüflösung: Prüfung prüflösen", text: `Als Prüflösung (${nm("pruefloesung", "n.daehne")}) „Im Teilnahmemodus lösen“, danach benötigte Zeit und Einschätzung speichern und „Prüflösung abschließen“. Danach geht die Prüfung automatisch zurück an die Kommission (Nr. 4).`, as: who("pruefloesung", "n.daehne"), go: go("anmerkungen"), done: !has("pruefloesung") || ev("pruefloesung-abgeschlossen") },
    { t: 15, role: "kommission", title: "Kommission: Anmerkungen einarbeiten", text: `Als Kommission (${nm("kommission", "g.ohm")}) die Anmerkungen im Editor einarbeiten und im Reiter „Anmerkungen“ als eingearbeitet markieren.`, as: who("kommission", "g.ohm"), go: go("anmerkungen"), done: (ev("lektorat-ende") || after("gesperrt", "begutachtung", "veroeffentlicht") || (!has("lektorat") && !has("pruefloesung"))) && fb.every((f) => f.resolved) },
    { t: 12, role: "vorsitz", title: "Kommissionsvorsitz: final freigeben – verschlüsseln", text: `Als Kommissionsvorsitz (${nm("vorsitz", kg ? byId("persons", kg.chair)?.username : "a.steinhoff")}) „Final freigeben (verschlüsseln)“ (Statuswechsel Nr. 5). Inhalt und Aufgabensteuerung werden <b>verschlüsselt und weggesperrt</b>; niemand kann sie mehr einsehen.`, as: who("vorsitz", "a.steinhoff"), go: go("uebersicht"), done: after("gesperrt", "begutachtung", "veroeffentlicht") },
    { t: 47, title: "Organisationen der Prüfung zuordnen", text: "Nach der finalen Freigabe im Reiter „Organisationen“ die teilnehmenden Schulen suchen und wählen (z. B. AFS und BTS; gefiltert nach dem Ausbildungsberuf). Die Schuladministrationen werden automatisch hinzugefügt – üblicherweise ca. 2 Monate vor der Durchführung.", as: ks, go: go("organisationen"), done: !!(c?.meta?.orgs || []).length && !!course },
    { t: 52, title: "Schule: Prüfung organisieren (ohne Inhalt)", text: "Als Schuladministration Marit Hinrichs (AFS) unter „Prüfungen“ die neue Prüfung öffnen und Teilnehmende zuordnen (z. B. Klasse FA230a). Der <b>Inhalt ist nicht einsehbar</b>, andere beteiligte Schulen sind nicht sichtbar – die Organisation läuft trotzdem schon.", as: sa, go: course ? `#/app/kurs/${course.id}/mitglieder` : "#/app/kurse", done: afsTn },
    { t: 21, title: "Schule: Raumaufsicht vorbereiten", text: "Reiter „Raumaufsichten“ › „Raumaufsicht erstellen“ mit einem Prüfungsraum der Schule. Gestartet werden kann erst ab Prüfungsstart. (optional)", optional: true, as: sa, go: course ? `#/app/kurs/${course.id}/raumaufsichten` : "#/app/kurse", done: !!course && D.rooms.some((r) => r.course === course.id) },
    { t: "–", title: "Begutachtungszeitraum erreicht", text: "Laut Prüfungsrumpf wird die Prüfung automatisch vor dem Prüfungsstart entschlüsselt. Für die Demo als Koordinierungsstelle in der „Übersicht“ „Demo: Begutachtungszeitraum jetzt beginnen“ – den Verlauf zeigt der Reiter „Verlauf“.", as: ks, go: go("uebersicht"), done: after("begutachtung", "veroeffentlicht") },
    { t: 48, title: "Schule: Prüfung begutachten", text: "Als Schuladministration Marit Hinrichs (Schulleitung) die Prüfung öffnen und „Prüfung begutachten“ (Vorschau). Auch zugewiesene Korrektor:innen sehen die Prüfung jetzt. Fehler werden außerhalb des Portals an die Koordinierungsstelle gemeldet. Die Einsichtnahme wird nicht im Verlauf protokolliert.", as: sa, go: course ? `#/app/kurs/${course.id}/mitglieder` : "#/app/kurse", done: !!c && (CR.reviewedBy(c, HI) || after("veroeffentlicht")) },
    { t: 50, title: "Gemeldete Fehler beheben und direkt freigeben", text: `Als Koordinierungsstelle oder Kommission die Prüfung im Editor korrigieren und speichern – die Korrektur wird <b>direkt freigegeben</b>, ohne erneuten Freigabeprozess. (optional)`, optional: true, as: ks, go: c ? `#/app/editor/${c.id}/aufgaben` : "#/app/erstellung", done: ev("korrektur-freigegeben") },
    { t: "–", title: "Prüfungsstart: Inhalt für die Durchführung freigegeben", text: "Zum Prüfungstermin wird der Inhalt automatisch freigegeben; danach können die Raumaufsichten starten. Für die Demo als Koordinierungsstelle „Demo: Prüfungsstart jetzt“.", as: ks, go: go("uebersicht"), done: st === "veroeffentlicht" },
  ];
  // Rolle (noch) nicht zugewiesen: Koordinierungsstelle weist zuerst zu; übernimmt die Kommission die Erstellung, entfallen die Schritte der Aufgabenerstellung
  return list.map((x) => {
    if (!x.role || !c) return x;
    if (x.role === "aufgabenerstellung" && CR.byCommission(c)) return { ...x, done: true, title: x.title + " (entfällt – Kommission erstellt)" };
    if (x.done) return x;
    if (!has(x.role)) return { ...x, as: ks, go: go("personen"), text: `<b>Noch niemand als ${esc(CR.EROLES[x.role].label)} zugewiesen.</b> Als Koordinierungsstelle zuerst im Reiter „Personen“ zuweisen. Danach: ${x.text}` };
    return x;
  });
}

// ---------- Prüfung durchführen (Raumaufsicht und Prüfling) ----------
const room123 = () => D.rooms.find((r) => r.name === "Raum 123");
function conduct(s) {
  const r = room123(); const tp = D.participants.find((x) => x.room === r?.id && x.username === "n.froehlke");
  const ra = asPerson("t.riedmueller", "aufsicht"); const tn = tp ? { role: "tn", pid: tp.id } : null;
  const subs = tp ? D.items.filter((i) => i.participant === tp.id && i.submission).length : 0;
  const prot = r ? D.protocol.filter((x) => x.room === r.id).length : 0;
  return [
    { t: 22, title: "Raumaufsicht öffnen und Anwesenheit prüfen", text: "Als Raumaufsicht Thea Riedmüller „Raum 123“ öffnen: Sitzplan, Status der Prüflinge und Startfenster. Tipp: Raumaufsicht und Prüfling in zwei Browserfenstern nebeneinander öffnen – alles ist live gekoppelt.", as: ra, go: r && `#/app/raum/${r.id}/meinraum`, manual: "raum", done: !!s.manual?.raum },
    { t: 19, title: "Prüfling: anmelden, Belehrung und Gesundheitsabfrage bestätigen", text: "Als Prüfling Niklas Fröhlke im Wartebereich die Belehrung zu Täuschungsversuchen und die Gesundheitsabfrage bestätigen. Die Raumaufsicht sieht den Status sofort im Sitzplan.", as: tn, go: "#/tn", done: !!tp?.cheat_ack && tp?.health === "ok" },
    { t: 22, title: "Raumaufsicht: Prüfung starten", text: "Als Thea Riedmüller „Prüfung starten“. Übrige Teilnehmende lassen sich unter Administration › „Übrige Teilnehmende anmelden“ simulieren.", as: ra, go: r && `#/app/raum/${r.id}/meinraum`, done: !!r && r.state !== "CREATED" },
    { t: 19, title: "Prüfling: Aufgabe bearbeiten und Abgabe markieren", text: "Als Niklas Fröhlke eine Aufgabe öffnen, z. B. eine E-Mail senden oder eine Datei ablegen, und als Abgabe der Teilaufgabe markieren.", as: tn, go: "#/tn/dashboard", done: subs > (s.base.subs || 0) },
    { t: 22, title: "Raumaufsicht: Zusatzzeit oder Pause für einen Prüfling", text: "In „Mein Raum“ bzw. „Teilnehmende“ einen Prüfling wählen und z. B. Zusatzzeit gewähren oder pausieren – der Eintrag erscheint im Protokoll. (optional)", optional: true, as: ra, go: r && `#/app/raum/${r.id}/teilnehmende`, done: prot > (s.base.prot || 0) + 3 },
    { t: 19, title: "Prüfling: Prüfung abgeben", text: "Als Niklas Fröhlke „Prüfung beenden“ und abgeben. (optional – sonst sammelt die Aufsicht ein)", optional: true, as: tn, go: "#/tn/abgaben", done: ["abgegeben", "eingesammelt", "beendet"].includes(tp?.status) },
    { t: 23, title: "Raumaufsicht: einsammeln und beenden", text: "Als Thea Riedmüller „Prüfung einsammeln“ und anschließend „Prüfung beenden“.", as: ra, go: r && `#/app/raum/${r.id}/meinraum`, done: r?.state === "TERMINATED" },
    { t: 23, title: "Prüfungsprotokoll herunterladen", text: "Reiter „Prüfungsprotokoll“: alle Ereignisse mit Uhrzeit, PDF herunterladen.", as: ra, go: r && `#/app/raum/${r.id}/protokoll`, manual: "prot", done: !!s.manual?.prot },
  ];
}

// ---------- Korrektur und Ergebnisse (Prüfung) ----------
const gjson = (stage) => JSON.stringify(D.gradings.filter((g) => +g.corrector === stage).map((g) => [g.participant, g.points, g.marks, g.not_done]));
const approvals = (stage) => D.gradings.filter((g) => +g.corrector === stage).reduce((a, g) => a + (g.approvals || []).length, 0);
function correction(s) {
  const pr1 = D.courses.find((x) => x.title === "FA230 - Musterprüfung");
  const k = (u, st) => asPerson(u, "korrektor", { corrector: st }); const sa = asPerson("m.hinrichs", "schuladmin");
  return [
    { t: 20, title: "Erstkorrektur: Teilaufgabe bewerten", text: "Als Erstkorrektorin Gesa Ohm die Korrekturübersicht öffnen, eine Teilaufgabe wählen und Punkte je Kriterium vergeben – Korrekturzeichen am rechten Rand (Auswahl oder Stifteingabe), Begründung.", as: k("g.ohm", 1), go: "#/app/korrektur", done: gjson(1) !== s.base.g1 },
    { t: 20, title: "Erstkorrektur gemeinsam freigeben", text: "Die Erstkorrektur ist eine Gruppe (Gesa Ohm und Lina Voigt): Jede Person gibt frei; final ist die Bewertung, wenn alle freigegeben haben. Freigabe in der Korrekturübersicht.", as: k("g.ohm", 1), go: "#/app/korrektur", done: approvals(1) > (s.base.a1 || 0) },
    { t: 10, title: "Zweitkorrektur", text: "Als Zweitkorrektorin Ayla Steinhoff bewerten (Zeichen am linken Rand, grün) – die Erstkorrektur ist sichtbar.", as: k("a.steinhoff", 2), go: "#/app/korrektur?k=2", done: gjson(2) !== s.base.g2 },
    { t: 10, title: "Vergleich mit einem anderen Prüfling", text: "Im Korrekturmodus „Vergleichen“ öffnet einen anderen Prüfling derselben Teilaufgabe in einem neuen Tab. (optional)", optional: true, manual: "vgl", as: k("a.steinhoff", 2), go: "#/app/korrektur?k=2", done: !!s.manual?.vgl },
    { t: 28, title: "Schuladministration: Ergebnisse und Drittkorrektur", text: "Als Marit Hinrichs unter „Ergebnisse“ Punkte und Noten prüfen. Die Gesamtnote ist das Mittel der Noten. Bei großer Abweichung ist die Drittkorrektur <b>automatisch angefordert</b> – zurücknehmen oder für weitere Prüflinge anfordern.", as: sa, go: "#/app/ergebnisse", done: JSON.stringify(pr1?.third || {}) !== s.base.third },
    { t: 27, title: "Endbeurteilung (Drittkorrektur) durchführen", text: "Als Endbeurteiler Karim Ebeling die angeforderten Prüflinge bewerten (braun, linker Rand). Die Note der Endbeurteilung wird zur Gesamtnote.", as: k("k.ebeling", 3), go: "#/app/korrektur?k=3", done: D.gradings.filter((g) => +g.corrector === 3).length > (s.base.g3n || 0) },
    { t: 30, title: "Ergebnisse exportieren", text: "Als Schuladministration „CSV exportieren“. (optional)", optional: true, manual: "csv", as: sa, go: "#/app/ergebnisse", done: !!s.manual?.csv },
  ];
}

// ---------- Prüfungseinsicht ----------
function einsicht(s) {
  const pe = asPerson("t.riedmueller", "einsicht");
  const n = (a) => D.protocol.filter((x) => x.action === a).length;
  return [
    { t: 37, title: "Prüfungseinsicht beginnen", text: "Als Thea Riedmüller (Rolle Prüfungseinsicht) die Liste öffnen – sie zeigt nur Prüflinge der eigenen Schule mit abgeschlossener Prüfung (z. B. Zwischenprüfung, Raum 202). „Einsicht beginnen“ bestätigt die Anwesenheit in Präsenz.", as: pe, go: "#/app/pruefungseinsicht", done: n("Prüfungseinsicht begonnen") > (s.base.ein0 || 0) },
    { t: 38, title: "Endnote und Abgabe mit Korrekturzeichen zeigen", text: "Gezeigt werden nur Endnote und Abgaben mit Korrekturzeichen – keine Punkte je Teilaufgabe, Begründungen oder Kommentare.", as: pe, go: "#/app/pruefungseinsicht", manual: "zeigen", done: !!s.manual?.zeigen },
    { t: 37, title: "Prüfungseinsicht beenden", text: "„Einsicht beenden“ – Beginn und Ende werden im Prüfungsprotokoll festgehalten.", as: pe, go: "#/app/pruefungseinsicht", done: n("Prüfungseinsicht beendet") > (s.base.ein1 || 0) },
  ];
}

// ---------- Katalog (Bereichsadministration) ----------
function catalogFlow(s) {
  const ba = asPerson("w.hollerbach", "bereichsadmin");
  const nw = D.catalog.filter((c) => !c.mine && !c.status && !s.base.catalog.includes(c.id));
  const own = nw.filter((c) => !c.copied_from && !/Import/.test(c.creator || "")).sort((a, b) => (a.created > b.created ? -1 : 1))[0];
  return [
    { t: "–", title: "Unterrichtsinhalt erstellen", text: "Als Bereichsadministration Wenke Hollerbach im Katalog „Unterrichtsinhalt erstellen“ – der Inhalt wird als Entwurf angelegt und im Editor geöffnet.", as: ba, go: "#/app/katalog", done: !!own },
    { t: "–", title: "Inhalt im Editor bearbeiten und speichern", text: "Aufgaben, Teilaufgaben, Bewertungsraster und Materialien anlegen (E-Mails z. B. mit relativer Zeitangabe) und speichern. „Editor beenden“ führt zurück.", as: ba, go: own ? `#/app/editor/${own.id}/aufgaben` : "#/app/katalog", done: !!own && own.updated !== own.created },
    { t: "–", title: "Global freigeben", text: "Im Katalog (Reiter „Nicht freigegeben“) bzw. im Editor „Global freigeben“ – der Inhalt ist jetzt für alle Lehrkräfte sichtbar.", as: ba, go: "#/app/katalog", done: !!own && own.release?.scope === "global" },
    { t: "–", title: "Durchgeführte Prüfung veröffentlichen", text: "„Durchgeführte Prüfung veröffentlichen“: z. B. die Zwischenprüfung als Übung übernehmen – ohne Teilnehmende und Ergebnisse. (optional)", optional: true, as: ba, go: "#/app/katalog", done: nw.some((c) => c.copied_from && D.catalog.some((x) => x.id === c.copied_from && x.status)) },
    { t: "–", title: "Prüfung importieren", text: "Im Editor „Exportieren“ und die Datei über „Prüfung importieren“ wieder einlesen. (optional)", optional: true, as: ba, go: "#/app/katalog", done: nw.some((c) => /Import/.test(c.creator || "")) },
    { t: "–", title: "Sichtbarkeit prüfen", text: "Als Lehrkraft (z. B. Amir Eggert) den Katalog öffnen: Der freigegebene Inhalt erscheint und kann kopiert werden; Entwürfe sind nicht sichtbar.", as: asPerson("a.eggert", "lehrkraft"), go: "#/app/katalog", manual: "vis", done: !!s.manual?.vis },
  ];
}

// ---------- Stammdaten (Koordinierungsstelle) ----------
const sj = (k) => JSON.stringify(D.settings.find((x) => x.key === k)?.value || null);
const komJ = () => JSON.stringify(D.groups.filter((g) => g.kind === "kommission").map((g) => [g.name, g.members, g.chair, g.fachbereich]));
const orgJ = () => JSON.stringify(D.orgs.map((o) => o.berufe || []));
const poolN = () => D.settings.filter((x) => String(x.key).startsWith("pool:")).length;
function masterFlow(s) {
  const ks = asPerson("l.brandauer", "autor");
  return [
    { t: "–", title: "Ausbildungsberuf und Prüfungstitel pflegen", text: "Als Koordinierungsstelle unter „Stammdaten › Ausbildungsberufe“ einen Beruf bearbeiten (z. B. Prüfungstitel ergänzen) oder neu anlegen – Suche nach Name oder Berufsnummer.", as: ks, go: "#/app/stammdaten/berufe", done: sj("berufe") !== s.base.berufe },
    { t: "–", title: "Schulen und Ausbildungsberufe zuordnen", text: "„Schulen“: hinterlegen, welche Schule welche Berufe ausbildet – Grundlage für die Auswahl der Organisationen einer Prüfung.", as: ks, go: "#/app/stammdaten/schulen", done: orgJ() !== s.base.orgs },
    { t: "–", title: "Kommission pflegen", text: "„Kommissionen“: Mitglieder, Vorsitz oder Fachbereich ändern – die Änderung wirkt sofort in allen Prüfungen der Kommission.", as: ks, go: "#/app/stammdaten/kommissionen", done: komJ() !== s.base.kom },
    { t: "–", title: "Unternehmenspool anlegen", text: "„Unternehmenspools“: einen Pool für einen Fachbereich anlegen.", as: ks, go: "#/app/stammdaten/pools", done: poolN() > (s.base.pools || 0) },
    { t: "–", title: "Korrekturzeichensatz verbindlich festlegen", text: "„Korrekturzeichensätze“: einen Satz bearbeiten und als verbindlich festlegen – gilt sofort für Erstellung, Prüfung und Unterricht.", as: ks, go: "#/app/stammdaten/zeichen", done: sj("signsets") !== s.base.signs },
    { t: "–", title: "Wirkung prüfen", text: "Als Korrektorin Gesa Ohm einen Korrekturmodus öffnen: Die Korrekturzeichen entsprechen dem verbindlichen Satz. Danach ggf. wieder den Standardsatz festlegen.", as: asPerson("g.ohm", "korrektor", { corrector: 1 }), go: "#/app/korrektur", manual: "wirk", done: !!s.manual?.wirk },
  ];
}

// ---------- Schüler:in (Unterricht) ----------
function studentFlow(s) {
  const pe = P("h.nowak"); const mine = D.participants.filter((x) => x.person === pe?.id);
  const dist = mine.find((x) => byId("rooms", x.room)?.mode === "distanz"); const pres = mine.find((x) => byId("rooms", x.room)?.name === "WG12a · Präsenzunterricht");
  const su = pe ? { person: pe.id, role: "schueler", extra: { portal: pe.id } } : null;
  return [
    { t: 34, title: "Meine Teilnahmen: Distanzeinheit wählen", text: "Als Schülerin Helena Nowak „Meine Teilnahmen“ öffnen. Präsenzunterricht und Distanzeinheit stehen gleichzeitig zur Wahl – bei der Distanzeinheit „Teilnehmen“ und die Einheit selbst starten.", as: su, go: "#/schueler", done: !!dist && !["nicht_eingeloggt"].includes(dist.status) },
    { t: 34, title: "Aufgabe bearbeiten und Abgabe markieren", text: "In der Distanzeinheit eine Aufgabe bearbeiten und als Abgabe markieren.", as: dist ? { role: "tn", pid: dist.id } : su, go: "#/tn/dashboard", done: !!dist && D.items.filter((i) => i.participant === dist.id && i.submission).length > (s.base.dsubs || 0) },
    { t: 34, title: "Einheit abschließen", text: "„Einheit beenden“ und abgeben. Ist die Einheit mehrfach durchlaufbar, kann sie im Zeitraum wiederholt werden.", as: dist ? { role: "tn", pid: dist.id } : su, go: "#/tn/abgaben", done: !!dist && ["abgegeben", "beendet"].includes(dist.status) && (dist.status !== s.base.dstatus || (dist.attempt || 1) > (s.base.dattempt || 1)) },
    { t: 34, title: "Erwartungshorizont mit Aufgabenstellung", text: "Nach Abschluss der Distanzeinheit „Erwartungshorizont ansehen“: zu jeder Teilaufgabe stehen Arbeitsauftrag (bei Auswahlfragen mit Antwortoptionen) und Erwartungshorizont untereinander.", optional: true, manual: "hz", as: dist ? { role: "tn", pid: dist.id } : su, go: "#/tn/erwartung", done: !!s.manual?.hz },
    { t: 36, title: "Korrektur und Ergebnis ansehen", text: "Zurück zu „Meine Teilnahmen“ › „Ergebnisse“: die freigegebene Korrektur des Probelaufs mit Punkten, Note, Begründung und Korrekturzeichen.", as: su, go: "#/schueler", manual: "erg", done: !!s.manual?.erg },
    { t: 34, title: "Präsenzunterricht: Wartebereich", text: "Am Präsenzunterricht teilnehmen: Im Unterricht entfallen Belehrung und Gesundheitsabfrage – Sie warten direkt auf den Start durch die Lehrkraft. Die Demo der Arbeitsumgebung lässt sich im Wartebereich starten. (optional)", optional: true, as: pres ? { role: "tn", pid: pres.id } : su, go: "#/tn", done: !!pres && pres.status !== "nicht_eingeloggt" },
  ];
}

// ---------- Eigene Unterrichtsinhalte (Lehrkraft) ----------
function ownContent(s) {
  const E = P("a.eggert"); const lk = asPerson("a.eggert", "lehrkraft");
  const c = D.catalog.filter((x) => x.mine && x.editor_by === E?.id && !s.base.catalog.includes(x.id)).sort((a, b) => (a.created > b.created ? -1 : 1))[0];
  const course = c && D.courses.find((x) => x.catalog === c.id);
  const mitb = course && members(course).find((m) => m.role === "mitbetreuung");
  if (c?.release && !s.manual?.relseen) { s.manual.relseen = true; save(s); }
  return [
    { t: 31, title: "Eigenen Inhalt mit Unterricht erstellen", text: "Als Lehrkraft Amir Eggert im Katalog „Neuen Inhalt erstellen“ (mit „Unterricht anlegen“) – alternativ einen Katalogeintrag kopieren: Es entsteht eine eigene, bearbeitbare Kopie.", as: lk, go: "#/app/katalog", done: !!c },
    { t: 31, title: "Inhalt im Editor bearbeiten", text: "Aufgaben, Materialien (z. B. Datei unter „Eigene Dateien“, E-Mail „vor 2 Tagen“) und Bewertung anlegen und speichern.", as: lk, go: c ? `#/app/editor/${c.id}/aufgaben` : "#/app/katalog", done: !!c && c.updated !== c.created },
    { t: 31, title: "Weitere Lehrkraft als Mitbetreuung", text: "Im Unterricht „Lehrkraft hinzufügen“ (z. B. Lina Voigt). Die Mitbetreuung kann den Inhalt ebenfalls bearbeiten.", as: lk, go: course ? `#/app/kurs/${course.id}/mitglieder` : "#/app/kurse", done: !!mitb },
    { t: 31, title: "Mitbetreuung bearbeitet den Inhalt", text: `Als ${esc(personName(byId("persons", mitb?.person)) || "Mitbetreuung")} den Inhalt im Editor öffnen und ändern. (optional)`, optional: true, as: mitb ? { person: mitb.person, role: "lehrkraft" } : lk, go: c ? `#/app/editor/${c.id}/allgemein` : "#/app/kurse", manual: "mitb", done: !!s.manual?.mitb },
    { t: "–", title: "Für die eigene Schule im Katalog freigeben", text: "Im Unterricht oder Editor „Für meine Schule freigeben“: Lehrkräfte der AFS sehen das Material im Katalog (Reiter „Meine Schule“).", as: lk, go: course ? `#/app/kurs/${course.id}/mitglieder` : "#/app/katalog", done: !!c?.release || !!s.manual?.relseen },
    { t: "–", title: "Sichtbarkeit prüfen", text: "Als Lehrkraft einer anderen Schule (Emil Gaspari, BTS) den Katalog öffnen: Das Material erscheint nicht.", as: asPerson("e.gaspari", "lehrkraft"), go: "#/app/katalog", manual: "vis", done: !!s.manual?.vis },
    { t: "–", title: "Freigabe beenden", text: "Als Amir Eggert die Freigabe wieder beenden (Katalog › „Eigene Inhalte“). Nur der Einsteller kann das. (optional)", optional: true, as: lk, go: "#/app/katalog", done: !!s.manual?.relseen && !!c && !c.release },
  ];
}

// ---------- Kammer: externe Prüflinge (Arten 1–4), Annahme und Ummeldung ----------
const pr1c = () => D.courses.find((x) => x.title === "FA230 - Musterprüfung");
const pr3c = () => D.courses.find((x) => x.kind === "pruefung" && String(x.title).startsWith("Zwischenprüfung"));
const xe = (c, u) => (c?.ext || {})[P(u)?.id] || null;
const partOf = (c, pid, org) => !!pid && D.participants.some((x) => x.person === pid && byId("rooms", x.room)?.course === c?.id && (!org || byId("rooms", x.room)?.org === org));
const partIn = (c, u, org) => partOf(c, P(u)?.id, org);
const corrFor = (c, pid, org, stage) => !!pid && (c?.corrections || []).some((a) => a.kind === "person" && a.target === pid && a.org === org && +a.stage === stage);
const roomIn = (c, name) => D.rooms.find((r) => r.name === name && r.course === c?.id);
const kLinks = (c) => (t) => c && `#/app/kurs/${c.id}/${t}`;
function kammerArt2(s) {
  const c = pr1c(); const L = kLinks(c); const KA = asPerson("j.lindemann", "kammeradmin"); const SA = asPerson("m.hinrichs", "schuladmin");
  const afs = P("m.hinrichs")?.org; const e = xe(c, "p.engel"); const r124 = roomIn(c, "Raum 124");
  return [
    { t: "K", title: "Kammer: Prüfling einer Schule zuordnen (Art 2)", text: "Als Kammeradministration (Jasper Lindemann, IHK Musterstadt) unter „Externe Prüflinge“ bei Paula Engel – von der GWS abgelehnt, noch nicht versorgt – „Ändern“: Art 2 (Durchführung und Korrektur an der Schule) und die Ahornfeld-Schule (AFS) wählen. Die AFS wird benachrichtigt.", as: KA, go: L("zuordnung"), done: !!e && +e.art === 2 && e.school === afs },
    { t: "K", title: "Schule: Vorschlag annehmen", text: "Als Schuladministration der AFS (Marit Hinrichs) die Benachrichtigung öffnen bzw. „Externe Prüflinge“: Vor der Annahme sehen Sie nur Anzahl, Art und Nachteilsausgleich. „Annehmen“ – erst danach erscheinen Name, Vorname und Prüflingsnummer.", as: SA, go: L("extern"), done: !!e && e.school === afs && e.status === "angenommen" },
    { t: 52, title: "Schule: Raumaufsicht zuordnen", text: "In der Raumaufsicht „Raum 124“ „Teilnehmende hinzufügen“: Paula Engel steht als angenommener externer Prüfling zur Auswahl – nur in dieser Prüfung. Den Nachteilsausgleich pflegt die Kammer; an der Schule ist er nur lesbar.", as: SA, go: r124 && `#/app/raum/${r124.id}/teilnehmende`, done: partIn(c, "p.engel", afs) },
    { t: 24, title: "Schule: Korrektor:innen zuweisen", text: "Reiter „Korrektoren“ › Erstkorrektur › „Korrektorengruppe zuweisen“ › „Einzelne Prüflinge“: Paula Engel (Art 2) einer Lehrkraft der AFS zuweisen. Externe Prüflinge mit Art 3 erscheinen hier nicht – sie korrigiert die Kammer.", as: SA, go: L("korrektoren"), done: corrFor(c, P("p.engel")?.id, afs, 1) },
    { t: "K", title: "Kammer: Stand der Durchführung", text: "Als Kammeradministration „Durchführung“: Sie sehen nur Ihre eigenen externen Prüflinge (Ort, Raumaufsicht, Termin, Status, Zeitgutschrift) – nicht die übrigen Teilnehmenden oder Aufsichtspersonen. Protokolleinträge einer Schule erst nach deren Freigabe.", manual: "kdf", as: KA, go: L("durchfuehrung"), done: !!s.manual?.kdf },
    { t: 37, title: "Kammer: Prüfungseinsicht", text: "Als Kammer-Prüfungseinsicht (Hanno Weißgerber): Die Einsicht externer Prüflinge findet immer bei der Kammer statt – auch bei Svenja Lorenz, die in der Zwischenprüfung an der AFS geschrieben hat und dort korrigiert wurde. Die Prüfungseinsicht der AFS sieht sie nicht. (optional)", optional: true, manual: "kei", as: asPerson("h.weissgerber", "einsicht"), go: "#/app/pruefungseinsicht", done: !!s.manual?.kei },
  ];
}
function kammerArt3(s) {
  const c = pr1c(), c3 = pr3c(); const L = kLinks(c); const KA = asPerson("j.lindemann", "kammeradmin"); const SB = asPerson("i.ammermann", "schuladmin"); const bts = P("i.ammermann")?.org;
  const e = xe(c, "l.sander"); const r201 = roomIn(c, "Raum 201"); const r110 = roomIn(c3, "Raum 110");
  return [
    { t: "K", title: "Schule: Vorschlag (Art 3) annehmen", text: "Als Schuladministration der Birkental-Schule (Ilka Ammermann) unter „Externe Prüflinge“ den Vorschlag der IHK Musterstadt annehmen: Art 3 – nur Durchführung an Ihrer Schule, die Korrektur übernimmt die Kammer.", as: SB, go: L("extern"), done: e?.status === "angenommen" },
    { t: 52, title: "Schule: Raumaufsicht zuordnen", text: "Raum 201 › „Teilnehmende hinzufügen“: Leonie Sander (extern) zuordnen. Ihr Nachteilsausgleich (10 Min.) kommt von der Kammer.", as: SB, go: r201 && `#/app/raum/${r201.id}/teilnehmende`, done: partIn(c, "l.sander", bts) },
    { t: 24, title: "Schule: keine Korrektur bei Art 3", text: "Reiter „Korrektoren“: Externe Prüflinge mit Art 3 (Leonie Sander, Can Hoffmeister) stehen nicht zur Auswahl – nach dem Beenden geht die Prüfung direkt an die Kammer.", manual: "k3", as: SB, go: L("korrektoren"), done: !!s.manual?.k3 },
    { t: 23, title: "Schule: Prüfungsprotokoll freigeben", text: "In der abgeschlossenen Zwischenprüfung hat Jonas Krämer (Art 3) im Raum 110 der BTS geschrieben: „Prüfungsprotokoll“ › „Protokoll freigeben“. Erst danach sieht die Kammer die Einträge ihres Prüflings; Durchführung und Protokoll bleiben bei der Schule.", as: SB, go: r110 && `#/app/raum/${r110.id}/protokoll`, done: !!r110?.prot_released },
    { t: "K", title: "Kammer: Protokolleinträge des eigenen Prüflings", text: "Als Kammeradministration in der Zwischenprüfung „Durchführung“: Für Jonas Krämer sind jetzt die Protokolleinträge sichtbar – nur seine, nicht die des gesamten Raums.", manual: "kp3", as: KA, go: c3 && `#/app/kurs/${c3.id}/durchfuehrung`, done: !!s.manual?.kp3 },
    { t: 20, title: "Kammer: Korrektur durch die Kammer", text: "Als Kammer-Korrektorin (Mira Fenske, Erstkorrektur): Die Korrekturübersicht zeigt die externen Prüflinge mit Art 1 und 3, z. B. Jonas Krämer aus der Zwischenprüfung. (optional)", optional: true, manual: "kk3", as: asPerson("m.fenske", "korrektor", { corrector: 1 }), go: "#/app/korrektur", done: !!s.manual?.kk3 },
  ];
}
function kammerArt1(s) {
  const c = pr1c(); const L = kLinks(c); const KA = asPerson("j.lindemann", "kammeradmin"); const km = P("j.lindemann")?.org; const e = xe(c, "m.jansen"); const kr = roomIn(c, "Prüfungssaal 1");
  return [
    { t: "K", title: "Kammer prüft selbst (Art 1)", text: "Als Kammeradministration (Jasper Lindemann) unter „Externe Prüflinge“ bei Marek Jansen (noch nicht versorgt) „Zuordnen“: Art 1 – die Kammer prüft selbst. Keine Schule ist beteiligt.", as: KA, go: L("zuordnung"), done: +e?.art === 1 },
    { t: 21, title: "Raumaufsicht der Kammer", text: "„Raumaufsichten“ › Prüfungssaal 1 › „Teilnehmende hinzufügen“: Marek Jansen zuordnen. In Räumen der Kammer stehen nur externe Prüflinge mit Art 1 oder 4 zur Auswahl.", as: KA, go: kr && `#/app/raum/${kr.id}/teilnehmende`, done: partIn(c, "m.jansen", km) },
    { t: 52, title: "Rolle in der Kammer vergeben", text: "„Rollen in der Kammer“ › Raumaufsichten › „Raumaufsicht hinzufügen“: Mira Fenske. Die Kammer vergibt die Rollen innerhalb ihrer Organisation wie eine Schule.", as: KA, go: L("mitglieder"), done: members(c || {}).some((m) => m.person === P("m.fenske")?.id && m.role === "raumaufsicht") },
    { t: 24, title: "Korrektur durch die Kammer", text: "„Korrektoren“ › Erstkorrektur › „Korrektorengruppe zuweisen“: Marek Jansen → Ole Brückner (Kammer).", as: KA, go: L("korrektoren"), done: corrFor(c, P("m.jansen")?.id, km, 1) },
    { t: 22, title: "Kammer-Raumaufsicht", text: "Als Kammer-Raumaufsicht (Hanno Weißgerber): Sie sehen nur die Raumaufsicht der Kammer im Prüfungssaal 1 mit den externen Prüflingen der Kammer.", manual: "kr1", as: asPerson("h.weissgerber", "aufsicht"), go: kr && `#/app/raum/${kr.id}/meinraum`, done: !!s.manual?.kr1 },
  ];
}
function kammerArt4(s) {
  const c = pr1c(); const L = kLinks(c); const KA = asPerson("j.lindemann", "kammeradmin"); const km = P("j.lindemann")?.org; const kr = roomIn(c, "Prüfungssaal 1");
  const nx = D.persons.filter((p) => p.kind === "extern" && p.org === km && !(s.base.persons || []).includes(p.id)).sort((a, b) => String(b.created).localeCompare(String(a.created)))[0];
  const e = nx && (c?.ext || {})[nx.id]; const pool = (D.settings.find((x) => x.key === "kpool:" + km)?.value || []).map((x) => x.person);
  return [
    { t: "K", title: "Korrektorenpool ansehen", text: "Als Kammeradministration „Externe Prüflinge“: Unten steht der Korrektorenpool – Lehrkräfte der Schulen, die sich ehrenamtlich bereit erklärt haben (Name, Schule, Fach). Andere Lehrkräfte sieht die Kammer nicht.", manual: "pool", as: KA, go: "#/app/kammer", done: !!s.manual?.pool },
    { t: "K", title: "Externen Prüfling anlegen", text: "„Prüfling anlegen“ (oder „CSV importieren“): Name, Vorname, Prüflingsnummer und Nachteilsausgleich erfassen.", as: KA, go: "#/app/kammer", done: !!nx },
    { t: "K", title: "Zur Prüfung hinzufügen, Art 4 wählen", text: `„Prüfungen“ › FA230 › „Externe Prüflinge“ › „Prüflinge zur Prüfung hinzufügen“, danach bei ${nx ? esc(personName(nx)) : "dem neuen Prüfling"} „Zuordnen“: Art 4 – die Kammer prüft, Korrektur durch Lehrkräfte der Schulen.`, as: KA, go: L("zuordnung"), done: +e?.art === 4 },
    { t: 21, title: "Raumaufsicht der Kammer", text: "„Raumaufsichten“ › Prüfungssaal 1 › „Teilnehmende hinzufügen“: den neuen Prüfling zuordnen.", as: KA, go: kr && `#/app/raum/${kr.id}/teilnehmende`, done: partOf(c, nx?.id, km) },
    { t: 24, title: "Lehrkraft aus dem Pool zuweisen", text: "„Korrektoren“ › Erstkorrektur › „Korrektorengruppe zuweisen“: den Prüfling einer Lehrkraft aus dem Korrektorenpool zuweisen (z. B. Gesa Ohm, AFS).", as: KA, go: L("korrektoren"), done: !!nx && (c?.corrections || []).some((a) => a.target === nx.id && a.org === km && (a.correctors || []).some((x) => pool.includes(x))) },
    { t: 20, title: "Pseudonymisierte Korrektur", text: "Als Gesa Ohm (Erstkorrektur): In der Korrekturübersicht erscheint Elena Brandt (Art 4, Zwischenprüfung) nur als „Prüfling, MS-26-1006“ – ohne Namen. Die Prüflinge der eigenen Schule sieht sie wie gewohnt.", manual: "pseudo", as: asPerson("g.ohm", "korrektor", { corrector: 1 }), go: "#/app/korrektur", done: !!s.manual?.pseudo },
  ];
}
function kammerAnnahme(s) {
  const c = pr1c(); const L = kLinks(c);
  const SA = asPerson("m.hinrichs", "schuladmin"), SB = asPerson("i.ammermann", "schuladmin"), KA = asPerson("j.lindemann", "kammeradmin"), KB = asPerson("c.ostrowski", "kammeradmin");
  const afs = P("m.hinrichs")?.org, bts = P("i.ammermann")?.org; const lo = xe(c, "s.lorenz"), ro = xe(c, "f.roth"), kr = xe(c, "j.kraemer"); const r123 = room123();
  return [
    { t: "K", title: "Schule: Benachrichtigung und Annahme", text: "Als Marit Hinrichs (AFS): Auf der Seite „Prüfungen“ steht die Benachrichtigung „Externe Prüflinge zur Annahme“. Unter „Externe Prüflinge“ sehen Sie je Kammer nur Anzahl, Art und Nachteilsausgleich. Den Vorschlag der IHK Musterstadt annehmen (einzeln oder „Alle annehmen“).", as: SA, go: L("extern"), done: lo?.status === "angenommen" },
    { t: "K", title: "Schule: Vorschlag ablehnen", text: "Den Vorschlag der IHK Bergland (1 externer Prüfling) ablehnen, z. B. „keine freien Plätze“. Die Kammer wird benachrichtigt.", as: SA, go: L("extern"), done: ro?.status === "abgelehnt" || (!!ro && ro.school !== afs) },
    { t: "K", title: "Andere Kammer: neu zuordnen", text: "Als Kammeradministration der IHK Bergland (Carla Ostrowski): Benachrichtigung „Zuordnung abgelehnt“. Fabian Roth der Birkental-Schule (BTS) zuordnen – sie liegt in einem anderen Kammerbezirk; dazu „auch Schulen anderer Kammerbezirke anzeigen“. Die IHK Bergland sieht nur ihre eigenen Prüflinge.", as: KB, go: L("zuordnung"), done: ro?.school === bts },
    { t: "K", title: "Kammer: kurzfristige Ummeldung", text: "Jonas Krämer ist an der AFS (Raum 123) eingeplant, soll nach Absprache aber an der BTS schreiben: Als Jasper Lindemann (IHK Musterstadt) „Ändern“ → Art 2, BTS. Die AFS wird benachrichtigt und Jonas Krämer aus der noch nicht begonnenen Raumaufsicht entfernt.", as: KA, go: L("zuordnung"), done: kr?.school === bts },
    { t: "K", title: "Schule: Ummeldung annehmen", text: "Als Ilka Ammermann (BTS): Auch eine Ummeldung nimmt immer die Schuladministration an. Beide Vorschläge (IHK Bergland, IHK Musterstadt) annehmen.", as: SB, go: L("extern"), done: ro?.school === bts && ro.status === "angenommen" && kr?.school === bts && kr.status === "angenommen" },
    { t: "K", title: "Schule: Ergebnis der Ummeldung", text: "Als Marit Hinrichs (AFS): Benachrichtigung „Zuordnung durch die Kammer zurückgezogen“. In Raum 123 ist Jonas Krämer nicht mehr eingeplant; in keiner anderen Prüfung der AFS steht er zur Auswahl.", manual: "um", as: SA, go: r123 && `#/app/raum/${r123.id}/teilnehmende`, done: !!s.manual?.um },
  ];
}

export const KINDS = {
  erstellung: { name: "Klickstrecke Prüfungserstellung bis Prüfungsstart", short: "Prüfungserstellung", icon: "pencil", group: "Prüfungserstellung", fn: creation },
  stammdaten: { name: "Klickstrecke Stammdaten (Koordinierungsstelle)", short: "Stammdaten", icon: "database", group: "Prüfungserstellung", fn: masterFlow },
  pruefung: { name: "Klickstrecke Prüfung organisieren (Schuladministration)", short: "Prüfung organisieren", icon: "clipboard-list", group: "Prüfungsdurchführung", fn: exam },
  durchfuehrung: { name: "Klickstrecke Prüfung durchführen (Raumaufsicht und Prüfling)", short: "Prüfung durchführen", icon: "monitor", group: "Prüfungsdurchführung", fn: conduct },
  korrektur: { name: "Klickstrecke Korrektur und Ergebnisse", short: "Korrektur und Ergebnisse", icon: "file-pen-line", group: "Prüfungsdurchführung", fn: correction },
  einsicht: { name: "Klickstrecke Prüfungseinsicht", short: "Prüfungseinsicht", icon: "eye", group: "Prüfungsdurchführung", fn: einsicht },
  kammer_annahme: { name: "Klickstrecke Kammer: Annahme und Ummeldung", short: "Annahme und Ummeldung", icon: "user-round-plus", group: "Kammer", fn: kammerAnnahme },
  kammer_art2: { name: "Klickstrecke Kammer Art 2: Durchführung und Korrektur an der Schule", short: "Art 2 · Schule führt durch und korrigiert", icon: "school", group: "Kammer", fn: kammerArt2 },
  kammer_art3: { name: "Klickstrecke Kammer Art 3: nur Durchführung an der Schule", short: "Art 3 · Schule führt nur durch", icon: "monitor", group: "Kammer", fn: kammerArt3 },
  kammer_art1: { name: "Klickstrecke Kammer Art 1: Kammer prüft selbst", short: "Art 1 · Kammer prüft selbst", icon: "building-2", group: "Kammer", fn: kammerArt1 },
  kammer_art4: { name: "Klickstrecke Kammer Art 4: Korrektur durch Lehrkräfte (pseudonymisiert)", short: "Art 4 · Korrektur durch Lehrkräfte", icon: "file-pen-line", group: "Kammer", fn: kammerArt4 },
  unterricht: { name: "Klickstrecke Unterricht (Lehrkraft)", short: "Unterricht durchführen", icon: "book-open", group: "Unterricht", fn: lesson },
  inhalte: { name: "Klickstrecke Eigene Unterrichtsinhalte (Lehrkraft)", short: "Eigene Inhalte", icon: "copy", group: "Unterricht", fn: ownContent },
  schueler: { name: "Klickstrecke Schüler:in", short: "Schüler:in", icon: "graduation-cap", group: "Unterricht", fn: studentFlow },
  katalog: { name: "Klickstrecke Katalog (Bereichsadministration)", short: "Katalog pflegen", icon: "library", group: "Katalog", fn: catalogFlow },
};
const NAMES = Object.fromEntries(Object.entries(KINDS).map(([k, v]) => [k, v.name]));
// Übersprungene optionale Schritte gelten als erledigt
const steps = (s) => { const l = (KINDS[s.kind]?.fn || exam)(s); (s.skip || []).forEach((i) => { if (l[i]) l[i].done = true; }); return l; };

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
  const base = { courses: D.courses.map((c) => c.id), rooms: D.rooms.map((r) => r.id), catalog: D.catalog.map((c) => c.id), persons: D.persons.map((p) => p.id) };
  // Ausgangsstand für die Erkennung der Schritte
  const r = room123(); const tp = D.participants.find((x) => x.room === r?.id && x.username === "n.froehlke");
  const pr1 = D.courses.find((x) => x.title === "FA230 - Musterprüfung"); const nw = P("h.nowak"); const dist = D.participants.find((x) => x.person === nw?.id && byId("rooms", x.room)?.mode === "distanz");
  Object.assign(base, { subs: tp ? D.items.filter((i) => i.participant === tp.id && i.submission).length : 0, prot: r ? D.protocol.filter((x) => x.room === r.id).length : 0,
    g1: gjson(1), g2: gjson(2), a1: approvals(1), g3n: D.gradings.filter((g) => +g.corrector === 3).length, third: JSON.stringify(pr1?.third || {}),
    ein0: D.protocol.filter((x) => x.action === "Prüfungseinsicht begonnen").length, ein1: D.protocol.filter((x) => x.action === "Prüfungseinsicht beendet").length,
    berufe: sj("berufe"), orgs: orgJ(), kom: komJ(), pools: poolN(), signs: sj("signsets"),
    dsubs: dist ? D.items.filter((i) => i.participant === dist.id && i.submission).length : 0, dstatus: dist?.status || "", dattempt: dist?.attempt || 1 });
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
export const isPaused = () => !!st()?.paused;
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
    ${s.open ? `<div class="gp-bar"><i style="width:${Math.round((done / list.length) * 100)}%"></i></div><ol class="gp-steps">${list.map((x, i) => (!s.full && i !== cur && !(!x.done && x.optional && i < cur)) ? "" : `<li class="${x.done ? "done" : ""} ${i === cur ? "cur" : ""}"><div class="gp-row"><span class="gp-ico">${x.done ? icon("check") : i + 1}</span><span class="grow"><b>${esc(x.title)}</b>${x.optional ? ' <span class="xs muted">optional</span>' : ""}${x.t === "K" ? '<span class="xs muted"> · Kammer</span>' : `<span class="xs muted"> · Task ${x.t}</span>`}</span></div>
      ${i === cur || (!x.done && x.optional && i < cur) ? `<p class="small">${x.text}</p><div class="row wrap" style="gap:6px">${x.go ? `<button class="btn primary xs" data-ggo="${i}">${icon("arrow-right")} ${x.as ? "Anmelden und öffnen" : "Öffnen"}</button>` : ""}${x.manual ? `<button class="btn xs" data-gman="${x.manual === true ? "vis" : x.manual}">${icon("check")} Erledigt</button>` : ""}${x.optional ? `<button class="btn xs ghost" data-gskip="${i}">überspringen</button>` : ""}</div>` : ""}</li>`).join("")}</ol>
    ${done === list.length || cur < 0 || list.every((x) => x.done || x.optional) ? `<div class="notice success small">${icon("circle-check")}<span>Klickstrecke abgeschlossen${done < list.length ? " – optionale Schritte sind noch offen" : ""}.</span></div>` : ""}<div class="row between gp-foot"><button class="link xs" data-gfull>${s.full ? "Nur aktuellen Schritt" : `Alle Schritte anzeigen`}</button><a class="xs" href="#/">Personen wechseln</a><button class="link xs" data-gstop title="Die Klickstrecke wird angehalten und kann auf der Startseite an derselben Stelle fortgesetzt werden">Pausieren</button></div>` : ""}`;
  if (!old) document.body.appendChild(el);
  el.querySelector("[data-gtoggle]").onclick = () => { if (store.get("role") === "tn") { store.set("guideOpenTn", !store.get("guideOpenTn")); const v = st(); v.open = true; save(v); } else { const v = st(); v.open = !v.open; save(v); } mountPanel(); };
  el.querySelectorAll("[data-ggo]").forEach((b) => (b.onclick = () => { const x = steps(st())[+b.dataset.ggo]; loginAs(x.as); if (location.hash === x.go) render(); else navigate(x.go); }));
  el.querySelectorAll("[data-gman]").forEach((man) => (man.onclick = () => { const v = st(); v.manual[man.dataset.gman] = true; save(v); mountPanel(); }));
  el.querySelectorAll("[data-gskip]").forEach((b) => (b.onclick = () => { const v = st(); (v.skip ||= []).push(+b.dataset.gskip); save(v); mountPanel(); }));
  const fu = el.querySelector("[data-gfull]"); if (fu) fu.onclick = () => { const v = st(); v.full = !v.full; save(v); mountPanel(); };
  const stp = el.querySelector("[data-gstop]"); if (stp) stp.onclick = () => { stop(); render(); };
}
onChange(() => { if (active()) setTimeout(mountPanel, 50); });

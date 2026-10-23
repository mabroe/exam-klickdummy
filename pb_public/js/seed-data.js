// Exam Klickdummy – Demodaten (gemeinsame Quelle)
// Wird von PocketBase (pb_hooks/seed.js, per require) und im Browser-Modus (js/localdb.js) verwendet.
// Erzeugt reine Datensätze mit festen IDs; Beziehungen sind damit in beiden Umgebungen identisch.
// Alle Personennamen sind zufällig erzeugte Fantasienamen – Ähnlichkeiten mit realen Personen sind nicht beabsichtigt.
(function (root) {
  // Stand der Demodaten. Erhöhen, wenn sich die Demodaten ändern – ältere Datenbestände werden beim Start automatisch neu aufgebaut.
  var SEED_VERSION = 18;
  var COLLECTIONS = ["orgs", "venues", "persons", "groups", "courses", "rooms", "participants", "supervisors", "protocol", "items", "gradings", "comments", "tasks", "catalog", "kfiles", "settings"];

  // Bewertungskriterien je Teilaufgabe (Maximalpunkte) – muss zu js/scenario.js passen
  var CRITERIA = {
    "1.1": [2, 2, 1], "1.2": [4, 4, 2], "1.3": [5, 3, 2],
    "2.1": [4, 3, 3], "2.2": [4, 4, 2], "2.3": [5, 3, 2],
    "3.1": [8, 4, 3], "3.2": [8, 5, 2],
  };

  function iso(d) { return d.toISOString().replace("T", " "); }
  function pad(n) { return ("0" + n).slice(-2); }
  function hm(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function uname(l, f) { return (f[0] + "." + l).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/\s/g, ""); }
  function rid() { var a = "abcdefghijklmnopqrstuvwxyz0123456789", s = ""; for (var i = 0; i < 15; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

  function build(nowMs) {
    var out = {}; COLLECTIONS.forEach(function (c) { out[c] = []; });
    function add(c, data) { var r = Object.assign({ id: rid() }, data); out[c].push(r); return r; }
    var now = new Date(nowMs || Date.now());
    var planned = new Date(now.getTime() + 20 * 60 * 1000);
    var at = function (min) { return hm(new Date(planned.getTime() + min * 60000)); };

    // ---------- Schulen und reale Räume (nur für Prüfungen; verhindern Doppelbelegungen) ----------
    // Ausbildungsberufe je Schule (für die Auswahl der Organisationen einer Prüfung)
    var afs = add("orgs", { name: "Ahornfeld-Schule Musterstadt", short: "AFS", city: "Musterstadt", berufe: ["bm", "ik", "fisi", "fiae"] });
    var bts = add("orgs", { name: "Birkental-Schule Musterstadt", short: "BTS", city: "Musterstadt", berufe: ["bm", "eh", "fisi", "fiae"] });
    var MORE = [["Christophorus-Schule Neudorf am Hang", "CSN", "Neudorf am Hang", ["ik", "eh", "mech"], ["Kirchhoff", "Bente"]],
      ["Dornbach-Schule Talwiesen", "DST", "Talwiesen", ["bm", "eh"], ["Seidenfaden", "Jörn"]],
      ["Eschenhain-Schule Bergstetten", "EHS", "Bergstetten", ["fisi", "fiae", "mech"], ["Ollendorf", "Pia"]],
      ["Ginsterweg-Schule Beispielhausen", "GWS", "Beispielhausen", ["bm", "ik"], ["Weidenbach", "Torge"]],
      ["Holunderhof-Schule Talwiesen", "HHS", "Talwiesen", ["fisi", "mech"], ["Quast", "Henrike"]],
      ["Ilexgrund-Schule Bergstetten", "IGS", "Bergstetten", ["bm", "ik", "eh", "fisi", "fiae"], ["Rautenberg", "Silas"]],
      ["Kastanienallee-Schule Musterstadt", "KAS", "Musterstadt", ["bm", "fiae"], ["Mertensen", "Jule"]],
      ["Lärchenweg-Schule Neudorf am Hang", "LWS", "Neudorf am Hang", ["eh", "ik", "bm"], ["Vosskuhl", "Arne"]]]
      .map(function (x) { return { org: add("orgs", { name: x[0], short: x[1], city: x[2], berufe: x[3] }), admin: x[4] }; });
    var V = {};
    [[afs, "Raum 123", "Haus A", 3, 5], [afs, "Raum 124", "Haus A", 4, 6], [afs, "Raum 105", "Haus A", 4, 6], [afs, "Raum 202", "Haus B", 4, 6], [afs, "Raum 204", "Haus B", 4, 5], [afs, "Raum 305", "Haus C", 4, 6], [afs, "PC-Pool 2", "Haus B", 4, 6], [afs, "PC-Pool 3", "Haus B", 3, 6],
     [bts, "Raum 201", "Hauptgebäude", 4, 6], [bts, "Aula (Großraum)", "Hauptgebäude", 10, 12], [bts, "Raum 017", "Werkstattgebäude", 4, 5], [bts, "Raum 110", "Hauptgebäude", 5, 6]]
      .forEach(function (v) { V[v[1]] = add("venues", { org: v[0].id, name: v[1], building: v[2], rows: v[3], cols: v[4], capacity: v[3] * v[4], layout: "reihen" }); });

    // ---------- Konten: Lehrkräfte und Schuladministration ----------
    var P = function (lastname, firstname, org, kind, short) { return add("persons", { lastname: lastname, firstname: firstname, username: uname(lastname, firstname), org: org.id, kind: kind, short: short || "", email: uname(lastname, firstname) + "@" + (org === afs ? "afs" : "bts") + ".schule.bw" }); };
    var T = {};
    [["Eggert", "Amir", "AE"], ["Riedmüller", "Thea", "TR"], ["Voigt", "Lina", "LV"], ["Ohm", "Gesa", "GO"], ["Steinhoff", "Ayla", "AS"], ["Ebeling", "Karim", "KE"], ["Morawetz", "Ilyas", "IM"]]
      .forEach(function (x) { T[x[0]] = P(x[0], x[1], afs, "lehrkraft", x[2]); });
    // Lehrkraft mit Abordnung: Stammschule AFS, zusätzlich der BTS zugeordnet (sieht die berechtigten Informationen beider Schulen)
    T.Morawetz.orgs = [afs.id, bts.id];
    // Prüfungserstellung (Instanz OPE): Koordinierungsstelle und Lektorat ohne Schulzuordnung; Kommission, Aufgabenerstellung usw. sind Lehrkräfte der Schulen
    var X = function (lastname, firstname, kind, short) { return add("persons", { lastname: lastname, firstname: firstname, username: uname(lastname, firstname), org: "", kind: kind, short: short, email: uname(lastname, firstname) + "@ibbw.example" }); };
    T.Brandauer = X("Brandauer", "Lisette", "koordination", "LB");
    T.Kowalczyk = X("Kowalczyk", "Dorian", "fachexperte", "DK");
    T.Hinrichs = P("Hinrichs", "Marit", afs, "schuladmin", "MH");
    T.Ammermann = P("Ammermann", "Ilka", bts, "schuladmin", "IA");
    T.Gaspari = P("Gaspari", "Emil", bts, "lehrkraft", "EG");
    // weitere Koordinierungsstelle (gleichzeitige Bearbeitung testen) und Bereichsadministration (Katalog)
    T.Tessendorf = X("Tessendorf", "Malin", "koordination", "MT");
    T.Hollerbach = X("Hollerbach", "Wenke", "bereichsadmin", "WH");
    MORE.forEach(function (m) { P(m.admin[0], m.admin[1], m.org, "schuladmin", m.admin[0][0] + m.admin[1][0]).email = uname(m.admin[0], m.admin[1]) + "@" + m.org.short.toLowerCase() + ".schule.bw"; });
    T["Dähne"] = P("Dähne", "Niklas", bts, "lehrkraft", "ND");

    // ---------- Katalog ----------
    // Katalog nur für den Unterricht: Prüfungsähnliche Inhalte dienen als Übung/Prüfungsvorbereitung
    var C = function (title, beruf, fach, jahr, kind, image, description) {
      if (kind === "Prüfung") kind = "Lernerfolgskontrolle";
      return add("catalog", {
        title: title, beruf: beruf, fach: fach, jahr: jahr, kind: kind, image: image, description: description, duration: kind === "Prüfung" ? "90 Minuten" : "45 Minuten", creator: "IBBW",
        tags: [kind === "Prüfung" ? "Prüfungen" : "Lernerfolgskontrolle", "Teil " + (1 + (image % 2))],
        contents: ["Ausgangssituation mit Unternehmensprofil", "Arbeitsaufträge mit E-Mail-Client und Kalender", "Bereitgestellte Dateien und Vorlagen", "Erwartungshorizont und Bewertungsraster"],
        mine: false, copied_from: "", release: { scope: "global", by: T.Hollerbach.id, at: iso(new Date(now.getTime() - 86400000 * 30)) },
      });
    };
    C("Prüfung XY", "Fachinformatiker Systemintegration", "IT-Systeme", "2023", "Prüfung", 0, "Dieser Kurs vermittelt fortgeschrittene Excel-Funktionen wie Pivot-Tabellen, SVERWEIS, komplexe Formeln und Datenanalyse.");
    // Prüfung FA230: Inhalt der Prüfung (kein Katalogeintrag – im Erstellungsprozess veröffentlicht)
    var catFA = C("FA230 - Musterprüfung", "Kaufmann/-frau für Büromanagement", "Geschäftsprozesse", "2024", "Prüfung", 1, "Musterprüfung mit Angebotsvergleich, Kalkulation und Netzwerkkonfiguration am Bildschirmarbeitsplatz.");
    catFA.kind = "Prüfung"; catFA.tags = ["Prüfungen"]; catFA.status = "veroeffentlicht"; catFA.editor_by = "prozess"; catFA.release = null;
    catFA.meta = { titel: "FA230 - Musterprüfung", art: "Musterprüfung", beruf: "Kaufmann/-frau für Büromanagement", bereich: "Geschäftsprozesse", code: "FA230", termin: iso(planned).slice(0, 16).replace(" ", "T"), dauer: 90, einsicht_h: 24, orgs: [afs.id, bts.id], beruf_id: "bm", berufsnr: "10101", fachbereich: "kfm", ptitel: "Musterprüfung Geschäftsprozesse", jahr: String(now.getFullYear()), pool: "funsport", version: 1 };
    catFA.team = {}; catFA.history = [{ at: iso(new Date(now.getTime() - 86400000 * 40)), by: "Koordinierungsstelle", ev: "angelegt", text: "Prüfung angelegt", to: "vorbereitung" }, { at: iso(new Date(now.getTime() - 86400000)), by: "Koordinierungsstelle", ev: "begutachtung", text: "Begutachtung durch die Schulen freigeschaltet (24 h vor Prüfungsstart)", from: "gesperrt", to: "begutachtung" }, { at: iso(new Date(now.getTime() - 3600000)), by: "System", ev: "veroeffentlicht", text: "Prüfungsstart erreicht – Inhalt für die Durchführung freigegeben", from: "begutachtung", to: "veroeffentlicht" }];
    C("FA230 - Musterprüfung (Übung für den Unterricht)", "Kaufmann/-frau für Büromanagement", "Geschäftsprozesse", "2024", "Lernerfolgskontrolle", 1, "Übungsfassung der Musterprüfung FA230 für den Unterricht: Angebotsvergleich, Kalkulation und Netzwerkkonfiguration am Bildschirmarbeitsplatz.");
    C("Grundlagen Tabellenkalkulation", "Kaufmann/-frau für Büromanagement", "Informationsverarbeitung", "2022", "Lernerfolgskontrolle", 2, "Zellbezüge, kopierfähige Formeln und die WENN-Funktion sicher anwenden.");
    C("Netzwerktechnik kompakt", "Fachinformatiker Systemintegration", "Vernetzte Systeme", "2024", "Lernerfolgskontrolle", 3, "IPv4-Subnetting, VLANs und Firewall-Grundregeln an einem Praxisfall.");
    C("Datenbanken und SQL", "Fachinformatiker Anwendungsentwicklung", "Datenbanken", "2023", "Prüfung", 0, "Relationale Modellierung, SELECT-Abfragen mit JOIN und Aggregatfunktionen.");
    C("Objektorientierte Programmierung", "Fachinformatiker Anwendungsentwicklung", "Programmierung", "2025", "Lernerfolgskontrolle", 1, "Klassen, Vererbung und Polymorphie in Python und Java.");
    C("Kundenkommunikation per E-Mail", "Kaufmann/-frau im Einzelhandel", "Kommunikation", "2022", "Lernerfolgskontrolle", 2, "Normgerechte Geschäftskorrespondenz nach DIN 5008 im E-Mail-Client.");
    C("Beschaffungsprozesse", "Industriekaufmann/-frau", "Geschäftsprozesse", "2023", "Prüfung", 3, "Bedarfsermittlung, Bezugskalkulation und Lieferantenauswahl.");
    C("Abschlussprüfung Teil 1 – Probelauf", "Fachinformatiker Systemintegration", "IT-Systeme", "2025", "Prüfung", 0, "Probelauf für AP Teil 1 mit allen Werkzeugen der Prüfungsumgebung.");
    C("Kosten- und Leistungsrechnung", "Industriekaufmann/-frau", "Rechnungswesen", "2024", "Lernerfolgskontrolle", 1, "Kostenarten, Kostenstellen und Deckungsbeitragsrechnung.");
    var catWeb = C("Webentwicklung HTML/CSS", "Fachinformatiker Anwendungsentwicklung", "Programmierung", "2025", "Lernerfolgskontrolle", 2, "Semantisches HTML und responsives Layout mit CSS Grid.");
    // noch nicht freigegeben (Entwurf der Bereichsadministration)
    C("IT-Sicherheit im Unternehmen", "Fachinformatiker Systemintegration", "Vernetzte Systeme", "2022", "Prüfung", 3, "Schutzbedarfsfeststellung, Backup-Konzepte und Rechtevergabe.").release = null;
    C("Unterrichtseinheit Marketing", "Kaufmann/-frau im Einzelhandel", "Marketing", "2023", "Lernerfolgskontrolle", 0, "Marketing-Mix und Kundenbefragung auswerten.");
    C("Präsentation und Moderation", "Kaufmann/-frau für Büromanagement", "Kommunikation", "2024", "Lernerfolgskontrolle", 1, "Präsentationen strukturieren und Ergebnisse moderieren.");

    // ---------- Kurse (Prüfungsebene / Unterrichtsebene) ----------
    var CO = function (data) { return add("courses", Object.assign({ status: "veröffentlicht", exam_code: "FA230", description: "", orgs: [], groups: [], members: [], org: "", owner: "", catalog: "" }, data)); };
    var pr1 = CO({ title: "FA230 - Musterprüfung", kind: "pruefung", catalog: catFA.id, orgs: [afs.id, bts.id],
      description: "Prüfung der Koordinierungsstelle (Instanz OPP). Schuladministration ordnet Teilnehmende, Raumaufsichten und Korrektoren zu." });
    var pr2 = CO({ title: "Interne Evaluation", kind: "pruefung", orgs: [afs.id], exam_code: "" });
    // Unterricht: Die Lehrkraft arbeitet mit einer eigenen Kopie des Katalogeintrags (im Editor bearbeitbar, auch durch die Mitbetreuung)
    var copyOf = function (src, owner, title) { var k = add("catalog", Object.assign({}, src, { id: rid(), title: title || src.title, mine: true, copied_from: src.id, editor_by: owner.id, creator: owner.lastname + ", " + owner.firstname, release: null })); return k; };
    var u1 = CO({ title: "Zentrale Klassenarbeit HTML", kind: "unterricht", catalog: "", org: afs.id, owner: T.Eggert.id, members: [{ person: T.Eggert.id, role: "besitzer" }] });
    var u2 = CO({ title: "Klassenarbeit HTML WG12b", kind: "unterricht", catalog: "", org: afs.id, owner: T.Morawetz.id, members: [{ person: T.Morawetz.id, role: "besitzer" }] });
    var u3 = CO({ title: "Zentrale Klassenarbeit CSS", kind: "unterricht", catalog: "", org: bts.id, owner: T.Gaspari.id, members: [{ person: T.Gaspari.id, role: "besitzer" }, { person: T.Morawetz.id, role: "mitbetreuung" }] });
    // eigenes Unterrichtsmaterial der Lehrkraft, für die eigene Schule im Katalog freigegeben
    var ownLek = add("catalog", { title: "Übung Bezugskalkulation (AFS)", beruf: "Kaufmann/-frau für Büromanagement", fach: "Geschäftsprozesse", jahr: String(now.getFullYear()), kind: "Lernerfolgskontrolle", image: 2, description: "Eigene Übung von Amir Eggert: Bezugskalkulation und Angebotsvergleich – für die Lehrkräfte der Ahornfeld-Schule freigegeben.", duration: "45 Minuten", creator: "Eggert, Amir", tags: ["Lernerfolgskontrolle", "eigene Schule"], contents: ["Ausgangssituation mit Unternehmensprofil", "Arbeitsaufträge mit E-Mail-Client", "Bewertungsraster"], mine: true, copied_from: "", editor_by: T.Eggert.id, release: { scope: "org", org: afs.id, by: T.Eggert.id, at: iso(new Date(now.getTime() - 86400000 * 3)) } });

    // ---------- Raumaufsichten ----------
    // Prüfung: realer Raum (venue) der Schule. Unterricht: kein realer Raum – Sitzplätze und Anordnung legt die Lehrkraft fest.
    var R = function (data) {
      return add("rooms", Object.assign({ exam_code: "", state: "CREATED", duration_min: 90, global_extra: 0, paused_total_s: 0, created_label: "16.10.2026, 11:30", start_earliest: "08:30", start_latest: "09:00", layout: "reihen", venue: "", group_size: 0, lockdown: false }, data));
    };
    var fromVenue = function (v) { return { name: v.name, venue: v.id, capacity: v.capacity, rows: v.rows, cols: v.cols, layout: v.layout }; };
    var day = function (i) { var d = new Date(now.getTime() + i * 86400000); d.setHours(8, 30, 0, 0); return iso(d); };
    var now0 = { planned_start: iso(planned), start_earliest: hm(planned), start_latest: at(30), lockdown: true, exam_code: "FA230" };
    var room = R(Object.assign(fromVenue(V["Raum 123"]), now0, { exam_name: pr1.title, course: pr1.id, org: afs.id, owner: T.Hinrichs.id }));
    var aula = R(Object.assign(fromVenue(V["Aula (Großraum)"]), now0, { exam_name: pr1.title, course: pr1.id, org: bts.id, owner: T.Ammermann.id }));
    R(Object.assign(fromVenue(V["Raum 124"]), { exam_name: pr1.title, exam_code: "FA230", planned_start: day(1), course: pr1.id, org: afs.id, owner: T.Hinrichs.id }));
    R(Object.assign(fromVenue(V["Raum 201"]), { exam_name: pr1.title, exam_code: "FA230", planned_start: day(2), course: pr1.id, org: bts.id, owner: T.Ammermann.id }));
    R(Object.assign(fromVenue(V["Raum 105"]), { exam_name: pr2.title, planned_start: day(7), course: pr2.id, org: afs.id, owner: T.Hinrichs.id }));
    var V_ = function (name, cap, layout, extra) { var o = { name: name, capacity: cap, layout: layout, venue: "" }; if (layout === "reihen" || layout === "versetzt") { o.cols = (extra && extra.cols) || 5; o.rows = Math.ceil(cap / o.cols); } else { o.rows = 0; o.cols = 0; } if (layout === "gruppen") o.group_size = (extra && extra.group_size) || 4; return o; };
    R(Object.assign(V_("Klassenarbeit HTML · Gruppe A", 16, "reihen", { cols: 4 }), { exam_name: u1.title, planned_start: day(3), course: u1.id, org: afs.id, owner: T.Eggert.id }));
    R(Object.assign(V_("Klassenarbeit HTML · Gruppe B", 14, "uform"), { exam_name: u1.title, planned_start: day(3), course: u1.id, org: afs.id, owner: T.Eggert.id }));
    R(Object.assign(V_("WG12b · Klassenarbeit", 12, "gruppen", { group_size: 4 }), { exam_name: u2.title, planned_start: day(4), course: u2.id, org: afs.id, owner: T.Morawetz.id }));
    R(Object.assign(V_("WG12b · Nachschreibtermin", 8, "versetzt", { cols: 4 }), { exam_name: u2.title, planned_start: day(9), course: u2.id, org: afs.id, owner: T.Morawetz.id }));
    R(Object.assign(V_("Klassenarbeit CSS", 20, "reihen", { cols: 5 }), { exam_name: u3.title, planned_start: day(5), course: u3.id, org: bts.id, owner: T.Gaspari.id }));

    // ---------- Teilnehmende (Raum 123, Klasse FA230a der AFS) ----------
    var people = [
      ["Fröhlke", "Niklas", "1-1"], ["Ehrlicher", "Wiebke", "1-2"], ["Nagelschmidt", "Edda", "1-3"],
      ["Aumann", "Ulla", "1-4"], ["Iversen", "Kira", "1-5"],
      ["Kuhnert", "Tanja", "2-1"], ["Niebuhr", "Maya", "2-2"], ["Mattern", "Kaja", "2-3"],
      ["Trautwein", "Elif", "2-4"], ["Birkholz", "Carsten", "2-5"],
      ["Lohse", "Olaf", "3-1"], ["Dittrich", "Fenja", "3-2"], ["Ahlers", "Malte", "3-3"],
      ["Wiechert", "Niklas", ""], ["Grube", "Levin", ""], ["Hanke", "Lina", ""],
      ["Oltmanns", "Yannik", ""], ["Drechsel", "Kaja", ""], ["Uhlig", "Milan", ""],
    ];
    var groupMembers = {};
    var student = function (l, f, org, uname_) { return add("persons", { lastname: l, firstname: f, username: uname_ || uname(l, f), org: org.id, kind: "schueler", short: "", email: "" }); };
    var ids = {};
    people.forEach(function (x) {
      var per = student(x[0], x[1], afs);
      var r = add("participants", {
        lastname: x[0], firstname: x[1], username: per.username, group_name: "FA230a", org: afs.name, person: per.id,
        room: x[2] ? room.id : "", seat: x[2], present: false, status: "nicht_eingeloggt", extra_time: 0,
        comment: "", health: "", cheat_ack: false, bookmarks: [], nta: x[0] === "Ehrlicher" ? 15 : 0, violations: 0,
      });
      ids[x[0]] = r.id; (groupMembers.FA230a = groupMembers.FA230a || { org: afs, ids: [] }).ids.push(per.id);
    });

    // ---------- Testfall: Großraum mit 120 Teilnehmenden (BTS) ----------
    var FN = ["Bela", "Yannik", "Karim", "Nele", "Selma", "Thea", "Maya", "Oskar", "Pia", "Imke", "Esra", "Tanja", "Vito", "Adele", "Mats", "Matteo", "Ines", "Timo", "Ilka", "Sven"];
    var LN = ["Adameit", "Lindqvist", "Petersohn", "Hellwig", "Czerny", "Tiedemann", "Zoller", "Rosendahl", "Tegeler", "Bruns", "Fock", "Haberkorn", "Dorn", "Falkenrath", "Lüdtke", "Wendlandt", "Göbel", "Kniese", "Rothkegel", "Brenneisen", "Vierling", "Wachtel", "Scharnhorst", "Quandel"];
    var ST = ["nicht_eingeloggt", "wartend", "wartend_bestaetigt", "wartend_bestaetigt", "wartend_bestaetigt"];
    for (var i = 0; i < 120; i++) {
      var rr = 10 - Math.floor(i / 12), cc = (i % 12) + 1;
      var f = FN[i % FN.length], l = LN[(i * 7) % LN.length];
      var status = ST[(i * 3) % ST.length], grp = "FA23" + (1 + (i % 4)) + "b";
      var per = student(l, f, bts, uname(l, f) + (i + 1));
      add("participants", {
        lastname: l, firstname: f, username: per.username, group_name: grp, org: bts.name, person: per.id,
        room: aula.id, seat: rr + "-" + cc, present: status !== "nicht_eingeloggt", status: status, extra_time: 0, nta: i % 17 === 0 ? 20 : 0,
        comment: "", health: status === "wartend_bestaetigt" ? "ok" : "", cheat_ack: status === "wartend_bestaetigt", bookmarks: [], simulated: status !== "nicht_eingeloggt", violations: 0,
      });
      (groupMembers[grp] = groupMembers[grp] || { org: bts, ids: [] }).ids.push(per.id);
    }

    // ---------- Aufsichtspersonen ----------
    var SV = function (t, roomId, periods) { return add("supervisors", { lastname: t.lastname, firstname: t.firstname, short: t.short, username: t.username, person: t.id, room: roomId, present: true, from: periods[0].from, to: periods[periods.length - 1].to, periods: periods }); };
    SV(T.Gaspari, aula.id, [{ from: at(0), to: at(120) }]);
    SV(T["Dähne"], aula.id, [{ from: at(0), to: at(120) }]);
    SV(T["Riedmüller"], room.id, [{ from: at(0), to: at(120) }]);
    // Aufsicht mit Unterbrechung: zwei Zeiträume
    SV(T.Voigt, room.id, [{ from: at(0), to: at(45) }, { from: at(75), to: at(120) }]);

    // ---------- Protokoll ----------
    add("protocol", { room: room.id, ts: iso(new Date(now.getTime() - 3600000)), participant: "–", username: T["Riedmüller"].username, seat: "–", action: "Raumaufsicht wurde angelegt", comment: "", kind: "system" });

    // ---------- Bereitgestellte Arbeitsmaterialien (je Aufgabe) ----------
    var G = function (kind, folder, data, task) { return add("items", { participant: "", kind: kind, folder: folder, data: Object.assign({ task: task || "1" }, data), submission: "" }); };
    G("file", "provided", { name: "Angebot_BatteryWorld.pdf", url: "samples/Angebot_BatteryWorld.pdf", format: "PDF", size: "0,4 MB", changed: "20.08.25", path: "Bereitgestellte Dateien" });
    G("file", "provided", { name: "Angebot_Innovatech.pdf", url: "samples/Angebot_Innovatech.pdf", format: "PDF", size: "0,3 MB", changed: "20.08.25", path: "Bereitgestellte Dateien" });
    G("file", "provided", { name: "Vorlage_Angebotsvergleich.xlsx", url: "samples/Vorlage_Angebotsvergleich.xlsx", format: "XLSX", size: "0,1 MB", changed: "20.08.25", path: "Bereitgestellte Dateien/Vorlagen" });
    G("file", "provided", { name: "Netzplan_FunSport.png", url: "samples/Netzplan_FunSport.png", format: "PNG", size: "0,8 MB", changed: "20.08.25", path: "Bereitgestellte Dateien" }, "3");
    G("code", "ide", { name: "bestellmenge.py", lang: "python", code: "# Aufgabe 1.3 – Bestellmenge ermitteln\n\ndef bestellmenge(lagerbestand, meldebestand, hoechstbestand):\n    # TODO: Bestellmenge berechnen\n    return 0\n\n\nprint(\"Bestellmenge:\", bestellmenge(120, 150, 400))\n" });
    G("code", "ide", { name: "bestellmenge.js", lang: "javascript", code: "// Aufgabe 1.3 – Bestellmenge ermitteln (JavaScript)\n\nfunction bestellmenge(lagerbestand, meldebestand, hoechstbestand) {\n  // TODO: Bestellmenge berechnen\n  return 0;\n}\n\nconsole.log(\"Bestellmenge:\", bestellmenge(120, 150, 400));\n" });
    G("code", "ide", { name: "README.md", lang: "text", code: "Projekt Bestellmenge\n====================\nWenn der Lagerbestand den Meldebestand unterschreitet,\nwird bis zum Höchstbestand aufgefüllt.\n" });
    G("mail", "inbox", {
      from: "Bäumler, Karim", from_mail: "Karim.Baeumler@funsport-innovations.de", to: "azubi@funsport-innovations.de",
      subject: "Quantitativer Angebotsvergleich für neue Lithium-Batterie-Packs", date: "13.10.2025 09:22", attach_urls: { "Angebotsvergleich.xlsx": "samples/Vorlage_Angebotsvergleich.xlsx" },
      attachments: ["Angebotsvergleich.xlsx"],
      body: "Hallo Herr Bendix,\n\ndie FunSport Innovations GmbH steht kurz vor dem Produktionsstart eines neuen E-Skateboard-Modells. Dafür benötigen wir Lithium-Batterie-Packs in größerer Stückzahl. Um unsere Kosten niedrig zu halten, möchte ich Sie bitten, einen quantitativen Angebotsvergleich durchzuführen.\n\nGehen Sie von einem Bedarf von 300 Batterie-Packs aus. Die eingegangenen Angebote habe ich im Ordner „Bereitgestellte Dateien“ (Angebot_BatteryWorld und Angebot_Innovatech) abgelegt. Sie finden dort auch eine Vorlage für den Angebotsvergleich (Vorlage_Angebotsvergleich.xlsx).\n\nFühren Sie einen Angebotsvergleich durch. Nutzen Sie Zellbezüge, verwenden Sie kopierfähige Formeln und setzen Sie die Wenn-Funktion, wenn möglich, ein.\n\nSenden Sie mir Ihr Ergebnis (Angebotsvergleich.xlsx) bitte schnellstmöglich zu.\n\nIch danke Ihnen schon jetzt für Ihre Unterstützung! Bei Rückfragen stehe ich Ihnen selbstverständlich gern zur Verfügung.\n\nMit freundlichen Grüßen\nKarim Bäumler\nEinkauf – FunSport Innovations GmbH",
    });
    G("mail", "inbox", {
      from: "Danner, Ronja", from_mail: "info@batteryworldgmbh.de", to: "einkauf@funsport-innovations.de",
      subject: "Angebote", date: "11.10.2025 10:22", attachments: ["Angebot_BatteryWorld.pdf"], attach_urls: { "Angebot_BatteryWorld.pdf": "samples/Angebot_BatteryWorld.pdf" },
      body: "Sehr geehrter Herr Bendix,\n\nanbei erhalten Sie unser Angebot über 300 Lithium-Batterie-Packs (Typ LBP-36V).\n\nMit freundlichen Grüßen\nRonja Danner\nBatteryWorld GmbH",
    });
    G("mail", "inbox", {
      from: "Timm, Rafael", from_mail: "r.timm@innovatech.de", to: "einkauf@funsport-innovations.de",
      subject: "Angebot für Lithium-Batterie-Packs", date: "09.10.2025 08:05", attachments: ["Angebot_Innovatech.pdf"], attach_urls: { "Angebot_Innovatech.pdf": "samples/Angebot_Innovatech.pdf" },
      body: "Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Anfrage. Gerne unterbreiten wir Ihnen folgendes Angebot …\n\nFreundliche Grüße\nRafael Timm\nInnovaTech GmbH",
    });
    G("event", "calendar", { title: "Messe", day: 0, start: "07:00", end: "07:30", allday: true, editable: false, location: "Messe Stuttgart", desc: "Fachmesse E-Mobilität" });
    G("event", "calendar", { title: "Materialbeschaffung Speedster", day: 1, start: "08:30", end: "09:15", editable: false, location: "Besprechungsraum 2", desc: "Abstimmung Lieferanten Kugellager" }, "2");
    G("event", "calendar", { title: "Besprechung XY", day: 3, start: "11:00", end: "12:00", editable: false, location: "Online", desc: "Wöchentliche Abstimmung Einkauf" });

    // Kleines Ticketsystem: jede Aufgabe hat eigene Tickets
    G("ticket", "tickets", { no: "4650", subject: "Zugang zum Lieferantenportal BatteryWorld", requester: "Einkauf", prio: "mittel", status: "offen", created: "08.10.2025 10:12",
      desc: "Für den Angebotsvergleich wird ein Zugang zum Lieferantenportal von BatteryWorld benötigt. Bitte Zugangsdaten beim Lieferanten anfragen und im Ticket dokumentieren.", answers: [] }, "1");
    G("ticket", "tickets", { no: "4641", subject: "Excel-Vorlage Angebotsvergleich gesperrt", requester: "Einkauf", prio: "niedrig", status: "geschlossen", created: "01.10.2025 09:30", desc: "Die Vorlage war schreibgeschützt.", answers: [{ by: "IT-Support", at: "01.10.2025 11:02", text: "Schreibschutz entfernt, Vorlage liegt unter Bereitgestellte Dateien." }] }, "1");
    G("ticket", "tickets", { no: "4688", subject: "Lieferantenstammdaten Rollmaster AG anlegen", requester: "Voßkamp, Selma", prio: "mittel", status: "offen", created: "13.10.2025 14:20",
      desc: "Bitte die Rollmaster AG (Kugellager) als Lieferant im System anlegen: Anschrift, Ansprechpartner, Zahlungsbedingungen laut Preisliste.", answers: [] }, "2");
    // Aufgabe 2 – Angebote & Kalkulation
    G("mail", "inbox", { from: "Voßkamp, Selma", from_mail: "s.vosskamp@funsport-innovations.de", to: "azubi@funsport-innovations.de", subject: "Kugellager für den Speedster – Anfrage und Termin", date: "14.10.2025 08:10", attachments: ["Lieferantenliste.xlsx"], attach_urls: { "Lieferantenliste.xlsx": "samples/Lieferantenliste.xlsx" },
      body: "Hallo,\n\nfür die Produktion des Speedster benötigen wir 500 Kugellager (Typ 608-2RS). Bitte formulieren Sie eine Anfrage an einen der Lieferanten aus der Lieferantenliste und planen Sie für nächste Woche ein Lieferantengespräch im Kalender ein. Achten Sie auf bestehende Termine.\n\nViele Grüße\nSelma Voßkamp\nAusbildungsleitung" }, "2");
    G("mail", "inbox", { from: "Rollmaster AG", from_mail: "vertrieb@rollmaster.de", to: "einkauf@funsport-innovations.de", subject: "Ihre Anfrage – Rahmenkonditionen 2025", date: "10.10.2025 15:41", attachments: ["Preisliste_Rollmaster.pdf"], attach_urls: { "Preisliste_Rollmaster.pdf": "samples/Preisliste_Rollmaster.pdf" },
      body: "Sehr geehrte Damen und Herren,\n\nanbei unsere aktuelle Preisliste. Bei Abnahme ab 500 Stück gewähren wir 8 % Mengenrabatt.\n\nMit freundlichen Grüßen\nRollmaster AG" }, "2");
    G("file", "provided", { name: "Lieferantenliste.xlsx", url: "samples/Lieferantenliste.xlsx", format: "XLSX", size: "0,1 MB", changed: "20.08.25", path: "Bereitgestellte Dateien" }, "2");
    G("file", "provided", { name: "Kalkulationsschema.pdf", url: "samples/Kalkulationsschema.pdf", format: "PDF", size: "0,2 MB", changed: "20.08.25", path: "Bereitgestellte Dateien/Vorlagen" }, "2");
    G("file", "provided", { name: "Preisliste_Rollmaster.pdf", url: "samples/Preisliste_Rollmaster.pdf", format: "PDF", size: "0,3 MB", changed: "20.08.25", path: "Bereitgestellte Dateien" }, "2");
    G("event", "calendar", { title: "Lieferantentag Einkauf", day: 2, start: "09:00", end: "12:00", editable: false, location: "Halle 1", desc: "Interne Schulung" }, "2");
    G("event", "calendar", { title: "Teamrunde Produktion", day: 4, start: "10:00", end: "11:00", editable: false, location: "Besprechungsraum 1", desc: "" }, "2");
    // Aufgabe 3 – Netzwerkkonfiguration
    G("mail", "inbox", { from: "Pätzold, Helge", from_mail: "h.paetzold@funsport-innovations.de", to: "azubi@funsport-innovations.de", subject: "Neuer Standort – Netzwerkplanung", date: "15.10.2025 07:55", attachments: ["Anforderungen_Netzwerk.pdf"], attach_urls: { "Anforderungen_Netzwerk.pdf": "samples/Anforderungen_Netzwerk.pdf" },
      body: "Hallo,\n\nfür den neuen Standort benötigen wir einen IP-Adressplan und ein Firewall-Regelwerk. Die Details finden Sie in den Anforderungen und im Ticketsystem (Ticket #4711 und #4712).\n\nViele Grüße\nHelge Pätzold\nGeschäftsführung" }, "3");
    G("file", "provided", { name: "Anforderungen_Netzwerk.pdf", url: "samples/Anforderungen_Netzwerk.pdf", format: "PDF", size: "0,2 MB", changed: "20.08.25", path: "Bereitgestellte Dateien" }, "3");
    G("event", "calendar", { title: "Abnahme IT-Infrastruktur", day: 3, start: "13:00", end: "14:30", editable: false, location: "Neuer Standort", desc: "Abnahme durch die Geschäftsführung" }, "3");
    G("code", "ide", { name: "firewall_regeln.txt", lang: "text", code: "# Firewall-Regelwerk (Vorlage)\n# Nr | Quelle | Ziel | Dienst/Port | Aktion | Begründung\n1 | any | any | any | deny | Default-Deny\n" }, "3");
    G("ticket", "tickets", { no: "4711", subject: "IP-Adressplan für den neuen Standort erstellen", requester: "Helge Pätzold", prio: "hoch", status: "offen", created: "15.10.2025 08:02",
      desc: "Bitte das Netz 192.168.40.0/24 in Subnetze für Verwaltung (50 Hosts), Produktion (25 Hosts) und Gäste (10 Hosts) aufteilen. Netz-ID, Broadcast und Hostbereich dokumentieren.", answers: [] }, "3");
    G("ticket", "tickets", { no: "4712", subject: "Gäste-WLAN darf nur ins Internet", requester: "IT-Sicherheit", prio: "mittel", status: "offen", created: "15.10.2025 08:05",
      desc: "Das Gäste-Netz soll ausschließlich Internetzugriff erhalten. Die Verwaltung muss auf die Produktion zugreifen können. Bitte Regelwerk vorschlagen und begründen.", answers: [] }, "3");
    G("ticket", "tickets", { no: "4698", subject: "Drucker im Lager druckt nicht", requester: "Lager", prio: "niedrig", status: "geschlossen", created: "02.10.2025 11:20", desc: "Erledigt durch Neustart des Druckservers.", answers: [{ by: "IT-Support", at: "02.10.2025 13:05", text: "Druckerwarteschlange neu gestartet, Problem behoben." }] }, "3");

    // ---------- ERP-System (Stammdaten und Belege je Aufgabe; Prüflinge legen eigene Lieferanten und Bestellungen an) ----------
    var E = function (type, data, task) { return add("items", { participant: "", kind: "erp", folder: "erp", data: Object.assign({ task: task || "1", type: type }, data), submission: "" }); };
    ["1", "2"].forEach(function (t) {
      E("artikel", { nr: "100100", name: "Lithium-Batterie-Pack LBP-36V", gruppe: "Zukaufteile", einheit: "Stk.", bestand: 120, melde: 150, hoechst: 400, ek: 115.0, lieferant: "70010" }, t);
      E("artikel", { nr: "100200", name: "Rillenkugellager 608-2RS", gruppe: "Zukaufteile", einheit: "Stk.", bestand: 180, melde: 300, hoechst: 1000, ek: 0.48, lieferant: "" }, t);
      E("artikel", { nr: "100300", name: "Deck Ahorn 7-lagig (Speedster)", gruppe: "Halbfabrikate", einheit: "Stk.", bestand: 260, melde: 100, hoechst: 500, ek: 18.9, lieferant: "70030" }, t);
      E("artikel", { nr: "100400", name: "Rolle PU 90 mm", gruppe: "Zukaufteile", einheit: "Stk.", bestand: 940, melde: 400, hoechst: 2000, ek: 2.35, lieferant: "70030" }, t);
      E("artikel", { nr: "900100", name: "E-Skateboard Speedster", gruppe: "Fertigerzeugnisse", einheit: "Stk.", bestand: 85, melde: 50, hoechst: 300, ek: 0, vk: 449.0, lieferant: "" }, t);
      E("lieferant", { nr: "70010", name: "BatteryWorld GmbH", ort: "Heilbronn", mail: "info@batteryworldgmbh.de", zahlung: "14 Tage 2 % Skonto, 30 Tage netto" }, t);
      E("lieferant", { nr: "70020", name: "InnovaTech GmbH", ort: "Karlsruhe", mail: "r.timm@innovatech.de", zahlung: "10 Tage 3 % Skonto" }, t);
      E("lieferant", { nr: "70030", name: "Holz & Rolle KG", ort: "Pforzheim", mail: "vertrieb@holzundrolle.de", zahlung: "30 Tage netto" }, t);
      E("bestellung", { nr: "BE-2025-0412", datum: "02.10.2025", lieferant: "70030", pos: [{ artikel: "100400", menge: 800, preis: 2.35 }], status: "geliefert" }, t);
      E("bestellung", { nr: "BE-2025-0431", datum: "08.10.2025", lieferant: "70030", pos: [{ artikel: "100300", menge: 150, preis: 18.9 }], status: "offen" }, t);
      // Finanzbuchhaltung: Kontenplan (vereinfacht, Industriekontenrahmen) und zu buchende Belege
      [["2000", "Rohstoffe", "Aktiv"], ["2020", "Hilfsstoffe", "Aktiv"], ["2400", "Forderungen aus Lieferungen und Leistungen", "Aktiv"], ["2600", "Vorsteuer", "Aktiv"], ["2800", "Bank", "Aktiv"], ["2880", "Kasse", "Aktiv"],
       ["4400", "Verbindlichkeiten aus Lieferungen und Leistungen", "Passiv"], ["4800", "Umsatzsteuer", "Passiv"], ["5000", "Umsatzerlöse für eigene Erzeugnisse", "Ertrag"], ["5710", "Zinserträge", "Ertrag"],
       ["6000", "Aufwendungen für Rohstoffe", "Aufwand"], ["6020", "Aufwendungen für Hilfsstoffe", "Aufwand"], ["6140", "Ausgangsfrachten", "Aufwand"], ["6800", "Büromaterial", "Aufwand"]]
        .forEach(function (k) { E("konto", { nr: k[0], name: k[1], art: k[2] }, t); });
      E("beleg", { nr: "ER-4711", art: "Eingangsrechnung", datum: "14.10.2025", partner: "Holz & Rolle KG", text: "800 Rollen PU 90 mm (Lieferung zu BE-2025-0412)", netto: 1880.0, ust: 19 }, t);
      E("beleg", { nr: "AR-2025-118", art: "Ausgangsrechnung", datum: "15.10.2025", partner: "Sportwelt Müllerstadt GmbH", text: "10 E-Skateboards Speedster", netto: 4490.0, ust: 19 }, t);
      E("beleg", { nr: "KA-0031", art: "Kassenbeleg", datum: "16.10.2025", partner: "Papierhaus Kleinert", text: "Druckerpapier und Ordner", netto: 42.0, ust: 19 }, t);
    });
    E("artikel", { nr: "IT-2001", name: "Managed Switch 24 Port", gruppe: "IT-Inventar", einheit: "Stk.", bestand: 2, melde: 1, hoechst: 4, ek: 389.0, lieferant: "70040" }, "3");
    E("artikel", { nr: "IT-2002", name: "Firewall-Appliance", gruppe: "IT-Inventar", einheit: "Stk.", bestand: 0, melde: 1, hoechst: 2, ek: 1290.0, lieferant: "70040" }, "3");
    E("artikel", { nr: "IT-2003", name: "WLAN-Access-Point", gruppe: "IT-Inventar", einheit: "Stk.", bestand: 3, melde: 2, hoechst: 8, ek: 149.0, lieferant: "70040" }, "3");
    E("lieferant", { nr: "70040", name: "NetzWerk Systemhaus GmbH", ort: "Stuttgart", mail: "service@netzwerk-systemhaus.de", zahlung: "30 Tage netto" }, "3");
    E("bestellung", { nr: "BE-2025-0450", datum: "14.10.2025", lieferant: "70040", pos: [{ artikel: "IT-2001", menge: 2, preis: 389.0 }], status: "offen" }, "3");

    // ---------- Abgaben + Bewertungen für bereits korrigierbare Teilnehmende ----------
    var graded = ["Kuhnert", "Niebuhr", "Mattern", "Trautwein", "Birkholz", "Lohse", "Dittrich", "Ahlers", "Ehrlicher"];
    var seedNo = 7;
    var rnd = function () { seedNo = (seedNo * 9301 + 49297) % 233280; return seedNo / 233280; };
    graded.forEach(function (l, idx) {
      var pid = ids[l];
      var p = people.filter(function (x) { return x[0] === l; })[0];
      var sender = p[1].split(" ")[0] + " " + l;
      // Anhang der gesendeten E-Mail: eigene Datei (echte Excel-Datei)
      var att = add("items", { participant: pid, kind: "file", folder: "own", submission: "", data: { task: "1", name: "Angebotsvergleich.xlsx", format: "XLSX", size: "0,1 MB", changed: "13.10.25", url: "samples/abgaben/Angebotsvergleich_" + l + ".xlsx" } });
      add("items", { participant: pid, kind: "mail", folder: "sent", submission: "1.1", data: { task: "1", attach_refs: { "Angebotsvergleich.xlsx": att.id },
        from: sender, from_mail: uname(l, p[1]) + "@azubi.funsport-innovations.de", to: "Karim.Baeumler@funsport-innovations.de",
        subject: "AW: Quantitativer Angebotsvergleich für neue Lithium-Batterie-Packs", date: "13.10.2025 09:5" + (idx % 10),
        attachments: ["Angebotsvergleich.xlsx"],
        body: "Sehr geehrter Herr Bäumler,\n\nanbei sende ich Ihnen den gewünschten quantitativen Angebotsvergleich für 300 Lithium-Batterie-Packs. Unter Berücksichtigung von Rabatt, Skonto und Bezugskosten ist das Angebot der " + (idx % 3 ? "BatteryWorld GmbH" : "InnovaTech GmbH") + " günstiger.\n\nMit freundlichen Grüßen\n" + sender,
      } });
      // Abgabe 1.2: hochgeladene Kalkulation in unterschiedlichen Formaten (PDF, Word, Excel) – echte Beispieldateien
      var fmt = ["pdf", "docx", "xlsx"][idx % 3];
      add("items", { participant: pid, kind: "file", folder: "own", submission: "1.2", data: { task: "1", name: "Kalkulation_" + l + "." + fmt, format: fmt.toUpperCase(), size: "0,1 MB", changed: "21.10.26", url: "samples/abgaben/Kalkulation_" + l + "." + fmt } });
      // Abgabe 2.3: direkt in der Aufgabe hochgeladene Datei (nicht in „Eigene Dateien“)
      if (idx < 4) { var f2 = ["xlsx", "pdf", "docx", "xlsx"][idx]; add("items", { participant: pid, kind: "file", folder: "own", submission: "2.3", data: { task: "2", path: "Dateiupload", name: "Nachkalkulation_" + l + "." + f2, format: f2.toUpperCase(), size: "0,1 MB", changed: "21.10.26", url: "samples/abgaben/Nachkalkulation_" + l + "." + f2, direct: true } }); }
      if (idx % 4 !== 3) add("items", { participant: pid, kind: "code", folder: "ide", submission: "1.3", data: { task: "1", name: "bestellmenge.py", lang: "python", code: "# Aufgabe 1.3 – Bestellmenge\n\ndef bestellmenge(lagerbestand, meldebestand, hoechstbestand):\n    if lagerbestand < meldebestand:\n        return hoechstbestand - lagerbestand\n" + (idx % 2 ? "    return 0\n" : "    else:\n        return 0\n") + "\n\nprint(\"Bestellmenge:\", bestellmenge(120, 150, 400))\n" } });
      add("items", { participant: pid, kind: "note", folder: "notes", submission: "2.1", data: { task: "2", title: "Anfrage", html: "<p>Sehr geehrte Damen und Herren,</p><p>wir bitten um ein Angebot über 500 Kugellager Typ 608-2RS …</p>" } });

      // Erstkorrektur weitgehend fertig; Zweitkorrektur bei den ersten drei vollständig (bei der ersten mit deutlicher Abweichung), bei zwei weiteren begonnen
      var ekPts = {};
      [1, 2].forEach(function (c) {
        if (c === 2 && idx > 4) return;
        var points = {}, notDone = {};
        Object.keys(CRITERIA).forEach(function (st, si) {
          if (c === 1 && si > 5 && idx % 2) return; // einige offen
          if (c === 2 && idx > 2 && si > 2) return;
          if (st === "1.3" && idx % 4 === 3) { notDone[st] = true; return; }
          if (c === 2 && idx <= 2) { var f = idx === 0 ? 0.55 : 0.92 + rnd() * 0.12; points[st] = (ekPts[st] || CRITERIA[st]).map(function (v, k) { return Math.min(CRITERIA[st][k], Math.max(0, Math.round(v * f * 2) / 2)); }); return; }
          points[st] = CRITERIA[st].map(function (m) { return Math.max(0, Math.round(m * (0.45 + rnd() * 0.55) * 2) / 2); });
          if (c === 1) ekPts[st] = points[st];
        });
        var marks = {};
        if (idx < 3) marks["1.1"] = c === 1
          ? [{ id: "s1" + idx, type: "sign", sign: "r", ax: 420, ay: 300 }, { id: "s2" + idx, type: "sign", sign: "Ug", ax: 360, ay: 345 }, { id: "l1" + idx, type: "hline", style: "wavy", x1: 330, x2: 560, y: 352 }]
          : [{ id: "z1" + idx, type: "sign", sign: "(r)", ax: 420, ay: 300 }, { id: "z2" + idx, type: "vline", y1: 280, y2: 360 }];
        // Gruppenfreigabe: EK (Gesa Ohm + Lina Voigt) final bei vollständigen Bewertungen, bei einer erst 1 von 2; ZK (Ayla Steinhoff) final bei den ersten drei
        var full = c === 1 ? !(idx % 2) : idx <= 2;
        var approvals = c === 1 ? (full ? (idx === 4 ? [T.Ohm.id] : [T.Ohm.id, T.Voigt.id]) : []) : (full ? [T.Steinhoff.id] : []);
        var released = c === 1 ? approvals.length === 2 : approvals.length === 1;
        add("gradings", { participant: pid, corrector: c, points: points, not_done: notDone, marks: marks, released: released, approvals: approvals });
      });
    });
    add("comments", { participant: ids.Birkholz, subtask: "1.2", author: "Korrektor 1", body: "Kalkulationsschema vollständig, Rundungsfehler bei den Bezugskosten." });
    add("comments", { participant: ids.Birkholz, subtask: "1.2", author: "Korrektor 2", body: "Zustimmung, Teilpunkt für Folgefehler vergeben." });

    // ---------- Aufgabensteuerung ----------
    var TK = function (procedure, procedure_icon, title, icon, due, link, task_no, extra) {
      return add("tasks", Object.assign({ procedure: procedure, procedure_icon: procedure_icon, title: title, icon: icon, due: due, link: link, task_no: task_no, done: false, is_new: true, role: procedure.indexOf("FA230") >= 0 ? "" : "lehrkraft", closed: false }, extra || {}));
    };
    var P1 = "Prüfung „FA230 - Musterprüfung“";
    TK(P1, "clipboard-list", "Prüfungsorganisation der Raumaufsicht", "calendar-plus", "20.10.2026", "#/app/raumaufsicht", 21, { role: "schuladmin" });
    TK(P1, "clipboard-list", "Zuweisung der Prüfungsrollen und Anmeldung der Teilnehmenden", "users", "20.10.2026", "#/app/kurse", 52, { role: "schuladmin" });
    TK(P1, "clipboard-list", "Korrektoren festlegen", "file-pen-line", "22.10.2026", "#/app/kurse", 24, { role: "schuladmin" });
    TK(P1, "clipboard-list", "Raumaufsicht durchführen", "monitor", "21.10.2026", "#/app/raumaufsicht", 22, { role: "lehrkraft" });
    TK(P1, "clipboard-list", "Erstkorrektur durchführen", "file-pen-line", "28.10.2026", "#/app/korrektur", 20, { role: "lehrkraft" });
    TK(P1, "clipboard-list", "Zweitkorrektur durchführen", "file-pen-line", "04.11.2026", "#/app/korrektur?k=2", 10, { role: "lehrkraft" });
    TK(P1, "clipboard-list", "Prüfungsergebnisse einsehen/herunterladen", "chart-pie", "15.11.2026", "#/app/ergebnisse", 28, { is_new: false, role: "schuladmin" });
    TK(P1, "clipboard-list", "Prüfungseinsicht gewähren", "eye", "20.11.2026", "#/app/ergebnisse", 37, { is_new: false, role: "schuladmin" });
    var PU = "Unterricht „Zentrale Klassenarbeit HTML“";
    TK(PU, "book-open", "Unterricht bearbeiten (Teilnehmende und Lehrkräfte)", "users", "24.10.2026", "#/app/kurse", 31, { role: "lehrkraft" });
    TK(PU, "book-open", "Durchführung planen (Sitzplätze und Anordnung)", "calendar-plus", "27.10.2026", "#/app/raumaufsicht", 32, { role: "lehrkraft" });
    TK(PU, "book-open", "Raumaufsicht durchführen", "monitor", "28.10.2026", "#/app/raumaufsicht", 33, { role: "lehrkraft" });
    TK(PU, "book-open", "Korrektur durchführen", "file-pen-line", "04.11.2026", "#/app/korrektur", 35, { role: "lehrkraft" });
    var P2 = "Zentrale Klassenarbeit „HTML“";
    TK(P2, "list", "Umfrage vervollständigen", "file", "01.10.2026", "", 0);
    TK(P2, "list", "Sitzordnung festlegen", "calendar-plus", "01.10.2026", "#/app/raumaufsicht", 0);
    TK(P2, "list", "Klasse zuweisen", "users", "01.10.2026", "", 0);
    var P3 = "Interne Evaluation „Mobbing in der Klasse“";
    TK(P3, "presentation", "Fragebogen vervollständigen", "file", "01.10.2026", "", 0);
    TK(P3, "presentation", "Tag der Durchführung definieren", "calendar-plus", "01.10.2026", "", 0);
    TK(P3, "presentation", "Klasse zuweisen", "users", "01.10.2026", "", 0);
    var P4 = "Zentrale Klassenarbeit „CSS“";
    TK(P4, "list", "Korrektur der Klassenarbeit", "calendar-plus", "23.10.2026", "#/app/korrektur", 35);
    var P5 = "Zentrale Klassenarbeit „JavaScript“";
    TK(P5, "list", "Sitzordnung festlegen", "calendar-plus", "12.06.2026", "", 0, { done: true, is_new: false, closed: true });
    TK(P5, "list", "Korrektur der Klassenarbeit", "file-pen-line", "30.06.2026", "", 0, { done: true, is_new: false, closed: true });
    var P6 = "Lernstandserhebung „Tabellenkalkulation“";
    TK(P6, "presentation", "Ergebnisse einsehen", "chart-pie", "15.07.2026", "", 0, { done: true, is_new: false, closed: true });

    // ---------- Weitere Schüler:innen und Gruppen ----------
    var wg = [["Nowak", "Helena"], ["Marquardt", "Aaron"], ["Thierfelder", "Bettina"], ["Nolting", "Ronja"], ["Brockmann", "Emil"], ["Reinholz", "Nele"], ["Thamm", "Amir"], ["Kleinert", "Helge"], ["Leupold", "Talea"], ["Rademacher", "Fenja"]].map(function (x) { return student(x[0], x[1], afs); });
    var j1extra = [["Kortum", "Hagen"], ["Mehring", "Dana"], ["Wölk", "Amir"]].map(function (x) { return student(x[0], x[1], afs); });
    var GR = function (name, org, kind, members) { return add("groups", { name: name, org: org.id, kind: kind, source: "schulverwaltung", course: "", members: members }); };
    var pid = function (x) { return x.id; };
    var gFA = GR("FA230a", afs, "klasse", groupMembers.FA230a.ids);
    var gWG = GR("WG12a", afs, "klasse", wg.map(pid));
    GR("Informatik J1", afs, "kurs", wg.slice(0, 5).map(pid).concat(j1extra.map(pid)));
    GR("WG12b", afs, "klasse", j1extra.map(pid));
    // Prüfungskommissionen (Gruppen der Koordinierungsstelle) mit festem Vorsitz
    add("groups", { name: "Prüfungskommission Büromanagement", org: "", kind: "kommission", source: "koordinierungsstelle", course: "", members: [T.Ohm.id, T.Ebeling.id, T.Steinhoff.id], chair: T.Steinhoff.id, fachbereich: "kfm" });
    add("groups", { name: "Prüfungskommission IT-Berufe", org: "", kind: "kommission", source: "koordinierungsstelle", course: "", members: [T.Gaspari.id, T.Morawetz.id, T["Dähne"].id], chair: T.Gaspari.id, fachbereich: "it" });
    var btsGroups = Object.keys(groupMembers).filter(function (k) { return groupMembers[k].org === bts; }).map(function (k) { return GR(k, bts, "klasse", groupMembers[k].ids); });
    // Mitglieder der Prüfung (pflegt die Schuladministration der jeweiligen Schule) und des Unterrichts (pflegt die Lehrkraft)
    // Gruppen im Kurs: Stand beim Hinzufügen (members/base); spätere Änderungen der Gruppe werden angezeigt und können übernommen werden
    var snap = function (g, role) { return { group: g.id, role: role, name: g.name, members: g.members.slice(), base: g.members.slice(), at: iso(new Date(now.getTime() - 86400000 * 5)) }; };
    pr1.groups = [snap(gFA, "teilnehmer")].concat(btsGroups.map(function (g) { return snap(g, "teilnehmer"); }));
    pr1.members = [{ person: T["Riedmüller"].id, role: "raumaufsicht" }, { person: T.Voigt.id, role: "raumaufsicht" }, { person: T.Hinrichs.id, role: "pruefungseinsicht" }, { person: T.Gaspari.id, role: "raumaufsicht" }, { person: T["Dähne"].id, role: "raumaufsicht" }, { person: T.Morawetz.id, role: "raumaufsicht" }, { person: T["Riedmüller"].id, role: "pruefungseinsicht" }, { person: T["Dähne"].id, role: "pruefungseinsicht" }, { person: T.Hinrichs.id, role: "schuladmin" }, { person: T.Ammermann.id, role: "schuladmin" }];
    // Korrektorengruppen je Korrekturstufe (Zuweisung für die Klasse FA230a bzw. die Klassen der BTS); Endbeurteilung nur auf Anforderung
    var K = function (stage, group, correctors, org) { return { id: rid(), stage: stage, kind: "group", target: group.id, correctors: correctors.map(function (x) { return x.id; }), org: org.id }; };
    pr1.corrections = [K(1, gFA, [T.Ohm, T.Voigt], afs), K(2, gFA, [T.Steinhoff], afs), K(3, gFA, [T.Ebeling], afs)]
      .concat(btsGroups.map(function (g) { return K(1, g, [T.Gaspari], bts); }), btsGroups.map(function (g) { return K(2, g, [T["Dähne"], T.Morawetz], bts); }));
    pr1.third = {}; pr1.korr_end = "2026-11-06"; pr1.dk_threshold = 1;
    // Aufgabensteuerung (Beispielregeln): Aktion ausgeführt bzw. zeitliche Faktoren, verknüpft mit UND/ODER
    var mailA = function (task, subject, body) { return { id: rid(), type: "mail", task: task, from: "Bäumler, Karim", from_mail: "Karim.Baeumler@funsport-innovations.de", subject: subject, body: body }; };
    var exampleRules = function () { return [
      { id: rid(), name: "Rückfrage nach Start von Aufgabe 2", active: true, match: "all", groups: [{ id: rid(), match: "all", conditions: [{ id: rid(), type: "task_opened", task: "2" }] }],
        actions: [mailA("2", "Kurze Rückfrage zur Kalkulation", "Hallo,\n\nbitte berücksichtigen Sie bei der Kalkulation zusätzlich den Mindermengenzuschlag von 25 € je Bestellung.\n\nViele Grüße\nKarim Bäumler")] },
      { id: rid(), name: "Erinnerung nach 3 Minuten ohne Aktivität", active: true, match: "all", groups: [{ id: rid(), match: "all", conditions: [{ id: rid(), type: "inactive_minutes", min: 3 }] }],
        actions: [mailA("", "Wie ist der Stand?", "Hallo,\n\nich habe seit einigen Minuten nichts von Ihnen gehört. Wie ist der aktuelle Stand?\n\nViele Grüße\nKarim Bäumler")] },
      { id: rid(), name: "Terminvorschlag nach Angebotsvergleich", active: true, match: "all", groups: [{ id: rid(), match: "any", conditions: [{ id: rid(), type: "mail_sent", task: "1" }, { id: rid(), type: "minutes_in_task", task: "1", min: 10 }] }],
        actions: [{ id: rid(), type: "event", task: "1", title: "Abstimmung Lieferantenauswahl", day: 2, start: "10:00", end: "10:30", location: "Besprechungsraum 1", text: "Ergebnis des Angebotsvergleichs vorstellen" }] },
      { id: rid(), name: "Hinweis auf fehlende Abgabe 3.1", active: true, match: "all", groups: [{ id: rid(), match: "all", conditions: [{ id: rid(), type: "remaining_minutes", min: 15 }, { id: rid(), type: "no_submission", subtask: "3.1" }] }],
        actions: [{ id: rid(), type: "notice", text: "Zu Teilaufgabe 3.1 ist noch keine Abgabe markiert. Denken Sie daran, Ihre Ergebnisse als Abgabe zu markieren." }] },
    ]; };
    // Die Regeln gehören zum Inhalt der Prüfung bzw. des Kurses (Katalog) und werden im Prüfungseditor konfiguriert
    catFA.rules = exampleRules(); catWeb.rules = exampleRules().slice(0, 2);
    u1.catalog = copyOf(catWeb, T.Eggert, "Webentwicklung HTML/CSS (Kopie Eggert)").id;
    u2.catalog = copyOf(catWeb, T.Morawetz, "Webentwicklung HTML/CSS (Kopie Morawetz)").id;
    u3.catalog = copyOf(catWeb, T.Gaspari, "Webentwicklung HTML/CSS (Kopie Gaspari)").id;
    // Unterricht: Gruppe WG12a beim Hinzufügen ohne die später zugezogene Schülerin (Hinweis „aktuellerer Stand“)
    u1.groups = [snap(gWG, "teilnehmer")]; u1.groups[0].members = gWG.members.slice(0, -1); u1.groups[0].base = gWG.members.slice(0, -1);

    // ---------- Unterricht: Distanzeinheit (fester Zeitraum, Start durch die Schüler:innen, mehrfach durchlaufbar) ----------
    var wFrom = new Date(now.getTime() - 86400000); wFrom.setHours(8, 0, 0, 0);
    var wTo = new Date(now.getTime() + 6 * 86400000); wTo.setHours(20, 0, 0, 0);
    var dist = R(Object.assign(V_("WG12a · Übung zuhause (Distanz)", 30, "reihen", { cols: 5 }), { exam_name: u1.title, planned_start: iso(wFrom), course: u1.id, org: afs.id, owner: T.Eggert.id,
      mode: "distanz", window_from: iso(wFrom), window_to: iso(wTo), duration_min: 45, repeatable: true, show_horizon: true, start_earliest: "", start_latest: "" }));
    var LP = function (per, roomId, extra) { return add("participants", Object.assign({ lastname: per.lastname, firstname: per.firstname, username: per.username, group_name: "WG12a", org: afs.name, person: per.id, room: roomId, seat: "", present: false, status: "nicht_eingeloggt", extra_time: 0, comment: "", health: "", cheat_ack: false, bookmarks: [], nta: 0, violations: 0, attempt: 1 }, extra || {})); };
    wg.slice(0, 4).forEach(function (per, i) {
      LP(per, dist.id, i === 1 ? { status: "abgegeben", cheat_ack: true, health: "ok", present: true, started_at: iso(new Date(now.getTime() - 3 * 3600000)), finished_at: iso(new Date(now.getTime() - 2.4 * 3600000)) } : {});
    });
    // Präsenzstunde zur gleichen Zeit wie die Distanzeinheit: Schüler:innen wählen, woran sie teilnehmen
    var pres = R(Object.assign(V_("WG12a · Präsenzunterricht", 16, "reihen", { cols: 4 }), { exam_name: u1.title, planned_start: iso(new Date(now.getTime() + 30 * 60000)), start_earliest: hm(new Date(now.getTime() + 30 * 60000)), start_latest: hm(new Date(now.getTime() + 60 * 60000)), course: u1.id, org: afs.id, owner: T.Eggert.id, duration_min: 45 }));
    wg.slice(0, 4).forEach(function (per, i) { LP(per, pres.id, { seat: "1-" + (i + 1) }); });
    add("protocol", { room: dist.id, ts: iso(new Date(now.getTime() - 2.4 * 3600000)), participant: wg[1].lastname + ", " + wg[1].firstname, username: wg[1].username, seat: "–", action: "Einheit beendet und abgegeben", comment: "Distanzunterricht · Durchlauf 1", kind: "system" });

    // ---------- Unterricht: abgeschlossene, korrigierte Präsenzeinheit (Korrektur für die Schüler:innen freigegeben) ----------
    var past = R(Object.assign(V_("Klassenarbeit HTML · Probelauf", 12, "reihen", { cols: 4 }), { exam_name: u1.title, planned_start: day(-6), started_at: day(-6), course: u1.id, org: afs.id, owner: T.Eggert.id, state: "TERMINATED", released: true }));
    u1.corrector = T.Eggert.id;
    wg.slice(4, 7).concat([wg[0]]).forEach(function (per, i) {
      var lp = LP(per, past.id, { status: "beendet", seat: "1-" + (i + 1), cheat_ack: true, health: "ok", present: true, started_at: day(-6), finished_at: day(-6) });
      add("items", { participant: lp.id, kind: "mail", folder: "sent", submission: "1.1", data: { task: "1", from: per.firstname + " " + per.lastname, from_mail: per.username + "@azubi.funsport-innovations.de", to: "Karim.Baeumler@funsport-innovations.de", subject: "AW: Quantitativer Angebotsvergleich für neue Lithium-Batterie-Packs", date: "13.10.2025 10:1" + i, attachments: [],
        body: "Sehr geehrter Herr Bäumler,\n\nnach meinem Angebotsvergleich ist das Angebot der " + (i % 2 ? "InnovaTech GmbH" : "BatteryWorld GmbH") + " unter Berücksichtigung von Rabatt, Skonto und Bezugskosten günstiger.\n\nMit freundlichen Grüßen\n" + per.firstname + " " + per.lastname } });
      add("items", { participant: lp.id, kind: "note", folder: "notes", submission: "2.1", data: { task: "2", title: "Anfrage", html: "<p>Sehr geehrte Damen und Herren,</p><p>bitte senden Sie uns ein Angebot über 500 Kugellager Typ 608-2RS.</p>" } });
      var pts = {}, notes = {};
      Object.keys(CRITERIA).forEach(function (st) { pts[st] = CRITERIA[st].map(function (m) { return Math.max(0, Math.round(m * (0.5 + rnd() * 0.5) * 2) / 2); }); });
      notes["1.1"] = ["Vergleich vollständig, Skonto korrekt berücksichtigt.", "Ergebnis richtig, die Begründung der Entscheidung fehlt teilweise.", "Bezugskosten nicht vollständig einbezogen.", "Sauber gerechnet, Ergebnis gut begründet."][i];
      notes["2.1"] = "Anfrage formal korrekt, Liefertermin fehlt.";
      add("gradings", { participant: lp.id, corrector: 1, points: pts, not_done: {}, notes: notes, released: true, approvals: [T.Eggert.id],
        marks: { "1.1": [{ id: "lp" + i + "a", type: "sign", sign: i === 2 ? "f" : "r", ax: 420, ay: 300 }, { id: "lp" + i + "b", type: "hline", style: "single", x1: 330, x2: 520, y: 330 }] } });
    });

    // ---------- Prüfungserstellung: Prüfungen in verschiedenen Status (Testdaten für alle Rollen) ----------
    var dIso = function (days) { var d = new Date(now.getTime() + days * 86400000); return iso(d).slice(0, 10); };
    var dtIso = function (days, h) { var d = new Date(now.getTime() + days * 86400000); d.setHours(h || 8, 30, 0, 0); return iso(d).slice(0, 16).replace(" ", "T"); };
    var H = function (days, by, ev, text, from, to) { var o = { at: iso(new Date(now.getTime() + days * 86400000)), by: by, ev: ev, text: text }; if (to) { o.from = from || ""; o.to = to; } return o; };
    var sub = function (title, type, text, crit, hz) { return { title: title, type: type, tool: type === "app" ? "mail" : type, text: text, options: [], criteria: crit, horizon: hz, images: [] }; };
    var KS = "Brandauer, Lisette";
    var exV = add("catalog", { title: "Abschlussprüfung Teil 2 – Kundenbeziehungsprozesse Winter 2026", beruf: "Kaufmann/-frau für Büromanagement", fach: "Kundenbeziehungsprozesse", jahr: String(now.getFullYear()), kind: "Prüfung", image: 2, description: "", duration: "120 Minuten", creator: "Koordinierungsstelle (IBBW)", tags: ["Prüfungen", "Erstellungsprozess"], contents: [], mine: false, copied_from: "", editor_by: "prozess", status: "vorbereitung", release: null, rules: [],
      content: { name: "Abschlussprüfung Teil 2 – Kundenbeziehungsprozesse Winter 2026", duration_min: 120, ausgangssituation: "Sie sind Mitarbeiterin bzw. Mitarbeiter im Vertriebsinnendienst der Muster Handels GmbH.", company: { name: "Muster Handels GmbH", allgemein: "Die Muster Handels GmbH beliefert Unternehmen und Behörden mit Büro- und Schulbedarf.", adresse: "Muster Handels GmbH\nLindenring 4\n68159 Mannheim", kontakt: "Telefon 0621 445500", rechtliches: "GmbH · Amtsgericht Mannheim HRB 112233", vorlagen: "" }, info: { title: "Prüfungsinformationen", items: [["Bearbeitungszeit", "120 Minuten zzgl. individueller Zusatzzeit"]] }, gradingKey: { type: "ihk" }, categories: { system: "none", list: [] }, signatures: {},
        tasks: [{ title: "Kundenanfrage bearbeiten", situation: "Ein Neukunde bittet um ein Angebot über 200 Ordner.", tools: ["files", "mail", "editor"], materials: [], subtasks: [sub("Angebot per E-Mail", "app", "Erstellen Sie ein Angebot und senden Sie es per E-Mail an den Kunden.", [["Inhalt", 6, ""], ["Form", 4, ""]], [["Angebot vollständig, Preise korrekt", "6 P"], ["Geschäftsbrief nach DIN 5008", "4 P"]])] },
          { title: "Reklamation", situation: "", tools: ["files", "mail", "editor"], materials: [], subtasks: [sub("Reklamation beantworten", "freitext", "", [["Inhalt", 5, ""]], [["", "5 P"]])] }] },
      meta: { titel: "Abschlussprüfung Teil 2 – Kundenbeziehungsprozesse Winter 2026", ptitel: "Abschlussprüfung Teil 2 – Kundenbeziehungsprozesse", zeitraum: "Winter", jahr: String(now.getFullYear()), beruf_id: "bm", beruf: "Kaufmann/-frau für Büromanagement", berufsnr: "10101", fachbereich: "kfm", art: "Abschlussprüfung Teil 2", bereich: "Kundenbeziehungsprozesse", code: "BM-KBP-W" + String(now.getFullYear()).slice(2), termin: dtIso(70), dauer: 120, einsicht_h: "24 Stunden", erstellung_von: dIso(-10), erstellung_bis: dIso(20), kommission_bis: dIso(40), lektorat_bis: dIso(50), pruefloesung_bis: dIso(50), hilfsmittel: "nicht programmierbarer Taschenrechner", pool: "muster", orgs: [], version: 1 },
      team: { koordination: [T.Brandauer.id], aufgabenerstellung: [T.Voigt.id, T.Kowalczyk.id], kommission_group: "", kommission: [T.Ohm.id, T.Ebeling.id], vorsitz: [T.Steinhoff.id], beratung: [T.Morawetz.id], lektorat: [], pruefloesung: [] },
      history: [H(-12, KS, "angelegt", "Neue Prüfung angelegt (Status Vorbereitung)", "", "vorbereitung"), H(-11, KS, "metadaten", "Prüfungsmetadaten vollständig gesetzt (Task 2)"), H(-11, KS, "team", "Kommission „Prüfungskommission Büromanagement“ zugewiesen – Vorsitz: Steinhoff, Ayla"), H(-11, KS, "team", "Aufgabenerstellung: Voigt, Lina; Kowalczyk, Dorian zugewiesen"), H(-10, "Ohm, Gesa", "pool", "Unternehmenspool festgelegt: Muster Handels GmbH (Task 14)"), H(-2, "Voigt, Lina", "inhalt", "Inhalt im Editor gespeichert")],
      feedback: [{ id: "fbv1", kind: "beratung", by: "Morawetz, Ilyas", pid: T.Morawetz.id, at: iso(new Date(now.getTime() - 86400000)), st: "1.1", text: "Mengenangabe im Arbeitsauftrag ergänzen (200 Ordner, Lieferung frei Haus?).", resolved: false }], reviews: {} });
    var kgBM = out.groups.filter(function (g) { return g.kind === "kommission" && g.fachbereich === "kfm"; })[0];
    var kgIT = out.groups.filter(function (g) { return g.kind === "kommission" && g.fachbereich === "it"; })[0];
    exV.team.kommission_group = kgBM.id;
    // Kommission übernimmt die Aufgabenerstellung (ohne Rolle Aufgabenerstellung, Start direkt im Review)
    add("catalog", { title: "Abschlussprüfung Teil 1 – Einrichten eines IT-gestützten Arbeitsplatzes Winter 2026", beruf: "Fachinformatiker/-in Systemintegration", fach: "IT-Arbeitsplatz", jahr: String(now.getFullYear()), kind: "Prüfung", image: 3, description: "", duration: "90 Minuten", creator: "Koordinierungsstelle (IBBW)", tags: ["Prüfungen", "Erstellungsprozess"], contents: [], mine: false, copied_from: "", editor_by: "prozess", status: "review", release: null, rules: [],
      content: { name: "Abschlussprüfung Teil 1 – Einrichten eines IT-gestützten Arbeitsplatzes Winter 2026", duration_min: 90, ausgangssituation: "Sie arbeiten im IT-Service der NetzWerk Systemhaus GmbH.", company: { name: "NetzWerk Systemhaus GmbH", allgemein: "Systemhaus für mittelständische Unternehmen.", adresse: "NetzWerk Systemhaus GmbH\nSchlossweg 7\n70173 Stuttgart", kontakt: "service@netzwerk-systemhaus.example", rechtliches: "GmbH", vorlagen: "" }, info: { title: "Prüfungsinformationen", items: [["Bearbeitungszeit", "90 Minuten zzgl. individueller Zusatzzeit"]] }, gradingKey: { type: "ihk" }, categories: { system: "none", list: [] }, signatures: {},
        tasks: [{ title: "Arbeitsplatz einrichten", situation: "Ein neuer Mitarbeiter benötigt einen Arbeitsplatz.", tools: ["files", "mail", "tickets", "editor"], materials: [], subtasks: [sub("Ticket bearbeiten", "freitext", "Beschreiben Sie die Schritte zur Einrichtung des Arbeitsplatzes.", [["Vollständigkeit", 6, ""], ["Fachbegriffe", 4, ""]], [["Benutzerkonto, Rechte, Software, Datensicherung", "6 P"], ["Fachlich korrekte Begriffe", "4 P"]])] }] },
      meta: { titel: "Abschlussprüfung Teil 1 – Einrichten eines IT-gestützten Arbeitsplatzes Winter 2026", ptitel: "Abschlussprüfung Teil 1 – Einrichten eines IT-gestützten Arbeitsplatzes", zeitraum: "Winter", jahr: String(now.getFullYear()), beruf_id: "fisi", beruf: "Fachinformatiker/-in Systemintegration", berufsnr: "20201", fachbereich: "it", art: "Abschlussprüfung Teil 1", bereich: "IT-Arbeitsplatz", code: "FISI-AP1-W" + String(now.getFullYear()).slice(2), termin: dtIso(60), dauer: 90, einsicht_h: "48 Stunden", kommission_erstellt: true, kommission_bis: dIso(30), lektorat_bis: dIso(40), pruefloesung_bis: dIso(40), hilfsmittel: "", pool: "netzwerk", orgs: [], version: 1 },
      team: { koordination: [T.Brandauer.id], aufgabenerstellung: [], kommission_group: kgIT.id, kommission: [T.Morawetz.id, T["Dähne"].id], vorsitz: [T.Gaspari.id], beratung: [], lektorat: [T.Kowalczyk.id], pruefloesung: [] },
      history: [H(-6, KS, "angelegt", "Neue Prüfung angelegt – die Kommission übernimmt die Aufgabenerstellung (Start im Status Kommission/Review)", "", "review"), H(-6, KS, "team", "Kommission „Prüfungskommission IT-Berufe“ zugewiesen – Vorsitz: Gaspari, Emil"), H(-5, "Dähne, Niklas", "pool", "Unternehmenspool festgelegt: NetzWerk Systemhaus GmbH (Task 14)")], feedback: [], reviews: {} });

    // ---------- Abgeschlossene Prüfung mit Ergebnissen (Testdaten Prüfungseinsicht, Ergebnisse, Korrektur) ----------
    var catZP = add("catalog", { title: "Zwischenprüfung Büromanagement Sommer " + now.getFullYear(), beruf: "Kaufmann/-frau für Büromanagement", fach: "Geschäftsprozesse", jahr: String(now.getFullYear()), kind: "Prüfung", image: 0, description: "", duration: "90 Minuten", creator: "Koordinierungsstelle (IBBW)", tags: ["Prüfungen"], contents: [], mine: false, copied_from: "", editor_by: "prozess", status: "veroeffentlicht", release: null, rules: [],
      meta: { titel: "Zwischenprüfung Büromanagement Sommer " + now.getFullYear(), ptitel: "Musterprüfung Geschäftsprozesse", zeitraum: "Sommer", jahr: String(now.getFullYear()), beruf_id: "bm", beruf: "Kaufmann/-frau für Büromanagement", berufsnr: "10101", fachbereich: "kfm", art: "Zwischenprüfung", bereich: "Geschäftsprozesse", code: "BM-ZP-S" + String(now.getFullYear()).slice(2), termin: dtIso(-21), dauer: 90, einsicht_h: "24 Stunden", pool: "funsport", orgs: [afs.id, bts.id], version: 1 },
      team: {}, history: [H(-120, KS, "angelegt", "Prüfung angelegt", "", "vorbereitung"), H(-21, "System (Zeitsteuerung)", "veroeffentlicht", "Prüfungsstart erreicht – Inhalt für die Durchführung freigegeben", "begutachtung", "veroeffentlicht")], feedback: [], reviews: {} });
    var pr3 = CO({ title: catZP.title, kind: "pruefung", catalog: catZP.id, orgs: [afs.id, bts.id], exam_code: catZP.meta.code, status: "veröffentlicht", description: "Abgeschlossene Prüfung mit Ergebnissen (Testdaten für Ergebnisse und Prüfungseinsicht)." });
    catZP.meta.course = pr3.id;
    var zpRooms = { afs: R(Object.assign(fromVenue(V["Raum 202"]), { exam_name: pr3.title, exam_code: pr3.exam_code, planned_start: day(-21), started_at: day(-21), course: pr3.id, org: afs.id, owner: T.Hinrichs.id, state: "TERMINATED" })),
      bts: R(Object.assign(fromVenue(V["Raum 110"]), { exam_name: pr3.title, exam_code: pr3.exam_code, planned_start: day(-21), started_at: day(-21), course: pr3.id, org: bts.id, owner: T.Ammermann.id, state: "TERMINATED" })) };
    var btsGrp0 = btsGroups[0];
    pr3.groups = [snap(gFA, "teilnehmer"), snap(btsGrp0, "teilnehmer")];
    pr3.members = [{ person: T.Hinrichs.id, role: "schuladmin" }, { person: T.Ammermann.id, role: "schuladmin" }, { person: T["Riedmüller"].id, role: "pruefungseinsicht" }, { person: T.Hinrichs.id, role: "pruefungseinsicht" }, { person: T["Dähne"].id, role: "pruefungseinsicht" }, { person: T.Ammermann.id, role: "pruefungseinsicht" }];
    var kA = [T.Ohm], kA2 = [T.Steinhoff], kB = [T.Gaspari], kB2 = [T["Dähne"]];
    pr3.corrections = [K(1, gFA, kA, afs), K(2, gFA, kA2, afs), K(1, btsGrp0, kB, bts), K(2, btsGrp0, kB2, bts)]; pr3.third = {}; pr3.korr_end = dIso(-3); pr3.dk_threshold = 1;
    var zpPeople = groupMembers.FA230a.ids.slice(0, 6).map(function (id) { return { per: out.persons.filter(function (x) { return x.id === id; })[0], room: zpRooms.afs, org: afs, k1: kA, k2: kA2 }; })
      .concat(btsGrp0.members.slice(0, 4).map(function (id) { return { per: out.persons.filter(function (x) { return x.id === id; })[0], room: zpRooms.bts, org: bts, k1: kB, k2: kB2 }; }));
    zpPeople.forEach(function (z, i) {
      var per = z.per;
      var zp = add("participants", { lastname: per.lastname, firstname: per.firstname, username: per.username, group_name: i < 6 ? "FA230a" : btsGrp0.name, org: z.org.name, person: per.id, room: z.room.id, seat: "1-" + (i % 6 + 1), present: true, status: i === 5 ? "nicht_teilnahme" : "beendet", extra_time: 0, comment: "", health: "ok", cheat_ack: true, bookmarks: [], nta: 0, violations: 0, started_at: day(-21), finished_at: day(-21) });
      if (i === 5) return;
      add("items", { participant: zp.id, kind: "mail", folder: "sent", submission: "1.1", data: { task: "1", from: per.firstname + " " + per.lastname, from_mail: per.username + "@azubi.funsport-innovations.de", to: "Karim.Baeumler@funsport-innovations.de", subject: "AW: Quantitativer Angebotsvergleich für neue Lithium-Batterie-Packs", date: "13.10.2025 10:2" + (i % 10), attachments: [],
        body: "Sehr geehrter Herr Bäumler,\n\nnach meinem Angebotsvergleich ist das Angebot der " + (i % 2 ? "InnovaTech GmbH" : "BatteryWorld GmbH") + " günstiger.\n\nMit freundlichen Grüßen\n" + per.firstname + " " + per.lastname } });
      add("items", { participant: zp.id, kind: "note", folder: "notes", submission: "2.1", data: { task: "2", title: "Anfrage", html: "<p>Sehr geehrte Damen und Herren,</p><p>bitte senden Sie uns ein Angebot über 500 Kugellager Typ 608-2RS.</p>" } });
      var e1 = {};
      [1, 2].forEach(function (c) {
        var pts = {};
        Object.keys(CRITERIA).forEach(function (st) { pts[st] = CRITERIA[st].map(function (m, k) { var base = c === 1 ? m * (0.42 + rnd() * 0.56) : (e1[st][k] * (0.9 + rnd() * 0.15)); return Math.min(m, Math.max(0, Math.round(base * 2) / 2)); }); if (c === 1) e1[st] = pts[st]; });
        var marks = { "1.1": [{ id: "zp" + i + c, type: "sign", sign: c === 1 ? (i % 3 ? "r" : "Ug") : "(r)", ax: 420, ay: 300 + c * 20 }, { id: "zl" + i + c, type: "hline", style: c === 1 ? "wavy" : "single", x1: 330, x2: 520, y: 330 + c * 10 }] };
        add("gradings", { participant: zp.id, corrector: c, points: pts, not_done: {}, marks: marks, released: true, approvals: (c === 1 ? z.k1 : z.k2).map(function (x) { return x.id; }) });
      });
    });

    // ---------- Einstellungen ----------
    add("settings", { key: "favorites", value: ["Uv", "Ug", "r", "(r)", "f"] });
    add("settings", { key: "einsicht", value: { released: false } });
    // Stammdaten der Koordinierungsstelle (Berufsnummern sind Demowerte)
    add("settings", { key: "fachbereiche", value: [{ id: "kfm", name: "Kaufmännische Berufe" }, { id: "it", name: "IT-Berufe" }, { id: "tech", name: "Gewerblich-technische Berufe" }] });
    add("settings", { key: "berufe", value: [
      { id: "bm", nr: "10101", name: "Kaufmann/-frau für Büromanagement", fb: "kfm", titel: ["Abschlussprüfung Teil 1 – Informationstechnisches Büromanagement", "Abschlussprüfung Teil 2 – Kundenbeziehungsprozesse", "Abschlussprüfung Teil 2 – Wirtschafts- und Sozialkunde", "Musterprüfung Geschäftsprozesse"] },
      { id: "ik", nr: "10102", name: "Industriekaufmann/-frau", fb: "kfm", titel: ["Abschlussprüfung – Geschäftsprozesse", "Abschlussprüfung – Kaufmännische Steuerung und Kontrolle", "Abschlussprüfung – Wirtschafts- und Sozialkunde"] },
      { id: "eh", nr: "10103", name: "Kaufmann/-frau im Einzelhandel", fb: "kfm", titel: ["Abschlussprüfung Teil 1 – Verkauf und Werbemaßnahmen", "Abschlussprüfung Teil 2 – Geschäftsprozesse im Einzelhandel"] },
      { id: "fisi", nr: "20201", name: "Fachinformatiker/-in Systemintegration", fb: "it", titel: ["Abschlussprüfung Teil 1 – Einrichten eines IT-gestützten Arbeitsplatzes", "Abschlussprüfung Teil 2 – Konzeption und Administration von IT-Systemen", "Abschlussprüfung Teil 2 – Analyse und Entwicklung von Netzwerken"] },
      { id: "fiae", nr: "20202", name: "Fachinformatiker/-in Anwendungsentwicklung", fb: "it", titel: ["Abschlussprüfung Teil 1 – Einrichten eines IT-gestützten Arbeitsplatzes", "Abschlussprüfung Teil 2 – Planen eines Softwareproduktes", "Abschlussprüfung Teil 2 – Entwicklung und Umsetzung von Algorithmen"] },
      { id: "mech", nr: "30301", name: "Mechatroniker/-in", fb: "tech", titel: ["Abschlussprüfung Teil 1", "Abschlussprüfung Teil 2 – Arbeitsplanung", "Abschlussprüfung Teil 2 – Funktionsanalyse"] }] });
    [{ id: "funsport", name: "FunSport Innovations GmbH", fachbereich: "kfm", branche: "Sportartikel / E-Mobilität", allgemein: "Die FunSport Innovations GmbH entwickelt und vertreibt Funsport-Produkte, u. a. das E-Skateboard „Speedster“. 35 Beschäftigte.", adresse: "FunSport Innovations GmbH\nSportparkallee 12\n70173 Stuttgart", kontakt: "Telefon 0711 123456-0\ninfo@funsport-innovations.de", rechtliches: "GmbH · Amtsgericht Stuttgart HRB 765432" },
     { id: "muster", name: "Muster Handels GmbH", fachbereich: "kfm", branche: "Großhandel Bürobedarf", allgemein: "Die Muster Handels GmbH beliefert Unternehmen und Behörden in Baden-Württemberg mit Büro- und Schulbedarf. 120 Beschäftigte, eigener Onlineshop.", adresse: "Muster Handels GmbH\nLindenring 4\n68159 Mannheim", kontakt: "Telefon 0621 445500\nservice@muster-handels.example", rechtliches: "GmbH · Amtsgericht Mannheim HRB 112233" },
     { id: "nordwerk", name: "NordWerk Maschinenbau AG", fachbereich: "tech", branche: "Maschinen- und Anlagenbau", allgemein: "Die NordWerk Maschinenbau AG fertigt Verpackungsmaschinen für die Lebensmittelindustrie. 480 Beschäftigte an zwei Standorten.", adresse: "NordWerk Maschinenbau AG\nIndustriestraße 20\n89077 Ulm", kontakt: "Telefon 0731 90880\ninfo@nordwerk.example", rechtliches: "AG · Amtsgericht Ulm HRB 445566" },
     { id: "netzwerk", name: "NetzWerk Systemhaus GmbH", fachbereich: "it", branche: "IT-Dienstleistungen", allgemein: "Systemhaus für mittelständische Unternehmen: Arbeitsplatz-IT, Netzwerke und Support. 60 Beschäftigte.", adresse: "NetzWerk Systemhaus GmbH\nSchlossweg 7\n70173 Stuttgart", kontakt: "service@netzwerk-systemhaus.example", rechtliches: "GmbH · Amtsgericht Stuttgart HRB 778899" },
     { id: "datenhafen", name: "Datenhafen Software GmbH", fachbereich: "it", branche: "Softwareentwicklung", allgemein: "Die Datenhafen Software GmbH entwickelt Logistik-Software für Häfen und Speditionen. 90 Beschäftigte.", adresse: "Datenhafen Software GmbH\nKaiweg 3\n20457 Hamburg", kontakt: "kontakt@datenhafen.example", rechtliches: "GmbH · Amtsgericht Hamburg HRB 556677" }]
      .forEach(function (u) { u.by = "Koordinierungsstelle"; add("settings", { key: "pool:" + u.id, value: u }); });
    add("settings", { key: "signsets", value: { active: "std", sets: [
      { id: "std", name: "Korrekturzeichen (Standard)", groups: [
        { group: "Allgemeine Korrekturzeichen", items: [["r", "richtiges Teilergebnis"], ["f", "falsches Teilergebnis"], ["(r)", "es wird mit einem Fehler richtig weitergerechnet"], ["Ug", "ungenau"], ["Ul", "unleserlich"], ["Uv", "unvollständig"]] },
        { group: "Sprachlich-formale Mängel", items: [["R", "Rechtschreibung"], ["Z", "Zeichensetzung"], ["Gr", "Grammatik"], ["A", "Ausdruck"], ["Sb", "Satzbau"]] },
        { group: "Mängel inhaltlicher Art", items: [["I", "Inhalt"], ["Def", "Definition"], ["Log", "Logik"], ["Th", "Thema bzw. Aufgabenstellung nicht beachtet, falsches Textverständnis"], ["ÜF", "Übertragungsfehler – Fehler ohne Punktabzug, wenn er als Flüchtigkeitsfehler anzusehen ist"], ["Zs", "Zusammenhang"], ["Wf", "Fehler, der wiederholt vorkommt"]] }] },
      { id: "kurz", name: "Kurzsatz (Entwurf)", groups: [{ group: "Allgemeine Korrekturzeichen", items: [["r", "richtig"], ["f", "falsch"], ["(r)", "Folgefehler richtig weitergerechnet"], ["Uv", "unvollständig"]] }, { group: "Sprache", items: [["R", "Rechtschreibung"], ["Gr", "Grammatik"], ["A", "Ausdruck"]] }] }] } });
    add("settings", { key: "demo", value: { seeded_at: iso(now), seed_version: SEED_VERSION } });
    return out;
  }

  var api = { SEED_VERSION: SEED_VERSION, COLLECTIONS: COLLECTIONS, CRITERIA: CRITERIA, build: build };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CheckBWSeed = api;
})(typeof globalThis !== "undefined" ? globalThis : this);

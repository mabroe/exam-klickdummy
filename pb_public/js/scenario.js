// Prüfungsinhalt der Musterprüfung FA230 (Demo-Szenario „FunSport Innovations GmbH“)
// Bewertungskriterien müssen zu pb_hooks/seed.js (CRITERIA) passen.

export const EXAM = {
  name: "FA230 - Musterprüfung",
  company: {
    name: "FunSport Innovations GmbH",
    allgemein: "Die FunSport Innovations GmbH ist ein aufstrebendes Beratungsunternehmen für Fragen rund um die Themen Digitalisierung, IT-Infrastruktur und IT-Sicherheit. Das Unternehmen beschäftigt 35 Personen. Zu den Auftraggebern der IT Sol GmbH gehören Geschäftskunden aus ganz Deutschland. Der Hauptsitz des Unternehmens ist in Achrieden.",
    adresse: "FunSport Innovations GmbH\nSportparkallee 12\n70173 Stuttgart",
    rechtliches: "Rechtsform: GmbH\nRegistergericht: Amtsgericht Stuttgart, HRB 765432\nGeschäftsführung: Dr. Helge Pätzold",
    kontakt: "Telefon: 0711 123456-0\nE-Mail: info@funsport-innovations.de\nWeb: www.funsport-innovations.de",
    vorlagen: "Briefvorlage DIN 5008, Vorlage Angebotsvergleich, Kalkulationsschema",
  },
  // E-Mail-Signaturen je Ausgangssituation (Aufgabe); Platzhalter {name}, {mail}
  signatures: {
    "1": [["Einkauf (vollständig)", "Mit freundlichen Grüßen\n\n{name}\nAuszubildende/r im Einkauf\nFunSport Innovations GmbH\nSportparkallee 12 · 70173 Stuttgart\nTelefon 0711 123456-230 · {mail}\nwww.funsport-innovations.de"], ["Kurz (intern)", "Viele Grüße\n{name}\nEinkauf"]],
    "2": [["Materialwirtschaft (vollständig)", "Mit freundlichen Grüßen\n\n{name}\nAuszubildende/r Materialwirtschaft\nFunSport Innovations GmbH\nSportparkallee 12 · 70173 Stuttgart\nTelefon 0711 123456-240 · {mail}"], ["Kurz (intern)", "Viele Grüße\n{name}\nMaterialwirtschaft"]],
    "3": [["IT-Abteilung (vollständig)", "Mit freundlichen Grüßen\n\n{name}\nAuszubildende/r IT-Systemintegration\nFunSport Innovations GmbH · IT-Abteilung\nSportparkallee 12 · 70173 Stuttgart\nTelefon 0711 123456-300 · {mail}"], ["Kurz (intern)", "Viele Grüße\n{name}\nIT-Abteilung"]],
  },
  ausgangssituation: "Die FunSport Innovations GmbH ist ein aufstrebendes Beratungsunternehmen für Fragen rund um die Themen Digitalisierung, IT-Infrastruktur und IT-Sicherheit. Sie sind Auszubildende/r und unterstützen in den kommenden Wochen verschiedene Abteilungen. Nutzen Sie für die Bearbeitung die bereitgestellten Werkzeuge: E-Mail-Client, Kalender, Dateiablage und Notizen.",
  tasks: [
    {
      no: "1", title: "Angebotsvergleich", points: 25,
      situation: "FunSport Innovations GmbH entwickelt und vertreibt innovative Funsport-Produkte. Das wichtigste Produkt ist derzeit das E-Skateboard „Speedster“ mit Lithium-Batterien.\n\nDa die Nachfrage wächst, soll die Materialbeschaffung zukünftig besser geplant werden. Ziel ist es jederzeit liefern zu können und Lagerbestände so gering wie möglich zu halten.\n\nSie arbeiten im Einkauf und in der Beschaffung und übernehmen dort verschiedene Aufgaben.\n\nBearbeiten Sie die in der E-Mail von Herrn Bäumler an Sie gestellten Anforderungen.",
      subtasks: [
        { no: "1.1", title: "Angebotsvergleich", points: 5, tool: "mail",
          text: "Lesen Sie die E-Mail von Herrn Bäumler im Posteingang. Führen Sie den geforderten quantitativen Angebotsvergleich mit der bereitgestellten Vorlage durch und senden Sie Ihr Ergebnis per E-Mail an Herrn Bäumler. Markieren Sie die gesendete E-Mail als Abgabe.",
          criteria: [["Inhalt und Formulierung", 2], ["Darstellung und Berechnung", 2], ["DIN Rechtschreibung und Grammatik", 1]],
          horizon: [["Bezugspreise korrekt ermittelt (Listenpreis, Rabatt, Skonto, Bezugskosten)", "1 P"], ["Kopierfähige Formeln mit Zellbezügen und WENN-Funktion", "1 P"], ["Begründete Entscheidung für den günstigeren Lieferanten", "2 P"], ["E-Mail normgerecht nach DIN 5008, Anhang beigefügt", "1 P"]] },
        { no: "1.2", title: "Angebotskalkulation", points: 10, tool: "files",
          text: "Erstellen Sie auf Basis des günstigsten Angebots eine Bezugskalkulation für 300 Batterie-Packs. Laden Sie Ihre Kalkulation in „Eigene Dateien“ hoch und markieren Sie sie als Abgabe.",
          criteria: [["Kalkulationsschema", 4], ["Berechnung", 4], ["Darstellung", 2]],
          horizon: [["Vollständiges Kalkulationsschema vom Listeneinkaufspreis bis zum Bezugspreis", "4 P"], ["Rechnerisch richtige Werte, Folgefehler werden berücksichtigt", "4 P"], ["Übersichtliche Darstellung mit Beschriftung und Einheiten", "2 P"]] },
        { no: "1.3", title: "Programmierung", points: 10, tool: "ide",
          text: "Implementieren Sie in der Entwicklungsumgebung die Funktion bestellmenge(lagerbestand, meldebestand, hoechstbestand), die die Bestellmenge ermittelt. Nutzen Sie die Vorlage bestellmenge.py (oder bestellmenge.js), testen Sie Ihr Programm über „Ausführen“ und markieren Sie die Datei als Abgabe.",
          criteria: [["Funktionalität", 5], ["Codequalität", 3], ["Dokumentation", 2]],
          horizon: [["Korrekte Verzweigung Lagerbestand < Meldebestand", "2 P"], ["Berechnung Bestellmenge = Höchstbestand − Lagerbestand", "3 P"], ["Sinnvolle Bezeichner und Einrückung", "3 P"], ["Kurze Erläuterung des Algorithmus", "2 P"]] },
      ],
    },
    {
      no: "2", title: "Angebote & Kalkulation", points: 30,
      situation: "Für die Produktion des „Speedster“ werden zusätzlich Kugellager benötigt. Ihr Ausbilder bittet Sie, den Beschaffungsprozess vorzubereiten und einen Termin mit dem Lieferanten zu planen.",
      subtasks: [
        { no: "2.1", title: "Anfrage formulieren", points: 10, tool: "editor",
          text: "Formulieren Sie eine Anfrage an einen möglichen Lieferanten über 500 Kugellager (Typ 608-2RS). Speichern Sie die Anfrage in den Notizen und markieren Sie sie als Abgabe.",
          criteria: [["Inhalt", 4], ["Formulierung", 3], ["DIN 5008", 3]],
          horizon: [["Alle notwendigen Angaben (Menge, Typ, Liefertermin, Zahlungsbedingungen)", "4 P"], ["Freundlicher, sachlicher Stil", "3 P"], ["Formale Gestaltung nach DIN 5008", "3 P"]] },
        { no: "2.2", title: "Termin planen", points: 10, tool: "calendar",
          text: "Planen Sie im Kalender einen Termin für ein Lieferantengespräch in der kommenden Woche. Achten Sie auf bestehende Termine. Markieren Sie den Termin als Abgabe.",
          criteria: [["Terminwahl", 4], ["Vollständigkeit", 4], ["Darstellung", 2]],
          horizon: [["Termin kollidiert nicht mit bestehenden Terminen", "4 P"], ["Titel, Ort und Beschreibung vollständig", "4 P"], ["Aussagekräftige Bezeichnung", "2 P"]] },
        { no: "2.3", title: "Nachkalkulation", points: 10, tool: "upload",
          text: "Führen Sie eine Nachkalkulation für den Auftrag durch (Tabellenkalkulation, Textverarbeitung oder PDF) und laden Sie die Datei direkt hier als Abgabe hoch. Eine Ablage unter „Eigene Dateien“ ist nicht nötig.",
          criteria: [["Berechnung", 5], ["Interpretation", 3], ["Darstellung", 2]],
          horizon: [["Abweichungen korrekt berechnet", "5 P"], ["Ursachen der Abweichungen benannt", "3 P"], ["Übersichtliche Darstellung", "2 P"]] },
      ],
    },
    {
      no: "3", title: "Netzwerkkonfiguration", points: 30,
      situation: "Die FunSport Innovations GmbH bezieht einen neuen Standort. Das Netzwerk für Verwaltung, Produktion und Gäste muss geplant werden. Einen Netzplan finden Sie unter „Bereitgestellte Dateien“.",
      subtasks: [
        { no: "3.1", title: "IP-Adressplan", points: 15, tool: "tickets",
          text: "Bearbeiten Sie Ticket #4711 im Ticketsystem: Teilen Sie das Netz 192.168.40.0/24 in drei Subnetze für Verwaltung (50 Hosts), Produktion (25 Hosts) und Gäste (10 Hosts) auf. Dokumentieren Sie Netz-ID, Broadcast und Hostbereich in der Lösung des Tickets und markieren Sie das Ticket als Abgabe.",
          criteria: [["Subnetting", 8], ["Dokumentation", 4], ["Darstellung", 3]],
          horizon: [["Korrekte Subnetzmasken /26, /27, /28", "4 P"], ["Netz-ID und Broadcast richtig", "4 P"], ["Vollständige Tabelle", "4 P"], ["Übersichtlich", "3 P"]] },
        { no: "3.2", title: "Firewall-Regeln", points: 15, tool: "tickets",
          text: "Bearbeiten Sie Ticket #4712: Formulieren Sie Firewall-Regeln, sodass das Gäste-Netz nur Internetzugriff hat und die Verwaltung auf die Produktion zugreifen darf. Sie können die Vorlage firewall_regeln.txt in der Entwicklungsumgebung oder eine Notiz nutzen. Markieren Sie Ihre Lösung als Abgabe.",
          criteria: [["Regelwerk", 8], ["Begründung", 5], ["Darstellung", 2]],
          horizon: [["Default-Deny und notwendige Allow-Regeln", "8 P"], ["Begründung je Regel", "5 P"], ["Tabellarische Darstellung", "2 P"]] },
      ],
    },
  ],
  info: {
    title: "Prüfungsinformationen",
    items: [
      ["Bearbeitungszeit", "90 Minuten zzgl. individueller Zusatzzeit"],
      ["Zugelassene Hilfsmittel", "Bereitgestellte Werkzeuge der Prüfungsumgebung (Dateien, Mail, Kalender, Notizen, Tickets, Taschenrechner, Entwicklungsumgebung)"],
      ["Abgabe", "Markieren Sie Dateien, E-Mails, Termine, Notizen, Tickets oder Code-Dateien als Abgabe der jeweiligen Teilaufgabe. Nur markierte Elemente werden bewertet."],
      ["Arbeitsmaterialien", "E-Mails, Dateien, Termine, Tickets und Code-Vorlagen gehören jeweils zu einer Aufgabe. In den Werkzeugen sehen Sie immer die Materialien der geöffneten Aufgabe."],
      ["Speicherung", "Alle Eingaben werden automatisch gespeichert (Freitexte spätestens alle 15 Sekunden)."],
    ],
  },
  faq: [
    ["Was passiert bei einem Verbindungsabbruch?", "Ihre Eingaben werden laufend gespeichert. Sie müssen sich nicht erneut anmelden: Sobald die Verbindung wieder besteht, arbeiten Sie direkt weiter. Der Abbruch wird protokolliert; die Aufsicht kann verlorene Zeit gutschreiben."],
    ["Wie markiere ich etwas als Abgabe?", "Über das Häkchen-Symbol neben einer Datei, beim Senden einer E-Mail oder in den Termindetails wählen Sie die Teilaufgabe aus."],
    ["Kann ich eine Abgabe ändern?", "Ja, bis Sie die Prüfung beenden bzw. die Aufsicht sie einsammelt, können Sie Markierungen hinzufügen oder entfernen."],
    ["Ich benötige eine Pause.", "Melden Sie sich bei der Aufsicht. Die Aufsicht kann Ihre Prüfung pausieren."],
  ],
};

export const ALL_SUBTASKS = EXAM.tasks.flatMap((t) => t.subtasks.map((s) => ({ ...s, task: t })));
export const subtask = (no) => ALL_SUBTASKS.find((s) => s.no === no);
export const taskOf = (no) => EXAM.tasks.find((t) => t.no === String(no));
export const TOTAL_POINTS = EXAM.tasks.reduce((a, t) => a + t.points, 0);

// Korrekturzeichen
export const SIGNS = [
  { group: "Allgemeine Korrekturzeichen", items: [["r", "richtiges Teilergebnis"], ["f", "falsches Teilergebnis"], ["(r)", "es wird mit einem Fehler richtig weitergerechnet"], ["Ug", "ungenau"], ["Ul", "unleserlich"], ["Uv", "unvollständig"]] },
  { group: "Sprachlich-formale Mängel", items: [["R", "Rechtschreibung"], ["Z", "Zeichensetzung"], ["Gr", "Grammatik"], ["A", "Ausdruck"], ["Sb", "Satzbau"]] },
  { group: "Mängel inhaltlicher Art", items: [["I", "Inhalt"], ["Def", "Definition"], ["Log", "Logik"], ["Th", "Thema bzw. Aufgabenstellung nicht beachtet, falsches Textverständnis"], ["ÜF", "Übertragungsfehler – Fehler ohne Punktabzug, wenn er als Flüchtigkeitsfehler anzusehen ist"], ["Zs", "Zusammenhang"], ["Wf", "Fehler, der wiederholt vorkommt"]] },
];

// Korrekturrollen: Farbe und Randseite der Korrekturzeichen
export const CORRECTORS = {
  1: { label: "Erstkorrektur", short: "EK", color: "#c0161b", side: "right", name: "Gesa Ohm" },
  2: { label: "Zweitkorrektur", short: "ZK", color: "#1d7f37", side: "left", name: "Ayla Steinhoff" },
  3: { label: "Drittkorrektur (Endbeurteilung)", short: "DK", color: "#8a5a2b", side: "left", name: "Dr. Karim Ebeling" },
};
export const ALL_SIGN_KEYS = SIGNS.flatMap((g) => g.items.map((i) => i[0]));

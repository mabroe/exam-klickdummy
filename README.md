# Exam Klickdummy – Prüfungsplattform Exam

Interaktiver Klickdummy der Prüfungsplattform. Er ist in HTML/CSS/JS nach den Figma-Screens nachgebaut und läuft entweder mit **PocketBase** als lokaler Datenbank und Webserver oder als **statische Seite (z. B. GitHub Pages)** mit einer Datenbank im Browser. Die Rollen sind über Realtime live gekoppelt. Startet die Raumaufsicht die Prüfung, wechselt der Prüfling im anderen Browserfenster sofort vom Wartebereich in die Prüfung. Markierte Abgaben erscheinen direkt in der Korrektur.

> Nur für Demonstrationszwecke. Alle Personennamen sind zufällig erzeugte Fantasienamen. Alle Collections sind ohne Zugriffsschutz (öffentliche API-Regeln). Bitte keine echten Personendaten verwenden.

**Zugang:** Vor dem Klickdummy steht eine Passwortseite. Die Freigabe gilt 12 Stunden im jeweiligen Browser; „Zugang sperren“ auf der Startseite hebt sie auf. Das Passwort wird nur als SHA-256-Prüfsumme in `pb_public/js/config.js` gespeichert. Es ist eine Zugangshürde für den Demonstrator, kein Schutz vertraulicher Inhalte – der Quelltext einer GitHub-Pages-Seite ist öffentlich. Neues Passwort: Prüfsumme erzeugen (`python3 -c "import hashlib;print(hashlib.sha256('NEUES-PASSWORT'.encode()).hexdigest())"`) und in `config.js` bei `passwordHash` eintragen.

## Schnellstart

| System | Start |
|---|---|
| macOS / Linux | `./start.sh` |
| Windows | Doppelklick auf `start.bat` (oder `start.ps1` in PowerShell) |
| Docker / Synology | `docker compose up -d --build` |

Danach im Browser **http://localhost:8090** öffnen.

Beim ersten Start lädt das Skript PocketBase (v0.40.5, ca. 12 MB) von GitHub herunter. Dann legt es die Datenbank in `pb_data/` an und füllt sie mit Demodaten. Weitere Starts laufen offline.

Optional: Unter `http://localhost:8090/_/` gibt es die PocketBase-Admin-Oberfläche, um Daten direkt anzusehen oder zu ändern. Beim ersten Aufruf wird dort ein Admin-Konto angelegt.

## GitHub Pages und Datenhaltung

Der Klickdummy erkennt beim Start selbst, wo die Daten liegen (`backend` in `pb_public/js/config.js`):

| Betrieb | Daten | Live-Kopplung der Rollen |
|---|---|---|
| Lokal mit PocketBase (`start.sh`, `start.bat`, Docker) | Server-Datenbank `pb_data/` | alle Browser und Geräte im Netz |
| **GitHub Pages** (statisch) | **IndexedDB im Browser** – Demodaten werden beim ersten Aufruf automatisch angelegt | alle Tabs und Fenster **desselben Browsers** (BroadcastChannel) |
| GitHub Pages + eigener PocketBase-Server (`backend: "https://…"`) | Server-Datenbank | alle Geräte |

Im Browser-Modus gelten dieselben Fachregeln wie auf dem Server (Nachteilsausgleich nur vor dem Start, keine Doppelbelegung realer Räume); hochgeladene Dateien werden ebenfalls in IndexedDB gespeichert. Jeder Browser hat seinen eigenen Datenstand; „Demo zurücksetzen“ setzt ihn zurück. Die Demodaten stehen für beide Betriebsarten in einer gemeinsamen Datei (`pb_public/js/seed-data.js`).

**Veröffentlichen:** Repository auf GitHub anlegen und pushen, dann einmalig *Settings › Pages › Build and deployment › Source: GitHub Actions* wählen. Der Workflow `.github/workflows/pages.yml` veröffentlicht den Ordner `pb_public` bei jedem Push auf `main`. Neue Version: `tools/release.sh 8.1 "Beschreibung"` (setzt die Version, committet, taggt und pusht).

**Geräteübergreifend live (optional):** PocketBase mit diesem Repository auf einem eigenen Server betreiben (z. B. Docker auf einer Synology) und in `config.js` `backend: "https://klickdummy.example.de"` eintragen. Die Oberfläche bleibt auf GitHub Pages.

## Rollen und Inhalte

| Rolle | Bereiche (Figma) | Bezug Tasks / Rollen |
|---|---|---|
| **Prüfling** | Wartebereich (Belehrung, Gesundheitsabfrage, Countdown, Onboarding), Prüfungsmodus (Dashboard, Aufgaben/Teilaufgaben, Ausgangssituation, Aufgabenwechsel), Taskleiste mit Fenstern für Dateien, Mail, Kalender, Notizen, Taschenrechner und Entwicklungsumgebung (IDE), Abgaben markieren, Abgabenübersicht, Endbildschirm | Exam-Teilnehmer, Task 19 / 34 |
| **Raumaufsicht** | Übersicht Raumaufsicht, Tabs Prüfung · Mein Raum · Teilnehmende · Aufsichtspersonen · Prüfungsprotokoll, Starten/Pausieren/Einsammeln/Beenden, Teilnehmerdetails (Pause, Sperre, Zusatzzeit, NTA, Versetzung), besondere Vorkommnisse, Symbolhilfe | Exam-Raumaufsicht, Task 21 / 22 / 33 |
| **Korrektor:in** (Erst-, Zweit-, Drittkorrektur) | Korrekturübersicht (aufgaben-/personenweise, einklappbare Summen), Korrekturmodus mit Randkorrektur je Rolle, Unterstreichungen, Stifteingabe mit Zeichenerkennung, Tablet-Ansicht, Favoriten, einklappbare Bewertung, Kommentare, Erwartungshorizont und Vergleich mit anderem Prüfling (jeweils neuer Tab), finale Freigabe | Exam-Korrektor, Task 10 / 11 / 20 / 27 |
| **Lehrkraft** (Unterrichtsebene) | Meine Aufgaben, Katalog, Inhalt als Unterricht kopieren (eigene, im Editor bearbeitbare Kopie), eigene Inhalte erstellen und für die eigene Schule freigeben, **Mein Unterricht** mit Mitglieder- und Gruppenverwaltung (Schüler:innen einzeln, Klassen/Kurse der Schulverwaltung, eigene Gruppen, weitere Lehrkräfte als Mitbetreuung), Raumaufsicht planen und durchführen, Korrektur | Exam-Lehrkraft, Task 31 / 32 / 33 / 35 / 36 |
| **Bereichsadministration** (Wenke Hollerbach) | **Katalog** für den Unterricht pflegen: Inhalte im Editor anlegen und bearbeiten, **global freigeben** und Freigabe beenden (Reiter „Nicht freigegeben“ für Entwürfe) | Katalog, Unterricht (OPU) |
| **Schuladministration** (Prüfungsebene) | **Prüfungen** der eigenen Schule: Teilnehmende (Personen/Klassen), Raumaufsichten, Korrektor:innen (Erst/Zweit/Dritt), Prüfungseinsicht – jeweils nur Personen der eigenen Schule; Raumaufsichten der Schule organisieren | Exam-Schuladministration, Task 52 / 24 / 21 / 23 / 28 |

## Konten, Schulen und Sichtbarkeit

Auf der Startseite meldet man sich als **konkrete Person** an. Zwei fiktive Schulen sind angelegt: **Ahornfeld-Schule (AFS)** und **Birkental-Schule (BTS)**. Alle Namen sind zufällig erzeugt.

| Person | Schule | Rolle im Demo |
|---|---|---|
| Amir Eggert | AFS | Lehrkraft, Besitzer „Zentrale Klassenarbeit HTML“ (Gruppe A in Reihen, Gruppe B in U-Form) |
| Ilyas Morawetz | AFS · BTS | Lehrkraft in **zwei Organisationen**: eigener Unterricht an der AFS, Mitbetreuung „Zentrale Klassenarbeit CSS“ (BTS), Raumaufsicht und Zweitkorrektur der FA230-Prüfung an der BTS |
| Thea Riedmüller, Lina Voigt | AFS | Raumaufsichten der FA230-Prüfung (Raum 123); Riedmüller zusätzlich Rolle „Prüfungseinsicht“ |
| Gesa Ohm + Lina Voigt, Ayla Steinhoff, Dr. Karim Ebeling | AFS | Korrektorengruppen FA230 (FA230a): Erstkorrektur (Gruppe aus zwei Personen), Zweitkorrektur, Endbeurteilung |
| Marit Hinrichs | AFS | Schuladministration |
| Ilka Ammermann | BTS | Schuladministration (Raum 201, Aula) |
| Emil Gaspari, Niklas Dähne | BTS | Lehrkräfte / Raumaufsichten BTS; Dähne zusätzlich Rolle „Prüfungseinsicht“ |

**Räume und Sitzordnungen**
- **Unterricht:** Es wird **kein realer Raum** gebucht. Die Lehrkraft gibt der Raumaufsicht eine Bezeichnung und wählt **Anzahl der Sitzplätze** und **Anordnung**: Reihen (Plätze je Reihe), Reihen versetzt, U-Form oder Gruppentische (4 oder 6 Plätze). Eine Vorschau zeigt den Sitzplan; bis zum Start lässt er sich im Reiter „Prüfung“ ändern. Platzbezeichnungen: Reihe-Platz (`2-1`), U-Form fortlaufend (`7`), Gruppentische Tisch-Platz (`T2-3`).
- **Prüfung:** Die Schuladministration wählt einen **realen Raum ihrer Schule** (Raumliste je Schule). Ein Raum kann je Zeitraum (Bearbeitungszeit zzgl. 30 Minuten) nur einmal belegt werden; belegte Räume sind in der Auswahl gesperrt und der Server weist Doppelbelegungen ab.

**Prüfungsräume** verwaltet die Schuladministration unter **„Prüfungsräume“** (Navigation bzw. „Prüfungsräume verwalten“ in der Raumaufsicht): anlegen, bearbeiten (Bezeichnung, Gebäude, Sitzplätze und Anordnung) und löschen, solange der Raum nicht verplant ist. Räume gehören zu einer Schule und stehen nur deren Prüfungs-Raumaufsichten zur Auswahl.

**Lehrkräfte in mehreren Organisationen** (`persons.orgs`): Sie sehen die berechtigten Informationen aller ihrer Schulen – Kurse, in denen sie Mitglied sind, und können von jeder ihrer Schulen als Raumaufsicht, Korrektor:in oder Lehrkraft zugeordnet werden. In Listen erscheinen sie mit allen Schulkürzeln (z. B. „AFS · BTS“).

Klassen und Kurse der Schulverwaltung: FA230a, WG12a, WG12b, Informatik J1 (AFS) sowie die Klassen des Großraums (BTS).

**Sichtbarkeit der Raumaufsichten** (Übersicht und Direktaufruf):
- **Lehrkraft**: nur Raumaufsichten, die ihr Konto betreffen – Eigentümer, eingetragene Aufsichtsperson oder Besitzer/Mitbetreuung des Unterrichtskurses.
- **Raumaufsicht**: nur Raumaufsichten, in denen sie als Aufsichtsperson eingetragen ist (bei genau einer wird sie direkt geöffnet).
- **Schuladministration**: nur die Prüfungs-Raumaufsichten der eigenen Schule. In einer schulübergreifenden Prüfung sieht und bearbeitet sie nur Mitglieder ihrer Schule.
- **Korrektur**: nur Arbeiten aus Kursen, in denen das Konto korrigieren darf. Prüfung (Rolle Korrektor:in): Erst-, Zweit- und Drittkorrektur. Unterricht (Rolle Lehrkraft): **genau eine Korrektur** durch die korrigierende Lehrkraft (zunächst der Besitzer); sie kann die Korrektur an eine andere Lehrkraft des Kurses weitergeben („Korrektur weitergeben“ in der Korrekturübersicht).

Zuordnungen in der Raumaufsicht erfolgen **aus den Kursmitgliedern**: Teilnehmende aus der Rolle „Teilnehmende“ (Prüfung: nur der Schule des Raums, nicht bereits in einer anderen Raumaufsicht derselben Prüfung), Aufsichtspersonen aus der Rolle „Raumaufsicht“ (Prüfung) bzw. den Lehrkräften des Unterrichts. Eine Lehrkraft, die eine Raumaufsicht erstellt, wird automatisch als Aufsichtsperson eingetragen.

## Testbare Klickstrecken

Auf der Startseite starten zwei Klickstrecken. Ein **Leitfaden unten rechts** zeigt den aktuellen Schritt mit Erläuterung und der Schaltfläche „Anmelden und öffnen“ (wechselt die Person und öffnet die richtige Seite). Erledigte Schritte werden automatisch aus den Daten erkannt; „Alle Schritte anzeigen“ blendet die vollständige Liste ein. „Pausieren“ hält die Klickstrecke an; auf der Startseite lässt sie sich jederzeit **an der letzten Stelle fortsetzen** oder neu beginnen – auch nach einem Personenwechsel oder Ausflug in andere Bereiche.

**Unterricht (Lehrkraft Amir Eggert)**
1. Prüfung aus dem Katalog kopieren (Task 31)
2. Schüler:innen hinzufügen – Klasse WG12a oder einzeln (Task 31)
3. Weitere Lehrkraft als Mitbetreuung hinzufügen (optional)
4. Eigene Gruppe anlegen (optional)
5. Raumaufsicht mit Sitzplätzen und Anordnung erstellen – ohne realen Raum (Task 32)
6. Teilnehmende aus dem Kurs zuordnen (Task 32)
7. Sichtbarkeit prüfen: Lehrkraft ohne Bezug sieht die Raumaufsicht nicht, Mitbetreuung schon
8. Prüfung starten (Task 33)
9. Als Schüler:in teilnehmen (Task 34)
10. Einsammeln und beenden (Task 33) – im Unterricht gibt es kein Prüfungsprotokoll
11. Korrigieren – genau eine Korrektur (Task 35, optional)
12. Korrektur an eine andere Lehrkraft des Kurses weitergeben (optional)

**Prüfung (Schuladministration Marit Hinrichs)**
1. Prüfung „FA230“ öffnen, Teilnehmende der eigenen Schule zuordnen (Task 52)
2. Raumaufsicht (Person) zuordnen (Task 52)
3. Korrektorengruppen zuweisen – je Stufe mehrere Personen, für eine Klasse oder einzelne Prüflinge (Task 24)
4. Raumaufsicht in einem freien realen Raum erstellen – belegte Räume sind gesperrt (Task 21)
5. Aufsichtspersonen zuordnen (Task 21)
6. Teilnehmende zuordnen (Task 21)
7. Sichtbarkeit prüfen: Schuladmin der BTS sieht die Raumaufsicht nicht; die Raumaufsicht sieht nur ihre Räume
8. Raumaufsicht durchführen als zugeordnete Raumaufsicht (Task 22)
9. Beenden und Protokoll herunterladen (Task 23)
10. Ergebnisse prüfen und über eine Drittkorrektur entscheiden (Task 28)

## Empfohlene Demo (zwei Fenster nebeneinander)

1. Fenster A: **Raumaufsicht** (Thea Riedmüller) wählen. Der Sitzplan von Raum 123 erscheint.
2. Fenster B: **Prüfling** (Niklas Fröhlke, Platz 1-1) wählen. Die Belehrung und die Gesundheitsabfrage bestätigen.
3. Fenster A: Bei Platz 1-1 die **Anwesenheit** einschalten. Optional „Demo: übrige Teilnehmende anmelden“ klicken.
4. Fenster A: **Prüfung starten**. In Fenster B läuft ein 5-Sekunden-Countdown, danach öffnet sich das Dashboard.
5. Fenster B: Teilaufgabe 1.1 öffnen und die Mail von Herrn Bäumler beantworten. Die Vorlage anhängen, senden und **als Abgabe 1.1 markieren**.
6. Fenster A: Über „Details“ den Prüfling pausieren oder sperren. Fenster B zeigt sofort das Overlay. Danach **Prüfung einsammeln**.
7. Rolle **Korrektor:in** wählen. Die Abgabe von Niklas Fröhlke erscheint in der Korrekturübersicht und kann bewertet werden.

Über **Administration › Demo zurücksetzen** oder den Button auf der Startseite wird alles auf den Ausgangszustand gesetzt. Andere offene Fenster laden dabei automatisch neu. Der Prüfungsbeginn von Raum 123 liegt nach dem Zurücksetzen 20 Minuten in der Zukunft.

## Großraum (mehr als 40 Teilnehmende)

Ab **41 Teilnehmenden** in einer Raumaufsicht wird kein Sitzplan mehr angezeigt: Der Reiter „Mein Raum“ ist ausgegraut, Aufrufe leiten in den Reiter „Teilnehmende“. Dort erfolgt die gesamte Steuerung (Anwesenheit, Anmelde-/Verbindungsstatus, Status, Zeitgutschrift, Details, Entfernen) mit Suche, Statusfilter und Seitenaufteilung. Die Grenze von 40 entspricht etwa dem größten üblichen Klassen- bzw. Prüfungsraum (`PLAN_MAX` in `js/views/proctor.js`).

## Raumaufsicht: Teilnehmende entfernen

Im Reiter „Teilnehmende“ lassen sich Teilnehmende **einzeln** (Papierkorb in der Zeile), als **Auswahl** oder als **ganze Gruppe** (Klasse/Kurs, „Gruppe entfernen“) wieder aus der Raumaufsicht entfernen. Jede Entfernung wird protokolliert.

## Fenster und Taskleiste (Prüfling)

- Jede geöffnete E-Mail, jeder Entwurf und jede Notiz öffnet ein **eigenes Fenster**. Fenster lassen sich verschieben, in der Größe ändern, maximieren und schließen.
- **Klick außerhalb** eines Fensters (Aufgabe, Kopfzeile, freie Fläche) minimiert alle sichtbaren Fenster. Sie bleiben in der Taskleiste.
- Dialoge (z. B. „Als Abgabe markieren“, „Neuer Termin“) liegen immer **vor** den Fenstern. Ebenen: Seite < Taskleiste < Fenster < Dialoge < Menüs < Hinweise < Sperrbildschirm.
- **Aufgabenspezifische Materialien:** E-Mails, Dateien, Termine, Tickets und Code gehören jeweils zu einer Aufgabe (`data.task`). Die Werkzeuge zeigen immer die Inhalte der geöffneten bzw. zuletzt geöffneten Aufgabe. Fenstertitel tragen die Aufgabe, neu angelegte Elemente werden ihr zugeordnet. Die Abgabe-Auswahl bietet nur Teilaufgaben dieser Aufgabe an.
- **Aufgaben sind voneinander unabhängig:** Jede Aufgabe hat eigene Fenster (inkl. Rechner-Verlauf und IDE-Konsole). Beim Wechsel werden die Fenster der anderen Aufgabe ausgeblendet und beim Zurückkehren wiederhergestellt. Auf **Dashboard und Abgaben** sind alle Anwendungen in der Taskleiste ausgegraut und lassen sich nicht öffnen.
- **Ticketsystem** (jede Aufgabe mit eigenen Tickets, Schwerpunkt Aufgabe 3, neue Tickets anlegbar): Ticketliste mit Priorität und Status, Ticketfenster mit Anfrage, Verlauf, Status und Lösungsfeld. Tickets werden wie andere Elemente als Abgabe markiert und in der Korrektur dargestellt.
- **Automatische Zwischenspeicherung** aller Freitexte: E-Mail-Entwürfe, Notizen und Ticket-Lösungen alle 15 s, beim Verlassen oder Minimieren eines Fensters und beim Schließen. Der Code in der IDE wird bei jeder Eingabe gespeichert. In der Korrektur werden Begründungen (15 s, beim Verlassen) und Kommentar-Entwürfe gesichert.
- **E-Mail-Anlagen**: Anhänge empfangener E-Mails werden beim Login automatisch unter „Eigene Dateien › E-Mail-Anlagen“ abgelegt und lassen sich dort unabhängig von der E-Mail öffnen, herunterladen, anhängen oder als Abgabe markieren. Anhänge in einer E-Mail sind anklickbar.
- **Signaturen**: Im Verfassen-Fenster fügt „Signatur einfügen“ eine Signatur ein; für jede Ausgangssituation (Aufgabe) sind passende Signaturen hinterlegt (vollständig und kurz, `EXAM.signatures` in `js/scenario.js`).
- **Anhang einer Abgabe austauschen**: In den Abgaben lässt sich bei einer als Abgabe markierten E-Mail **nur der Anhang** durch eine neuere Datei ersetzen (vorhandene eigene Datei oder neuer Upload); der E-Mail-Text bleibt unverändert, der Austausch wird protokolliert.
- **Direkte Dateiabgabe**: Teilaufgaben mit Dateiabgabe (Beispiel 2.3 Nachkalkulation) haben in der Aufgabe ein Upload-Feld (auch per Ziehen und Ablegen). Die Datei wird direkt als Abgabe gespeichert, ohne Umweg über „Eigene Dateien“; ersetzen und entfernen sind möglich.
- **ERP-System** (vereinfacht, je Aufgabe eigene Daten): Artikel mit Lagerbestand, Melde- und Höchstbestand, Lieferanten und Bestellungen. Bestellvorschlag = Höchstbestand − Bestand bei Unterschreiten des Meldebestands. Eigene Lieferanten und Bestellungen können als Abgabe markiert werden und erscheinen in der Korrektur als Beleg. **Finanzbuchhaltung**: Reiter „Buchungen“ mit zu buchenden Belegen (Eingangs-/Ausgangsrechnung, Kassenbeleg) und **Buchungssätzen** – ein- oder mehrteilig (z. B. „6000 Aufwendungen für Rohstoffe 1.880,00 € / 2600 Vorsteuer 357,20 € an 4400 Verbindlichkeiten 2.237,20 €“) mit Prüfung Soll = Haben; Reiter „Kontenplan / Salden“. Buchungssätze lassen sich als Abgabe markieren und erscheinen in der Korrektur als Soll/Haben-Tabelle.
- **Echte Beispieldateien**: Bereitgestellte Materialien und E-Mail-Anlagen (Angebote, Vorlagen, Preisliste, Netzplan) sowie die Beispielabgaben (PDF, Word, Excel) liegen unter `pb_public/samples` (erzeugt mit `tools/make-samples.py`).
- **Textmarkierung in E-Mails**: Text in einer erhaltenen E-Mail auswählen und gelb, grün oder rot markieren; mehrere Passagen unabhängig voneinander, „Markierung entfernen“ und „Alle Markierungen löschen“. Die Markierungen bleiben während der Prüfung erhalten und werden nicht bewertet.
- **Echte Datei-Uploads** (bis 20 MB) in „Eigene Dateien“ mit Vorschau (Bild, PDF, Text) und Download.
- Die Aufgabenseite zeigt alle **Werkzeuge** inkl. Ticketsystem, Entwicklungsumgebung und Taschenrechner als Kacheln. Die Navigation ist auf Dashboard und Aufgabenseiten einklappbar und überdeckt beim Scrollen keine Inhalte.
- Punkte unter einem Taskleisten-Symbol zeigen die offenen Fenster, eine Zahl steht für mehrere Fenster. Bei mehreren Fenstern einer Kategorie öffnet ein Klick eine **Auswahlliste** (wiederherstellen, alle minimieren, alle schließen, neues Fenster).
- **Taschenrechner** mit Verlauf und Tastatureingabe.
- **Entwicklungsumgebung (IDE)** mit Projektdateien, Tabs, Zeilennummern, Auto-Einrückung und Konsole. JavaScript wird im Browser ausgeführt (isolierter Worker, 3 s Zeitlimit). Python wird **vereinfacht simuliert**: def, if/elif/else, for, while, return, print und f-Strings werden nach JavaScript übersetzt. Code-Dateien werden wie alle anderen Elemente als Abgabe markiert und in der Korrektur mit Zeilennummern angezeigt.

## Randkorrektur und Stifteingabe (Korrektur)

| Rolle | Farbe | Position der Korrekturzeichen |
|---|---|---|
| Erstkorrektur | rot | rechter Rand |
| Zweitkorrektur | grün | linker Rand |
| Drittkorrektur (Endbeurteilung) | braun | linker Rand, außen |

- Werkzeuge: Auswählen, Korrekturzeichen (Favoriten + Kategorien), **Unterstreichen** horizontal (einfach / doppelt / gekringelt), **vertikaler Randstrich**, Stift, Radierer, Zoom. Löschen mit Entf oder über den Papierkorb. Markierungen aller vorhandenen Korrekturen werden immer angezeigt, bearbeiten lassen sich nur eigene.
- Randzeichen bestehen **nur aus dem Zeichen** (ohne Rahmen). Mehrere Zeichen auf derselben Zeile stehen **kommasepariert nebeneinander**; ein Umbruch erfolgt erst, wenn die Randbreite voll ist. Das Papier passt sich automatisch der Breite an, sodass beide Korrekturränder sichtbar sind.
- Bei Korrekturzeichen wird **an der Textstelle selbst nichts dargestellt**, nur das Zeichen am Rand (auch bei per Stift erkannten Zeichen). **Klick auf ein Randzeichen** (oder Enter) hebt die markierte Stelle kurz farbig hervor und zeigt eine Verbindungslinie – auch in Vergleich und Prüfungseinsicht.
- **Dateiupload durch Korrigierende** (z. B. Korrekturbogen, Nebenrechnung): wird je Prüfling und Teilaufgabe gespeichert (`kfiles`), ist für alle Korrigierenden sichtbar und herunterladbar, eigene Dateien lassen sich löschen.
- **Bewertungsbereich einklappen**: über die Leiste „Bewertungsansichten“. „Maximieren“ blendet zusätzlich die Navigation aus.
- **Vergleichen** öffnet die Arbeit eines anderen Prüflings zur selben Teilaufgabe **schreibgeschützt in einem neuen Tab**.
- **Tablet-Ansicht** (Tablet-Symbol, oder automatisch bei Stifteingabe): größere Bedienelemente, Bewertung als ausklappbares Seitenpanel, Papier passt sich der Breite an. Mit dem Finger verschiebt man das Dokument (Handballenerkennung), der Stift schreibt.
- **Stiftgesten**: waagerechter Strich = unterstreichen, zwei Striche = doppelt, Wellenlinie = unterkringeln, senkrechter Strich = Randstrich.
- **Handschrift** (Erkennung Version 2): Geschriebene Korrekturzeichen werden in Buchstaben zerlegt, jeder Buchstabe wird gegen mehrere Schreibweisen geprüft ($P-Point-Cloud-Verfahren) und das Ergebnis mit der Liste der **zulässigen Korrekturzeichen** abgeglichen (auch zusammenhängend geschriebene Buchstaben, Plausibilität von Ober-/Unterlängen). Eigene Zeichen werden nicht angenommen.
  - **Sicher erkannt**: Das Zeichen wird gesetzt; ein kleines Fenster zeigt das Ergebnis mit Alternativen und „Rückgängig“.
  - **Unsicher**: Statt einer Ablehnung erscheinen die vier wahrscheinlichsten Zeichen zur Auswahl.
  - **Lernen**: Jede Auswahl bzw. Korrektur wird als persönliche Schriftprobe gespeichert. Über **„Einlernen“** (neben dem Stift) schreibt man jedes Zeichen ein- bis zweimal vor. Die Proben gelten je Korrekturrolle (max. 5 je Zeichen) und lassen sich löschen.
  - Messung mit einer unabhängigen, simulierten Testhandschrift (eigene Buchstabenformen, Neigung, Zittern, Schreibschrift; 540 Proben): richtig erkannt 95,7 % (vorher 86,3 %), richtiges Zeichen unter den ersten drei 99,8 %, automatisch übernommen 80 % (vorher 67 %) bei 0,2 % Fehlübernahmen, kein Gekritzel angenommen. Mit zwei eingelernten Proben je Zeichen steigt die automatische Übernahme auf rund 92 %. Echte Handschrift kann davon abweichen.

## Ablauf und Prüfungsende

- **Kein hartes Ende bei Zeitablauf:** Ist die Bearbeitungszeit (inkl. Nachteilsausgleich und Zusatzzeit) abgelaufen, wechselt der Status auf „Bearbeitungszeit beendet“. Die Prüfung läuft weiter. Der Timer zeigt die Überziehung (+mm:ss). Die **zuletzt bearbeitete Aufgabe** kann abgeschlossen werden (inkl. Abgaben markieren und Werkzeuge), **neue Aufgaben lassen sich nicht mehr öffnen**. Sie sind in der Navigation gesperrt, ein direkter Aufruf wird abgefangen. Gibt die Aufsicht Zusatzzeit, werden die Aufgaben wieder freigegeben. Beides wird protokolliert.
- **Prüfling „Prüfung beenden“:** Der Prüfling gibt selbst ab (Status „abgegeben“). Für ihn ist die Bearbeitung damit beendet, er kann nicht mehr weiterarbeiten.
- **Finales Ende nur durch die Raumaufsicht:** „Prüfung einsammeln“ (einzeln oder gesammelt, auch für abgegebene Prüfungen) bzw. „Prüfung beenden“ für den ganzen Raum.
- **Verbindungsabbruch:** Während des Abbruchs ist der Bildschirm gesperrt (keine Bearbeitung möglich). Nach der Wiederherstellung geht es automatisch weiter, ohne erneute Anmeldung. Abbruch und Wiederherstellung inkl. Dauer werden protokolliert.
- **Pause und Sperre:** Der gesamte Bildschirm des Prüflings wird blickdicht ausgeblendet (Kopfzeile, Aufgabe, Fenster, Taskleiste). Inhalte dahinter sind nicht bedienbar (`inert`).

## Anmelde- und Verbindungsstatus (Raumaufsicht)

| Anzeige | Bedeutung |
|---|---|
| angemeldet · verbunden | Prüfling angemeldet, Lebenszeichen (Heartbeat alle 10 s) innerhalb der letzten 30 s |
| angemeldet · keine Verbindung | angemeldet, aber seit über 30 s kein Lebenszeichen oder Browser geschlossen (wird sofort gemeldet) |
| angemeldet · Verbindung unterbrochen | simulierter Abbruch läuft (Restdauer im Tooltip) |
| nicht angemeldet | hat sich noch nicht angemeldet |

Ein **Nachteilsausgleich** kann nur **vor dem Prüfungsstart** gewährt oder geändert werden; danach ist das Feld ausgegraut (zusätzlich serverseitig abgesichert). Für Störungen während der Prüfung dient die Zusatzzeit. Zeitgutschriften werden getrennt ausgewiesen: **NTA** (Nachteilsausgleich, blau), **Zusatzzeit** (individuell, gelb) und **Raum** (Zusatzzeit für alle, grau). Die Tabelle „Teilnehmende“ ist kompakt und passt ohne horizontales Scrollen in die Ansicht.

## Prüfungssicherheit

- Ist „Vollbildmodus erzwingen“ aktiv (Raumaufsicht › Reiter Prüfung, Standard in Raum 123), startet die Bearbeitung erst im Vollbild. Nach dem Verlassen des Vollbilds erscheint wieder die Aufforderung. Im Klickdummy lässt sich das für Demos überspringen.
- Tab- oder Fensterwechsel, Minimieren und Schließen des Browserfensters werden **nicht protokolliert** (fachliche Vorgabe). Das Schließen des Browsers wirkt sich nur auf die Verbindungsanzeige der Raumaufsicht aus.

## Prüfungsprotokoll (PDF)

Das Prüfungsprotokoll gibt es **nur bei Prüfungen** (nicht im Unterricht). Der Download ist **erst nach Beendigung der Prüfung** möglich. „Protokoll herunterladen (PDF)“ im Reiter Prüfungsprotokoll erzeugt lokal im Browser ein PDF (jsPDF) mit:
1. **Angaben zur Prüfung**: Prüfung, Raum, geplanter und tatsächlicher Start, Startfenster, Bearbeitungszeit, Bearbeitungsende, Pausen, Status, Vollbildmodus, Teilnehmende, Nachteilsausgleich und Zusatzzeiten
2. **Raumaufsichten**: je Aufsichtsperson eine Zeile mit Kürzel, Anwesenheit, **allen Aufsichtszeiträumen** und **einem Unterschriftsfeld** (mehrere Zeiträume bei Aufsicht mit Unterbrechung, festzulegen im Reiter „Aufsichtspersonen“ › „Zeiträume festlegen“; Überschneidungen werden abgelehnt), zusätzlich Ort/Datum und Unterschrift Prüfungsleitung
3. **Sitzplan** (Reihe-Platz, Name, Status, Tafel)
4. **alle Protokolleinträge** (Vorkommnisse rot hervorgehoben), mit Seitenzahlen

## Demo im Wartebereich

„Demo starten“ öffnet eine Klickstrecke in elf Schritten an einer verkleinerten Nachbildung des Prüfungsmodus: Kopfzeile, Dashboard, Navigation, gesperrte Taskleiste, Aufgabe und Arbeitsauftrag, Fenster, Ergebnis erstellen, als Abgabe markieren, Abgaben prüfen, Pause/Verbindungsabbruch, Zeitablauf und Prüfung beenden. Der jeweils anzuklickende Bereich ist markiert, alternativ „Weiter“ oder Pfeiltasten. Die Demo startet nur per Klick.

## Dateien im Korrekturscreen

- **PDF-Dateien** (hochgeladen von Teilnehmenden oder von der Korrektur) werden seitenweise direkt im Korrekturbereich angezeigt und lassen sich wie Text mit Randzeichen, Unterstreichungen und Stift korrigieren.
- **Office-Dateien** (Word, Excel) werden beim ersten Öffnen im Browser automatisch in eine **PDF-Korrekturfassung** umgewandelt (Text, Überschriften und Tabellen). Diese wird gespeichert, für alle Korrigierenden genutzt und ist korrigierbar. Bilder werden direkt angezeigt.
- **E-Mail-Anhänge** einer Abgabe werden unterhalb der E-Mail ebenso dargestellt.
- **„Hochgeladene Dateien“** unterscheidet: **Originaldateien der/des Teilnehmenden** (Badge „Original · Format“, Herkunft: eigene Dateien, direkte Abgabe oder E-Mail-Anhang) – immer **im Originalformat herunterladbar** –, die daraus erzeugte **PDF-Korrekturfassung** sowie **Dateien der Korrektur** (mit Korrekturstufe).

## Korrektorengruppen (Prüfung)

- Im Kurs der Prüfung, Reiter **„Korrektoren“**, weist die Schuladministration je Korrekturstufe (Erst-, Zweitkorrektur, Endbeurteilung) eine **Gruppe aus einer oder mehreren Korrektor:innen** zu – für eine **Klasse/einen Kurs** (gilt für alle zugehörigen Prüflinge) oder für **einzelne Prüflinge** (Einzelzuweisung hat Vorrang). Gruppen gelten nur für diese Prüfung; dieselben Personen dürfen in mehreren Stufen sein (ohne Warnung). Mitglieder lassen sich über „Bearbeiten“ austauschen oder entfernen, erteilte Freigaben bleiben erhalten.
- Alle Mitglieder sehen die **gesamte Leistung** und erfassen **eine gemeinsame Bewertung** je Stufe; die Aufteilung regelt die Gruppe selbst.
- **Gruppenfreigabe**: Die Bewertung ist **final**, sobald alle Mitglieder freigegeben haben; angezeigt wird der aggregierte Stand („1 von 2 freigegeben“). Bis dahin kann jedes Mitglied seine Freigabe zurückziehen – nicht mehr nach der letzten Freigabe oder nach dem Ende des Korrekturzeitraums (im Reiter „Korrektoren“ einstellbar). Finale Bewertungen sind schreibgeschützt.

## Ergebnisse und Prüfungseinsicht

- **Ergebnisübersicht** (Navigation „Ergebnisse“, rechtebasiert): je Prüfling Name, Vorname, Anmeldename, **Punkte und Note der Erstkorrektur, Zweitkorrektur und Endbeurteilung** sowie die **Gesamtnote**; dazu Kennzahlen, Notenspiegel, Aufgabenstatistik und **CSV-Export**. Die Schuladministration sieht alle Prüflinge ihrer Schule mit allen drei Korrekturstufen, Korrektor:innen nur die Prüflinge ihrer Korrektorengruppen, Lehrkräfte die Teilnehmenden ihres Unterrichts. Änderungen der Korrektur erscheinen sofort.
- **Noten**: linearer Notenschlüssel bezogen auf die Maximalpunktzahl – Note = 6 − 5 · Punkte / Maximalpunkte, auf eine Nachkommastelle zugunsten des Prüflings abgerundet. Bei 100 Punkten entspricht das exakt der Tabelle „Notenschlüssel 100 P“ (geprüft gegen alle Werte der Vorlage, auch für 60 bzw. 50 Punkte); „Notenschlüssel“ zeigt die Tabelle für eine wählbare Maximalpunktzahl.
- **Gesamtnote**: Mittelwert der Noten aus Erst- und Zweitkorrektur (auf eine Nachkommastelle abgerundet). Ist eine Endbeurteilung angefordert, gilt deren Note. Im Unterricht gibt es nur eine Korrektur.
- **Drittkorrektur**: Weichen die Noten aus Erst- und Zweitkorrektur um mindestens die eingestellte Schwelle ab (Standard 1,0 Notenstufen, im Reiter „Korrektoren“ einstellbar), wird die Zeile hervorgehoben und „Drittkorrektur empfohlen“ angezeigt. Die **Entscheidung trifft die Schuladministration** („anfordern“ bzw. „zurücknehmen“); erst dann erhält die Korrektorengruppe der Endbeurteilung Zugriff auf den Prüfling.
- **Prüfungseinsicht (Prüfung)**: Es gibt **keine Freigabe** und **keinen eigenständigen Zugriff** für Prüflinge – auch nicht per Direktaufruf. Die Einsicht findet **immer in Präsenz** statt: Eine Person mit der Rolle **„Prüfungseinsicht“** (Kursmitglied der Prüfung, Prüfungen › Mitglieder) meldet sich an (Startseite › Prüfungseinsicht), wählt einen Prüfling ihrer Schule mit abgeschlossener Prüfung und beginnt die Einsicht nach einer Bestätigung (Prüfling anwesend, Begleitung während der gesamten Einsicht). Gezeigt werden **nur die Endnote und die Abgabe inkl. Korrekturzeichen** – keine Punkte je Teilaufgabe, Begründungen, Bemerkungen, Kommentare oder Erwartungshorizont. Eine Leiste zeigt die begleitende Person; Beginn und Ende werden im Prüfungsprotokoll festgehalten. Demo: Thea Riedmüller (AFS), Niklas Dähne (BTS). Lehrkräfte und Schuladministration sehen weiterhin die vollständige Einsicht in den Ergebnissen.
- **Korrektur und Ergebnis (Unterricht)**: Die Lehrkraft gibt die Korrektur **je Durchführung** frei (Ergebnisse › „Freigabe der Korrektur für die Schüler:innen“, `rooms.released`). Schüler:innen sehen anschließend **nur ihre eigenen** Ergebnisse: Punkte je Teilaufgabe, Note, Begründung und Korrekturzeichen. Demo: „Klassenarbeit HTML · Probelauf“ (Brockmann, Reinholz, Thamm) ist korrigiert und freigegeben.

## Erstellungsprozess einer Prüfung (Instanz OPE)

Prüfungen entstehen ausschließlich im Erstellungsprozess (Navigation **„Erstellung“**, Startseite › Prüfungserstellung mit Personenwahl) – **der Katalog enthält nur Inhalte für den Unterricht**. Status: **Vorbereitung → Kommission/Review → Lektorat und Prüflösen → Review → Verschlüsselt (final freigegeben, weggesperrt) → Begutachtung durch die Schulen → Prüfungsstart**.

| Rolle | Aufgaben (Task) | Status |
|---|---|---|
| Koordinierungsstelle (Lisette Brandauer, Malin Tessendorf) | Prüfung anlegen (38), Rahmendaten und Prüfungsrumpf (2/3), Personen zuweisen (4/5), Unternehmenspool (14, gemeinsam mit der Kommission), **Organisationen zuordnen nach der finalen Freigabe** (47), Verlauf (6), Freigabe aufheben (8), Fehlerbehebung vor Prüfungsbeginn (50), **Stammdaten** | alle |
| Aufgabenerstellung | Aufgaben im Editor erstellen, an die Kommission übergeben (46, Nr. 1) | Vorbereitung |
| Kommission (als **Gruppe** des Fachbereichs gewählt) | Unternehmenspool wählen oder neu anlegen (14), Entwürfe einarbeiten und weiterreichen (15, Nr. 3), Anmerkungen einarbeiten, Fehlerbehebung vor Prüfungsbeginn (49) | Vorbereitung, Review, Begutachtung |
| Kommissionsvorsitz (automatisch der Vorsitz der Kommissionsgruppe) | final freigeben → **Verschlüsselung** (12, Nr. 5) | Review |
| Beratung, Lektorat, Prüflösung (optional) | Entwürfe einsehen (16), lektorieren (17), im Teilnahmemodus prüflösen (18) | Vorbereitung/Review bzw. Lektorat |
| Schuladministration und Korrektor:innen der teilnehmenden Schulen | **Prüfungsbegutachtung vor Prüfungsstart** (48) – Fehler werden außerhalb des Portals gemeldet | Begutachtung |

- **Neue Prüfung**: Ausbildungsberuf aus den Stammdaten wählen – **nach Ausbildungsberuf oder nach Berufsnummer** (mit Suche) –, dazu einen der für den Beruf hinterlegten **Prüfungstitel**, optional den Prüfungszeitraum und das **Prüfungsjahr**. Daraus entsteht der Titel (z. B. „Abschlussprüfung Teil 1 – Informationstechnisches Büromanagement 2027“); Fachbereich und Berufsnummer werden übernommen.
- **Kommission übernimmt die Aufgabenerstellung** (Auswahlfeld beim Anlegen bzw. in den Rahmendaten während der Vorbereitung): keine Rolle Aufgabenerstellung, Start direkt im Status **Kommission/Review**; Start und Ende des Erstellungszeitraums sind keine Pflichtfelder.
- **Statuswechsel überall sichtbar**: Die Leiste **„Nächste Schritte“** steht im Kopf jeder Seite der Prüfung (alle Reiter) und im **Editor** – z. B. „An die Kommission übergeben“, „An Lektorat und Prüflösung übergeben“, „Final freigeben“, „Lektorat abschließen“. Im Editor wird vor einem Statuswechsel automatisch gespeichert. Auch die Übersicht „Prüfungserstellung“ bietet je Prüfung den nächsten Schritt direkt an.
- **Datenschutz (DSGVO) – wer sieht was?**

  | Information | sichtbar für |
  |---|---|
  | Personen im Erstellungsprozess (Reiter „Personen“) | nur Koordinierungsstelle (die zuordnende Stelle) |
  | Namen der Aufgabenerstellung | Koordinierungsstelle und die Aufgabenerstellung untereinander – **nicht** die Kommission |
  | Namen von Kommission und Vorsitz | Koordinierungsstelle und die Kommission untereinander |
  | Namen von Beratung, Lektorat, Prüflösung | nur Koordinierungsstelle (und die Person selbst) |
  | Rahmendaten und Prüfungsrumpf | Koordinierungsstelle (bearbeitet), Kommission, Vorsitz, Beratung, Lektorat, Prüflösung (lesend) – **nicht** die Aufgabenerstellung |
  | Unternehmenspool | Koordinierungsstelle und Kommission (alle Pools des Fachbereichs); die Aufgabenerstellung **nur den ausgewählten Pool** |
  | Anmerkungen | Koordinierungsstelle und Kommission/Vorsitz (ohne Namen der Verfassenden); Beratung, Lektorat, Prüflösung nur ihre eigenen |
  | Verlauf | nur Koordinierungsstelle; Einsichtnahmen im Rahmen der Begutachtung werden **nicht** protokolliert |
  | Organisationen | nur Koordinierungsstelle; eine Schuladministration sieht nur ihre eigene Schule (keine anderen beteiligten Schulen, keine Schuladministrationen oder Personen anderer Schulen) |

- **Gleichzeitige Bearbeitung**: Mehrere Personen können eine Prüfung zugleich bearbeiten. Gesperrt wird jeweils der Bereich, an dem jemand arbeitet – im Editor je **Aufgabe** (mit Teilaufgaben) bzw. die Reiter „Allgemein“, „Notenschlüssel und Kategorien“, „Aufgabensteuerung“, in der Prüfung die **Rahmendaten**. Andere sehen den Hinweis „Gesperrt … wird gerade von … bearbeitet“ und den gespeicherten Stand nur lesend. Den Namen sehen nur Personen, die sich kennen dürfen (Aufgabenerstellung untereinander, Kommission untereinander, Koordinierungsstelle). Beim Speichern werden nur die eigenen Bereiche übernommen; Änderungen anderer bleiben erhalten. Sperren werden laufend erneuert und verfallen 90 Sekunden nach Verlassen. Testen: zwei Fenster, z. B. Thea Riedmüller und Lina Voigt (Aufgabenerstellung) bzw. Lisette Brandauer und Malin Tessendorf (Rahmendaten).
- **Unternehmenspools** gehören zu einem **Fachbereich** und sind nur für Prüfungen dieses Fachbereichs wählbar. Koordinierungsstelle (Stammdaten bzw. in der Prüfung) und Kommission (in der Prüfung) legen neue Pools an; passt kein vorhandener, wird für die Prüfung ein neuer angelegt und direkt ausgewählt. Ohne Unternehmenspool ist keine finale Freigabe möglich.
- **Kommissionen**: Gruppen der Koordinierungsstelle mit Fachbereich („Prüfungskommission Büromanagement“, Vorsitz Ayla Steinhoff; „Prüfungskommission IT-Berufe“, Vorsitz Emil Gaspari). Zur Auswahl stehen die Kommissionen des Fachbereichs der Prüfung; ihr Vorsitz wird automatisch Kommissionsvorsitz.
- **Verschlüsselung**: Mit der finalen Freigabe werden Inhalt und Aufgabensteuerung mit **AES-256-GCM** (WebCrypto) verschlüsselt; im Datensatz bleibt nur ein Platzhalter mit Fingerabdruck (SHA-256). Niemand kann den Inhalt einsehen oder bearbeiten. Im Klickdummy liegt der Schlüssel in einem eigenen Feld; produktiv gehört er in eine Schlüsselverwaltung mit zeitgesteuerter Freigabe.
- **Organisationen erst nach der finalen Freigabe**: Im Status „Verschlüsselt“ bzw. „Begutachtung“ wählt die Koordinierungsstelle die Schulen mit **Suche** (Name, Kürzel, Ort) und Filter **„nur Schulen mit dem Ausbildungsberuf der Prüfung“**. Welche Schule welche Berufe hat, ist in den Stammdaten hinterlegt. Die Schuladministrationen werden automatisch hinzugefügt und organisieren die Prüfung (Teilnehmende, Raumaufsichten, Korrektoren); den Inhalt sehen sie erst im Begutachtungszeitraum.
- **Prüfungsrumpf (Durchführungskonfiguration)**: Prüfungstermin, Bearbeitungszeit und **Vorlauf der Begutachtung** (2, 12, 24, 48 oder 72 Stunden vor Prüfungsstart). Zum Beginn des Vorlaufs wird die Prüfung automatisch entschlüsselt und für Schuladministration und Korrektor:innen der teilnehmenden Schulen zur Begutachtung freigeschaltet; zum Prüfungsstart wird der Inhalt für die Durchführung freigegeben. Demo-Schaltflächen der Koordinierungsstelle simulieren beide Zeitpunkte.
- **Fehlerbehebung**: Im Begutachtungszeitraum können Koordinierungsstelle, Kommission und Vorsitz bis zum Prüfungsstart im Editor korrigieren. Die Korrektur wird beim Speichern **direkt freigegeben** (Version 2, 3 …), ohne erneuten Freigabeprozess.
- **Klickstrecke „Prüfungserstellung bis Prüfungsstart“** auf der Startseite: alle Schritte mit automatischem Personenwechsel.

## Stammdaten (Koordinierungsstelle)

Navigation **„Stammdaten“** (nur Koordinierungsstelle):
- **Ausbildungsberufe**: Berufsnummer (Demowerte), Bezeichnung, Fachbereich und die **Prüfungstitel** der möglichen Prüfungen; Suche nach Name oder Nummer.
- **Schulen**: Matrix Schule × Ausbildungsberuf – Grundlage für die Auswahl der Organisationen einer Prüfung. Im Klickdummy sind zehn fiktive Schulen angelegt.
- **Unternehmenspools** je Fachbereich anlegen und bearbeiten.
- **Korrekturzeichensätze**: Zeichensätze anlegen, duplizieren, bearbeiten (Gruppen, Kürzel, Bedeutung) und einen als **verbindlich** festlegen. Er gilt sofort **einheitlich in allen Instanzen** – Erstellung, Prüfung (Erst-, Zweit-, Drittkorrektur) und Unterricht; Favoriten der Korrektor:innen werden daraus gewählt. Kürzel aus Buchstaben mit Schreibvorlage werden per Stift erkannt, andere stehen über die Auswahl zur Verfügung.
- **Fachbereiche** (Kaufmännische Berufe, IT-Berufe, Gewerblich-technische Berufe).

## Katalog und Unterricht

- **Globale Freigabe**: Die Bereichsadministration pflegt die Katalogeinträge (Editor) und gibt sie **global** frei; Entwürfe sind für Lehrkräfte unsichtbar. Die Freigabe kann wieder beendet werden.
- **Eigene Inhalte der Lehrkraft**: „Neuen Inhalt erstellen“ legt ein eigenes Unterrichtsmaterial an (wahlweise gleich mit Unterricht). Beim **Kopieren** aus dem Katalog entsteht eine **eigene Kopie** des Inhalts, die im Editor bearbeitet werden kann („Inhalt bearbeiten“ im Unterricht, Reiter „Eigene Inhalte“ im Katalog); der Katalogeintrag bleibt unverändert. Die **Mitbetreuung** eines Unterrichts kann den Inhalt ebenfalls bearbeiten.
- **Freigabe für die eigene Schule**: Eine Lehrkraft kann eigenes Material in den Katalog stellen – sichtbar nur für Lehrkräfte ihrer Organisation (Reiter „Meine Schule“). Nur der Einsteller kann die Freigabe beenden. Für andere Schulen sind solche Inhalte weder im Katalog noch per Direktaufruf (Vorschau, Editor) erreichbar.

## Testdaten

Für alle Rollen sind Daten vorhanden, u. a.: Prüfungen im Erstellungsprozess in den Status Vorbereitung (mit Aufgabenerstellung und Beratungshinweis) und Kommission/Review (Kommission erstellt die Aufgaben, IT-Berufe), eine **abgeschlossene Prüfung mit Ergebnissen** („Zwischenprüfung Büromanagement Sommer …“, Raum 202 an der AFS und Raum 110 an der BTS, Erst- und Zweitkorrektur freigegeben) für **Ergebnisse und Prüfungseinsicht** an beiden Schulen (Prüfungseinsicht: Marit Hinrichs, Thea Riedmüller, Niklas Dähne, Ilka Ammermann), eigene Kopien und schulintern freigegebenes Material im Unterricht, ein noch nicht freigegebener Katalogentwurf, Konten und Belege im ERP.

## Prüfungseditor

Prüfungen und Unterrichtsinhalte (Lernerfolgskontrollen) werden im **Editor** erstellt. Zugang: im Erstellungsprozess je Rolle und Status (siehe oben), als **Bereichsadministration** für die Katalogeinträge, als **Lehrkraft** (und Mitbetreuung) für eigene Inhalte und eigene Kopien. Einstieg im Katalog über „Neuen Inhalt erstellen“ bzw. „Bearbeiten“ / „Im Editor bearbeiten“. Der Inhalt wird im Katalogeintrag gespeichert (`catalog.content`, Regeln in `catalog.rules`) und gilt für alle Kurse, die ihn nutzen.
- **Allgemein**: Titel, Art (Prüfung/Lernerfolgskontrolle), Beruf, Fach, Jahr, Bearbeitungszeit, Beschreibung, Ausgangssituation, Unternehmensprofil (Name, Profil, Adresse, Kontakt, Rechtliches, Vorlagen) und Prüfungsinformationen für das Dashboard.
- **Notenschlüssel und Kategorien** (einmalig je Inhalt): linearer Notenschlüssel, IHK-Notenschlüssel (92/81/67/50/30 %), Notenstufen Schule (85/70/55/40/20 %) oder eigene Prozentgrenzen; Kategoriensystem für die Kriterien (Kompetenzbereiche, Anforderungsbereiche AFB I–III, Handlungsphasen oder eigene Kategorien). Ergebnisse zeigen den Erreichungsgrad je Kategorie.
- **Aufgaben**: beliebig viele Aufgaben und Teilaufgaben (anlegen, sortieren, duplizieren, löschen) im Strukturbaum. Je Aufgabe: Titel, Ausgangssituation, **freigeschaltete Anwendungen** (Dateien, Mail, Kalender, Notizen, Tickets, ERP, Rechner, IDE – nur diese erscheinen bei den Teilnehmenden) und **bereitgestellte Materialien**: Dateien (Upload bis 2 MB oder Platzhalter), E-Mails mit Anhängen, Termine, Tickets, Code-Vorlagen, ERP-Artikel und -Lieferanten, **Konten und Belege** für die Finanzbuchhaltung.
- **Teilaufgaben**: Titel, **Fragetyp** – Bearbeitung mit Anwendung (E-Mail senden, Datei ablegen, Notiz, Termin, Ticket, Programmieren, ERP-Beleg), Datei-Upload in der Aufgabe, **Freitext**, **Kurzantwort**, **Single Choice**, **Multiple Choice** (mit Antwortoptionen und Lösung) –, Arbeitsauftrag, **Bewertungsraster** (Kriterien mit Maximalpunkten und Kategorie; die Punkte der Teilaufgabe ergeben sich daraus) und **Erwartungshorizont** (Erwartungen mit Punkten, **Bilder** mit Bildunterschrift).
- **Aufgabensteuerung**: Regeln mit Bedingungen (UND/ODER) und Aktionen, siehe unten.
- **Prüfen und speichern**: Vollständigkeitsprüfung (z. B. fehlender Arbeitsauftrag, Raster ohne Punkte, Horizont-Punkte ≠ Raster, nicht freigeschaltete Anwendung, Single Choice ohne genau eine richtige Antwort, Regeln mit ungültigen Bezügen) mit Sprung zur Stelle, Übersicht aller Aufgaben; **Vorschau** aus dem Editor (zurück mit „Zurück zum Editor“).
- **Durchführung**: Materialien werden beim ersten Login je Teilnahme bereitgestellt; Antworten zu Freitext/Kurzantwort/Choice werden in der Aufgabe erfasst, automatisch gespeichert und gelten als Abgabe. In der Korrektur erscheint die Antwort auf dem Korrekturpapier, bei Choice-Fragen mit automatischer Auswertung als Hinweis; der Erwartungshorizont zeigt Lösung und Bilder. Korrektur- und Ergebnisübersicht bieten bei mehreren Inhalten eine Auswahl „Inhalt“.
- Die **Musterprüfung FA230** lässt sich ebenfalls im Editor öffnen; beim ersten Speichern wird sie mit ihren Materialien als eigener Inhalt abgelegt.

## Aufgabensteuerung

Die Aufgabensteuerung **hängt fest an der Prüfung bzw. am Kurs** (Inhalt im Katalog, `catalog.rules`) und wird im **Prüfungseditor** (Reiter „Aufgabensteuerung“, mit Vorlagen) konfiguriert. Im Kurs zeigt der Reiter **„Aufgabensteuerung“** die Regeln nur schreibgeschützt.
- **Bedingungen** – *Aktion ausgeführt*: Aufgabe/Teilaufgabe geöffnet, Abgabe markiert, E-Mail gesendet, Termin/Ticket angelegt, Datei hochgeladen, Bestellung im ERP-System; *zeitliche Faktoren*: Minuten seit Bearbeitungsbeginn, keine Aktivität seit n Minuten, Minuten in einer Aufgabe, Restzeit ≤ n Minuten; *Bearbeitungsstand*: Fortschritt in Prozent, noch keine Abgabe zu einer Teilaufgabe, andere Regel ausgelöst.
- **Verknüpfung**: Bedingungen einer Gruppe mit **UND** bzw. **ODER**, Gruppen untereinander ebenfalls mit UND bzw. ODER.
- **Aktionen**: neue E-Mail, neuer Kalendertermin, neues Ticket (in einer gewählten oder der aktuellen Aufgabe) oder ein eingeblendeter Hinweis.
- Jede Regel löst je Teilnehmer:in **einmal** aus (`participants.fired`, Bearbeitungsstand in `participants.progress`) und wird im Prüfungsprotokoll vermerkt; in der Vorschau sind die Regeln nachvollziehbar. FA230: vier Beispielregeln (u. a. „Aufgabe 2 gestartet → E-Mail“, „3 Minuten ohne Aktivität → Erinnerung“), „Webentwicklung HTML/CSS“: zwei.

## Distanzunterricht

Beim Erstellen einer Raumaufsicht im Unterricht wählt die Lehrkraft **Präsenz** oder **Distanz**.
- **Distanz**: fester **Zeitraum** (von–bis) und Bearbeitungszeit; die Teilnehmenden entscheiden selbst, wann sie beginnen („Einheit jetzt starten“ nach Belehrung und Gesundheitsabfrage). Die Bearbeitungszeit endet spätestens mit dem Zeitraum, danach wird automatisch abgegeben. Es gibt **keine Steuerung durch die Lehrkraft** (kein Starten, Sperren, Pausieren oder Einsammeln) und keinen Sitzplan; die Lehrkraft sieht Status, Start und Durchlauf.
- Optionen: **mehrfach durchlaufbar** (z. B. zur Prüfungsvorbereitung; ein neuer Durchlauf ersetzt die bisherige Bearbeitung) und **Erwartungshorizont nach Abschluss anzeigen**.
- Demo: „WG12a · Übung zuhause (Distanz)“ (Zeitraum gestern bis in 6 Tagen; Nowak, Marquardt, Thierfelder, Nolting).

## Vorschau und Markierungen

- Die **Vorschau** aus einem Kurs (Lehrkraft bzw. Schuladministration) führt mit „Vorschau beenden“ zurück in den Kurs; ein Wechsel in den Katalog ist dort nicht vorgesehen. Je Teilaufgabe lässt sich der **Erwartungshorizont** einblenden.
- **Textmarkierungen** (gelb, grün, rot) sind außer in E-Mails auch im **Arbeitsauftrag** und in der **Ausgangssituation** möglich; sie bleiben je Prüfling gespeichert und werden nicht bewertet.
- Direkt in der Aufgabe hochgeladene Dateien liegen zusätzlich unter **Eigene Dateien › Dateiupload**.
- Tabellenzeilen (Raumaufsichten, Kurse) öffnen sich per Klick in die Zeile oder mit Enter.

## Schneller korrigieren

- **Bewertungsbausteine** (☰ neben jedem Kriterium): „vollständig / überwiegend / teilweise / kaum / nicht erfüllt“ setzen die Punkte und ergänzen die **Begründung**.
- **Tastenkürzel** (Übersicht mit `?`): `1`–`9` Favoriten-Zeichen, `U` Unterstreichen (mehrfach: einfach → doppelt → gekringelt), `V` Randstrich, `P` Stift, `E` Radierer, `S`/`Esc` Auswählen, `Entf` Löschen, `Alt`+`←/→` Prüfling wechseln, `N` nächste Teilaufgabe, `B` Bewertungsbereich, `Umschalt`+`F` maximieren, `+`/`−` Zoom.
- **Fortschritt**: „bewertet x/y“ je Teilaufgabe im Korrekturmodus und als Zeile in der Korrekturübersicht.

## Barrierefreiheit

- Fenster per Tastatur: `Alt`+`1`…`7` öffnet Dateien, Mail, Kalender, Notizen, Tickets, Rechner, IDE. `F6` wechselt zwischen Fenstern und Aufgabe, `Esc` minimiert das aktive Fenster. Beim Öffnen erhält das Fenster den Fokus.
- Menüs und Fensterauswahl mit Pfeiltasten. Dialoge halten den Fokus und geben ihn beim Schließen zurück.
- **ARIA-Live**: Restzeit-Ansagen bei 30, 15, 10, 5 und 1 Minute (berücksichtigt Nachteilsausgleich und Zusatzzeit), Toasts als Statusmeldungen, Fehler als Alert.
- „Zum Inhalt springen“-Link, sichtbare Fokusrahmen, beschriftete Schalter.

## Testfälle (Administration › Testfälle)

| Testfall | Wirkung |
|---|---|
| Großraum mit 120 Teilnehmenden | „Aula (Großraum)“: kein Sitzplan („Mein Raum“ ausgegraut), Steuerung im Reiter „Teilnehmende“ mit Suche, Statusfilter und Seitenaufteilung |
| Verbindungsabbruch | Prüfling 20 s offline (Hinweis im Prüfungsmodus), danach geht es **automatisch ohne erneute Anmeldung** weiter. Die Aufsicht sieht den Abbruch live, Abbruch und Wiederherstellung (mit Dauer) stehen im Protokoll. Auch über „Details › Testfälle“ in der Raumaufsicht |
| Nachteilsausgleich im Timer | +15 Min. NTA: Restzeit, Kopfzeile des Prüflings („inkl. 15 Min. Nachteilsausgleich“), Sitzplan |
| Bearbeitungszeit fast abgelaufen | Restzeit 2 Min.: Zeitansagen, danach Status „Bearbeitungszeit beendet“ (Prüfung läuft weiter, neue Aufgaben gesperrt) |

## Projektstruktur

```
pb_migrations/   Datenmodell (Collections) als PocketBase-Migration
pb_hooks/        Server-Hooks: Demodaten laden (seed.js), Fachregeln (rules.js), /api/demo/reset, /api/demo/simulate-login
pb_public/       Frontend (ohne Build-Schritt) – wird auf GitHub Pages veröffentlicht
  js/main.js     Einstieg: Passwortseite (gate.js), danach app.js
  js/config.js   Datenhaltung (auto/local/Server-URL) und Passwort-Prüfsumme
  js/seed-data.js Demodaten (gemeinsam für PocketBase und Browser-Modus)
  js/localdb.js  Browser-Datenbank (IndexedDB, Tab-Synchronisation) für statisches Hosting
  js/seats.js    Sitzordnungen (Reihen, versetzt, U-Form, Gruppentische) und Raumbelegung
  js/docs.js     PDF-Darstellung (PDF.js), Office-Vorschau und Umwandlung in PDF (mammoth, SheetJS, jsPDF)
  js/grades.js   Linearer Notenschlüssel, Gruppenfreigaben, Gesamtnote
  js/rules.js    Aufgabensteuerung: Bedingungen, Aktionen, Auswertung
  js/content.js  Aktiver Prüfungs-/Kursinhalt je Ansicht, Materialien, Inhaltsauswahl in Übersichten
  js/views/editor.js · ruleeditor.js  Prüfungseditor und Regeleditor
  js/views/creation.js  Erstellungsprozess (Status, Rahmendaten, Personen, Aufgaben je Rolle, Sichtbarkeit, Anmerkungen, Verlauf)
  js/views/stammdaten.js Stammdaten der Koordinierungsstelle
  js/masterdata.js Ausbildungsberufe, Fachbereiche, Unternehmenspools, Korrekturzeichensätze
  js/locks.js    Bearbeitungssperren bei gleichzeitiger Bearbeitung
  js/highlight.js Textmarkierungen in Arbeitsauftrag und Ausgangssituation
  samples/       Beispieldateien (Materialien, E-Mail-Anlagen, Beispielabgaben)
  css/app.css    Designsystem nach Figma (Gelb-Header, Rail, Tabs, Modals, Toasts, Status-Chips …)
  js/app.js      Router, Shells, Rollenwahl
  js/data.js     Backend-Erkennung, PocketBase-Client bzw. Browser-Datenbank, Realtime-Spiegel
  js/scenario.js Prüfungsinhalt (Szenario FunSport, Aufgaben, Kriterien, Erwartungshorizont, Korrekturzeichen)
  js/ink.js      Stiftgesten und Handschrifterkennung der Korrekturzeichen
  js/views/      participant.js · dock.js (Fenster, Taskleiste, Rechner, IDE) · proctor.js · correction.js · kmode.js (Korrekturmodus) · results.js (Ergebnisse, Einsicht) · rules.js (Aufgabensteuerung) · teacher.js
```

### Datenmodell (Collections)

`orgs` (Schulen), `persons` (Konten: Lehrkraft, Schüler:in, Schuladmin; `orgs` = weitere Schulen), `groups` (Klassen/Kurse der Schulverwaltung und eigene Gruppen), `courses` (Unterricht bzw. Prüfung mit Mitgliedern `[{ person, role, stage }]`, Gruppen, Gruppen und Korrektorengruppen), `venues` (Prüfungsräume je Schule, von der Schuladministration gepflegt), `rooms` (Raumaufsichten mit Kurs, Schule, Eigentümer, Sitzordnung `layout`/`capacity`/`cols`/`group_size` und ggf. realem Raum `venue`; Distanz: `mode`, `window_from`/`window_to`, `repeatable`, `show_horizon`; Freigabe der Korrektur `released`), `participants` (Teilnahmen, mit Person verknüpft), `supervisors`, `protocol`, `items` (Dateien inkl. Upload, Mails, Termine, Notizen, Tickets, Code und Abgabe-Markierungen je Prüfling, Zuordnung zur Aufgabe in `data.task`), `gradings` (Punkte, Korrekturzeichen, Begründungen und Freigabe je Korrektor), `kfiles` (Dateien der Korrigierenden), `comments`, `tasks` (Aufgabensteuerung), `catalog` (Prüfungs-/Kursinhalte inkl. Aufgabensteuerung `rules`, Katalogfreigabe `release` global/Organisation), `settings` (u. a. Stammdaten `berufe`, `fachbereiche`, `signsets`, Unternehmenspools `pool:<id>`, Bearbeitungssperren `lock:<Prüfung>:<Bereich>`); `orgs.berufe` (Ausbildungsberufe je Schule), `groups.fachbereich` (Kommissionen).

### Teilnehmenden-Status

`nicht_eingeloggt → wartend → wartend_bestaetigt → laeuft ⇄ pausiert/gesperrt → zeit_beendet (läuft weiter) → abgegeben (selbst beendet) → eingesammelt | beendet`, außerdem `nicht_teilnahme` (Gesundheitsabfrage nicht bestätigt).

## Anpassen

- **Prüfungsinhalt** ändern: `pb_public/js/scenario.js`. Bei geänderten Bewertungskriterien auch `CRITERIA` in `pb_hooks/seed.js` anpassen.
- **Demodaten** ändern: `pb_hooks/seed.js`, danach „Demo zurücksetzen“.
- **Layout/Farben**: CSS-Variablen am Anfang von `pb_public/css/app.css`.
- Änderungen am Frontend sind nach einem Neuladen im Browser sichtbar. Ein Neustart ist nur bei neuen Migrationen nötig. Die Startseite zeigt die Version; passt sie nicht zum Server, erscheint ein Hinweis zum Neuladen (Caching ist für die Oberfläche deaktiviert).
- **Nach einem Update** werden veraltete Demodaten beim Start automatisch neu aufgebaut (Stand `SEED_VERSION` in `pb_public/js/seed-data.js`, gilt auch für die Browser-Datenbank). Alle Skripte werden mit `?v=<Version>` geladen, sodass kein Browser-Cache alte Dateien liefert. Version setzen: `python3 tools/set-version.py <Version>`. Die aktuelle Version steht auf der Startseite und im Rollen-Knopf unten rechts.

## Bekannte Vereinfachungen

- Keine echte Anmeldung (IdAM). Person und Rolle werden pro Browser-Tab auf der Startseite gewählt; der Leitfaden einer Klickstrecke gilt für alle Tabs des Browsers.
- Annahme: Die Schuladministration sieht nur Raumaufsichten von **Prüfungen** ihrer Schule (Prüfungsebene), nicht die Unterrichts-Raumaufsichten der Lehrkräfte.
- Bereitgestellte Dateien sind Demo-Platzhalter ohne Inhalt. Hochgeladene Dateien werden echt gespeichert. Bearbeiten in Office-Anwendungen ist nicht möglich.
- Die Verbindungsanzeige basiert auf einem Heartbeat alle 10 Sekunden (Zeitlimit 30 s). Per Simulation angemeldete Teilnehmende gelten immer als verbunden.
- Python in der IDE ist eine Simulation (Übersetzung einfacher Sprachkonstrukte), keine vollständige Python-Laufzeit.
- Die Handschrifterkennung arbeitet regelbasiert mit Vorlagen und persönlichen Proben. Für den Produktivbetrieb empfiehlt sich zusätzlich ein mit echten Schriftproben vieler Korrigierender trainiertes Modell.
- Nicht umgesetzt: Breakpoint-Varianten > 100 Teilnehmende, Wizard „Unternehmensdaten“ und Anlegen neuer Prüfungen über „Erstellen“ (Hinweis-Toast).

## Lizenzen

PocketBase (MIT), PocketBase JS SDK (MIT), jsPDF und jsPDF-AutoTable (MIT), PDF.js (Apache 2.0), mammoth.js (BSD-2-Clause), SheetJS Community Edition (Apache 2.0), Lucide Icons (ISC), Noto Sans (SIL OFL 1.1). Alle Bibliotheken liegen lokal unter `pb_public/js/vendor` und werden erst bei Bedarf geladen.

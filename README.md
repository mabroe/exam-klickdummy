# CheckBW Klickdummy – Prüfungsplattform Bildschirmarbeitsplatz

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
| **Lehrkraft** (Unterrichtsebene) | Meine Aufgaben, Katalog, Prüfung als Unterricht kopieren, **Mein Unterricht** mit Mitglieder- und Gruppenverwaltung (Schüler:innen einzeln, Klassen/Kurse der Schulverwaltung, eigene Gruppen, weitere Lehrkräfte als Mitbetreuung), Raumaufsicht planen und durchführen, Korrektur | Exam-Lehrkraft, Task 31 / 32 / 33 / 35 / 36 |
| **Schuladministration** (Prüfungsebene) | **Prüfungen** der eigenen Schule: Teilnehmende (Personen/Klassen), Raumaufsichten, Korrektor:innen (Erst/Zweit/Dritt), Prüfungseinsicht – jeweils nur Personen der eigenen Schule; Raumaufsichten der Schule organisieren | Exam-Schuladministration, Task 52 / 24 / 21 / 23 / 28 |

## Konten, Schulen und Sichtbarkeit

Auf der Startseite meldet man sich als **konkrete Person** an. Zwei fiktive Schulen sind angelegt: **Ahornfeld-Schule (AFS)** und **Birkental-Schule (BTS)**. Alle Namen sind zufällig erzeugt.

| Person | Schule | Rolle im Demo |
|---|---|---|
| Amir Eggert | AFS | Lehrkraft, Besitzer „Zentrale Klassenarbeit HTML“ (Gruppe A in Reihen, Gruppe B in U-Form) |
| Ilyas Morawetz | AFS | Lehrkraft, eigener Unterricht (Gruppentische, versetzte Reihen) |
| Thea Riedmüller, Lina Voigt | AFS | Raumaufsichten der FA230-Prüfung (Raum 123) |
| Gesa Ohm, Ayla Steinhoff, Dr. Karim Ebeling | AFS | Erst-, Zweit-, Drittkorrektur FA230 |
| Marit Hinrichs | AFS | Schuladministration |
| Ilka Ammermann | BTS | Schuladministration (Raum 201, Aula) |
| Emil Gaspari, Niklas Dähne | BTS | Lehrkräfte / Raumaufsichten BTS |

**Räume und Sitzordnungen**
- **Unterricht:** Es wird **kein realer Raum** gebucht. Die Lehrkraft gibt der Raumaufsicht eine Bezeichnung und wählt **Anzahl der Sitzplätze** und **Anordnung**: Reihen (Plätze je Reihe), Reihen versetzt, U-Form oder Gruppentische (4 oder 6 Plätze). Eine Vorschau zeigt den Sitzplan; bis zum Start lässt er sich im Reiter „Prüfung“ ändern. Platzbezeichnungen: Reihe-Platz (`2-1`), U-Form fortlaufend (`7`), Gruppentische Tisch-Platz (`T2-3`).
- **Prüfung:** Die Schuladministration wählt einen **realen Raum ihrer Schule** (Raumliste je Schule). Ein Raum kann je Zeitraum (Bearbeitungszeit zzgl. 30 Minuten) nur einmal belegt werden; belegte Räume sind in der Auswahl gesperrt und der Server weist Doppelbelegungen ab.

Klassen und Kurse der Schulverwaltung: FA230a, WG12a, WG12b, Informatik J1 (AFS) sowie die Klassen des Großraums (BTS).

**Sichtbarkeit der Raumaufsichten** (Übersicht und Direktaufruf):
- **Lehrkraft**: nur Raumaufsichten, die ihr Konto betreffen – Eigentümer, eingetragene Aufsichtsperson oder Besitzer/Mitbetreuung des Unterrichtskurses.
- **Raumaufsicht**: nur Raumaufsichten, in denen sie als Aufsichtsperson eingetragen ist (bei genau einer wird sie direkt geöffnet).
- **Schuladministration**: nur die Prüfungs-Raumaufsichten der eigenen Schule. In einer schulübergreifenden Prüfung sieht und bearbeitet sie nur Mitglieder ihrer Schule.
- **Korrektur**: nur Arbeiten aus Kursen, in denen das Konto korrigieren darf (Prüfung: Korrektor:in, Unterricht: Lehrkraft des Kurses).

Zuordnungen in der Raumaufsicht erfolgen **aus den Kursmitgliedern**: Teilnehmende aus der Rolle „Teilnehmende“ (Prüfung: nur der Schule des Raums, nicht bereits in einer anderen Raumaufsicht derselben Prüfung), Aufsichtspersonen aus der Rolle „Raumaufsicht“ (Prüfung) bzw. den Lehrkräften des Unterrichts. Eine Lehrkraft, die eine Raumaufsicht erstellt, wird automatisch als Aufsichtsperson eingetragen.

## Testbare Klickstrecken

Auf der Startseite starten zwei Klickstrecken. Ein **Leitfaden unten rechts** zeigt den aktuellen Schritt mit Erläuterung und der Schaltfläche „Anmelden und öffnen“ (wechselt die Person und öffnet die richtige Seite). Erledigte Schritte werden automatisch aus den Daten erkannt; „Alle Schritte anzeigen“ blendet die vollständige Liste ein.

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
10. Einsammeln und beenden, Protokoll-PDF (Task 33)
11. Korrigieren (Task 35, optional)

**Prüfung (Schuladministration Marit Hinrichs)**
1. Prüfung „FA230“ öffnen, Teilnehmende der eigenen Schule zuordnen (Task 52)
2. Raumaufsicht (Person) zuordnen (Task 52)
3. Korrektor:innen festlegen (Task 24)
4. Raumaufsicht in einem freien realen Raum erstellen – belegte Räume sind gesperrt (Task 21)
5. Aufsichtspersonen zuordnen (Task 21)
6. Teilnehmende zuordnen (Task 21)
7. Sichtbarkeit prüfen: Schuladmin der BTS sieht die Raumaufsicht nicht; die Raumaufsicht sieht nur ihre Räume
8. Raumaufsicht durchführen als zugeordnete Raumaufsicht (Task 22)
9. Beenden und Protokoll herunterladen (Task 23)

## Empfohlene Demo (zwei Fenster nebeneinander)

1. Fenster A: **Raumaufsicht** (Thea Riedmüller) wählen. Der Sitzplan von Raum 123 erscheint.
2. Fenster B: **Prüfling** (Niklas Fröhlke, Platz 1-1) wählen. Die Belehrung und die Gesundheitsabfrage bestätigen.
3. Fenster A: Bei Platz 1-1 die **Anwesenheit** einschalten. Optional „Demo: übrige Teilnehmende anmelden“ klicken.
4. Fenster A: **Prüfung starten**. In Fenster B läuft ein 5-Sekunden-Countdown, danach öffnet sich das Dashboard.
5. Fenster B: Teilaufgabe 1.1 öffnen und die Mail von Herrn Bäumler beantworten. Die Vorlage anhängen, senden und **als Abgabe 1.1 markieren**.
6. Fenster A: Über „Details“ den Prüfling pausieren oder sperren. Fenster B zeigt sofort das Overlay. Danach **Prüfung einsammeln**.
7. Rolle **Korrektor:in** wählen. Die Abgabe von Niklas Fröhlke erscheint in der Korrekturübersicht und kann bewertet werden.

Über **Administration › Demo zurücksetzen** oder den Button auf der Startseite wird alles auf den Ausgangszustand gesetzt. Andere offene Fenster laden dabei automatisch neu. Der Prüfungsbeginn von Raum 123 liegt nach dem Zurücksetzen 20 Minuten in der Zukunft.

## Fenster und Taskleiste (Prüfling)

- Jede geöffnete E-Mail, jeder Entwurf und jede Notiz öffnet ein **eigenes Fenster**. Fenster lassen sich verschieben, in der Größe ändern, maximieren und schließen.
- **Klick außerhalb** eines Fensters (Aufgabe, Kopfzeile, freie Fläche) minimiert alle sichtbaren Fenster. Sie bleiben in der Taskleiste.
- Dialoge (z. B. „Als Abgabe markieren“, „Neuer Termin“) liegen immer **vor** den Fenstern. Ebenen: Seite < Taskleiste < Fenster < Dialoge < Menüs < Hinweise < Sperrbildschirm.
- **Aufgabenspezifische Materialien:** E-Mails, Dateien, Termine, Tickets und Code gehören jeweils zu einer Aufgabe (`data.task`). Die Werkzeuge zeigen immer die Inhalte der geöffneten bzw. zuletzt geöffneten Aufgabe. Fenstertitel tragen die Aufgabe, neu angelegte Elemente werden ihr zugeordnet. Die Abgabe-Auswahl bietet nur Teilaufgaben dieser Aufgabe an.
- **Aufgaben sind voneinander unabhängig:** Jede Aufgabe hat eigene Fenster (inkl. Rechner-Verlauf und IDE-Konsole). Beim Wechsel werden die Fenster der anderen Aufgabe ausgeblendet und beim Zurückkehren wiederhergestellt. Auf **Dashboard und Abgaben** sind alle Anwendungen in der Taskleiste ausgegraut und lassen sich nicht öffnen.
- **Ticketsystem** (jede Aufgabe mit eigenen Tickets, Schwerpunkt Aufgabe 3, neue Tickets anlegbar): Ticketliste mit Priorität und Status, Ticketfenster mit Anfrage, Verlauf, Status und Lösungsfeld. Tickets werden wie andere Elemente als Abgabe markiert und in der Korrektur dargestellt.
- **Automatische Zwischenspeicherung** aller Freitexte: E-Mail-Entwürfe, Notizen und Ticket-Lösungen alle 15 s, beim Verlassen oder Minimieren eines Fensters und beim Schließen. Der Code in der IDE wird bei jeder Eingabe gespeichert. In der Korrektur werden Begründungen (15 s, beim Verlassen) und Kommentar-Entwürfe gesichert.
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

Der Download ist **erst nach Beendigung der Prüfung** möglich. „Protokoll herunterladen (PDF)“ im Reiter Prüfungsprotokoll erzeugt lokal im Browser ein PDF (jsPDF) mit:
1. **Angaben zur Prüfung**: Prüfung, Raum, geplanter und tatsächlicher Start, Startfenster, Bearbeitungszeit, Bearbeitungsende, Pausen, Status, Vollbildmodus, Teilnehmende, Nachteilsausgleich und Zusatzzeiten
2. **Raumaufsichten**: je Aufsichtsperson eine Zeile mit Kürzel, Anwesenheit, **allen Aufsichtszeiträumen** und **einem Unterschriftsfeld** (mehrere Zeiträume bei Aufsicht mit Unterbrechung, festzulegen im Reiter „Aufsichtspersonen“ › „Zeiträume festlegen“; Überschneidungen werden abgelehnt), zusätzlich Ort/Datum und Unterschrift Prüfungsleitung
3. **Sitzplan** (Reihe-Platz, Name, Status, Tafel)
4. **alle Protokolleinträge** (Vorkommnisse rot hervorgehoben), mit Seitenzahlen

## Demo im Wartebereich

„Demo starten“ öffnet eine Klickstrecke in elf Schritten an einer verkleinerten Nachbildung des Prüfungsmodus: Kopfzeile, Dashboard, Navigation, gesperrte Taskleiste, Aufgabe und Arbeitsauftrag, Fenster, Ergebnis erstellen, als Abgabe markieren, Abgaben prüfen, Pause/Verbindungsabbruch, Zeitablauf und Prüfung beenden. Der jeweils anzuklickende Bereich ist markiert, alternativ „Weiter“ oder Pfeiltasten. Die Demo startet nur per Klick.

## Ergebnisse und Prüfungseinsicht

- **Ergebnisse** (Navigation „Ergebnisse“): Kennzahlen, Notenspiegel, Aufgabenstatistik (Ø Punkte, Erreichungsgrad, Spannweite), Ergebnisliste mit EK/ZK/DK, Endpunkten und Note, Hinweis bei Abweichung ≥ 10 % zwischen Erst- und Zweitkorrektur, **CSV-Export**.
- Endpunkte: Drittkorrektur, sonst Mittelwert aus Erst- und Zweitkorrektur (auf halbe Punkte gerundet), sonst Erstkorrektur.
- **Prüfungseinsicht**: wird in den Ergebnissen freigegeben. Lehrkräfte öffnen sie je Prüfling, Prüflinge nach Prüfungsende über den Endbildschirm. Sie zeigt Punkte je Teilaufgabe, Begründungen und die Arbeit mit den Randzeichen aller Korrekturen (schreibgeschützt). Interne Kommentare bleiben verborgen.

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
| Großraum mit 120 Teilnehmenden | „Aula (Großraum)“: kompakter Sitzplan, Hervorhebung nach Status, Suche, Pagination |
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
  css/app.css    Designsystem nach Figma (Gelb-Header, Rail, Tabs, Modals, Toasts, Status-Chips …)
  js/app.js      Router, Shells, Rollenwahl
  js/data.js     Backend-Erkennung, PocketBase-Client bzw. Browser-Datenbank, Realtime-Spiegel
  js/scenario.js Prüfungsinhalt (Szenario FunSport, Aufgaben, Kriterien, Erwartungshorizont, Korrekturzeichen)
  js/ink.js      Stiftgesten und Handschrifterkennung der Korrekturzeichen
  js/views/      participant.js · dock.js (Fenster, Taskleiste, Rechner, IDE) · proctor.js · correction.js · kmode.js (Korrekturmodus) · results.js (Ergebnisse, Einsicht) · teacher.js
```

### Datenmodell (Collections)

`orgs` (Schulen), `persons` (Konten: Lehrkraft, Schüler:in, Schuladmin), `groups` (Klassen/Kurse der Schulverwaltung und eigene Gruppen), `courses` (Unterricht bzw. Prüfung mit Mitgliedern `[{ person, role, stage }]` und Gruppen), `venues` (reale Räume je Schule, nur für Prüfungen), `rooms` (Raumaufsichten mit Kurs, Schule, Eigentümer, Sitzordnung `layout`/`capacity`/`cols`/`group_size` und ggf. realem Raum `venue`), `participants` (Teilnahmen, mit Person verknüpft), `supervisors`, `protocol`, `items` (Dateien inkl. Upload, Mails, Termine, Notizen, Tickets, Code und Abgabe-Markierungen je Prüfling, Zuordnung zur Aufgabe in `data.task`), `gradings` (Punkte, Korrekturzeichen, Begründungen und Freigabe je Korrektor), `kfiles` (Dateien der Korrigierenden), `comments`, `tasks` (Aufgabensteuerung), `catalog`, `settings`.

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

PocketBase (MIT), PocketBase JS SDK (MIT), jsPDF und jsPDF-AutoTable (MIT), Lucide Icons (ISC), Noto Sans (SIL OFL 1.1).

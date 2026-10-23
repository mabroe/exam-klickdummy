// Klickstrecke „Demo starten“ im Wartebereich: erklärt den Prüfungsmodus an einer verkleinerten Nachbildung.
// In jedem Schritt ist ein Bereich hervorgehoben; ein Klick darauf (oder „Weiter“) führt zum nächsten Schritt.
import { icon, esc, modal } from "../ui.js?v=9.3";
import { EXAM } from "../scenario.js?v=9.3";

const STEPS = [
  { view: "dash", hot: "head", title: "Kopfzeile: Zeit und Fortschritt",
    text: "Oben rechts sehen Sie immer Ihre <b>verbleibende Bearbeitungszeit</b>, den <b>Gesamtfortschritt</b> (Anteil der Teilaufgaben mit Abgabe) und den <b>Verbindungsstatus</b>. Ein Nachteilsausgleich oder eine Zusatzzeit ist bereits eingerechnet und wird darunter ausgewiesen. Kurz vor Ablauf erhalten Sie Hinweise.",
    tip: "Klicken Sie auf die markierte Kopfzeile." },
  { view: "dash", hot: "tiles", title: "Dashboard",
    text: "Das Dashboard ist Ihr Startpunkt. Hier finden Sie die <b>Prüfungsinformationen</b>, die <b>Ausgangssituation der Prüfung</b> und <b>allgemeine Fragen</b>. Rechts sehen Sie den Fortschritt je Aufgabe und springen direkt in jede Teilaufgabe.",
    tip: "Klicken Sie auf die Kacheln." },
  { view: "dash", hot: "nav", title: "Navigation",
    text: "Über die Navigation links wechseln Sie zwischen <b>Dashboard</b>, <b>Abgaben</b> und den <b>Aufgaben</b> mit ihren Teilaufgaben. Ein Häkchen zeigt Teilaufgaben, zu denen bereits eine Abgabe markiert ist. Mit dem Pfeil klappen Sie die Navigation ein, um mehr Platz zu haben.",
    tip: "Klicken Sie auf die Navigation." },
  { view: "dash", hot: "dock", title: "Taskleiste – auf dem Dashboard gesperrt",
    text: "Unten befindet sich die Taskleiste mit den Anwendungen: Dateien, Mail, Kalender, Notizen, Tickets, Taschenrechner und Entwicklungsumgebung. Auf <b>Dashboard und Abgaben sind die Anwendungen ausgegraut</b>. Sie stehen erst zur Verfügung, wenn Sie eine Aufgabe geöffnet haben.",
    tip: "Klicken Sie auf „Aufgabe 1“ in der Navigation, um sie zu öffnen.", hotAlt: "navtask" },
  { view: "task", hot: "assign", title: "Aufgabe und Arbeitsauftrag",
    text: "Jede Aufgabe beginnt mit ihrer <b>Ausgangssituation</b>. Über die Reiter wählen Sie die Teilaufgabe. Der <b>Arbeitsauftrag</b> beschreibt, was zu tun ist, und öffnet direkt das passende Werkzeug. Rechts sehen Sie die Materialien dieser Aufgabe, z. B. den Posteingang.",
    tip: "Klicken Sie auf „Mail öffnen“." },
  { view: "win", hot: "win", title: "Arbeiten in Fenstern",
    text: "Anwendungen öffnen sich als <b>Fenster</b>, die Sie verschieben, vergrößern und schließen können. Jede E-Mail oder Notiz erhält ein eigenes Fenster. Ein <b>Klick neben ein Fenster</b> minimiert alle Fenster – sie bleiben in der Taskleiste. Bei mehreren Fenstern zeigt die Taskleiste eine Auswahlliste.",
    tip: "Klicken Sie im Fenster auf „Antworten“." },
  { view: "compose", hot: "send", title: "Ergebnis erstellen",
    text: "Schreiben Sie Ihre Antwort, hängen Sie Dateien an und senden Sie die E-Mail. Alle Eingaben werden <b>automatisch zwischengespeichert</b> (spätestens alle 15 Sekunden). Jede Aufgabe hat ihre <b>eigenen Materialien</b>: E-Mails, Dateien, Termine, Tickets und Code der anderen Aufgaben sehen Sie dort nicht.",
    tip: "Klicken Sie auf „Senden“." },
  { view: "mark", hot: "mark", title: "Als Abgabe markieren",
    text: "<b>Bewertet wird nur, was Sie als Abgabe markieren.</b> Nach dem Senden, Speichern oder Hochladen wählen Sie die Teilaufgabe aus. Markierungen erkennen Sie am Häkchen-Symbol und können sie jederzeit ändern – auch bei Dateien, Terminen, Notizen, Tickets und Code-Dateien.",
    tip: "Klicken Sie auf „Markieren“." },
  { view: "abg", hot: "abg", title: "Abgaben prüfen",
    text: "Unter <b>Abgaben</b> sehen Sie für jede Teilaufgabe eine Vorschau Ihrer markierten Elemente. Der Reiter <b>Offene Aufgaben</b> listet Teilaufgaben, zu denen noch nichts markiert ist. Gemerkte Aufgaben finden Sie ebenfalls hier.",
    tip: "Klicken Sie auf die Abgabenübersicht." },
  { view: "pause", hot: "overlay", title: "Pause und Verbindungsabbruch",
    text: "Pausiert die Aufsicht die Prüfung, wird der <b>gesamte Bildschirm ausgeblendet</b>; bei angehaltener Prüfung läuft die Zeit nicht weiter. Bei einem <b>Verbindungsabbruch</b> bleiben Ihre Eingaben erhalten. Sobald die Verbindung wieder steht, arbeiten Sie ohne erneute Anmeldung weiter.",
    tip: "Klicken Sie auf den Hinweis." },
  { view: "end", hot: "finish", title: "Zeitablauf und Prüfung beenden",
    text: "Ist Ihre Bearbeitungszeit abgelaufen, können Sie die zuletzt bearbeitete Aufgabe noch abschließen, aber <b>keine neue Aufgabe öffnen</b>. Mit <b>„Prüfung beenden“</b> geben Sie selbst ab – danach ist keine Bearbeitung mehr möglich. Den endgültigen Abschluss übernimmt die Aufsicht durch Einsammeln.",
    tip: "Klicken Sie auf „Prüfung beenden“, um die Demo abzuschließen." },
];

const tools = (off) => ["folder", "mail", "calendar", "notepad-text", "ticket", "calculator", "code-xml"].map((ic) => `<span class="tm-tool ${off ? "off" : ""}">${icon(ic)}</span>`).join("");
const hot = (id, cur, html, cls = "") => `<div class="${cls} ${id === cur ? "tm-hot" : ""}" data-hot="${id}">${html}</div>`;

function screen(step) {
  const v = step.view, h = step.hot, alt = step.hotAlt;
  const head = hot("head", h, `<span class="tm-logo"></span><b>${esc(EXAM.name)}</b><span class="tm-grow"></span><span class="tm-meta"><span>${icon("clock")} 1:24:10</span><span class="tm-prog"><i style="width:${v === "abg" || v === "end" ? 60 : v === "mark" ? 20 : 0}%"></i></span>${v === "abg" || v === "end" ? 60 : v === "mark" ? 20 : 0}%<span>${icon("radio")}</span></span>`, "tm-head");
  const nav = (task) => hot("nav", h, `<div class="tm-navh">${icon("menu")}</div>
    <div class="tm-li ${task ? "" : "on"}">${icon("house")} Dashboard</div><div class="tm-li ${v === "abg" ? "on" : ""}">${icon("list-checks")} Abgaben</div><div class="tm-li">${icon("clipboard-list")} Aufgaben</div>
    ${EXAM.tasks.map((t) => `<div class="tm-li sub ${task && t.no === "1" ? "on" : ""} ${alt && t.no === "1" ? "tm-hot" : ""}" ${alt && t.no === "1" ? `data-hot="${alt}"` : ""}>${t.no} ${esc(t.title)}</div>`).join("")}`, "tm-nav");
  const dock = (off) => hot("dock", h, `<span class="tm-tool page">${icon("house")}</span><span class="tm-tool page">${icon("list-checks")}</span><i class="tm-sep"></i>${tools(off)}`, "tm-dock");
  let body = "";
  if (v === "dash") body = `${nav(false)}<div class="tm-main tm-dash">${hot("tiles", h, `<div class="tm-tile">${icon("info")}<b>Prüfungsinformationen</b></div><div class="tm-tile">${icon("building-2")}<b>Ausgangssituation</b></div><div class="tm-tile">${icon("circle-question-mark")}<b>Allgemeine Fragen</b></div>`, "tm-tiles")}
    <div class="tm-panel"><b>Fortschritt</b>${EXAM.tasks.map((t) => `<div class="tm-acc"><b>Aufgabe ${t.no}:</b> ${esc(t.title)}<span class="tm-mini"><i style="width:0"></i></span></div>`).join("")}</div></div>`;
  if (["task", "win", "compose", "mark"].includes(v)) body = `${nav(true)}<div class="tm-main"><div class="tm-title">Teilaufgabe 1.1 Angebotsvergleich</div>
    <div class="tm-tabs"><span>Übersicht</span><span class="on">1.1</span><span>1.2</span><span>1.3</span></div>
    <div class="tm-grid">${hot("assign", h, `<b>${icon("clipboard-list")} Arbeitsauftrag 1.1</b><p>Lesen Sie die E-Mail von Herrn Bäumler und senden Sie Ihren Angebotsvergleich per E-Mail. Markieren Sie die gesendete E-Mail als Abgabe.</p><span class="tm-btn">${icon("mail")} Mail öffnen</span>`, "tm-assign")}
      <div class="tm-widget"><b>${icon("mail")} Mail</b><div class="tm-row unread">Quantitativer Angebotsvergleich …</div><div class="tm-row">Angebote</div><div class="tm-row">Angebot für Lithium-Batterie-Packs</div></div></div></div>`;
  if (v === "abg") body = `${nav(true)}<div class="tm-main"><div class="tm-title">Abgaben</div><div class="tm-tabs"><span class="on">Abgabenübersicht</span><span>Gemerkte Aufgaben</span><span>Offene Aufgaben <em>6</em></span></div>
    ${hot("abg", h, `<div class="tm-acc"><b>Aufgabe 1 Angebotsvergleich</b></div><div class="tm-sub ok">${icon("circle-check")} 1.1 Angebotsvergleich – E-Mail „AW: Quantitativer Angebotsvergleich“</div><div class="tm-sub ok">${icon("circle-check")} 1.2 Angebotskalkulation – Datei „Kalkulation.pdf“</div><div class="tm-sub warn">${icon("triangle-alert")} 1.3 Programmierung – noch keine Abgabe markiert</div>`, "tm-abg")}</div>`;
  if (v === "pause") body = `${nav(true)}<div class="tm-main"><div class="tm-title">Teilaufgabe 1.2 Angebotskalkulation</div></div>`;
  if (v === "end") body = `${nav(true)}<div class="tm-main"><div class="tm-title row-between">Teilaufgabe 1.3 Programmierung ${hot("finish", h, "Prüfung beenden", "tm-finish")}</div><div class="tm-note">${icon("alarm-clock")} Die Bearbeitungszeit ist abgelaufen. Sie können Aufgabe 1 noch abschließen; neue Aufgaben können nicht mehr geöffnet werden.</div></div>`;
  let over = "";
  if (v === "win" || v === "compose") over = hot("win", h, `<div class="tm-winh">${icon("mail")} ${v === "win" ? "Mail – Quantitativer Angebotsvergleich" : "Neue E-Mail – AW: Quantitativer Angebotsvergleich"}<span class="tm-grow"></span>${icon("minus")}${icon("square")}${icon("x")}</div>
    <div class="tm-winb">${v === "win" ? `<div class="tm-muted">Von: Bäumler, Karim</div><p>Hallo Herr Bendix, bitte führen Sie einen quantitativen Angebotsvergleich durch und senden Sie mir Ihr Ergebnis …</p><div class="tm-right"><span class="tm-btn ghost">Weiterleiten</span><span class="tm-btn">${icon("reply")} Antworten</span></div>`
      : `<div class="tm-field">An: Karim.Baeumler@funsport-innovations.de</div><div class="tm-field">Betreff: AW: Quantitativer Angebotsvergleich</div><div class="tm-text">Sehr geehrter Herr Bäumler,<br>anbei der Angebotsvergleich. Das Angebot der BatteryWorld GmbH ist günstiger …</div><div class="tm-attach">${icon("paperclip")} Angebotsvergleich.xlsx</div><div class="tm-right"><span class="tm-muted">Automatisch gespeichert</span>${hot("send", h, `${icon("send")} Senden`, "tm-btn")}</div>`}</div>`, "tm-win");
  if (v === "mark") over = `<div class="tm-dim"></div>` + hot("mark", h, `<b>${icon("triangle-alert")} E-Mail als Abgabe markieren</b><p>Wählen Sie die Teilaufgabe, für die die E-Mail als Abgabe markiert werden soll.</p><div class="tm-select">1.1 Angebotsvergleich ${icon("chevron-down")}</div><div class="tm-right"><span class="tm-btn ghost">Nicht markieren</span><span class="tm-btn">Markieren</span></div>`, "tm-dialog");
  if (v === "pause") over = hot("overlay", h, `<div class="tm-pausebox"><b>${icon("circle-pause")} Prüfung pausiert</b><p>Bitte warten Sie, bis die Aufsicht die Prüfung fortsetzt.</p></div>`, "tm-pause");
  return `<div class="tm-screen tm-v-${v}">${head}<div class="tm-body">${body}</div>${dock(v === "dash" || v === "abg")}${over}</div>`;
}

export function startTour() {
  let i = 0;
  return modal({ title: "Demo: So funktioniert der Prüfungsmodus", size: "wide", headIcon: icon("circle-play", "lg"),
    body: `<div data-tour></div>`,
    footer: `<span class="muted small grow" data-stepno></span><button class="btn" data-close>Demo beenden</button><button class="btn" data-prev>${icon("arrow-left")} Zurück</button><button class="btn primary" data-next>Weiter ${icon("arrow-right")}</button>`,
    onMount(m, close) {
      const draw = () => {
        const s = STEPS[i];
        m.querySelector("[data-tour]").innerHTML = `<div class="tour">
          <div class="tour-dots" aria-hidden="true">${STEPS.map((_, k) => `<i class="${k < i ? "done" : k === i ? "on" : ""}"></i>`).join("")}</div>
          <div class="tour-grid"><div class="tour-stage" data-stage aria-hidden="true">${screen(s)}</div>
          <div class="tour-text" aria-live="polite"><div class="xs muted">Schritt ${i + 1} von ${STEPS.length}</div><h3>${esc(s.title)}</h3><p>${s.text}</p><div class="tour-tip">${icon("mouse-pointer-2")} ${esc(s.tip)}</div></div></div></div>`;
        m.querySelector("[data-stepno]").textContent = `Schritt ${i + 1} von ${STEPS.length}`;
        m.querySelector("[data-prev]").disabled = i === 0;
        m.querySelector("[data-next]").innerHTML = i === STEPS.length - 1 ? `${icon("check")} Demo abschließen` : `Weiter ${icon("arrow-right")}`;
        m.querySelectorAll(".tm-hot").forEach((el) => (el.onclick = (e) => { e.stopPropagation(); next(); }));
      };
      const next = () => { if (i === STEPS.length - 1) close("done"); else { i++; draw(); } };
      m.querySelector("[data-next]").onclick = next;
      m.querySelector("[data-prev]").onclick = () => { if (i > 0) { i--; draw(); } };
      m.addEventListener("keydown", (e) => { if (e.key === "ArrowRight") next(); if (e.key === "ArrowLeft" && i > 0) { i--; draw(); } });
      draw();
    } });
}
export const TOUR_STEPS = STEPS.length;

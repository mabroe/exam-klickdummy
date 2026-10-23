// Exam Klickdummy – Router, Shells, Rollenwahl
import { D, loadAll, subscribeAll, onChange, resetDemo, byId, demoApi, backend } from "./data.js?v=8.9";
import { lock as lockGate } from "./gate.js?v=8.9";
import { icon, esc, store, brand, popMenu, modal, toast, $, debounce, closeMenus, confirmBox } from "./ui.js?v=8.9";
import * as TN from "./views/participant.js?v=8.9";
import * as PR from "./views/proctor.js?v=8.9";
import * as KO from "./views/correction.js?v=8.9";
import * as LK from "./views/teacher.js?v=8.9";
import * as RS from "./views/results.js?v=8.9";
import * as KU from "./views/courses.js?v=8.9";
import * as GD from "./guide.js?v=8.9";
import * as ED from "./views/editor.js?v=8.9";
import * as CR from "./views/creation.js?v=8.9";
import { CORRECTORS } from "./scenario.js?v=8.9";
import { me, personName, orgShort, orgsLabel, einsichtPersons, members, correctorStage, STAGE_LABEL, visibleRooms } from "./access.js?v=8.9";
import { seatCount, seatCmp } from "./seats.js?v=8.9";
import { syncForRoute } from "./content.js?v=8.9";

export const VERSION = "8.9";
export const VERSION_LABEL = `Version ${VERSION} · 22.10.2026`;
export const ROLES = {
  tn: { label: "Prüfling", icon: "graduation-cap" },
  aufsicht: { label: "Raumaufsicht", icon: "monitor", user: "Thea Riedmüller" },
  korrektor: { label: "Korrektor:in", icon: "file-pen-line" },
  lehrkraft: { label: "Lehrkraft", icon: "school", user: "Amir Eggert" },
  schuladmin: { label: "Schuladministration", icon: "building-2", user: "Marit Hinrichs" },
  einsicht: { label: "Prüfungseinsicht", icon: "eye" },
  autor: { label: "Prüfungserstellung", icon: "pencil", user: "Koordinierungsstelle (IBBW)" },
};
export const session = {
  get role() { return store.get("role"); },
  get pid() { return store.get("pid"); },
  get corrector() { return store.get("corrector", 1); },
  get person() { return store.get("person"); },
  userName() {
    const r = this.role;
    if (r === "tn") { const p = byId("participants", this.pid); return p ? `${p.firstname} ${p.lastname}` : "Prüfling"; }
    const pe = me(); if (pe) return `${pe.firstname} ${pe.lastname}`;
    if (r === "korrektor") return CORRECTORS[+this.corrector]?.name || "Korrektor:in";
    return ROLES[r]?.user || "Vorname Nachname";
  },
};
export const setRole = (role, extra = {}) => { store.set("role", role); Object.entries(extra).forEach(([k, v]) => store.set(k, v)); };

// ---------- Router ----------
const routes = [
  [/^$/, () => startView()],
  [/^tn(?:\/(.*))?$/, (m, q) => TN.route(m[1] || "", q)],
  [/^app\/raumaufsicht$/, (m, q) => PR.overview(q)],
  [/^app\/raum\/([^/]+)(?:\/([^/]+))?$/, (m, q) => PR.room(m[1], m[2] || "meinraum", q)],
  [/^app\/korrektur$/, (m, q) => KO.overview(q)],
  [/^app\/ergebnisse$/, () => RS.overview()],
  [/^app\/einsicht\/([^/]+)$/, (m) => RS.einsichtView(m[1])],
  [/^app\/korrektur\/([^/]+)\/([^/]+)$/, (m, q) => KO.mode(m[1], m[2], q, false)],
  [/^app\/vergleich\/([^/]+)\/([^/]+)$/, (m, q) => KO.mode(m[1], m[2], q, true)],
  [/^erwartung\/([^/]+)$/, (m) => KO.horizon(m[1])],
  [/^app\/aufgaben$/, (m, q) => LK.tasks(q)],
  [/^app\/katalog$/, (m, q) => LK.catalog(q)],
  [/^app\/katalog\/([^/]+)$/, (m) => LK.course(m[1])],
  [/^app\/meine-pruefungen$/, () => ({ redirect: "#/app/kurse" })],
  [/^app\/kurse$/, () => KU.list()],
  [/^app\/kurs\/([^/]+)(?:\/([^/]+))?$/, (m) => KU.detail(m[1], m[2] || "mitglieder")],
  [/^app\/vorschau\/([^/]+)(?:\/(.*))?$/, (m, q) => TN.preview(m[1], m[2] || "", q)],
  [/^app\/admin$/, () => LK.admin()],
  [/^app\/raeume$/, () => PR.venues()],
  [/^app\/pruefungseinsicht$/, () => RS.einsichtList()],
  [/^app\/editor\/([^/]+)(?:\/([^/]+))?$/, (m) => ED.editor(m[1], m[2] || "allgemein")],
  [/^app\/erstellung$/, () => CR.list()],
  [/^app\/erstellung\/([^/]+)(?:\/([^/]+))?$/, (m) => CR.detail(m[1], m[2] || "uebersicht")],
  [/^app\/pruefungseinsicht\/([^/]+)$/, (m) => RS.einsichtSession(m[1])],
];

let current = null;
let pending = false;
const root = document.getElementById("app");

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  return { path: path.replace(/\/$/, ""), q: Object.fromEntries(new URLSearchParams(qs || "")) };
}

export function navigate(h) { if (location.hash === h) render(true); else location.hash = h; }

function resolve() {
  const { path, q } = parseHash();
  try { syncForRoute(path, session); } catch (e) { console.warn("[content]", e); }
  for (const [re, fn] of routes) { const m = path.match(re); if (m) return fn(m, q); }
  return notFound();
}

export function render(force = true) {
  closeMenus();
  if (current?.unmount) current.unmount();
  current = resolve();
  if (!/^#\/app\/(korrektur|vergleich)\//.test(location.hash)) document.body.classList.remove("kfocus");
  if (current?.redirect) { location.replace(current.redirect); return; }
  draw();
  if (force) window.scrollTo(0, 0);
}

function draw() {
  const v = current;
  document.title = (v.title ? v.title + " – " : "") + "Exam Klickdummy";
  if (v.shell === "staff") root.innerHTML = staffShell(v);
  else if (v.shell === "plain") root.innerHTML = plainShell(v);
  else root.innerHTML = v.render();
  bindShell();
  const main = $("#main") || root;
  v.mount && v.mount(main);
  rolePill();
}

// Aktuelle Ansicht sofort neu zeichnen (lokaler UI-Zustand geändert)
export function redraw() {
  if (!current) return;
  const inner = $("#main");
  if (inner && (current.shell === "staff" || current.shell === "plain")) { inner.innerHTML = current.render(); current.mount && current.mount(inner); }
  else draw();
}

// Bei Datenänderungen: aktuelle Ansicht neu zeichnen, ohne laufende Eingaben zu zerstören
export const refresh = debounce(() => {
  if (!current) return;
  const a = document.activeElement;
  const main = $("#main") || root;
  const typing = a && main.contains(a) && (a.matches("input,textarea,select") || a.isContentEditable);
  if (typing || main.querySelector(".dd.open") || document.querySelector(".popmenu") || current.freeze?.()) { pending = true; return; }
  pending = false;
  if (current.reroute) { const y0 = window.scrollY; render(false); window.scrollTo(0, y0); return; }
  if (current.update) { current.update(main); return; }
  const y = window.scrollY;
  const inner = $("#main");
  if (current.shell === "staff" || current.shell === "plain") { inner.innerHTML = current.render(); current.mount && current.mount(inner); }
  else draw();
  window.scrollTo(0, y);
}, 60);
document.addEventListener("focusout", () => setTimeout(() => pending && refresh(), 50));
document.addEventListener("click", () => setTimeout(() => pending && !document.querySelector(".popmenu") && refresh(), 120));

// ---------- Shells ----------
function userMenu() {
  return `<div class="usermenu"><button data-usermenu>${icon("circle-user", "lg")}<span class="nm">${esc(session.userName())}</span>${icon("chevron-down")}</button></div>`;
}
function staffShell(v) {
  const adm = me()?.kind === "schuladmin";
  const nav = session.role === "einsicht" ? [["einsicht", "#/app/pruefungseinsicht", "eye", "Prüfungseinsicht"]] : session.role === "autor" ? [["erstellung", "#/app/erstellung", "clipboard-list", "Erstellung"], ["katalog", "#/app/katalog", "pencil", "Katalog und Editor"]] : [
    ["aufgaben", "#/app/aufgaben", "circle-check", "Aufgaben"],
    ["katalog", "#/app/katalog", "pencil", "Katalog"],
    ["kurse", "#/app/kurse", adm ? "clipboard-list" : "book-open", adm ? "Prüfungen" : "Mein Unterricht"],
    ["ergebnisse", "#/app/ergebnisse", "chart-pie", "Ergebnisse"],
    ["schule", "#/app/raumaufsicht", "school", "Meine Schule"],
    ...(adm ? [["raeume", "#/app/raeume", "door-open", "Prüfungsräume"]] : []),
    ["admin", "#/app/admin", "sliders-horizontal", "Administration"],
  ];
  return `<button class="skiplink" data-skip>Zum Inhalt springen</button><header class="topbar">${brand()}${userMenu()}</header>
  <div class="shell"><aside class="rail" aria-label="Hauptnavigation"><nav>${nav.map(([k, h, ic, l]) => `<a href="${h}" class="${v.rail === k ? "active" : ""}"><span class="pill">${icon(ic, "lg")}</span>${l}</a>`).join("")}</nav>
  <nav><button data-help><span class="pill">${icon("circle-question-mark", "lg")}</span>Hilfe</button><button data-info><span class="pill">${icon("house", "lg")}</span>Informationen</button></nav></aside>
  <main class="main" id="main" tabindex="-1">${v.render()}</main></div>`;
}
function plainShell(v) {
  return `<header class="topbar">${brand()}${userMenu()}</header><main class="main" id="main">${v.render()}</main>`;
}
function bindShell() {
  const um = root.querySelector("[data-usermenu]");
  if (um) um.onclick = () => popMenu(um, [
    { header: "Angemeldet als " + (ROLES[session.role]?.label || "Gast") + (me() ? " · " + (me().org ? orgShort(me().org) : "IBBW") : "") },
    { label: "Rolle wechseln", icon: "refresh-cw", run: () => navigate("#/") },
    { label: "Demo-Verwaltung", icon: "sliders-horizontal", run: () => navigate("#/app/admin") },
    "-",
    { label: "Abmelden", icon: "log-out", run: () => { store.del("role"); navigate("#/"); } },
  ]);
  const help = root.querySelector("[data-help]"); if (help) help.onclick = () => directHelp();
  const sk = root.querySelector(".topbar ~ .shell") && root.querySelector("[data-skip]"); if (sk) sk.onclick = () => document.getElementById("main")?.focus();
  const info = root.querySelector("[data-info]"); if (info) info.onclick = () => aboutBox();
}
export function directHelp(extra = "") {
  modal({ title: "Direkthilfe", headIcon: `<span class="helpbtn" style="width:32px;height:32px;border:none"><span class="q">?</span></span>`, size: "wide",
    body: `<p>Dieser Klickdummy bildet die Prüfungsplattform am Bildschirmarbeitsplatz nach. Alle Daten sind Demodaten und werden lokal in PocketBase gespeichert.</p>${extra}` });
}
function aboutBox() {
  modal({ title: "Informationen", size: "wide", body: `<p><b>Exam Klickdummy – Prüfungsplattform Exam</b></p>
  <p>Grundlage sind die Figma-Screens (Wartebereich, Teilnahmemodus, Raumaufsicht, Korrekturworkflow, Aufgabensteuerung, Katalog) sowie die Rollen- und Aufgabenbeschreibungen der Instanzen OPE, OPP und OPU.</p>
  <p>Die Rollen sind live gekoppelt: Öffnen Sie z. B. die Raumaufsicht und den Prüfling in zwei Browserfenstern, um Start, Pause und Einsammeln in Echtzeit zu sehen.</p>` });
}

function rolePill() {
  document.querySelector(".rolepill")?.remove();
  GD.mountPanel(); // Leitfaden (auf der Anmeldeseite ausgeblendet)
  if (!session.role || !parseHash().path) return;
  const a = document.createElement("a");
  a.className = "rolepill"; a.href = "#/";
  a.innerHTML = `<span class="dot"></span>${esc(session.userName())} (${esc(ROLES[session.role]?.label || "")}${me() ? ", " + esc(me().org ? orgShort(me().org) : "IBBW") : ""}) · Rolle wechseln <span style="opacity:.6;font-weight:400">v${VERSION}</span>`;
  document.body.appendChild(a);
}

function notFound() {
  return { shell: "plain", title: "Nicht gefunden", render: () => `<div class="empty">${icon("circle-alert")}<h2>Seite nicht gefunden</h2><p><a href="#/">Zur Rollenwahl</a></p></div>` };
}

// ---------- Rollen- und Personenwahl ----------
const P = (kind) => D.persons.filter((p) => p.kind === kind).sort((a, b) => a.org.localeCompare(b.org) || a.lastname.localeCompare(b.lastname));
const optP = (list, sel) => list.map((p) => `<option value="${p.id}" ${p.username === sel ? "selected" : ""}>${esc(personName(p))} (${esc(orgsLabel(p))})</option>`).join("");
// Personen der Prüfungserstellung: Koordinierungsstelle zuerst, dann Fachexpert:innen und Lehrkräfte (mit ihren Rollen im Erstellungsprozess)
function creationPersons() {
  const roles = (p) => D.catalog.filter((c) => c.status).flatMap((c) => Object.entries(c.team || {}).filter(([k, ids]) => k !== "koordination" && ids.includes(p.id)).map(([k]) => CR.EROLES[k]?.label)).filter(Boolean);
  const list = D.persons.filter((p) => ["koordination", "fachexperte", "lehrkraft"].includes(p.kind)).sort((a, b) => (a.kind === "koordination" ? -1 : b.kind === "koordination" ? 1 : 0) || a.lastname.localeCompare(b.lastname));
  return list.map((p) => { const r = [...new Set(roles(p))]; return `<option value="${p.id}">${esc(personName(p))} – ${p.kind === "koordination" ? "Koordinierungsstelle" : r.length ? esc(r.join(", ")) : p.kind === "fachexperte" ? "Fachexpert:in (IBBW)" : esc(orgsLabel(p))}</option>`; }).join("");
}
export function login(person, role, extra = {}) { store.set("person", person?.id || ""); setRole(role, extra); }
function startView() {
  const room = D.rooms.find((r) => r.name === "Raum 123") || D.rooms[0];
  // Prüflinge: Teilnahmen je Raumaufsicht (ohne Großraum-Testfall)
  const rooms = D.rooms.filter((r) => seatCount(r) <= 60 && D.participants.some((p) => p.room === r.id)).sort((a, b) => (a.name === "Raum 123" ? -1 : b.name === "Raum 123" ? 1 : a.name.localeCompare(b.name)));
  const tnOpts = rooms.map((r) => `<optgroup label="${esc(r.name)} – ${esc(r.exam_name)}">${D.participants.filter((p) => p.room === r.id).sort((a, b) => seatCmp(a.seat, b.seat)).map((p) => `<option value="${p.id}" ${p.username === "n.froehlke" ? "selected" : ""}>${esc(p.lastname)}, ${esc(p.firstname)}${p.seat ? ` (Platz ${esc(p.seat)})` : ""}</option>`).join("")}</optgroup>`).join("");
  const supIds = new Set(D.supervisors.map((s) => s.person).filter(Boolean));
  const correctors = [];
  // Korrektor:innen aus den Korrektorengruppen der Prüfungen (je Person und Stufe einmal)
  const seenK = new Set();
  D.courses.filter((c) => c.kind === "pruefung").forEach((c) => (c.corrections || []).forEach((a) => (a.correctors || []).forEach((id) => { const pe = byId("persons", id); const k = id + "|" + a.stage; if (pe && !seenK.has(k)) { seenK.add(k); correctors.push({ pe, stage: +a.stage, c }); } })));
  correctors.sort((a, b) => a.stage - b.stage || orgShort(a.pe.org).localeCompare(orgShort(b.pe.org)) || a.pe.lastname.localeCompare(b.pe.lastname));
  return {
    title: "Rollenwahl",
    render: () => `<div class="start"><header class="topbar">${brand()}<span class="bold">Klickdummy · Prüfungsplattform Exam</span></header>
    <div class="wrap">
      <h1>Anmelden als …</h1>
      <p class="lead mt">Wählen Sie eine Person. Zwei Schulen sind angelegt (AFS und BTS), damit die Sichtbarkeit je Konto und Organisation testbar ist. Die Rollen sind live gekoppelt – öffnen Sie z. B. Raumaufsicht und Prüfling in zwei Browserfenstern${backend.mode === "local" ? " bzw. Tabs dieses Browsers" : ""}.</p>
      ${(() => { const g = GD.status(); return g ? `<div class="guidepick guideresume"><div class="grow"><b>${icon("list-checks")} ${esc(g.name)} ${g.paused ? "pausiert" : "läuft"}</b><span class="small muted">${g.done} von ${g.total} Schritten erledigt${g.step ? ` · nächster Schritt: <b>${esc(g.step.title)}</b>` : " · abgeschlossen"}</span></div>
        <button class="btn primary" data-guideresume>${icon("arrow-right")} An der letzten Stelle fortsetzen</button><button class="btn" data-guide="${g.kind}" data-restart>${icon("rotate-ccw")} Neu beginnen</button><button class="btn ghost" data-guideoff>${icon("x")} Beenden</button>${g.kind === "unterricht" ? `<button class="btn ghost" data-guide="pruefung" data-switch>${icon("clipboard-list")} Stattdessen: Prüfung (Schuladmin)</button>` : `<button class="btn ghost" data-guide="unterricht" data-switch>${icon("book-open")} Stattdessen: Unterricht (Lehrkraft)</button>`}</div>`
        : `<div class="guidepick"><div><b>${icon("list-checks")} Testbare Klickstrecken</b><span class="small muted">Führen Schritt für Schritt durch die Workflows; der Fortschritt wird automatisch erkannt. Sie können jederzeit über diese Seite an der letzten Stelle weitermachen.</span></div>
        <button class="btn primary" data-guide="erstellung">${icon("pencil")} Prüfungserstellung (Koordinierungsstelle)</button><button class="btn primary" data-guide="unterricht">${icon("book-open")} Unterricht (Lehrkraft)</button><button class="btn primary" data-guide="pruefung">${icon("clipboard-list")} Prüfung (Schuladmin)</button></div>`; })()}
      <div class="rolegrid five six seven">
        <div class="rolecard"><div class="rico">${icon("graduation-cap", "lg")}</div><h3>Prüfling</h3>
          <ul><li>Wartebereich, Belehrung, Gesundheitsabfrage</li><li>Prüfungsmodus mit Werkzeugen</li><li>Abgaben markieren</li></ul>
          <label class="lbl mt-s" for="pidsel">Teilnahme</label><select class="select" id="pidsel">${tnOpts}</select>
          <button class="btn primary" data-role="tn">${icon("log-in")} Zur Prüfung</button></div>
        <div class="rolecard"><div class="rico">${icon("school", "lg")}</div><h3>Lehrkraft</h3>
          <ul><li>Unterrichtsebene: Prüfung aus dem Katalog kopieren</li><li>Teilnehmende, Gruppen, weitere Lehrkräfte</li><li>Raumaufsicht planen und durchführen, korrigieren</li></ul>
          <label class="lbl mt-s" for="lksel">Person</label><select class="select" id="lksel">${optP(P("lehrkraft"), "a.eggert")}</select>
          <button class="btn primary" data-role="lehrkraft">${icon("arrow-right")} Zum Unterricht</button></div>
        <div class="rolecard"><div class="rico">${icon("monitor", "lg")}</div><h3>Raumaufsicht</h3>
          <ul><li>Nur zugeordnete Raumaufsichten</li><li>Starten, pausieren, einsammeln, beenden</li><li>Protokoll</li></ul>
          <label class="lbl mt-s" for="ausel">Person</label><select class="select" id="ausel">${optP(P("lehrkraft").filter((p) => supIds.has(p.id)), "t.riedmueller")}</select>
          <button class="btn primary" data-role="aufsicht">${icon("arrow-right")} Zur Raumaufsicht</button></div>
        <div class="rolecard"><div class="rico">${icon("file-pen-line", "lg")}</div><h3>Korrektor:in</h3>
          <ul><li>Erst rot rechts, Zweit grün links, Dritt braun links</li><li>Stifteingabe mit Zeichenerkennung</li><li>Vergleich, Freigabe</li></ul>
          <label class="lbl mt-s" for="ksel">Person und Korrekturrolle</label><select class="select" id="ksel">${correctors.map((k) => `<option value="${k.pe.id}|${k.stage}">${esc(personName(k.pe))} – ${STAGE_LABEL[k.stage]}</option>`).join("")}</select>
          <button class="btn primary" data-role="korrektor">${icon("arrow-right")} Zur Korrektur</button></div>
        <div class="rolecard"><div class="rico">${icon("pencil", "lg")}</div><h3>Prüfungserstellung</h3>
          <ul><li>Koordinierungsstelle: Prüfung anlegen, Rahmendaten, Personen</li><li>Aufgabenerstellung, Kommission, Vorsitz, Beratung, Lektorat, Prüflösung</li><li>Editor, Freigabe bis zum Prüfungsstart</li></ul>
          <label class="lbl mt-s" for="ersel">Person</label><select class="select" id="ersel">${creationPersons()}</select>
          <button class="btn primary" data-role="autor">${icon("arrow-right")} Zur Prüfungserstellung</button></div>
        <div class="rolecard"><div class="rico">${icon("eye", "lg")}</div><h3>Prüfungseinsicht</h3>
          <ul><li>Einsicht immer in Präsenz</li><li>Person begleitet die Einsicht</li><li>Endnote und Abgabe mit Korrekturzeichen</li></ul>
          <label class="lbl mt-s" for="eisel">Person</label><select class="select" id="eisel">${optP(einsichtPersons().sort((a, b) => a.org.localeCompare(b.org) || a.lastname.localeCompare(b.lastname)), "t.riedmueller")}</select>
          <button class="btn primary" data-role="einsicht">${icon("arrow-right")} Zur Prüfungseinsicht</button></div>
        <div class="rolecard"><div class="rico">${icon("building-2", "lg")}</div><h3>Schuladministration</h3>
          <ul><li>Prüfungsebene: Teilnehmende, Raumaufsichten, Korrektoren zuordnen</li><li>Prüfungsräume und Raumaufsichten der eigenen Schule</li><li>Ergebnisse, Drittkorrektur</li></ul>
          <label class="lbl mt-s" for="sasel">Person</label><select class="select" id="sasel">${optP(P("schuladmin"), "m.hinrichs")}</select>
          <button class="btn primary" data-role="schuladmin">${icon("arrow-right")} Zu den Prüfungen</button></div>
      </div>
      <div class="demo-strip">
        <button class="btn" data-reset>${icon("rotate-ccw")} Demo zurücksetzen</button>
        <span class="badge gray" title="Stand der Oberfläche">${VERSION_LABEL}</span><span class="muted small">Setzt alle Daten (Kurse, Mitglieder, Status, Abgaben, Bewertungen, Protokoll) auf den Ausgangszustand zurück. Der Prüfungsbeginn von Raum 123 liegt danach 20 Minuten in der Zukunft.</span>
        <span class="grow"></span><span class="badge ${backend.mode === "local" ? "cyan" : "green"}" title="${backend.mode === "local" ? "Die Daten liegen in diesem Browser (IndexedDB). Live-Kopplung zwischen Tabs und Fenstern dieses Browsers; andere Geräte sehen eigene Daten." : "Die Daten liegen auf dem PocketBase-Server " + esc(backend.url) + "; alle Geräte sind live gekoppelt."}">${icon(backend.mode === "local" ? "hard-drive" : "server")} ${backend.mode === "local" ? "Daten im Browser" : "PocketBase-Server"}</span><button class="btn ghost sm" data-lockgate>${icon("lock")} Zugang sperren</button>
      </div>
    </div></div>`,
    mount(el) {
      el.querySelectorAll("[data-role]").forEach((b) => (b.onclick = () => {
        const r = b.dataset.role; const v = (id) => el.querySelector(id).value;
        if (r === "tn") { login(null, "tn", { pid: v("#pidsel") }); navigate("#/tn"); }
        if (r === "lehrkraft") { login(byId("persons", v("#lksel")), "lehrkraft"); navigate("#/app/kurse"); }
        if (r === "aufsicht") { login(byId("persons", v("#ausel")), "aufsicht"); const vr = visibleRooms(); navigate(vr.length === 1 ? `#/app/raum/${vr[0].id}/meinraum` : "#/app/raumaufsicht"); } // genau eine Raumaufsicht: direkt öffnen
        if (r === "korrektor") { const [pid, st] = v("#ksel").split("|"); login(byId("persons", pid), "korrektor", { corrector: +st }); navigate("#/app/korrektur"); }
        if (r === "schuladmin") { login(byId("persons", v("#sasel")), "schuladmin"); navigate("#/app/kurse"); }
        if (r === "autor") { login(byId("persons", v("#ersel")), "autor"); navigate("#/app/erstellung"); }
        if (r === "einsicht") { login(byId("persons", v("#eisel")), "einsicht"); navigate("#/app/pruefungseinsicht"); }
      }));
      el.querySelectorAll("[data-guide]").forEach((b) => (b.onclick = async () => { if ((b.hasAttribute("data-restart") || b.hasAttribute("data-switch")) && !(await confirmBox(b.hasAttribute("data-switch") ? "Andere Klickstrecke starten" : "Klickstrecke neu beginnen", "<p>Der bisherige Fortschritt der laufenden Klickstrecke wird verworfen. Ihre angelegten Daten bleiben erhalten.</p>", b.hasAttribute("data-switch") ? "Starten" : "Neu beginnen"))) return; GD.start(b.dataset.guide, b.hasAttribute("data-restart")); }));
      const gr = el.querySelector("[data-guideresume]"); if (gr) gr.onclick = () => GD.resume();
      const go = el.querySelector("[data-guideoff]"); if (go) go.onclick = () => { GD.discard(); render(); };
      el.querySelector("[data-lockgate]").onclick = () => lockGate();
      el.querySelector("[data-reset]").onclick = async () => { await resetDemo(); toast("Demo zurückgesetzt", "Alle Daten wurden auf den Ausgangszustand gesetzt."); render(); };
    },
  };
}

// Veraltete Oberfläche erkennen (z. B. Browser-Cache oder alter Server-Prozess)
async function checkVersion() {
  try {
    const v = await demoApi.version();
    if (v.version !== VERSION) toast("Versionskonflikt", `Oberfläche ${VERSION}, Server ${v.version}. Bitte alten Server beenden, neu starten und die Seite mit Strg+F5 neu laden.`, "warn", { sticky: true, action: { label: "Neu laden", run: () => location.reload() } });
  } catch {}
}

// ---------- Start ----------
async function boot() {
  root.innerHTML = `<div class="empty" style="padding-top:20vh">${icon("refresh-cw", "xl")}<p>Lade Prüfungsplattform …</p></div>`;
  try { await loadAll(); await subscribeAll(); checkVersion(); if (window.__reseeded) toast("Demodaten aktualisiert", "Die Datenbank stammte aus einer älteren Version und wurde automatisch auf den aktuellen Stand gebracht (u. a. aufgabenspezifische Materialien und Tickets).", "info", { ms: 9000 }); }
  catch (e) { root.innerHTML = backend.mode === "local" ? `<div class="empty" style="padding-top:20vh"><h2>Die Datenbank im Browser konnte nicht geöffnet werden</h2><p>Bitte ein privates Fenster vermeiden oder die Websitedaten für diese Seite zulassen.</p><pre>${esc(e.message)}</pre></div>` : `<div class="empty" style="padding-top:20vh"><h2>Keine Verbindung zum Server</h2><p>Bitte PocketBase starten (siehe README).</p><pre>${esc(e.message)}</pre></div>`; return; }
  onChange((c, ev) => {
    if (c === "_reset") { toast("Demo wurde zurückgesetzt", "", "info"); render(); return; }
    if (c === "_hb") { current?.onHeartbeat?.(ev); return; }
    refresh();
  });
  window.addEventListener("hashchange", () => render());
  // Zeitsteuerung der Prüfungen (Begutachtungszeitraum, Prüfungsstart)
  CR.autoAdvance(); setInterval(() => CR.autoAdvance(), 20000);
  // Vorschau: Herkunft merken (aus einem Kurs → zurück zum Kurs, aus dem Katalog → zurück zum Katalog)
  // Tabellenzeilen mit data-href: Klick in die Zeile öffnet den Eintrag (Schaltflächen und Links in der Zeile behalten ihre Funktion)
  document.addEventListener("click", (e) => {
    const pv = e.target.closest("[data-pvfrom]"); if (pv) store.set("pvfrom", { course: pv.dataset.pvfrom, tab: "info" });
    if (e.target.closest("[data-pvcat], a[href^='#/app/katalog']")) store.set("pvfrom", null);
    const tr = e.target.closest("tr[data-href]");
    if (tr && !e.target.closest("a, button, input, select, textarea, label")) navigate(tr.dataset.href);
  });
  document.addEventListener("change", (e) => { const cs = e.target.closest?.("[data-contentsel]"); if (cs) { sessionStorage.setItem("cbw.contentSel", JSON.stringify(cs.value)); redraw(); } });
  document.addEventListener("keydown", (e) => { const tr = e.target.closest?.("tr[data-href]"); if (tr && e.target === tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); navigate(tr.dataset.href); } });
  render();
}
boot();

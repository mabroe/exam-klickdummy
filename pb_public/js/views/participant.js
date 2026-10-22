// Prüfling: Wartebereich, Prüfungsmodus (Dashboard, Aufgaben, Abgaben), Endbildschirm, Kursvorschau
import { D, onChange, byId, upd, create, del, log, online, setting, createWithFile, demoApi } from "../data.js?v=8.3";
import { icon, esc, store, modal, confirmBox, toast, brand, popMenu, statusChip, endTime, mmss, parseDate, toPb, isFinished, isActive, isConnected, isOffline, HB_MS, $ } from "../ui.js?v=8.3";
import { EXAM, ALL_SUBTASKS, subtask, taskOf } from "../scenario.js?v=8.3";
import { navigate, session, render, directHelp } from "../app.js?v=8.3";
import * as W from "./dock.js?v=8.3";
import { einsichtView } from "./results.js?v=8.3";
// Punktebadge: grün, sobald für die (Teil-)Aufgabe eine Abgabe markiert ist, sonst grau
const ptsBadge = (done, label, title = "") => `<span class="badge ${done ? "lime" : "gray"}" title="${title || (done ? "Abgabe markiert" : "noch nicht bearbeitet")}">${label}</span>`;
const taskDone = (items, t) => t.subtasks.filter((s) => items.some((i) => i.submission === s.no)).length;


let hbTimer = null, tickTimer = null, countdownUntil = 0, lastStatus = null;
const ui = { navCollapsed: false, openAcc: { 1: true }, abgTab: "uebersicht", pdfPage: 1, openTree: { 1: true } };

// ---------- Prüfungssicherheit, Zeitansagen ----------
const THRESH = [30, 15, 10, 5, 1];
const announced = {};
let reconnectFlag = false, timeFlag = false, blockedMsg = null, secBound = false, wasFs = false;
function announce(text) { const l = document.querySelector("[data-live]"); if (!l) return; l.textContent = ""; setTimeout(() => (l.textContent = text), 60); }
// Tab-/Fensterwechsel und Verlassen des Vollbilds werden bewusst NICHT protokolliert (fachliche Vorgabe).
// Bei erzwungenem Vollbild erscheint nach dem Verlassen lediglich wieder die Aufforderung, das Vollbild zu aktivieren.
function bindSecurity() {
  if (secBound) return; secBound = true;
  document.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement && CTX && !CTX.preview) render(false); });
}
// Nach Ablauf der Bearbeitungszeit: kein hartes Ende, aber keine neue Aufgabe mehr öffnen
const timeOver = (ctx) => !ctx.preview && ctx.p.status === "zeit_beendet";
const allowedTask = (ctx) => store.get("curTask." + ctx.p.id);
const taskBlocked = (ctx, no) => timeOver(ctx) && String(no) !== String(allowedTask(ctx));
const hasLog = (p, action) => D.protocol.some((x) => x.username === p.username && x.action === action);

// ---------- Kontext (echter Prüfling oder Vorschau) ----------
const previewMem = {};
function makeCtx(preview, courseId) {
  if (preview) {
    if (!previewMem[courseId]) previewMem[courseId] = D.items.filter((i) => i.participant === "").map((i) => ({ ...i, id: "pv" + Math.random().toString(36).slice(2, 9), participant: "preview", data: { ...i.data } }));
    const mem = previewMem[courseId];
    const course = byId("catalog", courseId);
    return {
      preview: true, base: `#/app/vorschau/${courseId}`, course,
      p: { id: "preview", firstname: "Vorname", lastname: "Nachname", seat: "1-1", status: "laeuft", bookmarks: store.get("pvbm", []), extra_time: 0, nta: 0 },
      room: { duration_min: 90, state: "RUNNING", started_at: toPb(new Date(Date.now() - 5 * 60000)), global_extra: 0, paused_total_s: 0 },
      items: () => mem,
      async add(kind, folder, data, submission = "") { const r = { id: "pv" + Math.random().toString(36).slice(2, 9), participant: "preview", kind, folder, data, submission }; mem.push(r); W.refreshWindows(); refreshPage(); return r; },
      async upd(id, patch) { const r = mem.find((x) => x.id === id); Object.assign(r, patch); W.refreshWindows(); refreshPage(); return r; },
      async del(id) { const i = mem.findIndex((x) => x.id === id); if (i >= 0) mem.splice(i, 1); W.refreshWindows(); refreshPage(); },
      async setBookmarks(b) { store.set("pvbm", b); this.p.bookmarks = b; refreshPage(); },
    };
  }
  const p = byId("participants", session.pid);
  const room = p && byId("rooms", p.room);
  return {
    preview: false, base: "#/tn", p, room,
    items: () => D.items.filter((i) => i.participant === p.id),
    add: (kind, folder, data, submission = "") => create("items", { participant: p.id, kind, folder, data, submission }),
    addFile: (data, file) => createWithFile("items", { participant: p.id, kind: "file", folder: "own", data, submission: "" }, file),
    upd: (id, patch) => upd("items", id, patch),
    del: (id) => del("items", id),
    setBookmarks: (b) => upd("participants", p.id, { bookmarks: b }),
  };
}
let CTX = null;
const refreshPage = () => { const el = $("#tnpage"); if (el && CTX) { el.innerHTML = pageBody(CTX, curSub); bindPage(el, CTX, curSub); } };
let curSub = "";

export const submissionsFor = (items, st) => items.filter((i) => i.submission === st);
export const progressOf = (items) => {
  const done = ALL_SUBTASKS.filter((s) => items.some((i) => i.submission === s.no)).length;
  return Math.round((done / ALL_SUBTASKS.length) * 100);
};

// ---------- Einstieg ----------
export function route(sub, q) {
  if (session.role !== "tn" || !session.pid) return { redirect: "#/" };
  const ctx = makeCtx(false);
  if (!ctx.p) return { redirect: "#/" };
  CTX = ctx; W.setCtx(ctx);
  const p = ctx.p, room = ctx.room;
  if (!room) return simplePage("Kein Prüfungsraum", `<div class="endbox"><h1>Sie sind keinem Prüfungsraum zugeordnet</h1><p class="muted">Bitte wenden Sie sich an die Aufsicht.</p></div>`);

  const phase = isFinished(p.status) ? "end" : isActive(p.status) ? "exam" : "wait";
  if (phase === "exam" && lastStatus && !isActive(lastStatus)) { countdownUntil = Date.now() + 5000; document.querySelectorAll(".backdrop").forEach((b) => b.remove()); }
  lastStatus = p.status;
  if (phase === "wait") { W.closeAll(); return waitView(ctx); }
  if (phase !== "exam" && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  if (phase === "end" && sub === "einsicht" && setting("einsicht", {}).released) { W.closeAll(); return einsichtView(p.id, { participantView: true }); }
  if (phase === "end") { W.closeAll(); return endView(ctx); }
  const tm = sub.match(/^aufgabe\/(\d)/);
  if (tm && taskBlocked(ctx, tm[1])) { blockedMsg = tm[1]; return { redirect: "#/tn/dashboard" }; }
  W.setTask(tm ? tm[1] : null); // Werkzeuge nur innerhalb einer Aufgabe – jede Aufgabe mit eigenen Materialien und Fenstern
  return examView(ctx, sub, q);
}

export function preview(courseId, sub) {
  const ctx = makeCtx(true, courseId);
  CTX = ctx; W.setCtx(ctx);
  const tm = (sub || "").match(/^aufgabe\/(\d)/);
  W.setTask(tm ? tm[1] : null);
  return examView(ctx, sub, {});
}

let hbPid = null, lastBeat = 0;
function startHeartbeat(ctx) {
  clearInterval(tickTimer); tickTimer = null;
  if (ctx.preview) return;
  if (hbTimer && hbPid === ctx.p.id) return; // läuft bereits – nicht bei jedem Neuzeichnen neu starten
  clearInterval(hbTimer); hbPid = ctx.p.id;
  // Lebenszeichen alle 10 s – auch bei verdecktem Fenster (Browser drosseln Timer, 10 s bleiben aber erreichbar)
  const pid = ctx.p.id;
  const beat = () => { const cur = byId("participants", pid); if (!cur || isOffline(cur) || session.pid !== pid || session.role !== "tn") return; lastBeat = Date.now(); upd("participants", pid, { last_seen: toPb() }).catch(() => {}); };
  if (Date.now() - lastBeat > HB_MS / 2) beat();
  hbTimer = setInterval(beat, HB_MS);
  bindPagehide();
}
// Browser/Tab wird geschlossen: Verbindung sofort als unterbrochen melden (statt 30 s auf das Ausbleiben des Heartbeats zu warten)
let phBound = false;
function bindPagehide() {
  if (phBound) return; phBound = true;
  window.addEventListener("pagehide", () => {
    if (!CTX || CTX.preview || session.role !== "tn") return;
    demoApi.beacon("participants", CTX.p.id, { last_seen: toPb(new Date(Date.now() - 10 * 60000)) });
  });
}
function stopTimers() { clearInterval(hbTimer); clearInterval(tickTimer); hbTimer = tickTimer = null; }
const stopTick = () => { clearInterval(tickTimer); tickTimer = null; }; // Heartbeat läuft beim Neuzeichnen weiter

let loginRunning = false;
async function ensureLogin(ctx) {
  if (loginRunning) return; loginRunning = true;
  try { await doLogin(ctx); } finally { loginRunning = false; }
}
async function doLogin(ctx) {
  const p = ctx.p;
  if (p.status === "nicht_eingeloggt") {
    await upd("participants", p.id, { status: "wartend", last_seen: toPb(), simulated: false });
    log(p.room, p, "Teilnehmende/r hat sich angemeldet", "", "system");
  } else if (!isConnected(p)) {
    upd("participants", p.id, { last_seen: toPb() }).catch(() => {});
  }
  if (!D.items.some((i) => i.participant === p.id && i.kind !== "note" && i.folder !== "own" && i.folder !== "sent")) {
    // Arbeitsmaterialien beim ersten Login kopieren (Copy-on-Login)
    const globals = D.items.filter((i) => i.participant === "");
    for (const g of globals) await create("items", { participant: p.id, kind: g.kind, folder: g.folder, data: { ...g.data, read: false }, submission: "" });
  }
}

// ---------- Wartebereich ----------
function waitView(ctx) {
  const p = ctx.p, room = ctx.room;
  const confirmedBoth = p.cheat_ack && p.health === "ok";
  return {
    reroute: true,
    title: "Wartebereich",
    render: () => {
      const ps = parseDate(room.planned_start);
      return `<header class="topbar">${brand()}<div class="usermenu"><button data-um>${icon("circle-user", "lg")}<span class="nm">${esc(p.firstname)} ${esc(p.lastname)}</span>${icon("chevron-down")}</button></div></header>
      <div class="tn-page">
        <h1 class="mb">Wartebereich</h1>
        <div class="warte">
          <section class="pdfbox"><h3>Wichtige Informationen zur Prüfung</h3>
            <div class="pdfviewer">
              <div><div class="pdftool"><button class="iconbtn" data-pgstep="-1" ${ui.pdfPage <= 1 ? "disabled" : ""} aria-label="Vorherige Seite">${icon("chevron-left")}</button><span class="input" style="min-height:24px;width:52px;padding:0 6px;display:inline-grid;place-items:center">${ui.pdfPage}</span> von 3<button class="iconbtn" data-pgstep="1" ${ui.pdfPage >= 3 ? "disabled" : ""} aria-label="Nächste Seite">${icon("chevron-right")}</button><span class="grow"></span><span class="xs muted">Wichtige_Informationen.pdf</span></div>
                <div class="pdfpage"><div class="sheet">${pdfContent(ui.pdfPage, room)}</div></div></div>
              <div class="thumbs" aria-label="Seitenvorschau">${[1, 2, 3].map((n) => `<button class="thumb ${n === ui.pdfPage ? "active" : ""}" data-pg="${n}" aria-label="Seite ${n} anzeigen" aria-current="${n === ui.pdfPage}"><span class="thumbmini" aria-hidden="true"><span class="sheet">${pdfContent(n, room)}</span></span><span class="thumbno">Seite ${n}</span></button>`).join("")}</div>
            </div>
          </section>
          <div class="col" style="gap:18px">
            <div class="wcard countdown"><h3>${room.state === "RUNNING" ? "Die Prüfung läuft" : "Countdown bis zur Prüfung"}</h3><span class="big">${icon("alarm-clock")}<span data-countdown>${room.state === "RUNNING" ? "gestartet" : "–"}</span></span></div>
            ${card("Belehrung zu Täuschungshandlungen", p.cheat_ack, "Bitte lesen Sie die Belehrung zu Täuschungshandlungen und bestätigen Sie, dass Sie diese zur Kenntnis genommen haben.", "Zur Belehrung", "cheat")}
            ${card("Gesundheitsabfrage", p.health === "ok", "Bitte bestätigen Sie, dass Sie sich gesundheitlich in der Lage fühlen, die Prüfung abzulegen.", "Zur Gesundheitsabfrage", "health")}
            <div class="wcard"><h3>Demobereich</h3><p>Lernen Sie den Prüfungsmodus in einer kurzen Klickstrecke kennen: Kopfzeile, Dashboard, Aufgaben, Fenster, Abgaben markieren und Prüfung beenden.</p><div class="row end"><button class="btn primary" data-demo>Demo starten</button></div></div>
            ${confirmedBoth ? `<div class="notice success">${icon("circle-check")}<div><b>Alles bestätigt.</b> ${room.state === "RUNNING" ? (p.present ? "Die Prüfung startet gleich." : "Die Aufsicht muss noch Ihre Anwesenheit bestätigen.") : "Die Prüfung startet, sobald die Aufsicht sie freigibt."}</div></div>` : ""}
          </div>
        </div>
      </div>`;
    },
    async mount(el) {
      startHeartbeat(ctx);
      await ensureLogin(ctx);
      el.querySelector("[data-um]").onclick = (e) => popMenu(e.currentTarget, [{ label: "Rolle wechseln", icon: "refresh-cw", run: () => navigate("#/") }]);
      el.querySelectorAll("[data-pg]").forEach((b) => (b.onclick = () => { ui.pdfPage = +b.dataset.pg; render(false); }));
      el.querySelectorAll("[data-pgstep]").forEach((b) => (b.onclick = () => { ui.pdfPage = Math.max(1, Math.min(3, ui.pdfPage + +b.dataset.pgstep)); render(false); }));
      const cb = el.querySelector("[data-cheat]"); if (cb) cb.onclick = () => cheatModal(ctx);
      const hb = el.querySelector("[data-health]"); if (hb) hb.onclick = () => healthModal(ctx);
      el.querySelector("[data-demo]").onclick = () => import("./tour.js?v=8.3").then((m) => m.startTour()); // nur auf Klick, kein automatischer Start
      // Prüfung läuft bereits, Bestätigung fehlt
      if (room.state === "RUNNING" && !confirmedBoth && !document.querySelector(".backdrop") && !store.get("bo." + p.id)) {
        store.set("bo." + p.id, 1);
        modal({ title: "Bestätigung offen", warn: true, size: "narrow", body: `<p>Die Prüfung hat bereits begonnen und Sie haben ${!p.cheat_ack ? "die Erklärung zu den Täuschungsversuchen" : "die Gesundheitsabfrage"} noch nicht bestätigt.</p>`, footer: `<button class="btn primary" data-value="go">Jetzt bestätigen</button>` })
          .then((v) => v === "go" && (!p.cheat_ack ? cheatModal(ctx) : healthModal(ctx)));
      }
      const tick = () => {
        const c = el.querySelector("[data-countdown]"); if (!c) return;
        if (room.state === "RUNNING") return;
        const ms = parseDate(room.planned_start) - Date.now();
        c.textContent = ms > 0 ? (ms > 3600000 ? mmss(ms) + " h" : mmss(ms) + " Minuten") : "in Kürze";
        if (ms > 0 && ms < 5 * 60000 && !confirmedBoth && !store.get("warn5." + p.id)) {
          store.set("warn5." + p.id, 1);
          toast("Die Prüfung beginnt in 5 Minuten", "Sie haben die Erklärung zu den Täuschungsversuchen noch nicht bestätigt.", "warn", { sticky: true, action: { label: "Jetzt bestätigen", run: () => (!p.cheat_ack ? cheatModal(ctx) : healthModal(ctx)) } });
        }
      };
      tick(); tickTimer = setInterval(tick, 1000);
    },
    unmount: stopTick,
  };
}
function card(title, ok, text, btn, key) {
  return `<div class="wcard"><div class="top"><h3>${title}</h3>${ok ? `<span class="okflag ok">${icon("circle-check")} Bestätigt</span>` : `<span class="okflag open">${icon("triangle-alert")} Bestätigung offen</span>`}</div>
  <p>${text}</p>${ok ? "" : `<div class="row end"><button class="btn primary" data-${key}>${btn}</button></div>`}</div>`;
}
function pdfContent(n, room) {
  if (n === 1) return `<h3>${esc(room.exam_name)}</h3><p class="mt">Raum: ${esc(room.name)}<br>Bearbeitungszeit: ${room.duration_min} Minuten</p><p>Die Prüfung besteht aus drei Aufgaben mit insgesamt 85 Punkten. Alle Arbeitsmaterialien stehen in der Prüfungsumgebung zur Verfügung.</p><p>Bitte schalten Sie Mobiltelefone und Smartwatches aus und legen Sie diese an den dafür vorgesehenen Platz.</p>`;
  if (n === 2) return `<h3>Ablauf</h3><ol><li>Belehrung bestätigen</li><li>Gesundheitsabfrage beantworten</li><li>Start durch die Aufsicht abwarten</li><li>Aufgaben bearbeiten und Ergebnisse als Abgabe markieren</li><li>Prüfung beenden</li></ol>`;
  return `<h3>Hinweise zur Abgabe</h3><p>Bewertet werden nur Elemente, die Sie als Abgabe einer Teilaufgabe markiert haben: Dateien, E-Mails, Termine, Notizen, Tickets oder Code-Dateien.</p><p>Die Abgabenübersicht zeigt Ihnen jederzeit, welche Teilaufgaben noch offen sind.</p>`;
}
const CHEAT_TEXT = `<div class="input" style="height:220px;overflow:auto;white-space:normal"><p><b>§ 22 Täuschungshandlungen, Ordnungsverstöße</b></p>
<p>(1) Wer es unternimmt, das Prüfungsergebnis durch Täuschung oder Benutzung nicht zugelassener Hilfsmittel zu beeinflussen, oder wer nicht zugelassene Hilfsmittel nach Bekanntgabe der Prüfungsaufgaben mit sich führt oder Beihilfe zu einer Täuschung oder einem Täuschungsversuch leistet, begeht eine Täuschungshandlung.</p>
<p>(2) Wird während der Prüfung eine Täuschungshandlung festgestellt oder entsteht ein entsprechender Verdacht, ist der Sachverhalt von einer aufsichtführenden Lehrkraft festzustellen und zu protokollieren. Der Prüfling setzt die Prüfung bis zur Entscheidung über die Täuschungshandlung vorbehaltlich fort.</p>
<p>(3) Liegt eine Täuschungshandlung vor, wird die von der Täuschungshandlung betroffene Prüfungsleistung mit „ungenügend“ (0 Punkte) bewertet. In schweren Fällen kann die gesamte Prüfung für nicht bestanden erklärt werden.</p></div>`;
function cheatModal(ctx) {
  modal({ title: "Belehrung zu Täuschungshandlungen", warn: true, body: CHEAT_TEXT, footer: `<button class="btn primary" data-value="ok">Bestätigen</button>` }).then(async (v) => {
    if (v !== "ok") return;
    await setConfirm(ctx, { cheat_ack: true });
    log(ctx.p.room, ctx.p, "Belehrung zu Täuschungshandlungen bestätigt", "", "system");
    toast("Belehrung bestätigt");
  });
}
function healthModal(ctx) {
  modal({ title: "Gesundheitsabfrage", warn: true, body: `<p>Bitte bestätigen Sie, dass Sie sich gesundheitlich in der Lage fühlen, jetzt die Prüfung abzulegen.</p><p><button class="link" data-info>${icon("external-link")} Weitere Informationen zu Nichtteilnahme oder Rücktritt</button></p>`,
    footer: `<button class="btn" data-value="no">Nicht bestätigen</button><button class="btn primary" data-value="ok">Bestätigen</button>`,
    onMount: (m) => (m.querySelector("[data-info]").onclick = () => modal({ title: "Nichtteilnahme oder Rücktritt", size: "narrow", body: "<p>Wer aus gesundheitlichen Gründen nicht an der Prüfung teilnehmen kann, muss dies unverzüglich der Aufsicht mitteilen und ein ärztliches Attest nachreichen.</p>" })),
  }).then(async (v) => {
    if (v === "ok") { await setConfirm(ctx, { health: "ok" }); log(ctx.p.room, ctx.p, "Gesundheitsabfrage bestätigt", "", "system"); toast("Gesundheitsabfrage bestätigt"); }
    if (v === "no") {
      const sure = await modal({ title: "Sind Sie sich sicher, dass Sie die Gesundheitsfrage nicht bestätigen wollen?", warn: true, body: `<p>Wenn Sie aus gesundheitlichen Gründen nicht an der Prüfung teilnehmen können, informieren Sie bitte die Aufsicht.</p><p>Diese Entscheidung ist <b>nicht</b> widerrufbar.</p>`, footer: `<button class="btn" data-value="back">Abbrechen</button><button class="btn primary" data-value="no">Nicht teilnehmen</button>` });
      if (sure === "no") { await upd("participants", ctx.p.id, { health: "declined", status: "nicht_teilnahme" }); log(ctx.p.room, ctx.p, "Gesundheitsabfrage nicht bestätigt – Nichtteilnahme", "", "vorkommnis"); }
      else if (sure === "back") healthModal(ctx);
    }
  });
}
async function setConfirm(ctx, patch) {
  const p = ctx.p; const next = { ...p, ...patch };
  const both = next.cheat_ack && next.health === "ok";
  if (both) patch.status = ctx.room.state === "RUNNING" && p.present ? "laeuft" : "wartend_bestaetigt";
  if (patch.status === "laeuft") patch.started_at = toPb();
  await upd("participants", p.id, patch);
}

// ---------- Endbildschirm ----------
function endView(ctx) {
  const p = ctx.p;
  const texts = {
    eingesammelt: ["Ihre Prüfung wurde eingesammelt", "Die Aufsicht hat Ihre Prüfung eingesammelt. Ihre markierten Abgaben wurden übermittelt."],
    zeit_beendet: ["Die Bearbeitungszeit ist abgelaufen", "Ihre markierten Abgaben wurden automatisch übermittelt."],
    abgegeben: ["Sie haben Ihre Prüfung abgegeben", "Ihre markierten Abgaben wurden übermittelt. Eine weitere Bearbeitung ist nicht möglich. Die Aufsicht schließt die Prüfung ab – bitte bleiben Sie bis dahin auf Ihrem Platz bzw. folgen Sie den Anweisungen der Aufsicht."],
    beendet: ["Die Prüfung wurde beendet", "Die Aufsicht hat die Prüfung beendet. Ihre markierten Abgaben wurden übermittelt."],
    nicht_teilnahme: ["Sie nehmen nicht an der Prüfung teil", "Bitte melden Sie sich bei der Aufsicht."],
  }[p.status] || ["Prüfung beendet", ""];
  const subs = ctx.items().filter((i) => i.submission);
  return {
    reroute: true,
    title: "Prüfung beendet",
    render: () => `<header class="topbar">${brand()}<span class="bold">${esc(p.firstname)} ${esc(p.lastname)}</span></header>
    <div class="endbox"><div class="ok">${icon(p.status === "nicht_teilnahme" ? "circle-x" : "circle-check", "xl")}</div><h1>${texts[0]}</h1><p class="lead mt">${texts[1]}</p>
    ${p.status !== "nicht_teilnahme" ? `<div class="card pad mt" style="text-align:left"><h3>Übermittelte Abgaben (${subs.length})</h3>${ALL_SUBTASKS.map((s) => { const n = subs.filter((i) => i.submission === s.no).length; return `<div class="row between small" style="padding:4px 0;border-bottom:1px solid var(--line-2)"><span>${s.no} ${esc(s.title)}</span>${n ? `<span class="badge green">${n} Abgabe${n > 1 ? "n" : ""}</span>` : `<span class="badge gray">keine Abgabe</span>`}</div>`; }).join("")}</div>` : ""}
    ${p.status !== "nicht_teilnahme" ? (setting("einsicht", {}).released ? `<div class="notice success mt" style="justify-content:center">${icon("circle-check")}<span>Die Prüfungseinsicht ist freigegeben.</span></div><p class="mt"><a class="btn primary" href="#/tn/einsicht">${icon("eye")} Prüfungseinsicht öffnen</a></p>` : `<p class="muted small mt">Die Prüfungseinsicht wird nach Abschluss der Korrektur freigegeben.</p>`) : ""}
    <p class="mt-l"><a class="btn" href="#/">Zur Rollenwahl</a></p></div>`,
    mount() { stopTimers(); },
  };
}

function simplePage(title, html) { return { title, render: () => `<header class="topbar">${brand()}</header>${html}` }; }

// ---------- Prüfungsmodus ----------
function examView(ctx, sub, q) {
  curSub = sub;
  const p = ctx.p;
  return {
    reroute: !ctx.preview,
    title: ctx.preview ? "Kursvorschau" : "Prüfung",
    render: () => `${examHead(ctx)}<div class="tn-page" id="tnpage">${pageBody(ctx, sub)}</div>${dock(ctx, sub)}${overlay(ctx)}`,
    async mount(el) {
      // Sperrbildschirm (Pause, Sperre, Verbindungsabbruch, Vollbild): alles dahinter ausblenden und unbedienbar machen
      const locked = !!el.querySelector(".fullgray");
      document.body.classList.toggle("exam-locked", locked);
      el.querySelectorAll("#tnpage, .examhead, .dock").forEach((n) => (n.inert = locked));
      const wl = document.getElementById("winlayer"); if (wl) wl.inert = locked;
      if (locked) { document.querySelectorAll(".backdrop, .drawer, .drawer-back, .popmenu, .winchooser").forEach((b) => b.remove()); el.querySelector(".fullgray button")?.focus(); }
      bindPage(el.querySelector("#tnpage"), ctx, sub);
      bindDock(el, ctx);
      W.restore(); W.bindOutsideMinimize();
      if (!ctx.preview) { startHeartbeat(ctx); ensureLogin(ctx); bindSecurity(); }
      const sk = document.querySelector("[data-skip]"); if (sk) sk.onclick = () => { const m = document.getElementById("tnpage"); m.setAttribute("tabindex", "-1"); m.focus(); };
      const fs = document.querySelector("[data-fs]");
      if (fs) fs.onclick = () => document.documentElement.requestFullscreen().then(() => { wasFs = true; render(false); }).catch(() => toast("Vollbild nicht verfügbar", "Ihr Browser erlaubt den Vollbildmodus hier nicht. Fortfahren ohne Vollbild ist im Klickdummy möglich.", "warn"));
      const fss = document.querySelector("[data-fsskip]"); if (fss) fss.onclick = () => { store.set("fsskip." + p.id, 1); render(false); };
      if (blockedMsg) { const n = blockedMsg; blockedMsg = null; blockedModal(ctx, n); }
      if (!announced[p.id]) { announced[p.id] = new Set(); const e0 = endTime(ctx.room, ctx.p); const ms0 = e0 ? e0 - Date.now() : Infinity; THRESH.forEach((t) => { if (ms0 <= t * 60000) announced[p.id].add(t); }); }
      const tick = () => {
        const t = document.querySelector("[data-timer]"); if (!t) return;
        const end = endTime(ctx.room, ctx.p);
        const ms = end ? end - Date.now() : (ctx.room.duration_min || 90) * 60000;
        t.textContent = ms > 0 ? mmss(ms) : "+" + mmss(-ms);
        t.parentElement.classList.toggle("warn", ms < 5 * 60000);
        t.parentElement.title = ms > 0 ? "Verbleibende Bearbeitungszeit" : "Bearbeitungszeit abgelaufen – überzogen um";
        const cd = document.querySelector("[data-startcd]");
        if (cd) { const left = countdownUntil - Date.now(); if (left <= 0) { countdownUntil = 0; render(false); return; } cd.textContent = "00:0" + Math.ceil(left / 1000); }
        if (!ctx.preview && ms > 0) {
          const crossed = THRESH.filter((th) => ms <= th * 60000 && !announced[p.id].has(th));
          if (crossed.length) { crossed.forEach((th) => announced[p.id].add(th)); const th = Math.min(...crossed); const left = Math.ceil(ms / 60000);
            announce(`Noch ${left} ${left === 1 ? "Minute" : "Minuten"} Bearbeitungszeit.`);
            if (th <= 5) toast(`Noch ${left} ${left === 1 ? "Minute" : "Minuten"} Bearbeitungszeit`, "Denken Sie daran, Ihre Ergebnisse als Abgabe zu markieren.", "warn"); }
        }
        // Sperrbildschirm muss immer dem aktuellen Zustand entsprechen (z. B. Pause/Abbruch während einer Eingabe)
        if (!ctx.preview) { const fresh = byId("participants", ctx.p.id); if (fresh && fresh !== ctx.p) { ctx.p = fresh; ctx.room = byId("rooms", fresh.room) || ctx.room; }
          const want = !!overlay(ctx), have = !!document.querySelector(".fullgray"); if (want !== have) { render(false); return; } }
        // Verbindung automatisch wiederhergestellt → direkt weiterarbeiten, aber dokumentieren
        if (!ctx.preview && ctx.p.offline_until && parseDate(ctx.p.offline_until) <= Date.now() && !reconnectFlag) {
          reconnectFlag = true;
          const since = [...D.protocol].reverse().find((x) => x.username === ctx.p.username && x.action === "Verbindung unterbrochen");
          const secs = since ? Math.round((Date.now() - parseDate(since.ts)) / 1000) : null;
          upd("participants", ctx.p.id, { offline_until: "", last_seen: toPb() }).then(() => {
            log(ctx.p.room, ctx.p, "Verbindung wiederhergestellt", secs ? `automatisch, Unterbrechung ca. ${secs} s` : "automatisch", "system");
            toast("Verbindung wiederhergestellt", "Sie können direkt weiterarbeiten. Ihre Eingaben sind vollständig erhalten.");
          }).finally(() => (reconnectFlag = false));
        }
        // Zeitablauf: kein hartes Ende – Status „Bearbeitungszeit beendet“, Prüfung läuft weiter
        if (!ctx.preview && ctx.room.state === "RUNNING" && !timeFlag) {
          if (ms <= 0 && ctx.p.status === "laeuft") {
            timeFlag = true;
            upd("participants", ctx.p.id, { status: "zeit_beendet" }).then(() => { if (!hasLog(ctx.p, "Bearbeitungszeit abgelaufen")) log(ctx.p.room, ctx.p, "Bearbeitungszeit abgelaufen", "Prüfung läuft weiter, neue Aufgaben gesperrt", "system"); }).finally(() => (timeFlag = false));
          } else if (ms > 0 && ctx.p.status === "zeit_beendet") {
            timeFlag = true;
            upd("participants", ctx.p.id, { status: "laeuft" }).then(() => log(ctx.p.room, ctx.p, "Bearbeitungszeit verlängert", "Aufgaben wieder freigegeben", "system")).finally(() => (timeFlag = false));
          }
        }
      };
      tick(); clearInterval(tickTimer); tickTimer = setInterval(tick, 1000);
      // Ausgangssituation beim ersten Öffnen einer Aufgabe
      const tm = sub.match(/^aufgabe\/(\d)/);
      if (tm && !timeOver(ctx)) store.set("curTask." + p.id, tm[1]); // zuletzt bearbeitete Aufgabe
      if (tm && !store.get(`sit.${p.id}.${tm[1]}`)) { store.set(`sit.${p.id}.${tm[1]}`, 1); situationModal(taskOf(tm[1])); }
    },
    unmount() { stopTick(); document.body.classList.remove("exam-locked"); const wl = document.getElementById("winlayer"); if (wl) wl.inert = false; },
  };
}

function examHead(ctx) {
  const p = ctx.p; const prog = progressOf(ctx.items());
  const conn = ctx.preview || online;
  const plus = (p.nta || 0) + (p.extra_time || 0) + (ctx.room.global_extra || 0);
  return `<button class="skiplink" data-skip>Zum Inhalt springen</button><div class="sr-only" aria-live="assertive" data-live></div><header class="examhead"><div class="examname"><span class="logo-mini"><b></b><i></i></span>${esc(ctx.preview ? ctx.course?.title || EXAM.name : ctx.room.exam_name)}${ctx.preview ? `<span class="preview-banner">${icon("eye")} Sie befinden sich im Vorschaumodus</span>` : ""}</div>
  <div><div class="who">${esc(p.firstname)} ${esc(p.lastname)}&nbsp;&nbsp;P: ${esc(p.seat)}</div>
  <div class="meta"><span class="timer" title="Verbleibende Bearbeitungszeit">${icon("clock")} <span data-timer>--:--</span></span><span title="Fortschritt"><span class="progressbar"><i style="width:${prog}%"></i></span> ${prog}%</span><span class="conn ${conn ? "" : "off"}" title="${conn ? "Verbunden" : "Keine Verbindung"}">${icon("radio")}</span></div>${plus ? `<div class="xs" style="text-align:right;font-weight:600" title="Bereits in der Restzeit enthalten">inkl. ${p.nta ? `${p.nta} Min. Nachteilsausgleich` : ""}${p.nta && (p.extra_time || ctx.room.global_extra) ? " + " : ""}${(p.extra_time || 0) + (ctx.room.global_extra || 0) ? `${(p.extra_time || 0) + (ctx.room.global_extra || 0)} Min. Zusatzzeit` : ""}</div>` : ""}</div></header>`;
}

function overlay(ctx) {
  if (ctx.preview) return "";
  const p = ctx.p, room = ctx.room;
  if (countdownUntil > Date.now()) return `<div class="fullgray dim"><div class="startbox"><div class="bold">Die Prüfung startet in</div><div class="big">${icon("alarm-clock")}<span data-startcd>00:05</span> Sekunden</div></div></div>`;
  if (room.state === "PAUSED" || p.status === "pausiert") return `<div class="fullgray" role="alertdialog" aria-label="Prüfung pausiert"><div class="startbox"><div class="big">${icon("circle-pause")} Prüfung pausiert</div><p class="small muted">Der Bildschirminhalt ist während der Pause vollständig ausgeblendet.</p><p>Bitte warten Sie, bis die Aufsicht die Prüfung fortsetzt. Die Bearbeitungszeit ${room.state === "PAUSED" ? "wird angehalten" : "läuft weiter, sofern die Aufsicht keine Zusatzzeit vergibt"}.</p></div></div>`;
  if (isOffline(p)) return `<div class="fullgray" role="alertdialog" aria-label="Verbindung unterbrochen"><div class="startbox"><div class="big" style="font-size:30px">${icon("refresh-cw", "spin")} Verbindung unterbrochen</div><p>Ihre bisherigen Eingaben sind gesichert. Die Verbindung wird automatisch wiederhergestellt – danach können Sie direkt weiterarbeiten.<br><span class="small muted">Der Abbruch wird protokolliert. Die Aufsicht kann verlorene Zeit als Zusatzzeit gutschreiben.</span></p></div></div>`;
  if (room.lockdown && ["laeuft", "zeit_beendet"].includes(p.status) && !document.fullscreenElement && !store.get("fsskip." + p.id)) return `<div class="fullgray" role="alertdialog" aria-label="Vollbildmodus erforderlich"><div class="startbox" style="max-width:560px"><div class="big" style="font-size:28px">${icon("maximize")} Vollbildmodus erforderlich</div><p>Die Prüfung wird im Vollbildmodus durchgeführt. Bitte aktivieren Sie das Vollbild, um weiterzuarbeiten.</p><button class="btn primary" data-fs>${icon("maximize")} Vollbild aktivieren und fortfahren</button><p class="mt"><button class="link xs" data-fsskip>Ohne Vollbild fortfahren (nur im Klickdummy)</button></p></div></div>`;
  if (p.status === "gesperrt") return `<div class="fullgray"><div class="startbox"><div class="big">${icon("ban")} Zugang gesperrt</div><p>Ihr Zugang zur Prüfung wurde von der Aufsicht gesperrt. Bitte melden Sie sich bei der Aufsicht.</p></div></div>`;
  return "";
}

function navTree(ctx, sub) {
  const items = ctx.items();
  const act = (h) => (("#/" + "x/" + sub).endsWith(h) ? "active" : "");
  return `<aside class="tn-nav"><div class="nh"><span class="roundico">${icon("menu")}</span><button class="iconbtn" data-collapse aria-label="Navigation einklappen">${icon("chevron-left", "lg")}</button></div>
  <ul><li><a href="${ctx.base}/dashboard" class="${sub === "dashboard" || sub === "" ? "active" : ""}">${icon("house")} Dashboard</a></li>
  <li><a href="${ctx.base}/abgaben" class="${sub === "abgaben" ? "active" : ""}">${icon("list-checks")} Abgaben</a></li>
  <li><button data-tree="all">${icon("clipboard-list")} <span class="grow">Aufgaben</span>${icon(ui.openTree.all !== false ? "chevron-up" : "chevron-down")}</button>
  ${ui.openTree.all !== false ? `<ul>${EXAM.tasks.map((t) => `<li><a href="${ctx.base}/aufgabe/${t.no}" class="${sub === "aufgabe/" + t.no ? "active" : ""}"><span>${t.no} ${esc(t.title)}</span>${ptsBadge(taskDone(items, t) > 0, t.points, `${taskDone(items, t)} von ${t.subtasks.length} Teilaufgaben mit Abgabe`)}</a>
    ${(sub.startsWith("aufgabe/" + t.no)) ? `<ul>${t.subtasks.map((s) => `<li><a href="${ctx.base}/aufgabe/${t.no}/${s.no}" class="${sub === `aufgabe/${t.no}/${s.no}` ? "active" : ""}"><span>${items.some((i) => i.submission === s.no) ? icon("check") : ""} ${s.no} ${esc(s.title)}</span><span class="badge ${items.some((i) => i.submission === s.no) ? "lime" : "gray"}">${s.points}</span></a></li>`).join("")}</ul>` : ""}</li>`).join("")}</ul>` : ""}</li></ul></aside>`;
}

function pageBody(ctx, sub) {
  const parts = sub.split("/");
  const grid = (inner) => `<div class="tn-grid ${ui.navCollapsed ? "collapsed" : ""}">${navTree(ctx, sub)}<div>${inner}</div></div>`;
  const endBtn = ctx.preview ? `<a class="btn" href="#/app/katalog/${ctx.course?.id || ""}">${icon("arrow-left")} Vorschau beenden</a><button class="btn primary" data-copy>${icon("copy")} Kurs kopieren</button>` : `<button class="btn soft" data-finish>Prüfung beenden</button>`;
  const over = timeOver(ctx) ? `<div class="notice warn mb" role="status">${icon("alarm-clock")}<span><b>Die Bearbeitungszeit ist abgelaufen.</b> ${allowedTask(ctx) ? `Sie können Aufgabe ${esc(allowedTask(ctx))} noch abschließen und Abgaben markieren;` : ""} neue Aufgaben können nicht mehr geöffnet werden. Die Prüfung wird durch die Aufsicht eingesammelt.</span></div>` : "";
  const head = (t) => over + `<div class="taskhead"><h1>${t}</h1><div class="row"><button class="helpbtn" data-help aria-label="Hilfe"><span class="q">?</span></button>${endBtn}</div></div>`;

  if (parts[0] === "abgaben") return head("Abgaben") + grid(abgabenBody(ctx));
  if (parts[0] === "info") return head(EXAM.info.title) + grid(`<div class="card pad">${EXAM.info.items.map(([k, v]) => `<div class="kv">${icon("info")}<div><b>${k}</b><br>${v}</div></div>`).join("")}</div>`);
  if (parts[0] === "fragen") return head("Allgemeine Fragen") + grid(EXAM.faq.map(([qq, a], i) => `<div class="acc"><button data-faq="${i}"><b>${qq}</b>${icon("chevron-down")}</button><div class="acc-b ${ui["faq" + i] ? "" : "hidden"}">${a}</div></div>`).join(""));
  if (parts[0] === "aufgabe") {
    const t = taskOf(parts[1]); if (!t) return "Aufgabe nicht gefunden";
    const st = parts[2] ? subtask(parts[2]) : null;
    const bm = (ctx.p.bookmarks || []).includes(st ? st.no : t.no);
    return over + `<div class="taskhead"><h1>${st ? `Teilaufgabe ${st.no} ${esc(st.title)}` : `Aufgabe ${t.no} ${esc(t.title)}`}</h1>
      <div class="row wrap">${st ? `<button class="btn ghost sm" data-restart>${icon("rotate-ccw")} Aufgabe neu starten</button>` : ""}<button class="btn ghost sm" data-bookmark>${icon(bm ? "bookmark-check" : "bookmark")} ${bm ? "Aufgabe gemerkt" : "Aufgabe merken"}</button>${endBtn}</div></div>` + grid(taskBody(ctx, t, st));
  }
  // Dashboard
  return head("Dashboard") + dashBody(ctx);
}

function dashBody(ctx) {
  const items = ctx.items();
  const prog = progressOf(items);
  return `<div class="dash ${ui.navCollapsed ? "collapsed" : ""}">${navTree(ctx, "dashboard")}
  <div class="tilecol">
    <div class="tile"><span class="round">${icon("info")}</span><h3>Prüfungsinformationen</h3><a class="linkarrow" href="${ctx.base}/info">Aufrufen ${icon("arrow-right")}</a></div>
    <div class="tile">${companyLogo()}<h3>Ausgangssituation der Prüfung</h3><p>${esc(EXAM.ausgangssituation.slice(0, 130))} …</p><button class="linkarrow" data-sit="0">Aufrufen ${icon("arrow-right")}</button></div>
    <div class="tile"><span class="round">${icon("circle-question-mark")}</span><h3>Allgemeine Fragen</h3><a class="linkarrow" href="${ctx.base}/fragen">Aufrufen ${icon("arrow-right")}</a></div>
  </div>
  <section class="panel progresscol"><div class="ph"><span>Fortschritt</span><span class="small" style="font-weight:400">Gesamt <span class="miniprogress"><i style="width:${prog}%"></i></span> ${prog}%</span></div>
  ${EXAM.tasks.map((t) => {
    const done = t.subtasks.filter((s) => items.some((i) => i.submission === s.no)).length;
    const pr = Math.round((done / t.subtasks.length) * 100);
    const open = ui.openAcc[t.no];
    return `<div class="acc"><button data-acc="${t.no}"><div><div><b>Aufgabe ${t.no}:</b> ${esc(t.title)}</div><div class="small mt-s">Fortschritt <span class="miniprogress"><i style="width:${pr}%"></i></span> ${pr}%</div></div>${icon(open ? "chevron-up" : "chevron-down")}</button>
    ${open ? `<div class="acc-b">${t.subtasks.map((s) => { const has = items.some((i) => i.submission === s.no); return `<a class="subtask" href="${ctx.base}/aufgabe/${t.no}/${s.no}"><span class="stico ${has ? "done" : "todo"}">${icon(has ? "check" : "square-pen")}</span><span class="grow">${s.no} ${esc(s.title)}</span><span class="linkarrow">${icon("arrow-right")} Zur Teilaufgabe</span></a>`; }).join("")}</div>` : ""}</div>`;
  }).join("")}</section></div>`;
}

function companyLogo(size = 64) {
  return `<svg class="company-logo" style="width:${size}px;height:${size}px" viewBox="0 0 64 64" aria-label="FunSport Logo"><circle cx="38" cy="12" r="6" fill="#f08a24"/><path d="M14 30 L30 22 L44 26 L54 18" stroke="#1f7fc4" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M30 22 L24 40 L34 48" stroke="#f08a24" stroke-width="6" fill="none" stroke-linecap="round"/><text x="32" y="60" font-size="10" text-anchor="middle" font-weight="700" fill="#174a7c" font-family="Arial">FunSport</text></svg>`;
}

function taskBody(ctx, t, st) {
  const all = ctx.items();
  const items = all.filter((i) => W.itemTask(i) === t.no); // aufgabenspezifische Materialien
  const tabs = `<div class="row between" style="align-items:flex-end"><div class="tabs small" style="margin-bottom:18px;flex:1">
    <a href="${ctx.base}/aufgabe/${t.no}" class="${!st ? "active" : ""}">Übersicht Aufgabe ${t.no} ${ptsBadge(taskDone(all, t) > 0, t.points, `${taskDone(all, t)} von ${t.subtasks.length} Teilaufgaben mit Abgabe`)}</a>
    ${t.subtasks.map((s) => `<a href="${ctx.base}/aufgabe/${t.no}/${s.no}" class="${st?.no === s.no ? "active" : ""}">Aufgabe ${s.no} <span class="badge ${all.some((i) => i.submission === s.no) ? "lime" : "gray"}">${s.points}</span></a>`).join("")}</div>
    <button class="helpbtn" data-help style="margin-bottom:18px" aria-label="Hilfe"><span class="q">?</span></button></div>`;
  const inbox = items.filter((i) => i.kind === "mail" && i.folder === "inbox");
  const events = items.filter((i) => i.kind === "event");
  const subs = st ? submissionsFor(all, st.no) : [];
  const toolLabel = { mail: ["mail", "Mail öffnen"], files: ["folder", "Dateien öffnen"], editor: ["notepad-text", "Notizen öffnen"], calendar: ["calendar", "Kalender öffnen"], ide: ["code-xml", "Entwicklungsumgebung öffnen"], calc: ["calculator", "Taschenrechner öffnen"], tickets: ["ticket", "Ticketsystem öffnen"] };
  const cnt = (k) => items.filter((i) => i.kind === k).length;
  const tools = [["files", "folder", "Dateien", `${cnt("file")} Dateien`], ["mail", "mail", "Mail", `${items.filter((i) => i.kind === "mail" && i.folder === "inbox").length} im Posteingang`], ["calendar", "calendar", "Kalender", `${cnt("event")} Termine`], ["editor", "notepad-text", "Notizen", `${cnt("note")} Notizen`], ["tickets", "ticket", "Tickets", `${cnt("ticket")} Tickets`], ["ide", "code-xml", "Entwicklungsumgebung", `${cnt("code")} Code-Dateien`], ["calc", "calculator", "Taschenrechner", "Grundrechenarten, Prozent"]];
  return tabs + `<div class="taskgrid"><div class="col" style="gap:20px">
    <button class="ausgang" data-sit="${t.no}"><span class="round">${icon("info")}</span><span class="grow">Ausgangssituation</span>${icon("arrow-right")}</button>
    ${st ? `<div class="assignment"><h3>${icon("clipboard-list")} Arbeitsauftrag ${st.no}</h3><p>${esc(st.text)}</p>
      <div class="row wrap between"><button class="btn primary sm" data-open="${st.tool}">${icon(toolLabel[st.tool][0])} ${toolLabel[st.tool][1]}</button>
      <span class="small">${subs.length ? `<span class="badge green">${icon("check")} ${subs.length} Abgabe${subs.length > 1 ? "n" : ""} markiert</span>` : `<span class="badge gray">noch keine Abgabe</span>`}</span></div></div>`
    : `<div class="card pad"><h3>Teilaufgaben</h3>${t.subtasks.map((s) => `<a class="subtask mt-s" href="${ctx.base}/aufgabe/${t.no}/${s.no}"><span class="stico ${items.some((i) => i.submission === s.no) ? "done" : "todo"}">${icon(items.some((i) => i.submission === s.no) ? "check" : "square-pen")}</span><span class="grow">${s.no} ${esc(s.title)}</span><span class="badge ${items.some((i) => i.submission === s.no) ? "lime" : "gray"}">${s.points} P</span></a>`).join("")}</div>`}
    <div class="widget"><div class="wh" style="cursor:default">${icon("app-window")} Werkzeuge für Aufgabe ${t.no}</div><div class="wb"><div class="toolwidgets">${tools.map(([k, ic, l, sub]) => `<button data-open="${k}">${icon(ic)}<span><b>${l}</b><small>${sub}</small></span></button>`).join("")}</div><p class="xs muted mt-s" style="margin-bottom:0">Alle Werkzeuge finden Sie auch in der Taskleiste am unteren Bildschirmrand (Tastatur: <kbd>Alt</kbd> + <kbd>1</kbd> … <kbd>7</kbd>).</p></div></div>
    <div class="widget"><div class="wh" style="cursor:default">${icon("building-2")} ${esc(EXAM.company.name)}</div><div class="wb">
      <div class="tabs small" style="margin-bottom:12px">${["allgemein", "adresse", "rechtliches", "kontakt", "vorlagen"].map((k) => `<button data-ctab="${k}" class="${(ui.ctab || "allgemein") === k ? "active" : ""}">${k[0].toUpperCase() + k.slice(1)}</button>`).join("")}</div>
      <div class="row" style="align-items:flex-start;gap:16px">${companyLogo(74)}<div style="white-space:pre-line">${esc(EXAM.company[ui.ctab || "allgemein"])}</div></div></div></div>
    <div class="widget"><div class="wh" data-open="files">${icon("folder")} Dateien</div><div class="wb">
      <div class="tabs small" style="margin-bottom:8px"><button class="active">Bereitgestellte Dateien</button><button data-open="files">Eigene Dateien</button></div>
      ${items.filter((i) => i.kind === "file" && i.folder === "provided").slice(0, 4).map((f) => `<div class="row small" style="padding:4px 0">${icon("file")} ${esc(f.data.name)}</div>`).join("") || `<div class="small muted">Für diese Aufgabe sind keine Dateien bereitgestellt.</div>`}</div></div>
    ${cnt("ticket") ? `<div class="widget"><div class="wh" data-open="tickets">${icon("ticket")} Tickets</div><div class="wb">${items.filter((i) => i.kind === "ticket").map((k) => `<div class="row small" style="padding:4px 0">${icon("ticket")} <span class="grow">#${esc(k.data.no)} ${esc(k.data.subject)}</span><span class="muted">${esc(k.data.status)}</span></div>`).join("")}</div></div>` : ""}
  </div>
  <div class="col" style="gap:20px">
    <div class="widget"><div class="wh" data-open="mail">${icon("mail")} Mail</div><div class="wb" style="padding:0">
      <div class="tabs small" style="margin:8px 14px 0"><button class="active">Posteingang</button><button data-open="mail">Gesendet</button></div>
      ${inbox.length ? inbox.map((m) => `<div class="mailrow ${m.data.read ? "" : "unread"}" data-openmail="${m.id}"><div><div class="subj">${esc(m.data.subject)}</div><div>${esc(m.data.from)} (${esc(m.data.from_mail)})</div></div><div class="small">${esc(m.data.date)} ${m.data.attachments?.length ? icon("paperclip") : ""}</div></div>`).join("") : `<div class="empty small">${icon("mail")}<div>Der Posteingang ist leer</div></div>`}</div></div>
    <div class="widget"><div class="wh" data-open="calendar">${icon("calendar")} Kalender</div><div class="wb">
      ${events.length ? events.map((e, k) => `<div class="calrow"><b>${W.dayDate(e.data.day)}</b><div class="bar ${k % 2 ? "b2" : ""}"><div>${esc(e.data.start)} – ${esc(e.data.end)} Uhr</div><b>${esc(e.data.title)}</b></div></div>`).join("") : `<div class="empty small">${icon("calendar")}<div>Es sind noch keine Termine angelegt</div></div>`}</div></div>
    ${cnt("code") ? `<div class="widget"><div class="wh" data-open="ide">${icon("code-xml")} Entwicklungsumgebung</div><div class="wb">${items.filter((i) => i.kind === "code").map((k) => `<div class="row small" style="padding:4px 0">${icon("file-code")} ${esc(k.data.name)}</div>`).join("")}</div></div>` : ""}
    ${st && subs.length ? `<div class="widget"><div class="wh" style="cursor:default">${icon("list-checks")} Abgaben zu ${st.no}</div><div class="wb">${subs.map((s) => W.itemLine(s)).join("")}</div></div>` : ""}
  </div></div>`;
}

function abgabenBody(ctx) {
  const items = ctx.items();
  const bms = ctx.p.bookmarks || [];
  const open = ALL_SUBTASKS.filter((s) => !items.some((i) => i.submission === s.no));
  const tabs = `<div class="tabs small"><button data-abg="uebersicht" class="${ui.abgTab === "uebersicht" ? "active" : ""}">Abgabenübersicht</button><button data-abg="gemerkt" class="${ui.abgTab === "gemerkt" ? "active" : ""}">Gemerkte Aufgaben <span class="badge gray">${bms.length}</span></button><button data-abg="offen" class="${ui.abgTab === "offen" ? "active" : ""}">Offene Aufgaben <span class="badge ${open.length ? "red" : "green"}">${open.length}</span></button></div>`;
  if (ui.abgTab === "gemerkt") {
    return tabs + (bms.length ? bms.map((no) => { const s = subtask(no); const t = s ? s.task : taskOf(no); return `<a class="subtask mt-s" href="${ctx.base}/aufgabe/${t.no}${s ? "/" + s.no : ""}"><span class="stico open">${icon("bookmark")}</span><span class="grow">${s ? `Teilaufgabe ${s.no} ${esc(s.title)}` : `Aufgabe ${t.no} ${esc(t.title)}`}</span>${icon("arrow-right")}</a>`; }).join("") : `<div class="empty">${icon("bookmark")}<p>Sie haben noch keine Aufgaben gemerkt.<br>Nutzen Sie „Aufgabe merken“ in einer Aufgabe.</p></div>`);
  }
  if (ui.abgTab === "offen") {
    return tabs + (open.length ? `<p class="muted">Zu diesen Teilaufgaben haben Sie noch nichts als Abgabe markiert:</p>` + open.map((s) => `<a class="subtask mt-s" href="${ctx.base}/aufgabe/${s.task.no}/${s.no}"><span class="stico todo">${icon("square-pen")}</span><span class="grow">${s.no} ${esc(s.title)}</span><span class="badge gray">${s.points} Punkte</span>${icon("arrow-right")}</a>`).join("") : `<div class="notice success">${icon("circle-check")}<span>Zu allen Teilaufgaben liegt mindestens eine Abgabe vor.</span></div>`);
  }
  return tabs + EXAM.tasks.map((t) => {
    const openA = ui["abgacc" + t.no] !== false;
    return `<div class="acc"><button data-abgacc="${t.no}"><div><b>Aufgabe ${t.no} ${esc(t.title)}</b> ${ptsBadge(taskDone(items, t) > 0, `${t.points} Punkte`, `${taskDone(items, t)} von ${t.subtasks.length} Teilaufgaben mit Abgabe`)}</div>${icon(openA ? "chevron-up" : "chevron-down")}</button>
    ${openA ? `<div class="acc-b">${t.subtasks.map((s) => { const subs = submissionsFor(items, s.no); return `<div class="card pad soft"><div class="row between"><b>${icon("bookmark")} ${s.no} ${esc(s.title)}</b><span class="badge ${subs.length ? "lime" : "gray"}">${s.points} Punkte</span></div>
      ${subs.length ? `<div class="mt-s small bold">Vorschau</div>${subs.map((x) => `<div class="card pad mt-s">${W.itemPreview(x)}</div>`).join("")}<a class="btn sm block mt-s" href="${ctx.base}/aufgabe/${t.no}/${s.no}">${icon("arrow-right")} Zur Teilaufgabe – Auswahl bearbeiten</a>` : `<div class="notice warn mt-s">${icon("triangle-alert")}<span>Noch keine Abgabe markiert. <a href="${ctx.base}/aufgabe/${t.no}/${s.no}">Zur Teilaufgabe</a></span></div>`}</div>`; }).join("")}</div>` : ""}</div>`;
  }).join("");
}

function situationModal(t) {
  modal({ title: t ? `Ausgangssituation Aufgabe ${t.no}` : "Ausgangssituation der Prüfung", info: true, size: "wide",
    body: `${t ? `<details class="card pad soft"><summary class="bold">Ausgangssituation der Prüfung</summary><p style="white-space:pre-line">${esc(EXAM.ausgangssituation)}</p></details><h3 class="mt">Ausgangssituation Aufgabe ${t.no}</h3><p style="white-space:pre-line">${esc(t.situation)}</p>` : `<div class="row" style="align-items:flex-start;gap:18px">${companyLogo(80)}<p style="white-space:pre-line;margin:0">${esc(EXAM.ausgangssituation)}\n\n${esc(EXAM.company.allgemein)}</p></div>`}`,
    footer: `<button class="btn primary" data-close>Schließen</button>` });
}

function bindPage(el, ctx, sub) {
  if (!el) return;
  const p = ctx.p;
  el.querySelectorAll("[data-collapse]").forEach((b) => (b.onclick = () => { ui.navCollapsed = !ui.navCollapsed; refreshPage(); }));
  el.querySelectorAll(".tn-nav .nh .roundico").forEach((b) => (b.onclick = () => { if (ui.navCollapsed) { ui.navCollapsed = false; refreshPage(); } }));
  el.querySelectorAll("[data-tree]").forEach((b) => (b.onclick = () => { ui.openTree.all = ui.openTree.all === false; refreshPage(); }));
  el.querySelectorAll("[data-acc]").forEach((b) => (b.onclick = () => { ui.openAcc[b.dataset.acc] = !ui.openAcc[b.dataset.acc]; refreshPage(); }));
  el.querySelectorAll("[data-abgacc]").forEach((b) => (b.onclick = () => { ui["abgacc" + b.dataset.abgacc] = ui["abgacc" + b.dataset.abgacc] === false; refreshPage(); }));
  el.querySelectorAll("[data-abg]").forEach((b) => (b.onclick = () => { ui.abgTab = b.dataset.abg; refreshPage(); }));
  el.querySelectorAll("[data-faq]").forEach((b) => (b.onclick = () => { ui["faq" + b.dataset.faq] = !ui["faq" + b.dataset.faq]; refreshPage(); }));
  el.querySelectorAll("[data-ctab]").forEach((b) => (b.onclick = () => { ui.ctab = b.dataset.ctab; refreshPage(); }));
  el.querySelectorAll("[data-sit]").forEach((b) => (b.onclick = () => situationModal(b.dataset.sit === "0" ? null : taskOf(b.dataset.sit))));
  el.querySelectorAll("[data-help]").forEach((b) => (b.onclick = () => directHelp(`<h3>Bedienung</h3><ul><li>Navigation links: Dashboard, Abgaben, Aufgaben</li><li>Taskleiste unten: Werkzeuge als Fenster öffnen, minimierte Fenster wiederherstellen; bei mehreren Fenstern erscheint eine Auswahlliste</li><li>Arbeitsmaterialien sind aufgabenspezifisch: Die Werkzeuge zeigen die Inhalte der geöffneten Aufgabe</li><li>Freitexte (E-Mail-Entwürfe, Notizen, Ticket-Lösungen) werden alle 15 Sekunden automatisch gespeichert</li><li>Häkchen-Symbol: Element als Abgabe markieren</li></ul><h3 class="mt">Tastatur</h3><table class="tbl"><tbody><tr><td><kbd>Alt</kbd> + <kbd>1</kbd> … <kbd>7</kbd></td><td>Dateien, Mail, Kalender, Notizen, Tickets, Rechner, IDE öffnen</td></tr><tr><td><kbd>F6</kbd> / <kbd>Umschalt</kbd>+<kbd>F6</kbd></td><td>zwischen offenen Fenstern und Aufgabe wechseln</td></tr><tr><td><kbd>Esc</kbd></td><td>aktives Fenster minimieren</td></tr><tr><td><kbd>Strg</kbd> + <kbd>Enter</kbd></td><td>Programm in der IDE ausführen</td></tr><tr><td><kbd>Pfeiltasten</kbd></td><td>in Menüs und Auswahllisten navigieren</td></tr></tbody></table>`)));
  el.querySelectorAll("[data-open]").forEach((b) => (b.onclick = (e) => { e.stopPropagation(); W.open(b.dataset.open, { subtask: sub.split("/")[2] }); }));
  el.querySelectorAll("[data-openmail]").forEach((b) => (b.onclick = () => W.open("mail", { mailId: b.dataset.openmail, subtask: sub.split("/")[2] })));
  const fin = el.querySelector("[data-finish]"); if (fin) fin.onclick = () => finishExam(ctx);
  const cp = el.querySelector("[data-copy]"); if (cp) cp.onclick = () => import("./teacher.js?v=8.3").then((m) => m.copyCourse(ctx.course));
  const bm = el.querySelector("[data-bookmark]");
  if (bm) bm.onclick = () => {
    const parts = sub.split("/"); const key = parts[2] || parts[1];
    const list = [...(p.bookmarks || [])]; const i = list.indexOf(key);
    if (i >= 0) list.splice(i, 1); else list.push(key);
    ctx.setBookmarks(list); toast(i >= 0 ? "Markierung entfernt" : "Aufgabe gemerkt", i >= 0 ? "" : "Sie finden gemerkte Aufgaben unter Abgaben › Gemerkte Aufgaben.", "info");
  };
  const rs = el.querySelector("[data-restart]");
  if (rs) rs.onclick = async () => {
    const st = sub.split("/")[2];
    if (!(await confirmBox("Aufgabe neu starten", `Alle Abgabe-Markierungen der Teilaufgabe ${st} werden entfernt. Ihre Dateien, E-Mails und Notizen bleiben erhalten.`, "Neu starten"))) return;
    for (const it of ctx.items().filter((i) => i.submission === st)) await ctx.upd(it.id, { submission: "" });
    toast("Teilaufgabe zurückgesetzt");
  };
  // Gesperrte Aufgaben nach Zeitablauf kennzeichnen und abfangen
  el.querySelectorAll('a[href*="/aufgabe/"]').forEach((a) => {
    const to = a.getAttribute("href").match(/aufgabe\/(\d)/)?.[1];
    if (!to || !taskBlocked(ctx, to)) return;
    a.classList.add("locked"); a.setAttribute("aria-disabled", "true"); a.title = "Bearbeitungszeit abgelaufen – keine neue Aufgabe";
    a.insertAdjacentHTML("afterbegin", icon("lock"));
    a.addEventListener("click", (e) => { e.preventDefault(); e.stopImmediatePropagation(); blockedModal(ctx, to); }, true);
  });
  // Aufgabenwechsel mit offenen Fenstern
  el.querySelectorAll('a[href*="/aufgabe/"]').forEach((a) => a.addEventListener("click", async (e) => {
    const from = sub.match(/^aufgabe\/(\d)/)?.[1]; const to = a.getAttribute("href").match(/aufgabe\/(\d)/)?.[1];
    if (!from || !to || from === to || !W.anyOpen()) return;
    e.preventDefault();
    const ok = await confirmBox("Aufgabe wechseln", "Sind Sie sicher, dass Sie die Aufgabe wechseln wollen?<br>Die aktuelle Aufgabe wird pausiert und die ausgewählte Aufgabe wird gestartet. Alle aktiven Fenster aus der aktuellen Aufgabe werden geschlossen.", "Wechseln");
    if (ok) { W.closeTaskWindows(); location.hash = a.getAttribute("href"); }
  }));
}

// Prüfling gibt selbst ab: Bearbeitung für ihn beendet; final beendet die Raumaufsicht (Einsammeln/Beenden)
async function finishExam(ctx) {
  const open = ALL_SUBTASKS.filter((s) => !ctx.items().some((i) => i.submission === s.no));
  const ok = await confirmBox("Prüfung beenden", `${open.length ? `<p>Zu <b>${open.length} Teilaufgaben</b> haben Sie noch keine Abgabe markiert: ${open.map((s) => s.no).join(", ")}.</p>` : ""}<p>Möchten Sie Ihre Prüfung wirklich beenden und abgeben? Danach können Sie <b>nicht mehr weiterarbeiten</b>. Die Aufsicht schließt die Prüfung anschließend ab.</p>`, "Prüfung beenden");
  if (!ok) return;
  W.closeAll();
  await upd("participants", ctx.p.id, { status: "abgegeben", finished_at: toPb() });
  log(ctx.p.room, ctx.p, "Prüfling hat die Prüfung beendet und abgegeben", "Bearbeitung gesperrt, Abschluss durch die Aufsicht", "system");
}
function blockedModal(ctx, no) {
  if ([...document.querySelectorAll(".backdrop h2")].some((h) => h.textContent === "Bearbeitungszeit abgelaufen")) return;
  modal({ title: "Bearbeitungszeit abgelaufen", warn: true, size: "narrow", body: `<p>Aufgabe ${esc(no)} kann nicht mehr geöffnet werden, da Ihre Bearbeitungszeit abgelaufen ist.</p>${allowedTask(ctx) ? `<p>Sie können die zuletzt bearbeitete <b>Aufgabe ${esc(allowedTask(ctx))}</b> noch abschließen.</p>` : ""}<p>Die Prüfung wird durch die Aufsicht eingesammelt.</p>`, footer: `${allowedTask(ctx) ? `<a class="btn" href="${ctx.base}/aufgabe/${esc(allowedTask(ctx))}" data-close>Zu Aufgabe ${esc(allowedTask(ctx))}</a>` : ""}<button class="btn primary" data-close>Verstanden</button>` });
}

// ---------- Dock (Taskleiste) ----------
const TOOLS = [["files", "folder", "Dateien"], ["mail", "mail", "Mail"], ["calendar", "calendar", "Kalender"], ["editor", "notepad-text", "Notizen"], ["tickets", "ticket", "Tickets"], ["calc", "calculator", "Rechner"], ["ide", "code-xml", "IDE"]];
const unreadOf = (ctx) => (W.getTask() ? ctx.items().filter((i) => i.kind === "mail" && i.folder === "inbox" && !i.data.read && W.itemTask(i) === W.getTask()).length : 0);
function dockBtn(k, ic, label, unread) {
  const st = W.dockState(k);
  if (!W.getTask()) return `<button class="tooloff" data-dock="${k}" aria-disabled="true" title="${label} – nur innerhalb einer Aufgabe verfügbar">${icon(ic)}${label}</button>`;
  return `<button class="${st.count ? "open" : ""} ${st.visible ? "vis" : ""}" data-dock="${k}" title="${label}${st.count ? ` – ${st.count} Fenster${st.minimized ? `, ${st.minimized} minimiert` : ""}` : ""}">${icon(ic)}${label}${k === "mail" && unread ? `<span class="dbadge" title="${unread} ungelesen">${unread}</span>` : ""}${st.count > 1 ? `<span class="dcount" title="${st.count} Fenster geöffnet">${st.count}</span>` : ""}<span class="dots">${"<i></i>".repeat(Math.min(st.count, 3))}</span></button>`;
}
function dock(ctx, sub) {
  const unread = unreadOf(ctx);
  const page = sub.split("/")[0] || "dashboard";
  const pg = (k, ic, label) => `<button class="page ${page === k ? "active" : ""}" data-dock="${k}">${icon(ic)}${label}</button>`;
  return `<nav class="dock" aria-label="Taskleiste">${pg("dashboard", "house", "Dashboard")}${pg("abgaben", "list-checks", "Abgaben")}<span class="sep"></span><span data-tools style="display:contents">${TOOLS.map(([k, ic, l]) => dockBtn(k, ic, l, unread)).join("")}</span></nav>`;
}
function bindDock(root, ctx) {
  root.querySelectorAll("[data-dock]").forEach((b) => (b.onclick = () => {
    const k = b.dataset.dock;
    if (k === "dashboard" || k === "abgaben") { location.hash = `${ctx.base}/${k}`; return; }
    if (b.classList.contains("tooloff")) { toast("Werkzeuge nur in einer Aufgabe verfügbar", "Auf Dashboard und Abgaben sind die Anwendungen gesperrt. Öffnen Sie eine Aufgabe – jede Aufgabe hat eigene E-Mails, Dateien, Termine, Tickets und Code.", "info"); return; }
    W.dockClick(k, b, { subtask: curSub.split("/")[2] });
  }));
}
export function syncDock() {
  const host = document.querySelector(".dock [data-tools]"); if (!host || !CTX) return;
  const unread = unreadOf(CTX);
  host.innerHTML = TOOLS.map(([k, ic, l]) => dockBtn(k, ic, l, unread)).join("");
  bindDock(host, CTX);
}
W.setDockListener(() => syncDock());
onChange((c) => { if (c === "items") setTimeout(syncDock, 80); }); // Ungelesen-Zähler aktuell halten

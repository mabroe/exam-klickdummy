// Lehrkraft / Schuladministration: Meine Aufgaben, Katalog, Kursdetails, Meine Prüfungen, Demo-Verwaltung
import { D, byId, upd, create, resetDemo, demoApi } from "../data.js?v=9.2";
import { icon, esc, modal, toast, popMenu, parseDate, mmss, pager, bindPager, ddHtml, bindDd, statusChip, toPb, isActive } from "../ui.js?v=9.2";
import { simulateOffline } from "./proctor.js?v=9.2";
import { navigate, redraw, render, session } from "../app.js?v=9.2";
import * as ED from "./editor.js?v=9.2";
import { me, visibleCourses, visibleRooms, inOrg, orgShort } from "../access.js?v=9.2";

const S = { tab: "active", sort: "new", q: "", open: {}, cat: { q: "", applied: "", tab: "Alle", beruf: [], fach: [], jahr: [], page: 1, per: 6 } };
let timer = null;

// ---------- Meine Aufgaben ----------
export function tasks() {
  return {
    shell: "staff", rail: "aufgaben", title: "Meine Aufgaben",
    render() {
      const room = visibleRooms().filter((r) => r.state !== "TERMINATED").sort((a, b) => (a.planned_start > b.planned_start ? 1 : -1))[0];
      const ms = room ? parseDate(room.planned_start) - Date.now() : null;
      const soon = room && room.state === "CREATED" && ms > 0 && ms < 3 * 3600000;
      const running = room && (room.state === "RUNNING" || room.state === "PAUSED");
      const myRole = me()?.kind === "schuladmin" ? "schuladmin" : "lehrkraft";
      let list = D.tasks.filter((t) => (!t.role || t.role === myRole) && (S.tab === "active" ? !t.closed : t.closed));
      if (S.q) list = list.filter((t) => (t.title + " " + t.procedure).toLowerCase().includes(S.q.toLowerCase()));
      const groups = [];
      list.forEach((t) => { let g = groups.find((x) => x.name === t.procedure); if (!g) groups.push((g = { name: t.procedure, icon: t.procedure_icon, items: [] })); g.items.push(t); });
      if (S.sort === "old") groups.reverse();
      return `${soon || running ? `<div class="banner">${icon("alarm-clock")} <span>${running ? `Die Prüfung „${esc(room.exam_name)}“ in ${esc(room.name)} <b>läuft</b>.` : `In <b data-soon>${mmss(ms)}</b> Minuten steht die Prüfung „${esc(room.exam_name)}“ an.`}</span> <a class="btn primary sm" href="#/app/raum/${room.id}/meinraum">${icon("circle-play")} Raumaufsicht ${running ? "öffnen" : "starten"}</a></div>` : ""}
      <div class="pagehead"><h1>Meine Aufgaben</h1></div>
      <div class="row between wrap mb"><div class="segmented"><button data-tab="active" class="${S.tab === "active" ? "active" : ""}">${icon("pencil")} Aktive Verfahren</button><button data-tab="closed" class="${S.tab === "closed" ? "active" : ""}">${icon("folder")} Abgeschlossene Verfahren</button></div>
        <div class="row"><div class="search"><input class="input" style="width:240px" placeholder="Suchen" data-q value="${esc(S.q)}">${icon("search")}</div><button class="btn primary" data-create>${icon("plus")} Erstellen</button></div></div>
      <div class="row mb"><button class="btn ghost sm" data-sort>Sortierung: ${S.sort === "new" ? "neueste zuerst" : "älteste zuerst"} ${icon("chevron-down")}</button></div>
      ${groups.length ? groups.map((g) => {
        const open = S.open[g.name] ?? (g.name.includes("FA230") || g.name.includes("HTML"));
        const due = room && g.name.includes(room.exam_name) && soon;
        return `<div class="proc"><button data-g="${esc(g.name)}"><span class="picon">${icon(g.icon, "lg")}</span><span class="grow">${esc(g.name)}</span>${icon(open ? "chevron-up" : "chevron-down", "lg")}</button>
        ${open ? `<div class="tasks">${due ? `<div class="banner inproc">${icon("alarm-clock")} <span>In <b data-soon>${mmss(ms)}</b> Minuten steht die Prüfung an.</span> <a class="btn primary sm" href="#/app/raum/${room.id}/meinraum">${icon("circle-play")} Raumaufsicht starten</a></div>` : ""}
          ${g.items.map((t) => `<button class="taskrow ${t.done ? "done" : ""}" data-task="${t.id}"><span class="tico">${icon(t.icon)}</span><span class="t grow">${esc(t.title)}${t.task_no ? ` <span class="xs muted">Task ${t.task_no}</span>` : ""}</span>${t.done ? `<span class="badge green">${icon("check")} erledigt</span>` : t.is_new ? `<span class="badge new">neu</span>` : ""}<b class="small">${esc(t.due)}</b></button>`).join("")}</div>` : ""}</div>`;
      }).join("") : `<div class="empty">${icon("circle-check")}<p>Keine Aufgaben gefunden.</p></div>`}`;
    },
    mount(el) {
      el.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => { S.tab = b.dataset.tab; redraw(); }));
      el.querySelectorAll("[data-g]").forEach((b) => (b.onclick = () => { const k = b.dataset.g; S.open[k] = !(S.open[k] ?? (k.includes("FA230") || k.includes("HTML"))); redraw(); }));
      el.querySelector("[data-sort]").onclick = (e) => popMenu(e.currentTarget, [{ label: "neueste zuerst", run: () => { S.sort = "new"; redraw(); } }, { label: "älteste zuerst", run: () => { S.sort = "old"; redraw(); } }], { align: "left" });
      const q = el.querySelector("[data-q]"); q.oninput = () => { S.q = q.value; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); };
      el.querySelector("[data-create]").onclick = (e) => popMenu(e.currentTarget, ["Neue Prüfung", "Neue Lernstandserhebung", "Neue Lernreise"].map((l) => ({ label: l, run: () => toast(l, "Das Anlegen ist im Klickdummy nicht umgesetzt. Nutzen Sie den Katalog, um eine Prüfung zu kopieren.", "info") })));
      el.querySelectorAll("[data-task]").forEach((b) => (b.onclick = async () => {
        const t = byId("tasks", b.dataset.task);
        if (t.is_new) upd("tasks", t.id, { is_new: false });
        if (t.link) navigate(t.link);
        else {
          const v = await modal({ title: t.title, body: `<p>Verfahren: <b>${esc(t.procedure)}</b><br>Fällig: ${esc(t.due)}</p><p class="muted">Für diese Aufgabe ist im Klickdummy keine eigene Ansicht hinterlegt.</p>`, footer: `<button class="btn" data-close>Schließen</button>${t.done ? "" : `<button class="btn primary" data-value="done">${icon("check")} Als erledigt markieren</button>`}` });
          if (v === "done") { await upd("tasks", t.id, { done: true }); toast("Aufgabe erledigt", t.title); }
        }
      }));
      clearInterval(timer);
      const room = visibleRooms().filter((r) => r.state !== "TERMINATED").sort((a, b) => (a.planned_start > b.planned_start ? 1 : -1))[0];
      if (room) timer = setInterval(() => document.querySelectorAll("[data-soon]").forEach((s) => (s.textContent = mmss(parseDate(room.planned_start) - Date.now()))), 1000);
    },
    unmount() { clearInterval(timer); },
  };
}

// ---------- Katalog ----------
// Sichtbarkeit im Katalog: global freigegebene Einträge (Bereichsadministration) und Einträge, die Lehrkräfte für ihre Schule freigegeben haben.
// Die Bereichsadministration sieht zusätzlich ihre noch nicht freigegebenen Entwürfe; Prüfungen des Erstellungsprozesses erscheinen nie.
export function inCatalog(c, p = me()) {
  if (!c || c.status || c.kind === "Prüfung") return false;
  const r = ED.releaseOf(c);
  if (ED.isAuthor()) return !c.mine;
  if (r?.scope === "global") return true;
  if (r?.scope === "org") return !!p && inOrg(p, r.org);
  return false;
}
const ownContents = (p = me()) => D.catalog.filter((c) => c.mine && !c.status && ED.canEdit(c));
const opts = (k) => [...new Set(D.catalog.filter((c) => inCatalog(c)).map((c) => c[k]))].sort();
function cover(c) { return `<div class="cover c${c.image % 4}"><div class="book">${esc(c.title)}<small>von IBBW · ${esc(c.jahr)}</small></div></div>`; }
const catTabs = () => ["Alle", "Lernerfolgskontrollen", ...(ED.isAuthor() ? ["Nicht freigegeben"] : session.role === "lehrkraft" ? ["Meine Schule", "Eigene Inhalte"] : [])];
function filtered() {
  const st = S.cat; if (!catTabs().includes(st.tab)) st.tab = "Alle";
  // Katalog nur für den Unterricht: Prüfungen laufen ausschließlich über den Erstellungsprozess
  const base = st.tab === "Eigene Inhalte" ? ownContents() : D.catalog.filter((c) => inCatalog(c));
  return base.filter((c) => {
    if (st.tab === "Nicht freigegeben" && ED.releaseOf(c)) return false;
    if (st.tab === "Meine Schule" && ED.releaseOf(c)?.scope !== "org") return false;
    if (st.tab === "Lernerfolgskontrollen" && c.kind !== "Lernerfolgskontrolle") return false;
    if (st.beruf.length && !st.beruf.includes(c.beruf)) return false;
    if (st.fach.length && !st.fach.includes(c.fach)) return false;
    if (st.jahr.length && !st.jahr.includes(c.jahr)) return false;
    if (st.applied) { const q = st.applied.toLowerCase(); if (!(c.title + " " + c.description + " " + c.beruf + " " + c.fach + " " + (c.tags || []).join(" ")).toLowerCase().includes(q)) return false; }
    return true;
  });
}
export function catalog() {
  return {
    shell: "staff", rail: "katalog", title: "Katalog",
    render() {
      const st = S.cat; const list = filtered();
      const page = list.slice((st.page - 1) * st.per, st.page * st.per);
      const terms = ["Unterricht", "Unterrichtsmaterial", "Unterrichtsmethoden", "Tabellenkalkulation", "Netzwerktechnik", "Prüfung", "Programmierung", "Datenbanken"];
      const sugg = st.q && st.q !== st.applied ? terms.filter((t) => t.toLowerCase().startsWith(st.q.toLowerCase())).slice(0, 4) : [];
      return `<section class="hero"><h1>Katalog</h1><div class="sbar"><input data-q placeholder="Suchbegriff eingeben" value="${esc(st.q)}" aria-label="Katalog durchsuchen">${st.q ? `<button class="clr" data-clr aria-label="Suche leeren">${icon("x", "lg")}</button>` : ""}<button class="go" data-go aria-label="Suchen">${icon("search", "lg")}</button>
        ${sugg.length ? `<div class="suggest">${sugg.map((s) => `<button data-sugg="${esc(s)}">${icon("search")} ${esc(s)}</button>`).join("")}</div>` : ""}</div></section>
      <div class="row between wrap"><nav class="tabs" style="min-width:320px">${catTabs().map((t) => `<button data-ctab="${t}" class="${st.tab === t ? "active" : ""}">${t}</button>`).join("")}</nav>
        <div class="row wrap" style="margin-bottom:24px">${ddHtml("beruf", "Beruf", opts("beruf"), st.beruf, st)}${ddHtml("fach", "Fach", opts("fach"), st.fach, st)}${ddHtml("jahr", "Jahr", opts("jahr"), st.jahr, st)}${ED.canCreate() ? `<button class="btn primary" data-newcontent>${icon("plus")} ${ED.isAuthor() ? "Unterrichtsinhalt erstellen" : "Neuen Inhalt erstellen"}</button>` : ""}${ED.isAuthor() ? `<button class="btn" data-pubexam>${icon("library")} Durchgeführte Prüfung veröffentlichen</button><button class="btn" data-import>${icon("upload")} Prüfung importieren</button>` : ""}${session.role === "bereichsadmin" ? "" : `<a class="btn ghost" href="#/app/kurse">${icon("folder")} ${me()?.kind === "schuladmin" ? "Prüfungen" : "Mein Unterricht"} (${visibleCourses().length})</a>`}</div></div>
      ${st.applied || st.beruf.length || st.fach.length || st.jahr.length ? `<p class="small mb">${list.length} Ergebnis${list.length === 1 ? "" : "se"}${st.applied ? ` für „<b>${esc(st.applied)}</b>“` : ""} <button class="link" data-reset>Filter zurücksetzen</button></p>` : ""}
      ${st.tab === "Eigene Inhalte" ? `<div class="notice info small mb">${icon("info")}<span>Eigene Unterrichtsmaterialien und Ihre Kopien aus dem Katalog. Sie bearbeiten sie im Editor; die Mitbetreuung Ihres Unterrichts ebenfalls. Über „Für meine Schule freigeben“ stellen Sie ein Material in den Katalog – sichtbar nur für Lehrkräfte Ihrer Schule; die Freigabe können Sie jederzeit beenden.</span></div>` : ""}
      ${list.length ? `<div class="cgrid">${page.map((c) => { const rel = ED.releaseOf(c); return `<article class="ccard">${cover(c)}<div class="cb"><div class="row wrap" style="gap:6px"><span class="badge purple">${esc(c.beruf)}</span><span class="badge cyan">${esc(c.fach)}</span><span class="badge lime">${esc(c.jahr)}</span>${rel ? (rel.scope === "org" ? `<span class="badge orange" title="Nur für Lehrkräfte dieser Schule">${icon("school")} ${esc(orgShort(rel.org))}</span>` : ED.isAuthor() ? `<span class="badge green">${icon("globe")} global</span>` : "") : `<span class="badge gray">nicht freigegeben</span>`}</div><h3>${esc(c.title)}</h3><p>${esc(c.description)}</p></div>
        <div class="cf">${session.role === "lehrkraft" ? `<button class="linkarrow" data-copy="${c.id}">${icon("copy")} Kopieren</button>` : ""}${ED.canEdit(c) ? `<a class="linkarrow" href="#/app/editor/${c.id}/allgemein">${icon("pencil")} Bearbeiten</a>` : ""}${ED.canPublish(c) ? `<button class="linkarrow" data-publish="${c.id}" data-on="${rel ? 0 : 1}">${icon(rel ? "eye-off" : "globe")} ${rel ? "Freigabe beenden" : ED.isAuthor() ? "Global freigeben" : "Für meine Schule freigeben"}</button>` : ""}<a class="linkarrow" href="#/app/katalog/${c.id}">${icon("arrow-right")} Zur Kursübersicht</a></div></article>`; }).join("")}</div>${pager(list.length, st.page, st.per, [6, 12, 24])}`
      : `<div class="empty">${icon("search")}<h2>Keine Suchergebnisse</h2><p>Zu Ihrer Suche wurden keine Einträge gefunden. Prüfen Sie die Schreibweise oder entfernen Sie Filter.</p><button class="btn" data-reset>Filter zurücksetzen</button></div>`}`;
    },
    mount(el) {
      const st = S.cat;
      const q = el.querySelector("[data-q]");
      q.oninput = () => { st.q = q.value; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(pos, pos); };
      q.onkeydown = (e) => { if (e.key === "Enter") { st.applied = st.q; st.page = 1; redraw(); } };
      el.querySelector("[data-go]").onclick = () => { st.applied = st.q; st.page = 1; redraw(); };
      const c = el.querySelector("[data-clr]"); if (c) c.onclick = () => { st.q = ""; st.applied = ""; redraw(); };
      el.querySelectorAll("[data-sugg]").forEach((b) => (b.onclick = () => { st.q = st.applied = b.dataset.sugg; st.page = 1; redraw(); }));
      el.querySelectorAll("[data-ctab]").forEach((b) => (b.onclick = () => { st.tab = b.dataset.ctab; st.page = 1; redraw(); }));
      el.querySelectorAll("[data-reset]").forEach((b) => (b.onclick = () => { Object.assign(st, { q: "", applied: "", beruf: [], fach: [], jahr: [], page: 1 }); redraw(); }));
      bindDd(el, st, (k, v) => { st[k] = v; st.page = 1; }, redraw);
      bindPager(el, st, redraw);
      el.querySelectorAll("[data-copy]").forEach((b) => (b.onclick = () => copyCourse(byId("catalog", b.dataset.copy))));
      el.querySelectorAll("[data-publish]").forEach((b) => (b.onclick = () => ED.publish(byId("catalog", b.dataset.publish), b.dataset.on === "1")));
      const nc = el.querySelector("[data-newcontent]"); if (nc) nc.onclick = () => ED.newContentDialog();
      const pe = el.querySelector("[data-pubexam]"); if (pe) pe.onclick = () => ED.publishExamDialog();
      const im = el.querySelector("[data-import]"); if (im) im.onclick = () => ED.importDialog();
    },
  };
}
// Kopieren aus dem Katalog: Unterrichtsebene (Lehrkraft) – legt einen eigenen Kurs mit Mitgliederverwaltung an
export async function copyCourse(c) { if (!c) return; const m = await import("./courses.js?v=9.2"); return m.copyToLesson(c); }
export function course(id) {
  const c = byId("catalog", id);
  if (!c) return { redirect: "#/app/katalog" };
  if (!inCatalog(c) && !ED.canEdit(c)) return { shell: "staff", rail: "katalog", title: "Kein Zugriff", render: () => `<div class="empty">${icon("lock")}<h2>Nicht im Katalog</h2><p>Dieser Eintrag ist für Sie nicht freigegeben.</p><a class="btn" href="#/app/katalog">Zum Katalog</a></div>` };
  return {
    shell: "staff", rail: "katalog", title: c.title,
    render: () => `<section class="hero" style="min-height:150px;align-items:flex-start;padding-left:48px"><h1>Kursübersicht</h1></section>
      <div class="breadcrumb"><a href="#/app/katalog">Suchergebnisse</a>${icon("chevron-right")}<b>Kursübersicht</b></div>
      <div class="detailgrid"><div class="col" style="gap:22px"><article class="ccard">${cover(c)}<div class="cb"><div class="row" style="gap:6px"><span class="badge purple">${esc(c.beruf)}</span><span class="badge lime">${esc(c.jahr)}</span></div><h2>${esc(c.title)}</h2><p style="-webkit-line-clamp:unset">${esc(c.description)}</p></div>
        <div class="cf">${session.role !== "lehrkraft" ? "" : `<button class="linkarrow" data-copy>${icon("copy")} Kopieren</button>`}${ED.canEdit(c) ? `<a class="btn sm" href="#/app/editor/${c.id}/allgemein">${icon("pencil")} Im Editor bearbeiten</a>` : ""}<a class="btn primary sm" href="#/app/vorschau/${c.id}/dashboard" data-pvcat>${icon("arrow-right")} Zum Kurs</a></div></article>
        <div class="card pad"><h3>Inhalte</h3><ul>${(c.contents || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div></div>
      <div class="col" style="gap:22px"><div class="card pad"><h3>Überblick</h3><div class="kv">${icon("presentation")}<div><div class="small">Ausbildungsberuf</div><span class="v">${esc(c.beruf)}</span></div></div><div class="kv">${icon("clock")}<div><div class="small">Dauer</div><span class="v">${esc(c.duration)}</span></div></div><div class="kv">${icon("user")}<div><div class="small">Ersteller</div><span class="v">${esc(c.creator)}</span></div></div><div class="kv">${icon("book-open")}<div><div class="small">Art</div><span class="v">${esc(c.kind)}</span></div></div></div>
        <div class="card pad"><h3>Schlagworte</h3><div class="row wrap" style="gap:6px">${(c.tags || []).map((t) => `<span class="badge cyan">${esc(t)}</span>`).join("")}</div></div></div></div>`,
    mount(el) { const cp = el.querySelector("[data-copy]"); if (cp) cp.onclick = () => copyCourse(c); },
  };
}
export function mine() {
  return {
    shell: "staff", rail: "katalog", title: "Meine Prüfungen",
    render() {
      const list = D.catalog.filter((c) => c.mine);
      return `<div class="breadcrumb"><a href="#/app/katalog">Katalog</a>${icon("chevron-right")}<b>Meine Prüfungen</b></div><div class="pagehead"><h1>Meine Prüfungen</h1></div>
      <p class="muted">Aus dem Katalog kopierte und angepasste Prüfungen. Diese können Sie bearbeiten, Mitglieder zuordnen und einer Raumaufsicht zuweisen.</p>
      ${list.length ? `<div class="tablewrap mt"><table class="tbl"><thead><tr><th>Titel</th><th>Beruf</th><th>Jahr</th><th>Art</th><th>Kopiert von</th><th></th></tr></thead><tbody>${list.map((c) => `<tr><td><b>${esc(c.title)}</b></td><td>${esc(c.beruf)}</td><td>${esc(c.jahr)}</td><td>${esc(c.kind)}</td><td>${esc(byId("catalog", c.copied_from)?.title || "–")}</td><td class="row"><a class="btn sm" href="#/app/vorschau/${c.id}/dashboard">${icon("eye")} Vorschau</a><button class="btn sm" data-room="${c.id}">${icon("calendar-plus")} Raumaufsicht planen</button></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">${icon("copy")}<h3>Noch keine Prüfungen kopiert</h3><p>Kopieren Sie eine Prüfung aus dem Katalog.</p><a class="btn primary" href="#/app/katalog">Zum Katalog</a></div>`}`;
    },
    mount(el) { el.querySelectorAll("[data-room]").forEach((b) => (b.onclick = () => navigate("#/app/raumaufsicht"))); },
  };
}

// ---------- Demo-Verwaltung ----------
export function admin() {
  return {
    shell: "staff", rail: "admin", title: "Administration",
    render() {
      const room = D.rooms.find((r) => r.name === "Raum 123");
      const ps = D.participants.filter((p) => p.room === room?.id);
      const count = (s) => ps.filter((p) => p.status === s).length;
      return `<div class="pagehead"><div><h1>Administration</h1><div class="sub">Demo-Steuerung des Klickdummys</div></div></div>
      <div class="statgrid"><div class="stat"><div class="small muted">Raum 123</div><div class="v">${room ? ({ CREATED: "Vorbereitung", RUNNING: "läuft", PAUSED: "pausiert", TERMINATED: "beendet" })[room.state] : "–"}</div></div>
        <div class="stat"><div class="small muted">Teilnehmende im Raum</div><div class="v">${ps.length}</div></div><div class="stat"><div class="small muted">Prüfung läuft</div><div class="v">${count("laeuft")}</div></div>
        <div class="stat"><div class="small muted">Abgaben gesamt</div><div class="v">${D.items.filter((i) => i.submission && i.participant).length}</div></div><div class="stat"><div class="small muted">Protokolleinträge</div><div class="v">${D.protocol.length}</div></div></div>
      <div class="card pad mt-l"><h3>Demo-Aktionen</h3>
        <div class="row wrap mt"><button class="btn" data-reset>${icon("rotate-ccw")} Demo zurücksetzen</button><button class="btn" data-sim>${icon("users")} Übrige Teilnehmende anmelden (Raum 123)</button><button class="btn" data-soon>${icon("alarm-clock")} Prüfungsbeginn auf „in 6 Minuten“ setzen</button></div>
        <p class="small muted mt">„Demo zurücksetzen“ stellt alle Daten wieder her. Offene Browserfenster anderer Rollen laden automatisch neu.</p></div>
      <div class="card pad mt"><h3>Testfälle</h3><p class="small muted">Gezielt Situationen herstellen, z. B. für Workshops oder um bekannte Probleme (Last, Verbindung, Nachteilsausgleich) nachzustellen.</p>
        <div class="testgrid mt">
          <div class="tcase"><b>${icon("users")} Großraum mit 120 Teilnehmenden</b><p class="small">Ab 41 Teilnehmenden kein Sitzplan: „Mein Raum“ ist ausgegraut, Steuerung mit Suche, Statusfilter und Seitenaufteilung im Reiter „Teilnehmende“.</p>${(() => { const a = D.rooms.find((r) => D.participants.filter((p) => p.room === r.id).length > 40); return a ? `<a class="btn sm" href="#/app/raum/${a.id}/teilnehmende">${icon("arrow-right")} ${esc(a.name)} öffnen</a>` : "–"; })()}</div>
          <div class="tcase"><b>${icon("radio")} Verbindungsabbruch</b><p class="small">Prüfling ist 20 s offline (Hinweis im Prüfungsmodus), danach geht es automatisch weiter – ohne erneute Anmeldung. Aufsicht sieht den Abbruch live; Abbruch und Wiederherstellung (mit Dauer) werden protokolliert.</p>
            <div class="row wrap"><select class="select" style="width:auto" data-offp aria-label="Prüfling für Verbindungsabbruch">${ps.filter((p) => p.status !== "nicht_eingeloggt").map((p) => `<option value="${p.id}">${esc(p.lastname)}, ${esc(p.firstname)} (${esc(p.seat)})</option>`).join("") || `<option value="">– niemand angemeldet –</option>`}</select><button class="btn sm" data-off>Abbruch simulieren</button></div></div>
          <div class="tcase"><b>${icon("clock")} Nachteilsausgleich im Timer</b><p class="small">Setzt 15 Min. Nachteilsausgleich für den gewählten Prüfling. Restzeit, Kopfzeile des Prüflings und Sitzplan zeigen ihn an. Nur vor dem Prüfungsstart möglich.</p>
            <div class="row wrap"><select class="select" style="width:auto" data-ntap aria-label="Prüfling für Nachteilsausgleich">${ps.map((p) => `<option value="${p.id}">${esc(p.lastname)}, ${esc(p.firstname)}${p.nta ? ` – NTA ${p.nta} Min.` : ""}</option>`).join("")}</select>${(() => { const r123 = D.rooms.find((r) => r.name === "Raum 123"); const lock = r123 && r123.state !== "CREATED"; return `<button class="btn sm" data-nta="15" ${lock ? "disabled" : ""}>+15 Min. NTA</button><button class="btn sm ghost" data-nta="0" ${lock ? "disabled" : ""}>entfernen</button>${lock ? `<span class="xs muted">${icon("lock")} Prüfung bereits gestartet</span>` : ""}`; })()}</div></div>
          <div class="tcase"><b>${icon("alarm-clock")} Bearbeitungszeit fast abgelaufen</b><p class="small">Raum 123 läuft, Restzeit 2 Minuten (ohne Zusatzzeiten). Nach Ablauf läuft die Prüfung weiter: Status „Bearbeitungszeit beendet“, neue Aufgaben gesperrt, Ende nur durch Einsammeln/Beenden.</p><button class="btn sm" data-ending>Restzeit auf 2 Min. setzen</button></div>
          <div class="tcase"><b>${icon("eye")} Ergebnisse und Prüfungseinsicht</b><p class="small">Notenspiegel, Aufgabenstatistik, CSV-Export; Einsicht in Präsenz mit der Rolle „Prüfungseinsicht“.</p><a class="btn sm" href="#/app/ergebnisse">${icon("arrow-right")} Zu den Ergebnissen</a></div>
        </div></div>
      <div class="card pad mt"><h3>Statusübersicht Raum 123</h3><div class="legend mt-s">${["nicht_eingeloggt", "wartend", "wartend_bestaetigt", "laeuft", "pausiert", "gesperrt", "zeit_beendet", "abgegeben", "eingesammelt", "beendet", "nicht_teilnahme"].map((s) => `<span>${statusChip(s)} ${count(s)}</span>`).join("")}</div></div>
      <div class="card pad mt"><h3>Rollen und Instanzen</h3><p class="small">Die Navigation orientiert sich an den Bereichsrollen der Instanzen <b>OPE</b> (Erstellung), <b>OPP</b> (Prüfen) und <b>OPU</b> (Unterricht). Abgebildet sind im Klickdummy: Exam-Teilnehmer (Task 19/34), Exam-Raumaufsicht (Task 22/33), Exam-Korrektor (Task 10/20/27), Exam-Lehrkraft/Schuladministration (Task 21/24/31/32, Katalog).</p></div>`;
    },
    mount(el) {
      el.querySelector("[data-reset]").onclick = async () => { await resetDemo(); toast("Demo zurückgesetzt"); render(); };
      el.querySelector("[data-sim]").onclick = async () => { const room = D.rooms.find((r) => r.name === "Raum 123"); const r = await demoApi.simulateLogin(room.id); toast("Simulation", `${r.count} Teilnehmende angemeldet.`, "info"); };
      const room = D.rooms.find((r) => r.name === "Raum 123");
      const off = el.querySelector("[data-off]"); if (off) off.onclick = () => { const p = D.participants.find((x) => x.id === el.querySelector("[data-offp]").value); if (p) simulateOffline(room, p); };
      el.querySelectorAll("[data-nta]").forEach((b) => (b.onclick = async () => { const p = D.participants.find((x) => x.id === el.querySelector("[data-ntap]").value); await upd("participants", p.id, { nta: +b.dataset.nta }); const { log } = await import("../data.js?v=9.2"); log(p.room, p, "Nachteilsausgleich geändert", `${b.dataset.nta} Min.`, "aktion"); toast("Nachteilsausgleich gesetzt", `${p.lastname}: ${b.dataset.nta} Min.`); }));
      const end = el.querySelector("[data-ending]"); if (end) end.onclick = async () => {
        const start = new Date(Date.now() - ((room.duration_min || 90) + (room.global_extra || 0) - 2) * 60000);
        await upd("rooms", room.id, { state: "RUNNING", started_at: toPb(start), paused_total_s: 0, paused_at: "" });
        for (const p of D.participants.filter((x) => x.room === room.id && isActive(x.status))) await upd("participants", p.id, { started_at: toPb(start) });
        toast("Restzeit gesetzt", "Raum 123: noch etwa 2 Minuten Bearbeitungszeit (ohne Zusatzzeiten).", "info");
      };
      el.querySelector("[data-soon]").onclick = async () => { const room = D.rooms.find((r) => r.name === "Raum 123"); await upd("rooms", room.id, { planned_start: new Date(Date.now() + 6 * 60000).toISOString().replace("T", " ") }); toast("Prüfungsbeginn angepasst", "Raum 123 startet planmäßig in 6 Minuten.", "info"); };
    },
  };
}

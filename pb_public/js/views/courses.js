// Kurse (Unterricht bzw. Prüfung): Übersicht, Mitglieder- und Gruppenverwaltung, Raumaufsichten des Kurses
//  - Unterricht (Lehrkraft): Teilnehmende (Personen, vorhandene Gruppen, eigene Gruppen) und weitere Lehrkräfte (Mitbetreuung)
//  - Prüfung (Schuladministration): Teilnehmende, Raumaufsichten, Korrektor:innen (Erst/Zweit/Dritt), Prüfungseinsicht –
//    jeweils nur für Personen der eigenen Organisation
import { D, byId, upd, create, del, log } from "../data.js?v=8.2";
import { icon, esc, modal, confirmBox, toast, fmtDateTime, parseDate } from "../ui.js?v=8.2";
import { navigate, redraw } from "../app.js?v=8.2";
import { lessonCorrector, me, members, canManageCourse, visibleCourses, visibleRooms, orgName, orgShort, personName, KIND, ROLE_LABEL, STAGE_LABEL } from "../access.js?v=8.2";

const ROOM_STATE = { CREATED: ["In Vorbereitung", "gray"], RUNNING: ["Prüfung läuft", "cyan"], PAUSED: ["Prüfung pausiert", "yellowb"], TERMINATED: ["Prüfung beendet", "green"] };
const UI = { q: "", addQ: "" };

// ---------- Kursliste ----------
export function list() {
  return {
    shell: "staff", rail: "kurse", title: "Kurse",
    render() {
      const p = me();
      if (!p || p.kind === "schueler") return `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Bitte als Lehrkraft oder Schuladministration anmelden.</p><a class="btn" href="#/">Zur Anmeldung</a></div>`;
      const adm = p.kind === "schuladmin";
      const list = visibleCourses(p);
      const own = (c) => members(c).filter((m) => byId("persons", m.person)?.org === p.org);
      return `<div class="pagehead"><div><h1>${adm ? "Prüfungen" : "Mein Unterricht"}</h1><div class="sub">${esc(personName(p))} · ${esc(orgName(p.org))}</div></div>
        ${adm ? "" : `<a class="btn primary" href="#/app/katalog">${icon("copy")} Prüfung aus dem Katalog kopieren</a>`}</div>
      <p class="muted">${adm ? "Prüfungsebene: Prüfungen, an denen Ihre Schule beteiligt ist. Sie ordnen Teilnehmende, Raumaufsichten und Korrektor:innen Ihrer Schule zu und organisieren die Raumaufsichten." : "Unterrichtsebene: aus dem Katalog kopierte Kurse, die Sie besitzen oder mitbetreuen. Fügen Sie Teilnehmende und Lehrkräfte hinzu und planen Sie die Raumaufsicht."}</p>
      ${list.length ? `<div class="tablewrap mt"><table class="tbl"><thead><tr><th>Titel</th><th>Ebene</th><th>${adm ? "Beteiligte Schulen" : "Besitzer"}</th><th class="num">Teilnehmende${adm ? " (eigene Schule)" : ""}</th><th class="num">Raumaufsichten</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map((c) => { const tn = (adm ? own(c) : members(c)).filter((m) => m.role === "teilnehmer"); const rooms = visibleRooms(p).filter((r) => r.course === c.id);
          return `<tr><td><b>${esc(c.title)}</b>${c.catalog ? `<div class="xs muted">Kopie von „${esc(byId("catalog", c.catalog)?.title || "Katalog")}“</div>` : ""}</td><td><span class="badge ${c.kind === "pruefung" ? "purple" : "cyan"}">${KIND[c.kind]}</span></td>
          <td>${adm ? (c.orgs || []).map((o) => esc(orgShort(o))).join(", ") : esc(personName(byId("persons", c.owner)))}</td><td class="num">${new Set(tn.map((m) => m.person)).size}</td><td class="num">${rooms.length}</td><td>${esc(c.status || "–")}</td>
          <td><a class="linkarrow" href="#/app/kurs/${c.id}/mitglieder">${icon("arrow-right")} Öffnen</a></td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="empty">${icon("book-open")}<h3>${adm ? "Keine Prüfungen für Ihre Schule" : "Noch kein Unterricht"}</h3>${adm ? "" : `<p>Kopieren Sie eine Prüfung aus dem Katalog.</p><a class="btn primary" href="#/app/katalog">Zum Katalog</a>`}</div>`}`;
    },
  };
}

// ---------- Kursdetail ----------
export function detail(id, tab) {
  return {
    shell: "staff", rail: "kurse", title: "Kurs",
    render() {
      const c = byId("courses", id); const p = me();
      if (!c) return `<div class="empty">Kurs nicht gefunden. <a href="#/app/kurse">Zur Übersicht</a></div>`;
      if (!canManageCourse(c, p)) return `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Dieser Kurs gehört nicht zu Ihrem Konto bzw. Ihrer Organisation.</p><a class="btn" href="#/app/kurse">Zur Übersicht</a></div>`;
      const tabs = [["mitglieder", "Mitglieder und Gruppen"], ["raumaufsichten", "Raumaufsichten"], ["info", "Kursinformationen"]];
      const body = tab === "raumaufsichten" ? tabRooms(c, p) : tab === "info" ? tabInfo(c) : c.kind === "pruefung" ? tabMembersExam(c, p) : tabMembersLesson(c, p);
      return `<div class="breadcrumb"><a href="#/app/kurse">${p.kind === "schuladmin" ? "Prüfungen" : "Mein Unterricht"}</a>${icon("chevron-right")}<b>${esc(c.title)}</b></div>
      <div class="pagehead"><div><h1>${esc(c.title)}</h1><div class="row mt-s small"><span class="badge ${c.kind === "pruefung" ? "purple" : "cyan"}">${KIND[c.kind]}</span><span>${c.kind === "pruefung" ? "Beteiligte Schulen: " + (c.orgs || []).map((o) => esc(orgShort(o))).join(", ") : "Besitzer: " + esc(personName(byId("persons", c.owner)))}</span></div></div>
        <div class="actions-bar">${c.catalog ? `<a class="btn" href="#/app/vorschau/${c.catalog}/dashboard">${icon("eye")} Vorschau</a>` : ""}<button class="btn primary" data-newroom>${icon("calendar-plus")} Raumaufsicht erstellen</button></div></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/app/kurs/${id}/${k}" class="${k === tab ? "active" : ""}">${l}</a>`).join("")}</nav>${body}`;
    },
    mount(el) {
      const c = byId("courses", id); if (!c || !canManageCourse(c)) return;
      el.querySelectorAll("[data-newroom]").forEach((nr) => (nr.onclick = () => import("./proctor.js?v=8.2").then((m) => m.newRoomDialog(c.id))));
      el.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => addPersons(c, b.dataset.add, b.dataset.stage)));
      el.querySelectorAll("[data-addgroup]").forEach((b) => (b.onclick = () => addGroup(c, b.dataset.addgroup)));
      const ng = el.querySelector("[data-owngroup]"); if (ng) ng.onclick = () => ownGroup(c);
      el.querySelectorAll("[data-rmm]").forEach((b) => (b.onclick = () => removeMember(c, b.dataset.rmm, b.dataset.role)));
      el.querySelectorAll("[data-rmg]").forEach((b) => (b.onclick = () => removeGroup(c, b.dataset.rmg)));
      el.querySelectorAll("[data-stage]").forEach((s) => s.tagName === "SELECT" && (s.onchange = () => setStage(c, s.dataset.pid, +s.value)));
      el.querySelectorAll("[data-gopen]").forEach((b) => (b.onclick = () => { UI["g" + b.dataset.gopen] = !UI["g" + b.dataset.gopen]; redraw(); }));
    },
  };
}

const delBtn = (pid, role, label) => `<button class="iconbtn" data-rmm="${pid}" data-role="${role}" title="Entfernen" aria-label="${esc(label)} entfernen">${icon("trash-2")}</button>`;
function personRows(list, c, role, extraCol) {
  return list.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Anmeldename</th><th>Schule</th>${extraCol ? `<th>${extraCol.head}</th>` : ""}<th>Zugeordnet über</th><th></th></tr></thead><tbody>${list.map((m) => { const pe = byId("persons", m.person); return `<tr><td><b>${esc(personName(pe))}</b></td><td>${esc(pe?.username || "")}</td><td>${esc(orgShort(pe?.org))}</td>${extraCol ? `<td>${extraCol.cell(m)}</td>` : ""}<td>${m.via ? `<span class="badge gray">${icon("users")} Gruppe ${esc(m.via)}</span>` : "einzeln"}</td><td>${m.via || m.role === "besitzer" ? "" : delBtn(m.person, m.role, personName(pe))}</td></tr>`; }).join("")}</tbody></table></div>` : `<div class="empty small">${icon("users")}<div>Noch niemand zugeordnet</div></div>`;
}
function groupRows(c, ownOrgOnly) {
  const p = me();
  const gs = (c.groups || []).map((g) => ({ ...g, gr: byId("groups", g.group) })).filter((g) => g.gr && (!ownOrgOnly || g.gr.org === p.org));
  if (!gs.length) return `<p class="small muted">Keine Gruppen zugeordnet.</p>`;
  return `<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Gruppe</th><th>Art</th><th>Herkunft</th><th class="num">Mitglieder</th><th></th></tr></thead><tbody>${gs.map((g) => `<tr><td><button class="linkbtn" data-gopen="${g.group}">${icon(UI["g" + g.group] ? "chevron-up" : "chevron-down")} <b>${esc(g.gr.name)}</b></button>${UI["g" + g.group] ? `<div class="xs muted mt-s">${(g.gr.members || []).map((id) => esc(personName(byId("persons", id)))).join(" · ")}</div>` : ""}</td><td>${g.gr.kind === "klasse" ? "Klasse" : g.gr.kind === "kurs" ? "Kurs" : "eigene Gruppe"}</td><td>${g.gr.source === "kurs" ? "im Kurs angelegt" : "Schulverwaltung"}</td><td class="num">${(g.gr.members || []).length}</td><td><button class="iconbtn" data-rmg="${g.group}" title="Gruppe entfernen" aria-label="Gruppe ${esc(g.gr.name)} entfernen">${icon("trash-2")}</button></td></tr>`).join("")}</tbody></table></div>`;
}

// Unterricht: Lehrkraft verwaltet Teilnehmende und Mitbetreuung
function tabMembersLesson(c, p) {
  const ms = members(c);
  const teachers = ms.filter((m) => m.role === "besitzer" || m.role === "mitbetreuung");
  const tn = ms.filter((m) => m.role === "teilnehmer");
  return `<div class="notice info small mb">${icon("info")}<span>Unterrichtsebene: Sie fügen Schülerinnen und Schüler (einzeln oder als Gruppe) sowie weitere Lehrkräfte hinzu. Weitere Lehrkräfte erhalten die <b>Mitbetreuung</b> mit denselben Rechten wie der Besitzer.</span></div>
  <div class="card pad"><div class="row between wrap"><h3>${icon("school")} Lehrkräfte (${teachers.length})</h3><button class="btn sm" data-add="mitbetreuung">${icon("user-round-plus")} Lehrkraft hinzufügen</button></div>
    ${personRows(teachers, c, "", { head: "Rolle", cell: (m) => `<span class="badge ${m.role === "besitzer" ? "dark" : "gray"}">${ROLE_LABEL[m.role]}</span>${lessonCorrector(c) === m.person ? ` <span class="badge lime" title="Korrigiert die Arbeiten dieses Kurses">${icon("file-pen-line")} Korrektur</span>` : ""}` })}
    <p class="xs muted" style="margin-bottom:0">Im Unterricht korrigiert genau eine Lehrkraft (zunächst der Besitzer). Die Korrektur kann in der Korrekturübersicht an eine andere Lehrkraft dieses Kurses weitergegeben werden.</p></div>
  <div class="card pad mt"><div class="row between wrap"><h3>${icon("users")} Gruppen</h3><div class="row wrap"><button class="btn sm" data-addgroup="teilnehmer">${icon("users")} Klasse/Kurs hinzufügen</button><button class="btn sm" data-owngroup>${icon("plus")} Eigene Gruppe anlegen</button></div></div>
    <p class="xs muted">Klassen und Kurse stammen aus der Schulverwaltung. Eigene Gruppen legen Sie im Kurs aus einzelnen Schülerinnen und Schülern an.</p>${groupRows(c)}</div>
  <div class="card pad mt"><div class="row between wrap"><h3>${icon("graduation-cap")} Teilnehmende (${new Set(tn.map((m) => m.person)).size})</h3><button class="btn sm" data-add="teilnehmer">${icon("user-round-plus")} Schüler:innen hinzufügen</button></div>
    ${personRows(tn, c, "teilnehmer")}</div>`;
}
// Prüfung: Schuladministration verwaltet Rollen nur für die eigene Organisation
function tabMembersExam(c, p) {
  const ms = members(c);
  const mine = ms.filter((m) => byId("persons", m.person)?.org === p.org);
  const hidden = new Set(ms.filter((m) => byId("persons", m.person)?.org !== p.org).map((m) => m.person)).size;
  const sec = (role, ic, title, addLabel, extra) => { const l = mine.filter((m) => m.role === role); return `<div class="card pad mt"><div class="row between wrap"><h3>${icon(ic)} ${title} (${new Set(l.map((m) => m.person)).size})</h3><div class="row wrap">${role === "teilnehmer" ? `<button class="btn sm" data-addgroup="teilnehmer">${icon("users")} Klasse/Kurs hinzufügen</button>` : ""}<button class="btn sm" data-add="${role}">${icon("user-round-plus")} ${addLabel}</button></div></div>${role === "teilnehmer" ? groupRows(c, true) : ""}${personRows(l, c, role, extra)}</div>`; };
  return `<div class="notice info small mb">${icon("info")}<span>Prüfungsebene (Task 52 / 24): Sie ordnen Personen Ihrer Schule <b>${esc(orgName(p.org))}</b> zu. ${hidden ? `${hidden} Mitglieder anderer Schulen sind ausgeblendet.` : ""}</span></div>
  ${sec("teilnehmer", "graduation-cap", "Teilnehmende", "Teilnehmende hinzufügen")}
  ${sec("raumaufsicht", "monitor", "Raumaufsichten", "Raumaufsicht hinzufügen")}
  ${sec("korrektor", "file-pen-line", "Korrektor:innen", "Korrektor:in hinzufügen", { head: "Korrekturrolle", cell: (m) => `<select class="select" style="width:auto;min-height:30px;padding:2px 8px" data-stage data-pid="${m.person}" aria-label="Korrekturrolle">${[1, 2, 3].map((s) => `<option value="${s}" ${+m.stage === s ? "selected" : ""}>${STAGE_LABEL[s]}</option>`).join("")}</select>` })}
  ${sec("pruefungseinsicht", "eye", "Prüfungseinsicht", "Person hinzufügen")}`;
}
function tabRooms(c, p) {
  const rooms = visibleRooms(p).filter((r) => r.course === c.id);
  return `<div class="row between wrap mb"><p class="muted" style="margin:0">${c.kind === "pruefung" ? "Raumaufsichten Ihrer Schule für diese Prüfung." : "Raumaufsichten dieses Unterrichtskurses."}</p><button class="btn primary" data-newroom>${icon("calendar-plus")} Raumaufsicht erstellen</button></div>
  ${rooms.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Raum</th><th>Start</th><th class="num">Aufsichten</th><th class="num">Teilnehmende</th><th>Status</th><th></th></tr></thead><tbody>${rooms.map((r) => `<tr><td><b>${esc(r.name)}</b></td><td>${fmtDateTime(parseDate(r.planned_start))}</td><td class="num">${D.supervisors.filter((s) => s.room === r.id).length}</td><td class="num">${D.participants.filter((x) => x.room === r.id).length}</td><td><span class="badge ${ROOM_STATE[r.state]?.[1]}">${ROOM_STATE[r.state]?.[0]}</span></td><td><a class="linkarrow" href="#/app/raum/${r.id}/meinraum">${icon("arrow-right")} Zur Raumaufsicht</a></td></tr>`).join("")}</tbody></table></div>`
  : `<div class="empty">${icon("calendar-plus")}<h3>Noch keine Raumaufsicht</h3><p>Erstellen Sie eine Raumaufsicht und ordnen Sie anschließend Teilnehmende und Aufsichtspersonen aus den Kursmitgliedern zu.</p></div>`}`;
}
function tabInfo(c) {
  const k = byId("catalog", c.catalog);
  return `<div class="card pad" style="max-width:720px"><div class="kv">${icon("book-open")}<div><div class="small">Ebene</div><span class="v">${KIND[c.kind]}</span></div></div>
    <div class="kv">${icon("copy")}<div><div class="small">Grundlage</div><span class="v">${esc(k?.title || "Prüfung der Koordinierungsstelle")}</span></div></div>
    <div class="kv">${icon("building-2")}<div><div class="small">Organisation(en)</div><span class="v">${c.kind === "pruefung" ? (c.orgs || []).map((o) => esc(orgName(o))).join(", ") : esc(orgName(c.org))}</span></div></div>
    <div class="kv">${icon("info")}<div><div class="small">Beschreibung</div><span class="v">${esc(c.description || k?.description || "–")}</span></div></div></div>`;
}

// ---------- Änderungen ----------
const ROLE_FOR = { teilnehmer: "schueler", mitbetreuung: "lehrkraft", raumaufsicht: "lehrkraft", korrektor: "lehrkraft", pruefungseinsicht: "lehrkraft" };
async function addPersons(c, role, stage) {
  const p = me();
  const existing = new Set(members(c).filter((m) => m.role === role || (role === "mitbetreuung" && m.role === "besitzer")).map((m) => m.person));
  const kind = ROLE_FOR[role];
  const cand = D.persons.filter((x) => x.org === p.org && (role === "pruefungseinsicht" ? x.kind !== "schueler" : x.kind === kind) && !existing.has(x.id)).sort((a, b) => a.lastname.localeCompare(b.lastname));
  const title = { teilnehmer: "Schüler:innen hinzufügen", mitbetreuung: "Lehrkraft hinzufügen (Mitbetreuung)", raumaufsicht: "Raumaufsicht hinzufügen", korrektor: "Korrektor:in hinzufügen", pruefungseinsicht: "Prüfungseinsicht hinzufügen" }[role];
  const v = await modal({ title, size: "wide",
    body: `<div class="row between wrap mb"><span class="small">Personen der Organisation <b>${esc(orgName(p.org))}</b></span><div class="search" style="width:280px"><input class="input" data-s placeholder="Name oder Anmeldename suchen" aria-label="Suchen">${icon("search")}</div></div>
      ${role === "korrektor" ? `<div class="field" style="max-width:280px"><label class="lbl">Korrekturrolle</label><select class="select" data-st>${[1, 2, 3].map((s) => `<option value="${s}">${STAGE_LABEL[s]}</option>`).join("")}</select></div>` : ""}
      <div class="tablewrap" style="max-height:360px"><table class="tbl compact"><thead><tr><th><input type="checkbox" data-all aria-label="Alle auswählen"></th><th>Name</th><th>Anmeldename</th><th>Klasse/Kurs</th></tr></thead><tbody>${cand.length ? cand.map((x) => `<tr data-row="${esc((x.lastname + " " + x.firstname + " " + x.username).toLowerCase())}"><td><input type="checkbox" data-p="${x.id}" aria-label="${esc(personName(x))}"></td><td>${esc(personName(x))}</td><td>${esc(x.username)}</td><td class="xs">${esc(D.groups.filter((g) => (g.members || []).includes(x.id) && g.source !== "kurs").map((g) => g.name).join(", "))}</td></tr>`).join("") : `<tr><td colspan="4"><div class="empty small">Keine weiteren Personen verfügbar</div></td></tr>`}</tbody></table></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Hinzufügen</button>`,
    onMount(m, close) {
      const s = m.querySelector("[data-s]"); s.oninput = () => m.querySelectorAll("[data-row]").forEach((r) => (r.style.display = r.dataset.row.includes(s.value.toLowerCase()) ? "" : "none"));
      const all = m.querySelector("[data-all]"); all.onchange = () => m.querySelectorAll("[data-p]").forEach((x) => { if (x.closest("tr").style.display !== "none") x.checked = all.checked; });
      m.querySelector("[data-ok]").onclick = () => close({ ids: [...m.querySelectorAll("[data-p]:checked")].map((x) => x.dataset.p), stage: +(m.querySelector("[data-st]")?.value || stage || 1) });
    } });
  if (!v || !v.ids.length) return;
  const add = v.ids.map((id) => (role === "korrektor" ? { person: id, role, stage: v.stage } : { person: id, role }));
  await upd("courses", c.id, { members: [...(c.members || []), ...add] });
  toast(`${add.length} ${add.length === 1 ? "Person" : "Personen"} hinzugefügt`, `${ROLE_LABEL[role]}${role === "korrektor" ? " · " + STAGE_LABEL[v.stage] : ""}: ${v.ids.map((id) => byId("persons", id)?.lastname).join(", ")}`);
}
async function addGroup(c, role) {
  const p = me();
  const have = new Set((c.groups || []).map((g) => g.group));
  const cand = D.groups.filter((g) => g.org === p.org && g.source === "schulverwaltung" && !have.has(g.id)).sort((a, b) => a.name.localeCompare(b.name));
  const v = await modal({ title: "Klasse oder Kurs hinzufügen", size: "narrow",
    body: `<p class="small">Alle Mitglieder der Gruppe werden als <b>Teilnehmende</b> zugeordnet. Spätere Änderungen der Gruppe in der Schulverwaltung wirken sich automatisch aus.</p>${cand.length ? cand.map((g) => `<label class="checkbox" style="display:flex;margin:8px 0"><input type="checkbox" data-g="${g.id}"> <b>${esc(g.name)}</b>&nbsp;<span class="muted small">(${g.kind === "klasse" ? "Klasse" : "Kurs"}, ${(g.members || []).length} Mitglieder)</span></label>`).join("") : `<div class="empty small">Keine weiteren Gruppen verfügbar</div>`}`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Hinzufügen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close([...m.querySelectorAll("[data-g]:checked")].map((x) => x.dataset.g))) });
  if (!v || !v.length) return;
  await upd("courses", c.id, { groups: [...(c.groups || []), ...v.map((g) => ({ group: g, role }))] });
  toast("Gruppe hinzugefügt", v.map((g) => byId("groups", g)?.name).join(", "));
}
async function ownGroup(c) {
  const p = me();
  const pool = D.persons.filter((x) => x.org === p.org && x.kind === "schueler").sort((a, b) => a.lastname.localeCompare(b.lastname));
  const inCourse = new Set(members(c).filter((m) => m.role === "teilnehmer").map((m) => m.person));
  const v = await modal({ title: "Eigene Gruppe anlegen", size: "wide",
    body: `<div class="field"><label class="lbl">Gruppenname</label><input class="input" data-n placeholder="z. B. Nachschreiber, Gruppe A"></div>
      <div class="row between"><span class="small">Mitglieder auswählen (Teilnehmende des Kurses stehen oben)</span><div class="search" style="width:260px"><input class="input" data-s placeholder="Suchen" aria-label="Suchen">${icon("search")}</div></div>
      <div class="tablewrap mt-s" style="max-height:320px"><table class="tbl compact"><tbody>${[...pool.filter((x) => inCourse.has(x.id)), ...pool.filter((x) => !inCourse.has(x.id))].map((x) => `<tr data-row="${esc((x.lastname + " " + x.firstname).toLowerCase())}"><td><input type="checkbox" data-p="${x.id}" aria-label="${esc(personName(x))}"></td><td>${esc(personName(x))}</td><td class="xs muted">${inCourse.has(x.id) ? "bereits Teilnehmende/r" : ""}</td></tr>`).join("")}</tbody></table></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Gruppe anlegen</button>`,
    onMount(m, close) {
      const s = m.querySelector("[data-s]"); s.oninput = () => m.querySelectorAll("[data-row]").forEach((r) => (r.style.display = r.dataset.row.includes(s.value.toLowerCase()) ? "" : "none"));
      m.querySelector("[data-ok]").onclick = () => { const n = m.querySelector("[data-n]").value.trim(); const ids = [...m.querySelectorAll("[data-p]:checked")].map((x) => x.dataset.p); if (!n) { m.querySelector("[data-n]").style.borderColor = "var(--red)"; return; } if (!ids.length) return toast("Bitte Mitglieder auswählen", "", "info"); close({ n, ids }); };
    } });
  if (!v) return;
  const g = await create("groups", { name: v.n, org: p.org, kind: "eigen", source: "kurs", course: c.id, members: v.ids });
  await upd("courses", c.id, { groups: [...(c.groups || []), { group: g.id, role: "teilnehmer" }] });
  toast("Eigene Gruppe angelegt", `${v.n} (${v.ids.length} Mitglieder)`);
}
async function removeMember(c, pid, role) {
  const pe = byId("persons", pid);
  if (!(await confirmBox("Mitglied entfernen", `${esc(personName(pe))} wird als ${esc(ROLE_LABEL[role])} aus dem Kurs entfernt.`, "Entfernen"))) return;
  await upd("courses", c.id, { members: (c.members || []).filter((m) => !(m.person === pid && m.role === role)) });
}
async function removeGroup(c, gid) {
  const g = byId("groups", gid);
  if (!(await confirmBox("Gruppe entfernen", `Die Gruppe ${esc(g?.name || "")} wird aus dem Kurs entfernt.`, "Entfernen"))) return;
  await upd("courses", c.id, { groups: (c.groups || []).filter((x) => x.group !== gid) });
  if (g?.source === "kurs") await del("groups", gid);
}
async function setStage(c, pid, stage) {
  await upd("courses", c.id, { members: (c.members || []).map((m) => (m.person === pid && m.role === "korrektor" ? { ...m, stage } : m)) });
  toast("Korrekturrolle geändert", `${personName(byId("persons", pid))}: ${STAGE_LABEL[stage]}`);
}

// Kurs aus dem Katalog kopieren (Unterrichtsebene, Task 31)
export async function copyToLesson(cat) {
  const p = me();
  if (!p || p.kind !== "lehrkraft") { toast("Nur auf Unterrichtsebene", "Das Kopieren aus dem Katalog ist Lehrkräften vorbehalten. Melden Sie sich als Lehrkraft an.", "info"); return null; }
  const n = D.courses.filter((x) => x.catalog === cat.id && x.owner === p.id).length + 1;
  const v = await modal({ title: "Prüfung als Unterricht kopieren",
    body: `<div class="field"><label class="lbl">Kurstitel</label><input class="input" data-t value="${esc(cat.title)} – ${esc(p.lastname)}${n > 1 ? " " + n : ""}"></div><p class="small">${esc(cat.description)}</p>
      <div class="notice info small">${icon("info")}<span>Die Kopie gehört Ihnen (<b>Besitzer</b>) und erscheint unter „Mein Unterricht“. Anschließend fügen Sie Teilnehmende und ggf. weitere Lehrkräfte hinzu und planen die Raumaufsicht.</span></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("copy")} Kopieren</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close(m.querySelector("[data-t]").value.trim())) });
  if (!v) return null;
  const c = await create("courses", { title: v, kind: "unterricht", catalog: cat.id, org: p.org, orgs: [], owner: p.id, members: [{ person: p.id, role: "besitzer" }], groups: [], status: "veröffentlicht", exam_code: "FA230", description: cat.description });
  toast("Kurs kopiert", `„${v}“ – jetzt Mitglieder hinzufügen.`);
  navigate(`#/app/kurs/${c.id}/mitglieder`);
  return c;
}

// Kammer: externe Prüflinge, Zuordnung je Prüfung und Prüfling (Arten 1–4), Annahme durch die Schule, Durchführungsstand,
// Korrektorenpool und Benachrichtigungen (Kammeradministration ↔ Schuladministration)
//  - Die Kammer sieht nur die Informationen ihrer eigenen externen Prüflinge (nicht des gesamten Raums)
//  - Die Schule sieht vor der Annahme nur Anzahl, Art und Nachteilsausgleich; nach der Annahme Name, Vorname, Prüflingsnummer, NTA
//  - Protokolleinträge einer Schule sieht die Kammer erst nach der Protokollfreigabe durch die Schule
import { D, byId, upd, create, log, setting } from "../data.js?v=10.1";
import { icon, esc, modal, confirmBox, toast, fmtDateTime, parseDate, statusChip, isFinished, isActive } from "../ui.js?v=10.1";
import { navigate, redraw } from "../app.js?v=10.1";
import { me, members, personName, orgName, orgShort, isKammerOrg, isExtern, ART, EXT_STATUS, extOf, atSchool, extAccepted, extForSchool, isAdm, isLeitung, isOrga } from "../access.js?v=10.1";

const UI = { allSchools: false, sel: new Set(), q: "" };
const nowIso = () => new Date().toISOString().replace("T", " ");
const isKA = (p = me()) => isAdm(p) && isKammerOrg(p.org);
// Reiter einer Prüfung auf Prüfungsebene je nach Rolle: Organisation (O) bzw. Leitung (L), kombinierbar
export function examTabs(c, p, xo = 0) {
  if (c.kind !== "pruefung" || !isAdm(p)) return [["mitglieder", "Mitglieder und Gruppen"], ["raumaufsichten", "Raumaufsichten"], ["info", "Kursinformationen"]];
  const O = isOrga(p, c), L = isLeitung(p);
  const t = isKA(p)
    ? [["zuordnung", "Externe Prüflinge", O], ["mitglieder", "Rollen in der Kammer", O], ["korrektoren", "Korrektoren", O], ["raumaufsichten", "Raumaufsichten", O || L], ["durchfuehrung", "Durchführung", O || L], ["info", "Kursinformationen", true]]
    : [["mitglieder", "Mitglieder und Gruppen", O], ["extern", `Externe Prüflinge${xo ? ` <span class="badge yellowb">${xo}</span>` : ""}`, O || L], ["korrektoren", "Korrektoren", O], ["raumaufsichten", "Raumaufsichten", O || L], ["info", "Kursinformationen", true]];
  return t.filter((x) => x[2]).map(([k, l]) => [k, l]);
}
export const firstTab = (c, p, xo = 0) => { const t = examTabs(c, p, xo).map((x) => x[0]); return xo && t.includes("extern") ? "extern" : t[0] || "info"; };
export const artBadge = (art) => (art ? `<span class="badge ${+art === 2 ? "lime" : +art === 3 ? "orange" : "purple"}" title="${esc(ART[art].text)}">Art ${art} · ${esc(ART[art].short)}</span>` : `<span class="badge gray">noch nicht versorgt</span>`);
export const extStatusBadge = (e) => (!e ? `<span class="badge gray">offen</span>` : `<span class="badge ${EXT_STATUS[e.status]?.[1] || "gray"}">${esc(EXT_STATUS[e.status]?.[0] || e.status)}</span>`);
// Hinweis „extern“ an Teilnehmenden (Raumaufsicht, Listen)
export function extTag(p) {
  const pe = byId("persons", p?.person); if (!isExtern(pe)) return "";
  return ` <span class="badge cyan xs" title="Externer Prüfling der Kammer – Nachteilsausgleich pflegt die Kammer">${icon("building-2")} extern · ${esc(orgShort(pe.org))}</span>`;
}
// Teilnahmen eines externen Prüflings in einer Prüfung
const partOf = (c, pid) => D.participants.find((x) => x.person === pid && byId("rooms", x.room)?.course === c.id) || null;
const roomOf = (x) => byId("rooms", x?.room);
// Abgeschlossen: Änderungen der Zuordnung nur bis zum Abschluss der Prüfung (für diesen Prüfling)
const finishedFor = (c, pid) => { const x = partOf(c, pid); return !!x && (isFinished(x.status) || roomOf(x)?.state === "TERMINATED"); };
// Kammer-Prüflinge im Kurs (Mitglieder mit Rolle „Teilnehmende“)
const kammerPupils = (c, org) => [...new Set(members(c).filter((m) => m.role === "teilnehmer").map((m) => m.person))].map((id) => byId("persons", id)).filter((pe) => isExtern(pe) && pe.org === org).sort((a, b) => a.lastname.localeCompare(b.lastname));
export const unsupplied = (c, org) => kammerPupils(c, org).filter((pe) => { const e = extOf(c, pe.id); return !e || e.status === "abgelehnt"; });
// Schulen der Prüfung (vom IBBW hinzugefügt); Standard: nur Schulen des eigenen Kammerbezirks
const schoolsOf = (c, kammer, all) => (c.orgs || []).map((o) => byId("orgs", o)).filter((o) => o && o.type !== "kammer" && (all || o.bezirk === kammer?.bezirk)).sort((a, b) => a.name.localeCompare(b.name));
export const poolOf = (org) => (setting("kpool:" + org, []) || []).map((x) => ({ ...x, pe: byId("persons", x.person) })).filter((x) => x.pe);

// ---------- Benachrichtigungen ----------
export async function notify(org, role, c, title, body, link, kind = "info") {
  if (!org) return;
  const pe = me();
  await create("notices", { org, role, course: c?.id || "", title, body, link, kind, read: false, by: pe ? personName(pe) : "System" }).catch(() => {});
}
// Vorschläge zur Annahme sieht die Prüfungsleitung, alle übrigen Benachrichtigungen Leitung und Organisation
const myNotices = (p = me()) => (p && isAdm(p) ? D.notices.filter((n) => n.org === p.org && (n.kind !== "vorschlag" || isLeitung(p))).sort((a, b) => String(b.created).localeCompare(String(a.created))) : []);
export function noticesBox(p = me()) {
  const list = myNotices(p); const unread = list.filter((n) => !n.read);
  if (!list.length) return "";
  const KIND = { vorschlag: "user-round-plus", annahme: "circle-check", ablehnung: "circle-x", umzug: "repeat", rueckzug: "undo-2", protokoll: "file-text", art: "pencil", info: "info" };
  return `<section class="card pad mb noticebox" aria-label="Benachrichtigungen"><div class="row between wrap"><h3>${icon("bell")} Benachrichtigungen ${unread.length ? `<span class="badge red">${unread.length} neu</span>` : ""}</h3>${unread.length ? `<button class="btn ghost xs" data-nall>${icon("check")} Alle als gelesen markieren</button>` : ""}</div>
    <ul class="noticelist">${list.slice(0, 6).map((n) => `<li class="${n.read ? "read" : ""}">${icon(KIND[n.kind] || "info")}<div class="grow"><b>${esc(n.title)}</b><div class="small">${esc(n.body)}</div><div class="xs muted">${esc(n.by || "")}${n.created ? " · " + fmtDateTime(parseDate(n.created)) : ""}</div></div>
      <div class="row" style="gap:6px">${n.link ? `<button class="btn sm" data-nopen="${n.id}">${icon("arrow-right")} Öffnen</button>` : ""}${n.read ? "" : `<button class="iconbtn" data-nread="${n.id}" title="Als gelesen markieren" aria-label="Als gelesen markieren">${icon("check")}</button>`}</div></li>`).join("")}</ul></section>`;
}
// kompakt im Kurs: nur ungelesene Benachrichtigungen zu dieser Prüfung
export function courseNotices(c, p = me()) {
  const list = myNotices(p).filter((n) => !n.read && n.course === c?.id);
  return list.map((n) => `<div class="notice warn small mb">${icon("bell")}<span><b>${esc(n.title)}:</b> ${esc(n.body)}</span><button class="iconbtn" data-nread="${n.id}" title="Als gelesen markieren" aria-label="Als gelesen markieren">${icon("check")}</button></div>`).join("");
}
export function bindNotices(el) {
  el.querySelectorAll("[data-nopen]").forEach((b) => (b.onclick = async () => { const n = byId("notices", b.dataset.nopen); if (!n) return; if (!n.read) upd("notices", n.id, { read: true }); navigate(n.link); }));
  el.querySelectorAll("[data-nread]").forEach((b) => (b.onclick = () => upd("notices", b.dataset.nread, { read: true })));
  const all = el.querySelector("[data-nall]"); if (all) all.onclick = async () => { for (const n of myNotices().filter((x) => !x.read)) await upd("notices", n.id, { read: true }); };
}
export const unreadCount = (p = me()) => myNotices(p).filter((n) => !n.read).length;

// ---------- Externe Prüflinge der Kammer (Personenverwaltung) ----------
export function externView() {
  return {
    shell: "staff", rail: "kammer", title: "Externe Prüflinge",
    render() {
      const p = me();
      if (!isKA(p)) return `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Externe Prüflinge verwaltet die Kammer (Prüfungsorganisation).</p><a class="btn" href="#/">Zur Anmeldung</a></div>`;
      const ro = !isOrga(p);
      let list = D.persons.filter((x) => isExtern(x) && x.org === p.org).sort((a, b) => a.lastname.localeCompare(b.lastname));
      if (UI.q) { const q = UI.q.toLowerCase(); list = list.filter((x) => (x.lastname + " " + x.firstname + " " + x.pnr).toLowerCase().includes(q)); }
      const exams = (pe) => D.courses.filter((c) => c.kind === "pruefung" && members(c).some((m) => m.person === pe.id && m.role === "teilnehmer"));
      const pool = poolOf(p.org);
      return `${noticesBox(p)}<div class="pagehead"><div><h1>Externe Prüflinge</h1><div class="sub">${esc(personName(p))} · ${esc(orgName(p.org))}</div></div>
        ${ro ? `<span class="badge gray">${icon("eye")} nur lesend – Pflege durch die Prüfungsorganisation</span>` : `<div class="row wrap"><button class="btn" data-csv>${icon("upload")} CSV importieren</button><button class="btn primary" data-newx>${icon("user-round-plus")} Prüfling anlegen</button></div>`}</div>
      <p class="muted">Externe Prüfungsteilnehmende der Kammer mit Name, Vorname, Prüflingsnummer und Nachteilsausgleich. Den Nachteilsausgleich pflegt ausschließlich die Kammer – die Schulen sehen ihn nur lesend. Die Zuordnung zu Schulen erfolgt je Prüfung und Prüfling unter „Prüfungen“ › „Externe Prüflinge“.</p>
      <div class="row between wrap mb"><div class="search"><input class="input" style="width:280px" data-xq placeholder="Name oder Prüflingsnummer" value="${esc(UI.q)}" aria-label="Prüflinge suchen">${icon("search")}</div><span class="small muted">${list.length} Prüfling(e)</span></div>
      <div class="tablewrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Prüflingsnummer</th><th>Nachteilsausgleich</th><th>Prüfungen (Zuordnung)</th></tr></thead><tbody>
      ${list.map((x) => `<tr><td><b>${esc(personName(x))}</b></td><td>${esc(x.pnr || "–")}</td><td><select class="select sm" ${ro ? "disabled" : ""} data-xnta="${x.id}" aria-label="Nachteilsausgleich ${esc(personName(x))}" style="width:auto">${[0, 10, 15, 20, 30, 45].map((m) => `<option value="${m}" ${m === (+x.nta || 0) ? "selected" : ""}>${m ? m + " Minuten" : "keiner"}</option>`).join("")}</select></td>
        <td class="small">${exams(x).map((c) => { const e = extOf(c, x.id); return `<div><a href="#/app/kurs/${c.id}/zuordnung">${esc(c.title)}</a> · ${e ? `Art ${e.art}${e.school ? " · " + esc(orgShort(e.school)) : ""} · ${esc(EXT_STATUS[e.status]?.[0] || e.status)}` : `<span class="badge gray">noch nicht versorgt</span>`}</div>`; }).join("") || `<span class="muted">keiner Prüfung zugeordnet</span>`}</td></tr>`).join("") || `<tr><td colspan="4"><div class="empty small">Keine Prüflinge gefunden.</div></td></tr>`}</tbody></table></div>
      <section class="card pad mt-l"><h3>${icon("users")} Korrektorenpool (Art 4)</h3>
        <p class="small muted">Lehrkräfte der Schulen, die sich ehrenamtlich zur Korrektur für die Kammer bereit erklärt haben. Die Bereitschaft wird im Vorfeld außerhalb der Plattform geklärt. Aus Datenschutzgründen sieht die Kammer nur diese Personen – mit Name, Schule und Fach. Sie korrigieren pseudonymisiert (nur Prüflingsnummer).</p>
        ${pool.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Schule</th><th>Fach</th></tr></thead><tbody>${pool.map((x) => `<tr><td>${esc(personName(x.pe))}</td><td>${esc(orgName(x.pe.org))}</td><td>${esc(x.fach || "–")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted">Noch keine Lehrkräfte im Pool.</p>`}</section>`;
    },
    mount(el) {
      bindNotices(el);
      const q = el.querySelector("[data-xq]"); if (q) q.oninput = () => { UI.q = q.value; const pos = q.selectionStart; redraw(); const n = document.querySelector("[data-xq]"); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
      el.querySelectorAll("[data-xnta]").forEach((s) => (s.onchange = () => setNta(s.dataset.xnta, +s.value)));
      const nb = el.querySelector("[data-newx]"); if (nb) nb.onclick = () => newExtern();
      const cb = el.querySelector("[data-csv]"); if (cb) cb.onclick = () => csvImport();
    },
  };
}
const unameOf = (l, f) => (f[0] + "." + l).toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z.\-]/g, "");
async function addExtern(l, f, pnr, nta) {
  const p = me();
  const u = unameOf(l, f); const n = D.persons.filter((x) => x.username.startsWith(u)).length;
  return create("persons", { lastname: l, firstname: f, username: n ? u + (n + 1) : u, org: p.org, kind: "extern", short: "", email: "", orgs: [], pnr, nta: +nta || 0 });
}
async function newExtern() {
  const v = await modal({ title: "Externen Prüfling anlegen", size: "narrow",
    body: `<div class="field"><label class="lbl" for="xl">Name</label><input id="xl" class="input" data-f="l"></div><div class="field"><label class="lbl" for="xf">Vorname</label><input id="xf" class="input" data-f="f"></div>
      <div class="field"><label class="lbl" for="xp">Prüflingsnummer</label><input id="xp" class="input" data-f="pnr" placeholder="z. B. MS-26-1010"></div>
      <div class="field"><label class="lbl" for="xn">Nachteilsausgleich</label><select id="xn" class="select" data-f="nta">${[0, 10, 15, 20, 30, 45].map((m) => `<option value="${m}">${m ? m + " Minuten" : "keiner"}</option>`).join("")}</select></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Anlegen</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value.trim())); if (!o.l || !o.f || !o.pnr) return toast("Bitte Name, Vorname und Prüflingsnummer angeben", "", "error"); close(o); }) });
  if (!v) return;
  await addExtern(v.l, v.f, v.pnr, v.nta); toast("Prüfling angelegt", `${v.l}, ${v.f} (${v.pnr})`);
}
async function csvImport() {
  const v = await modal({ title: "Externe Prüflinge per CSV importieren", size: "wide",
    body: `<p class="small">Eine Zeile je Prüfling: <code>Name;Vorname;Prüflingsnummer;Nachteilsausgleich in Minuten</code>. Kopfzeile optional.</p><textarea class="input" rows="8" data-csvt placeholder="Name;Vorname;Prüflingsnummer;NTA&#10;Meyer;Lea;MS-26-1101;0&#10;Ünal;Deniz;MS-26-1102;15"></textarea>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("upload")} Importieren</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close(m.querySelector("[data-csvt]").value)) });
  if (!v) return;
  const rows = v.split(/\r?\n/).map((l) => l.split(/[;,\t]/).map((x) => x.trim())).filter((r) => r.length >= 3 && r[0] && !/^name$/i.test(r[0]));
  for (const r of rows) await addExtern(r[0], r[1], r[2], r[3]);
  toast("Import abgeschlossen", `${rows.length} Prüfling(e) angelegt.`);
}
async function setNta(pid, nta) {
  const pe = byId("persons", pid); if (!pe) return;
  await upd("persons", pid, { nta });
  // Teilnahmen, die noch nicht begonnen haben, übernehmen den geänderten Nachteilsausgleich
  for (const x of D.participants.filter((y) => y.person === pid && ["nicht_eingeloggt", "wartend", "wartend_bestaetigt"].includes(y.status) && roomOf(y)?.state === "CREATED")) {
    await upd("participants", x.id, { nta }); log(x.room, x, "Nachteilsausgleich durch die Kammer geändert", `${nta} Min.`, "aktion", personName(me()));
  }
  toast("Nachteilsausgleich gespeichert", `${personName(pe)}: ${nta ? nta + " Minuten" : "keiner"}`);
}

// ---------- Prüfung (Kammer): Zuordnung der externen Prüflinge ----------
export function tabZuordnung(c, p) {
  const kammer = byId("orgs", p.org);
  const list = kammerPupils(c, p.org);
  const un = unsupplied(c, p.org);
  const cnt = (f) => list.filter((pe) => f(extOf(c, pe.id))).length;
  const sch = schoolsOf(c, kammer, true);
  return `<div class="notice info small mb">${icon("info")}<span><b>Zuordnung je Prüfling:</b> Art 1 – die Kammer prüft selbst · Art 2 – Durchführung und Korrektur an einer Schule · Art 3 – nur Durchführung an einer Schule, Korrektur durch die Kammer · Art 4 – die Kammer prüft, Korrektur durch bereite Lehrkräfte der Schulen (pseudonymisiert). Ob externe Prüflinge an einer Schule schreiben dürfen, klären Sie vorab außerhalb der Plattform – die Schule nimmt jeden Vorschlag selbst an. Korrekturen der Zuordnung sind bis zum Abschluss der Prüfung möglich.</span></div>
  <div class="row wrap mb" style="gap:8px">${[["Prüflinge", list.length, "gray"], ["noch nicht versorgt", un.length, un.length ? "red" : "gray"], ["Annahme offen", cnt((e) => e?.status === "vorgeschlagen"), "yellowb"], ["an Schulen angenommen", cnt((e) => extAccepted(e)), "green"], ["bei der Kammer", cnt((e) => e?.status === "kammer"), "cyan"]].map(([l, n, b]) => `<span class="badge ${b}">${l}: <b>${n}</b></span>`).join("")}</div>
  ${un.length ? `<div class="notice warn small mb">${icon("triangle-alert")}<span><b>Noch nicht versorgt:</b> ${un.map((pe) => `${esc(personName(pe))} (${esc(pe.pnr)})${extOf(c, pe.id)?.status === "abgelehnt" ? ` – von ${esc(orgShort(extOf(c, pe.id).school))} abgelehnt` : ""}`).join(" · ")}. Ordnen Sie diese Prüflinge einer anderen Schule zu oder übernehmen Sie sie selbst (Art 1 oder 4).</span></div>` : ""}
  <div class="row between wrap mb"><div class="row wrap"><button class="btn" data-add="teilnehmer">${icon("user-round-plus")} Prüflinge zur Prüfung hinzufügen</button><button class="btn primary" data-xassign ${UI.sel.size ? "" : "disabled"}>${icon("send")} Ausgewählte zuordnen${UI.sel.size ? ` (${UI.sel.size})` : ""}</button></div>
    <span class="small muted">Teilnehmende Schulen (vom IBBW hinzugefügt): ${sch.map((o) => `${esc(o.short)}${o.bezirk !== kammer?.bezirk ? " <span class=\"xs\">(anderer Bezirk)</span>" : ""}`).join(", ") || "–"}</span></div>
  ${list.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th><input type="checkbox" data-xall aria-label="Alle auswählen"></th><th>Name</th><th>Prüflingsnummer</th><th>NTA</th><th>Art</th><th>Schule</th><th>Status</th><th>Durchführung</th><th></th></tr></thead><tbody>
  ${list.map((pe) => { const e = extOf(c, pe.id); const x = partOf(c, pe.id); const r = roomOf(x); const fin = finishedFor(c, pe.id);
    return `<tr><td><input type="checkbox" data-xsel="${pe.id}" ${UI.sel.has(pe.id) ? "checked" : ""} ${fin ? "disabled" : ""} aria-label="${esc(personName(pe))} auswählen"></td><td><b>${esc(personName(pe))}</b></td><td>${esc(pe.pnr || "–")}</td><td>${pe.nta ? pe.nta + " Min." : "–"}</td>
      <td>${artBadge(e?.status === "abgelehnt" ? 0 : e?.art)}</td><td>${e?.school ? `${esc(orgShort(e.school))}${byId("orgs", e.school)?.bezirk !== kammer?.bezirk ? ` <span class="xs muted">anderer Bezirk</span>` : ""}` : e ? `<span class="muted">${esc(orgShort(p.org))}</span>` : "–"}</td><td>${extStatusBadge(e)}</td>
      <td class="small">${x && r ? `${esc(r.name)}${isKammerOrg(r.org) ? "" : ` (${esc(orgShort(r.org))})`} · ${statusChip(x.status)}` : e && (extAccepted(e) || e.status === "kammer") ? `<span class="muted">noch keiner Raumaufsicht zugeordnet</span>` : "–"}</td>
      <td class="nowrap">${fin ? `<span class="xs muted" title="Prüfung für diesen Prüfling abgeschlossen">${icon("lock")} abgeschlossen</span>` : `<button class="btn xs" data-xone="${pe.id}">${icon("pencil")} ${e ? "Ändern" : "Zuordnen"}</button>`}${e?.hist?.length ? `<button class="iconbtn" data-xhist="${pe.id}" title="Verlauf" aria-label="Verlauf ${esc(personName(pe))}">${icon("history")}</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
  : `<div class="empty">${icon("users")}<h3>Noch keine externen Prüflinge in dieser Prüfung</h3><p>Fügen Sie Prüflinge Ihrer Kammer hinzu und ordnen Sie sie anschließend zu.</p></div>`}`;
}
export function bindZuordnung(el, c) {
  el.querySelectorAll("[data-xsel]").forEach((b) => (b.onchange = () => { b.checked ? UI.sel.add(b.dataset.xsel) : UI.sel.delete(b.dataset.xsel); redraw(); }));
  const all = el.querySelector("[data-xall]"); if (all) all.onchange = () => { el.querySelectorAll("[data-xsel]:not([disabled])").forEach((b) => (all.checked ? UI.sel.add(b.dataset.xsel) : UI.sel.delete(b.dataset.xsel))); redraw(); };
  el.querySelectorAll("[data-xone]").forEach((b) => (b.onclick = () => assignDialog(c, [b.dataset.xone])));
  const ab = el.querySelector("[data-xassign]"); if (ab) ab.onclick = () => assignDialog(c, [...UI.sel]);
  el.querySelectorAll("[data-xhist]").forEach((b) => (b.onclick = () => { const e = extOf(c, b.dataset.xhist); modal({ title: `Verlauf: ${esc(personName(byId("persons", b.dataset.xhist)))}`, size: "narrow", body: `<ul class="small">${(e?.hist || []).slice().reverse().map((h) => `<li><b>${esc(fmtDateTime(parseDate(h.at)))}</b> · ${esc(h.by)}<br>${esc(h.text)}</li>`).join("")}</ul>` }); }));
}
async function assignDialog(c, pids) {
  const p = me(); const kammer = byId("orgs", p.org);
  if (!pids.length) return;
  const e0 = pids.length === 1 ? extOf(c, pids[0]) : null;
  const v0 = { art: e0 && e0.status !== "abgelehnt" ? +e0.art : 2, school: e0?.status === "abgelehnt" ? "" : e0?.school || "", all: UI.allSchools || (!!e0?.school && e0.status !== "abgelehnt" && byId("orgs", e0.school)?.bezirk !== kammer?.bezirk) };
  const res = await modal({ title: pids.length === 1 ? `Zuordnen: ${esc(personName(byId("persons", pids[0])))}` : `${pids.length} Prüflinge zuordnen`, size: "wide",
    body: `<div data-ad></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("send")} Zuordnung speichern</button>`,
    onMount(m, close) {
      const draw = () => {
        const sch = schoolsOf(c, kammer, v0.all);
        const prev = pids.map((id) => extOf(c, id)).filter(Boolean);
        m.querySelector("[data-ad]").innerHTML = `<fieldset class="field" style="border:0;padding:0"><legend class="lbl">Art der Prüfung</legend>${[1, 2, 3, 4].map((a) => `<label class="checkbox" style="display:flex;margin:6px 0"><input type="radio" name="xart" value="${a}" ${v0.art === a ? "checked" : ""}> <span><b>Art ${a}:</b> ${esc(ART[a].label)} <span class="xs muted">– ${esc(ART[a].text)}</span></span></label>`).join("")}</fieldset>
          ${atSchool({ art: v0.art }) ? `<div class="field"><label class="lbl" for="xsch">Schule</label><select id="xsch" class="select" data-xs><option value="">Schule auswählen</option>${sch.map((o) => `<option value="${o.id}" ${o.id === v0.school ? "selected" : ""}>${esc(o.name)} (${esc(o.short)})${o.bezirk !== kammer?.bezirk ? " – anderer Kammerbezirk" : ""}</option>`).join("")}</select>
            <label class="checkbox small mt-s"><input type="checkbox" data-xallsch ${v0.all ? "checked" : ""}> auch Schulen anderer Kammerbezirke anzeigen (nur Schulen, die das IBBW der Prüfung hinzugefügt hat)</label></div>
            <div class="notice info small">${icon("info")}<span>Die Schule erhält eine Benachrichtigung und sieht bis zur Annahme nur Anzahl, Art und Nachteilsausgleich. Name, Vorname und Prüflingsnummer sieht sie erst nach der Annahme.</span></div>`
          : `<div class="notice info small">${icon("info")}<span>${v0.art === 4 ? "Die Kammer führt durch. Die Korrektur weisen Sie unter „Korrektoren“ Lehrkräften aus dem Korrektorenpool zu; sie sehen nur die Prüflingsnummer." : "Die Kammer führt durch und korrigiert selbst. Raumaufsicht und Korrektur vergeben Sie innerhalb Ihrer Kammer."}</span></div>`}
          ${prev.some((e) => e.school && (e.status === "angenommen" || e.status === "vorgeschlagen")) ? `<p class="xs muted">Bei einem Wechsel der Schule wird die bisherige Schule benachrichtigt; noch nicht begonnene Teilnahmen werden dort aus der Raumaufsicht entfernt. Die neue Schule muss erneut annehmen.</p>` : ""}`;
        m.querySelectorAll("[name=xart]").forEach((r) => (r.onchange = () => { v0.art = +r.value; draw(); }));
        const s = m.querySelector("[data-xs]"); if (s) s.onchange = () => (v0.school = s.value);
        const a = m.querySelector("[data-xallsch]"); if (a) a.onchange = () => { v0.all = a.checked; UI.allSchools = a.checked; draw(); };
      };
      draw();
      m.querySelector("[data-ok]").onclick = () => { if (atSchool({ art: v0.art }) && !v0.school) return toast("Bitte eine Schule auswählen", "", "error"); close({ art: v0.art, school: atSchool({ art: v0.art }) ? v0.school : "" }); };
    } });
  if (!res) return;
  await setExt(c, pids, res.art, res.school);
  UI.sel.clear();
}
// Zuordnung speichern: Status, Verlauf, Benachrichtigungen, Entfernen aus der Raumaufsicht der bisherigen Schule
export async function setExt(c, pids, art, school) {
  const p = me(); const by = personName(p); const ext = { ...(c.ext || {}) };
  const toSchool = new Map(); const fromSchool = new Map(); let changed = 0;
  for (const pid of pids) {
    if (finishedFor(c, pid)) continue;
    const prev = ext[pid] || null; const pe = byId("persons", pid);
    const sameSchool = prev && prev.school === school && prev.status !== "abgelehnt";
    let status = atSchool({ art }) ? (sameSchool && prev.status === "angenommen" ? "angenommen" : "vorgeschlagen") : "kammer";
    if (prev && +prev.art === art && sameSchool) continue;
    const text = atSchool({ art }) ? (sameSchool ? `Art geändert: Art ${art} (${ART[art].short})` : `Art ${art} · ${orgShort(school)} vorgeschlagen`) : `Art ${art} · ${ART[art].label}`;
    ext[pid] = { art, school, status, at: nowIso(), by, hist: [...(prev?.hist || []), { at: nowIso(), by, text }] };
    changed++;
    // bisherige Schule: Zuordnung zurückziehen, nicht begonnene Teilnahme aus der Raumaufsicht entfernen
    if (prev?.school && prev.school !== school && prev.status !== "abgelehnt") {
      fromSchool.set(prev.school, [...(fromSchool.get(prev.school) || []), pe]);
      const x = partOf(c, pid); const r = roomOf(x);
      if (x && r && r.org === prev.school && !isActive(x.status) && !isFinished(x.status)) { await upd("participants", x.id, { room: "", seat: "", present: false, status: "nicht_eingeloggt" }); log(r.id, x, "Externe/r Prüfling durch die Kammer umgemeldet", "aus der Raumaufsicht entfernt", "aktion", by); }
    }
    // Kammer → Schule (oder Art 1/4): Teilnahme in einer Kammer-Raumaufsicht lösen, wenn jetzt an einer Schule
    if (atSchool({ art })) { const x = partOf(c, pid); const r = roomOf(x); if (x && r && isKammerOrg(r.org) && !isActive(x.status) && !isFinished(x.status)) await upd("participants", x.id, { room: "", seat: "", present: false, status: "nicht_eingeloggt" }); }
    if (atSchool({ art }) && (!sameSchool || status === "vorgeschlagen")) toSchool.set(school, [...(toSchool.get(school) || []), { pe, art, kind: sameSchool ? "art" : "vorschlag" }]);
    else if (atSchool({ art }) && sameSchool) toSchool.set(school, [...(toSchool.get(school) || []), { pe, art, kind: "art" }]);
  }
  if (!changed) { toast("Keine Änderung", "Die Zuordnung ist unverändert bzw. die Prüfung ist für die Auswahl bereits abgeschlossen.", "info"); return; }
  await upd("courses", c.id, { ext });
  const kname = orgName(p.org);
  for (const [org, l] of toSchool) {
    const neu = l.filter((x) => x.kind === "vorschlag"); const art = l.filter((x) => x.kind === "art");
    if (neu.length) await notify(org, "schuladmin", c, neu.length === 1 ? "Externer Prüfling zur Annahme" : `${neu.length} externe Prüflinge zur Annahme`, `${kname}: ${neu.length} externe(r) Prüfling(e) (${[...new Set(neu.map((x) => "Art " + x.art))].join(", ")}) für „${c.title}“ vorgeschlagen`, `#/app/kurs/${c.id}/extern`, "vorschlag");
    if (art.length) await notify(org, "schuladmin", c, "Art der Prüfung geändert", `${kname}: ${art.map((x) => `${personName(x.pe)} jetzt Art ${x.art} (${ART[x.art].short})`).join(" · ")}`, `#/app/kurs/${c.id}/extern`, "art");
  }
  for (const [org, l] of fromSchool) await notify(org, "schuladmin", c, "Zuordnung durch die Kammer zurückgezogen", `${kname}: ${l.length} externe(r) Prüfling(e) für „${c.title}“ an anderer Stelle eingeplant`, `#/app/kurs/${c.id}/extern`, "rueckzug");
  toast("Zuordnung gespeichert", `${changed} Prüfling(e) · ${atSchool({ art }) ? `${orgShort(school)} benachrichtigt` : ART[art].label}`);
}

// ---------- Prüfung (Kammer): Stand der Durchführung der eigenen Prüflinge ----------
export function tabDurchfuehrung(c, p) {
  const list = kammerPupils(c, p.org).map((pe) => ({ pe, e: extOf(c, pe.id), x: partOf(c, pe.id) })).filter((o) => o.e && o.e.status !== "abgelehnt");
  const protOf = (o) => { const r = roomOf(o.x); if (!r) return null; if (!isKammerOrg(r.org) && !r.prot_released) return false; return D.protocol.filter((q) => q.room === r.id && (q.username === o.pe.username || q.participant === `${o.pe.lastname}, ${o.pe.firstname}`)).sort((a, b) => String(a.ts).localeCompare(String(b.ts))); };
  return `<div class="notice info small mb">${icon("shield-check")}<span>Sie sehen ausschließlich die Angaben Ihrer eigenen externen Prüflinge – nicht die übrigen Teilnehmenden oder Aufsichtspersonen eines Raums. Protokolleinträge einer Schule sind sichtbar, sobald die Schule das Prüfungsprotokoll freigegeben hat.</span></div>
  ${list.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Prüfling</th><th>Art</th><th>Ort</th><th>Raumaufsicht</th><th>Termin</th><th>Status</th><th>Zeitgutschrift</th><th>Protokoll</th></tr></thead><tbody>
  ${list.map((o) => { const r = roomOf(o.x); const pr = protOf(o);
    return `<tr><td><b>${esc(personName(o.pe))}</b><div class="xs muted">${esc(o.pe.pnr)}</div></td><td>${artBadge(o.e.art)}</td><td>${o.e.school ? esc(orgName(o.e.school)) : esc(orgName(p.org))}${atSchool(o.e) && !extAccepted(o.e) ? `<div class="xs muted">${esc(EXT_STATUS[o.e.status]?.[0] || "")}</div>` : ""}</td>
      <td>${r ? (isKammerOrg(r.org) ? `<a href="#/app/raum/${r.id}/meinraum">${esc(r.name)}</a>` : esc(r.name)) : `<span class="muted">noch nicht zugeordnet</span>`}</td><td class="small">${r ? fmtDateTime(parseDate(r.planned_start)) : "–"}</td><td>${o.x && r ? statusChip(o.x.status) : "–"}</td>
      <td class="small">${o.x ? [o.x.nta ? `NTA ${o.x.nta} Min.` : "", o.x.extra_time ? `Zusatzzeit ${o.x.extra_time} Min.` : ""].filter(Boolean).join(" · ") || "–" : "–"}</td>
      <td class="small">${pr === null ? "–" : pr === false ? `<span class="badge gray">${icon("lock")} noch nicht freigegeben</span>` : pr.length ? `<button class="btn xs" data-xprot="${o.pe.id}">${icon("file-text")} ${pr.length} Einträge</button>` : `<span class="muted">keine Einträge</span>`}</td></tr>`; }).join("")}</tbody></table></div>`
  : `<div class="empty">${icon("users")}<h3>Noch keine Zuordnungen</h3></div>`}`;
}
export function bindDurchfuehrung(el, c) {
  el.querySelectorAll("[data-xprot]").forEach((b) => (b.onclick = () => {
    const pe = byId("persons", b.dataset.xprot); const x = partOf(c, pe.id); const r = roomOf(x);
    const l = D.protocol.filter((q) => q.room === r.id && (q.username === pe.username || q.participant === `${pe.lastname}, ${pe.firstname}`)).sort((a, z) => String(a.ts).localeCompare(String(z.ts)));
    modal({ title: `Protokoll: ${esc(personName(pe))}`, size: "wide", body: `<p class="small muted">${esc(r.name)}${isKammerOrg(r.org) ? "" : ` · ${esc(orgName(r.org))} · freigegeben ${r.prot_released_at ? fmtDateTime(parseDate(r.prot_released_at)) : ""}`} – nur Einträge zu diesem Prüfling</p><div class="tablewrap"><table class="tbl compact"><thead><tr><th>Zeit</th><th>Aktion</th><th>Kommentar</th></tr></thead><tbody>${l.map((q) => `<tr><td class="nowrap">${fmtDateTime(parseDate(q.ts))}</td><td>${esc(q.action)}</td><td class="small">${esc(q.comment || "")}</td></tr>`).join("")}</tbody></table></div>` });
  }));
}

// ---------- Prüfung (Schule): externe Prüflinge annehmen ----------
export function tabSchoolExt(c, p) {
  const all = extForSchool(c, p.org);
  const open = all.filter((x) => x.e.status === "vorgeschlagen"); const acc = all.filter((x) => x.e.status === "angenommen"); const rej = all.filter((x) => x.e.status === "abgelehnt");
  const byK = new Map(); open.forEach((x) => byK.set(x.pe.org, [...(byK.get(x.pe.org) || []), x]));
  const L = isLeitung(p);
  return `${L ? "" : `<div class="notice warn small mb">${icon("lock")}<span>Über die Annahme externer Prüflinge entscheidet die <b>Prüfungsleitung</b> Ihrer Schule. Sie sehen den Stand und die angenommenen Prüflinge für die Organisation.</span></div>`}<div class="notice info small mb">${icon("info")}<span>Kammern können ihre externen Prüfungsteilnehmenden zur Durchführung (und ggf. Korrektur) an Ihre Schule schicken. Die Absprache erfolgt vorab außerhalb der Plattform; jeder Vorschlag wird erst mit Ihrer <b>Annahme</b> wirksam. Vor der Annahme sehen Sie nur Anzahl, Art und Nachteilsausgleich. Angenommene Prüflinge stehen ausschließlich für diese Prüfung zur Verfügung; Zuordnungen ändert nur die Kammer.</span></div>
  <section class="card pad"><h3>${icon("user-round-plus")} Zur Annahme (${open.length})</h3>
    ${open.length ? [...byK].map(([k, l]) => `<div class="kgroup mt-s"><div class="row between wrap"><b>${esc(orgName(k))}</b>${L ? `<div class="row" style="gap:6px"><button class="btn sm" data-xrej="${l.map((x) => x.pid).join(",")}">${icon("x")} Alle ablehnen</button><button class="btn primary sm" data-xacc="${l.map((x) => x.pid).join(",")}">${icon("check")} Alle ${l.length} annehmen</button></div>` : `<span class="badge yellowb">Annahme durch die Prüfungsleitung offen</span>`}</div>
      <div class="tablewrap mt-s"><table class="tbl compact"><thead><tr><th>#</th><th>Art</th><th>Nachteilsausgleich</th><th>vorgeschlagen</th><th></th></tr></thead><tbody>${l.map((x, i) => `<tr><td>Externer Prüfling ${i + 1}</td><td>${artBadge(x.e.art)}</td><td>${x.pe.nta ? x.pe.nta + " Minuten" : "keiner"}</td><td class="small">${fmtDateTime(parseDate(x.e.at))}</td>
        <td class="nowrap">${L ? `<button class="btn xs" data-xrej="${x.pid}">${icon("x")} Ablehnen</button><button class="btn primary xs" data-xacc="${x.pid}">${icon("check")} Annehmen</button>` : ""}</td></tr>`).join("")}</tbody></table></div></div>`).join("") : `<p class="small muted">Keine offenen Vorschläge.</p>`}</section>
  <section class="card pad mt"><div class="row between wrap"><h3>${icon("graduation-cap")} Angenommene externe Prüflinge (${acc.length})</h3>${acc.length ? `<a class="btn sm" href="#/app/kurs/${c.id}/raumaufsichten">${icon("arrow-right")} Raumaufsichten</a>` : ""}</div>
    ${acc.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Vorname</th><th>Prüflingsnummer</th><th>Nachteilsausgleich</th><th>Kammer</th><th>Art</th><th>Raumaufsicht</th></tr></thead><tbody>${acc.map((x) => { const pt = partOf(c, x.pid); const r = roomOf(pt);
      return `<tr><td><b>${esc(x.pe.lastname)}</b></td><td>${esc(x.pe.firstname)}</td><td>${esc(x.pe.pnr)}</td><td>${x.pe.nta ? x.pe.nta + " Min." : "–"} <span class="xs muted" title="gepflegt von der Kammer">${icon("lock")}</span></td><td>${esc(orgShort(x.pe.org))}</td><td>${artBadge(x.e.art)}</td><td class="small">${r && r.org === p.org ? `<a href="#/app/raum/${r.id}/teilnehmende">${esc(r.name)}</a> · ${statusChip(pt.status)}` : `<span class="muted">noch keiner Raumaufsicht zugeordnet</span>`}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="xs muted mt-s">Art 2: Sie führen durch und korrigieren (Korrektorenzuweisung im Reiter „Korrektoren“). Art 3: Sie führen nur durch – nach dem Beenden geht die Prüfung an die Kammer; geben Sie dazu das Prüfungsprotokoll frei. Die Prüfungseinsicht der externen Prüflinge findet immer bei der Kammer statt.</p>` : `<p class="small muted">Noch keine externen Prüflinge angenommen.</p>`}</section>
  ${rej.length ? `<p class="small muted mt">${rej.length} Vorschlag/Vorschläge abgelehnt.</p>` : ""}`;
}
export function bindSchoolExt(el, c) {
  el.querySelectorAll("[data-xacc]").forEach((b) => (b.onclick = () => decide(c, b.dataset.xacc.split(","), true)));
  el.querySelectorAll("[data-xrej]").forEach((b) => (b.onclick = () => decide(c, b.dataset.xrej.split(","), false)));
}
export async function decide(c, pids, ok) {
  const p = me(); let reason = "";
  if (!isLeitung(p)) { toast("Nur durch die Prüfungsleitung", "Über die Annahme externer Prüflinge entscheidet die Prüfungsleitung.", "error"); return; }
  if (!ok) {
    const v = await modal({ title: pids.length === 1 ? "Vorschlag ablehnen" : `${pids.length} Vorschläge ablehnen`, size: "narrow", body: `<p class="small">Die Kammer wird benachrichtigt und ordnet den Prüfling anderweitig zu.</p><div class="field"><label class="lbl" for="xr">Begründung (optional)</label><input id="xr" class="input" data-r placeholder="z. B. keine freien Plätze"></div>`,
      footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Ablehnen</button>`, onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => close(m.querySelector("[data-r]").value.trim() || "-")) });
    if (!v) return; reason = v === "-" ? "" : v;
  }
  const ext = { ...(c.ext || {}) }; const by = personName(p); const perK = new Map();
  for (const pid of pids) {
    const e = ext[pid]; if (!e || e.school !== p.org || e.status !== "vorgeschlagen") continue;
    ext[pid] = { ...e, status: ok ? "angenommen" : "abgelehnt", at: nowIso(), by, hist: [...(e.hist || []), { at: nowIso(), by, text: `von ${orgShort(p.org)} ${ok ? "angenommen" : "abgelehnt"}${reason ? " – " + reason : ""}` }] };
    const pe = byId("persons", pid); perK.set(pe.org, [...(perK.get(pe.org) || []), pe]);
  }
  await upd("courses", c.id, { ext });
  for (const [k, l] of perK) await notify(k, "kammeradmin", c, ok ? `Zuordnung angenommen (${orgShort(p.org)})` : `Zuordnung abgelehnt (${orgShort(p.org)})`, `${orgName(p.org)}: ${l.map((pe) => `${personName(pe)} (${pe.pnr})`).join(", ")}${reason ? " – " + reason : ""}`, `#/app/kurs/${c.id}/zuordnung`, ok ? "annahme" : "ablehnung");
  const n = [...perK.values()].flat().length;
  toast(ok ? "Angenommen" : "Abgelehnt", `${n} externe(r) Prüfling(e) – die Kammer wurde benachrichtigt.`);
}
export const openProposals = (c, p = me()) => extForSchool(c, p?.org).filter((x) => x.e.status === "vorgeschlagen").length;

// ---------- Protokollfreigabe (Schule → Kammer) ----------
export async function releaseProtocol(room) {
  const ext = D.participants.filter((x) => x.room === room.id).map((x) => byId("persons", x.person)).filter(isExtern);
  if (!(await confirmBox("Prüfungsprotokoll freigeben", `<p>Das Prüfungsprotokoll dieser Raumaufsicht wird freigegeben.${ext.length ? ` Die zuständigen Kammern sehen danach die Einträge <b>ihrer</b> externen Prüflinge (${ext.length}).` : ""}</p>`, "Freigeben"))) return;
  await upd("rooms", room.id, { prot_released: true, prot_released_at: new Date().toISOString().replace("T", " ") });
  log(room.id, null, "Prüfungsprotokoll freigegeben", "", "aktion", personName(me()));
  const c = byId("courses", room.course);
  for (const k of [...new Set(ext.map((pe) => pe.org))]) await notify(k, "kammeradmin", c, `Protokoll freigegeben (${orgShort(room.org)})`, `${orgName(room.org)} hat das Prüfungsprotokoll „${room.name}“ freigegeben (${ext.filter((pe) => pe.org === k).length} externe Prüflinge). Die nachgelagerten Schritte liegen bei Ihnen.`, `#/app/kurs/${c.id}/durchfuehrung`, "protokoll");
  toast("Protokoll freigegeben", ext.length ? "Die Kammer wurde benachrichtigt." : "");
}

// ---------- Rollen der Organisation: Prüfungsleitung bestimmt die Prüfungsorganisation ----------
const KIND_LABEL = { schuladmin: "Prüfungsleitung", kammeradmin: "Prüfungsleitung", lehrkraft: "Lehrkraft", verwaltung: "Verwaltung", kammer: "Kammer" };
export function rolesView() {
  return {
    shell: "staff", rail: "rollen", title: "Rollen der Organisation",
    render() {
      const p = me();
      if (!isLeitung(p)) return `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Die Prüfungsorganisation bestimmt die Prüfungsleitung.</p></div>`;
      const org = p.org; const k = isKammerOrg(org);
      const leads = D.persons.filter((x) => isLeitung(x) && x.org === org);
      const list = (setting("orgrole:" + org, []) || []).map((r) => ({ ...r, pe: byId("persons", r.person) })).filter((r) => r.pe);
      const exams = D.courses.filter((c) => c.kind === "pruefung" && (c.orgs || []).includes(org));
      return `<div class="pagehead"><div><h1>Rollen ${k ? "der Kammer" : "der Schule"}</h1><div class="sub">${esc(orgName(org))} · Prüfungsleitung ${esc(personName(p))}</div></div><button class="btn primary" data-orgadd>${icon("user-round-plus")} Prüfungsorganisation bestimmen</button></div>
      <div class="notice info small mb">${icon("info")}<span><b>Prüfungsleitung</b> (von der Koordinierungsstelle hinzugefügt): Annahme externer Prüflinge, Begutachtung vor Prüfungsstart, Drittkorrektur, Protokollfreigabe, Ergebnisse mit Noten. <b>Prüfungsorganisation</b> (von der Leitung bestimmt): ${k ? "externe Prüflinge und deren Zuordnung, Rollen in der Kammer, Räume, Raumaufsichten, Korrektoren" : "Teilnehmende, Räume, Raumaufsichten, Korrektoren"} – ohne Einsicht in Noten. Beide Rollen sind kombinierbar; die Organisation gilt für alle Prüfungen der Organisation oder nur für ausgewählte.</span></div>
      <section class="card pad"><h3>${icon("building-2")} Prüfungsleitung</h3><div class="row wrap" style="gap:6px">${leads.map((x) => `<span class="badge gray">${icon("user")} ${esc(personName(x))}${list.some((r) => r.person === x.id) ? " · auch Organisation" : ""}</span>`).join("")}</div></section>
      <section class="card pad mt"><h3>${icon("clipboard-list")} Prüfungsorganisation (${list.length})</h3>
        ${list.length ? `<div class="tablewrap"><table class="tbl compact"><thead><tr><th>Name</th><th>Funktion</th><th>Umfang</th><th></th></tr></thead><tbody>${list.map((r) => `<tr><td><b>${esc(personName(r.pe))}</b></td><td>${esc(KIND_LABEL[r.pe.kind] || r.pe.kind)}</td><td class="small">${(r.courses || []).length ? r.courses.map((id) => esc(byId("courses", id)?.title || "–")).join("<br>") : "alle Prüfungen"}</td>
          <td class="nowrap"><button class="iconbtn" data-orgedit="${r.person}" title="Bearbeiten" aria-label="Bearbeiten">${icon("pencil")}</button><button class="iconbtn" data-orgdel="${r.person}" title="Entfernen" aria-label="Entfernen">${icon("trash-2")}</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="small muted">Noch niemand bestimmt.</p>`}
        <p class="xs muted mt-s">${exams.length} Prüfung(en) Ihrer Organisation.</p></section>`;
    },
    mount(el) {
      const b = el.querySelector("[data-orgadd]"); if (b) b.onclick = () => orgDialog();
      el.querySelectorAll("[data-orgedit]").forEach((x) => (x.onclick = () => orgDialog(x.dataset.orgedit)));
      el.querySelectorAll("[data-orgdel]").forEach((x) => (x.onclick = async () => { const p = me(); const pe = byId("persons", x.dataset.orgdel); if (!(await confirmBox("Prüfungsorganisation entfernen", `<p>${esc(personName(pe))} verliert die Rolle Prüfungsorganisation.</p>`, "Entfernen"))) return; await saveRoles(p.org, (setting("orgrole:" + p.org, []) || []).filter((r) => r.person !== pe.id)); toast("Rolle entfernt", personName(pe)); }));
    },
  };
}
async function saveRoles(org, list) {
  const rec = D.settings.find((s) => s.key === "orgrole:" + org);
  return rec ? upd("settings", rec.id, { value: list }) : create("settings", { key: "orgrole:" + org, value: list });
}
async function orgDialog(pid = "") {
  const p = me(); const org = p.org; const k = isKammerOrg(org);
  const list = setting("orgrole:" + org, []) || []; const ex = list.find((r) => r.person === pid);
  const kinds = k ? ["kammer", "kammeradmin"] : ["lehrkraft", "verwaltung", "schuladmin"];
  const cand = D.persons.filter((x) => x.org === org && kinds.includes(x.kind) && (x.id === pid || !list.some((r) => r.person === x.id))).sort((a, b) => a.lastname.localeCompare(b.lastname));
  const exams = D.courses.filter((c) => c.kind === "pruefung" && (c.orgs || []).includes(org));
  const v = await modal({ title: ex ? "Prüfungsorganisation bearbeiten" : "Prüfungsorganisation bestimmen", size: "wide",
    body: `<div class="field"><label class="lbl" for="orp">Person ${k ? "der Kammer" : "der Schule"}</label><select id="orp" class="select" data-op ${ex ? "disabled" : ""}>${cand.map((x) => `<option value="${x.id}" ${x.id === pid ? "selected" : ""}>${esc(personName(x))} · ${esc(KIND_LABEL[x.kind] || x.kind)}</option>`).join("")}</select></div>
      <fieldset class="field" style="border:0;padding:0"><legend class="lbl">Umfang</legend><label class="checkbox" style="display:flex;margin:6px 0"><input type="radio" name="osc" value="all" ${!(ex?.courses || []).length ? "checked" : ""}> alle Prüfungen der Organisation</label><label class="checkbox" style="display:flex;margin:6px 0"><input type="radio" name="osc" value="some" ${(ex?.courses || []).length ? "checked" : ""}> nur ausgewählte Prüfungen</label></fieldset>
      <div data-oex>${exams.map((c) => `<label class="checkbox" style="display:flex;margin:4px 0 4px 24px"><input type="checkbox" data-oc="${c.id}" ${(ex?.courses || []).includes(c.id) ? "checked" : ""}> ${esc(c.title)}</label>`).join("")}</div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount(m, close) {
      const sync = () => (m.querySelector("[data-oex]").style.opacity = m.querySelector("[name=osc]:checked").value === "some" ? "1" : ".4");
      m.querySelectorAll("[name=osc]").forEach((r) => (r.onchange = sync)); sync();
      m.querySelector("[data-ok]").onclick = () => { const person = m.querySelector("[data-op]").value; const some = m.querySelector("[name=osc]:checked").value === "some"; const courses = some ? [...m.querySelectorAll("[data-oc]:checked")].map((x) => x.dataset.oc) : []; if (!person) return toast("Bitte eine Person wählen", "", "error"); if (some && !courses.length) return toast("Bitte mindestens eine Prüfung wählen", "", "error"); close({ person, courses }); };
    } });
  if (!v) return;
  await saveRoles(org, [...list.filter((r) => r.person !== v.person), { person: v.person, courses: v.courses, by: personName(p), at: nowIso() }]);
  toast("Prüfungsorganisation gespeichert", `${personName(byId("persons", v.person))} · ${v.courses.length ? v.courses.length + " Prüfung(en)" : "alle Prüfungen"}`);
}

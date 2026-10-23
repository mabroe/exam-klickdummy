// Stammdaten der Koordinierungsstelle: Ausbildungsberufe mit Berufsnummer und Prüfungstiteln, Fachbereiche, Schulen und ihre
// Ausbildungsberufe, Unternehmenspools je Fachbereich, Korrekturzeichensätze (verbindlich für Erstellung, Prüfung und Unterricht)
import { D, upd, create, byId, setSetting } from "../data.js?v=9.3";
import { icon, esc, toast, modal, confirmBox } from "../ui.js?v=9.3";
import { redraw } from "../app.js?v=9.3";
import { me, personName, orgsLabel } from "../access.js?v=9.3";
import { berufe, fachbereiche, fbName, berufById, pools, savePool, poolForm, readPoolForm, signsets, saveSignsets, inkSupported, INK_CHARS } from "../masterdata.js?v=9.3";

const TABS = [["berufe", "Ausbildungsberufe"], ["schulen", "Schulen"], ["kommissionen", "Kommissionen"], ["pools", "Unternehmenspools"], ["zeichen", "Korrekturzeichensätze"], ["fachbereiche", "Fachbereiche"]];
const UI = { q: "", sq: "", set: "", fb: "" };
const rid = () => Math.random().toString(36).slice(2, 10);

export function view(tab = "berufe") {
  if (!TABS.some(([k]) => k === tab)) tab = "berufe";
  return {
    shell: "staff", rail: "stammdaten", title: "Stammdaten",
    render() {
      if (me()?.kind !== "koordination") return `<div class="empty">${icon("lock")}<h2>Kein Zugriff</h2><p>Die Stammdaten pflegt die Koordinierungsstelle.</p></div>`;
      return `<div class="pagehead"><div><h1>Stammdaten</h1><div class="sub">${esc(personName(me()))} · Koordinierungsstelle</div></div></div>
        <nav class="tabs">${TABS.map(([k, l]) => `<a href="#/app/stammdaten/${k}" class="${k === tab ? "active" : ""}">${l}</a>`).join("")}</nav>
        ${{ berufe: tabBerufe, schulen: tabSchulen, kommissionen: tabKom, pools: tabPools, zeichen: tabZeichen, fachbereiche: tabFb }[tab]()}`;
    },
    mount(el) { bind(el, tab); },
  };
}

// ---------- Ausbildungsberufe ----------
function tabBerufe() {
  const q = UI.q.toLowerCase(); const list = [...berufe()].sort((a, b) => a.nr.localeCompare(b.nr)).filter((b) => !q || (b.nr + " " + b.name).toLowerCase().includes(q));
  return `<div class="row between wrap mb"><p class="small" style="margin:0">Für jeden Ausbildungsberuf sind Berufsnummer, Fachbereich und die Titel der möglichen Prüfungen hinterlegt. Beim Anlegen einer Prüfung werden Beruf (nach Name oder Nummer), Prüfungstitel und Prüfungsjahr daraus ausgewählt.</p>
    <div class="row wrap" style="gap:8px"><div class="search" style="width:260px"><input class="input" data-q value="${esc(UI.q)}" placeholder="Beruf oder Berufsnummer" aria-label="Ausbildungsberuf suchen">${icon("search")}</div><button class="btn primary sm" data-beruf="">${icon("plus")} Ausbildungsberuf</button></div></div>
  <div class="tablewrap"><table class="tbl"><thead><tr><th>Berufsnummer</th><th>Ausbildungsberuf</th><th>Fachbereich</th><th>Prüfungstitel</th><th class="num">Schulen</th><th></th></tr></thead><tbody>
    ${list.map((b) => `<tr><td><b>${esc(b.nr)}</b></td><td>${esc(b.name)}</td><td class="small">${esc(fbName(b.fb))}</td><td class="small">${(b.titel || []).map((t) => esc(t)).join("<br>")}</td><td class="num">${D.orgs.filter((o) => (o.berufe || []).includes(b.id)).length}</td><td><button class="iconbtn" data-beruf="${b.id}" aria-label="${esc(b.name)} bearbeiten">${icon("pencil")}</button></td></tr>`).join("") || `<tr><td colspan="6"><div class="empty small">Kein Ausbildungsberuf gefunden.</div></td></tr>`}</tbody></table></div>
  <p class="xs muted mt-s">Die Berufsnummern im Klickdummy sind Demowerte.</p>`;
}
async function editBeruf(id) {
  const b = berufById(id) || { id: "", nr: "", name: "", fb: fachbereiche()[0]?.id, titel: [] };
  const v = await modal({ title: id ? "Ausbildungsberuf bearbeiten" : "Ausbildungsberuf anlegen", size: "wide",
    body: `<div class="grid2"><div class="field"><label class="lbl" for="bf-nr">Berufsnummer *</label><input id="bf-nr" class="input" data-f="nr" value="${esc(b.nr)}"></div><div class="field"><label class="lbl" for="bf-fb">Fachbereich</label><select id="bf-fb" class="select" data-f="fb">${fachbereiche().map((f) => `<option value="${f.id}" ${f.id === b.fb ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div></div>
      <div class="field"><label class="lbl" for="bf-n">Ausbildungsberuf *</label><input id="bf-n" class="input" data-f="name" value="${esc(b.name)}"></div>
      <div class="field"><label class="lbl" for="bf-t">Prüfungstitel (einer je Zeile)</label><textarea id="bf-t" class="input" rows="6" data-f="titel">${esc((b.titel || []).join("\n"))}</textarea></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = {}; m.querySelectorAll("[data-f]").forEach((f) => (o[f.dataset.f] = f.value.trim())); if (!o.nr || !o.name) return toast("Berufsnummer und Bezeichnung angeben", "", "error"); if (berufe().some((x) => x.nr === o.nr && x.id !== b.id)) return toast("Berufsnummer bereits vergeben", o.nr, "error"); close(o); }) });
  if (!v) return;
  const nb = { ...b, ...v, id: b.id || rid(), titel: v.titel.split("\n").map((s) => s.trim()).filter(Boolean) };
  await setSetting("berufe", [...berufe().filter((x) => x.id !== nb.id), nb]);
  toast("Ausbildungsberuf gespeichert", `${nb.nr} ${nb.name}`);
}

// ---------- Schulen und ihre Ausbildungsberufe ----------
function tabSchulen() {
  const q = UI.sq.toLowerCase(); const bs = [...berufe()].sort((a, b) => a.nr.localeCompare(b.nr));
  const list = [...D.orgs].sort((a, b) => a.name.localeCompare(b.name)).filter((o) => !q || (o.name + " " + o.short + " " + o.city).toLowerCase().includes(q));
  return `<div class="row between wrap mb"><p class="small" style="margin:0">Hinterlegt, welche Schule welche Ausbildungsberufe unterrichtet. Bei der Zuordnung der Organisationen einer Prüfung werden standardmäßig nur Schulen mit dem Ausbildungsberuf der Prüfung angezeigt.</p>
    <div class="search" style="width:280px"><input class="input" data-sq value="${esc(UI.sq)}" placeholder="Schule, Kürzel oder Ort" aria-label="Schule suchen">${icon("search")}</div></div>
  <div class="tablewrap"><table class="tbl compact"><thead><tr><th>Schule</th><th>Ort</th>${bs.map((b) => `<th class="ctr" title="${esc(b.name)}">${esc(b.nr)}</th>`).join("")}</tr></thead><tbody>
    ${list.map((o) => `<tr><td><b>${esc(o.name)}</b> <span class="xs muted">${esc(o.short)}</span></td><td class="small">${esc(o.city || "")}</td>${bs.map((b) => `<td class="ctr"><input type="checkbox" data-ob="${o.id}|${b.id}" ${(o.berufe || []).includes(b.id) ? "checked" : ""} aria-label="${esc(o.short)}: ${esc(b.name)}"></td>`).join("")}</tr>`).join("")}</tbody></table></div>
  <p class="xs muted mt-s">${bs.map((b) => `${esc(b.nr)} = ${esc(b.name)}`).join(" · ")}</p>`;
}

// ---------- Kommissionen (Gruppen der Koordinierungsstelle) ----------
// Änderungen wirken sofort: Kommission und Vorsitz einer Prüfung ergeben sich live aus der zugewiesenen Kommissionsgruppe
function tabKom() {
  const gs = D.groups.filter((g) => g.kind === "kommission").sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="row between wrap mb"><p class="small" style="margin:0">Prüfungskommissionen mit Fachbereich, Mitgliedern und Vorsitz. Änderungen werden <b>sofort</b> in alle Prüfungen übernommen, denen die Kommission zugewiesen ist (Kommission und Kommissionsvorsitz).</p><button class="btn primary sm" data-kom="">${icon("plus")} Kommission</button></div>
  <div class="tablewrap"><table class="tbl"><thead><tr><th>Kommission</th><th>Fachbereich</th><th>Vorsitz</th><th>Mitglieder</th><th class="num">Prüfungen</th><th></th></tr></thead><tbody>
    ${gs.map((g) => `<tr><td><b>${esc(g.name)}</b></td><td class="small">${esc(fbName(g.fachbereich))}</td><td class="small">${esc(personName(byId("persons", g.chair)))}</td><td class="small">${(g.members || []).filter((x) => x !== g.chair).map((x) => esc(personName(byId("persons", x)))).join("<br>")}</td><td class="num">${D.catalog.filter((c) => c.status && c.team?.kommission_group === g.id).length}</td><td><button class="iconbtn" data-kom="${g.id}" aria-label="${esc(g.name)} bearbeiten">${icon("pencil")}</button></td></tr>`).join("") || `<tr><td colspan="6"><div class="empty small">Keine Kommissionen.</div></td></tr>`}</tbody></table></div>`;
}
async function editKom(id) {
  const g = byId("groups", id) || { name: "", fachbereich: fachbereiche()[0]?.id, members: [], chair: "" };
  const cand = D.persons.filter((p) => ["lehrkraft", "fachexperte"].includes(p.kind)).sort((a, b) => a.lastname.localeCompare(b.lastname));
  const v = await modal({ title: id ? "Kommission bearbeiten" : "Kommission anlegen", size: "wide",
    body: `<div class="grid2"><div class="field"><label class="lbl" for="kg-n">Bezeichnung *</label><input id="kg-n" class="input" data-kn value="${esc(g.name)}" placeholder="Prüfungskommission …"></div><div class="field"><label class="lbl" for="kg-f">Fachbereich</label><select id="kg-f" class="select" data-kf>${fachbereiche().map((f) => `<option value="${f.id}" ${f.id === g.fachbereich ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div></div>
      <div class="search mb"><input class="input" data-ks placeholder="Person suchen" aria-label="Person suchen">${icon("search")}</div>
      <div class="tablewrap" style="max-height:340px;overflow:auto"><table class="tbl compact"><thead><tr><th>Mitglied</th><th>Vorsitz</th><th>Name</th><th>Schule</th></tr></thead><tbody>${cand.map((p) => `<tr data-row="${esc((p.lastname + " " + p.firstname).toLowerCase())}"><td><input type="checkbox" data-km="${p.id}" ${(g.members || []).includes(p.id) ? "checked" : ""} aria-label="${esc(personName(p))} Mitglied"></td><td><input type="radio" name="kc" data-kc="${p.id}" ${g.chair === p.id ? "checked" : ""} aria-label="${esc(personName(p))} Vorsitz"></td><td>${esc(personName(p))}</td><td class="xs">${esc(p.org ? orgsLabel(p) : "IBBW")}</td></tr>`).join("")}</tbody></table></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => {
      const s = m.querySelector("[data-ks]"); s.oninput = () => m.querySelectorAll("[data-row]").forEach((tr) => (tr.hidden = !tr.dataset.row.includes(s.value.toLowerCase())));
      m.querySelectorAll("[data-kc]").forEach((r) => (r.onchange = () => { const cb = m.querySelector(`[data-km="${r.dataset.kc}"]`); if (cb) cb.checked = true; }));
      m.querySelector("[data-ok]").onclick = () => {
        const name = m.querySelector("[data-kn]").value.trim(); const members = [...m.querySelectorAll("[data-km]:checked")].map((x) => x.dataset.km); const chair = m.querySelector("[data-kc]:checked")?.dataset.kc || "";
        if (!name) return toast("Bezeichnung fehlt", "", "error");
        if (!chair || !members.includes(chair)) return toast("Vorsitz wählen", "Der Vorsitz muss Mitglied der Kommission sein.", "error");
        close({ name, fachbereich: m.querySelector("[data-kf]").value, members, chair });
      };
    } });
  if (!v) return;
  if (id) await upd("groups", id, v); else await create("groups", { ...v, org: "", kind: "kommission", source: "koordinierungsstelle", course: "" });
  const n = D.catalog.filter((c) => c.status && c.team?.kommission_group === id).length;
  toast("Kommission gespeichert", `${v.name}${n ? ` – sofort wirksam in ${n} Prüfung(en)` : ""}`);
}

// ---------- Unternehmenspools ----------
function tabPools() {
  const list = pools().filter((p) => !UI.fb || p.fachbereich === UI.fb);
  return `<div class="row between wrap mb"><p class="small" style="margin:0">Unternehmenspools werden einem Fachbereich zugeordnet und können nur von Prüfungen dieses Fachbereichs ausgewählt werden. Neue Pools legen Koordinierungsstelle und Kommission (in der Prüfung) an.</p>
    <div class="row wrap" style="gap:8px"><select class="select" data-fb aria-label="Fachbereich filtern" style="width:auto"><option value="">alle Fachbereiche</option>${fachbereiche().map((f) => `<option value="${f.id}" ${UI.fb === f.id ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select><button class="btn primary sm" data-pool="">${icon("plus")} Unternehmenspool</button></div></div>
  <div class="tablewrap"><table class="tbl"><thead><tr><th>Unternehmen</th><th>Fachbereich</th><th>Branche</th><th class="num">Prüfungen</th><th>Angelegt von</th><th></th></tr></thead><tbody>
    ${list.map((u) => `<tr><td><b>${esc(u.name)}</b><div class="xs muted">${esc((u.allgemein || "").slice(0, 110))}</div></td><td class="small">${esc(fbName(u.fachbereich))}</td><td class="small">${esc(u.branche || "")}</td><td class="num">${D.catalog.filter((c) => c.status && c.meta?.pool === u.id).length}</td><td class="small">${esc(u.by || "")}</td><td><button class="iconbtn" data-pool="${u.id}" aria-label="${esc(u.name)} bearbeiten">${icon("pencil")}</button></td></tr>`).join("") || `<tr><td colspan="6"><div class="empty small">Keine Unternehmenspools.</div></td></tr>`}</tbody></table></div>`;
}
async function editPool(id) {
  const u = pools().find((x) => x.id === id) || {};
  const v = await modal({ title: id ? "Unternehmenspool bearbeiten" : "Unternehmenspool anlegen", size: "wide", body: poolForm(u, { fbSelect: true, fb: UI.fb || u.fachbereich }),
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>Speichern</button>`,
    onMount: (m, close) => (m.querySelector("[data-ok]").onclick = () => { const o = readPoolForm(m); if (!o.name) { m.querySelector("[data-pf=name]").style.borderColor = "var(--red)"; return; } close(o); }) });
  if (!v) return;
  await savePool({ ...u, ...v, id: u.id, by: u.by || personName(me()), at: u.at || new Date().toISOString() });
  toast("Unternehmenspool gespeichert", v.name);
}

// ---------- Korrekturzeichensätze ----------
function tabZeichen() {
  const s = signsets(); const saved = s.sets.find((x) => x.id === (UI.set || s.active)) || s.sets[0]; UI.set = saved?.id || "";
  const cur = SD && SD.id === saved?.id ? SD : saved;
  return `<div class="notice info small mb">${icon("info")}<span>Der <b>verbindliche Korrekturzeichensatz</b> gilt einheitlich in allen Instanzen – Erstellung (Prüflösung, Erwartungshorizont), Prüfung (Erst-, Zweit-, Drittkorrektur) und Unterricht. Korrektor:innen wählen ihre Favoriten aus diesem Satz. Bereits gesetzte Zeichen bleiben erhalten.</span></div>
  <div class="edlayout"><aside class="edtree"><div class="row between"><b>Zeichensätze</b><button class="btn xs" data-newset>${icon("plus")} Neu</button></div><ol>${s.sets.map((x) => `<li><button class="edn ${x.id === cur?.id ? "on" : ""}" data-set="${x.id}"><span class="grow">${esc(x.name)}</span>${x.id === s.active ? `<span class="badge green">verbindlich</span>` : ""}</button></li>`).join("")}</ol></aside>
  <div class="edpanel">${cur ? `<div class="row between wrap"><h2 style="margin:0">${esc(cur.name)}</h2><div class="row wrap" style="gap:6px">${cur.id === s.active ? `<span class="badge green">${icon("check")} verbindlich für alle Instanzen</span>` : `<button class="btn primary sm" data-activate>${icon("check")} Als verbindlich festlegen</button>`}<button class="btn sm" data-dupset>${icon("copy")} Duplizieren</button>${cur.id === s.active ? "" : `<button class="btn sm ghost" data-delset>${icon("trash-2")} Löschen</button>`}</div></div>
    <div class="field mt"><label class="lbl" for="ss-n">Bezeichnung</label><input id="ss-n" class="input" data-ssname value="${esc(cur.name)}"></div>
    ${(cur.groups || []).map((g, gi) => `<section class="edsec"><div class="row between"><input class="input" style="max-width:420px;font-weight:600" data-sg="${gi}" value="${esc(g.group)}" aria-label="Gruppe"><div class="row"><button class="btn xs" data-additem="${gi}">${icon("plus")} Zeichen</button><button class="iconbtn" data-delgrp="${gi}" aria-label="Gruppe entfernen">${icon("trash-2")}</button></div></div>
      <table class="tbl compact mt-s"><thead><tr><th style="width:120px">Kürzel</th><th>Bedeutung</th><th>Stifteingabe</th><th></th></tr></thead><tbody>${(g.items || []).map((it, ii) => `<tr><td><input class="input" data-si="${gi}.${ii}.0" value="${esc(it[0])}" aria-label="Kürzel"></td><td><input class="input" data-si="${gi}.${ii}.1" value="${esc(it[1])}" aria-label="Bedeutung"></td><td class="xs">${inkSupported(it[0]) ? `<span class="badge green">erkennbar</span>` : `<span class="badge yellowb" title="Für die Handschrifterkennung stehen nur diese Zeichen zur Verfügung: ${esc(INK_CHARS.join(" "))}">nur Auswahl</span>`}</td><td><button class="iconbtn" data-delitem="${gi}.${ii}" aria-label="Zeichen entfernen">${icon("x")}</button></td></tr>`).join("")}</tbody></table></section>`).join("")}
    <div class="row between mt"><button class="btn sm" data-addgrp>${icon("plus")} Gruppe</button><button class="btn primary" data-saveset>${icon("save")} Zeichensatz speichern</button></div>
    <p class="xs muted">Stifteingabe: Kürzel aus den Buchstaben ${esc(INK_CHARS.join(" "))} werden per Handschrift erkannt; andere Kürzel stehen über die Auswahl im Korrekturmodus zur Verfügung.</p>` : ""}</div></div>`;
}
const draftSet = () => { const s = signsets(); const cur = s.sets.find((x) => x.id === UI.set) || s.sets[0]; return { s: JSON.parse(JSON.stringify(s)), cur: JSON.parse(JSON.stringify(cur)) }; };
let SD = null; // ungespeicherter Zeichensatz
function readSet(el) {
  const d = SD || draftSet().cur; const n = el.querySelector("[data-ssname]"); if (n) d.name = n.value.trim() || d.name;
  el.querySelectorAll("[data-sg]").forEach((f) => (d.groups[+f.dataset.sg].group = f.value));
  el.querySelectorAll("[data-si]").forEach((f) => { const [g, i, k] = f.dataset.si.split(".").map(Number); d.groups[g].items[i][k] = f.value.trim(); });
  return d;
}

// ---------- Fachbereiche ----------
function tabFb() {
  return `<p class="small">Fachbereiche gliedern Ausbildungsberufe, Kommissionen und Unternehmenspools.</p><div class="tablewrap" style="max-width:720px"><table class="tbl"><thead><tr><th>Fachbereich</th><th class="num">Berufe</th><th class="num">Kommissionen</th><th class="num">Unternehmenspools</th></tr></thead><tbody>
    ${fachbereiche().map((f) => `<tr><td><input class="input" data-fbn="${f.id}" value="${esc(f.name)}" aria-label="Fachbereich"></td><td class="num">${berufe().filter((b) => b.fb === f.id).length}</td><td class="num">${D.groups.filter((g) => g.kind === "kommission" && g.fachbereich === f.id).length}</td><td class="num">${pools().filter((p) => p.fachbereich === f.id).length}</td></tr>`).join("")}</tbody></table></div>
    <div class="row mt" style="gap:8px"><button class="btn sm" data-addfb>${icon("plus")} Fachbereich</button><button class="btn primary sm" data-savefb>${icon("save")} Speichern</button></div>`;
}

function bind(el, tab) {
  const q = el.querySelector("[data-q]"); if (q) q.oninput = () => { UI.q = q.value; redraw(); const n = document.querySelector("[data-q]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  const sq = el.querySelector("[data-sq]"); if (sq) sq.oninput = () => { UI.sq = sq.value; redraw(); const n = document.querySelector("[data-sq]"); n.focus(); n.setSelectionRange(n.value.length, n.value.length); };
  el.querySelectorAll("[data-beruf]").forEach((b) => (b.onclick = () => editBeruf(b.dataset.beruf)));
  el.querySelectorAll("[data-ob]").forEach((cb) => (cb.onchange = async () => { const [oid, bid] = cb.dataset.ob.split("|"); const o = D.orgs.find((x) => x.id === oid); const set = new Set(o.berufe || []); if (cb.checked) set.add(bid); else set.delete(bid); await upd("orgs", oid, { berufe: [...set] }); toast("Ausbildungsberufe gespeichert", `${o.short}: ${[...set].map((x) => berufById(x)?.nr || x).join(", ") || "keine"}`); }));
  const fb = el.querySelector("[data-fb]"); if (fb) fb.onchange = () => { UI.fb = fb.value; redraw(); };
  el.querySelectorAll("[data-pool]").forEach((b) => (b.onclick = () => editPool(b.dataset.pool)));
  el.querySelectorAll("[data-kom]").forEach((b) => (b.onclick = () => editKom(b.dataset.kom)));
  // Zeichensätze
  if (tab === "zeichen") {
    el.querySelectorAll("[data-set]").forEach((b) => (b.onclick = () => { UI.set = b.dataset.set; SD = null; redraw(); }));
    const edit = (fn) => { SD = readSet(el); fn(SD); redraw(); };
    el.querySelectorAll("[data-additem]").forEach((b) => (b.onclick = () => edit((d) => d.groups[+b.dataset.additem].items.push(["", ""]))));
    el.querySelectorAll("[data-delitem]").forEach((b) => (b.onclick = () => edit((d) => { const [g, i] = b.dataset.delitem.split(".").map(Number); d.groups[g].items.splice(i, 1); })));
    el.querySelectorAll("[data-delgrp]").forEach((b) => (b.onclick = () => edit((d) => d.groups.splice(+b.dataset.delgrp, 1))));
    const ag = el.querySelector("[data-addgrp]"); if (ag) ag.onclick = () => edit((d) => d.groups.push({ group: "Neue Gruppe", items: [["", ""]] }));
    const save = async (activate = false) => {
      const d = readSet(el); d.groups = d.groups.map((g) => ({ group: g.group.trim() || "Gruppe", items: g.items.filter((i) => i[0]) }));
      const keys = d.groups.flatMap((g) => g.items.map((i) => i[0])); const dup = keys.find((k, i) => keys.indexOf(k) !== i);
      if (dup) return toast("Kürzel doppelt", `„${dup}“ kommt mehrfach vor.`, "error");
      if (!keys.length) return toast("Leerer Zeichensatz", "Mindestens ein Korrekturzeichen angeben.", "error");
      const s = signsets(); const v = { active: activate ? d.id : s.active, sets: s.sets.map((x) => (x.id === d.id ? d : x)) };
      await saveSignsets(v); SD = null; toast(activate ? "Verbindlicher Zeichensatz festgelegt" : "Zeichensatz gespeichert", `${d.name} · gilt ${v.active === d.id ? "jetzt für Erstellung, Prüfung und Unterricht" : "erst nach Festlegung als verbindlich"}`);
    };
    const sv = el.querySelector("[data-saveset]"); if (sv) sv.onclick = () => save(false);
    const ac = el.querySelector("[data-activate]"); if (ac) ac.onclick = async () => { if (await confirmBox("Zeichensatz verbindlich festlegen", "<p>Der Zeichensatz gilt sofort einheitlich für alle Instanzen (Erstellung, Prüfung, Unterricht). Favoriten der Korrektor:innen, die nicht enthalten sind, entfallen.</p>", "Festlegen", "Abbrechen", false)) save(true); };
    const ns = el.querySelector("[data-newset]"); if (ns) ns.onclick = async () => { const s = signsets(); const n = { id: rid(), name: "Neuer Zeichensatz", groups: [{ group: "Allgemeine Korrekturzeichen", items: [["r", "richtig"], ["f", "falsch"]] }] }; await saveSignsets({ ...s, sets: [...s.sets, n] }); UI.set = n.id; SD = null; };
    const du = el.querySelector("[data-dupset]"); if (du) du.onclick = async () => { const s = signsets(); const cur = readSet(el); const n = { ...JSON.parse(JSON.stringify(cur)), id: rid(), name: cur.name + " (Kopie)" }; await saveSignsets({ ...s, sets: [...s.sets, n] }); UI.set = n.id; SD = null; };
    const de = el.querySelector("[data-delset]"); if (de) de.onclick = async () => { if (!(await confirmBox("Zeichensatz löschen", "Der Zeichensatz wird entfernt.", "Löschen"))) return; const s = signsets(); await saveSignsets({ ...s, sets: s.sets.filter((x) => x.id !== UI.set) }); UI.set = ""; SD = null; };
  }
  const af = el.querySelector("[data-addfb]"); if (af) af.onclick = async () => { await setSetting("fachbereiche", [...fachbereiche(), { id: rid(), name: "Neuer Fachbereich" }]); };
  const sf = el.querySelector("[data-savefb]"); if (sf) sf.onclick = async () => { const v = fachbereiche().map((f) => ({ ...f, name: el.querySelector(`[data-fbn="${f.id}"]`)?.value.trim() || f.name })); await setSetting("fachbereiche", v); toast("Fachbereiche gespeichert"); };
}

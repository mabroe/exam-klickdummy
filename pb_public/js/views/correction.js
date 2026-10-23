// Korrekturworkflow: Korrekturübersicht, Korrekturmodus, Vergleich, Erwartungshorizont
import { D, byId, upd, create, setting, setSetting } from "../data.js?v=9.3";
import { icon, esc, modal, confirmBox, toast, drawer, popMenu, fmtDateTime, parseDate, uid, store } from "../ui.js?v=9.3";
import { EXAM, ALL_SUBTASKS, subtask, SIGNS, TOTAL_POINTS, CORRECTORS } from "../scenario.js?v=9.3";
import { contentScope } from "../content.js?v=9.3";
import * as CRk from "./creation.js?v=9.3";
import { navigate, redraw, session } from "../app.js?v=9.3";
import { me, courseOf, correctorStages, canCorrect, correctionOver, lessonCorrector, lessonTeachers, isTeacherOf, personName, visibleCourses, STAGE_LABEL } from "../access.js?v=9.3";
import { linearGrade, fmtNote, approvalState, approvalText } from "../grades.js?v=9.3";
export { mode } from "./kmode.js?v=9.3";

const S = { view: "aufgaben", collapsed: {} };
// Lehrkraft (Unterrichtsebene): genau eine Korrektur; Korrektor:in (Prüfungsebene): Erst-, Zweit-, Drittkorrektur
export const lessonMode = () => session.role === "lehrkraft";
// Stufen, in denen die angemeldete Person in Prüfungen korrigiert
export const myStages = () => { const pe = me(); if (!pe) return [1, 2, 3]; return [...new Set(D.courses.filter((c) => c.kind === "pruefung").flatMap((c) => correctorStages(c, pe.id)))].sort(); };
export const corr = () => { if (lessonMode()) return 1; const st = myStages(); const k = +session.corrector || st[0] || 1; return st.length && !st.includes(k) ? st[0] : k; };
export const corrName = (c) => (lessonMode() ? "Korrektur" : CORRECTORS[c]?.label || "Korrektur");

// Teilnehmende mit Abgaben (Korrekturgegenstand)
// Zu korrigierende Arbeiten: nur aus Kursen, in denen das Konto korrigieren darf (Prüfung: Korrektor:in, Unterricht: Lehrkraft des Kurses)
export function candidates() {
  const withSubs = new Set(D.items.filter((i) => i.submission && i.participant).map((i) => i.participant));
  const pe = me();
  const kind = lessonMode() ? "unterricht" : "pruefung";
  const stage = corr();
  // Prüfung: nur Prüflinge, für die die Person der Korrektorengruppe dieser Stufe angehört (Endbeurteilung nur, wenn angefordert)
  return D.participants.filter((p) => { if (!withSubs.has(p.id)) return false; const c = courseOf(byId("rooms", p.room)); if (!pe) return !lessonMode(); return c?.kind === kind && canCorrect(c, p, stage, pe.id); }).sort((a, b) => a.lastname.localeCompare(b.lastname));
}
export const grading = (pid, c = corr()) => D.gradings.find((g) => g.participant === pid && g.corrector === c);
export function stPoints(g, st) {
  if (!g) return null;
  if (g.not_done?.[st]) return 0;
  const p = g.points?.[st]; if (!p) return null;
  return p.reduce((a, b) => a + (+b || 0), 0);
}
export const fmtP = (v) => (v === null || v === undefined ? "–" : String(Math.round(v * 10) / 10).replace(".", ","));
const grade = (pts) => fmtNote(linearGrade(pts));
// Gemeinsame Bewertung freigeben bzw. Freigabe zurückziehen (Gruppenfreigabe)
export async function setApproval(p, on) {
  const stage = corr(); const pe = me(); const g = grading(p.id, stage); const st = approvalState(p, stage);
  if (!on) {
    if (st.final) { toast("Freigabe nicht zurückziehbar", "Alle Mitglieder der Korrektorengruppe haben freigegeben – die Bewertung ist final.", "error"); return false; }
    if (correctionOver(courseOf(byId("rooms", p.room)))) { toast("Korrekturzeitraum beendet", "Die Freigabe kann nicht mehr zurückgezogen werden.", "error"); return false; }
  }
  const cur = new Set(g?.approvals || []); on ? cur.add(pe.id) : cur.delete(pe.id);
  const approvals = [...cur]; const final = st.group.length > 0 && st.group.every((x) => cur.has(x));
  if (g) await upd("gradings", g.id, { approvals, released: final });
  else await create("gradings", { participant: p.id, corrector: stage, points: {}, not_done: {}, marks: {}, approvals, released: final });
  return true;
}
export async function saveGrading(pid, patch) {
  const g = grading(pid);
  if (g) return upd("gradings", g.id, patch);
  return create("gradings", { participant: pid, corrector: corr(), points: {}, not_done: {}, marks: {}, released: false, ...patch });
}

// Status der gemeinsamen Bewertung (aggregiert, ohne Namen)
function statusBadge(p, done) {
  const a = approvalState(p, corr());
  if (a.final) return `<span class="badge green">${icon("lock")} final</span>`;
  if (a.n) return `<span class="badge yellowb" title="Freigabe der Korrektorengruppe">${esc(approvalText(a))}</span>`;
  return done ? `<span class="badge cyan">bewertet</span>` : `<span class="badge gray">offen</span>`;
}
function approveBtn(p, done) {
  const a = approvalState(p, corr()); const pe = me(); if (!pe || a.final) return "";
  if (a.approved(pe.id)) return correctionOver(courseOf(byId("rooms", p.room))) ? "" : `<button class="btn sm ghost" data-approve="${p.id}" data-on="0">${icon("rotate-ccw")} Freigabe zurückziehen</button>`;
  return `<button class="btn sm" data-approve="${p.id}" data-on="1" ${done ? "" : `title="Noch nicht alle Teilaufgaben bewertet"`}>${icon("circle-check")} Freigeben</button>`;
}

// ---------- Übersicht ----------
export function overview(q) {
  if (q.k) session && (sessionStorage.setItem("cbw.corrector", q.k));
  return {
    shell: "staff", rail: "ergebnisse", title: "Korrekturübersicht",
    render() {
      const CS = contentScope(candidates()); const ps = CS.ps;
      const c = corr();
      const pe0 = me();
      const mineOpen = ps.filter((p) => !approvalState(p, c).approved(pe0?.id));
      const mineWithdraw = ps.filter((p) => { const a = approvalState(p, c); return a.approved(pe0?.id) && !a.final && !correctionOver(courseOf(byId("rooms", p.room))); });
      const total = (p) => ALL_SUBTASKS.reduce((a, s) => a + (stPoints(grading(p.id), s.no) || 0), 0);
      const openCnt = ps.reduce((a, p) => a + ALL_SUBTASKS.filter((s) => stPoints(grading(p.id), s.no) === null).length, 0);
      let table;
      if (S.view === "aufgaben") {
        const head = EXAM.tasks.map((t) => S.collapsed[t.no] ? `<th class="sum grp" data-grp="${t.no}" title="Aufklappen">Summe A${t.no} ${icon("chevron-right")}</th>` : t.subtasks.map((s) => `<th title="${esc(s.title)}">${s.no}</th>`).join("") + `<th class="sum grp" data-grp="${t.no}" title="Zuklappen">${icon("chevron-left")} Summe A${t.no}</th>`).join("");
        const maxRow = EXAM.tasks.map((t) => (S.collapsed[t.no] ? "" : t.subtasks.map((s) => `<td>${s.points}</td>`).join("")) + `<td class="sum">${t.points}</td>`).join("");
        const other = c === 1 ? 2 : 1;
        table = `<div class="tablewrap"><table class="tbl ktable"><thead><tr><th>Name</th><th>Vorname</th>${head}<th class="sum">Gesamt</th><th>Note</th><th>Status</th></tr></thead><tbody>
        <tr class="maxrow"><td>Max. Punkte</td><td></td>${maxRow}<td class="sum">${TOTAL_POINTS}</td><td></td><td></td></tr>
        <tr class="maxrow progrow"><td>Bewertet</td><td></td>${EXAM.tasks.map((t) => (S.collapsed[t.no] ? "" : t.subtasks.map((s) => { const n = ps.filter((p) => stPoints(grading(p.id), s.no) !== null).length; return `<td title="${n} von ${ps.length} Prüflingen bewertet"><span class="xs">${n}/${ps.length}</span><div class="hbar thin"><i style="width:${ps.length ? (n / ps.length) * 100 : 0}%"></i></div></td>`; }).join("")) + `<td class="sum"></td>`).join("")}<td class="sum"></td><td></td><td></td></tr>
        ${ps.map((p) => {
          const g = grading(p.id); const go = grading(p.id, other);
          const cells = EXAM.tasks.map((t) => { let sum = 0, any = false; const sc = t.subtasks.map((s) => { const v = stPoints(g, s.no); if (v !== null) { sum += v; any = true; } const vo = stPoints(go, s.no); const diff = v !== null && vo !== null && Math.abs(v - vo) >= s.points * 0.3; return S.collapsed[t.no] ? "" : `<td class="cell ${v === null ? "open" : ""} ${g?.not_done?.[s.no] ? "nd" : ""} ${diff ? "diff" : ""}" data-cell="${p.id}|${s.no}" title="${diff ? "Deutliche Abweichung zur " + corrName(other) : "Bewerten"}">${g?.not_done?.[s.no] ? "n.b." : fmtP(v)}${D.comments.some((x) => x.participant === p.id && x.subtask === s.no) ? " " + icon("message-square") : ""}</td>`; }).join(""); return sc + `<td class="sum">${any ? fmtP(sum) : "–"}</td>`; }).join("");
          const tot = total(p); const done = ALL_SUBTASKS.every((s) => stPoints(g, s.no) !== null);
          return `<tr><td>${esc(p.lastname)}</td><td>${esc(p.firstname)}</td>${cells}<td class="sum">${fmtP(tot)}</td><td>${done ? grade(tot) : "–"}</td><td>${statusBadge(p, done)}</td></tr>`;
        }).join("")}</tbody></table></div>
        <p class="small muted mt-s">Klicken Sie auf eine Zelle, um die Teilaufgabe im Korrekturmodus zu bewerten. ${icon("message-square")} = Kommentar vorhanden${lessonMode() ? "" : ` · <span class="badge yellowb">gelb</span> = deutliche Abweichung zur ${corrName(other)}`} · n.b. = nicht bearbeitet</p>`;
      } else {
        table = `<div class="cgrid">${ps.map((p) => {
          const g = grading(p.id); const done = ALL_SUBTASKS.filter((s) => stPoints(g, s.no) !== null).length; const tot = total(p);
          const next = ALL_SUBTASKS.find((s) => stPoints(g, s.no) === null) || ALL_SUBTASKS[0];
          return `<div class="card pad"><div class="row between"><h3>${esc(p.lastname)}, ${esc(p.firstname)}</h3>${statusBadge(p, done === ALL_SUBTASKS.length)}</div>
          <div class="small muted">${esc(p.username)} · Platz ${esc(p.seat || "–")}</div>
          <div class="mt-s small">Fortschritt <span class="miniprogress" style="width:120px"><i style="width:${(done / ALL_SUBTASKS.length) * 100}%"></i></span> ${done}/${ALL_SUBTASKS.length} Teilaufgaben</div>
          <div class="row between mt"><span><b>${fmtP(tot)}</b> / ${TOTAL_POINTS} Punkte${done === ALL_SUBTASKS.length ? ` · Note ${grade(tot)}` : ""}</span><span class="row" style="gap:6px">${approveBtn(p, done === ALL_SUBTASKS.length)}<a class="btn sm" href="#/app/korrektur/${p.id}/${next.no}">${icon("arrow-right")} Korrigieren</a></span></div></div>`;
        }).join("")}</div>`;
      }
      const room = D.rooms.find((r) => r.name === "Raum 123");
      const lesson = lessonMode(); const pe = me();
      const mine = lesson ? visibleCourses(pe).filter((x) => x.kind === "unterricht" && lessonCorrector(x) === pe?.id) : [];
      const elsewhere = lesson ? visibleCourses(pe).filter((x) => x.kind === "unterricht" && lessonCorrector(x) && lessonCorrector(x) !== pe?.id) : [];
      const sub = lesson ? (mine.length ? mine.map((x) => esc(x.title)).join(" · ") : "Keine Unterrichtskurse in Ihrer Korrektur") : `${esc(EXAM.name)} · ${esc(CORRECTORS[c].label)} · Prüflinge, deren Korrektorengruppe Sie angehören`;
      // Prüfungsbegutachtung vor Prüfungsstart (Task 48): Prüfungen im Begutachtungszeitraum, in denen das Konto korrigiert
      const rev = D.catalog.filter((x) => x.status === "begutachtung" && CRk.schoolReviewer(x, pe0));
      const revHtml = rev.map((x) => `<div class="notice info mb">${icon("eye")}<span><b>Prüfungsbegutachtung vor Prüfungsstart:</b> „${esc(x.title)}“ ist bis ${fmtDateTime(CRk.startAt(x))} Uhr zur Begutachtung freigeschaltet. Fehler melden Sie bitte außerhalb des Portals an die Koordinierungsstelle bzw. Prüfungskommission.</span><a class="btn sm" href="#/app/vorschau/${x.id}/dashboard">${icon("eye")} Prüfung begutachten</a></div>`).join("");
      return revHtml + `<div class="pagehead"><div><h1>Korrekturübersicht</h1><div class="sub">${sub}</div></div>
        <div class="row wrap">${CS.select}${lesson ? `<button class="btn" data-handoff ${mine.length ? "" : "disabled"} title="Korrektur an eine andere Lehrkraft des Kurses weitergeben">${icon("forward")} Korrektur weitergeben</button>` : `${myStages().length > 1 ? `<select class="select" style="width:auto" data-corr aria-label="Korrekturstufe">${myStages().map((k) => `<option value="${k}" ${c === k ? "selected" : ""}>${CORRECTORS[k].label}</option>`).join("")}</select>` : `<span class="badge" style="background:${CORRECTORS[c].color};color:#fff">${esc(CORRECTORS[c].label)}</span>`}`}
        <button class="btn primary" data-start ${ps.length ? "" : "disabled"}>${icon("play")} Korrektur starten</button></div></div>
      <div class="row between wrap"><nav class="tabs" style="flex:1"><button data-view="aufgaben" class="${S.view === "aufgaben" ? "active" : ""}">Aufgabenweise</button><button data-view="personen" class="${S.view === "personen" ? "active" : ""}">Personenweise</button></nav>
        <div class="row" style="margin-bottom:24px"><span class="small muted">${openCnt} Bewertungen offen</span>${mineWithdraw.length ? `<button class="btn ghost" data-withdrawall>${icon("rotate-ccw")} Meine Freigaben zurückziehen (${mineWithdraw.length})</button>` : ""}<button class="btn" data-release ${mineOpen.length ? "" : "disabled"}>${icon("funnel")} ${mineOpen.length ? `Alle freigeben (${mineOpen.length})` : "Von Ihnen freigegeben"}</button></div></div>
      ${lesson ? "" : `<p class="xs muted" style="margin-top:-14px">Gemeinsame Bewertung je Korrekturstufe: Sie ist final, sobald alle Mitglieder der Korrektorengruppe freigegeben haben. Bis dahin kann jedes Mitglied seine Freigabe zurückziehen (bis zum Ende des Korrekturzeitraums).</p>`}
      ${lesson && elsewhere.length ? `<div class="notice info small mb">${icon("info")}<span>${elsewhere.map((x) => `Die Korrektur von „${esc(x.title)}“ liegt bei <b>${esc(personName(byId("persons", lessonCorrector(x))))}</b>.`).join(" ")}</span></div>` : ""}
      ${ps.length ? table : !lesson && c === 3 ? `<div class="card empty">${icon("file-pen-line")}<h3>Keine Endbeurteilung angefordert</h3><p>Die Schuladministration entscheidet nach Erst- und Zweitkorrektur, ob eine Drittkorrektur (Endbeurteilung) notwendig ist. Angeforderte Prüflinge erscheinen hier.</p></div>` : `<div class="card empty">${icon("file-pen-line")}<h3>Noch keine Abgaben vorhanden</h3><p>Sobald Prüflinge Abgaben markiert haben, erscheinen sie hier.</p>${room ? `<a class="btn" href="#/app/raum/${room.id}/meinraum">Zur Raumaufsicht</a>` : ""}</div>`}`;
    },
    mount(el) {
      el.querySelectorAll("[data-view]").forEach((b) => (b.onclick = () => { S.view = b.dataset.view; redraw(); }));
      el.querySelectorAll("[data-grp]").forEach((b) => (b.onclick = () => { S.collapsed[b.dataset.grp] = !S.collapsed[b.dataset.grp]; redraw(); }));
      el.querySelectorAll("[data-cell]").forEach((td) => (td.onclick = () => { const [p, s] = td.dataset.cell.split("|"); navigate(`#/app/korrektur/${p}/${s}`); }));
      const ho = el.querySelector("[data-handoff]"); if (ho) ho.onclick = () => handoff();
      const cs = el.querySelector("[data-corr]"); if (cs) cs.onchange = (e) => { sessionStorage.setItem("cbw.corrector", e.target.value); redraw(); toast(corrName(+e.target.value) + " aktiv", "", "info"); };
      const st = el.querySelector("[data-start]");
      if (st) st.onclick = () => { for (const p of candidates()) { const s = ALL_SUBTASKS.find((x) => stPoints(grading(p.id), x.no) === null); if (s) return navigate(`#/app/korrektur/${p.id}/${s.no}`); } const p = candidates()[0]; navigate(`#/app/korrektur/${p.id}/1.1`); };
      const rel = el.querySelector("[data-release]");
      if (rel) rel.onclick = async () => {
        const pe = me(); const ps = candidates().filter((p) => !approvalState(p, corr()).approved(pe?.id));
        const open = ps.reduce((a, p) => a + ALL_SUBTASKS.filter((s) => stPoints(grading(p.id), s.no) === null).length, 0);
        const ok = await confirmBox("Bewertungen freigeben", `${open ? `<div class="notice warn">${icon("triangle-alert")}<span>Es sind noch <b>${open}</b> Bewertungen offen. Offene Teilaufgaben werden mit 0 Punkten gewertet.</span></div>` : ""}<p>Sie geben die gemeinsame Bewertung (${esc(corrName(corr()))}) für <b>${ps.length}</b> Prüfling${ps.length === 1 ? "" : "e"} frei. Final wird sie, sobald alle Mitglieder der Korrektorengruppe freigegeben haben; bis dahin können Sie Ihre Freigabe zurückziehen.</p>`, "Freigeben");
        if (!ok) return;
        for (const p of ps) await setApproval(p, true);
        toast("Freigabe erteilt", `${corrName(corr())}: ${ps.length} Prüfling${ps.length === 1 ? "" : "e"}.`);
      };
      const wa = el.querySelector("[data-withdrawall]");
      if (wa) wa.onclick = async () => {
        if (!(await confirmBox("Freigaben zurückziehen", "<p>Ihre Freigaben für noch nicht finale Bewertungen werden zurückgezogen. Die Bewertungen bleiben im Entwurfsstatus.</p>", "Zurückziehen"))) return;
        const pe = me(); for (const p of candidates()) { const a = approvalState(p, corr()); if (a.approved(pe?.id) && !a.final) await setApproval(p, false); }
        toast("Freigaben zurückgezogen", "", "info");
      };
      el.querySelectorAll("[data-approve]").forEach((b) => (b.onclick = async () => { const p = byId("participants", b.dataset.approve); if (await setApproval(p, b.dataset.on === "1")) toast(b.dataset.on === "1" ? "Freigabe erteilt" : "Freigabe zurückgezogen", `${p.lastname}, ${p.firstname}`, "info"); }));
    },
  };
}


// Unterricht: Korrektur an eine andere Lehrkraft des Kurses weitergeben (bisherige Bewertungen bleiben erhalten)
async function handoff() {
  const pe = me();
  const courses = visibleCourses(pe).filter((x) => x.kind === "unterricht" && lessonCorrector(x) === pe?.id);
  if (!courses.length) return;
  const opts = (c) => lessonTeachers(c).filter((t) => t.id !== pe.id);
  const v = await modal({ title: "Korrektur weitergeben", size: "narrow",
    body: `<p class="small">Im Unterricht korrigiert genau eine Lehrkraft. Die Korrektur kann an eine andere Lehrkraft weitergegeben werden, die Mitglied des Kurses ist. Bisherige Bewertungen und Korrekturzeichen bleiben erhalten.</p>
      <div class="field"><label class="lbl" for="ho-c">Unterricht (Kurs)</label><select id="ho-c" class="select" data-c>${courses.map((c) => `<option value="${c.id}">${esc(c.title)}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="ho-t">An Lehrkraft</label><select id="ho-t" class="select" data-t></select><p class="xs muted" data-none hidden style="margin:6px 0 0">Diesem Kurs gehört noch keine weitere Lehrkraft an. Fügen Sie im Kurs unter „Mitglieder und Gruppen“ eine Lehrkraft hinzu.</p></div>`,
    footer: `<button class="btn" data-close>Abbrechen</button><button class="btn primary" data-ok>${icon("forward")} Weitergeben</button>`,
    onMount: (m, close) => {
      const cs = m.querySelector("[data-c]"), ts = m.querySelector("[data-t]"), ok = m.querySelector("[data-ok]");
      const fill = () => { const l = opts(byId("courses", cs.value)); ts.innerHTML = l.map((t) => `<option value="${t.id}">${esc(personName(t))}</option>`).join(""); ts.disabled = !l.length; ok.disabled = !l.length; m.querySelector("[data-none]").hidden = !!l.length; };
      cs.onchange = fill; fill();
      ok.onclick = () => close({ c: cs.value, t: ts.value });
    } });
  if (!v || !v.t) return;
  const c = byId("courses", v.c), t = byId("persons", v.t);
  await upd("courses", c.id, { corrector: t.id });
  toast("Korrektur weitergegeben", `„${c.title}“ wird jetzt von ${personName(t)} korrigiert.`);
}

const draftKey = (pid, st) => `cdraft.${pid}.${st}`;
export function commentsDrawer(pid, st) {
  const list = () => D.comments.filter((x) => x.participant === pid && x.subtask === st).sort((a, b) => (a.created < b.created ? 1 : -1));
  drawer({ title: "Kommentare", iconName: "message-square",
    body: `<div data-list>${list().map((c) => `<div class="comment"><b>${esc(c.author)}</b><span class="xs muted">${fmtDateTime(parseDate(c.created))}</span><p style="margin:6px 0 0">${esc(c.body)}</p></div>`).join("") || `<div class="empty small">Noch keine Kommentare zu dieser Teilaufgabe.</div>`}</div>`,
    footer: `<label class="lbl">Kommentar</label><textarea class="input" data-c placeholder="Kommentar eingeben">${esc(store.lget(draftKey(pid, st), ""))}</textarea><div class="row between mt-s"><span class="xs muted" data-cdraft>${store.lget(draftKey(pid, st), "") ? "Entwurf wiederhergestellt" : "Entwurf wird automatisch zwischengespeichert"}</span><button class="btn primary" data-send>${icon("message-square")} Kommentieren</button></div>`,
    onMount(d, close) {
      // Entwurf automatisch zwischenspeichern (bei Eingabe, spätestens alle 15 s)
      const ta = d.querySelector("[data-c]"); let dirty = false;
      const saveDraft = () => { if (!dirty) return; dirty = false; store.lset(draftKey(pid, st), ta.value); const x = d.querySelector("[data-cdraft]"); if (x) x.textContent = "Entwurf gespeichert " + new Date().toLocaleTimeString("de-DE"); };
      ta.oninput = () => { dirty = true; clearTimeout(ta._t); ta._t = setTimeout(saveDraft, 1500); };
      const iv = setInterval(() => (ta.isConnected ? saveDraft() : clearInterval(iv)), 15000);
      d.querySelector("[data-send]").onclick = async () => {
        const t = d.querySelector("[data-c]").value.trim(); if (!t) return;
        store.lset(draftKey(pid, st), ""); dirty = false;
        await create("comments", { participant: pid, subtask: st, author: `Korrektor ${corr()} (${session.userName()})`, body: t });
        close(); toast("Kommentar gespeichert"); setTimeout(() => commentsDrawer(pid, st), 50);
      };
    } });
}
export function favoritesDrawer() {
  const favs = new Set(setting("favorites", []));
  drawer({ title: "Favoriten verwalten", iconName: "settings",
    body: `<div class="tree">${SIGNS.map((g, gi) => `<label class="grp"><input type="checkbox" data-g="${gi}" ${g.items.every(([k]) => favs.has(k)) ? "checked" : ""}> ${esc(g.group)}</label><div class="kids">${g.items.map(([k, t]) => `<label title="${esc(t)}"><input type="checkbox" data-k="${esc(k)}" data-gi="${gi}" ${favs.has(k) ? "checked" : ""}> <b>${esc(k)}</b> <span class="small">(${esc(t.length > 60 ? t.slice(0, 60) + "…" : t)})</span></label>`).join("")}</div>`).join("")}</div>`,
    footer: `<div class="row end"><button class="btn primary" data-save>${icon("save")} Favoritenauswahl speichern</button></div>`,
    onMount(d, close) {
      d.querySelectorAll("[data-g]").forEach((g) => (g.onchange = () => d.querySelectorAll(`[data-gi="${g.dataset.g}"]`).forEach((c) => (c.checked = g.checked))));
      d.querySelector("[data-save]").onclick = async () => { const sel = [...d.querySelectorAll("[data-k]:checked")].map((c) => c.dataset.k); await setSetting("favorites", sel); close(); toast("Favoriten gespeichert", `${sel.length} Korrekturzeichen in der Schnellauswahl.`); };
    } });
}

// ---------- Erwartungshorizont ----------
export function horizon(st) {
  const s = subtask(st);
  return {
    shell: "plain", title: "Erwartungshorizont",
    render: () => `<div class="breadcrumb"><button class="link" data-back>${icon("arrow-left")} Zurück</button><span class="muted">Erwartungshorizont (öffnet sich als eigener Tab)</span></div><div class="row between wrap mb"><h1>Erwartungshorizont</h1><select class="select" style="width:auto" data-st>${ALL_SUBTASKS.map((x) => `<option value="${x.no}" ${x.no === st ? "selected" : ""}>Teilaufgabe ${x.no} ${esc(x.title)}</option>`).join("")}</select></div>
      ${s ? `<p class="lead">Teilaufgabe ${s.no} ${esc(s.title)} · ${s.points} Punkte</p><p class="small">${esc(s.text || "")}</p>${(s.type === "single" || s.type === "multiple") && (s.options || []).length ? `<div class="card pad mt"><h3>Lösung (${s.type === "single" ? "Single Choice" : "Multiple Choice"})</h3><ol type="A">${s.options.map((o) => `<li>${o.correct ? `<b>${esc(o.text)}</b> ${icon("check")}` : esc(o.text)}</li>`).join("")}</ol></div>` : ""}
      <div class="card horizont mt">${s.horizon.map(([t, pt]) => `<div class="item"><div><b>${esc(String(t).split(" ").slice(0, 4).join(" "))} …</b><ul><li>${esc(t)}</li></ul></div><div>${esc(pt)}</div></div>`).join("")}</div>
      ${(s.images || []).length ? `<div class="hzimgs mt">${s.images.map((im) => `<figure><img src="${esc(im.src)}" alt="${esc(im.caption || "Abbildung zum Erwartungshorizont")}"><figcaption class="xs muted">${esc(im.caption || "")}</figcaption></figure>`).join("")}</div>` : ""}
      <h3 class="mt-l">Bewertungsraster</h3><div class="tablewrap mt-s"><table class="tbl"><thead><tr><th>Kriterium</th>${s.criteria.some((k) => k[2]) ? "<th>Kategorie</th>" : ""}<th class="num">Max. Punkte</th></tr></thead><tbody>${s.criteria.map(([n, m, cat]) => `<tr><td>${esc(n)}</td>${s.criteria.some((k) => k[2]) ? `<td>${esc(cat || "–")}</td>` : ""}<td class="num">${m}</td></tr>`).join("")}</tbody></table></div>` : ""}`,
    mount(el) {
      el.querySelector("[data-st]").onchange = (e) => navigate(`#/erwartung/${e.target.value}`);
      el.querySelector("[data-back]").onclick = () => { if (window.opener && history.length <= 2) window.close(); else if (history.length > 1) history.back(); setTimeout(() => { if (location.hash.startsWith("#/erwartung")) navigate("#/app/korrektur"); }, 200); };
    },
  };
}

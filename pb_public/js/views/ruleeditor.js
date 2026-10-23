// Aufgabensteuerung im Prüfungseditor: Regeln mit Bedingungen (UND/ODER) und Aktionen – bearbeitet den Entwurf des Editors
import { icon, esc, confirmBox } from "../ui.js?v=8.8";
import { EXAM, ALL_SUBTASKS } from "../scenario.js?v=8.8";
import { CONDITIONS, ACTIONS, newRule, newCondition, newAction, ruleText } from "../rules.js?v=8.8";


const TEMPLATES = [
  { name: "Aufgabe 2 gestartet → neue E-Mail", make: () => ({ ...newRule(), name: "Rückfrage nach Start von Aufgabe 2", groups: [{ id: "g" + Math.random().toString(36).slice(2, 7), match: "all", conditions: [{ ...newCondition("task_opened"), task: "2" }] }],
    actions: [{ ...newAction("mail"), task: "2", subject: "Kurze Rückfrage zur Kalkulation", body: "Hallo,\n\nbitte berücksichtigen Sie bei der Kalkulation zusätzlich den Mindermengenzuschlag von 25 € je Bestellung.\n\nViele Grüße\nKarim Bäumler" }] }) },
  { name: "3 Minuten keine Aktivität → Erinnerung per E-Mail", make: () => ({ ...newRule(), name: "Erinnerung bei Inaktivität", groups: [{ id: "g" + Math.random().toString(36).slice(2, 7), match: "all", conditions: [{ ...newCondition("inactive_minutes"), min: 3 }] }],
    actions: [{ ...newAction("mail"), subject: "Wie ist der Stand?", body: "Hallo,\n\nich habe seit einigen Minuten nichts von Ihnen gehört. Wie ist der aktuelle Stand?\n\nViele Grüße\nKarim Bäumler" }] }) },
  { name: "E-Mail gesendet ODER 10 Minuten in Aufgabe 1 → Termin", make: () => ({ ...newRule(), name: "Terminvorschlag nach Angebotsvergleich", match: "all", groups: [{ id: "g1", match: "any", conditions: [{ ...newCondition("mail_sent"), task: "1" }, { ...newCondition("minutes_in_task"), task: "1", min: 10 }] }],
    actions: [{ ...newAction("event"), task: "1", title: "Abstimmung Lieferantenauswahl", day: 2, start: "10:00", end: "10:30", location: "Besprechungsraum 1", text: "Ergebnis des Angebotsvergleichs vorstellen" }] }) },
  { name: "Restzeit ≤ 15 Minuten UND keine Abgabe zu 3.1 → Hinweis", make: () => ({ ...newRule(), name: "Hinweis auf fehlende Abgabe 3.1", groups: [{ id: "g1", match: "all", conditions: [{ ...newCondition("remaining_minutes"), min: 15 }, { ...newCondition("no_submission"), subtask: "3.1" }] }],
    actions: [{ ...newAction("notice"), text: "Zu Teilaufgabe 3.1 ist noch keine Abgabe markiert. Denken Sie daran, Ihre Ergebnisse als Abgabe zu markieren." }] }) },
];

const taskOpts = (v, any = true) => `${any ? `<option value="">beliebige</option>` : ""}${EXAM.tasks.map((t) => `<option value="${t.no}" ${String(v) === t.no ? "selected" : ""}>Aufgabe ${t.no} ${esc(t.title)}</option>`).join("")}`;
const subOpts = (v, any = true) => `${any ? `<option value="">beliebige</option>` : ""}${ALL_SUBTASKS.map((s) => `<option value="${s.no}" ${String(v) === s.no ? "selected" : ""}>${s.no} ${esc(s.title)}</option>`).join("")}`;
const groupsOf = () => [...new Set(Object.values(CONDITIONS).map((d) => d.group))];
const typeOpts = (v) => groupsOf().map((g) => `<optgroup label="${g}">${Object.entries(CONDITIONS).filter(([, d]) => d.group === g).map(([k, d]) => `<option value="${k}" ${v === k ? "selected" : ""}>${d.label}</option>`).join("")}</optgroup>`).join("");
const matchSel = (path, v, what) => `<select class="select sm matchsel" data-rf="${path}.match" aria-label="Verknüpfung ${what}"><option value="all" ${v !== "any" ? "selected" : ""}>UND – alle</option><option value="any" ${v === "any" ? "selected" : ""}>ODER – mindestens eine</option></select>`;

function condRow(c, path, rules, ri) {
  const d = CONDITIONS[c.type] || CONDITIONS.task_opened;
  const f = [];
  if (d.fields.includes("task")) f.push(`<select class="select sm" data-rf="${path}.task" aria-label="Aufgabe">${taskOpts(c.task, c.type !== "task_opened" && c.type !== "minutes_in_task")}</select>`);
  if (d.fields.includes("subtask")) f.push(`<select class="select sm" data-rf="${path}.subtask" aria-label="Teilaufgabe">${subOpts(c.subtask, c.type === "submission_marked")}</select>`);
  if (d.fields.includes("rule")) f.push(`<select class="select sm" data-rf="${path}.rule" aria-label="Regel"><option value="">Regel wählen</option>${rules.filter((_, k) => k !== ri).map((r) => `<option value="${r.id}" ${c.rule === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select>`);
  if (d.fields.includes("min")) f.push(`<span class="row" style="gap:4px"><span class="small">${d.op}</span><input class="input sm" type="number" min="0" max="${c.type === "progress_min" ? 100 : 600}" style="width:76px" data-rf="${path}.min" data-num value="${esc(c.min)}" aria-label="Wert"><span class="small">${c.type === "progress_min" ? "%" : "Min."}</span></span>`);
  return `<div class="rcond"><select class="select sm" data-rf="${path}.type" data-re aria-label="Bedingung">${typeOpts(c.type)}</select>${f.join("")}<button class="iconbtn" data-rdel="${path}" title="Bedingung entfernen" aria-label="Bedingung entfernen">${icon("x")}</button></div>`;
}
function actionRow(a, path) {
  const t = a.type;
  const fld = (k, label, w = "") => `<label class="rfield ${w}"><span class="xs">${label}</span><input class="input sm" data-rf="${path}.${k}" value="${esc(a[k] ?? "")}"></label>`;
  const area = (k, label) => `<label class="rfield wide"><span class="xs">${label}</span><textarea class="input sm" rows="3" data-rf="${path}.${k}">${esc(a[k] || "")}</textarea></label>`;
  const task = `<label class="rfield"><span class="xs">in Aufgabe</span><select class="select sm" data-rf="${path}.task"><option value="">aktuelle Aufgabe</option>${taskOpts(a.task, false)}</select></label>`;
  const body = t === "mail" ? task + fld("from", "Absender") + fld("from_mail", "E-Mail-Adresse") + fld("subject", "Betreff", "wide") + area("body", "Text")
    : t === "event" ? task + fld("title", "Titel", "wide") + `<label class="rfield"><span class="xs">Tag</span><select class="select sm" data-rf="${path}.day">${["Mo", "Di", "Mi", "Do", "Fr"].map((x, i) => `<option value="${i}" ${+a.day === i ? "selected" : ""}>${x}</option>`).join("")}</select></label>` + fld("start", "Beginn") + fld("end", "Ende") + fld("location", "Ort") + area("text", "Beschreibung")
    : t === "ticket" ? task + fld("from", "Anfordernde Stelle") + `<label class="rfield"><span class="xs">Priorität</span><select class="select sm" data-rf="${path}.prio">${["niedrig", "mittel", "hoch"].map((x) => `<option ${a.prio === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>` + fld("subject", "Betreff", "wide") + area("body", "Beschreibung")
    : area("text", "Hinweistext");
  return `<div class="ract"><div class="row between"><select class="select sm" data-rf="${path}.type" data-re aria-label="Aktion">${Object.entries(ACTIONS).map(([k, d]) => `<option value="${k}" ${t === k ? "selected" : ""}>${d.label}</option>`).join("")}</select><button class="iconbtn" data-rdel="${path}" title="Aktion entfernen" aria-label="Aktion entfernen">${icon("trash-2")}</button></div><div class="rfields">${body}</div></div>`;
}

export function rulesEditor(rules) {
  return `<div class="notice info small mb">${icon("workflow")}<span><b>Aufgabensteuerung:</b> Regeln stellen während der Bearbeitung automatisch neue Inhalte bereit – z. B. eine E-Mail, sobald Aufgabe 2 gestartet wird, oder eine Erinnerung nach 3 Minuten ohne Aktivität. Bedingungen lassen sich mit <b>UND</b> bzw. <b>ODER</b> verknüpfen und in Gruppen kombinieren. Jede Regel löst je Teilnehmer:in einmal aus. Die Regeln gehören fest zu diesem Inhalt; Lehrkräfte und Schuladministration sehen sie nur schreibgeschützt.</span></div>
  <div class="row wrap mb"><button class="btn primary" data-radd>${icon("plus")} Neue Regel</button><select class="select" data-rtpl aria-label="Vorlage hinzufügen"><option value="">Vorlage hinzufügen …</option>${TEMPLATES.map((t, i) => `<option value="${i}">${esc(t.name)}</option>`).join("")}</select></div>
  ${rules.length ? rules.map((r, ri) => `<section class="card pad rulecard ${r.active === false ? "off" : ""}" data-rule="${ri}">
    <div class="row between wrap"><div class="row grow" style="gap:10px"><label class="toggle" title="Regel aktiv"><input type="checkbox" data-rf="${ri}.active" data-bool ${r.active !== false ? "checked" : ""} aria-label="Regel aktiv"><span></span></label><input class="input rulename" data-rf="${ri}.name" value="${esc(r.name)}" aria-label="Name der Regel"></div>
      <div class="row"><button class="iconbtn" data-rup="${ri}" ${ri ? "" : "disabled"} title="Nach oben" aria-label="Regel nach oben">${icon("chevron-up")}</button><button class="iconbtn" data-rdel="${ri}" title="Regel löschen" aria-label="Regel löschen">${icon("trash-2")}</button></div></div>
    <p class="xs muted mt-s" data-rsum="${ri}">${esc(ruleText(r, rules))}</p>
    <div class="rcols"><div><div class="row between"><h4>${icon("filter")} Wenn</h4>${(r.groups || []).length > 1 ? `<span class="row small" style="gap:6px">Gruppen verknüpfen: ${matchSel(String(ri), r.match, "der Gruppen")}</span>` : ""}</div>
      ${(r.groups || []).map((g, gi) => `${gi ? `<div class="rjoin">${r.match === "any" ? "ODER" : "UND"}</div>` : ""}<div class="rgroup"><div class="row between"><span class="xs muted">Gruppe ${gi + 1}</span><span class="row" style="gap:6px">${(g.conditions || []).length > 1 ? matchSel(`${ri}.groups.${gi}`, g.match, "der Bedingungen") : ""}${r.groups.length > 1 ? `<button class="iconbtn" data-rdel="${ri}.groups.${gi}" title="Gruppe entfernen" aria-label="Gruppe entfernen">${icon("x")}</button>` : ""}</span></div>
        ${(g.conditions || []).map((cnd, ci) => `${ci ? `<div class="rjoin s">${g.match === "any" ? "oder" : "und"}</div>` : ""}${condRow(cnd, `${ri}.groups.${gi}.conditions.${ci}`, rules, ri)}`).join("")}
        <button class="btn xs ghost mt-s" data-raddc="${ri}.${gi}">${icon("plus")} Bedingung</button></div>`).join("")}
      <button class="btn xs mt-s" data-raddg="${ri}">${icon("plus")} Bedingungsgruppe</button></div>
      <div><h4>${icon("zap")} Dann</h4>${(r.actions || []).map((a, ai) => actionRow(a, `${ri}.actions.${ai}`)).join("")}<button class="btn xs mt-s" data-radda="${ri}">${icon("plus")} Aktion</button></div></div>
  </section>`).join("") : `<div class="empty">${icon("workflow")}<h3>Noch keine Regeln</h3><p>Legen Sie eine Regel an oder übernehmen Sie eine Vorlage.</p></div>`}`;
}

const getPath = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
function setPath(obj, path, val) { const ks = path.split("."); const last = ks.pop(); const t = ks.reduce((o, k) => o[k], obj); t[last] = val; }
function delPath(obj, path) { const ks = path.split("."); const last = +ks.pop(); const t = ks.length ? ks.reduce((o, k) => o[k], obj) : obj; t.splice(last, 1); }

export function bindRulesEditor(el, rules, rr, changed) {
  el.querySelectorAll("[data-rf]").forEach((f) => {
    const path = f.dataset.rf;
    const read = () => (f.hasAttribute("data-bool") ? f.checked : f.hasAttribute("data-num") ? +f.value : f.value);
    const apply = () => {
      setPath(rules, path, read()); changed();
      if (f.hasAttribute("data-re")) {
        const parent = getPath(rules, path.split(".").slice(0, -1).join("."));
        if (path.includes(".actions.")) Object.entries(newAction(parent.type)).forEach(([k, v]) => { if (parent[k] === undefined) parent[k] = v; });
        if (path.includes(".conditions.")) { const d = CONDITIONS[parent.type]; if (d.fields.includes("task") && !parent.task && (parent.type === "task_opened" || parent.type === "minutes_in_task")) parent.task = "1"; if (d.fields.includes("subtask") && !parent.subtask && parent.type !== "submission_marked") parent.subtask = ALL_SUBTASKS[0]?.no || ""; }
        rr(); return;
      }
      const ri = +path.split(".")[0]; const sum = el.querySelector(`[data-rsum="${ri}"]`); if (sum) sum.textContent = ruleText(rules[ri], rules);
    };
    if (f.tagName === "SELECT" || f.type === "checkbox") f.onchange = apply; else f.oninput = apply;
  });
  const struct = (fn) => () => { fn(); changed(); rr(); };
  el.querySelectorAll("[data-rdel]").forEach((b) => (b.onclick = async () => {
    const path = b.dataset.rdel;
    if (!path.includes(".") && !(await confirmBox("Regel löschen", `Die Regel „${esc(rules[+path]?.name || "")}“ wird entfernt.`, "Löschen"))) return;
    delPath(rules, path); changed(); rr();
  }));
  el.querySelectorAll("[data-raddc]").forEach((b) => (b.onclick = struct(() => { const [ri, gi] = b.dataset.raddc.split(".").map(Number); rules[ri].groups[gi].conditions.push(newCondition()); })));
  el.querySelectorAll("[data-raddg]").forEach((b) => (b.onclick = struct(() => { rules[+b.dataset.raddg].groups.push({ id: "g" + Math.random().toString(36).slice(2, 8), match: "all", conditions: [newCondition("minutes_since_start")] }); })));
  el.querySelectorAll("[data-radda]").forEach((b) => (b.onclick = struct(() => rules[+b.dataset.radda].actions.push(newAction("notice")))));
  el.querySelectorAll("[data-rup]").forEach((b) => (b.onclick = struct(() => { const i = +b.dataset.rup; [rules[i - 1], rules[i]] = [rules[i], rules[i - 1]]; })));
  const add = el.querySelector("[data-radd]"); if (add) add.onclick = struct(() => rules.push(newRule()));
  const tpl = el.querySelector("[data-rtpl]"); if (tpl) tpl.onchange = () => { const t = TEMPLATES[+tpl.value]; if (!t) return; const r = t.make(); r.id = Math.random().toString(36).slice(2, 10); rules.push(r); changed(); rr(); };
}
export const validateRules = (rules) => rules.filter((r) => !r.name?.trim() || !(r.groups || []).some((g) => (g.conditions || []).length) || !(r.actions || []).length).map((r) => r.name || "Regel ohne Namen");

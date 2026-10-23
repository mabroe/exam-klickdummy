// Aufgabensteuerung im Kurs: schreibgeschützte Anzeige der Regeln aus dem Inhalt der Prüfung bzw. des Kurses (Katalog).
// Die Regeln hängen fest an der Prüfung/am Kurs und werden im Prüfungseditor (Rolle Prüfungserstellung bzw. Lehrkraft für eigene Inhalte) konfiguriert.
import { byId } from "../data.js?v=8.8";
import { icon, esc } from "../ui.js?v=8.8";
import { ACTIONS, condText } from "../rules.js?v=8.8";

const actText = (a) => {
  const where = a.task ? `Aufgabe ${esc(a.task)}` : "aktuelle Aufgabe";
  if (a.type === "mail") return `E-Mail von <b>${esc(a.from || "")}</b>: „${esc(a.subject || "")}“ <span class="xs muted">(${where})</span>`;
  if (a.type === "event") return `Termin „${esc(a.title || "")}“, ${["Mo", "Di", "Mi", "Do", "Fr"][+a.day || 0]} ${esc(a.start || "")}–${esc(a.end || "")} Uhr <span class="xs muted">(${where})</span>`;
  if (a.type === "ticket") return `Ticket „${esc(a.subject || "")}“ <span class="xs muted">(${where})</span>`;
  return `Hinweis: „${esc(a.text || "")}“`;
};
export const rulesOfCourse = (c) => byId("catalog", c?.catalog)?.rules || [];

export function tabRules(c) {
  const k = byId("catalog", c.catalog); const rules = rulesOfCourse(c);
  const join = (m) => (m === "any" ? "ODER" : "UND");
  return `<div class="notice info small mb">${icon("lock")}<span><b>Aufgabensteuerung (schreibgeschützt).</b> Die Regeln gehören fest zum Inhalt ${c.kind === "pruefung" ? "der Prüfung" : "des Kurses"}${k ? ` „${esc(k.title)}“` : ""} und werden im <b>Prüfungseditor</b> konfiguriert. Im Kurs können sie nicht geändert werden. Während der Bearbeitung stellen sie automatisch neue Inhalte bereit; jede Regel löst je ${c.kind === "pruefung" ? "Prüfling" : "Teilnehmer:in"} einmal aus. In der Vorschau lassen sich die Regeln nachvollziehen.</span></div>
  ${rules.length ? rules.map((r) => `<section class="card pad rulecard ${r.active === false ? "off" : ""}">
    <div class="row between wrap"><h3 style="margin:0">${icon("workflow")} ${esc(r.name)}</h3>${r.active === false ? `<span class="badge gray">inaktiv</span>` : `<span class="badge green">aktiv</span>`}</div>
    <div class="rcols"><div><h4>${icon("filter")} Wenn</h4>${(r.groups || []).map((g, gi) => `${gi ? `<div class="rjoin">${join(r.match)}</div>` : ""}<div class="rgroup">${(g.conditions || []).map((x, ci) => `${ci ? `<div class="rjoin s">${join(g.match).toLowerCase()}</div>` : ""}<div class="rcond small">${esc(condText(x, rules))}</div>`).join("")}</div>`).join("")}</div>
      <div><h4>${icon("zap")} Dann</h4>${(r.actions || []).map((a) => `<div class="ract small">${icon(ACTIONS[a.type]?.icon || "info")} ${actText(a)}</div>`).join("")}</div></div></section>`).join("")
    : `<div class="empty">${icon("workflow")}<h3>Keine Aufgabensteuerung</h3><p>Für diesen Inhalt sind im Prüfungseditor keine Regeln hinterlegt.</p></div>`}`;
}
export function bindRules() {}

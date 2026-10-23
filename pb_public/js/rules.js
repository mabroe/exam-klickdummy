// Aufgabensteuerung: Regeln der Prüfung bzw. des Unterrichts (Konfiguration im Kurs, Auswertung im Prüflings-Client)
// course.rules = [{ id, name, active, match: "all"|"any", groups: [{ match: "all"|"any", conditions: [{ type, task, subtask, min }] }], actions: [{ type, task, … }] }]
//  - Bedingungen innerhalb einer Gruppe werden mit UND bzw. ODER verknüpft, die Gruppen untereinander ebenfalls mit UND bzw. ODER
//  - jede Regel löst je Prüfling höchstens einmal aus (participants.fired); Aktionen stellen neue Inhalte bereit
import { endTime, parseDate } from "./ui.js?v=8.8";

export const CONDITIONS = {
  task_opened: { label: "Aufgabe geöffnet", group: "Aktion ausgeführt", fields: ["task"] },
  subtask_opened: { label: "Teilaufgabe geöffnet", group: "Aktion ausgeführt", fields: ["subtask"] },
  submission_marked: { label: "Abgabe markiert", group: "Aktion ausgeführt", fields: ["subtask"], hint: "leer = beliebige Teilaufgabe" },
  mail_sent: { label: "E-Mail gesendet", group: "Aktion ausgeführt", fields: ["task"], hint: "leer = in beliebiger Aufgabe" },
  event_created: { label: "Termin angelegt", group: "Aktion ausgeführt", fields: ["task"] },
  file_uploaded: { label: "Datei hochgeladen", group: "Aktion ausgeführt", fields: ["task"] },
  ticket_created: { label: "Ticket angelegt", group: "Aktion ausgeführt", fields: ["task"] },
  erp_order: { label: "Bestellung im ERP-System angelegt", group: "Aktion ausgeführt", fields: ["task"] },
  minutes_since_start: { label: "Minuten seit Bearbeitungsbeginn", group: "Zeitliche Faktoren", fields: ["min"], op: "≥" },
  inactive_minutes: { label: "Keine Aktivität seit Minuten", group: "Zeitliche Faktoren", fields: ["min"], op: "≥" },
  minutes_in_task: { label: "Minuten in einer Aufgabe", group: "Zeitliche Faktoren", fields: ["task", "min"], op: "≥" },
  remaining_minutes: { label: "Restzeit in Minuten", group: "Zeitliche Faktoren", fields: ["min"], op: "≤" },
  progress_min: { label: "Fortschritt in Prozent", group: "Bearbeitungsstand", fields: ["min"], op: "≥" },
  no_submission: { label: "Noch keine Abgabe zu Teilaufgabe", group: "Bearbeitungsstand", fields: ["subtask"] },
  rule_fired: { label: "Andere Regel ausgelöst", group: "Bearbeitungsstand", fields: ["rule"] },
};
export const ACTIONS = {
  mail: { label: "Neue E-Mail im Posteingang", icon: "mail" },
  event: { label: "Neuer Kalendertermin", icon: "calendar" },
  ticket: { label: "Neues Ticket", icon: "ticket" },
  notice: { label: "Hinweis einblenden", icon: "info" },
};
const rid = () => Math.random().toString(36).slice(2, 10);
export const newCondition = (type = "task_opened") => ({ id: rid(), type, task: "1", subtask: "", min: 3, rule: "" });
export const newAction = (type = "mail") => ({ id: rid(), type, task: "", from: "Bäumler, Karim", from_mail: "Karim.Baeumler@funsport-innovations.de", subject: "", body: "", title: "", day: 1, start: "09:00", end: "09:30", location: "", text: "", prio: "mittel" });
export const newRule = () => ({ id: rid(), name: "Neue Regel", active: true, match: "all", groups: [{ id: rid(), match: "all", conditions: [newCondition()] }], actions: [newAction()] });

// lesbare Beschreibung einer Bedingung
export function condText(c, rules = []) {
  const d = CONDITIONS[c.type]; if (!d) return "?";
  const parts = [];
  if (d.fields.includes("task")) parts.push(c.task ? `Aufgabe ${c.task}` : "beliebige Aufgabe");
  if (d.fields.includes("subtask")) parts.push(c.subtask ? `Teilaufgabe ${c.subtask}` : "beliebige Teilaufgabe");
  if (d.fields.includes("rule")) parts.push(`„${rules.find((r) => r.id === c.rule)?.name || "–"}“`);
  if (d.fields.includes("min")) parts.push(`${d.op} ${c.min}${c.type === "progress_min" ? " %" : " Min."}`);
  return `${d.label}${parts.length ? ": " + parts.join(", ") : ""}`;
}
export function ruleText(r, rules = []) {
  const j = (m) => (m === "any" ? " ODER " : " UND ");
  return (r.groups || []).map((g) => { const t = (g.conditions || []).map((c) => condText(c, rules)).join(j(g.match)); return (r.groups.length > 1 && g.conditions.length > 1) ? `(${t})` : t; }).join(j(r.match));
}

// ---------- Auswertung ----------
const own = (items, kind, pred = () => true) => items.filter((i) => i.kind === kind && pred(i));
const inTask = (i, task) => !task || String(i.data?.task || (i.submission || "1").split(".")[0]) === String(task);
function checkCondition(c, s) {
  const { items, progress, fired, now } = s;
  switch (c.type) {
    case "task_opened": return !!progress.opened?.[c.task];
    case "subtask_opened": return !!progress.subopened?.[c.subtask];
    case "submission_marked": return items.some((i) => i.submission && (!c.subtask || i.submission === c.subtask));
    case "mail_sent": return own(items, "mail", (i) => i.folder === "sent" && !i.data?.seeded && inTask(i, c.task)).length > 0;
    case "event_created": return own(items, "event", (i) => i.data?.editable !== false && !i.data?.byRule && inTask(i, c.task)).length > 0;
    case "file_uploaded": return own(items, "file", (i) => i.folder === "own" && !i.data?.fromMail && !i.data?.url && inTask(i, c.task)).length > 0;
    case "ticket_created": return own(items, "ticket", (i) => i.data?.own && !i.data?.byRule && inTask(i, c.task)).length > 0;
    case "erp_order": return own(items, "erp", (i) => i.data?.type === "bestellung" && i.data?.own && inTask(i, c.task)).length > 0;
    case "minutes_since_start": return s.start ? (now - s.start) / 60000 >= +c.min : false;
    case "inactive_minutes": return s.start ? (now - Math.max(s.lastActive || 0, s.start)) / 60000 >= +c.min : false;
    case "minutes_in_task": return ((progress.taskTime?.[c.task] || 0) / 60) >= +c.min;
    case "remaining_minutes": return s.end ? (s.end - now) / 60000 <= +c.min && s.end > now : false;
    case "progress_min": return s.progressPct >= +c.min;
    case "no_submission": return !items.some((i) => i.submission === c.subtask);
    case "rule_fired": return fired.includes(c.rule);
    default: return false;
  }
}
const combine = (list, match, fn) => (list.length ? (match === "any" ? list.some(fn) : list.every(fn)) : false);
export const ruleMatches = (r, s) => combine(r.groups || [], r.match, (g) => combine(g.conditions || [], g.match, (c) => checkCondition(c, s)));

// Zustand für die Auswertung aus Kontext (echter Prüfling oder Vorschau)
export function evalState(ctx, extra) {
  const p = ctx.p, room = ctx.room;
  const start = parseDate(p.started_at)?.getTime() || parseDate(room?.started_at)?.getTime() || 0;
  return { items: ctx.items(), progress: extra.progress, fired: extra.fired, now: Date.now(), start, end: endTime(room, p)?.getTime() || 0, lastActive: extra.lastActive, progressPct: extra.progressPct || 0 };
}

// Aktion ausführen: neue Inhalte in der zugeordneten Aufgabe bereitstellen
export async function runAction(a, ctx, curTask) {
  const task = String(a.task || curTask || "1");
  const now = new Date();
  const stamp = now.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "");
  if (a.type === "mail") return ctx.add("mail", "inbox", { task, from: a.from || "Bäumler, Karim", from_mail: a.from_mail || "", to: "azubi@funsport-innovations.de", subject: a.subject || "(ohne Betreff)", body: a.body || "", date: stamp, attachments: [], read: false, byRule: true });
  if (a.type === "event") return ctx.add("event", "calendar", { task, title: a.title || "Termin", day: +a.day || 0, start: a.start || "09:00", end: a.end || "09:30", location: a.location || "", desc: a.text || "", editable: false, byRule: true });
  if (a.type === "ticket") return ctx.add("ticket", "tickets", { task, no: String(4700 + Math.floor(Math.random() * 200)), subject: a.subject || "Neues Ticket", desc: a.body || "", requester: a.from || "Einkauf", prio: a.prio || "mittel", status: "offen", created: stamp, answers: [], byRule: true });
  return null; // Hinweis: Anzeige übernimmt der Aufrufer
}

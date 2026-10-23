// Bewertung: linearer Notenschlüssel, Freigabestatus der Korrektorengruppen, Gesamtnote
import { D, byId } from "./data.js?v=8.8";
import { ALL_SUBTASKS, TOTAL_POINTS, EXAM, GRADING_KEYS } from "./scenario.js?v=8.8";
import { courseOfParticipant, correctorsFor, thirdRequested, approvalStateFor } from "./access.js?v=8.8";

// Linearer Notenschlüssel (entspricht der Tabelle „Notenschlüssel 100 P“ und ihrer Anpassung an die Maximalpunktzahl):
// Note = 6 − 5 · Punkte / Maximalpunkte, auf eine Nachkommastelle zugunsten des Prüflings abgerundet (100 P → 1,0; 50 P → 3,5; 0 P → 6,0)
// Notenschlüssel des aktiven Inhalts (einmalig im Prüfungseditor gewählt): linear oder Notenstufen nach Prozentgrenzen
export const keyThresholds = (k = EXAM.gradingKey) => (k?.type && k.type !== "linear" ? (k.thresholds && k.thresholds.length === 5 ? k.thresholds : GRADING_KEYS[k.type]?.thresholds) : null);
export const gradingKeyLabel = (k = EXAM.gradingKey) => GRADING_KEYS[k?.type || "linear"]?.label || "Linearer Notenschlüssel";
export const linearGrade = (pts, max = TOTAL_POINTS) => {
  if (pts === null || pts === undefined || !(max > 0)) return null;
  const th = keyThresholds();
  if (th) { const pct = (100 * Math.max(0, Math.min(max, pts))) / max; const i = th.findIndex((t) => pct + 1e-9 >= +t); return i < 0 ? 6 : i + 1; }
  const n = 6 - (5 * Math.max(0, Math.min(max, pts))) / max;
  return Math.max(1, Math.min(6, Math.floor(n * 10 + 1e-9) / 10));
};
export const fmtNote = (n) => (n === null || n === undefined ? "–" : n.toFixed(1).replace(".", ","));
export const noteBucket = (n) => Math.min(6, Math.max(1, Math.floor(n + 0.5)));
// Schwelle für die Empfehlung einer Drittkorrektur (Notendifferenz EK/ZK)
export const DK_THRESHOLD_DEFAULT = 1.0;
export const dkThreshold = (c) => (+c?.dk_threshold > 0 ? +c.dk_threshold : DK_THRESHOLD_DEFAULT);

export const gradingOf = (pid, stage) => D.gradings.find((g) => g.participant === pid && +g.corrector === +stage);
const stP = (g, st) => { if (!g) return null; if (g.not_done?.[st]) return 0; const p = g.points?.[st]; if (!p) return null; return p.reduce((a, b) => a + (+b || 0), 0); };
// Punkte einer Korrekturstufe: { pts, complete }
export function stageResult(pid, stage) {
  const g = gradingOf(pid, stage); if (!g) return { pts: null, complete: false, any: false, note: null };
  let t = 0, any = false, complete = true;
  ALL_SUBTASKS.forEach((s) => { const x = stP(g, s.no); if (x === null) complete = false; else { t += x; any = true; } });
  return { pts: any ? t : null, complete, any, note: complete ? linearGrade(t) : null };
}
// Freigabestatus einer gemeinsamen Bewertung: alle Mitglieder der zugewiesenen Gruppe müssen freigeben
export function approvalState(p, stage) {
  const c = courseOfParticipant(p); const st = approvalStateFor(c, p, stage); const g = gradingOf(p.id, stage);
  const ok = (g?.approvals || []).filter((x) => st.group.includes(x));
  return { ...st, approved: (pid) => ok.includes(pid) };
}
export const approvalText = (a) => (a.final ? "final" : a.of ? `${a.n} von ${a.of} freigegeben` : "keine Gruppe zugewiesen");
// Gesamtnote: Endbeurteilung, falls durchgeführt; sonst Mittelwert der Noten aus Erst- und Zweitkorrektur; Unterricht: die eine Korrektur
export function overall(p) {
  const c = courseOfParticipant(p);
  const ek = stageResult(p.id, 1), zk = stageResult(p.id, 2), dk = stageResult(p.id, 3);
  const third = c?.kind === "pruefung" && thirdRequested(c, p);
  const diff = ek.note !== null && zk.note !== null ? Math.abs(ek.note - zk.note) : null;
  const recommend = c?.kind === "pruefung" && diff !== null && diff >= dkThreshold(c) - 1e-9;
  let note = null, src = "";
  if (c?.kind === "unterricht") { note = ek.note; src = "Korrektur"; }
  else if (third && dk.note !== null) { note = dk.note; src = "Endbeurteilung"; }
  else if (!third && ek.note !== null && zk.note !== null) { note = Math.floor(((ek.note + zk.note) / 2) * 10 + 1e-9) / 10; src = "Ø EK/ZK"; }
  return { c, ek, zk, dk, third, diff, recommend, note, src };
}
// Wertetabelle des Notenschlüssels (für die Anzeige)
export function keyTable(max = TOTAL_POINTS, step = 0.5) {
  const rows = []; for (let p = max; p >= -1e-9; p -= step) rows.push([Math.round(p * 2) / 2, linearGrade(p, max)]); return rows;
}

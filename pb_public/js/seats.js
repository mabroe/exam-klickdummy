// Sitzordnungen und reale Räume
//  - Unterricht: kein realer Raum. Die Lehrkraft legt Anzahl der Sitzplätze und Anordnung fest.
//  - Prüfung: realer Raum der Schule (venue); ein Raum kann je Zeitraum nur einmal belegt werden.
import { D, byId } from "./data.js?v=8.3";
import { esc, parseDate, fmtDateTime, fmtTime } from "./ui.js?v=8.3";

export const LAYOUTS = {
  reihen: { label: "Reihen", hint: "Tischreihen mit Blick zur Tafel" },
  versetzt: { label: "Reihen versetzt", hint: "Versetzte Plätze mit Abstand" },
  uform: { label: "U-Form", hint: "Plätze an drei Seiten, offen zur Tafel" },
  gruppen: { label: "Gruppentische", hint: "Tischgruppen mit 4 oder 6 Plätzen" },
};
export const layoutOf = (room) => (LAYOUTS[room?.layout] ? room.layout : "reihen");
export const isVirtual = (room) => !room?.venue && byId("courses", room?.course)?.kind === "unterricht";

// Sitzplätze mit Rasterposition. seats: [{ id, gr, gc, span }]; cols = Anzahl Rasterspalten, unit = Mindestbreite einer Rasterspalte (px)
export function seatMap(room, compact = false) {
  const L = layoutOf(room);
  const rowsCols = (+room.rows || 0) * (+room.cols || 0);
  const n = Math.max(0, Math.min(400, +room.capacity > 0 ? (rowsCols && L !== "uform" && L !== "gruppen" ? Math.min(+room.capacity, rowsCols) : +room.capacity) : rowsCols));
  const seats = [];
  if (L === "reihen" || L === "versetzt") {
    const C = Math.max(1, +room.cols || 5), R = Math.max(1, Math.ceil(n / C));
    for (let r = 1, k = 0; r <= R; r++) for (let c = 1; c <= C && k < n; c++, k++) {
      seats.push(L === "reihen" ? { id: `${r}-${c}`, gr: R - r + 1, gc: c, span: 1 } : { id: `${r}-${c}`, gr: R - r + 1, gc: 1 + (c - 1) * 6 + (r % 2 === 0 ? 3 : 0), span: 4 });
    }
    return L === "reihen" ? { seats, cols: C, unit: compact ? 64 : 160, gap: compact ? 6 : 22, layout: L } : { seats, cols: 6 * C + 1, unit: compact ? 12 : 30, gap: compact ? 3 : 6, layout: L };
  }
  if (L === "uform") {
    const s = Math.max(0, Math.floor((n - 2) / 3)), b = n - 2 * s; let k = 1;
    for (let i = s; i >= 1; i--) seats.push({ id: String(k++), gr: i, gc: 1, span: 1 });
    for (let i = 0; i < b; i++) seats.push({ id: String(k++), gr: 1, gc: (s ? 2 : 1) + i, span: 1 });
    for (let i = 1; i <= s; i++) seats.push({ id: String(k++), gr: i, gc: b + 2, span: 1 });
    return { seats, cols: s ? b + 2 : b, unit: compact ? 64 : 128, gap: compact ? 6 : 14, layout: L };
  }
  // Gruppentische: je Tisch 2 Plätze nebeneinander, Gruppengröße 4 oder 6
  const g = +room.group_size === 6 ? 6 : 4, h = g / 2, tables = Math.max(1, Math.ceil(n / g)), tp = Math.min(tables, n > 24 ? 4 : 3);
  for (let t = 0, k = 0; t < tables; t++) for (let j = 0; j < g && k < n; j++, k++) {
    const tr = Math.floor(t / tp), tc = t % tp;
    seats.push({ id: `T${t + 1}-${j + 1}`, gr: tr * (h + 1) + Math.floor(j / 2) + 1, gc: 1 + tc * 11 + (j % 2) * 4, span: 4 });
  }
  return { seats, cols: tp * 11 - 3, unit: compact ? 12 : tp > 3 ? 26 : 34, gap: compact ? 3 : 6, layout: L, group: g };
}
// Natürliche Sortierung der Platzbezeichnungen: 1, 2, … 10 bzw. 1-2 vor 1-10
export const seatCmp = (a, b) => (a ? 0 : 1) - (b ? 0 : 1) || String(a || "").localeCompare(String(b || ""), "de", { numeric: true });
export const seatIds = (room) => seatMap(room).seats.map((s) => s.id);
export const seatCount = (room) => seatMap(room).seats.length;
export const validSeat = (room, id) => !!id && seatIds(room).includes(id);
export const freeSeats = (room, taken) => seatIds(room).filter((id) => !taken.has(id));
export function seatScheme(room) {
  const L = layoutOf(room);
  if (L === "uform") return "Die Plätze sind in U-Form fortlaufend nummeriert, beginnend vorne links (Beispiel: <b>1</b>).";
  if (L === "gruppen") return "Die Nummerierung folgt dem Schema <b>Tisch-Platz</b> (Beispiel: <b>T2-3</b> bedeutet <b>Tischgruppe 2</b>, <b>Platz 3</b>).";
  return "Die Nummerierung der Sitzplätze folgt dem Schema <b>Reihe-Platz</b> (Beispiel: <b>2-1</b> bedeutet Sitzplatz in <b>Reihe 2</b>, <b>Platz 1</b>; Reihe 1 an der Tafel).";
}
export function describe(room) {
  const L = layoutOf(room), n = seatCount(room);
  const det = L === "reihen" || L === "versetzt" ? `, ${room.cols} je Reihe` : L === "gruppen" ? ` à ${+room.group_size === 6 ? 6 : 4}` : "";
  return `${n} Plätze · ${LAYOUTS[L].label}${det}`;
}
// CSS-Variablen für .seatgrid
export const gridStyle = (m) => `--cols:${m.cols};--cmin:${m.unit}px;--cgap:${m.gap}px`;
export const posStyle = (s) => `grid-row:${s.gr};grid-column:${s.gc} / span ${s.span}`;

// Vorschau (klein, ohne Namen) – im Dialog und in den Einstellungen
export function previewHtml(room) {
  const m = seatMap(room, true);
  if (!m.seats.length) return `<div class="seatprev empty small muted">Keine Sitzplätze</div>`;
  return `<div class="seatprev" aria-label="Vorschau Sitzordnung: ${esc(describe(room))}"><div class="seatprev-grid" style="--cols:${m.cols}">${m.seats.map((s) => `<span style="${posStyle(s)}" title="Platz ${esc(s.id)}">${esc(s.id)}</span>`).join("")}</div><div class="seatprev-tafel">Tafel</div></div>`;
}
// kleines Symbol je Anordnung
export function layoutIcon(L) {
  const r = (x, y) => `<rect x="${x}" y="${y}" width="7" height="5" rx="1"/>`;
  const shapes = {
    reihen: [0, 1, 2].flatMap((y) => [0, 1, 2, 3].map((x) => r(2 + x * 9, 3 + y * 8))).join(""),
    versetzt: [0, 1, 2].flatMap((y) => [0, 1, 2].map((x) => r(2 + x * 12 + (y % 2 ? 6 : 0), 3 + y * 8))).join(""),
    uform: [r(2, 3), r(2, 11), r(2, 19), r(11, 3), r(20, 3), r(29, 3), r(29, 11), r(29, 19)].join(""),
    gruppen: [[3, 4], [22, 4], [3, 17], [22, 17]].map(([x, y]) => r(x, y) + r(x + 8, y) + r(x, y + 6) + r(x + 8, y + 6)).join(""),
  };
  return `<svg viewBox="0 0 38 30" width="38" height="30" aria-hidden="true" fill="currentColor">${shapes[L]}<rect x="10" y="27" width="18" height="2" opacity=".5"/></svg>`;
}

// ---------- Reale Räume (Prüfung) ----------
export const venuesOf = (orgId) => D.venues.filter((v) => v.org === orgId).sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
const span = (r) => { const s = parseDate(r.planned_start)?.getTime() || 0; return [s, s + ((+r.duration_min || 0) + 30) * 60000]; };
// Belegung eines realen Raums im Zeitraum von plan (planned_start, duration_min) – ohne die Raumaufsicht selbst
export function venueConflict(venueId, plan, exceptRoomId = "") {
  if (!venueId) return null;
  const [a0, a1] = span(plan);
  return D.rooms.find((r) => r.id !== exceptRoomId && r.venue === venueId && r.state !== "TERMINATED" && (() => { const [b0, b1] = span(r); return a0 < b1 && b0 < a1; })()) || null;
}
export const conflictText = (r) => r ? `belegt: ${r.exam_name || r.name}, ${fmtDateTime(parseDate(r.planned_start))}–${fmtTime(new Date(span(r)[1] - 30 * 60000))} Uhr` : "";

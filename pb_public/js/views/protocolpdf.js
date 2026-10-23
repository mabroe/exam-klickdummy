// Prüfungsprotokoll als PDF (jsPDF + AutoTable, lokal eingebunden)
// Aufbau: Angaben zur Prüfung · Raumaufsichten mit Aufsichtszeiten und Unterschriftsfeldern · Sitzplan · Protokolleinträge
import { D } from "../data.js?v=9.3";
import { toast, parseDate, fmtDateTime, fmtTime, plannedEnd, STATUS } from "../ui.js?v=9.3";
import { seatMap, validSeat, describe, seatScheme } from "../seats.js?v=9.3";

let loading = null;
function loadScript(src) { return new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Skript nicht ladbar: " + src)); document.head.appendChild(s); }); }
async function lib() {
  if (window.jspdf?.jsPDF?.API?.autoTable) return window.jspdf.jsPDF;
  loading ||= loadScript("js/vendor/jspdf.umd.min.js").then(() => loadScript("js/vendor/jspdf.plugin.autotable.min.js"));
  await loading; return window.jspdf.jsPDF;
}
// Standardschrift (WinAnsi): Zeichen außerhalb ersetzen
const t = (s) => String(s ?? "").replace(/[→⇄]/g, "->").replace(/[✓]/g, "OK").replace(/[^\x00-\xFF€„“”‚‘’–—…•]/g, "");
const STATE = { CREATED: "nicht gestartet", RUNNING: "läuft", PAUSED: "pausiert", TERMINATED: "beendet" };

export async function protocolPdf(room) {
  if (room.state !== "TERMINATED") { toast("Protokoll noch nicht verfügbar", "Das Prüfungsprotokoll kann erst nach Beendigung der Prüfung heruntergeladen werden.", "info"); return; }
  let jsPDF;
  try { jsPDF = await lib(); } catch (e) { toast("PDF-Erstellung nicht möglich", e.message, "error"); return; }
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16;
  const ps = D.participants.filter((p) => p.room === room.id);
  const svs = D.supervisors.filter((s) => s.room === room.id).sort((a, b) => (a.from || "").localeCompare(b.from || "") || a.lastname.localeCompare(b.lastname));
  const rows = D.protocol.filter((x) => x.room === room.id).sort((a, b) => (a.ts > b.ts ? 1 : -1));
  const now = new Date();
  const head = (title) => { doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.text(t(title), M, y); y += 7; doc.setFont("helvetica", "normal"); doc.setFontSize(10); };
  const tableOpts = { margin: { left: M, right: M }, styles: { font: "helvetica", fontSize: 9, cellPadding: 1.8, lineColor: [200, 200, 200], lineWidth: 0.2, textColor: 30 }, headStyles: { fillColor: [235, 235, 235], textColor: 20, fontStyle: "bold" } };
  let y = 18;

  // Kopf
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text("Prüfungsprotokoll", M, y);
  doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(t(`erstellt am ${fmtDateTime(now)} Uhr`), W - M, y, { align: "right" }); y += 9;

  // 1. Angaben zur Prüfung
  head("1. Angaben zur Prüfung");
  const started = parseDate(room.started_at), planned = parseDate(room.planned_start);
  const cnt = (f) => ps.filter(f).length;
  doc.autoTable({ ...tableOpts, startY: y, theme: "grid", body: [
    ["Prüfung", t(room.exam_name || "–")], [room.venue ? "Prüfungsraum" : "Raumaufsicht", t(room.name + (room.venue ? "" : " (ohne realen Raum)"))],
    ["Geplanter Start", t(planned ? fmtDateTime(planned) + " Uhr" : "–")], ["Startfenster", t(`${room.start_earliest || "–"} bis ${room.start_latest || "–"} Uhr`)],
    ["Tatsächlicher Start", t(started ? fmtDateTime(started) + " Uhr" : "–")], ["Bearbeitungszeit", t(`${room.duration_min} Minuten${room.global_extra ? ` + ${room.global_extra} Minuten Zusatzzeit für den Raum` : ""}`)],
    ["Geplantes Bearbeitungsende", t(planned || started ? fmtTime(plannedEnd(room)) + " Uhr" : "–")], ["Pausen gesamt", t(`${Math.round((room.paused_total_s || 0) / 60)} Minuten`)],
    ["Status der Prüfung", t(STATE[room.state] || room.state)], ["Vollbildmodus erzwungen", room.lockdown ? "ja" : "nein"],
    ["Teilnehmende", t(`${ps.length} zugeordnet, davon ${cnt((p) => p.present)} anwesend · ${cnt((p) => ["abgegeben", "eingesammelt", "beendet"].includes(p.status))} abgeschlossen · ${cnt((p) => p.status === "nicht_teilnahme")} Nichtteilnahme`)],
    ["Nachteilsausgleich / Zusatzzeit", t(ps.filter((p) => p.nta || p.extra_time).map((p) => `${p.lastname}, ${p.firstname} (${[p.nta ? "NTA +" + p.nta + " Min." : "", p.extra_time ? "Zusatzzeit +" + p.extra_time + " Min." : ""].filter(Boolean).join(", ")})`).join("; ") || "keine")],
  ], columnStyles: { 0: { cellWidth: 58, fontStyle: "bold" } } });
  y = doc.lastAutoTable.finalY + 10;

  // 2. Raumaufsichten mit Unterschriftsfeldern
  head("2. Raumaufsichten");
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text(t("Mit ihrer Unterschrift bestätigen die Aufsichtspersonen die ordnungsgemäße Aufsicht in allen angegebenen Zeiträumen."), M, y); y += 5; doc.setTextColor(0);
  // Je Aufsichtsperson eine Zeile: alle Aufsichtszeiträume untereinander, eine Unterschrift für alle Zeiträume
  const per = (s) => (s.periods?.length ? s.periods : s.from ? [{ from: s.from, to: s.to }] : []);
  doc.autoTable({ ...tableOpts, startY: y, theme: "grid",
    head: [["Aufsichtsperson", "Kürzel", "Anwesend", "Aufsichtszeiträume", "Unterschrift"]],
    body: svs.length ? svs.map((s) => [t(`${s.lastname}, ${s.firstname}`), t(s.short || ""), s.present ? "ja" : "nein", t(per(s).map((p) => `${p.from || "_____"} – ${p.to || "_____"} Uhr`).join("\n") || "_____ – _____ Uhr"), ""]) : [[{ content: "Keine Aufsichtspersonen zugeordnet", colSpan: 5 }]],
    bodyStyles: { minCellHeight: 14, valign: "middle" }, columnStyles: { 3: { cellWidth: 42 }, 4: { cellWidth: 52 } } });
  y = doc.lastAutoTable.finalY + 8;
  // Unterschrift Protokollführung
  if (y > 260) { doc.addPage(); y = 20; }
  doc.setFontSize(9); doc.line(M, y + 10, M + 70, y + 10); doc.line(W - M - 70, y + 10, W - M, y + 10);
  doc.text("Ort, Datum", M, y + 14); doc.text(t("Unterschrift Prüfungsleitung / Vorsitz"), W - M - 70, y + 14);

  // 3. Sitzplan
  doc.addPage(); y = 18; head("3. Sitzplan");
  const bySeat = Object.fromEntries(ps.map((p) => [p.seat, p]));
  const map = seatMap(room); const cols = Math.max(1, map.cols), rowsN = Math.max(1, ...map.seats.map((x) => x.gr));
  const gap = 2, uw = (W - 2 * M + gap) / cols, maxH = 245 - y;
  const ch = Math.min(24, (maxH - 12 - gap * (rowsN - 1)) / rowsN);
  const sw = Math.min(...map.seats.map((x) => x.span)) * uw - gap;
  const fs = Math.max(4.5, Math.min(8, sw / 4.2, ch / 3));
  doc.setFontSize(8); doc.setTextColor(90); doc.text(t(`${describe(room)}${room.venue ? "" : " (ohne realen Raum)"}. ${seatScheme(room).replace(/<[^>]+>/g, "")}`), M, y, { maxWidth: W - 2 * M }); y += 8; doc.setTextColor(0);
  for (const st of map.seats) {
    const x = M + (st.gc - 1) * uw, yy = y + (st.gr - 1) * (ch + gap), w = st.span * uw - gap, s = st.id, p = bySeat[s];
    doc.setDrawColor(150); doc.setFillColor(p ? 255 : 244, p ? 255 : 244, p ? 255 : 244); doc.rect(x, yy, w, ch, "FD");
    doc.setFontSize(fs); doc.setFont("helvetica", "bold"); doc.text(s, x + 1.2, yy + fs * 0.42);
    if (p) {
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(t(`${p.lastname}, ${p.firstname}`), w - 2.4).slice(0, ch > 14 ? 2 : 1);
      doc.text(lines, x + 1.2, yy + fs * 0.42 + fs * 0.45);
      if (ch > 16) { doc.setTextColor(90); doc.text(t(STATUS[p.status] || p.status), x + 1.2, yy + ch - 1.5); doc.setTextColor(0); }
    }
  }
  const tafelY = y + rowsN * (ch + gap) + 2;
  doc.setFillColor(60); doc.rect(W / 2 - 30, tafelY, 60, 6, "F"); doc.setTextColor(255); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("Tafel", W / 2, tafelY + 4.2, { align: "center" }); doc.setTextColor(0); doc.setFont("helvetica", "normal");
  const unseated = ps.filter((p) => !validSeat(room, p.seat));
  if (unseated.length) { doc.setFontSize(8); doc.text(t("Ohne gültigen Sitzplatz: " + unseated.map((p) => `${p.lastname}, ${p.firstname}`).join("; ")), M, tafelY + 12, { maxWidth: W - 2 * M }); }

  // 4. Protokolleinträge
  doc.addPage(); y = 18; head("4. Protokolleinträge");
  doc.autoTable({ ...tableOpts, startY: y, theme: "striped",
    head: [["Zeitstempel", "Teilnehmende/r", "Anmeldename", "Platz", "Art", "Aktion", "Kommentar"]],
    body: rows.length ? rows.map((r) => [t(fmtDateTime(parseDate(r.ts))), t(r.participant), t(r.username), t(r.seat), t({ vorkommnis: "Vorkommnis", aktion: "Aktion", system: "System" }[r.kind] || r.kind || ""), t(r.action), t(r.comment)]) : [[{ content: "Keine Einträge", colSpan: 7 }]],
    styles: { ...tableOpts.styles, fontSize: 8 }, columnStyles: { 0: { cellWidth: 27 }, 3: { cellWidth: 11 }, 4: { cellWidth: 16 }, 5: { cellWidth: 44 } },
    didParseCell: (d) => { if (d.section === "body" && rows[d.row.index]?.kind === "vorkommnis") d.cell.styles.textColor = [160, 20, 25]; } });

  // Seitenzahlen
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text(t(`${room.exam_name || ""} · ${room.name} · Prüfungsprotokoll`), M, 290); doc.text(`Seite ${i} von ${n}`, W - M, 290, { align: "right" }); doc.setTextColor(0); }
  const name = `Pruefungsprotokoll_${room.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}_${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(name);
  toast("Protokoll als PDF heruntergeladen", name, "info");
  return name;
}

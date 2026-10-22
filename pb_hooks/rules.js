// Fachregeln für Server-Hooks (werden per require eingebunden, da Hook-Handler keinen Zugriff auf äußere Funktionen haben)
module.exports = {
  // Ein realer Raum (venue) kann je Zeitraum (Bearbeitungszeit + 30 Minuten) nur einmal belegt werden
  checkVenue(e) {
    const r = e.record; const v = r.getString("venue");
    if (!v) return;
    const span = (x) => { const s = new Date(String(x.getString("planned_start")).replace(" ", "T")).getTime(); return [s, s + (x.getInt("duration_min") + 30) * 60000]; };
    const a = span(r);
    const list = e.app.findRecordsByFilter("rooms", "venue = {:v} && state != 'TERMINATED' && id != {:id}", "", 0, 0, { v: v, id: r.id || "" });
    for (const o of list) { const b = span(o); if (a[0] < b[1] && b[0] < a[1]) throw new BadRequestError("Der Raum ist in diesem Zeitraum bereits belegt (" + (o.getString("exam_name") || o.getString("name")) + ")."); }
  },
};

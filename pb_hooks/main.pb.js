/// <reference path="../pb_data/types.d.ts" />
// Exam Klickdummy – Server-Hooks

// Demodaten bei leerer Datenbank laden (wird vom Frontend beim Start aufgerufen)
routerAdd("POST", "/api/demo/ensure", (e) => {
  const s = require(`${__hooks}/seed.js`);
  let seeded = false;
  let reseeded = false;
  if (s.isEmpty(e.app)) {
    console.log("[klickdummy] Leere Datenbank – lade Demodaten …");
    e.app.runInTransaction((tx) => s.seed(tx));
    seeded = true;
  } else if (s.dataVersion(e.app) < s.SEED_VERSION) {
    // Datenbank aus einer älteren Version: Demodaten automatisch neu aufbauen
    console.log("[klickdummy] Demodaten veraltet – werden auf Stand " + s.SEED_VERSION + " gebracht …");
    e.app.runInTransaction((tx) => s.reset(tx));
    reseeded = true;
  }
  return e.json(200, { ok: true, seeded, reseeded });
});

// Demo vollständig zurücksetzen
routerAdd("POST", "/api/demo/reset", (e) => {
  const s = require(`${__hooks}/seed.js`);
  e.app.runInTransaction((tx) => s.reset(tx));
  return e.json(200, { ok: true });
});

// Simulation: alle übrigen Teilnehmenden eines Raums melden sich an
// body: { room: "<id>", except: "<participantId>" }
routerAdd("POST", "/api/demo/simulate-login", (e) => {
  const body = e.requestInfo().body || {};
  const list = e.app.findRecordsByFilter("participants", "room = {:room} && status = 'nicht_eingeloggt'", "seat", 0, 0, { room: body.room || "" });
  let n = 0;
  const now = new Date().toISOString().replace("T", " ");
  list.forEach((p, i) => {
    if (!p || p.id === body.except) return;
    if (i % 7 === 3) return; // eine Person bleibt bewusst „nicht eingeloggt“
    const confirmed = i % 3 !== 1;
    p.set("status", confirmed ? "wartend_bestaetigt" : "wartend");
    p.set("cheat_ack", confirmed);
    p.set("health", confirmed ? "ok" : "");
    p.set("present", true);
    p.set("simulated", true);
    p.set("last_seen", now);
    e.app.save(p);
    n++;
  });
  return e.json(200, { ok: true, count: n });
});

// Keine Browser-Caches für die Oberfläche: Änderungen sind nach dem Neuladen sofort aktiv
routerUse((e) => {
  const path = e.request.url.path || "";
  if (!path.startsWith("/api/")) e.response.header().set("Cache-Control", "no-cache, no-store, must-revalidate");
  return e.next();
});

// Version der Server-Seite (muss zu pb_public/js/app.js VERSION passen)
routerAdd("GET", "/api/demo/version", (e) => e.json(200, { version: "8.7" }));

// Nachteilsausgleich darf nur vor dem Prüfungsstart (Raumstatus CREATED) geändert werden – auch serverseitig abgesichert
onRecordUpdateRequest((e) => {
  const orig = e.record.original();
  if (orig && orig.getInt("nta") !== e.record.getInt("nta")) {
    let state = "CREATED";
    try { state = e.app.findRecordById("rooms", e.record.getString("room")).getString("state"); } catch (_) {}
    if (state && state !== "CREATED") throw new BadRequestError("Ein Nachteilsausgleich kann nur vor dem Prüfungsstart gewährt oder geändert werden.");
  }
  e.next();
}, "participants");

// Reale Räume (nur Prüfung) dürfen je Zeitraum nur einmal belegt werden – auch serverseitig abgesichert (siehe rules.js)
onRecordCreateRequest((e) => { require(`${__hooks}/rules.js`).checkVenue(e); e.next(); }, "rooms");
onRecordUpdateRequest((e) => { require(`${__hooks}/rules.js`).checkVenue(e); e.next(); }, "rooms");

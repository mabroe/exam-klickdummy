// Exam Klickdummy – Demodaten in PocketBase laden
// Die Datensätze selbst stehen in pb_public/js/seed-data.js (gemeinsame Quelle für Server- und Browser-Modus).
const S = require(`${__hooks}/../pb_public/js/seed-data.js`);

function wipe(app) {
  for (const n of S.COLLECTIONS) {
    try { app.truncateCollection(app.findCollectionByNameOrId(n)); } catch (e) { console.log("truncate " + n + ": " + e); }
  }
}

function seed(app) {
  const data = S.build(Date.now());
  for (const name of S.COLLECTIONS) {
    const col = app.findCollectionByNameOrId(name);
    for (const rec of data[name]) {
      const r = new Record(col);
      for (const k in rec) r.set(k, rec[k]);
      app.save(r);
    }
  }
}

module.exports = {
  seed,
  reset: (app) => { wipe(app); seed(app); },
  isEmpty: (app) => {
    try { return app.countRecords("rooms") === 0; } catch (e) { return true; }
  },
  SEED_VERSION: S.SEED_VERSION,
  dataVersion: (app) => {
    try { const r = app.findFirstRecordByFilter("settings", "key = 'demo'"); const o = JSON.parse(r.getString("value") || "{}"); return +(o && o.seed_version) || 0; } catch (e) { return 0; }
  },
};

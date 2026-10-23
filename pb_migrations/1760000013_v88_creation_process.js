/// <reference path="../pb_data/types.d.ts" />
// v8.8: Erstellungsprozess (Instanz OPE) – Status, Rahmendaten, Personen im Erstellungsprozess, Verlauf, Anmerkungen, Abschlüsse
migrate((app) => {
  const c = app.findCollectionByNameOrId("catalog");
  c.fields.add(new TextField({ name: "status" }));
  ["meta", "team", "history", "feedback", "reviews"].forEach((n) => c.fields.add(new JSONField({ name: n, maxSize: 2000000 })));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("catalog");
  ["status", "meta", "team", "history", "feedback", "reviews"].forEach((n) => c.fields.removeByName(n));
  app.save(c);
});

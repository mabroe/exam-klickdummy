/// <reference path="../pb_data/types.d.ts" />
// v8: reale Räume (nur für Prüfungen, gegen Doppelbelegung) und frei gestaltbare Sitzordnungen im Unterricht
migrate((app) => {
  const open = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };
  app.save(new Collection({ type: "base", name: "venues", ...open, fields: [
    { name: "org", type: "text" }, { name: "name", type: "text" }, { name: "building", type: "text" },
    { name: "rows", type: "number" }, { name: "cols", type: "number" }, { name: "capacity", type: "number" }, { name: "layout", type: "text" },
    { name: "created", type: "autodate", onCreate: true, onUpdate: false }, { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ] }));
  const r = app.findCollectionByNameOrId("rooms");
  r.fields.add(new TextField({ name: "layout" }));     // reihen | versetzt | uform | gruppen
  r.fields.add(new TextField({ name: "venue" }));      // realer Raum (nur Prüfung)
  r.fields.add(new NumberField({ name: "group_size" }));
  app.save(r);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("venues")); } catch (_) {}
  const r = app.findCollectionByNameOrId("rooms"); ["layout", "venue", "group_size"].forEach((n) => r.fields.removeByName(n)); app.save(r);
});

/// <reference path="../pb_data/types.d.ts" />
// v5: echte Datei-Uploads (Prüfling: items.file, Korrektor: kfiles)
migrate((app) => {
  const items = app.findCollectionByNameOrId("items");
  items.fields.add(new FileField({ name: "file", maxSelect: 1, maxSize: 20 * 1024 * 1024 }));
  app.save(items);
  const open = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };
  const k = new Collection({ type: "base", name: "kfiles", ...open, fields: [
    { name: "participant", type: "text" }, { name: "subtask", type: "text" }, { name: "corrector", type: "number" },
    { name: "name", type: "text" }, { name: "file", type: "file", maxSelect: 1, maxSize: 20 * 1024 * 1024 },
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
  ] });
  app.save(k);
}, (app) => {
  try { app.delete(app.findCollectionByNameOrId("kfiles")); } catch (_) {}
  const items = app.findCollectionByNameOrId("items"); items.fields.removeByName("file"); app.save(items);
});

/// <reference path="../pb_data/types.d.ts" />
// v10.0: Kammern als Organisation (Art, Bezirk), externe Prüflinge (Prüflingsnummer, Nachteilsausgleich),
// Zuordnung externer Prüflinge je Prüfung (courses.ext), Protokollfreigabe je Raumaufsicht, Benachrichtigungen
migrate((app) => {
  const o = app.findCollectionByNameOrId("orgs");
  o.fields.add(new TextField({ name: "type" })); o.fields.add(new TextField({ name: "bezirk" })); app.save(o);
  const p = app.findCollectionByNameOrId("persons");
  p.fields.add(new TextField({ name: "pnr" })); p.fields.add(new NumberField({ name: "nta" })); app.save(p);
  const c = app.findCollectionByNameOrId("courses");
  c.fields.add(new JSONField({ name: "ext", maxSize: 2000000 })); app.save(c);
  const r = app.findCollectionByNameOrId("rooms");
  r.fields.add(new BoolField({ name: "prot_released" })); r.fields.add(new DateField({ name: "prot_released_at" })); app.save(r);
  const n = new Collection({ type: "base", name: "notices", listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "",
    fields: [{ name: "org", type: "text" }, { name: "role", type: "text" }, { name: "course", type: "text" }, { name: "title", type: "text" }, { name: "body", type: "text" },
      { name: "link", type: "text" }, { name: "kind", type: "text" }, { name: "read", type: "bool" }, { name: "by", type: "text" },
      { name: "created", type: "autodate", onCreate: true, onUpdate: false }, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }] });
  app.save(n);
}, (app) => {
  const o = app.findCollectionByNameOrId("orgs"); o.fields.removeByName("type"); o.fields.removeByName("bezirk"); app.save(o);
  const p = app.findCollectionByNameOrId("persons"); p.fields.removeByName("pnr"); p.fields.removeByName("nta"); app.save(p);
  const c = app.findCollectionByNameOrId("courses"); c.fields.removeByName("ext"); app.save(c);
  const r = app.findCollectionByNameOrId("rooms"); r.fields.removeByName("prot_released"); r.fields.removeByName("prot_released_at"); app.save(r);
  try { app.delete(app.findCollectionByNameOrId("notices")); } catch (_) {}
});

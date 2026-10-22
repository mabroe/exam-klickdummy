/// <reference path="../pb_data/types.d.ts" />
// v8.5: Lehrkräfte in mehreren Organisationen, Distanzunterricht, Aufgabensteuerung, Einsicht je Organisation bzw. Kurs
migrate((app) => {
  const add = (col, fields) => { const c = app.findCollectionByNameOrId(col); fields.forEach((f) => c.fields.add(f)); app.save(c); };
  add("persons", [new JSONField({ name: "orgs", maxSize: 20000 })]);
  add("venues", [new NumberField({ name: "group_size" })]);
  add("rooms", [new TextField({ name: "mode" }), new DateField({ name: "window_from" }), new DateField({ name: "window_to" }), new BoolField({ name: "repeatable" }), new BoolField({ name: "show_horizon" }), new BoolField({ name: "released" })]);
  add("participants", [new NumberField({ name: "attempt" }), new JSONField({ name: "progress", maxSize: 200000 }), new JSONField({ name: "fired", maxSize: 200000 })]);
  add("courses", [new JSONField({ name: "rules", maxSize: 2000000 }), new JSONField({ name: "einsicht", maxSize: 20000 })]);
}, (app) => {
  const rm = (col, names) => { const c = app.findCollectionByNameOrId(col); names.forEach((n) => c.fields.removeByName(n)); app.save(c); };
  rm("persons", ["orgs"]); rm("venues", ["group_size"]); rm("rooms", ["mode", "window_from", "window_to", "repeatable", "show_horizon", "released"]); rm("participants", ["attempt", "progress", "fired"]); rm("courses", ["rules", "einsicht"]);
});

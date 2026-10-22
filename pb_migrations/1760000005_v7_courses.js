/// <reference path="../pb_data/types.d.ts" />
// v7: Organisationen, Personen (Konten), Gruppen (Klassen/Kurse), Kurse mit Mitgliedern (Unterricht/Prüfung)
// Raumaufsichten, Aufsichtspersonen und Teilnahmen werden mit Kurs, Organisation und Person verknüpft.
migrate((app) => {
  const open = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };
  const text = (name) => ({ name, type: "text" });
  const json = (name) => ({ name, type: "json", maxSize: 2000000 });
  const stamps = [{ name: "created", type: "autodate", onCreate: true, onUpdate: false }, { name: "updated", type: "autodate", onCreate: true, onUpdate: true }];
  const defs = [
    ["orgs", [text("name"), text("short"), text("city")]],
    // kind: lehrkraft | schueler | schuladmin
    ["persons", [text("lastname"), text("firstname"), text("username"), text("org"), text("kind"), text("short"), text("email")]],
    // kind: klasse | kurs | eigen; source: schulverwaltung | kurs; members: [personId]
    ["groups", [text("name"), text("org"), text("kind"), text("source"), text("course"), json("members")]],
    // kind: unterricht | pruefung; members: [{ person, role, stage? }]; groups: [{ group, role }]; orgs: [orgId]
    ["courses", [text("title"), text("kind"), text("catalog"), text("org"), json("orgs"), text("owner"), json("members"), json("groups"), text("status"), text("exam_code"), text("description")]],
  ];
  for (const [name, fields] of defs) app.save(new Collection({ type: "base", name, ...open, fields: [...fields, ...stamps] }));
  const addText = (col, names) => { const c = app.findCollectionByNameOrId(col); names.forEach((n) => c.fields.add(new TextField({ name: n }))); app.save(c); };
  addText("rooms", ["course", "org", "owner"]);
  addText("supervisors", ["person"]);
  addText("participants", ["person"]);
}, (app) => {
  for (const n of ["courses", "groups", "persons", "orgs"]) { try { app.delete(app.findCollectionByNameOrId(n)); } catch (_) {} }
  const rm = (col, names) => { const c = app.findCollectionByNameOrId(col); names.forEach((n) => c.fields.removeByName(n)); app.save(c); };
  rm("rooms", ["course", "org", "owner"]); rm("supervisors", ["person"]); rm("participants", ["person"]);
});

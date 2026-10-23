/// <reference path="../pb_data/types.d.ts" />
// v9.0: Ausbildungsberufe je Schule, Katalogfreigabe (global bzw. eigene Organisation), Fachbereich der Kommission
migrate((app) => {
  const o = app.findCollectionByNameOrId("orgs"); o.fields.add(new JSONField({ name: "berufe", maxSize: 20000 })); app.save(o);
  const c = app.findCollectionByNameOrId("catalog"); c.fields.add(new JSONField({ name: "release", maxSize: 20000 })); app.save(c);
  const g = app.findCollectionByNameOrId("groups"); g.fields.add(new TextField({ name: "fachbereich" })); app.save(g);
}, (app) => {
  const o = app.findCollectionByNameOrId("orgs"); o.fields.removeByName("berufe"); app.save(o);
  const c = app.findCollectionByNameOrId("catalog"); c.fields.removeByName("release"); app.save(c);
  const g = app.findCollectionByNameOrId("groups"); g.fields.removeByName("fachbereich"); app.save(g);
});

/// <reference path="../pb_data/types.d.ts" />
// v8.9: verschlüsselte Ablage nach finaler Freigabe (sealed/vault), Kommissionen als Gruppen mit Vorsitz
migrate((app) => {
  const c = app.findCollectionByNameOrId("catalog");
  c.fields.add(new JSONField({ name: "sealed", maxSize: 30000000 })); c.fields.add(new JSONField({ name: "vault", maxSize: 20000 }));
  app.save(c);
  const g = app.findCollectionByNameOrId("groups"); g.fields.add(new TextField({ name: "chair" })); app.save(g);
}, (app) => {
  const c = app.findCollectionByNameOrId("catalog"); c.fields.removeByName("sealed"); c.fields.removeByName("vault"); app.save(c);
  const g = app.findCollectionByNameOrId("groups"); g.fields.removeByName("chair"); app.save(g);
});

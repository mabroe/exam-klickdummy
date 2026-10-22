/// <reference path="../pb_data/types.d.ts" />
// v8.3: Korrektorengruppen je Korrekturstufe, Gruppenfreigabe, Drittkorrektur auf Anforderung der Schuladministration
migrate((app) => {
  const c = app.findCollectionByNameOrId("courses");
  c.fields.add(new JSONField({ name: "corrections", maxSize: 2000000 }));
  c.fields.add(new JSONField({ name: "third", maxSize: 2000000 }));
  c.fields.add(new TextField({ name: "korr_end" }));
  c.fields.add(new NumberField({ name: "dk_threshold" }));
  app.save(c);
  const g = app.findCollectionByNameOrId("gradings");
  g.fields.add(new JSONField({ name: "approvals", maxSize: 200000 }));
  app.save(g);
}, (app) => {
  const c = app.findCollectionByNameOrId("courses"); ["corrections", "third", "korr_end", "dk_threshold"].forEach((n) => c.fields.removeByName(n)); app.save(c);
  const g = app.findCollectionByNameOrId("gradings"); g.fields.removeByName("approvals"); app.save(g);
});

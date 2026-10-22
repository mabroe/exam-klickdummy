/// <reference path="../pb_data/types.d.ts" />
// v6.3: mehrere Aufsichtszeiträume je Aufsichtsperson (z. B. Aufsicht mit Unterbrechung)
migrate((app) => {
  const c = app.findCollectionByNameOrId("supervisors");
  c.fields.add(new JSONField({ name: "periods", maxSize: 20000 }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("supervisors"); c.fields.removeByName("periods"); app.save(c);
});

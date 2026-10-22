/// <reference path="../pb_data/types.d.ts" />
// v8.6: Aufgabensteuerung gehört zum Prüfungs-/Kursinhalt (Katalog) – Konfiguration im Prüfungseditor
migrate((app) => {
  const c = app.findCollectionByNameOrId("catalog"); c.fields.add(new JSONField({ name: "rules", maxSize: 2000000 })); app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("catalog"); c.fields.removeByName("rules"); app.save(c);
});

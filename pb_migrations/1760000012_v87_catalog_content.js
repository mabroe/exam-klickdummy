/// <reference path="../pb_data/types.d.ts" />
// v8.7: Prüfungs-/Kursinhalt aus dem Editor (Aufgaben, Teilaufgaben, Fragetypen, Materialien, Bewertung)
migrate((app) => {
  const c = app.findCollectionByNameOrId("catalog"); c.fields.add(new JSONField({ name: "content", maxSize: 20000000 })); c.fields.add(new TextField({ name: "editor_by" })); app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("catalog"); c.fields.removeByName("content"); c.fields.removeByName("editor_by"); app.save(c);
});

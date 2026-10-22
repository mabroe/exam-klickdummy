/// <reference path="../pb_data/types.d.ts" />
// v8.4: Herkunft der Dateien im Korrekturscreen (Korrektor-Upload oder automatisch erzeugte PDF-Korrekturfassung)
migrate((app) => {
  const k = app.findCollectionByNameOrId("kfiles");
  k.fields.add(new TextField({ name: "kind" }));    // "" bzw. korrektor | konvertiert
  k.fields.add(new TextField({ name: "source" }));  // Quelle der Korrekturfassung (Element- bzw. Datei-ID)
  k.fields.add(new TextField({ name: "orig" }));    // Name der Originaldatei
  app.save(k);
}, (app) => {
  const k = app.findCollectionByNameOrId("kfiles"); ["kind", "source", "orig"].forEach((n) => k.fields.removeByName(n)); app.save(k);
});

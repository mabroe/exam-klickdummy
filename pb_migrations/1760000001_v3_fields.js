/// <reference path="../pb_data/types.d.ts" />
// v3: Prüfungssicherheit, Verbindungstests, Begründungen in der Bewertung
migrate((app) => {
  const p = app.findCollectionByNameOrId("participants");
  p.fields.add(new NumberField({ name: "violations" }));      // Anzahl Verlassen der Prüfungsumgebung
  p.fields.add(new DateField({ name: "offline_until" }));     // simulierter Verbindungsabbruch bis
  p.fields.add(new BoolField({ name: "relogin" }));           // Wiederanmeldung nach Abbruch erforderlich
  app.save(p);
  const r = app.findCollectionByNameOrId("rooms");
  r.fields.add(new BoolField({ name: "lockdown" }));          // Vollbild erzwingen / Verlassen protokollieren
  app.save(r);
  const g = app.findCollectionByNameOrId("gradings");
  g.fields.add(new JSONField({ name: "notes", maxSize: 2000000 })); // Begründungen je Teilaufgabe
  app.save(g);
}, (app) => {
  const drop = (c, names) => { const col = app.findCollectionByNameOrId(c); names.forEach((n) => col.fields.removeByName(n)); app.save(col); };
  drop("participants", ["violations", "offline_until", "relogin"]);
  drop("rooms", ["lockdown"]);
  drop("gradings", ["notes"]);
});

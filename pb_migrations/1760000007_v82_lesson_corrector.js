/// <reference path="../pb_data/types.d.ts" />
// v8.2: Unterricht – eine korrigierende Lehrkraft je Kurs (weitergebbar an andere Lehrkräfte des Kurses)
migrate((app) => {
  const c = app.findCollectionByNameOrId("courses");
  c.fields.add(new TextField({ name: "corrector" }));
  app.save(c);
}, (app) => {
  const c = app.findCollectionByNameOrId("courses"); c.fields.removeByName("corrector"); app.save(c);
});

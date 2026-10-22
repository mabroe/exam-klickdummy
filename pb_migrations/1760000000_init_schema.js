/// <reference path="../pb_data/types.d.ts" />
// Exam Klickdummy – Datenmodell
// Alle Collections sind bewusst öffentlich (leere Regeln), da der Klickdummy
// nur lokal zu Demonstrationszwecken läuft. NICHT für echte Daten verwenden.

migrate((app) => {
  const open = { listRule: "", viewRule: "", createRule: "", updateRule: "", deleteRule: "" };
  const text = (name) => ({ name, type: "text" });
  const num = (name) => ({ name, type: "number" });
  const bool = (name) => ({ name, type: "bool" });
  const json = (name) => ({ name, type: "json", maxSize: 2000000 });
  const date = (name) => ({ name, type: "date" });
  const stamps = [
    { name: "created", type: "autodate", onCreate: true, onUpdate: false },
    { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
  ];

  const defs = [
    // Raumaufsichten (Proctoring) inkl. Prüfungszuordnung
    ["rooms", [
      text("name"), text("exam_name"), text("exam_code"),
      text("state"),            // CREATED | RUNNING | PAUSED | TERMINATED
      date("planned_start"), text("start_earliest"), text("start_latest"),
      num("duration_min"), num("global_extra"), num("capacity"), num("rows"), num("cols"),
      date("started_at"), date("paused_at"), num("paused_total_s"), text("created_label"),
    ]],
    // Prüfungsteilnehmende
    ["participants", [
      text("lastname"), text("firstname"), text("username"), text("group_name"), text("org"),
      text("room"), text("seat"), bool("present"),
      text("status"),           // siehe js/ui.js STATUS
      num("extra_time"), num("nta"), text("comment"),
      text("health"),           // '' | ok | declined
      bool("cheat_ack"), date("last_seen"), date("started_at"), date("finished_at"),
      json("bookmarks"), bool("simulated"),
    ]],
    // Aufsichtspersonen
    ["supervisors", [
      text("lastname"), text("firstname"), text("short"), text("username"), text("room"),
      bool("present"), text("from"), text("to"),
    ]],
    // Prüfungsprotokoll
    ["protocol", [
      text("room"), date("ts"), text("participant"), text("username"), text("seat"),
      text("action"), text("comment"), text("kind"),
    ]],
    // Arbeitsobjekte im Prüfungsmodus: Dateien, Mails, Termine, Notizen
    ["items", [
      text("participant"),      // '' = global bereitgestellt (Vorlage)
      text("kind"),             // file | mail | event | note
      text("folder"),           // provided | own | inbox | draft | sent | deleted | calendar | notes
      json("data"),
      text("submission"),       // Teilaufgabe, z. B. "1.1" (leer = keine Abgabe)
    ]],
    // Bewertungen je Teilnehmende/r und Korrektor/in
    ["gradings", [
      text("participant"), num("corrector"), json("points"), json("not_done"), json("marks"),
      bool("released"),
    ]],
    // Kommentare im Korrekturmodus
    ["comments", [text("participant"), text("subtask"), text("author"), text("body")]],
    // Aufgabensteuerung „Meine Aufgaben“
    ["tasks", [
      text("procedure"), text("procedure_icon"), text("title"), text("icon"), text("due"),
      bool("done"), bool("is_new"), text("link"), text("role"), num("task_no"), bool("closed"),
    ]],
    // Katalog / Meine Prüfungen
    ["catalog", [
      text("title"), text("beruf"), text("fach"), text("jahr"), text("kind"), text("description"),
      text("duration"), text("creator"), json("tags"), json("contents"), bool("mine"), text("copied_from"),
      num("image"),
    ]],
    // Einstellungen (Favoriten Korrekturzeichen, Freigabestatus …)
    ["settings", [text("key"), json("value")]],
  ];

  for (const [name, fields] of defs) {
    const c = new Collection({ type: "base", name, ...open, fields: [...fields, ...stamps] });
    app.save(c);
  }
}, (app) => {
  for (const name of ["settings", "catalog", "tasks", "comments", "gradings", "items", "protocol", "supervisors", "participants", "rooms"]) {
    try { app.delete(app.findCollectionByNameOrId(name)); } catch (_) {}
  }
});

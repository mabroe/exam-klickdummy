// Konfiguration des Klickdummys
export default {
  // Datenhaltung:
  //  "auto"      – PocketBase verwenden, wenn die Seite von PocketBase ausgeliefert wird (lokaler Start), sonst Browser-Datenbank
  //  "local"     – immer Browser-Datenbank (IndexedDB, Live-Kopplung zwischen Tabs desselben Browsers) – z. B. GitHub Pages
  //  "https://…" – Oberfläche auf GitHub Pages, Daten auf einem eigenen PocketBase-Server (Live-Kopplung über Geräte hinweg)
  backend: "auto",
  // SHA-256 des Zugangspassworts der Startseite (nur eine Zugangshürde für den Klickdummy, kein Schutz vertraulicher Daten)
  passwordHash: "00109b923b64588d3f1de911b6d6302e1b675049418add2d6646e59c16d492c8",
  // Wie lange die Passworteingabe im Browser gültig bleibt (Stunden)
  passwordHours: 12,
};

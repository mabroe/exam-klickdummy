// Einstieg: zuerst Zugangsseite (Passwort), dann der Klickdummy
import { gate } from "./gate.js?v=8.8";
await gate(document.getElementById("app"));
await import("./app.js?v=8.8");

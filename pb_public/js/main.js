// Einstieg: zuerst Zugangsseite (Passwort), dann der Klickdummy
import { gate } from "./gate.js?v=9.0";
await gate(document.getElementById("app"));
await import("./app.js?v=9.0");

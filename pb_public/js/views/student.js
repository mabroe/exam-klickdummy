// Schüler:in: eigene Teilnahmen (Unterricht und Prüfung) – Teilnahme wählen (z. B. Präsenz- und Distanzeinheit gleichzeitig),
// freigegebene Korrekturen und Ergebnisse des Unterrichts einsehen
import { D, byId } from "../data.js?v=9.1";
import { icon, esc, store, brand, fmtDateTime, parseDate, isFinished, isDistance, windowState } from "../ui.js?v=9.1";
import { navigate, setRole } from "../app.js?v=9.1";
import { courseOf, einsichtFor } from "../access.js?v=9.1";

const STATUS = { nicht_eingeloggt: "noch nicht begonnen", wartend: "im Wartebereich", wartend_bestaetigt: "im Wartebereich", laeuft: "in Bearbeitung", pausiert: "pausiert", gesperrt: "gesperrt", zeit_beendet: "Bearbeitungszeit beendet", abgegeben: "abgegeben", eingesammelt: "eingesammelt", beendet: "beendet", nicht_teilnahme: "nicht teilgenommen" };
export const studentPerson = () => byId("persons", store.get("portal") || store.get("person"));
export function participations(pe) {
  return D.participants.filter((x) => x.person === pe?.id).map((x) => ({ x, room: byId("rooms", x.room), c: courseOf(byId("rooms", x.room)) })).filter((e) => e.room && e.c)
    .sort((a, b) => String(b.room.planned_start || "").localeCompare(String(a.room.planned_start || "")));
}
function stateOf(e) {
  const { x, room, c } = e; const dist = isDistance(room); const fin = isFinished(x.status);
  if (fin) {
    if (einsichtFor(x)) return { kind: "result", text: "Korrektur freigegeben" };
    return { kind: "done", text: c.kind === "pruefung" ? "abgeschlossen – Einsicht nur in Präsenz bei der Schule" : "abgeschlossen – Korrektur noch nicht freigegeben" };
  }
  if (dist) {
    const w = windowState(room);
    if (w === "before") return { kind: "later", text: `Distanz · ab ${fmtDateTime(parseDate(room.window_from))} Uhr` };
    if (w === "after") return { kind: "done", text: "Zeitraum abgelaufen" };
    return { kind: "join", text: `Distanz · bis ${fmtDateTime(parseDate(room.window_to))} Uhr` };
  }
  if (room.state === "TERMINATED") return { kind: "done", text: "beendet" };
  return { kind: "join", text: `Präsenz · ${esc(room.name)} · Beginn ${fmtDateTime(parseDate(room.planned_start))} Uhr` };
}
export function portal() {
  const pe = studentPerson();
  if (!pe) return { redirect: "#/" };
  return {
    title: "Meine Teilnahmen",
    render() {
      const list = participations(pe).map((e) => ({ ...e, s: stateOf(e) }));
      const now = list.filter((e) => e.s.kind === "join"); const res = list.filter((e) => e.s.kind === "result"); const rest = list.filter((e) => !["join", "result"].includes(e.s.kind));
      const row = (e, btn) => `<tr><td><b>${esc(e.c.title)}</b><div class="xs muted">${esc(e.room.name)}</div></td><td><span class="badge ${e.c.kind === "pruefung" ? "purple" : "cyan"}">${e.c.kind === "pruefung" ? "Prüfung" : "Unterricht"}</span> <span class="badge ${isDistance(e.room) ? "orange" : "gray"}">${isDistance(e.room) ? "Distanz" : "Präsenz"}</span></td><td class="small">${e.s.text}</td><td class="small">${esc(STATUS[e.x.status] || e.x.status)}${e.x.attempt > 1 ? ` · Durchlauf ${e.x.attempt}` : ""}</td><td>${btn}</td></tr>`;
      const tbl = (rows, empty) => rows.length ? `<div class="tablewrap"><table class="tbl"><thead><tr><th>Kurs</th><th>Art</th><th>Termin</th><th>Status</th><th></th></tr></thead><tbody>${rows.join("")}</tbody></table></div>` : `<p class="small muted">${empty}</p>`;
      return `<header class="topbar">${brand()}<div class="row" style="gap:12px"><span class="bold">${esc(pe.firstname)} ${esc(pe.lastname)}</span><a class="btn ghost sm" href="#/">Rolle wechseln</a></div></header>
      <div class="tn-page" style="max-width:1100px;margin:0 auto">
        <h1>Meine Teilnahmen</h1><p class="lead">Wählen Sie, woran Sie jetzt teilnehmen – z. B. am Präsenzunterricht im Raum oder an einer Distanzeinheit von zu Hause. Freigegebene Korrekturen Ihres Unterrichts sehen Sie unter „Ergebnisse“.</p>
        <h2 class="mt">${icon("log-in")} Teilnehmen</h2>${tbl(now.map((e) => row(e, `<button class="btn primary sm" data-join="${e.x.id}">${icon("log-in")} ${["laeuft", "pausiert", "wartend", "wartend_bestaetigt", "zeit_beendet"].includes(e.x.status) ? "Fortsetzen" : "Teilnehmen"}</button>`)), "Zurzeit keine Teilnahme möglich.")}
        <h2 class="mt-l">${icon("chart-pie")} Ergebnisse</h2>${tbl(res.map((e) => row(e, `<button class="btn sm" data-result="${e.x.id}">${icon("eye")} Korrektur und Ergebnis</button>`)), "Noch keine freigegebenen Ergebnisse.")}
        ${rest.length ? `<h2 class="mt-l">${icon("clock")} Weitere</h2>${tbl(rest.map((e) => row(e, "")), "")}` : ""}
      </div>`;
    },
    mount(el) {
      const go = (pid, h) => { store.set("portal", pe.id); setRole("tn", { pid }); navigate(h); };
      el.querySelectorAll("[data-join]").forEach((b) => (b.onclick = () => go(b.dataset.join, "#/tn")));
      el.querySelectorAll("[data-result]").forEach((b) => (b.onclick = () => go(b.dataset.result, "#/tn/einsicht")));
    },
  };
}
// Link zurück zur Übersicht der eigenen Teilnahmen (Prüflingsansichten)
export const portalLink = () => (store.get("portal") ? `<a class="btn ghost sm" href="#/schueler" data-portal>${icon("arrow-left")} Meine Teilnahmen</a>` : "");

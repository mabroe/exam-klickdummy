// Bearbeitungssperren bei gleichzeitiger Bearbeitung einer Prüfung (Editor und Formulare der Prüfungserstellung)
//  - je Bereich (z. B. „Allgemein“, eine Aufgabe, Aufgabensteuerung, Rahmendaten) ein Datensatz settings.key = "lock:<Prüfung>:<Bereich>"
//  - die Sperre gehört dem Browserfenster (Tab) einer Person; sie wird regelmäßig erneuert und verfällt ohne Erneuerung nach 90 Sekunden
//  - bei gleichzeitigem Anfordern gewinnt der zuerst angelegte Datensatz
import { D, create, upd, del } from "./data.js?v=9.2";
import { me, personName } from "./access.js?v=9.2";

const TTL = 90000, BEAT = 20000;
const TAB = (() => { try { let t = sessionStorage.getItem("cbw.tab"); if (!t) { t = Math.random().toString(36).slice(2, 10); sessionStorage.setItem("cbw.tab", t); } return t; } catch { return Math.random().toString(36).slice(2, 10); } })();
const key = (cat, area) => `lock:${cat}:${area}`;
const fresh = (r) => r && Date.now() - new Date(r.value?.at || 0).getTime() < TTL;
const recs = (k) => D.settings.filter((s) => s.key === k).sort((a, b) => String(a.created).localeCompare(String(b.created)) || String(a.id).localeCompare(String(b.id)));
const mine = (r) => r?.value?.tab === TAB && r?.value?.pid === (me()?.id || "");
const held = new Map(); // key -> record id
// Wer hält die Sperre (nur andere Fenster/Personen)? → { pid, name, role, self } oder null
export function lockedBy(cat, area) {
  const r = recs(key(cat, area)).find(fresh);
  if (!r || mine(r)) return null;
  return { ...r.value, self: r.value.pid === me()?.id };
}
export const isMine = (cat, area) => { const r = recs(key(cat, area)).find(fresh); return !!r && mine(r); };
export async function acquire(cat, area, role = "") {
  const k = key(cat, area); const p = me();
  const list = recs(k);
  const cur = list.find(fresh);
  if (cur && !mine(cur)) return false;
  for (const r of list.filter((x) => !fresh(x) && !mine(x))) del("settings", r.id).catch(() => {});
  const value = { pid: p?.id || "", name: p ? personName(p) : "Koordinierungsstelle", role, tab: TAB, at: new Date().toISOString(), area };
  if (cur && mine(cur)) { held.set(k, cur.id); await upd("settings", cur.id, { value }).catch(() => {}); return true; }
  const rec = await create("settings", { key: k, value });
  // Gleichzeitige Anforderung: der älteste gültige Datensatz gewinnt
  const winner = recs(k).find(fresh);
  if (winner && winner.id !== rec.id) { await del("settings", rec.id).catch(() => {}); return false; }
  held.set(k, rec.id); return true;
}
export async function release(cat, area) {
  const k = key(cat, area);
  for (const r of recs(k).filter(mine)) await del("settings", r.id).catch(() => {});
  held.delete(k);
}
// alle eigenen Sperren einer Prüfung freigeben (außer den angegebenen Bereichen)
export async function releaseAll(cat, keep = []) {
  for (const r of D.settings.filter((s) => String(s.key).startsWith(`lock:${cat}:`) && mine(s))) if (!keep.includes(r.value?.area)) { await del("settings", r.id).catch(() => {}); held.delete(r.key); }
}
export const myAreas = (cat) => D.settings.filter((s) => String(s.key).startsWith(`lock:${cat}:`) && mine(s) && fresh(s)).map((s) => s.value.area);
// Erneuerung der eigenen Sperren
setInterval(() => { for (const r of D.settings.filter((s) => String(s.key).startsWith("lock:") && mine(s))) upd("settings", r.id, { value: { ...r.value, at: new Date().toISOString() } }).catch(() => {}); }, BEAT);
window.addEventListener("pagehide", () => { for (const r of D.settings.filter((s) => String(s.key).startsWith("lock:") && mine(s))) { try { del("settings", r.id); } catch {} } });

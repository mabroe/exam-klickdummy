// Datenschicht: PocketBase (lokaler Server) oder Browser-Datenbank (GitHub Pages) + Realtime-Spiegel aller Collections im Speicher
import PocketBase from "./vendor/pocketbase.es.mjs?v=9.1";
import { toPb } from "./ui.js?v=9.1";
import CFG from "./config.js?v=9.1";

export const APP_VERSION = "9.1";
// Backend ermitteln: PocketBase, wenn erreichbar, sonst Datenbank im Browser
export const backend = { mode: "local", url: "" };
async function probe(url) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 2500);
  try { const r = await fetch(url + "api/demo/version", { cache: "no-store", signal: ac.signal }); if (!r.ok) return null; const j = await r.json(); return j && j.version ? j : null; } catch { return null; } finally { clearTimeout(t); }
}
const want = String(CFG.backend || "auto");
if (/^https?:\/\//.test(want)) { backend.mode = "pocketbase"; backend.url = want.replace(/\/?$/, "/"); }
else if (want === "auto" && location.protocol.startsWith("http") && !/\.github\.io$/.test(location.hostname) && (await probe(location.origin + "/"))) { backend.mode = "pocketbase"; backend.url = location.origin + "/"; }

export let pb;
let api;
if (backend.mode === "pocketbase") {
  pb = new PocketBase(backend.url.replace(/\/$/, ""));
  pb.autoCancellation(false);
  const post = (path, body) => fetch(backend.url + path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) }).then((x) => x.json());
  api = {
    ensure: () => post("api/demo/ensure"),
    reset: () => post("api/demo/reset"),
    simulateLogin: (room, except) => post("api/demo/simulate-login", { room, except }),
    version: () => fetch(backend.url + "api/demo/version", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { version: "?" })),
    beacon: (col, id, data) => { try { fetch(`${backend.url}api/collections/${col}/records/${id}`, { method: "PATCH", keepalive: true, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); } catch {} },
  };
} else {
  const { createLocalBackend } = await import("./localdb.js?v=9.1");
  const lb = await createLocalBackend({ version: APP_VERSION });
  pb = lb.client; api = lb.api;
}
export const demoApi = {
  simulateLogin: (room, except) => api.simulateLogin(room, except),
  version: () => api.version(),
  beacon: (col, id, data) => api.beacon(col, id, data),
};

export const COLS = ["rooms", "participants", "supervisors", "protocol", "items", "gradings", "comments", "tasks", "catalog", "settings", "kfiles", "orgs", "persons", "groups", "courses", "venues"];
export const D = Object.fromEntries(COLS.map((c) => [c, []]));
const listeners = new Set();
export const onChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const emit = (col, ev) => listeners.forEach((fn) => { try { fn(col, ev); } catch (e) { console.error(e); } });
export let online = true;

export async function loadAll() {
  const r = await api.ensure().catch(() => ({}));
  if (r.reseeded) window.__reseeded = true;
  const lists = await Promise.all(COLS.map((c) => pb.collection(c).getFullList({ batch: 1000, sort: "created" })));
  COLS.forEach((c, i) => (D[c] = lists[i]));
}

export async function subscribeAll() {
  for (const c of COLS) {
    await pb.collection(c).subscribe("*", (e) => {
      const arr = D[c];
      const i = arr.findIndex((r) => r.id === e.record.id);
      // Reine Heartbeat-Aktualisierungen (last_seen) nicht als Datenänderung melden
      if (c === "participants" && e.action === "update" && i >= 0) {
        const strip = (r) => JSON.stringify({ ...r, last_seen: 0, updated: 0 });
        if (strip(arr[i]) === strip(e.record)) { arr[i] = e.record; emit("_hb", e); return; }
      }
      if (e.action === "delete") { if (i >= 0) arr.splice(i, 1); }
      else if (i >= 0) arr[i] = e.record; else arr.push(e.record);
      if (c === "settings" && e.action === "create" && e.record.key === "demo") { reloadAfterReset(); return; }
      emit(c, e);
    });
  }
  pb.realtime.onDisconnect = () => { online = false; emit("_conn"); };
}

let reloading = false;
async function reloadAfterReset() {
  if (reloading) return; reloading = true;
  setTimeout(async () => { await loadAll(); reloading = false; emit("_reset"); }, 400);
}

export const byId = (c, id) => D[c].find((r) => r.id === id);
export const where = (c, fn) => D[c].filter(fn);

function patchLocal(c, rec) {
  const arr = D[c]; const i = arr.findIndex((r) => r.id === rec.id);
  if (i >= 0) arr[i] = rec; else arr.push(rec);
}
export async function upd(c, id, data) {
  const local = byId(c, id); if (local) Object.assign(local, data);
  // Reine Heartbeat-Aktualisierungen lösen kein Neuzeichnen aus
  const hbOnly = c === "participants" && Object.keys(data).every((k) => k === "last_seen");
  emit(hbOnly ? "_hb" : c, { action: "local", id });
  const rec = await pb.collection(c).update(id, data);
  patchLocal(c, rec); return rec;
}
export async function create(c, data) {
  const rec = await pb.collection(c).create(data);
  patchLocal(c, rec); emit(c, { action: "create", record: rec }); return rec;
}
export async function del(c, id) {
  const arr = D[c]; const i = arr.findIndex((r) => r.id === id); if (i >= 0) arr.splice(i, 1);
  emit(c, { action: "local-delete", id });
  await pb.collection(c).delete(id);
}

export async function resetDemo() {
  await api.reset();
  await loadAll(); emit("_reset");
}

export function log(roomId, p, action, comment = "", kind = "aktion", by = "") {
  return create("protocol", {
    room: roomId, ts: toPb(), participant: p ? `${p.lastname}, ${p.firstname}` : "–",
    username: p ? p.username : by || "–", seat: p ? p.seat || "–" : "–", action, comment, kind,
  }).catch(() => {});
}

export const setting = (key, def = null) => D.settings.find((s) => s.key === key)?.value ?? def;
export async function setSetting(key, value) {
  const s = D.settings.find((x) => x.key === key);
  return s ? upd("settings", s.id, { value }) : create("settings", { key, value });
}

// Datei-Upload (multipart) und URL für Anzeige/Download
export async function createWithFile(c, data, file) {
  const fd = new FormData(); Object.entries(data).forEach(([k, v]) => fd.append(k, typeof v === "object" ? JSON.stringify(v) : v)); if (file) fd.append("file", file);
  const rec = await pb.collection(c).create(fd); patchLocal(c, rec); emit(c, { action: "create", record: rec }); return rec;
}
// Datei-URL: hochgeladene Datei (PocketBase bzw. Browser-Datenbank) oder mitgelieferte Beispieldatei (data.url)
export const fileUrl = (rec, opts = {}) => (rec?.file ? pb.files.getURL(rec, rec.file, opts) : rec?.data?.url || "");

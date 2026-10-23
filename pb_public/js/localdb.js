// Browser-Modus (z. B. GitHub Pages): ersetzt den PocketBase-Server durch eine Datenbank im Browser.
//  - Speicherung in IndexedDB (bleibt nach dem Neuladen erhalten, getrennt je Browser/Gerät)
//  - Live-Kopplung der Rollen über BroadcastChannel zwischen allen Tabs/Fenstern desselben Browsers
//  - bildet die vom Klickdummy genutzten Teile der PocketBase-Client-API und der /api/demo/*-Endpunkte nach
import { SCHEMA, normalize } from "./schema.js?v=9.3";

const DB_NAME = "checkbw-klickdummy";
const ts = (ms = Date.now()) => new Date(ms).toISOString().replace("T", " ");
const rid = (n = 15) => { const a = "abcdefghijklmnopqrstuvwxyz0123456789"; let s = ""; const r = crypto.getRandomValues(new Uint8Array(n)); for (const x of r) s += a[x % 36]; return s; };
const clone = (o) => (o == null ? o : structuredClone(o));
class ApiError extends Error { constructor(msg, status = 400) { super(msg); this.status = status; this.response = { message: msg, data: {} }; } }

// ---------- IndexedDB ----------
function openDb() {
  return new Promise((res, rej) => {
    const q = indexedDB.open(DB_NAME, 1);
    q.onupgradeneeded = () => { const db = q.result; if (!db.objectStoreNames.contains("rec")) db.createObjectStore("rec"); if (!db.objectStoreNames.contains("files")) db.createObjectStore("files"); };
    q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error);
  });
}
const tx = (db, store, mode, fn) => new Promise((res, rej) => { const t = db.transaction(store, mode); const s = t.objectStore(store); const out = fn(s); t.oncomplete = () => res(out?.result ?? out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
const getAll = (db, store) => new Promise((res, rej) => { const t = db.transaction(store, "readonly"); const s = t.objectStore(store); const keys = s.getAllKeys(); const vals = s.getAll(); t.oncomplete = () => res(keys.result.map((k, i) => [k, vals.result[i]])); t.onerror = () => rej(t.error); });

const loadSeed = async () => { await import("./seed-data.js?v=9.3"); return globalThis.CheckBWSeed; };

export async function createLocalBackend({ version }) {
  const db = await openDb();
  const M = Object.fromEntries(Object.keys(SCHEMA).map((c) => [c, new Map()]));
  const urls = new Map(); // Dateiname -> Object-URL
  const subs = new Map(); // Collection -> Set(callback)
  const bc = "BroadcastChannel" in window ? new BroadcastChannel(DB_NAME) : null;
  let last = 0; const stamp = () => { last = Math.max(Date.now(), last + 1); return ts(last); };
  let q = Promise.resolve(); const persist = (fn) => (q = q.then(fn).catch((e) => console.error("[localdb]", e)));

  async function loadMemory() {
    Object.values(M).forEach((m) => m.clear());
    for (const [k, v] of await getAll(db, "rec")) { const i = k.indexOf("/"); const c = k.slice(0, i); if (M[c]) M[c].set(v.id, v); }
  }
  async function fileUrl(name) {
    if (!name || urls.has(name)) return;
    const f = await tx(db, "files", "readonly", (s) => s.get(name));
    if (f) urls.set(name, URL.createObjectURL(f));
  }
  async function loadFiles() { for (const m of [M.items, M.kfiles]) for (const r of m.values()) await fileUrl(r.file); }
  await loadMemory(); await loadFiles();

  const notify = (col, action, record) => { const set = subs.get(col); if (set) set.forEach((cb) => { try { cb({ action, record: clone(record) }); } catch (e) { console.error(e); } }); };
  const emitLocal = (col, action, record) => setTimeout(() => notify(col, action, record), 0);
  const post = (msg) => { try { bc?.postMessage(msg); } catch (e) { console.warn("[localdb] broadcast", e); } };

  if (bc) bc.onmessage = async ({ data: m }) => {
    if (m.t === "reset") { await loadMemory(); await loadFiles(); const demo = [...M.settings.values()].find((s) => s.key === "demo"); notify("settings", "create", demo || { id: "-", key: "demo" }); return; }
    if (m.t !== "ev" || !M[m.col]) return;
    if (m.action === "delete") M[m.col].delete(m.record.id); else { if (m.record.file) await fileUrl(m.record.file); M[m.col].set(m.record.id, m.record); }
    notify(m.col, m.action, m.record);
  };

  // ---------- Fachregeln, die sonst die Server-Hooks prüfen ----------
  const overlap = (a, b) => { const s = (r) => new Date(String(r.planned_start).replace(" ", "T")).getTime(); const e = (r) => s(r) + ((+r.duration_min || 0) + 30) * 60000; return s(a) < e(b) && s(b) < e(a); };
  function validate(col, before, after) {
    if (col === "participants" && before && (+before.nta || 0) !== (+after.nta || 0)) {
      const room = M.rooms.get(after.room); if (room && room.state && room.state !== "CREATED") throw new ApiError("Ein Nachteilsausgleich kann nur vor dem Prüfungsstart gewährt oder geändert werden.");
    }
    if (col === "rooms" && after.venue && after.planned_start) {
      const hit = [...M.rooms.values()].find((r) => r.id !== after.id && r.venue === after.venue && r.state !== "TERMINATED" && overlap(r, after));
      if (hit) throw new ApiError(`Der Raum ist in diesem Zeitraum bereits belegt (${hit.exam_name || hit.name}).`);
    }
  }

  async function fromForm(data) {
    if (!(data instanceof FormData)) return { fields: { ...data }, file: null };
    const fields = {}; let file = null;
    for (const [k, v] of data.entries()) { if (v instanceof Blob) { if (k === "file") file = v; } else fields[k] = v; }
    return { fields, file };
  }
  async function storeFile(file) {
    const base = (file.name || "datei").replace(/[^\w.\-]+/g, "_"); const dot = base.lastIndexOf(".");
    const name = (dot > 0 ? base.slice(0, dot) : base) + "_" + rid(10) + (dot > 0 ? base.slice(dot) : "");
    await tx(db, "files", "readwrite", (s) => s.put(file, name)); urls.set(name, URL.createObjectURL(file)); return name;
  }
  const put = (col, rec) => persist(() => tx(db, "rec", "readwrite", (s) => s.put(rec, `${col}/${rec.id}`)));

  function collection(col) {
    if (!M[col]) throw new ApiError(`Unbekannte Collection ${col}`, 404);
    return {
      async getFullList(opts = {}) {
        const key = (opts.sort || "created").replace(/^[-+]/, ""); const dir = (opts.sort || "").startsWith("-") ? -1 : 1;
        return [...M[col].values()].map(clone).sort((a, b) => (a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0));
      },
      async getOne(id) { const r = M[col].get(id); if (!r) throw new ApiError("Nicht gefunden", 404); return clone(r); },
      async create(data) {
        const { fields, file } = await fromForm(data);
        const now = stamp();
        const rec = { ...normalize(col, fields), id: fields.id && /^[a-z0-9]{15}$/.test(fields.id) ? fields.id : rid(), collectionName: col, created: now, updated: now };
        validate(col, null, rec);
        if (file) rec.file = await storeFile(file);
        M[col].set(rec.id, rec); put(col, rec); await q;
        post({ t: "ev", col, action: "create", record: rec }); emitLocal(col, "create", rec);
        return clone(rec);
      },
      async update(id, data) {
        const before = M[col].get(id); if (!before) throw new ApiError("Nicht gefunden", 404);
        const { fields, file } = await fromForm(data);
        const rec = { ...before, ...normalize(col, fields, true), id, updated: stamp() };
        validate(col, before, rec);
        if (file) rec.file = await storeFile(file);
        M[col].set(id, rec); put(col, rec);
        post({ t: "ev", col, action: "update", record: rec }); emitLocal(col, "update", rec);
        return clone(rec);
      },
      async delete(id) {
        const before = M[col].get(id); if (!before) return true;
        M[col].delete(id); persist(() => tx(db, "rec", "readwrite", (s) => s.delete(`${col}/${id}`)));
        post({ t: "ev", col, action: "delete", record: before }); emitLocal(col, "delete", before);
        return true;
      },
      async subscribe(topic, cb) { if (!subs.has(col)) subs.set(col, new Set()); subs.get(col).add(cb); return async () => subs.get(col)?.delete(cb); },
      async unsubscribe() { subs.delete(col); },
    };
  }

  // ---------- Demodaten ----------
  async function seedAll() {
    const S = await loadSeed();
    const data = S.build(Date.now());
    await persist(() => tx(db, "rec", "readwrite", (s) => s.clear()));
    await persist(() => tx(db, "files", "readwrite", (s) => s.clear()));
    urls.forEach((u) => URL.revokeObjectURL(u)); urls.clear();
    let base = Date.now() - 3600000;
    await persist(() => tx(db, "rec", "readwrite", (s) => {
      for (const col of S.COLLECTIONS) for (const r of data[col] || []) { const t0 = ts(base++); s.put({ ...normalize(col, r), id: r.id, collectionName: col, created: t0, updated: t0 }, `${col}/${r.id}`); }
    }));
    await loadMemory();
    return S.SEED_VERSION;
  }
  const withLock = (fn) => (navigator.locks?.request ? navigator.locks.request("checkbw-seed", fn) : fn());
  const seedVersion = () => { const s = [...M.settings.values()].find((x) => x.key === "demo"); return +(s?.value?.seed_version) || 0; };

  const api = {
    async ensure() {
      return withLock(async () => {
        await loadMemory();
        const want = (await loadSeed()).SEED_VERSION;
        const empty = M.rooms.size === 0;
        if (!empty && seedVersion() >= want) return { ok: true, seeded: false, reseeded: false };
        await seedAll(); post({ t: "reset" });
        return { ok: true, seeded: empty, reseeded: !empty };
      });
    },
    async reset() { await withLock(async () => { await seedAll(); }); post({ t: "reset" }); return { ok: true }; },
    async simulateLogin(roomId, except) {
      const list = [...M.participants.values()].filter((p) => p.room === roomId && p.status === "nicht_eingeloggt").sort((a, b) => String(a.seat || "").localeCompare(String(b.seat || ""), "de", { numeric: true }));
      let n = 0; const now = ts();
      const rm = M.rooms.get(roomId); const lesson = M.courses.get(rm?.course)?.kind === "unterricht"; // Unterricht: ohne Bestätigungen
      for (let i = 0; i < list.length; i++) {
        const p = list[i]; if (p.id === except || i % 7 === 3) continue;
        const ok = lesson || i % 3 !== 1;
        await collection("participants").update(p.id, { status: ok ? "wartend_bestaetigt" : "wartend", cheat_ack: ok, health: ok ? "ok" : "", present: true, simulated: true, last_seen: now }); n++;
      }
      return { ok: true, count: n };
    },
    async version() { return { version }; },
    // Verbindung beim Schließen des Tabs sofort als unterbrochen melden
    beacon(col, id, data) { collection(col).update(id, data).catch(() => {}); },
  };

  const client = {
    collection,
    files: { getURL: (rec, name) => urls.get(name) || "" },
    realtime: { onDisconnect: null },
    autoCancellation() {},
  };
  return { client, api };
}

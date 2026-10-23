// Verschlüsselte Ablage („Tresor“) einer final freigegebenen Prüfung
// AES-256-GCM über WebCrypto; der Schlüssel liegt im Klickdummy in einem eigenen Feld (vault) – produktiv in einer Schlüsselverwaltung
// mit zeitgesteuerter Freigabe. Ohne WebCrypto (unsicherer Kontext) wird ein als Demo gekennzeichnetes XOR-Verfahren genutzt.
const enc = new TextEncoder(), dec = new TextDecoder();
const toB64 = (u8) => { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const fromB64 = (b) => { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
const hex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const subtle = globalThis.crypto?.subtle;

export async function seal(obj) {
  const data = enc.encode(JSON.stringify(obj));
  const at = new Date().toISOString();
  if (subtle) {
    const key = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle.encrypt({ name: "AES-GCM", iv }, key, data));
    const raw = new Uint8Array(await subtle.exportKey("raw", key));
    const sha = hex(await subtle.digest("SHA-256", data));
    return { sealed: { alg: "AES-256-GCM", iv: toB64(iv), data: toB64(ct), sha256: sha, bytes: data.length, at }, vault: { key: toB64(raw), alg: "AES-256-GCM" } };
  }
  const k = crypto.getRandomValues(new Uint8Array(32)); const ct = data.map((b, i) => b ^ k[i % 32]);
  return { sealed: { alg: "XOR-Demo", data: toB64(ct), bytes: data.length, at }, vault: { key: toB64(k), alg: "XOR-Demo" } };
}
export async function unseal(sealed, vault) {
  if (!sealed?.data || !vault?.key) throw new Error("Schlüssel oder Daten fehlen");
  const ct = fromB64(sealed.data); const k = fromB64(vault.key);
  if (sealed.alg === "AES-256-GCM") {
    if (!subtle) throw new Error("WebCrypto ist in diesem Kontext nicht verfügbar");
    const key = await subtle.importKey("raw", k, { name: "AES-GCM" }, false, ["decrypt"]);
    const pt = await subtle.decrypt({ name: "AES-GCM", iv: fromB64(sealed.iv) }, key, ct);
    return JSON.parse(dec.decode(pt));
  }
  return JSON.parse(dec.decode(ct.map((b, i) => b ^ k[i % 32])));
}
export const fingerprint = (sealed) => (sealed?.sha256 ? sealed.sha256.slice(0, 16).replace(/(.{4})/g, "$1 ").trim() : "–");

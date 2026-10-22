// Zugangsseite: Passwort vor dem Klickdummy (Zugangshürde für die Demo, kein Schutz vertraulicher Daten)
import CFG from "./config.js?v=8.1";

const KEY = "checkbw.gate";
// SHA-256 (Fallback, falls crypto.subtle nicht verfügbar ist, z. B. bei http über eine Netzwerkadresse)
function sha256js(str) {
  const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  const b = new TextEncoder().encode(str); const l = b.length; const n = ((l + 9 + 63) >> 6) << 6; const m = new Uint8Array(n); m.set(b); m[l] = 0x80;
  const dv = new DataView(m.buffer); dv.setUint32(n - 4, l * 8); dv.setUint32(n - 8, Math.floor(l / 0x20000000));
  const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]; const w = new Uint32Array(64);
  const r = (x, y) => (x >>> y) | (x << (32 - y));
  for (let o = 0; o < n; o += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) { const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
    let [a, b2, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b2) ^ (a & c) ^ (b2 & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
    }
    [a, b2, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) | 0));
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}
async function sha256(str) {
  if (crypto?.subtle) { try { const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str)); return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join(""); } catch {} }
  return sha256js(str);
}
const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } };
const write = (v) => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };
export const unlocked = () => { const g = read(); return !!g && g.h === CFG.passwordHash && g.until > Date.now(); };
export function lock() { write(null); location.reload(); }

export function gate(root) {
  if (!CFG.passwordHash || unlocked()) return Promise.resolve();
  return new Promise((resolve) => {
    root.innerHTML = `<main class="gate" aria-labelledby="gate-h">
      <form class="gate-card" autocomplete="off" novalidate>
        <div class="gate-brand"><img src="img/favicon.svg" alt="" width="40" height="40"><div><b>CheckBW</b><span>Prüfungsplattform Bildschirmarbeitsplatz</span></div></div>
        <h1 id="gate-h">Klickdummy</h1>
        <p class="gate-sub">Dieser Demonstrator ist passwortgeschützt. Er enthält ausschließlich fiktive Demodaten.</p>
        <label class="lbl" for="gate-pw">Passwort</label>
        <div class="gate-pw"><input id="gate-pw" class="input" type="password" autocomplete="current-password" required aria-describedby="gate-err"><button type="button" class="gate-eye" aria-label="Passwort anzeigen" aria-pressed="false">Anzeigen</button></div>
        <p id="gate-err" class="gate-err" role="alert" hidden>Das Passwort ist nicht korrekt.</p>
        <button class="btn primary block" type="submit">Klickdummy öffnen</button>
        <p class="gate-foot">Die Freigabe gilt in diesem Browser für ${+CFG.passwordHours || 12} Stunden.</p>
      </form></main>`;
    const f = root.querySelector("form"), pw = root.querySelector("#gate-pw"), err = root.querySelector("#gate-err"), eye = root.querySelector(".gate-eye");
    pw.focus();
    eye.onclick = () => { const show = pw.type === "password"; pw.type = show ? "text" : "password"; eye.textContent = show ? "Verbergen" : "Anzeigen"; eye.setAttribute("aria-pressed", String(show)); pw.focus(); };
    pw.oninput = () => { err.hidden = true; pw.removeAttribute("aria-invalid"); };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const h = await sha256(pw.value);
      if (h !== CFG.passwordHash) { err.hidden = false; pw.setAttribute("aria-invalid", "true"); pw.select(); f.classList.remove("shake"); void f.offsetWidth; f.classList.add("shake"); return; }
      write({ h, until: Date.now() + (+CFG.passwordHours || 12) * 3600000 });
      resolve();
    };
  });
}

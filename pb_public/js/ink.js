// Stifteingabe: Gestenerkennung (Unterstreichungen) und Handschrifterkennung der Korrekturzeichen
// Handschrift (Version 2):
//  1. Zerlegung der Striche in Buchstaben (Hauptstriche nach waagerechter Überlappung, Punkte/Querstriche werden zugeordnet)
//  2. Buchstabenerkennung mit dem $P-Point-Cloud-Verfahren (Vatavu, Anthony, Wobbrock 2012) gegen mehrere Schreibvarianten je Buchstabe
//  3. Wörterbuch-Abgleich: nur die vorgegebenen Korrekturzeichen sind erlaubt; Zuordnung Striche ↔ Buchstaben per dynamischer
//     Programmierung (auch zusammenhängend geschriebene Buchstaben), Plausibilität der Buchstabenhöhen (z. B. Unterlänge bei „g“)
//  4. Ganzwort-Vergleich als Rückfallebene sowie persönliche Schriftproben des Korrektors (Einlernen / Lernen aus Korrekturen)
import { ALL_SIGN_KEYS } from "./scenario.js?v=8.7";

// ---------- Einstrich-Glyphen (Koordinaten: x nach rechts, y nach unten, Grundlinie y=10) ----------
const G = {
  r: { w: 4, s: [[[0, 4], [0, 10]], [[0, 6.5], [1, 4.8], [2.5, 4], [4, 4.4]]] },
  f: { w: 4, s: [[[4, 0.6], [3, 0], [2.1, 0.4], [1.8, 2], [1.8, 10]], [[0.2, 4.2], [3.6, 4.2]]] },
  "(": { w: 2.5, s: [[[2.2, -0.5], [0.8, 2.5], [0.3, 6], [0.8, 9.5], [2.2, 12.5]]] },
  ")": { w: 2.5, s: [[[0.3, -0.5], [1.7, 2.5], [2.2, 6], [1.7, 9.5], [0.3, 12.5]]] },
  U: { w: 6, s: [[[0, 0], [0, 7], [0.9, 9.2], [3, 10], [5.1, 9.2], [6, 7], [6, 0]]] },
  g: { w: 4.6, s: [[[4.2, 5.2], [3.2, 4.1], [1.6, 4.1], [0.4, 5.2], [0, 7], [0.5, 8.7], [2, 9.4], [3.5, 8.9], [4.2, 7.4]], [[4.3, 4], [4.3, 11.6], [3.5, 13.1], [2, 13.4], [0.5, 12.6]]] },
  l: { w: 1.5, s: [[[0.7, 0], [0.7, 10]]] },
  v: { w: 4.4, s: [[[0, 4], [2.2, 10], [4.4, 4]]] },
  R: { w: 6, s: [[[0, 10], [0, 0], [3.5, 0], [5, 0.9], [5.4, 2.5], [5, 4.1], [3.5, 5], [0, 5]], [[2.6, 5], [5.8, 10]]] },
  Z: { w: 6, s: [[[0, 0], [6, 0], [0, 10], [6, 10]]] },
  G: { w: 6.5, s: [[[6, 1.6], [4.5, 0], [2, 0], [0.5, 1.6], [0, 5], [0.5, 8.4], [2, 10], [4.5, 10], [6, 8.5], [6.1, 5.6], [3.6, 5.6]]] },
  A: { w: 6, s: [[[0, 10], [3, 0], [6, 10]], [[1.2, 6.6], [4.8, 6.6]]] },
  S: { w: 5.5, s: [[[5.1, 1.5], [3.5, 0], [1.6, 0], [0.3, 1.5], [0.6, 3.5], [2.6, 4.8], [4.5, 6], [5.3, 8], [4, 9.8], [1.8, 10], [0, 8.6]]] },
  b: { w: 5, s: [[[0, 0], [0, 10]], [[0, 6.2], [1.5, 4.3], [3, 4.1], [4.3, 5], [4.7, 7], [4.3, 9], [3, 10], [1.5, 9.8], [0, 8.4]]] },
  I: { w: 1.5, s: [[[0.7, 0], [0.7, 10]]] },
  D: { w: 6.2, s: [[[0, 0], [0, 10]], [[0, 0], [3, 0], [5, 1.5], [5.9, 5], [5, 8.5], [3, 10], [0, 10]]] },
  e: { w: 4.6, s: [[[0.2, 7], [4.3, 7], [4.1, 5.3], [3, 4.2], [1.5, 4.1], [0.3, 5.2], [0, 7], [0.4, 8.8], [1.8, 10], [3.3, 9.9], [4.4, 9]]] },
  L: { w: 5.2, s: [[[0, 0], [0, 10], [5, 10]]] },
  o: { w: 4.6, s: [[[2.3, 4], [0.6, 4.7], [0, 7], [0.6, 9.3], [2.3, 10], [4, 9.3], [4.6, 7], [4, 4.7], [2.3, 4]]] },
  T: { w: 6, s: [[[0, 0], [6, 0]], [[3, 0], [3, 10]]] },
  h: { w: 4.6, s: [[[0, 0], [0, 10]], [[0, 6.2], [1.5, 4.3], [3, 4], [4.1, 5], [4.3, 6.5], [4.3, 10]]] },
  Ü: { w: 6, s: [[[0, 0], [0, 7], [0.9, 9.2], [3, 10], [5.1, 9.2], [6, 7], [6, 0]], [[1.6, -2.4], [2, -1.9]], [[4, -2.4], [4.4, -1.9]]] },
  F: { w: 5.4, s: [[[5, 0], [0, 0], [0, 10]], [[0, 5], [4, 5]]] },
  s: { w: 4.2, s: [[[3.9, 4.7], [2.5, 4], [1, 4.2], [0.3, 5.2], [1, 6.6], [3, 7.3], [4, 8.5], [3.4, 9.7], [1.8, 10], [0.2, 9.4]]] },
  W: { w: 8.4, s: [[[0, 0], [1.9, 10], [4.2, 3], [6.5, 10], [8.4, 0]]] },
};
// Alternative Schreibweisen (Einstrich-Varianten)
const ALT = {
  r: [{ w: 4, s: [[[0, 10], [0, 4], [0, 6.5], [1, 4.8], [2.5, 4], [4, 4.4]]] }],
  h: [{ w: 4.6, s: [[[0, 0], [0, 10], [0, 6.2], [1.5, 4.3], [3, 4], [4.1, 5], [4.3, 6.5], [4.3, 10]]] }],
  b: [{ w: 5, s: [[[0, 0], [0, 10], [0, 8.4], [1.5, 9.8], [3, 10], [4.3, 9], [4.7, 7], [4.3, 5], [3, 4.1], [1.5, 4.3], [0, 6.2]]] }],
};

// Erzeugt Striche eines Korrekturzeichens (z. B. für Vorlagen oder Tests)
export function glyphStrokes(sign, { size = 30, x = 0, y = 0, variant = 0, jitter = 0, seed = 1 } = {}) {
  let rnd = seed; const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280 - 0.5; };
  const strokes = []; let off = 0; const k = size / 10;
  for (const ch of [...sign]) {
    const g = (variant && ALT[ch]?.[variant - 1]) || G[ch];
    if (!g) continue;
    g.s.forEach((st) => strokes.push(st.map(([px, py]) => ({ x: x + (off + px) * k + rand() * jitter, y: y + py * k + rand() * jitter }))));
    off += g.w + 1.6;
  }
  return strokes;
}

// ---------- $P-Grundfunktionen ----------
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function pathLength(pts) { let d = 0; for (let i = 1; i < pts.length; i++) if (pts[i].id === pts[i - 1].id) d += dist(pts[i - 1], pts[i]); return d; }
function resample(points, n) {
  const pts = points.map((p) => ({ ...p }));
  const I = pathLength(pts) / (n - 1) || 1; let D = 0; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].id !== pts[i - 1].id) continue;
    const d = dist(pts[i - 1], pts[i]);
    if (D + d >= I && d > 0) {
      const q = { x: pts[i - 1].x + ((I - D) / d) * (pts[i].x - pts[i - 1].x), y: pts[i - 1].y + ((I - D) / d) * (pts[i].y - pts[i - 1].y), id: pts[i].id };
      out.push(q); pts.splice(i, 0, q); D = 0;
    } else D += d;
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}
function cloud(strokes, n) {
  const pts = []; strokes.forEach((s, id) => s.forEach((p) => pts.push({ x: p.x, y: p.y, id })));
  if (pts.length < 2) pts.push({ ...pts[0], x: pts[0].x + 0.01 });
  let p = resample(pts, n);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  p.forEach((q) => { minX = Math.min(minX, q.x); minY = Math.min(minY, q.y); maxX = Math.max(maxX, q.x); maxY = Math.max(maxY, q.y); });
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  p = p.map((q) => ({ x: (q.x - minX) / size, y: (q.y - minY) / size }));
  const cx = p.reduce((a, q) => a + q.x, 0) / n, cy = p.reduce((a, q) => a + q.y, 0) / n;
  const c = p.map((q) => ({ x: q.x - cx, y: q.y - cy })); c.n = n; c.asp = Math.log(((maxX - minX) + 0.06 * size) / ((maxY - minY) + 0.06 * size)); return c;
}
function cloudDistance(a, b, start) {
  const n = a.length, matched = new Uint8Array(n); let sum = 0, i = start;
  do {
    let idx = -1, min = Infinity;
    for (let j = 0; j < n; j++) if (!matched[j]) { const d = (a[i].x - b[j].x) ** 2 + (a[i].y - b[j].y) ** 2; if (d < min) { min = d; idx = j; } }
    matched[idx] = 1; sum += (1 - ((i - start + n) % n) / n) * Math.sqrt(min); i = (i + 1) % n;
  } while (i !== start);
  return sum;
}
function pdist(a, b) { const n = a.length, step = Math.max(1, Math.floor(Math.sqrt(n))); let min = Infinity; for (let i = 0; i < n; i += step) min = Math.min(min, cloudDistance(a, b, i), cloudDistance(b, a, i)); return (min / n) * 64; }
// Ähnlichkeit 0..1 aus $P-Abstand und Seitenverhältnis
const simOf = (a, b) => Math.max(0, 1 - (pdist(a, b) + Math.abs(a.asp - b.asp) * 0.7) / 4.2);

// ---------- Buchstabenvorlagen (mehrere Schreibweisen je Buchstabe) ----------
const V = {
  r: [{ w: 4, s: [[[0, 10], [0, 4.4], [0, 7], [1.2, 4.9], [2.7, 4.1], [4, 4.5]]] }, { w: 3.6, s: [[[0, 4.2], [0, 10]], [[0, 7.2], [0.8, 5.3], [2.2, 4.3], [3.6, 4.6]]] }],
  f: [{ w: 4, s: [[[4, 0.8], [3, 0], [2, 0.6], [1.8, 3.5], [1.8, 10.3], [1.6, 4.3], [0, 4.3], [3.8, 4.3]]] }, { w: 3.4, s: [[[1.6, 0], [1.6, 10]], [[0, 4.3], [3.4, 4.3]]] }, { w: 4.2, s: [[[4, 0.6], [2.6, 0], [1.8, 1.4], [1.8, 10.2]], [[0.4, 4.6], [4, 4.5]]] }],
  "(": [{ w: 2.5, s: [[[2.4, -0.4], [1, 2], [0.2, 6], [1, 10], [2.4, 12.4]]] }],
  ")": [{ w: 2.5, s: [[[0.1, -0.4], [1.5, 2], [2.3, 6], [1.5, 10], [0.1, 12.4]]] }],
  U: [{ w: 6, s: [[[0, 0], [0, 7.4], [1, 9.4], [3, 10], [5, 9.4], [6, 7.4], [6, 0], [6, 10]]] }, { w: 6, s: [[[0, 0], [0.2, 5], [0.6, 8.2], [1.8, 9.7], [3, 10], [4.2, 9.7], [5.4, 8.2], [5.8, 5], [6, 0]]] }],
  g: [{ w: 4.5, s: [[[4.3, 5.4], [3.4, 4.2], [1.8, 4], [0.4, 5], [0, 7], [0.5, 8.9], [2, 9.7], [3.6, 9.1], [4.3, 7.2], [4.3, 4.1], [4.3, 11.5], [3.6, 13.1], [2, 13.5], [0.4, 12.6]]] }, { w: 4.6, s: [[[2.3, 4], [0.6, 4.8], [0, 7], [0.6, 9.2], [2.3, 10], [4, 9.2], [4.6, 7], [4, 4.8], [2.3, 4]], [[4.5, 4.4], [4.5, 13.4], [2.6, 13.8], [0.8, 13]]] }, { w: 4.4, s: [[[4.2, 4.5], [2.2, 4], [0.3, 5.2], [0.2, 7.6], [2, 9], [4.1, 8], [4.4, 4.2], [4.1, 9.5], [3, 13.2], [1.6, 13.6], [0.1, 12.5]]] }],
  l: [{ w: 2.6, s: [[[0, 8.6], [1.5, 4], [2, 1], [1.3, 0], [0.7, 0.9], [0.6, 9.3], [1.4, 10], [2.6, 9.6]]] }],
  v: [{ w: 4.4, s: [[[0, 4], [1.3, 8], [2.2, 10], [3.2, 8], [4.4, 4]]] }],
  R: [{ w: 6, s: [[[0, 10], [0, 0], [3.5, 0], [5, 1], [5.4, 2.6], [5, 4.1], [3.5, 5], [0.2, 5], [2.8, 5.4], [6, 10]]] }, { w: 5.8, s: [[[0, 0], [0, 10]], [[0, 0.2], [3.4, 0], [5, 1], [5.3, 2.6], [4.8, 4.2], [3.3, 5], [0.2, 5]], [[2.4, 5], [5.8, 10]]] }],
  Z: [{ w: 6, s: [[[0, 0.2], [6, 0], [0, 10], [6, 10]], [[1.2, 5], [4.8, 5]]] }],
  G: [{ w: 6.2, s: [[[5.8, 1.4], [4.2, 0], [2, 0.1], [0.4, 1.8], [0, 5], [0.5, 8.4], [2.2, 10], [4.4, 9.9], [6, 8.5], [6.2, 6]], [[3.6, 5.8], [6.4, 5.8]]] }, { w: 6, s: [[[5.8, 1.8], [4.3, 0.2], [2, 0], [0.4, 1.8], [0, 5], [0.5, 8.4], [2.2, 10], [4.4, 9.9], [5.9, 8.4], [6, 5.6], [6, 10]]] }],
  A: [{ w: 6, s: [[[0, 10], [3, 0], [6, 10], [4.8, 6.6], [1.2, 6.6]]] }, { w: 6, s: [[[0, 10], [3, 0]], [[3, 0], [6, 10]], [[1.2, 6.6], [4.8, 6.6]]] }],
  S: [{ w: 5.2, s: [[[5, 1.2], [3.6, 0], [1.6, 0.1], [0.3, 1.5], [0.4, 3.4], [2.2, 4.7], [4.4, 5.8], [5.2, 7.8], [4.4, 9.5], [2.4, 10], [0.6, 9.6], [0, 8.6]]] }],
  b: [{ w: 5, s: [[[0, 0], [0, 10]], [[0, 7], [0.9, 4.9], [2.6, 4.1], [4.2, 4.8], [5, 7], [4.2, 9.3], [2.6, 10], [0.9, 9.4], [0, 8]]] }],
  I: [{ w: 3, s: [[[1.5, 0], [1.5, 10]], [[0, 0], [3, 0]], [[0, 10], [3, 10]]] }],
  D: [{ w: 6, s: [[[0, 10], [0, 0], [2.8, 0], [5, 1.5], [6, 5], [5, 8.5], [2.8, 10], [0, 10]]] }],
  e: [{ w: 4.6, s: [[[0.3, 7.1], [4.4, 6.8], [4, 5], [2.6, 4.1], [1, 4.4], [0.1, 6.2], [0.3, 8.5], [1.8, 9.9], [3.6, 9.8], [4.6, 8.8]]] }, { w: 4.4, s: [[[0.4, 7.5], [2.6, 7.2], [4, 6], [3.4, 4.4], [1.6, 4.2], [0.2, 5.8], [0.2, 8.4], [1.6, 9.9], [3.4, 9.9], [4.4, 9]]] }],
  L: [{ w: 5.2, s: [[[0, 0], [0, 10]], [[0, 10], [5.2, 10]]] }],
  o: [{ w: 4.6, s: [[[2.3, 4], [4, 4.7], [4.6, 7], [4, 9.3], [2.3, 10], [0.6, 9.3], [0, 7], [0.6, 4.7], [2.3, 4]]] }],
  T: [{ w: 6, s: [[[3, 10], [3, 0]], [[0, 0], [6, 0]]] }],
  h: [{ w: 4.6, s: [[[0, 0], [0, 10]], [[0, 7], [0.8, 5], [2.4, 4.1], [3.9, 4.6], [4.5, 6.2], [4.5, 10]]] }],
  Ü: [{ w: 6, s: [[[0, 0], [0, 7], [0.9, 9.2], [3, 10], [5.1, 9.2], [6, 7], [6, 0], [6, 10]], [[1.5, -2.3], [1.9, -2]], [[4, -2.3], [4.4, -2]]] }, { w: 6, s: [[[0, 0], [0, 7], [0.9, 9.2], [3, 10], [5.1, 9.2], [6, 7], [6, 0]], [[1.2, -2.2], [4.8, -2.2]]] }],
  F: [{ w: 5, s: [[[0, 0], [0, 10]], [[0, 0], [5, 0]], [[0, 5], [3.8, 5]]] }],
  s: [{ w: 4, s: [[[3.8, 4.8], [2.4, 4], [0.8, 4.3], [0.4, 5.8], [2, 6.9], [3.7, 8], [3.4, 9.6], [1.7, 10], [0, 9.3]]] }],
  W: [{ w: 8, s: [[[0, 0], [2, 10], [4, 3]], [[4, 3], [6, 10], [8, 0]]] }, { w: 8, s: [[[0, 0], [1.6, 7], [2.6, 10], [3.6, 7], [4, 3], [4.4, 7], [5.4, 10], [6.4, 7], [8, 0]]] }],
};
const CHAR_N = 40, WORD_N = 64;
const scaleGlyph = (g, k = 3, ox = 0) => g.s.map((st) => st.map(([x, y]) => ({ x: (ox + x) * k, y: y * k })));
let CHARS = null; // { ch: [{cloud, top, bot}] }
function charTemplates() {
  if (CHARS) return CHARS; CHARS = {};
  const chars = new Set(ALL_SIGN_KEYS.join(""));
  for (const ch of chars) {
    const vs = [G[ch], ...(ALT[ch] || []), ...(V[ch] || [])].filter(Boolean);
    CHARS[ch] = vs.map((g) => ({ cloud: cloud(scaleGlyph(g), CHAR_N) }));
  }
  return CHARS;
}
// Vertikale Lage je Buchstabe (0 = Versalhöhe, 10 = Grundlinie)
const ext = (ch) => { const g = G[ch]; let t = Infinity, b = -Infinity; g.s.forEach((st) => st.forEach(([, y]) => { t = Math.min(t, y); b = Math.max(b, y); })); return [t, b]; };
// Wortvorlagen (Ganzwort): Kombinationen der Schreibweisen, auch zusammenhängend geschrieben
const WORDS = {};
function wordTemplates(word) {
  if (WORDS[word]) return WORDS[word];
  const chars = [...word]; const lists = chars.map((c) => [G[c], ...(ALT[c] || []), ...(V[c] || [])].filter(Boolean));
  const combos = []; const total = lists.reduce((a, l) => a * l.length, 1);
  for (let k = 0; k < Math.min(total, 8); k++) { let r = k; combos.push(lists.map((l) => { const g = l[r % l.length]; r = Math.floor(r / l.length); return g; })); }
  const out = [];
  for (const combo of combos) {
    let off = 0; const strokes = [];
    combo.forEach((g) => { strokes.push(...scaleGlyph(g, 3, off)); off += g.w + 1.4; });
    out.push(cloud(strokes, WORD_N));
    if (chars.length > 1) { // Schreibschrift: alle Hauptstriche verbunden
      const joined = [strokes.flat()]; out.push(cloud(joined, WORD_N));
    }
  }
  return (WORDS[word] = out);
}

// ---------- Zerlegung in Buchstaben ----------
function bbox(strokes) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  strokes.forEach((s) => s.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); }));
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}
const ovl = (a, b) => Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
export function segment(strokes) {
  const W = bbox(strokes); const H = Math.max(W.h, 1);
  const items = strokes.map((s) => ({ s, b: bbox([s]) }));
  const major = items.filter((it) => it.b.h >= 0.3 * H || (it.b.w >= 0.25 * H && it.b.h >= 0.18 * H && it.b.w < 0.9 * H));
  const minor = items.filter((it) => !major.includes(it));
  major.sort((a, b) => a.b.minX - b.b.minX);
  const groups = [];
  for (const it of major) {
    const g = groups[groups.length - 1];
    if (g && ovl(g.b, it.b) >= 0.3 * Math.min(g.b.w || 1, it.b.w || 1) + 0.02 * H) { g.items.push(it); g.b = bbox(g.items.map((x) => x.s)); }
    else groups.push({ items: [it], b: it.b });
  }
  if (!groups.length && minor.length) { groups.push({ items: [minor.shift()], b: null }); groups[0].b = groups[0].items[0].b; }
  for (const it of minor) { // Punkte, Querstriche, Bögen dem Buchstaben mit größter Überdeckung zuordnen
    let best = groups[0], bv = -Infinity;
    for (const g of groups) { const v = ovl(g.b, it.b) - 0.3 * Math.abs(g.b.cx - it.b.cx); if (v > bv) { bv = v; best = g; } }
    best.items.push(it); best.b = bbox(best.items.map((x) => x.s));
  }
  return groups.map((g) => ({ strokes: g.items.map((x) => x.s), b: g.b }));
}

// ---------- Persönliche Schriftproben ----------
let USER = {}; // { sign: [cloud, …] }
export function setUserSamples(samples) {
  USER = {};
  for (const [sign, list] of Object.entries(samples || {})) USER[sign] = (list || []).map((st) => cloud(st.map((s) => s.map(([x, y]) => ({ x, y }))), WORD_N));
}
// Kompakte Speicherform einer Probe (Striche, auf 24 Punkte je Strich reduziert, normiert)
export function packSample(strokes) {
  const b = bbox(strokes); const k = 100 / Math.max(b.w, b.h, 1);
  return strokes.map((s) => { const step = Math.max(1, Math.floor(s.length / 24)); return s.filter((_, i) => i % step === 0 || i === s.length - 1).map((p) => [Math.round((p.x - b.minX) * k), Math.round((p.y - b.minY) * k)]); });
}

// ---------- Erkennung ----------
// Liefert sortierte Kandidaten [{ sign, score }] – score 0..1
export function recognizeSign(strokes, allowed = ALL_SIGN_KEYS) {
  strokes = strokes.filter((s) => s.length);
  const pts = strokes.reduce((a, s) => a + s.length, 0);
  if (pts < 2) return [];
  const CT = charTemplates();
  const W = bbox(strokes);
  const segs = segment(strokes).slice(0, 9);
  const m = segs.length;
  const gcache = new Map();
  const groupCloud = (i, j, n) => { const k = `${i}-${j}-${n}`; if (!gcache.has(k)) gcache.set(k, cloud(segs.slice(i, j).flatMap((x) => x.strokes), n)); return gcache.get(k); };
  const scache = new Map();
  // Ähnlichkeit Strichgruppe [i,j) ↔ Buchstabenfolge sub
  const pair = (i, j, sub) => {
    const key = `${i}-${j}-${sub}`; if (scache.has(key)) return scache.get(key);
    let v;
    if (sub.length === 1) { const c = groupCloud(i, j, CHAR_N); v = Math.max(...CT[sub].map((t) => simOf(c, t.cloud))); }
    else { const c = groupCloud(i, j, WORD_N); v = Math.max(...wordTemplates(sub).map((t) => simOf(c, t))) - 0.03; }
    scache.set(key, v); return v;
  };
  const whole = cloud(strokes, WORD_N);
  const res = [];
  for (const sign of allowed) {
    const chars = [...sign]; const k = chars.length;
    // 1) Ganzwortvergleich
    let best = Math.max(...wordTemplates(sign).map((t) => simOf(whole, t))) * 0.96;
    // 2) Buchstabenweise Zuordnung (DP): Gruppen [i..j) ↔ Buchstaben [a..b), 1:n oder n:1
    if (m <= k + 4) {
      const dp = Array.from({ length: m + 1 }, () => new Array(k + 1).fill(-Infinity)); const len = Array.from({ length: m + 1 }, () => new Array(k + 1).fill(0));
      dp[0][0] = 0;
      for (let i = 0; i <= m; i++) for (let a = 0; a <= k; a++) {
        if (dp[i][a] === -Infinity) continue;
        for (let di = 1; di <= Math.min(4, m - i); di++) for (let da = 1; da <= k - a; da++) {
          if (di > 1 && da > 1) continue;
          const sub = chars.slice(a, a + da).join("");
          const sc = pair(i, i + di, sub) - (di > 1 ? 0.04 * (di - 1) : 0);
          const v = dp[i][a] + sc * da;
          if (v > dp[i + di][a + da]) { dp[i + di][a + da] = v; len[i + di][a + da] = len[i][a] + da; }
        }
      }
      if (dp[m][k] > -Infinity) {
        let s = dp[m][k] / k;
        // Höhenplausibilität: Lage der Buchstaben im Wort (Versal-, x-Höhe, Unterlänge)
        if (k > 1 && m === k) {
          const ex = chars.map(ext); const t0 = Math.min(...ex.map((e) => e[0])), b0 = Math.max(...ex.map((e) => e[1])), h0 = b0 - t0;
          let pen = 0; segs.forEach((g, i) => { pen += Math.abs((g.b.minY - W.minY) / (W.h || 1) - (ex[i][0] - t0) / h0) + Math.abs((g.b.maxY - W.minY) / (W.h || 1) - (ex[i][1] - t0) / h0); });
          s -= (pen / k) * 0.12;
        }
        best = Math.max(best, s);
      }
    }
    // 3) persönliche Schriftproben
    if (USER[sign]?.length) best = Math.max(best, Math.min(1, Math.max(...USER[sign].map((t) => simOf(whole, t))) + 0.06));
    res.push({ sign, score: Math.max(0, Math.min(1, best)) });
  }
  return res.sort((a, b) => b.score - a.score);
}
// Schwellen kalibriert mit unabhängiger, simulierter Handschrift (Neigung, Zittern, Schreibschrift, eigene Buchstabenformen)
export const ACCEPT_SCORE = 0.5, ACCEPT_GAP = 0.06, ASK_SCORE = 0.33;
// Entscheidung: automatisch übernehmen, nachfragen (Auswahl der wahrscheinlichsten Zeichen) oder ablehnen
export function decide(r) {
  if (!r?.length) return "reject";
  const [a, b] = r; const gap = a.score - (b?.score || 0);
  if (a.score >= ACCEPT_SCORE && gap >= ACCEPT_GAP) return "accept";
  if (a.score >= ASK_SCORE) return "ask";
  return "reject";
}

// ---------- Gesten ----------
const len = (s) => { let d = 0; for (let i = 1; i < s.length; i++) d += dist(s[i - 1], s[i]); return d; };
function reversalsY(s) { let r = 0, dir = 0; for (let i = 2; i < s.length; i++) { const dy = s[i].y - s[i - 2].y; if (Math.abs(dy) < 1.2) continue; const nd = Math.sign(dy); if (dir && nd !== dir) r++; dir = nd; } return r; }
function lineKind(s) {
  const b = bbox([s]); const L = len(s);
  if (b.w >= 34 && b.h >= 4 && b.h <= 0.5 * b.w && L > 1.12 * b.w && reversalsY(s) >= 3) return "wavy";
  if (b.w >= 34 && b.h <= Math.max(12, 0.22 * b.w) && L <= 1.35 * b.w) return "h";
  if (false && b.h <= 0.5 * b.w && L > 1.12 * b.w && reversalsY(s) >= 3) return "wavy";
  if (b.h >= 46 && b.w <= Math.max(14, 0.22 * b.h) && L <= 1.35 * b.h) return "v";
  return null;
}
// Klassifiziert eine abgeschlossene Stiftgeste
export function classifyGesture(strokes) {
  if (strokes.length === 1) {
    const s = strokes[0]; const k = lineKind(s); const b = bbox([s]);
    const ym = s.reduce((a, p) => a + p.y, 0) / s.length;
    if (k === "h") return { type: "hline", style: "single", x1: b.minX, x2: b.maxX, y: ym };
    if (k === "wavy") return { type: "hline", style: "wavy", x1: b.minX, x2: b.maxX, y: ym };
    if (k === "v") return { type: "vline", y1: b.minY, y2: b.maxY, x: b.cx };
  }
  if (strokes.length === 2 && strokes.every((s) => lineKind(s) === "h")) {
    const [a, b] = strokes.map((s) => bbox([s]));
    const overlap = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
    if (overlap > 0.5 * Math.min(a.w, b.w) && Math.abs(a.cy - b.cy) <= 18) return { type: "hline", style: "double", x1: Math.min(a.minX, b.minX), x2: Math.max(a.maxX, b.maxX), y: (a.cy + b.cy) / 2 - 2 };
  }
  const b = bbox(strokes);
  return { type: "glyph", bbox: b };
}
export { bbox };

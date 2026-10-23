// Stammdaten der Koordinierungsstelle: Fachbereiche, Ausbildungsberufe (mit Berufsnummer und Prüfungstiteln), Unternehmenspools,
// Korrekturzeichensätze. Gespeichert in der Collection „settings“ (berufe, fachbereiche, signsets; Unternehmenspools je Datensatz „pool:<id>“).
// Die Berufsnummern sind Demowerte.
import { D, setting, setSetting, create, upd } from "./data.js?v=9.3";
import { SIGNS, ALL_SIGN_KEYS } from "./scenario.js?v=9.3";
import { esc, icon } from "./ui.js?v=9.3";
import { resetInk, INK_CHARS } from "./ink.js?v=9.3";

export const DEFAULT_FB = [{ id: "kfm", name: "Kaufmännische Berufe" }, { id: "it", name: "IT-Berufe" }, { id: "tech", name: "Gewerblich-technische Berufe" }];
export const fachbereiche = () => setting("fachbereiche", DEFAULT_FB) || DEFAULT_FB;
export const fbName = (id) => fachbereiche().find((f) => f.id === id)?.name || id || "–";
export const berufe = () => setting("berufe", []) || [];
export const berufById = (id) => berufe().find((b) => b.id === id);
// Beruf aus einem gespeicherten Text (ältere Datensätze) bestimmen
export const berufByName = (name) => berufe().find((b) => b.name === name || b.name.replace(/\/-.*$/, "") === String(name || "").replace(/\/-.*$/, ""));
export const berufLabel = (b, by = "name") => (b ? (by === "nr" ? `${b.nr} – ${b.name}` : `${b.name} (${b.nr})`) : "–");
export const examTitle = (m) => [m?.ptitel, [m?.zeitraum, m?.jahr].filter(Boolean).join(" ")].filter(Boolean).join(" ");

// ---------- Auswahl Ausbildungsberuf (nach Name oder Berufsnummer), Prüfungstitel und Prüfungsjahr ----------
const years = () => { const y = new Date().getFullYear(); return [y, y + 1, y + 2, y + 3].map(String); };
export const ZEITRAUM = ["", "Frühjahr", "Sommer", "Herbst", "Winter"];
export function berufPicker(m = {}, { ro = false, id = "bp", req = true } = {}) {
  const by = m._by || "name"; const list = [...berufe()].sort((a, b) => (by === "nr" ? a.nr.localeCompare(b.nr) : a.name.localeCompare(b.name)));
  const b = berufById(m.beruf_id); const dis = ro ? "disabled" : "";
  return `<div class="bpick" data-bpick>
    <div class="field"><span class="lbl">Ausbildungsberuf${req ? " *" : ""}</span>
      <div class="row wrap" style="gap:8px"><div class="segmented sm" role="group" aria-label="Auswahl nach">${[["name", "nach Ausbildungsberuf"], ["nr", "nach Berufsnummer"]].map(([k, l]) => `<button type="button" data-bby="${k}" class="${by === k ? "active" : ""}" ${dis}>${l}</button>`).join("")}</div>
      <div class="search grow" style="min-width:180px"><input class="input" data-bq placeholder="${by === "nr" ? "Berufsnummer eingeben, z. B. 101" : "Beruf suchen"}" aria-label="Ausbildungsberuf suchen" ${dis}>${icon("search")}</div></div>
      <select class="select mt-s" id="${id}-b" data-bsel aria-label="Ausbildungsberuf" ${dis}><option value="">Ausbildungsberuf wählen</option>${list.map((x) => `<option value="${x.id}" data-s="${esc((x.nr + " " + x.name).toLowerCase())}" ${x.id === m.beruf_id ? "selected" : ""}>${esc(berufLabel(x, by))}</option>`).join("")}</select>
      ${b ? `<p class="xs muted" style="margin:4px 0 0">Berufsnummer ${esc(b.nr)} · Fachbereich ${esc(fbName(b.fb))}</p>` : ""}</div>
    <div class="field"><label class="lbl" for="${id}-t">Prüfungstitel${req ? " *" : ""}</label><select class="select" id="${id}-t" data-bt ${dis || (b ? "" : "disabled")}><option value="">${b ? "Prüfungstitel wählen" : "zuerst Beruf wählen"}</option>${(b?.titel || []).map((t) => `<option ${t === m.ptitel ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>
    <div class="grid2"><div class="field"><label class="lbl" for="${id}-z">Prüfungszeitraum</label><select class="select" id="${id}-z" data-bz ${dis}>${ZEITRAUM.map((z) => `<option value="${z}" ${z === (m.zeitraum || "") ? "selected" : ""}>${z || "–"}</option>`).join("")}</select></div>
      <div class="field"><label class="lbl" for="${id}-j">Prüfungsjahr${req ? " *" : ""}</label><select class="select" id="${id}-j" data-bj ${dis}>${[...new Set([...(m.jahr ? [String(m.jahr)] : []), ...years()])].sort().map((y) => `<option ${y === String(m.jahr || years()[1]) ? "selected" : ""}>${y}</option>`).join("")}</select></div></div>
    ${m.ptitel || b ? `<p class="small" data-btitle>Prüfung: <b>${esc(examTitle({ ...m, jahr: m.jahr || years()[1] }) || "–")}</b></p>` : `<p class="small" data-btitle></p>`}</div>`;
}
// Liest die Auswahl; onChange wird bei jeder Änderung mit dem neuen Stand aufgerufen (zum Neuzeichnen)
export function bindBerufPicker(root, m, onChange) {
  const w = root.querySelector("[data-bpick]"); if (!w) return;
  const read = () => ({ ...m, beruf_id: w.querySelector("[data-bsel]").value, ptitel: w.querySelector("[data-bt]").value, zeitraum: w.querySelector("[data-bz]").value, jahr: w.querySelector("[data-bj]").value });
  w.querySelectorAll("[data-bby]").forEach((b) => (b.onclick = () => onChange({ ...read(), _by: b.dataset.bby })));
  const q = w.querySelector("[data-bq]"); const sel = w.querySelector("[data-bsel]");
  q.oninput = () => { const v = q.value.toLowerCase().trim(); let first = null; sel.querySelectorAll("option[data-s]").forEach((o) => { const hit = !v || o.dataset.s.includes(v); o.hidden = !hit; if (hit && !first) first = o; }); if (v && first && (sel.selectedOptions[0]?.hidden || !sel.value)) { sel.value = first.value; onChange({ ...read(), ptitel: "", _q: q.value }); } };
  if (m._q) { q.value = m._q; }
  sel.onchange = () => onChange({ ...read(), ptitel: "" });
  w.querySelector("[data-bt]").onchange = w.querySelector("[data-bz]").onchange = w.querySelector("[data-bj]").onchange = () => onChange(read());
}
// Felder für die Speicherung (beruf/berufsnr/fachbereich/titel)
export function berufMeta(m) {
  const b = berufById(m.beruf_id);
  return { beruf_id: m.beruf_id || "", beruf: b?.name || m.beruf || "", berufsnr: b?.nr || "", fachbereich: b?.fb || m.fachbereich || "", ptitel: m.ptitel || "", zeitraum: m.zeitraum || "", jahr: m.jahr || "", titel: examTitle(m) };
}

// ---------- Unternehmenspools ----------
export const pools = () => D.settings.filter((s) => String(s.key).startsWith("pool:")).map((s) => ({ ...s.value, rid: s.id })).sort((a, b) => String(a.name).localeCompare(String(b.name)));
export const poolById = (id) => pools().find((p) => p.id === id);
export const poolsFor = (fb) => pools().filter((p) => !fb || p.fachbereich === fb);
export async function savePool(data) {
  const id = data.id || Math.random().toString(36).slice(2, 10);
  const rec = D.settings.find((s) => s.key === "pool:" + id);
  const value = { ...(rec?.value || {}), ...data, id };
  if (rec) await upd("settings", rec.id, { value }); else await create("settings", { key: "pool:" + id, value });
  return value;
}
export const POOL_FIELDS = [["name", "Unternehmen", 0], ["branche", "Branche", 0], ["allgemein", "Unternehmensprofil", 3], ["adresse", "Adresse (mehrzeilig)", 3], ["kontakt", "Kontakt", 2], ["rechtliches", "Rechtliches", 2]];
export function poolForm(p = {}, { fbSelect = true, fb = "" } = {}) {
  return `${fbSelect ? `<div class="field"><label class="lbl" for="pf-fb">Fachbereich</label><select id="pf-fb" class="select" data-pf="fachbereich">${fachbereiche().map((f) => `<option value="${f.id}" ${f.id === (p.fachbereich || fb) ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></div>` : `<p class="small">Fachbereich: <b>${esc(fbName(fb || p.fachbereich))}</b> – nur Prüfungen dieses Fachbereichs können den Pool auswählen.</p>`}
    ${POOL_FIELDS.map(([k, l, a]) => `<div class="field"><label class="lbl" for="pf-${k}">${l}${k === "name" ? " *" : ""}</label>${a ? `<textarea id="pf-${k}" class="input" rows="${a}" data-pf="${k}">${esc(p[k] || "")}</textarea>` : `<input id="pf-${k}" class="input" data-pf="${k}" value="${esc(p[k] || "")}">`}</div>`).join("")}`;
}
export const readPoolForm = (m) => { const o = {}; m.querySelectorAll("[data-pf]").forEach((f) => (o[f.dataset.pf] = f.value.trim())); return o; };

// ---------- Korrekturzeichensätze (einheitlich für Erstellung, Prüfung und Unterricht) ----------
export const DEFAULT_SIGNS = JSON.parse(JSON.stringify(SIGNS));
export const signsets = () => setting("signsets", null) || { active: "std", sets: [{ id: "std", name: "Korrekturzeichen (Standard)", groups: DEFAULT_SIGNS }] };
export const activeSignSet = () => { const s = signsets(); return s.sets.find((x) => x.id === s.active) || s.sets[0]; };
export const saveSignsets = (v) => setSetting("signsets", v);
let applied = "";
// Wendet den verbindlichen Zeichensatz auf Korrekturmodus, Favoriten und Handschrifterkennung an
export function applySigns() {
  const set = activeSignSet(); const groups = set?.groups?.length ? set.groups : DEFAULT_SIGNS;
  const key = JSON.stringify(groups); if (key === applied) return false; applied = key;
  SIGNS.length = 0; groups.forEach((g) => SIGNS.push({ group: g.group, items: (g.items || []).filter((i) => i[0]) }));
  ALL_SIGN_KEYS.length = 0; SIGNS.forEach((g) => g.items.forEach((i) => ALL_SIGN_KEYS.push(i[0])));
  resetInk(); return true;
}
// Kürzel, die von der Handschrifterkennung unterstützt werden
export const inkSupported = (k) => [...String(k || "")].every((ch) => INK_CHARS.includes(ch));
export { INK_CHARS };

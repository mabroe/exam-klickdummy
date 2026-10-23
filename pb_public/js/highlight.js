// Textmarkierung in bereitgestellten Texten (Arbeitsauftrag, Ausgangssituation) – Selbstorganisation, wird nicht bewertet
// Gespeichert je Prüfling als Element kind "hl" (data: { key, ranges: [{ s, e, c }] }); Offsets beziehen sich auf den reinen Text
import { icon, esc, toast, confirmBox } from "./ui.js?v=9.1";

export const HL_COLORS = [["y", "Gelb"], ["g", "Grün"], ["r", "Rot"]];
let pop = null; const hidePop = () => { pop?.remove(); pop = null; };
document.addEventListener("mousedown", (e) => { if (pop && !pop.contains(e.target)) hidePop(); }, { capture: true });

// Markierbarer Textblock: html wird unverändert dargestellt, Markierungen werden über die Textknoten gelegt
export function markable(key, html, { label = "Text", cls = "", tag = "div" } = {}) {
  return `<div class="mkwrap" data-mk="${esc(key)}"><${tag} class="mkbody ${cls}" data-mkbody>${html}</${tag}>
    <div class="mktools" role="toolbar" aria-label="Textmarkierung ${esc(label)}">${icon("highlighter")}<span class="xs muted">Text auswählen, um ihn farbig zu markieren</span><span class="grow"></span><button type="button" class="btn xs ghost" data-mkclear hidden>${icon("trash-2")} Markierungen löschen</button></div></div>`;
}

const itemOf = (ctx, key) => ctx.items().find((i) => i.kind === "hl" && i.data?.key === key);
const rangesOf = (ctx, key) => itemOf(ctx, key)?.data?.ranges || [];

function paint(body, ranges) {
  // vorhandene Markierungen entfernen
  body.querySelectorAll("mark.hlm").forEach((m) => m.replaceWith(...m.childNodes));
  body.normalize();
  if (!ranges.length) return;
  const nodes = []; const w = document.createTreeWalker(body, NodeFilter.SHOW_TEXT); let n, pos = 0;
  while ((n = w.nextNode())) { nodes.push({ n, s: pos, e: pos + n.textContent.length }); pos += n.textContent.length; }
  for (const { n, s, e } of nodes) {
    const cuts = ranges.filter((r) => r.s < e && r.e > s).map((r) => ({ a: Math.max(r.s, s) - s, b: Math.min(r.e, e) - s, c: r.c })).sort((x, y) => x.a - y.a);
    if (!cuts.length) continue;
    const t = n.textContent; const frag = document.createDocumentFragment(); let i = 0;
    for (const k of cuts) {
      if (k.a > i) frag.append(t.slice(i, k.a));
      const m = document.createElement("mark"); m.className = `hlm hl-${k.c}`; m.textContent = t.slice(Math.max(i, k.a), k.b); frag.append(m); i = Math.max(i, k.b);
    }
    if (i < t.length) frag.append(t.slice(i));
    n.replaceWith(frag);
  }
}
function offset(root, node, off) {
  const r = document.createRange(); r.setStart(root, 0);
  try { r.setEnd(node, off); } catch { return 0; }
  return r.toString().length;
}
const toRanges = (col) => { const r = []; let i = 0; while (i < col.length) { if (!col[i]) { i++; continue; } let j = i; while (j < col.length && col[j] === col[i]) j++; r.push({ s: i, e: j, c: col[i] }); i = j; } return r; };

// alle markierbaren Blöcke unterhalb von root aktivieren
export function bindMarkables(root, ctx) {
  root.querySelectorAll("[data-mk]").forEach((wrap) => {
    const key = wrap.dataset.mk; const body = wrap.querySelector("[data-mkbody]"); const clr = wrap.querySelector("[data-mkclear]");
    const show = (ranges) => { paint(body, ranges); clr.hidden = !ranges.length; };
    show(rangesOf(ctx, key));
    const save = async (ranges) => {
      show(ranges);
      const it = itemOf(ctx, key);
      try { if (it) await ctx.upd(it.id, { data: { ...it.data, ranges } }); else await ctx.add("hl", "hl", { key, ranges, task: key.split(":")[1]?.split(".")[0] || "" }); }
      catch (e) { toast("Markierung nicht gespeichert", e?.message || "", "error"); }
    };
    const apply = (c) => {
      const sel = window.getSelection(); if (!sel.rangeCount || sel.isCollapsed) return;
      const r = sel.getRangeAt(0); if (!body.contains(r.commonAncestorContainer)) return;
      let a = offset(body, r.startContainer, r.startOffset), b = offset(body, r.endContainer, r.endOffset); if (b < a) [a, b] = [b, a];
      const len = body.textContent.length; if (b <= a) return;
      const col = new Array(len).fill(""); rangesOf(ctx, key).forEach((x) => { for (let i = x.s; i < Math.min(len, x.e); i++) col[i] = x.c; });
      for (let i = a; i < Math.min(len, b); i++) col[i] = c === "none" ? "" : c;
      sel.removeAllRanges(); hidePop(); save(toRanges(col));
    };
    clr.onclick = async () => { if (await confirmBox("Markierungen löschen", "Alle farbigen Markierungen in diesem Text werden entfernt.", "Löschen")) save([]); };
    body.addEventListener("mouseup", () => setTimeout(() => {
      const sel = window.getSelection(); hidePop();
      if (!sel.rangeCount || sel.isCollapsed || !body.contains(sel.getRangeAt(0).commonAncestorContainer)) return;
      const rc = sel.getRangeAt(0).getBoundingClientRect();
      pop = document.createElement("div"); pop.className = "hlpop"; pop.setAttribute("role", "toolbar"); pop.setAttribute("aria-label", "Auswahl markieren");
      pop.innerHTML = `<span class="xs">Markieren</span>${HL_COLORS.map(([k, l]) => `<button type="button" class="hlbtn hl-${k}" data-c="${k}" title="${l}" aria-label="${l} markieren"></button>`).join("")}<button type="button" class="iconbtn" data-c="none" title="Markierung entfernen" aria-label="Markierung entfernen">${icon("eraser")}</button>`;
      document.body.appendChild(pop);
      pop.style.left = Math.max(8, Math.min(window.innerWidth - pop.offsetWidth - 8, rc.left + rc.width / 2 - pop.offsetWidth / 2)) + "px";
      pop.style.top = Math.max(8, rc.top - pop.offsetHeight - 8) + "px";
      pop.querySelectorAll("[data-c]").forEach((btn) => { btn.addEventListener("mousedown", (e) => e.preventDefault()); btn.onclick = () => apply(btn.dataset.c); });
    }, 0));
  });
}

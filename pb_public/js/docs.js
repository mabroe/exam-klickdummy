// Dokumente im Browser: PDF-Seiten rendern (pdf.js), Office-Dateien anzeigen (mammoth, SheetJS) und in PDF umwandeln (jsPDF)
// Alle Bibliotheken liegen lokal unter js/vendor und werden erst bei Bedarf geladen.
const loaded = {};
function script(src) { return (loaded[src] ||= new Promise((ok, fail) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Skript nicht ladbar: " + src)); document.head.appendChild(s); })); }
let pdfjs = null;
async function pdfLib() {
  if (pdfjs) return pdfjs;
  pdfjs = await import("./vendor/pdf.min.mjs?v=8.9");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("./vendor/pdf.worker.min.mjs", import.meta.url).href;
  return pdfjs;
}
async function jsPDFLib() {
  if (!window.jspdf?.jsPDF?.API?.autoTable) { await script("js/vendor/jspdf.umd.min.js"); await script("js/vendor/jspdf.plugin.autotable.min.js"); }
  return window.jspdf.jsPDF;
}
const mammothLib = async () => { await script("js/vendor/mammoth.browser.min.js"); return window.mammoth; };
const xlsxLib = async () => { await script("js/vendor/xlsx.full.min.js"); return window.XLSX; };

export const extOf = (name = "") => (String(name).split(".").pop() || "").toLowerCase();
export const isPdf = (f) => extOf(f) === "pdf";
export const isImage = (f) => /^(png|jpe?g|gif|webp)$/.test(extOf(f));
export const isWord = (f) => /^(docx)$/.test(extOf(f));
export const isSheet = (f) => /^(xlsx|xls|csv|ods)$/.test(extOf(f));
export const isOffice = (f) => isWord(f) || isSheet(f);
const buf = async (url) => { const r = await fetch(url); if (!r.ok) throw new Error("Datei nicht abrufbar (" + r.status + ")"); return r.arrayBuffer(); };

// ---------- PDF → Seitenbilder (Cache je URL) ----------
const pageCache = new Map();
export const cachedPages = (url) => pageCache.get(url)?.pages || null;
export function pdfPages(url, width = 680) {
  if (pageCache.has(url)) return pageCache.get(url).promise;
  const entry = {};
  entry.promise = (async () => {
    const lib = await pdfLib();
    const pdf = await lib.getDocument({ data: new Uint8Array(await buf(url)) }).promise;
    const pages = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 20); i++) {
      const page = await pdf.getPage(i); const v1 = page.getViewport({ scale: 1 }); const scale = (width / v1.width) * 2; const vp = page.getViewport({ scale });
      const cv = document.createElement("canvas"); cv.width = vp.width; cv.height = vp.height;
      await page.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      pages.push({ src: cv.toDataURL("image/png"), w: width, h: Math.round(vp.height / 2) });
    }
    entry.pages = pages; return pages;
  })();
  entry.promise.catch(() => pageCache.delete(url));
  pageCache.set(url, entry);
  return entry.promise;
}

// ---------- Office → HTML (Vorschau) ----------
const htmlCache = new Map();
export async function officeHtml(url, name) {
  const key = url + "|" + name; if (htmlCache.has(key)) return htmlCache.get(key);
  let html;
  if (isWord(name)) { const m = await mammothLib(); html = (await m.convertToHtml({ arrayBuffer: await buf(url) })).value; }
  else { const X = await xlsxLib(); const wb = X.read(await buf(url), { type: "array" }); html = wb.SheetNames.map((n) => `<h4>${n}</h4>` + X.utils.sheet_to_html(wb.Sheets[n], { header: "", footer: "" })).join(""); }
  htmlCache.set(key, html); return html;
}

// ---------- Office → PDF (Korrekturfassung) ----------
const T = (s) => String(s ?? "").replace(/−/g, "-").replace(/[^\x00-\xFF€„“”‚‘’–—…•]/g, "");
export async function officeToPdf(url, name, meta = {}) {
  const jsPDF = await jsPDFLib();
  const doc = new jsPDF({ unit: "mm", format: "a4" }); const W = 210, M = 18; let y = 18;
  const headLine = () => { doc.setFontSize(7.5); doc.setTextColor(120); doc.text(T(`Korrekturfassung (PDF) – automatisch umgewandelt aus ${name}${meta.who ? " · " + meta.who : ""}`), M, 10); doc.setTextColor(0); };
  headLine();
  const ensure = (h) => { if (y + h > 282) { doc.addPage(); headLine(); y = 18; } };
  const para = (text, size = 10.5, bold = false) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(size); const lines = doc.splitTextToSize(T(text), W - 2 * M); lines.forEach((l) => { ensure(size * 0.45); doc.text(l, M, y); y += size * 0.45; }); y += 2; };
  const table = (rows) => { if (!rows.length) return; doc.autoTable({ startY: y, margin: { left: M, right: M }, head: [rows[0].map(T)], body: rows.slice(1).map((r) => r.map(T)), styles: { font: "helvetica", fontSize: 9, cellPadding: 1.6, lineColor: [190, 190, 190], lineWidth: 0.2 }, headStyles: { fillColor: [235, 235, 235], textColor: 20 }, theme: "grid" }); y = doc.lastAutoTable.finalY + 6; };
  if (isWord(name)) {
    const m = await mammothLib(); const html = (await m.convertToHtml({ arrayBuffer: await buf(url) })).value;
    const box = document.createElement("div"); box.innerHTML = html;
    for (const el of box.children) {
      const tag = el.tagName.toLowerCase();
      if (tag === "table") table([...el.rows].map((r) => [...r.cells].map((c) => c.textContent.trim())));
      else if (/^h[1-3]$/.test(tag)) para(el.textContent, tag === "h1" ? 15 : tag === "h2" ? 13 : 11.5, true);
      else if (tag === "ul" || tag === "ol") [...el.children].forEach((li, i) => para((tag === "ol" ? i + 1 + ". " : "• ") + li.textContent));
      else if (el.textContent.trim()) para(el.textContent);
    }
  } else {
    const X = await xlsxLib(); const wb = X.read(await buf(url), { type: "array" });
    for (const n of wb.SheetNames) {
      const rows = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, blankrows: false, defval: "" }).filter((r) => r.some((c) => String(c).trim()));
      para(`Tabellenblatt „${n}“`, 12, true);
      const w = Math.max(...rows.map((r) => r.length), 1); const norm = rows.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? ""));
      // Titelzeilen (nur erste Spalte gefüllt) als Text, Rest als Tabelle
      while (norm.length && norm[0].slice(1).every((c) => !String(c).trim())) para(norm.shift()[0], 11, true);
      table(norm);
    }
  }
  return doc.output("blob");
}

// Download einer Datei unter ihrem Originalnamen
export async function downloadUrl(url, name) {
  try { const b = await (await fetch(url)).blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  catch { window.open(url, "_blank"); }
}

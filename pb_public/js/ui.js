// Gemeinsame UI-Helfer
import { ICONS } from "./icons.js?v=8.8";

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const icon = (name, cls = "") => `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ""}</svg>`;
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const store = {
  get(k, d = null) { try { const v = sessionStorage.getItem("cbw." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem("cbw." + k, JSON.stringify(v)); } catch {} },
  del(k) { try { sessionStorage.removeItem("cbw." + k); } catch {} },
  lget(k, d = null) { try { const v = localStorage.getItem("cbw." + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  lset(k, v) { try { localStorage.setItem("cbw." + k, JSON.stringify(v)); } catch {} },
};

// ---------- Status ----------
export const STATUS = {
  nicht_eingeloggt: "nicht eingeloggt",
  wartend: "wartend",
  wartend_bestaetigt: "wartend – bestätigt",
  laeuft: "läuft",
  pausiert: "pausiert",
  gesperrt: "gesperrt",
  eingesammelt: "Prüfung eingesammelt",
  zeit_beendet: "Bearbeitungszeit beendet",
  abgegeben: "abgegeben",
  beendet: "beendet",
  nicht_teilnahme: "Nicht-Teilnahme",
};
export const statusChip = (s) => `<span class="status st-${esc(s)}">${esc(STATUS[s] || s)}</span>`;
// „Bearbeitungszeit beendet“ ist KEIN Prüfungsende: Die Prüfung läuft weiter, bis die Aufsicht einsammelt/beendet.
export const isActive = (s) => ["laeuft", "pausiert", "gesperrt", "zeit_beendet"].includes(s);
// Für den Prüfling ist die Bearbeitung mit „abgegeben“ beendet; final beendet die Raumaufsicht (Einsammeln/Beenden)
export const isFinished = (s) => ["abgegeben", "eingesammelt", "beendet", "nicht_teilnahme"].includes(s);
export const isCollectable = (s) => isActive(s) || s === "abgegeben";

// ---------- Zeit ----------
export const parseDate = (v) => (v ? new Date(String(v).replace(" ", "T")) : null);
export const toPb = (d = new Date()) => d.toISOString().replace("T", " ");
export const fmtTime = (d) => (d ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–");
export const fmtDateTime = (d) => (d ? d.toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
export const mmss = (ms) => {
  const t = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : String(m).padStart(2, "0")) + ":" + String(s).padStart(2, "0");
};

// Distanzunterricht: fester Zeitraum, Teilnehmende starten selbst; keine Steuerung durch die Lehrkraft
export const isDistance = (room) => room?.mode === "distanz";
export function windowState(room, now = Date.now()) {
  const a = parseDate(room?.window_from)?.getTime(), b = parseDate(room?.window_to)?.getTime();
  if (a && now < a) return "before";
  if (b && now >= b) return "after";
  return "open";
}
// Bearbeitungsende eines Teilnehmenden
export function endTime(room, p) {
  if (!room) return null;
  if (isDistance(room)) {
    const st = parseDate(p?.started_at); if (!st) return null;
    const mins = (room.duration_min || 0) + (p?.extra_time || 0) + (p?.nta || 0);
    const e = new Date(st.getTime() + mins * 60000); const w = parseDate(room.window_to);
    return w && w < e ? w : e;
  }
  const start = parseDate(p?.started_at) || parseDate(room.started_at);
  if (!start) return null;
  const mins = (room.duration_min || 0) + (room.global_extra || 0) + (p?.extra_time || 0) + (p?.nta || 0);
  let pausedMs = (room.paused_total_s || 0) * 1000;
  if (room.state === "PAUSED" && room.paused_at) pausedMs += Date.now() - parseDate(room.paused_at).getTime();
  return new Date(start.getTime() + mins * 60000 + pausedMs);
}
export function plannedEnd(room, p) {
  const s = parseDate(room?.planned_start); if (!s) return null;
  return new Date(s.getTime() + ((room.duration_min || 0) + (room.global_extra || 0) + (p?.extra_time || 0) + (p?.nta || 0)) * 60000);
}
export const isOffline = (p) => !!(p && p.offline_until && parseDate(p.offline_until) > Date.now());
// Heartbeat des Prüflings alle 10 s; ohne Lebenszeichen seit 30 s gilt die Verbindung als unterbrochen
export const HB_MS = 10000, HB_TIMEOUT_MS = 30000;
export const isConnected = (p) => p && p.status !== "nicht_eingeloggt" && !isOffline(p) && (p.simulated || (p.last_seen && Date.now() - parseDate(p.last_seen).getTime() < HB_TIMEOUT_MS));
// Eindeutiger Anmelde- und Verbindungsstatus für die Raumaufsicht
export function connState(p) {
  if (!p || p.status === "nicht_eingeloggt") return { key: "none", label: "nicht angemeldet", short: "nicht angemeldet", icon: "user-round-x", tip: "Hat sich noch nicht angemeldet" };
  if (isOffline(p)) { const s = Math.max(0, Math.ceil((parseDate(p.offline_until) - Date.now()) / 1000)); return { key: "lost", label: "angemeldet · Verbindung unterbrochen", short: "Verbindung unterbrochen", icon: "wifi-off", tip: `Simulierter Verbindungsabbruch – automatische Wiederherstellung in ca. ${s} s` }; }
  if (isFinished(p.status)) return { key: "none", label: "abgemeldet (Prüfung beendet)", short: "abgemeldet", icon: "log-out", tip: "Bearbeitung beendet" };
  if (isConnected(p)) return { key: "ok", label: "angemeldet · verbunden", short: "verbunden", icon: "wifi", tip: p.simulated ? "Angemeldet (simulierte/r Teilnehmende/r)" : "Angemeldet, letztes Lebenszeichen vor " + Math.round((Date.now() - parseDate(p.last_seen)) / 1000) + " s" };
  const ago = p.last_seen ? Math.round((Date.now() - parseDate(p.last_seen)) / 1000) : null;
  return { key: "lost", label: "angemeldet · keine Verbindung", short: "keine Verbindung", icon: "wifi-off", tip: ago != null ? `Kein Lebenszeichen seit ${ago >= 120 ? Math.round(ago / 60) + " Min." : ago + " s"} (Browser geschlossen oder Netz getrennt)` : "Kein Lebenszeichen" };
}
export const connChip = (p, compact = false) => { const c = connState(p); return `<span class="connchip ${c.key}" data-conn="${p.id}" title="${esc(c.tip)}">${icon(c.icon)}${esc(compact ? c.short : c.label)}</span>`; };
// Zeitgutschriften getrennt ausweisen: Nachteilsausgleich (NTA), individuelle Zusatzzeit, Zusatzzeit für den ganzen Raum
export function timeBadges(p, room) {
  const out = [];
  if (p.nta) out.push(`<span class="timebadge nta" title="Nachteilsausgleich (vorab genehmigt)">NTA +${p.nta} Min.</span>`);
  if (p.extra_time) out.push(`<span class="timebadge zz" title="Individuelle Zusatzzeit (z. B. nach Störung)">Zusatzzeit +${p.extra_time} Min.</span>`);
  if (room?.global_extra) out.push(`<span class="timebadge gz" title="Zusatzzeit für den gesamten Raum">Raum +${room.global_extra} Min.</span>`);
  return out.join(" ");
}

// ---------- Toasts ----------
export function toast(title, text = "", type = "success", opts = {}) {
  let host = $(".toasts");
  if (!host) { host = document.createElement("div"); host.className = "toasts"; host.setAttribute("role", "status"); host.setAttribute("aria-live", "polite"); document.body.appendChild(host); }
  const el = document.createElement("div");
  el.className = "toast " + type;
  if (type === "error" || type === "warn") el.setAttribute("role", "alert");
  const ic = type === "success" ? "circle-check" : type === "info" ? "info" : "triangle-alert";
  el.innerHTML = `${icon(ic, "lead")}<div class="grow"><b>${esc(title)}</b>${text ? `<span>${esc(text)}</span>` : ""}${opts.action ? `<div class="mt-s"><button class="btn sm" data-act>${icon("arrow-right")} ${esc(opts.action.label)}</button></div>` : ""}</div><button class="x" aria-label="Schließen">${icon("x")}</button>`;
  el.querySelector(".x").onclick = () => el.remove();
  if (opts.action) el.querySelector("[data-act]").onclick = () => { el.remove(); opts.action.run(); };
  host.appendChild(el);
  if (!opts.sticky) setTimeout(() => el.remove(), opts.ms || 4500);
  return el;
}

// ---------- Modal ----------
// modal({ title, body, footer?, size?, warn?, onMount?(el, close), closable? }) → Promise<any>
export function modal({ title, body, footer = "", size = "", warn = false, info = false, onMount, closable = true, headIcon = "" }) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "backdrop";
    back.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-labelledby="mh-${(modal.n = (modal.n || 0) + 1)}">
      <div class="modal-h">${warn ? icon("triangle-alert", "warn") : ""}${info ? icon("info", "lg") : ""}${headIcon}<h2 id="mh-${modal.n}">${title}</h2>${closable ? `<button class="iconbtn" data-close aria-label="Schließen">${icon("x", "lg")}</button>` : ""}</div>
      <div class="modal-b">${body}</div>
      ${footer ? `<div class="modal-f">${footer}</div>` : ""}
    </div>`;
    let done = false;
    const prevFocus = document.activeElement;
    const close = (v) => { if (done) return; done = true; back.remove(); document.removeEventListener("keydown", onKey); try { prevFocus && prevFocus.isConnected && prevFocus.focus(); } catch {} resolve(v); };
    const onKey = (e) => {
      if (e.key === "Escape" && closable) close(null);
      if (e.key === "Tab") { // Fokus im Dialog halten
        const f = [...back.querySelectorAll("button,input,select,textarea,a[href],[tabindex]:not([tabindex='-1'])")].filter((x) => !x.disabled && x.offsetParent !== null);
        if (!f.length) return; const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    back.addEventListener("mousedown", (e) => { if (e.target === back && closable) close(null); });
    back.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => close(null)));
    back.querySelectorAll("[data-value]").forEach((b) => (b.onclick = () => close(b.dataset.value)));
    document.body.appendChild(back);
    // Fokus auf den Dialog selbst (Bildschirmleser lesen den Titel vor), ohne sichtbaren Fokusrahmen beim Öffnen;
    // Felder mit autofocus erhalten den Fokus direkt
    const dlg = back.querySelector(".modal"); dlg.tabIndex = -1;
    const auto = back.querySelector("[autofocus]");
    setTimeout(() => { try { (auto || dlg).focus({ preventScroll: true }); } catch {} }, 30);
    onMount && onMount(back.querySelector(".modal"), close);
  });
}
export const confirmBox = (title, text, okLabel = "Bestätigen", cancel = "Abbrechen", warn = true) =>
  modal({ title, warn, size: "narrow", body: `<div>${text}</div>`, footer: `<button class="btn" data-value="no">${cancel}</button><button class="btn primary" data-value="ok">${okLabel}</button>` }).then((v) => v === "ok");

// ---------- Drawer ----------
export function drawer({ title, iconName = "", body, footer = "", onMount }) {
  const back = document.createElement("div"); back.className = "drawer-back";
  const d = document.createElement("aside"); d.className = "drawer";
  d.innerHTML = `<div class="drawer-h">${iconName ? icon(iconName) : ""}<span>${title}</span><button class="iconbtn" data-close aria-label="Schließen">${icon("x")}</button></div><div class="drawer-b">${body}</div>${footer ? `<div class="drawer-f">${footer}</div>` : ""}`;
  const close = () => { back.remove(); d.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  back.onclick = close; d.querySelector("[data-close]").onclick = close;
  document.body.append(back, d);
  onMount && onMount(d, close);
  return close;
}

// ---------- Dropdown-Menü ----------
export function popMenu(anchor, items, { align = "right" } = {}) {
  closeMenus();
  const m = document.createElement("div");
  m.className = "menu popmenu";
  m.innerHTML = items.map((it, i) => it === "-" ? `<div class="sep"></div>` : it.header ? `<div class="hd">${esc(it.header)}</div>` : `<button data-i="${i}" ${it.disabled ? "disabled style='opacity:.45'" : ""}>${it.icon ? icon(it.icon) : ""}${esc(it.label)}</button>`).join("");
  const r = anchor.getBoundingClientRect();
  m.style.position = "fixed";
  m.style.top = r.bottom + 6 + "px";
  if (align === "right") m.style.right = Math.max(8, window.innerWidth - r.right) + "px"; else m.style.left = r.left + "px";
  m.setAttribute("role", "menu");
  m.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (!b) return; const it = items[+b.dataset.i]; closeMenus(); it.run && it.run(); });
  m.addEventListener("keydown", (e) => {
    const bs = [...m.querySelectorAll("button:not([disabled])")]; const i = bs.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); bs[(i + 1) % bs.length]?.focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); bs[(i - 1 + bs.length) % bs.length]?.focus(); }
    if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeMenus(); anchor.focus(); }
  });
  m.querySelectorAll("button").forEach((b) => b.setAttribute("role", "menuitem"));
  document.body.appendChild(m);
  // nach oben aufklappen bzw. Höhe begrenzen, wenn unten kein Platz ist
  m.style.maxHeight = Math.max(160, window.innerHeight - 24) + "px"; m.style.overflow = "auto";
  const mh = m.offsetHeight;
  if (r.bottom + 6 + mh > window.innerHeight) {
    const above = r.top - 6 - mh;
    if (above >= 8) m.style.top = above + "px";
    else { m.style.top = "8px"; m.style.maxHeight = window.innerHeight - 16 + "px"; }
  }
  setTimeout(() => { document.addEventListener("mousedown", outside); m.querySelector("button:not([disabled])")?.focus(); }, 0);
  function outside(e) { if (!m.contains(e.target)) { closeMenus(); } }
  m._outside = outside;
  return m;
}
export function closeMenus() { $$(".popmenu").forEach((m) => { document.removeEventListener("mousedown", m._outside); m.remove(); }); }

// ---------- Pagination ----------
export function pager(total, page, per, opts = [5, 10, 25]) {
  const pages = Math.max(1, Math.ceil(total / per));
  const from = total ? (page - 1) * per + 1 : 0, to = Math.min(total, page * per);
  return `<div class="pager"><span>Einträge pro Seite</span><select data-per>${opts.map((o) => `<option ${o === per ? "selected" : ""}>${o}</option>`).join("")}</select><span>${from}–${to} von ${total}</span>
  <button class="iconbtn" data-page="1" ${page <= 1 ? "disabled" : ""} aria-label="Erste Seite">${icon("chevrons-left")}</button>
  <button class="iconbtn" data-page="${page - 1}" ${page <= 1 ? "disabled" : ""} aria-label="Zurück">${icon("chevron-left")}</button>
  <button class="iconbtn" data-page="${page + 1}" ${page >= pages ? "disabled" : ""} aria-label="Weiter">${icon("chevron-right")}</button>
  <button class="iconbtn" data-page="${pages}" ${page >= pages ? "disabled" : ""} aria-label="Letzte Seite">${icon("chevrons-right")}</button></div>`;
}
export function bindPager(root, state, rerender) {
  root.querySelectorAll("[data-page]").forEach((b) => (b.onclick = () => { state.page = +b.dataset.page; rerender(); }));
  const sel = root.querySelector("[data-per]"); if (sel) sel.onchange = () => { state.per = +sel.value; state.page = 1; rerender(); };
}

// Logo „Exam“: Prüfungsbogen mit Haken (Bildmarke) und Wortmarke
export const examMark = (size = 44) => `<svg class="exmark" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="11" fill="#1d1d1b"/><rect x="11" y="12" width="17" height="4" rx="2" fill="#fff"/><rect x="11" y="21" width="12" height="4" rx="2" fill="#fff"/><rect x="11" y="30" width="8" height="4" rx="2" fill="#fff" opacity=".55"/><path d="M24.5 31.5l5 5 9.5-12" fill="none" stroke="#ffff00" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
export const brand = (small = false) => `<a class="brand ${small ? "small" : ""}" href="#/" aria-label="Exam – Startseite">${examMark(small ? 36 : 46)}<span class="wm">Exam</span></a>`;
export const debounce = (fn, ms = 80) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const uid = () => Math.random().toString(36).slice(2, 9);

// ---------- Filter-Dropdown mit Checkboxen ----------
// state.openDd = key hält ein Dropdown nach dem Neuzeichnen offen
export function ddHtml(key, label, options, selected = [], state = {}) {
  const open = state.openDd === key;
  return `<div class="dd ${open ? "open" : ""}" data-dd="${key}"><button class="btn" data-ddbtn aria-expanded="${open}">${esc(label)}${selected.length ? ` (${selected.length})` : ""} ${icon(open ? "chevron-up" : "chevron-down")}</button>
  <div class="menu ${open ? "" : "hidden"}">${options.map((o) => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<label><input type="checkbox" value="${esc(v)}" ${selected.includes(v) ? "checked" : ""}> ${esc(l)}</label>`; }).join("")}</div></div>`;
}
export function bindDd(root, state, onSel, rerender) {
  root.querySelectorAll("[data-dd]").forEach((dd) => {
    const key = dd.dataset.dd;
    dd.querySelector("[data-ddbtn]").onclick = (e) => { e.stopPropagation(); state.openDd = state.openDd === key ? null : key; rerender(); };
    dd.querySelectorAll("input[type=checkbox]").forEach((c) => (c.onchange = () => { onSel(key, [...dd.querySelectorAll("input:checked")].map((x) => x.value)); rerender(); }));
  });
  if (state._off) document.removeEventListener("mousedown", state._off);
  state._off = null;
  if (state.openDd) {
    const off = (e) => { if (!e.target.closest(".dd")) { state.openDd = null; document.removeEventListener("mousedown", off); state._off = null; rerender(); } };
    state._off = off;
    setTimeout(() => document.addEventListener("mousedown", off), 0);
  }
}

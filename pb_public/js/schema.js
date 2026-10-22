// Feldtypen je Collection (entspricht pb_migrations/*). Wird im Browser-Modus für Standardwerte und Typumwandlung genutzt.
const t = "text", n = "number", b = "bool", j = "json", d = "date", f = "file";
const F = (s) => Object.fromEntries(s.split(" ").map((x) => { const [k, ty] = x.split(":"); return [k, ty]; }));
export const SCHEMA = {
  rooms: F(`name:${t} exam_name:${t} exam_code:${t} state:${t} planned_start:${d} start_earliest:${t} start_latest:${t} duration_min:${n} global_extra:${n} capacity:${n} rows:${n} cols:${n} started_at:${d} paused_at:${d} paused_total_s:${n} created_label:${t} lockdown:${b} course:${t} org:${t} owner:${t} layout:${t} venue:${t} group_size:${n} mode:${t} window_from:${d} window_to:${d} repeatable:${b} show_horizon:${b} released:${b}`),
  participants: F(`lastname:${t} firstname:${t} username:${t} group_name:${t} org:${t} room:${t} seat:${t} present:${b} status:${t} extra_time:${n} nta:${n} comment:${t} health:${t} cheat_ack:${b} last_seen:${d} started_at:${d} finished_at:${d} bookmarks:${j} simulated:${b} violations:${n} offline_until:${d} relogin:${b} person:${t} attempt:${n} progress:${j} fired:${j}`),
  supervisors: F(`lastname:${t} firstname:${t} short:${t} username:${t} room:${t} present:${b} from:${t} to:${t} periods:${j} person:${t}`),
  protocol: F(`room:${t} ts:${d} participant:${t} username:${t} seat:${t} action:${t} comment:${t} kind:${t}`),
  items: F(`participant:${t} kind:${t} folder:${t} data:${j} submission:${t} file:${f}`),
  gradings: F(`participant:${t} corrector:${n} points:${j} not_done:${j} marks:${j} released:${b} notes:${j} approvals:${j}`),
  comments: F(`participant:${t} subtask:${t} author:${t} body:${t}`),
  tasks: F(`procedure:${t} procedure_icon:${t} title:${t} icon:${t} due:${t} done:${b} is_new:${b} link:${t} role:${t} task_no:${n} closed:${b}`),
  catalog: F(`title:${t} beruf:${t} fach:${t} jahr:${t} kind:${t} description:${t} duration:${t} creator:${t} tags:${j} contents:${j} mine:${b} copied_from:${t} image:${n}`),
  settings: F(`key:${t} value:${j}`),
  kfiles: F(`participant:${t} subtask:${t} corrector:${n} name:${t} file:${f} kind:${t} source:${t} orig:${t}`),
  orgs: F(`name:${t} short:${t} city:${t}`),
  persons: F(`lastname:${t} firstname:${t} username:${t} org:${t} kind:${t} short:${t} email:${t} orgs:${j}`),
  groups: F(`name:${t} org:${t} kind:${t} source:${t} course:${t} members:${j}`),
  courses: F(`title:${t} kind:${t} catalog:${t} org:${t} orgs:${j} owner:${t} members:${j} groups:${j} status:${t} exam_code:${t} description:${t} corrector:${t} corrections:${j} third:${j} korr_end:${t} dk_threshold:${n} rules:${j} einsicht:${j}`),
  venues: F(`org:${t} name:${t} building:${t} rows:${n} cols:${n} capacity:${n} layout:${t} group_size:${n}`),
};
const DEF = { text: "", number: 0, bool: false, json: null, date: "", file: "" };
// Wert wie PocketBase normalisieren
export function coerce(type, v) {
  if (type === "number") { const x = Number(v); return Number.isFinite(x) ? x : 0; }
  if (type === "bool") return v === true || v === "true" || v === 1 || v === "1" || v === "on";
  if (type === "json") { if (typeof v === "string") { try { return v === "" ? null : JSON.parse(v); } catch { return v; } } return v === undefined ? null : v; }
  if (type === "text" || type === "date" || type === "file") return v == null ? "" : String(v);
  return v;
}
export function normalize(col, rec, partial = false) {
  const s = SCHEMA[col] || {}; const out = {};
  for (const [k, ty] of Object.entries(s)) { if (k in rec) out[k] = coerce(ty, rec[k]); else if (!partial) out[k] = DEF[ty] === null ? null : DEF[ty]; }
  for (const [k, v] of Object.entries(rec)) if (!(k in s) && !(k in out)) out[k] = v;
  return out;
}

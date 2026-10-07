// Проверка, нормализация, слияние и упаковка данных. Без DOM — тестируется в node.
import {DAY} from './format.js';
import {EQUIP} from './data/equipment.js';

export const DB_V = 2;
const PHASES = ['p1', 'p2', 'p3'];
const TYPES = ['w', 'r', 't', 'c'];
const STEPS = [0.5, 1, 1.25, 2, 2.5, 4, 5, 10];

export const emptyDB = () => ({v: DB_V, sessions: [], bw: [], waist: [], goal: null, phase: 'p1', wo: 'А', ach: {}, plan: null, custom: {}, exs: {}, lastBackup: null, settings: {name: '', knee: true}, dismissed: {}, tomb: {sessions: {}, bw: {}, waist: {}}, updatedAt: 0});

const obj = x => x && typeof x === 'object' && !Array.isArray(x);
const okDate = d => typeof d === 'string' && Number.isFinite(Date.parse(d));
const n = v => v === '' || v === null || v === undefined ? NaN : Number(String(v).replace(',', '.'));
const inRange = (v, lo, hi) => Number.isFinite(v) && v >= lo && v <= hi;

function normRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(obj).map(r => ({a: r.a === null || r.a === undefined || r.a === '' ? null : n(r.a), b: n(r.b)}))
    .filter(r => Number.isFinite(r.b) && (r.a === null || Number.isFinite(r.a)));
}

function normSession(s) {
  if (!obj(s) || !okDate(s.date) || !obj(s.entries)) return null;
  const entries = {};
  Object.entries(s.entries).forEach(([id, rows]) => {const r = normRows(rows); if (r.length) entries[id] = r;});
  const knee = s.knee === null || s.knee === undefined || s.knee === '' ? null : Math.min(10, Math.max(0, Math.round(n(s.knee)) || 0));
  const id = (typeof s.id === 'number' || (typeof s.id === 'string' && s.id.trim())) && Number.isFinite(+s.id) && +s.id > 0 ? +s.id : Date.parse(s.date);
  const out = {id, date: new Date(s.date).toISOString(), phase: PHASES.includes(s.phase) ? s.phase : 'p1', wo: String(s.wo ?? ''), knee, entries, dur: Number.isFinite(+s.dur) && s.dur > 0 ? Math.min(600, Math.round(+s.dur)) : null};
  if (obj(s.swaps)) out.swaps = {...s.swaps};
  return out;
}

const byDate = (a, b) => Date.parse(a.date) - Date.parse(b.date);
// Дубли (тот же id и та же дата) убираем; разные тренировки с одинаковым id сохраняем под новым id.
function uniqSessions(arr) {
  const byId = new Map(), out = [];
  arr.forEach(s => {
    const sig = s.date;
    let id = s.id;
    while (byId.has(id)) {if (byId.get(id) === sig) return; id++;}
    byId.set(id, sig);
    out.push(id === s.id ? s : {...s, id});
  });
  return out;
}

function normPlan(p) {
  if (!obj(p) || !PHASES.every(k => obj(p[k]) && obj(p[k].w))) return null;
  const out = {};
  for (const k of PHASES) {
    const ph = p[k], w = {};
    for (const [wo, items] of Object.entries(ph.w)) {
      if (!Array.isArray(items)) return null;
      w[wo] = items.map(x => Array.isArray(x) ? {id: x[0], s: x[1], r: String(x[2] ?? ''), n: x[3] || '', ...(obj(x[4]) ? x[4] : {})} : x)
        .filter(x => obj(x) && typeof x.id === 'string' && inRange(+x.s, 1, 10))
        .map(x => ({...x, s: Math.round(+x.s), r: String(x.r ?? ''), n: String(x.n ?? '')}));
    }
    out[k] = {label: String(ph.label ?? k), sub: String(ph.sub ?? ''), hint: String(ph.hint ?? ''), w};
  }
  return out;
}

function normCustom(c) {
  const out = {};
  if (!obj(c)) return out;
  Object.entries(c).forEach(([id, e]) => {
    if (obj(e) && typeof e.n === 'string' && e.n.trim() && Object.prototype.hasOwnProperty.call(EQUIP, e.img) && TYPES.includes(e.t))
      out[id] = {n: e.n.trim().slice(0, 40), g: String(e.g || ''), img: e.img, t: e.t, setup: String(e.setup || ''), how: Array.isArray(e.how) ? e.how.map(String) : [], bad: Array.isArray(e.bad) ? e.bad.map(String) : [], own: 1};
  });
  return out;
}

function normExs(x) {
  const out = {};
  if (!obj(x)) return out;
  Object.entries(x).forEach(([id, v]) => {
    if (obj(v)) out[id] = {note: typeof v.note === 'string' ? v.note.slice(0, 500) : '', step: STEPS.includes(+v.step) ? +v.step : null};
  });
  return out;
}

// Любой вход → корректный db. Неизвестные упражнения в истории сохраняем.
export function normalizeDB(raw) {
  const d = obj(raw) ? raw : {}, db = emptyDB();
  db.sessions = uniqSessions((Array.isArray(d.sessions) ? d.sessions : []).map(normSession).filter(Boolean)).sort(byDate);
  db.bw = (Array.isArray(d.bw) ? d.bw : []).filter(x => obj(x) && okDate(x.date) && inRange(n(x.kg), 30, 250)).map(x => ({date: x.date, kg: n(x.kg)})).sort(byDate);
  db.waist = (Array.isArray(d.waist) ? d.waist : []).filter(x => obj(x) && okDate(x.date) && inRange(n(x.v), 40, 200)).map(x => ({date: x.date, v: n(x.v)})).sort(byDate);
  db.goal = inRange(n(d.goal), 40, 200) ? n(d.goal) : null;
  db.phase = PHASES.includes(d.phase) ? d.phase : 'p1';
  db.wo = typeof d.wo === 'string' ? d.wo : 'А';
  if (obj(d.ach)) Object.entries(d.ach).forEach(([k, v]) => {if (okDate(v)) db.ach[k] = v;});
  db.plan = normPlan(d.plan);
  db.custom = normCustom(d.custom);
  db.exs = normExs(d.exs);
  db.lastBackup = okDate(d.lastBackup) ? d.lastBackup : null;
  if (obj(d.settings)) db.settings = {name: typeof d.settings.name === 'string' ? d.settings.name.trim().slice(0, 24) : '', knee: d.settings.knee !== false};
  if (obj(d.dismissed)) Object.entries(d.dismissed).forEach(([k, v]) => {if (okDate(v)) db.dismissed[k] = v;});
  if (obj(d.tomb)) ['sessions', 'bw', 'waist'].forEach(k => {if (obj(d.tomb[k])) Object.entries(d.tomb[k]).forEach(([id, v]) => {if (okDate(v)) db.tomb[k][id] = v;});});
  db.sessions = db.sessions.filter(s => !db.tomb.sessions[String(s.id)]);
  db.bw = db.bw.filter(x => !db.tomb.bw[x.date]);
  db.waist = db.waist.filter(x => !db.tomb.waist[x.date]);
  db.updatedAt = Number.isFinite(+d.updatedAt) ? +d.updatedAt : 0;
  return db;
}

export const isEmpty = db => !db.sessions.length && !db.bw.length && !db.waist.length;

const NOT_BACKUP = 'Это не похоже на резервную копию';
const okPhoto = p => obj(p) && typeof p.ex === 'string' && typeof p.data === 'string' && /^data:image\/(jpeg|png|webp|heic);base64,/.test(p.data);

// Новый формат: {app:'gym', db, photos}. Старый (копия из буфера): сам db.
export function parseBackup(text) {
  let d;
  try {d = JSON.parse(String(text).trim());} catch (e) {throw new Error(NOT_BACKUP);}
  let raw = obj(d) && d.app === 'gym' && obj(d.db) ? d.db : d;
  // аварийный файл с экрана сбоя: сырые строки хранилища
  if (obj(d) && !Array.isArray(d.sessions) && ['db', 'prev', 'legacy'].some(k => typeof d[k] === 'string')) {
    for (const k of ['db', 'prev', 'legacy']) {
      try {const x = JSON.parse(d[k]); if (obj(x) && Array.isArray(x.sessions)) {raw = x; break;}} catch (e) {}
    }
  }
  if (!obj(raw) || !Array.isArray(raw.sessions)) throw new Error(NOT_BACKUP);
  const photos = obj(d) && Array.isArray(d.photos) ? d.photos.filter(okPhoto).map(p => ({ex: p.ex, ts: +p.ts || 0, data: p.data, label: String(p.label || '')})) : [];
  return {db: normalizeDB(raw), photos};
}

// Слияние: ничего не удаляет. Записи объединяются, настройки остаются свои.
export function mergeDB(local, inc) {
  if (isEmpty(local)) {
    const db = {...inc, custom: {...inc.custom, ...local.custom}, exs: {...inc.exs, ...local.exs}, plan: local.plan || inc.plan, goal: local.goal ?? inc.goal, lastBackup: local.lastBackup || inc.lastBackup, settings: local.settings && local.settings.name ? local.settings : inc.settings, dismissed: {...inc.dismissed, ...local.dismissed}};
    return {db, added: {sessions: inc.sessions.length, bw: inc.bw.length, waist: inc.waist.length}};
  }
  const ids = new Set(local.sessions.map(s => s.id)), bwD = new Set(local.bw.map(x => x.date)), waD = new Set(local.waist.map(x => x.date));
  const newS = inc.sessions.filter(s => !ids.has(s.id)), newB = inc.bw.filter(x => !bwD.has(x.date)), newW = inc.waist.filter(x => !waD.has(x.date));
  const ach = {...inc.ach};
  Object.entries(local.ach).forEach(([k, v]) => {if (!ach[k] || v < ach[k]) ach[k] = v;});
  const db = {
    ...local,
    sessions: [...local.sessions, ...newS].sort(byDate),
    bw: [...local.bw, ...newB].sort(byDate),
    waist: [...local.waist, ...newW].sort(byDate),
    ach,
    custom: {...inc.custom, ...local.custom},
    exs: {...inc.exs, ...local.exs},
    plan: local.plan || inc.plan,
    goal: local.goal ?? inc.goal,
    settings: local.settings && local.settings.name ? local.settings : inc.settings,
    dismissed: {...inc.dismissed, ...local.dismissed},
  };
  return {db, added: {sessions: newS.length, bw: newB.length, waist: newW.length}};
}

export const makeBackup = (db, photos, now = new Date()) => ({app: 'gym', v: DB_V, exportedAt: now.toISOString(), db, photos});

// Пора делать копию: ещё ни одной копии, 5 тренировок без копии или 14 дней с новыми данными.
export function backupDue(db, now = new Date()) {
  const since = db.lastBackup ? Date.parse(db.lastBackup) : 0;
  const fresh = db.sessions.filter(s => Date.parse(s.date) > since).length;
  const due = fresh > 0 && (!db.lastBackup || fresh >= 5 || (+now - since) / DAY >= 14);
  return {due, n: fresh};
}

// ---- черновик идущей тренировки ----
export const emptyDraft = () => ({start: null, last: null, ex: {}, knee: null, swap: {}, warm: {}, skip: {}});
const fin = v => Number.isFinite(+v) && v !== null && v !== '' ? +v : null;
const strMap = m => obj(m) ? Object.fromEntries(Object.entries(m).filter(([, v]) => typeof v === 'string')) : {};
const boolMap = m => obj(m) ? Object.fromEntries(Object.entries(m).filter(([, v]) => v === true)) : {};

function normDraft(c) {
  if (!obj(c)) return null;
  const d = emptyDraft(), ex = obj(c.ex) ? c.ex : {};
  Object.entries(ex).forEach(([id, rows]) => {
    if (!Array.isArray(rows)) return;
    const r = rows.filter(obj).map(x => {
      const o = {a: x.a === '' || x.a === null || x.a === undefined ? '' : fin(x.a) ?? '', b: x.b === '' || x.b === null || x.b === undefined ? '' : fin(x.b) ?? '', done: x.done === true};
      if (fin(x.t)) o.t = +x.t;
      if (x.edA === true) o.edA = true;
      if (x.edB === true) o.edB = true;
      return o;
    });
    if (r.length) d.ex[id] = r;
  });
  d.start = fin(c.start);
  const ts = Object.values(d.ex).flat().map(x => x.t || 0);
  d.last = fin(c.last) ?? (ts.length && Math.max(...ts) ? Math.max(...ts) : d.start);
  d.knee = fin(c.knee) === null ? null : Math.min(10, Math.max(0, Math.round(+c.knee)));
  d.swap = strMap(c.swap);
  d.skip = boolMap(c.skip);
  if (obj(c.warm)) Object.entries(c.warm).forEach(([id, v]) => {if (Array.isArray(v)) d.warm[id] = v.map(x => x === true);});
  return d;
}

export function normalizeDR(raw) {
  const out = {};
  if (!obj(raw)) return out;
  Object.entries(raw).forEach(([k, v]) => {
    if (k === 'rest') {if (obj(v) && fin(v.end) && fin(v.tot)) out.rest = {end: +v.end, tot: +v.tot, label: String(v.label || 'Отдых')};}
    else if (k === 'updatedAt') {}
    else if (k.includes('|')) {const d = normDraft(v); if (d) out[k] = d;}
  });
  return out;
}

// ---- синхронизация между телефонами ----
// Удаление оставляет «надгробие», чтобы запись не вернулась с другого телефона.
export function tombstone(db, kind, key, now = new Date()) {
  const k = String(key), keep = kind === 'sessions' ? x => String(x.id) !== k : x => x.date !== k;
  return {...db, [kind]: db[kind].filter(keep), tomb: {...db.tomb, [kind]: {...db.tomb[kind], [k]: now.toISOString()}}};
}
export function untomb(db, kind, key) {
  const {[String(key)]: _, ...rest} = db.tomb[kind];
  return {...db, tomb: {...db.tomb, [kind]: rest}};
}

// Слияние копий с двух телефонов: записи объединяются (минус удалённые), настройки — с более свежей стороны.
export function syncMerge(a, b) {
  const newer = (b.updatedAt || 0) > (a.updatedAt || 0) ? b : a, older = newer === a ? b : a;
  const tomb = {};
  ['sessions', 'bw', 'waist'].forEach(k => {tomb[k] = {...a.tomb[k], ...b.tomb[k]};});
  const uniq = (xs, key) => {const m = new Map(); xs.forEach(x => {if (!m.has(key(x))) m.set(key(x), x);}); return [...m.values()];};
  const sessions = uniq([...newer.sessions, ...older.sessions], s => s.id).filter(s => !tomb.sessions[String(s.id)]).sort(byDate);
  const bw = uniq([...newer.bw, ...older.bw], x => x.date).filter(x => !tomb.bw[x.date]).sort(byDate);
  const waist = uniq([...newer.waist, ...older.waist], x => x.date).filter(x => !tomb.waist[x.date]).sort(byDate);
  const ach = {...older.ach};
  Object.entries(newer.ach).forEach(([k, v]) => {if (!ach[k] || v < ach[k]) ach[k] = v;});
  return {
    ...newer, sessions, bw, waist, ach, tomb,
    custom: {...older.custom, ...newer.custom},
    dismissed: {...older.dismissed, ...newer.dismissed},
    lastBackup: [a.lastBackup, b.lastBackup].filter(Boolean).sort().at(-1) || null,
    updatedAt: Math.max(a.updatedAt || 0, b.updatedAt || 0),
  };
}

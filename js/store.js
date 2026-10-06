// Хранение на телефоне: localStorage + предыдущая версия для отката.
// Пока данные не прочитаны успешно, запись запрещена — пустые данные не затрут историю.
import {normalizeDB, normalizeDR, emptyDB, emptyDraft} from './backup.js';

const K = {db: 'gym.db', prev: 'gym.db.prev', dr: 'gym.draft', snap: 'gym.db.before-import'};
const LEGACY = {db: 'gym-db', dr: 'gym-draft3'};

export const state = {db: emptyDB(), dr: {}, ok: false, warn: null, saveFailed: false};

const LS = {
  get: k => {try {return localStorage.getItem(k);} catch (e) {return null;}},
  set: (k, v) => {try {localStorage.setItem(k, v); return true;} catch (e) {console.error('save failed', k, e); return false;}},
  del: k => {try {localStorage.removeItem(k);} catch (e) {}},
};
export const storageWorks = () => {try {localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); return true;} catch (e) {return false;}};

// undefined — строка повреждена (сырая копия сохранена рядом), null — данных нет.
function parse(key) {
  const raw = LS.get(key);
  if (!raw) return null;
  try {return JSON.parse(raw);} catch (e) {
    console.error('corrupt', key, e);
    LS.set(`${key}.corrupt.${Date.now()}`, raw);
    return undefined;
  }
}

export function load() {
  state.warn = null;
  state.saveFailed = false;
  let raw = parse(K.db);
  if (raw === undefined || (raw && !Array.isArray(raw.sessions))) {
    const prev = parse(K.prev);
    raw = prev && Array.isArray(prev.sessions) ? prev : null;
    state.warn = raw ? 'Данные были повреждены — восстановлена предыдущая версия.' : 'Данные повреждены. Сырая копия сохранена — восстанови из резервной копии.';
  }
  if (raw === null && !state.warn) {
    const old = parse(LEGACY.db);
    if (old && Array.isArray(old.sessions)) raw = old;
  }
  state.db = normalizeDB(raw);
  const dr = parse(K.dr) ?? parse(LEGACY.dr);
  state.dr = normalizeDR(dr);
  state.ok = true;
}

export function rawExport() {
  return JSON.stringify({db: LS.get(K.db), prev: LS.get(K.prev), dr: LS.get(K.dr), legacy: LS.get(LEGACY.db)});
}

export function setDB(next) {
  state.db = {...next, updatedAt: Date.now()};
  if (!state.ok) return false;
  const cur = LS.get(K.db);
  if (cur) LS.set(K.prev, cur);
  const ok = LS.set(K.db, JSON.stringify(state.db));
  state.saveFailed = !ok;
  return ok;
}
export const updDB = fn => setDB(fn(state.db));

export function setDR(next) {
  state.dr = next;
  if (!state.ok) return false;
  const ok = LS.set(K.dr, JSON.stringify(next));
  if (!ok) state.saveFailed = true;
  return ok;
}
export const draft = k => state.dr[k] || emptyDraft();
export const patchDraft = (k, fn) => setDR({...state.dr, [k]: fn(draft(k))});
export function dropDraft(k) {const {[k]: _, ...rest} = state.dr; return setDR(rest);}
export const setRest = rest => {const {rest: _, ...d} = state.dr; return setDR(rest ? {...d, rest} : d);};

export function snapshot() {return LS.set(K.snap, JSON.stringify(state.db));}
export function undoSnapshot() {
  const raw = parse(K.snap);
  if (!raw) return false;
  setDB(normalizeDB(raw));
  LS.del(K.snap);
  return true;
}
export const hasSnapshot = () => !!LS.get(K.snap);

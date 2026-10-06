// Хранение на телефоне: localStorage + предыдущая версия для отката.
// Пока данные не прочитаны успешно, запись запрещена — пустые данные не затрут историю.
import {normalizeDB, normalizeDR, emptyDB, emptyDraft} from './backup.js';

// Профили: у основного — прежние ключи (совместимость), у остальных — свои с суффиксом @id.
const PROF = 'gym.profiles', ACTIVE = 'gym.active', MAIN = 'main', NAME_MAX = 24;
const keysFor = pid => pid === MAIN ? {db: 'gym.db', prev: 'gym.db.prev', dr: 'gym.draft', snap: 'gym.db.before-import'}
  : {db: `gym.db@${pid}`, prev: `gym.db.prev@${pid}`, dr: `gym.draft@${pid}`, snap: `gym.db.before-import@${pid}`};
let K = keysFor(MAIN);
const LEGACY = {db: 'gym-db', dr: 'gym-draft3'};

export const state = {db: emptyDB(), dr: {}, ok: false, warn: null, saveFailed: false, memOnly: false};
const failed = () => {state.saveFailed = true; try {dispatchEvent(new Event('gym:savefail'));} catch (e) {}};

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
  const pid = activeProfile();
  K = keysFor(pid);
  let raw = parse(K.db);
  if (raw === undefined || (raw && !Array.isArray(raw.sessions))) {
    const prev = parse(K.prev);
    raw = prev && Array.isArray(prev.sessions) ? prev : null;
    state.warn = raw ? 'Данные были повреждены — восстановлена предыдущая версия.' : 'Данные повреждены. Сырая копия сохранена — восстанови из резервной копии.';
    if (!raw) {LS.set(`${K.db}.corrupt.${Date.now()}`, LS.get(K.db) || ''); state.dr = normalizeDR(parse(K.dr)); state.ok = false; return;}
  }
  if (raw === null && !state.warn && pid === MAIN) {
    const old = parse(LEGACY.db);
    if (old && Array.isArray(old.sessions)) raw = old;
  }
  state.db = normalizeDB(raw);
  const dr = parse(K.dr) ?? (pid === MAIN ? parse(LEGACY.dr) : null);
  state.dr = normalizeDR(dr);
  state.ok = true;
  state.memOnly = !storageWorks();
  LS.del(K.snap);
}

export function rawExport() {
  const corrupt = {};
  try {Object.keys(localStorage).filter(k => k.includes('.corrupt.')).forEach(k => {corrupt[k] = LS.get(k);});} catch (e) {}
  return JSON.stringify({db: LS.get(K.db), prev: LS.get(K.prev), dr: LS.get(K.dr), legacy: LS.get(LEGACY.db), corrupt});
}
// После повреждения обеих копий запись разрешается только явным действием — восстановлением.
export const unlock = () => {state.ok = true;};

// Показываем только то, что действительно сохранилось.
export function setDB(next) {
  const cand = {...next, updatedAt: Date.now()};
  if (!state.ok) return false;
  if (state.memOnly) {state.db = cand; failed(); return false;}
  const cur = LS.get(K.db);
  if (cur) LS.set(K.prev, cur);
  const ok = LS.set(K.db, JSON.stringify(cand));
  if (ok) state.db = cand; else failed();
  state.saveFailed = !ok;
  return ok;
}
export const updDB = fn => setDB(fn(state.db));

export function setDR(next) {
  state.dr = next;
  if (!state.ok && !state.warn) return false;
  const ok = LS.set(K.dr, JSON.stringify(next));
  if (!ok) failed();
  return ok;
}
export const draft = k => state.dr[k] || emptyDraft();
export const patchDraft = (k, fn) => setDR({...state.dr, [k]: fn(draft(k))});
export function dropDraft(k) {const {[k]: _, ...rest} = state.dr; return setDR(rest);}
export const setRest = rest => {const {rest: _, ...d} = state.dr; return setDR(rest ? {...d, rest} : d);};

export function snapshot() {LS.del(K.snap); return LS.set(K.snap, JSON.stringify(state.db));}
export const dropSnapshot = () => LS.del(K.snap);
export function undoSnapshot() {
  const raw = parse(K.snap);
  if (!raw) return false;
  setDB(normalizeDB(raw));
  LS.del(K.snap);
  return true;
}
export const hasSnapshot = () => !!LS.get(K.snap);

// ---- профили ----
function readList() {
  let list = [];
  try {list = JSON.parse(LS.get(PROF) || '[]');} catch (e) {list = [];}
  list = Array.isArray(list) ? list.filter(p => p && typeof p.id === 'string' && typeof p.name === 'string') : [];
  if (!list.some(p => p.id === MAIN)) list.unshift({id: MAIN, name: 'Я'});
  return list;
}
export const profiles = () => readList();
export function activeProfile() {const id = LS.get(ACTIVE); return id && readList().some(p => p.id === id) ? id : MAIN;}
const cleanName = n => {const s = String(n || '').trim().slice(0, NAME_MAX); if (!s) throw new Error('Введи имя'); return s;};

export function switchProfile(pid) {
  if (!readList().some(p => p.id === pid)) return false;
  LS.set(ACTIVE, pid);
  load();
  return true;
}
export function addProfile(name, opts = {}) {
  const n = cleanName(name), id = 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  LS.set(PROF, JSON.stringify([...readList(), {id, name: n}]));
  switchProfile(id);
  setDB({...state.db, settings: {name: n, knee: opts.knee !== false}});
  return id;
}
export function renameProfile(pid, name) {
  const n = cleanName(name);
  LS.set(PROF, JSON.stringify(readList().map(p => p.id === pid ? {...p, name: n} : p)));
  if (pid === activeProfile()) setDB({...state.db, settings: {...state.db.settings, name: n}});
}
export function deleteProfile(pid) {
  if (pid === MAIN || !readList().some(p => p.id === pid)) return false;
  const ks = Object.values(keysFor(pid));
  try {Object.keys(localStorage).filter(k => k.endsWith('@' + pid) || k.includes('@' + pid + '.')).forEach(k => LS.del(k));} catch (e) {}
  ks.forEach(LS.del);
  LS.set(PROF, JSON.stringify(readList().filter(p => p.id !== pid)));
  if (LS.get(ACTIVE) === pid) switchProfile(MAIN);
  return true;
}

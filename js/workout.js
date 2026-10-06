// Идущая тренировка: черновик, подходы, завершение. Без отрисовки.
import {state, draft, patchDraft, setDB, dropDraft} from './store.js';
import * as P from './program.js';
import * as L from './logic.js';
import {stats, checkAch} from './stats.js';

export const STALE_MS = 3 * 3600e3;
export const MAX_DUR_MIN = 300;
export const keyOf = (phase, wo) => phase + '|' + wo;
export const curKey = () => keyOf(state.db.phase, state.db.wo);
const hasDone = c => Object.values(c.ex).some(rows => rows.some(x => x.done));

export function liveKeys() {return Object.keys(state.dr).filter(k => k.includes('|') && state.dr[k].start && hasDone(state.dr[k]));}
export function activeKey() {const ks = liveKeys(); return ks.includes(curKey()) ? curKey() : ks[0] || null;}
export const isStale = (c, now = Date.now()) => !!c.last && now - c.last > STALE_MS;
export const splitKey = k => {const i = k.indexOf('|'); return [k.slice(0, i), k.slice(i + 1)];};

export function itemsFor(k) {const [ph, wo] = splitKey(k); return P.itemsOf(state.db, ph, wo, draft(k).swap);}

export function optsFor(k, it, now = new Date()) {
  const [ph] = splitKey(k), e = P.exOf(state.db, it.id);
  return {sessions: state.db.sessions, id: it.id, t: e.t, sets: it.s, reps: it.r, step: P.stepOf(state.db, it.id), phase: ph, now, knee: e.knee};
}
export const aimFor = (k, it) => L.aim(optsFor(k, it));
export const rowsFor = (k, it) => draft(k).ex[it.id] || L.defaults(optsFor(k, it));

export function progressOf(k) {
  const c = draft(k);
  let done = 0, total = 0;
  itemsFor(k).forEach(it => {
    const rows = rowsFor(k, it);
    total += rows.length;
    done += c.skip[it.id] ? rows.length : rows.filter(x => x.done).length;
  });
  return {done, total};
}
export const exDone = (k, it) => draft(k).skip[it.id] || rowsFor(k, it).every(x => x.done);

// ---- изменения черновика (всегда новые объекты) ----
export function setRows(k, id, rows) {
  patchDraft(k, c => ({...c, ex: {...c.ex, [id]: rows}}));
}
// Возвращает false, если черновик устарел: его сначала сохраняют или удаляют.
export function markSet(k, it, idx, done, now = Date.now()) {
  const c0 = draft(k);
  if (done && c0.start && isStale(c0, now)) return false;
  const rows = rowsFor(k, it), x = rows[idx];
  const next = rows.map((r, j) => {
    if (j === idx) return done ? {...r, done: true, t: now} : {...r, done: false};
    // вес переносим только в подходы, которые ещё не трогали руками
    if (done && j > idx && !r.done && !r.edA && P.exOf(state.db, it.id).t === 'w') return {...r, a: x.a};
    return r;
  });
  patchDraft(k, c => ({...c, start: c.start && hasDone(c) ? c.start : done ? now : c.start, last: done ? now : c.last, ex: {...c.ex, [it.id]: next}}));
  return true;
}
// Пустое значение в отмеченном подходе не снимает ✓ — об этом предупредит «Завершить».
export function editField(k, it, idx, f, v) {
  const rows = rowsFor(k, it);
  const next = rows.map((r, j) => j !== idx ? r : {...r, [f]: v, [f === 'a' ? 'edA' : 'edB']: true});
  setRows(k, it.id, next);
}
export function addSet(k, it) {const rows = rowsFor(k, it), l = rows[rows.length - 1] || {a: '', b: ''}; setRows(k, it.id, [...rows, {a: l.a, b: l.b, done: false}]);}
export function removeSet(k, it, idx) {const rows = rowsFor(k, it); if (rows.length > 1 && !rows[idx].done) setRows(k, it.id, rows.filter((_, j) => j !== idx));}
export const setSkip = (k, id, on) => patchDraft(k, c => {const {[id]: _, ...rest} = c.skip; return {...c, skip: on ? {...rest, [id]: true} : rest};});
export const setKnee = (k, v) => patchDraft(k, c => ({...c, knee: v}));
export const setWarm = (k, id, arr) => patchDraft(k, c => ({...c, warm: {...c.warm, [id]: arr}}));
export function swapEx(k, origId, toId) {
  patchDraft(k, c => {
    const {[origId]: _, ...swap} = c.swap, cur = c.swap[origId] || origId, {[cur]: __, ...ex} = c.ex;
    return {...c, ex, swap: toId === origId ? swap : {...swap, [origId]: toId}};
  });
}

// Что не отмечено: подходы без ✓ и отмеченные, но с пустыми числами.
export function pending(k) {
  const c = draft(k), out = [];
  itemsFor(k).forEach(it => {
    if (c.skip[it.id]) return;
    const t = P.exOf(state.db, it.id).t;
    const n = rowsFor(k, it).filter(x => !x.done || x.b === '' || (t === 'w' && x.a === '')).length;
    if (n) out.push({id: it.id, n});
  });
  return out;
}

const doneRows = (t, rows) => (rows || []).filter(x => x.done && x.b !== '' && (t !== 'w' || x.a !== ''));
// Сохраняет и то, что убрали из программы посреди тренировки: отмеченное не теряется.
export function buildSession(k, now = Date.now()) {
  const c = draft(k), [phase, wo] = splitKey(k), entries = {};
  const add = id => {
    const t = P.exOf(state.db, id).t, rows = doneRows(t, c.ex[id]);
    if (rows.length && !entries[id]) entries[id] = rows;
  };
  itemsFor(k).forEach(it => add(it.id));
  Object.keys(c.ex).forEach(add);
  if (!Object.keys(entries).length) return null;
  const ts = Object.values(entries).flat().map(x => x.t).filter(Boolean);
  const start = ts.length ? Math.min(...ts) : c.start, last = ts.length ? Math.max(...ts) : c.last;
  const end = last && now - last > STALE_MS ? last : now;
  const dur = start ? Math.min(MAX_DUR_MIN, Math.max(1, Math.round((Math.min(end, last || end) - start) / 60000))) : null;
  const swaps = Object.keys(c.swap).length ? {...c.swap} : undefined;
  const out = Object.fromEntries(Object.entries(entries).map(([id, rows]) => {const t = P.exOf(state.db, id).t; return [id, rows.map(x => ({a: t === 'w' ? +x.a : null, b: +x.b}))];}));
  return {id: end, date: new Date(end).toISOString(), phase, wo, knee: c.knee, entries: out, dur, ...(swaps ? {swaps} : {})};
}
export const needsKnee = k => {const s = buildSession(k); return draft(k).knee === null && !!s && Object.keys(s.entries).some(id => P.exOf(state.db, id).knee);};

// Сохраняет тренировку. Черновик удаляется только если запись прошла.
export function commit(k, s) {
  const before = state.db.ach, sessions = [...state.db.sessions, s];
  const {ach, fresh} = checkAch(before, stats({...state.db, sessions}, new Date()));
  if (!setDB({...state.db, sessions, ach})) return {ok: false, fresh: []};
  const keep = state.dr[k];
  dropDraft(k);
  return {ok: true, fresh, keep, prevAch: before};
}
// Отмена: убирает тренировку, возвращает черновик и достижения, какими они были.
export function undoCommit(s, k, keep, prevAch) {
  setDB({...state.db, sessions: state.db.sessions.filter(x => x.id !== s.id), ach: prevAch || state.db.ach});
  if (keep) patchDraft(k, () => keep);
}

export function restFor(it, phase) {
  const e = P.exOf(state.db, it.id);
  if (e.g === 'cardio' || it.ss) return 0;
  if (e.t === 't') return 60;
  if (phase === 'p1') return 75;
  return ['quads', 'hams', 'glutes', 'chest', 'backv', 'backh', 'press'].includes(e.g) ? 120 : 90;
}

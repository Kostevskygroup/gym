import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: k => mem.has(k) ? mem.get(k) : null,
  setItem: (k, v) => {if (globalThis.__full) throw new Error('QuotaExceededError'); mem.set(k, String(v));},
  removeItem: k => mem.delete(k),
};

const store = await import('../js/store.js');
const WK = await import('../js/workout.js');
const {emptyDB} = await import('../js/backup.js');

const K = 'p2|Низ 1';
const fresh = (db = {}) => {mem.clear(); globalThis.__full = false; mem.set('gym.db', JSON.stringify({...emptyDB(), phase: 'p2', wo: 'Низ 1', ...db})); store.load();};
const item = id => WK.itemsFor(K).find(x => x.id === id);

beforeEach(() => fresh());

test('load: corrupt main data falls back to the previous copy and keeps the raw string', () => {
  mem.clear();
  mem.set('gym.db', '{broken');
  mem.set('gym.db.prev', JSON.stringify({...emptyDB(), sessions: [{id: 1, date: '2026-10-01T10:00:00Z', entries: {lat: [{a: 40, b: 10}]}}]}));
  store.load();
  assert.equal(store.state.db.sessions.length, 1);
  assert.match(store.state.warn, /предыдущая/);
  assert.ok([...mem.keys()].some(k => k.startsWith('gym.db.corrupt.')));
});

test('load: migrates data from the old single-file version', () => {
  mem.clear();
  mem.set('gym-db', JSON.stringify({sessions: [{id: 5, date: '2026-09-01T10:00:00Z', phase: 'p1', wo: 'А', knee: 0, entries: {lat: [{a: 30, b: 12}]}, prs: []}], bw: [], waist: [], goal: null, phase: 'p1', wo: 'А', ach: {}}));
  store.load();
  assert.equal(store.state.db.sessions[0].id, 5);
});

test('setDB keeps the previous version for rollback', () => {
  store.setDB({...store.state.db, goal: 90});
  store.setDB({...store.state.db, goal: 85});
  assert.equal(JSON.parse(mem.get('gym.db.prev')).goal, 90);
});

test('setDB reports failure when storage is full', () => {
  globalThis.__full = true;
  assert.equal(store.setDB({...store.state.db, goal: 80}), false);
  assert.equal(store.state.saveFailed, true);
});

test('marking a set starts the session and copies weight only to untouched sets', () => {
  const it = item('legpress');
  WK.editField(K, it, 0, 'a', 100);
  WK.editField(K, it, 2, 'a', 90);
  WK.markSet(K, it, 0, true, 1000);
  const rows = WK.rowsFor(K, it), c = store.draft(K);
  assert.equal(c.start, 1000);
  assert.equal(c.last, 1000);
  assert.equal(rows[0].done, true);
  assert.equal(rows[1].a, 100);
  assert.equal(rows[2].a, 90);
  assert.equal(WK.activeKey(), K);
});

test('clearing a done set un-ticks it so it is not saved as 0', () => {
  const it = item('legpress');
  WK.editField(K, it, 0, 'a', 100);
  WK.markSet(K, it, 0, true);
  WK.editField(K, it, 0, 'b', '');
  assert.equal(WK.rowsFor(K, it)[0].done, false);
});

test('add / remove sets; done sets cannot be removed', () => {
  const it = item('legpress'), n = WK.rowsFor(K, it).length;
  WK.addSet(K, it);
  assert.equal(WK.rowsFor(K, it).length, n + 1);
  WK.removeSet(K, it, n);
  assert.equal(WK.rowsFor(K, it).length, n);
  WK.editField(K, it, 0, 'a', 100);
  WK.markSet(K, it, 0, true);
  WK.removeSet(K, it, 0);
  assert.equal(WK.rowsFor(K, it).length, n);
});

test('swap replaces the exercise for today and can be reverted', () => {
  WK.swapEx(K, 'legpress', 'gobletbox');
  assert.ok(item('gobletbox'));
  assert.equal(item('gobletbox').orig, 'legpress');
  WK.swapEx(K, 'legpress', 'legpress');
  assert.ok(item('legpress'));
  assert.equal(item('legpress').orig, undefined);
});

test('skip counts as complete for progress and is excluded from pending', () => {
  const total = WK.progressOf(K).total;
  WK.setSkip(K, 'legpress', true);
  assert.equal(WK.progressOf(K).done, WK.rowsFor(K, item('legpress')).length);
  assert.ok(!WK.pending(K).some(p => p.id === 'legpress'));
  assert.equal(WK.progressOf(K).total, total);
});

test('knee question is required only when knee exercises are in the workout', () => {
  assert.equal(WK.needsKnee(K), true);
  WK.setKnee(K, 2);
  assert.equal(WK.needsKnee(K), false);
});

test('buildSession: only done sets with values; stale draft keeps its own date and capped duration', () => {
  assert.equal(WK.buildSession(K), null);
  const it = item('legpress'), t0 = Date.parse('2026-10-01T10:00:00Z');
  WK.editField(K, it, 0, 'a', 100);
  WK.markSet(K, it, 0, true, t0);
  WK.markSet(K, it, 1, true, t0 + 30 * 60e3);
  const s = WK.buildSession(K, t0 + 48 * 3600e3);
  assert.deepEqual(s.entries.legpress, [{a: 100, b: WK.rowsFor(K, it)[0].b}, {a: 100, b: WK.rowsFor(K, it)[1].b}]);
  assert.equal(s.date, new Date(t0 + 30 * 60e3).toISOString());
  assert.equal(s.dur, 30);
  assert.equal(WK.isStale(store.draft(K), t0 + 48 * 3600e3), true);
});

test('commit saves the session, unlocks achievements, removes the draft; undo restores both', () => {
  const it = item('legpress');
  WK.editField(K, it, 0, 'a', 100);
  WK.markSet(K, it, 0, true);
  const s = WK.buildSession(K);
  const r = WK.commit(K, s);
  assert.equal(r.ok, true);
  assert.ok(r.fresh.includes('Первая трен.'));
  assert.equal(store.state.db.sessions.length, 1);
  assert.equal(store.state.dr[K], undefined);
  WK.undoCommit(s, K, r.keep);
  assert.equal(store.state.db.sessions.length, 0);
  assert.equal(WK.rowsFor(K, it)[0].done, true);
});

test('commit keeps the draft when saving fails', () => {
  const it = item('legpress');
  WK.editField(K, it, 0, 'a', 100);
  WK.markSet(K, it, 0, true);
  const s = WK.buildSession(K);
  globalThis.__full = true;
  assert.equal(WK.commit(K, s).ok, false);
  assert.ok(store.state.dr[K]);
});

test('rest: superset first exercise gets no rest, compound 120 s in phase 2', () => {
  assert.equal(WK.restFor({id: 'cablecurl', ss: 1}, 'p3'), 0);
  assert.equal(WK.restFor({id: 'legpress'}, 'p2'), 120);
  assert.equal(WK.restFor({id: 'lateral'}, 'p2'), 90);
  assert.equal(WK.restFor({id: 'bike'}, 'p2'), 0);
  assert.equal(WK.restFor({id: 'legpress'}, 'p1'), 75);
});

test('snapshot / undoSnapshot roll back an import', () => {
  store.setDB({...store.state.db, goal: 90});
  store.snapshot();
  store.setDB({...store.state.db, goal: 70});
  assert.equal(store.undoSnapshot(), true);
  assert.equal(store.state.db.goal, 90);
  assert.equal(store.hasSnapshot(), false);
});

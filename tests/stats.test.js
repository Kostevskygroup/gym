import {test} from 'node:test';
import assert from 'node:assert/strict';
import {stats, checkAch, ACH} from '../js/stats.js';
import {emptyDB} from '../js/backup.js';

const S = (i, entries, extra = {}) => ({id: i, date: new Date(2026, 9, i, 10).toISOString(), phase: 'p1', wo: 'А', knee: 0, entries, dur: 50, ...extra});
const now = new Date(2026, 9, 20);

test('stats summarises history', () => {
  const db = {...emptyDB(), sessions: [S(1, {lat: [{a: 50, b: 10}]}), S(3, {lat: [{a: 50, b: 12}]})], bw: [{date: '2026-10-01', kg: 100}, {date: '2026-10-10', kg: 97}]};
  const st = stats(db, now);
  assert.equal(st.allPRs.length, 1);
  assert.equal(st.total, 1100);
  assert.equal(st.kgLost, 3);
  assert.equal(st.last30, 2);
});

test('checkAch is immutable and reports only new achievements', () => {
  const db = {...emptyDB(), sessions: [S(1, {lat: [{a: 50, b: 10}]})]};
  const ach0 = {};
  const r = checkAch(ach0, stats(db, now));
  assert.deepEqual(ach0, {});
  assert.ok(r.ach.first);
  assert.deepEqual(r.fresh, ['Первая тренировка']);
  assert.deepEqual(checkAch(r.ach, stats(db, now)).fresh, []);
});

test('knee achievement needs 5 recorded leg days with low pain', () => {
  const legs = [1, 2, 3, 4, 5].map(i => S(i, {legpress: [{a: 80, b: 12}]}, {knee: 1}));
  const upper = [6, 7].map(i => S(i, {lat: [{a: 40, b: 10}]}, {knee: 9}));
  const st = stats({...emptyDB(), sessions: [...legs, ...upper]}, now);
  assert.ok(ACH.find(a => a[0] === 'knee')[3](st));
  const st2 = stats({...emptyDB(), sessions: legs.map(s => ({...s, knee: null}))}, now);
  assert.ok(!ACH.find(a => a[0] === 'knee')[3](st2));
});

test('all-machines achievement counts gym equipment, not exercises', () => {
  const eqEx = ['legpress', 'lat', 'chest', 'shoulder', 'row', 'legcurl', 'legext', 'smithbench', 'rope', 'hammer', 'incline', 'crunch', 'bike'];
  const st = stats({...emptyDB(), sessions: eqEx.map((id, i) => S(i + 1, {[id]: [{a: 10, b: 10}]}))}, now);
  assert.ok(ACH.find(a => a[0] === 'all')[3](st));
  const st2 = stats({...emptyDB(), sessions: eqEx.slice(1).map((id, i) => S(i + 1, {[id]: [{a: 10, b: 10}]}))}, now);
  assert.ok(!ACH.find(a => a[0] === 'all')[3](st2));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {roadmap, lastDeltas, monthDeltas, deltaTxt} from '../js/journey.js';

const DAY = 864e5, T0 = new Date(2026, 8, 7, 10).getTime(); // понедельник
const S = (day, entries, extra = {}) => ({id: T0 + day * DAY, date: new Date(T0 + day * DAY).toISOString(), phase: 'p1', wo: 'А', entries, ...extra});
const EX = {legpress: {t: 'w', n: 'Жим ногами'}, plank: {t: 't', n: 'Планка'}, bike: {t: 'c', n: 'Велосипед'}, lat: {t: 'w', n: 'Тяга'}};
const exOf = id => EX[id];

test('roadmap: plan week, stage statuses and workouts per week of the current stage', () => {
  const ss = [S(0, {}), S(2, {}), S(7, {}), S(9, {}), S(11, {}), S(14, {}, {phase: 'p2'})];
  const r = roadmap(ss, 'p2', new Date(T0 + 15 * DAY));
  assert.equal(r.week, 3);
  assert.deepEqual(r.stages.map(s => s.status), ['done', 'now', 'next']);
  assert.deepEqual(r.stages.map(s => s.done), [5, 1, 0]);
  assert.equal(r.next, 'p3');
  // этап 2 — недели 4–10: текущая неделя 3 (переход раньше срока) показывается первой
  assert.equal(r.weeks[0].n, 3);
  assert.equal(r.weeks[0].cur, true);
  assert.equal(r.weeks[0].count, 1);
  assert.equal(r.weeks.at(-1).n, 10);
  assert.ok(r.weeks.slice(1).every(w => w.future && w.count === 0));
  assert.equal(r.left, 8);
});

test('roadmap: stage overstayed — weeks continue past its end, nothing left', () => {
  const ss = [0, 7, 14, 21].map(d => S(d, {}));
  const r = roadmap(ss, 'p1', new Date(T0 + 22 * DAY));
  assert.equal(r.week, 4);
  assert.deepEqual(r.weeks.map(w => w.n), [1, 2, 3, 4]);
  assert.equal(r.weeks[3].cur, true);
  assert.equal(r.left, 0);
});

test('roadmap: open-ended last stage ends at the current week', () => {
  const r = roadmap([S(0, {}, {phase: 'p3'})], 'p3', new Date(T0 + DAY));
  assert.equal(r.left, null);
  assert.equal(r.next, null);
  assert.ok(r.weeks.length >= 1 && r.weeks.at(-1).cur);
});

test('lastDeltas: best set vs the previous time the exercise was done; only gains', () => {
  const prev = S(0, {legpress: [{a: 40, b: 12}, {a: 40, b: 11}], lat: [{a: 50, b: 10}], plank: [{b: 30}]});
  const cur = S(3, {legpress: [{a: 42.5, b: 12}], lat: [{a: 45, b: 10}], plank: [{b: 40}], bike: [{b: 10}]}, {wo: 'Б'});
  const d = lastDeltas(cur, [prev, cur], exOf);
  assert.deepEqual(d.map(x => x.id), ['legpress', 'plank']);
  assert.equal(deltaTxt(d[0]), '40×12 → 42,5×12');
  assert.equal(deltaTxt(d[1]), '30 → 40 с');
  assert.deepEqual(lastDeltas(prev, [prev, cur], exOf), []);
});

test('monthDeltas: compares with ~4 weeks ago (or the first time), weights first, skips stale and flat', () => {
  const ss = [
    S(0, {legpress: [{a: 60, b: 12}], lat: [{a: 50, b: 10}], plank: [{b: 30}]}),
    S(10, {legpress: [{a: 65, b: 12}], lat: [{a: 50, b: 10}]}),
    S(35, {legpress: [{a: 75, b: 12}], lat: [{a: 50, b: 10}], plank: [{b: 45}]}),
  ];
  const now = new Date(T0 + 36 * DAY), d = monthDeltas(ss, exOf, now);
  assert.deepEqual(d.map(x => x.id), ['legpress', 'plank']);
  assert.equal(deltaTxt(d[0]), '60 → 75 кг');
  assert.equal(d[0].pct, 25);
  assert.equal(d[1].pct, 50);
  // давно не делал (> 3 недель) — не показываем
  assert.deepEqual(monthDeltas(ss, exOf, new Date(T0 + 70 * DAY)), []);
});

test('monthDeltas: same weight, more reps reads as reps', () => {
  const ss = [S(0, {lat: [{a: 50, b: 8}]}), S(30, {lat: [{a: 50, b: 12}]})];
  const [d] = monthDeltas(ss, exOf, new Date(T0 + 31 * DAY));
  assert.equal(deltaTxt(d), '50 кг: 8 → 12 повт');
  assert.equal(d.pct, 50);
});

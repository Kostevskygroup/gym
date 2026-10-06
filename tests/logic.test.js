import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  topRep, lowRep, weekStart, planWeek, recPhase, gapDays, nextWo, lastFor, setScore, prMap,
  vol, streak, floorTo, aim, defaults, warmups, warmPlan, alternatives, sanity, kneeAvg,
} from '../js/logic.js';
import {EX} from '../js/data/exercises.js';

const exOf = id => EX[id] || {n: id, t: 'w'};
const D = s => new Date(s).toISOString();
const S = (date, entries, extra = {}) => ({id: +new Date(date), date: D(date), phase: 'p2', wo: 'Низ 1', knee: 0, entries, ...extra});
const W3 = (a, ...b) => b.map(x => ({a, b: x}));

test('topRep / lowRep parse ranges', () => {
  assert.equal(topRep('8–10'), 10);
  assert.equal(lowRep('8–10'), 8);
  assert.equal(topRep('12'), 12);
  assert.equal(topRep('макс'), null);
});

test('weekStart is local Monday midnight', () => {
  const w = weekStart(new Date(2026, 9, 8, 15)); // Thu
  assert.equal(w.getDay(), 1);
  assert.equal(w.getDate(), 5);
  assert.equal(w.getHours(), 0);
});

test('planWeek counts weeks that had training, not calendar weeks', () => {
  const now = new Date(2026, 9, 20);
  assert.equal(planWeek([], now), 1);
  const s = [S('2026-09-01T10:00', {}), S('2026-09-08T10:00', {}), S('2026-10-13T10:00', {})];
  // 3 active weeks, current week (Oct 19) has none yet → week 4
  assert.equal(planWeek(s, now), 4);
  // training in the current week does not add a new week
  assert.equal(planWeek([...s, S('2026-10-19T10:00', {})], now), 4);
});

test('recPhase thresholds', () => {
  assert.equal(recPhase(3), 'p1');
  assert.equal(recPhase(4), 'p2');
  assert.equal(recPhase(10), 'p2');
  assert.equal(recPhase(11), 'p3');
});

test('gapDays since last session', () => {
  assert.equal(gapDays([], new Date()), null);
  assert.equal(gapDays([S('2026-10-01T10:00', {})], new Date('2026-10-11T10:00')), 10);
});

test('nextWo rotates within the phase', () => {
  const keys = ['Верх 1', 'Низ 1', 'Верх 2', 'Низ 2'];
  assert.equal(nextWo([], 'p2', keys), 'Верх 1');
  assert.equal(nextWo([S('2026-10-01', {}, {wo: 'Низ 1'})], 'p2', keys), 'Верх 2');
  assert.equal(nextWo([S('2026-10-01', {}, {wo: 'Низ 2'})], 'p2', keys), 'Верх 1');
  assert.equal(nextWo([S('2026-10-01', {}, {wo: 'Удалённая'})], 'p2', keys), 'Верх 1');
});

test('lastFor returns entries with date and phase', () => {
  const s = [S('2026-10-01', {lat: W3(40, 10, 10)}), S('2026-10-03', {row: W3(30, 12)})];
  const L = lastFor(s, 'lat');
  assert.deepEqual(L.e, W3(40, 10, 10));
  assert.equal(L.phase, 'p2');
  assert.equal(lastFor(s, 'chest'), null);
});

test('setScore uses e1RM for weighted sets', () => {
  assert.equal(Math.round(setScore('w', {a: 50, b: 10})), 67);
  assert.ok(setScore('w', {a: 55, b: 3}) < setScore('w', {a: 50, b: 10}));
  assert.equal(setScore('r', {a: null, b: 15}), 15);
});

test('prMap: first session is never a PR, heavier-but-weaker is not a PR, rep PR counts', () => {
  const s = [
    S('2026-10-01', {lat: W3(50, 10, 10)}),
    S('2026-10-03', {lat: [{a: 55, b: 3}, ...W3(50, 8, 8)]}),
    S('2026-10-05', {lat: W3(50, 11, 10)}),
  ];
  const m = prMap(s, exOf);
  assert.equal(m.get(s[0].id).length, 0);
  assert.equal(m.get(s[1].id).length, 0);
  assert.equal(m.get(s[2].id).length, 1);
  assert.match(m.get(s[2].id)[0].txt, /50 кг × 11/);
});

test('prMap ignores sessions order in the array (sorts by date)', () => {
  const a = S('2026-10-05', {lat: W3(50, 11)}), b = S('2026-10-01', {lat: W3(50, 10)});
  const m = prMap([a, b], exOf);
  assert.equal(m.get(a.id).length, 1);
  assert.equal(m.get(b.id).length, 0);
});

test('vol doubles paired dumbbells and per-side lifts', () => {
  assert.equal(vol(S('2026-10-01', {lat: W3(40, 10)}), exOf), 400);
  assert.equal(vol(S('2026-10-01', {lateral: W3(8, 15)}), exOf), 240);
  assert.equal(vol(S('2026-10-01', {crunch: [{a: null, b: 15}]}), exOf), 0);
});

test('streak counts consecutive weeks meeting the need, DST-safe', () => {
  const now = new Date(2026, 3, 8); // spring after EU DST change
  const s = [];
  for (const d of ['2026-03-16', '2026-03-18', '2026-03-23', '2026-03-25', '2026-03-30', '2026-04-01']) s.push(S(d + 'T10:00', {}));
  assert.equal(streak(s, now, 2), 3);
  assert.equal(streak(s, now, 3), 0);
});

test('floorTo rounds down to the machine step', () => {
  assert.equal(floorTo(53.9, 2.5), 52.5);
  assert.equal(floorTo(7, 2), 6);
  assert.equal(floorTo(1, 2.5), 2.5);
});

const base = {id: 'lat', t: 'w', sets: 3, reps: '10', step: 2.5, phase: 'p2'};
const now = new Date('2026-10-10T10:00');

test('aim: all sets hit the top → add one step', () => {
  const A = aim({...base, now, sessions: [S('2026-10-08', {lat: W3(45, 10, 10, 10)})]});
  assert.equal(A.up, true);
  assert.equal(A.w, 47.5);
  assert.equal(A.r, 10);
  assert.match(A.txt, /47\.5 кг × 10/);
});

test('aim: bonus set beyond planned sets does not block progression', () => {
  const A = aim({...base, now, sessions: [S('2026-10-08', {lat: [...W3(45, 10, 10, 10), {a: 45, b: 6}]})]});
  assert.equal(A.up, true);
});

test('aim: one heavier last set does not drag the working weight', () => {
  const A = aim({...base, now, sessions: [S('2026-10-08', {lat: [...W3(45, 10, 10), {a: 47.5, b: 6}]})]});
  assert.equal(A.w, 45);
});

test('aim: short of reps → same weight, +1 rep', () => {
  const A = aim({...base, reps: '8–10', now, sessions: [S('2026-10-08', {lat: W3(45, 9, 8, 8)})]});
  assert.equal(A.up, false);
  assert.equal(A.w, 45);
  assert.equal(A.r, 9);
});

test('aim: far below the range → drop one step', () => {
  const A = aim({...base, reps: '10–12', now, sessions: [S('2026-10-08', {lat: W3(50, 7, 6, 6)})]});
  assert.equal(A.down, true);
  assert.equal(A.w, 47.5);
  assert.equal(A.r, 10);
});

test('aim: after a 3-week break → 90%, no increase', () => {
  const A = aim({...base, now, sessions: [S('2026-09-15', {lat: W3(50, 10, 10, 10)})]});
  assert.equal(A.up, false);
  assert.equal(A.w, 45);
  assert.match(A.why, /перерыв/);
});

test('aim: knee pain ≥4 holds the weight on knee exercises', () => {
  const s = [S('2026-10-08', {legpress: W3(100, 12, 12, 12)}, {knee: 5})];
  const A = aim({id: 'legpress', t: 'w', sets: 3, reps: '12', step: 2.5, phase: 'p2', now, sessions: s, knee: 1});
  assert.equal(A.up, false);
  assert.equal(A.w, 100);
  assert.match(A.why, /колени/i);
});

test('aim: knee pain ≥6 lowers the weight one step', () => {
  const s = [S('2026-10-08', {legpress: W3(100, 12, 12, 12)}, {knee: 7})];
  const A = aim({id: 'legpress', t: 'w', sets: 3, reps: '12', step: 2.5, phase: 'p2', now, sessions: s, knee: 1});
  assert.equal(A.w, 97.5);
});

test('aim: phase change estimates weight and reps from e1RM', () => {
  const s = [S('2026-10-08', {lat: W3(50, 10, 10, 10)}, {phase: 'p2'})];
  const A = aim({id: 'lat', t: 'w', sets: 4, reps: '6–8', step: 2.5, phase: 'p3', now, sessions: s});
  assert.equal(A.w, 52.5);
  assert.equal(A.r, 7);
  const coarse = aim({id: 'smithbench', t: 'w', sets: 4, reps: '6–8', step: 5, phase: 'p3', now, sessions: [S('2026-10-08', {smithbench: W3(50, 10, 10, 10)}, {phase: 'p2'})]});
  assert.equal(coarse.w, 50);
  assert.equal(coarse.r, 8);
});

test('aim: rep exercises progress +1 up to a cap', () => {
  const s = [S('2026-10-08', {crunch: [{a: null, b: 15}, {a: null, b: 13}]})];
  const A = aim({id: 'crunch', t: 'r', sets: 2, reps: '15', step: 1, phase: 'p2', now, sessions: s});
  assert.equal(A.r, 16);
  const capped = aim({id: 'crunch', t: 'r', sets: 2, reps: '15', step: 1, phase: 'p2', now, sessions: [S('2026-10-08', {crunch: [{a: null, b: 20}, {a: null, b: 20}]})]});
  assert.equal(capped.r, 20);
  assert.match(capped.txt, /усложни|вес/);
});

test('aim: no history → null', () => {
  assert.equal(aim({...base, now, sessions: []}), null);
});

test('defaults: first time leaves weight empty and reps at the bottom of the range', () => {
  const rows = defaults({...base, reps: '8–10', now, sessions: []});
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], {a: '', b: 8, done: false});
});

test('defaults: cardio (c) has one row', () => {
  const rows = defaults({id: 'bike', t: 'c', sets: 1, reps: '10', step: 1, phase: 'p2', now, sessions: []});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].b, 10);
});

test('defaults: rep exercises use per-set +1', () => {
  const s = [S('2026-10-08', {crunch: [{a: null, b: 15}, {a: null, b: 13}]})];
  const rows = defaults({id: 'crunch', t: 'r', sets: 2, reps: '15', step: 1, phase: 'p2', now, sessions: s});
  assert.deepEqual(rows.map(x => x.b), [16, 14]);
});

test('warmups: two sets for heavy, one for light, none for tiny', () => {
  assert.deepEqual(warmups(100, 2.5, true), [{a: 50, b: 10}, {a: 75, b: 5}]);
  assert.deepEqual(warmups(40, 2.5, false), [{a: 25, b: 8}]);
  assert.deepEqual(warmups(14, 2, true), [{a: 8, b: 10}]);
  assert.deepEqual(warmups(8, 2, true), []);
  assert.deepEqual(warmups('', 2.5, true), []);
});

test('warmPlan: first big group gets full warm-up, later new groups get one set, repeats none', () => {
  const items = [{id: 'bike'}, {id: 'legpress'}, {id: 'rdl'}, {id: 'legcurl'}, {id: 'abduct'}];
  const p = warmPlan(items, exOf);
  assert.deepEqual(p, {legpress: 'full', rdl: 'one'});
});

test('alternatives stay within the muscle group and skip excluded ids', () => {
  const alt = alternatives('legpress', EX, ['gobletbox']);
  assert.ok(alt.length >= 1);
  assert.ok(!alt.includes('legpress'));
  assert.ok(!alt.includes('gobletbox'));
  alt.forEach(id => assert.equal(EX[id].g, 'quads'));
});

test('alternatives put knee-loading moves last', () => {
  const alt = alternatives('legpress', EX, []);
  assert.equal(alt[alt.length - 1], 'legext');
});

test('sanity flags likely typos', () => {
  assert.match(sanity('w', {a: 525, b: 10}, 52.5), /525/);
  assert.equal(sanity('w', {a: 55, b: 10}, 52.5), null);
  assert.match(sanity('w', {a: 50, b: 100}, 50), /100/);
  assert.equal(sanity('w', {a: 50, b: 10}, null), null);
});

test('kneeAvg uses only sessions with knee-loading exercises and a recorded value', () => {
  const s = [
    S('2026-10-01', {legpress: W3(100, 12)}, {knee: 6}),
    S('2026-10-02', {lat: W3(40, 10)}, {knee: 0}),
    S('2026-10-03', {hipthrust: W3(60, 10)}, {knee: 2}),
    S('2026-10-04', {legpress: W3(100, 12)}, {knee: null}),
  ];
  assert.equal(kneeAvg(s, exOf, 3), 4);
  assert.equal(kneeAvg([], exOf, 3), null);
});

test('warmups never go below the empty bar', () => {
  assert.deepEqual(warmups(30, 2.5, true, 20), [{a: 20, b: 10}, {a: 22.5, b: 5}]);
  assert.deepEqual(warmups(20, 2.5, true, 20), []);
  assert.deepEqual(warmups(60, 2.5, true, 20), [{a: 30, b: 10}, {a: 45, b: 5}]);
});

test('free weights show up as swaps for machine exercises', () => {
  assert.ok(alternatives('row', EX).includes('bbrow'));
  assert.ok(alternatives('rdl', EX).includes('bbrdl'));
  assert.ok(alternatives('cablecurl', EX).includes('ezcurl'));
  assert.ok(alternatives('rope', EX).includes('ezskull'));
});

test('aim: knee guard uses the latest leg day, not only the last time this exercise was done', () => {
  const s = [S('2026-10-06', {legpress: W3(100, 12, 12, 12)}, {knee: 1}), S('2026-10-08', {hipthrust: W3(60, 10)}, {knee: 7})];
  const A = aim({id: 'legpress', t: 'w', sets: 3, reps: '12', step: 2.5, phase: 'p2', now, sessions: s, knee: 1, kneeLast: 7});
  assert.equal(A.up, false);
  assert.equal(A.w, 97.5);
});

test('aim: phase change after a long break still deloads; knee pain still lowers', () => {
  const s = [S('2026-08-20', {lat: W3(50, 10, 10, 10)}, {phase: 'p2'})];
  const A = aim({id: 'lat', t: 'w', sets: 4, reps: '6–8', step: 2.5, phase: 'p3', now, sessions: s});
  assert.ok(A.w < 52.5);
  assert.match(A.why, /перерыв/);
  const k = aim({id: 'legpress', t: 'w', sets: 4, reps: '6–8', step: 2.5, phase: 'p3', now, sessions: [S('2026-10-08', {legpress: W3(100, 12, 12, 12)}, {phase: 'p2', knee: 8})], knee: 1});
  assert.equal(k.down, true);
});

test('kneeLast returns the most recent recorded leg-day knee score', async () => {
  const {kneeLast} = await import('../js/logic.js');
  const s = [S('2026-10-01', {legpress: W3(100, 12)}, {knee: 2}), S('2026-10-02', {lat: W3(40, 10)}, {knee: 9}), S('2026-10-03', {hipthrust: W3(60, 10)}, {knee: null})];
  assert.equal(kneeLast(s, exOf), 2);
  assert.equal(kneeLast([], exOf), null);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildProgram} from '../js/builder.js';
import {EX} from '../js/data/exercises.js';
import {EQUIP} from '../js/data/equipment.js';
import {exLoad} from '../js/logic.js';
import {toItem} from '../js/program.js';

const base = {goal: 'general', days: 3, level: 1, pain: [], focus: []};
const days = p => Object.values(p.p2.w).map(items => items.map(toItem));
const ids = p => ['p1', 'p2', 'p3'].flatMap(ph => Object.values(p[ph].w).flat().map(x => toItem(x).id));

test('number of workout days follows the choice', () => {
  for (const d of [2, 3, 4, 5]) for (const ph of ['p1', 'p2', 'p3']) assert.equal(Object.keys(buildProgram({...base, days: d}, EX)[ph].w).length, d, `${d} ${ph}`);
});

test('only gym equipment and known exercises', () => {
  for (const goal of ['general', 'glutes', 'fatloss', 'strength']) for (const id of ids(buildProgram({...base, goal, days: 4}, EX))) {
    assert.ok(EX[id], id);
    assert.ok(EQUIP[EX[id].img], id);
  }
});

test('painful joints exclude heavy-load exercises and prefer gentle ones', () => {
  for (const j of ['knee', 'back', 'shoulder', 'elbow', 'wrist', 'hip', 'ankle']) {
    const p = buildProgram({...base, days: 4, pain: [j]}, EX);
    for (const id of ids(p)) assert.ok((exLoad(EX[id])[j] || 0) < 2, `${j}: ${id}`);
  }
});

test('every day ends with a 3-move core circuit in the fixed order', () => {
  for (const d of [2, 3, 4, 5]) for (const items of days(buildProgram({...base, days: d}, EX))) {
    const core = items.slice(-3);
    assert.deepEqual(core.map(x => EX[x.id].cr), ['stab', 'flex', 'side']);
    assert.deepEqual(core.map(x => !!x.ss), [true, true, false]);
    assert.ok(core.every(x => x.blk === 'core'));
  }
});

test('no exercise repeats within a day', () => {
  for (const d of [2, 3, 4, 5]) for (const items of days(buildProgram({...base, days: d, focus: ['glutes', 'arms']}, EX))) {
    const xs = items.map(x => x.id);
    assert.equal(new Set(xs).size, xs.length);
  }
});

test('glute focus adds glute work', () => {
  const count = p => days(p).flat().filter(x => EX[x.id].g === 'glutes' || EX[x.id].g === 'gmed').length;
  assert.ok(count(buildProgram({...base, focus: ['glutes']}, EX)) > count(buildProgram(base, EX)));
});

test('beginners get only beginner-friendly exercises', () => {
  for (const id of ids(buildProgram({...base, days: 4, level: 1}, EX))) assert.ok((EX[id].lv || 1) <= 1, id);
});

test('fat-loss starts each day with cardio', () => {
  for (const items of days(buildProgram({...base, goal: 'fatloss'}, EX))) assert.equal(EX[items[0].id].g, 'cardio');
});

test('phases progress: more sets later, strength gets lower reps', () => {
  const p = buildProgram({...base, goal: 'strength', days: 4}, EX);
  const first = ph => toItem(Object.values(p[ph].w)[0].find(x => EX[toItem(x).id].mech === 'compound'));
  assert.ok(first('p3').s >= first('p1').s);
  assert.match(first('p3').r, /^[68]/);
});

test('deterministic: same answers give the same program', () => {
  assert.deepEqual(buildProgram({...base, days: 4, focus: ['back']}, EX), buildProgram({...base, days: 4, focus: ['back']}, EX));
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  exOf, allEx, planOf, phaseOf, itemsOf, stepOf, setItem, removeItem, moveItem, addItem, replaceItem,
  resetPlan, addCustom, pickerGroups,
} from '../js/program.js';
import {emptyDB} from '../js/backup.js';
import {W} from '../js/data/program.js';
import {EX} from '../js/data/exercises.js';

const db0 = () => emptyDB();

test('exOf never returns undefined for unknown ids', () => {
  const e = exOf(db0(), 'nope');
  assert.equal(e.t, 'w');
  assert.match(e.n, /nope/);
  assert.equal(e.gone, 1);
});

test('planOf falls back to the built-in program', () => {
  assert.equal(planOf(db0()), W);
  assert.equal(phaseOf(db0(), 'zz').label, 'zz');
});

test('itemsOf normalizes arrays and applies swaps', () => {
  const it = itemsOf(db0(), 'p2', 'Низ 1', {legpress: 'gobletbox'});
  const lp = it.find(x => x.orig === 'legpress');
  assert.equal(lp.id, 'gobletbox');
  assert.equal(lp.s, 3);
  assert.equal(typeof lp.r, 'string');
  assert.equal(itemsOf(db0(), 'p2', 'нет такой').length, 0);
});

test('superset flag is carried on the first exercise of the pair', () => {
  const it = itemsOf(db0(), 'p3', 'Верх 1');
  assert.equal(it.find(x => x.id === 'cablecurl').ss, 1);
  assert.ok(!it.find(x => x.id === 'rope').ss);
});

test('stepOf: per-exercise setting overrides equipment default', () => {
  const db = db0();
  assert.equal(stepOf(db, 'smithbench'), 5);
  assert.equal(stepOf(db, 'lateral'), 2);
  assert.equal(stepOf({...db, exs: {lat: {step: 5}}}, 'lat'), 5);
});

test('editor ops are immutable and do not touch the built-in program', () => {
  const db = db0();
  const a = setItem(db, 'p1', 'А', 1, {s: 3, r: '12'});
  assert.equal(db.plan, null);
  assert.equal(W.p1.w['А'][1][1], 2);
  assert.equal(itemsOf(a, 'p1', 'А')[1].s, 3);
  const b = removeItem(a, 'p1', 'А', 0);
  assert.equal(itemsOf(b, 'p1', 'А').length, itemsOf(a, 'p1', 'А').length - 1);
  assert.equal(itemsOf(a, 'p1', 'А')[0].id, 'bike');
});

test('moveItem swaps neighbours and ignores out-of-range moves', () => {
  const db = db0();
  const m = moveItem(db, 'p1', 'А', 1, -1);
  assert.equal(itemsOf(m, 'p1', 'А')[0].id, 'legpress');
  assert.equal(itemsOf(m, 'p1', 'А')[1].id, 'bike');
  const same = moveItem(db, 'p1', 'А', 0, -1);
  assert.deepEqual(itemsOf(same, 'p1', 'А'), itemsOf(db, 'p1', 'А'));
});

test('addItem appends with sensible defaults and refuses duplicates and unknown ids', () => {
  const db = addItem(db0(), 'p1', 'А', 'hammer');
  const last = itemsOf(db, 'p1', 'А').at(-1);
  assert.equal(last.id, 'hammer');
  assert.ok(last.s >= 2);
  assert.throws(() => addItem(db, 'p1', 'А', 'hammer'), /уже есть/);
  assert.throws(() => addItem(db, 'p1', 'А', 'nope'), /не найдено/);
});

test('replaceItem makes a swap permanent', () => {
  const db = replaceItem(db0(), 'p2', 'Низ 1', 'legpress', 'gobletbox');
  const ids = itemsOf(db, 'p2', 'Низ 1').map(x => x.id);
  assert.ok(ids.includes('gobletbox'));
  assert.ok(!ids.includes('legpress'));
});

test('resetPlan restores the built-in program', () => {
  const db = resetPlan(removeItem(db0(), 'p1', 'А', 0));
  assert.equal(db.plan, null);
});

test('addCustom only accepts equipment from the gym', () => {
  const {db, id} = addCustom(db0(), {n: 'Шраги в Смите', img: 'smith', t: 'w', g: 'rear'});
  assert.equal(allEx(db)[id].n, 'Шраги в Смите');
  assert.equal(exOf(db, id).img, 'smith');
  assert.throws(() => addCustom(db0(), {n: 'Гиперэкстензия', img: 'hyper', t: 'w', g: 'hams'}), /тренажёр/);
  assert.throws(() => addCustom(db0(), {n: '  ', img: 'smith', t: 'w', g: 'hams'}), /название/);
  assert.throws(() => addCustom(db0(), {n: 'X', img: 'smith', t: 'zz', g: 'hams'}), /тип/);
});

test('pickerGroups lists every usable exercise once, grouped by equipment', () => {
  const g = pickerGroups(db0());
  const ids = g.flatMap(x => x.items);
  assert.equal(new Set(ids).size, ids.length);
  Object.keys(EX).filter(id => !EX[id].retired).forEach(id => assert.ok(ids.includes(id), id));
  g.forEach(x => x.items.forEach(id => assert.equal(EX[id].img, x.eq)));
});

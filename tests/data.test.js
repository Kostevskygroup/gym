// Сторож правила «программа строится только на тренажёрах этого зала».
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {EX} from '../js/data/exercises.js';
import {W} from '../js/data/program.js';
import {EQUIP, hasPhoto} from '../js/data/equipment.js';
import {GUIDE, PHOTO_W, PHOTO_H} from '../js/data/guides.js';
import {GROUPS, TYPES} from '../js/program.js';
import {alternatives} from '../js/logic.js';

const root = new URL('..', import.meta.url).pathname;

test('every exercise uses equipment from the gym and has complete technique text', () => {
  for (const [id, e] of Object.entries(EX)) {
    assert.ok(EQUIP[e.img], `${id}: тренажёр ${e.img} не из зала`);
    assert.ok(TYPES[e.t], `${id}: тип ${e.t}`);
    assert.ok(GROUPS[e.g], `${id}: группа ${e.g}`);
    assert.ok(e.n && e.setup && e.how.length && e.bad.length, `${id}: текст техники`);
  }
});

test('every gym machine with a photo has the photo file', () => {
  for (const eq of Object.keys(EQUIP)) if (hasPhoto(eq)) assert.ok(existsSync(`${root}img/${eq}.jpg`), eq);
});

test('every program item references a known exercise with valid sets', () => {
  for (const [ph, p] of Object.entries(W)) for (const [wo, items] of Object.entries(p.w)) for (const [id, s, r] of items) {
    assert.ok(EX[id], `${ph}/${wo}: ${id}`);
    assert.ok(Number.isInteger(s) && s >= 1 && s <= 10, `${ph}/${wo}: ${id} sets`);
    assert.ok(String(r).length, `${ph}/${wo}: ${id} reps`);
  }
});

test('every exercise except cardio has at least one swap on gym equipment', () => {
  for (const id of Object.keys(EX)) if (EX[id].g !== 'cardio' && EX[id].g !== 'gmed' && EX[id].g !== 'rear' && EX[id].g !== 'side') assert.ok(alternatives(id, EX).length, id);
});

test('photo guides reference known exercises and stay inside the photo', () => {
  for (const [id, g] of Object.entries(GUIDE)) {
    assert.ok(EX[id], id);
    assert.ok(hasPhoto(EX[id].img), `${id}: нет фото тренажёра`);
    for (const [x, y, t] of g.pins) assert.ok(x >= 0 && x <= PHOTO_W && y >= 0 && y <= PHOTO_H && t, `${id}: ${x},${y}`);
    for (const a of g.arrows || []) assert.ok(a.every((v, i) => v >= 0 && v <= (i % 2 ? PHOTO_H : PHOTO_W)), `${id}: стрелка`);
  }
});

test('every exercise with a gym photo has a photo guide', () => {
  for (const [id, e] of Object.entries(EX)) if (hasPhoto(e.img)) assert.ok(GUIDE[id], id);
});

test('no power rack: barbell work is limited to moves you can start from the floor', () => {
  const ok = new Set(['backh', 'hams', 'glutes', 'biceps']);
  for (const [id, e] of Object.entries(EX)) if (e.img === 'barbell') assert.ok(ok.has(e.g), `${id}: нужна рама — делай в Смите`);
});

test('every workout ends with a 3-part core circuit: stability → flexion → anti-rotation/side', async () => {
  const {toItem} = await import('../js/program.js');
  const ORDER = ['stab', 'flex', 'side'];
  for (const [ph, p] of Object.entries(W)) for (const [wo, raw] of Object.entries(p.w)) {
    const items = raw.map(toItem), core = items.filter(x => x.blk === 'core');
    assert.equal(core.length, 3, `${ph}/${wo}: 3 упражнения пресса`);
    assert.deepEqual(core.map(x => EX[x.id].cr), ORDER, `${ph}/${wo}: порядок`);
    assert.deepEqual(items.slice(-3).map(x => x.id), core.map(x => x.id), `${ph}/${wo}: пресс в конце`);
    assert.deepEqual(core.map(x => !!x.ss), [true, true, false], `${ph}/${wo}: круг`);
    assert.equal(new Set(core.map(x => x.s)).size, 1, `${ph}/${wo}: одинаковое число кругов`);
  }
});

test('core work is varied: no exercise repeats within a phase week more than twice', () => {
  for (const [ph, p] of Object.entries(W)) {
    const n = {};
    Object.values(p.w).flat().filter(x => x[4] && x[4].blk === 'core').forEach(x => n[x[0]] = (n[x[0]] || 0) + 1);
    Object.entries(n).forEach(([id, c]) => assert.ok(c <= 2, `${ph}: ${id} ×${c}`));
    if (Object.keys(p.w).length >= 4) assert.ok(Object.keys(n).length >= 7, `${ph}: разнообразие ${Object.keys(n).length}`);
  }
});

test('every core exercise has a role', () => {
  for (const [id, e] of Object.entries(EX)) if (e.g === 'core') assert.ok(['stab', 'flex', 'side'].includes(e.cr), id);
});

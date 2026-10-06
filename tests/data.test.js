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

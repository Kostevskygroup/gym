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

test('every exercise with a gym photo has a photo guide (own or the machine default)', async () => {
  const {guideFor, GUIDE_EQ} = await import('../js/data/guides.js');
  for (const [id, e] of Object.entries(EX)) if (hasPhoto(e.img)) assert.ok(guideFor(id, e.img), id);
  for (const [eq, g] of Object.entries(GUIDE_EQ)) for (const [x, y] of g.pins) assert.ok(x >= 0 && x <= PHOTO_W && y >= 0 && y <= PHOTO_H, eq);
});

test('library is big and covers every muscle group', () => {
  assert.ok(Object.keys(EX).length >= 140, String(Object.keys(EX).length));
  for (const g of Object.keys(GROUPS)) assert.ok(Object.values(EX).some(e => e.g === g), g);
});

test('no power rack: no barbell bench press, overhead press or squat (those go in the Smith)', () => {
  for (const [id, e] of Object.entries(EX)) if (e.img === 'barbell' || e.img === 'ezbar') {
    assert.ok(!['chest', 'press'].includes(e.g), `${id}: жим со стоек — делай в Смите`);
    assert.ok(!/присед/i.test(e.n), `${id}: присед нужна рама — делай в Смите`);
  }
});

// Пресс — одно упражнение в конце тренировки, обычными подходами с отдыхом. Разные дни — разные упражнения и типы.
test('every workout ends with exactly one core exercise — no circuit', async () => {
  const {toItem} = await import('../js/program.js');
  for (const [ph, p] of Object.entries(W)) for (const [wo, raw] of Object.entries(p.w)) {
    const items = raw.map(toItem), core = items.filter(x => x.blk === 'core');
    assert.equal(core.length, 1, `${ph}/${wo}: одно упражнение на пресс`);
    assert.equal(items.at(-1).id, core[0].id, `${ph}/${wo}: пресс в конце`);
    assert.ok(!core[0].ss, `${ph}/${wo}: без круга`);
    assert.equal(EX[core[0].id].g, 'core', `${ph}/${wo}: это упражнение на пресс`);
  }
});

test('core varies: within a phase every day has its own exercise, types cover min(3, days); phases differ', async () => {
  const {toItem} = await import('../js/program.js');
  const coreOf = p => Object.values(p.w).map(raw => raw.map(toItem).find(x => x.blk === 'core').id);
  for (const [ph, p] of Object.entries(W)) {
    const ids = coreOf(p);
    assert.equal(new Set(ids).size, ids.length, `${ph}: повтор ${ids}`);
    assert.ok(new Set(ids.map(id => EX[id].cr)).size >= Math.min(3, ids.length), `${ph}: типы ${ids}`);
  }
  assert.notDeepEqual(coreOf(W.p2), coreOf(W.p3), 'Основа и Прогресс — разный пресс');
});

test('every core exercise has a role', () => {
  for (const [id, e] of Object.entries(EX)) if (e.g === 'core') assert.ok(['stab', 'flex', 'side'].includes(e.cr), id);
});

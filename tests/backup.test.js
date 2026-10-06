import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyDB, normalizeDB, parseBackup, mergeDB, makeBackup, backupDue, isEmpty} from '../js/backup.js';

const sess = (id, date, entries = {lat: [{a: 40, b: 10}]}) => ({id, date, phase: 'p1', wo: 'А', knee: 1, entries});

test('normalizeDB fills defaults for garbage input', () => {
  for (const raw of [null, 5, 'x', [], {sessions: {}}, {bw: null, waist: 'a', ach: 3}]) {
    const db = normalizeDB(raw);
    assert.ok(Array.isArray(db.sessions));
    assert.ok(Array.isArray(db.bw));
    assert.ok(Array.isArray(db.waist));
    assert.equal(typeof db.ach, 'object');
    assert.equal(db.phase, 'p1');
    assert.equal(db.v, 2);
  }
});

test('normalizeDB drops broken sessions and rows, keeps unknown exercise ids', () => {
  const db = normalizeDB({sessions: [
    sess(1, '2026-10-01T10:00:00Z', {lat: [{a: '40', b: '10'}, {a: 40, b: ''}, 'x'], zzz: [{a: 10, b: 5}], empty: []}),
    {id: 2, date: 'not a date', entries: {}},
    {id: 3, date: '2026-10-02T10:00:00Z'},
    sess(1, '2026-10-01T10:00:00Z'),
  ]});
  assert.equal(db.sessions.length, 1);
  assert.deepEqual(db.sessions[0].entries.lat, [{a: 40, b: 10}]);
  assert.deepEqual(db.sessions[0].entries.zzz, [{a: 10, b: 5}]);
  assert.equal(db.sessions[0].entries.empty, undefined);
});

test('normalizeDB keeps knee null when not recorded and clamps values', () => {
  const db = normalizeDB({sessions: [{...sess(1, '2026-10-01'), knee: undefined}, {...sess(2, '2026-10-02'), knee: 44}]});
  assert.equal(db.sessions[0].knee, null);
  assert.equal(db.sessions[1].knee, 10);
});

test('normalizeDB filters body measurements and settings', () => {
  const db = normalizeDB({
    bw: [{date: '2026-10-01', kg: 100}, {date: 'x', kg: 90}, {date: '2026-10-02', kg: 5000}],
    waist: [{date: '2026-10-01', v: 100}],
    goal: 'abc', phase: 'p9',
    exs: {lat: {note: 'сиденье 4', step: 5}, bad: 'x', row: {note: 7, step: 3.3}},
    custom: {u_1: {n: 'Шраги', img: 'smith', t: 'w', g: 'rear'}, u_2: {n: 'X', img: 'hyper', t: 'w'}},
  });
  assert.equal(db.bw.length, 1);
  assert.equal(db.waist.length, 1);
  assert.equal(db.goal, null);
  assert.equal(db.phase, 'p1');
  assert.deepEqual(db.exs.lat, {note: 'сиденье 4', step: 5});
  assert.deepEqual(db.exs.row, {note: '', step: null});
  assert.equal(db.exs.bad, undefined);
  assert.ok(db.custom.u_1);
  assert.equal(db.custom.u_2, undefined);
});

test('normalizeDB rejects malformed plans', () => {
  assert.equal(normalizeDB({plan: {p1: 5}}).plan, null);
  assert.equal(normalizeDB({plan: 'x'}).plan, null);
  const ok = normalizeDB({plan: {p1: {label: 'a', sub: '', hint: '', w: {'А': [['lat', 3, '10']]}}, p2: {label: 'b', w: {}}, p3: {label: 'c', w: {}}}});
  assert.ok(ok.plan);
  assert.deepEqual(ok.plan.p1.w['А'][0], {id: 'lat', s: 3, r: '10', n: ''});
});

test('parseBackup accepts the new file format and the old clipboard text', () => {
  const file = JSON.stringify(makeBackup({...emptyDB(), sessions: [sess(1, '2026-10-01')]}, [{ex: 'lat', ts: 1, data: 'data:image/jpeg;base64,AA=='}], new Date('2026-10-06')));
  const a = parseBackup(file);
  assert.equal(a.db.sessions.length, 1);
  assert.equal(a.photos.length, 1);
  const old = JSON.stringify({sessions: [sess(5, '2026-09-01')], bw: [], waist: [], goal: 95, phase: 'p1', wo: 'А', ach: {first: '2026-09-01'}, updatedAt: 1});
  const b = parseBackup(old);
  assert.equal(b.db.sessions[0].id, 5);
  assert.equal(b.db.goal, 95);
  assert.deepEqual(b.photos, []);
});

test('parseBackup rejects text that is not a backup', () => {
  assert.throws(() => parseBackup('hello'), /не похоже/);
  assert.throws(() => parseBackup('{"a":1}'), /не похоже/);
  assert.throws(() => parseBackup('{"sessions": 5}'), /не похоже/);
});

test('parseBackup drops photos that are not image data URLs', () => {
  const t = JSON.stringify({app: 'gym', db: {sessions: []}, photos: [{ex: 'lat', ts: 1, data: 'javascript:alert(1)'}, {ex: 'lat', ts: 2, data: 'data:image/png;base64,AA=='}]});
  assert.equal(parseBackup(t).photos.length, 1);
});

test('mergeDB into an empty app takes everything from the backup', () => {
  const inc = normalizeDB({sessions: [sess(1, '2026-10-01')], goal: 90, phase: 'p2', wo: 'Низ 1'});
  const {db, added} = mergeDB(emptyDB(), inc);
  assert.equal(db.sessions.length, 1);
  assert.equal(db.goal, 90);
  assert.equal(db.phase, 'p2');
  assert.equal(added.sessions, 1);
});

test('mergeDB never deletes newer local workouts', () => {
  const local = normalizeDB({sessions: [sess(1, '2026-10-01'), sess(3, '2026-10-05')], bw: [{date: '2026-10-05', kg: 99}], phase: 'p2'});
  const inc = normalizeDB({sessions: [sess(1, '2026-10-01'), sess(2, '2026-10-03')], bw: [{date: '2026-10-01', kg: 101}], phase: 'p1', ach: {first: '2026-09-01'}});
  const {db, added} = mergeDB(local, inc);
  assert.deepEqual(db.sessions.map(s => s.id), [1, 2, 3]);
  assert.equal(db.bw.length, 2);
  assert.equal(db.phase, 'p2');
  assert.equal(db.ach.first, '2026-09-01');
  assert.deepEqual(added, {sessions: 1, bw: 1, waist: 0});
});

test('makeBackup wraps data with a version and date', () => {
  const b = makeBackup(emptyDB(), [], new Date('2026-10-06T10:00:00Z'));
  assert.equal(b.app, 'gym');
  assert.equal(b.v, 2);
  assert.equal(b.exportedAt, '2026-10-06T10:00:00.000Z');
});

test('backupDue after 5 sessions or 14 days with new data', () => {
  const now = new Date('2026-10-20T10:00:00Z');
  assert.equal(backupDue(emptyDB(), now).due, false);
  const s = [1, 2, 3].map(i => sess(i, `2026-10-1${i}T10:00:00Z`));
  assert.equal(backupDue({...emptyDB(), sessions: s, lastBackup: '2026-10-10T00:00:00Z'}, now).due, false);
  assert.equal(backupDue({...emptyDB(), sessions: s, lastBackup: '2026-10-01T00:00:00Z'}, now).due, true);
  const five = [1, 2, 3, 4, 5].map(i => sess(i, `2026-10-1${i}T10:00:00Z`));
  const r = backupDue({...emptyDB(), sessions: five, lastBackup: '2026-10-10T00:00:00Z'}, now);
  assert.equal(r.due, true);
  assert.equal(r.n, 5);
  assert.equal(backupDue({...emptyDB(), sessions: s}, now).due, true);
});

test('isEmpty', () => {
  assert.equal(isEmpty(emptyDB()), true);
  assert.equal(isEmpty({...emptyDB(), bw: [{date: '2026-10-01', kg: 90}]}), false);
});

import {normalizeDR, emptyDraft} from '../js/backup.js';

test('normalizeDR keeps valid drafts and repairs broken ones', () => {
  const dr = normalizeDR({
    'p1|А': {start: 1000, ex: {lat: [{a: 40, b: 10, done: true, t: 1100}, 'x'], bad: 5}, knee: 3, swap: {legpress: 'gobletbox'}},
    'p1|Б': 'garbage',
    rest: {end: 5000, tot: 90, label: 'Отдых'},
    updatedAt: 7,
  });
  assert.deepEqual(dr['p1|А'].ex.lat, [{a: 40, b: 10, done: true, t: 1100}]);
  assert.equal(dr['p1|А'].ex.bad, undefined);
  assert.equal(dr['p1|А'].knee, 3);
  assert.equal(dr['p1|А'].last, 1100);
  assert.deepEqual(dr['p1|А'].swap, {legpress: 'gobletbox'});
  assert.equal(dr['p1|Б'], undefined);
  assert.deepEqual(dr.rest, {end: 5000, tot: 90, label: 'Отдых'});
  assert.deepEqual(normalizeDR(null), {});
  assert.deepEqual(emptyDraft(), {start: null, last: null, ex: {}, knee: null, swap: {}, warm: {}, skip: {}});
});

test('mergeDB into an app with no history keeps local settings, notes and plan', () => {
  const local = {...emptyDB(), goal: 90, exs: {legpress: {note: 'сиденье 4', step: null}}, custom: {u_1: {n: 'Шраги', img: 'smith', t: 'w', g: 'rear', setup: '', how: [], bad: [], own: 1}}, plan: {p1: {label: 'a', sub: '', hint: '', w: {}}, p2: {label: 'b', sub: '', hint: '', w: {}}, p3: {label: 'c', sub: '', hint: '', w: {}}}};
  const inc = normalizeDB({sessions: [sess(1, '2026-10-01')], goal: 80, phase: 'p2', exs: {lat: {note: 'x', step: 5}}});
  const {db} = mergeDB(local, inc);
  assert.equal(db.sessions.length, 1);
  assert.equal(db.goal, 90);
  assert.ok(db.exs.legpress && db.exs.lat);
  assert.ok(db.custom.u_1);
  assert.ok(db.plan);
  assert.equal(db.phase, 'p2');
});

test('parseBackup restores the emergency raw export from the crash screen', () => {
  const raw = JSON.stringify({db: JSON.stringify({sessions: [sess(7, '2026-10-01')]}), prev: null, dr: null, legacy: null});
  assert.equal(parseBackup(raw).db.sessions[0].id, 7);
  const onlyPrev = JSON.stringify({db: '{broken', prev: JSON.stringify({sessions: [sess(8, '2026-10-02')]})});
  assert.equal(parseBackup(onlyPrev).db.sessions[0].id, 8);
});

test('normalizeDB keeps distinct sessions with missing or clashing ids', () => {
  const db = normalizeDB({sessions: [
    {id: null, date: '2026-10-01T10:00:00Z', entries: {lat: [{a: 40, b: 10}]}},
    {id: '', date: '2026-10-02T10:00:00Z', entries: {lat: [{a: 42.5, b: 10}]}},
    {id: 5, date: '2026-10-03T10:00:00Z', entries: {lat: [{a: 45, b: 10}]}},
    {id: 5, date: '2026-10-04T10:00:00Z', entries: {lat: [{a: 47.5, b: 10}]}},
    {id: 5, date: '2026-10-03T10:00:00Z', entries: {lat: [{a: 45, b: 11}]}},
  ]});
  assert.equal(db.sessions.length, 4);
  assert.equal(new Set(db.sessions.map(s => s.id)).size, 4);
});

test('normalizeDB rejects inherited keys as equipment', () => {
  const db = normalizeDB({custom: {u_x: {n: 'X', img: 'constructor', t: 'w', g: 'hams'}}});
  assert.equal(db.custom.u_x, undefined);
});

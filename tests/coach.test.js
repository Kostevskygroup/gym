import {test} from 'node:test';
import assert from 'node:assert/strict';
import {insights, applyAction, dismiss} from '../js/coach.js';
import {emptyDB} from '../js/backup.js';
import {itemsOf} from '../js/program.js';

const DAY = 864e5, now = new Date('2026-10-20T12:00:00Z');
const at = d => new Date(+now - d * DAY).toISOString();
const S = (d, wo, entries, extra = {}) => ({id: +now - d * DAY, date: at(d), phase: 'p2', wo, knee: 1, entries, dur: 55, ...extra});
const W3 = (a, ...b) => b.map(x => ({a, b: x}));
const db = (sessions, more = {}) => ({...emptyDB(), phase: 'p2', wo: 'Верх 1', sessions, ...more});
const find = (list, kind) => list.find(x => x.kind === kind);

test('no history → only a welcome hint, nothing alarming', () => {
  const l = insights(db([]), now);
  assert.ok(l.every(x => x.level !== 'warn'));
});

test('plateau: 4 sessions over 3+ weeks without strength gain suggests a swap', () => {
  const s = [28, 21, 14, 7].map(d => S(d, 'Верх 1', {lat: W3(45, 10, 10, 9)}));
  const p = find(insights(db(s), now), 'plateau');
  assert.ok(p, 'plateau found');
  assert.equal(p.ex, 'lat');
  assert.equal(p.action.type, 'swap');
  assert.notEqual(p.action.to, 'lat');
});

test('no plateau when the lift is still growing', () => {
  const s = [28, 21, 14, 7].map((d, i) => S(d, 'Верх 1', {lat: W3(45 + i * 2.5, 10, 10, 10)}));
  assert.equal(find(insights(db(s), now), 'plateau'), undefined);
});

test('knee pain trend: warns, never invents a knee-friendly quad swap that the gym lacks', () => {
  const s = [9, 5, 2].map(d => S(d, 'Низ 1', {legpress: W3(100, 12)}, {knee: 5}));
  const k = find(insights(db(s, {wo: 'Низ 1'}), now), 'knee');
  assert.ok(k);
  assert.equal(k.level, 'warn');
  assert.match(k.text, /колени/i);
  if (k.action) assert.ok(['swap', 'remove'].includes(k.action.type));
});

test('knee pain in phase 3 suggests dropping the risky leg extension first', () => {
  const s = [9, 5, 2].map(d => S(d, 'Низ 1', {legpress: W3(100, 12)}, {knee: 6, phase: 'p3'}));
  const k = find(insights(db(s, {phase: 'p3', wo: 'Низ 1'}), now), 'knee');
  assert.deepEqual([k.action.type, k.action.id], ['remove', 'legext']);
});

test('knee insight is off for profiles without knee issues', () => {
  const s = [9, 5, 2].map(d => S(d, 'Низ 1', {legpress: W3(100, 12)}, {knee: 6}));
  assert.equal(find(insights(db(s, {wo: 'Низ 1', settings: {knee: false}}), now), 'knee'), undefined);
});

test('an exercise missing from the last 2 sessions of its workout is flagged', () => {
  const s = [10, 3].map(d => S(d, 'Низ 1', {legpress: W3(100, 12), rdl: W3(16, 10), legcurl: W3(30, 12), abduct: W3(12.5, 15)}));
  const m = find(insights(db(s, {wo: 'Низ 1'}), now), 'skipped');
  assert.ok(m);
  assert.equal(m.ex, 'calf');
});

test('the same swap made twice suggests making it permanent', () => {
  const s = [10, 3].map(d => S(d, 'Низ 1', {gobletbox: W3(20, 10)}, {swaps: {legpress: 'gobletbox'}}));
  const r = find(insights(db(s, {wo: 'Низ 1'}), now), 'swaps');
  assert.ok(r);
  assert.deepEqual([r.action.from, r.action.to], ['legpress', 'gobletbox']);
});

test('consistency: praise a streak, warn when the week is slipping', () => {
  const good = [];
  for (let w = 1; w <= 3; w++) for (const d of [0, 1, 3, 5]) good.push(S(w * 7 + d - 6, 'Верх 1', {lat: W3(40, 10)}));
  assert.equal(find(insights(db(good), now), 'streak')?.level, 'good');
});

test('body: weight stalled for 3 weeks above the goal', () => {
  const bw = [21, 14, 7, 0].map(d => ({date: at(d), kg: 99.5}));
  const b = find(insights(db([S(2, 'Верх 1', {lat: W3(40, 10)})], {bw, goal: 90}), now), 'weight');
  assert.ok(b);
  assert.match(b.text, /3 нед/);
});

test('body: remind to weigh in after 10+ days', () => {
  const b = find(insights(db([S(2, 'Верх 1', {lat: W3(40, 10)})], {bw: [{date: at(15), kg: 99}]}), now), 'weighin');
  assert.ok(b);
});

test('dismissed insights stay hidden for two weeks', () => {
  const s = [28, 21, 14, 7].map(d => S(d, 'Верх 1', {lat: W3(45, 10, 10, 9)}));
  const d0 = db(s), p = find(insights(d0, now), 'plateau');
  const d1 = dismiss(d0, p.key, now);
  assert.equal(find(insights(d1, now), 'plateau'), undefined);
  const d2 = {...d1, dismissed: {[p.key]: new Date(+now - 15 * DAY).toISOString()}};
  assert.ok(find(insights(d2, now), 'plateau'));
});

test('applyAction swap replaces the exercise in every workout of the phase', () => {
  const d0 = db([]);
  const d1 = applyAction(d0, {type: 'swap', phase: 'p2', from: 'legcurl', to: 'rdl'});
  for (const wo of ['Низ 1', 'Низ 2']) {
    const ids = itemsOf(d1, 'p2', wo).map(x => x.id);
    assert.ok(!ids.includes('legcurl'), wo);
  }
  assert.equal(d0.plan, null);
});

test('applyAction never creates a duplicate exercise in a workout', () => {
  const d1 = applyAction(db([]), {type: 'swap', phase: 'p2', from: 'legcurl', to: 'rdl'});
  const ids = itemsOf(d1, 'p2', 'Низ 1').map(x => x.id);
  assert.equal(ids.filter(x => x === 'rdl').length, 1);
});

test('shoulder pain trend suggests a shoulder-friendlier swap', () => {
  const s = [9, 5, 2].map(d => S(d, 'Верх 1', {shoulder: W3(30, 10)}, {pain: {shoulder: 5}, knee: null}));
  const k = insights(db(s, {settings: {name: '', pain: ['shoulder'], knee: false, focus: [], goal: '', days: null, level: null}}), now).find(x => x.kind === 'pain');
  assert.ok(k, 'pain insight');
  assert.match(k.title, /Плечи/);
});

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {solve, lerpPose, ik2, phaseAt, SEG} from '../js/anim/rig.js';
import {frameSvg, viewBox, FLOOR} from '../js/anim/draw.js';
import {MOVES, moveFor} from '../js/data/moves.js';
import {EX} from '../js/data/exercises.js';

const KINDS = ['rect', 'line', 'circ', 'pad', 'handle', 'disc', 'mat', 'bench', 'seat', 'stack', 'pulley', 'cable', 'db', 'bb', 'bar', 'lever', 'plat', 'roller', 'rail', 'pullbar', 'smith', 'box', 'bike'];
const near = (a, b, eps = 0.6) => Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;

test('ik2 brings the limb end to a reachable target', () => {
  const base = [100, 100], tg = [140, 150], [a1, a2] = ik2(base, tg, 31, 35, -1);
  const r = d => d * Math.PI / 180, j = [base[0] + Math.sin(r(a1)) * 31, base[1] - Math.cos(r(a1)) * 31];
  assert.ok(near([j[0] + Math.sin(r(a2)) * 35, j[1] - Math.cos(r(a2)) * 35], tg));
});

test('root anchors a point: standing ankle stays where it was put', () => {
  const P = solve({root: 'an', at: [180, 209], t: 30, l: [190, 175, 90]});
  assert.ok(near(P.an, [180, 209]));
  assert.ok(Math.abs(Math.hypot(P.kn[0] - P.hip[0], P.kn[1] - P.hip[1]) - SEG.th) < 0.01);
});

test('ik targets hold hands and feet in place while the body moves', () => {
  const A = {root: 'to', at: [74, 211], t: 74, ik: {a: [214, 210]}, l: [255, 255, 172]};
  const B = {...A, t: 84, l: [264, 264, 177]};
  for (const k of [0, 0.5, 1]) assert.ok(near(solve(lerpPose(A, B, k)).hn, [214, 210], 1));
});

test('tempo: start and finish are held, motion eases in between', () => {
  assert.equal(phaseAt(0).k, 0);
  assert.equal(phaseAt(1200).k, 1);
  assert.equal(phaseAt(1200).stage, 'top');
  const mid = phaseAt(550).k;
  assert.ok(mid > 0.3 && mid < 0.7);
});

// Каждое описанное движение: известные детали снаряда, конечные координаты, ничего не уходит под пол.
for (const [id, m] of Object.entries(MOVES)) {
  test(`move ${id}: valid scene and poses`, () => {
    assert.ok(EX[id], `${id} is not in the exercise catalog`);
    assert.ok(m.a && m.b, 'needs start (a) and finish (b) poses');
    for (const o of m.s || []) assert.ok(KINDS.includes(o.k), `unknown equipment part "${o.k}"`);
    const spec = moveFor(id, EX[id]);
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const P = solve(lerpPose(m.a, m.b, k), m.v === 'f');
      for (const [n, v] of Object.entries(P)) {
        assert.ok(Number.isFinite(v[0]) && Number.isFinite(v[1]), `${n} is not a number at k=${k}`);
        assert.ok(v[1] <= FLOOR + 1.5, `${n} goes under the floor (y=${v[1].toFixed(1)}) at k=${k}`);
      }
      const svg = frameSvg(spec, lerpPose(m.a, m.b, k), k, 't', viewBox(spec, [m.a, m.b]));
      assert.ok(!/NaN|undefined/.test(svg), 'svg has NaN/undefined');
    }
  });
}

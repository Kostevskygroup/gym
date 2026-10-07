// node tools/pose-points.mjs <id> [k] — координаты суставов позы (k: 0 старт, 1 финиш, по умолчанию оба).
// Помогает ставить снаряд под фигуру: плечи на скамью, кисти на гриф, стопы на пол (y ≈ 209 у щиколотки).
import {solve, lerpPose} from '../js/anim/rig.js';
import {MOVES} from '../js/data/moves.js';
const [id, kArg] = process.argv.slice(2), m = MOVES[id];
if (!m) {console.error('нет движения', id); process.exit(1);}
const KEYS = ['hip', 'sh', 'hd', 'el', 'hn', 'hn2', 'kn', 'an', 'he', 'to', 'an2', 'to2'];
for (const k of kArg === undefined ? [0, 1] : [+kArg]) {
  const P = solve(lerpPose(m.a, m.b, k), m.v === 'f');
  console.log(`k=${k} ` + KEYS.map(n => `${n}=${P[n].map(v => Math.round(v)).join(',')}`).join(' '));
}

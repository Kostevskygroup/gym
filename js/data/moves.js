// Анимация техники: для каждого упражнения — снаряд (s), поза «старт» (a) и «финиш» (b).
// Формат поз и углов — js/anim/rig.js; детали снаряда — js/anim/draw.js (EQ). Пол — y = 214, щиколотка стоя — y ≈ 209.
// v:'f' — вид спереди; tempo: 'rep' (по умолчанию) | 'hold' (удержание) | 'fast' (кардио); m — свои подсвеченные мышцы.

import {M as MACHINES} from './moves/machines.js';
import {M as MACHINES2} from './moves/machines2.js';
import {M as BIKES} from './moves/bikes.js';
import {M as CABLE1} from './moves/cable1.js';
import {M as CABLE2} from './moves/cable2.js';
import {M as CABLE3} from './moves/cable3.js';
import {M as CABLE4} from './moves/cable4.js';
import {M as FREE} from './moves/free.js';
import {M as FREE2} from './moves/free2.js';
import {M as BENCH} from './moves/bench.js';
import {M as BENCH2} from './moves/bench2.js';
import {M as SMITH} from './moves/smith.js';
import {M as SMITH2} from './moves/smith2.js';
import {M as FLOOR} from './moves/floor.js';
import {M as FLOOR2} from './moves/floor2.js';
import {STAND, STAND_F, ANKLE_Y} from './moves/kit.js';

const BASE = {
  dbcurl: {
    s: [{k: 'db', at: 'hn2', z: 2}, {k: 'db', at: 'hn', z: 7}],
    a: {...STAND, a: [182, 182]},
    b: {...STAND, a: [174, 28]},
  },
  // Таз уходит назад, стопы и угол в колене (~160°) почти не меняются; гантели скользят по ногам до середины голени.
  rdl: {
    la: 'Внизу', lb: 'Вверху',
    s: [{k: 'db', at: 'hn2', z: 2}, {k: 'db', at: 'hn', z: 7}],
    a: {at: [148, 130.6], t: 82, hd: -10, ik: {l: [180, ANKLE_Y], a: [189, 186]}, l: [0, 0, 90]},
    b: {at: [178, 123.7], t: 0, ik: {l: [180, ANKLE_Y], a: [191, 135]}, l: [0, 0, 90]},
  },
  // Спина на спинке, руки на боковых рукоятях; стопы в верхней части платформы, пятки на ней всё время.
  // Внизу колено ~92°, вверху ~156° (не до щелчка). Стек — сразу за платформой, как в зале.
  legpress: {
    fit: [[278, 60]],
    s: [
      {k: 'rail', p: [[108, 210], [262, 210]], w: 6, z: -1},
      {k: 'stack', x: 232, top: 64, lift: 22, z: -1},
      {k: 'lever', from: [232, 138], to: {p: 'ft', d: [11, 10]}, w: 6, z: -1},
      {k: 'seat', x: 104, y: 160, w: 56, back: {ang: 62, len: 74}},
      {k: 'handle', at: 'hn', z: 8},
      {k: 'plat', at: {p: 'ft', d: [7, 10]}, ang: 6, w: 78, z: 8},
    ],
    a: {at: [112, 150], t: -28, hd: 8, ik: {a: [122, 156], l: [172, 132]}, l: [0, 0, 6]},
    b: {at: [112, 150], t: -28, hd: 8, ik: {a: [122, 156], l: [195, 136]}, l: [0, 0, 6]},
  },
  // Impulse: колонна перед сиденьем держит валики на бёдрах, сверху дуга уходит назад к оси рычагов;
  // рукояти ходят по дуге вокруг этой оси; стек рядом с колонной.
  lat: {
    s: [
      {k: 'stack', x: 222, top: 40, lift: 20, z: -1},
      {k: 'rect', x: 205, y: 48, w: 9, h: 166, c: 'steel', z: -1},
      {k: 'line', p: [[209.5, 52], [206, 26], [186, 14], [104, 14], [70, 60]], w: 9, z: -1},
      {k: 'seat', x: 116, y: 178, w: 54},
      {k: 'roller', at: {p: 'kn', d: [-4, -15]}, r: 8, arm: [209, 150], z: 8},
      {k: 'lever', from: [70, 60], to: 'hn', z: 3},
    ],
    a: {at: [140, 166], t: -4, l: [90, 180, 90], ik: {a: {c: [70, 60], r: 100, ang: 76}}},
    b: {at: [140, 166], t: -16, hd: 8, l: [90, 180, 90], ik: {a: {c: [70, 60], r: 100, ang: 124}}},
  },
  // Носки закреплены ik — не уходят в коврик, корпус лишь чуть «дышит».
  plank: {
    tempo: 'hold',
    s: [{k: 'mat', x: 50, w: 260, z: -1}],
    a: {root: 'el', at: [262, 205], t: 80, hd: 6, a: [180, 92], ik: {l: [123.5, 192]}, l: [0, 0, 175]},
    b: {root: 'el', at: [262, 205], t: 78, hd: 6, a: [180, 92], ik: {l: [123.5, 192]}, l: [0, 0, 175]},
  },
  hipthrust: {
    s: [
      {k: 'smith', x: 214, z: -1},
      {k: 'bench', x: 70, y: 166, w: 96},
      {k: 'bb', at: {p: 'hip', d: [4, -18]}, r: 21, z: 8},
    ],
    a: {root: 'sh', at: [160, 160], t: 302, hd: 34, ik: {l: [262, 209], a: [214, 170]}, l: [0, 0, 92]},
    b: {root: 'sh', at: [160, 160], t: 272, hd: 46, ik: {l: [262, 209], a: [218, 144]}, l: [0, 0, 92]},
  },
  lateral: {
    v: 'f',
    s: [{k: 'db', at: 'hn', z: 8}, {k: 'db', at: 'hn2', z: 8}],
    a: {...STAND_F, a: [190, 182], a2: [170, 178]},
    b: {...STAND_F, a: [266, 258], a2: [94, 102]},
  },
  fly: {
    v: 'f',
    s: [
      {k: 'rect', x: 14, y: 16, w: 8, h: 198, c: 'steel', z: -1}, {k: 'rect', x: 338, y: 16, w: 8, h: 198, c: 'steel', z: -1},
      {k: 'pulley', x: 26, y: 34, z: -1}, {k: 'pulley', x: 334, y: 34, z: -1},
      {k: 'cable', from: [26, 34], to: 'hn', z: 8}, {k: 'cable', from: [334, 34], to: 'hn2', z: 8},
    ],
    a: {...STAND_F, a: [262, 250], a2: [98, 110]},
    b: {...STAND_F, a: [205, 150], a2: [155, 210]},
  },
  pushup: {
    s: [{k: 'mat', x: 40, w: 270, z: -1}],
    a: {root: 'to', at: [74, 211], t: 74, hd: 4, ik: {a: [214, 210]}, l: [255, 255, 172]},
    b: {root: 'to', at: [74, 211], t: 84, hd: 4, ik: {a: [214, 210]}, l: [264, 264, 177]},
  },
};

export const MOVES = {...MACHINES, ...MACHINES2, ...BIKES, ...CABLE1, ...CABLE2, ...CABLE3, ...CABLE4, ...FREE, ...FREE2, ...BENCH, ...BENCH2, ...SMITH, ...SMITH2, ...FLOOR, ...FLOOR2, ...BASE};

// Движение для упражнения (с группой мышц из каталога) или null — тогда анимации нет.
export const moveFor = (id, e) => MOVES[id] ? {g: e && e.g, ...MOVES[id]} : null;

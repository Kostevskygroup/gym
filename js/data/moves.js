// Анимация техники: для каждого упражнения — снаряд (s), поза «старт» (a) и «финиш» (b).
// Формат поз и углов — js/anim/rig.js; детали снаряда — js/anim/draw.js (EQ). Пол — y = 214, щиколотка стоя — y ≈ 209.
// v:'f' — вид спереди; tempo: 'rep' (по умолчанию) | 'hold' (удержание) | 'fast' (кардио); m — свои подсвеченные мышцы.

import {M as MACHINES} from './moves/machines.js';
import {M as CABLE1} from './moves/cable1.js';
import {M as CABLE2} from './moves/cable2.js';
import {M as FREE} from './moves/free.js';
import {M as BENCH} from './moves/bench.js';
import {M as SMITH} from './moves/smith.js';
import {M as FLOOR} from './moves/floor.js';
import {STAND, STAND_F} from './moves/kit.js';

const BASE = {
  dbcurl: {
    s: [{k: 'db', at: 'hn2', z: 2}, {k: 'db', at: 'hn', z: 7}],
    a: {...STAND, a: [182, 182]},
    b: {...STAND, a: [174, 28]},
  },
  rdl: {
    s: [{k: 'db', at: 'hn2', z: 2}, {k: 'db', at: 'hn', z: 7}],
    a: {...STAND, a: [180, 180]},
    b: {...STAND, t: 72, hd: -10, l: [200, 172, 90], a: [180, 180]},
  },
  legpress: {
    s: [
      {k: 'rail', p: [[150, 196], [330, 196]], w: 6, z: -1},
      {k: 'stack', x: 300, top: 60, lift: 22, z: -1},
      {k: 'seat', x: 96, y: 160, w: 56, back: {ang: 62, len: 74}},
      {k: 'plat', at: {p: 'ft', d: [7, 0]}, ang: 0, w: 70, z: 8},
    ],
    a: {at: [128, 150], t: -28, hd: 8, a: [150, 120], l: [58, 132, 20]},
    b: {at: [128, 150], t: -28, hd: 8, a: [150, 120], l: [82, 96, 6]},
  },
  // Impulse: рычаги с рукоятями ходят по дуге от верхней оси за спиной; стек сбоку.
  lat: {
    s: [
      {k: 'stack', x: 198, top: 40, lift: 20, z: -1},
      {k: 'rect', x: 58, y: 50, w: 9, h: 164, c: 'steel', z: -1},
      {k: 'line', p: [[62, 54], [70, 60]], w: 9, z: -1},
      {k: 'seat', x: 116, y: 178, w: 54},
      {k: 'roller', at: {p: 'kn', d: [-4, -15]}, r: 8, z: 8},
      {k: 'lever', from: [70, 60], to: 'hn', z: 8},
    ],
    a: {at: [140, 166], t: -4, l: [90, 180, 90], ik: {a: {c: [70, 60], r: 100, ang: 76}}},
    b: {at: [140, 166], t: -16, hd: 8, l: [90, 180, 90], ik: {a: {c: [70, 60], r: 100, ang: 124}}},
  },
  plank: {
    tempo: 'hold',
    s: [{k: 'mat', x: 50, w: 260, z: -1}],
    a: {root: 'el', at: [262, 205], t: 80, hd: 6, a: [180, 92], l: [262, 262, 175]},
    b: {root: 'el', at: [262, 205], t: 78, hd: 6, a: [180, 92], l: [260, 262, 175]},
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

export const MOVES = {...MACHINES, ...CABLE1, ...CABLE2, ...FREE, ...BENCH, ...SMITH, ...FLOOR, ...BASE};

// Движение для упражнения (с группой мышц из каталога) или null — тогда анимации нет.
export const moveFor = (id, e) => MOVES[id] ? {g: e && e.g, ...MOVES[id]} : null;

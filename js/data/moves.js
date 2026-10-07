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

// Башня кроссовера спереди, как tower() в cable4: колонна с кареткой-роликом (cx, py), стек снаружи (st −1 — слева),
// колпак на top; трос: блоки → верхние ролики → каретка. F — пол.
const towerF = (cx, py, st, top, lift = 14, F = 214) => {
  const sx = st > 0 ? cx + 9 : cx - 41, L = Math.min(cx, sx) - 6, R = Math.max(cx, sx + 32) + 6;
  return [
    {k: 'line', p: [[st > 0 ? cx - 24 : L, F - 3], [st > 0 ? R : cx + 24, F - 3]], w: 6, z: -1},
    {k: 'rect', x: L, y: top - 5, w: R - L, h: 8, z: -1},
    {k: 'rect', x: cx - 4, y: top, w: 8, h: F - top - 3, c: 'hi', z: -1},
    {k: 'rect', x: cx - 6, y: py - 9, w: 12, h: 18, c: 'dark', z: -1},
    {k: 'stack', x: sx, top, w: 32, lift, z: -1, cable: {to: [cx, py], via: [[sx + 16, top + 11], [cx, top + 11]]}},
    {k: 'pulley', x: cx, y: py, z: -1},
  ];
};

const BASE = {
  dbcurl: {
    s: [{k: 'db', at: 'hn2', z: 2}, {k: 'db', at: 'hn', z: 7}],
    a: {...STAND, a: [182, 182]},
    b: {...STAND, a: [174, 28]},
  },
  // Старт стоя, гантели перед бёдрами → таз назад; угол в колене (~160°) почти не меняется, гантели скользят до середины голени.
  rdl: {
    la: 'Вверху', lb: 'Внизу',
    s: [{k: 'db', at: 'hn2', z: 2}, {k: 'db', at: 'hn', z: 7}],
    a: {at: [178, 123.7], t: 0, ik: {l: [180, ANKLE_Y], a: [191, 135]}, l: [0, 0, 90]},
    b: {at: [148, 130.6], t: 82, hd: -10, ik: {l: [180, ANKLE_Y], a: [189, 186]}, l: [0, 0, 90]},
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
  // Impulse: колонна перед сиденьем держит валики на бёдрах, сверху балка; рычаги висят с балки над головой,
  // рукояти идут вниз к верху груди; корпус почти не раскачивается; стек рядом с колонной.
  lat: {
    fit: [[128, 34]],
    s: [
      {k: 'stack', x: 222, top: 40, lift: 20, z: -1},
      {k: 'rect', x: 205, y: 48, w: 9, h: 166, c: 'steel', z: -1},
      {k: 'line', p: [[209.5, 52], [206, 26], [186, 14], [126, 14]], w: 9, z: -1},
      {k: 'seat', x: 116, y: 178, w: 54},
      {k: 'roller', at: {p: 'kn', d: [-4, -15]}, r: 8, arm: [209, 150], z: 8},
      {k: 'lever', from: [128, 16], to: 'hn', z: 3},
    ],
    a: {at: [140, 166], t: -8, l: [90, 180, 90], ik: {a: [160, 48]}},
    b: {at: [140, 166], t: -10, hd: 8, l: [90, 180, 90], ik: {a: [153, 115]}},
  },
  // Носки закреплены ik — не уходят в коврик, корпус лишь чуть «дышит».
  plank: {
    tempo: 'hold',
    s: [{k: 'mat', x: 50, w: 260, z: -1}],
    a: {root: 'el', at: [262, 205], t: 80, hd: 6, a: [180, 92], ik: {l: [123.5, 192]}, l: [0, 0, 175]},
    b: {root: 'el', at: [262, 205], t: 78, hd: 6, a: [180, 92], ik: {l: [123.5, 192]}, l: [0, 0, 175]},
  },
  // Смит в профиль, как в smith2: стойки (задняя — левее ножки скамьи, передняя — за носками), база, направляющая
  // x 214 — гриф ходит по ней строго вертикально. Скамья поперёк — виден торец: подушка на центральной ножке
  // с Т-опорой; лопатки на её краю.
  hipthrust: {
    s: [
      {k: 'rect', x: 124, y: -20, w: 9, h: 234, z: -2}, {k: 'rect', x: 290, y: -20, w: 9, h: 234, z: -2},
      {k: 'rect', x: 118, y: 208, w: 187, h: 6, z: -2},
      {k: 'line', p: [[214, -20], [214, 208]], w: 3, c: 'hi', z: -1},
      {k: 'line', p: [[147, 183], [147, 205]], w: 7, z: 0}, {k: 'line', p: [[117, 208], [177, 208]], w: 6, z: 0},
      {k: 'handle', at: [117, 208], r: 5, z: 0}, {k: 'handle', at: [177, 208], r: 5, z: 0},
      {k: 'pad', x: 130, y: 175, w: 34, h: 10, z: 0},
      {k: 'bb', at: 'hn', r: 21, z: 8},
    ],
    a: {root: 'sh', at: [160, 160], t: 302, hd: 34, ik: {l: [262, 209], a: [214, 170]}, l: [0, 0, 92]},
    b: {root: 'sh', at: [160, 160], t: 272, hd: 46, ik: {l: [262, 209], a: [214, 144]}, l: [0, 0, 92]},
  },
  lateral: {
    v: 'f',
    s: [{k: 'db', at: 'hn', z: 8}, {k: 'db', at: 'hn2', z: 8}],
    a: {...STAND_F, a: [190, 182], a2: [170, 178]},
    b: {...STAND_F, a: [266, 258], a2: [94, 102]},
  },
  // Блоки на уровне плеч; локти чуть согнуты, кисти сходятся перед грудью. Спереди руки к зрителю не укорачиваются —
  // поэтому вверху локоть на рисунке согнут сильнее; дальний локоть наружу (ikb a2), а не через корпус.
  // Две башни со стеками снаружи и верхняя балка, как в cable4; каретки на высоте плеч.
  fly: {
    v: 'f', m: ['chest', 'delt'], fit: [[39, 60], [333, 60]],
    s: [
      ...towerF(86, 72, -1, 4), ...towerF(286, 72, 1, 4), {k: 'rect', x: 80, y: -1, w: 212, h: 8, z: -1},
      {k: 'cable', from: [86, 72], to: 'hn', z: 8, handle: false}, {k: 'cable', from: [286, 72], to: 'hn2', z: 8, handle: false},
      {k: 'handle', at: 'hn', r: 4.6, z: 8}, {k: 'handle', at: 'hn2', r: 4.6, z: 8},
    ],
    a: {...STAND_F, ikb: {a2: 1}, ik: {a: [108, 91], a2: [264, 91]}},
    b: {...STAND_F, ikb: {a2: 1}, ik: {a: [184, 99], a2: [188, 99]}},
  },
  pushup: {
    s: [{k: 'mat', x: 40, w: 270, z: -1}],
    a: {root: 'to', at: [74, 211], t: 68, hd: 4, ik: {a: [200, 210]}, l: [249, 249, 169]},
    b: {root: 'to', at: [74, 211], t: 88, hd: 4, ik: {a: [200, 210]}, l: [268, 268, 180]},
  },
};

export const MOVES = {...MACHINES, ...MACHINES2, ...BIKES, ...CABLE1, ...CABLE2, ...CABLE3, ...CABLE4, ...FREE, ...FREE2, ...BENCH, ...BENCH2, ...SMITH, ...SMITH2, ...FLOOR, ...FLOOR2, ...BASE};

// Движение для упражнения (с группой мышц из каталога) или null — тогда анимации нет.
export const moveFor = (id, e) => MOVES[id] ? {g: e && e.g, ...MOVES[id]} : null;

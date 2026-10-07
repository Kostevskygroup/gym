// Анимация техники: machines2 — рычажные тренажёры Impulse для верха (жимы, тяги). Формат — tools/ANIM_GUIDE.md.
import {ANKLE_Y} from './kit.js';

// Рукоять на дуге рычага через старт A и финиш B: ось на серединном перпендикуляре хорды на расстоянии d
// (s = ±1 — с какой стороны хорды ось). Возвращает цели ik для старта и финиша.
function arc(A, B, d, s = 1) {
  const dx = B[0] - A[0], dy = B[1] - A[1], L = Math.hypot(dx, dy);
  const c = [(A[0] + B[0]) / 2 - s * d * dy / L, (A[1] + B[1]) / 2 + s * d * dx / L].map(v => Math.round(v * 10) / 10);
  const ang = p => Math.atan2(p[0] - c[0], c[1] - p[1]) * 180 / Math.PI, r = Math.hypot(A[0] - c[0], A[1] - c[1]);
  const a0 = ang(A);
  let a1 = ang(B);
  while (a1 - a0 > 180) a1 -= 360;
  while (a1 - a0 < -180) a1 += 360;
  return {c, a: {c, r, ang: a0}, b: {c, r, ang: a1}, A, B};
}
// Неподвижный второй рычаг (одной рукой — вторая рукоять стоит в старте).
const restLever = (L, z = 1) => ({k: 'lever', from: L.c, to: L.A, z});

// ---- Жим от груди: сиденье с высокой спинкой до затылка, рычаги от нижней оси под сиденьем, стек сзади ----
const CH = arc([120, 121], [170, 122], 73, 1);
const CH_SEAT = {k: 'seat', x: 104, y: 172, w: 52, back: {ang: 80, len: 96}};
const chestS = (one) => [
  {k: 'stack', x: 18, top: 50, lift: 20, z: -1},
  {k: 'line', p: [[52, 211], [176, 211]], w: 6, z: -1},
  {k: 'line', p: [[CH.c[0] - 10, 211], CH.c, [CH.c[0] + 14, 211]], w: 7, z: -1},
  CH_SEAT,
  ...(one ? [restLever(CH)] : []),
  {k: 'lever', from: CH.c, to: 'hn', z: 8},
];
const CH_POSE = {at: [118, 161], t: -10, hd: 0, ik: {l: [172, ANKLE_Y]}};

// ---- Жим плечами: спинка с наклоном, рычаги от оси на стойке стека за спиной, рукояти у плеч ----
const SH = arc([126, 104], [118, 46], 75, -1);
const shoulderS = (one) => [
  {k: 'stack', x: 6, top: 40, lift: 20, z: -1},
  {k: 'line', p: [[40, 211], [168, 211]], w: 6, z: -1},
  {k: 'seat', x: 104, y: 172, w: 50, back: {ang: 78, len: 76}},
  {k: 'pad', x: 100 - 76 - 4 - 22, y: 168, w: 22, h: 10, rot: 78, ox: 100, oy: 172},
  ...(one ? [restLever(SH, 1)] : []),
  {k: 'lever', from: SH.c, to: 'hn', z: 3},
];
const SH_POSE = {at: [118, 161], t: -12, hd: -2, ik: {l: [172, ANKLE_Y]}};

// ---- Горизонтальная тяга: сиденье без спинки, вертикальный упор для груди, рычаги свисают с оси спереди сверху ----
// dy — сиденье и упор ниже (задняя дельта); подставка для стоп наклонная.
const rowFrame = (pv, dy) => [
  {k: 'stack', x: 8, top: 44, lift: 20, z: -1},
  {k: 'line', p: [[42, 211], [232, 211]], w: 6, z: -1},
  {k: 'rect', x: 222, y: 24, w: 9, h: 190, c: 'steel', z: -1},
  {k: 'line', p: [[226, 28], pv], w: 9, z: -1},
  {k: 'line', p: [[156, 120 + dy], [160, 120 + dy], [160, 211]], w: 6, z: -1},
  {k: 'line', p: [[170, 212.5], [201, 199.5]], w: 5, c: 'hi', z: 6},
  {k: 'rect', x: 152, y: 103 + dy, w: 5, h: 40, c: 'steel', r: 2, z: 6},
  {k: 'pad', x: 153, y: 100 + dy, w: 46, h: 11, rot: 90, ox: 153, oy: 100 + dy, z: 6},
  {k: 'seat', x: 96, y: 172 + dy, w: 56},
];
const rowS = (L, one, dy = 0, z = 8) => [...rowFrame(L.c, dy), ...(one ? [restLever(L, 1)] : []), {k: 'lever', from: L.c, to: 'hn', z}];
const ROW = arc([188, 130], [142, 126], 95, 1);
const ROW_POSE = {at: [122, 161], t: 5, hd: 2, l: [0, 0, 70], ik: {l: [180, 204]}};
// Задняя дельта: сиденье ниже — рукояти на уровне плеч, локти высоко.
const REAR = arc([190, 114], [132, 117], 95, 1);
const REAR_POSE = {...ROW_POSE, at: [122, 165], ik: {l: [180, 205]}};
// Сведение лопаток: руки прямые, рукоять уходит на несколько сантиметров.
const SCAP = arc([192, 131], [185, 130.5], 95, 1);

// ---- Верхняя тяга: та же сцена, что lat в js/data/moves.js ----
const LAT_PV = [70, 60];
const latS = (one, neutral) => [
  {k: 'stack', x: 198, top: 40, lift: 20, z: -1},
  {k: 'rect', x: 58, y: 50, w: 9, h: 164, c: 'steel', z: -1},
  {k: 'line', p: [[62, 54], [70, 60]], w: 9, z: -1},
  {k: 'seat', x: 116, y: 178, w: 54},
  {k: 'roller', at: {p: 'kn', d: [-4, -15]}, r: 8, z: 8},
  ...(one ? [{k: 'lever', from: LAT_PV, to: [161, 51], z: 1}] : []),
  {k: 'lever', from: LAT_PV, to: 'hn', z: 8},
  // вертикальная рукоять сквозь кулак
  ...(neutral ? [{k: 'roller', arm: {p: 'hn', d: [1, -11]}, at: {p: 'hn', d: [-1, 11]}, r: 3.4, z: 8},
    {k: 'bar', a: {p: 'hn', d: [1, -10]}, b: {p: 'hn', d: [-1, 9]}, ext: 0, plates: false, z: 8}] : []),
];
const LAT_POSE = {at: [140, 166], l: [90, 180, 90]};

export const M = {
  // Лопатки прижаты к спинке; рукояти от середины груди вперёд, локти не в замок.
  chest: {
    s: chestS(false),
    a: {...CH_POSE, ik: {...CH_POSE.ik, a: CH.a}},
    b: {...CH_POSE, ik: {...CH_POSE.ik, a: CH.b}},
  },
  // Одной рукой: вторая рукоять стоит у груди, свободная рука лежит на бедре у края сиденья.
  chest_1arm: {
    s: chestS(true),
    a: {...CH_POSE, ik: {...CH_POSE.ik, a: CH.a, a2: [154, 151]}},
    b: {...CH_POSE, ik: {...CH_POSE.ik, a: CH.b, a2: [154, 151]}},
  },
  // От уровня плеч вверх по дуге, локти чуть впереди корпуса, спина на спинке.
  shoulder: {
    s: shoulderS(false),
    a: {...SH_POSE, ik: {...SH_POSE.ik, a: SH.a}},
    b: {...SH_POSE, ik: {...SH_POSE.ik, a: SH.b}},
    fit: [[SH.c[0], 40]],
  },
  // Одной рукой: вторая рукоять стоит у плеча, свободная рука на бедре у края сиденья.
  shoulder_1arm: {
    s: shoulderS(true),
    a: {...SH_POSE, ik: {...SH_POSE.ik, a: SH.a, a2: [154, 151]}},
    b: {...SH_POSE, ik: {...SH_POSE.ik, a: SH.b, a2: [154, 151]}},
    fit: [[SH.c[0], 40]],
  },
  // Грудь на упоре; локти назад вдоль корпуса, рукояти к низу груди.
  row: {
    s: rowS(ROW, false),
    a: {...ROW_POSE, ik: {...ROW_POSE.ik, a: ROW.a}},
    b: {...ROW_POSE, ik: {...ROW_POSE.ik, a: ROW.b}},
    fit: [[230, 24]],
  },
  // Одной рукой: вторая рука лежит на бедре.
  row_1arm: {
    s: rowS(ROW, true),
    a: {...ROW_POSE, ik: {...ROW_POSE.ik, a: ROW.a, a2: [150, 147]}},
    b: {...ROW_POSE, ik: {...ROW_POSE.ik, a: ROW.b, a2: [150, 147]}},
    fit: [[230, 24]],
  },
  // Локти на уровне плеч уходят назад и в стороны до линии корпуса.
  row_rear: {
    s: rowS(REAR, false, 4, 3),
    a: {...REAR_POSE, ik: {...REAR_POSE.ik, a: REAR.a}},
    b: {...REAR_POSE, ik: {...REAR_POSE.ik, a: REAR.b}},
    fit: [[230, 24]],
  },
  // Руки прямые: только лопатки назад — плечи и рукояти уходят на пару сантиметров.
  row_scap: {
    s: rowS(SCAP, false),
    a: {...ROW_POSE, t: 10, hd: -2, ik: {...ROW_POSE.ik, a: SCAP.a}},
    b: {...ROW_POSE, t: 3, hd: 6, ik: {...ROW_POSE.ik, a: SCAP.b}},
    fit: [[230, 24]],
  },
  // Одной рукой: локоть к боку, корпус не заваливается; свободная рука держит валик, вторая рукоять вверху.
  lat_1arm: {
    s: latS(true, false),
    a: {...LAT_POSE, t: -4, ik: {a: {c: LAT_PV, r: 100, ang: 76}, a2: [179, 141]}},
    b: {...LAT_POSE, t: -8, hd: 6, ik: {a: {c: LAT_PV, r: 100, ang: 128}, a2: [179, 141]}},
  },
  // Вертикальные рукояти, ладони друг к другу; локти вниз и назад к рёбрам.
  lat_neutral: {
    s: latS(false, true),
    a: {...LAT_POSE, t: -4, ik: {a: {c: LAT_PV, r: 100, ang: 76}}},
    b: {...LAT_POSE, t: -14, hd: 8, ik: {a: {c: LAT_PV, r: 100, ang: 130}}},
  },
};

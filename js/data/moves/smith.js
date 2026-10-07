// Анимация техники: машина Смита (Life Fitness, img/smith.jpg). Формат — tools/ANIM_GUIDE.md.
// Гриф ходит строго вертикально по направляющей: x грифа одинаков в a и b, кисти держат гриф (ik).
// В профиль гриф — блин в кистях; направляющая проходит через его центр.
import {ANKLE_Y, FLOOR_Y} from './kit.js';

const rad = d => d * Math.PI / 180;
const mv = (p, a, len) => [p[0] + Math.sin(rad(a)) * len, p[1] - Math.cos(rad(a)) * len];
const r1 = p => p.map(v => Math.round(v * 10) / 10);

// Рама как в smith2.js frame(): задняя и передняя стойки, верхняя балка, база; направляющая x — через гриф.
// Стойки уходят за верх кадра. Блин на грифе — у кистей.
const TOP = -20;
const rails = x => [
  {k: 'rect', x: x - 72, y: TOP, w: 9, h: FLOOR_Y - TOP, z: -2},
  {k: 'rect', x: x + 63, y: TOP, w: 9, h: FLOOR_Y - TOP, z: -2},
  {k: 'rect', x: x - 78, y: FLOOR_Y - 6, w: 156, h: 6, z: -2},
  {k: 'rect', x: x - 72, y: TOP, w: 144, h: 8, z: -2},
  {k: 'line', p: [[x, TOP], [x, FLOOR_Y - 6]], w: 3, c: 'hi', z: -1},
];
// Скамья (img/bench.jpg), как в smith2.js/bench.js: стойка под сиденьем, балка к задней опоре, упор, заглушки.
// hx — стык сиденья и спинки; верх подушек y; спинка ang° от горизонта поднимается влево (dir 1 — вправо).
const padPt = (hx, ang, dir, d, off, y) => {
  const c = Math.cos(rad(ang)), s = Math.sin(rad(ang));
  return [hx + dir * (d * c - 4.5 * s) - dir * s * off, y + 4.5 - d * s - 4.5 * c - c * off];
};
function bench(hx, ang = 0, y = 170, dir = -1, z = 3) {
  const seat = 34, len = 84, sx = dir < 0 ? hx + 2 : hx - 2 - seat, fx = sx + seat / 2, rx = hx + dir * (len - 12);
  const prop = ang ? padPt(hx, ang, dir, len * 0.5, -9, y) : [rx, y + 8];
  return [
    {k: 'line', p: [[fx, y + 8], [fx, 205], [rx, 205]], w: 6, z},
    {k: 'line', p: [[hx + dir * 24, 205], prop], w: 5, z},
    {k: 'handle', at: [fx, 208], r: 5, z}, {k: 'handle', at: [rx, 208], r: 5, z},
    {k: 'pad', x: dir < 0 ? hx - len : hx, y, w: len, h: 9, rot: -dir * ang, ox: hx, oy: y + 4.5, z},
    {k: 'pad', x: sx, y, w: seat, h: 9, z},
  ];
}
const plate = (z = 6, r = 20) => ({k: 'bb', at: 'hn', r, z});
const smith = (x, z, r, ...rest) => [...rails(x), ...rest, plate(z, r)];
// Точка грифа на прямой x, касающаяся корпуса спереди (зазор gap от оси корпуса).
const touch = (hip, t, x, gap = 17) => {const n = mv([0, 0], t + 90, 1); return r1([x, hip[1] + (gap - (x - hip[0]) * n[0]) / n[1]]);};
// Кисть на почти прямой руке (64.5) на прямой x под/над плечом sh: down 1 — ниже плеча, −1 — выше.
const reach = (sh, x, down = 1) => r1([x, sh[1] + down * Math.sqrt(64.5 ** 2 - (x - sh[0]) ** 2)]);
const shOf = (hip, t) => mv(hip, t, 54);

// ---- гриф на трапециях: на спине за плечом (BK) и чуть выше (UP); локти вниз под грифом ----
const BK = 13, UP = 3;
const onBack = (bar, t) => mv(mv(bar, t + 90, BK), t + 180, UP);
// Гриф на вертикали x, таз на высоте hipY при наклоне t; плечо (root) ставится под гриф.
const backPose = (x, hipY, t, hd, ik, l = [0, 0, 90], l2) => {
  const o = mv(onBack([0, 0], t), t, -54), bar = r1([x, hipY - o[1]]);
  return {root: 'sh', at: r1(onBack(bar, t)), t, hd, ik: {a: bar, ...ik}, ikb: {a: 1}, l, ...(l2 ? {l2} : {})};
};

// Присед: стопы чуть впереди грифа, голень наклонена мало, внизу бедро параллельно полу.
const SQ_AN = [200, ANKLE_Y], SQ_X = 183;
const SQ_TOP = backPose(SQ_X, 123.2, -2, 2, {l: SQ_AN});
// На скамью: таз дальше назад, ягодицы касаются скамьи чуть выше параллели.
const BOX_LOW = backPose(SQ_X, 162.7, 32, -22, {l: SQ_AN});

// Сплит-присед: длинная разножка, корпус вертикально, таз строго вниз; заднее колено почти у коврика.
const SP_X = 159, SP_F = [205, ANKLE_Y], SP_R = [124, 200];
const split = y => backPose(SP_X, y, 2, 0, {l: SP_F, l2: SP_R}, [0, 0, 90], [0, 0, 134]);

// Болгарский: подъём задней стопы на скамье позади, корпус чуть вперёд.
const BG_X = 165, BG_F = [204, ANKLE_Y], BG_R = [110, 165];
const bulg = (y, t) => backPose(BG_X, y, t, 6 - t, {l: BG_F, l2: BG_R}, [0, 0, 90], [0, 0, 258]);

// Икры: носок на краю блина (пятка ниже края), ноги прямые; гриф над плечами в обеих позах (x общий).
const CF_TOE = [214, 200.3];
const calfBar = (f, L, t) => {const an = mv(CF_TOE, f, -15), hip = mv(mv(an, L + 1.5, -42), L - 1.5, -44); return mv(mv(mv(hip, t, 54), t - 90, BK), t, UP);};
const CF_X = r1(calfBar(66, 180, 2))[0];
const calf = (f, L, t) => ({root: 'to', at: CF_TOE, t, l: [L - 1.5, L + 1.5, f], ik: {a: [CF_X, r1(calfBar(f, L, t))[1]]}, ikb: {a: 1}});

// ---- наклоны: таз в at, стопы на полу, кисти на грифе (вертикаль x) ----
const AN = [196, ANKLE_Y];
const hinge = (hip, t, hd, hn) => ({at: hip, t, hd, ik: {l: AN, a: hn}, l: [0, 0, 90]});
const RDL_X = 204, RDL_LOW = [164, 131], RDL_TOP = [191, 123.5];
const ROW_X = 197, ROW_HIP = [163, 131];

// ---- лёжа на скамье: голова влево, стопы на полу ----
const BN_HIP = [190, 152], BN_T = 272, BN_SH = shOf(BN_HIP, BN_T), BN_FT = [234, ANKLE_Y];
const lying = (hn, hd = -9) => ({at: BN_HIP, t: BN_T, hd, ik: {l: BN_FT, a: hn}, l: [0, 0, 92]});
// Широкий хват касается ниже середины груди, узкий — низа грудины (локти ближе к корпусу).
const BN_X = Math.round(BN_SH[0] + 18), CG_X = Math.round(BN_SH[0] + 24);
const FLAT = bench(174, 0, 166);

// Наклонная 30°: таз в углу сиденья, корпус и затылок на спинке.
const IN_HIP = [160, 154], IN_T = 300, IN_SH = shOf(IN_HIP, IN_T), IN_X = 129;
const incl = hn => ({at: IN_HIP, t: IN_T, hd: -12, ik: {l: [205, ANKLE_Y], a: hn}, l: [0, 0, 90]});

// Сидя, спинка почти вертикально; гриф перед лицом.
const SE_HIP = [156, 154], SE_T = -8, SE_SH = shOf(SE_HIP, SE_T), SE_X = 170;
const seated = hn => ({at: SE_HIP, t: SE_T, hd: 8, ik: {l: [204, ANKLE_Y], a: hn}, l: [0, 0, 90]});

// ---- гриф неподвижен на крюках, тело прямое и поворачивается вокруг опоры ----
// Опора и углы t подобраны заранее: в одной позе грудь касается грифа (зазор 17), в другой рука ~64.5 (почти прямая).
// Отжимания: носки на полу, грудь к грифу (B); стопа на носке.
const PU_B = [236, 126], PU_TO = [138.6, 211];
const pushT = t => ({root: 'to', at: PU_TO, t, hd: 4, l: [t + 180, t + 180, t + 100], ik: {a: PU_B}});
// Австралийские: пятки на полу, грудь к грифу (B).
const IR_B = [148, 122], IR_HE = [238.1, 209];
const rowT = t => ({root: 'he', at: IR_HE, t, hd: 8, l: [t + 180, t + 180, t + 95], ik: {a: IR_B}});

export const M = {
  // Жим лёжа: гриф опускается к низу груди и выжимается строго вверх; лопатки и таз на скамье.
  smithbench: {
    s: smith(BN_X, 3, 20, ...FLAT), // блин за корпусом — грудь видна
    a: lying(touch(BN_HIP, BN_T, BN_X)),
    b: lying(reach(BN_SH, BN_X, -1)),
    fit: [[BN_X, reach(BN_SH, BN_X, -1)[1] - 24]],
    la: 'У груди', lb: 'Руки прямые',
  },
  // Икры: гриф на плечах, носки на краю блина; пятки ниже края до растяжения → на носки как можно выше.
  smithcalf: {
    // Один блин лёжа (как dbcalfone): подушечка стопы на ребре, пятка ниже края; ступица — впереди носка.
    s: [...rails(CF_X), {k: 'rect', x: CF_TOE[0] - 9, y: 204, w: 40, h: 10, c: 'plate', r: 2}, {k: 'rect', x: CF_TOE[0] - 7, y: 204, w: 36, h: 2, c: 'plateHi', r: 1},
      {k: 'rect', x: CF_TOE[0] + 8, y: 201.2, w: 16, h: 3.2, c: 'plateHi', r: 1.2}, plate(4, 21)],
    a: calf(66, 180, 2),
    b: calf(138, 178.9, 0),
    la: 'Пятки вниз', lb: 'На носках',
  },
  // Присед на скамью: таз назад и вниз до касания ягодицами, без посадки.
  smith_box_squat: {
    m: ['quads', 'glutes'],
    s: smith(SQ_X, 4, 21, ...bench(134, 0, 175)),
    a: BOX_LOW, b: SQ_TOP,
    la: 'Касание скамьи', lb: 'Вверху',
  },
  // Присед: до параллели бедра с полом, колени по носкам, стопы впереди грифа.
  smith_squat: {
    s: smith(SQ_X, 4, 21),
    a: backPose(SQ_X, 169, 28, -20, {l: SQ_AN}), b: SQ_TOP,
    la: 'Внизу', lb: 'Вверху',
  },
  // Выпады на месте: таз строго вниз, заднее колено почти касается сложенного коврика.
  smith_split_squat: {
    s: smith(SP_X, 4, 21, {k: 'rect', x: 150, y: 207, w: 34, h: 7, c: 'pad', r: 3, z: 0}),
    a: split(155), b: split(132.1),
    la: 'Внизу', lb: 'Вверху',
  },
  // Болгарский: задняя стопа подъёмом на скамье, вниз до почти параллели переднего бедра.
  smith_bulgarian: {
    m: ['quads', 'glutes'],
    s: smith(BG_X, 4, 21, ...bench(80)),
    a: bulg(160, 14), b: bulg(129.6, 6),
    la: 'Внизу', lb: 'Вверху',
  },
  // Румынская: таз назад, колени почти не сгибаются, гриф скользит вдоль ног чуть ниже колен.
  smith_rdl: {
    s: smith(RDL_X, 6, 20),
    a: hinge(RDL_TOP, 4, 0, reach(shOf(RDL_TOP, 4), RDL_X)),
    b: hinge(RDL_LOW, 72, -10, reach(shOf(RDL_LOW, 72), RDL_X)),
    la: 'Вверху', lb: 'Внизу',
  },
  // Австралийские: тело прямое от плеч до пяток, грудь к грифу, лопатки сводятся.
  smith_inverted_row: {
    s: smith(IR_B[0], 6, 20),
    a: rowT(284.4), b: rowT(304),
    la: 'Руки прямые', lb: 'Грудь к грифу',
  },
  // Тяга в наклоне: корпус ~45°, колени мягкие; гриф с прямых рук к животу, локти назад.
  smith_bent_row: {
    s: smith(ROW_X, 6, 20),
    a: hinge(ROW_HIP, 48, -16, reach(shOf(ROW_HIP, 48), ROW_X)),
    b: hinge(ROW_HIP, 48, -16, touch(ROW_HIP, 48, ROW_X)),
    la: 'Руки прямые', lb: 'К животу',
  },
  // Жим сидя: гриф перед лицом от подбородка до почти прямых рук; спина на спинке.
  smith_seated_press: {
    s: smith(SE_X, 3, 18, ...bench(140, 80, 168)),
    a: seated([SE_X, 92]),
    b: seated(reach(SE_SH, SE_X, -1)),
    la: 'У подбородка', lb: 'Вверху',
  },
  // Наклонная 30°: гриф на верх груди под ключицы и вверх; лопатки и таз на скамье.
  smith_incline_press: {
    s: smith(IN_X, 3, 20, ...bench(154, 30, 168)),
    a: incl(touch(IN_HIP, IN_T, IN_X)),
    b: incl(reach(IN_SH, IN_X, -1)),
    fit: [[IN_X, reach(IN_SH, IN_X, -1)[1] - 24]],
    la: 'У груди', lb: 'Руки прямые',
  },
  // Узкий хват: гриф к низу груди, локти вдоль корпуса, выжим трицепсом.
  smith_close_grip: {
    s: smith(CG_X, 6, 20, ...FLAT),
    a: lying(touch(BN_HIP, BN_T, CG_X)),
    b: lying(reach(BN_SH, CG_X, -1)),
    fit: [[CG_X, reach(BN_SH, CG_X, -1)[1] - 24]],
    la: 'У груди', lb: 'Руки прямые',
  },
  // Отжимания от грифа: тело — прямая линия, грудь к грифу и выжим до прямых рук.
  smith_bar_pushup: {
    s: smith(PU_B[0], 3, 20),
    a: pushT(28.1), b: pushT(48),
    la: 'Руки прямые', lb: 'Грудь у грифа',
  },
};

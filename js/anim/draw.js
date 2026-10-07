// Отрисовка сцены техники в SVG-строку: снаряд (сзади и спереди фигуры) + фигура-манекен с подсвеченными мышцами.
// Поле 360×240, пол на y = 214. Снаряд — простые детали; подвижные детали привязаны к точкам фигуры.
import {solve, dir} from './rig.js';

export const W = 360, H = 240, FLOOR = 214;
// near/far — заливки ближних и дальних частей тела; nearG/farG — их градиенты (объём), подставляются в кадре.
const C = {
  near: '#E6EDE9', far: '#93A69E', edge: '#0F1C18',
  mus: '#F5C842', musFar: '#B8963A',
  steel: '#5D6F68', hi: '#8C9D96', dark: '#1E2C28', pad: '#2E403A', padHi: '#43574F',
  cable: '#C7D1CC', plate: '#3B4B45', plateHi: '#71837C',
};
const f1 = n => Math.round(n * 10) / 10;
const P2 = p => `${f1(p[0])} ${f1(p[1])}`;

// Сужающаяся капсула между двумя точками — кость с мышцей (данные пути).
function capD(a, ra, b, rb) {
  const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 0.001, nx = -dy / d, ny = dx / d;
  const p = (q, r, s) => [q[0] + nx * r * s, q[1] + ny * r * s];
  return `M${P2(p(a, ra, 1))}L${P2(p(b, rb, 1))}A${f1(rb)} ${f1(rb)} 0 0 0 ${P2(p(b, rb, -1))}L${P2(p(a, ra, -1))}A${f1(ra)} ${f1(ra)} 0 0 0 ${P2(p(a, ra, 1))}Z`;
}
const dotD = (c, r) => `M${f1(c[0] - r)} ${f1(c[1])}a${f1(r)} ${f1(r)} 0 1 0 ${f1(2 * r)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-2 * r)} 0Z`;
const cap = (a, ra, b, rb, fill) => `<path d="${capD(a, ra, b, rb)}" fill="${fill}"/>`;
// Часть тела одним силуэтом: сначала тёмный контур всех деталей, сверху заливка — швов между деталями нет.
const part = (ds, fill, extra = '') => `<path d="${ds.join('')}" fill="${C.edge}" stroke="${C.edge}" stroke-width="3.2" stroke-linejoin="round"/><path d="${ds.join('')}" fill="${fill}"/>${extra}`;
const circ = (c, r, fill, edge = C.edge, sw = 1.4) => `<circle cx="${f1(c[0])}" cy="${f1(c[1])}" r="${f1(r)}" fill="${fill}"${edge ? ` stroke="${edge}" stroke-width="${sw}"` : ''}/>`;
const at = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const off = (p, ang, len) => {const [x, y] = dir(ang); return [p[0] + x * len, p[1] + y * len];};
const angOf = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI;

// Мышца на сегменте: золотая вставка внутри капсулы, сдвинутая к нужной стороне (side: −1 — перед, 1 — зад, 0 — центр).
function musSeg(a, ra, b, rb, side, color) {
  const ang = angOf(a, b) + (side < 0 ? -90 : 90), s = side ? 0.34 : 0;
  const A = off(at(a, b, 0.16), ang, ra * s), B = off(at(a, b, 0.84), ang, rb * s);
  return cap(A, ra * 0.6, B, rb * 0.6, color);
}

// Радиусы сегментов: [начало, конец].
const R = {th: [12.5, 8.6], sh: [8.4, 5.8], ua: [7.8, 5.9], fa: [6.1, 4.6], foot: [4.9, 3.7], hand: 5.3};

// Какие мышцы где: g (группа из каталога) → вставки. Можно задать m в описании движения.
export const MUS = {
  quads: ['quads'], hams: ['hams', 'glutes'], glutes: ['glutes', 'hams'], calves: ['calves'], gmed: ['gmed', 'glutes'],
  chest: ['chest', 'triceps'], backv: ['lats', 'biceps'], backh: ['lats', 'rear'], press: ['delt', 'triceps'],
  side: ['delt'], rear: ['rear'], biceps: ['biceps'], triceps: ['triceps'], core: ['abs'], cardio: ['quads', 'calves'],
};

function legHtml(P, s, color, mus, mc, front) {
  const hip = s ? P.hpF : P.hpN, kn = s ? P.kn2 : P.kn, an = s ? P.an2 : P.an, to = s ? P.to2 : P.to, he = s ? P.he2 : P.he;
  let h = '';
  const sd = v => front ? 0 : v;
  if (mus.has('quads')) h += musSeg(hip, R.th[0], kn, R.th[1], sd(-1), mc);
  if (mus.has('hams')) h += musSeg(hip, R.th[0], kn, R.th[1], sd(1), mc);
  if (mus.has('calves')) h += musSeg(kn, R.sh[0], an, R.sh[1], sd(1), mc);
  return part([capD(hip, R.th[0], kn, R.th[1]), capD(kn, R.sh[0], an, R.sh[1]), capD(he, R.foot[0], to, R.foot[1])], color, h);
}
function armHtml(P, s, color, mus, mc, front) {
  const sh = s ? P.shF : P.shN, el = s ? P.el2 : P.el, wr = s ? P.wr2 : P.wr, hn = s ? P.hn2 : P.hn;
  let h = '';
  const sd = v => front ? 0 : v;
  if (mus.has('biceps')) h += musSeg(sh, R.ua[0], el, R.ua[1], sd(-1), mc);
  if (mus.has('triceps')) h += musSeg(sh, R.ua[0], el, R.ua[1], sd(1), mc);
  if (mus.has('delt') || mus.has('rear')) h += circ(off(sh, angOf(sh, el) + (mus.has('rear') && !front ? 90 : 0), 1.5), 7, mc, null);
  return part([capD(sh, R.ua[0], el, R.ua[1]), capD(el, R.fa[0], wr, R.fa[1]), dotD(hn, R.hand)], color, h);
}

// Корпус: в профиль — капсула с тазом и грудной клеткой, спереди — трапеция.
function torsoHtml(P, pose, mus, front, fill) {
  const t = pose.t || 0, hip = P.hip, sh = P.sh;
  let h;
  if (front) {
    const L = [P.shN[0] - 4, P.shN[1] - 3], Rr = [P.shF[0] + 4, P.shF[1] - 3], hl = [P.hpN[0] - 6, hip[1] + 6], hr = [P.hpF[0] + 6, hip[1] + 6];
    h = part([`M${P2(L)}Q${P2([sh[0], sh[1] - 8])} ${P2(Rr)}L${P2(hr)}Q${P2([hip[0], hip[1] + 12])} ${P2(hl)}Z`], fill);
    if (mus.has('chest')) h += cap(at(hip, sh, 0.68), 6, at(hip, sh, 0.86), 6, C.mus).replace('<path', '<path transform="translate(-7 0)"') + cap(at(hip, sh, 0.68), 6, at(hip, sh, 0.86), 6, C.mus).replace('<path', '<path transform="translate(7 0)"');
    if (mus.has('abs')) h += cap(at(hip, sh, 0.12), 6, at(hip, sh, 0.6), 7, C.mus);
    if (mus.has('lats')) h += cap(at(hip, sh, 0.35), 3, at(hip, sh, 0.8), 5, C.mus).replace('<path', '<path transform="translate(-13 0)"') + cap(at(hip, sh, 0.35), 3, at(hip, sh, 0.8), 5, C.mus).replace('<path', '<path transform="translate(13 0)"');
    if (mus.has('gmed')) h += circ([P.hpN[0] - 5, hip[1] + 1], 6, C.mus) + circ([P.hpF[0] + 5, hip[1] + 1], 6, C.mus);
    return h;
  }
  const back = t - 90, fwd = t + 90;
  h = part([capD(hip, 14, at(hip, sh, 0.55), 13.6), capD(at(hip, sh, 0.45), 14.6, sh, 15.6), dotD(off(hip, back, 3.5), 14)], fill);
  if (mus.has('chest')) h += cap(off(at(hip, sh, 0.62), fwd, 6), 6, off(at(hip, sh, 0.9), fwd, 6), 6.5, C.mus);
  if (mus.has('abs')) h += cap(off(at(hip, sh, 0.14), fwd, 6.5), 5.5, off(at(hip, sh, 0.56), fwd, 6.5), 5.5, C.mus);
  if (mus.has('lats')) h += cap(off(at(hip, sh, 0.34), back, 6.5), 4.5, off(at(hip, sh, 0.86), back, 6.5), 6.5, C.mus);
  if (mus.has('glutes')) h += circ(off(off(hip, back, 6), t + 180, 1), 8.5, C.mus);
  if (mus.has('gmed')) h += circ(off(hip, t, 6), 6.5, C.mus);
  return h;
}

// Голова с намёком на лицо (выступ спереди) — видно, куда смотрит человек.
function headHtml(P, pose, front, fill) {
  const face = front ? [] : [dotD(off(P.hd, (pose.t || 0) + (pose.hd || 0) + 105, 7), 4.6)];
  return part([capD(P.sh, 6.6, P.nk, 6), dotD(P.hd, 12), ...face], fill);
}

// ---- снаряд ----
const pt = (P, ref) => Array.isArray(ref) ? ref : typeof ref === 'string' ? P[ref] : ref && ref.p ? [P[ref.p][0] + (ref.d?.[0] || 0), P[ref.p][1] + (ref.d?.[1] || 0)] : [0, 0];
const rect = (x, y, w, h, fill, r = 3, rot = 0, ox = x, oy = y) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${r}" fill="${fill}"${rot ? ` transform="rotate(${f1(rot)} ${f1(ox)} ${f1(oy)})"` : ''}/>`;
const line = (pts, w, color) => `<polyline points="${pts.map(P2).join(' ')}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
// Мягкая деталь (сиденье, спинка): тёмная подушка с полоской света сверху.
const padRect = (x, y, w, h, rot = 0, ox = x, oy = y) => rect(x, y, w, h, C.pad, 4, rot, ox, oy) + rect(x + 2, y, w - 4, 2.4, C.padHi, 1.2, rot, ox, oy);

const EQ = {
  rect: (o) => rect(o.x, o.y, o.w, o.h, C[o.c] || C.steel, o.r ?? 3, o.rot || 0, o.ox ?? o.x, o.oy ?? o.y),
  line: (o) => line(o.p, o.w || 6, C[o.c] || C.steel),
  circ: (o) => circ([o.x, o.y], o.r, C[o.c] || C.steel, null),
  pad: (o) => padRect(o.x, o.y, o.w, o.h, o.rot || 0, o.ox ?? o.x, o.oy ?? o.y),
  handle: (o, P) => {const c = pt(P, o.at || 'hn'); return circ(c, o.r || 4.5, C.dark, C.hi, 1.8);},
  disc: (o) => circ([o.x, o.y], o.r || 20, C.plate, C.plateHi, 2.2) + circ([o.x, o.y], (o.r || 20) * 0.36, C.dark, C.hi, 1.4),
  mat: (o) => rect(o.x, FLOOR - 4, o.w || 150, 5, '#2C4A40', 2.5),
  // Скамья/сиденье: подушка высотой y (верх), ножки до пола; back — спинка {ang: 0 плоско … 90 вертикально, len}.
  bench: (o) => {
    const w = o.w || 110, y = o.y ?? 160;
    let h = line([[o.x + 10, y + 8], [o.x + 10, FLOOR]], 5, C.steel) + line([[o.x + w - 10, y + 8], [o.x + w - 10, FLOOR]], 5, C.steel) + line([[o.x + 4, FLOOR], [o.x + w - 4, FLOOR]], 4, C.steel);
    h += padRect(o.x, y, w, 9);
    if (o.back) h += padRect(o.x - (o.back.len || 70), y, o.back.len || 70, 9, o.back.ang || 0, o.x, y + 4);
    return h;
  },
  seat: (o) => {
    const w = o.w || 46, y = o.y ?? 150;
    let h = line([[o.x + w / 2, y + 8], [o.x + w / 2, FLOOR]], 7, C.steel) + line([[o.x + w / 2 - 22, FLOOR], [o.x + w / 2 + 22, FLOOR]], 5, C.steel);
    h += padRect(o.x, y, w, 9);
    if (o.back) h += line([[o.x + 4, y + 6], [o.x - 6, y + 6]], 5, C.steel) + padRect(o.x - 4 - (o.back.len || 64), y - 4, o.back.len || 64, 10, o.back.ang ?? 80, o.x - 4, y);
    return h;
  },
  // Стойка с весовым стеком; блоки поднимаются вместе с движением (k). pul — где блок троса: 'top' | 'low' | число y.
  stack: (o, P, k) => {
    const x = o.x, top = o.top ?? 30, w = o.w || 34, lift = (o.lift ?? 18) * k;
    let h = rect(x - 3, top, 6, FLOOR - top, C.steel, 2) + rect(x + w - 3, top, 6, FLOOR - top, C.steel, 2) + rect(x - 3, top, w + 6, 7, C.steel, 2);
    h += line([[x + w / 2 - 6, top + 8], [x + w / 2 - 6, FLOOR - 4]], 1.5, C.hi) + line([[x + w / 2 + 6, top + 8], [x + w / 2 + 6, FLOOR - 4]], 1.5, C.hi);
    for (let i = 0; i < 9; i++) {
      const up = i >= 6 ? lift : 0, y = FLOOR - 10 - (8 - i) * 7 - up;
      h += rect(x + 3, y, w - 6, 6, i >= 6 ? C.plateHi : C.plate, 1.5);
    }
    // трос от поднятых блоков через блоки-ролики к рукояти
    if (o.cable) {
      const from = [x + w / 2, FLOOR - 10 - 2 * 7 - lift], via = o.cable.via || [];
      h += line([from, ...via, pt(P, o.cable.to || 'hn')], 1.8, C.cable) + via.map(v => circ(v, 5, C.dark, C.hi, 1.8)).join('');
    }
    return h;
  },
  pulley: (o) => circ([o.x, o.y], o.r || 6, C.dark, C.hi, 2),
  // Трос от блока к руке/ноге; handle — рукоять на конце.
  cable: (o, P) => {
    const a = pt(P, o.from), b = pt(P, o.to), via = o.via ? (Array.isArray(o.via[0]) ? o.via : [o.via]) : [];
    return line([a, ...via, b], 1.8, C.cable) + (o.handle === false ? '' : circ(b, 3.6, C.dark, C.hi, 1.6));
  },
  // Гантель в профиль — диск; штанга — большой блин; ez — блин поменьше. Рисуются в кисти.
  db: (o, P) => {const c = pt(P, o.at || 'hn'); return circ(c, o.r || 8.5, C.plate, C.plateHi, 2) + circ(c, 2.4, C.hi, null);},
  bb: (o, P) => {const c = pt(P, o.at || 'hn'), r = o.r || 21; return circ(c, r, C.plate, C.plateHi, 2.2) + circ(c, r * 0.36, C.dark, C.hi, 1.4) + circ(c, 2.6, C.hi, null);},
  // Гриф спереди: перекладина через обе кисти с блинами по краям.
  bar: (o, P) => {
    const a = pt(P, o.a || 'hn'), b = pt(P, o.b || 'hn2'), ext = o.ext ?? 34, ang = angOf(a, b), A = off(a, ang + 180, ext), B = off(b, ang, ext);
    let h = line([A, B], 4, C.hi);
    if (o.plates !== false) for (const e of [A, B]) h += rect(e[0] - 4, e[1] - (o.pr || 18), 8, (o.pr || 18) * 2, C.plate, 2);
    return h;
  },
  // Рычаг тренажёра от оси до рукояти.
  lever: (o, P) => {const a = pt(P, o.from), b = pt(P, o.to || 'hn'); return line([a, b], o.w || 7, C.steel) + circ(a, 6, C.dark, C.hi, 2) + circ(b, 4.5, C.dark, C.hi, 1.8);},
  // Платформа жима ногами под стопой, повёрнута по углу ang.
  plat: (o, P) => {const c = pt(P, o.at || 'ft'), w = o.w || 62; return rect(c[0] - 4, c[1] - w / 2, 8, w, C.steel, 3, o.ang || 0, c[0], c[1]) + rect(c[0] + 4, c[1] - w / 2 + 6, 4, w - 12, C.hi, 2, o.ang || 0, c[0], c[1]);},
  // Валик тренажёра у голени/щиколотки.
  roller: (o, P) => {const c = pt(P, o.at || 'an'); return (o.arm ? line([pt(P, o.arm), c], 6, C.steel) : '') + circ(c, o.r || 8, C.pad, C.padHi, 2);},
  rail: (o) => line(o.p, o.w || 8, C.steel),
  pullbar: (o) => line([[o.x, o.y], [o.x + (o.w || 60), o.y]], 5, C.hi),
  // Машина Смита: две направляющие и гриф с блинами в кистях (в профиль — блин).
  smith: (o) => rect(o.x - 3, o.top ?? 18, 6, FLOOR - (o.top ?? 18), C.steel, 2) + rect(o.x - 8, (o.top ?? 18), 16, 6, C.steel, 2),
  box: (o) => padRect(o.x, o.y, o.w || 50, FLOOR - o.y),
  bike: (o, P) => {
    const x = o.x, cx = x + 70, cy = 186;
    let h = line([[x, FLOOR], [x + 120, FLOOR]], 5, C.steel) + line([[x + 30, FLOOR], [x + 40, 120], [cx, cy]], 7, C.steel) + line([[cx, cy], [x + 108, 112], [x + 116, 104]], 6, C.steel);
    h += padRect(x + 20, 112, 40, 9) + line([[x + 104, 100], [x + 124, 100]], 6, C.hi);
    h += circ([cx, cy], 16, C.dark, C.hi, 2) + line([pt(P, 'ft'), pt(P, 'ft2')], 3, C.hi);
    return h;
  },
};

function eqHtml(list, P, k) {return list.map(o => (EQ[o.k] ? EQ[o.k](o, P, k) : '')).join('');}

// Слои: −10 далеко позади … 3 между дальними и ближними конечностями (по умолчанию) … 10 поверх всего.
export function sceneHtml(spec, pose, k, uid = 'mv') {
  const front = spec.v === 'f', P = solve(pose, front), mus = new Set(spec.m || MUS[spec.g] || []);
  const NEAR = `url(#${uid}n)`, FAR = `url(#${uid}f)`;
  const eq = spec.s || [], by = z => eq.filter(o => (o.z ?? 3) === z);
  const zs = [...new Set(eq.map(o => o.z ?? 3))];
  const body = [
    [1, legHtml(P, 1, front ? NEAR : FAR, mus, front ? C.mus : C.musFar, front)],
    [2, armHtml(P, 1, front ? NEAR : FAR, mus, front ? C.mus : C.musFar, front)],
    [4, torsoHtml(P, pose, mus, front, NEAR)],
    [5, headHtml(P, pose, front, NEAR)],
    [6, legHtml(P, 0, NEAR, mus, C.mus, front)],
    [7, armHtml(P, 0, NEAR, mus, C.mus, front)],
  ];
  const layers = [...body.map(([z, h]) => [z, h]), ...zs.map(z => [z + 0.5, eqHtml(by(z), P, k)])].sort((a, b) => a[0] - b[0]);
  const cx = (P.hip[0] + (P.an[0] + P.an2[0]) / 2) / 2;
  const shadow = `<ellipse cx="${f1(cx)}" cy="${FLOOR + 2}" rx="78" ry="5" fill="rgba(0,0,0,.35)"/>`;
  return shadow + layers.map(x => x[1]).join('');
}

// Кадр под движение: рамка 3:2 вокруг фигуры во всех фазах (+ точки fit из описания), пол — у нижнего края.
const PAD = 30, MIN_W = 230;
export function viewBox(spec, poses) {
  const front = spec.v === 'f', xs = [], ys = [];
  for (const p of poses) for (const v of Object.values(solve(p, front))) {xs.push(v[0]); ys.push(v[1]);}
  for (const [x, y] of spec.fit || []) {xs.push(x); ys.push(y);}
  const bottom = FLOOR + 14, top = Math.min(...ys) - PAD - 12, left = Math.min(...xs) - PAD, right = Math.max(...xs) + PAD;
  let w = right - left, h = bottom - top;
  if (w < MIN_W) w = MIN_W;
  if (w / h < 1.5) w = h * 1.5; else h = w / 1.5;
  const cx = (left + right) / 2;
  return [f1(cx - w / 2), f1(bottom - h), f1(w), f1(h)];
}

// Целая картинка: фон-подсветка, пол и сцена. uid — чтобы градиенты разных картинок на странице не путались.
export function frameSvg(spec, pose, k, uid = 'mv', vb = [0, 0, W, H]) {
  const [x, y, w, h] = vb;
  return `<svg viewBox="${vb.join(' ')}" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
  <defs><radialGradient id="${uid}bg" gradientUnits="userSpaceOnUse" cx="${f1(x + w / 2)}" cy="${f1(y + h * 0.42)}" r="${f1(w * 0.75)}"><stop offset="0" stop-color="#1F3A31"/><stop offset="1" stop-color="#0D1915"/></radialGradient>
  <linearGradient id="${uid}n" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F4F8F6"/><stop offset="1" stop-color="#C3D1CA"/></linearGradient>
  <linearGradient id="${uid}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9FB2AA"/><stop offset="1" stop-color="#76897F"/></linearGradient></defs>
  <rect x="${x - 10}" y="${y - 10}" width="${w + 20}" height="${h + 20}" fill="url(#${uid}bg)"/>
  <rect x="${x - 10}" y="${FLOOR}" width="${w + 20}" height="${h}" fill="rgba(0,0,0,.24)"/>
  <line x1="${x - 10}" y1="${FLOOR}" x2="${x + w + 10}" y2="${FLOOR}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>
  <g class="scene">${sceneHtml(spec, pose, k, uid)}</g></svg>`;
}

// Скелет фигуры для анимации техники: углы суставов → точки на плоскости. Без DOM — проверяется тестами.
// Углы — направление сегмента по часовой от «вверх»: 0 — вверх, 90 — вперёд (вправо), 180 — вниз, 270 — назад.
// Поза: {at:[x,y], root:'hip'|'an'|'hn'|…, t: корпус, hd: наклон головы к корпусу,
//        a:[плечо, предплечье] ближняя рука, a2 — дальняя, l:[бедро, голень, стопа] ближняя нога, l2 — дальняя,
//        ik:{a|a2:[x,y] — кисть сюда, l|l2:[x,y] — щиколотка сюда; или {c:[x,y], r, ang} — точка на дуге вокруг оси
//        рычага тренажёра (рукоять ходит по дуге)}, ikb:{a:±1} — в какую сторону сгиб (по умолчанию
//        колено вперёд, локоть назад)}. ik удобнее углов: стопа стоит на полу, руки держат гриф, сустав сгибается сам.
// Корень (root) не должен лежать на конечности с ik.

export const SEG = {torso: 54, neck: 9, head: 11, ua: 31, fa: 28, hand: 7, th: 44, sh: 42, foot: 15, heel: 5};
// Вид спереди: плечи и тазобедренные разнесены в стороны; в профиль совпадают.
export const FRONT = {sh: 17, hip: 9};

const rad = d => d * Math.PI / 180;
export const dir = a => [Math.sin(rad(a)), -Math.cos(rad(a))];
const add = (p, a, len) => {const [dx, dy] = dir(a); return [p[0] + dx * len, p[1] + dy * len];};

const mix = (x, y, k) => x + (y - x) * k;
const mixArr = (x, y, k) => x ? x.map((v, i) => mix(v, (y || x)[i] ?? v, k)) : y;

export function lerpPose(A, B, k) {
  const out = {...A};
  for (const f of ['t', 'hd']) out[f] = mix(A[f] ?? 0, B[f] ?? A[f] ?? 0, k);
  // дальние конечности без своих углов повторяют ближние (после ik) — их не заполняем
  for (const f of ['a', 'l', 'a2', 'l2']) if (A[f]) out[f] = mixArr(A[f], B[f] || A[f], k);
  out.at = mixArr(A.at, B.at || A.at, k);
  const mixT = (v, w) => Array.isArray(v) ? mixArr(v, w, k) : {c: mixArr(v.c, w.c, k), r: mix(v.r, w.r ?? v.r, k), ang: mix(v.ang, w.ang ?? v.ang, k)};
  if (A.ik) out.ik = Object.fromEntries(Object.entries(A.ik).map(([n, v]) => [n, mixT(v, (B.ik && B.ik[n]) || v)]));
  return out;
}

function limbArm(sh, [ua, fa, hn]) {
  const el = add(sh, ua, SEG.ua), wr = add(el, fa, SEG.fa);
  return {el, wr, hn: add(wr, hn ?? fa, SEG.hand)};
}
function limbLeg(hip, [th, sh, ft]) {
  const kn = add(hip, th, SEG.th), an = add(kn, sh, SEG.sh), f = ft ?? sh - 90;
  const to = add(an, f, SEG.foot), he = add(an, f + 180, SEG.heel);
  return {kn, an, to, he, ft: add(an, f, SEG.foot * 0.45)};
}

const angOf = (a, b) => Math.atan2(b[0] - a[0], -(b[1] - a[1])) * 180 / Math.PI;
// Двухзвенная обратная кинематика: углы [первое звено, второе], чтобы конец пришёл в target (или тянулся к нему).
export function ik2(base, target, L1, L2, bend) {
  const d = Math.max(1, Math.min(Math.hypot(target[0] - base[0], target[1] - base[1]), L1 + L2 - 0.01));
  const A = Math.acos(Math.max(-1, Math.min(1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d)))) * 180 / Math.PI;
  const a1 = angOf(base, target) - bend * A, j = add(base, a1, L1);
  return [a1, angOf(j, target)];
}
const IKB = {a: -1, a2: -1, l: 1, l2: 1};
// Цель ik: точка или точка на дуге рычага.
export const target = v => Array.isArray(v) ? v : add(v.c, v.ang, v.r);

// Все точки позы. front — вид спереди (руки и ноги по сторонам), иначе профиль лицом вправо.
export function solve(pose, front = false) {
  const p = {t: 0, hd: 0, ...pose, a: pose.a || [180, 180], l: pose.l || [180, 180, 90]}, ik = p.ik || {}, ikb = {...IKB, ...(p.ikb || {})};
  const raw = (at, useIk) => {
    const hip = at, sh = add(hip, p.t, SEG.torso), nk = add(sh, p.t + p.hd, SEG.neck);
    const hd = add(nk, p.t + p.hd, SEG.head);
    const off = front ? FRONT : {sh: 0, hip: 0};
    const shN = [sh[0] - off.sh, sh[1]], shF = [sh[0] + off.sh, sh[1]];
    const hpN = [hip[0] - off.hip, hip[1]], hpF = [hip[0] + off.hip, hip[1]];
    // кисть — на конце предплечья (hand продолжает его), щиколотка — на конце голени
    const arm = (n, base, ang) => useIk && ik[n] ? [...ik2(base, target(ik[n]), SEG.ua, SEG.fa + SEG.hand, ikb[n])] : ang;
    const leg = (n, base, ang) => useIk && ik[n] ? [...ik2(base, target(ik[n]), SEG.th, SEG.sh, ikb[n]), ang && ang[2]] : ang;
    const a = arm('a', shN, p.a), a2 = arm('a2', shF, p.a2 || (ik.a2 ? p.a : a));
    const l = leg('l', hpN, p.l), l2 = leg('l2', hpF, p.l2 || (ik.l2 ? p.l : l));
    const A = limbArm(shN, a), A2 = limbArm(shF, a2), L = limbLeg(hpN, l), L2 = limbLeg(hpF, l2);
    return {hip, sh, nk, hd, shN, shF, hpN, hpF, ...A, ...L,
      el2: A2.el, wr2: A2.wr, hn2: A2.hn, kn2: L2.kn, an2: L2.an, to2: L2.to, he2: L2.he, ft2: L2.ft};
  };
  const at = p.at || [0, 0], root = p.root || 'hip';
  if (root === 'hip') return raw(at, true);
  const z = raw([0, 0], false), r = z[root];
  if (!r) throw new Error('unknown root ' + root);
  return raw([at[0] - r[0], at[1] - r[1]], true);
}

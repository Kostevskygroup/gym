// Расчёты тренировок: цели, рекорды, объём, недели. Без DOM — тестируется в node.
import {DAY, r1, ymd} from './format.js';

export const topRep = r => {const m = String(r).match(/(\d+)(?!.*\d)/); return m ? +m[1] : null;};
export const lowRep = r => {const m = String(r).match(/\d+/); return m ? +m[0] : null;};

export function weekStart(d) {const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x;}
export const weekKey = d => ymd(weekStart(d));
const byDate = (a, b) => new Date(a.date) - new Date(b.date);

// Неделя плана = сколько недель уже было с тренировками (+ текущая).
// Перерыв не двигает план вперёд, переход часов (DST) не влияет.
export function planWeek(sessions, now = new Date()) {
  const weeks = new Set(sessions.map(s => weekKey(s.date)));
  return weeks.size + (weeks.has(weekKey(now)) ? 0 : 1);
}
export const recPhase = w => w <= 3 ? 'p1' : w <= 10 ? 'p2' : 'p3';
export const RANGE = {p1: [1, 3], p2: [4, 10], p3: [11, null]};
export const target = phase => phase === 'p1' ? 3 : 4;
export const RIR = {p1: 3, p2: 2, p3: 1};

export function gapDays(sessions, now = new Date()) {
  if (!sessions.length) return null;
  const last = Math.max(...sessions.map(s => +new Date(s.date)));
  return Math.floor((+now - last) / DAY);
}

export function nextWo(sessions, phase, keys) {
  const l = [...sessions].sort(byDate).reverse().find(s => s.phase === phase && keys.includes(s.wo));
  return l ? keys[(keys.indexOf(l.wo) + 1) % keys.length] : keys[0];
}

export function lastFor(sessions, id) {
  const s = [...sessions].sort(byDate).reverse().find(x => x.entries[id] && x.entries[id].length);
  return s ? {e: s.entries[id], date: s.date, phase: s.phase, wo: s.wo, knee: s.knee, pain: painOf(s)} : null;
}

// Сила подхода: для весовых — расчётный максимум (Эпли), для остальных — значение.
export const setScore = (t, x) => t === 'w' ? (+x.a || 0) * (1 + (+x.b || 0) / 30) : +x.b || 0;
export const bestSet = (t, e) => e.reduce((b, x) => !b || setScore(t, x) > setScore(t, b) ? x : b, null);
export const e1rm = (t, e) => e.length ? Math.max(...e.map(x => setScore(t, x))) : 0;

// Рекорды считаются заново по всей истории: правки и удаления сразу учитываются.
export function prMap(sessions, exOf) {
  const best = {}, out = new Map();
  [...sessions].sort(byDate).forEach(s => {
    const prs = [];
    Object.entries(s.entries).forEach(([id, e]) => {
      if (!e || !e.length) return;
      const t = exOf(id).t, bs = bestSet(t, e), sc = setScore(t, bs), pb = best[id];
      if (pb && sc > pb.sc * (t === 'w' ? 1.005 : 1)) prs.push({id, txt: prTxt(t, bs, pb.x)});
      if (!pb || sc > pb.sc) best[id] = {sc, x: bs};
    });
    out.set(s.id, prs);
  });
  return out;
}
const UNITS = {r: 'повт', t: 'с', c: 'мин'};
function prTxt(t, x, prev) {
  if (t !== 'w') return `${x.b} ${UNITS[t]} · +${r1(x.b - prev.b)}`;
  const d = +x.a === +prev.a ? `+${x.b - prev.b} повт` : +x.a > +prev.a ? `+${r1(x.a - prev.a)} кг` : `сильнее на ${Math.round((setScore(t, x) / setScore(t, prev) - 1) * 100)}%`;
  return `${x.a} кг × ${x.b} · ${d}`;
}

export function vol(s, exOf) {
  let v = 0;
  Object.entries(s.entries).forEach(([id, e]) => {const x = exOf(id); if (x.t === 'w') e.forEach(r => v += (+r.a || 0) * (+r.b || 0) * (x.x2 ? 2 : 1));});
  return v;
}
export const totalVol = (sessions, exOf) => sessions.reduce((a, s) => a + vol(s, exOf), 0);

// Подряд идущие недели, где тренировок было не меньше need. Текущая неделя
// засчитывается, если уже выполнена, иначе считаем с прошлой.
export function streak(sessions, now = new Date(), need = 2) {
  const by = {};
  sessions.forEach(s => {const k = weekKey(s.date); by[k] = (by[k] || 0) + 1;});
  const w = weekStart(now);
  if ((by[ymd(w)] || 0) < need) w.setDate(w.getDate() - 7);
  let n = 0;
  while ((by[ymd(w)] || 0) >= need) {n++; w.setDate(w.getDate() - 7);}
  return n;
}

export const floorTo = (x, step) => Math.max(step, r1(Math.floor(x / step + 1e-9) * step));
const roundTo = (x, step) => r1(Math.round(x / step) * step);

function mode(arr) {
  const c = {};
  arr.forEach(v => c[v] = (c[v] || 0) + 1);
  return +Object.keys(c).sort((a, b) => c[b] - c[a] || b - a)[0];
}

const kg = (w, r) => `${w} кг × ${r}`;

// Цель на сегодня по прошлой тренировке (двойная прогрессия).
// Боль: худшее значение среди отслеживаемых суставов, которые нагружает упражнение.
// opts.load — нагрузка упражнения {сустав: 1|2}; opts.pains — последняя боль по суставам {сустав: 0..10}.
// Старый вариант (только колени): opts.knee + opts.kneeLast.
function worstPain(o, L) {
  const load = o.load || (o.knee ? {knee: 1} : {}), pains = o.pains || (o.kneeLast !== undefined || o.knee ? {knee: o.kneeLast ?? null} : {});
  let worst = null, joint = null;
  Object.keys(pains).forEach(j => {
    if (!(load[j] >= 1)) return;
    const v = Math.max(L.pain[j] ?? -1, pains[j] ?? -1);
    if (v >= 0 && (worst === null || v > worst)) {worst = v; joint = j;}
  });
  return {pain: worst, joint};
}
export const JOINT_SHORT = {knee: 'колени', back: 'спина', shoulder: 'плечи', elbow: 'локти', wrist: 'запястья', neck: 'шея', hip: 'таз', ankle: 'голеностоп'};
// opts: {sessions, id, t, sets, reps, step, phase, now, load, pains}
export function aim(o) {
  const L = lastFor(o.sessions, o.id);
  if (!L) return null;
  const days = (+(o.now || new Date()) - new Date(L.date)) / DAY;
  if (o.t !== 'w') return aimPlain(o, L);
  const tr = topRep(o.reps) || 12, lr = lowRep(o.reps) || tr, step = o.step || 2.5;
  // колени: худшее из «в прошлый раз на этом упражнении» и «последний день ног»
  const wp = worstPain(o, L), knee = wp.pain, jl = JOINT_SHORT[wp.joint] || 'колени';
  const pause = days > 14 ? (days > 28 ? 0.8 : 0.9) : 1;
  if (L.phase && o.phase && L.phase !== o.phase) {
    const e1 = e1rm('w', L.e), rir = RIR[o.phase] ?? 2;
    let w = floorTo(e1 / (1 + (lr + rir) / 30), step), why = 'новый этап — вес по расчёту', down = false;
    if (pause < 1) {w = floorTo(w * pause, step); why = 'новый этап, после перерыва — легче';}
    if (knee >= 6) {w = floorTo(w - step, step); why = `${jl} ${knee}/10 — легче`; down = true;}
    const r = Math.max(lr, Math.min(tr, Math.round(30 * (e1 / w - 1)) - rir));
    return {w, r: pause < 1 || down ? lr : r, up: false, down, txt: kg(w, pause < 1 || down ? lr : r), why};
  }
  const P = L.e.slice(0, o.sets), w = mode(P.map(x => +x.a)), atW = P.filter(x => +x.a === w), mr = Math.min(...atW.map(x => +x.b));
  if (pause < 1) {
    const nw = floorTo(w * pause, step);
    return {w: nw, r: lr, up: false, txt: kg(nw, lr), why: 'после перерыва — начни легче'};
  }
  if (knee >= 6) {const nw = floorTo(w - step, step); return {w: nw, r: lr, up: false, down: true, txt: kg(nw, lr), why: `${jl} ${knee}/10 — легче`};}
  const up = atW.length >= o.sets && atW.every(x => +x.b >= tr);
  if (up && knee >= 4) return {w, r: tr, up: false, txt: kg(w, tr), why: `${jl} ${knee}/10 — вес не повышаем`};
  if (up) {const nw = r1(w + step); return {w: nw, r: lr, up: true, txt: kg(nw, lr)};}
  if (mr < lr - 1) {const nw = floorTo(w - step, step); return {w: nw, r: lr, up: false, down: true, txt: kg(nw, lr), why: 'не добрал повторы — чуть легче'};}
  const r = Math.max(lr, Math.min(mr + 1, tr));
  return {w, r, up: false, txt: kg(w, r)};
}

const REP_CAP = 5;
function aimPlain(o, L) {
  const b = Math.max(...L.e.map(x => +x.b || 0)), tr = topRep(o.reps);
  if (o.t === 'r') {
    const cap = tr ? tr + REP_CAP : Infinity, r = Math.min(b + 1, cap);
    return {w: null, r, up: false, txt: b >= cap ? `${cap} повт · усложни или добавь вес` : `${r} повт`, cap};
  }
  if (o.t === 't') return {w: null, r: b + 5, up: false, txt: `${b + 5} с`};
  return {w: null, r: b, up: false, txt: `${b} мин`};
}

export function defaults(o) {
  const A = aim(o), n = o.t === 'c' ? 1 : o.sets, out = [];
  const L = A && o.t === 'r' ? lastFor(o.sessions, o.id) : null;
  for (let k = 0; k < n; k++) {
    if (o.t === 'w') out.push({a: A ? A.w : '', b: A ? A.r : (lowRep(o.reps) || ''), done: false});
    else if (L) out.push({a: '', b: Math.min((+(L.e[k] || L.e[L.e.length - 1]).b || 0) + 1, A.cap), done: false});
    else out.push({a: '', b: A ? A.r : (topRep(o.reps) || ''), done: false});
  }
  return out;
}

// Разминка перед рабочим весом: полная (50%×10, 75%×5) для первого базового
// упражнения тренировки, один подход (60%×8) для следующей новой группы мышц.
// min — вес пустого грифа: разминка не бывает легче него.
export function warmups(w, step, full, min = 0) {
  w = +w;
  if (!(w >= 10)) return [];
  const sets = full && w >= 20 ? [[.5, 10], [.75, 5]] : full ? [[.5, 10]] : [[.6, 8]];
  const out = [];
  sets.forEach(([p, b]) => {const a = Math.max(min, roundTo(w * p, step)); if (a > 0 && a < w && !out.some(x => x.a === a)) out.push({a, b});});
  return out;
}
const BIG = new Set(['quads', 'hams', 'glutes', 'chest', 'backv', 'backh', 'press']);
export function warmPlan(items, exOf) {
  const seen = new Set(), plan = {};
  items.forEach(({id}) => {
    const e = exOf(id);
    if (e.t !== 'w' || !BIG.has(e.g) || seen.has(e.g)) return;
    plan[id] = seen.size ? 'one' : 'full';
    seen.add(e.g);
  });
  return plan;
}

// Замены — та же группа мышц; нагружающие колени — в конце списка.
const kneeLoad = e => e.risky ? 2 : e.knee ? 1 : 0;
export function alternatives(id, exAll, exclude = []) {
  const src = exAll[id];
  if (!src || !src.g) return [];
  return Object.keys(exAll)
    .filter(k => k !== id && !exclude.includes(k) && exAll[k].g === src.g && !exAll[k].retired)
    .sort((a, b) => kneeLoad(exAll[a]) - kneeLoad(exAll[b]));
}

// Похоже на опечатку? Возвращает вопрос для подтверждения или null.
export function sanity(t, x, lastW) {
  if (t === 'w' && lastW > 0 && (+x.a > lastW * 1.5 || +x.a < lastW * 0.5)) return `Точно ${x.a} кг? В прошлый раз было ${lastW} кг`;
  if (+x.b > 50) return `Точно ${x.b}? Это много`;
  return null;
}

// Колени в последний день ног (где указано), или null.
// Нагрузка упражнения на суставы (старые данные — только колени).
export const exLoad = e => e.load || (e.risky ? {knee: 2} : e.knee ? {knee: 1} : {});
// Суставы, которые упражнение нагружает сильно (≥ 2).
export const heavyJoints = e => Object.entries(exLoad(e)).filter(([, v]) => v >= 2).map(([j]) => j);
// «нагрузка: колени, спина» или '' — подпись в выборе и замене упражнения.
export const loadTxt = e => {const hi = heavyJoints(e).map(j => JOINT_SHORT[j]).filter(Boolean); return hi.length ? 'нагрузка: ' + hi.join(', ') : '';};
// Нагружает ли упражнение хоть один из отмеченных суставов (≥ 1).
export const loadsAny = (e, joints) => joints.some(j => (exLoad(e)[j] || 0) >= 1);
// Порядок замен: что уже делали → без нагрузки на отмеченные суставы → остальные (внутри — исходный порядок).
export function rankAlts(ids, exOf, didBefore, joints) {
  const key = id => (didBefore(id) ? 0 : 2) + (loadsAny(exOf(id), joints) ? 1 : 0);
  return ids.map((id, i) => [id, key(id), i]).sort((a, b) => a[1] - b[1] || a[2] - b[2]).map(x => x[0]);
}
// Боль в тренировке по суставам (старые записи — только колени).
export const painOf = s => s.pain || (s.knee != null ? {knee: s.knee} : {});
const loads = (s, exOf, j) => Object.keys(s.entries).some(id => (exLoad(exOf(id))[j] || 0) >= 1);
// Последняя отмеченная боль в суставе среди тренировок, где он был нагружен.
export function painLast(sessions, exOf, j) {
  const l = [...sessions].sort(byDate).filter(s => painOf(s)[j] != null && loads(s, exOf, j)).at(-1);
  return l ? painOf(l)[j] : null;
}
export function painAvg(sessions, exOf, j, n = 3) {
  const xs = [...sessions].sort(byDate).filter(s => painOf(s)[j] != null && loads(s, exOf, j)).slice(-n);
  return xs.length ? r1(xs.reduce((a, s) => a + painOf(s)[j], 0) / xs.length) : null;
}
export const kneeLast = (sessions, exOf) => painLast(sessions, exOf, 'knee');

// Средняя боль в коленях за последние n тренировок ног (где указана).
export const kneeAvg = (sessions, exOf, n = 3) => painAvg(sessions, exOf, 'knee', n);

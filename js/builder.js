// Помощник «Собрать программу»: цель, дни, опыт, боли и упор → программа из 3 этапов
// на оборудовании зала. Без DOM, детерминированно (одинаковые ответы — одинаковая программа).
import {exLoad} from './logic.js';
import {EQUIP} from './data/equipment.js';

export const GOALS = {glutes: 'Ягодицы и ноги', fatloss: 'Похудение и тонус', strength: 'Сила', general: 'Общая форма'};
export const FOCUS = {glutes: 'Ягодицы', legs: 'Ноги', back: 'Спина', chest: 'Грудь', arms: 'Руки', shoulders: 'Плечи', core: 'Пресс', posture: 'Осанка'};

// Каркасы дней: группы мышц по порядку (сначала базовые).
const FULL_A = ['quads', 'backv', 'chest', 'hams', 'backh', 'side'];
const FULL_B = ['glutes', 'backh', 'press', 'hams', 'backv', 'rear'];
const FULL_C = ['quads', 'chest', 'backv', 'glutes', 'side', 'biceps'];
const UPPER = ['chest', 'backv', 'press', 'backh', 'biceps', 'triceps'];
const UPPER2 = ['backh', 'chest', 'side', 'backv', 'rear', 'triceps'];
const LOWER = ['quads', 'hams', 'glutes', 'gmed', 'calves'];
const LOWER2 = ['glutes', 'hams', 'quads', 'gmed', 'glutes'];
const GLUTEDAY = ['glutes', 'hams', 'glutes', 'gmed', 'glutes'];
function template(goal, days) {
  if (days <= 2) return [['Всё тело А', FULL_A], ['Всё тело Б', FULL_B]];
  if (days === 3) return goal === 'glutes' ? [['Низ А', LOWER2], ['Верх', UPPER], ['Низ Б', GLUTEDAY]] : [['А', FULL_A], ['Б', FULL_B], ['В', FULL_C]];
  if (days === 4) return [['Верх 1', UPPER], ['Низ 1', goal === 'glutes' ? LOWER2 : LOWER], ['Верх 2', UPPER2], ['Низ 2', goal === 'glutes' ? GLUTEDAY : LOWER2]];
  return [['Низ 1', LOWER], ['Верх 1', UPPER], ['Ягодицы', GLUTEDAY], ['Верх 2', UPPER2], ['Низ 2', LOWER2]];
}
const LOWER_G = new Set(['quads', 'hams', 'glutes', 'gmed', 'calves']);
const isLower = slots => slots.filter(g => LOWER_G.has(g)).length >= 3;
// Упор добавляет по одной позиции в подходящие дни.
function withFocus(slots, focus) {
  const nLow = slots.filter(g => LOWER_G.has(g)).length, lower = nLow >= 3, upper = nLow === 0, full = !lower && !upper;
  const add = [];
  if (focus.includes('glutes') && (lower || full)) add.push('glutes', 'gmed');
  if (focus.includes('legs') && (lower || full)) add.push('quads', 'hams');
  if (focus.includes('back') && !lower) add.push('backh');
  if (focus.includes('chest') && !lower) add.push('chest');
  if (focus.includes('arms') && !lower) add.push('biceps', 'triceps');
  if (focus.includes('shoulders') && !lower) add.push('side');
  if (focus.includes('posture')) add.push(lower ? 'glutes' : 'rear');
  return [...slots, ...add];
}

const BIG = new Set(['quads', 'hams', 'glutes', 'chest', 'backv', 'backh', 'press']);
const MAX_MAIN = 7;
function reps(goal, ph, mech, e) {
  if (e.t === 't') return ph === 'p1' ? '30' : ph === 'p2' ? '40' : '45';
  if (e.t === 'c') return '10';
  if (mech === 'compound' && goal === 'strength') return {p1: '10–12', p2: '8–10', p3: '6–8'}[ph];
  if (mech === 'compound') return {p1: '12–15', p2: '10–12', p3: '8–10'}[ph];
  return {p1: '12–15', p2: '12–15', p3: '10–12'}[ph];
}
const sets = (ph, mech) => ph === 'p1' ? 2 : ph === 'p2' ? 3 : mech === 'compound' ? 4 : 3;

// Выбор упражнения в позицию: безопасно для больных суставов, по уровню, без повторов, с разнообразием.
function pickFor(lib, g, {pain, level, used, dayUsed, dayEquip, role, preferMech, big}) {
  const cands = Object.entries(lib).filter(([id, e]) => (role ? e.cr === role : e.g === g) && !e.retired && Object.prototype.hasOwnProperty.call(EQUIP, e.img) && !dayUsed.has(id));
  const score = ([id, e]) => {
    const ld = exLoad(e);
    if (pain.some(j => (ld[j] || 0) >= 2)) return Infinity;
    if ((e.lv || 1) > level) return Infinity;
    let sc = pain.reduce((a, j) => a + (ld[j] || 0) * 6, 0);
    sc += (used.get(id) || 0) * 4;
    if (dayEquip.has(e.img)) sc += 2;
    if (preferMech && e.mech && e.mech !== preferMech) sc += 3;
    if (big && e.t !== 'w') sc += 5;
    if (e.risky) sc += 5;
    return sc;
  };
  let best = null, bs = Infinity;
  cands.forEach(c => {const sc = score(c); if (sc < bs) {bs = sc; best = c[0];}});
  return best;
}

const HINT = {
  p1: (d, rir) => `${d} ${d < 5 ? 'раза' : 'раз'} в неделю. В запасе ${rir} повтора. Отдых 1–1,5 мин. В конце — пресс кругом.`,
  p2: d => `${d} ${d < 5 ? 'раза' : 'раз'} в неделю. В запасе 1–2 повтора. Отдых 1,5–2 мин в базовых. В конце — пресс кругом.`,
  p3: d => `${d} ${d < 5 ? 'раза' : 'раз'} в неделю. Базовые тяжелее, изолирующие в 10–12. Отдых 2 мин в базе. В конце — пресс кругом.`,
};

// opts: {goal, days, level (1 новичок | 2 с опытом), pain: [суставы], focus: [упор]}; lib — все упражнения.
export function buildProgram(opts, lib) {
  const goal = GOALS[opts.goal] ? opts.goal : 'general', days = Math.min(5, Math.max(2, +opts.days || 3));
  const level = opts.level === 2 ? 2 : 1, pain = opts.pain || [], focus = opts.focus || [];
  const used = new Map(), plan = template(goal, days).map(([name, slots]) => [name, withFocus(slots, focus)]);
  const chosen = plan.map(([name, slots]) => {
    const dayUsed = new Set(), dayEquip = new Set(), list = [];
    const take = (g, extra = {}) => {
      const id = pickFor(lib, g, {pain, level, used, dayUsed, dayEquip, ...extra});
      if (!id) return null;
      dayUsed.add(id); dayEquip.add(lib[id].img); used.set(id, (used.get(id) || 0) + 1);
      return id;
    };
    if (goal === 'fatloss' || isLower(slots) || slots === FULL_A) {const c = take('cardio'); if (c) list.push({id: c, cardio: true});}
    slots.slice(0, MAX_MAIN).forEach((g, i) => {const id = take(g, {preferMech: BIG.has(g) && i < 4 ? 'compound' : 'isolation', big: BIG.has(g) && i < 4}); if (id) list.push({id});});
    const core = ['stab', 'flex', 'side'].map(role => take('core', {role})).filter(Boolean);
    return [name, list, core];
  });
  const out = {};
  ['p1', 'p2', 'p3'].forEach((ph, pi) => {
    const w = {};
    chosen.forEach(([name, list, core]) => {
      w[name] = [
        ...list.map(({id, cardio}) => {
          const e = lib[id], mech = e.mech || (BIG.has(e.g) ? 'compound' : 'isolation');
          return cardio ? {id, s: 1, r: goal === 'fatloss' ? ['10', '12', '15'][pi] : '8', n: ''} : {id, s: sets(ph, mech), r: reps(goal, ph, mech, e), n: ''};
        }),
        ...core.map((id, i) => ({id, s: ph === 'p1' ? 2 : 3, r: reps(goal, ph, 'isolation', lib[id]), n: '', blk: 'core', ...(i < core.length - 1 ? {ss: 1} : {})})),
      ];
    });
    out[ph] = {label: ['Втягивание', 'Основа', 'Прогресс'][pi], sub: ['нед. 1–3', 'нед. 4–10', 'нед. 11+'][pi], hint: HINT[ph](days, level === 1 ? 3 : 2), w};
  });
  return out;
}

// Программа и упражнения: доступ с учётом своих правок, редактор (без мутаций), замены.
import {EX} from './data/exercises.js';
import {W} from './data/program.js';
import {EQUIP} from './data/equipment.js';

export const PHASES = ['p1', 'p2', 'p3'];
// Роли трёх мест в круге пресса — одинаковые в каждой тренировке.
export const ROLE = {stab: 'Стабилизация', flex: 'Скручивание', side: 'Анти-вращение и бок'};
export const TYPES = {w: 'Вес и повторы', r: 'Только повторы', t: 'Секунды', c: 'Минуты'};
export const GROUPS = {
  quads: 'Передняя поверхность бедра', hams: 'Задняя поверхность бедра', glutes: 'Ягодицы', gmed: 'Боковая ягодичная',
  calves: 'Икры', backv: 'Спина — тяга сверху', backh: 'Спина — тяга к поясу', chest: 'Грудь', press: 'Плечи — жим',
  side: 'Плечи — средняя дельта', rear: 'Задняя дельта', biceps: 'Бицепс', triceps: 'Трицепс', core: 'Пресс и кор', cardio: 'Кардио',
};

export const allEx = db => ({...EX, ...(db.custom || {})});
export const exOf = (db, id) => EX[id] || (db.custom || {})[id] || {n: id + ' (удалено)', g: null, img: null, t: 'w', setup: '', how: [], bad: [], gone: 1};
export const planOf = db => db.plan || W;
export const phaseOf = (db, p) => planOf(db)[p] || W[p] || {label: p, sub: '', hint: '', w: {}};
export const woKeys = (db, p) => Object.keys(phaseOf(db, p).w);

export const toItem = x => Array.isArray(x) ? {id: x[0], s: x[1], r: String(x[2]), n: x[3] || '', ...(x[4] || {})} : {...x};
export function itemsOf(db, phase, wo, swap = {}) {
  return (phaseOf(db, phase).w[wo] || []).map(toItem).map(it => swap[it.id] ? {...it, id: swap[it.id], orig: it.id} : it);
}

const STEP_DEFAULT = 2.5;
export const stepOf = (db, id) => (db.exs || {})[id]?.step || EQUIP[exOf(db, id).img]?.step || STEP_DEFAULT;
export const noteOf = (db, id) => (db.exs || {})[id]?.note || '';

// ---- редактор: каждая операция возвращает новый db ----
function editWo(db, ph, wo, fn) {
  const plan = structuredClone(planOf(db));
  if (!plan[ph] || !plan[ph].w[wo]) throw new Error('Нет такой тренировки');
  plan[ph] = {...plan[ph], w: {...plan[ph].w, [wo]: fn(plan[ph].w[wo].map(toItem))}};
  return {...db, plan};
}
export const setItem = (db, ph, wo, i, patch) => editWo(db, ph, wo, arr => arr.map((x, k) => k === i ? {...x, ...patch} : x));
export const removeItem = (db, ph, wo, i) => editWo(db, ph, wo, arr => arr.filter((_, k) => k !== i));
export function moveItem(db, ph, wo, i, dir) {
  return editWo(db, ph, wo, arr => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const out = [...arr];
    [out[i], out[j]] = [out[j], out[i]];
    return out;
  });
}
export function addItem(db, ph, wo, id) {
  const e = allEx(db)[id];
  if (!e) throw new Error('Упражнение не найдено');
  return editWo(db, ph, wo, arr => {
    if (arr.some(x => x.id === id)) throw new Error('Это упражнение уже есть в тренировке');
    return [...arr, e.t === 'c' ? {id, s: 1, r: '10', n: ''} : {id, s: 3, r: e.t === 't' ? '30' : '10–12', n: ''}];
  });
}
export const replaceItem = (db, ph, wo, from, to) => editWo(db, ph, wo, arr => arr.map(x => x.id === from ? {...x, id: to} : x));
export const resetPlan = db => ({...db, plan: null});

export const isGymEquip = eq => Object.prototype.hasOwnProperty.call(EQUIP, eq);

// Своё упражнение — только на оборудовании из зала.
export function addCustom(db, {n, img, t, g}) {
  const name = String(n || '').trim();
  if (!name || name.length > 40) throw new Error('Укажи название до 40 символов');
  if (!isGymEquip(img)) throw new Error('Выбери тренажёр из своего зала');
  if (!TYPES[t]) throw new Error('Выбери тип упражнения');
  if (!GROUPS[g]) throw new Error('Выбери группу мышц');
  const id = 'u_' + Date.now().toString(36);
  const e = {n: name, g, img, t, setup: '', how: [], bad: [], own: 1};
  return {db: {...db, custom: {...(db.custom || {}), [id]: e}}, id};
}

// Список для выбора упражнения: по тренажёрам, в порядке EQUIP.
export function pickerGroups(db) {
  const all = allEx(db);
  return Object.keys(EQUIP)
    .map(eq => ({eq, items: Object.keys(all).filter(id => all[id].img === eq && !all[id].retired)}))
    .filter(x => x.items.length);
}

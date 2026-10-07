// Сводка по истории для экранов и достижений. Без DOM.
import {DAY, r1} from './format.js';
import {prMap, vol, totalVol, streak, target, kneeAvg} from './logic.js';
import {exOf as exOfDb} from './program.js';
import {EQUIP, hasPhoto} from './data/equipment.js';

export function stats(db, now = new Date()) {
  const exOf = id => exOfDb(db, id), S = db.sessions, prs = prMap(S, exOf);
  const allPRs = S.flatMap(s => (prs.get(s.id) || []).map(p => ({...p, date: s.date})));
  const kgLost = db.bw.length ? r1(db.bw[0].kg - db.bw[db.bw.length - 1].kg) : 0;
  const waistLost = db.waist.length > 1 ? r1(db.waist[0].v - db.waist[db.waist.length - 1].v) : 0;
  return {
    exOf, S, prs, allPRs, kgLost, waistLost,
    vol: s => vol(s, exOf),
    total: totalVol(S, exOf),
    streak: streak(S, now, target(db.phase) - 1),
    last30: S.filter(s => +now - new Date(s.date) < 30 * DAY).length,
    knee: kneeAvg(S, exOf, 3),
    now,
  };
}

const legDays = st => st.S.filter(s => s.knee != null && Object.keys(s.entries).some(id => st.exOf(id).knee));
const usedEquip = st => new Set(st.S.flatMap(s => Object.keys(s.entries).map(id => st.exOf(id).img)));

export const ACH = [
  ['first', '1', 'Первая тренировка', st => st.S.length >= 1], ['w5', '5', '5 тренировок', st => st.S.length >= 5],
  ['w10', '10', '10 тренировок', st => st.S.length >= 10], ['w25', '25', '25 тренировок', st => st.S.length >= 25],
  ['w50', '50', '50 тренировок', st => st.S.length >= 50], ['pr1', 'PR', 'Первый рекорд', st => st.allPRs.length >= 1],
  ['pr10', '10', '10 рекордов', st => st.allPRs.length >= 10], ['pr30', '30', '30 рекордов', st => st.allPRs.length >= 30],
  ['t3', '3т', '3 т за раз', st => st.S.some(s => st.vol(s) >= 3000)], ['t6', '6т', '6 т за раз', st => st.S.some(s => st.vol(s) >= 6000)],
  ['tot50', '50т', '50 т всего', st => st.total >= 50000], ['tot200', '200', '200 т всего', st => st.total >= 200000],
  ['s4', '4н', '4 недели подряд', st => st.streak >= 4], ['s8', '8н', '8 недель подряд', st => st.streak >= 8],
  ['p2', 'II', 'Этап 2', st => st.S.some(s => s.phase === 'p2')], ['p3', 'III', 'Этап 3', st => st.S.some(s => s.phase === 'p3')],
  ['kg3', '−3', '−3 кг', st => st.kgLost >= 3], ['kg6', '−6', '−6 кг', st => st.kgLost >= 6],
  ['kg10', '−10', '−10 кг', st => st.kgLost >= 10], ['wa5', '−5', '−5 см талии', st => st.waistLost >= 5],
  ['knee', '0', '5 тренировок ног без боли', st => {const l = legDays(st).slice(-5); return l.length >= 5 && l.every(s => s.knee <= 2);}],
  ['h1', '60′', 'Час в зале', st => st.S.some(s => (s.dur || 0) >= 60)],
  ['m12', '12', '12 тренировок за месяц', st => st.last30 >= 12],
  ['all', '★', 'Все тренажёры зала', st => {const u = usedEquip(st); return Object.keys(EQUIP).filter(eq => hasPhoto(eq) && !EQUIP[eq].extra).every(eq => u.has(eq));}],
];

// Возвращает новый объект достижений и названия только что полученных.
export function checkAch(ach, st) {
  const out = {...ach}, fresh = [];
  ACH.forEach(([id, , t, f]) => {if (!out[id] && f(st)) {out[id] = st.now.toISOString(); fresh.push(t);}});
  return {ach: out, fresh};
}

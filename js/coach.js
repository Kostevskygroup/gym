// «Тренер»: рекомендации по истории тренировок, коленям и весу тела. Без DOM.
// Каждая рекомендация: {kind, key, level: warn|info|good, title, text, ex?, action?}.
import {DAY, r1, plural} from './format.js';
import {e1rm, painAvg, exLoad, streak, target, weekKey, alternatives} from './logic.js';
import * as P from './program.js';

const HIDE_DAYS = 14, MAX_SHOWN = 4;
const byDate = (a, b) => new Date(a.date) - new Date(b.date);
const kneeLoad = e => e.risky ? 2 : e.knee ? 1 : 0;
const name = (db, id) => `«${P.exOf(db, id).n}»`;

function phaseItems(db, ph) {
  return P.woKeys(db, ph).flatMap(wo => P.itemsOf(db, ph, wo).map(it => ({...it, wo})));
}
// Лучшая замена: та же группа, не тяжелее для колен, нет в этом этапе.
function bestAlt(db, id, ph, needLowerKnee) {
  const used = new Set(phaseItems(db, ph).map(x => x.id)), all = P.allEx(db), src = all[id];
  return alternatives(id, all, [...used]).find(a => needLowerKnee ? kneeLoad(all[a]) < kneeLoad(src) : kneeLoad(all[a]) <= kneeLoad(src)) || null;
}

function plateaus(db, now) {
  const out = [], seen = new Set();
  phaseItems(db, db.phase).forEach(({id}) => {
    if (seen.has(id) || P.exOf(db, id).t !== 'w') return;
    seen.add(id);
    const hist = db.sessions.filter(s => s.entries[id] && +now - new Date(s.date) < 56 * DAY).sort(byDate).slice(-4);
    if (hist.length < 4) return;
    const span = (new Date(hist[3].date) - new Date(hist[0].date)) / DAY, ago = (+now - new Date(hist[3].date)) / DAY;
    if (span < 14 || ago > 21) return;
    const v = hist.map(s => e1rm('w', s.entries[id]));
    if (Math.max(v[2], v[3]) > Math.max(v[0], v[1]) * 1.005) return;
    const to = bestAlt(db, id, db.phase, false), weeks = Math.round(span / 7);
    out.push({kind: 'plateau', key: 'plateau:' + id, level: 'info', ex: id, title: 'Застой — пора сменить стимул',
      text: `${name(db, id)} не растёт ${hist.length} тренировки (${weeks} нед.). ${to ? `Смени на ${name(db, to)} на 4–6 недель — новое движение снова даст рост.` : 'Сделай одну тренировку на 10% легче, потом снова прибавляй.'}`,
      action: to ? {type: 'swap', phase: db.phase, from: id, to, label: 'Заменить в программе'} : null});
  });
  return out;
}

const JOINT_TITLE = {knee: 'Колени', back: 'Спина', shoulder: 'Плечи', elbow: 'Локти', wrist: 'Запястья', neck: 'Шея', hip: 'Таз', ankle: 'Голеностоп'};
const trackedOf = db => db.settings && Array.isArray(db.settings.pain) ? db.settings.pain : (!db.settings || db.settings.knee !== false ? ['knee'] : []);
const loadOf = (db, id, j) => (exLoad(P.exOf(db, id))[j] || 0);
// Лучшая замена с меньшей нагрузкой на больной сустав.
function gentlerAlt(db, id, j) {
  const used = new Set(phaseItems(db, db.phase).map(x => x.id)), all = P.allEx(db);
  return alternatives(id, all, [...used]).find(a => (exLoad(all[a])[j] || 0) < loadOf(db, id, j)) || null;
}
function pains(db) {
  const exOf = id => P.exOf(db, id), out = [];
  trackedOf(db).forEach(j => {
    const avg = painAvg(db.sessions, exOf, j, 3);
    if (avg === null || avg < 4) return;
    const title = `${JOINT_TITLE[j]}: в среднем ${avg}/10`, kind = j === 'knee' ? 'knee' : 'pain';
    const loaded = phaseItems(db, db.phase).filter(x => loadOf(db, x.id, j) >= 1);
    const heavy = loaded.find(x => loadOf(db, x.id, j) >= 2), swap = loaded.map(x => ({from: x.id, to: gentlerAlt(db, x.id, j)})).find(x => x.to);
    const base = {kind, level: 'warn', title};
    if (heavy) out.push({...base, key: `pain:${j}:rm:${heavy.id}`, text: `${JOINT_TITLE[j]} болят последние тренировки. Убери ${name(db, heavy.id)} — для этого сустава это самое тяжёлое упражнение. Веса в упражнениях на этот сустав приложение уже не повышает.`, action: {type: 'remove', phase: db.phase, wo: heavy.wo, id: heavy.id, label: 'Убрать из программы'}});
    else if (swap) out.push({...base, key: `pain:${j}:${swap.from}`, text: `${JOINT_TITLE[j]} болят последние тренировки. Замени ${name(db, swap.from)} на ${name(db, swap.to)} — меньше нагрузка. Веса на этот сустав приложение уже не повышает.`, action: {type: 'swap', phase: db.phase, from: swap.from, to: swap.to, label: 'Заменить в программе'}});
    else out.push({...base, key: `pain:${j}:avg`, text: `${JOINT_TITLE[j]} болят последние тренировки. Веса на этот сустав приложение не повышает — работай легче и в комфортной амплитуде. Если боль держится — покажись врачу.`});
  });
  return out;
}

function skipped(db) {
  const out = [];
  P.woKeys(db, db.phase).forEach(wo => {
    const last = db.sessions.filter(s => s.phase === db.phase && s.wo === wo).sort(byDate).slice(-2);
    if (last.length < 2) return;
    P.itemsOf(db, db.phase, wo).forEach((it, i) => {
      const miss = last.every(s => !s.entries[it.id] && !(s.swaps && s.swaps[it.id]));
      if (!miss || P.exOf(db, it.id).g === 'cardio') return;
      const to = bestAlt(db, it.id, db.phase, false);
      out.push({kind: 'skipped', key: `skipped:${wo}:${it.id}`, level: 'info', ex: it.id, title: 'Упражнение выпадает',
        text: `${name(db, it.id)} не делалось 2 последние тренировки «${wo}». ${to ? `Может, удобнее ${name(db, to)}?` : 'Если не подходит — убери его.'}`,
        action: to ? {type: 'swap', phase: db.phase, from: it.id, to, label: 'Заменить'} : {type: 'remove', phase: db.phase, wo, id: it.id, label: 'Убрать из программы'}});
    });
  });
  return out.slice(0, 2);
}

function repeatedSwaps(db) {
  const out = [];
  P.woKeys(db, db.phase).forEach(wo => {
    const last = db.sessions.filter(s => s.phase === db.phase && s.wo === wo).sort(byDate).slice(-2);
    if (last.length < 2) return;
    Object.entries(last[1].swaps || {}).forEach(([from, to]) => {
      if (last[0].swaps && last[0].swaps[from] === to && P.itemsOf(db, db.phase, wo).some(x => x.id === from))
        out.push({kind: 'swaps', key: `swaps:${from}:${to}`, level: 'info', title: 'Закрепить замену?', text: `Ты уже дважды делаешь ${name(db, to)} вместо ${name(db, from)}. Поставить в программу навсегда?`, action: {type: 'swap', phase: db.phase, from, to, label: 'Закрепить'}});
    });
  });
  return out;
}

function consistency(db, now) {
  const out = [], T = target(db.phase), n = streak(db.sessions, now, T - 1);
  if (n >= 3) out.push({kind: 'streak', key: 'streak:' + n, level: 'good', title: `${n} ${plural(n, 'неделя', 'недели', 'недель')} подряд по плану`, text: 'Регулярность — главное, что даёт результат. Так держать!'});
  const wk = weekKey(now), done = db.sessions.filter(s => weekKey(s.date) === wk).length;
  const left = 7 - ((new Date(now).getDay() + 6) % 7);
  if (db.sessions.length && done < T && T - done > left) out.push({kind: 'week', key: 'week:' + wk, level: 'info', title: `На этой неделе ${done} из ${T}`, text: `До конца недели ${left} ${plural(left, 'день', 'дня', 'дней')}. Сделай сколько успеешь — даже одна тренировка лучше пропуска.`});
  return out;
}

function body(db, now) {
  const out = [], bw = [...db.bw].sort(byDate), last = bw.at(-1);
  if ((last && db.sessions.length && +now - new Date(last.date) > 10 * DAY) || (!last && db.sessions.length >= 2))
    out.push({kind: 'weighin', key: 'weighin:' + weekKey(now), level: 'info', title: last ? 'Пора взвеситься' : 'Запиши вес и талию', text: 'Раз в неделю утром натощак — иначе не видно, как меняется тело.', action: {type: 'go', view: 'body', label: 'Записать'}});
  const recent = bw.filter(x => +now - new Date(x.date) <= 28 * DAY);
  if (recent.length >= 3) {
    const weeks = (new Date(recent.at(-1).date) - new Date(recent[0].date)) / DAY / 7, d = recent.at(-1).kg - recent[0].kg;
    if (weeks >= 2.5 && db.goal && recent.at(-1).kg > db.goal && d >= -0.2)
      out.push({kind: 'weight', key: 'weight:' + weekKey(now), level: 'info', title: 'Вес стоит', text: `${Math.round(weeks)} нед. без снижения. Посмотри на талию: если она уходит — всё идёт хорошо. Если нет — убери ~200 ккал в день.`});
    if (weeks >= 1.5 && d / recent[0].kg / weeks < -0.01)
      out.push({kind: 'weight', key: 'fast:' + weekKey(now), level: 'warn', title: 'Вес уходит слишком быстро', text: `−${r1(-d)} кг за ${Math.round(weeks)} нед. Больше 1% в неделю — теряешь мышцы. Добавь белка и немного еды.`});
  }
  return out;
}

const LEVEL = {warn: 0, info: 1, good: 2};
export function insights(db, now = new Date()) {
  const hidden = db.dismissed || {};
  const fresh = x => !hidden[x.key] || +now - new Date(hidden[x.key]) > HIDE_DAYS * DAY;
  return [...pains(db), ...plateaus(db, now), ...repeatedSwaps(db), ...skipped(db), ...consistency(db, now), ...body(db, now)]
    .filter(fresh).sort((a, b) => LEVEL[a.level] - LEVEL[b.level]).slice(0, MAX_SHOWN);
}

export const dismiss = (db, key, now = new Date()) => ({...db, dismissed: {...(db.dismissed || {}), [key]: now.toISOString()}});

// Применить рекомендацию к программе (новый db). Дублей в тренировке не создаёт.
export function applyAction(db, a) {
  if (a.type === 'remove') {
    const i = P.itemsOf(db, a.phase, a.wo).findIndex(x => x.id === a.id);
    return i < 0 ? db : P.removeItem(db, a.phase, a.wo, i);
  }
  if (a.type !== 'swap') return db;
  return P.woKeys(db, a.phase).reduce((d, wo) => {
    const items = P.itemsOf(d, a.phase, wo), i = items.findIndex(x => x.id === a.from);
    if (i < 0) return d;
    return items.some(x => x.id === a.to) ? P.removeItem(d, a.phase, wo, i) : P.replaceItem(d, a.phase, wo, a.from, a.to);
  }, db);
}

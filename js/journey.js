// Путь по программе и «было → стало». Без DOM — проверяется тестами (tests/journey.test.js).
import {DAY, fmtN} from './format.js';
import {planWeek, weekKey, RANGE, target, bestSet, setScore} from './logic.js';
import {PHASES} from './program.js';

const byDate = (a, b) => new Date(a.date) - new Date(b.date);
const UNIT = {r: 'повт', t: 'с'};

// Карта программы: неделя плана, статус этапов и тренировки по неделям текущего этапа.
// Неделя плана n — n-я календарная неделя, в которой были тренировки (перерывы план не двигают).
export function roadmap(sessions, phase, now = new Date()) {
  const week = planWeek(sessions, now), keys = [...new Set(sessions.map(s => weekKey(s.date)))].sort();
  const perWeek = n => n <= keys.length ? sessions.filter(s => weekKey(s.date) === keys[n - 1]).length : 0;
  const ci = PHASES.indexOf(phase), [a, b] = RANGE[phase] || [1, null];
  const stages = PHASES.map((k, i) => ({key: k, range: RANGE[k], status: i < ci ? 'done' : i === ci ? 'now' : 'next', done: sessions.filter(s => s.phase === k).length}));
  const from = Math.min(a, week), to = Math.max(b || week, week);
  const weeks = Array.from({length: to - from + 1}, (_, i) => from + i).map(n => ({n, count: perWeek(n), target: target(phase), cur: n === week, future: n > week}));
  return {week, stages, weeks, left: b ? Math.max(0, b - week + 1) : null, next: PHASES[ci + 1] || null};
}

// kind: 'set' — подход целиком (после тренировки), 'trend' — коротко, что изменилось (за месяц).
const delta = (id, t, was, now, kind) => {
  const byW = t === 'w' && +now.a !== +was.a;
  const pct = byW ? Math.round((now.a / was.a - 1) * 100) : Math.round((now.b / was.b - 1) * 100);
  return {id, t, was, now, pct, kind};
};

// После тренировки: лучший подход каждого упражнения против прошлого раза с ним. Только то, что выросло.
export function lastDeltas(s, sessions, exOf) {
  return Object.entries(s.entries).flatMap(([id, e]) => {
    const t = exOf(id).t;
    if (t === 'c' || !e.length) return [];
    const prev = sessions.filter(x => x.id !== s.id && new Date(x.date) < new Date(s.date) && x.entries[id] && x.entries[id].length).sort(byDate).at(-1);
    if (!prev) return [];
    const was = bestSet(t, prev.entries[id]), now = bestSet(t, e);
    return setScore(t, now) > setScore(t, was) ? [delta(id, t, was, now, 'set')] : [];
  });
}

// Главный экран: что выросло за месяц — последний лучший подход против того, что было ~4 недели назад
// (или в первый раз, если истории меньше). Давно не делал (> 3 недель) — не показываем. Сначала веса (рост силы), потом секунды и повторы.
const WINDOW = 28 * DAY, STALE = 21 * DAY, MIN_SPAN = 7 * DAY;
export function monthDeltas(sessions, exOf, now = new Date(), top = 3) {
  const ids = [...new Set(sessions.flatMap(s => Object.keys(s.entries)))];
  return ids.flatMap(id => {
    const t = exOf(id).t;
    if (t === 'c') return [];
    const ss = sessions.filter(s => s.entries[id] && s.entries[id].length).sort(byDate), last = ss.at(-1);
    if (ss.length < 2 || now - new Date(last.date) > STALE) return [];
    const old = ss.filter(s => now - new Date(s.date) >= WINDOW).at(-1) || ss[0];
    if (new Date(last.date) - new Date(old.date) < MIN_SPAN) return [];
    const was = bestSet(t, old.entries[id]), cur = bestSet(t, last.entries[id]);
    return setScore(t, cur) > setScore(t, was) && setScore(t, was) > 0 ? [delta(id, t, was, cur, 'trend')] : [];
  }).sort((a, b) => (a.t === 'w' ? 0 : 1) - (b.t === 'w' ? 0 : 1) || b.pct - a.pct).slice(0, top);
}

// «40×12 → 42,5×12», «60 → 75 кг», «50 кг: 8 → 12 повт», «30 → 40 с».
export function deltaTxt(d) {
  const {was: a, now: b} = d;
  if (d.t !== 'w') return `${fmtN(a.b)} → ${fmtN(b.b)} ${UNIT[d.t] || ''}`.trim();
  const sameW = +a.a === +b.a, sameR = +a.b === +b.b;
  if (d.kind === 'set' || (!sameW && !sameR)) return `${fmtN(a.a)}×${a.b} → ${fmtN(b.a)}×${b.b}`;
  return sameW ? `${fmtN(b.a)} кг: ${a.b} → ${b.b} повт` : `${fmtN(a.a)} → ${fmtN(b.a)} кг`;
}

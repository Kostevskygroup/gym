// «Карта программы»: три этапа (Втягивание → Основа → Прогресс), где ты сейчас, тренировки по неделям этапа и что дальше.
import {openSheet, sheetHead} from '../ui.js';
import {state} from '../store.js';
import * as P from '../program.js';
import {roadmap} from '../journey.js';
import {esc, plural} from '../format.js';

const weeksTxt = ([a, b]) => b ? `недели ${a}–${b}` : `с недели ${a}`;
const STATUS = {done: 'пройден', now: 'сейчас', next: 'впереди'};

// Неделя этапа: кружки по числу тренировок в неделю, закрашены сделанные.
const weekCell = w => `<div class="rw${w.cur ? ' cur' : ''}${w.future ? ' fut' : ''}${!w.future && w.count >= w.target ? ' full' : ''}">
  <span class="rd">${Array.from({length: Math.max(w.target, w.count)}, (_, i) => `<i class="${i < w.count ? 'on' : ''}"></i>`).join('')}</span>
  <small>${w.cur ? 'сейчас' : 'нед. ' + w.n}</small></div>`;

function nextTxt(db, r) {
  if (!r.next) return 'Последний этап: продолжай, вес и повторы растут по подсказкам.';
  const label = esc(P.phaseOf(db, r.next).label);
  if (r.left === 0) return `Этот этап пройден — переходи на «${label}» кнопкой на главном экране.`;
  return `Ещё ${r.left} ${plural(r.left, 'неделя', 'недели', 'недель')} на этом этапе, потом — «${label}».`;
}

export function openRoadmap() {
  const db = state.db, r = roadmap(db.sessions, db.phase);
  const stage = s => {
    const ph = P.phaseOf(db, s.key), n = s.key.slice(1);
    return `<li class="rs ${s.status}"><span class="rn">${s.status === 'done' ? '✓' : n}</span><div class="rt">
      <b>Этап ${n} · ${esc(ph.label)}<em>${STATUS[s.status]}</em></b>
      <small>${weeksTxt(s.range)}${s.done ? ` · ${s.done} ${plural(s.done, 'тренировка', 'тренировки', 'тренировок')}` : ''}</small>
      ${ph.hint ? `<p>${esc(ph.hint)}</p>` : ''}
      ${s.status === 'now' ? `<div class="rws">${r.weeks.map(weekCell).join('')}</div>` : ''}</div></li>`;
  };
  openSheet(`${sheetHead('Карта программы', `Неделя ${r.week}`, 'От лёгкого входа к росту силы — по шагам')}<div class="sc">
    <ol class="road">${r.stages.map(stage).join('')}</ol>
    <div class="tb2"><p>${nextTxt(db, r)}</p></div></div>`);
}

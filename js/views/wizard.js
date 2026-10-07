// Анкета: новый человек или пересборка программы. Цель, дни, опыт, что беспокоит, упор, откуда программа.
import {toast, openSheet, closeSheet, sheetHead, showErr, clearErr} from '../ui.js';
import {state, profiles, activeProfile, addProfile, updDB} from '../store.js';
import {GOALS, FOCUS, buildProgram} from '../builder.js';
import {allEx, planOf} from '../program.js';
import {JOINTS} from '../data/exercises.js';
import {W} from '../data/program.js';
import {esc} from '../format.js';

const chipRow = (id, opts, sel, multi) => `<div class="chipsel" id="${id}" data-multi="${multi ? 1 : 0}">${Object.entries(opts).map(([k, v]) => `<button type="button" class="${(multi ? sel.includes(k) : sel === k) ? 'on' : ''}" data-k="${esc(k)}">${esc(v)}</button>`).join('')}</div>`;
const DAYS = {2: '2', 3: '3', 4: '4', 5: '5'}, LEVELS = {1: 'Новичок', 2: 'Уже занимаюсь'};
// «Ничего не беспокоит» — чип по умолчанию в ряду суставов; с любым суставом он снимается.
const NONE = 'none', PAIN_OPTS = {[NONE]: 'Ничего не беспокоит', ...JOINTS};
const NAME_MAX = 24;

// mode: 'first' — первый запуск; 'new' — новый профиль; 'rebuild' — новая программа текущему. after() — перерисовать.
export function openWizard(mode, after) {
  const st = (mode === 'rebuild' && state.db.settings) || {};
  const askName = mode !== 'rebuild', first = mode === 'first';
  const a = {goal: st.goal || 'general', days: String(st.days || 3), level: String(st.level || 1), pain: [...(st.pain || [])], focus: [...(st.focus || [])], src: 'auto'};
  const others = profiles().filter(p => p.id !== activeProfile() || mode === 'new').filter(() => !first);
  const SRC = {auto: 'Собрать под меня', std: 'Стандартная программа', ...Object.fromEntries(others.map(p => ['copy:' + p.id, 'Как у «' + p.name + '»']))};
  const title = mode === 'new' ? 'Новый человек' : first ? 'Расскажи о себе' : 'Программа под меня';
  const cta = mode === 'new' ? 'Создать и открыть' : first ? 'Собрать мою программу' : 'Собрать программу';
  const html = `${sheetHead(title, first ? 'Шаг 1 из 2' : '', 'Ответы можно поменять потом в профиле')}<div class="sc wiz">
    ${askName ? `<div class="tb2 first"><h4>Как тебя зовут</h4><input id="wname" class="inp" maxlength="${NAME_MAX}" autocomplete="given-name" placeholder="Например: Ксюша" value="${esc(st.name || '')}"><p class="ferr" id="wnerr">Как к тебе обращаться?</p></div>` : ''}
    <div class="tb2"><h4>Цель</h4>${chipRow('wgoal', GOALS, a.goal, false)}</div>
    <div class="tb2"><h4>Сколько раз в неделю</h4>${chipRow('wdays', DAYS, a.days, false)}</div>
    <div class="tb2"><h4>Опыт</h4>${chipRow('wlevel', LEVELS, a.level, false)}</div>
    <div class="tb2"><h4>Что беспокоит · можно несколько</h4>${chipRow('wpain', PAIN_OPTS, a.pain.length ? a.pain : [NONE], true)}<p class="hint2">Тяжёлые для этих суставов упражнения не попадут в программу, а после тренировки я спрошу, как они.</p></div>
    <div class="tb2"><h4>На что сделать упор · не обязательно</h4>${chipRow('wfocus', FOCUS, a.focus, true)}</div>
    <div class="tb2"><h4>Программа</h4>${chipRow('wsrc', SRC, a.src, false)}${first ? '<p class="hint2">«Собрать под меня» — по твоим ответам. «Стандартная» — готовая программа зала: Втягивание → Основа → Прогресс.</p>' : ''}</div>
    <p class="hint2">${first ? 'Программу можно поменять в любой момент.' : 'Программа на 3 этапа на тренажёрах твоего зала, в конце каждой тренировки — пресс кругом. Её можно править в «Программе».'}</p>
    <div class="acts"><button class="btn" id="wgo">${cta}</button></div></div>`;
  openSheet(html, sh => {
    sh.querySelectorAll('.chipsel').forEach(box => box.onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      if (box.dataset.multi !== '1') {box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); return;}
      const none = box.querySelector(`[data-k="${NONE}"]`);
      if (!none) {b.classList.toggle('on'); return;}
      if (b === none) {box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); return;}
      b.classList.toggle('on');
      none.classList.remove('on');
      if (!box.querySelector('.on')) none.classList.add('on');
    });
    const nameInp = sh.querySelector('#wname');
    if (nameInp) nameInp.oninput = () => clearErr(sh);
    sh.querySelector('#wgo').onclick = () => {
      const pick = id => [...sh.querySelectorAll(`#${id} .on`)].map(b => b.dataset.k);
      const ans = {goal: pick('wgoal')[0] || 'general', days: +(pick('wdays')[0] || 3), level: +(pick('wlevel')[0] || 1), pain: pick('wpain').filter(k => k !== NONE), focus: pick('wfocus')};
      const src = pick('wsrc')[0] || 'auto';
      const nm = askName ? String(nameInp.value || '').trim().slice(0, NAME_MAX) : null;
      if (askName && !nm) {
        // кнопка внизу, поле вверху: кроме ошибки у поля — уведомление, чтобы было понятно, почему ничего не произошло
        nameInp.classList.add('bad'); showErr(sh, 'Как к тебе обращаться?');
        nameInp.scrollIntoView({block: 'center'}); nameInp.focus();
        toast('Введи имя вверху анкеты');
        return;
      }
      if (mode === 'rebuild' && !confirm('Заменить текущую программу новой? История и рекорды останутся.')) return;
      let plan;
      if (src === 'std') plan = null;
      else if (src.startsWith('copy:')) plan = copiedPlan(src.slice(5));
      else plan = buildProgram(ans, allEx(state.db));
      try {
        if (mode === 'new') addProfile(nm, ans);
        updDB(d => ({...d, plan: plan === undefined ? d.plan : plan, phase: 'p1', wo: Object.keys((plan || W).p1.w)[0], settings: {...d.settings, ...ans, ...(nm ? {name: nm} : {}), knee: ans.pain.includes('knee')}}));
      } catch (e) {toast(e.message); return;}
      closeSheet();
      // сначала следующий экран, потом уведомление — чтобы оно поднялось над его кнопками
      after(mode === 'new');
      if (!first) toast(mode === 'new' ? 'Профиль создан — программа готова' : 'Программа собрана');
    };
  });
}

// Программа другого профиля (его правки поверх стандартной).
function copiedPlan(pid) {
  try {
    const raw = localStorage.getItem(pid === 'main' ? 'gym.db' : `gym.db@${pid}`);
    const db = raw ? JSON.parse(raw) : null;
    return db && db.plan ? structuredClone(db.plan) : null;
  } catch (e) {return null;}
}
export const currentPlanName = () => state.db.plan ? 'своя' : 'стандартная';
export {planOf};

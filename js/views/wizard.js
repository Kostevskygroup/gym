// Анкета: новый человек или пересборка программы. Цель, дни, опыт, что беспокоит, упор, откуда программа.
import {toast, openSheet, closeSheet, sheetHead} from '../ui.js';
import {state, profiles, activeProfile, addProfile, updDB} from '../store.js';
import {GOALS, FOCUS, buildProgram} from '../builder.js';
import {allEx, planOf} from '../program.js';
import {JOINTS} from '../data/exercises.js';
import {W} from '../data/program.js';
import {esc} from '../format.js';

const chipRow = (id, opts, sel, multi) => `<div class="chipsel" id="${id}" data-multi="${multi ? 1 : 0}">${Object.entries(opts).map(([k, v]) => `<button type="button" class="${(multi ? sel.includes(k) : sel === k) ? 'on' : ''}" data-k="${esc(k)}">${esc(v)}</button>`).join('')}</div>`;
const DAYS = {2: '2', 3: '3', 4: '4', 5: '5'}, LEVELS = {1: 'Новичок', 2: 'Уже занимаюсь'};

// mode: 'new' — новый профиль; 'rebuild' — новая программа текущему. after() — перерисовать.
export function openWizard(mode, after) {
  const st = (mode === 'rebuild' && state.db.settings) || {};
  const a = {name: '', goal: st.goal || 'general', days: String(st.days || 3), level: String(st.level || 1), pain: [...(st.pain || [])], focus: [...(st.focus || [])], src: 'auto'};
  const others = profiles().filter(p => p.id !== activeProfile() || mode === 'new');
  const SRC = {auto: 'Собрать под меня', std: 'Стандартная программа', ...Object.fromEntries(others.map(p => ['copy:' + p.id, 'Как у «' + p.name + '»']))};
  const html = `${sheetHead(mode === 'new' ? 'Новый человек' : 'Программа под меня', '', 'Ответы можно поменять потом в профиле')}<div class="sc wiz">
    ${mode === 'new' ? `<div class="form"><label>Имя<input id="wname" maxlength="24" placeholder="Например: Ксюша"></label></div>` : ''}
    <div class="tb2"><h4>Цель</h4>${chipRow('wgoal', GOALS, a.goal, false)}</div>
    <div class="tb2"><h4>Сколько раз в неделю</h4>${chipRow('wdays', DAYS, a.days, false)}</div>
    <div class="tb2"><h4>Опыт</h4>${chipRow('wlevel', LEVELS, a.level, false)}</div>
    <div class="tb2"><h4>Что беспокоит</h4>${chipRow('wpain', JOINTS, a.pain, true)}<p class="hint2">Упражнения с сильной нагрузкой на эти суставы в программу не попадут, а после тренировки приложение спросит про самочувствие.</p></div>
    <div class="tb2"><h4>На что сделать упор</h4>${chipRow('wfocus', FOCUS, a.focus, true)}</div>
    <div class="tb2"><h4>Программа</h4>${chipRow('wsrc', SRC, a.src, false)}</div>
    <button class="btn" style="margin-top:20px" id="wgo">${mode === 'new' ? 'Создать и открыть' : 'Собрать программу'}</button>
    <p class="hint2">Программа на 3 этапа на тренажёрах твоего зала, в конце каждой тренировки — пресс кругом. Её можно править в «Программе».</p></div>`;
  openSheet(html, sh => {
    sh.querySelectorAll('.chipsel').forEach(box => box.onclick = e => {
      const b = e.target.closest('[data-k]'); if (!b) return;
      if (box.dataset.multi === '1') b.classList.toggle('on');
      else {box.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));}
    });
    sh.querySelector('#wgo').onclick = () => {
      const pick = id => [...sh.querySelectorAll(`#${id} .on`)].map(b => b.dataset.k);
      const ans = {goal: pick('wgoal')[0] || 'general', days: +(pick('wdays')[0] || 3), level: +(pick('wlevel')[0] || 1), pain: pick('wpain'), focus: pick('wfocus')};
      const src = pick('wsrc')[0] || 'auto';
      if (mode === 'rebuild' && !confirm('Заменить текущую программу новой? История и рекорды останутся.')) return;
      let plan;
      if (src === 'std') plan = null;
      else if (src.startsWith('copy:')) plan = copiedPlan(src.slice(5));
      else plan = buildProgram(ans, allEx(state.db));
      try {
        if (mode === 'new') addProfile(sh.querySelector('#wname').value, ans);
        updDB(d => ({...d, plan: plan === undefined ? d.plan : plan, phase: 'p1', wo: Object.keys((plan || W).p1.w)[0], settings: {...d.settings, ...ans, knee: ans.pain.includes('knee')}}));
      } catch (e) {toast(e.message); return;}
      closeSheet();
      toast(mode === 'new' ? 'Профиль создан — программа готова' : 'Программа собрана');
      after(mode === 'new');
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

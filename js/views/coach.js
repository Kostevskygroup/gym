// «Тренер советует» на главном экране: рекомендации с кнопкой «применить» и тихим ✕ «скрыть».
import {$$, toast, ICON} from '../ui.js';
import {state, updDB} from '../store.js';
import {insights, applyAction, dismiss} from '../coach.js';
import {esc} from '../format.js';

const LVL_ICON = {warn: 'warn', info: 'bulb', good: 'flame'};
let shown = [];

// Похвалу (good) скрывать нечем — она уйдёт сама, когда изменится серия.
const tipHtml = (x, i) => `<div class="tip ${x.level}">
    <span class="ti">${ICON[LVL_ICON[x.level]] || ICON.info}</span>
    <div class="t"><b>${esc(x.title)}</b><p>${esc(x.text)}</p>
      ${x.action ? `<div class="ta"><button class="btn s2 sm" data-apply="${i}">${esc(x.action.label)}</button></div>` : ''}</div>
    ${x.level === 'good' ? '' : `<button class="tx" data-hide="${i}" aria-label="Скрыть совет на 2 недели">${ICON.x}</button>`}</div>`;

export function coachHtml() {
  shown = insights(state.db);
  if (!shown.length) return '';
  return `<div class="sec"><b>Тренер советует</b></div><div class="coach">${shown.map(tipHtml).join('')}</div>`;
}

// rerender — перерисовать экран после изменения; go — переход на вкладку.
// Применение не переспрашивает: совет уже объяснил, что изменится, а «Отменить» в уведомлении — страховка.
export function bindCoach(rerender, go) {
  $$('[data-apply]').forEach(b => b.onclick = () => {
    const x = shown[+b.dataset.apply];
    if (!x || !x.action) return;
    if (x.action.type === 'go') {go(x.action.view); return;}
    const before = state.db.plan;
    updDB(d => dismiss(applyAction(d, x.action), x.key));
    rerender();
    toast('Программа обновлена', {label: 'Отменить', run: () => {updDB(d => ({...d, plan: before})); rerender();}});
  });
  $$('[data-hide]').forEach(b => b.onclick = () => {
    const x = shown[+b.dataset.hide];
    if (!x) return;
    updDB(d => dismiss(d, x.key));
    rerender();
    toast('Скрыто на 2 недели');
  });
}

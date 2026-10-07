// «Тренер советует» на главном экране: рекомендации с кнопкой «применить» и «скрыть».
import {$$, toast, ICON} from '../ui.js';
import {state, updDB} from '../store.js';
import {insights, applyAction, dismiss} from '../coach.js';
import {esc} from '../format.js';

const LVL_ICON = {warn: 'info', info: 'bulb', good: 'flame'};
let shown = [];

export function coachHtml() {
  shown = insights(state.db);
  if (!shown.length) return '';
  return `<div class="sec"><b>Тренер советует</b></div><div class="coach">${shown.map((x, i) => `<div class="tip ${x.level}">
    <span class="ti">${ICON[LVL_ICON[x.level]] || ICON.info}</span>
    <div class="t"><b>${esc(x.title)}</b><p>${esc(x.text)}</p>
      <div class="ta">${x.action ? `<button class="btn sm" data-apply="${i}">${esc(x.action.label)}</button>` : ''}<button class="lnk" data-hide="${i}">Скрыть</button></div></div></div>`).join('')}</div>`;
}

// rerender — перерисовать экран после изменения; go — переход на вкладку.
export function bindCoach(rerender, go) {
  $$('[data-apply]').forEach(b => b.onclick = () => {
    const x = shown[+b.dataset.apply];
    if (!x || !x.action) return;
    if (x.action.type === 'go') {go(x.action.view); return;}
    if (!confirm(`${x.title}\n\n${x.text}\n\nПрименить к программе?`)) return;
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

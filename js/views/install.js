// «Как установить»: три шага с картинками кнопок iPhone. Показывается, пока приложение открыто не с экрана «Домой».
import {openSheet, closeSheet, sheetHead} from '../ui.js';
import {isIOS, isStandalone} from '../platform.js';

const SHARE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="4"/><path d="M12 9v6M9 12h6"/></svg>';

export const needsInstall = () => isIOS() && !isStandalone();

export function installHtml() {
  return `<ol class="steps3">
    <li><span class="ic">${SHARE}</span><div><b>Нажми «Поделиться»</b><small>квадрат со стрелкой внизу Safari (на iPad — вверху)</small></div></li>
    <li><span class="ic">${PLUS}</span><div><b>Выбери «На экран „Домой“»</b><small>прокрути меню вниз, если не видно</small></div></li>
    <li><span class="ic">${HOME}</span><div><b>Открой с экрана «Домой»</b><small>появится иконка «Мой зал». Дальше заходи только через неё</small></div></li>
  </ol>`;
}

export function openInstall() {
  openSheet(`${sheetHead('Поставь на экран «Домой»', '', 'Тогда приложение открывается как обычное и работает без интернета')}<div class="sc">
    ${installHtml()}
    <div class="note" style="margin-top:16px">Важно: открывать нужно именно в Safari. Данные во вкладке Safari и в иконке на экране «Домой» хранятся отдельно — поэтому после установки войди в облако ещё раз, и всё подтянется.</div>
    <button class="btn" style="margin-top:20px" data-close>Понятно</button></div>`);
}

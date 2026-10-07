// «Как установить»: на iPhone — три шага с картинками кнопок Safari; на Android — системный диалог
// или шаги меню Chrome. Показывается, пока приложение открыто не с экрана «Домой».
import {openSheet, closeSheet, sheetHead, ICON, toast} from '../ui.js';
import {isIOS, isAndroid, isStandalone, canPromptInstall, promptInstall} from '../platform.js';

const SHARE = '<svg viewBox="0 0 24 24"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8"/></svg>';
const PLUS = '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>';
const DOTS = '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></svg>';
const SAFARI_ONLY = 'Открыть нужно именно в Safari — из Chrome иконку не поставить';

// iPhone в Safari: без иконки на экране «Домой» приложение — просто вкладка.
export const needsInstall = () => isIOS() && !isStandalone();
// Android (и десктопный Chrome с диалогом установки): предлагаем установку одной строкой на главном экране.
export const canInstall = () => !isStandalone() && !isIOS() && (canPromptInstall() || isAndroid());

const step = (icon, b, small) => `<li><span class="ic">${icon}</span><div><b>${b}</b><small>${small}</small></div></li>`;

export function installHtml() {
  return `<ol class="steps3">
    ${step(SHARE, 'Нажми «Поделиться»', 'квадрат со стрелкой внизу Safari')}
    ${step(PLUS, 'Выбери «На экран „Домой“»', 'прокрути меню вниз, если не видно')}
    ${step(ICON.grid, 'Открой иконку «Мой зал»', 'дальше заходи только через неё')}
  </ol>
  <p class="hint2 arrow">Кнопка «Поделиться» — внизу экрана Safari ↓</p>`;
}

const androidHtml = () => `<ol class="steps3">
    ${step(DOTS, 'Открой меню браузера', 'три точки в углу экрана')}
    ${step(PLUS, 'Выбери «Добавить на главный экран»', 'или «Установить приложение»')}
    ${step(ICON.grid, 'Открой иконку «Мой зал»', 'дальше заходи только через неё')}
  </ol>`;

// close — что сделать после закрытия (например, перейти на главный экран в конце первого запуска).
export function openInstall(close) {
  const after = typeof close === 'function' ? close : null;
  if (needsInstall() || isIOS()) {
    openSheet(`${sheetHead('На экран «Домой»', 'Установка', 'Открывается как приложение и работает без интернета')}<div class="sc">
      ${installHtml()}
      <p class="hint2">${SAFARI_ONLY}. Дальше открывай только через иконку — вкладка Safari это другая копия.</p></div>`, null, after);
    return;
  }
  openSheet(`${sheetHead('На экран «Домой»', 'Установка', 'Открывается как приложение и работает без интернета')}<div class="sc">
    ${canPromptInstall() ? '<button class="btn" id="inst-go">Установить</button><p class="hint2">Телефон спросит подтверждение — и иконка появится на экране «Домой».</p>' : androidHtml()}</div>`, sh => {
    const b = sh.querySelector('#inst-go');
    if (b) b.onclick = async () => {b.disabled = true; const ok = await promptInstall(); closeSheet(); toast(ok ? 'Готово — открой «Мой зал» с экрана «Домой»' : 'Установку можно сделать позже из меню браузера');};
  }, after);
}

// Строка на главном экране: открывает шаги или системный диалог. '' — когда приложение уже установлено.
export function installRow() {
  if (needsInstall()) return `<button class="backup" id="goinstall"><span class="bi inv">${ICON.grid}</span><span class="t"><b>Поставить на экран «Домой»</b><small>Работает без интернета</small></span>${ICON.chev}</button>`;
  if (canInstall()) return `<button class="backup" id="goinstall"><span class="bi inv">${ICON.grid}</span><span class="t"><b>Установить «Мой зал»</b><small>${canPromptInstall() ? 'Одно нажатие · без интернета' : 'На экран «Домой» · без интернета'}</small></span>${ICON.chev}</button>`;
  return '';
}

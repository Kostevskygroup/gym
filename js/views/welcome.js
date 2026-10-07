// Первый запуск на новом телефоне: на iPhone в Safari — сначала установка; дальше анкета → облако (→ установка, если ещё в Safari).
import {$, toast, openSheet, closeSheet, sheetHead, pwInput, bindPw, showErr, clearErr} from '../ui.js';
import {state, profiles, renameProfile, updDB} from '../store.js';
import {esc, plural, loginFrom} from '../format.js';
import * as SY from '../sync.js';
import {planOf} from '../program.js';
import {openWizard} from './wizard.js';
import {installHtml, needsInstall, openInstall} from './install.js';

const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>';
const MIN_PASS = 6;
const INTRO = 'Программа под тебя на тренажёрах нашего зала: подходы, таймер отдыха, техника на фото, прогресс и рекорды.';
// «Открыть пока в Safari» — человек сознательно идёт без установки; до перезагрузки установку не навязываем.
let forceWeb = false;

// Новый телефон: анкета не пройдена, нет тренировок, нет облака, один профиль.
export const isFresh = () => !(state.db.settings && state.db.settings.onboarded) && !state.db.sessions.length && !SY.account() && profiles().length === 1;

export function welcomeHtml() {
  const inv = SY.pendingInvite();
  if (needsInstall() && !forceWeb) return `<div class="welcome ios" id="welcome">
    <div class="wl">${LOGO}</div>
    <h1>Мой зал</h1>
    <p>${INTRO}</p>
    <div class="inst"><span class="eyebrow">Установка</span><b class="ct">Поставь на экран «Домой»</b>${installHtml()}</div>
    ${inv ? `<div class="inv">Твой код приглашения<b class="n">${esc(inv)}</b><small>Понадобится после установки — он же есть в сообщении</small></div>` : ''}
    <button class="btn s2" id="wsafari">Открыть пока в Safari</button>
  </div>`;
  return `<div class="welcome" id="welcome">
    <div class="wl">${LOGO}</div>
    <h1>Мой зал</h1>
    <p>${INTRO}</p>
    ${inv ? `<div class="inv">Твой код приглашения<b class="n">${esc(inv)}</b><small>Понадобится на шаге «Облако» — он уже введён</small></div>` : ''}
    <button class="btn" id="wstart">Начать — короткая анкета</button>
    <button class="btn s2" id="wlogin">У меня уже есть аккаунт</button>
    <small>Около минуты. Программу можно поменять в любой момент.</small>
  </div>`;
}

export function bindWelcome(go) {
  const w = $('#welcome');
  if (!w) return;
  const ws = $('#wsafari');
  if (ws) {ws.onclick = () => {forceWeb = true; go('home');}; return;}
  $('#wstart').onclick = () => openWizard('first', () => {
    const n = state.db.settings && state.db.settings.name;
    if (n) {try {renameProfile('main', n);} catch (e) {}}
    cloudStep(go);
  });
  $('#wlogin').onclick = () => loginStep(go);
}

const LOGIN_HINT = 'Можно поменять. Это вход, не имя';
const PASS_HINT = 'Сохрани его в Заметки или в связку ключей iPhone — восстановить пароль нельзя';
const INVITE_RE = /^ZAL-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
const cleanCode = v => String(v || '').trim().toUpperCase();

const loginField = name => `<label>Логин (латиницей)<input id="cname" class="inp" autocomplete="username" autocapitalize="none" value="${esc(loginFrom(name))}" placeholder="например: ksyusha"><small>${LOGIN_HINT}</small></label>`;
const passFields = () => `<label>Пароль${pwInput('cpass', 'new-password', 'минимум 6 символов')}<small>${PASS_HINT}</small></label>
      <label>Повтори пароль${pwInput('cpass2', 'new-password')}</label>`;
const codeField = (inv, first) => `<label>Код приглашения${first ? ' · обязателен' : ''}<input id="cinv" class="inp" autocapitalize="characters" autocomplete="off" value="${esc(inv)}" placeholder="ZAL-XXXX-XXXX"><small>${inv ? 'Код из сообщения со ссылкой — уже введён' : 'Код пришлёт тот, кто пригласил'}</small></label>`;

// Шаг «Облако»: подтверждает программу; с кодом из ссылки — регистрация, без кода — поле кода первым,
// кнопка выключена, пока код не введён, а «Позже» — полноценная кнопка.
// Закрытие любым способом ведёт дальше (установка или главный экран) — шаг нельзя потерять.
function cloudStep(go) {
  const inv = SY.pendingInvite(), name = (state.db.settings && state.db.settings.name) || '';
  const days = Object.keys(planOf(state.db).p1.w);
  const fields = inv ? loginField(name) + passFields() + codeField(inv, false) : codeField('', true) + loginField(name) + passFields();
  openSheet(`${sheetHead('Облако', 'Шаг 2 из 2')}<div class="sc">
    <div class="tb2 first"><p><b>Программа готова:</b> ${days.length} ${plural(days.length, 'день', 'дня', 'дней')} в неделю — ${days.map(esc).join(', ')}. Включи облако, чтобы ничего не потерялось и всё было на любом телефоне.</p></div>
    <div class="form">${fields}</div>
    <p class="ferr" id="cerr"></p>
    <button class="btn" id="cgo"${inv ? '' : ' disabled'}>Включить облако</button>
    <button class="${inv ? 'textbtn' : 'btn s2'}" id="cskip">Позже — пока только на этом телефоне</button></div>`, sh => {
    bindPw(sh);
    const code = sh.querySelector('#cinv'), b = sh.querySelector('#cgo');
    const check = () => {if (!inv) b.disabled = !INVITE_RE.test(cleanCode(code.value));};
    sh.querySelector('.form').oninput = () => {clearErr(sh); check();};
    code.onblur = () => {code.value = cleanCode(code.value); check();};
    sh.querySelector('#cskip').onclick = () => closeSheet();
    b.onclick = async () => {
      const p = sh.querySelector('#cpass').value, p2 = sh.querySelector('#cpass2').value, c = cleanCode(code.value);
      if (!INVITE_RE.test(c)) {showErr(sh, 'Код выглядит как ZAL-XXXX-XXXX — проверь его в сообщении'); code.closest('label').classList.add('bad'); return;}
      if (p.length < MIN_PASS) {showErr(sh, 'Пароль короче 6 символов'); sh.querySelector('#cpass').closest('label').classList.add('bad'); return;}
      if (p !== p2) {showErr(sh, 'Пароли не совпадают'); sh.querySelector('#cpass2').closest('label').classList.add('bad'); return;}
      b.disabled = true; b.textContent = 'Подключаю…';
      try {await SY.register(sh.querySelector('#cname').value, p, c); toast('Облако включено'); closeSheet();}
      catch (e) {console.error('register', e); showErr(sh, SY.humanErr(e)); b.disabled = false; b.textContent = 'Включить облако';}
    };
  }, () => installStep(go));
}

const FORGOT = 'Пароль восстановить нельзя — данные зашифрованы им. Попроси новый код у того, кто тебя пригласил, и создай аккаунт заново.';
function loginStep(go) {
  openSheet(`${sheetHead('Вход')}<div class="sc">
    <div class="tb2 first"><p>Логин и пароль из шага «Облако» — те же, что на другом телефоне.</p></div>
    <div class="form">
      <label>Логин (латиницей)<input id="cname" class="inp" autocomplete="username" autocapitalize="none" placeholder="например: ksyusha"></label>
      <label>Пароль${pwInput('cpass', 'current-password')}</label>
    </div>
    <p class="ferr" id="cerr"></p>
    <button class="btn" id="cgo">Войти</button>
    <button class="textbtn" id="cforgot">Не помню пароль</button></div>`, sh => {
    bindPw(sh);
    sh.querySelector('.form').oninput = () => clearErr(sh);
    sh.querySelector('#cforgot').onclick = () => showErr(sh, FORGOT, true);
    sh.querySelector('#cgo').onclick = async () => {
      const b = sh.querySelector('#cgo'); b.disabled = true; b.textContent = 'Вхожу…';
      try {
        await SY.login(sh.querySelector('#cname').value, sh.querySelector('#cpass').value);
        const n = state.db.settings && state.db.settings.name;
        if (n) {try {renameProfile('main', n);} catch (e) {}}
        const k = state.db.sessions.length;
        toast(`Данные загружены: ${k} ${plural(k, 'тренировка', 'тренировки', 'тренировок')}`);
        closeSheet();
      } catch (e) {console.error('login', e); showErr(sh, SY.humanErr(e)); b.disabled = false; b.textContent = 'Войти';}
    };
  }, () => installStep(go));
}

// Конец первого запуска: отмечаем анкету пройденной; если это ещё Safari на iPhone — напоминаем про иконку.
function installStep(go) {
  updDB(d => ({...d, settings: {...(d.settings || {}), onboarded: true}}));
  if (!needsInstall()) {go('home'); return;}
  openInstall(() => go('home'));
}

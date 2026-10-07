// Первый запуск на новом телефоне: кто ты → анкета → облако → установка на экран «Домой».
import {$, toast, openSheet, closeSheet, sheetHead} from '../ui.js';
import {state, profiles, renameProfile, updDB} from '../store.js';
import {esc} from '../format.js';
import * as SY from '../sync.js';
import {openWizard} from './wizard.js';
import {installHtml, needsInstall} from './install.js';

const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/></svg>';

// Новый телефон: нет тренировок, нет имени, нет облака.
export const isFresh = () => !state.db.sessions.length && !(state.db.settings && state.db.settings.name) && !SY.account() && profiles().length === 1;

export function welcomeHtml() {
  const inv = SY.pendingInvite();
  return `<div class="welcome" id="welcome">
    <div class="wl">${LOGO}</div>
    <h1>Мой зал</h1>
    <p>Программа под тебя на тренажёрах нашего зала. Подходы, таймер отдыха, техника на фото тренажёров, прогресс и рекорды.</p>
    ${inv ? `<div class="note">Код приглашения <b>${esc(inv)}</b> уже введён — он понадобится на шаге «Облако».</div>` : ''}
    <button class="btn" id="wstart">Начать — ответить на 5 вопросов</button>
    <button class="btn s2" id="wlogin">У меня уже есть аккаунт</button>
    <small>Около минуты. Ответы можно поменять в профиле.</small>
  </div>`;
}

export function bindWelcome(go) {
  const w = $('#welcome');
  if (!w) return;
  $('#wstart').onclick = () => openWizard('first', () => {
    const n = state.db.settings && state.db.settings.name;
    if (n) {try {renameProfile('main', n);} catch (e) {}}
    cloudStep(go);
  });
  $('#wlogin').onclick = () => loginStep(go);
}

// Шаг «Облако»: с кодом из ссылки — регистрация, без — можно пропустить.
function cloudStep(go) {
  const inv = SY.pendingInvite(), name = (state.db.settings && state.db.settings.name) || '';
  openSheet(`${sheetHead('Облако', 'Шаг 2 из 3', 'Чтобы ничего не потерялось и было на любом телефоне')}<div class="sc">
    <p class="hint2 lead">Данные шифруются на телефоне твоим паролем — прочитать их можешь только ты. Пароль не восстановить, запиши его.</p>
    <div class="form"><label>Имя для входа<input id="cname" autocomplete="username" value="${esc(name)}"></label>
    <label>Пароль<input id="cpass" type="password" autocomplete="new-password" placeholder="минимум 6 символов"></label>
    <label>Код приглашения<input id="cinv" autocapitalize="characters" value="${esc(inv)}" placeholder="ZAL-XXXX-XXXX"></label></div>
    <button class="btn" style="margin-top:14px" id="cgo">Включить облако</button>
    <button class="lnk" style="margin-top:8px" id="cskip">Позже — данные останутся только на этом телефоне</button></div>`, sh => {
    sh.querySelector('#cskip').onclick = () => {closeSheet(); installStep(go);};
    sh.querySelector('#cgo').onclick = async () => {
      const b = sh.querySelector('#cgo'); b.disabled = true; b.textContent = 'Подключаю…';
      try {await SY.register(sh.querySelector('#cname').value, sh.querySelector('#cpass').value, sh.querySelector('#cinv').value); toast('Облако включено'); closeSheet(); installStep(go);}
      catch (e) {toast(e.message); b.disabled = false; b.textContent = 'Включить облако';}
    };
  });
}

function loginStep(go) {
  openSheet(`${sheetHead('Вход', '', 'Тем же именем и паролем, что на другом телефоне')}<div class="sc">
    <div class="form"><label>Имя для входа<input id="cname" autocomplete="username"></label>
    <label>Пароль<input id="cpass" type="password" autocomplete="current-password"></label></div>
    <button class="btn" style="margin-top:14px" id="cgo">Войти</button></div>`, sh => {
    sh.querySelector('#cgo').onclick = async () => {
      const b = sh.querySelector('#cgo'); b.disabled = true; b.textContent = 'Вхожу…';
      try {
        await SY.login(sh.querySelector('#cname').value, sh.querySelector('#cpass').value);
        const n = state.db.settings && state.db.settings.name;
        if (n) {try {renameProfile('main', n);} catch (e) {}}
        toast('Данные загружены'); closeSheet(); installStep(go);
      } catch (e) {toast(e.message); b.disabled = false; b.textContent = 'Войти';}
    };
  });
}

function installStep(go) {
  updDB(d => ({...d, settings: {...(d.settings || {}), onboarded: true}}));
  if (!needsInstall()) {go('home'); return;}
  openSheet(`${sheetHead('Последний шаг', 'Шаг 3 из 3', 'Поставь приложение на экран «Домой»')}<div class="sc">${installHtml()}
    <div class="note" style="margin-top:16px">После установки открой иконку и войди в облако — всё подтянется. Вкладку Safari можно закрыть.</div>
    <button class="btn" style="margin-top:20px" data-close>Понятно</button></div>`, null, () => go('home'));
}

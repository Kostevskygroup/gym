// Профили: несколько человек на одном телефоне, у каждого всё своё.
import {toast, openSheet, closeSheet, sheetHead, CK} from '../ui.js';
import {state, profiles, activeProfile, switchProfile, addProfile, renameProfile, deleteProfile, updDB} from '../store.js';
import {esc, fmtD} from '../format.js';
import * as SY from '../sync.js';
import {JOINTS} from '../data/exercises.js';
import {openWizard} from './wizard.js';

const ago = iso => {const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'только что' : m < 60 ? m + ' мин назад' : m < 1440 ? Math.round(m / 60) + ' ч назад' : fmtD(iso);};
let cmode = 'new';
function cloudHtml(me) {
  const a = SY.account();
  if (a) return `<div class="tb2"><h4>Облако</h4><div class="cloud${a.err ? ' bad' : ''}"><b>Вход: ${esc(a.name)}</b><small>${a.err ? esc(a.err) : a.at ? 'синхронизировано ' + ago(a.at) : 'синхронизация…'}</small></div>
    <div class="g2" style="margin-top:12px"><button class="btn s2 sm" id="csync">Синхронизировать</button><button class="btn s2 sm" id="cout">Выйти из облака</button></div>
    <p class="hint2">Данные шифруются на телефоне и хранятся на сервере в Ирландии. На другом телефоне войди с тем же именем и паролем.</p></div>`;
  return `<div class="tb2"><h4>Облако</h4><p class="hint2 lead">Чтобы ничего не потерялось и было на любом телефоне — включи облако. Данные шифруются на телефоне паролем: прочитать их можешь только ты.</p>
    <div class="seg" id="cmode"><button class="${cmode === 'new' ? 'on' : ''}" data-m="new">Новый аккаунт</button><button class="${cmode === 'in' ? 'on' : ''}" data-m="in">Уже есть</button></div>
    <div class="form"><label>Имя для входа<input id="cname" autocomplete="username" value="${esc(me.name === 'Я' ? '' : me.name)}" placeholder="Например: slava"></label>
    <label>Пароль<input id="cpass" type="password" autocomplete="${cmode === 'new' ? 'new-password' : 'current-password'}" placeholder="минимум 6 символов"></label>
    ${cmode === 'new' ? '<label>Код приглашения<input id="cinv" autocapitalize="characters" placeholder="ZAL-XXXX-XXXX-XXXX"></label>' : ''}</div>
    <button class="btn" style="margin-top:12px" id="cgo">${cmode === 'new' ? 'Создать и включить' : 'Войти'}</button>
    <p class="hint2">Пароль не восстановить — запиши его. Без пароля данные не расшифровать никому.</p></div>`;
}

const initial = n => esc((String(n || '?').trim()[0] || '?').toUpperCase());
export const avatarHtml = () => {const p = profiles().find(x => x.id === activeProfile()); return `<button class="avatar" id="profbtn" aria-label="Профиль: ${esc(p.name)}">${initial(p.name)}</button>`;};

// after(changed) вызывается после переключения или изменения профиля.
export function openProfiles(after) {
  const draw = sh => {
    const list = profiles(), cur = activeProfile(), me = list.find(p => p.id === cur), knee = !state.db.settings || state.db.settings.knee !== false;
    sh.innerHTML = `${sheetHead('Профили', '', 'У каждого свои тренировки, программа, заметки и фото')}<div class="sc">
      <div class="glist">${list.map(p => `<button class="gl-row prof${p.id === cur ? ' on' : ''}" data-pid="${esc(p.id)}"><span class="avatar sm">${initial(p.name)}</span><span class="t"><b>${esc(p.name)}</b><small>${p.id === cur ? 'сейчас открыт' : 'нажми, чтобы переключиться'}</small></span>${p.id === cur ? CK : '<span></span>'}</button>`).join('')}</div>
      <div class="tb2"><h4>${esc(me.name)} — настройки</h4>
        <p class="hint2 lead">Что беспокоит — приложение спросит про это после тренировки и не будет повышать вес, если болит.</p>
        <div class="chipsel" id="ppain">${Object.entries(JOINTS).map(([j, t]) => `<button type="button" class="${(state.db.settings?.pain || (knee ? ['knee'] : [])).includes(j) ? 'on' : ''}" data-j="${j}">${t}</button>`).join('')}</div>
        <button class="btn s2 sm" style="margin-top:12px" id="prebuild">Собрать программу заново под меня</button>
        <div class="g2" style="margin-top:12px"><button class="btn s2 sm" id="pren">Переименовать</button>${cur !== 'main' ? '<button class="btn s2 sm danger" id="pdel">Удалить профиль</button>' : '<span></span>'}</div></div>
      ${cloudHtml(me)}
      <div class="tb2"><h4>Новый человек</h4>
        <button class="btn" id="padd">Добавить человека</button>
        <p class="hint2">Короткая анкета: цель, сколько раз в неделю, опыт, что беспокоит и на что упор — и программа соберётся сама из упражнений твоего зала. На другом телефоне просто открой ту же ссылку: там всё будет своё.</p></div>
    </div>`;
    sh.querySelectorAll('[data-pid]').forEach(b => b.onclick = () => {
      const id = b.dataset.pid;
      if (id === activeProfile()) return;
      switchProfile(id); closeSheet(); after(true);
      toast('Открыт профиль: ' + profiles().find(p => p.id === id).name);
    });
    sh.querySelector('#ppain').onclick = e => {
      const b = e.target.closest('[data-j]'); if (!b) return;
      b.classList.toggle('on');
      const pain = [...sh.querySelectorAll('#ppain .on')].map(x => x.dataset.j);
      updDB(d => ({...d, settings: {...(d.settings || {}), pain, knee: pain.includes('knee')}}));
      after(false);
    };
    sh.querySelector('#prebuild').onclick = () => openWizard('rebuild', () => after(false));
    sh.querySelector('#pren').onclick = () => {
      const n = prompt('Новое имя', me.name);
      if (n === null) return;
      try {renameProfile(cur, n); draw(sh); after(false);} catch (e) {toast(e.message);}
    };
    const del = sh.querySelector('#pdel');
    if (del) del.onclick = () => {
      if (!confirm(`Удалить профиль «${me.name}» со всеми его тренировками? Это нельзя отменить. Сначала сохрани его копию в «Тело», если нужно.`)) return;
      deleteProfile(cur); closeSheet(); after(true); toast('Профиль удалён');
    };
    sh.querySelectorAll('#cmode [data-m]').forEach(b => b.onclick = () => {cmode = b.dataset.m; draw(sh);});
    const go = sh.querySelector('#cgo');
    if (go) go.onclick = async () => {
      const name = sh.querySelector('#cname').value, pass = sh.querySelector('#cpass').value, inv = sh.querySelector('#cinv');
      go.disabled = true; go.textContent = 'Подключаю…';
      try {
        if (cmode === 'new') await SY.register(name, pass, inv ? inv.value : ''); else await SY.login(name, pass);
        toast('Облако включено'); draw(sh); after(false);
      } catch (e) {toast(e.message); go.disabled = false; go.textContent = cmode === 'new' ? 'Создать и включить' : 'Войти';}
    };
    const cs = sh.querySelector('#csync');
    if (cs) cs.onclick = async () => {cs.disabled = true; try {await SY.syncNow(); toast('Синхронизировано');} catch (e) {toast(e.message);} draw(sh); after(false);};
    const co = sh.querySelector('#cout');
    if (co) co.onclick = () => {if (confirm('Выйти из облака на этом телефоне? Данные на телефоне останутся, на сервере тоже.')) {SY.logout(); draw(sh);}};
    sh.querySelector('#padd').onclick = () => openWizard('new', () => after(true));
  };
  openSheet('', draw);
}

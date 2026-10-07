// Профиль: облако и приглашения, программа и суставы, имя; несколько человек на одном телефоне — за «Ещё».
import {toast, openSheet, closeSheet, sheetHead, CK, ICON, textForm, pwInput, bindPw, showErr, clearErr} from '../ui.js';
import {state, profiles, activeProfile, switchProfile, renameProfile, deleteProfile, updDB} from '../store.js';
import {esc, fmtD, ago, DAY, loginFrom, isInviteCode} from '../format.js';
import * as SY from '../sync.js';
import {JOINTS} from '../data/exercises.js';
import {openWizard} from './wizard.js';

const MIN_PASS = 6, INVITE_DAYS = 7;
const LOGIN_HINT = 'Можно поменять. Это вход, не имя';
const PASS_HINT = 'Сохрани его в Заметки или в связку ключей iPhone — восстановить пароль нельзя';
const INVITE_HINT = 'Код на 7 дней, один раз. Откроется «Поделиться».';
let cmode = 'new';

// Ошибка облака — человеческой фразой и с кнопкой: войти заново (ключ не подходит) или повторить (нет связи).
const cloudStatus = a => {
  if (!a.err) return `<div class="cloud"><b>Вход: ${esc(a.name)}${a.admin ? ' · владелец' : ''}</b><small>${a.at ? 'синхронизировано ' + ago(a.at) : 'синхронизация…'}</small></div>`;
  const relogin = SY.errAction(a.err) === 'relogin';
  return `<div class="cloud bad"><b>Вход: ${esc(a.name)}${a.admin ? ' · владелец' : ''}</b><small>${esc(a.err)}</small>
    <button class="textbtn inl" id="${relogin ? 'cfix' : 'cretry'}">${relogin ? 'Выйти и войти заново' : 'Повторить'}</button></div>`;
};

function cloudHtml(me) {
  const a = SY.account();
  if (a) return `<div class="tb2"><h4>Облако</h4>
    ${a.admin ? `<button class="btn" id="cinvite">${ICON.invite}Пригласить человека</button><p class="hint2">${INVITE_HINT}</p><div id="cinvlist"></div>` : ''}
    ${cloudStatus(a)}
    <div class="g2"><button class="btn s2" id="csync">Синхронизировать</button><button class="btn s2" id="cout">Выйти из облака</button></div>
    <p class="hint2">Данные шифруются на телефоне и хранятся на сервере в Ирландии. На другом телефоне войди с тем же логином и паролем.</p></div>`;
  const isNew = cmode === 'new';
  return `<div class="tb2"><h4>Облако</h4>
    <div class="seg" id="cmode"><button class="${isNew ? 'on' : ''}" data-m="new">Новый аккаунт</button><button class="${isNew ? '' : 'on'}" data-m="in">Уже есть</button></div>
    <div class="form">
      <label>Логин (латиницей)<input id="cname" class="inp" autocomplete="username" autocapitalize="none" value="${esc(loginFrom(me.name === 'Я' ? '' : me.name))}" placeholder="например: slava"><small>${LOGIN_HINT}</small></label>
      <label>Пароль${pwInput('cpass', isNew ? 'new-password' : 'current-password', isNew ? 'минимум 6 символов' : '')}${isNew ? `<small>${PASS_HINT}</small>` : ''}</label>
      ${isNew ? `<label>Повтори пароль${pwInput('cpass2', 'new-password')}</label>
      <label>Код приглашения<input id="cinv" class="inp" autocapitalize="characters" autocomplete="off" value="${esc(SY.pendingInvite())}" placeholder="ZAL-…"><small>Код даёт тот, кто тебя пригласил — он в сообщении со ссылкой.</small></label>` : ''}
    </div>
    <p class="ferr" id="cerr"></p>
    <button class="btn" id="cgo">${isNew ? 'Создать и включить' : 'Войти'}</button>
    <p class="hint2">Данные шифруются на телефоне паролем и хранятся на сервере в Ирландии — прочитать их можешь только ты.</p></div>`;
}

const initial = n => esc((String(n || '?').trim()[0] || '?').toUpperCase());
export const avatarHtml = () => {const p = profiles().find(x => x.id === activeProfile()); return `<button class="avatar" id="profbtn" aria-label="Профиль: ${esc(p.name)}">${initial(p.name)}</button>`;};

// Отправить приглашение. Вызывать прямо из обработчика нажатия: iOS открывает «Поделиться» только по жесту.
export function shareInvite(code) {
  const text = SY.inviteText(code);
  if (navigator.share) return navigator.share({title: 'Мой зал', text}).then(() => toast('Приглашение отправлено'), e => {
    if (e && e.name === 'AbortError') return;
    toast(e && e.name === 'NotAllowedError' ? 'Не удалось открыть «Поделиться» — нажми «Отправить» рядом с кодом' : (e && e.message) || 'Не получилось отправить');
  });
  return navigator.clipboard.writeText(text).then(() => toast('Приглашение скопировано — отправь его в мессенджере'), () => toast('Не удалось скопировать — нажми «Отправить» рядом с кодом'));
}

// Создать код → запомнить на телефоне → показать в списке → предложить отправить. Код не теряется, даже если «Поделиться» сорвалось.
export async function inviteFlow(onList) {
  let inv;
  try {inv = await SY.createInvite();}
  catch (e) {console.error('invite', e); toast(SY.humanErr(e) || 'Не удалось создать код'); return null;}
  const exp = inv.exp || new Date(Date.now() + INVITE_DAYS * DAY).toISOString();
  SY.rememberInvite({code: inv.code, exp});
  if (onList) onList();
  await shareInvite(inv.code);
  return inv.code;
}

const tail = c => String(c || '').slice(-4);
const invRow = i => {
  const st = i.used ? 'использован' : i.expired ? 'истёк' : 'действует до ' + fmtD(i.exp);
  const send = i.full && !i.used && !i.expired;
  return `<div class="gl-row inv"><span class="t"><b class="n">${esc(i.full || i.code)}</b><small>${st}</small></span>${send ? `<button class="textbtn inl" data-resend="${esc(i.full)}">Отправить</button>` : '<span></span>'}</div>`;
};
// Список кодов: сразу — свои (целиком), затем сверяем с сервером (он знает «использован/истёк», но маскирует код).
async function drawInvites(sh) {
  const box = sh.querySelector('#cinvlist'); if (!box) return;
  const render = rows => {
    box.innerHTML = rows.length ? `<div class="glist">${rows.map(invRow).join('')}</div>` : '';
    box.querySelectorAll('[data-resend]').forEach(b => b.onclick = () => shareInvite(b.dataset.resend));
  };
  const local = SY.localInvites();
  render(local.map(l => ({...l, full: l.code})));
  try {
    const list = await SY.listInvites();
    const rows = list.map(i => {
      const l = local.find(x => tail(x.code) === tail(i.code));
      if (l && (i.used || i.expired)) SY.forgetInvite(l.code);
      return {...i, full: l && !i.used && !i.expired ? l.code : ''};
    });
    local.filter(l => !list.some(i => tail(i.code) === tail(l.code))).forEach(l => rows.push({code: l.code, full: l.code, exp: l.exp}));
    render(rows);
  } catch (e) {/* нет связи — остаётся локальный список */}
}

// after(changed) вызывается после переключения или изменения профиля.
export function openProfiles(after) {
  const draw = sh => {
    const list = profiles(), cur = activeProfile(), me = list.find(p => p.id === cur), pain = (state.db.settings && state.db.settings.pain) || [];
    const many = list.length > 1;
    sh.innerHTML = `${sheetHead(many ? 'Профили' : 'Профиль', '', many ? 'У каждого свои тренировки, программа, заметки и фото' : '')}<div class="sc">
      ${many ? `<div class="glist">${list.map(p => `<button class="gl-row prof${p.id === cur ? ' on' : ''}" data-pid="${esc(p.id)}"><span class="avatar sm">${initial(p.name)}</span><span class="t"><b>${esc(p.name)}</b><small>${p.id === cur ? 'сейчас открыт' : 'нажми, чтобы переключиться'}</small></span>${p.id === cur ? CK : '<span></span>'}</button>`).join('')}</div>` : ''}
      ${cloudHtml(me)}
      <div class="tb2"><h4>Моя программа</h4>
        <button class="btn s2" id="prebuild">Собрать программу заново</button>
        <p class="hint2">Что беспокоит — после тренировки спрошу про это и не буду повышать вес, если болит.</p>
        <div class="chipsel" id="ppain" data-multi="1">${Object.entries(JOINTS).map(([j, t]) => `<button type="button" class="${pain.includes(j) ? 'on' : ''}" data-j="${j}">${t}</button>`).join('')}</div></div>
      <div class="tb2"><h4>Имя</h4>
        <div class="g2"><button class="btn s2" id="pren">Переименовать</button>${cur !== 'main' ? '<button class="btn s2 danger" id="pdel">Удалить профиль</button>' : '<span></span>'}</div></div>
      <details class="more"><summary class="textbtn">Ещё один человек на этом телефоне${ICON.down}</summary>
        <div class="tb2"><button class="btn s2" id="padd">Добавить человека</button>
        <p class="hint2">Если телефон общий — у каждого будут свои тренировки, программа и облако. На другом телефоне просто открой ссылку приложения.</p></div></details>
    </div>`;
    bindPw(sh);
    sh.querySelectorAll('[data-pid]').forEach(b => b.onclick = () => {
      const id = b.dataset.pid;
      if (id === activeProfile()) return;
      switchProfile(id); closeSheet(); after(true);
      toast('Открыт профиль: ' + profiles().find(p => p.id === id).name);
    });
    sh.querySelector('#ppain').onclick = e => {
      const b = e.target.closest('[data-j]'); if (!b) return;
      b.classList.toggle('on');
      const next = [...sh.querySelectorAll('#ppain .on')].map(x => x.dataset.j);
      updDB(d => ({...d, settings: {...(d.settings || {}), pain: next, knee: next.includes('knee')}}));
      after(false);
    };
    sh.querySelector('#prebuild').onclick = () => openWizard('rebuild', () => after(false));
    sh.querySelector('#pren').onclick = () => textForm(sh, {title: 'Имя', label: 'Как к тебе обращаться', value: me.name}, {
      back: () => draw(sh),
      ok: v => {renameProfile(cur, v); draw(sh); after(false);},
    });
    const del = sh.querySelector('#pdel');
    if (del) del.onclick = () => {
      if (!confirm(`Удалить профиль «${me.name}» со всеми его тренировками? Это нельзя отменить. Сначала сохрани его копию в «Тело», если нужно.`)) return;
      deleteProfile(cur); closeSheet(); after(true); toast('Профиль удалён');
    };
    sh.querySelectorAll('#cmode [data-m]').forEach(b => b.onclick = () => {cmode = b.dataset.m; draw(sh);});
    const form = sh.querySelector('.form');
    if (form) form.oninput = () => clearErr(sh);
    const go = sh.querySelector('#cgo');
    if (go) go.onclick = async () => {
      const name = sh.querySelector('#cname').value, pass = sh.querySelector('#cpass').value, inv = sh.querySelector('#cinv'), p2 = sh.querySelector('#cpass2');
      if (cmode === 'new') {
        if (inv && !isInviteCode(inv.value)) {showErr(sh, inv.value.trim() ? 'Код не похож на код приглашения (ZAL-…) — проверь его в сообщении' : 'Введи код приглашения'); inv.closest('label').classList.add('bad'); return;}
        if (pass.length < MIN_PASS) {showErr(sh, 'Пароль короче 6 символов'); sh.querySelector('#cpass').closest('label').classList.add('bad'); return;}
        if (p2 && pass !== p2.value) {showErr(sh, 'Пароли не совпадают'); p2.closest('label').classList.add('bad'); return;}
      }
      go.disabled = true; go.textContent = 'Подключаю…';
      try {
        if (cmode === 'new') await SY.register(name, pass, inv ? inv.value : ''); else await SY.login(name, pass);
        toast('Облако включено'); draw(sh); after(false);
      } catch (e) {console.error('cloud', e); showErr(sh, SY.humanErr(e)); go.disabled = false; go.textContent = cmode === 'new' ? 'Создать и включить' : 'Войти';}
    };
    const fix = sh.querySelector('#cfix');
    if (fix) fix.onclick = () => {if (confirm('Выйти из облака и войти заново? Данные на телефоне останутся.')) {SY.logout(); cmode = 'in'; draw(sh);}};
    const retry = sh.querySelector('#cretry');
    if (retry) retry.onclick = async () => {retry.disabled = true; try {await SY.syncNow(); toast('Синхронизировано');} catch (e) {toast(SY.humanErr(e));} draw(sh); after(false);};
    const ci = sh.querySelector('#cinvite');
    if (ci) {
      ci.onclick = async () => {ci.disabled = true; try {await inviteFlow(() => drawInvites(sh));} finally {ci.disabled = false; drawInvites(sh);}};
      drawInvites(sh);
    }
    const cs = sh.querySelector('#csync');
    if (cs) cs.onclick = async () => {cs.disabled = true; try {await SY.syncNow(); toast('Синхронизировано');} catch (e) {toast(SY.humanErr(e));} draw(sh); after(false);};
    const co = sh.querySelector('#cout');
    if (co) co.onclick = () => {if (confirm('Выйти из облака на этом телефоне? Данные на телефоне останутся, на сервере тоже.')) {SY.logout(); draw(sh);}};
    sh.querySelector('#padd').onclick = () => openWizard('new', () => after(true));
  };
  openSheet('', draw);
}

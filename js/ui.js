// Мелкие помощники интерфейса: выбор элементов, уведомление, нижняя шторка, примитивы форм.
import {esc} from './format.js';

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

let toastT = null, relift = null;
const TOAST_MS = 2400, TOAST_ACT_MS = 6000, TOAST_GAP = 8, RELIFT_MS = 350;
// toast('Удалено', {label: 'Отменить', run: fn}) — кнопка действия на 6 секунд. ms — своя длительность.
// pos 'top' — у верхнего края под полосой сессии (короткие «✓ готово» во время тренировки).
export function toast(text, action, ms, pos) {
  const e = $('#toast');
  e.innerHTML = '';
  e.classList.toggle('top', pos === 'top');
  const t = document.createElement('span');
  t.className = 'tt';
  t.textContent = text;
  e.append(t);
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => {b.onclick = null; hideToast(e); action.run();};
    e.append(b);
  }
  e.classList.toggle('act', !!action);
  e.classList.add('on');
  if (pos !== 'top') {
    liftOverButtons(e);
    // шторка или экран могут открыться сразу после уведомления — проверяем кнопки ещё раз
    setTimeout(() => e.classList.contains('on') && liftOverButtons(e), RELIFT_MS);
    watchScroll(e);
  } else e.style.removeProperty('--lift');
  clearTimeout(toastT);
  toastT = setTimeout(() => hideToast(e), ms || (action ? TOAST_ACT_MS : TOAST_MS));
}

// Убрать уведомление сейчас (например, «Дальше: …» устарело — всё уже сделано).
export function dismissToast() {clearTimeout(toastT); hideToast($('#toast'));}

function hideToast(e) {
  e.classList.remove('on', 'act', 'top');
  if (relift) {$('#app').removeEventListener('scroll', relift); relift = null;}
}

// Пока уведомление видно, экран может прокрутиться под ним — проверяем кнопки заново (раз в кадр).
function watchScroll(e) {
  const app = $('#app');
  if (relift) app.removeEventListener('scroll', relift);
  let raf = 0;
  relift = () => {if (!raf) raf = requestAnimationFrame(() => {raf = 0; liftOverButtons(e);});};
  app.addEventListener('scroll', relift, {passive: true});
}

// Уведомление не должно закрывать ни одну кнопку экрана или шторки: если под ним что-то видно — поднимаем его выше.
// Карточки боли (.kneec) — целиком: иначе уведомление встаёт между заголовком «Колени сегодня» и сеткой 0–10.
const LIFT_OVER = '.view.on .btn, .view.on .ck, .view.on .kneec, .view.on .knees button, .view.on .textbtn, .ov.on .btn, .ov.on .knees button, .ov.on .textbtn, .done-ov.on .btn';
// Поднимаем повторно: над одним рядом кнопок может оказаться следующий (сетка 0–10). Не выше LIFT_MIN_TOP от верха экрана.
const LIFT_STEPS = 6, LIFT_MIN_TOP = 100;
function liftOverButtons(e) {
  e.style.removeProperty('--lift');
  const r = e.getBoundingClientRect();
  const rects = $$(LIFT_OVER).map(b => b.getBoundingClientRect()).filter(q => q.height);
  let lift = 0;
  for (let i = 0; i < LIFT_STEPS; i++) {
    const top = r.top - lift, bottom = r.bottom - lift;
    const hit = rects.filter(q => q.bottom > top && q.top < bottom);
    if (!hit.length) break;
    const next = r.bottom - Math.min(...hit.map(q => q.top)) + TOAST_GAP;
    if (r.top - next < LIFT_MIN_TOP) break;
    lift = next;
  }
  if (lift) e.style.setProperty('--lift', Math.ceil(lift) + 'px');
}

// Горизонтальные ряды чипов: затухание у края — только когда ряд правда не помещается и не докручен.
export function fadeRows(root = document) {
  root.querySelectorAll('.wos, .exl, .medals, .pgf').forEach(el => {
    const upd = () => el.classList.toggle('ovf', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    upd();
    el.addEventListener('scroll', upd, {passive: true});
  });
}

let onClose = null;
export function openSheet(html, mount, close) {
  const ov = $('#sheetov'), sh = $('#sheet'), t = $('#toast');
  if (onClose) onClose();
  sh.innerHTML = html;
  sh.scrollTop = 0;
  sh.classList.remove('scrolled');
  sh.onscroll = () => {sh.classList.toggle('scrolled', sh.scrollTop > 2); if (t.classList.contains('on') && !t.classList.contains('top')) liftOverButtons(t);};
  ov.classList.add('on');
  onClose = close || null;
  if (mount) mount(sh);
  if (t.classList.contains('on') && !t.classList.contains('top')) setTimeout(() => liftOverButtons(t), RELIFT_MS);
}
export function closeSheet() {
  $('#sheetov').classList.remove('on');
  if (onClose) {const f = onClose; onClose = null; f();}
}
export const sheetOpen = () => $('#sheetov').classList.contains('on');

export const CK = '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
export const ICON = {
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg>',
  swap: '<svg viewBox="0 0 24 24"><path d="M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  skip: '<svg viewBox="0 0 24 24"><path d="M5 5l9 7-9 7zM17 5v14"/></svg>',
  core: '<svg viewBox="0 0 24 24"><rect x="7" y="3" width="10" height="18" rx="5"/><path d="M7 9h10M7 15h10M12 3v18"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg>',
  chev: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 3c.6 3.4 4.5 5.4 4.5 9.8A4.5 4.5 0 0 1 7.5 13c0-2 .9-3.4 2.1-4.5.3 1.5 1 2.4 2.2 2.8.1-2.8.6-5.4.2-8.3z"/></svg>',
  save: '<svg viewBox="0 0 24 24"><path d="M12 4v10M7.5 9.5L12 14l4.5-4.5M5 19h14"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3zM12 10v4M12 17v.5"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>',
  eyeoff: '<svg viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6 9.5 6c1.6 0 3-.4 4.3-1M9.9 5.2A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-2.2 3"/></svg>',
  invite: '<svg viewBox="0 0 24 24"><circle cx="10" cy="8" r="3.5"/><path d="M3.5 20a6.5 6.5 0 0 1 13 0M18 7v6M15 10h6"/></svg>',
  grid: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg>',
};

// Шапка шторки: надзаголовок, заголовок, строка под ним и ✕. Текст передаётся уже экранированным.
export const sheetHead = (titleHtml, eyebrow = '', subHtml = '') =>
  `<div class="shd"><div>${eyebrow ? `<small>${eyebrow}</small>` : ''}<h2>${titleHtml}</h2>${subHtml ? `<p class="shs">${subHtml}</p>` : ''}</div><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>`;

// Поле пароля с кнопкой «показать». Привязка — bindPw(root).
export const pwInput = (id, autocomplete, placeholder = '') =>
  `<div class="pw"><input id="${id}" type="password" autocomplete="${autocomplete}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ''}><button type="button" class="pwt" aria-label="Показать пароль">${ICON.eye}</button></div>`;
export function bindPw(root) {
  root.querySelectorAll('.pw .pwt').forEach(b => b.onclick = () => {
    const i = b.parentElement.querySelector('input'), show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.innerHTML = show ? ICON.eyeoff : ICON.eye;
    b.setAttribute('aria-label', show ? 'Скрыть пароль' : 'Показать пароль');
  });
}

// Ошибка формы на месте (вместо системного окна): showErr(sh, 'текст'), clearErr(sh) — при вводе.
export function showErr(root, msg, info = false) {
  const e = root.querySelector('.ferr'); if (!e) return;
  e.textContent = msg; e.classList.toggle('info', info); e.classList.add('on');
}
export function clearErr(root) {
  root.querySelectorAll('.ferr.on').forEach(e => e.classList.remove('on', 'info'));
  root.querySelectorAll('.bad').forEach(e => e.classList.remove('bad'));
}

// Форма из одного поля внутри текущей шторки (вместо prompt()): ok(value) может бросить — ошибка покажется под полем.
const TF_FOCUS_MS = 60;
export function textForm(sh, {title, label, value = '', placeholder = '', cta = 'Сохранить', maxlength = 24}, {ok, back}) {
  sh.innerHTML = `${sheetHead(esc(title))}<div class="sc"><div class="form"><label>${esc(label)}<input id="tf" class="inp" value="${esc(value)}" placeholder="${esc(placeholder)}" maxlength="${maxlength}" autocomplete="off"></label><p class="ferr" id="tferr"></p></div>
    <button class="btn" id="tfok">${esc(cta)}</button><button class="btn s2" id="tfback">Назад</button></div>`;
  sh.scrollTop = 0;
  const inp = sh.querySelector('#tf');
  inp.oninput = () => clearErr(sh);
  inp.onkeydown = e => {if (e.key === 'Enter') {e.preventDefault(); sh.querySelector('#tfok').click();}};
  sh.querySelector('#tfback').onclick = back;
  sh.querySelector('#tfok').onclick = () => {
    try {ok(inp.value);}
    catch (e) {showErr(sh, e.message); inp.classList.add('bad'); inp.focus();}
  };
  setTimeout(() => {inp.focus(); inp.select();}, TF_FOCUS_MS);
}

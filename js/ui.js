// Мелкие помощники интерфейса: выбор элементов, уведомление, нижняя шторка.
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

let toastT = null, relift = null;
const TOAST_MS = 2400, TOAST_ACT_MS = 6000, TOAST_GAP = 8;
// toast('Удалено', {label: 'Отменить', run: fn}) — кнопка действия на 6 секунд. ms — своя длительность.
export function toast(text, action, ms) {
  const e = $('#toast');
  e.innerHTML = '';
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
  liftOverButtons(e);
  watchScroll(e);
  clearTimeout(toastT);
  toastT = setTimeout(() => hideToast(e), ms || (action ? TOAST_ACT_MS : TOAST_MS));
}

// Убрать уведомление сейчас (например, «Дальше: …» устарело — всё уже сделано).
export function dismissToast() {clearTimeout(toastT); hideToast($('#toast'));}

function hideToast(e) {
  e.classList.remove('on', 'act');
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

// Уведомление не должно закрывать главную кнопку экрана: если под ним видна .btn — поднимаем его выше.
function liftOverButtons(e) {
  e.style.removeProperty('--lift');
  const r = e.getBoundingClientRect();
  let lift = 0;
  $$('.view.on .btn, .ov.on .btn, .done-ov.on .btn').forEach(b => {
    const q = b.getBoundingClientRect();
    if (q.height && q.bottom > r.top && q.top < r.bottom) lift = Math.max(lift, r.bottom - q.top + TOAST_GAP);
  });
  if (lift) e.style.setProperty('--lift', Math.ceil(lift) + 'px');
}

// Горизонтальные ряды чипов: затухание у края — только когда ряд правда не помещается и не докручен.
export function fadeRows(root = document) {
  root.querySelectorAll('.wos, .exl, .medals').forEach(el => {
    const upd = () => el.classList.toggle('ovf', el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    upd();
    el.addEventListener('scroll', upd, {passive: true});
  });
}

let onClose = null;
export function openSheet(html, mount, close) {
  const ov = $('#sheetov'), sh = $('#sheet');
  if (onClose) onClose();
  sh.innerHTML = html;
  sh.scrollTop = 0;
  sh.classList.remove('scrolled');
  sh.onscroll = () => sh.classList.toggle('scrolled', sh.scrollTop > 2);
  ov.classList.add('on');
  onClose = close || null;
  if (mount) mount(sh);
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
};

// Шапка шторки: надзаголовок, заголовок, строка под ним и ✕. Текст передаётся уже экранированным.
export const sheetHead = (titleHtml, eyebrow = '', subHtml = '') =>
  `<div class="shd"><div>${eyebrow ? `<small>${eyebrow}</small>` : ''}<h2>${titleHtml}</h2>${subHtml ? `<p class="shs">${subHtml}</p>` : ''}</div><button class="x" data-close aria-label="Закрыть">${ICON.x}</button></div>`;

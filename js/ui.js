// Мелкие помощники интерфейса: выбор элементов, уведомление, нижняя шторка.
export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];

let toastT = null;
// toast('Удалено', {label: 'Отменить', run: fn}) — кнопка действия на 6 секунд.
export function toast(text, action) {
  const e = $('#toast');
  e.innerHTML = '';
  e.append(document.createTextNode(text));
  if (action) {
    const b = document.createElement('button');
    b.textContent = action.label;
    b.onclick = () => {e.classList.remove('on'); action.run();};
    e.append(b);
  }
  e.classList.toggle('act', !!action);
  e.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => e.classList.remove('on'), action ? 6000 : 2400);
}

let onClose = null;
export function openSheet(html, mount, close) {
  const ov = $('#sheetov'), sh = $('#sheet');
  if (onClose) onClose();
  sh.innerHTML = html;
  sh.scrollTop = 0;
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
};

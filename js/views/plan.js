// Редактор программы: подходы, повторы, порядок, добавить/убрать, свои упражнения, дни.
// Добавлять можно только упражнения на тренажёрах твоего зала.
import {$, toast, openSheet, closeSheet, ICON, sheetHead, fadeRows, textForm} from '../ui.js';
import {state, updDB} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import {esc, plural} from '../format.js';
import {EQUIP, hasPhoto} from '../data/equipment.js';

let ph = 'p1', wo = 'А', after = () => {};
export const onPlanClose = fn => {after = fn;};
const DAY_MAX = 20, SEARCH_MS = 100;

const thumb = e => hasPhoto(e.img) ? `<img src="img/${e.img}.jpg" alt="">` : '<span class="noph"></span>';

export function openPlan(phase, w) {
  ph = phase; wo = w;
  openSheet('', sh => draw(sh), () => after());
}

function apply(fn) {
  try {updDB(fn);} catch (e) {toast(e.message); return false;}
  return true;
}

function draw(sh) {
  const db = state.db, keys = P.woKeys(db, ph);
  if (!keys.includes(wo)) wo = keys[0];
  const items = P.itemsOf(db, ph, wo);
  const firstCore = items.findIndex(it => it.blk === 'core');
  sh.innerHTML = `${sheetHead('Программа')}<div class="sc">
  <p class="hint2 lead">Изменения сразу попадут в тренировки. История и рекорды не трогаются.</p>
  <div class="seg" id="pph">${P.PHASES.map(p => `<button class="${p === ph ? 'on' : ''}" data-p="${p}">${esc(P.phaseOf(db, p).label)}</button>`).join('')}</div>
  <div class="wosr"><div class="wos">${keys.map(k => `<button class="${k === wo ? 'on' : ''}" data-w="${esc(k)}">${esc(k)}</button>`).join('')}</div><button class="iconbtn" id="dadd" aria-label="Новый день">${ICON.plus}</button></div>
  <div class="dayops"><button class="textbtn inl" id="dren">Переименовать «${esc(wo)}»</button></div>
  <div class="plist">${items.map((it, i) => {const e = P.exOf(db, it.id), core = it.blk === 'core'; return `${i === firstCore ? '<div class="pgrp">Пресс<small>одно упражнение в конце</small></div>' : ''}<div class="pi" data-i="${i}">${thumb(e)}<div class="t">${core && P.ROLE[e.cr] ? `<small class="role">${P.ROLE[e.cr]}</small>` : ''}<b>${esc(e.n)}</b><small>${esc(EQUIP[e.img]?.n || '')}</small>
    <div class="pc">${e.t === 'c' ? '' : `<div class="mini"><button data-a="sm" aria-label="Меньше подходов">−</button><b class="n">${it.s}</b><button data-a="sp" aria-label="Больше подходов">+</button></div><span class="x">×</span>`}
    <label class="rp"><input value="${esc(it.r)}" data-a="r" aria-label="Повторы" maxlength="12"><span>${e.t === 't' ? 'сек' : e.t === 'c' ? 'мин' : 'повт'}</span></label>
    <div class="pa"><button data-a="up" aria-label="Выше"${i ? '' : ' disabled'}>${ICON.up}</button><button data-a="dn" aria-label="Ниже"${i < items.length - 1 ? '' : ' disabled'}>${ICON.down}</button></div></div></div>
    <button class="prm" data-a="rm" aria-label="Убрать «${esc(e.n)}»">${ICON.x}</button></div>`;}).join('')}</div>
  <button class="btn s2" id="padd">+ Добавить упражнение</button>
  <button class="btn s2" id="pown">+ Своё упражнение</button>
  <div class="sheet-foot">${keys.length > 1 ? `<button class="textbtn danger" id="ddel">Удалить день «${esc(wo)}»</button>` : ''}${db.plan ? '<button class="textbtn" id="preset">Вернуть исходную программу</button>' : ''}</div></div>`;
  fadeRows(sh);
  sh.querySelectorAll('#pph [data-p]').forEach(b => b.onclick = () => {ph = b.dataset.p; draw(sh);});
  sh.querySelectorAll('.wos [data-w]').forEach(b => b.onclick = () => {wo = b.dataset.w; draw(sh);});
  sh.querySelector('#dadd').onclick = () => textForm(sh, {title: 'Новый день', label: 'Название', placeholder: 'Например: Ягодицы', cta: 'Добавить', maxlength: DAY_MAX}, {
    back: () => draw(sh),
    ok: v => {updDB(d => P.addDay(d, v)); wo = v.trim().slice(0, DAY_MAX); draw(sh);},
  });
  sh.querySelector('#dren').onclick = () => textForm(sh, {title: 'Название дня', label: 'Название', value: wo, maxlength: DAY_MAX}, {
    back: () => draw(sh),
    ok: v => {updDB(d => P.renameDay(d, wo, v)); wo = v.trim().slice(0, DAY_MAX); draw(sh);},
  });
  const dd = sh.querySelector('#ddel'); if (dd) dd.onclick = () => {if (confirm(`Удалить день «${wo}» из программы во всех этапах? История останется.`) && apply(d => P.removeDay(d, wo))) {wo = P.woKeys(state.db, ph)[0]; draw(sh);}};
  sh.querySelector('.plist').onclick = ev => {
    const b = ev.target.closest('[data-a]'); if (!b || b.dataset.a === 'r') return;
    const i = +b.closest('.pi').dataset.i, it = items[i], a = b.dataset.a;
    if (a === 'sm' || a === 'sp') apply(d => P.setItem(d, ph, wo, i, {s: Math.min(10, Math.max(1, it.s + (a === 'sp' ? 1 : -1)))}));
    if (a === 'up' || a === 'dn') apply(d => P.moveItem(d, ph, wo, i, a === 'up' ? -1 : 1));
    if (a === 'rm' && confirm(`Убрать «${P.exOf(state.db, it.id).n}» из тренировки ${wo}? Уже отмеченные сегодня подходы сохранятся.`)) apply(d => P.removeItem(d, ph, wo, i));
    draw(sh);
  };
  sh.querySelector('.plist').onchange = ev => {
    const inp = ev.target; if (inp.dataset.a !== 'r') return;
    const i = +inp.closest('.pi').dataset.i, v = inp.value.trim().replace(/-/g, '–');
    if (!/\d/.test(v) && v !== 'макс') {toast('Повторы: число или диапазон, например 8–10'); draw(sh); return;}
    apply(d => P.setItem(d, ph, wo, i, {r: v}));
  };
  sh.querySelector('#padd').onclick = () => {pq = ''; pg = ''; picker(sh);};
  sh.querySelector('#pown').onclick = () => ownForm(sh);
  const rs = sh.querySelector('#preset');
  if (rs) rs.onclick = () => {if (confirm('Вернуть исходную программу? Твои правки программы пропадут, история останется.')) {apply(P.resetPlan); draw(sh); toast('Программа как в начале');}};
}

// Короткие подписи групп для ряда фильтров (P.GROUP_SHORT); полные названия остаются в строках и в «Своём упражнении».
const SHORT = P.GROUP_SHORT;
const EMPTY_HINT = 'Ничего не нашлось.<br><small>Попробуй: ягодицы, спина, гантели</small>';

let pq = '', pg = '', pqT = 0;
// Шапка, поиск и фильтры рисуются один раз; по вводу перерисовывается только список результатов.
function picker(sh) {
  const db = state.db, all = P.allEx(db);
  const n = P.pickerGroups(db).reduce((a, g) => a + g.items.length, 0);
  sh.innerHTML = `${sheetHead(`Добавить в «${esc(wo)}»`, '', `${n} ${plural(n, 'упражнение', 'упражнения', 'упражнений')} на оборудовании твоего зала`)}<div class="sc">
  <div class="srch"><input id="pq" class="inp" type="search" placeholder="Поиск: жим, ягодицы, гантели…" value="${esc(pq)}" autocomplete="off"><button type="button" class="x" id="pqx" aria-label="Очистить"${pq ? '' : ' hidden'}>${ICON.x}</button></div>
  <div class="chipsel pgf" id="pgf"><button type="button" class="${pg ? '' : 'on'}" data-g="">Все</button>${Object.keys(P.GROUPS).map(k => `<button type="button" class="${pg === k ? 'on' : ''}" data-g="${k}">${esc(SHORT[k] || P.GROUPS[k])}</button>`).join('')}</div>
  <div id="pkres"></div>
  <button class="btn s2" id="pback">Назад</button></div>`;
  sh.scrollTop = 0;
  const results = () => {
    const inWo = P.itemsOf(db, ph, wo).map(x => x.id), q = pq.trim().toLowerCase();
    const match = id => (!pg || all[id].g === pg) && P.matchQuery(all[id], q);
    const groups = P.pickerGroups(db).map(g => ({...g, items: g.items.filter(match)})).filter(g => g.items.length);
    const box = sh.querySelector('#pkres');
    box.innerHTML = groups.map(g => `<div class="pg"><div class="pgh">${hasPhoto(g.eq) ? `<img src="img/${g.eq}.jpg" alt="">` : '<span class="noph"></span>'}<b>${esc(EQUIP[g.eq].n)}</b></div>
      ${g.items.map(id => {const lt = L.loadTxt(all[id]); return `<button class="pk" data-id="${esc(id)}" ${inWo.includes(id) ? 'disabled' : ''}><b>${esc(all[id].n)}</b><small>${esc(P.GROUPS[all[id].g] || '')}${lt ? ' · ' + lt : ''}${inWo.includes(id) ? ' · уже есть' : ''}</small></button>`;}).join('')}</div>`).join('') || `<p class="empty">${EMPTY_HINT}</p>`;
    box.querySelectorAll('.pk[data-id]').forEach(b => b.onclick = () => {if (apply(d => P.addItem(d, ph, wo, b.dataset.id))) {toast('Добавлено'); draw(sh);}});
  };
  results();
  fadeRows(sh);
  const q = sh.querySelector('#pq'), x = sh.querySelector('#pqx');
  q.oninput = () => {pq = q.value; x.hidden = !pq; clearTimeout(pqT); pqT = setTimeout(results, SEARCH_MS);};
  x.onclick = () => {pq = ''; q.value = ''; x.hidden = true; results(); q.focus();};
  sh.querySelectorAll('#pgf [data-g]').forEach(b => b.onclick = () => {pg = b.dataset.g; sh.querySelectorAll('#pgf button').forEach(c => c.classList.toggle('on', c === b)); results();});
  sh.querySelector('#pback').onclick = () => draw(sh);
}

function ownForm(sh) {
  sh.innerHTML = `${sheetHead('Своё упражнение')}<div class="sc"><p class="hint2 lead">Только на оборудовании твоего зала. Фото техники добавишь потом в «Технике».</p>
  <div class="form">
    <label>Название<input id="on" maxlength="40" placeholder="Например: Шраги в Смите"></label>
    <label>Тренажёр<select id="oe">${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}">${esc(v.n)}</option>`).join('')}</select></label>
    <label>Что записываем<select id="ot">${Object.entries(P.TYPES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <label>Группа мышц (для замен)<select id="og">${Object.entries(P.GROUPS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  </div>
  <button class="btn" id="osave">Создать и добавить в «${esc(wo)}»</button>
  <button class="btn s2" id="oback">Назад</button></div>`;
  sh.scrollTop = 0;
  sh.querySelector('#oback').onclick = () => draw(sh);
  sh.querySelector('#osave').onclick = () => {
    try {
      const {db, id} = P.addCustom(state.db, {n: $('#on').value, img: $('#oe').value, t: $('#ot').value, g: $('#og').value});
      updDB(() => P.addItem(db, ph, wo, id));
      toast('Создано'); draw(sh);
    } catch (e) {toast(e.message);}
  };
}

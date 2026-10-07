// Редактор программы: подходы, повторы, порядок, добавить/убрать, свои упражнения.
// Добавлять можно только упражнения на тренажёрах твоего зала.
import {$, toast, openSheet, closeSheet, ICON, sheetHead, fadeRows} from '../ui.js';
import {state, updDB} from '../store.js';
import * as P from '../program.js';
import {esc} from '../format.js';
import {EQUIP, hasPhoto} from '../data/equipment.js';

let ph = 'p1', wo = 'А', after = () => {};
export const onPlanClose = fn => {after = fn;};

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
  <div class="wos">${keys.map(k => `<button class="${k === wo ? 'on' : ''}" data-w="${esc(k)}">${esc(k)}</button>`).join('')}<button class="edit" id="dadd">+ День</button></div>
  <div class="dayops"><button class="lnk" id="dren">Переименовать «${esc(wo)}»</button>${keys.length > 1 ? `<button class="lnk danger" id="ddel">Удалить день</button>` : ''}</div>
  <div class="plist">${items.map((it, i) => {const e = P.exOf(db, it.id), core = it.blk === 'core'; return `${i === firstCore ? '<div class="pgrp">Пресс · круг<small>подряд без отдыха</small></div>' : ''}<div class="pi" data-i="${i}">${thumb(e)}<div class="t">${core && P.ROLE[e.cr] ? `<small class="role">${P.ROLE[e.cr]}</small>` : ''}<b>${esc(e.n)}</b><small>${esc(EQUIP[e.img]?.n || '')}</small>
    <div class="pc">${e.t === 'c' ? '' : `<div class="mini"><button data-a="sm" aria-label="Меньше подходов">−</button><b class="n">${it.s}</b><button data-a="sp" aria-label="Больше подходов">+</button></div><span class="x">×</span>`}
    <label class="rp"><input value="${esc(it.r)}" data-a="r" aria-label="Повторы" maxlength="12"><span>${e.t === 't' ? 'сек' : e.t === 'c' ? 'мин' : 'повт'}</span></label>
    <div class="pa"><button data-a="up" aria-label="Выше"${i ? '' : ' disabled'}>${ICON.up}</button><button data-a="dn" aria-label="Ниже"${i < items.length - 1 ? '' : ' disabled'}>${ICON.down}</button></div></div></div>
    <button class="prm" data-a="rm" aria-label="Убрать «${esc(e.n)}»">${ICON.x}</button></div>`;}).join('')}</div>
  <button class="btn s2" style="margin-top:12px" id="padd">+ Добавить упражнение</button>
  <button class="btn s2" style="margin-top:8px" id="pown">+ Своё упражнение</button>
  ${db.plan ? '<button class="textbtn" id="preset">Вернуть исходную программу</button>' : ''}</div>`;
  fadeRows(sh);
  sh.querySelectorAll('#pph [data-p]').forEach(b => b.onclick = () => {ph = b.dataset.p; draw(sh);});
  sh.querySelectorAll('.wos [data-w]').forEach(b => b.onclick = () => {wo = b.dataset.w; draw(sh);});
  sh.querySelector('#dadd').onclick = () => {const n = prompt('Название нового дня (например: Ягодицы)'); if (n === null) return; if (apply(d => P.addDay(d, n))) {wo = n.trim().slice(0, 20); draw(sh);}};
  sh.querySelector('#dren').onclick = () => {const n = prompt('Новое название дня', wo); if (n === null) return; if (apply(d => P.renameDay(d, wo, n))) {wo = n.trim().slice(0, 20); draw(sh);}};
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
  sh.querySelector('#padd').onclick = () => picker(sh);
  sh.querySelector('#pown').onclick = () => ownForm(sh);
  const rs = sh.querySelector('#preset');
  if (rs) rs.onclick = () => {if (confirm('Вернуть исходную программу? Твои правки программы пропадут, история останется.')) {apply(P.resetPlan); draw(sh); toast('Программа как в начале');}};
}

let pq = '', pg = '';
function picker(sh) {
  const db = state.db, inWo = P.itemsOf(db, ph, wo).map(x => x.id), all = P.allEx(db);
  const match = id => (!pg || all[id].g === pg) && (!pq || all[id].n.toLowerCase().includes(pq.toLowerCase()));
  const groups = P.pickerGroups(db).map(g => ({...g, items: g.items.filter(match)})).filter(g => g.items.length);
  const n = groups.reduce((a, g) => a + g.items.length, 0);
  sh.innerHTML = `${sheetHead(`Добавить в «${esc(wo)}»`, '', `${n} упражнений на оборудовании твоего зала`)}<div class="sc">
  <div class="form"><input id="pq" type="search" placeholder="Поиск: жим, ягодичный, канат…" value="${esc(pq)}"></div>
  <div class="chipsel pgf" id="pgf"><button type="button" class="${pg ? '' : 'on'}" data-g="">Все</button>${Object.entries(P.GROUPS).map(([k, v]) => `<button type="button" class="${pg === k ? 'on' : ''}" data-g="${k}">${esc(v)}</button>`).join('')}</div>
  ${groups.map(g => `<div class="pg"><div class="pgh">${hasPhoto(g.eq) ? `<img src="img/${g.eq}.jpg" alt="">` : '<span class="noph"></span>'}<b>${esc(EQUIP[g.eq].n)}</b></div>
    ${g.items.map(id => `<button class="pk" data-id="${esc(id)}" ${inWo.includes(id) ? 'disabled' : ''}><b>${esc(all[id].n)}</b><small>${esc(P.GROUPS[all[id].g] || '')}${loadTxt(all[id])}${inWo.includes(id) ? ' · уже есть' : ''}</small></button>`).join('')}</div>`).join('') || '<p class="empty">Ничего не нашлось.</p>'}
  <button class="btn s2" style="margin-top:14px" id="pback">Назад</button></div>`;
  sh.querySelector('#pq').oninput = e => {pq = e.target.value; const pos = e.target.selectionStart; picker(sh); const i = sh.querySelector('#pq'); i.focus(); i.setSelectionRange(pos, pos);};
  sh.querySelectorAll('#pgf [data-g]').forEach(b => b.onclick = () => {pg = b.dataset.g; picker(sh);});
  sh.querySelectorAll('.pk[data-id]').forEach(b => b.onclick = () => {if (apply(d => P.addItem(d, ph, wo, b.dataset.id))) {toast('Добавлено'); draw(sh);}});
  sh.querySelector('#pback').onclick = () => draw(sh);
}
const JS = {knee: 'колени', back: 'спина', shoulder: 'плечи', elbow: 'локти', wrist: 'запястья', neck: 'шея', hip: 'таз', ankle: 'голеностоп'};
// Какие суставы сильно нагружает — видно сразу при выборе.
const loadTxt = e => {const hi = Object.entries(e.load || {}).filter(([, v]) => v >= 2).map(([j]) => JS[j]); return hi.length ? ' · нагрузка: ' + hi.join(', ') : '';};

function ownForm(sh) {
  sh.innerHTML = `${sheetHead('Своё упражнение')}<div class="sc"><p class="hint2 lead">Только на оборудовании твоего зала. Фото техники добавишь потом в «Технике».</p>
  <div class="form">
    <label>Название<input id="on" maxlength="40" placeholder="Например: Шраги в Смите"></label>
    <label>Тренажёр<select id="oe">${Object.entries(EQUIP).map(([k, v]) => `<option value="${k}">${esc(v.n)}</option>`).join('')}</select></label>
    <label>Что записываем<select id="ot">${Object.entries(P.TYPES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
    <label>Группа мышц (для замен)<select id="og">${Object.entries(P.GROUPS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  </div>
  <button class="btn" style="margin-top:16px" id="osave">Создать и добавить в «${esc(wo)}»</button>
  <button class="btn s2" style="margin-top:8px" id="oback">Назад</button></div>`;
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

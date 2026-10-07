// Экран «Тренировка»: карточки упражнений, подходы, разминка, круг пресса, таймер.
import {$, $$, toast, dismissToast, CK, ICON, openSheet, closeSheet, sheetHead, fadeRows} from '../ui.js';
import {state, draft, updDB, dropDraft} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import * as WK from '../workout.js';
import {esc, fmtT, fmtD, fmtN, ruDec, plural} from '../format.js';
import {unlockAudio, haptic, keepAwake} from '../platform.js';
import {startRest, stopRest} from '../timer.js';
import {openTech, openSwap, openNote} from './sheets.js';
import {finish, saveStale} from './finish.js';
import {EQUIP, hasPhoto} from '../data/equipment.js';
import {ownCover} from './covers.js';

const UNIT_S = {w: 'повт', r: 'повт', t: 'сек', c: 'мин'};
const RIR_TXT = {p1: '3 повтора в запасе', p2: '1–2 повтора в запасе', p3: '1 повтор в запасе'};
const KNEE_HINT = {none: 'Отметь, даже если 0.', set: '0 — ничего не чувствую. Выше 3 — вес на ноги не повышаем.'};
let open = {}, lastTap = 0;
const DOUBLE_TAP_MS = 600, DONE_TOAST_MS = 1500;
const isCore = it => it.blk === 'core';
const slotOf = it => it.orig || it.id;

export function renderTrain() {
  const db = state.db, ph = P.phaseOf(db, db.phase), keys = P.woKeys(db, db.phase);
  if (!ph.w[db.wo]) updDB(d => ({...d, wo: keys[0]}));
  const k = WK.curKey(), c = draft(k), items = WK.itemsFor(k), live = WK.activeKey();
  open = {};
  let h = `<div class="pt"><button class="ptb" id="phbtn" aria-haspopup="dialog">Этап ${db.phase.slice(1)} · ${esc(ph.label)}${ICON.down}</button><h1>Тренировка ${esc(db.wo)}</h1></div>`;
  if (c.start && WK.isStale(c)) h += `<div class="switch"><b>Тренировка от ${fmtD(c.last)} не завершена</b>Сохрани её той датой — или начни заново.<div class="g2" style="margin-top:12px"><button class="btn" id="t-stsave">Сохранить</button><button class="btn s2" id="t-stdrop">Начать заново</button></div></div>`;
  h += `<div class="wosr"><div class="wos" id="wos">${keys.map(w => `<button class="${w === db.wo ? 'on' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
    <button class="iconbtn" id="goplan" aria-label="Программа">${ICON.list}</button></div>
  <div class="session" id="session"></div>
  <div id="list">${listHtml(items)}</div>
  ${items.length ? '' : '<p class="empty">В этой тренировке нет упражнений — добавь их в «Программе».</p>'}
  ${WK.kneeTracked() ? `<div class="card kneec" id="kneec">${kneeHtml(c.knee)}</div>` : ''}
  <button class="btn" id="finish" style="margin-top:24px">Завершить тренировку</button>
  <button class="textbtn" id="reset">Сбросить отметки</button>`;
  $('#v-train').innerHTML = h;
  fadeRows($('#v-train'));
  items.filter(it => !isCore(it)).forEach(it => renderCard(it));
  renderCirc();
  updSession();
  bindTrain(k, live);
  if (live === k) keepAwake(true);
}

// Обычные упражнения — карточками; подряд идущие упражнения пресса — одним кругом.
function listHtml(items) {
  let circ = false;
  return items.map(it => {
    if (!isCore(it)) return `<div class="ex" id="ex-${esc(slotOf(it))}" data-slot="${esc(slotOf(it))}"></div>`;
    if (circ) return '';
    circ = true;
    return '<section class="circ" id="circ"></section>';
  }).join('');
}

const kneeHtml = v => {
  const none = v === null || v === undefined;
  return `<div class="h"><span>Колени сегодня</span><b class="n${none ? ' none' : ''}" id="kneev">${none ? 'не отмечено' : v}</b></div>
  <small>${none ? KNEE_HINT.none : KNEE_HINT.set}</small>
  <div class="knees" id="knee" role="group" aria-label="Боль в коленях">${Array.from({length: 11}, (_, i) => `<button class="${v === i ? 'on' : ''}" data-v="${i}">${i}</button>`).join('')}</div>`;
};

function bindTrain(k, live) {
  const guard = () => WK.activeKey() !== k || confirm('Идёт тренировка — переключиться? Отметки сохранятся.');
  $('#phbtn').onclick = () => openPhase(guard);
  $$('#wos [data-w]').forEach(b => b.onclick = () => {if (b.dataset.w === state.db.wo || !guard()) return; updDB(d => ({...d, wo: b.dataset.w})); renderTrain();});
  $('#goplan').onclick = () => import('./plan.js').then(m => m.openPlan(state.db.phase, state.db.wo));
  if ($('#kneec')) $('#kneec').onclick = e => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    WK.setKnee(k, +b.dataset.v);
    haptic(5);
    $('#kneec').innerHTML = kneeHtml(+b.dataset.v);
  };
  $('#finish').onclick = () => finish(k);
  $('#reset').onclick = () => {if (confirm('Сбросить все отметки этой тренировки?')) {dropDraft(k); stopRest(); keepAwake(false); renderTrain(); updDot();}};
  const ss = $('#t-stsave'); if (ss) ss.onclick = () => saveStale(k, () => {renderTrain(); updDot();});
  const sd = $('#t-stdrop'); if (sd) sd.onclick = () => {if (confirm('Удалить незавершённую тренировку?')) {dropDraft(k); renderTrain(); updDot();}};
  const list = $('#list');
  list.onclick = onTap;
  list.oninput = onInput;
}

// Шторка «Этап»: какой этап программы сейчас идёт.
function openPhase(guard) {
  const db = state.db, cur = P.phaseOf(db, db.phase);
  openSheet(`${sheetHead('Этап')}<div class="sc"><div class="glist">${P.PHASES.map(p => {const x = P.phaseOf(db, p); return `<button class="gl-row${p === db.phase ? ' on' : ''}" data-p="${p}"><span class="t"><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></span>${p === db.phase ? CK : '<span></span>'}</button>`;}).join('')}</div>
    ${cur.hint ? `<div class="tb2"><p>${esc(cur.hint)}</p></div>` : ''}</div>`, sh => {
    sh.querySelectorAll('[data-p]').forEach(b => b.onclick = () => {
      if (b.dataset.p === state.db.phase) {closeSheet(); return;}
      if (!guard()) return;
      updDB(d => ({...d, phase: b.dataset.p, wo: P.woKeys(d, b.dataset.p)[0]}));
      closeSheet(); renderTrain();
    });
  });
}

export function updDot() {$('#livedot').classList.toggle('lv', !!WK.activeKey());}

function updSession() {
  const k = WK.curKey(), c = draft(k), {done, total} = WK.progressOf(k), items = WK.itemsFor(k), sk = c.skip, cur = curItem(k);
  const est = Math.round(items.reduce((a, it) => a + (P.exOf(state.db, it.id).t === 'c' ? +it.r || 10 : it.s * 2.5), 0) / 5) * 5;
  const segs = items.map(it => {
    const rows = WK.rowsFor(k, it), f = sk[it.id] ? 1 : rows.filter(x => x.done).length / (rows.length || 1);
    return `<i class="${cur && slotOf(cur) === slotOf(it) ? 'cur' : ''}" style="--f:${f.toFixed(3)}"></i>`;
  }).join('');
  $('#session').innerHTML = `<div class="r1"><span><b class="n">${done}</b> из ${total} подходов</span>${c.start ? `<span class="el n" id="elapsed">${fmtT((Date.now() - c.start) / 1000)}</span>` : `<span>≈ ${est} мин</span>`}</div><div class="segs" aria-hidden="true">${segs}</div>`;
}
export function tickElapsed() {
  const c = draft(WK.curKey()), el = $('#elapsed');
  if (el && c.start) el.textContent = fmtT((Date.now() - c.start) / 1000);
}

const itemBySlot = slot => WK.itemsFor(WK.curKey()).find(x => slotOf(x) === slot);
const idxOf = slot => WK.itemsFor(WK.curKey()).findIndex(x => slotOf(x) === slot);

function photoFor(id, e) {
  if (hasPhoto(e.img)) return `img/${e.img}.jpg`;
  return ownCover(id);
}

const toolsHtml = skip => `<div class="tools"><button data-act="tech">${ICON.info}Техника</button><button data-act="swap">${ICON.swap}Заменить</button><button data-act="note">${ICON.note}Заметка</button><button data-act="skip">${ICON.skip}${skip ? 'Вернуть' : 'Пропустить'}</button></div>`;
const CS_TOOLS = [['tech', 'info', 'Техника'], ['swap', 'swap', 'Заменить'], ['note', 'note', 'Заметка'], ['skip', 'skip', 'Пропустить']];
const csToolsHtml = () => `<div class="cs-tools">${CS_TOOLS.map(([a, ic, t]) => `<button data-act="${a}" aria-label="${t}" title="${t}">${ICON[ic]}</button>`).join('')}</div>`;
const swpHtml = (db, it) => it.orig ? `<div class="swp">вместо «${esc(P.exOf(db, it.orig).n)}» · <button data-act="unswap">вернуть</button></div>` : '';
const noteBtn = note => note ? `<button class="mynote" data-act="note">${ICON.note}${esc(note)}</button>` : '';

function renderCard(it, justK) {
  if (isCore(it)) return renderCirc(slotOf(it), justK);
  const k = WK.curKey(), db = state.db, e = P.exOf(db, it.id), slot = slotOf(it), c = draft(k);
  const el = $('#ex-' + CSS.escape(slot));
  if (!el) return;
  const rows = WK.rowsFor(k, it), A = WK.aimFor(k, it), Ls = L.lastFor(db.sessions, it.id), skip = !!c.skip[it.id];
  const all = !skip && rows.every(x => x.done), nx = rows.findIndex(x => !x.done), ok = open[slot] ?? nx;
  const tlab = e.t === 'c' ? esc(it.r) + ' мин' : e.t === 't' ? it.s + ' × ' + esc(it.r) + ' с' : it.s + ' × ' + esc(it.r) + ' повт';
  const best = Ls && e.t === 'w' ? L.bestSet('w', db.sessions.flatMap(s => s.entries[it.id] || [])) : null;
  const pic = photoFor(it.id, e), note = P.noteOf(db, it.id);
  el.className = 'ex' + (pic ? '' : ' noimg') + (all ? ' all' : '') + (skip ? ' skip' : '');
  let h = `${pic ? `<div class="exp"><img src="${pic}" alt="" loading="lazy"></div>` : ''}
  <div class="exh"><div class="no">${idxOf(slot) + 1} из ${WK.itemsFor(k).length}</div>
   <h3>${esc(e.n)}${e.knee ? '<span class="kn">колени</span>' : ''}<span class="okb">✓ Готово</span></h3>
   <div class="tg">${tlab}${best ? ' · рекорд ' + fmtN(best.a) + '×' + best.b : ''}</div>
   ${swpHtml(db, it)}</div>
  ${toolsHtml(skip)}`;
  if (skip) {el.innerHTML = h + '<p class="skipped">Пропущено сегодня</p>'; return;}
  h += noteBtn(note);
  if (A) h += `<div class="aimrow ${A.up ? 'up' : A.down ? 'down' : ''}"><span>${A.up ? '↑ Пора добавить' : A.down ? '↓ Сегодня легче' : 'Цель'}</span><b class="n">${esc(ruDec(A.txt))}</b>${A.why ? `<small>${esc(A.why)}</small>` : ''}</div>`;
  else if (e.t === 'w') h += `<div class="aimrow first"><span>Первый раз</span><b>Подбери вес: ${RIR_TXT[db.phase] || RIR_TXT.p2}</b></div>`;
  if (it.n) h += `<div class="note">${esc(it.n)}</div>`;
  const rm = ok >= 0 && rows[ok] && !rows[ok].done && rows.length > 1;
  h += `<div class="sets">${warmHtml(k, it, e, rows)}${setHead(Ls)}${rows.map((x, j) => j === ok ? rowOpen(e, x, j, j === nx, j === justK, Ls) : rowShut(e, x, j, j === justK, Ls)).join('')}
  ${setActs(e, rm, ok)}</div>`;
  el.innerHTML = h;
}

const setHead = Ls => `<div class="seth"><span></span><span><em>${Ls ? 'Прошлый · ' + fmtD(Ls.date) : ''}</em><em>Сегодня</em></span><span></span></div>`;
function setActs(e, rm, ok) {
  const add = e.t !== 'c' ? '<button class="addset" data-act="add">+ Ещё подход</button>' : '';
  const del = rm ? `<button class="rmset" data-act="del" data-k="${ok}">Убрать подход</button>` : '';
  return add || del ? `<div class="setacts">${add || '<span></span>'}${del}</div>` : '';
}

function setStr(t, e) {return e.map(x => t === 'w' ? `${fmtN(x.a)}×${x.b}` : `${x.b}${t === 't' ? ' с' : t === 'c' ? ' мин' : ''}`).join(', ');}
const valStr = (e, x) => e.t === 'w' ? `${x.a === '' ? '—' : fmtN(x.a)} кг × ${x.b === '' ? '—' : x.b}` : `${x.b === '' ? '—' : x.b} ${e.t === 't' ? 'с' : e.t === 'c' ? 'мин' : 'повт'}`;
const prevStr = (e, Ls, j) => {const p = Ls && (Ls.e[j] || null); return p ? (e.t === 'w' ? `${fmtN(p.a)}×${p.b}` : String(p.b)) : '';};

function rowShut(e, x, j, just, Ls) {
  return `<div class="set c ${x.done ? 'done' : ''} ${just ? 'just' : ''}" data-k="${j}"><span class="si">${j + 1}</span>
  <button class="sv" data-act="open"><b class="n">${valStr(e, x)}</b><small class="n">${prevStr(e, Ls, j)}</small></button>
  <button class="ck" data-act="${x.done ? 'open' : 'ck'}" aria-label="Подход ${j + 1} ${x.done ? 'выполнен' : 'отметить'}">${CK}</button></div>`;
}
function rowOpen(e, x, j, isNext, just, Ls, label = `подход ${j + 1}`) {
  const tg = f => !x.done && !(f === 'w' ? x.edA : x.edB) ? ' tgt' : '';
  const stp = (f, val, unit, mode, ph) => `<div class="stp"><button data-act="${f}m" aria-label="Меньше">−</button><label><input class="n${tg(f)}" inputmode="${mode}" data-f="${f === 'w' ? 'a' : 'b'}" value="${esc(ruDec(val))}" placeholder="${ph}" aria-label="${unit}, ${label}"><span>${unit}</span></label><button data-act="${f}p" aria-label="Больше">+</button></div>`;
  const was = prevStr(e, Ls, j);
  return `<div class="set x ${x.done ? 'done' : ''} ${isNext ? 'nx' : ''} ${just ? 'just' : ''}" data-k="${j}"><span class="si">${j + 1}</span>
  <div class="ins">${e.t === 'w' ? stp('w', x.a, 'кг', 'decimal', 'вес') : ''}${stp('r', x.b, UNIT_S[e.t], 'numeric', '—')}
  ${was ? `<small class="was n">было ${was}</small>` : ''}</div>
  <div class="side"><button class="ck big" data-act="ck" aria-pressed="${x.done}" aria-label="${label[0].toUpperCase() + label.slice(1)} выполнен">${CK}</button></div></div>`;
}

function warmHtml(k, it, e, rows) {
  const sk = draft(k).skip, plan = L.warmPlan(WK.itemsFor(k).filter(x => !sk[x.id]), id => P.exOf(state.db, id));
  if (!plan[it.id]) return '';
  const w = +(rows[0] && rows[0].a) || 0, sets = L.warmups(w, P.stepOf(state.db, it.id), plan[it.id] === 'full', EQUIP[e.img]?.min || 0);
  if (!sets.length) return '';
  const done = draft(k).warm[it.id] || [];
  if (rows.some(x => x.done) && !done.some(Boolean)) return '';
  return `<div class="seth wuh"><span></span><span>Разминка</span><span></span></div>` + sets.map((s, j) => `<div class="set c wu ${done[j] ? 'done' : ''}"><span class="si" aria-hidden="true"></span>
    <span class="sv"><b class="n">${fmtN(s.a)} кг × ${s.b}</b></span>
    <button class="ck" data-act="warm" data-w="${j}" aria-label="Разминка ${j + 1} ${done[j] ? 'выполнена' : 'отметить'}">${CK}</button></div>`).join('');
}

// ---- круг пресса: один блок, станции по порядку, один ✓ на станцию в текущем круге ----
function coreItems(k) {return WK.itemsFor(k).filter(isCore);}

function renderCirc(justSlot, justK) {
  const el = $('#circ');
  if (!el) return;
  const k = WK.curKey(), db = state.db, c = draft(k), its = coreItems(k);
  const st = its.map(it => ({it, e: P.exOf(db, it.id), rows: WK.rowsFor(k, it), skip: !!c.skip[it.id]}));
  const {rounds, round, cur} = WK.circuitState(st);
  const last = its[its.length - 1], [ph] = WK.splitKey(k), rest = last ? WK.restFor(last, ph) : 0, all = cur === -1;
  const pills = Array.from({length: rounds}, (_, r) => `<i class="${all || r < round ? 'd' : r === round ? 'c' : ''}"></i>`).join('');
  el.className = 'circ' + (all ? ' all' : '');
  let h = `<header class="circ-h"><span class="circ-ic">${ICON.core}</span>
    <div class="circ-t"><b>Пресс</b><small>Подряд без отдыха${rest ? ` · ${rest} с после круга` : ''}</small></div>
    <div class="circ-r"><span class="n">${all ? 'Готово' : `Круг ${round + 1} из ${rounds}`}</span><span class="pills">${pills}</span></div></header>`;
  const doneRounds = Math.min(round, rounds);
  if (doneRounds) {
    h += `<div class="circ-done">${Array.from({length: doneRounds}, (_, r) => `<div class="cr"><span class="crk">${CK}Круг ${r + 1}</span><span class="crv">${st.filter(s => !s.skip && s.rows[r]).map(s => `<button class="n" data-act="open" data-slot="${esc(slotOf(s.it))}" data-k="${r}">${valStr(s.e, s.rows[r])}</button>`).join('')}</span></div>`).join('')}</div>`;
  }
  h += `<ol class="circ-st">${st.map((s, i) => stationHtml(s, i, {round, cur, all}, justSlot, justK)).join('')}`;
  if (!all) h += `<li class="cs-rest"><span class="node">${ICON.clock}</span>${round < rounds - 1 ? `Отдых ${rest} с → круг ${round + 2}` : 'Последний круг'}</li>`;
  el.innerHTML = h + '</ol>';
}

function stationHtml(s, i, {round, cur, all}, justSlot, justK) {
  const db = state.db, k = WK.curKey(), {it, e, rows, skip} = s, slot = slotOf(it), role = P.ROLE[e.cr] || '';
  const forced = open[slot], isCur = i === cur, j = forced ?? Math.min(round, rows.length - 1), x = rows[j];
  const isOpen = !skip && (isCur || forced !== undefined) && x;
  const done = !skip && !isCur && x && x.done;
  if (all && forced === undefined) return '';
  const cls = `ex inblk cs${done ? ' done' : ''}${isCur ? ' cur' : ''}${isOpen ? ' open' : ''}${skip ? ' skipst' : ''}`;
  const node = skip ? '–' : done ? CK : String(i + 1);
  const head = `<li class="${cls}" id="ex-${esc(slot)}" data-slot="${esc(slot)}"><span class="node">${node}</span>`;
  if (skip) return `${head}<div class="cs-hd"><small class="role">${esc(role)}</small><b class="nm">${esc(e.n)}</b></div><p class="cs-skip">Пропущено <button data-act="skip">Вернуть</button></p></li>`;
  if (!isOpen) {
    return `${head}<div class="set c${x.done ? ' done' : ''}${slot === justSlot && j === justK ? ' just' : ''}" data-k="${j}">
      <button class="sv" data-act="open" aria-label="${esc(e.n)}, круг ${j + 1}${x.done ? ' выполнен — изменить' : ''}"><small class="role">${esc(role)}</small><b class="nm">${esc(e.n)}</b><span class="tv n">${valStr(e, x)}</span></button>
      ${x.done ? '' : `<button class="ck" data-act="ck" aria-label="${esc(e.n)}, круг ${j + 1} отметить">${CK}</button>`}</div></li>`;
  }
  const Ls = L.lastFor(db.sessions, it.id), note = P.noteOf(db, it.id);
  return `${head}<div class="cs-hd"><small class="role">${esc(role)}${role ? ' · ' : ''}круг ${j + 1}</small><b class="nm">${esc(e.n)}</b>${swpHtml(db, it)}${noteBtn(note)}</div>
    <div class="sets">${rowOpen(e, x, j, isCur && !x.done, slot === justSlot && j === justK, Ls, `круг ${j + 1}`)}</div>
    ${csToolsHtml()}</li>`;
}

// ---- нажатия ----
function flushFocused() {
  const ae = document.activeElement;
  if (ae && ae.matches && ae.matches('#list input[data-f]')) onInput({target: ae});
}
function onInput(ev) {
  const inp = ev.target;
  if (inp.tagName !== 'INPUT' || !inp.dataset.f) return;
  const slot = inp.closest('[data-slot]').dataset.slot, it = itemBySlot(slot), j = +inp.closest('.set').dataset.k;
  const v = String(inp.value).replace(',', '.').trim();
  WK.editField(WK.curKey(), it, j, inp.dataset.f, v === '' || isNaN(+v) ? '' : +v);
  inp.classList.remove('tgt');
}

function onTap(ev) {
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  flushFocused();
  const card = b.closest('[data-slot]');
  if (!card) return;
  const slot = card.dataset.slot, it = itemBySlot(slot), k = WK.curKey(), act = b.dataset.act;
  if (!it) return;
  const e = P.exOf(state.db, it.id);
  if (act === 'tech') return openTech(it.id);
  if (act === 'note') return openNote(it.id, () => renderCard(itemBySlot(slot)));
  if (act === 'swap') return openSwap(k, it, () => {renderTrain();});
  if (act === 'unswap') {
    if ((draft(k).ex[it.id] || []).some(x => x.done) && !confirm(`Отмеченные подходы по «${e.n}» сбросятся. Вернуть по плану?`)) return;
    WK.swapEx(k, it.orig, it.orig); return renderTrain();
  }
  if (act === 'skip') {
    const on = !draft(k).skip[it.id];
    WK.setSkip(k, it.id, on); delete open[slot]; renderAll();
    if (on) toast('Пропущено', {label: 'Вернуть', run: () => {WK.setSkip(k, it.id, false); if (WK.curKey() === k && $('#v-train').classList.contains('on')) renderAll();}});
    return;
  }
  if (act === 'add') {WK.addSet(k, it); open[slot] = WK.rowsFor(k, it).length - 1; return rerender(it);}
  if (act === 'warm') return tapWarm(k, it, +b.dataset.w);
  const j = +(b.dataset.k ?? b.closest('.set').dataset.k), rows = WK.rowsFor(k, it), x = rows[j];
  if (!x) return;
  if (act === 'open') {open[slot] = j; return rerender(it);}
  if (act === 'del') {WK.removeSet(k, it, j); delete open[slot]; return rerender(it);}
  if (act === 'wm' || act === 'wp') {const st = P.stepOf(state.db, it.id), cur = +x.a || 0; WK.editField(k, it, j, 'a', Math.max(0, Math.round((cur + (act === 'wp' ? st : -st)) * 100) / 100)); haptic(5); return rerender(it, j);}
  if (act === 'rm' || act === 'rp') {const st = e.t === 't' ? 5 : 1, cur = +x.b || 0; WK.editField(k, it, j, 'b', Math.max(0, cur + (act === 'rp' ? st : -st))); haptic(5); return rerender(it, j);}
  if (act === 'ck') return tapCheck(k, it, j, x, e);
}

function rerender(it, keepOpen) {
  const slot = slotOf(it);
  if (keepOpen !== undefined) open[slot] = keepOpen;
  renderCard(itemBySlot(slot));
  updSession();
}

function tapCheck(k, it, j, x, e) {
  const now = Date.now();
  if (now - lastTap < DOUBLE_TAP_MS) return;
  lastTap = now;
  unlockAudio();
  if (!x.done) {
    if (x.b === '' || (e.t === 'w' && x.a === '')) {toast(e.t === 'w' ? 'Укажи вес и повторы' : 'Укажи значение'); return;}
    const Ls = L.lastFor(state.db.sessions, it.id), lw = Ls && e.t === 'w' ? Math.max(...Ls.e.map(r => +r.a || 0)) : null;
    const q = L.sanity(e.t, x, lw);
    if (q && !confirm(q)) return;
  }
  const slot = slotOf(it);
  if (!WK.markSet(k, it, j, !x.done, now)) {toast('Сначала сохрани или удали незавершённую тренировку вверху'); return;}
  delete open[slot];
  haptic(18);
  updDot();
  if (!x.done) {
    keepAwake(true);
    const rows = WK.rowsFor(k, it), allDone = rows.every(r => r.done);
    renderCard(itemBySlot(slot), j);
    updSession();
    const [ph] = WK.splitKey(k), rest = WK.restFor(it, ph), circ = WK.circuitNext(k, it);
    if (circ) {
      // круг: следующее упражнение круга; отдых только после последнего в раунде
      const name = P.exOf(state.db, circ.id).n;
      goTo(circ, 350, !it.ss);
      if (it.ss) {stopRest(); toast('Дальше без отдыха: ' + name);}
      else startRest(rest, 'Круг готов · далее: ' + name);
      return;
    }
    const nxt = nextUp(k, slot);
    if (allDone && nxt) {toast('✓ ' + (isCore(it) ? 'Пресс' : e.n) + ' — готово', null, DONE_TOAST_MS); goTo(nxt, 450);}
    else if (allDone) {dismissToast(); goFinish(450);}
    const label = allDone ? (nxt ? 'Далее: ' + P.exOf(state.db, nxt.id).n : 'Последнее упражнение позади') : `Далее: подход ${j + 2} · ${valStr(e, rows[j + 1] || x)}`;
    if (rest) startRest(allDone ? Math.min(rest, 90) : rest, label); else stopRest();
  } else rerender(it);
}

// Всё отмечено — сразу к кнопке «Завершить тренировку», без уведомления поверх неё.
function goFinish(delay) {
  setTimeout(() => {
    const b = $('#finish');
    if (b) b.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center'});
  }, delay);
}

function goTo(it, delay, toSet) {
  setTimeout(() => {
    const card = $('#ex-' + CSS.escape(slotOf(it)));
    const n = toSet && card ? card.querySelector('.set.nx') || card : card;
    if (n) n.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: n === card ? 'start' : 'center'});
  }, delay);
}

// Следующее незаконченное упражнение — ищем после текущего, затем с начала.
function nextUp(k, slot) {
  const items = WK.itemsFor(k), i = items.findIndex(x => slotOf(x) === slot);
  return [...items.slice(i + 1), ...items.slice(0, i)].find(x => !WK.exDone(k, x)) || null;
}

// Текущее упражнение: где был последний отмеченный подход (если не закончено), иначе следующее незаконченное.
function curItem(k) {
  const c = draft(k), items = WK.itemsFor(k);
  let best = null, bt = 0;
  items.forEach(it => (c.ex[it.id] || []).forEach(x => {if (x.done && x.t > bt) {bt = x.t; best = it;}}));
  if (best) return WK.exDone(k, best) ? nextUp(k, slotOf(best)) : best;
  return items.find(x => !WK.exDone(k, x)) || null;
}

function tapWarm(k, it, j) {
  unlockAudio();
  const cur = draft(k).warm[it.id] || [], next = [...cur];
  next[j] = !next[j];
  WK.setWarm(k, it.id, next.map(Boolean));
  haptic(10);
  if (next[j]) startRest(45, 'Разминка — дальше рабочий вес');
  rerender(it);
}

// К упражнению, где был последний отмеченный подход (или к следующему), иначе — к первому незаконченному.
export function scrollToCurrent() {
  const k = WK.curKey(), c = draft(k), items = WK.itemsFor(k);
  const hasDone = items.some(it => (c.ex[it.id] || []).some(x => x.done));
  const target = hasDone ? curItem(k) : null;
  const card = target ? $('#ex-' + CSS.escape(slotOf(target))) : null;
  const n = (card && (card.querySelector('.set.nx') || card)) || $('#list .set.nx') || $('#list .set.x');
  if (n) n.scrollIntoView({block: card && !card.querySelector('.set.nx') ? 'start' : 'center'});
}
function renderAll() {WK.itemsFor(WK.curKey()).filter(x => !isCore(x)).forEach(x => renderCard(x)); renderCirc(); updSession();}

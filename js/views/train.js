// Экран «Тренировка»: карточки упражнений, подходы, разминка, таймер.
import {$, $$, toast, CK, ICON} from '../ui.js';
import {state, draft, updDB, dropDraft} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import * as WK from '../workout.js';
import {esc, fmtT, fmtD} from '../format.js';
import {unlockAudio, haptic, keepAwake} from '../platform.js';
import {startRest, stopRest} from '../timer.js';
import {openTech, openSwap, openNote} from './sheets.js';
import {finish, saveStale} from './finish.js';
import {hasPhoto} from '../data/equipment.js';
import {ownCover} from './covers.js';

const UNIT_T = {w: 'повторы', r: 'повторы', t: 'секунды', c: 'минуты'};
const RIR_TXT = {p1: '3 повтора в запасе', p2: '1–2 повтора в запасе', p3: '1 повтор в запасе'};
let open = {}, lastTap = 0;
const DOUBLE_TAP_MS = 600;

export function renderTrain() {
  const db = state.db, ph = P.phaseOf(db, db.phase), keys = P.woKeys(db, db.phase);
  if (!ph.w[db.wo]) updDB(d => ({...d, wo: keys[0]}));
  const k = WK.curKey(), c = draft(k), items = WK.itemsFor(k), live = WK.activeKey();
  open = {};
  let h = `<div class="pt"><small>Этап ${db.phase.slice(1)} · ${esc(ph.label)}</small><h1>Тренировка ${esc(db.wo)}</h1></div>`;
  if (c.start && WK.isStale(c)) h += `<div class="switch"><b>Тренировка от ${fmtD(c.last)} не завершена</b>Сохрани её той датой — или начни заново.<div class="g2" style="margin-top:12px"><button class="btn" id="stsave">Сохранить</button><button class="btn s2" id="stdrop">Начать заново</button></div></div>`;
  h += `<div class="seg" id="phs">${P.PHASES.map(p => `<button class="${p === db.phase ? 'on' : ''}" data-p="${p}">${esc(P.phaseOf(db, p).label)}<small>${esc(P.phaseOf(db, p).sub)}</small></button>`).join('')}</div>
  <div class="wos" id="wos">${keys.map(w => `<button class="${w === db.wo ? 'on' : ''}" data-w="${esc(w)}">${esc(w)}</button>`).join('')}<button class="edit" id="goplan">${ICON.note}Программа</button></div>
  <div class="session" id="session"></div>
  <p class="hintl">${esc(ph.hint)}</p>
  <div id="list">${items.map(it => `<div class="ex" id="ex-${it.orig || it.id}" data-slot="${it.orig || it.id}"></div>`).join('')}</div>
  ${items.length ? '' : '<p class="empty">В этой тренировке нет упражнений — добавь их в «Программе».</p>'}
  <div class="card kneec"><div class="h">Колени сегодня</div><div class="r"><input type="range" id="knee" min="0" max="10" value="${c.knee ?? 0}" aria-label="Боль в коленях"><b class="n" id="kneev">${c.knee ?? '—'}</b></div><small>${c.knee === null ? 'Сдвинь ползунок — даже если 0.' : '0 — ничего не чувствую. Выше 3 — вес на ноги не повышаем.'}</small></div>
  <button class="btn" id="finish" style="margin-top:18px">Завершить тренировку</button>
  <button class="textbtn" id="reset">Сбросить отметки</button>`;
  $('#v-train').innerHTML = h;
  items.forEach(it => renderCard(it));
  updSession();
  bindTrain(k, live);
  if (live === k) keepAwake(true);
}

function bindTrain(k, live) {
  const guard = () => !live || live !== k || confirm('Идёт тренировка — переключиться? Отметки сохранятся.');
  $$('#phs button').forEach(b => b.onclick = () => {if (b.dataset.p === state.db.phase || !guard()) return; updDB(d => ({...d, phase: b.dataset.p, wo: P.woKeys(d, b.dataset.p)[0]})); renderTrain();});
  $$('#wos [data-w]').forEach(b => b.onclick = () => {if (b.dataset.w === state.db.wo || !guard()) return; updDB(d => ({...d, wo: b.dataset.w})); renderTrain();});
  $('#goplan').onclick = () => import('./plan.js').then(m => m.openPlan(state.db.phase, state.db.wo));
  $('#knee').oninput = e => {WK.setKnee(k, +e.target.value); $('#kneev').textContent = e.target.value;};
  $('#finish').onclick = () => finish(k);
  $('#reset').onclick = () => {if (confirm('Сбросить все отметки этой тренировки?')) {dropDraft(k); stopRest(); keepAwake(false); renderTrain(); updDot();}};
  const ss = $('#stsave'); if (ss) ss.onclick = () => {saveStale(k); renderTrain(); updDot();};
  const sd = $('#stdrop'); if (sd) sd.onclick = () => {if (confirm('Удалить незавершённую тренировку?')) {dropDraft(k); renderTrain(); updDot();}};
  const list = $('#list');
  list.onclick = onTap;
  list.oninput = onInput;
}

export function updDot() {$('#livedot').classList.toggle('lv', !!WK.activeKey());}

function updSession() {
  const k = WK.curKey(), c = draft(k), {done, total} = WK.progressOf(k), items = WK.itemsFor(k);
  const est = Math.round(items.reduce((a, it) => a + (P.exOf(state.db, it.id).t === 'c' ? +it.r || 10 : it.s * 2.5), 0) / 5) * 5;
  $('#session').innerHTML = `<div class="r1"><span><b class="n">${done}</b> из ${total} подходов</span>${c.start ? `<span class="el n" id="elapsed">${fmtT((Date.now() - c.start) / 1000)}</span>` : `<span>≈ ${est} мин</span>`}</div><div class="bar"><i style="width:${total ? done / total * 100 : 0}%"></i></div>`;
}
export function tickElapsed() {
  const c = draft(WK.curKey()), el = $('#elapsed');
  if (el && c.start) el.textContent = fmtT((Date.now() - c.start) / 1000);
}

const itemBySlot = slot => WK.itemsFor(WK.curKey()).find(x => (x.orig || x.id) === slot);
const idxOf = slot => WK.itemsFor(WK.curKey()).findIndex(x => (x.orig || x.id) === slot);

function photoFor(id, e) {
  if (hasPhoto(e.img)) return `img/${e.img}.jpg`;
  return ownCover(id);
}

function renderCard(it, justK) {
  const k = WK.curKey(), db = state.db, e = P.exOf(db, it.id), slot = it.orig || it.id, c = draft(k);
  const el = $('#ex-' + CSS.escape(slot));
  if (!el) return;
  const rows = WK.rowsFor(k, it), A = WK.aimFor(k, it), Ls = L.lastFor(db.sessions, it.id), skip = !!c.skip[it.id];
  const all = !skip && rows.every(x => x.done), nx = rows.findIndex(x => !x.done), ok = open[slot] ?? nx;
  const tlab = e.t === 'c' ? it.r + ' мин' : e.t === 't' ? it.s + ' × ' + it.r + ' с' : it.s + ' × ' + it.r + ' повт';
  const best = Ls && e.t === 'w' ? L.bestSet('w', db.sessions.flatMap(s => s.entries[it.id] || [])) : null;
  const pic = photoFor(it.id, e), note = P.noteOf(db, it.id);
  el.className = 'ex' + (pic ? '' : ' noimg') + (all ? ' all' : '') + (skip ? ' skip' : '');
  let h = `${pic ? `<div class="exp"><img src="${pic}" alt="" loading="lazy"></div>` : ''}
  <button class="info" data-act="tech">${ICON.info}Техника</button>
  <div class="exh"><div class="t"><div class="no">${idxOf(slot) + 1} / ${WK.itemsFor(k).length}</div>
   <h3>${esc(e.n)}${e.knee ? '<span class="kn">колени</span>' : ''}<span class="okb">✓ Готово</span></h3>
   <div class="tg">${tlab}${best ? ' · рекорд ' + best.a + '×' + best.b : ''}</div>
   ${it.orig ? `<div class="swp">вместо «${esc(P.exOf(db, it.orig).n)}» · <button data-act="unswap">вернуть</button></div>` : ''}</div></div>
  <div class="tools"><button data-act="swap">${ICON.swap}Заменить</button><button data-act="note">${ICON.note}Заметка</button><button data-act="skip">${ICON.skip}${skip ? 'Вернуть' : 'Пропустить'}</button></div>`;
  if (skip) {el.innerHTML = h + '<p class="skipped">Пропущено сегодня</p>'; return;}
  if (note) h += `<button class="mynote" data-act="note">${esc(note)}</button>`;
  if (Ls) h += `<div class="last"><span>Прошлый раз · ${fmtD(Ls.date)}</span><b>${esc(setStr(e.t, Ls.e))}</b></div>`;
  if (A) h += `<div class="aimrow ${A.up ? 'up' : A.down ? 'down' : ''}"><span>${A.up ? '↑ Пора добавить' : A.down ? '↓ Сегодня легче' : 'Цель сегодня'}</span><b>${esc(A.txt)}</b>${A.why ? `<small>${esc(A.why)}</small>` : ''}</div>`;
  else if (e.t === 'w') h += `<div class="aimrow"><span>Первый раз</span><b>Подбери вес: ${RIR_TXT[db.phase] || RIR_TXT.p2}</b></div>`;
  if (it.n) h += `<div class="note">${esc(it.n)}</div>`;
  h += warmHtml(k, it, e, rows);
  h += `<div class="sets">${rows.map((x, j) => j === ok ? rowOpen(e, x, j, j === nx, j === justK, rows.length, Ls) : rowShut(e, x, j, j === justK, Ls)).join('')}
  ${e.t !== 'c' ? `<button class="addset" data-act="add">+ Ещё подход</button>` : ''}</div>`;
  el.innerHTML = h;
}

function setStr(t, e) {return e.map(x => t === 'w' ? `${x.a}×${x.b}` : `${x.b}${t === 't' ? ' с' : t === 'c' ? ' мин' : ''}`).join(', ');}
const valStr = (e, x) => e.t === 'w' ? `${x.a === '' ? '—' : x.a} кг × ${x.b === '' ? '—' : x.b}` : `${x.b === '' ? '—' : x.b} ${e.t === 't' ? 'с' : e.t === 'c' ? 'мин' : 'повт'}`;
const wasStr = (e, Ls, j) => {const p = Ls && (Ls.e[j] || null); return p ? 'было ' + (e.t === 'w' ? `${p.a}×${p.b}` : p.b) : '';};

function rowShut(e, x, j, just, Ls) {
  return `<div class="set c ${x.done ? 'done' : ''} ${just ? 'just' : ''}" data-k="${j}"><span class="si">${j + 1}</span>
  <button class="sv" data-act="open"><b class="n">${valStr(e, x)}</b><small>${wasStr(e, Ls, j)}</small></button>
  <button class="ck" data-act="${x.done ? 'open' : 'ck'}" aria-label="Подход ${j + 1} ${x.done ? 'выполнен' : 'отметить'}">${CK}</button></div>`;
}
function rowOpen(e, x, j, isNext, just, n, Ls) {
  const tg = f => !x.done && !(f === 'w' ? x.edA : x.edB) ? ' tgt' : '';
  const stp = (f, val, unit, mode, ph) => `<div class="stp"><button data-act="${f}m" aria-label="Меньше">−</button><label><input class="n${tg(f)}" inputmode="${mode}" data-f="${f === 'w' ? 'a' : 'b'}" value="${val}" placeholder="${ph}" aria-label="${unit}, подход ${j + 1}"><span>${unit}</span></label><button data-act="${f}p" aria-label="Больше">+</button></div>`;
  return `<div class="set x ${x.done ? 'done' : ''} ${isNext ? 'nx' : ''} ${just ? 'just' : ''}" data-k="${j}"><span class="si">${j + 1}</span>
  <div class="ins">${e.t === 'w' ? stp('w', x.a, 'кг', 'decimal', 'вес') : ''}${stp('r', x.b, e.t === 'w' ? 'повт' : UNIT_T[e.t].slice(0, 4), 'numeric', '—')}
  <small class="was">${wasStr(e, Ls, j)}${tg('r') ? (wasStr(e, Ls, j) ? ' · ' : '') + 'жёлтым — цель, сделал меньше — поправь' : ''}</small></div>
  <div class="side"><button class="ck big" data-act="ck" aria-pressed="${x.done}" aria-label="Подход ${j + 1} выполнен">${CK}</button>${!x.done && n > 1 ? `<button class="rmset" data-act="del" aria-label="Убрать подход">${ICON.x}</button>` : ''}</div></div>`;
}

function warmHtml(k, it, e, rows) {
  const plan = L.warmPlan(WK.itemsFor(k), id => P.exOf(state.db, id));
  if (!plan[it.id]) return '';
  const w = +(rows[0] && rows[0].a) || 0, sets = L.warmups(w, P.stepOf(state.db, it.id), plan[it.id] === 'full');
  if (!sets.length) return '';
  const done = draft(k).warm[it.id] || [];
  if (rows.some(x => x.done) && !done.some(Boolean)) return '';
  return `<div class="warm"><span>Разминка</span>${sets.map((s, j) => `<button class="${done[j] ? 'on' : ''}" data-act="warm" data-w="${j}">${done[j] ? '✓ ' : ''}${s.a} кг × ${s.b}</button>`).join('')}</div>`;
}

// ---- нажатия ----
function flushFocused() {
  const ae = document.activeElement;
  if (ae && ae.matches && ae.matches('#list input[data-f]')) onInput({target: ae});
}
function onInput(ev) {
  const inp = ev.target;
  if (inp.tagName !== 'INPUT' || !inp.dataset.f) return;
  const slot = inp.closest('.ex').dataset.slot, it = itemBySlot(slot), j = +inp.closest('.set').dataset.k;
  const v = String(inp.value).replace(',', '.').trim();
  WK.editField(WK.curKey(), it, j, inp.dataset.f, v === '' || isNaN(+v) ? '' : +v);
  inp.classList.remove('tgt');
}

function onTap(ev) {
  const b = ev.target.closest('[data-act]');
  if (!b) return;
  flushFocused();
  const card = b.closest('.ex'), slot = card.dataset.slot, it = itemBySlot(slot), k = WK.curKey(), act = b.dataset.act;
  if (!it) return;
  const e = P.exOf(state.db, it.id);
  if (act === 'tech') return openTech(it.id);
  if (act === 'note') return openNote(it.id, () => renderCard(itemBySlot(slot)));
  if (act === 'swap') return openSwap(k, it, () => {renderTrain();});
  if (act === 'unswap') {WK.swapEx(k, it.orig, it.orig); return renderTrain();}
  if (act === 'skip') {const on = !draft(k).skip[it.id]; WK.setSkip(k, it.id, on); renderCard(it); updSession(); if (on) toast('Пропущено', {label: 'Вернуть', run: () => {WK.setSkip(k, it.id, false); renderCard(itemBySlot(slot)); updSession();}}); return;}
  if (act === 'add') {WK.addSet(k, it); open[slot] = WK.rowsFor(k, it).length - 1; return rerender(it);}
  if (act === 'warm') return tapWarm(k, it, +b.dataset.w);
  const j = +b.closest('.set').dataset.k, rows = WK.rowsFor(k, it), x = rows[j];
  if (act === 'open') {open[slot] = j; return rerender(it);}
  if (act === 'del') {WK.removeSet(k, it, j); delete open[slot]; return rerender(it);}
  if (act === 'wm' || act === 'wp') {const st = P.stepOf(state.db, it.id), cur = +x.a || 0; WK.editField(k, it, j, 'a', Math.max(0, Math.round((cur + (act === 'wp' ? st : -st)) * 100) / 100)); haptic(5); return rerender(it, j);}
  if (act === 'rm' || act === 'rp') {const st = e.t === 't' ? 5 : 1, cur = +x.b || 0; WK.editField(k, it, j, 'b', Math.max(0, cur + (act === 'rp' ? st : -st))); haptic(5); return rerender(it, j);}
  if (act === 'ck') return tapCheck(k, it, j, x, e);
}

function rerender(it, keepOpen) {
  const slot = it.orig || it.id;
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
  const slot = it.orig || it.id;
  WK.markSet(k, it, j, !x.done, now);
  delete open[slot];
  haptic(18);
  updDot();
  if (!x.done) {
    keepAwake(true);
    const rows = WK.rowsFor(k, it), allDone = rows.every(r => r.done);
    renderCard(itemBySlot(slot), j);
    updSession();
    const nxt = nextUp(k, slot);
    if (allDone) {
      toast('✓ ' + e.n + ' — готово');
      if (nxt) setTimeout(() => {const n = $('#ex-' + CSS.escape(nxt.orig || nxt.id)); if (n) n.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});}, 450);
    }
    const [ph] = WK.splitKey(k), rest = WK.restFor(it, ph);
    const label = allDone ? (nxt ? 'Далее: ' + P.exOf(state.db, nxt.id).n : 'Последнее упражнение позади') : `Далее: подход ${j + 2} · ${valStr(e, rows[j + 1] || x)}`;
    if (rest) startRest(allDone ? Math.min(rest, 90) : rest, label); else stopRest();
  } else rerender(it);
}

// Следующее незаконченное упражнение — ищем после текущего, затем с начала.
function nextUp(k, slot) {
  const items = WK.itemsFor(k), i = items.findIndex(x => (x.orig || x.id) === slot);
  return [...items.slice(i + 1), ...items.slice(0, i)].find(x => !WK.exDone(k, x)) || null;
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

export function scrollToCurrent() {
  const n = $('#list .set.nx') || $('#list .set.x');
  if (n) n.scrollIntoView({block: 'center'});
}

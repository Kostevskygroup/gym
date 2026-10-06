// Экран «Прогресс»: регулярность, графики силы, история с правкой.
import {$, $$, toast, openSheet, closeSheet, ICON} from '../ui.js';
import {state, updDB} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import {stats} from '../stats.js';
import {normalizeDB} from '../backup.js';
import {esc, fmtD, fmtVolT, plural, r1, ymd, UNIT} from '../format.js';
import {chart} from './chart.js';

let sel = null, mode = 'w';
const RECENT_DAYS = 28;

export function renderProg() {
  const db = state.db, st = stats(db), S = db.sessions;
  let h = `<div class="pt"><small>${S.length} ${plural(S.length, 'тренировка', 'тренировки', 'тренировок')} · ${fmtVolT(st.total)}</small><h1>Прогресс</h1></div>`;
  h += heat(S, st);
  const used = [...new Set(S.flatMap(s => Object.keys(s.entries)))].filter(id => st.exOf(id).g !== 'cardio');
  h += `<div class="sec"><b>Сила</b></div>`;
  if (!used.length) h += `<p class="empty">Заверши первую тренировку — здесь появятся графики силы.</p>`;
  else h += strength(used, st);
  h += `<div class="sec"><b>История</b></div>` + (S.length ? [...S].reverse().map(s => histItem(s, st)).join('') : '<p class="empty">Пока пусто.</p>');
  $('#v-prog').innerHTML = h;
  bind();
}

function heat(S, st) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = L.weekStart(today); start.setDate(start.getDate() - 77);
  const by = {};
  S.forEach(s => {const k = ymd(s.date); by[k] = (st.prs.get(s.id) || []).length || by[k] === 'pr' ? 'pr' : 'y';});
  let h = `<div class="sec"><b>Регулярность</b><span>${st.streak ? '🔥 ' + st.streak + ' нед. подряд' : '12 недель'}</span></div><div class="card"><div class="heat"><div class="dl">${['Пн', '', 'Ср', '', 'Пт', '', 'Вс'].map(d => `<span>${d}</span>`).join('')}</div>`;
  for (let w = 0; w < 12; w++) {
    h += '<div class="w">';
    for (let d = 0; d < 7; d++) {
      const t = new Date(start); t.setDate(t.getDate() + w * 7 + d);
      const k = ymd(t);
      h += `<i class="${t > today ? 'f' : (by[k] || '')} ${k === ymd(today) ? 'td' : ''}"></i>`;
    }
    h += '</div>';
  }
  return h + `</div><div class="legend"><span>тренировка</span><span class="p">день рекорда</span></div></div>`;
}

function strength(used, st) {
  if (!used.includes(sel)) sel = used.includes('legpress') ? 'legpress' : used[0];
  const id = sel, t = st.exOf(id).t, list = st.S.filter(s => s.entries[id]);
  const isW = t === 'w', m = isW ? mode : 'b';
  const y = s => isW ? (m === 'w' ? Math.max(...s.entries[id].map(x => x.a)) : Math.round(L.e1rm('w', s.entries[id]))) : Math.max(...s.entries[id].map(x => x.b));
  const pts = list.map(s => ({d: s.date, y: y(s), pr: (st.prs.get(s.id) || []).some(p => p.id === id)}));
  const best = Math.max(...pts.map(p => p.y));
  const e1 = list.map(s => ({d: s.date, v: L.e1rm('w', s.entries[id])}));
  const recent = e1.filter(x => +st.now - new Date(x.d) < RECENT_DAYS * 864e5);
  const e1best = Math.round(Math.max(...e1.map(x => x.v))), e1now = recent.length ? Math.round(Math.max(...recent.map(x => x.v))) : null;
  const first = pts[0].y, last = pts.at(-1).y, pct = first ? Math.round((last - first) / first * 100) : 0;
  return `<div class="exl" id="exl">${used.map(x => `<button class="${x === id ? 'on' : ''}" data-x="${esc(x)}">${esc(st.exOf(x).n)}</button>`).join('')}</div>
  ${isW ? `<div class="seg" style="margin-top:12px" id="pmode"><button class="${m === 'w' ? 'on' : ''}" data-m="w">Рабочий вес</button><button class="${m === 'e' ? 'on' : ''}" data-m="e">Сила (расчёт)</button></div>` : ''}
  <div class="g2" style="margin-top:12px"><div class="st"><small>${isW && m === 'e' ? 'Лучшая сила' : 'Рекорд'}</small><b class="n">${best}<span> ${UNIT[t]}</span></b><i>старт ${first} ${UNIT[t]}</i></div>
  <div class="st"><small>${isW ? 'Максимум на 1 раз' : 'Прирост'}</small><b class="n">${isW ? '≈' + (e1now ?? e1best) + '<span> кг</span>' : (pct > 0 ? '+' : '') + pct + '<span>%</span>'}</b><i>${isW ? (e1now !== null ? `за 4 недели · лучший ${e1best}` : `лучший ${e1best}, давно`) : 'с первой тренировки'}</i></div></div>
  ${chart(pts, 'Прогресс ' + st.exOf(id).n)}<p class="cap">${isW ? (m === 'w' ? 'Рабочий вес по тренировкам' : 'Расчётный максимум: учитывает и вес, и повторы') : 'Лучший подход'} · жёлтые точки — рекорды</p>`;
}

function histItem(s, st) {
  const prs = st.prs.get(s.id) || [];
  return `<details class="hist"><summary><span><b>Тренировка ${esc(s.wo)}</b>${prs.length ? '<span class="kn">PR</span>' : ''}<br><span class="sb">${esc(P.phaseOf(state.db, s.phase).label)}</span></span><span class="rt">${fmtD(s.date)}<br>${fmtVolT(st.vol(s))}${s.dur ? ' · ' + s.dur + ' мин' : ''}</span></summary>
  <div class="hb">${Object.entries(s.entries).map(([id, e]) => {const x = st.exOf(id); return `<p>${esc(x.n)}<span>${e.map(r => x.t === 'w' ? r.a + '×' + r.b : r.b).join(', ')}</span></p>`;}).join('')}<p>Колени<span>${s.knee === null ? 'не указано' : s.knee + '/10'}</span></p>
  <div class="hbb"><button class="sm2" data-edit="${s.id}">${ICON.note}Исправить</button><button class="del" data-del="${s.id}">Удалить</button></div></div></details>`;
}

function bind() {
  const ex = $('#exl');
  if (ex) $$('#exl button').forEach(b => b.onclick = () => {sel = b.dataset.x; const sl = ex.scrollLeft; renderProg(); $('#exl').scrollLeft = sl;});
  $$('#pmode button').forEach(b => b.onclick = () => {mode = b.dataset.m; const sl = $('#exl').scrollLeft; renderProg(); $('#exl').scrollLeft = sl;});
  $$('[data-del]').forEach(b => b.onclick = () => {
    const id = +b.dataset.del, s = state.db.sessions.find(x => x.id === id);
    if (!s || !confirm('Удалить эту тренировку?')) return;
    updDB(d => ({...d, sessions: d.sessions.filter(x => x.id !== id)}));
    renderProg();
    toast('Тренировка удалена', {label: 'Вернуть', run: () => {updDB(d => normalizeDB({...d, sessions: [...d.sessions, s]})); renderProg();}});
  });
  $$('[data-edit]').forEach(b => b.onclick = () => editSession(+b.dataset.edit));
}

// Правка подходов прошедшей тренировки — опечатки больше не портят рекорды навсегда.
function editSession(id) {
  const s = state.db.sessions.find(x => x.id === id);
  if (!s) return;
  const exOf = x => P.exOf(state.db, x);
  const rowsHtml = (eid, e) => e.map((r, j) => `<div class="er" data-ex="${esc(eid)}" data-j="${j}">${exOf(eid).t === 'w' ? `<input inputmode="decimal" data-f="a" value="${r.a ?? ''}" aria-label="Вес"><span>кг ×</span>` : ''}<input inputmode="numeric" data-f="b" value="${r.b}" aria-label="Повторы"><button data-rm aria-label="Убрать подход">${ICON.x}</button></div>`).join('');
  openSheet(`<span class="grab"></span><div class="sc"><h2>Тренировка ${esc(s.wo)} · ${fmtD(s.date)}</h2>
    ${Object.entries(s.entries).map(([eid, e]) => `<div class="tb2"><h4>${esc(exOf(eid).n)}</h4>${rowsHtml(eid, e)}</div>`).join('')}
    <div class="tb2"><h4>Колени</h4><input type="number" min="0" max="10" id="ekn" value="${s.knee ?? ''}" placeholder="не указано" class="ekn"></div>
    <button class="btn" style="margin-top:20px" id="esave">Сохранить</button><button class="btn s2" style="margin-top:8px" id="eclose">Отмена</button></div>`, sh => {
    sh.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => b.closest('.er').remove());
    sh.querySelector('#eclose').onclick = closeSheet;
    sh.querySelector('#esave').onclick = () => {
      const entries = {};
      let bad = false;
      sh.querySelectorAll('.er').forEach(r => {
        const eid = r.dataset.ex, a = r.querySelector('[data-f=a]'), b = r.querySelector('[data-f=b]');
        if ((a && !(String(a.value).trim() && isFinite(+String(a.value).replace(',', '.')))) || !(String(b.value).trim() && isFinite(+String(b.value).replace(',', '.')))) bad = true;
        (entries[eid] = entries[eid] || []).push({a: a ? a.value : null, b: b.value});
      });
      if (bad) {toast('Заполни вес и повторы или убери подход ✕'); return;}
      const kn = sh.querySelector('#ekn').value;
      updDB(d => normalizeDB({...d, sessions: d.sessions.map(x => x.id === id ? {...x, entries, knee: kn === '' ? null : +kn} : x)}));
      closeSheet(); renderProg(); toast('Исправлено — рекорды пересчитаны');
    };
  });
}

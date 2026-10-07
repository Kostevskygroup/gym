// Экран «Сегодня».
import {$, toast, ICON} from '../ui.js';
import {state, updDB, dropDraft, draft} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import * as WK from '../workout.js';
import {stats, ACH} from '../stats.js';
import {backupDue} from '../backup.js';
import {esc, fmtD, fmtT, fmtVol, fmtN, ruDec, signed, NNBSP, r1, plural} from '../format.js';
import {hasPhoto} from '../data/equipment.js';
import {saveStale} from './finish.js';
import {coachHtml, bindCoach} from './coach.js';
import {avatarHtml, openProfiles, inviteFlow} from './profiles.js';
import {welcomeHtml, bindWelcome, isFresh} from './welcome.js';
import {openInstall, installRow} from './install.js';
import * as SY from '../sync.js';

const greet = () => {const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';};
function ringSvg(p) {const c = 2 * Math.PI * 42; return `<svg viewBox="0 0 104 104"><circle class="trk" cx="52" cy="52" r="42" fill="none" stroke-width="10"/><circle class="arc" cx="52" cy="52" r="42" fill="none" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-to="${c * (1 - Math.min(1, p))}" style="transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)"/></svg>`;}
function spark(arr) {
  if (arr.length < 2) return '';
  const mn = Math.min(...arr), mx = Math.max(...arr), rg = mx - mn || 1;
  const pts = arr.map((v, i) => [(i / (arr.length - 1) * 114 + 3).toFixed(1), (45 - (v - mn) / rg * 40).toFixed(1)]);
  return `<svg viewBox="0 0 120 50" aria-hidden="true"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4.5" fill="currentColor"/></svg>`;
}

function warnings() {
  let h = '';
  if (state.warn) h += `<div class="warn on">${esc(state.warn)}</div>`;
  if (state.saveFailed) h += `<div class="warn on">Не удаётся сохранить данные на телефоне. Сделай резервную копию во вкладке «Тело».</div>`;
  return h;
}
// Владелец зовёт людей прямо с главного экрана — не через три уровня настроек.
const inviteRow = () => SY.account()?.admin ? `<button class="backup" id="goinvite"><span class="bi inv">${ICON.invite}</span><span class="t"><b>Пригласить в «Мой зал»</b><small>Код на 7 дней, один раз · откроется «Поделиться»</small></span>${ICON.chev}</button>` : '';
// До первой тренировки нули (0 тренировок, 0/3, пустая шкала) ничего не говорят — вместо них: что за этап и как это работает.
const freshHero = (db, ph, a, b, T) => `<div class="sec"><b>Твоя программа</b></div><div class="card hero fresh"><div class="l"><span class="eyebrow">Этап ${db.phase.slice(1)} · ${b ? 'недели ' + a + '–' + b : 'с недели ' + a}</span><b class="ht">${esc(ph.label)}</b>
    <div class="bl"><span>${T} ${plural(T, 'тренировка', 'тренировки', 'тренировок')} в неделю</span><span>первая впереди</span></div></div>
  <span class="eyebrow how">Как это работает</span><ol class="steps">
    <li>Нажми «Начать тренировку» — откроется список упражнений с фото тренажёров.</li>
    <li>После подхода нажми ✓ — таймер отдыха включится сам.</li>
    <li>В конце нажми «Завершить». В следующий раз я подскажу вес.</li></ol></div>`;

export function renderHome(go) {
  const db = state.db;
  const onb = isFresh() && !(db.settings && db.settings.onboarded);
  document.body.classList.toggle('onb', onb);
  if (onb) {$('#v-home').innerHTML = warnings() + welcomeHtml(); bindWelcome(go); return;}
  const st = stats(db), S = db.sessions, now = new Date();
  const wk = L.planWeek(S, now), rp = L.recPhase(wk), [a, b] = L.RANGE[db.phase], ph = P.phaseOf(db, db.phase), T = L.target(db.phase);
  const pct = S.length ? (b ? Math.min(1, Math.max(0, (wk - a + 1) / (b - a + 1))) : 1) : 0;
  const thisW = S.filter(s => L.weekKey(s.date) === L.weekKey(now)).length;
  const keys = P.woKeys(db, db.phase), nw = L.nextWo(S, db.phase, keys), items = P.itemsOf(db, db.phase, nw), ak = WK.activeKey();
  const gap = L.gapDays(S, now), due = backupDue(db, now);
  const day = now.toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'});
  const streak = st.streak >= 2 ? `${ICON.flame}${st.streak} ${plural(st.streak, 'неделя', 'недели', 'недель')} подряд` : `${S.length} ${plural(S.length, 'тренировка', 'тренировки', 'тренировок')}`;
  const who = db.settings && db.settings.name ? ', ' + esc(db.settings.name) : '';
  let h = warnings() + `<div class="pt has-av"><small>${greet()}${who} · ${day}</small><h1>${S.length ? 'Неделя ' + wk : 'Первая неделя'}</h1>${avatarHtml()}</div>`;
  if (S.length) h += `<div class="card hero"><div class="l"><span class="eyebrow">Этап ${db.phase.slice(1)}</span><b class="ht">${esc(ph.label)}</b>
    <div class="bar${b ? ' wk' : ''}"${b ? ` style="--n:${b - a + 1}"` : ''}><i style="width:${pct * 100}%"></i></div>
    <div class="bl"><span>${b ? 'недели ' + a + '–' + b : 'с недели ' + a}</span><span>${streak}</span></div></div>
  <div class="ringw"><div class="ring${thisW >= T ? ' full' : ''}">${ringSvg(thisW / T)}<div class="c"><b class="n">${thisW}/${T}</b></div></div><small>за неделю</small></div></div>`;
  // идёт та же тренировка, что и «следующая» — одно действие «Продолжить» в баннере, карточку «Следующая» не дублируем
  const liveIsNext = !!ak && ak === WK.keyOf(db.phase, nw);
  if (ak) {
    const c = draft(ak), wo = WK.splitKey(ak)[1], pr = WK.progressOf(ak);
    h += WK.isStale(c) ? `<div class="switch"><b>Тренировка ${esc(wo)} от ${fmtD(c.last)} не завершена</b>Сохранить её той датой или удалить?<div class="g2" style="margin-top:12px"><button class="btn" id="h-stsave">Сохранить</button><button class="btn s2" id="h-stdrop">Удалить</button></div></div>`
      : `<button class="live" id="golive"><span class="p"></span><span class="t"><b>Идёт тренировка</b><small>${esc(wo)} · <span class="n">${pr.done}/${pr.total}</span> подходов · <span class="n" id="liveel">${fmtT((Date.now() - c.start) / 1000)}</span></small></span><em>Продолжить</em></button>`;
  }
  if (S.length) h += installRow();
  if (gap !== null && gap > 14) h += `<div class="switch"><b>С возвращением! Перерыв ${gap} ${plural(gap, 'день', 'дня', 'дней')}</b>Первые тренировки веса будут на 10–20% легче — это нормально, сила вернётся быстро.</div>`;
  else if (S.length && rp > db.phase) h += `<div class="switch"><b>Пора на этап ${rp.slice(1)} — «${esc(P.phaseOf(db, rp).label)}»</b>Ты на неделе ${wk}. Дальше больше подходов и новые упражнения.<button class="btn" id="gophase">Перейти на этап ${rp.slice(1)}</button></div>`;
  const heroEx = (items.find(x => hasPhoto(P.exOf(db, x.id).img) && P.exOf(db, x.id).g !== 'cardio') || items[0]);
  const est = Math.round(items.reduce((s, x) => s + (P.exOf(db, x.id).t === 'c' ? +x.r || 10 : x.s * 2.5), 0) / 5) * 5;
  if (!liveIsNext) h += `<div class="sec"><b>${S.length ? 'Следующая' : 'Первая тренировка'}</b></div>
  <div class="nextc">${heroEx && hasPhoto(P.exOf(db, heroEx.id).img) ? `<img src="img/${P.exOf(db, heroEx.id).img}.jpg" alt="">` : ''}<div class="k"><span>${items.length} ${plural(items.length, 'упражнение', 'упражнения', 'упражнений')}</span><span>≈ ${est} мин</span></div><h3>Тренировка ${esc(nw)}</h3><div class="chips">${chips(db, items)}</div><button class="btn" id="gonow">Начать тренировку</button></div>`;
  // до первой тренировки главное — кнопка «Начать»: карточка этапа с подсказкой и установка идут под ней
  if (!S.length) h += freshHero(db, ph, a, b, T) + installRow();
  h += coachHtml();
  h += inviteRow();
  if (due.due && !SY.cloudOk()) h += `<button class="backup" id="gobackup"><span class="bi">${ICON.save}</span><span class="t"><b>Сохрани резервную копию</b><small>${due.n} ${plural(due.n, 'тренировка', 'тренировки', 'тренировок')} без копии</small></span>${ICON.chev}</button>`;
  if (S.length) {
    const JT = {knee: 'Колени', back: 'Спина', shoulder: 'Плечи', elbow: 'Локти', wrist: 'Запястья', neck: 'Шея', hip: 'Тазобедренные', ankle: 'Голеностоп'};
    const pj = Object.entries(st.pains).sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))[0], kn = pj ? pj[1] : null;
    const painTile = pj ? `<div class="st"><small>${JT[pj[0]]} · среднее</small><b class="n${kn === null || kn === undefined ? '' : kn <= 3 ? ' good' : ' warn'}">${kn === null || kn === undefined ? '—' : fmtN(kn, 1)}<span>/10</span></b><i>за 3 тренировки</i></div>`
      : `<div class="st"><small>Серия</small><b class="n">${st.streak}<span>${plural(st.streak, 'неделя', 'недели', 'недель')}</span></b><i>подряд по плану</i></div>`;
    h += `<div class="sec"><b>Результаты</b></div><div class="g2">
      <div class="st"><small>Поднято всего</small><b class="n">${fmtVol(st.total)}</b><i>${st.total >= 5000 ? elephants(st.total) : 'за ' + S.length + ' ' + plural(S.length, 'тренировку', 'тренировки', 'тренировок')}</i></div>
      <div class="st"><small>Рекорды</small><b class="n">${st.allPRs.length}</b><i>${st.allPRs.length ? 'последний ' + fmtD(st.allPRs.at(-1).date) : 'первый впереди'}</i></div>
      <div class="st"><small>За 30 дней</small><b class="n">${st.last30}<span>${plural(st.last30, 'тренировка', 'тренировки', 'тренировок')}</span></b><i>всего ${S.length}</i></div>
      ${painTile}</div>`;
  }
  h += bodyCard(db);
  const prs = st.allPRs.slice(-4).reverse();
  if (prs.length) h += `<div class="sec"><b>Последние рекорды</b></div><div class="card prs">${prs.map(p => `<div class="prl"><span class="ic">PR</span><span class="t"><b>${esc(st.exOf(p.id).n)}</b><small class="n">${esc(ruDec(p.txt))}</small></span><span class="dt">${fmtD(p.date)}</span></div>`).join('')}</div>`;
  // медали появляются с первой завершённой тренировки — на пустом экране 24 серых кружка только пугают
  if (S.length) h += `<div class="sec"><b>Достижения</b><span>${Object.keys(db.ach).filter(k => ACH.some(x => x[0] === k)).length} из ${ACH.length}</span></div><div class="card ach">${ACH.map(([id, bd, t]) => `<div class="${db.ach[id] ? 'on' : ''}"><span>${bd}</span>${t}</div>`).join('')}</div>`;
  $('#v-home').innerHTML = h;
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('#v-home [data-to]').forEach(c => c.style.strokeDashoffset = c.dataset.to)));
  bind(go, nw, ak, rp);
}

// «≈ 25,9 слона»: дробное число — всегда «слона».
const elephants = kg => {const v = r1(kg / 5000); return '≈ ' + fmtN(v, 1) + ' ' + (v % 1 ? 'слона' : plural(v, 'слон', 'слона', 'слонов'));};

// Первые два упражнения, «+N» за остальные, и один чип круга пресса.
function chips(db, items) {
  const main = items.filter(x => x.blk !== 'core' && P.exOf(db, x.id).g !== 'cardio'), core = items.filter(x => x.blk === 'core');
  let h = main.slice(0, 2).map(x => `<span>${esc(P.exOf(db, x.id).n)}</span>`).join('');
  if (main.length > 2) h += `<span class="more">+${main.length - 2}</span>`;
  if (core.length) h += `<span class="core">${ICON.core}Пресс · ${core[0].s} ${plural(core[0].s, 'круг', 'круга', 'кругов')}</span>`;
  return h;
}

function bodyCard(db) {
  if (!db.bw.length) return `<div class="sec"><b>Вес тела</b></div><button class="card bstart" id="gobody"><b>Запиши стартовый вес и талию</b><small>Без этого не увидишь, как меняется тело →</small></button>`;
  const s0 = db.bw[0].kg, c = db.bw.at(-1).kg, d = r1(c - s0);
  let h = `<div class="sec"><b>Вес тела</b><span>${db.goal ? 'цель ' + fmtN(db.goal, 1) + NNBSP + 'кг' : ''}</span></div><div class="card"><div class="wcard"><div class="l"><b class="n">${fmtN(c, 1)}</b><span class="u">кг</span>${db.bw.length > 1 ? `<span class="delta n ${d < 0 ? 'g' : 'z'}">${signed(d)}</span>` : ''}<small>старт ${fmtN(s0, 1)}${NNBSP}кг</small></div>${spark(db.bw.slice(-12).map(x => x.kg))}</div>`;
  if (db.goal && s0 > db.goal) {const p = Math.min(1, Math.max(0, (s0 - c) / (s0 - db.goal))); h += `<div class="bar goal"><i style="width:${p * 100}%"></i></div><div class="bl2"><span>${Math.round(p * 100)}% пути</span><span>осталось ${fmtN(r1(Math.max(0, c - db.goal)), 1)}${NNBSP}кг</span></div>`;}
  else if (!db.goal) h += `<p class="hint2">Поставь цель во вкладке «Тело» — появится шкала.</p>`;
  return h + `</div>`;
}

function bind(go, nw, ak, rp) {
  const gn = $('#gonow'); if (gn) gn.onclick = () => {updDB(d => ({...d, wo: nw})); go('train', true);};
  const gl = $('#golive'); if (gl) gl.onclick = () => {const [ph, wo] = WK.splitKey(ak); updDB(d => ({...d, phase: ph, wo})); go('train', true);};
  const gp = $('#gophase'); if (gp) gp.onclick = () => {updDB(d => ({...d, phase: rp, wo: P.woKeys(d, rp)[0]})); renderHome(go); toast('Этап ' + rp.slice(1) + ' — поехали!');};
  const gb = $('#gobody'); if (gb) gb.onclick = () => go('body');
  const gk = $('#gobackup'); if (gk) gk.onclick = () => go('body', false, 'backup');
  const gv = $('#goinvite'); if (gv) gv.onclick = async () => {gv.disabled = true; try {await inviteFlow();} finally {gv.disabled = false;}};
  const ss = $('#h-stsave'); if (ss) ss.onclick = () => saveStale(ak, () => renderHome(go));
  const sd = $('#h-stdrop'); if (sd) sd.onclick = () => {if (confirm('Удалить незавершённую тренировку?')) {dropDraft(ak); renderHome(go);}};
  bindCoach(() => renderHome(go), go);
  const gi = $('#goinstall'); if (gi) gi.onclick = openInstall;
  $('#profbtn').onclick = () => openProfiles(changed => changed ? dispatchEvent(new Event('gym:profile')) : renderHome(go));
}

export function tickLive() {
  const ak = WK.activeKey(), le = $('#liveel');
  if (le && ak) le.textContent = fmtT((Date.now() - draft(ak).start) / 1000);
}

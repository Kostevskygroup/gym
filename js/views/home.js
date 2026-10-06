// Экран «Сегодня».
import {$, toast} from '../ui.js';
import {state, updDB, dropDraft, draft} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import * as WK from '../workout.js';
import {stats, ACH} from '../stats.js';
import {backupDue} from '../backup.js';
import {esc, fmtD, fmtT, fmtVol, r1, plural} from '../format.js';
import {isIOS, isStandalone} from '../platform.js';
import {hasPhoto} from '../data/equipment.js';
import {saveStale} from './finish.js';

const greet = () => {const h = new Date().getHours(); return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';};
function ringSvg(p) {const c = 2 * Math.PI * 42; return `<svg viewBox="0 0 104 104"><circle cx="52" cy="52" r="42" fill="none" stroke="#264135" stroke-width="11"/><circle cx="52" cy="52" r="42" fill="none" stroke="${p >= 1 ? '#6BC28A' : '#F5C842'}" stroke-width="11" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" data-to="${c * (1 - Math.min(1, p))}" style="transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)"/></svg>`;}
function spark(arr) {
  if (arr.length < 2) return '';
  const mn = Math.min(...arr), mx = Math.max(...arr), rg = mx - mn || 1;
  const pts = arr.map((v, i) => [(i / (arr.length - 1) * 114 + 3).toFixed(1), (45 - (v - mn) / rg * 40).toFixed(1)]);
  return `<svg viewBox="0 0 120 50"><polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="#6BC28A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${pts.at(-1)[0]}" cy="${pts.at(-1)[1]}" r="4.5" fill="#6BC28A"/></svg>`;
}

function banners() {
  let h = '';
  if (state.warn) h += `<div class="warn on">${esc(state.warn)}</div>`;
  if (state.saveFailed) h += `<div class="warn on">Не удаётся сохранить данные на телефоне. Сделай резервную копию во вкладке «Тело».</div>`;
  if (isIOS() && !isStandalone()) h += `<div class="switch"><b>Открой с экрана «Домой»</b>Нажми «Поделиться» → «На экран Домой» и заходи через иконку. Данные во вкладке Safari хранятся отдельно от приложения на экране «Домой».</div>`;
  return h;
}

export function renderHome(go) {
  const db = state.db, st = stats(db), S = db.sessions, now = new Date();
  const wk = L.planWeek(S, now), rp = L.recPhase(wk), [a, b] = L.RANGE[db.phase], ph = P.phaseOf(db, db.phase), T = L.target(db.phase);
  const pct = S.length ? (b ? Math.min(1, Math.max(0, (wk - a + 1) / (b - a + 1))) : 1) : 0;
  const thisW = S.filter(s => L.weekKey(s.date) === L.weekKey(now)).length;
  const keys = P.woKeys(db, db.phase), nw = L.nextWo(S, db.phase, keys), items = P.itemsOf(db, db.phase, nw), ak = WK.activeKey();
  const gap = L.gapDays(S, now), due = backupDue(db, now);
  const day = now.toLocaleDateString('ru-RU', {weekday: 'long', day: 'numeric', month: 'long'});
  let h = banners() + `<div class="pt"><small>${day[0].toUpperCase() + day.slice(1)}</small><h1>${greet()}</h1></div>
  <div class="card hero"><div class="l"><span class="tag">Этап ${db.phase.slice(1)} · ${esc(ph.label)}</span><div class="wk">${S.length ? 'Неделя ' + wk : 'Старт'}</div><div class="bar"><i style="width:${pct * 100}%"></i></div><div class="bl"><span>${b ? 'недели ' + a + '–' + b : 'с недели ' + a}</span><span>${st.streak >= 2 ? '🔥 ' + st.streak + ' нед. подряд' : S.length + ' ' + plural(S.length, 'тренировка', 'тренировки', 'тренировок')}</span></div></div>
  <div class="ring">${ringSvg(thisW / T)}<div class="c"><b class="n">${thisW}/${T}</b><small>неделя</small></div></div></div>`;
  if (ak) {
    const c = draft(ak), wo = WK.splitKey(ak)[1];
    h += WK.isStale(c) ? `<div class="switch"><b>Тренировка ${esc(wo)} от ${fmtD(c.last)} не завершена</b>Сохранить её той датой или удалить?<div class="g2" style="margin-top:12px"><button class="btn" id="h-stsave">Сохранить</button><button class="btn s2" id="h-stdrop">Удалить</button></div></div>`
      : `<button class="live" id="golive"><span class="p"></span><span class="t"><b>Идёт тренировка ${esc(wo)}</b><small class="n" id="liveel">${fmtT((Date.now() - c.start) / 1000)}</small></span><em>Продолжить</em></button>`;
  }
  if (gap !== null && gap > 14) h += `<div class="switch"><b>С возвращением! Перерыв ${gap} ${plural(gap, 'день', 'дня', 'дней')}</b>Первые тренировки веса будут на 10–20% легче — это нормально, сила вернётся быстро.</div>`;
  else if (S.length && rp > db.phase) h += `<div class="switch"><b>Пора на этап ${rp.slice(1)} — «${esc(P.phaseOf(db, rp).label)}»</b>Ты на неделе ${wk}. Дальше больше подходов и новые упражнения.<button class="btn" id="gophase">Перейти на этап ${rp.slice(1)}</button></div>`;
  if (due.due) h += `<button class="card backup" id="gobackup"><b>Сохрани резервную копию</b><span>${due.n} ${plural(due.n, 'тренировка', 'тренировки', 'тренировок')} без копии. Если удалить иконку или сменить телефон — без копии всё пропадёт.</span></button>`;
  const heroEx = (items.find(x => hasPhoto(P.exOf(db, x.id).img) && P.exOf(db, x.id).g !== 'cardio') || items[0]);
  const est = Math.round(items.reduce((s, x) => s + (P.exOf(db, x.id).t === 'c' ? +x.r || 10 : x.s * 2.5), 0) / 5) * 5;
  h += `<div class="sec"><b>${S.length ? 'Следующая' : 'Первая тренировка'}</b></div>
  <div class="nextc">${heroEx && hasPhoto(P.exOf(db, heroEx.id).img) ? `<img src="img/${P.exOf(db, heroEx.id).img}.jpg" alt="">` : ''}<div class="k"><span>${items.length} ${plural(items.length, 'упражнение', 'упражнения', 'упражнений')}</span><span>≈ ${est} мин</span></div><h3>Тренировка ${esc(nw)}</h3><div class="chips">${items.filter(x => P.exOf(db, x.id).g !== 'cardio').map(x => `<span>${esc(P.exOf(db, x.id).n)}</span>`).join('')}</div><button class="btn" id="gonow">${ak && ak === WK.keyOf(db.phase, nw) ? 'Продолжить' : 'Начать тренировку'}</button></div>`;
  h += `<div class="sec"><b>Результаты</b></div><div class="g2">
    <div class="st"><small>Поднято всего</small><b class="n">${fmtVol(st.total)}</b><i>${st.total >= 5000 ? '≈ ' + r1(st.total / 5000) + ' слона 🐘' : 'за ' + S.length + ' трен.'}</i></div>
    <div class="st"><small>Рекорды</small><b class="n">${st.allPRs.length}</b><i>${st.allPRs.length ? 'последний ' + fmtD(st.allPRs.at(-1).date) : 'первый впереди'}</i></div>
    <div class="st"><small>За 30 дней</small><b class="n">${st.last30}<span> трен.</span></b><i>всего ${S.length}</i></div>
    <div class="st"><small>Колени</small><b class="n">${st.knee ?? '—'}<span>/10</span></b><i>среднее за 3 трен. ног</i></div></div>`;
  h += bodyCard(db);
  const prs = st.allPRs.slice(-4).reverse();
  if (prs.length) h += `<div class="sec"><b>Последние рекорды</b></div><div class="card">${prs.map(p => `<div class="prl"><span class="ic">PR</span><span class="t"><b>${esc(st.exOf(p.id).n)}</b><small>${esc(p.txt)}</small></span><span class="dt">${fmtD(p.date)}</span></div>`).join('')}</div>`;
  h += `<div class="sec"><b>Достижения</b><span>${Object.keys(db.ach).filter(k => ACH.some(x => x[0] === k)).length} из ${ACH.length}</span></div><div class="card ach">${ACH.map(([id, bd, t]) => `<div class="${db.ach[id] ? 'on' : ''}"><span>${bd}</span>${t}</div>`).join('')}</div>`;
  $('#v-home').innerHTML = h;
  requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('#v-home [data-to]').forEach(c => c.style.strokeDashoffset = c.dataset.to)));
  bind(go, nw, ak, rp);
}

function bodyCard(db) {
  if (!db.bw.length) return `<div class="sec"><b>Вес тела</b></div><button class="card" id="gobody" style="width:100%;text-align:left;display:block"><b style="font-size:16px">Запиши стартовый вес и талию</b><div style="font-size:14.5px;color:var(--tx2);margin-top:4px">Без этого не увидишь, как меняется тело →</div></button>`;
  const s0 = db.bw[0].kg, c = db.bw.at(-1).kg, d = r1(c - s0);
  let h = `<div class="sec"><b>Вес тела</b><span>${db.goal ? 'цель ' + db.goal + ' кг' : ''}</span></div><div class="card"><div class="wcard"><div class="l"><b class="n">${c}</b> <span class="mu" style="font-weight:700">кг</span>${db.bw.length > 1 ? `<span class="delta ${d < 0 ? 'g' : 'n'}">${d > 0 ? '+' : ''}${d}</span>` : ''}<div style="font-size:14px;color:var(--tx2);margin-top:2px">старт ${s0} кг</div></div>${spark(db.bw.slice(-12).map(x => x.kg))}</div>`;
  if (db.goal && s0 > db.goal) {const p = Math.min(1, Math.max(0, (s0 - c) / (s0 - db.goal))); h += `<div class="bar" style="margin-top:16px"><i style="width:${p * 100}%;background:var(--ok)"></i></div><div class="bl2"><span>${Math.round(p * 100)}% пути</span><span>осталось ${r1(Math.max(0, c - db.goal))} кг</span></div>`;}
  else if (!db.goal) h += `<p style="font-size:14px;color:var(--tx2);margin-top:10px">Поставь цель во вкладке «Тело» — появится шкала.</p>`;
  return h + `</div>`;
}

function bind(go, nw, ak, rp) {
  $('#gonow').onclick = () => {updDB(d => ({...d, wo: nw})); go('train', true);};
  const gl = $('#golive'); if (gl) gl.onclick = () => {const [ph, wo] = WK.splitKey(ak); updDB(d => ({...d, phase: ph, wo})); go('train', true);};
  const gp = $('#gophase'); if (gp) gp.onclick = () => {updDB(d => ({...d, phase: rp, wo: P.woKeys(d, rp)[0]})); renderHome(go); toast('Этап ' + rp.slice(1) + ' — поехали!');};
  const gb = $('#gobody'); if (gb) gb.onclick = () => go('body');
  const gk = $('#gobackup'); if (gk) gk.onclick = () => go('body', false, 'backup');
  const ss = $('#h-stsave'); if (ss) ss.onclick = () => saveStale(ak, () => renderHome(go));
  const sd = $('#h-stdrop'); if (sd) sd.onclick = () => {if (confirm('Удалить незавершённую тренировку?')) {dropDraft(ak); renderHome(go);}};
}

export function tickLive() {
  const ak = WK.activeKey(), le = $('#liveel');
  if (le && ak) le.textContent = fmtT((Date.now() - draft(ak).start) / 1000);
}

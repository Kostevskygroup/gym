// Завершение тренировки: проверки, сохранение, экран итогов с отменой.
import {$, toast, openSheet, closeSheet, sheetHead, fadeRows} from '../ui.js';
import {state} from '../store.js';
import * as P from '../program.js';
import * as WK from '../workout.js';
import {prMap, vol} from '../logic.js';
import {esc, fmtD, fmtN, ruDec, r1, plural, UNIT} from '../format.js';
import {ACH} from '../stats.js';
import {keepAwake, haptic} from '../platform.js';
import {stopRest} from '../timer.js';
import {planWeek} from '../logic.js';
import {backupDue} from '../backup.js';

let go = () => {};
export const onFinishNav = fn => {go = fn;};

export function finish(k) {
  const miss = WK.pending(k);
  if (miss.length) {
    const n = miss.reduce((a, m) => a + m.n, 0), names = miss.slice(0, 3).map(m => P.exOf(state.db, m.id).n).join(', ');
    if (!confirm(`Не отмечено ${n} ${plural(n, 'подход', 'подхода', 'подходов')}: ${names}${miss.length > 3 ? '…' : ''}. Завершить без них?`)) return;
  }
  if (!WK.buildSession(k)) {toast('Отметь ✓ хотя бы один подход'); return;}
  askPains(k, WK.painsToAsk(k), () => save(k));
}

const JQ = {knee: 'Как колени сегодня?', back: 'Как спина сегодня?', shoulder: 'Как плечи сегодня?', elbow: 'Как локти сегодня?', wrist: 'Как запястья сегодня?', neck: 'Как шея сегодня?', hip: 'Как тазобедренные сегодня?', ankle: 'Как голеностоп сегодня?'};
// По очереди про каждый отслеживаемый сустав, который нагружала тренировка.
function askPains(k, joints, next) {
  if (!joints.length) {closeSheet(); next(); return;}
  const [j, ...rest] = joints;
  openSheet(`${sheetHead(JQ[j] || 'Как самочувствие?', rest.length ? `ещё ${rest.length}` : '')}<div class="sc"><p class="hint2 lead">0 — ничего не чувствую, 10 — сильная боль. От этого зависит, повышать ли вес в упражнениях на этот сустав.</p>
    <div class="knees">${Array.from({length: 11}, (_, i) => `<button data-v="${i}">${i}</button>`).join('')}</div></div>`, sh => {
    sh.querySelectorAll('[data-v]').forEach(b => b.onclick = () => {WK.setPain(k, j, +b.dataset.v); askPains(k, rest, next);});
  });
}

export function saveStale(k, after) {
  if (!WK.buildSession(k)) {toast('В этой тренировке нет отмеченных подходов'); return;}
  const run = () => {
    const s = WK.buildSession(k), r = WK.commit(k, s);
    if (!r.ok) {toast('Не сохранилось — сделай резервную копию в «Тело»'); return;}
    toast('Сохранено с датой ' + fmtD(s.date));
    after && after();
  };
  askPains(k, WK.painsToAsk(k), run);
}

function save(k) {
  const s = WK.buildSession(k);
  const r = WK.commit(k, s);
  if (!r.ok) {toast('Не сохранилось! Сделай резервную копию в «Тело»'); return;}
  stopRest();
  keepAwake(false);
  showDone(s, r, k);
}

function improvements(s) {
  const exOf = id => P.exOf(state.db, id);
  const prev = state.db.sessions.filter(x => x.id !== s.id && x.phase === s.phase && x.wo === s.wo).at(-1);
  if (!prev) return [];
  return Object.entries(s.entries).flatMap(([id, e]) => {
    const t = exOf(id).t, before = prev.entries[id];
    if (!before) return [];
    if (t === 'w') {const d = vol({entries: {[id]: e}}, exOf) - vol({entries: {[id]: before}}, exOf); return d > 0 ? [`${exOf(id).n}: +${Math.round(d)} кг объёма`] : [];}
    const d = e.reduce((a, x) => a + x.b, 0) - before.reduce((a, x) => a + x.b, 0);
    return d > 0 ? [`${exOf(id).n}: +${d} ${UNIT[t]}`] : [];
  });
}

export function report(s, prs) {
  const exOf = id => P.exOf(state.db, id), lw = state.db.bw.at(-1);
  let t = `Неделя ${planWeek(state.db.sessions.filter(x => x.id !== s.id), new Date(s.date))} · ${P.phaseOf(state.db, s.phase).label} · ${s.wo} · ${fmtD(s.date)}${s.dur ? ' · ' + s.dur + ' мин' : ''}\n`;
  Object.entries(s.entries).forEach(([id, e]) => {
    const x = exOf(id);
    t += `${x.n}: ${e.map(r => x.t === 'w' ? `${r.a}×${r.b}` : r.b).join(', ')}${s.swaps && Object.values(s.swaps).includes(id) ? ' (замена)' : ''}\n`;
  });
  t += `Объём: ${Math.round(vol(s, exOf))} кг · Колени: ${s.knee === null ? 'не указано' : s.knee + '/10'}`;
  if (prs.length) t += `\nРекорды: ${prs.map(p => exOf(p.id).n + ' ' + p.txt).join('; ')}`;
  if (lw) t += `\nВес тела: ${lw.kg} кг (${fmtD(lw.date)})`;
  return t;
}

function showDone(s, r, k) {
  const exOf = id => P.exOf(state.db, id), prs = prMap(state.db.sessions, exOf).get(s.id) || [];
  const v = vol(s, exOf), ns = Object.values(s.entries).reduce((a, e) => a + e.length, 0), imps = improvements(s);
  $('#d-title').textContent = prs.length ? (prs.length === 1 ? 'Новый рекорд!' : `${prs.length} ${plural(prs.length, 'новый рекорд', 'новых рекорда', 'новых рекордов')}!`) : 'Отличная работа!';
  $('#d-sub').textContent = `${s.wo} · №${state.db.sessions.length}`;
  $('#d-stats').innerHTML = [['Время', s.dur || 0, 'мин'], ['Объём', v >= 1000 ? r1(v / 1000) : Math.round(v), v >= 1000 ? 'т' : 'кг'], ['Подходов', ns, ''], ['Рекордов', prs.length, '']]
    .filter(([, n]) => n > 0)
    .map(([l, n, u]) => `<div><small>${l}</small><b class="n"><em data-cnt="${n}">0</em>${u ? `<span>${u}</span>` : ''}</b></div>`).join('');
  $('#d-hl').innerHTML = prs.map(p => `<p class="pr"><i>PR</i><span>${esc(exOf(p.id).n)}: ${esc(ruDec(p.txt))}</span></p>`).join('')
    + imps.map(x => `<p class="im"><i>↑</i><span>${esc(ruDec(x))}</span></p>`).join('')
    + (s.knee > 3 ? `<p class="wr"><i>!</i><span>Колени ${s.knee}/10 — вес на ноги в следующий раз не повышаем</span></p>` : '');
  $('#d-ach').innerHTML = r.fresh.length ? `<div class="sec"><b>Новые достижения</b><span>${r.fresh.length}</span></div><div class="medals">${r.fresh.map(x => {const a = ACH.find(y => y[2] === x); return `<div class="md"><span>${esc(a ? a[1] : '★')}</span>${esc(x)}</div>`;}).join('')}</div>` : '';
  $('#d-txt').textContent = report(s, prs);
  const due = backupDue(state.db);
  $('#d-backup').style.display = due.due ? 'flex' : 'none';
  $('#doneov').classList.add('on');
  $('#doneov').scrollTop = 0;
  fadeRows($('#d-ach'));
  haptic([30, 60, 30]);
  countUp();
  confetti(prs.length || r.fresh.length ? 160 : 70);
  $('#d-undo').onclick = () => {
    if (!confirm('Отменить сохранение? Тренировка вернётся в работу.')) return;
    WK.undoCommit(s, k, r.keep, r.prevAch);
    $('#doneov').classList.remove('on');
    go('train');
    toast('Вернул тренировку — продолжай');
  };
}

const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp() {
  document.querySelectorAll('[data-cnt]').forEach(el => {
    const to = +el.dataset.cnt, dec = to % 1 !== 0;
    if (RM()) {el.textContent = fmtN(to, 1); return;}
    const t0 = performance.now();
    const f = t => {const p = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - p, 3); el.textContent = dec ? fmtN((to * e).toFixed(1), 1) : Math.round(to * e); if (p < 1) requestAnimationFrame(f);};
    requestAnimationFrame(f);
  });
}
function confetti(n) {
  if (RM()) return;
  const cv = $('#conf'), dpr = devicePixelRatio || 1, W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
  const cols = ['#F5C842', '#6BC28A', '#FFE08A', '#F1F6F2', '#BFE8CC'];
  const ps = Array.from({length: n}, (_, i) => ({x: W / 2, y: H * 0.22, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 12 - 4, s: Math.random() * 7 + 4, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, c: cols[i % cols.length], w: i % 2}));
  const t0 = performance.now();
  const f = t => {
    x.clearRect(0, 0, W, H);
    const age = (t - t0) / 1000;
    ps.forEach(p => {p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; x.save(); x.globalAlpha = Math.max(0, 1 - age / 3); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; if (p.w) x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); else {x.beginPath(); x.arc(0, 0, p.s / 3, 0, 7); x.fill();} x.restore();});
    if (age < 3.2) requestAnimationFrame(f); else x.clearRect(0, 0, W, H);
  };
  requestAnimationFrame(f);
}

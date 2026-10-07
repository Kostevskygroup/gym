// Запуск приложения: загрузка данных, навигация, офлайн, защита от сбоев.
import {$, $$, toast, closeSheet, sheetOpen} from './ui.js';
import {state, load, storageWorks, rawExport, updDB, setDB} from './store.js';
import * as WK from './workout.js';
import {registerSW, saveFile, pendingUpdate} from './platform.js';
import {resumeRest, stopRest, adjust} from './timer.js';
import {unlockAudio} from './platform.js';
import {renderHome, tickLive} from './views/home.js';
import {renderTrain, updDot, tickElapsed, scrollToCurrent} from './views/train.js';
import {renderProg} from './views/progress.js';
import {renderBody} from './views/body.js';
import {onFinishNav} from './views/finish.js';
import {onPlanClose} from './views/plan.js';
import {refreshCovers} from './views/covers.js';
import {ymd} from './format.js';
import {startAutoSync, syncNow, setPendingInvite} from './sync.js';
import {stats, checkAch} from './stats.js';

// Достижения по уже существующей истории (после переноса или восстановления) — без поздравлений.
function backfillAch() {
  const {ach, fresh} = checkAch(state.db.ach, stats(state.db));
  if (fresh.length) setDB({...state.db, ach});
}
function onProfile() {
  document.querySelector('#timer').classList.remove('on', 'over');
  document.body.classList.remove('timing');
  backfillAch();
  updDot();
  resumeRest();
  refreshCovers().then(() => {if (cur === 'train') renderTrain();});
  go('home');
  syncNow().catch(() => {});
}

const VIEWS = {home: renderHome, train: renderTrain, prog: renderProg, body: renderBody};
let cur = 'home';
const scrollPos = {};

export function go(v, toCurrent, focus) {
  scrollPos[cur] = $('#app').scrollTop;
  cur = v;
  $$('nav button').forEach(x => x.classList.toggle('on', x.dataset.v === v));
  $$('.view').forEach(x => x.classList.toggle('on', x.id === 'v-' + v));
  try {
    if (v === 'home') renderHome(go); else if (v === 'body') renderBody(focus); else VIEWS[v]();
  } catch (e) {crash(e); return;}
  updDot();
  if (v === 'train' && (toCurrent || WK.activeKey() === WK.curKey())) requestAnimationFrame(scrollToCurrent);
  else $('#app').scrollTop = focus ? $('#app').scrollTop : (scrollPos[v] || 0);
}

function crash(e) {
  console.error(e);
  const el = $('#crash');
  el.querySelector('pre').textContent = String(e && e.stack || e).slice(0, 600);
  el.classList.add('on');
}

function bindGlobal() {
  $$('nav button').forEach(b => b.onclick = () => {if (sheetOpen()) closeSheet(); go(b.dataset.v);});
  $('#sheetov').onclick = e => {if (e.target.id === 'sheetov') closeSheet();};
  // ✕ в шапке любой шторки; делегирование переживает перерисовку содержимого.
  $('#sheet').addEventListener('click', e => {if (e.target.closest('[data-close]')) closeSheet();});
  $('#tplus').onclick = () => {unlockAudio(); adjust(15);};
  $('#tminus').onclick = () => {unlockAudio(); adjust(-15);};
  $('#tstop').onclick = stopRest;
  $('#d-close').onclick = () => {$('#doneov').classList.remove('on'); go('home');};
  $('#d-copy').onclick = async () => {
    try {await navigator.clipboard.writeText($('#d-txt').textContent); toast('Скопировано — вставь в чат');}
    catch (e) {$('.chat').open = true; const r = document.createRange(); r.selectNodeContents($('#d-txt')); getSelection().removeAllRanges(); getSelection().addRange(r); toast('Выделено — скопируй вручную');}
  };
  $('#d-backup').onclick = () => {$('#doneov').classList.remove('on'); go('body', false, 'backup');};
  $('#crash-save').onclick = () => saveFile(`gym-raw-${ymd(new Date())}.json`, rawExport()).catch(() => {});
  $('#crash-reload').onclick = () => {const u = pendingUpdate(); if (u) u(); else location.reload();};
  window.addEventListener('error', e => crash(e.error || e.message));
  window.addEventListener('unhandledrejection', e => crash(e.reason));
  setInterval(() => {tickElapsed(); tickLive();}, 1000);
  addEventListener('gym:profile', onProfile);
  // с другого телефона пришли новые данные — перерисовать экран (кроме идущей тренировки)
  addEventListener('gym:remote', () => {if (cur !== 'train' && !sheetOpen()) go(cur);});
  addEventListener('gym:savefail', () => toast('Не сохранилось — на телефоне закончилось место. Сохрани копию в «Тело»'));
  onFinishNav(go);
  onPlanClose(() => {if (cur === 'train') renderTrain();});
}

function start() {
  if (!storageWorks()) $('#warn').classList.add('on');
  // …/gym/?invite=ZAL-XXXX-XXXX — запоминаем код и убираем его из адреса
  try {
    const u = new URL(location.href), inv = u.searchParams.get('invite');
    if (inv) {setPendingInvite(inv); u.searchParams.delete('invite'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash);}
  } catch (e) {}
  bindGlobal();
  registerSW(apply => toast('Есть обновление приложения', {label: 'Обновить', run: apply}));
  try {load();} catch (e) {crash(e); return;}
  backfillAch();
  updDot();
  resumeRest();
  const ak = WK.activeKey();
  if (ak && !WK.isStale(state.dr[ak])) {
    const [ph, wo] = WK.splitKey(ak);
    updDB(d => ({...d, phase: ph, wo}));
    go('train', true);
  } else go('home');
  refreshCovers().then(() => {if (cur === 'train') renderTrain();});
  startAutoSync();
}

start();

// Таймер отдыха. Конец хранится в черновике — переживает перезапуск приложения.
// После нуля не исчезает: показывает «Отдых окончен +0:12», пока не нажмёшь «Готов» или ✓.
import {$} from './ui.js';
import {state, setRest} from './store.js';
import {fmtT} from './format.js';
import {beep, haptic} from './platform.js';

let int = null, rang = false;

export function startRest(sec, label) {
  if (!sec) return;
  rang = false;
  setRest({end: Date.now() + sec * 1000, tot: sec, label: label || 'Отдых'});
  show();
}
export function stopRest() {
  setRest(null);
  clearInterval(int); int = null;
  $('#timer').classList.remove('on', 'over');
  document.body.classList.remove('timing');
}
export function adjust(sec) {
  const r = state.dr.rest, now = Date.now();
  if (!r || (sec < 0 && r.end <= now)) return;
  const end = Math.max(now + 1000, Math.max(now, r.end) + sec * 1000);
  setRest({...r, end, tot: Math.max(r.tot + (sec > 0 ? sec : 0), 1)});
  rang = end > Date.now() ? false : rang;
  tick();
}
export function resumeRest() {if (state.dr.rest) {rang = state.dr.rest.end <= Date.now(); show();}}

function show() {
  $('#timer').classList.add('on');
  document.body.classList.add('timing');
  clearInterval(int);
  int = setInterval(tick, 250);
  tick();
}

const OVER_LIMIT_S = 600;
function tick() {
  const r = state.dr.rest;
  if (!r) {stopRest(); return;}
  const left = (r.end - Date.now()) / 1000, over = left <= 0;
  $('#timer').classList.toggle('over', over);
  $('#tlabel').textContent = over ? 'Отдых окончен — подход!' : r.label;
  $('#tval').textContent = over ? '+' + fmtT(-left) : fmtT(Math.ceil(left));
  $('#timer').style.setProperty('--p', over ? 1 : Math.max(0, left) / r.tot);
  $('#timer').classList.toggle('low', !over && left <= 10);
  if (over && !rang) {rang = true; beep(); haptic([250, 120, 250]);}
  if (-left > OVER_LIMIT_S) stopRest();
}

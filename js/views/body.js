// Экран «Тело»: вес, талия, цель и резервная копия.
import {$, $$, toast, openSheet, closeSheet} from '../ui.js';
import {state, updDB, setDB, snapshot, undoSnapshot, rawExport, unlock, dropSnapshot} from '../store.js';
import {stats, checkAch} from '../stats.js';
import {parseBackup, mergeDB, makeBackup} from '../backup.js';
import {exportPhotos, importPhotos} from '../photos.js';
import {saveFile, pickFile, persistStorage, pendingUpdate} from '../platform.js';
import {esc, fmtD, r1, plural, ymd, num, DAY} from '../format.js';
import {chart} from './chart.js';

let key = 'kg', prepared = null, persisted = 'unknown';

export function renderBody(focus) {
  const db = state.db, arr = key === 'kg' ? db.bw.map(x => ({d: x.date, y: x.kg})) : db.waist.map(x => ({d: x.date, y: x.v}));
  let h = `<div class="pt"><small>Раз в неделю, утром натощак</small><h1>Тело</h1></div>
  <div class="card"><div class="fields"><label>Вес, кг<input id="bwval" inputmode="decimal" placeholder="${db.bw.length ? db.bw.at(-1).kg : '—'}"></label><label>Талия, см<input id="wsval" inputmode="decimal" placeholder="${db.waist.length ? db.waist.at(-1).v : 'по пупку'}"></label></div>
  <button class="btn" id="bwsave" style="margin-top:14px">Записать замер</button></div>
  <div class="seg" style="margin-top:20px" id="bseg"><button class="${key === 'kg' ? 'on' : ''}" data-k="kg">Вес</button><button class="${key === 'waist' ? 'on' : ''}" data-k="waist">Талия</button></div>`;
  if (arr.length > 1) {
    const d = r1(arr.at(-1).y - arr[0].y), wk = Math.max(1, Math.round((new Date(arr.at(-1).d) - new Date(arr[0].d)) / 7 / DAY));
    h += `<div class="g2" style="margin-top:12px"><div class="st"><small>Сейчас</small><b class="n">${arr.at(-1).y}<span> ${key === 'kg' ? 'кг' : 'см'}</span></b><i>старт ${arr[0].y}</i></div><div class="st"><small>Изменение</small><b class="n" style="color:${d < 0 ? 'var(--ok)' : 'var(--tx)'}">${d > 0 ? '+' : ''}${d}</b><i>за ${wk} ${plural(wk, 'неделю', 'недели', 'недель')}</i></div></div>`;
  }
  h += arr.length ? chart(arr, key === 'kg' ? 'Вес тела' : 'Талия', key === 'kg' ? db.goal : null) : `<p class="empty">${key === 'kg' ? 'Запиши стартовый вес.' : 'Талия — лучший показатель ухода жира. Вес может стоять, а талия уходить.'}</p>`;
  h += `<div class="sec"><b>Цель по весу</b></div><div class="card" style="display:flex;gap:10px;align-items:flex-end"><div class="fields" style="flex:1;grid-template-columns:1fr"><label>Хочу весить, кг<input id="goalval" inputmode="decimal" value="${db.goal || ''}" placeholder="—"></label></div><button class="btn sm" id="goalsave" style="height:58px">Сохранить</button></div>`;
  h += backupCard(db);
  const all = [...db.bw.map(x => ({d: x.date, t: x.kg + ' кг', k: 'bw'})), ...db.waist.map(x => ({d: x.date, t: 'Талия ' + x.v + ' см', k: 'waist'}))].sort((a, b) => b.d.localeCompare(a.d));
  if (all.length) h += `<div class="sec"><b>Замеры</b></div>` + all.map(x => `<details class="hist"><summary><b>${esc(x.t)}</b><span class="rt">${fmtD(x.d)}</span></summary><div class="hb"><button class="del" data-bd="${x.k}|${esc(x.d)}">Удалить</button></div></details>`).join('');
  $('#v-body').innerHTML = h;
  bind();
  prepare();
  persistStorage().then(p => {persisted = p; const e = $('#pstat'); if (e) e.innerHTML = persistTxt();});
  if (focus === 'backup') $('#backup').scrollIntoView({block: 'start'});
}

const persistTxt = () => persisted === 'yes' ? '✓ Телефон не будет очищать эти данные сам' : persisted === 'no' ? 'Телефон может очистить данные при нехватке места — делай копии' : '';

function backupCard(db) {
  return `<div class="sec" id="backup"><b>Резервная копия</b></div><div class="card bk">
  <p>Все тренировки, замеры, заметки и твои фото хранятся только на этом телефоне. <b>Если удалить иконку с экрана «Домой» или сменить телефон — без копии всё пропадёт.</b> Сохраняй копию в «Файлы» (iCloud Drive) раз в пару недель.</p>
  <p class="mu" id="pstat">${persistTxt()}</p>
  <p class="mu">${db.lastBackup ? 'Последняя копия: ' + fmtD(db.lastBackup) : 'Копий ещё не было'}</p>
  <button class="btn" id="bexp">Сохранить копию файлом</button>
  <div class="g2" style="margin-top:8px"><button class="btn s2" id="bimp">Восстановить из файла</button><button class="btn s2" id="bpaste">Вставить текст</button></div>
  <button class="textbtn" id="bcopy">Скопировать копию текстом (без фото)</button></div>
  ${pendingUpdate() ? '<button class="btn" style="margin-top:12px" id="bupd">Обновить приложение</button>' : ''}`;
}

// Готовим файл заранее: «Поделиться» на iPhone должно открываться сразу по нажатию.
function prepare() {
  prepared = null;
  exportPhotos().then(photos => ({photos, failed: false}), e => {console.error('photos export', e); return {photos: [], failed: true};})
    .then(({photos, failed}) => {prepared = {json: JSON.stringify(makeBackup(state.db, photos)), failed};})
    .catch(e => console.error(e));
}

function bind() {
  $$('#bseg button').forEach(b => b.onclick = () => {key = b.dataset.k; renderBody();});
  $('#bwsave').onclick = () => {
    const kg = num($('#bwval').value), ws = num($('#wsval').value), d = new Date().toISOString();
    const okK = kg > 30 && kg < 250, okW = ws > 40 && ws < 200;
    if (!okK && !okW) {toast('Введи вес (30–250) или талию (40–200)'); return;}
    const next = {...state.db, bw: okK ? [...state.db.bw, {date: d, kg}] : state.db.bw, waist: okW ? [...state.db.waist, {date: d, v: ws}] : state.db.waist};
    const {ach, fresh} = checkAch(next.ach, stats(next));
    setDB({...next, ach});
    renderBody();
    toast(fresh.length ? '★ Достижение: ' + fresh[0] : 'Записано');
  };
  $('#goalsave').onclick = () => {const g = num($('#goalval').value); if (!(g > 40 && g < 200)) {toast('Введи цель в кг'); return;} updDB(d => ({...d, goal: g})); renderBody(); toast('Цель сохранена');};
  $('#bexp').onclick = () => {
    if (!prepared) {toast('Готовлю копию… нажми ещё раз через секунду'); return;}
    if (prepared.failed && !confirm('Фото не удалось добавить в копию. Сохранить копию без фото?')) return;
    const failed = prepared.failed;
    saveFile(`gym-backup-${ymd(new Date())}.json`, prepared.json).then(() => {updDB(d => ({...d, lastBackup: new Date().toISOString()})); renderBody(); toast(failed ? 'Копия сохранена без фото' : 'Копия сохранена');})
      .catch(e => {if (e && e.name !== 'AbortError') {console.error(e); toast('Не получилось: ' + (e.message || e));}});
  };
  $('#bimp').onclick = async () => {const f = await pickFile('.json,application/json,text/plain'); if (f) restore(await f.text());};
  $('#bpaste').onclick = () => pasteSheet();
  const up = $('#bupd'); if (up) up.onclick = () => {const u = pendingUpdate(); if (u) u();};
  $('#bcopy').onclick = async () => {
    const v = JSON.stringify(makeBackup(state.db, []));
    try {await navigator.clipboard.writeText(v); updDB(d => ({...d, lastBackup: new Date().toISOString()})); toast('Скопировано — вставь в Заметки');}
    catch (e) {pasteSheet(v);}
  };
  $$('[data-bd]').forEach(b => b.onclick = () => {
    const [k, d] = b.dataset.bd.split('|');
    if (!confirm('Удалить этот замер?')) return;
    const removed = state.db[k].find(x => x.date === d);
    updDB(db => ({...db, [k]: db[k].filter(x => x.date !== d)}));
    renderBody();
    toast('Замер удалён', {label: 'Вернуть', run: () => {updDB(db => ({...db, [k]: [...db[k], removed].sort((a, b) => a.date.localeCompare(b.date))})); renderBody();}});
  });
}

// Вставка текста: и для переноса из старой версии приложения, и как запасной путь копирования.
function pasteSheet(text) {
  const copyMode = typeof text === 'string';
  openSheet(`<span class="grab"></span><div class="sc"><h2>${copyMode ? 'Скопируй текст' : 'Вставь текст копии'}</h2>
    <p class="hint2">${copyMode ? 'Выдели всё и скопируй в Заметки.' : 'В старой версии приложения: «Тело» → «Скопировать копию». Потом вставь сюда.'}</p>
    <textarea id="pt" rows="8" ${copyMode ? 'readonly' : 'placeholder="{&quot;sessions&quot;: …}"'}>${copyMode ? esc(text) : ''}</textarea>
    ${copyMode ? '' : '<button class="btn" style="margin-top:12px" id="ptgo">Восстановить</button>'}
    <button class="btn s2" style="margin-top:8px" id="ptclose">Закрыть</button></div>`, sh => {
    sh.querySelector('#ptclose').onclick = closeSheet;
    const go = sh.querySelector('#ptgo');
    if (go) go.onclick = () => {const v = sh.querySelector('#pt').value; closeSheet(); restore(v);};
    if (copyMode) sh.querySelector('#pt').select();
  });
}

async function restore(text) {
  let b;
  try {b = parseBackup(text);} catch (e) {toast(e.message); return;}
  const inc = b.db, cur = state.db, last = inc.sessions.at(-1);
  const msg = `В копии: ${inc.sessions.length} трен.${last ? ', последняя ' + fmtD(last.date) : ''}, ${inc.bw.length} замеров веса${b.photos.length ? ', ' + b.photos.length + ' фото' : ''}.\nСейчас: ${cur.sessions.length} трен.\n\nДобавить недостающее? Ничего не удалится.`;
  if (!confirm(msg)) return;
  if (!state.ok) unlock();
  if (!snapshot() && !confirm('Не хватает места для отката. Восстановить без возможности отменить?')) return;
  const {db, added} = mergeDB(cur, inc);
  const {ach} = checkAch(db.ach, stats(db));
  if (!setDB({...db, ach})) {toast('Не сохранилось — на телефоне закончилось место'); return;}
  let np = 0, photoErr = false;
  try {np = await importPhotos(b.photos);} catch (e) {console.error(e); photoErr = true;}
  renderBody();
  const nm = added.bw + added.waist;
  toast(`Добавлено: ${added.sessions} трен., ${nm} ${plural(nm, 'замер', 'замера', 'замеров')}${np ? ', ' + np + ' фото' : ''}${photoErr ? ' (фото не восстановились)' : ''}`, {label: 'Отменить', run: () => {undoSnapshot(); renderBody(); toast('Восстановление отменено');}});
  setTimeout(dropSnapshot, 7000);
}

export const emergencyExport = () => saveFile(`gym-raw-${ymd(new Date())}.json`, rawExport());

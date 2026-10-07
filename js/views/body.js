// Экран «Тело»: вес, талия, цель и резервная копия.
import {$, $$, toast, openSheet, closeSheet, ICON, sheetHead} from '../ui.js';
import {state, updDB, setDB, snapshot, undoSnapshot, rawExport, unlock, dropSnapshot} from '../store.js';
import {stats, checkAch} from '../stats.js';
import {parseBackup, mergeDB, makeBackup, tombstone, untomb} from '../backup.js';
import {exportPhotos, importPhotos} from '../photos.js';
import {saveFile, pickFile, persistStorage, pendingUpdate} from '../platform.js';
import {esc, fmtD, fmtN, signed, NNBSP, r1, plural, ymd, num, DAY, ago} from '../format.js';
import {chart} from './chart.js';
import {account, cloudOk} from '../sync.js';

// Имя профиля в названии файла: копии разных людей не перепутать.
const fileTag = () => {const n = state.db.settings && state.db.settings.name; return n ? n.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 20) + '-' : '';};
let key = 'kg', prepared = null, persisted = 'unknown';

export function renderBody(focus) {
  const db = state.db, arr = key === 'kg' ? db.bw.map(x => ({d: x.date, y: x.kg})) : db.waist.map(x => ({d: x.date, y: x.v}));
  let h = `<div class="pt"><small>Раз в неделю, утром натощак</small><h1>Тело</h1></div>
  <div class="card"><div class="fields"><label>Вес, кг<input id="bwval" inputmode="decimal" placeholder="${db.bw.length ? 'было ' + fmtN(db.bw.at(-1).kg, 1) : '—'}"></label><label>Талия, см<input id="wsval" inputmode="decimal" placeholder="${db.waist.length ? 'было ' + fmtN(db.waist.at(-1).v, 1) : 'по пупку'}"></label></div>
  <button class="btn" id="bwsave" style="margin-top:16px">Записать замер</button></div>
  <div class="seg" style="margin-top:24px" id="bseg"><button class="${key === 'kg' ? 'on' : ''}" data-k="kg">Вес</button><button class="${key === 'waist' ? 'on' : ''}" data-k="waist">Талия</button></div>`;
  if (arr.length > 1) {
    const d = r1(arr.at(-1).y - arr[0].y), wk = Math.max(1, Math.round((new Date(arr.at(-1).d) - new Date(arr[0].d)) / 7 / DAY));
    const u = key === 'kg' ? 'кг' : 'см';
    h += `<div class="g2" style="margin-top:12px"><div class="st"><small>Сейчас</small><b class="n">${fmtN(arr.at(-1).y, 1)}<span>${u}</span></b><i>старт ${fmtN(arr[0].y, 1)}${NNBSP}${u}</i></div><div class="st"><small>Изменение</small><b class="n${d < 0 ? ' good' : ''}">${signed(d)}<span>${u}</span></b><i>за ${wk} ${plural(wk, 'неделю', 'недели', 'недель')}</i></div></div>`;
  }
  h += arr.length ? chart(arr, key === 'kg' ? 'Вес тела' : 'Талия', key === 'kg' ? db.goal : null) : `<p class="empty">${key === 'kg' ? 'Запиши стартовый вес.' : 'Талия — лучший показатель ухода жира. Вес может стоять, а талия уходить.'}</p>`;
  h += `<div class="sec"><b>Цель по весу</b></div><div class="card goalc"><div class="fields"><label>Хочу весить, кг<input id="goalval" inputmode="decimal" value="${db.goal ? fmtN(db.goal, 1) : ''}" placeholder="—"></label></div><button class="btn sm" id="goalsave">Сохранить</button></div>`;
  h += backupCard(db);
  const all = [...db.bw.map(x => ({d: x.date, t: fmtN(x.kg, 1) + NNBSP + 'кг', k: 'bw'})), ...db.waist.map(x => ({d: x.date, t: 'Талия ' + fmtN(x.v, 1) + NNBSP + 'см', k: 'waist'}))].sort((a, b) => b.d.localeCompare(a.d));
  if (all.length) h += `<div class="sec"><b>Замеры</b></div><div class="glist">` + all.map(x => `<details class="hist m"><summary><span class="t"><b class="n">${esc(x.t)}</b></span><span class="rt">${fmtD(x.d)}</span>${ICON.chev}</summary><div class="hb"><button class="del" data-bd="${x.k}|${esc(x.d)}">Удалить</button></div></details>`).join('') + '</div>';
  $('#v-body').innerHTML = h;
  bind();
  prepare();
  persistStorage().then(p => {persisted = p; const e = $('#pstat'); if (e) e.innerHTML = persistTxt();});
  if (focus === 'backup') $('#backup').scrollIntoView({block: 'start'});
}

const persistTxt = () => persisted === 'yes' ? '✓ Телефон не будет очищать эти данные сам' : persisted === 'no' ? 'Телефон может очистить данные при нехватке места — делай копии' : '';

// С включённым облаком копия — страховка на всякий случай, а не единственная защита данных.
function backupCard(db) {
  const a = account(), cloud = cloudOk();
  const lead = cloud
    ? `<p><b>Данные в облаке</b> · ${a.at ? 'синхронизировано ' + ago(a.at) : 'синхронизация…'}. Файл-копия — на всякий случай, например перед сменой телефона.</p>`
    : `<p>Все тренировки, замеры, заметки и твои фото хранятся только на этом телефоне. <b>Если удалить иконку с экрана «Домой» или сменить телефон — без копии всё пропадёт.</b> Сохраняй копию в «Файлы» (iCloud Drive) раз в пару недель.</p>`;
  return `<div class="sec" id="backup"><b>Резервная копия</b><span>${db.lastBackup ? 'Последняя копия: ' + fmtD(db.lastBackup) : 'Копий ещё не было'}</span></div><div class="card bk">
  ${lead}
  <p class="mu" id="pstat">${persistTxt()}</p>
  <button class="btn${cloud ? ' s2' : ''}" id="bexp">Сохранить копию файлом</button>
  <div class="bkl"><button id="bimp">Восстановить из файла${ICON.chev}</button><button id="bpaste">Вставить текст${ICON.chev}</button><button id="bcopy">Скопировать текстом — без фото${ICON.chev}</button></div></div>
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
    saveFile(`gym-backup-${fileTag()}${ymd(new Date())}.json`, prepared.json).then(() => {updDB(d => ({...d, lastBackup: new Date().toISOString()})); renderBody(); toast(failed ? 'Копия сохранена без фото' : 'Копия сохранена');})
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
    updDB(db => tombstone(db, k, d));
    renderBody();
    toast('Замер удалён', {label: 'Вернуть', run: () => {updDB(db => ({...untomb(db, k, d), [k]: [...db[k], removed].sort((a, b) => a.date.localeCompare(b.date))})); renderBody();}});
  });
}

// Вставка текста: и для переноса из старой версии приложения, и как запасной путь копирования.
function pasteSheet(text) {
  const copyMode = typeof text === 'string';
  openSheet(`${sheetHead(copyMode ? 'Скопируй текст' : 'Вставь текст копии')}<div class="sc">
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

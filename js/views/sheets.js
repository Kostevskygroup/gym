// Шторки: техника на фото твоего тренажёра, свои фото, замена, заметка и шаг веса.
import {toast, openSheet, closeSheet, ICON, sheetHead} from '../ui.js';
import {state, draft, updDB} from '../store.js';
import * as P from '../program.js';
import * as L from '../logic.js';
import * as WK from '../workout.js';
import {esc, fmtD, fmtN} from '../format.js';
import {EQUIP, hasPhoto} from '../data/equipment.js';
import {GUIDE, PHOTO_W, PHOTO_H, guideFor} from '../data/guides.js';
import {moveHtml} from '../anim/player.js';

const PIN_R = 24;

function guideSvg(id, e) {
  const g = guideFor(id, e.img);
  if (!g || !hasPhoto(e.img)) return '';
  const arrows = (g.arrows || []).map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#0D1A16" stroke-width="16" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#F5C842" stroke-width="9" stroke-linecap="round" marker-end="url(#ah)"/>`).join('');
  const pins = g.pins.map(([x, y], i) => `<g class="pin" data-pin="${i}"><circle cx="${x}" cy="${y}" r="${PIN_R + 6}" fill="rgba(13,26,22,.55)"/><circle cx="${x}" cy="${y}" r="${PIN_R}" fill="#F5C842" stroke="#0D1A16" stroke-width="4"/><text x="${x}" y="${y + 9}" text-anchor="middle" font-size="26" font-weight="900" fill="#17150A">${i + 1}</text></g>`).join('');
  return `<div class="guide"><svg viewBox="0 0 ${PHOTO_W} ${PHOTO_H}" role="img" aria-label="Фото тренажёра с отметками настройки">
    <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3" markerHeight="3" orient="auto"><path d="M0 0L10 5L0 10z" fill="#F5C842"/></marker></defs>
    <image href="img/${e.img}.jpg" width="${PHOTO_W}" height="${PHOTO_H}"/>${arrows}${pins}</svg></div>
    <ol class="pins">${g.pins.map(([, , t], i) => `<li data-pin="${i}"><i>${i + 1}</i><span>${esc(t)}</span></li>`).join('')}</ol>`;
}

const ytUrl = e => 'https://www.youtube.com/results?search_query=' + encodeURIComponent((e.yt || e.n.replace(/ — .*$/, '')) + ' техника выполнения');

export function openTech(id) {
  const e = P.exOf(state.db, id), note = P.noteOf(state.db, id), eq = EQUIP[e.img];
  const mv = moveHtml(id, e);
  const html = `${sheetHead(esc(e.n), 'Техника', eq ? esc(eq.n) : '')}<div class="sc">
  ${mv ? `<div class="tb2"><h4>Как делать — картинками</h4>${mv}</div>` : ''}
  ${guideSvg(id, e) ? `<div class="tb2"><h4>Настройка на твоём тренажёре</h4>${guideSvg(id, e)}</div>` : ''}
  ${e.setup ? `<div class="tb2"><p>${esc(e.setup)}</p></div>` : ''}
  ${e.knee && WK.kneeTracked() ? '<div class="tb2"><p>Нагружает колени — если болят выше 3, не повышай вес.</p></div>' : ''}
  ${note ? `<div class="tb2"><h4>Мои заметки</h4><p>${esc(note)}</p></div>` : ''}
  ${e.how.length ? `<div class="tb2"><h4>Как делать</h4><ol class="steps">${e.how.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}
  ${e.bad.length ? `<div class="tb2 bad"><h4>Частые ошибки</h4><ul class="bads">${e.bad.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
  <a class="btn s2 yt" href="${ytUrl(e)}" target="_blank" rel="noopener">${ICON.play}Видео техники на YouTube</a></div>`;
  openSheet(html, sh => {
    sh.querySelectorAll('[data-pin]').forEach(n => n.onclick = () => {const i = n.dataset.pin; sh.querySelectorAll('[data-pin]').forEach(m => m.classList.toggle('hl', m.dataset.pin === i));});
  });
}

// Порядок: «по плану» → что уже делали → без нагрузки на отмеченные суставы → остальные.
// Флажок «навсегда» — над списком: список длинный, внизу его не найти.
export function openSwap(k, it, done) {
  const db = state.db, slot = it.orig || it.id, inWo = WK.itemsFor(k).map(x => x.id), exOf = id => P.exOf(db, id);
  const alts = L.alternatives(slot, P.allEx(db), inWo.filter(x => x !== slot)), joints = WK.tracked();
  const cur = exOf(it.id), ranked = L.rankAlts(alts.filter(x => x !== it.id && x !== it.orig), exOf, id => !!L.lastFor(db.sessions, id), joints);
  const list = it.orig && it.orig !== it.id ? [it.orig, ...ranked] : ranked;
  const row = id => {
    const e = exOf(id), Ls = L.lastFor(db.sessions, id), lt = L.loadTxt(e);
    return `<button class="alt" data-to="${esc(id)}">${hasPhoto(e.img) ? `<img src="img/${e.img}.jpg" alt="">` : '<span class="noph"></span>'}<span class="t">${e.g === 'core' && P.ROLE[e.cr] ? `<small class="role">${P.ROLE[e.cr]}</small>` : ''}<b>${esc(e.n)}${id === it.orig ? '<span class="tag">по плану</span>' : ''}</b><small>${esc(EQUIP[e.img]?.n || '')}${lt ? ' · ' + lt : ''}</small><small class="n">${Ls ? 'было ' + esc(Ls.e.map(x => e.t === 'w' ? fmtN(x.a) + '×' + x.b : x.b).join(', ')) + ' · ' + fmtD(Ls.date) : 'ещё не было'}</small></span>${ICON.chev}</button>`;
  };
  openSheet(`${sheetHead(esc(cur.n), 'Замена')}<div class="sc">
    <p class="hint2">Тренажёр занят? Замена — на ту же группу мышц, только на оборудовании твоего зала.</p>
    <label class="chk"><input type="checkbox" id="swperm"> Заменить в программе навсегда</label>
    <div class="alts">${list.length ? list.map(row).join('') : '<p class="empty">Замен для этого упражнения нет.</p>'}</div></div>`, sh => {
    sh.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
      const to = b.dataset.to, rows = draft(k).ex[it.id] || [];
      if (rows.some(x => x.done) && !confirm('Отмеченные подходы по этому упражнению сбросятся. Заменить?')) return;
      const [ph, wo] = WK.splitKey(k);
      if (sh.querySelector('#swperm').checked) {
        updDB(d => P.replaceItem(d, ph, wo, slot, to));
        WK.swapEx(k, slot, slot);
        toast('Заменено в программе');
      } else {WK.swapEx(k, slot, to); toast(to === slot ? 'Снова по плану' : 'Заменено на сегодня');}
      closeSheet(); done();
    });
  });
}

const STEPS = [1, 2, 2.5, 5, 10];
export function openNote(id, done) {
  const db = state.db, e = P.exOf(db, id), cur = (db.exs || {})[id] || {note: '', step: null}, def = EQUIP[e.img]?.step || 2.5;
  let step = cur.step;
  const chips = () => STEPS.map(s => `<button class="${(step || def) === s ? 'on' : ''}" data-s="${s}">${fmtN(s)} кг${s === def ? ' ·' : ''}</button>`).join('');
  openSheet(`${sheetHead(esc(e.n), 'Заметка')}<div class="sc">
    <div class="tb2 first"><h4>Видно на каждой тренировке</h4><textarea id="nt" maxlength="500" rows="4" placeholder="Например: сиденье 4, спинка на 2-й дырке, ноги повыше">${esc(cur.note)}</textarea></div>
    ${e.t === 'w' ? `<div class="tb2"><h4>Шаг веса на этом тренажёре</h4><div class="chipsel" id="stp">${chips()}</div><p class="hint2">С таким шагом приложение повышает вес и двигает кнопки ±. Точкой отмечен шаг по умолчанию.</p></div>` : ''}
    <button class="btn" style="margin-top:24px" id="ntsave">Сохранить</button></div>`, sh => {
    const bindChips = () => sh.querySelectorAll('#stp [data-s]').forEach(b => b.onclick = () => {step = +b.dataset.s === def ? null : +b.dataset.s; sh.querySelector('#stp').innerHTML = chips(); bindChips();});
    bindChips();
    sh.querySelector('#ntsave').onclick = () => {
      const note = sh.querySelector('#nt').value.trim().slice(0, 500);
      updDB(d => ({...d, exs: {...d.exs, [id]: {note, step}}}));
      closeSheet(); toast('Сохранено'); done && done();
    };
  });
}

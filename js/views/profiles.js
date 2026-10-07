// Профили: несколько человек на одном телефоне, у каждого всё своё.
import {toast, openSheet, closeSheet, sheetHead, CK} from '../ui.js';
import {state, profiles, activeProfile, switchProfile, addProfile, renameProfile, deleteProfile, updDB} from '../store.js';
import {esc} from '../format.js';

const initial = n => esc((String(n || '?').trim()[0] || '?').toUpperCase());
export const avatarHtml = () => {const p = profiles().find(x => x.id === activeProfile()); return `<button class="avatar" id="profbtn" aria-label="Профиль: ${esc(p.name)}">${initial(p.name)}</button>`;};

// after(changed) вызывается после переключения или изменения профиля.
export function openProfiles(after) {
  const draw = sh => {
    const list = profiles(), cur = activeProfile(), me = list.find(p => p.id === cur), knee = !state.db.settings || state.db.settings.knee !== false;
    sh.innerHTML = `${sheetHead('Профили', '', 'У каждого свои тренировки, программа, заметки и фото')}<div class="sc">
      <div class="glist">${list.map(p => `<button class="gl-row prof${p.id === cur ? ' on' : ''}" data-pid="${esc(p.id)}"><span class="avatar sm">${initial(p.name)}</span><span class="t"><b>${esc(p.name)}</b><small>${p.id === cur ? 'сейчас открыт' : 'нажми, чтобы переключиться'}</small></span>${p.id === cur ? CK : '<span></span>'}</button>`).join('')}</div>
      <div class="tb2"><h4>${esc(me.name)} — настройки</h4>
        <label class="chk"><input type="checkbox" id="pknee" ${knee ? 'checked' : ''}> Следить за коленями (вопрос после тренировки, осторожнее с весом на ноги)</label>
        <div class="g2" style="margin-top:12px"><button class="btn s2 sm" id="pren">Переименовать</button>${cur !== 'main' ? '<button class="btn s2 sm danger" id="pdel">Удалить профиль</button>' : '<span></span>'}</div></div>
      <div class="tb2"><h4>Новый человек</h4>
        <div class="form"><label>Имя<input id="pname" maxlength="24" placeholder="Например: Ксюша"></label></div>
        <label class="chk"><input type="checkbox" id="pnknee"> Беспокоят колени</label>
        <button class="btn" style="margin-top:12px" id="padd">Добавить и открыть</button>
        <p class="hint2">Программа у нового человека начнётся с этапа 1 — потом её можно поменять под себя в «Программе». На другом телефоне просто открой ту же ссылку: там всё будет своё.</p></div>
    </div>`;
    sh.querySelectorAll('[data-pid]').forEach(b => b.onclick = () => {
      const id = b.dataset.pid;
      if (id === activeProfile()) return;
      switchProfile(id); closeSheet(); after(true);
      toast('Открыт профиль: ' + profiles().find(p => p.id === id).name);
    });
    sh.querySelector('#pknee').onchange = e => {updDB(d => ({...d, settings: {...(d.settings || {}), knee: e.target.checked}})); after(false);};
    sh.querySelector('#pren').onclick = () => {
      const n = prompt('Новое имя', me.name);
      if (n === null) return;
      try {renameProfile(cur, n); draw(sh); after(false);} catch (e) {toast(e.message);}
    };
    const del = sh.querySelector('#pdel');
    if (del) del.onclick = () => {
      if (!confirm(`Удалить профиль «${me.name}» со всеми его тренировками? Это нельзя отменить. Сначала сохрани его копию в «Тело», если нужно.`)) return;
      deleteProfile(cur); closeSheet(); after(true); toast('Профиль удалён');
    };
    sh.querySelector('#padd').onclick = () => {
      try {
        addProfile(sh.querySelector('#pname').value, {knee: sh.querySelector('#pnknee').checked});
        closeSheet(); after(true); toast('Новый профиль открыт');
      } catch (e) {toast(e.message);}
    };
  };
  openSheet('', draw);
}

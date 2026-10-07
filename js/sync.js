// Синхронизация с облаком (AWS, Ирландия): у каждого профиля свой аккаунт, данные шифруются на телефоне.
import {SYNC_URL} from './sync-config.js';
import {deriveAccount, importKey, seal, open} from './sync-crypto.js';
import {state, setDB, activeProfile} from './store.js';
import {normalizeDB, syncMerge} from './backup.js';
import {allPhotos, importPhotos} from './photos.js';

const KEY = () => 'gym.sync@' + activeProfile(), PUSH_DELAY = 4000, MAX_TRIES = 3;
const LS = {get: k => {try {return JSON.parse(localStorage.getItem(k));} catch (e) {return null;}}, set: (k, v) => {try {localStorage.setItem(k, JSON.stringify(v));} catch (e) {}}, del: k => {try {localStorage.removeItem(k);} catch (e) {}}};
export const account = () => LS.get(KEY());
const save = patch => {const a = {...account(), ...patch}; LS.set(KEY(), a); emit(); return a;};
const emit = () => {try {dispatchEvent(new Event('gym:sync'));} catch (e) {}};
let busy = null, timer = null, keyCache = null;
// Сравнение по содержимому (без отметки времени): если на сервере уже то же самое — не отправляем.
const same = (a, b) => {const x = normalizeDB(a), y = normalizeDB(b); x.updatedAt = y.updatedAt = 0; return JSON.stringify(x) === JSON.stringify(y);};

async function api(method, path, body, a) {
  const headers = {'content-type': 'application/json'};
  if (a) {headers['x-user'] = a.userId; headers['x-token'] = a.token;}
  let r;
  try {r = await fetch(SYNC_URL + path, {method, headers, body: body ? JSON.stringify(body) : undefined});}
  catch (e) {throw Object.assign(new Error('Нет связи с сервером'), {offline: true});}
  const data = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 409) throw Object.assign(new Error(data.error || 'Ошибка сервера ' + r.status), {status: r.status});
  return {status: r.status, data};
}
const key = async a => {if (!keyCache || keyCache.raw !== a.keyRaw) keyCache = {raw: a.keyRaw, key: await importKey(a.keyRaw)}; return keyCache.key;};

// Техническая ошибка (криптография, сеть, JSON, сервер) → понятная фраза для экрана. Детали — только в консоль.
const RELOGIN = 'Не удалось расшифровать данные — выйди из облака и войди заново';
export function humanErr(e) {
  const m = String((e && e.message) || e || '');
  if (!e) return 'Что-то пошло не так';
  if (e.offline || /fetch|network|load failed|сет[иь]/i.test(m)) return 'Нет связи с сервером';
  if (e.status === 401) return 'Пароль изменился или аккаунт удалён — войди заново';
  if (e.status >= 500) return 'Сервер не отвечает — попробуй позже';
  if (e.status) return m;
  const dom = typeof DOMException !== 'undefined' && e instanceof DOMException;
  if (dom || /AES|key data|decrypt|cipher|расшифровать|формат данных/i.test(m)) return RELOGIN;
  if (e instanceof SyntaxError || /JSON|token/i.test(m)) return 'Сервер ответил непонятно — попробуй позже';
  return m || 'Что-то пошло не так';
}
// Что предложить сделать при ошибке облака: войти заново или просто повторить.
export const errAction = err => /войди заново/.test(String(err || '')) ? 'relogin' : 'retry';

export async function register(name, password, invite) {
  const acc = await deriveAccount(name, password);
  const {data} = await api('POST', '/v1/register', {userId: acc.userId, token: acc.token, invite: String(invite || '').trim()});
  LS.set(KEY(), {name: name.trim(), userId: acc.userId, token: acc.token, keyRaw: acc.keyRaw, admin: data.admin === true, version: 0, at: null, err: null});
  clearPendingInvite();
  // код из адреса больше не нужен — убираем его из строки только теперь (до этого он переживает установку на экран «Домой»)
  try {const u = new URL(location.href); if (u.searchParams.has('invite')) {u.searchParams.delete('invite'); history.replaceState(null, '', u.pathname + u.search + u.hash);}} catch (e) {}
  emit();
  return syncNow();
}
// Облако включено и работает: показывать «сделай копию» не нужно.
export const cloudOk = () => {const a = account(); return !!a && !a.err;};
export async function login(name, password) {
  const acc = await deriveAccount(name, password);
  const {data} = await api('POST', '/v1/login', null, acc);
  LS.set(KEY(), {name: name.trim(), userId: acc.userId, token: acc.token, keyRaw: acc.keyRaw, admin: data.admin === true, version: 0, at: null, err: null});
  emit();
  return syncNow();
}
// Код приглашения из ссылки (…/gym/?invite=ZAL-…) — запоминаем до регистрации.
const PENDING = 'gym.pendingInvite';
export const pendingInvite = () => {try {return localStorage.getItem(PENDING) || '';} catch (e) {return '';}};
export const setPendingInvite = c => {try {localStorage.setItem(PENDING, String(c || '').trim().toUpperCase());} catch (e) {}};
export const clearPendingInvite = () => {try {localStorage.removeItem(PENDING);} catch (e) {}};
// Владелец создаёт одноразовый код на 7 дней прямо с телефона.
export async function createInvite() {
  const a = account();
  if (!a || !a.admin) throw new Error('Приглашать может только владелец');
  const {data} = await api('POST', '/v1/invites', {}, a);
  return data;
}
export async function listInvites() {
  const a = account();
  if (!a || !a.admin) return [];
  const {data} = await api('GET', '/v1/invites', null, a);
  return data.invites || [];
}
export const appUrl = () => location.origin + location.pathname.replace(/[^/]*$/, '');
export const inviteLink = code => `${appUrl()}?invite=${encodeURIComponent(code)}`;
// Сообщение приглашённому: рабочая ссылка с кодом и код отдельной строкой (iOS может потерять ?invite= при установке).
export const inviteText = code => `Привет! Ставлю тебе «Мой зал» — наше приложение для зала.\n\nОткрой в Safari: ${inviteLink(code)}\nОно само подскажет, как поставить иконку на экран «Домой», и соберёт программу под тебя.\n\nКод приглашения: ${code} — понадобится, когда приложение попросит включить облако. Действует 7 дней, один раз.`;
// Созданные с этого телефона коды целиком (сервер отдаёт их замаскированными) — чтобы отправить ещё раз, если «Поделиться» сорвалось.
const INV = () => 'gym.invites@' + activeProfile(), INV_MAX = 10;
export const localInvites = () => {const l = LS.get(INV()); return Array.isArray(l) ? l.filter(i => i && typeof i.code === 'string') : [];};
export const rememberInvite = ({code, exp}) => LS.set(INV(), [{code, exp}, ...localInvites().filter(i => i.code !== code)].slice(0, INV_MAX));
export const forgetInvite = code => LS.set(INV(), localInvites().filter(i => i.code !== code));
export function logout() {LS.del(KEY()); keyCache = null; emit();}

// Подтянуть с сервера, слить, отправить своё. Повторяет при одновременной записи с другого телефона.
export function syncNow() {
  if (busy) return busy;
  busy = (async () => {
    const a = account();
    if (!a || !SYNC_URL) return null;
    try {
      const k = await key(a);
      let remote = await api('GET', '/v1/data', null, a).catch(e => {if (e.status === 404) return {status: 404, data: {version: 0}}; throw e;});
      for (let i = 0; i < MAX_TRIES; i++) {
        const rv = remote.data.version || 0;
        if (remote.data.box) {
          const theirs = normalizeDB(await open(remote.data.box, k)), merged = syncMerge(state.db, theirs);
          if (!same(merged, state.db)) {setDB(merged); try {dispatchEvent(new Event('gym:remote'));} catch (e) {}}
          if (same(theirs, state.db)) {save({version: rv, at: new Date().toISOString(), err: null}); break;}
        }
        const put = await api('PUT', '/v1/data', {base: rv, box: await seal(state.db, k)}, a);
        if (put.status !== 409) {save({version: put.data.version, at: new Date().toISOString(), err: null}); break;}
        remote = put;
      }
      await syncPhotos(a, k).catch(e => console.warn('photo sync', e));
      return account();
    } catch (e) {
      console.error('sync', e);
      save({err: humanErr(e)});
      throw e;
    } finally {busy = null;}
  })();
  return busy;
}

const photoKey = p => (p.ex + '_' + p.ts).toLowerCase().replace(/[^0-9a-z_-]/g, '-').slice(0, 64);
async function syncPhotos(a, k) {
  if (typeof indexedDB === 'undefined') return;
  const {data} = await api('GET', '/v1/photos', null, a), remote = new Set(data.keys || []);
  const local = await allPhotos(), have = new Set(local.map(photoKey));
  for (const p of local) {
    if (remote.has(photoKey(p))) continue;
    const dataUrl = await new Promise((res, rej) => {const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(p.blob);});
    await api('PUT', '/v1/photo/' + photoKey(p), {box: await seal({ex: p.ex, ts: p.ts, label: p.label || '', data: dataUrl}, k)}, a);
  }
  const missing = [...remote].filter(x => !have.has(x)), got = [];
  for (const pk of missing) {const r = await api('GET', '/v1/photo/' + pk, null, a); got.push(await open(r.data.box, k));}
  if (got.length) await importPhotos(got);
}

// Автоматически: после сохранения (с задержкой), при открытии приложения и при появлении сети.
export function startAutoSync() {
  const later = () => {if (!account()) return; clearTimeout(timer); timer = setTimeout(() => syncNow().catch(() => {}), PUSH_DELAY);};
  addEventListener('gym:saved', later);
  addEventListener('online', () => syncNow().catch(() => {}));
  document.addEventListener('visibilitychange', () => {if (document.visibilityState === 'visible') syncNow().catch(() => {});});
  if (account()) syncNow().catch(() => {});
}

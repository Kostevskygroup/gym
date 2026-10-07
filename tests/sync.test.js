import {test} from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {getItem: k => mem.has(k) ? mem.get(k) : null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k), key: i => [...mem.keys()][i], get length() {return mem.size;}};
globalThis.addEventListener = globalThis.addEventListener || (() => {});
globalThis.dispatchEvent = globalThis.dispatchEvent || (() => true);

const {handle, inviteHash} = await import('../sync-server/handler.mjs');
const s3 = new Map();
const store = {
  async get(k) {return s3.get(k) || null;},
  async put(k, body, {ifMatch, ifNoneMatch} = {}) {const c = s3.get(k); if ((ifNoneMatch === '*' && c) || (ifMatch && (!c || c.etag !== ifMatch))) throw Object.assign(new Error('x'), {code: 412}); const etag = '"' + Math.random() + '"'; s3.set(k, {body, etag}); return etag;},
  async list(p) {return [...s3.keys()].filter(k => k.startsWith(p));},
};
const env = {INVITE_SHA: inviteHash('код-1')};
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(url), r = await handle({requestContext: {http: {method: o.method || 'GET'}}, rawPath: u.pathname, headers: o.headers || {}, body: o.body}, store, env);
  return {ok: r.statusCode < 400, status: r.statusCode, json: async () => JSON.parse(r.body || '{}')};
};

const storeMod = await import('../js/store.js');
const sync = await import('../js/sync.js');
const {deriveAccount, seal, open} = await import('../js/sync-crypto.js');
const {normalizeDB} = await import('../js/backup.js');
storeMod.load();

const S = (id, d) => ({id, date: d, phase: 'p1', wo: 'А', knee: 0, entries: {lat: [{a: 40, b: 10}]}});

test('register with invite, push, then another phone sees the data and its own workout merges in', async () => {
  storeMod.setDB({...storeMod.state.db, sessions: [S(1, '2026-10-01T10:00:00Z')]});
  await assert.rejects(sync.register('Ксюша', 'пароль-123', 'неверный'), /приглашения/);
  await sync.register('Ксюша', 'пароль-123', 'код-1');
  assert.equal(sync.account().err, null);
  const acc = await deriveAccount('ксюша', 'пароль-123');
  const pulled = await (await fetch('https://x/v1/data', {headers: {'x-user': acc.userId, 'x-token': acc.token}})).json();
  const theirs = await open(pulled.box, acc.key);
  assert.equal(theirs.sessions.length, 1);
  // «второй телефон» добавляет свою тренировку
  const phoneB = normalizeDB({...theirs, sessions: [...theirs.sessions, S(2, '2026-10-03T10:00:00Z')], updatedAt: Date.now() + 1000});
  const r = await fetch('https://x/v1/data', {method: 'PUT', headers: {'x-user': acc.userId, 'x-token': acc.token}, body: JSON.stringify({base: pulled.version, box: await seal(phoneB, acc.key)})});
  assert.equal(r.status, 200);
  await sync.syncNow();
  assert.deepEqual(storeMod.state.db.sessions.map(s => s.id), [1, 2]);
});

test('login with a wrong password is refused; right password restores data on a "new phone"', async () => {
  sync.logout();
  storeMod.setDB({...storeMod.state.db, sessions: []});
  await assert.rejects(sync.login('Ксюша', 'неправильно'), /пароль/i);
  await sync.login('Ксюша', 'пароль-123');
  assert.deepEqual(storeMod.state.db.sessions.map(s => s.id).sort(), [1, 2]);
});

test('server never sees workout content', () => {
  const dump = JSON.stringify([...s3.values()]);
  assert.ok(!dump.includes('lat') && !dump.includes('Ксюша'));
});

test('humanErr turns technical failures into plain words and keeps server messages', () => {
  const {humanErr, errAction} = sync;
  assert.equal(humanErr(new Error('AES key data must be 128 or 256 bits')), 'Не удалось расшифровать данные — выйди из облака и войди заново');
  assert.equal(humanErr(Object.assign(new Error('Failed to fetch'), {offline: true})), 'Нет связи с сервером');
  assert.equal(humanErr(new TypeError('Failed to fetch')), 'Нет связи с сервером');
  assert.equal(humanErr(Object.assign(new Error('Unauthorized'), {status: 401})), 'Пароль изменился или аккаунт удалён — войди заново');
  assert.equal(humanErr(Object.assign(new Error('Ошибка сервера 502'), {status: 502})), 'Сервер не отвечает — попробуй позже');
  assert.equal(humanErr(Object.assign(new Error('Неверный код приглашения'), {status: 400})), 'Неверный код приглашения');
  assert.equal(humanErr(new SyntaxError('Unexpected token < in JSON')), 'Сервер ответил непонятно — попробуй позже');
  assert.equal(humanErr(new Error('Пароль — минимум 6 символов')), 'Пароль — минимум 6 символов');
  assert.equal(errAction('Пароль изменился или аккаунт удалён — войди заново'), 'relogin');
  assert.equal(errAction('Нет связи с сервером'), 'retry');
});

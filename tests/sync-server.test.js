import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle, inviteHash} from '../sync-server/handler.mjs';

function memStore() {
  const m = new Map();
  let n = 0;
  return {
    m,
    async get(k) {return m.has(k) ? m.get(k) : null;},
    async put(k, body, {ifMatch, ifNoneMatch} = {}) {
      const cur = m.get(k);
      if (ifNoneMatch === '*' && cur) throw Object.assign(new Error('x'), {code: 412});
      if (ifMatch && (!cur || cur.etag !== ifMatch)) throw Object.assign(new Error('x'), {code: 412});
      const etag = '"e' + (++n) + '"';
      m.set(k, {body, etag});
      return etag;
    },
    async list(p) {return [...m.keys()].filter(k => k.startsWith(p));},
  };
}
const env = {INVITE_SHA: inviteHash('зал-2026')};
const U = 'a'.repeat(32), T = 'b'.repeat(64), T2 = 'c'.repeat(64);
const req = (method, path, body, headers = {}) => ({requestContext: {http: {method}}, rawPath: path, headers, body: body === undefined ? undefined : JSON.stringify(body)});
const as = {'x-user': U, 'x-token': T};
const box = n => ({v: 1, iv: 'aaaa', ct: 'ct' + n});
const call = async (s, ...a) => {const r = await handle(req(...a), s, env); return {code: r.statusCode, body: r.body ? JSON.parse(r.body) : null};};

test('register needs the invite code; the name can be taken only once', async () => {
  const s = memStore();
  assert.equal((await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: 'нет'})).code, 403);
  assert.equal((await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: ' ЗАЛ-2026 '})).code, 201);
  assert.equal((await call(s, 'POST', '/v1/register', {userId: U, token: T2, invite: 'зал-2026'})).code, 409);
});

test('login and data access require the right token', async () => {
  const s = memStore();
  await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: 'зал-2026'});
  assert.equal((await call(s, 'POST', '/v1/login', undefined, as)).code, 200);
  assert.equal((await call(s, 'POST', '/v1/login', undefined, {'x-user': U, 'x-token': T2})).code, 401);
  assert.equal((await call(s, 'GET', '/v1/data', undefined, {'x-user': U, 'x-token': 'zz'})).code, 401);
  assert.equal((await call(s, 'GET', '/v1/data', undefined, as)).code, 404);
});

test('versioned data: push, pull, conflict returns the newer copy', async () => {
  const s = memStore();
  await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: 'зал-2026'});
  assert.deepEqual((await call(s, 'PUT', '/v1/data', {base: 0, box: box(1)}, as)).body, {version: 1});
  assert.equal((await call(s, 'GET', '/v1/data', undefined, as)).body.box.ct, 'ct1');
  assert.equal((await call(s, 'PUT', '/v1/data', {base: 1, box: box(2)}, as)).body.version, 2);
  const stale = await call(s, 'PUT', '/v1/data', {base: 1, box: box(3)}, as);
  assert.equal(stale.code, 409);
  assert.equal(stale.body.version, 2);
  assert.equal(stale.body.box.ct, 'ct2');
});

test('server stores only what the phone sent (ciphertext), never a token in clear', async () => {
  const s = memStore();
  await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: 'зал-2026'});
  await call(s, 'PUT', '/v1/data', {base: 0, box: box(1)}, as);
  const dump = JSON.stringify([...s.m.values()]);
  assert.ok(!dump.includes(T));
});

test('photos: put, list, get; bad keys refused', async () => {
  const s = memStore();
  await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: 'зал-2026'});
  assert.equal((await call(s, 'PUT', '/v1/photo/lat_1700000000000', {box: box('p')}, as)).code, 200);
  assert.deepEqual((await call(s, 'GET', '/v1/photos', undefined, as)).body.keys, ['lat_1700000000000']);
  assert.equal((await call(s, 'GET', '/v1/photo/lat_1700000000000', undefined, as)).body.box.ct, 'ctp');
  assert.equal((await call(s, 'PUT', '/v1/photo/..%2Fx', {box: box('p')}, as)).code, 400);
});

test('users cannot see each other', async () => {
  const s = memStore(), U2 = 'd'.repeat(32), T3 = 'e'.repeat(64);
  await call(s, 'POST', '/v1/register', {userId: U, token: T, invite: 'зал-2026'});
  await call(s, 'POST', '/v1/register', {userId: U2, token: T3, invite: 'зал-2026'});
  await call(s, 'PUT', '/v1/data', {base: 0, box: box('mine')}, as);
  assert.equal((await call(s, 'GET', '/v1/data', undefined, {'x-user': U2, 'x-token': T3})).code, 404);
  assert.equal((await call(s, 'GET', '/v1/data', undefined, {'x-user': U, 'x-token': T3})).code, 401);
});

test('garbage requests get clean errors', async () => {
  const s = memStore();
  const r = await handle({requestContext: {http: {method: 'POST'}}, rawPath: '/v1/register', body: '{bad'}, s, env);
  assert.equal(r.statusCode, 400);
  assert.equal((await call(s, 'GET', '/v1/nope', undefined, as)).code, 401);
  assert.equal((await call(s, 'GET', '/v1/ping')).code, 200);
});

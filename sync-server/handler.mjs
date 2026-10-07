// Сервер синхронизации «Мой зал»: хранит только зашифрованные данные. AWS Lambda (Function URL) + S3.
// Хранилище передаётся снаружи: в Lambda — S3, в тестах — память.
import {createHash, timingSafeEqual, randomInt} from 'node:crypto';

const MAX_BODY = 4_500_000, MAX_PHOTOS = 600, INVITE_DAYS = 7, INVITE_MAX_OPEN = 20;
const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => {let s = ''; for (let i = 0; i < 8; i++) s += ALPHA[randomInt(ALPHA.length)]; return `ZAL-${s.slice(0, 4)}-${s.slice(4)}`;};
const invKey = code => `inv/${inviteHash(code)}.json`;
const RE = {user: /^[0-9a-f]{32}$/, token: /^[0-9a-f]{64}$/, photo: /^[0-9a-z_-]{1,64}$/};
const sha = s => createHash('sha256').update(String(s)).digest('hex');
const json = (statusCode, body) => ({statusCode, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}, body: JSON.stringify(body)});
const err = (code, message) => json(code, {error: message});
export const inviteHash = code => sha('gym-invite|' + String(code || '').trim().toLowerCase());

function sameHex(a, b) {
  const x = Buffer.from(String(a), 'hex'), y = Buffer.from(String(b), 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
function parse(event) {
  const raw = event.body ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body) : '';
  if (raw.length > MAX_BODY) throw Object.assign(new Error('Слишком большой запрос'), {code: 413});
  try {return raw ? JSON.parse(raw) : {};} catch (e) {throw Object.assign(new Error('Неверный JSON'), {code: 400});}
}
const okBox = b => b && b.v === 1 && typeof b.iv === 'string' && typeof b.ct === 'string';

// → {user, admin} или null
async function auth(store, h) {
  const user = h['x-user'], token = h['x-token'];
  if (!RE.user.test(user || '') || !RE.token.test(token || '')) return null;
  const a = await store.get(`u/${user}/auth.json`);
  if (!a) return null;
  const rec = JSON.parse(a.body);
  return sameHex(rec.h, sha(token)) ? {user, admin: rec.admin === true} : null;
}

// Код приглашения: мастер-код из окружения даёт права владельца; коды из приложения — одноразовые.
async function useInvite(store, env, code, nowIso) {
  if (env.INVITE_SHA && sameHex(inviteHash(code), env.INVITE_SHA)) return {ok: true, admin: true};
  const k = invKey(code), cur = await store.get(k);
  if (!cur) return {ok: false, msg: 'Неверный код приглашения'};
  const inv = JSON.parse(cur.body);
  if (inv.usedAt) return {ok: false, msg: 'Этот код уже использован — попроси новый'};
  if (Date.parse(inv.exp) < Date.parse(nowIso)) return {ok: false, msg: 'Срок кода истёк — попроси новый'};
  try {await store.put(k, JSON.stringify({...inv, usedAt: nowIso}), {ifMatch: cur.etag});}
  catch (e) {if (e.code === 412) return {ok: false, msg: 'Этот код уже использован — попроси новый'}; throw e;}
  return {ok: true, admin: false};
}

// env: {INVITE_SHA}. store: {get(key) → {body, etag} | null, put(key, body, {ifMatch?, ifNoneMatch?}) → etag (throws {code:412} on mismatch), list(prefix) → [keys]}
export async function handle(event, store, env, now = () => new Date().toISOString()) {
  try {
    const method = event.requestContext?.http?.method || event.httpMethod || 'GET', path = event.rawPath || event.path || '/';
    const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
    if (method === 'OPTIONS') return {statusCode: 204, headers: {}, body: ''};
    if (method === 'GET' && path === '/v1/ping') return json(200, {ok: true});

    if (method === 'POST' && path === '/v1/register') {
      const b = parse(event);
      if (!RE.user.test(b.userId || '') || !RE.token.test(b.token || '')) return err(400, 'Неверные данные');
      if (await store.get(`u/${b.userId}/auth.json`)) return err(409, 'Такое имя уже занято — войди или выбери другое');
      const inv = await useInvite(store, env, b.invite, now());
      if (!inv.ok) return err(403, inv.msg);
      try {await store.put(`u/${b.userId}/auth.json`, JSON.stringify({h: sha(b.token), at: now(), admin: inv.admin}), {ifNoneMatch: '*'});}
      catch (e) {if (e.code === 412) return err(409, 'Такое имя уже занято — войди или выбери другое'); throw e;}
      return json(201, {ok: true, admin: inv.admin});
    }

    const who = await auth(store, h);
    if (!who) return err(401, 'Неверное имя или пароль');
    const user = who.user;
    if (method === 'POST' && path === '/v1/login') return json(200, {ok: true, admin: who.admin});

    if (path === '/v1/invites') {
      if (!who.admin) return err(403, 'Приглашать может только владелец');
      if (method === 'POST') {
        const open = (await store.list('inv/')).length;
        if (open > INVITE_MAX_OPEN * 10) return err(507, 'Слишком много кодов');
        const code = newCode(), exp = new Date(Date.parse(now()) + INVITE_DAYS * 864e5).toISOString();
        await store.put(invKey(code), JSON.stringify({by: user, at: now(), exp, tail: code.slice(-4)}), {ifNoneMatch: '*'});
        return json(201, {code, exp});
      }
      if (method === 'GET') {
        const keys = await store.list('inv/'), invites = [];
        for (const k of keys) {const r = await store.get(k); if (!r) continue; const inv = JSON.parse(r.body); if (inv.by !== user) continue; invites.push({code: 'ZAL-····-' + (inv.tail || '····'), at: inv.at, exp: inv.exp, used: !!inv.usedAt, expired: !inv.usedAt && Date.parse(inv.exp) < Date.parse(now())});}
        invites.sort((a, b) => b.at.localeCompare(a.at));
        return json(200, {invites: invites.slice(0, INVITE_MAX_OPEN)});
      }
    }

    const dataKey = `u/${user}/data.json`;
    if (method === 'GET' && path === '/v1/data') {
      const d = await store.get(dataKey);
      return d ? json(200, JSON.parse(d.body)) : err(404, 'Данных пока нет');
    }
    if (method === 'PUT' && path === '/v1/data') {
      const b = parse(event);
      if (!okBox(b.box) || !Number.isInteger(b.base) || b.base < 0) return err(400, 'Неверные данные');
      const cur = await store.get(dataKey), curV = cur ? JSON.parse(cur.body).version : 0;
      if (curV !== b.base) return json(409, cur ? JSON.parse(cur.body) : {version: 0});
      const next = {version: curV + 1, box: b.box, at: now()};
      try {await store.put(dataKey, JSON.stringify(next), cur ? {ifMatch: cur.etag} : {ifNoneMatch: '*'});}
      catch (e) {if (e.code === 412) {const c2 = await store.get(dataKey); return json(409, c2 ? JSON.parse(c2.body) : {version: 0});} throw e;}
      return json(200, {version: next.version});
    }

    if (method === 'GET' && path === '/v1/photos') {
      const keys = (await store.list(`u/${user}/p/`)).map(k => k.split('/').pop().replace(/\.json$/, ''));
      return json(200, {keys});
    }
    const m = path.match(/^\/v1\/photo\/([^/]+)$/);
    if (m) {
      if (!RE.photo.test(m[1])) return err(400, 'Неверный ключ фото');
      const pk = `u/${user}/p/${m[1]}.json`;
      if (method === 'GET') {const p = await store.get(pk); return p ? json(200, JSON.parse(p.body)) : err(404, 'Нет такого фото');}
      if (method === 'PUT') {
        const b = parse(event);
        if (!okBox(b.box)) return err(400, 'Неверные данные');
        if ((await store.list(`u/${user}/p/`)).length >= MAX_PHOTOS) return err(507, 'Слишком много фото');
        await store.put(pk, JSON.stringify({box: b.box, at: now()}), {});
        return json(200, {ok: true});
      }
    }
    return err(404, 'Нет такого адреса');
  } catch (e) {
    if (e.code && e.code < 600) return err(e.code, e.message);
    console.error(e);
    return err(500, 'Ошибка сервера');
  }
}

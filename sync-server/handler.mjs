// Сервер синхронизации «Мой зал»: хранит только зашифрованные данные. AWS Lambda (Function URL) + S3.
// Хранилище передаётся снаружи: в Lambda — S3, в тестах — память.
import {createHash, timingSafeEqual} from 'node:crypto';

const MAX_BODY = 4_500_000, MAX_PHOTOS = 600;
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

async function auth(store, h) {
  const user = h['x-user'], token = h['x-token'];
  if (!RE.user.test(user || '') || !RE.token.test(token || '')) return null;
  const a = await store.get(`u/${user}/auth.json`);
  if (!a) return null;
  return sameHex(JSON.parse(a.body).h, sha(token)) ? user : null;
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
      if (!env.INVITE_SHA || !sameHex(inviteHash(b.invite), env.INVITE_SHA)) return err(403, 'Неверный код приглашения');
      if (!RE.user.test(b.userId || '') || !RE.token.test(b.token || '')) return err(400, 'Неверные данные');
      try {await store.put(`u/${b.userId}/auth.json`, JSON.stringify({h: sha(b.token), at: now()}), {ifNoneMatch: '*'});}
      catch (e) {if (e.code === 412) return err(409, 'Такое имя уже занято — войди или выбери другое'); throw e;}
      return json(201, {ok: true});
    }

    const user = await auth(store, h);
    if (!user) return err(401, 'Неверное имя или пароль');
    if (method === 'POST' && path === '/v1/login') return json(200, {ok: true});

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

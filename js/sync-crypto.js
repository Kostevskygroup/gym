// Шифрование для синхронизации: данные шифруются на телефоне, сервер видит только шифр.
// Из имени и пароля получаем два ключа: один подтверждает вход, второй шифрует (на сервер не уходит).
const ITER = 310000;
const enc = new TextEncoder(), dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const b64 = buf => {let s = ''; new Uint8Array(buf).forEach(b => {s += String.fromCharCode(b);}); return btoa(s);};
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const normName = n => String(n || '').trim().toLowerCase().replace(/\s+/g, ' ');

export async function sha256hex(text) {return hex(await subtle().digest('SHA-256', enc.encode(text)));}

// {userId, token, key}: userId — адрес данных, token — доказательство пароля, key — шифрование.
export async function deriveAccount(name, password) {
  const n = normName(name);
  if (n.length < 2) throw new Error('Имя — минимум 2 символа');
  if (String(password || '').length < 6) throw new Error('Пароль — минимум 6 символов');
  const base = await subtle().importKey('raw', enc.encode(String(password)), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('gym-sync|' + n), iterations: ITER}, base, 512);
  const all = new Uint8Array(bits);
  const key = await importKey(b64(all.slice(32)));
  return {userId: (await sha256hex('gym-user|' + n)).slice(0, 32), token: hex(all.slice(0, 32)), key, keyRaw: b64(all.slice(32))};
}
// Ключ хранится на телефоне, чтобы не вводить пароль при каждом открытии.
export const importKey = raw => subtle().importKey('raw', unb64(raw), {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);

export async function seal(obj, key) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({name: 'AES-GCM', iv}, key, enc.encode(JSON.stringify(obj)));
  return {v: 1, iv: b64(iv), ct: b64(ct)};
}
export async function open(box, key) {
  if (!box || box.v !== 1) throw new Error('Неизвестный формат данных на сервере');
  try {
    const pt = await subtle().decrypt({name: 'AES-GCM', iv: unb64(box.iv)}, key, unb64(box.ct));
    return JSON.parse(dec.decode(pt));
  } catch (e) {throw new Error('Не получилось расшифровать — проверь пароль');}
}

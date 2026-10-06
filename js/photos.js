// Свои фото упражнений (старт/финиш, табличка с тренажёра) — в IndexedDB на телефоне.
const NAME = 'gym-photos', STORE = 'photos', MAX = 1280, QUALITY = 0.82;

let dbp = null;
function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, {keyPath: 'id', autoIncrement: true}).createIndex('ex', 'ex');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}
async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode), out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
    t.onerror = () => rej(t.error);
  });
}

export const listPhotos = ex => tx('readonly', s => s.index('ex').getAll(ex)).then(a => (a || []).sort((x, y) => x.ts - y.ts));
export const allPhotos = () => tx('readonly', s => s.getAll()).then(a => a || []);
export const delPhoto = id => tx('readwrite', s => s.delete(id));
export const photoCounts = () => allPhotos().then(a => a.reduce((m, p) => ({...m, [p.ex]: (m[p.ex] || 0) + 1}), {}));

export async function addPhoto(ex, file, label = '') {
  const blob = await resize(file);
  return tx('readwrite', s => s.add({ex, label, ts: Date.now(), blob}));
}
export const setLabel = (p, label) => tx('readwrite', s => s.put({...p, label}));

async function resize(file) {
  const img = await createImageBitmap(file, {imageOrientation: 'from-image'}).catch(() => loadImg(file));
  const k = Math.min(1, MAX / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('Не получилось обработать фото')), 'image/jpeg', QUALITY));
}
function loadImg(file) {
  return new Promise((res, rej) => {
    const i = new Image(), u = URL.createObjectURL(file);
    i.onload = () => {URL.revokeObjectURL(u); res(i);};
    i.onerror = () => {URL.revokeObjectURL(u); rej(new Error('Это не фото'));};
    i.src = u;
  });
}

const toDataURL = blob => new Promise((res, rej) => {const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob);});
export async function exportPhotos() {
  const all = await allPhotos();
  return Promise.all(all.map(async p => ({ex: p.ex, ts: p.ts, label: p.label || '', data: await toDataURL(p.blob)})));
}
// Импорт из копии: пропускает уже существующие (то же упражнение и время).
export async function importPhotos(list) {
  const have = new Set((await allPhotos()).map(p => p.ex + '|' + p.ts));
  let n = 0;
  for (const p of list) {
    if (have.has(p.ex + '|' + p.ts)) continue;
    const blob = await (await fetch(p.data)).blob();
    await tx('readwrite', s => s.add({ex: p.ex, ts: p.ts, label: p.label || '', blob}));
    n++;
  }
  return n;
}

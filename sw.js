// Офлайн-режим: всё приложение лежит в кэше и открывается без сети.
// Файл собирается командой `npm run build` — не правь sw.js руками.
const VERSION = '7998a38d4b72';
const CACHE = 'gym-' + VERSION;
const ASSETS = [
 "./",
 "icons/icon-180.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon-maskable-512.png",
 "img/abbench.jpg",
 "img/bench.jpg",
 "img/bike.jpg",
 "img/cable.jpg",
 "img/chest.jpg",
 "img/db.jpg",
 "img/lat.jpg",
 "img/legcurl.jpg",
 "img/legext.jpg",
 "img/legpress.jpg",
 "img/row.jpg",
 "img/shoulder.jpg",
 "img/smith.jpg",
 "index.html",
 "js/app.js",
 "js/backup.js",
 "js/data/equipment.js",
 "js/data/exercises.js",
 "js/data/guides.js",
 "js/data/program.js",
 "js/format.js",
 "js/logic.js",
 "js/photos.js",
 "js/platform.js",
 "js/program.js",
 "js/stats.js",
 "js/store.js",
 "js/timer.js",
 "js/ui.js",
 "js/views/body.js",
 "js/views/chart.js",
 "js/views/covers.js",
 "js/views/finish.js",
 "js/views/home.js",
 "js/views/plan.js",
 "js/views/progress.js",
 "js/views/sheets.js",
 "js/views/train.js",
 "js/workout.js",
 "manifest.webmanifest",
 "styles.css"
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, {cache: 'reload'})))));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('gym-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Новая версия ждёт, пока пользователь нажмёт «Обновить» — тренировка не прервётся.
self.addEventListener('message', e => {if (e.data === 'skip') self.skipWaiting();});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(caches.match('./', {cacheName: CACHE}).then(r => r || fetch(req)));
    return;
  }
  e.respondWith(caches.match(req, {cacheName: CACHE, ignoreSearch: true}).then(r => r || fetch(req)));
});

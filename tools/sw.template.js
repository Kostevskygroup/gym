// Офлайн-режим: всё приложение лежит в кэше и открывается без сети.
// Файл собирается командой `npm run build` — не правь sw.js руками.
const VERSION = '__VERSION__';
const CACHE = 'gym-' + VERSION;
const ASSETS = __ASSETS__;

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

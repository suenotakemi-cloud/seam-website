/* SEAM Service Worker — PWA オフライン対応 + 高速化
   - HTML: network-first (常に最新、オフライン時はキャッシュ)
   - 静的アセット (vendor/css/js/json/font/画像): cache-first (2回目以降は即ロード)
   バージョンを上げるとキャッシュが刷新される */
const VERSION = 'seam-v7';
const CORE_CACHE = VERSION + '-core';
const ASSET_CACHE = VERSION + '-assets';

const CORE = [
  './',
  './index.html',
  './finder.html',
  './brand.html',
  './shop.html',
  './haircareshop.html',
  './onlineshop.html',
  './hairsalon.html',
  './headspa.html',
  './manifest.json',
  './vendor/react.production.min.js',
  './vendor/react-dom.production.min.js',
  './vendor/babel.min.js',
  './vendor/tailwindcss.js',
  './vendor/html2canvas.min.js',
  './data/products/seam-master.json',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CORE_CACHE).then((c) =>
      Promise.allSettled(CORE.map((u) => c.add(u)))
    )
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CORE_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

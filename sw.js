/* SEAM Service Worker — PWA オフライン対応 + 高速化
   - HTML: network-first (常に最新、オフライン時はキャッシュ)
   - 静的アセット (vendor/css/js/json/font/画像): cache-first (2回目以降は即ロード)
   バージョンを上げるとキャッシュが刷新される */
const VERSION = 'seam-v164';
const CORE_CACHE = VERSION + '-core';
const ASSET_CACHE = VERSION + '-assets';

const CORE = [
  './',
  './index.html',
  './finder.html',
  './skinfinder.html',
  './recruit.html',
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

  // ★取得は cache:'no-cache'(ETag条件付き再検証)。CFゾーンのBrowser TTL(4時間)で
  //   ブラウザHTTPキャッシュが古い資産を最大4時間保持し、素のfetch(req)がそれを
  //   掴んでSWに焼き直す事故が実際に起きた(CI再ビルドのtailwind.cssが届かない)。
  //   no-cacheなら 変更なし=304(軽い)/変更あり=即最新。
  //   例外: Rangeヘッダ付き(動画シーク)は req をそのまま使いRangeを保持する。
  const hasRange = req.headers.has('range');
  const netReq = hasRange ? req : new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' });

  if (isHTML) {
    e.respondWith(
      fetch(netReq).then((res) => {
        // 完全な同一オリジン200のみ保存（エラーページ/不透明応答はキャッシュしない）
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // 資産: stale-while-revalidate。
  // ★裏の再取得は e.waitUntil で必ず完走させる — これが無いとブラウザがSWを
  //   打ち切り、キャッシュが実質更新されない(CIがcss/jsを再ビルドしても
  //   再訪ユーザーに新スタイルが届かない事故が実際に起きた)。
  const networkUpdate = fetch(netReq).then((res) => {
    // 同一オリジンの完全な200のみ保存＝切れた/不透明/部分(206)応答で
    // キャッシュを汚染しない。汚れたコピーは背後の再取得で正しい版に置き換わる。
    if (res && res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).catch(() => {});
    }
    return res;
  });
  e.waitUntil(networkUpdate.catch(() => {}));
  e.respondWith(
    caches.match(req).then((cached) => cached || networkUpdate.catch(() => cached))
  );
});

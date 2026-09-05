/* SEAM Service Worker — PWA オフライン対応 + 高速化
   - HTML: network-first (常に最新、オフライン時はキャッシュ)
   - 静的アセット (vendor/css/js/json/font/画像): cache-first (2回目以降は即ロード)
   バージョンを上げるとキャッシュが刷新される */
const VERSION = 'seam-v171';
const CORE_CACHE = VERSION + '-core';
const ASSET_CACHE = VERSION + '-assets';

/* ★ここに当たる画面は、端末に一切残さない。
     これまでは同一オリジンの200を何でも保存していたので、
     予約台帳・レジ・カウンセリング・入場受付・カルテ、
     さらに合言葉つきのURLまで端末の中に残っていた。
     iPadを共有していたり、持ち去られたりすると、
     電源を切ってもオフラインで開けてしまう。

   ★増やすときは「お客様以外の情報が映る画面か」で決める。
     迷ったら足す。残さないことで困るのは速度だけ。 */
const PRIVATE_PATH = /^\/(booking|entrance|admin|write|karte|seam-karte|salontown-booking|pim|api\/pim|js\/pim-)(\/|\.|$|[a-z])/i;
const PRIVATE_QUERY = /(^|&)(t|token|stok|key|lt|k|s|r|deviceId)=/i;

function isPrivate(url) {
  if (PRIVATE_PATH.test(url.pathname)) return true;
  if (url.search && PRIVATE_QUERY.test(url.search.slice(1))) return true;
  return false;
}

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
    ).then(async () => {
      /* ★古い版が残した「お客様以外の情報が映る画面」を、いまここで消す。
           版を上げるだけでは、同じ名前の入れ物に入っていたものは消えるが、
           今の版の入れ物に入ってしまったものは残る。 */
      for (const name of await caches.keys()) {
        const c = await caches.open(name);
        for (const req of await c.keys()) {
          try { if (isPrivate(new URL(req.url))) await c.delete(req); } catch (err) {}
        }
      }
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* ★お客様以外の情報が映る画面は、通しで取りに行くだけ。
       保存もしないし、オフラインのときも別の画面を出さない。
       「オフラインなのに開けた」が、いちばん危ない。 */
  if (isPrivate(url)) {
    e.respondWith(
      fetch(req).catch(() => new Response(
        '<!doctype html><meta charset="utf-8">'
        + '<meta name="viewport" content="width=device-width,initial-scale=1">'
        + '<title>つながっていません</title>'
        + '<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;'
        + 'background:#F8F6F2;color:#4E4A43;font-family:-apple-system,"Noto Sans JP",sans-serif;'
        + 'text-align:center;padding:24px;line-height:2}'
        + 'b{display:block;color:#1B1A17;font-size:17px;font-weight:500;margin-bottom:6px}'
        + 'span{font-size:13.5px;color:#8A8378}</style>'
        + '<div><b>つながっていません</b>'
        + '<span>この画面は、通信できるときだけ開けます<br>'
        + 'お店の情報を端末に残さないためです</span></div>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
      ))
    );
    return;
  }

  const isHTML = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // ★HTMLナビゲーションは必ず元の req のまま fetch する。
    //   new Request(url) に置き換えると redirect モードが manual→follow に変わり、
    //   サイト内リンク(.html→CFが308で正規URLへ転送)のクリックが
    //   「リダイレクト済み応答は manual ナビゲーションに使えない」で全滅した
    //   (v164事故: 全ページ「ページが開けません」)。opaqueredirect の素通しが正解。
    e.respondWith(
      fetch(req).then((res) => {
        // 完全な同一オリジン200のみ保存（エラーページ/不透明応答はキャッシュしない）
        /* ★サーバーが「残すな」と言っているものは残さない */
        const noStore = /no-store/i.test(res.headers.get('Cache-Control') || '');
        if (res && res.status === 200 && res.type === 'basic' && !noStore) {
          const copy = res.clone();
          caches.open(CORE_CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then((r) => {
        /* ★どのURLでもトップを返していた。
             知らない画面が開いたように見えて、中身は別物という
             いちばん紛らわしい出方になる。
             取っておいた同じ画面があるときだけ返す。 */
        if (r) return r;
        return new Response(
          '<!doctype html><meta charset="utf-8">'
          + '<meta name="viewport" content="width=device-width,initial-scale=1">'
          + '<title>つながっていません</title>'
          + '<style>body{margin:0;min-height:100dvh;display:grid;place-items:center;'
          + 'background:#F8F6F2;color:#4E4A43;font-family:-apple-system,"Noto Sans JP",sans-serif;'
          + 'text-align:center;padding:24px;line-height:2}'
          + 'b{display:block;color:#1B1A17;font-size:17px;font-weight:500;margin-bottom:6px}'
          + 'a{color:#96613F}</style>'
          + '<div><b>つながっていません</b>'
          + '<a href="/">トップへ</a></div>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
        );
      }))
    );
    return;
  }

  // 資産: stale-while-revalidate。
  // ★裏の再取得は e.waitUntil で必ず完走させる — これが無いとブラウザがSWを
  //   打ち切り、キャッシュが実質更新されない(CIがcss/jsを再ビルドしても
  //   再訪ユーザーに新スタイルが届かない事故が実際に起きた)。
  // ★取得は cache:'no-cache'(ETag条件付き再検証) — CFゾーンのBrowser TTL(4時間)の
  //   古いHTTPキャッシュを素通りしないため(css/jsの新ビルドが届かない事故の根治)。
  //   サブリソースは redirect:'follow' が既定なので new Request 化しても安全。
  //   例外: Rangeヘッダ付き(動画シーク)は req をそのまま使いRangeを保持する。
  const netReq = req.headers.has('range')
    ? req
    : new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' });
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

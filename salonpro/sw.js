/* SalonPro Service Worker — コア資産をキャッシュしオフライン/高速化（軽くて落ちないPWA） */
const CACHE = 'salonpro-v43';
const CORE = [
  'home.html', 'index.html', 'cart.html', 'product.html', 'reorder.html',
  'mypage.html', 'learn.html', 'favorites.html', 'orders.html', 'support.html',
  'contact.html', 'login.html', 'register.html', 'barcode.html',
  'pos.html', 'inventory.html', 'admin.html', 'top.html',
  'news.html', 'seminar.html', 'campaigns.html', 'contracts.html',
  'subscribe.html', 'notify.html', 'payment.html', 'tracking.html', 'app.html', 'staff.html',
  'dealer-settings.html', 'tempu.html', 'books.html', 'equipment.html', 'partners.html', 'quickorder.html', 'invoices.html', 'staffmate.html', 'karte.html', 'tokushoho.html', 'privacy.html', 'terms.html', 'shipping.html', 'quote.html', 'guide.html', 'faq.html', 'company.html', 'rep.html', 'pop.html', 'owner.html', 'manage.html', 'me.html',
  'assets/css/tokens.css', 'assets/css/base.css', 'assets/css/components.css',
  'assets/css/home.css', 'assets/css/pages.css', 'assets/css/product.css',
  'assets/css/cart.css', 'assets/css/reorder.css', 'assets/css/listing.css',
  'assets/css/pos.css', 'assets/css/admin.css', 'assets/css/top.css',
  'assets/js/catalog.js', 'assets/js/data.js', 'assets/js/store.js', 'assets/js/salon.js', 'assets/js/components.js',
  'assets/js/nav.js', 'assets/js/app.js', 'assets/js/home.js', 'assets/js/cart.js',
  'assets/js/product.js', 'assets/js/reorder.js', 'assets/js/favorites.js',
  'assets/js/support.js', 'assets/js/barcode.js', 'assets/js/inventory.js',
  'assets/js/pos.js', 'assets/js/admin.js',
  'manifest.webmanifest', 'assets/img/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()).catch(() => {}));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;
  // HTML（ページ遷移）はネットワーク優先＝常に最新を表示。オフライン時のみキャッシュにフォールバック。
  const isHTML = req.mode === 'navigate' || req.destination === 'document' || /\.html(\?|$)/.test(req.url);
  if (isHTML) {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then(c => c || caches.match('home.html')))
    );
    return;
  }
  // それ以外（?v= 付きの不変アセット等）はキャッシュ優先＝高速・オフライン対応。
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => cached))
  );
});

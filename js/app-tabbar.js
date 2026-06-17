/* =========================================================================
   SEAM App-style bottom tab bar (mobile only)
   - 5タブ: ホーム / 診断 / ショップ / サロン予約 / 店舗一覧
   - 「サロン予約」タップで ヘアサロン / スパサロン の選択ポップアップを表示
   - デスクトップ(≥1024px)では非表示（上部ヘッダーが担う）
   - 5言語ラベル（localStorage seamLang 連動）
   - finder.html では読み込まない（独自の没入フロー＋固定CTAのため）
   ========================================================================= */
(function () {
  if (window.__seamTabbarInit) return;
  window.__seamTabbarInit = true;

  if (/\/finder\.html(?:$|[?#])/.test(location.pathname + location.search)) return;

  var LABELS = {
    ja: { home: 'ホーム', finder: '診断', shop: 'ショップ', stores: '店舗一覧', book: 'サロン予約' },
    en: { home: 'Home', finder: 'Diagnosis', shop: 'Shop', stores: 'Stores', book: 'Booking' },
    zh: { home: '首页', finder: '诊断', shop: '商店', stores: '门店', book: '沙龙预约' },
    tw: { home: '首頁', finder: '診斷', shop: '商店', stores: '門市', book: '沙龍預約' },
    ko: { home: '홈', finder: '진단', shop: '샵', stores: '매장', book: '살롱예약' }
  };
  // 「サロン予約」サブメニュー（ヘアサロン / スパサロン）
  var SUB = {
    ja: { hair: 'ヘアサロン', spa: 'スパサロン' },
    en: { hair: 'Hair Salon', spa: 'Spa Salon' },
    zh: { hair: '美发沙龙', spa: '头皮SPA' },
    tw: { hair: '美髮沙龍', spa: '頭皮SPA' },
    ko: { hair: '헤어살롱', spa: '스파살롱' }
  };
  function lang() {
    try { return localStorage.getItem('seamLang') || 'ja'; } catch (e) { return 'ja'; }
  }

  var IC = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20a1 1 0 0 0 1 1H10v-5.5h4V21h3.5a1 1 0 0 0 1-1V9.5"/>',
    finder: '<rect x="5.5" y="4.5" width="13" height="16" rx="2"/><path d="M9.2 4.5V3.7a2.8 2.8 0 0 1 5.6 0v.8"/><path d="M9 10.5h6M9 14h6M9 17.5h3.5"/>',
    shop: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    stores: '<path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>',
    book: '<rect x="4" y="5.5" width="16" height="15" rx="2.5"/><path d="M4 9.5h16M8.5 3.5v4M15.5 3.5v4"/><path d="M9 14.5l2 2 4-4"/>',
    // サブメニュー用
    hair: '<circle cx="6" cy="6" r="2.3"/><circle cx="6" cy="18" r="2.3"/><path d="M7.7 7.5 19 18M7.7 16.5 19 6"/>',
    spa: '<path d="M12 4C8.5 8 6.5 12 12 20c5.5-8 3.5-12 0-16z"/><path d="M12 9v9"/>'
  };

  var TABS = [
    { key: 'home',   href: 'index.html',     match: /(^\/$|\/index\.html|\/$)/ },
    { key: 'finder', href: 'finder.html',    match: /\/finder\.html/ },
    { key: 'shop',   href: 'brand.html',     match: /\/brand\.html/ },
    { key: 'book',   href: 'hairsalon.html', match: /\/(hairsalon|headspa)\.html/, submenu: true },
    { key: 'stores', href: 'shop.html#stores', match: /\/shop\.html/ }
  ];

  var path = location.pathname;
  function isActive(t) { return t.match.test(path); }

  function build() {
    var L = LABELS[lang()] || LABELS.ja;
    var nav = document.getElementById('seam-tabbar');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'seam-tabbar';
      nav.setAttribute('aria-label', 'メインナビ');
      document.body.appendChild(nav);
    }
    nav.innerHTML = TABS.map(function (t) {
      var active = isActive(t);
      var attrs = t.submenu
        ? ' id="seam-tab-book" data-submenu="1" aria-haspopup="true" aria-expanded="false"'
        : '';
      return '<a href="' + t.href + '"' + attrs + (active ? ' aria-current="page"' : '') + ' class="seam-tab' + (active ? ' is-active' : '') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[t.key] + '</svg>'
        + '<span>' + (L[t.key] || '') + '</span></a>';
    }).join('');
    buildSheet();
    bindSubmenu();
  }

  function buildSheet() {
    var S = SUB[lang()] || SUB.ja;
    var back = document.getElementById('seam-tab-backdrop');
    if (!back) { back = document.createElement('div'); back.id = 'seam-tab-backdrop'; document.body.appendChild(back); }
    var sheet = document.getElementById('seam-tab-sheet');
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'seam-tab-sheet'; sheet.setAttribute('role', 'menu'); document.body.appendChild(sheet); }
    function item(href, key, label) {
      return '<a href="' + href + '" role="menuitem" class="seam-sheet-item">'
        + '<span class="seam-sheet-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + IC[key] + '</svg></span>'
        + '<span>' + label + '</span></a>';
    }
    sheet.innerHTML = '<div class="seam-sheet-card">'
      + item('hairsalon.html', 'hair', S.hair)
      + item('headspa.html', 'spa', S.spa)
      + '</div>';
  }

  function openSheet() {
    document.getElementById('seam-tab-backdrop').classList.add('open');
    document.getElementById('seam-tab-sheet').classList.add('open');
    var b = document.getElementById('seam-tab-book'); if (b) b.setAttribute('aria-expanded', 'true');
  }
  function closeSheet() {
    var bd = document.getElementById('seam-tab-backdrop'); if (bd) bd.classList.remove('open');
    var sh = document.getElementById('seam-tab-sheet'); if (sh) sh.classList.remove('open');
    var b = document.getElementById('seam-tab-book'); if (b) b.setAttribute('aria-expanded', 'false');
  }
  function isOpen() {
    var sh = document.getElementById('seam-tab-sheet'); return !!(sh && sh.classList.contains('open'));
  }

  function bindSubmenu() {
    var b = document.getElementById('seam-tab-book');
    if (b && !b.__bound) {
      b.__bound = true;
      b.addEventListener('click', function (e) { e.preventDefault(); isOpen() ? closeSheet() : openSheet(); });
    }
    var bd = document.getElementById('seam-tab-backdrop');
    if (bd && !bd.__bound) { bd.__bound = true; bd.addEventListener('click', closeSheet); }
  }

  function injectStyle() {
    if (document.getElementById('seam-tabbar-style')) return;
    var s = document.createElement('style');
    s.id = 'seam-tabbar-style';
    s.textContent = [
      '#seam-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;',
      'background:rgba(255,255,255,0.92);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
      'border-top:1px solid #E2DDD3;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -4px 20px rgba(26,24,21,0.05);}',
      '#seam-tabbar .seam-tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;',
      'padding:9px 2px 8px;text-decoration:none;color:#8C7A63;transition:color .2s;-webkit-tap-highlight-color:transparent;cursor:pointer;}',
      '#seam-tabbar .seam-tab svg{width:22px;height:22px;opacity:.85;}',
      '#seam-tabbar .seam-tab span{font-size:10px;letter-spacing:.04em;font-family:"Noto Sans JP",sans-serif;line-height:1;}',
      '#seam-tabbar .seam-tab.is-active{color:#B8945A;}',
      '#seam-tabbar .seam-tab.is-active svg{opacity:1;}',
      /* backdrop (外側タップで閉じる, タブバーより下) */
      '#seam-tab-backdrop{position:fixed;inset:0;z-index:69;display:none;background:rgba(26,24,21,.12);-webkit-backdrop-filter:blur(1px);backdrop-filter:blur(1px);}',
      '#seam-tab-backdrop.open{display:block;}',
      /* sheet (タブバーの上にポップアップ) */
      '#seam-tab-sheet{position:fixed;left:0;right:0;bottom:calc(58px + env(safe-area-inset-bottom));z-index:71;display:none;justify-content:center;pointer-events:none;padding:0 16px;}',
      '#seam-tab-sheet.open{display:flex;animation:seamSheetUp .22s ease;}',
      '@keyframes seamSheetUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}',
      '#seam-tab-sheet .seam-sheet-card{pointer-events:auto;background:#fff;border:1px solid #E2DDD3;border-radius:16px;',
      'box-shadow:0 16px 44px rgba(26,24,21,0.20);padding:7px;margin-bottom:12px;min-width:230px;}',
      '#seam-tab-sheet .seam-sheet-item{display:flex;align-items:center;gap:12px;padding:13px 16px;border-radius:11px;',
      'color:#3D3833;text-decoration:none;font-family:"Noto Serif JP",serif;font-size:15.5px;letter-spacing:.02em;transition:background .15s;-webkit-tap-highlight-color:transparent;}',
      '#seam-tab-sheet .seam-sheet-item + .seam-sheet-item{margin-top:2px;}',
      '#seam-tab-sheet .seam-sheet-item:active{background:#F4F0EA;}',
      '@media(hover:hover){#seam-tab-sheet .seam-sheet-item:hover{background:#F6F3EE;}}',
      '#seam-tab-sheet .seam-sheet-ic{width:34px;height:34px;border-radius:9999px;background:#F4F0EA;color:#B8945A;display:flex;align-items:center;justify-content:center;flex:0 0 auto;}',
      '#seam-tab-sheet .seam-sheet-ic svg{width:17px;height:17px;}',
      'body{padding-bottom:calc(58px + env(safe-area-inset-bottom));}',
      '@media (min-width:1024px){#seam-tabbar,#seam-tab-sheet,#seam-tab-backdrop{display:none !important;}body{padding-bottom:0;}}'
    ].join('');
    document.head.appendChild(s);
  }

  function init() {
    injectStyle();
    build();
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
    window.addEventListener('seamlangchange', build);
    window.addEventListener('storage', function (e) { if (e.key === 'seamLang') build(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

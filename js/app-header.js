/* =========================================================================
   SEAM unified app header (all pages)
   - Sticky white banner: left hamburger / centered SEAM / right language toggle
   - Slide-out menu (finder / shop / brand / hairsalon / headspa / onlineshop + 2 CTA)
   - Self-contained: injects its own scoped CSS (no Tailwind layout dependency).
     Only the `font-serif` / `font-mono` utility classes are reused for type,
     so the wordmark matches index exactly on every page.
   - Keeps #langToggleBtn / #langCurrentLabel so js/lang.js wires the language
     modal (#langOverlay, which every page already ships). data-i18n keys are
     translated by lang.js and fall back to the JP default if a key is missing.
   - Pages must REMOVE their old <header> + slide menu and load this script.
   ========================================================================= */
(function () {
  if (window.__seamHeaderInit) return;
  window.__seamHeaderInit = true;

  // Standard SEAM navigation (same on every page → feels like one app)
  var NAV = [
    { href: 'finder.html',     key: 'nav.finder',  label: '髪格診断' },
    { href: 'shop.html',       key: 'nav.shop',    label: 'ヘアケアショップ' },
    { href: 'brand.html',      key: 'nav.brand',   label: '取扱ブランド' },
    { href: 'hairsalon.html',  key: 'nav.salon',   label: 'ヘアサロン' },
    { href: 'headspa.html',    key: 'nav.headspa', label: 'ヘッドスパ' },
    { href: 'onlineshop.html', key: 'nav.online',  label: 'オンラインショップ' }
  ];

  function injectStyle() {
    if (document.getElementById('seam-appheader-style')) return;
    var s = document.createElement('style');
    s.id = 'seam-appheader-style';
    s.textContent = [
      /* fonts: set index's serif/mono stacks explicitly so the wordmark renders
         identically even on pages that don't load Tailwind (brand / onlineshop) */
      '#seam-appheader,#seam-mobilenav{font-family:"Noto Serif JP","Instrument Serif","Cormorant Garamond",serif;}',
      /* sticky white banner (always solid, matches index #appHeader.is-solid) */
      '#seam-appheader{position:sticky;top:0;left:0;right:0;z-index:50;padding-top:env(safe-area-inset-top,0);',
      'background:rgba(255,255,255,.9);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);',
      'box-shadow:0 1px 0 #E7E1D6,0 6px 20px rgba(26,24,21,.05);}',
      '#seam-appheader .sah-in{position:relative;max-width:1152px;margin:0 auto;height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;}',
      '@media(min-width:640px){#seam-appheader .sah-in{height:64px;padding:0 28px;}}',
      /* hamburger (left) */
      '#seam-appheader .sah-burger{position:relative;z-index:2;width:44px;height:44px;margin-left:-8px;display:inline-flex;align-items:center;justify-content:center;background:none;border:0;cursor:pointer;color:#171614;-webkit-tap-highlight-color:transparent;}',
      '#seam-appheader .sah-burger .l{display:flex;flex-direction:column;gap:5px;}',
      '#seam-appheader .sah-burger i{display:block;height:1.6px;background:currentColor;border-radius:2px;}',
      '#seam-appheader .sah-burger i:nth-child(1),#seam-appheader .sah-burger i:nth-child(2){width:22px;}',
      '#seam-appheader .sah-burger i:nth-child(3){width:15px;}',
      /* centered wordmark */
      '#seam-appheader .sah-logo{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:25px;letter-spacing:.26em;padding-left:.26em;color:#171614;text-decoration:none;line-height:1;white-space:nowrap;}',
      '@media(min-width:640px){#seam-appheader .sah-logo{font-size:27px;}}',
      /* language toggle (right) */
      '#seam-appheader .sah-lang{position:relative;z-index:2;display:inline-flex;align-items:center;gap:6px;padding:0 4px;background:none;border:0;cursor:pointer;color:#171614;font-size:11.5px;line-height:1;-webkit-tap-highlight-color:transparent;transition:opacity .2s;}',
      '#seam-appheader .sah-lang:hover{opacity:.7;}',
      '#seam-appheader .sah-lang #langCurrentLabel{letter-spacing:.1em;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}',
      /* slide-out menu */
      '#seam-mobilenav{position:fixed;inset:0;z-index:60;background:#fff;transform:translateX(100%);transition:transform .3s ease;overflow-y:auto;padding-top:env(safe-area-inset-top,0);padding-bottom:env(safe-area-inset-bottom,0);}',
      '#seam-mobilenav.open{transform:translateX(0);}',
      '#seam-mobilenav .smn-top{display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #E2DDD3;}',
      '#seam-mobilenav .smn-logo{font-size:21px;letter-spacing:.24em;padding-left:.24em;color:#171614;}',
      '#seam-mobilenav .smn-close{width:44px;height:44px;margin-right:-8px;display:flex;align-items:center;justify-content:center;background:none;border:0;color:#171614;cursor:pointer;-webkit-tap-highlight-color:transparent;}',
      '#seam-mobilenav ul{list-style:none;margin:0;padding:22px 24px 4px;display:flex;flex-direction:column;gap:2px;}',
      '#seam-mobilenav li a{display:block;padding:12px 0;font-size:17px;color:#171614;text-decoration:none;transition:color .2s;}',
      '#seam-mobilenav li a:hover{color:#B8945A;}',
      '#seam-mobilenav .smn-cta{padding:18px 24px;margin-top:6px;border-top:1px solid #E2DDD3;display:flex;flex-direction:column;gap:12px;}',
      '#seam-mobilenav .smn-cta a{display:block;text-align:center;padding:14px;border-radius:9999px;font-size:15px;text-decoration:none;}',
      '#seam-mobilenav .smn-cta .is-fill{background:#A87456;color:#fff;}',
      '#seam-mobilenav .smn-cta .is-out{border:1px solid rgba(23,22,20,.25);color:#171614;}'
    ].join('');
    document.head.appendChild(s);
  }

  function build() {
    injectStyle();

    if (!document.getElementById('seam-appheader')) {
      var header = document.createElement('header');
      header.id = 'seam-appheader';
      header.innerHTML =
        '<div class="sah-in">'
        + '<button class="sah-burger" id="seamMenuToggle" type="button" aria-label="メニューを開く" aria-expanded="false" data-i18n-attr="aria-label:a11y.menuOpen">'
        +   '<span class="l"><i></i><i></i><i></i></span>'
        + '</button>'
        + '<a href="index.html" class="sah-logo font-serif" aria-label="SEAM">SEAM</a>'
        + '<button type="button" id="langToggleBtn" class="sah-lang" aria-label="言語を切り替える" data-i18n-attr="aria-label:a11y.langToggle">'
        +   '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>'
        +   '<span id="langCurrentLabel" class="font-mono">JP</span>'
        +   '<svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 5l3 3 3-3"/></svg>'
        + '</button>'
        + '</div>';
      document.body.insertBefore(header, document.body.firstChild);
    }

    if (!document.getElementById('seam-mobilenav')) {
      var nav = document.createElement('nav');
      nav.id = 'seam-mobilenav';
      nav.setAttribute('aria-hidden', 'true');
      var links = NAV.map(function (n) {
        return '<li><a href="' + n.href + '" data-i18n="' + n.key + '">' + n.label + '</a></li>';
      }).join('');
      nav.innerHTML =
        '<div class="smn-top">'
        +   '<span class="smn-logo font-serif">SEAM</span>'
        +   '<button class="smn-close" id="seamMenuClose" type="button" aria-label="閉じる" data-i18n-attr="aria-label:a11y.menuClose">'
        +     '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M6 6l12 12M18 6L6 18"/></svg>'
        +   '</button>'
        + '</div>'
        + '<ul class="font-serif">' + links + '</ul>'
        + '<div class="smn-cta font-serif">'
        +   '<a class="is-fill" href="finder.html" data-i18n="cta.finder">髪格診断をはじめる</a>'
        +   '<a class="is-out" href="hairsalon.html" data-i18n="cta.salon">サロンを予約する</a>'
        + '</div>';
      document.body.appendChild(nav);
    }

    wire();
  }

  function wire() {
    var t = document.getElementById('seamMenuToggle');
    var c = document.getElementById('seamMenuClose');
    var n = document.getElementById('seam-mobilenav');
    if (!t || !n || t.__bound) return;
    t.__bound = true;
    function open() { n.classList.add('open'); t.setAttribute('aria-expanded', 'true'); n.setAttribute('aria-hidden', 'false'); }
    function close() { n.classList.remove('open'); t.setAttribute('aria-expanded', 'false'); n.setAttribute('aria-hidden', 'true'); }
    t.addEventListener('click', open);
    if (c) c.addEventListener('click', close);
    n.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  }

  if (document.body) build();
  else document.addEventListener('DOMContentLoaded', build);
})();

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
  // 「ショップ」サブメニュー（オンラインショップ + 7店舗）＋ 会員確認ビュー文言
  var SHOP_ITEMS = [
    { key: 'ginza',      href: 'shop.html#store-ginza' },
    { key: 'sapporo',    href: 'shop.html#store-sapporo' },
    { key: 'omotesando', href: 'shop.html#store-omotesando' },
    { key: 'osaka',      href: 'shop.html#store-osaka' },
    { key: 'nagoya',     href: 'shop.html#store-nagoya' },
    { key: 'fukuoka',    href: 'shop.html#store-fukuoka' },
    { key: 'utsunomiya', href: 'shop.html#store-utsunomiya' }
  ];
  var ONLINE_ENTER_URL = 'https://salon.town/home'; // 会員入店（online-shop-gate.js と同一）
  var SHOPW = {
    ja: { online: 'オンラインショップ', members: '会員制', ginza: '銀座', sapporo: '札幌', omotesando: '表参道', osaka: '大阪', nagoya: '名古屋', fukuoka: '福岡', utsunomiya: '宇都宮',
          confirmTitle: 'オンラインショップは会員制です', confirmBody: 'ご来店の方だけの特別なお店です<br>会員登録はお済みですか？', enter: '入店する', register: '会員登録は店頭で（店舗を見る）', back: 'もどる' },
    en: { online: 'Online Shop', members: 'Members', ginza: 'GINZA', sapporo: 'SAPPORO', omotesando: 'OMOTESANDO', osaka: 'OSAKA', nagoya: 'NAGOYA', fukuoka: 'FUKUOKA', utsunomiya: 'UTSUNOMIYA',
          confirmTitle: 'Members-only online shop', confirmBody: 'Exclusively for guests registered at our stores.<br>Are you already a member?', enter: 'Enter', register: 'Register at a store', back: 'Back' },
    zh: { online: '线上商店', members: '会员制', ginza: '银座', sapporo: '札幌', omotesando: '表参道', osaka: '大阪', nagoya: '名古屋', fukuoka: '福冈', utsunomiya: '宇都宫',
          confirmTitle: '线上商店为会员制', confirmBody: '仅面向到店注册的会员<br>您已完成会员注册吗？', enter: '进入商店', register: '到店注册会员（查看门店）', back: '返回' },
    tw: { online: '線上商店', members: '會員制', ginza: '銀座', sapporo: '札幌', omotesando: '表參道', osaka: '大阪', nagoya: '名古屋', fukuoka: '福岡', utsunomiya: '宇都宮',
          confirmTitle: '線上商店為會員制', confirmBody: '僅面向到店註冊的會員<br>您已完成會員註冊嗎？', enter: '進入商店', register: '到店註冊會員（查看門市）', back: '返回' },
    ko: { online: '온라인숍', members: '회원제', ginza: '긴자', sapporo: '삿포로', omotesando: '오모테산도', osaka: '오사카', nagoya: '나고야', fukuoka: '후쿠오카', utsunomiya: '우쓰노미야',
          confirmTitle: '온라인숍은 회원제입니다', confirmBody: '매장에서 등록하신 분만을 위한 특별한 숍이에요<br>회원 등록은 하셨나요?', enter: '입장하기', register: '매장에서 회원 등록（매장 보기）', back: '돌아가기' }
  };
  function track(target) {
    try { window.seamTrack && window.seamTrack('shop_tab', { target: target }); } catch (e) {}
  }
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
    { key: 'shop',   href: 'brand.html',     match: /\/brand\.html/, submenu: 'shop' },
    { key: 'book',   href: 'hairsalon.html', match: /\/(hairsalon|headspa)\.html/, submenu: 'book' },
    { key: 'stores', href: 'shop.html#stores', match: /\/shop\.html/ }
  ];

  var path = location.pathname;
  function isActive(t) { return t.match.test(path); }

  function build() {
    var L = LABELS[lang()] || LABELS.ja;
    // 旧・静的な下部ナビ(.bottom-nav)が残っているページでは撤去する
    // （app-tabbar と二重に表示される＝スクロール時に下部タブが二重になる原因）
    try { Array.prototype.forEach.call(document.querySelectorAll('nav.bottom-nav'), function (n) { n.parentNode && n.parentNode.removeChild(n); }); } catch (e) {}
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
        ? ' id="seam-tab-' + t.key + '" data-submenu="' + t.submenu + '" aria-haspopup="true" aria-expanded="false"'
        : '';
      return '<a href="' + t.href + '"' + attrs + (active ? ' aria-current="page"' : '') + ' class="seam-tab' + (active ? ' is-active' : '') + '">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + IC[t.key] + '</svg>'
        + '<span>' + (L[t.key] || '') + '</span></a>';
    }).join('');
    buildSheet();
    bindSubmenu();
  }

  var currentSheet = ''; // 'book' | 'shop' | ''

  function buildSheet() {
    var back = document.getElementById('seam-tab-backdrop');
    if (!back) { back = document.createElement('div'); back.id = 'seam-tab-backdrop'; document.body.appendChild(back); }
    var sheet = document.getElementById('seam-tab-sheet');
    if (!sheet) { sheet = document.createElement('div'); sheet.id = 'seam-tab-sheet'; sheet.setAttribute('role', 'menu'); document.body.appendChild(sheet); }
    if (currentSheet) renderSheet(currentSheet); // 言語切替時は開いている内容を作り直す
  }

  function sheetItem(href, key, label) {
    return '<a href="' + href + '" role="menuitem" class="seam-sheet-item" data-close="1">'
      + '<span class="seam-sheet-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + IC[key] + '</svg></span>'
      + '<span>' + label + '</span></a>';
  }

  function renderSheet(type) {
    var sheet = document.getElementById('seam-tab-sheet');
    if (!sheet) return;
    currentSheet = type;
    if (type === 'book') {
      var S = SUB[lang()] || SUB.ja;
      sheet.innerHTML = '<div class="seam-sheet-card">'
        + sheetItem('hairsalon.html', 'hair', S.hair)
        + sheetItem('headspa.html', 'spa', S.spa)
        + '</div>';
    } else if (type === 'shop') {
      var W = SHOPW[lang()] || SHOPW.ja;
      // オンラインショップ（会員制）＋ 7店舗チップ
      sheet.innerHTML = '<div class="seam-sheet-card">'
        + '<button type="button" class="seam-sheet-item seam-sheet-online" data-online="1">'
        +   '<span class="seam-sheet-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + IC.shop + '</svg></span>'
        +   '<span>' + W.online + '</span>'
        +   '<span class="seam-sheet-pill">' + W.members + '</span>'
        +   '<span class="seam-sheet-chev" aria-hidden="true">›</span>'
        + '</button>'
        + '<div class="seam-sheet-divider"></div>'
        + '<div class="seam-sheet-grid">'
        + SHOP_ITEMS.map(function (s) {
            return '<a href="' + s.href + '" role="menuitem" class="seam-sheet-store" data-close="1" data-store="' + s.key + '">' + (W[s.key] || s.key) + '</a>';
          }).join('')
        + '</div>'
        + '</div>';
    } else if (type === 'online') {
      var W2 = SHOPW[lang()] || SHOPW.ja;
      sheet.innerHTML = '<div class="seam-sheet-card seam-sheet-confirm">'
        + '<p class="seam-confirm-eyebrow">— Members Only</p>'
        + '<p class="seam-confirm-title">' + W2.confirmTitle + '</p>'
        + '<p class="seam-confirm-body">' + W2.confirmBody + '</p>'
        + '<a href="' + ONLINE_ENTER_URL + '" target="_blank" rel="noopener" class="seam-confirm-enter" data-close="1" data-enter="1">' + W2.enter + ' <span aria-hidden="true">→</span></a>'
        + '<a href="shop.html#stores" class="seam-confirm-register" data-close="1">' + W2.register + '</a>'
        + '<button type="button" class="seam-confirm-back" data-back="1">' + W2.back + '</button>'
        + '</div>';
    }
    bindSheetContent();
  }

  function bindSheetContent() {
    var sheet = document.getElementById('seam-tab-sheet');
    if (!sheet || sheet.__contentBound) return;
    sheet.__contentBound = true;
    sheet.addEventListener('click', function (e) {
      var online = e.target.closest && e.target.closest('[data-online]');
      if (online) { e.preventDefault(); track('online'); renderSheet('online'); return; }
      var back = e.target.closest && e.target.closest('[data-back]');
      if (back) { e.preventDefault(); renderSheet('shop'); return; }
      var enter = e.target.closest && e.target.closest('[data-enter]');
      if (enter) { track('online_enter'); closeSheet(); return; } // 遷移はaに任せる(新規タブ)
      var store = e.target.closest && e.target.closest('[data-store]');
      if (store) {
        track(store.getAttribute('data-store'));
        // 同一ページ内ハッシュ(shop.html上)は手動スクロール(ハッシュ同一時のno-op対策)
        if (/\/shop\.html$/.test(location.pathname)) {
          var id = (store.getAttribute('href').split('#')[1] || '');
          var el = id && document.getElementById(id);
          if (el) { e.preventDefault(); closeSheet(); history.replaceState(null, '', '#' + id); el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        }
        closeSheet(); return;
      }
      if (e.target.closest && e.target.closest('[data-close]')) closeSheet();
    });
  }

  function openSheet(type) {
    currentSheet = type;
    renderSheet(type);
    document.getElementById('seam-tab-backdrop').classList.add('open');
    document.getElementById('seam-tab-sheet').classList.add('open');
    var b = document.getElementById('seam-tab-' + (type === 'book' ? 'book' : 'shop'));
    if (b) b.setAttribute('aria-expanded', 'true');
  }
  function closeSheet() {
    currentSheet = '';
    var bd = document.getElementById('seam-tab-backdrop'); if (bd) bd.classList.remove('open');
    var sh = document.getElementById('seam-tab-sheet'); if (sh) sh.classList.remove('open');
    ['seam-tab-book', 'seam-tab-shop'].forEach(function (id) {
      var b = document.getElementById(id); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function isOpen(type) {
    var sh = document.getElementById('seam-tab-sheet');
    return !!(sh && sh.classList.contains('open')) && (!type || currentSheet === type || (type === 'shop' && currentSheet === 'online'));
  }

  function bindSubmenu() {
    ['book', 'shop'].forEach(function (type) {
      var b = document.getElementById('seam-tab-' + type);
      if (b && !b.__bound) {
        b.__bound = true;
        b.addEventListener('click', function (e) {
          e.preventDefault();
          if (isOpen(type)) { closeSheet(); }
          else { if (type === 'shop') track('open'); openSheet(type); }
        });
      }
    });
    var bd = document.getElementById('seam-tab-backdrop');
    if (bd && !bd.__bound) { bd.__bound = true; bd.addEventListener('click', closeSheet); }
  }

  function injectStyle() {
    if (document.getElementById('seam-tabbar-style')) return;
    var s = document.createElement('style');
    s.id = 'seam-tabbar-style';
    s.textContent = [
      '#seam-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:70;display:flex;',
      'background:rgba(255,255,255,0.97);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);',
      'border-top:1.5px solid #D8CFBF;padding-bottom:env(safe-area-inset-bottom);box-shadow:0 -6px 24px rgba(26,24,21,0.10);}',
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
      /* ── ショップシート(オンライン+店舗) ── */
      '#seam-tab-sheet .seam-sheet-online{width:100%;border:0;background:none;text-align:left;cursor:pointer;font:inherit;}',
      '#seam-tab-sheet .seam-sheet-online .seam-sheet-ic{background:#1A1815;color:#D9BE93;}',
      '#seam-tab-sheet .seam-sheet-pill{margin-left:auto;flex:0 0 auto;font-family:Inter,"Noto Sans JP",sans-serif;font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#B8945A;border:1px solid rgba(184,148,90,.5);border-radius:9999px;padding:3px 8px;}',
      '#seam-tab-sheet .seam-sheet-chev{flex:0 0 auto;color:#B8945A;font-size:18px;line-height:1;margin-left:2px;}',
      '#seam-tab-sheet .seam-sheet-divider{height:1px;background:#EDE7DC;margin:6px 10px;}',
      '#seam-tab-sheet .seam-sheet-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4px;padding:2px 3px 3px;}',
      '#seam-tab-sheet .seam-sheet-store{display:flex;align-items:center;justify-content:center;min-height:44px;padding:10px 8px;border-radius:10px;',
      'background:#FAF8F4;border:1px solid #EDE7DC;color:#3D3833;text-decoration:none;font-family:"Noto Serif JP",serif;font-size:14px;letter-spacing:.04em;transition:background .15s;-webkit-tap-highlight-color:transparent;}',
      '#seam-tab-sheet .seam-sheet-store:active{background:#F0EBE2;}',
      '@media(hover:hover){#seam-tab-sheet .seam-sheet-store:hover{background:#F4F0EA;border-color:#DccbAe;}}',
      '#seam-tab-sheet .seam-sheet-grid .seam-sheet-store:last-child:nth-child(odd){grid-column:1/-1;}',
      /* ── オンライン会員確認ビュー ── */
      '#seam-tab-sheet .seam-sheet-confirm{padding:20px 18px 12px;text-align:center;min-width:270px;}',
      '#seam-tab-sheet .seam-confirm-eyebrow{margin:0 0 8px;font-family:Inter,"Noto Sans JP",sans-serif;font-size:9.5px;letter-spacing:.3em;text-transform:uppercase;color:#B8945A;}',
      '#seam-tab-sheet .seam-confirm-title{margin:0 0 8px;font-family:"Noto Serif JP",serif;font-size:16.5px;color:#1A1815;letter-spacing:.01em;}',
      '#seam-tab-sheet .seam-confirm-body{margin:0 0 16px;font-family:"Noto Serif JP",serif;font-size:12.5px;line-height:2;color:#8C7A63;}',
      '#seam-tab-sheet .seam-confirm-enter{display:flex;align-items:center;justify-content:center;gap:8px;background:#1A1815;color:#FAF8F4;',
      'padding:14px 16px;border-radius:10px;text-decoration:none;font-family:"Noto Serif JP",serif;font-size:14.5px;letter-spacing:.08em;-webkit-tap-highlight-color:transparent;}',
      '#seam-tab-sheet .seam-confirm-enter:active{opacity:.9;}',
      '#seam-tab-sheet .seam-confirm-enter span{color:#D9BE93;}',
      '#seam-tab-sheet .seam-confirm-register{display:block;margin-top:12px;color:#8C7A63;text-decoration:none;font-family:"Noto Serif JP",serif;font-size:12px;letter-spacing:.03em;border-bottom:0;}',
      '#seam-tab-sheet .seam-confirm-register:active{color:#3D3833;}',
      '#seam-tab-sheet .seam-confirm-back{display:block;width:100%;margin-top:6px;background:none;border:0;cursor:pointer;color:#B0A08B;',
      'font-family:Inter,"Noto Sans JP",sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;padding:10px;}',
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
    // 店舗アンカー着地の位置補正 — lazy画像/revealで高さが後から変わり初期ハッシュスクロールが
    // ずれるため、3秒間だけ目標位置へ追従補正する（#store-* のみ・ユーザー操作で即中止）
    if (/^#store-/.test(location.hash)) {
      try { history.scrollRestoration = 'manual'; } catch (e) {}
      var cancelled = false;
      ['wheel', 'touchstart', 'keydown'].forEach(function (ev) {
        window.addEventListener(ev, function () { cancelled = true; }, { once: true, passive: true });
      });
      var HEAD = 84; // 上部ヘッダーぶんのオフセット
      var tries = 0, stable = 0;
      var iv = setInterval(function () {
        tries++;
        if (cancelled || tries > 20) { clearInterval(iv); return; }
        var el = document.getElementById(location.hash.slice(1));
        if (!el) return;
        var top = el.getBoundingClientRect().top;
        if (Math.abs(top - HEAD) > 24) {
          stable = 0;
          window.scrollTo({ top: window.pageYOffset + top - HEAD, behavior: 'instant' });
        } else if (++stable >= 3) { clearInterval(iv); }
      }, 150);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

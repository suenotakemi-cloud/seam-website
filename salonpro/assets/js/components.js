/* =========================================================
   SalonPro / Components — 描画ヘルパー（純粋関数）
   icons / fmtYen / stock label / placeholder / product card
   ========================================================= */
(function () {
  /* ---------- SVG icon set（24x24, currentColor, CSSでサイズ調整）---------- */
  const I = {
    search:  '<path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m21 21-4.3-4.3"/>',
    heart:   '<path d="M19.5 12.6 12 20l-7.5-7.4a5 5 0 1 1 7.1-7.1l.4.4.4-.4a5 5 0 1 1 7.1 7.1Z"/>',
    cart:    '<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2.5 3h2.2l2.2 12.4a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.3L21.5 7H6"/>',
    menu:    '<path d="M3 6h18M3 12h18M3 18h18"/>',
    truck:   '<path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17.5" cy="18" r="1.6"/>',
    shield:  '<path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    sliders: '<path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/>',
    chevdown:'<path d="m6 9 6 6 6-6"/>',
    chevright:'<path d="m9 6 6 6-6 6"/>',
    sort:    '<path d="M7 4v16M7 4 4 7M7 4l3 3M17 20V4M17 20l-3-3M17 20l3-3"/>',
    grid:    '<rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/>',
    list:    '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1.2"/><circle cx="3.5" cy="12" r="1.2"/><circle cx="3.5" cy="18" r="1.2"/>',
    minus:   '<path d="M5 12h14"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    checkc:  '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.3 2.3L15.5 9.5"/>',
    alert:   '<path d="M12 3 2.5 20h19z"/><path d="M12 10v4M12 17.5v.01"/>',
    clock:   '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    close:   '<path d="M6 6l12 12M18 6 6 18"/>',
    home:    '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>',
    reorder: '<path d="M4 8a8 8 0 0 1 13.7-3.5L20 7"/><path d="M20 4v3h-3"/><path d="M20 16a8 8 0 0 1-13.7 3.5L4 17"/><path d="M4 20v-3h3"/>',
    user:    '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    store:   '<path d="M4 9h16l-1-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 20v-6h6v6"/>',
    book:    '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 5v14"/>',
    chart:   '<path d="M4 20V4M4 20h16"/><rect x="8" y="11" width="3" height="6"/><rect x="14" y="7" width="3" height="10"/>',
    check:   '<path d="m5 12 5 5L20 7"/>',
    spark:   '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>',
    tag:     '<path d="M3 12l9-9 9 9-9 9z"/>',
    bell:    '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  };

  function svg(name, cls) {
    const inner = I[name] || '';
    const c = cls ? ` class="${cls}"` : '';
    return `<svg${c} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }

  /* ---------- format ---------- */
  function fmtYen(n) { return '¥' + Number(n).toLocaleString('ja-JP'); }

  /* ---------- stock label（一覧/詳細/カート共通の固定語彙）---------- */
  const STOCK = {
    in:    { text: '在庫あり',   cls: 'stock--in',    icon: 'checkc' },
    low:   { text: '残りわずか', cls: 'stock--low',   icon: 'alert'  },
    order: { text: '取寄せ',     cls: 'stock--order', icon: 'clock'  },
    wait:  { text: '入荷待ち',   cls: 'stock--wait',  icon: 'clock'  },
  };

  /* ---------- placeholder（実画像が無い場合の上質なシルエット）---------- */
  function placeholder(ph = {}, brand = '') {
    const tint = ph.tint || '#c2c4c9';
    const shape = ph.shape || 'bottle';
    const stroke = 'rgba(20,20,28,.16)';
    let body = '';

    if (shape === 'pump') {
      body = `
        <rect x="40" y="14" width="20" height="9" rx="2" fill="${tint}" stroke="${stroke}"/>
        <rect x="46" y="6" width="8" height="10" rx="2" fill="${tint}" stroke="${stroke}"/>
        <rect x="33" y="23" width="34" height="63" rx="7" fill="${tint}" stroke="${stroke}"/>
        <rect x="38" y="40" width="24" height="30" rx="3" fill="rgba(255,255,255,.55)"/>`;
    } else if (shape === 'bottle') {
      body = `
        <rect x="44" y="8" width="12" height="9" rx="2" fill="${tint}" stroke="${stroke}"/>
        <path d="M40 17h20v6l4 6v52a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V29l4-6z" fill="${tint}" stroke="${stroke}"/>
        <rect x="41" y="42" width="22" height="26" rx="3" fill="rgba(255,255,255,.55)"/>`;
    } else if (shape === 'pouch') {
      body = `
        <path d="M30 20h40a4 4 0 0 1 4 4v58a6 6 0 0 1-6 6H32a6 6 0 0 1-6-6V24a4 4 0 0 1 4-4z" fill="${tint}" stroke="${stroke}"/>
        <path d="M30 20l8-8h8l-4 8" fill="${tint}" stroke="${stroke}"/>
        <rect x="36" y="44" width="28" height="30" rx="3" fill="rgba(255,255,255,.5)"/>`;
    } else if (shape === 'tube') {
      body = `
        <path d="M42 14h16l-2 6v54a8 8 0 0 1-12 0V20z" fill="${tint}" stroke="${stroke}"/>
        <rect x="44" y="8" width="12" height="7" rx="2" fill="${tint}" stroke="${stroke}"/>
        <rect x="44" y="40" width="12" height="26" rx="3" fill="rgba(255,255,255,.5)"/>`;
    } else if (shape === 'jar') {
      body = `
        <rect x="28" y="20" width="44" height="14" rx="4" fill="${tint}" stroke="${stroke}"/>
        <rect x="31" y="32" width="38" height="50" rx="8" fill="${tint}" stroke="${stroke}"/>
        <rect x="38" y="48" width="24" height="22" rx="3" fill="rgba(255,255,255,.5)"/>`;
    } else if (shape === 'box') {
      const label = ph.label || '';
      body = `
        <rect x="26" y="22" width="48" height="56" rx="4" fill="${tint}" stroke="${stroke}"/>
        <rect x="26" y="22" width="48" height="13" rx="4" fill="rgba(0,0,0,.12)"/>
        <rect x="33" y="42" width="34" height="20" rx="3" fill="#ffffff"/>
        <text x="50" y="55" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="8" font-weight="700" fill="${tint}">${label}</text>`;
    }

    return `<svg class="card__ph" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${brand}の商品画像">${body}</svg>`;
  }

  /* ---------- product card（④⑥⑨ グリッド対応：情報量はCSSで出し分け）---------- */
  function productCard(p, index = 0) {
    const s = STOCK[p.stock] || STOCK.in;
    const fav = SP.Store.isFav(p.id);

    // バッジ（ソフトチップ・複数）：種別 → 即日発送
    const chips = [];
    if (p.badge === 'popular')   chips.push('<span class="badge badge--popular">人気</span>');
    else if (p.badge === 'new')  chips.push('<span class="badge badge--new">新商品</span>');
    else if (p.badge === 'low')  chips.push('<span class="badge badge--low">残りわずか</span>');
    if (p.staple) chips.push('<span class="badge badge--staple">定番</span>');
    if (p.contract) {
      const _cb = SP.contractBrand ? SP.contractBrand(p.contract) : null;
      chips.push(_cb && _cb.mode === 'direct'
        ? '<span class="badge badge--direct">メーカー発注</span>'
        : '<span class="badge badge--contract">契約商品</span>');
    }
    if (p.same)   chips.push('<span class="badge badge--ship">即日発送</span>');
    // 出店ディーラー（菊地＝既定は非表示。コスモ等の他ディーラー商品にだけバッジ）
    if (window.SP.DEALERS && p.dealer && p.dealer !== window.SP.primaryDealer) {
      const _dl = window.SP.dealer(p.dealer);
      chips.push(`<span class="badge" style="background:${_dl.accent}1a;color:${_dl.accent}">${_dl.name}</span>`);
    }
    const badges = chips.length ? `<div class="card__badges">${chips.join('')}</div>` : '';
    // 他ディーラーに同一商品（より安い）があれば中立に通知（価格公平）
    const _alt = SP.Store.altDealer ? SP.Store.altDealer(p) : null;
    const altNote = (_alt && _alt.cheaper && !SP.Store.allDealers())
      ? `<div class="card__alt" style="font-size:11px;color:var(--ink-3);margin-top:3px">${window.SP.dealer(_alt.dealer).name}でも取扱い <b style="color:var(--gold-strong)">${fmtYen(_alt.price)}</b></div>`
      : '';

    const media = p.image
      ? `<img src="${p.image}" alt="${p.brand} ${p.name}" loading="lazy">`
      : placeholder(p.ph, p.brand);

    // 会員価格（税抜）＋ メーカー希望小売価格（無ければ導出）＋ OFF%
    const list = p.list || Math.round(p.price * 1.28 / 10) * 10;
    const off  = Math.max(0, Math.round((1 - p.price / list) * 100));
    const lastOrder = p.lastOrder || (p.same ? '2025/05/10' : null);
    // サロン別割引（ディーラーが店舗ごとに登録）：実効価格 eff と割引率
    const sRate = (window.SP.discountRate ? SP.discountRate(p) : 0);
    const eff = (window.SP.priceOf ? SP.priceOf(p) : p.price);
    const sOff = Math.round(sRate * 100);

    // 価格表示モード（テナント設定）：open=会員価格を表示／それ以外はログイン後に表示
    const priceOpen = !(window.SP.TENANT && window.SP.TENANT.priceMode && window.SP.TENANT.priceMode !== 'open');
    const priceBlock = priceOpen
      ? `<div class="card__price"><span class="card__price-lab">${sOff > 0 ? '貴店価格' : '会員価格'}</span><span class="card__price-val">${fmtYen(eff)}<span class="tax">税抜</span></span></div>
          ${sOff > 0
            ? `<div class="card__list">通常 <s>${fmtYen(p.price)}</s><span class="off" style="background:#1f4e8c1a;color:#1f4e8c">貴店割引 ${sOff}%</span></div>`
            : `<div class="card__list">メーカー希望小売 <s>${fmtYen(list)}</s>${off > 0 ? `<span class="off">${off}%OFF</span>` : ''}</div>`}
          ${altNote}`
      : `<div class="card__price"><span class="card__price-lab" style="color:var(--ink-3);font-weight:700">価格はログイン後に表示</span></div>`;

    return `
      <article class="card" data-id="${p.id}">
        <div class="card__media">
          ${badges}
          <button class="fav-btn" data-act="fav" aria-pressed="${fav}" aria-label="お気に入りに追加">${svg('heart')}</button>
          ${media}
        </div>
        <div class="card__body">
          <span class="card__brand"><span class="card__brand-name">${p.brand}</span><button class="card__brandfav" data-act="favbrand" data-brand="${p.brand}" aria-pressed="${SP.Store.isFavBrand(p.brand)}" aria-label="${p.brand}をブランドお気に入り">${svg('heart')}</button></span>
          <h3 class="card__name">${p.name}</h3>
          ${priceBlock}
          <div class="card__signals">
            <span class="stock ${s.cls}" aria-label="${s.text}">${svg(s.icon)}<span class="stock__t">${s.text}</span></span>
            ${lastOrder ? `<span class="card__last">前回 ${lastOrder}</span>` : ''}
          </div>
          <div class="card__foot">
            ${p.stock === 'wait'
              ? (function () { const on = SP.Store.hasRestockAlert && SP.Store.hasRestockAlert(p.id);
                  return `<button class="btn-restock${on ? ' is-on' : ''}" data-act="restock" aria-pressed="${on ? 'true' : 'false'}">${svg(on ? 'checkc' : 'bell')}<span class="btn-restock__t">${on ? '登録済み' : '入荷お知らせ'}</span></button>`; })()
              : `<div class="stepper" data-id="${p.id}">
              <button data-act="dec" aria-label="数量を減らす">${svg('minus')}</button>
              <input type="number" inputmode="numeric" value="1" min="1" max="99" aria-label="数量">
              <button data-act="inc" aria-label="数量を増やす">${svg('plus')}</button>
            </div>
            <button class="btn-cart" data-act="add">${svg('cart')}<span class="btn-cart__t">カート</span></button>`}
          </div>
        </div>
      </article>`;
  }

  /* ---------- 実在ページへのリンクマップ（data-soon ラベル → 遷移先）---------- */
  const LINKS = {
    '再購入': 'reorder.html',
    '契約ブランド': 'contracts.html',
    '契約一覧': 'contracts.html',
    '定番補充セット': 'reorder.html',
    '補充サポート': 'reorder.html',
    '今週のおすすめ商材': 'index.html',
    '商品を探す': 'index.html',
    '学習コンテンツ': 'learn.html',
    '学ぶ': 'learn.html',
    '教育': 'learn.html',
    '教育コンテンツ': 'learn.html',
    'セミナー': 'seminar.html',
    'お知らせ': 'news.html',
    'キャンペーン': 'campaigns.html',
    'メーカー添付': 'tempu.html',
    '添付': 'tempu.html',
    '業界誌・書籍': 'books.html',
    '業界誌': 'books.html',
    '書籍': 'books.html',
    '定期購読': 'books.html',
    '美容機器': 'equipment.html',
    '機器・什器': 'equipment.html',
    '設備・什器': 'equipment.html',
    'リース': 'equipment.html',
    '中古機器': 'equipment.html',
    'クイックオーダー': 'quickorder.html',
    '一括発注': 'quickorder.html',
    'カラーカルテ': 'karte.html',
    '顧客カルテ': 'karte.html',
    '請求書': 'invoices.html',
    '請求書・購入明細': 'invoices.html',
    '購入明細': 'invoices.html',
    'スタッフメイト': 'staffmate.html',
    '発注テンプレート': 'reorder.html',
    'パートナー紹介': 'partners.html',
    '開業・運営パートナー': 'partners.html',
    '工務店': 'partners.html',
    '税理士': 'partners.html',
    '社労士': 'partners.html',
    '保険': 'partners.html',
    '定期便': 'subscribe.html',
    '定期便・自動補充': 'subscribe.html',
    'アプリ': 'app.html',
    '通知設定': 'notify.html',
    '通知・リマインド': 'notify.html',
    '配送状況': 'tracking.html',
    '配送追跡': 'tracking.html',
    '支払い設定': 'payment.html',
    'お支払い設定': 'payment.html',
    'スタッフ管理': 'staff.html',
    '店舗・スタッフ管理': 'staff.html',
    'サロン支援サービス': 'support.html',
    '経営支援': 'support.html',
    '注文履歴': 'orders.html',
    'お気に入り': 'favorites.html',
    '問い合わせ': 'contact.html',
    'お問い合わせ': 'contact.html',
    'マイページ': 'mypage.html',
    '会員登録': 'register.html',
    'ログイン': 'login.html',
    'ログアウト': 'login.html',
  };

  /* ---------- 数量割引（まとめ買い）＆会員ランク ---------- */
  const QTY_TIERS = [{ min: 12, off: 0.10 }, { min: 6, off: 0.05 }];  // 12個〜10%/6個〜5%
  function tierOff(qty) { for (const t of QTY_TIERS) if (qty >= t.min) return t.off; return 0; }
  function unitPrice(base, qty) { return Math.round(base * (1 - tierOff(qty))); }
  const MEMBER_RANK = 'プラチナ';

  window.SP = window.SP || {};
  Object.assign(window.SP, { icons: I, svg, fmtYen, STOCK, placeholder, productCard, LINKS, QTY_TIERS, tierOff, unitPrice, MEMBER_RANK });
})();

/* =========================================================
   出荷スケジュール（全ページ共通）
   ルール：平日 朝10:00までのご注文で当日出荷（北海道）／土日は出荷休業
   - [data-ship-strip] … カウントダウン＆次回出荷の帯
   - [data-ship-cal]   … 出荷カレンダー（今後2週間の出荷日/休業日）
   ========================================================= */
(function () {
  const WD = ['日', '月', '火', '水', '木', '金', '土'];
  const CUT_H = 10; // 朝10時締切
  const isWeekend = d => d.getDay() === 0 || d.getDay() === 6;
  const sod = d => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const sameDay = (a, b) => sod(a).getTime() === sod(b).getTime();
  // 次に出荷される日（平日・10時前なら当日、それ以外は次の平日）
  function nextShip(now) {
    if (!isWeekend(now) && now.getHours() < CUT_H) return sod(now);
    const d = sod(now); d.setDate(d.getDate() + 1);
    while (isWeekend(d)) d.setDate(d.getDate() + 1);
    return d;
  }

  function updateStrip() {
    const els = document.querySelectorAll('[data-ship-strip]');
    if (!els.length) return;
    const now = new Date();
    const truck = SP.svg('truck');
    const ship = nextShip(now);
    let html;
    if (sameDay(ship, now)) {
      const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate(), CUT_H, 0, 0);
      const ms = cutoff - now;
      const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
      const t = h > 0 ? `あと${h}時間${m}分` : `あと${m}分`;
      html = `${truck}<span><b>${t}</b>のご注文で<b>本日出荷</b>（北海道・朝10:00締切）</span>`;
    } else {
      const lead = isWeekend(now) ? '本日は出荷休業（土日）' : '本日の出荷受付（10:00締切）は終了';
      html = `${truck}<span>${lead}。次回出荷は <b>${ship.getMonth() + 1}/${ship.getDate()}（${WD[ship.getDay()]}）</b></span>`;
    }
    els.forEach(el => { el.innerHTML = html; });
  }

  function injectCalStyle() {
    if (document.getElementById('shipCalStyle')) return;
    const st = document.createElement('style'); st.id = 'shipCalStyle';
    st.textContent = '.shipcal{border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden;background:#fff}.shipcal__h{display:flex;align-items:center;gap:8px;padding:13px 15px;background:var(--dark);color:#fff;font-size:12.5px;font-weight:700;line-height:1.5}.shipcal__h svg{width:18px;height:18px;color:var(--gold);flex:none}.shipcal__h b{color:var(--gold)}.shipcal__m{display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding:13px 15px 4px;font-size:15px;font-weight:900}.shipcal__m .next{font-size:11.5px;font-weight:800;color:var(--gold-strong);white-space:nowrap}.shipcal__wk{display:grid;grid-template-columns:repeat(7,1fr);padding:4px 12px 0}.shipcal__wk span{text-align:center;font-size:10px;font-weight:700;color:var(--ink-3)}.shipcal__wk span:first-child{color:#c25}.shipcal__wk span:last-child{color:#34507a}.shipcal__grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;padding:6px 12px 12px}.shipcal__c{aspect-ratio:1;border-radius:var(--r-sm);display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;font-weight:700;font-family:var(--font-num);position:relative;border:1px solid transparent}.shipcal__c.is-ship{background:#fff;border-color:var(--line);color:var(--ink)}.shipcal__c.is-off{background:var(--surface-2);color:#c25}.shipcal__c.is-past{opacity:.36}.shipcal__c.is-today{outline:2px solid var(--ink);outline-offset:-2px}.shipcal__c.is-next{border-color:var(--gold);box-shadow:0 0 0 2px var(--gold) inset;color:var(--gold-strong)}.shipcal__c .mk{font-size:7.5px;font-weight:800;margin-top:1px;font-family:var(--font-jp)}.shipcal__legend{display:flex;flex-wrap:wrap;gap:12px;padding:0 15px 13px;font-size:11px;color:var(--ink-2)}.shipcal__legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}';
    document.head.appendChild(st);
  }
  function updateCal() {
    const els = document.querySelectorAll('[data-ship-cal]');
    if (!els.length) return;
    injectCalStyle();
    const now = new Date();
    const ship = nextShip(now);
    const y = now.getFullYear(), mo = now.getMonth(), today = now.getDate();
    const lead = new Date(y, mo, 1).getDay();
    const dim = new Date(y, mo + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="shipcal__c is-blank"></div>';
    for (let d = 1; d <= dim; d++) {
      const date = new Date(y, mo, d);
      const off = isWeekend(date);
      const isToday = d === today;
      const isNext = sameDay(date, ship);
      let cls = off ? 'is-off' : 'is-ship';
      if (d < today) cls += ' is-past';
      if (isToday) cls += ' is-today';
      if (isNext) cls += ' is-next';
      const mk = isNext ? '次回' : (isToday ? '今日' : (off ? '休' : ''));
      cells += `<div class="shipcal__c ${cls}">${d}${mk ? `<span class="mk">${mk}</span>` : ''}</div>`;
    }
    const wk = WD.map(w => `<span>${w}</span>`).join('');
    const html = `<div class="shipcal">` +
      `<div class="shipcal__h">${SP.svg('truck')}<span>平日 朝<b>10:00</b>までのご注文で<b>当日出荷</b>（北海道）／<b>土日は出荷休業</b></span></div>` +
      `<div class="shipcal__m"><span>${y}年 ${mo + 1}月</span><span class="next">次回出荷：${ship.getMonth() + 1}/${ship.getDate()}（${WD[ship.getDay()]}）</span></div>` +
      `<div class="shipcal__wk">${wk}</div>` +
      `<div class="shipcal__grid">${cells}</div>` +
      `<div class="shipcal__legend"><span><i style="background:#fff;border:1px solid var(--line)"></i>出荷日</span><span><i style="background:var(--surface-2)"></i>休業（土日）</span><span><i style="background:#fff;border:1px solid var(--gold)"></i>次回出荷</span></div>` +
      `</div>`;
    els.forEach(el => { el.innerHTML = html; });
  }

  function update() { updateStrip(); updateCal(); }
  if (document.readyState !== 'loading') update();
  else document.addEventListener('DOMContentLoaded', update);
  setInterval(update, 30000);
})();

/* =========================================================
   PWA（全ページ共通：manifest注入＋Service Worker登録）
   「ホーム画面に追加」＝軽くて落ちないアプリ体験
   ========================================================= */
(function () {
  if (!document.querySelector('link[rel="manifest"]')) {
    const l = document.createElement('link'); l.rel = 'manifest'; l.href = 'manifest.webmanifest';
    document.head.appendChild(l);
  }
  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    const a = document.createElement('link'); a.rel = 'apple-touch-icon'; a.href = 'assets/img/icon.svg';
    document.head.appendChild(a);
  }
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  // 「ホーム画面に追加」＝アプリ化（ネイティブ風）。プロンプトを捕捉して app.html / 設定から呼べるように
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.SP_installEvent = e; document.dispatchEvent(new CustomEvent('sp-installable')); });
  window.SP = window.SP || {};
  window.SP.canInstall = () => !!window.SP_installEvent;
  window.SP.promptInstall = async () => {
    const e = window.SP_installEvent; if (!e) return 'unavailable';
    e.prompt(); const r = await e.userChoice; window.SP_installEvent = null; return (r && r.outcome) || 'done';
  };
})();

/* =========================================================
   テナント設定の見た目適用（マルチテナント白ラベル：テーマ色・サイト名）
   全ページで SP.TENANT を読み、accent/siteName を反映。
   ========================================================= */
(function () {
  function apply() {
    const t = window.SP && window.SP.TENANT; if (!t) return;
    const def = (window.SP.DEFAULT_TENANT || {}).accent || '#b9923f';
    if (t.accent && t.accent !== def) {
      const id = 'tenantTheme';
      const css = ':root{--gold:' + t.accent + ';--gold-strong:' + t.accent + ';--gold-soft:' + t.accent + '1a;--gold-line:' + t.accent + '55;}';
      let s = document.getElementById(id);
      if (s) s.textContent = css; else { s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s); }
    }
    if (t.siteName && t.siteName !== 'SalonPro') {
      [].forEach.call(document.querySelectorAll('.brand__logo'), el => { el.textContent = t.siteName; });
    }
    // 機能トグル：OFFの機能へのリンク/タブ/行を全ページで非表示（ディーラーがdealer-settingsで選択）
    const F = t.features || {};
    const FEAT_HREF = {
      favorites: ['favorites.html'], learn: ['learn.html'], support: ['support.html'],
      subscribe: ['subscribe.html'], staff: ['staff.html'], pos: ['pos.html', 'inventory.html'],
      barcode: ['barcode.html'], tempu: ['tempu.html'], push: ['app.html', 'notify.html'],
      books: ['books.html'], equipment: ['equipment.html'], partners: ['partners.html'],
      quickorder: ['quickorder.html'], invoices: ['invoices.html'], staffmate: ['staffmate.html'],
      karte: ['karte.html'],
    };
    Object.keys(FEAT_HREF).forEach(feat => {
      if (F[feat] === false) FEAT_HREF[feat].forEach(href => {
        [].forEach.call(document.querySelectorAll('a[href="' + href + '"], a[href^="' + href + '?"]'), a => {
          const row = a.closest('.list-row, .tab, [data-feat-row]');
          (row || a).style.display = 'none';
        });
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();
})();

/* =========================================================
   SP.Track — サイト行動・流入の軽量計測（localStorage）
   検索ワード・動線（ページビュー）・会員申請の流入元（ファーストタッチ）を記録。
   ※デモ／プロトタイプ。本番はサーバー or 解析基盤（GA4/自社DB）へ送信に差し替え。
   ========================================================= */
(function () {
  window.SP = window.SP || {};
  var EV = 'sp.events.v1', AT = 'sp.attr.v1', SID = 'sp.sid.v1';
  function read(k, f) { try { var v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } }
  function write(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function nowMs() { return new Date().getTime(); }
  function page() { return (location.pathname.split('/').pop() || 'home.html').split('?')[0] || 'home.html'; }
  function device() { try { return window.matchMedia('(max-width: 760px)').matches ? 'mobile' : 'desktop'; } catch (e) { return 'desktop'; } }
  function query() { var q = {}; try { location.search.slice(1).split('&').forEach(function (kv) { var a = kv.split('='); if (a[0]) q[decodeURIComponent(a[0])] = decodeURIComponent((a[1] || '').replace(/\+/g, ' ')); }); } catch (e) {} return q; }
  // 流入元の判定：UTM > 紹介コード > リファラ（外部）> 直接
  function classify() {
    var q = query();
    if (q.utm_source) return { source: q.utm_source, medium: q.utm_medium || 'campaign', campaign: q.utm_campaign || '' };
    if (q.invite) return { source: '紹介コード', medium: 'invite', campaign: q.invite };
    var r = document.referrer || '';
    try {
      var h = r ? new URL(r).hostname : '';
      if (h && h.indexOf(location.hostname) < 0) {
        if (/instagram/.test(h)) return { source: 'Instagram', medium: 'social', campaign: '' };
        if (/google\./.test(h)) return { source: 'Google', medium: 'organic', campaign: '' };
        if (/twitter|x\.com|t\.co/.test(h)) return { source: 'X / Twitter', medium: 'social', campaign: '' };
        if (/youtube|youtu\.be/.test(h)) return { source: 'YouTube', medium: 'social', campaign: '' };
        if (/line\./.test(h)) return { source: 'LINE', medium: 'social', campaign: '' };
        if (/facebook/.test(h)) return { source: 'Facebook', medium: 'social', campaign: '' };
        return { source: h, medium: 'referral', campaign: '' };
      }
    } catch (e) {}
    return { source: '直接', medium: 'direct', campaign: '' };
  }
  // セッション（30分でリセット）
  var t = nowMs(), sess = read(SID, null);
  if (!sess || (t - sess.at) > 30 * 60000) sess = { id: 'S' + t.toString(36), at: t }; else sess.at = t;
  write(SID, sess);
  // ファーストタッチのアトリビューションを一度だけ保存（＝どこから来たか）
  if (!read(AT, null)) { var s = classify(); write(AT, { source: s.source, medium: s.medium, campaign: s.campaign, landing: page(), device: device(), at: t }); }
  function log(type, data) {
    var ev = read(EV, []), rec = { t: type, page: page(), sid: sess.id, dev: device(), at: nowMs() };
    if (data) for (var k in data) rec[k] = data[k];
    ev.push(rec); if (ev.length > 300) ev = ev.slice(ev.length - 300); write(EV, ev);
  }
  // 自動ページビュー（動線）。運営/スタッフ系ページは顧客行動に含めない。
  var SKIP = /admin|pos|inventory|dealer-settings|staffmate|karte/;
  if (!SKIP.test(page())) {
    var ref = ''; try { var rr = document.referrer; if (rr && new URL(rr).hostname === location.hostname) ref = new URL(rr).pathname.split('/').pop(); } catch (e) {}
    log('view', { ref: ref });
  }
  window.SP.Track = {
    attr: function () { return read(AT, null); },
    session: function () { return read(SID, null); },
    log: log,
    events: function () { return read(EV, []); },
    clear: function () { write(EV, []); },
  };
})();

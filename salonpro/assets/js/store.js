/* =========================================================
   SalonPro / Store — カート & お気に入りの状態管理
   localStorage に永続化。subscribe で UI を購読更新。
   ※ 価格・在庫は本番では注文確定時にAPI再検証する前提（仕様 4.6/4.7）
   ========================================================= */
(function () {
  const LS_CART = 'sp.cart.v1';
  const LS_FAV  = 'sp.fav.v1';
  const LS_CONTRACTS = 'sp.contracts';        // [contractBrandId] 契約済みブランド
  const LS_CONTRACT_APPS = 'sp.contractApps'; // [contractBrandId] 申込済み（連絡待ち）ブランド
  const LS_FAV_BRAND = 'sp.favBrand.v1';      // [brandName] お気に入りブランド
  const LS_FAV_COLOR = 'sp.favColor.v1';      // ['line｜family'] お気に入りカラー
  const LS_CONTRACT_RECS = 'sp.contractAppRecs.v1'; // [契約申込レコード（内容付き）] admin審査用
  const LS_SEMINAR_APPS = 'sp.seminarApps';   // [セミナー申込レコード] admin・リマインド連携
  const LS_GIFT = 'sp.gift.v1';               // { [productId]: qty } キャンペーン無料品（¥0）
  const LS_ALL_DEALERS = 'sp.allDealers.v1';  // bool: 全ディーラー表示モード（重複も全部見る）
  const LS_CLAIMS = 'sp.claims.v1';           // メーカー添付の請求台帳（無償現品）
  const LS_BUNDLES = 'sp.bundles.v1';         // カート内の添付バンドル（10＋1 等・ロックグループ）
  const LS_SALON_BUNDLES = 'sp.salonBundles.v1'; // サロン別の添付条件（現在ログイン中サロン用 campaignId→{x,y,enabled}）
  const LS_SALON_CONDS = 'sp.salonConds.v1';     // 承認時に登録する各サロンの添付条件台帳（salon→{campaignId→{x,y,enabled}}）
  const LS_SALON_DISCOUNTS = 'sp.salonDiscounts.v1'; // サロン別の割引率（salon→{makers:{maker:rate}, brands:{brand:rate}}）
  const LS_BOOK_SUBS = 'sp.bookSubs.v1';         // [bookId] 業界誌の定期購読（サブスク）中
  const LS_LEASE_APPS = 'sp.leaseApps.v1';       // [機器リース/購入/中古の申込レコード] admin通知連携
  const LS_PARTNER_LEADS = 'sp.partnerLeads.v1'; // [紹介パートナー（工務店/税理士等）の紹介依頼] admin通知連携
  const LS_BUYBACKS = 'sp.buybacks.v1';          // [大型機器の買取査定依頼（写真添付）] admin通知連携
  const LS_USED_INV = 'sp.usedInventory.v1';     // [ディーラーが出品した中古在庫] 買取成立→中古再販に自動掲載
  const LS_STAFF = 'sp.staff.v1';                // [スタッフ {id,name,role,store}]
  const LS_ACTOR = 'sp.actor.v1';                // 現在の発注者 {role,name,staffId}
  const LS_TEMPLATES = 'sp.orderTemplates.v1';   // [発注テンプレ {id,name,by,items:[{id,qty}],at}]
  const LS_ORDER_APPR = 'sp.orderApprovals.v1';  // [スタッフの発注申請 {id,staff,items,total,count,status,at}]
  const LS_STAFFMATE_ORDERS = 'sp.staffmateOrders.v1'; // [スタッフ個人発注（スタッフメイト）]

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
    catch { return fallback; }
  }
  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  const listeners = new Set();
  let cart = load(LS_CART, {}); // { [productId]: qty }
  let favs = load(LS_FAV, []);  // [productId]
  let contracts = load(LS_CONTRACTS, []); // [contractBrandId]
  let capps = load(LS_CONTRACT_APPS, []); // [contractBrandId] 申込済み
  let favBrands = load(LS_FAV_BRAND, []); // [brandName]
  let favColors = load(LS_FAV_COLOR, []); // ['line｜family']
  let appRecs = load(LS_CONTRACT_RECS, []); // 契約申込レコード（内容付き）
  let semApps = load(LS_SEMINAR_APPS, []); // セミナー申込レコード
  let gift = load(LS_GIFT, {}); // キャンペーン無料品 { [productId]: qty }
  let allDealersFlag = load(LS_ALL_DEALERS, false); // 全ディーラー表示モード
  let claims = load(LS_CLAIMS, []); // メーカー添付 請求台帳
  let bundles = load(LS_BUNDLES, []); // 添付バンドル（カート内ロックグループ）
  let salonBundles = load(LS_SALON_BUNDLES, {}); // サロン別 添付条件（現在サロン）
  let salonConds = load(LS_SALON_CONDS, {});     // 承認時に登録する各サロンの添付条件台帳
  let salonDiscounts = load(LS_SALON_DISCOUNTS, {}); // サロン別の割引率台帳
  // デモ初回のみ：ログイン中サロンにサンプル割引を1件シード（菊地が登録した想定。発注画面の「貴店価格」を体感できるように）
  if (localStorage.getItem(LS_SALON_DISCOUNTS) === null) {
    salonDiscounts = { 'SALON LUXE 表参道店': { makers: {}, brands: { 'ミルボン': 0.10 } } };
    try { localStorage.setItem(LS_SALON_DISCOUNTS, JSON.stringify(salonDiscounts)); } catch (e) {}
  }
  let bookSubs = load(LS_BOOK_SUBS, []);         // 業界誌の定期購読中 [bookId]
  let leaseApps = load(LS_LEASE_APPS, []);       // 機器リース/購入/中古の申込レコード
  let partnerLeads = load(LS_PARTNER_LEADS, []); // 紹介パートナーの紹介依頼レコード
  let buybacks = load(LS_BUYBACKS, []);          // 大型機器の買取査定依頼レコード
  let usedInventory = load(LS_USED_INV, []);     // ディーラーが出品した中古在庫レコード
  // staff.html と同形のシード（同じ sp.staff.v1 を共有）
  const SEED_STAFF = [
    { id: 'u1', name: '菊地 健一', email: 'owner@salon-luxe.jp', store: 's1', role: 'owner', perms: { view: true, order: true, approve: true } },
    { id: 'u2', name: '田中 玲奈', email: 'reina@salon-luxe.jp', store: 's1', role: 'mgr', perms: { view: true, order: true, approve: true } },
    { id: 'u3', name: '佐藤 美咲', email: 'misaki@salon-luxe.jp', store: 's1', role: 'staff', perms: { view: true, order: true, approve: false } },
    { id: 'u4', name: '山本 大輔', email: 'daisuke@salon-luxe.jp', store: 's2', role: 'mgr', perms: { view: true, order: true, approve: true } },
  ];
  let staff = load(LS_STAFF, SEED_STAFF);
  let actor = load(LS_ACTOR, { role: 'owner', name: '菊地 健一', staffId: 'u1' });
  let orderTemplates = load(LS_TEMPLATES, []);   // 発注テンプレ
  let orderApprovals = load(LS_ORDER_APPR, []);  // スタッフ発注申請
  let staffmateOrders = load(LS_STAFFMATE_ORDERS, []); // スタッフ個人発注
  const CURRENT_SALON = 'SALON LUXE 表参道店';   // 現在ログイン中サロン（本番は会員情報から解決）

  // JAN（同一商品）インデックス：重複名寄せ用。商品は実行中不変なので遅延構築。
  let _janIdx = null;
  function janGroup(jan) {
    if (!jan) return [];
    if (!_janIdx) {
      _janIdx = {};
      (window.SP.DATA.products || []).forEach(p => { if (p.jan) (_janIdx[p.jan] = _janIdx[p.jan] || []).push(p); });
    }
    return _janIdx[jan] || [];
  }
  const dealerOf = p => (p && p.dealer) || 'kikuchi';

  function emit() {
    save(LS_CART, cart);
    save(LS_FAV, favs);
    save(LS_CONTRACTS, contracts);
    save(LS_CONTRACT_APPS, capps);
    save(LS_FAV_BRAND, favBrands);
    save(LS_FAV_COLOR, favColors);
    save(LS_CONTRACT_RECS, appRecs);
    save(LS_SEMINAR_APPS, semApps);
    save(LS_GIFT, gift);
    const summary = Store.cartSummary();
    listeners.forEach(fn => fn({ cart, favs, contracts, capps, favBrands, favColors, appRecs, semApps, summary }));
  }
  const colorKey = (line, family) => line + '｜' + family;
  function brandMode(p) {
    if (!p || !p.contract || !window.SP.contractBrand) return null;
    const b = window.SP.contractBrand(p.contract);
    return b ? b.mode : null;
  }

  function productById(id) {
    return (window.SP.DATA.products || []).find(p => p.id === id);
  }

  const Store = {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    /* ---- Cart ---- */
    getQty(id) { return cart[id] || 0; },
    addToCart(id, qty = 1) {
      cart[id] = (cart[id] || 0) + Math.max(1, qty);
      emit();
    },
    setQty(id, qty) {
      if (qty <= 0) delete cart[id];
      else cart[id] = qty;
      emit();
    },
    removeFromCart(id) { delete cart[id]; emit(); },
    clearCart() { cart = {}; emit(); },
    cartSummary() {
      let count = 0, lines = 0, total = 0;
      for (const id in cart) {
        const p = productById(id);
        if (!p) continue;
        const q = cart[id];
        count += q;
        lines += 1;
        total += p.price * q;
      }
      return { count, lines, total };
    },

    /* ---- Favorites ---- */
    isFav(id) { return favs.includes(id); },
    toggleFav(id) {
      const i = favs.indexOf(id);
      if (i >= 0) favs.splice(i, 1);
      else favs.push(id);
      emit();
      return favs.includes(id);
    },
    favCount() { return favs.length; },

    /* ---- 契約ブランド（契約商品の解放） ---- */
    getContracts() { return contracts.slice(); },
    hasContract(brandId) { return contracts.indexOf(brandId) >= 0; },
    addContract(brandId) {
      if (brandId && contracts.indexOf(brandId) < 0) contracts.push(brandId);
      const i = capps.indexOf(brandId); if (i >= 0) capps.splice(i, 1); // 申込→契約済みに昇格
      emit();
      return contracts.slice();
    },
    removeContract(brandId) {
      const i = contracts.indexOf(brandId);
      if (i >= 0) contracts.splice(i, 1);
      emit();
    },
    /* ---- 契約の申し込み（オンライン不可・連絡待ち） ---- */
    getApplied() { return capps.slice(); },
    hasApplied(brandId) { return capps.indexOf(brandId) >= 0; },
    applyContract(brandId) {
      if (brandId && capps.indexOf(brandId) < 0 && contracts.indexOf(brandId) < 0) capps.push(brandId);
      emit();
      return capps.slice();
    },
    brandMode,
    isContractProduct(p) { return !!(p && p.contract); },
    // 一覧に表示してよいか：メーカー発注(direct)はカタログに出さない（契約ハブのみ）／online・applyは契約済みのみ
    canShow(p) {
      if (!p || !p.contract) return true;
      if (brandMode(p) === 'direct') return false;
      return contracts.indexOf(p.contract) >= 0;
    },
    // SalonProのカートで購入できるか：直送は不可（メーカー発注サイトへ）
    canBuy(p) {
      if (!p || !p.contract) return true;
      if (brandMode(p) === 'direct') return false;
      return contracts.indexOf(p.contract) >= 0;
    },

    /* ---- マルチディーラー（中立マーケットプレイス） ---- */
    dealerOf,
    allDealers() { return allDealersFlag; },
    setAllDealers(v) { allDealersFlag = !!v; save(LS_ALL_DEALERS, allDealersFlag); emit(); return allDealersFlag; },
    // 重複(JAN一致)時：先契約（このサロン＝primaryDealer）を表示、後発は既定非表示。全表示モードなら全部表示。
    dealerVisible(p) {
      // 連携ディーラー（相乗りマーケット）OFF＝自社（primaryDealer）の商品のみ表示
      const T = window.SP.TENANT;
      if (T && T.features && T.features.marketplace === false) return dealerOf(p) === window.SP.primaryDealer;
      if (allDealersFlag) return true;
      if (!p || !p.jan) return true;
      const grp = janGroup(p.jan);
      if (grp.length <= 1) return true;
      const dealers = grp.map(dealerOf).filter((d, i, a) => a.indexOf(d) === i);
      if (dealers.length <= 1) return true;
      const primary = dealers.indexOf(window.SP.primaryDealer) >= 0 ? window.SP.primaryDealer : dealers[0];
      return dealerOf(p) === primary;
    },
    // 表示中の商品に「他ディーラーの同一商品」があれば返す（価格公平の中立通知用）。最安の別ディーラー品。
    altDealer(p) {
      if (!p || !p.jan) return null;
      const alts = janGroup(p.jan).filter(x => x.id !== p.id && dealerOf(x) !== dealerOf(p));
      if (!alts.length) return null;
      const a = alts.slice().sort((x, y) => x.price - y.price)[0];
      return { dealer: dealerOf(a), price: a.price, cheaper: a.price < p.price };
    },
    // カート内商品をディーラー別にグループ化：{ dealerId: [{p, qty}] }
    cartByDealer() {
      const groups = {};
      for (const id in cart) {
        const p = productById(id); if (!p) continue;
        const d = dealerOf(p);
        (groups[d] = groups[d] || []).push({ p, qty: cart[id] });
      }
      return groups;
    },
    // 指定ディーラーのカート商品だけ削除（そのディーラーの注文確定時に使用）
    clearDealerCart(dealerId) {
      for (const id in cart) {
        const p = productById(id);
        if (p && dealerOf(p) === dealerId) delete cart[id];
      }
      emit();
    },

    /* ---- お気に入り（3階層：ブランド／カラー／商品） ---- */
    getFavBrands() { return favBrands.slice(); },
    isFavBrand(name) { return favBrands.indexOf(name) >= 0; },
    toggleFavBrand(name) {
      const i = favBrands.indexOf(name);
      if (i >= 0) favBrands.splice(i, 1); else favBrands.push(name);
      emit();
      return favBrands.indexOf(name) >= 0;
    },
    getFavColors() { return favColors.map(k => { const a = k.split('｜'); return { line: a[0], family: a[1] }; }); },
    isFavColor(line, family) { return favColors.indexOf(colorKey(line, family)) >= 0; },
    toggleFavColor(line, family) {
      const k = colorKey(line, family), i = favColors.indexOf(k);
      if (i >= 0) favColors.splice(i, 1); else favColors.push(k);
      emit();
      return favColors.indexOf(k) >= 0;
    },

    /* ---- 契約申込レコード（admin審査連携） ---- */
    addContractApp(rec) {
      rec = rec || {};
      rec.id = rec.id || ('ca-' + (appRecs.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.status = 'pending';
      appRecs.unshift(rec);
      if (rec.brandId && capps.indexOf(rec.brandId) < 0 && contracts.indexOf(rec.brandId) < 0) capps.push(rec.brandId);
      emit();
      return rec;
    },
    getContractApps() { return appRecs.slice(); },
    pendingContractApps() { return appRecs.filter(r => r.status === 'pending'); },
    approveContractApp(id) {
      const r = appRecs.find(x => x.id === id); if (!r) return;
      r.status = 'approved'; r.decidedAt = Date.now();
      if (r.brandId && contracts.indexOf(r.brandId) < 0) contracts.push(r.brandId);
      const i = capps.indexOf(r.brandId); if (i >= 0) capps.splice(i, 1); // 申込→契約済みへ
      emit();
      return r;
    },
    rejectContractApp(id) {
      const r = appRecs.find(x => x.id === id); if (!r) return;
      r.status = 'rejected'; r.decidedAt = Date.now();
      const i = capps.indexOf(r.brandId); if (i >= 0) capps.splice(i, 1); // 差戻し→再申込可
      emit();
      return r;
    },

    /* ---- セミナー申込（admin・リマインド連携） ---- */
    addSeminarApp(rec) {
      rec = rec || {};
      rec.id = rec.id || ('sa-' + (semApps.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.reminded = false;
      semApps.unshift(rec);
      emit();
      return rec;
    },
    getSeminarApps() { return semApps.slice(); },
    hasSeminarApp(seminarId) { return semApps.some(a => a.seminarId === seminarId); },
    seminarAppCount(seminarId) { return semApps.filter(a => a.seminarId === seminarId).length; },
    markSeminarReminded(seminarId) {
      let n = 0;
      semApps.forEach(a => { if (a.seminarId === seminarId) { a.reminded = true; n++; } });
      emit();
      return n;
    },

    /* ---- 業界誌・書籍の定期購読（サブスク） ---- */
    getBookSubs() { return bookSubs.slice(); },
    hasBookSub(id) { return bookSubs.indexOf(id) >= 0; },
    addBookSub(id) { if (id && bookSubs.indexOf(id) < 0) { bookSubs.push(id); save(LS_BOOK_SUBS, bookSubs); emit(); } return bookSubs.slice(); },
    removeBookSub(id) { const i = bookSubs.indexOf(id); if (i >= 0) { bookSubs.splice(i, 1); save(LS_BOOK_SUBS, bookSubs); emit(); } return bookSubs.slice(); },
    toggleBookSub(id) { return this.hasBookSub(id) ? this.removeBookSub(id) : this.addBookSub(id); },

    /* ---- 機器のリース／購入 申込（申込でディーラーに通知＝admin連携） ---- */
    addLeaseApp(rec) {
      rec = rec || {};
      rec.id = rec.id || ('lz-' + (leaseApps.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.status = 'pending';
      rec.at = rec.at || Date.now();
      leaseApps.unshift(rec);
      save(LS_LEASE_APPS, leaseApps); emit();
      return rec;
    },
    getLeaseApps() { return leaseApps.slice(); },
    pendingLeaseApps() { return leaseApps.filter(a => a.status === 'pending'); },
    setLeaseStatus(id, status) {
      const a = leaseApps.find(x => x.id === id); if (!a) return;
      a.status = status; a.decidedAt = Date.now();
      save(LS_LEASE_APPS, leaseApps); emit();
      return a;
    },

    /* ---- 紹介パートナー（工務店/タオル/税理士/社労士/カード決済/保険）の紹介依頼 ---- */
    addPartnerLead(rec) {
      rec = rec || {};
      rec.id = rec.id || ('pt-' + (partnerLeads.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.status = 'pending';
      rec.at = rec.at || Date.now();
      partnerLeads.unshift(rec);
      save(LS_PARTNER_LEADS, partnerLeads); emit();
      return rec;
    },
    getPartnerLeads() { return partnerLeads.slice(); },
    pendingPartnerLeads() { return partnerLeads.filter(a => a.status === 'pending'); },
    setPartnerLeadStatus(id, status) {
      const a = partnerLeads.find(x => x.id === id); if (!a) return;
      a.status = status; a.decidedAt = Date.now();
      save(LS_PARTNER_LEADS, partnerLeads); emit();
      return a;
    },

    /* ---- 大型機器の買取査定依頼（セット椅子/シャンプー台/スチーマー等・写真添付→ディーラー査定→買取→中古再販へ） ---- */
    addBuyback(rec) {
      rec = rec || {};
      rec.id = rec.id || ('bb-' + (buybacks.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.status = 'pending';
      rec.at = rec.at || Date.now();
      buybacks.unshift(rec);
      save(LS_BUYBACKS, buybacks); emit();
      return rec;
    },
    getBuybacks() { return buybacks.slice(); },
    pendingBuybacks() { return buybacks.filter(a => a.status === 'pending'); },
    setBuybackStatus(id, status, quote) {
      const a = buybacks.find(x => x.id === id); if (!a) return;
      a.status = status; a.decidedAt = Date.now();
      if (quote != null && quote !== '') a.quote = quote;   // 査定額の提示（円）
      save(LS_BUYBACKS, buybacks); emit();
      return a;
    },

    /* ---- 中古在庫（ディーラーが買取成立機器を出品→equipment.html の中古再販に自動掲載） ---- */
    addUsedItem(rec) {
      rec = rec || {};
      rec.id = rec.id || ('ui-' + (usedInventory.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.listedAt = rec.listedAt || Date.now();
      usedInventory.unshift(rec);
      save(LS_USED_INV, usedInventory); emit();
      return rec;
    },
    getUsedInventory() { return usedInventory.slice(); },
    removeUsedItem(id) {
      usedInventory = usedInventory.filter(x => x.id !== id);
      save(LS_USED_INV, usedInventory); emit();
    },

    /* ---- スタッフ／発注者（actor）：オーナー＝直接発注、スタッフ＝発注は申請→承認 ---- */
    getStaff() { return staff.slice(); },
    addStaff(rec) { rec.id = rec.id || ('st-' + Date.now()); staff.push(rec); save(LS_STAFF, staff); emit(); return rec; },
    removeStaff(id) { staff = staff.filter(s => s.id !== id); save(LS_STAFF, staff); emit(); },
    getActor() { return actor; },
    setActor(a) { actor = a || actor; save(LS_ACTOR, actor); emit(); return actor; },
    isOwner() { return actor.role === 'owner'; },
    canApprove() { return actor.role === 'owner' || actor.role === 'mgr'; },
    needsApproval() { // スタッフの店舗発注は承認が必要（ディーラーがstaffApproval=falseなら無効）
      const f = (window.SP.TENANT && window.SP.TENANT.features) || {};
      return actor.role === 'staff' && f.staffApproval !== false;
    },

    /* ---- 発注テンプレート（カートを名前付き保存→ワンタップ投入） ---- */
    getTemplates() { return orderTemplates.slice(); },
    addTemplate(name, items) {
      const rec = { id: 'tpl-' + Date.now(), name: name || 'テンプレート', by: actor.name, items: items || [], at: Date.now() };
      orderTemplates.unshift(rec); save(LS_TEMPLATES, orderTemplates); emit(); return rec;
    },
    saveCartAsTemplate(name) {
      const items = Object.keys(cart).filter(id => cart[id] > 0).map(id => ({ id: id, qty: cart[id] }));
      if (!items.length) return null;
      return this.addTemplate(name, items);
    },
    removeTemplate(id) { orderTemplates = orderTemplates.filter(t => t.id !== id); save(LS_TEMPLATES, orderTemplates); emit(); },
    applyTemplate(id) {
      const t = orderTemplates.find(x => x.id === id); if (!t) return 0;
      let n = 0; t.items.forEach(it => { if (productById(it.id)) { this.addToCart(it.id, it.qty); n++; } });
      return n;
    },

    /* ---- スタッフの発注申請 → オーナー/店長が承認 ---- */
    addOrderApproval(rec) {
      rec = rec || {};
      rec.id = rec.id || ('oa-' + (orderApprovals.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      rec.status = 'pending'; rec.at = rec.at || Date.now();
      rec.staff = rec.staff || actor.name;
      orderApprovals.unshift(rec);
      save(LS_ORDER_APPR, orderApprovals); emit();
      return rec;
    },
    getOrderApprovals() { return orderApprovals.slice(); },
    pendingOrderApprovals() { return orderApprovals.filter(a => a.status === 'pending'); },
    setOrderApprovalStatus(id, status) {
      const a = orderApprovals.find(x => x.id === id); if (!a) return;
      a.status = status; a.decidedAt = Date.now();
      save(LS_ORDER_APPR, orderApprovals); emit();
      return a;
    },

    /* ---- スタッフメイト（スタッフ個人発注・特別価格。個人発注でのみ可） ---- */
    addStaffmateOrder(rec) {
      rec = rec || {};
      rec.id = rec.id || ('sm-' + Date.now());
      rec.staff = rec.staff || actor.name; rec.at = rec.at || Date.now();
      staffmateOrders.unshift(rec);
      save(LS_STAFFMATE_ORDERS, staffmateOrders); emit();
      return rec;
    },
    getStaffmateOrders() { return staffmateOrders.slice(); },

    /* ---- メーカー添付の請求台帳（無償現品＝メーカーへ請求） ---- */
    addClaim(rec) {
      rec = rec || {};
      rec.id = rec.id || ('cl-' + (claims.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      claims.unshift(rec);
      try { localStorage.setItem(LS_CLAIMS, JSON.stringify(claims)); } catch (e) {}
      return rec;
    },
    getClaims() { return claims.slice(); },
    clearClaims() { claims = []; try { localStorage.setItem(LS_CLAIMS, JSON.stringify(claims)); } catch (e) {} },

    /* ---- 添付バンドル（カート内のロックグループ：10＋1 等） ---- */
    addBundleRec(rec) {
      rec = rec || {};
      rec.id = rec.id || ('bd-' + (bundles.length + 1) + '-' + Math.floor(Math.random() * 1e6));
      bundles.unshift(rec);
      try { localStorage.setItem(LS_BUNDLES, JSON.stringify(bundles)); } catch (e) {}
      return rec;
    },
    getBundles() { return bundles.slice(); },
    bundlesByDealer() { const g = {}; bundles.forEach(b => { const d = b.dealer || 'kikuchi'; (g[d] = g[d] || []).push(b); }); return g; },
    // バンドル内のpid（カートで個別表示から除外するため）
    bundlePids() { const s = {}; bundles.forEach(b => { for (const p in (b.paid || {})) s[p] = 1; (b.free || []).forEach(p => s[p] = 1); }); return s; },
    removeBundle(id) {
      const b = bundles.find(x => x.id === id); if (!b) return;
      for (const pid in (b.paid || {})) { const left = (cart[pid] || 0) - b.paid[pid]; if (left > 0) cart[pid] = left; else delete cart[pid]; }
      (b.free || []).forEach(pid => { const left = (gift[pid] || 0) - 1; if (left > 0) gift[pid] = left; else delete gift[pid]; });
      if (b.claimIds && b.claimIds.length) { claims = claims.filter(c => b.claimIds.indexOf(c.id) < 0); try { localStorage.setItem(LS_CLAIMS, JSON.stringify(claims)); } catch (e) {} }
      bundles = bundles.filter(x => x.id !== id);
      try { localStorage.setItem(LS_BUNDLES, JSON.stringify(bundles)); } catch (e) {}
      emit();
    },
    clearBundles() { bundles = []; try { localStorage.setItem(LS_BUNDLES, JSON.stringify(bundles)); } catch (e) {} },
    // 注文確定時：そのディーラーのバンドル記録のみ除去（claims=請求台帳は残す／cart・giftは別途clear）
    clearDealerBundles(dealerId) {
      bundles = bundles.filter(b => (b.dealer || 'kikuchi') !== dealerId);
      try { localStorage.setItem(LS_BUNDLES, JSON.stringify(bundles)); } catch (e) {}
    },

    /* ---- サロン別 添付条件（承認サロンごとに 5+1 / 10+1 等） ---- */
    // 現在ログイン中サロンの条件は承認台帳(salonConds[CURRENT_SALON])を正とする（承認時の登録と一本化）。
    salonBundleCond(campId) {
      const sc = salonConds[CURRENT_SALON] || {};
      const ov = sc[campId] || salonBundles[campId]; // 台帳優先、無ければ旧storeへフォールバック
      const c = (window.SP.CAMPAIGNS || []).find(x => x.id === campId);
      return { x: (ov && ov.x) || (c ? c.x : 10), y: (ov && ov.y) || (c ? c.y : 1), enabled: ov ? ov.enabled !== false : true };
    },
    getSalonBundles() { return Object.assign({}, salonConds[CURRENT_SALON] || salonBundles); },
    setSalonBundleCond(campId, x, y, enabled) {
      salonConds[CURRENT_SALON] = salonConds[CURRENT_SALON] || {};
      salonConds[CURRENT_SALON][campId] = { x: +x || 1, y: +y || 1, enabled: enabled !== false };
      try { localStorage.setItem(LS_SALON_CONDS, JSON.stringify(salonConds)); } catch (e) {}
      return salonConds[CURRENT_SALON][campId];
    },

    /* ---- 承認時に登録する各サロンの添付条件台帳（菊地が会員審査の承認時に設定） ---- */
    getSalonCondsAll() { return JSON.parse(JSON.stringify(salonConds)); },
    getSalonConds(salonName) { return Object.assign({}, salonConds[salonName] || {}); },
    setSalonCondsFor(salonName, condsObj) {
      salonConds[salonName] = condsObj || {};
      try { localStorage.setItem(LS_SALON_CONDS, JSON.stringify(salonConds)); } catch (e) {}
      return salonConds[salonName];
    },

    /* ---- サロン別 割引率（ディーラーが店舗ごとにメーカー/ブランドの割引を登録→その店舗だけ価格が変わる） ---- */
    currentSalon() { return CURRENT_SALON; },
    getSalonDiscountsAll() { return JSON.parse(JSON.stringify(salonDiscounts)); },
    getSalonDiscounts(salonName) { const d = salonDiscounts[salonName || CURRENT_SALON] || {}; return { makers: Object.assign({}, d.makers || {}), brands: Object.assign({}, d.brands || {}) }; },
    setSalonDiscountsFor(salonName, rules) {
      salonDiscounts[salonName] = { makers: (rules && rules.makers) || {}, brands: (rules && rules.brands) || {} };
      try { localStorage.setItem(LS_SALON_DISCOUNTS, JSON.stringify(salonDiscounts)); } catch (e) {}
      emit();
      return salonDiscounts[salonName];
    },
    // 現在ログイン中サロンの、商品ごとの割引率（0〜1）。ブランド＞メーカーの優先で大きい方を採用。
    discountRate(p) {
      if (!p) return 0;
      const d = salonDiscounts[CURRENT_SALON] || {};
      const br = (d.brands && p.brand && d.brands[p.brand]) || 0;
      const mk = (d.makers && p.maker && d.makers[p.maker]) || 0;
      const r = Math.max(br, mk);
      return (r > 0 && r < 1) ? r : 0;
    },
    // その店舗の実効単価（税抜・割引適用後）。価格表示・カート計算はこれを使う。
    priceOf(p) { return p ? Math.round(p.price * (1 - this.discountRate(p))) : 0; },

    /* ---- キャンペーン無料品（¥0・カートに別枠で表示） ---- */
    addGift(id, qty = 1) { gift[id] = (gift[id] || 0) + Math.max(1, qty); emit(); },
    getGifts() { return Object.assign({}, gift); },
    giftCount() { let n = 0; for (const id in gift) n += gift[id]; return n; },
    removeGift(id) { delete gift[id]; emit(); },
    clearGifts() { gift = {}; emit(); },
  };

  window.SP = window.SP || {};
  window.SP.Store = Store;
  // サロン別の実効単価・割引率（価格表示/計算の共通フック）
  window.SP.priceOf = function (p) { return Store.priceOf(p); };
  window.SP.discountRate = function (p) { return Store.discountRate(p); };
})();

/* =========================================================
   SalonPro / App — 商品一覧ページのコントローラ
   描画・絞り込み・並び替え・カテゴリ切替・検索・カート同期
   ========================================================= */
(function () {
  const { DATA, Store, productCard, svg, fmtYen } = SP;
  const qs  = (s, r = document) => r.querySelector(s);
  const qsa = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------------- state ---------------- */
  const savedDensity = parseInt(localStorage.getItem('sp.density'), 10);
  const savedBiz = localStorage.getItem('sp.biz');
  const state = {
    biz: ['hair', 'eye', 'nail', 'esthe'].includes(savedBiz) ? savedBiz : 'hair', // 会員の業種（ヘア/アイ/ネイル/エステ）
    cat: 'shampoo',
    sort: 'pop',
    density: [4, 6, 9].includes(savedDensity) ? savedDensity : 6, // ④⑥⑨ 表示密度
    search: '',
    brand: null,
    brandAll: false,   // ブランドを選んで全カテゴリ横断表示中（→カテゴリを押すと そのブランド×カテゴリに絞る）
    colorType: null,   // カラー剤ドリル：選択中のタイプ（alkaline/gray/oxy/... / __cross＝色味×明るさ横断）
    colorLine: null,   // カラー剤ドリル：選択中のライン（ブランド）
    colorFamily: null, // カラー剤ドリル：選択中の色（family）
    colorTone: null,   // 色味×明るさ横断：選択中の色味グループ
    colorLevel: null,  // 色味×明るさ横断：選択中の明るさ（level）
    typeSel: {},       // タイプ・チップの選択（カテゴリ別：shampoo/treatment/outbath/styling/perm/straight）
    sizeSel: {},       // 容量（サイズ）チップの選択（カテゴリ別。タイプ×サイズの掛け合わせ）
    series: null,      // シリーズ（メーカー選択中の製品ライン：アドミオ/リシオ/モイスト等）でさらに絞る
    filters: { stock: new Set(), price: null, sameDay: false, concern: new Set() },
  };

  // 業種（全美容＝ヘア＋ネイル＋エステ）。会員の業種で商材・カテゴリを出し分け。
  const BIZ = [
    { id: 'hair',  label: 'ヘア（美容室）' },
    { id: 'eye',   label: 'アイ（まつげ）' },
    { id: 'nail',  label: 'ネイル' },
    { id: 'esthe', label: 'エステ' },
  ];
  // 会員業種ごとの「関連する業種」。アイ＝美容師免許のためヘア商材も関連。
  const VIEW = { hair: ['hair'], eye: ['eye', 'hair'], nail: ['nail'], esthe: ['esthe'] };
  const view = () => VIEW[state.biz] || ['hair'];
  // ★業種では「非表示」にせず「並べ替え」だけ行う（ヘアケアがネイル/エステでも売れる・逆もある＝クロスセル対応）。
  //   自業種＝0／関連業種（アイ→ヘア等）＝1／共通(all)＝2／その他＝3 の順で前に出す。stableソート前提。
  const catRank = c => (c.biz === state.biz ? 0 : view().indexOf(c.biz) >= 0 ? 1 : c.biz === 'all' ? 2 : 3);
  // カテゴリのうち機能トグルで管理するもの（OFFのディーラーでは一覧から除外）
  const CAT_FEATURE = { book: 'books', equipment: 'equipment' };
  const catFeatureOn = c => { const f = CAT_FEATURE[c.id]; if (!f) return true; const F = (window.SP.TENANT && window.SP.TENANT.features) || {}; return F[f] !== false; };
  const orderedCats = () => DATA.categories.filter(catFeatureOn).sort((a, b) => catRank(a) - catRank(b));
  const firstCat = () => (orderedCats()[0] || { id: state.cat }).id;

  // 悩み別ファセット（商品名キーワードで近似フィルタ）
  // 悩み・仕上がり（主にヘアケア。商品名マッチ＝該当0のカテゴリ/業種では自動的に出ない）
  const CONCERNS = [
    { id: 'damage',  label: 'ダメージ補修',     re: /ダメージ|リペア|補修|モイスト|クエンチ|トリートメント|オイル|エマルジョン/ },
    { id: 'curl',    label: 'くせ毛・うねり',   re: /スムージング|ストレート|くせ|フローディア|スリーク/ },
    { id: 'color',   label: 'カラーケア',       re: /カラー|アディクシー|プロマスター|シルバー|アメジスト/ },
    { id: 'volume',  label: 'ボリューム・地肌', re: /ボリューム|スカルプ|スキャルプ|クレンジング|ジオ/ },
    { id: 'gloss',   label: 'ツヤ・仕上げ',     re: /ポリッシュ|エルジューダ|セラム|ニュアンス|スタイリング/ },
  ].map(c => ({ id: c.id, label: c.label, match: p => c.re.test(p.name) }));

  // 特長・条件（全カテゴリ・全業種で意味を持つ。該当0は自動非表示）
  const FEATURES = [
    { id: 'f-new',    label: '新商品',         match: p => p.badge === 'new' },
    { id: 'f-pop',    label: '人気商品',       match: p => p.badge === 'popular' || (p.pop || 0) >= 92 },
    { id: 'f-bulk',   label: '業務用・大容量', match: p => p.sizeBucket === 's4' || /業務用|大容量/.test(p.name) },
    { id: 'f-refill', label: '詰替・レフィル', match: p => /詰替|詰め替え|つめかえ|レフィル|ﾚﾌｨﾙ/i.test(p.name) },
  ];
  // チップ統合参照（features＝特長 / その他＝悩み）。state.filters.concern に id を入れて運用。
  const CHIP_BY_ID = {};
  CONCERNS.forEach(c => { CHIP_BY_ID[c.id] = c; });
  FEATURES.forEach(f => { f.feature = true; CHIP_BY_ID[f.id] = f; });

  const SORTS = [
    { id: 'pop',        label: '人気順' },
    { id: 'new',        label: '新着順' },
    { id: 'price_asc',  label: '価格が安い順' },
    { id: 'price_desc', label: '価格が高い順' },
    { id: 'name',       label: '名前順' },
  ];
  const PRICE_RANGES = [
    { id: 'p1', label: '〜¥2,000',        test: p => p.price < 2000 },
    { id: 'p2', label: '¥2,000〜¥4,000',  test: p => p.price >= 2000 && p.price < 4000 },
    { id: 'p3', label: '¥4,000〜¥6,000',  test: p => p.price >= 4000 && p.price < 6000 },
    { id: 'p4', label: '¥6,000〜',        test: p => p.price >= 6000 },
  ];
  const STOCK_OPTS = [
    { id: 'in',    label: '在庫あり' },
    { id: 'low',   label: '残りわずか' },
    { id: 'order', label: '取寄せ' },
  ];

  /* ---------------- compute ---------------- */
  const cat = () => DATA.categories.find(c => c.id === state.cat);
  const inSearch = () => state.search.trim().length > 0;

  /* ---------- インクリメンタル検索（打つほど絞り込み・複数語AND・サジェスト） ---------- */
  // ひらがな→カタカナ・全角→半角・小文字化（長さを変えない正規化＝打ち間違いに強く）
  function normSearch(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60)) // ひらがな→カタカナ
      .replace(/[！-～]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)) // 全角英数記号→半角
      .replace(/　/g, ' ')   // 全角スペース→半角
      .replace(/\s+/g, ' ').trim();
  }
  const escHtml = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const catLabelOf = id => { const c = DATA.categories.find(x => x.id === id); return c ? c.label : ''; };
  // 商品ごとの検索対象テキスト（商品名＋ブランド＋メーカー＋ライン＋色＋カテゴリ名）をキャッシュ
  const _hayCache = {};
  function searchHay(p) {
    if (_hayCache[p.id]) return _hayCache[p.id];
    const s = normSearch([p.name, p.brand, p.maker, p.line, p.family, catLabelOf(p.cat)].filter(Boolean).join(' '));
    _hayCache[p.id] = s;
    return s;
  }
  // スペース区切りの全キーワードを含むか（AND・部分一致）。「アディク サファ」→ 両方含む商品だけ
  function matchSearch(p, raw) {
    const hay = searchHay(p);
    const toks = normSearch(raw).split(' ').filter(Boolean);
    return toks.every(t => hay.includes(t));
  }
  // 入力を「確定済みトークン」と「入力中の最後のトークン」に分解
  function splitQuery(raw) {
    const parts = normSearch(raw).split(' ').filter(Boolean);
    const trailingSpace = /\s$/.test(raw) || raw === '';
    const active = trailingSpace ? '' : (parts.length ? parts[parts.length - 1] : '');
    const committed = trailingSpace ? parts : parts.slice(0, -1);
    return { committed, active };
  }
  // 入力中トークンに一致する候補語（ブランド/ライン/メーカー/色/カテゴリ）を、件数つきで返す
  function buildSug(raw) {
    const { committed, active } = splitQuery(raw);
    if (!active) return [];
    const ctx = DATA.products.filter(p => Store.canShow(p) && Store.dealerVisible(p) && committed.every(t => searchHay(p).includes(t)));
    if (!ctx.length) return [];
    const m = new Map();
    const add = (term, kind) => {
      if (!term) return;
      const nt = normSearch(term);
      if (!nt.includes(active) || committed.includes(nt)) return;
      const cur = m.get(nt) || { term, kind, n: 0, starts: nt.indexOf(active) === 0 };
      cur.n++; m.set(nt, cur);
    };
    ctx.forEach(p => {
      add(p.brand, 'ブランド');
      if (p.line && p.line !== p.brand) add(p.line, 'ライン');
      if (p.maker && p.maker !== p.brand) add(p.maker, 'メーカー');
      if (p.family) add(p.family, 'カラー');
      add(catLabelOf(p.cat), 'カテゴリ');
    });
    return [...m.values()]
      .sort((a, b) => (b.starts - a.starts) || (b.n - a.n) || a.term.localeCompare(b.term, 'ja'))
      .slice(0, 8);
  }
  function hiTerm(term, active) {
    const nt = normSearch(term);
    if (!active || nt.length !== term.length) return escHtml(term);
    const i = nt.indexOf(active);
    if (i < 0) return escHtml(term);
    return escHtml(term.slice(0, i)) + '<b>' + escHtml(term.slice(i, i + active.length)) + '</b>' + escHtml(term.slice(i + active.length));
  }
  function renderSug() {
    const host = qs('#searchSug'); if (!host) return;
    const raw = qs('#searchInput').value;
    const sug = buildSug(raw);
    if (!sug.length) { host.hidden = true; host.innerHTML = ''; return; }
    const { active } = splitQuery(raw);
    host.innerHTML = sug.map(s =>
      '<button type="button" class="sug" data-term="' + escHtml(s.term) + '" data-kind="' + escHtml(s.kind) + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z"/><path d="m21 21-4.3-4.3"/></svg>' +
        '<span class="sug__t">' + hiTerm(s.term, active) + '</span>' +
        '<span class="sug__k">' + s.kind + '</span>' +
        '<span class="sug__n">' + s.n + '</span>' +
      '</button>').join('');
    host.hidden = false;
  }
  // 候補タップ：ブランド→ブランド絞り込み（全カテゴリ横断）／カテゴリ→そのカテゴリへ／その他（メーカー・ライン・色）→テキスト絞り込み継続
  function clearSearchInput() {
    const input = qs('#searchInput'); input.value = ''; state.search = '';
    const c = qs('#searchClear'); if (c) c.hidden = true;
    const sug = qs('#searchSug'); if (sug) { sug.hidden = true; sug.innerHTML = ''; }
  }
  function applySug(term, kind) {
    const input = qs('#searchInput');
    if (kind === 'ブランド') {
      state.brand = term; state.brandAll = true;
      clearSearchInput(); render(); input.blur();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (kind === 'カテゴリ') {
      const c = DATA.categories.find(x => x.label === term);
      if (c) { state.cat = c.id; state.brandAll = false; clearSearchInput(); render(); input.blur(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    }
    // メーカー／ライン／色 → 最後のトークンを候補語で置換して続けて絞れる（テキスト検索）
    let raw = input.value;
    if (raw === '' || /\s$/.test(raw)) raw = raw + term + ' ';
    else raw = raw.replace(/(^|\s)([^\s]*)$/, (m, pre) => pre + term + ' ');
    input.value = raw;
    state.search = raw;
    qs('#searchClear').hidden = !raw;
    render();
    renderSug();
    input.focus();
  }
  // 契約商品：online/applyは契約済みのときだけ表示。メーカー直送(direct)は常に表示（注文は外部）。
  // 検索中、またはブランドを選んで横断表示中（brandAll）は全カテゴリ対象。通常は現在カテゴリのみ。
  const crossCat = () => inSearch() || (state.brand && state.brandAll);
  const base = () => (crossCat() ? DATA.products : DATA.products.filter(p => p.cat === state.cat)).filter(p => Store.canShow(p) && Store.dealerVisible(p));

  // カラー剤ドリル（タイプ › ライン › 色 › 明るさ）
  const COLOR_TYPES = SP.COLOR_TYPES || [];
  const colorAll = () => DATA.products.filter(p => p.cat === 'color' && Store.canShow(p) && Store.dealerVisible(p));
  const colorOfType = t => colorAll().filter(p => (p.colorType || 'alkaline') === t);
  const colorTypeDef = id => COLOR_TYPES.find(t => t.id === id);
  // タイプ内のライン一覧（アルカリ/白髪などライン構造を持つタイプ用）
  const colorLines = () => {
    const seen = {}, out = [];
    colorOfType(state.colorType).filter(p => p.line).forEach(p => { if (!seen[p.line]) { seen[p.line] = { line: p.line, maker: p.maker, count: 0 }; out.push(seen[p.line]); } seen[p.line].count++; });
    return out;
  };
  const colorFamilies = (line) => {
    const seen = {}, out = [];
    colorAll().filter(p => p.line === line).forEach(p => { if (!seen[p.family]) { seen[p.family] = { family: p.family, tint: (p.ph && p.ph.tint) || '#999', count: 0 }; out.push(seen[p.family]); } seen[p.family].count++; });
    return out;
  };
  const colorShades = (line, family) => colorAll().filter(p => p.line === line && p.family === family).sort((a, b) => a.level - b.level);
  const inColorDrill = () => state.cat === 'color' && !inSearch() && !state.brand;

  // シリーズ（メーカーの中の製品ライン）を導出。美容師の頭の中の「メーカー→シリーズ→商品」に合わせる。
  // 例：アリミノ→アドミオ（カラー）／ミルボン→リシオ（ストレート）／アリミノ→モイスト（シャンプー）。
  const seriesOf = (p) => {
    const mk = p.maker || p.brand;
    if (p.line && p.line !== mk) return p.line;
    if (p.brand && p.brand !== mk) return p.brand;
    return null;
  };
  function filtered() {
    let list = base();
    if (inSearch()) {
      list = list.filter(p => matchSearch(p, state.search));
    }
    // ブランド絞り込みは brand／メーカー／ライン を横断一致（例：「ミルボン」＝メーカー＝アディクシー等 傘下も含む）
    if (state.brand) { const b = state.brand; list = list.filter(p => p.brand === b || p.maker === b || p.line === b); }
    // シリーズ絞り込み（メーカーの中の製品ライン）。該当が無い選択は自己解除（カテゴリ/ブランド切替時の取り残し防止）。
    if (state.series) { const w = list.filter(p => seriesOf(p) === state.series); if (w.length) list = w; else state.series = null; }
    if (state.filters.stock.size) list = list.filter(p => state.filters.stock.has(p.stock));
    if (state.filters.price) {
      const r = PRICE_RANGES.find(x => x.id === state.filters.price);
      if (r) list = list.filter(r.test);
    }
    if (state.filters.sameDay) list = list.filter(p => p.same);
    if (state.filters.concern.size) {
      const sel = [...state.filters.concern].map(id => CHIP_BY_ID[id]).filter(Boolean);
      const cons = sel.filter(c => !c.feature);   // 悩み＝OR（広げる）
      const feats = sel.filter(c => c.feature);   // 特長＝AND（絞る）
      if (cons.length) list = list.filter(p => cons.some(c => c.match(p)));
      if (feats.length) list = list.filter(p => feats.every(c => c.match(p)));
    }
    // タイプ・チップ＋容量チップ絞り込み（掛け合わせ。検索中・ブランド横断中は無効）
    if (!crossCat() && TYPE_CATS[state.cat]) {
      const _tc = TYPE_CATS[state.cat];
      const _ts = state.typeSel[state.cat]; if (_ts) list = list.filter(p => p[_tc.key] === _ts);
      const _ss = state.sizeSel[state.cat]; if (_ss) list = list.filter(p => p.sizeBucket === _ss);
    }

    const by = {
      pop:        (a, b) => b.pop - a.pop,
      new:        (a, b) => b.added - a.added,
      price_asc:  (a, b) => a.price - b.price,
      price_desc: (a, b) => b.price - a.price,
      name:       (a, b) => a.name.localeCompare(b.name, 'ja'),
    }[state.sort];
    return [...list].sort(by);
  }

  const hasActiveFilter = () =>
    state.brand || state.series || state.filters.stock.size || state.filters.price || state.filters.sameDay || state.filters.concern.size
    || !!(TYPE_CATS[state.cat] && (state.typeSel[state.cat] || state.sizeSel[state.cat]));

  /* ---------------- render ---------------- */
  const PAGE_SIZE = 60;          // 一覧の初回描画件数（DOM肥大・INP対策。以降は「もっと見る」で追加）
  let renderPage = 1, lastSig = '';
  function renderSig() {
    return JSON.stringify([state.cat, state.brand, state.brandAll, state.series, state.search, state.sort,
      [...state.filters.stock], state.filters.price, state.filters.sameDay, [...state.filters.concern],
      state.typeSel[state.cat] || '', state.sizeSel[state.cat] || '']);
  }
  function updateLoadMore(shown, total) {
    const wrap = qs('#loadMore'); if (!wrap) return;
    if (total > shown) {
      wrap.hidden = false;
      const btn = qs('#loadMoreBtn');
      if (btn) btn.textContent = `もっと見る（残り ${(total - shown).toLocaleString()} 件）`;
    } else { wrap.hidden = true; }
  }
  // 検索ワードの計測（入力途中を弾くため約1.1秒デバウンス＋連続同一を除外）
  let _trkTimer = null, _trkLast = '';
  function trackSearch(q, n) {
    if (!q || !(window.SP && SP.Track)) return;
    clearTimeout(_trkTimer);
    _trkTimer = setTimeout(function () { if (q && q !== _trkLast) { _trkLast = q; SP.Track.log('search', { q: q, n: n }); } }, 1100);
  }

  function render() {
    // カラーのドリル状態はカラー以外で初期化（タイプ・チップ state.typeSel はカテゴリ別に保持）
    if (state.cat !== 'color') { state.colorType = null; state.colorLine = null; state.colorFamily = null; }
    const grid = qs('#grid');
    // カラー剤＝タイプ先選択ドリル（タイプ › ライン › 色 › 明るさ）。検索中は通常グリッド。
    if (inColorDrill()) {
      renderTypeChips();
      renderColorDrill(grid);
      qs('#resultSort').textContent = SORTS.find(s => s.id === state.sort).label;
      renderActiveChips(); syncPills(); syncDensityToggle(); renderCatQuick(); renderBizBar(); renderContractNotice();
      return;
    }
    renderTypeChips();
    const list = filtered();
    grid.className = 'product-grid';
    grid.dataset.density = state.density;

    // 絞り込み条件が変わったら1ページ目に戻す（「もっと見る」では維持）
    const sig = renderSig();
    if (sig !== lastSig) { renderPage = 1; lastSig = sig; }

    if (!list.length) {
      grid.innerHTML = '';
      qs('#empty').hidden = false;
      updateLoadMore(0, 0);
    } else {
      qs('#empty').hidden = true;
      const shown = Math.min(list.length, renderPage * PAGE_SIZE);
      grid.innerHTML = list.slice(0, shown).map((p, i) => productCard(p, i)).join('');
      updateLoadMore(shown, list.length);
    }

    // title + count
    const crumbEl = qs('#crumbCat');
    if (inSearch()) {
      qs('#pageTitle').textContent = `「${state.search.trim()}」の検索結果`;
      qs('#pageCount').innerHTML = `<b>${list.length}</b>件`;
      if (crumbEl) crumbEl.textContent = '検索結果';
      trackSearch(state.search.trim(), list.length);
    } else if (state.brand && state.brandAll) {
      qs('#pageTitle').textContent = state.brand;
      qs('#pageCount').innerHTML = `全<b>${list.length}</b>件 ・ <span style="font-size:12px;color:var(--ink-3);font-weight:600">カテゴリを選ぶと絞り込めます</span>`;
      if (crumbEl) crumbEl.textContent = state.brand;
    } else {
      qs('#pageTitle').textContent = cat().label;
      const showCount = hasActiveFilter() ? list.length : cat().count;
      qs('#pageCount').innerHTML = `全<b>${showCount}</b>件`;
      if (crumbEl) crumbEl.textContent = cat().label;
    }
    qs('#resultSort').textContent = SORTS.find(s => s.id === state.sort).label;
    qs('#emptyTitle').textContent = (inSearch() || hasActiveFilter()) ? '該当する商品が見つかりません' : 'このカテゴリは準備中です';

    syncFavButtons();
    renderActiveChips();
    syncPills();
    syncDensityToggle();
    renderCatQuick();
    renderBizBar();
    renderContractNotice();
  }

  // このカテゴリ／検索結果に「未契約の契約ブランド」があれば、契約一覧への案内を出す
  function lockedBrandsHere() {
    const src = inSearch()
      ? DATA.products.filter(p => matchSearch(p, state.search))
      : DATA.products.filter(p => p.cat === state.cat);
    // 菊池発注(online/apply)で未契約のブランドのみ案内（メーカー発注=directはカタログに出さないので除外）
    const ids = [...new Set(src.filter(p => p.contract && Store.brandMode(p) !== 'direct' && !Store.hasContract(p.contract)).map(p => p.contract))];
    return ids.map(id => SP.contractBrand(id)).filter(Boolean);
  }
  function renderContractNotice() {
    const host = qs('#contractNotice');
    if (!host) return;
    if (!qs('#contractNoticeStyle')) {
      const st = document.createElement('style'); st.id = 'contractNoticeStyle';
      st.textContent = '#contractNotice{margin:0 0 12px}#contractNotice[hidden]{display:none}.cnote{display:flex;align-items:center;gap:10px;padding:11px 13px;border:1px solid var(--gold-line);background:var(--gold-soft);border-radius:var(--r-md);color:var(--ink);text-decoration:none}.cnote__ic{flex:none;color:var(--gold-strong);display:flex}.cnote__ic svg{width:20px;height:20px}.cnote__tx{font-size:12.5px;line-height:1.5;font-weight:600}.cnote__tx b{color:var(--gold-strong)}.cnote__go{margin-left:auto;flex:none;display:flex;align-items:center;gap:1px;color:var(--gold-strong);font-weight:800;font-size:12.5px;white-space:nowrap}.cnote__go svg{width:14px;height:14px}';
      document.head.appendChild(st);
    }
    const locked = lockedBrandsHere();
    if (!locked.length) { host.hidden = true; host.innerHTML = ''; return; }
    host.hidden = false;
    const names = locked.map(b => b.brand).join('・');
    host.innerHTML = `<a class="cnote" href="contracts.html">
      <span class="cnote__ic">${svg('shield')}</span>
      <span class="cnote__tx"><b>${names}</b> は契約ブランドです。契約・お申し込みで取扱いでき、ここに表示されます。</span>
      <span class="cnote__go">契約・申込${svg('chevright')}</span></a>`;
  }

  // タイプ・チップ（商品一覧の上に出す即フィルタ）。カラーはタイル式ドリルなので対象外。
  const TYPE_CATS = {
    shampoo:   { list: () => SP.SHAMPOO_TYPES || [],   key: 'shampooType' },
    treatment: { list: () => SP.TREATMENT_TYPES || [], key: 'treatmentType' },
    outbath:   { list: () => SP.OUTBATH_TYPES || [],   key: 'outbathType' },
    styling:   { list: () => SP.STYLING_TYPES || [],   key: 'stylingType' },
    perm:      { list: () => SP.PERM_TYPES || [],      key: 'permType' },
    straight:  { list: () => SP.STRAIGHT_TYPES || [],  key: 'straightType' },
  };
  const SIZE_BUCKETS = SP.SIZE_BUCKETS || [];
  const typeCfg = () => {
    const c = TYPE_CATS[state.cat]; if (!c) return null;
    return { list: c.list(), key: c.key, sel: state.typeSel[state.cat] || null };
  };
  // タイプ/容量チップの母集合。ブランド絞り込み中はそのブランド（brand/メーカー/ライン）に限定＝件数も連動
  const inCatProducts = () => DATA.products.filter(p => p.cat === state.cat && Store.canShow(p) && Store.dealerVisible(p) && (!state.brand || p.brand === state.brand || p.maker === state.brand || p.line === state.brand) && (!state.series || seriesOf(p) === state.series));
  // 現在のカテゴリ×選択メーカー内の「シリーズ」一覧（件数つき）。シリーズ選択は反映しない＝常に全シリーズを出して切替可能に。
  const seriesItems = () => {
    if (!state.brand) return [];
    const b = state.brand;
    const m = new Map();
    DATA.products.forEach(p => {
      if (p.cat !== state.cat || !Store.canShow(p) || !Store.dealerVisible(p)) return;
      if (!(p.brand === b || p.maker === b || p.line === b)) return;
      const s = seriesOf(p); if (s && s !== b) m.set(s, (m.get(s) || 0) + 1);
    });
    return [...m.entries()].map(([id, n]) => ({ id, label: id, n })).sort((a, b) => b.n - a.n);
  };
  // タイプ件数は現在の容量選択を、容量件数は現在のタイプ選択を反映（相互連動＝掛け合わせ件数）
  const typeCountCtx = (key, id) => { const ss = state.sizeSel[state.cat]; return inCatProducts().filter(p => p[key] === id && (!ss || p.sizeBucket === ss)).length; };
  const sizeCountCtx = (bid) => { const c = TYPE_CATS[state.cat], ts = state.typeSel[state.cat]; return inCatProducts().filter(p => p.sizeBucket === bid && (!ts || p[c.key] === ts)).length; };
  function chipRow(label, items, attr, sel) {
    const chips = ['<button class="tchip' + (!sel ? ' is-on' : '') + '" data-' + attr + '="__all">すべて</button>']
      .concat(items.filter(x => x.n > 0).map(x =>
        '<button class="tchip' + (sel === x.id ? ' is-on' : '') + '" data-' + attr + '="' + x.id + '">' + x.label + '<span class="tchip__n">' + x.n + '</span></button>'));
    return '<div class="tc-row"><span class="tc-row__l">' + label + '</span><div class="tc-row__chips">' + chips.join('') + '</div></div>';
  }
  function renderTypeChips() {
    let host = qs('#typeChips');
    const cfg = (!crossCat()) ? typeCfg() : null;
    const sItems = (!crossCat()) ? seriesItems() : [];
    if (!cfg && !sItems.length) { if (host) host.hidden = true; return; }
    if (!host) {
      if (!qs('#typeChipsStyle')) {
        const s = document.createElement('style'); s.id = 'typeChipsStyle';
        s.textContent = '.type-chips{display:flex;flex-direction:column;gap:7px;padding:2px 0 12px}.tc-row{display:flex;align-items:center;gap:8px}.tc-row__l{flex:none;font-size:11px;font-weight:800;color:var(--ink-3);width:46px;white-space:nowrap}.tc-row__chips{display:flex;gap:8px;overflow-x:auto;min-width:0}.tc-row__chips::-webkit-scrollbar{height:0}.type-chips .tchip{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 13px;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--surface-2);font-size:12.5px;font-weight:700;color:var(--ink-2);cursor:pointer;white-space:nowrap}.type-chips .tchip.is-on{background:var(--gold);border-color:var(--gold);color:#fff}.type-chips .tchip__n{font-size:11px;font-weight:800;opacity:.6}.type-chips .tchip.is-on .tchip__n{opacity:.9}';
        document.head.appendChild(s);
      }
      host = document.createElement('div'); host.id = 'typeChips'; host.className = 'type-chips';
      const grid = qs('#grid'); grid.parentNode.insertBefore(host, grid);
      host.addEventListener('click', e => {
        const seb = e.target.closest('[data-serieschip]');
        const tb = e.target.closest('[data-typechip]');
        const sb = e.target.closest('[data-sizechip]');
        if (seb) { const v = seb.dataset.serieschip; state.series = (v === '__all') ? null : v; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        else if (tb) { const v = tb.dataset.typechip; state.typeSel[state.cat] = (v === '__all') ? null : v; render(); }
        else if (sb) { const v = sb.dataset.sizechip; state.sizeSel[state.cat] = (v === '__all') ? null : v; render(); }
      });
    }
    host.hidden = false;
    let html = '';
    // シリーズ行（メーカー選択中＝「アリミノ→アドミオ」等のサブブランドで絞れる）。最優先で先頭に。
    if (sItems.length) html += chipRow('シリーズ', sItems, 'serieschip', state.series);
    if (cfg) {
      html += chipRow('タイプ', cfg.list.map(t => ({ id: t.id, label: t.label, n: typeCountCtx(cfg.key, t.id) })), 'typechip', cfg.sel);
      // 容量（サイズ）行：このカテゴリに容量が付く商品があるときだけ表示
      const sizeItems = SIZE_BUCKETS.map(b => ({ id: b.id, label: b.label, n: sizeCountCtx(b.id) }));
      if (sizeItems.some(x => x.n > 0)) html += chipRow('容量', sizeItems, 'sizechip', state.sizeSel[state.cat] || null);
    }
    host.innerHTML = html;
  }

  // カラー剤＝タイプ先選択ドリル（タイプ › ライン › 色 › 明るさ）。プロが薬剤タイプで素早く選べる。
  function renderColorDrill(grid) {
    if (!qs('#colorDrillStyle')) {
      const st = document.createElement('style'); st.id = 'colorDrillStyle';
      st.textContent = '.color-drill{display:block}.cd-crumb{display:flex;align-items:center;gap:2px;flex-wrap:wrap;margin-bottom:14px}.cd-crumb__l{font-size:12.5px;font-weight:700;color:var(--gold-strong);background:none;border:0;padding:2px;cursor:pointer}.cd-crumb__cur{font-size:12.5px;font-weight:800;color:var(--ink);padding:2px}.cd-crumb__sep{color:var(--ink-3);font-size:11px;margin:0 2px}.cd-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}@media(min-width:560px){.cd-grid{grid-template-columns:repeat(3,1fr)}}@media(min-width:880px){.cd-grid{grid-template-columns:repeat(4,1fr)}}.cd-cell{position:relative}.cd-go{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:14px;cursor:pointer;width:100%}.cd-go:hover{box-shadow:var(--shadow-md);border-color:var(--line-3)}.cd-cell--color .cd-go{align-items:stretch}.cd-card__maker{font-size:10.5px;color:var(--ink-3);font-weight:700}.cd-card__name{font-size:15px;font-weight:900;color:var(--ink)}.cd-card__meta{font-size:11.5px;color:var(--gold-strong);font-weight:700;margin-top:3px}.cd-swatch{height:48px;border-radius:var(--r-sm);margin-bottom:7px;border:1px solid rgba(0,0,0,.08)}.cd-fav{position:absolute;top:8px;right:8px;z-index:2;width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,.92);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--ink-3);padding:0;cursor:pointer}.cd-fav svg{width:16px;height:16px}.cd-fav[aria-pressed=true]{color:#d8392b}.cd-fav[aria-pressed=true] svg{fill:#d8392b}'
        + '.cdt-grid{display:grid;grid-template-columns:1fr;gap:10px}@media(min-width:560px){.cdt-grid{grid-template-columns:1fr 1fr}}@media(min-width:880px){.cdt-grid{grid-template-columns:1fr 1fr 1fr}}.cdt{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid var(--line);border-radius:var(--r-lg);padding:14px;cursor:pointer;width:100%;text-align:left}.cdt:hover{box-shadow:var(--shadow-md);border-color:var(--gold)}.cdt--cross{margin-bottom:10px;border-color:var(--gold-line);background:var(--gold-soft)}.cdt__ic{flex:none;width:42px;height:42px;border-radius:var(--r-md);background:var(--gold-soft);color:var(--gold-strong);display:flex;align-items:center;justify-content:center}.cdt__ic svg{width:22px;height:22px}.cdt__b{flex:1;min-width:0}.cdt__t{display:block;font-size:14.5px;font-weight:900;color:var(--ink)}.cdt__s{display:block;font-size:11.5px;color:var(--ink-3);font-weight:700;margin-top:2px}.cdt__go{flex:none;color:var(--gold-strong)}.cdt__go svg{width:18px;height:18px}'
        + '.cx-wrap{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}.cx-row{display:flex;align-items:center;gap:8px}.cx-l{flex:none;width:36px;font-size:11px;font-weight:800;color:var(--ink-3)}.cx-chips{display:flex;gap:7px;overflow-x:auto;min-width:0}.cx-chips::-webkit-scrollbar{height:0}.cx-chip{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--surface-2);font-size:12.5px;font-weight:700;color:var(--ink-2);cursor:pointer;white-space:nowrap}.cx-chip.is-on{background:var(--gold);border-color:var(--gold);color:#fff}.cx-sw{width:14px;height:14px;border-radius:50%;border:1px solid rgba(0,0,0,.12)}.cx-n{font-size:11px;font-weight:800;opacity:.6}.cx-chip.is-on .cx-n{opacity:.9}';
      document.head.appendChild(st);
    }
    grid.className = 'color-drill';
    grid.removeAttribute('data-density');
    const heart = svg('heart');
    const cc = qs('#crumbCat'); if (cc) cc.textContent = 'カラー剤';

    // Step 0：タイプ未選択 → 製品タイプの選択タイル（件数つき）
    if (!state.colorType) {
      qs('#pageTitle').textContent = 'カラー剤';
      qs('#pageCount').innerHTML = `<b>${COLOR_TYPES.length}</b>タイプ`;
      let html = '<nav class="cd-crumb"><span class="cd-crumb__cur">カラー剤</span></nav>';
      // 先頭に「色味×明るさで探す（全ブランド横断）」＝各社が未対応の差別化機能
      html += '<button class="cdt cdt--cross" data-cd="picktype" data-v="__cross">' +
        '<span class="cdt__ic" style="background:linear-gradient(135deg,#1f4e8c,#7a4f9e,#1f7a5a);color:#fff"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg></span>' +
        '<span class="cdt__b"><span class="cdt__t">色味×明るさで探す</span><span class="cdt__s">全ブランド横断（アッシュ×10レベル 等）</span></span>' +
        `<span class="cdt__go">${svg('chevright')}</span></button>`;
      html += '<div class="cdt-grid">' + COLOR_TYPES.map(t => {
        const n = colorOfType(t.id).length;
        return `<button class="cdt" data-cd="picktype" data-v="${t.id}">` +
          `<span class="cdt__ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${t.icon}</svg></span>` +
          `<span class="cdt__b"><span class="cdt__t">${t.label}</span><span class="cdt__s">${t.sub} ・ ${n}点</span></span>` +
          `<span class="cdt__go">${svg('chevright')}</span></button>`;
      }).join('') + '</div>';
      grid.innerHTML = html;
      qs('#empty').hidden = true;
      return;
    }

    // 色味×明るさ 横断（全ブランド）：トーン・チップ × 明るさ・チップ → 横断グリッド
    if (state.colorType === '__cross') {
      const TONES = SP.COLOR_TONES || [], LEVELS = SP.COLOR_LEVELS || [];
      const TONE_TINT = { 'アッシュ': '#6b7280', 'ブルー': '#1f4e8c', 'バイオレット': '#7a4f9e', 'グレー': '#8f9398', 'マット': '#1f7a5a', 'ベージュ': '#b9a78a', 'ブラウン': '#8a5a2f', 'ピンク': '#cf7a93' };
      const lineColors = colorAll().filter(p => p.tone && p.level); // ライン構造を持つ色（アルカリ＋白髪）
      const tn = state.colorTone, lv = state.colorLevel;
      let list = lineColors;
      if (tn) list = list.filter(p => p.tone === tn);
      if (lv) list = list.filter(p => p.level === lv);
      list = list.slice().sort((a, b) => a.level - b.level || a.line.localeCompare(b.line, 'ja'));
      qs('#pageTitle').textContent = '色味×明るさで探す';
      qs('#pageCount').innerHTML = `<b>${list.length}</b>件`;
      let h = '<nav class="cd-crumb"><button class="cd-crumb__l" data-cd="root">カラー剤</button><span class="cd-crumb__sep">›</span><span class="cd-crumb__cur">色味×明るさ（横断）</span></nav>';
      // 色味チップ（スウォッチ付き）
      h += '<div class="cx-wrap"><div class="cx-row"><span class="cx-l">色味</span><div class="cx-chips">';
      h += '<button class="cx-chip' + (!tn ? ' is-on' : '') + '" data-tone="__all">すべて</button>';
      h += TONES.map(t => {
        const n = lineColors.filter(p => p.tone === t && (!lv || p.level === lv)).length;
        return n ? '<button class="cx-chip' + (tn === t ? ' is-on' : '') + '" data-tone="' + t + '"><span class="cx-sw" style="background:' + (TONE_TINT[t] || '#999') + '"></span>' + t + '<span class="cx-n">' + n + '</span></button>' : '';
      }).join('');
      h += '</div></div><div class="cx-row"><span class="cx-l">明るさ</span><div class="cx-chips">';
      h += '<button class="cx-chip' + (!lv ? ' is-on' : '') + '" data-level="__all">すべて</button>';
      h += LEVELS.map(L => {
        const n = lineColors.filter(p => p.level === L && (!tn || p.tone === tn)).length;
        return n ? '<button class="cx-chip' + (lv === L ? ' is-on' : '') + '" data-level="' + L + '">' + L + '<span class="cx-n">' + n + '</span></button>' : '';
      }).join('');
      h += '</div></div></div>';
      h += list.length
        ? `<div class="product-grid" data-density="${state.density}">` + list.map((p, i) => productCard(p, i)).join('') + '</div>'
        : '<div style="padding:28px 8px;color:var(--ink-3);font-size:13px">条件に合うカラーがありません。色味または明るさを変えてください。</div>';
      grid.innerHTML = h; qs('#empty').hidden = true; syncFavButtons(); return;
    }

    const def = colorTypeDef(state.colorType) || { label: 'カラー', drill: false };
    const line = state.colorLine, family = state.colorFamily;
    let crumb = '<button class="cd-crumb__l" data-cd="root">カラー剤</button>';
    crumb += '<span class="cd-crumb__sep">›</span>' + ((def.drill && line) ? `<button class="cd-crumb__l" data-cd="type">${def.label}</button>` : `<span class="cd-crumb__cur">${def.label}</span>`);
    if (def.drill && line) crumb += '<span class="cd-crumb__sep">›</span>' + (family ? `<button class="cd-crumb__l" data-cd="line">${line}</button>` : `<span class="cd-crumb__cur">${line}</span>`);
    if (def.drill && family) crumb += `<span class="cd-crumb__sep">›</span><span class="cd-crumb__cur">${family}</span>`;
    let html = `<nav class="cd-crumb">${crumb}</nav>`;

    // フラットなタイプ（オキシ/ブリーチ/マニキュア/ヘナ/カラトリ/塩基性）→ 商品グリッド
    if (!def.drill) {
      const items = colorOfType(state.colorType).slice().sort((a, b) => b.pop - a.pop);
      qs('#pageTitle').textContent = def.label;
      qs('#pageCount').innerHTML = `<b>${items.length}</b>件`;
      html += items.length
        ? `<div class="product-grid" data-density="${state.density}">` + items.map((p, i) => productCard(p, i)).join('') + '</div>'
        : '<div style="padding:30px 8px;color:var(--ink-3);font-size:13px">このタイプは準備中です。</div>';
      grid.innerHTML = html; qs('#empty').hidden = true; syncFavButtons(); return;
    }

    // ドリルタイプ（アルカリ／白髪染め）：ライン › 色 › 明るさ
    if (!line) {
      const lines = colorLines();
      qs('#pageTitle').textContent = def.label;
      qs('#pageCount').innerHTML = `<b>${lines.length}</b>ライン`;
      html += '<div class="cd-grid">' + lines.map(l =>
        `<div class="cd-cell"><button class="cd-fav" data-favline="${l.line}" aria-pressed="${Store.isFavBrand(l.line)}" aria-label="ブランドをお気に入り">${heart}</button>` +
        `<button class="cd-go" data-cd="pickline" data-v="${l.line}"><span class="cd-card__maker">${l.maker}</span><span class="cd-card__name">${l.line}</span><span class="cd-card__meta">${l.count}色展開 ›</span></button></div>`).join('') + '</div>';
    } else if (!family) {
      const fams = colorFamilies(line);
      qs('#pageTitle').textContent = line;
      qs('#pageCount').innerHTML = `<b>${fams.length}</b>色`;
      const _camp = (SP.CAMPAIGNS || []).find(c => c.kind === 'buyXgetY' && c.line === line);
      const _tempuOn = !(window.SP.TENANT && window.SP.TENANT.features && window.SP.TENANT.features.tempu === false);
      if (_camp && _tempuOn) html += `<a href="campaigns.html?id=${_camp.id}" style="display:flex;align-items:center;gap:11px;border:1px solid var(--gold-line);background:var(--gold-soft);border-radius:var(--r-lg);padding:13px 15px;margin-bottom:14px;text-decoration:none;color:var(--ink)">
        <span style="flex:none;min-width:42px;height:38px;border-radius:var(--r-md);background:var(--gold);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:13px;padding:0 6px">${_camp.badge || '10＋1'}</span>
        <span style="flex:1;min-width:0"><span style="display:block;font-size:13.5px;font-weight:900">${_camp.tempu ? 'メーカー添付' : 'キャンペーン'}：${_camp.title}</span><span style="display:block;font-size:11.5px;color:var(--ink-2);margin-top:2px;line-height:1.5">${_camp.x}本＋無料${_camp.y}本を選んで発注（価格は${_camp.x}本分）。無料分（無償現品）はご負担ありません。</span></span>
        <span style="flex:none;color:var(--gold-strong);font-weight:800;font-size:12.5px;white-space:nowrap">組む ›</span></a>`;
      html += '<div class="cd-grid">' + fams.map(f =>
        `<div class="cd-cell cd-cell--color"><button class="cd-fav" data-favcolor="${line}｜${f.family}" aria-pressed="${Store.isFavColor(line, f.family)}" aria-label="カラーをお気に入り">${heart}</button>` +
        `<button class="cd-go" data-cd="pickfam" data-v="${f.family}"><span class="cd-swatch" style="background:${f.tint}"></span><span class="cd-card__name">${f.family}</span><span class="cd-card__meta">${f.count}段階の明るさ ›</span></button></div>`).join('') + '</div>';
    } else {
      const shades = colorShades(line, family);
      qs('#pageTitle').textContent = `${line} ${family}`;
      qs('#pageCount').innerHTML = `<b>${shades.length}</b>段階`;
      html += `<div class="product-grid" data-density="${state.density}">` + shades.map((p, i) => productCard(p, i)).join('') + '</div>';
    }
    grid.innerHTML = html;
    qs('#empty').hidden = true;
    if (family) syncFavButtons();
  }

  function syncDensityToggle() {
    qsa('#densityToggle button').forEach(b =>
      b.setAttribute('aria-pressed', parseInt(b.dataset.density, 10) === state.density));
  }

  function syncPills() {
    qs('#pillFilter').classList.toggle('pill--active', !!(state.filters.stock.size || state.filters.price || state.filters.sameDay));
    qs('#pillBrand').classList.toggle('pill--active', !!state.brand);
    qs('#pillBrandLabel').textContent = state.brand || 'ブランド';
    qs('#pillSort').classList.toggle('pill--active', state.sort !== 'pop');
    qs('#pillSortLabel').textContent = SORTS.find(s => s.id === state.sort).label;
  }

  function renderBizBar() {
    let bar = qs('#bizBar');
    if (!bar) {
      const cq = qs('#catQuick'); if (!cq) return;
      if (!qs('#bizBarStyle')) {
        const st = document.createElement('style'); st.id = 'bizBarStyle';
        st.textContent = '.biz-bar{display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--dark);overflow-x:auto}.biz-bar::-webkit-scrollbar{height:0}.biz-bar__l{font-size:11px;color:#aeb5c2;font-weight:700;flex:none}.biz-bar button{flex:none;height:32px;padding:0 14px;border-radius:999px;font-size:13px;font-weight:700;color:#c9ced8;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18)}.biz-bar button.is-on{background:var(--gold);color:#1b1b1d;border-color:var(--gold)}';
        document.head.appendChild(st);
      }
      bar = document.createElement('div'); bar.id = 'bizBar'; bar.className = 'biz-bar';
      cq.parentNode.insertBefore(bar, cq);
    }
    const TB = (window.SP.TENANT && window.SP.TENANT.biz) || {};
    bar.innerHTML = '<span class="biz-bar__l">業種</span>' +
      BIZ.filter(b => TB[b.id] !== false).map(b => `<button type="button" data-biz="${b.id}" class="${b.id === state.biz ? 'is-on' : ''}">${b.label}</button>`).join('');
  }
  function renderCatQuick() {
    const host = qs('#catQuick');
    host.innerHTML = orderedCats().map(c =>
      `<a href="#" data-cat="${c.id}" class="${!inSearch() && !(state.brand && state.brandAll) && c.id === state.cat ? 'is-active' : ''}">${c.label}</a>`
    ).join('');
  }

  function renderActiveChips() {
    const host = qs('#activeFilters');
    const chips = [];
    if (state.brand) chips.push(chip('brand', 'ブランド：' + state.brand));
    if (state.series) chips.push(chip('series', 'シリーズ：' + state.series));
    state.filters.stock.forEach(s => chips.push(chip('stock:' + s, (STOCK_OPTS.find(o => o.id === s) || {}).label)));
    if (state.filters.price) chips.push(chip('price', (PRICE_RANGES.find(p => p.id === state.filters.price) || {}).label));
    if (state.filters.sameDay) chips.push(chip('same', '当日出荷可'));
    state.filters.concern.forEach(id => chips.push(chip('concern:' + id, (CHIP_BY_ID[id] || {}).label)));
    host.innerHTML = chips.length
      ? chips.join('') + `<button class="chip--clear" data-clear="all">すべて解除</button>`
      : '';
  }
  function chip(key, label) {
    return `<span class="chip">${label}<button data-clear="${key}" aria-label="${label}を解除">${svg('close')}</button></span>`;
  }

  /* ---------------- favorites / cart sync ---------------- */
  function syncFavButtons() {
    qsa('.fav-btn').forEach(b => {
      const id = b.closest('[data-id]')?.dataset.id;
      if (id) b.setAttribute('aria-pressed', Store.isFav(id));
    });
  }

  function syncStore() {
    const { count, lines, total } = Store.cartSummary();
    // badges
    setBadge('#cartBadge', count);
    setBadge('#tabCartBadge', count);
    setBadge('#cartBarBadge', count);
    setBadge('#favBadge', Store.favCount());
    // cart bar
    const bar = qs('#cartBar');
    if (count > 0) {
      qs('#cartBarText').innerHTML =
        `選択中の商品：<span class="qty">${lines}</span>点　合計金額：<span class="sum">${fmtYen(total)}</span><span class="tax">（税抜）</span>`;
      bar.classList.add('is-visible');
      document.body.classList.add('has-cartbar');
    } else {
      bar.classList.remove('is-visible');
      document.body.classList.remove('has-cartbar');
    }
    syncFavButtons();
  }
  function setBadge(sel, n) {
    const el = qs(sel);
    if (!el) return;
    el.textContent = n;
    el.hidden = n <= 0;
  }

  /* ---------------- toast ---------------- */
  let toastTimer;
  function toast(msg) {
    const t = qs('#toast');
    t.innerHTML = svg('checkc') + msg;
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-visible'), 1900);
  }

  /* ---------------- overlay / drawer / dropdown ---------------- */
  const overlay = qs('#overlay');
  function openPanel(el, { clear = false, lock = true } = {}) {
    overlay.style.background = clear ? 'transparent' : '';
    overlay.classList.add('is-open');
    el.classList.add('is-open');
    if (lock) document.body.style.overflow = 'hidden';
  }
  function closeAll() {
    qsa('.drawer.is-open, .dropdown.is-open').forEach(e => e.classList.remove('is-open'));
    overlay.classList.remove('is-open');
    overlay.style.background = '';
    document.body.style.overflow = '';
  }
  overlay.addEventListener('click', closeAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  function openDropdown(trigger, items, selectedId, onSelect) {
    const dd = qs('#dropdown');
    dd.classList.remove('dropdown--brand');
    dd.innerHTML = items.map(it =>
      `<button role="option" data-val="${it.id}" aria-selected="${it.id === selectedId}">${it.label}${svg('check', 'check')}</button>`
    ).join('');
    const r = trigger.getBoundingClientRect();
    const w = Math.max(220, r.width);
    const vw = document.documentElement.clientWidth;
    let left = Math.min(r.left, vw - 12 - w);
    left = Math.max(12, left);
    dd.style.top = (r.bottom + 8) + 'px';
    dd.style.left = left + 'px';
    dd.style.minWidth = w + 'px';
    openPanel(dd, { clear: true, lock: false });
    dd.onclick = e => {
      const b = e.target.closest('button[data-val]');
      if (!b) return;
      closeAll();
      onSelect(b.dataset.val);
    };
  }
  // ブランド専用ピッカー：検索ボックス＋お気に入り＋人気ブランド＋50音（件数つき）。346件を上から見ずに探せる
  function openBrandPicker(trigger) {
    const dd = qs('#dropdown');
    const counts = {};
    base().forEach(p => { if (p.brand) counts[p.brand] = (counts[p.brand] || 0) + 1; });
    const all = Object.keys(counts);
    const byKana = (a, b) => a.localeCompare(b, 'ja');
    const byCount = (a, b) => counts[b] - counts[a] || byKana(a, b);
    const allSorted = all.slice().sort(byKana);
    const favs = ((Store.getFavBrands && Store.getFavBrands()) || []).filter(b => counts[b]).sort(byKana);
    const popular = all.slice().sort(byCount).slice(0, 10);
    const sel = state.brand;

    const row = b => {
      const on = b === sel;
      return `<button role="option" class="bp-row${on ? ' is-sel' : ''}" data-val="${escHtml(b)}" aria-selected="${on}"><span class="bp-row__n">${escHtml(b)}</span><span class="bp-row__c">${counts[b]}</span>${svg('check', 'check')}</button>`;
    };
    const listHtml = q => {
      const nq = normSearch(q);
      if (nq) {
        const hits = all.filter(b => normSearch(b).indexOf(nq) >= 0).sort(byCount);
        return hits.length
          ? `<div class="bp-sec">該当 ${hits.length}件</div>${hits.map(row).join('')}`
          : '<div class="bp-empty">該当するブランドがありません<br><span>別の表記でお試しください</span></div>';
      }
      let h = `<button role="option" class="bp-row bp-row--all${!sel ? ' is-sel' : ''}" data-val="__all" aria-selected="${!sel}"><span class="bp-row__n">すべてのブランド</span>${svg('check', 'check')}</button>`;
      if (favs.length) h += `<div class="bp-sec">お気に入り</div>${favs.map(row).join('')}`;
      h += `<div class="bp-sec">人気ブランド</div>${popular.map(row).join('')}`;
      h += `<div class="bp-sec">すべて（50音順）・${allSorted.length}ブランド</div>${allSorted.map(row).join('')}`;
      return h;
    };

    dd.classList.add('dropdown--brand');
    dd.style.minWidth = '';
    dd.innerHTML = `<div class="bp__top"><div class="bp__search">${svg('search', 'bp__si')}<input id="bpSearch" type="search" placeholder="ブランド名で検索（例：ルベル）" autocomplete="off" enterkeyhint="search"></div></div><div class="bp__list" id="bpList">${listHtml('')}</div>`;

    const r = trigger.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const w = Math.min(320, vw - 24);
    let left = Math.min(r.left, vw - 12 - w);
    left = Math.max(12, left);
    dd.style.top = (r.bottom + 8) + 'px';
    dd.style.left = left + 'px';
    openPanel(dd, { clear: true, lock: false });

    const input = qs('#bpSearch'), listEl = qs('#bpList');
    input.addEventListener('input', () => { listEl.innerHTML = listHtml(input.value); listEl.scrollTop = 0; });
    dd.onclick = e => {
      const b = e.target.closest('button[data-val]');
      if (!b) return;
      closeAll();
      const val = b.dataset.val;
      state.brand = val === '__all' ? null : val;
      state.brandAll = false;   // ピルからの選択は現在カテゴリ内で絞る（横断はしない）
      render();
    };
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  }

  // ドロップダウンはスクロールで閉じる（ブランドピッカーの内側スクロールでは閉じない）
  window.addEventListener('scroll', (e) => {
    if (!qs('#dropdown').classList.contains('is-open')) return;
    const t = e.target;
    if (t && t.closest && t.closest('#dropdown')) return;
    closeAll();
  }, true);

  /* ---------------- filter drawer ---------------- */
  function countBy(predicate) {
    const b = state.brand;
    return base().filter(p => !b || p.brand === b || p.maker === b || p.line === b).filter(predicate).length;
  }
  function renderFilterDrawer() {
    const stockHtml = STOCK_OPTS.map(o => `
      <label class="opt">
        <input type="checkbox" data-filter="stock" value="${o.id}" ${state.filters.stock.has(o.id) ? 'checked' : ''}>
        <span>${o.label}</span>
        <span class="opt__meta">${countBy(p => p.stock === o.id)}</span>
      </label>`).join('');
    const priceHtml = PRICE_RANGES.map(r => `
      <label class="opt">
        <input type="radio" name="price" data-filter="price" value="${r.id}" ${state.filters.price === r.id ? 'checked' : ''}>
        <span>${r.label}</span>
        <span class="opt__meta">${countBy(r.test)}</span>
      </label>`).join('');
    // チップは「該当0は非表示」＝そのカテゴリ/業種/ブランドで意味のあるものだけ出す
    const fchip = c => {
      const n = countBy(c.match);
      if (!n) return '';
      return `<button type="button" class="fchip" data-filter="concern" data-val="${c.id}" aria-pressed="${state.filters.concern.has(c.id)}">${c.label}<span class="fchip__n">${n}</span></button>`;
    };
    const featHtml = FEATURES.map(fchip).join('');
    // 悩み・仕上がりは「ヘア系カテゴリ＋業種ヘア/アイ」のときだけ（ネイル/エステ/機器/消耗品や検索横断では出さない＝誤マッチ防止）
    const HAIR_CONCERN_CATS = ['shampoo', 'treatment', 'outbath', 'scalp', 'care', 'styling'];
    const showConcerns = !crossCat() && (state.biz === 'hair' || state.biz === 'eye') && HAIR_CONCERN_CATS.includes(state.cat);
    const concernHtml = showConcerns ? CONCERNS.map(fchip).join('') : '';
    const featGroup = featHtml ? `<div class="filter-group"><div class="filter-group__title">特長・条件で絞る</div><div class="fchips">${featHtml}</div></div>` : '';
    const concernGroup = concernHtml ? `<div class="filter-group"><div class="filter-group__title">悩み・仕上がりで探す</div><div class="fchips">${concernHtml}</div></div>` : '';
    qs('#filterBody').innerHTML = `
      ${featGroup}
      ${concernGroup}
      <div class="filter-group">
        <div class="filter-group__title">在庫・納期</div>
        ${stockHtml}
        <label class="opt">
          <input type="checkbox" data-filter="same" ${state.filters.sameDay ? 'checked' : ''}>
          <span>当日出荷可</span>
          <span class="opt__meta">${countBy(p => p.same)}</span>
        </label>
      </div>
      <div class="filter-group">
        <div class="filter-group__title">価格帯（税抜）</div>
        ${priceHtml}
      </div>`;
    updateFilterFooter();
  }
  function updateFilterFooter() {
    qs('#filterCount').textContent = filtered().length;
  }

  /* ---------------- events ---------------- */
  function bind() {
    // ピル：絞り込み
    qs('#pillFilter').addEventListener('click', () => { renderFilterDrawer(); openPanel(qs('#filterDrawer')); });
    // もっと見る（次の60件を追加描画）
    const lmBtn = qs('#loadMoreBtn');
    if (lmBtn) lmBtn.addEventListener('click', () => { renderPage++; render(); });
    // ピル：カテゴリ
    qs('#pillCategory').addEventListener('click', e => {
      openDropdown(e.currentTarget,
        orderedCats().map(c => ({ id: c.id, label: c.label })),
        state.cat, val => { state.cat = val; state.brandAll = false; state.search = ''; qs('#searchInput').value = ''; render(); });
    });

    // 業種スイッチャー（ヘア/アイ/ネイル/エステ）：関連カテゴリを前に並べ替え（非表示にはしない）
    document.addEventListener('click', e => {
      const b = e.target.closest('#bizBar [data-biz]');
      if (!b) return;
      if (b.dataset.biz === state.biz) return;
      state.biz = b.dataset.biz;
      try { localStorage.setItem('sp.biz', state.biz); } catch (err) {}
      state.cat = firstCat();          // 業種の先頭カテゴリへ
      state.brand = null; state.brandAll = false; state.search = ''; const si = qs('#searchInput'); if (si) si.value = '';
      state.filters = { stock: new Set(), price: null, sameDay: false, concern: new Set() };
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    // ピル：ブランド（専用ピッカー：検索＋お気に入り＋人気＋50音・件数つき）
    qs('#pillBrand').addEventListener('click', e => openBrandPicker(e.currentTarget));
    // ピル：並び替え
    qs('#pillSort').addEventListener('click', e => {
      openDropdown(e.currentTarget, SORTS, state.sort, val => { state.sort = val; render(); });
    });

    // 表示密度トグル（④⑥⑨）：大きいほど情報が増え、小さいほど価格＋カートのみ。
    // 列数・情報量はCSS（data-density）で切替＝再描画しないので瞬時＆ちらつき無し。
    qsa('#densityToggle button').forEach(btn => btn.addEventListener('click', () => {
      state.density = parseInt(btn.dataset.density, 10) || 6;
      localStorage.setItem('sp.density', state.density);
      qs('#grid').dataset.density = state.density;
      syncDensityToggle();
      if (inColorDrill()) render(); // カラー段階一覧は内側gridを再描画
    }));

    // 全ディーラー表示モード（重複も表示。既定は先契約ディーラーのみ）
    const allChk = qs('#allDealersChk');
    if (allChk) {
      // 連携ディーラー（相乗りマーケット）OFF＝単独運営なのでトグル自体を隠す
      const mkOn = !(window.SP.TENANT && window.SP.TENANT.features && window.SP.TENANT.features.marketplace === false);
      const row = allChk.closest('div');
      if (row) row.hidden = !mkOn;
      allChk.checked = Store.allDealers();
      allChk.addEventListener('change', () => { Store.setAllDealers(allChk.checked); render(); });
    }

    // フィルタドロワー入力
    qs('#filterBody').addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.filter === 'stock') {
        t.checked ? state.filters.stock.add(t.value) : state.filters.stock.delete(t.value);
      } else if (t.dataset.filter === 'price') {
        state.filters.price = t.value;
      } else if (t.dataset.filter === 'same') {
        state.filters.sameDay = t.checked;
      }
      updateFilterFooter();
      render();
    });
    // 悩み別チップ（トグル）
    qs('#filterBody').addEventListener('click', e => {
      const chip = e.target.closest('.fchip');
      if (!chip) return;
      const id = chip.dataset.val;
      state.filters.concern.has(id) ? state.filters.concern.delete(id) : state.filters.concern.add(id);
      chip.setAttribute('aria-pressed', state.filters.concern.has(id));
      updateFilterFooter();
      render();
    });
    qs('#filterApply').addEventListener('click', closeAll);
    qs('#filterClear').addEventListener('click', () => {
      state.filters = { stock: new Set(), price: null, sameDay: false, concern: new Set() };
      renderFilterDrawer();
      render();
    });

    // アクティブチップ解除
    qs('#activeFilters').addEventListener('click', e => {
      const b = e.target.closest('[data-clear]');
      if (!b) return;
      const key = b.dataset.clear;
      if (key === 'all') state.filters = { stock: new Set(), price: null, sameDay: false, concern: new Set() }, state.brand = null, state.brandAll = false, state.series = null;
      else if (key === 'brand') state.brand = null, state.brandAll = false, state.series = null;
      else if (key === 'series') state.series = null;
      else if (key === 'price') state.filters.price = null;
      else if (key === 'same') state.filters.sameDay = false;
      else if (key.startsWith('stock:')) state.filters.stock.delete(key.split(':')[1]);
      else if (key.startsWith('concern:')) state.filters.concern.delete(key.split(':')[1]);
      render();
    });

    // カテゴリ クイック
    qs('#catQuick').addEventListener('click', e => {
      const a = e.target.closest('[data-cat]');
      if (!a) return;
      e.preventDefault();
      state.cat = a.dataset.cat; state.brandAll = false; state.search = ''; qs('#searchInput').value = '';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 商品グリッド（イベント委譲）
    qs('#grid').addEventListener('click', e => {
      // カラー剤ドリル：ブランド/カラーのお気に入り（♡）
      const favL = e.target.closest('[data-favline]');
      if (favL) { const on = Store.toggleFavBrand(favL.dataset.favline); favL.setAttribute('aria-pressed', on); toast(on ? 'お気に入りブランドに追加' : 'お気に入りブランドから削除'); return; }
      const favC = e.target.closest('[data-favcolor]');
      if (favC) { const a = favC.dataset.favcolor.split('｜'); const on = Store.toggleFavColor(a[0], a[1]); favC.setAttribute('aria-pressed', on); toast(on ? 'お気に入りカラーに追加' : 'お気に入りカラーから削除'); return; }
      // 色味×明るさ 横断：トーン／明るさチップ
      const toneB = e.target.closest('[data-tone]');
      if (toneB) { const v = toneB.dataset.tone; state.colorTone = (v === '__all') ? null : v; render(); return; }
      const lvB = e.target.closest('[data-level]');
      if (lvB) { const v = lvB.dataset.level; state.colorLevel = (v === '__all') ? null : parseInt(v, 10); render(); return; }
      // カラー剤ドリルのナビ（タイプ/ライン/色を選ぶ・戻る）
      const cd = e.target.closest('[data-cd]');
      if (cd) {
        const a = cd.dataset.cd;
        if (a === 'root') { state.colorType = null; state.colorLine = null; state.colorFamily = null; state.colorTone = null; state.colorLevel = null; }
        else if (a === 'picktype') { state.colorType = cd.dataset.v; state.colorLine = null; state.colorFamily = null; state.colorTone = null; state.colorLevel = null; }
        else if (a === 'type') { state.colorLine = null; state.colorFamily = null; }
        else if (a === 'line') { state.colorFamily = null; }
        else if (a === 'pickline') { state.colorLine = cd.dataset.v; state.colorFamily = null; try { if (window.SP && SP.Track) SP.Track.log('brand_view', { brand: cd.dataset.v, where: 'color' }); } catch (e) {} }
        else if (a === 'pickfam') { state.colorFamily = cd.dataset.v; try { if (window.SP && SP.Track) SP.Track.log('color_pick', { line: state.colorLine, family: cd.dataset.v }); } catch (e) {} }
        render();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      const card = e.target.closest('[data-id]');
      if (!card) return;
      const id = card.dataset.id;
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'fav') {
        const on = Store.toggleFav(id);
        const btn = e.target.closest('.fav-btn');
        btn.classList.remove('is-pop'); void btn.offsetWidth; if (on) btn.classList.add('is-pop');
        toast(on ? 'お気に入りに追加しました' : 'お気に入りから削除しました');
      } else if (act === 'favbrand') {
        const bb = e.target.closest('[data-act]');
        const on = Store.toggleFavBrand(bb.dataset.brand);
        qsa('.card__brandfav').forEach(x => { if (x.dataset.brand === bb.dataset.brand) x.setAttribute('aria-pressed', on); });
        toast(on ? 'お気に入りブランドに追加' : 'お気に入りブランドから削除');
      } else if (act === 'add') {
        const input = qs('.stepper input', card);
        const qty = Math.max(1, parseInt(input.value, 10) || 1);
        Store.addToCart(id, qty);
        toast(`カートに追加しました（${qty}点）`);
      } else if (act === 'inc' || act === 'dec') {
        const input = qs('.stepper input', card);
        let v = parseInt(input.value, 10) || 1;
        v = act === 'inc' ? Math.min(99, v + 1) : Math.max(1, v - 1);
        input.value = v;
      } else if (act === 'restock') {
        const on = Store.toggleRestockAlert(id);
        const rb = e.target.closest('[data-act="restock"]');
        rb.classList.toggle('is-on', on);
        rb.setAttribute('aria-pressed', on ? 'true' : 'false');
        rb.innerHTML = (SP.svg ? SP.svg(on ? 'checkc' : 'bell') : '') + `<span class="btn-restock__t">${on ? '登録済み' : '入荷お知らせ'}</span>`;
        toast(on ? '入荷したらお知らせします' : '入荷お知らせを解除しました');
      } else if (!e.target.closest('.card__foot')) {
        // 画像・商品名などをタップで詳細へ
        location.href = 'product.html?id=' + id;
      }
    });
    qs('#grid').addEventListener('change', e => {
      if (e.target.matches('.stepper input')) {
        let v = parseInt(e.target.value, 10) || 1;
        e.target.value = Math.min(99, Math.max(1, v));
      }
    });

    // メニュー
    qs('#btnMenu').addEventListener('click', () => openPanel(qs('#menuDrawer')));
    qsa('[data-close]').forEach(b => b.addEventListener('click', closeAll));

    // ヘッダー常設検索（全カテゴリ横断・ライブ＝打つほど絞り込み・候補サジェスト）
    const searchInput = qs('#searchInput');
    const searchClear = qs('#searchClear');
    const searchSug = qs('#searchSug');
    searchInput.addEventListener('input', e => {
      state.search = e.target.value;
      searchClear.hidden = !e.target.value;
      render();
      renderSug();
    });
    searchInput.addEventListener('focus', renderSug);
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { if (searchSug) searchSug.hidden = true; searchInput.blur(); }
      else if (e.key === 'Escape') { if (searchSug) searchSug.hidden = true; }
    });
    if (searchSug) {
      searchSug.addEventListener('mousedown', e => e.preventDefault()); // タップで入力のフォーカスを外さない
      searchSug.addEventListener('click', e => {
        const b = e.target.closest('.sug'); if (!b) return;
        applySug(b.dataset.term, b.dataset.kind);
      });
    }
    document.addEventListener('click', e => {
      if (searchSug && !e.target.closest('.header-search')) searchSug.hidden = true;
    });
    searchClear.addEventListener('click', () => {
      state.search = '';
      searchInput.value = '';
      searchClear.hidden = true;
      if (searchSug) searchSug.hidden = true;
      render();
      searchInput.focus();
    });

    // data-soon：実在ページがあれば遷移、なければ予告トースト
    qsa('[data-soon]').forEach(b => b.addEventListener('click', e => {
      e.preventDefault();
      const dest = SP.LINKS && SP.LINKS[b.dataset.soon];
      if (dest) { location.href = dest; return; }
      toast(b.dataset.soon + 'は次のステップで実装します');
    }));
  }

  /* ---------------- init ---------------- */
  function init() {
    Store.subscribe(syncStore);
    bind();
    // 業種の先頭カテゴリを既定に（アイ＝まつげ、ネイル＝ジェル 等で選びやすく）
    state.cat = firstCat();
    // 商品詳細のパンくず等からの ?cat= でカテゴリを直接開く
    const sp0 = new URLSearchParams(location.search);
    const catParam = sp0.get('cat');
    if (catParam && DATA.categories.find(c => c.id === catParam)) state.cat = catParam;
    // お気に入りブランド/カラーから直接ドリルを開く（?cat=color&type=...&line=...&family=...）
    if (state.cat === 'color') {
      const tp = sp0.get('type'), lp = sp0.get('line'), fp = sp0.get('family');
      if (tp && (SP.COLOR_TYPES || []).some(t => t.id === tp)) state.colorType = tp;
      if (lp) {
        state.colorLine = lp;
        // ラインからタイプを補完（お気に入りカラー等、type未指定でドリルを開けるように）
        if (!state.colorType) { const _p = DATA.products.find(p => p.cat === 'color' && p.line === lp); if (_p) state.colorType = _p.colorType || 'alkaline'; }
      }
      if (lp && fp) state.colorFamily = fp;
    }
    // ホーム等からの並び替え指定（?sort=new 等）
    const sortParam = sp0.get('sort');
    if (sortParam && SORTS.find(s => s.id === sortParam)) state.sort = sortParam;
    // ホーム等からの検索クエリ（?q=）を引き継ぐ
    const q = new URLSearchParams(location.search).get('q');
    if (q) {
      state.search = q;
      qs('#searchInput').value = q;
      qs('#searchClear').hidden = false;
    }
    render();
    syncStore();
  }
  document.addEventListener('DOMContentLoaded', init);
})();

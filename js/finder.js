'use strict';
/* ======================================================
   SEAM — finder.js  v21
   統合トップページ用 JavaScript
   担当: FV診断 / Quick Diagnosis / 詳細4ステップ診断 / Product Search
====================================================== */

// ── CONSTANTS ──────────────────────────────────────────

const CONCERN_CATEGORIES = {
  texture: {
    label: '髪の質感',
    items: ['パサつき','乾燥','ツヤがない','指通りが悪い','まとまらない']
  },
  volume: {
    label: 'ボリューム',
    items: ['広がり','うねり','くせ毛','ボリュームが出ない','ボリュームが出すぎる']
  },
  damage: {
    label: 'ダメージ',
    items: ['ダメージ','切れ毛','枝毛','ブリーチ毛のケア','カラーの持ちが悪い']
  },
  scalp: {
    label: '頭皮',
    items: ['頭皮の乾燥','頭皮のベタつき','フケ','かゆみ','におい']
  },
  aging: {
    label: 'エイジング',
    items: ['抜け毛が気になる','薄毛が気になる','ハリコシ不足','エイジングケア']
  }
};

const FINISH_OPTIONS = [
  'ツヤ感がほしい','まとまりがほしい','軽くサラサラに',
  'しっとりなめらかに','ふんわりボリュームを出したい',
  '香りを楽しみたい','ケア効果を長持ちさせたい','ハリ・コシを出したい'
];

const AGE_GROUPS = ['10代','20代','30代','40代','50代','60代以上'];

const CAT_ICONS = {
  shampoo:   'fa-light fa-pump-soap',
  treatment: 'fa-light fa-flask',
  mask:      'fa-light fa-jar',
  outbath:   'fa-light fa-bottle-droplet',
  essence:   'fa-light fa-droplet'
};

// Product Search 用商品データ（30件以上、finder-data.jsのPRODUCT_DBを補完する形）
const PRODUCTS = [
  // ── Aujua ──
  { id:'ps001', brand:'Aujua', category:'shampoo',
    name:'Aujua クエンチ シャンプー',
    desc:'乾燥・広がりが気になる方のための保水系シャンプー。洗い上がりしっとりやわらか。',
    tags:['乾燥ケア','保水','しっとり'],
    concern:['乾燥','パサつき','広がり'],
    url:'https://www.milbon.com/' },
  { id:'ps002', brand:'Aujua', category:'treatment',
    name:'Aujua クエンチ トリートメント',
    desc:'失われた水分・油分をバランスよく補給。毎日のケアでまとまりやすい髪へ。',
    tags:['乾燥ケア','保水','毎日使い'],
    concern:['乾燥','パサつき','まとまらない'],
    url:'https://www.milbon.com/' },
  { id:'ps003', brand:'Aujua', category:'mask',
    name:'Aujua クエンチ ヘアニュートリエント',
    desc:'週1〜2回の集中ケアマスク。乾燥や傷みに集中アプローチ。',
    tags:['集中ケア','保湿補修','週1〜2回'],
    concern:['乾燥','パサつき','ダメージ'],
    url:'https://www.milbon.com/' },
  { id:'ps004', brand:'Aujua', category:'shampoo',
    name:'Aujua リペアリティ シャンプー',
    desc:'ダメージを受けた髪に着目。洗うたびに質感を整えるサロン専売シャンプー。',
    tags:['ダメージ補修','高補修','サロン専売'],
    concern:['ダメージ','切れ毛','枝毛'],
    url:'https://www.milbon.com/' },
  { id:'ps005', brand:'Aujua', category:'treatment',
    name:'Aujua インメトリィ トリートメント',
    desc:'エイジングによるハリ・コシの変化に。根元からのボリューム感を整える。',
    tags:['エイジングケア','ハリコシ','ボリューム'],
    concern:['エイジングケア','ハリコシ不足','ボリュームが出ない'],
    url:'https://www.milbon.com/' },
  { id:'ps006', brand:'Aujua', category:'shampoo',
    name:'Aujua モイストカーム シャンプー',
    desc:'頭皮の状態に合わせた洗浄力コントロール。地肌環境を整える。',
    tags:['頭皮ケア','スカルプ','低刺激'],
    concern:['頭皮の乾燥','頭皮のベタつき','抜け毛が気になる'],
    url:'https://www.milbon.com/' },
  { id:'ps007', brand:'Aujua', category:'essence',
    name:'Aujua モイストカーム モイスチュアローション',
    desc:'頭皮の乾燥・べたつきを整えるスカルプローション。毎日のケアに。',
    tags:['頭皮ケア','保湿','バランス調整'],
    concern:['頭皮の乾燥','頭皮のベタつき','フケ'],
    url:'https://www.milbon.com/' },
  { id:'ps008', brand:'Aujua', category:'shampoo',
    name:'Aujua アクアヴィア シャンプー',
    desc:'くせ・うねりによる広がりに着目。扱いやすい髪への土台づくり。',
    tags:['くせケア','まとまり','うねり対策'],
    concern:['広がり','うねり','くせ毛'],
    url:'https://www.milbon.com/' },
  { id:'ps009', brand:'Aujua', category:'outbath',
    name:'Aujua アクアヴィア モイストセラム',
    desc:'広がりや浮きを抑えるアウトバス美容液。まとまりのある仕上がりへ。',
    tags:['まとまり','広がり抑制','毎日使い'],
    concern:['広がり','うねり','まとまらない'],
    url:'https://www.milbon.com/' },
  { id:'ps010', brand:'Aujua', category:'mask',
    name:'Aujua リペアリティ ヘアニュートリエント',
    desc:'ブリーチ・高度なダメージに集中ケア。週1〜2回の使用で毛先のやわらかさを。',
    tags:['集中補修','ブリーチケア','週1〜2回'],
    concern:['ブリーチ毛のケア','切れ毛','枝毛'],
    url:'https://www.milbon.com/' },

  // ── TOKIO ──
  { id:'ps011', brand:'TOKIO IE INKARAMI', category:'shampoo',
    name:'TOKIO IE INKARAMI シャンプー',
    desc:'ダメージを受けた髪に着目した補修系シャンプー。洗うたびに質感を整える。',
    tags:['ダメージ補修','高補修','サロン専売'],
    concern:['ダメージ','切れ毛','ブリーチ毛のケア'],
    url:'https://tokioie.jp/' },
  { id:'ps012', brand:'TOKIO IE INKARAMI', category:'treatment',
    name:'TOKIO IE INKARAMI トリートメント',
    desc:'毛髪内部補修に着目したプレミアムトリートメント。ブリーチ毛に高評価。',
    tags:['ダメージ補修','高補修','内部ケア'],
    concern:['ダメージ','ブリーチ毛のケア','切れ毛'],
    url:'https://tokioie.jp/' },
  { id:'ps013', brand:'TOKIO IE INKARAMI', category:'mask',
    name:'TOKIO IE INKARAMI PREMIUM マスク',
    desc:'ダメージ・乾燥が気になる髪への集中ケア。週1〜2回のスペシャルケアに。',
    tags:['集中ケア','保湿補修','週1〜2回'],
    concern:['ダメージ','乾燥','ブリーチ毛のケア'],
    url:'https://tokioie.jp/' },

  // ── Milbon ──
  { id:'ps014', brand:'Milbon', category:'shampoo',
    name:'グローバルミルボン カラープリザーブ シャンプー',
    desc:'カラー後の褪色を抑え、色ツヤの美しい印象を保ちやすくするシャンプー。',
    tags:['カラーケア','色持ち','ツヤ'],
    concern:['カラーの持ちが悪い','ダメージ'],
    url:'https://www.milbon.com/' },
  { id:'ps015', brand:'Milbon', category:'mask',
    name:'グローバルミルボン カラープリザーブ 集中ケア',
    desc:'カラー後の髪のダメージや褪色への集中ケア。色ツヤを保ちやすくする。',
    tags:['集中ケア','カラー保護','色持ち'],
    concern:['カラーの持ちが悪い'],
    url:'https://www.milbon.com/' },

  // ── Sublimique (サブリミック) ──
  { id:'ps016', brand:'Sublimique', category:'shampoo',
    name:'サブリミック ルミノフォース シャンプー',
    desc:'カラー後の褪色を抑えるカラーケアシャンプー。美しい発色を長持ちさせる。',
    tags:['カラーケア','色持ち','ツヤ'],
    concern:['カラーの持ちが悪い'],
    url:'https://www.shiseido.com/' },
  { id:'ps017', brand:'Sublimique', category:'shampoo',
    name:'サブリミック フェンテフォルテ シャンプー',
    desc:'頭皮環境を整えるスカルプ系シャンプー。ハリ・コシを出したい方に。',
    tags:['頭皮ケア','スカルプ','ハリコシ'],
    concern:['頭皮の乾燥','頭皮のベタつき','ハリコシ不足'],
    url:'https://www.shiseido.com/' },
  { id:'ps018', brand:'Sublimique', category:'essence',
    name:'サブリミック アデノバイタル スカルプエッセンス',
    desc:'抜け毛・薄毛が気になる方の頭皮環境を整えるスカルプエッセンス。毎日の習慣に。',
    tags:['頭皮ケア','スカルプ','ハリコシ'],
    concern:['抜け毛が気になる','薄毛が気になる','エイジングケア'],
    url:'https://www.shiseido.com/' },
  { id:'ps019', brand:'Sublimique', category:'outbath',
    name:'サブリミック ワンダーシールド',
    desc:'洗い流さないタイプのオイル。ツヤと毛先のまとまりを整えるアウトバスケア。',
    tags:['ツヤ','ダメージ補修','アウトバスオイル'],
    concern:['ツヤがない','ダメージ','切れ毛'],
    url:'https://www.shiseido.com/' },
  { id:'ps020', brand:'Sublimique', category:'shampoo',
    name:'サブリミック エアリーフロー シャンプー',
    desc:'軽やかな仕上がりを目指す、ふんわりボリューム系シャンプー。',
    tags:['ボリューム','軽やか','くせケア'],
    concern:['ボリュームが出ない','広がり','うねり'],
    url:'https://www.shiseido.com/' },

  // ── HITA ──
  { id:'ps021', brand:'HITA', category:'shampoo',
    name:'HITA シャンプー',
    desc:'くせ・うねりによる広がりを整え、扱いやすい髪へ導くシャンプー。',
    tags:['くせケア','うねり','まとまり'],
    concern:['広がり','うねり','くせ毛'],
    url:'https://www.lebel.co.jp/products/series/hita/' },
  { id:'ps022', brand:'HITA', category:'treatment',
    name:'HITA トリートメント',
    desc:'くせ・うねりによる広がりを整え、指通りのよいまとまりへ。',
    tags:['くせケア','まとまり','指通り'],
    concern:['広がり','うねり','まとまらない'],
    url:'https://www.lebel.co.jp/products/series/hita/' },
  { id:'ps023', brand:'HITA', category:'outbath',
    name:'HITA オイル',
    desc:'仕上げやドライ前の質感調整に。まとまりとツヤを補うアウトバスオイル。',
    tags:['ツヤ','まとまり','アウトバス'],
    concern:['広がり','ツヤがない','まとまらない'],
    url:'https://www.lebel.co.jp/products/series/hita/' },

  // ── SEE/SAW ──
  { id:'ps024', brand:'SEE/SAW', category:'shampoo',
    name:'SEE/SAW BALANCE / B シャンプー',
    desc:'しなやかな質感と透明感のあるやわらかな艶髪へ導くバランスタイプ。',
    tags:['艶','なめらか','バランス'],
    concern:['ツヤがない','まとまらない'],
    url:'https://www.lebel.co.jp/products/series/see-saw/' },
  { id:'ps025', brand:'SEE/SAW', category:'shampoo',
    name:'SEE/SAW SMOOTH / S シャンプー',
    desc:'軽やかで指通りのよい、透明感のあるさらさら質感へ整えるスムースタイプ。',
    tags:['さらさら','軽やか','透明感'],
    concern:['指通りが悪い','ボリュームが出すぎる'],
    url:'https://www.lebel.co.jp/products/series/see-saw/' },
  { id:'ps026', brand:'SEE/SAW', category:'treatment',
    name:'SEE/SAW MOISTURE / M トリートメント',
    desc:'うるおいとツヤを与え、なめらかな質感へ整えるモイスチャータイプ。',
    tags:['保湿','ツヤ','なめらか'],
    concern:['乾燥','パサつき','ツヤがない'],
    url:'https://www.lebel.co.jp/products/series/see-saw/' },

  // ── LOA THE OIL ──
  { id:'ps027', brand:'LOA THE OIL', category:'outbath',
    name:'LOA THE OIL',
    desc:'香りとツヤを楽しみながら、髪・肌にも使えるマルチオイル系アウトバス。',
    tags:['香り','ツヤ','マルチオイル'],
    concern:['ツヤがない','パサつき'],
    url:'https://jade-japan.com/loa/ja/oil/' },

  // ── エルジューダ ──
  { id:'ps028', brand:'Milbon', category:'outbath',
    name:'エルジューダ エマルジョン',
    desc:'乾かすだけでまとまる定番アウトバスミルク。あらゆる髪質にフィット。',
    tags:['アウトバス','定番','使いやすい'],
    concern:['パサつき','乾燥','まとまらない'],
    url:'https://www.milbon.com/' },
  { id:'ps029', brand:'Milbon', category:'outbath',
    name:'エルジューダ フリッズフィクサー',
    desc:'広がりや浮きを抑えてまとまりのある仕上がりへ。くせ毛・雨の日に。',
    tags:['まとまり','広がり抑制','毎日使い'],
    concern:['広がり','うねり','くせ毛'],
    url:'https://www.milbon.com/' },
  { id:'ps030', brand:'Milbon', category:'outbath',
    name:'エルジューダ FO',
    desc:'柔らかく動きのある仕上がりへ整えるオイルタイプ。細い毛・猫っ毛に。',
    tags:['ツヤ','柔らかさ','細毛'],
    concern:['ツヤがない','ボリュームが出ない','指通りが悪い'],
    url:'https://www.milbon.com/' },

  // ── oggiotto (オッジィオット) ──
  { id:'ps031', brand:'oggiotto', category:'treatment',
    name:'oggiotto インテンシブ LPP トリートメント',
    desc:'しなやかさと艶をまとった、大人の髪へ。oggiotto の定番集中ケア。',
    tags:['ツヤ','しなやか','サロン専売'],
    concern:['ツヤがない','パサつき','指通りが悪い'],
    url:'https://www.milbon.com/' },
  { id:'ps032', brand:'oggiotto', category:'outbath',
    name:'oggiotto アロマエステ オイル',
    desc:'豊かな香りと軽やかなテクスチャー。大人のヘアケアを格上げするアウトバス。',
    tags:['香り','ツヤ','大人向け'],
    concern:['ツヤがない','パサつき'],
    url:'https://www.milbon.com/' },

  // ── リケラ ──
  { id:'ps033', brand:'Riqual', category:'outbath',
    name:'リケラ エマルジョン',
    desc:'ブリーチ後の傷んだ髪に着目した補修乳液。カラー後の仕上げに。',
    tags:['ブリーチケア','補修','カラー保護'],
    concern:['ブリーチ毛のケア','カラーの持ちが悪い','ダメージ'],
    url:'https://www.lebel.co.jp/' },

  // ── バイカルテ ──
  { id:'ps034', brand:'Vicarte', category:'outbath',
    name:'バイカルテ エッセンスミルク',
    desc:'毛先のパサつき・乾燥に着目。ドライヤー前後に使う保湿アウトバスミルク。',
    tags:['保湿','乾燥ケア','毎日使い'],
    concern:['パサつき','乾燥'],
    url:'https://www.lebel.co.jp/' },
];

// ── STATE ────────────────────────────────────────────────
const state = {
  // 詳細診断
  step1: null,
  step2: null,
  step3: null,
  age:   null,
  situations: [],

  // Product Search
  productSearch: {
    query:   '',
    catFilter:   '',   // shampoo / treatment / mask / outbath / essence / ''
    brandFilter: '',   // brand名 / ''
    page: 1,
    perPage: 12,
    results: []
  }
};


/* ======================================================
   UTILITY
====================================================== */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function scrollToEl(el, offset = 20) {
  const top = el.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: 'smooth' });
}

function getCatLabel(cat) {
  const map = { shampoo:'シャンプー', treatment:'トリートメント', mask:'集中ケアマスク', outbath:'アウトバス', essence:'頭皮用エッセンス' };
  return map[cat] || cat;
}

function getCatIconClass(cat) {
  return CAT_ICONS[cat] || 'fa-light fa-star';
}


/* ======================================================
   NAV / HEADER
====================================================== */
function initNav() {
  const header    = document.getElementById('site-header');
  const hamburger = document.getElementById('hamburger');
  const mobileMenu= document.getElementById('mobile-menu');
  const mobileClose = document.getElementById('mobile-close');

  // スクロールでshadow追加
  const onScroll = () => {
    const scrolled = window.scrollY > 20;
    header?.classList.toggle('is-scrolled', scrolled);
    const scrollTopBtn = document.getElementById('scroll-top');
    scrollTopBtn?.classList.toggle('is-visible', window.scrollY > 400);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ハンバーガー
  hamburger?.addEventListener('click', () => {
    const isOpen = mobileMenu?.classList.contains('open');
    mobileMenu?.classList.toggle('open', !isOpen);
    hamburger.setAttribute('aria-expanded', String(!isOpen));
    document.body.style.overflow = isOpen ? '' : 'hidden';
  });
  mobileClose?.addEventListener('click', () => {
    mobileMenu?.classList.remove('open');
    hamburger?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  });
  // モバイルメニュー内リンクをクリックしたら閉じる
  mobileMenu?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileMenu.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    });
  });

  // スクロールトップ
  document.getElementById('scroll-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // ナビActive連動
  const sections = ['quick-search','step-diagnosis','product-search','brands','stores'];
  const navLinks = document.querySelectorAll('.header-nav a');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const id = e.target.id;
        navLinks.forEach(a => {
          a.classList.toggle('is-active', a.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { threshold: 0.3 });
  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}


/* ======================================================
   LANG TABS
====================================================== */
function initLangTabs() {
  document.querySelectorAll('.lang-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.lang-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (typeof window.switchLang === 'function') window.switchLang(tab.dataset.lang);
    });
  });
}


/* ======================================================
   FV QUICK PANEL
====================================================== */
function initFvPanel() {
  const grid    = document.getElementById('fv-concern-grid');
  const diagBtn = document.getElementById('fv-diagnose-btn');
  if (!grid || !diagBtn) return;

  let selected = null;

  grid.querySelectorAll('.fv__concern-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      grid.querySelectorAll('.fv__concern-btn').forEach(b => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      selected = btn.dataset.concern;
      diagBtn.disabled = false;
    });
  });

  diagBtn.addEventListener('click', () => {
    if (!selected) return;
    // QSセクションにマップしてスクロール
    const qsGrid = document.getElementById('qs-grid');
    const target = qsGrid?.querySelector(`.qs__chip[data-concern="${CSS.escape(selected)}"]`);
    if (target) {
      target.click();
    }
    const qsSection = document.getElementById('quick-search');
    if (qsSection) scrollToEl(qsSection, 80);
  });
}


/* ======================================================
   QUICK SEARCH (QS)
====================================================== */
function initQuickSearch() {
  const qsGrid   = document.getElementById('qs-grid');
  const result   = document.getElementById('qs-result');
  const resultH  = document.getElementById('qs-result-heading');
  const resultC  = document.getElementById('qs-result-cats');
  const toDetail = document.getElementById('qs-to-detail');
  const openDiag = document.getElementById('open-diagnosis');
  const badgeDet = document.getElementById('badge-detail');
  if (!qsGrid) return;

  // チップ選択
  qsGrid.querySelectorAll('.qs__chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const isActive = chip.classList.contains('is-selected');
      qsGrid.querySelectorAll('.qs__chip').forEach(c => {
        c.classList.remove('is-selected');
        c.setAttribute('aria-pressed', 'false');
      });
      if (!isActive) {
        chip.classList.add('is-selected');
        chip.setAttribute('aria-pressed', 'true');
        renderQsResult(chip.dataset.concern);
      } else {
        hideQsResult();
      }
    });
  });

  // 詳細診断ボタン
  function toggleDiagnosis(open) {
    const section = document.getElementById('step-diagnosis');
    if (!section) return;
    const btn = document.getElementById('open-diagnosis');
    if (open) {
      section.style.display = 'block';
      btn?.setAttribute('aria-expanded', 'true');
      setTimeout(() => scrollToEl(section, 60), 60);
    } else {
      section.style.display = 'none';
      btn?.setAttribute('aria-expanded', 'false');
    }
  }

  openDiag?.addEventListener('click', () => {
    const expanded = openDiag.getAttribute('aria-expanded') === 'true';
    toggleDiagnosis(!expanded);
  });
  badgeDet?.addEventListener('click', () => toggleDiagnosis(true));
  toDetail?.addEventListener('click', () => toggleDiagnosis(true));
}

function renderQsResult(concern) {
  const result   = document.getElementById('qs-result');
  const resultH  = document.getElementById('qs-result-heading');
  const resultC  = document.getElementById('qs-result-cats');
  if (!result || !resultH || !resultC) return;

  // QUICK_TO_STEP1でマッピング
  const step1Vals = QUICK_TO_STEP1[concern] || [concern];
  const c1 = step1Vals[0];

  resultH.textContent = `「${concern}」のおすすめアイテム`;

  // カテゴリ優先度でソート
  const priorities = CONCERN_MAP[c1] || {};
  const cats = ['shampoo','treatment','outbath','essence','mask']
    .sort((a, b) => (priorities[a] || 9) - (priorities[b] || 9))
    .slice(0, 3);

  resultC.innerHTML = cats.map(cat => {
    const content = CATEGORY_CONTENT[cat];
    const rule = content.rules.find(r =>
      r.match.includes(c1) || r.match.includes('*')
    ) || content.rules[content.rules.length - 1];
    return `
      <div class="qs__result-cat">
        <i class="${getCatIconClass(cat)} qs__result-cat-icon" aria-hidden="true"></i>
        <div class="qs__result-cat-body">
          <span class="qs__result-cat-name">${getCatLabel(cat)}</span>
          <p class="qs__result-cat-product">${rule.product}</p>
          <p class="qs__result-cat-desc">${rule.desc}</p>
        </div>
      </div>`;
  }).join('');

  result.classList.add('is-visible');
  setTimeout(() => scrollToEl(result, 80), 50);
}

function hideQsResult() {
  document.getElementById('qs-result')?.classList.remove('is-visible');
}


/* ======================================================
   CONCERN TABS (汎用タブUI)
====================================================== */
function initConcernTabs(panelEl) {
  if (!panelEl) return;
  const tabs   = panelEl.querySelectorAll('[role="tablist"] .concern-tab');
  const panels = panelEl.querySelectorAll('.concern-tab-panel');
  if (!tabs.length) return;

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected','false'); });
      panels.forEach(p => p.classList.remove('is-active'));
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected','true');
      if (panels[i]) panels[i].classList.add('is-active');
    });
    // キーボード操作（矢印キー）
    tab.addEventListener('keydown', (e) => {
      let idx = i;
      if (e.key === 'ArrowRight') idx = (i + 1) % tabs.length;
      else if (e.key === 'ArrowLeft') idx = (i - 1 + tabs.length) % tabs.length;
      else return;
      e.preventDefault();
      tabs[idx].click();
      tabs[idx].focus();
    });
  });
}


/* ======================================================
   STEP 診断タイル（各パネルに紐付け）
====================================================== */
function bindTilesInPanel(panelEl, stepNum) {
  if (!panelEl) return;
  panelEl.querySelectorAll(`.concern-tile[data-step="${stepNum}"]`).forEach(tile => {
    tile.addEventListener('click', () => {
      const val = tile.dataset.val;
      // Step2: Step1選択済みはブロック
      if (stepNum === 2 && val === state.step1) return;
      if (tile.classList.contains('is-disabled')) return;

      const stateKey = `step${stepNum}`;
      const wasSelected = state[stateKey] === val;

      // 同パネル内の全タイルを解除
      panelEl.querySelectorAll(`.concern-tile[data-step="${stepNum}"]`).forEach(t => {
        t.classList.remove('is-selected');
        t.setAttribute('aria-pressed','false');
        t.querySelector('.concern-tile__badge')?.remove();
      });

      if (!wasSelected) {
        state[stateKey] = val;
        tile.classList.add('is-selected');
        tile.setAttribute('aria-pressed','true');
        const badge = document.createElement('span');
        badge.className = 'concern-tile__badge';
        badge.setAttribute('aria-hidden','true');
        badge.textContent = stepNum;
        tile.appendChild(badge);
      } else {
        state[stateKey] = null;
      }

      updateSummary();
      if (stepNum === 1) {
        updateStepButtons(1);
        refreshStep2Disabled();
      }
      if (stepNum === 2) updateStepButtons(2);
      if (stepNum === 3) updateStepButtons(3);
    });
  });
}

function refreshStep2Disabled() {
  const panel2 = document.querySelector('[data-panel="2"]');
  if (!panel2) return;
  panel2.querySelectorAll('.concern-tile[data-step="2"]').forEach(tile => {
    const blocked = tile.dataset.val === state.step1;
    tile.classList.toggle('is-disabled', blocked);
    if (blocked) {
      tile.setAttribute('aria-disabled','true');
      // 選択中だったら解除
      if (state.step2 === tile.dataset.val) {
        state.step2 = null;
        tile.classList.remove('is-selected');
        tile.setAttribute('aria-pressed','false');
        tile.querySelector('.concern-tile__badge')?.remove();
        updateSummary();
      }
    } else {
      tile.removeAttribute('aria-disabled');
    }
  });
}


/* ======================================================
   STEP PROGRESS & NAVIGATION
====================================================== */
function gotoStep(num) {
  // パネル切り替え
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('is-active'));
  document.querySelector(`[data-panel="${num}"]`)?.classList.add('is-active');

  // 結果パネルを隠す
  const resultPanel = document.getElementById('result-panel');
  if (resultPanel) resultPanel.classList.remove('is-active');

  // 進捗ドット更新
  document.querySelectorAll('.step-progress__item').forEach(item => {
    const s = Number(item.dataset.step);
    item.classList.toggle('is-active', s === num);
    item.classList.toggle('is-done',   s < num);
  });

  // Step2移動時: disabled更新
  if (num === 2) refreshStep2Disabled();

  // スクロール
  const diagSection = document.getElementById('step-diagnosis');
  if (diagSection) scrollToEl(diagSection, 60);
}

function updateStepButtons(stepNum) {
  if (stepNum === 1) {
    const btn  = document.getElementById('step1-next');
    const help = document.getElementById('step1-help');
    if (btn)  btn.disabled = !state.step1;
    if (help) help.style.opacity = state.step1 ? '0' : '1';
  }
}

function bindStepNavigation() {
  // Step1 → 2
  document.getElementById('step1-next')?.addEventListener('click', () => {
    if (!state.step1) return;
    gotoStep(2);
  });
  // Step2 → 3
  document.getElementById('step2-next')?.addEventListener('click', () => gotoStep(3));
  document.getElementById('step2-skip')?.addEventListener('click', () => gotoStep(3));
  // Step3 → 4
  document.getElementById('step3-next')?.addEventListener('click', () => gotoStep(4));
  document.getElementById('step3-skip')?.addEventListener('click', () => gotoStep(4));
  // Step4 → 結果
  document.getElementById('step4-submit')?.addEventListener('click', runDiagnosis);
  document.getElementById('step4-skip')?.addEventListener('click',   runDiagnosis);
  // 戻るボタン
  document.querySelectorAll('.step-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const goto = Number(btn.dataset.goto);
      if (goto) gotoStep(goto);
    });
  });
  // リセット
  document.getElementById('result-reset')?.addEventListener('click', resetDiagnosis);
}

function resetDiagnosis() {
  state.step1 = null;
  state.step2 = null;
  state.step3 = null;
  state.age   = null;
  state.situations = [];

  // タイルをすべてリセット
  document.querySelectorAll('.concern-tile').forEach(t => {
    t.classList.remove('is-selected','is-disabled');
    t.setAttribute('aria-pressed','false');
    t.querySelector('.concern-tile__badge')?.remove();
    t.removeAttribute('aria-disabled');
  });
  // チップをリセット
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('is-selected'));
  // タブを先頭に戻す
  document.querySelectorAll('.concern-tabs').forEach(tabList => {
    const tabs   = tabList.querySelectorAll('.concern-tab');
    const panels = tabList.closest('.step-panel')?.querySelectorAll('.concern-tab-panel') || [];
    tabs.forEach((t,i) => {
      t.classList.toggle('is-active', i === 0);
      t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    });
    panels.forEach((p,i) => p.classList.toggle('is-active', i === 0));
  });

  // 結果パネルを隠す
  document.getElementById('result-panel')?.classList.remove('is-active');
  // サマリーリセット
  updateSummary();
  updateStepButtons(1);
  gotoStep(1);
}


/* ======================================================
   SELECTION SUMMARY (sticky)
====================================================== */
function updateSummary() {
  const summary = document.getElementById('selection-summary');
  const empty   = document.getElementById('summary-empty');
  if (!summary) return;

  const items = [];
  if (state.step1) items.push({ label: `お悩み: ${state.step1}`, step: 1 });
  if (state.step2) items.push({ label: `改善点: ${state.step2}`, step: 2 });
  if (state.step3) items.push({ label: `仕上がり: ${state.step3}`, step: 3 });
  if (state.age)   items.push({ label: `${state.age}`, step: 4 });

  // 既存アイテムを削除
  summary.querySelectorAll('.summary-item').forEach(el => el.remove());

  if (items.length === 0) {
    if (empty) empty.style.display = '';
  } else {
    if (empty) empty.style.display = 'none';
    items.forEach(item => {
      const el = document.createElement('span');
      el.className = 'summary-item';
      el.textContent = item.label;
      summary.appendChild(el);
    });
  }
}


/* ======================================================
   STEP4 CHIPS (年齢・状況)
====================================================== */
function bindChips() {
  document.querySelectorAll('.chip[data-type="age"]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip[data-type="age"]').forEach(c => c.classList.remove('is-selected'));
      const wasSelected = chip.classList.contains('is-selected');
      if (!wasSelected) {
        chip.classList.add('is-selected');
        state.age = chip.dataset.val;
      } else {
        state.age = null;
      }
      updateSummary();
    });
  });

  document.querySelectorAll('.chip[data-type="situation"]').forEach(chip => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('is-selected');
      const val = chip.dataset.val;
      if (chip.classList.contains('is-selected')) {
        if (!state.situations.includes(val)) state.situations.push(val);
      } else {
        state.situations = state.situations.filter(s => s !== val);
      }
    });
  });
}


/* ======================================================
   ACCORDION
====================================================== */
function bindAccordions() {
  document.querySelectorAll('.accordion__trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', String(!expanded));
      const bodyId = trigger.getAttribute('aria-controls');
      const body   = document.getElementById(bodyId);
      body?.classList.toggle('is-open', !expanded);
    });
  });

  // FAQ
  document.querySelectorAll('.faq__question').forEach(q => {
    q.addEventListener('click', () => {
      const item     = q.closest('.faq__item');
      const expanded = q.getAttribute('aria-expanded') === 'true';
      q.setAttribute('aria-expanded', String(!expanded));
      item?.classList.toggle('is-open', !expanded);
    });
  });
}


/* ======================================================
   DIAGNOSIS — RESULT RENDERING
====================================================== */

/**
 * メーカー横断ブランドバランシング
 * 同一ブランドは最大2件に制限、上位5件を返す
 */
function diversifyByBrand(recommendations) {
  const brandCount = {};
  const result     = [];
  for (const item of recommendations) {
    const brand = item.brand || 'unknown';
    brandCount[brand] = (brandCount[brand] || 0) + 1;
    if (brandCount[brand] <= 2) result.push(item);
    if (result.length >= 5) break;
  }
  return result;
}

function runDiagnosis() {
  const c1 = state.step1;
  if (!c1) return;
  const c2 = state.step2;
  const c3 = state.step3;

  // 総評テキスト
  const assessment = buildAssessment(c1, c2, c3);

  // カテゴリ優先度でソート
  const priorities = CONCERN_MAP[c1] || {};
  const cats = ['shampoo','treatment','outbath','essence','mask']
    .sort((a, b) => (priorities[a] || 9) - (priorities[b] || 9));

  // 各カテゴリのルール適用
  const recommendations = cats.map(cat => {
    const content = CATEGORY_CONTENT[cat];
    // c1, c2, c3の順でマッチを探す
    let rule = null;
    for (const concern of [c1, c2, c3].filter(Boolean)) {
      rule = content.rules.find(r => r.match.includes(concern));
      if (rule) break;
    }
    rule = rule || content.rules.find(r => r.match.includes('*'));
    return { cat, rule };
  }).filter(r => r.rule);

  renderDiagnosisResult(assessment, recommendations);
}

function renderDiagnosisResult(assessment, recommendations) {
  // 結果パネル表示
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('is-active'));
  const resultPanel = document.getElementById('result-panel');
  if (!resultPanel) return;
  resultPanel.classList.add('is-active');

  // 総評
  const heading = document.getElementById('result-assessment-heading');
  const body    = document.getElementById('result-assessment-body');
  if (heading) heading.textContent = assessment.heading;
  if (body)    body.textContent    = assessment.body;

  // 進捗ドットをすべて「完了」に
  document.querySelectorAll('.step-progress__item').forEach(item => {
    item.classList.remove('is-active');
    item.classList.add('is-done');
  });

  // カード生成
  const grid = document.getElementById('result-grid');
  if (!grid) return;
  grid.innerHTML = recommendations.map(({ cat, rule }, i) => `
    <article class="result-card">
      <div class="result-card__header">
        <span class="result-card__step">Step ${i + 1}</span>
        <span class="result-card__cat">
          <i class="${getCatIconClass(cat)}" aria-hidden="true"></i>
          ${getCatLabel(cat)}
        </span>
      </div>
      <div class="result-card__body">
        <p class="result-card__product">${rule.product}</p>
        <p class="result-card__desc">${rule.desc}</p>
        <p class="result-card__match">${rule.match_text || ''}</p>
        <div class="tag-chips">
          ${(rule.tags || []).map(t => `<span class="tag-chip">${t}</span>`).join('')}
        </div>
      </div>
    </article>
  `).join('');

  // スクロール
  const diagSection = document.getElementById('step-diagnosis');
  if (diagSection) setTimeout(() => scrollToEl(diagSection, 60), 60);
}


/* ======================================================
   PRODUCT SEARCH
====================================================== */
function initProductSearch() {
  const input    = document.getElementById('ps-search-input');
  const searchBtn= document.getElementById('ps-search-btn');
  const clearBtn = document.getElementById('ps-clear-btn');
  const moreBtn  = document.getElementById('ps-more-btn');
  if (!input) return;

  // 初期描画
  searchProducts();

  // 検索バー
  const debouncedSearch = debounce(() => {
    state.productSearch.query = input.value.trim();
    state.productSearch.page  = 1;
    searchProducts();
  }, 200);
  input.addEventListener('input', debouncedSearch);
  searchBtn?.addEventListener('click', () => {
    state.productSearch.query = input.value.trim();
    state.productSearch.page  = 1;
    searchProducts();
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      state.productSearch.query = input.value.trim();
      state.productSearch.page  = 1;
      searchProducts();
    }
  });

  // カテゴリフィルター
  document.querySelectorAll('.ps__filter-chip[data-filter="category"]').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ps__filter-chip[data-filter="category"]')
        .forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      state.productSearch.catFilter   = chip.dataset.val;
      state.productSearch.page = 1;
      searchProducts();
      updateClearBtn();
    });
  });

  // ブランドフィルター
  document.querySelectorAll('.ps__filter-chip[data-filter="brand"]').forEach(chip => {
    chip.addEventListener('click', () => {
      const isActive = chip.classList.contains('is-active');
      document.querySelectorAll('.ps__filter-chip[data-filter="brand"]')
        .forEach(c => c.classList.remove('is-active'));
      if (!isActive) {
        chip.classList.add('is-active');
        state.productSearch.brandFilter = chip.dataset.val;
      } else {
        state.productSearch.brandFilter = '';
      }
      state.productSearch.page = 1;
      searchProducts();
      updateClearBtn();
    });
  });

  // クリアボタン
  clearBtn?.addEventListener('click', () => {
    clearFilters();
  });

  // もっと見る
  moreBtn?.addEventListener('click', () => {
    state.productSearch.page++;
    searchProducts(true);
  });
}

function searchProducts(append = false) {
  const { query, catFilter, brandFilter, page, perPage } = state.productSearch;
  const q = query.toLowerCase();

  let results = PRODUCTS.filter(p => {
    // テキスト検索
    if (q) {
      const searchTarget = [p.name, p.brand, p.desc, ...(p.tags || []), ...(p.concern || [])].join(' ').toLowerCase();
      if (!searchTarget.includes(q)) return false;
    }
    // カテゴリフィルター
    if (catFilter && p.category !== catFilter) return false;
    // ブランドフィルター（部分一致）
    if (brandFilter && !p.brand.toLowerCase().includes(brandFilter.toLowerCase())) return false;
    return true;
  });

  state.productSearch.results = results;

  const total   = results.length;
  const sliced  = results.slice(0, page * perPage);
  const hasMore = total > page * perPage;

  renderProductResults(sliced, append);

  // カウント更新
  const countEl = document.getElementById('ps-count');
  if (countEl) countEl.textContent = total;

  // 空状態
  const empty = document.getElementById('ps-empty');
  empty?.classList.toggle('is-visible', total === 0);

  // もっと見るボタン
  const moreBtn = document.getElementById('ps-more-btn');
  if (moreBtn) moreBtn.style.display = hasMore ? '' : 'none';
}

function renderProductResults(products, append = false) {
  const grid = document.getElementById('ps-grid');
  if (!grid) return;

  const cards = products.map(p => {
    const catLabel = getCatLabel(p.category);
    const catIcon  = getCatIconClass(p.category);
    const tags = (p.tags || []).map(t => `<span class="product-card__tag">${t}</span>`).join('');
    return `
      <article class="product-card" role="listitem">
        <div class="product-card__img-wrap">
          <div class="product-card__img-placeholder" aria-hidden="true">
            <i class="${catIcon}"></i>
            <span>${catLabel}</span>
          </div>
          <span class="product-card__cat-badge">${catLabel}</span>
        </div>
        <div class="product-card__body">
          <p class="product-card__brand">${p.brand}</p>
          <h3 class="product-card__name">${p.name}</h3>
          <p class="product-card__desc">${p.desc}</p>
          <div class="product-card__tags">${tags}</div>
        </div>
        <div class="product-card__footer">
          <a href="${p.url}" target="_blank" rel="noopener" class="product-card__link"
            aria-label="${p.name}の詳細を見る">
            <i class="fa-light fa-arrow-up-right-from-square" aria-hidden="true"></i>
            詳細を見る
          </a>
          <a href="https://seam.stores.jp/" target="_blank" rel="noopener"
            class="product-card__link product-card__link--secondary"
            aria-label="オンラインショップで${p.name}を探す">
            <i class="fa-light fa-bag-shopping" aria-hidden="true"></i>
          </a>
        </div>
      </article>`;
  }).join('');

  if (append) {
    grid.insertAdjacentHTML('beforeend', cards);
  } else {
    grid.innerHTML = cards;
  }
}

function clearFilters() {
  state.productSearch.query        = '';
  state.productSearch.catFilter    = '';
  state.productSearch.brandFilter  = '';
  state.productSearch.page         = 1;

  const input = document.getElementById('ps-search-input');
  if (input) input.value = '';

  document.querySelectorAll('.ps__filter-chip[data-filter="category"]').forEach((c, i) => {
    c.classList.toggle('is-active', i === 0); // 最初の「すべて」をアクティブに
  });
  document.querySelectorAll('.ps__filter-chip[data-filter="brand"]').forEach(c => {
    c.classList.remove('is-active');
  });

  searchProducts();
  updateClearBtn();
}

function updateClearBtn() {
  const btn = document.getElementById('ps-clear-btn');
  const hasFilter = !!(state.productSearch.catFilter || state.productSearch.brandFilter || state.productSearch.query);
  btn?.classList.toggle('is-visible', hasFilter);
}


/* ======================================================
   INIT
====================================================== */
function init() {
  // ヘッダー・ナビ
  initNav();
  initLangTabs();

  // FVパネル
  initFvPanel();

  // QS
  initQuickSearch();

  // 詳細診断タブ
  const panel1 = document.querySelector('[data-panel="1"]');
  const panel2 = document.querySelector('[data-panel="2"]');
  initConcernTabs(panel1);
  initConcernTabs(panel2);

  // タイルバインド
  bindTilesInPanel(panel1, 1);
  bindTilesInPanel(panel2, 2);
  bindTilesInPanel(document.querySelector('[data-panel="3"]'), 3);

  // チップ
  bindChips();

  // アコーディオン
  bindAccordions();

  // ステップナビゲーション
  bindStepNavigation();

  // 初期ボタン状態
  updateStepButtons(1);
  updateSummary();

  // Product Search
  initProductSearch();

  // スムーズスクロール（内部アンカー）
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const href = a.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      scrollToEl(target, 80);
    });
  });
}

// DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/* =========================================================
   SalonPro / Data — 商品・カテゴリのマスタ
   ※ プロトタイプ用のサンプルデータ。実APIに差し替え可能な形。
   price は税抜単価。stock: in|low|order|wait / badge: popular|new|null
   ph: プレースホルダ画像の {shape, tint}（実画像が無い場合に描画）
   ========================================================= */
(function () {
  /* =========================================================
     テナント設定（マルチテナントSaaS）：1コードベースをディーラーごとに
     カスタマイズ。全ページがこの設定を読んで表示/非表示・色・業種・決済を切替。
     設定画面 dealer-settings.html が localStorage 'sp.tenant.v1' に保存。
     ========================================================= */
  const DEFAULT_TENANT = {
    siteName: 'SalonPro',
    operator: '菊地',
    accent: '#b9923f',
    biz: { hair: true, eye: true, nail: true, esthe: true },
    payments: { invoice: true, card: true, bank: true, cod: false },
    features: {
      seminars: true, campaigns: true, news: true, categoryGrid: true,
      marketplace: true, tempu: true, subscribe: true, barcode: true, pos: true,
      staff: true, push: true, favorites: true, learn: true, support: true,
      books: true, equipment: true, usedEquipment: true, partners: true,
      quickorder: true, invoices: true, staffmate: true, staffApproval: true,
      buyback: true, karte: true,
    },
    // 紹介パートナー（工務店/タオル/税理士/社労士/カード決済/保険）の表示可否（ディーラー個別）
    partners: { koumuten: true, towel: true, tax: true, sharoshi: true, payment: true, insurance: true, insurancePersonal: true, utility: true, internet: true, recruit: true, lease: true, security: true },
    // 個人支払い（スタッフメイトのスタッフ個人決済）の方式ごとの表示可否
    personalPay: { card: true, code: true, conbini: true },
    priceMode: 'open', // open | login | hidden
  };
  const TENANT_PRESETS = {
    open:   { label: 'オープンEC型（価格公開・自己完結）', patch: { priceMode: 'open', features: { marketplace: false } } },
    rep:    { label: '担当制ディーラー型（価格ログイン後・営業担当）', patch: { priceMode: 'login', features: { marketplace: false, subscribe: false, barcode: false, pos: false } } },
    market: { label: '全国相乗り型（連携ディーラーON）', patch: { priceMode: 'open', features: { marketplace: true } } },
  };
  function deepMerge(base, over) {
    const out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    for (const k in (over || {})) {
      out[k] = (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k])) ? deepMerge(base[k] || {}, over[k]) : over[k];
    }
    return out;
  }
  let TENANT = DEFAULT_TENANT;
  try { const saved = JSON.parse(localStorage.getItem('sp.tenant.v1')); if (saved) TENANT = deepMerge(DEFAULT_TENANT, saved); } catch (e) {}

  // 第1階層カテゴリ（biz＝対象業種。会員の業種で出し分け）
  const categories = [
    // ヘア（美容室）
    { id: 'shampoo',   label: 'シャンプー',          count: 452, biz: 'hair' },
    { id: 'treatment', label: 'トリートメント',      count: 318, biz: 'hair' },
    { id: 'color',     label: 'カラー剤',            count: 516, biz: 'hair' },
    { id: 'perm',      label: 'パーマ剤',            count: 120, biz: 'hair' },
    { id: 'straight',  label: 'ストレート剤',        count: 96,  biz: 'hair' },
    { id: 'outbath',   label: 'アウトバス',          count: 264, biz: 'hair' },
    { id: 'styling',   label: 'スタイリング',        count: 203, biz: 'hair' },
    { id: 'care',      label: '処理剤／ケア剤',      count: 142, biz: 'hair' },
    { id: 'scalp',     label: 'スカルプケア',        count: 96,  biz: 'hair' },
    // ネイル
    { id: 'nail-gel',  label: 'ジェル／カラージェル', count: 680, biz: 'nail' },
    { id: 'nail-care', label: 'ネイルケア／ファイル', count: 210, biz: 'nail' },
    // エステ
    { id: 'es-face',   label: 'フェイシャル',        count: 240, biz: 'esthe' },
    { id: 'es-body',   label: 'ボディ／痩身',        count: 180, biz: 'esthe' },
    // アイ（まつげ）※美容師免許が必要。ヘア商材も取扱可
    { id: 'eye-ext',   label: 'まつげエクステ（ラッシュ／グルー）', count: 320, biz: 'eye' },
    { id: 'eye-lift',  label: 'ラッシュリフト／まつげパーマ',       count: 96,  biz: 'eye' },
    { id: 'eye-tool',  label: 'アイツール／衛生用品',               count: 154, biz: 'eye' },
    // 共通（全業種で使う消耗品・備品）
    { id: 'supply',    label: 'サロン消耗品・備品',  count: 320, biz: 'all' },
    // 設備・什器（大型・機器）※全業種
    { id: 'equipment', label: '設備・什器',          count: 180, biz: 'all' },
    // 業界誌・書籍（定期購読＝サブスク／技術書）※全業種
    { id: 'book',      label: '業界誌・書籍',        count: 48,  biz: 'all' },
  ];

  // 並び順 added(新着) / pop(人気) は数値が大きいほど上位
  const products = [
    /* ===== シャンプー（スクショ①の9点を先頭に忠実再現） ===== */
    { id:'sh-001', cat:'shampoo', brand:'ルベル',     name:'イオ クレンジング リラックスメント 600mL',           price:3080, stock:'in',  badge:'popular', pop:98, added:60, same:true,  ph:{shape:'pump', tint:'#c0392b'} },
    { id:'sh-002', cat:'shampoo', brand:'トキオ',     name:'TOKIO IE インカラミ プレミアム シャンプー 400mL',      price:3280, stock:'in',  badge:'new',     pop:90, added:99, same:true,  ph:{shape:'pump', tint:'#2b2b2e'} },
    { id:'sh-003', cat:'shampoo', brand:'ミルボン',   name:'スムージング シャンプー ファインヘア 500mL',          price:3520, stock:'in',  badge:null,      pop:88, added:74, same:true,  ph:{shape:'pump', tint:'#e6e7ea'} },
    { id:'sh-004', cat:'shampoo', brand:'アジュバン', name:'Re: エミサリー シャンプー 700mL（詰替）',            price:3630, stock:'low', badge:'low',     pop:80, added:70, same:true,  ph:{shape:'pouch', tint:'#6b4f3a'} },
    { id:'sh-005', cat:'shampoo', brand:'ナプラ',     name:'N. シアシャンプー スムース 750mL（詰替）',           price:3080, stock:'in',  badge:null,      pop:92, added:80, same:true,  ph:{shape:'pouch', tint:'#b9bcc2'} },
    { id:'sh-006', cat:'shampoo', brand:'イーラル',   name:'ピュア シャンプー スカルプ 1000mL（詰替）',          price:5200, stock:'in',  badge:null,      pop:72, added:55, same:true,  ph:{shape:'pump', tint:'#243b6b'} },
    { id:'sh-007', cat:'shampoo', brand:'オージュア', name:'オーセナム シャンプー 1000mL（詰替）',               price:6160, stock:'in',  badge:null,      pop:86, added:78, same:true,  ph:{shape:'pouch', tint:'#bcd3e6'} },
    { id:'sh-008', cat:'shampoo', brand:'ケラスターゼ', name:'バン ニュートリ フォーティ 1000mL（サロンサイズ）',  price:6930, stock:'in',  badge:null,      pop:84, added:66, same:true,  ph:{shape:'pump', tint:'#ede7da'} },
    { id:'sh-009', cat:'shampoo', brand:'デミ',       name:'フローディア シャンプー スリークライト 1000mL（詰替）', price:4620, stock:'in', badge:null,      pop:70, added:58, same:true,  ph:{shape:'pouch', tint:'#c2c4c9'} },
    /* 充実用の追加（実在ブランドの定番ライン） */
    { id:'sh-010', cat:'shampoo', brand:'ルベル',     name:'ジオ スキャルプ シャンプー 1000mL（詰替）',          price:4400, stock:'in',  badge:'popular', pop:95, added:52, same:true,  ph:{shape:'pouch', tint:'#2f6f5e'} },
    { id:'sh-011', cat:'shampoo', brand:'ミルボン',   name:'プラーミア クリアスパフォーム 320g',                 price:3300, stock:'in',  badge:'new',     pop:76, added:96, same:true,  ph:{shape:'pump', tint:'#3a3f4a'} },
    { id:'sh-012', cat:'shampoo', brand:'ナプラ',     name:'インプライム シャンプー ボリューム 1000mL',          price:4180, stock:'in',  badge:null,      pop:68, added:48, same:true,  ph:{shape:'pouch', tint:'#8c6f3a'} },
    { id:'sh-013', cat:'shampoo', brand:'ホーユー',   name:'プロマスター カラーケア シャンプー さらり 1000mL',     price:3300, stock:'in',  badge:null,      pop:74, added:50, same:true,  ph:{shape:'pump', tint:'#356d8c'} },
    { id:'sh-014', cat:'shampoo', brand:'フィヨーレ', name:'Fプロテクト シャンプー リッチ 250mL',                price:1540, stock:'in',  badge:null,      pop:60, added:44, same:true,  ph:{shape:'bottle', tint:'#7a3b52'} },
    { id:'sh-015', cat:'shampoo', brand:'アリミノ',   name:'コアミー スムースシャンプー 600mL',                  price:2200, stock:'in',  badge:null,      pop:64, added:62, same:true,  ph:{shape:'pump', tint:'#caa64a'} },
    { id:'sh-016', cat:'shampoo', brand:'シュワルツコフ', name:'BCクア カラーセーブ シャンプー 1000mL',           price:4400, stock:'wait' , badge:null,    pop:58, added:40, same:false, ph:{shape:'pump', tint:'#1f2d4d'} },
    { id:'sh-017', cat:'shampoo', brand:'ロレアル',   name:'セリエ エキスパート アブソルートリペア 1500mL',       price:5830, stock:'in',  badge:null,      pop:66, added:46, same:true,  ph:{shape:'pump', tint:'#8a6d2f'} },
    { id:'sh-018', cat:'shampoo', brand:'タマリス',   name:'ソルティール シャンプー リペアモイスト 1000mL',       price:3080, stock:'low', badge:'low',     pop:55, added:38, same:true,  ph:{shape:'pouch', tint:'#9a8cae'} },
    { id:'sh-019', cat:'shampoo', brand:'ナカノ',     name:'R-23 シャンプー EX タイプ2 1000mL',                 price:2640, stock:'in',  badge:null,      pop:62, added:36, same:true,  ph:{shape:'pump', tint:'#b0573a'} },
    { id:'sh-020', cat:'shampoo', brand:'ジョンマスター', name:'イブニングP シャンプー N 473mL',                  price:3960, stock:'in',  badge:null,      pop:57, added:64, same:true,  ph:{shape:'bottle', tint:'#3f5a3a'} },
    { id:'sh-021', cat:'shampoo', brand:'ムコタ',     name:'アデューラ アイレ02 シャンプー 250mL',               price:1980, stock:'in',  badge:null,      pop:59, added:42, same:true,  ph:{shape:'bottle', tint:'#c7b89a'} },
    { id:'sh-022', cat:'shampoo', brand:'ニゼル',     name:'ジェリーH シャンプー 1000mL',                        price:3520, stock:'in',  badge:null,      pop:53, added:34, same:true,  ph:{shape:'pump', tint:'#4a4f57'} },
    { id:'sh-023', cat:'shampoo', brand:'ステラ',     name:'プレジュ シャンプー モイスト 700mL',                 price:2860, stock:'in',  badge:null,      pop:51, added:32, same:true,  ph:{shape:'pump', tint:'#b58da0'} },
    { id:'sh-024', cat:'shampoo', brand:'オブ・コスメ', name:'オブ シャンプー セ ハート 1000mL（詰替）',          price:4180, stock:'in',  badge:'popular', pop:82, added:54, same:true,  ph:{shape:'pouch', tint:'#7a6a8c'} },

    /* ===== カラー1剤は「ライン×色×明るさ」を後段の COLOR_LINES から生成（co-* を自動追加） ===== */

    /* ===== カラー2剤（オキシ／過酸化水素水・ディベロッパー）。1剤と対で使う酸化剤 ===== */
    { id:'cox-001', cat:'color', colorType:'oxy', brand:'ミルボン',   name:'オキシダン 6%（2剤）1000mL',              price:880,  stock:'in',  badge:'popular', pop:96, added:70, same:true,  ph:{shape:'pouch', tint:'#cfd3da'} },
    { id:'cox-002', cat:'color', colorType:'oxy', brand:'ミルボン',   name:'オキシダン 3%（2剤）1000mL',              price:880,  stock:'in',  badge:null,      pop:88, added:64, same:true,  ph:{shape:'pouch', tint:'#dde0e6'} },
    { id:'cox-003', cat:'color', colorType:'oxy', brand:'ホーユー',   name:'プロマスター オキシ 6%（2剤）1000mL',     price:770,  stock:'in',  badge:null,      pop:90, added:66, same:true,  ph:{shape:'pouch', tint:'#c4d4e0'} },
    { id:'cox-004', cat:'color', colorType:'oxy', brand:'ホーユー',   name:'プロマスター オキシ 3%（2剤）1000mL',     price:770,  stock:'in',  badge:null,      pop:82, added:60, same:true,  ph:{shape:'pouch', tint:'#d2dde6'} },
    { id:'cox-005', cat:'color', colorType:'oxy', brand:'ナプラ',     name:'N. オキシ 6%（2剤）1000mL',               price:660,  stock:'in',  badge:null,      pop:85, added:62, same:true,  ph:{shape:'pouch', tint:'#cccfd4'} },
    { id:'cox-006', cat:'color', colorType:'oxy', brand:'ナプラ',     name:'N. オキシ 3%（2剤）1000mL',               price:660,  stock:'in',  badge:null,      pop:78, added:56, same:true,  ph:{shape:'pouch', tint:'#d8dbe0'} },
    { id:'cox-007', cat:'color', colorType:'oxy', brand:'アリミノ',   name:'アジトール ハイブリッド オキシ 6% 1000mL', price:935,  stock:'in',  badge:null,      pop:74, added:52, same:true,  ph:{shape:'pouch', tint:'#c9c4b8'} },
    { id:'cox-008', cat:'color', colorType:'oxy', brand:'ロレアル',   name:'オキシダン クレーム 6%（20vol）1000mL',   price:1100, stock:'in',  badge:null,      pop:72, added:50, same:true,  ph:{shape:'pump', tint:'#e3dccb'} },
    { id:'cox-009', cat:'color', colorType:'oxy', brand:'ホーユー',   name:'プロマスター オキシ 4.5%（2剤）1000mL',   price:770,  stock:'low', badge:'low',     pop:64, added:46, same:true,  ph:{shape:'pouch', tint:'#cdd8e0'} },
    { id:'cox-010', cat:'color', colorType:'oxy', brand:'ミルボン',   name:'オキシダン 1.5%（低濃度・2剤）1000mL',     price:880,  stock:'in',  badge:null,      pop:60, added:42, same:true,  ph:{shape:'pouch', tint:'#e2e5ea'} },
    { id:'cox-011', cat:'color', colorType:'oxy', brand:'タマリス',   name:'ソルティール オキシ 6% 1000mL',           price:715,  stock:'in',  badge:null,      pop:58, added:40, same:true,  ph:{shape:'pouch', tint:'#cabfd0'} },
    { id:'cox-012', cat:'color', colorType:'oxy', brand:'デミ',       name:'ディベロッパー 6%（2剤）1800mL',          price:1320, stock:'in',  badge:null,      pop:62, added:44, same:true,  ph:{shape:'pump', tint:'#c2c4c9'} },

    /* ===== カラー剤：ブリーチ／ライトナー（脱色・脱染） ===== */
    { id:'cbl-1', cat:'color', colorType:'bleach', brand:'ナプラ',     name:'アクセスフリー パウダーブリーチ 400g',     price:2860, stock:'in',  badge:'popular', pop:90, added:66, same:true, ph:{shape:'box',  tint:'#e7e3d6', label:'BLEACH'} },
    { id:'cbl-2', cat:'color', colorType:'bleach', brand:'ホーユー',   name:'ブリーチ パウダー 500g',                  price:2420, stock:'in',  badge:null,      pop:80, added:58, same:true, ph:{shape:'box',  tint:'#dcd8cb', label:'BLEACH'} },
    { id:'cbl-3', cat:'color', colorType:'bleach', brand:'ウエラ',     name:'ブロンドール ライトナー 400g',            price:3300, stock:'in',  badge:null,      pop:72, added:52, same:true, ph:{shape:'box',  tint:'#efe7cf', label:'LIGHTNER'} },
    { id:'cbl-4', cat:'color', colorType:'bleach', brand:'ロレアル',   name:'ブロンステュディオ MTメッシュ 500g',       price:3520, stock:'low', badge:'low',     pop:64, added:46, same:true, ph:{shape:'box',  tint:'#e3dccb', label:'MECHE'} },

    /* ===== カラー剤：ヘアマニキュア（酸性カラー・1剤） ===== */
    { id:'cmn-1', cat:'color', colorType:'manicure', brand:'ナプラ',     name:'アクセスフリー マニキュア ナチュラルブラウン 300g', price:2310, stock:'in', badge:null, pop:78, added:55, same:true, ph:{shape:'tube', tint:'#6b4f3a', label:'MANI'} },
    { id:'cmn-2', cat:'color', colorType:'manicure', brand:'山発',       name:'パイモア カラーラッカー レッド 150g',              price:1760, stock:'in', badge:null, pop:66, added:48, same:true, ph:{shape:'tube', tint:'#a83246', label:'MANI'} },
    { id:'cmn-3', cat:'color', colorType:'manicure', brand:'ハホニコ',   name:'十六油 マニキュア アッシュ 300g',                  price:2200, stock:'in', badge:null, pop:60, added:44, same:true, ph:{shape:'tube', tint:'#6b7280', label:'MANI'} },
    { id:'cmn-4', cat:'color', colorType:'manicure', brand:'資生堂',     name:'プリミエンス マニキュア クリア 300g',              price:2530, stock:'in', badge:null, pop:54, added:40, same:true, ph:{shape:'tube', tint:'#d8d2c4', label:'CLEAR'} },

    /* ===== カラー剤：ヘナ（植物染料・1剤） ===== */
    { id:'chn-1', cat:'color', colorType:'henna', brand:'ナイアード',   name:'ヘナ＋木藍 ブラウン系 100g',           price:1540, stock:'in', badge:null, pop:70, added:50, same:true, ph:{shape:'box', tint:'#7a5230', label:'HENNA'} },
    { id:'chn-2', cat:'color', colorType:'henna', brand:'グリーンノート', name:'ヘナ オレンジ（天然100%）100g',       price:1320, stock:'in', badge:null, pop:60, added:44, same:true, ph:{shape:'box', tint:'#b5642a', label:'HENNA'} },
    { id:'chn-3', cat:'color', colorType:'henna', brand:'テンスター',   name:'ファッションヘナ ダークブラウン 100g',  price:990,  stock:'in', badge:null, pop:52, added:38, same:true, ph:{shape:'box', tint:'#5b3d28', label:'HENNA'} },

    /* ===== カラー剤：カラートリートメント（1剤・低ダメージ） ===== */
    { id:'cct-1', cat:'color', colorType:'colortreatment', brand:'ナプラ',   name:'ナシードカラートリートメント ブラウン 300g', price:2200, stock:'in', badge:'popular', pop:84, added:64, same:true, ph:{shape:'tube', tint:'#6b4f3a', label:'CT'} },
    { id:'cct-2', cat:'color', colorType:'colortreatment', brand:'ホーユー', name:'ビゲン カラートリートメント ダークブラウン 180g', price:1100, stock:'in', badge:null, pop:70, added:50, same:true, ph:{shape:'tube', tint:'#4a3526', label:'CT'} },
    { id:'cct-3', cat:'color', colorType:'colortreatment', brand:'サニープレイス', name:'ナチュラルVe カラートリートメント アッシュ 300g', price:2640, stock:'in', badge:null, pop:62, added:46, same:true, ph:{shape:'tube', tint:'#6b7280', label:'CT'} },

    /* ===== カラー剤：塩基性カラー／カラーバター（1剤・ビビッド） ===== */
    { id:'cbs-1', cat:'color', colorType:'basic', brand:'エンシェールズ', name:'カラーバター ショッキングパープル 200g', price:2090, stock:'in', badge:'popular', pop:86, added:70, same:true, ph:{shape:'jar', tint:'#6e2f8a', label:'BUTTER'} },
    { id:'cbs-2', cat:'color', colorType:'basic', brand:'エンシェールズ', name:'カラーバター ヘンプグリーン 200g',       price:2090, stock:'in', badge:null,      pop:74, added:56, same:true, ph:{shape:'jar', tint:'#3f7a4a', label:'BUTTER'} },
    { id:'cbs-3', cat:'color', colorType:'basic', brand:'ロイド',         name:'カラーキューティ 塩基性カラー ブルー 200g', price:1980, stock:'in', badge:null,    pop:64, added:48, same:true, ph:{shape:'jar', tint:'#2f5f9e', label:'BASIC'} },
    { id:'cbs-4', cat:'color', colorType:'basic', brand:'タマリス',       name:'ロックヴィラ カラーバター ピンク 200g',  price:2200, stock:'low', badge:'low',     pop:56, added:42, same:true, ph:{shape:'jar', tint:'#cf5a86', label:'BUTTER'} },

    /* ===== パーマ剤（permType＝還元剤系統×技法。チオ/シス/酸性/クリープ/デジタル/エア/コスメ＋2剤＋処理剤） ===== */
    { id:'pm-1',  cat:'perm', permType:'cold-thio', brand:'ミルボン',   name:'ニュートリプレックス クリエイト 1剤 400mL', price:1650, stock:'in', badge:'popular', pop:90, added:66, same:true, ph:{shape:'pouch', tint:'#3a6ea5', label:'COLD'} },
    { id:'pm-2',  cat:'perm', permType:'cold-thio', brand:'ナプラ',     name:'リッジフォルム ウェーブ チオ 1剤 400mL',    price:1320, stock:'in', badge:null,      pop:78, added:56, same:true, ph:{shape:'pouch', tint:'#3a6ea5', label:'COLD'} },
    { id:'pm-3',  cat:'perm', permType:'cold-cys',  brand:'ミルボン',   name:'ディーセス システアミン ウェーブ 1剤 400mL', price:1870, stock:'in', badge:null,     pop:74, added:52, same:true, ph:{shape:'pouch', tint:'#4a8f8a', label:'CYS'} },
    { id:'pm-4',  cat:'perm', permType:'cold-cys',  brand:'ハホニコ',   name:'キラメラメ システアミン 1剤 400mL',         price:1980, stock:'in', badge:null,     pop:62, added:46, same:true, ph:{shape:'pouch', tint:'#4a8f8a', label:'CYS'} },
    { id:'pm-5',  cat:'perm', permType:'acid',      brand:'ナンバースリー', name:'プルミエ 酸性 ウェーブ 1剤 400mL',       price:1760, stock:'in', badge:null,     pop:70, added:50, same:true, ph:{shape:'pouch', tint:'#b5764a', label:'ACID'} },
    { id:'pm-6',  cat:'perm', permType:'acid',      brand:'アリミノ',   name:'コスメカール 酸性 ウェーブ 1剤 400mL',      price:1540, stock:'in', badge:null,     pop:58, added:42, same:true, ph:{shape:'pouch', tint:'#b5764a', label:'ACID'} },
    { id:'pm-7',  cat:'perm', permType:'creep',     brand:'ミルボン',   name:'クリープパーマ クリエイト 1剤 400mL',       price:1980, stock:'in', badge:'new',     pop:72, added:90, same:true, ph:{shape:'pouch', tint:'#7a6ea5', label:'CREEP'} },
    { id:'pm-8',  cat:'perm', permType:'digital',   brand:'パイモア',   name:'デジタルパーマ用 ロッド加温 1剤 400mL',     price:2200, stock:'in', badge:null,      pop:66, added:48, same:true, ph:{shape:'pouch', tint:'#a5563a', label:'DIGITAL'} },
    { id:'pm-9',  cat:'perm', permType:'digital',   brand:'ミルボン',   name:'ディーセス デジタル 1剤（加温式）400mL',    price:2420, stock:'wait' , badge:null,   pop:60, added:44, same:false, ph:{shape:'pouch', tint:'#a5563a', label:'DIGITAL'} },
    { id:'pm-10', cat:'perm', permType:'air',       brand:'資生堂',     name:'エアウェーブ 専用 1剤 400mL',               price:2310, stock:'in', badge:null,      pop:56, added:40, same:true, ph:{shape:'pouch', tint:'#5a9ab5', label:'AIR'} },
    { id:'pm-11', cat:'perm', permType:'cosme',     brand:'ナプラ',     name:'コスメパーマ ソフト 1剤（化粧品）400mL',    price:1210, stock:'in', badge:null,      pop:64, added:46, same:true, ph:{shape:'pouch', tint:'#8a9a6b', label:'COSME'} },
    { id:'pm-12', cat:'perm', permType:'perm2',     brand:'ミルボン',   name:'ウェーブ 2剤（ブロム酸）400mL',             price:990,  stock:'in', badge:null,      pop:68, added:50, same:true, ph:{shape:'pouch', tint:'#cfd3da', label:'2剤'} },
    { id:'pm-13', cat:'perm', permType:'perm2',     brand:'ナプラ',     name:'リッジフォルム 2剤 400mL',                  price:880,  stock:'in', badge:null,      pop:60, added:44, same:true, ph:{shape:'pouch', tint:'#dde0e6', label:'2剤'} },
    { id:'pm-14', cat:'perm', permType:'treat',     brand:'ハホニコ',   name:'パーマ用 前処理剤（CMC）500mL',             price:1650, stock:'in', badge:null,      pop:54, added:38, same:true, ph:{shape:'pump',  tint:'#c8b89a', label:'処理'} },

    /* ===== ストレート剤（straightType＝アルカリ縮毛/酸性/クリープ/コスメ/2剤/処理剤） ===== */
    { id:'st-1',  cat:'straight', straightType:'alkaline', brand:'ミルボン', maker:'ミルボン', line:'リシオ',  name:'リシオ 縮毛矯正 1剤 N（軟化）400g',        price:2090, stock:'in', badge:'popular', pop:90, added:66, same:true, ph:{shape:'tube', tint:'#3a6ea5', label:'縮毛'} },
    { id:'st-2',  cat:'straight', straightType:'alkaline', brand:'ナプラ',     name:'エヌドット 縮毛矯正 1剤 ストロング 400g',  price:1760, stock:'in', badge:null,      pop:78, added:56, same:true, ph:{shape:'tube', tint:'#3a6ea5', label:'縮毛'} },
    { id:'st-3',  cat:'straight', straightType:'acid',     brand:'ナンバースリー', name:'酸性ストレート 1剤（ダメージ毛用）400g', price:2420, stock:'in', badge:'new',  pop:80, added:92, same:true, ph:{shape:'tube', tint:'#b5764a', label:'酸性'} },
    { id:'st-4',  cat:'straight', straightType:'acid',     brand:'ホーユー',   name:'プロマスター 酸性ストレート 1剤 400g',     price:2200, stock:'in', badge:null,      pop:66, added:50, same:true, ph:{shape:'tube', tint:'#b5764a', label:'酸性'} },
    { id:'st-5',  cat:'straight', straightType:'creep',    brand:'ミルボン',   name:'クリープ系 ストレート 1剤（質感重視）400g', price:2530, stock:'order', badge:null,  pop:60, added:46, same:false, ph:{shape:'tube', tint:'#7a6ea5', label:'CREEP'} },
    { id:'st-6',  cat:'straight', straightType:'cosme',    brand:'ナプラ',     name:'コスメストレート ソフト 1剤（化粧品）400g', price:1430, stock:'in', badge:null,     pop:58, added:42, same:true, ph:{shape:'tube', tint:'#8a9a6b', label:'COSME'} },
    { id:'st-7',  cat:'straight', straightType:'straight2', brand:'ミルボン', maker:'ミルボン', line:'リシオ', name:'リシオ ストレート 2剤（臭素酸）400g',      price:1100, stock:'in', badge:null,     pop:64, added:48, same:true, ph:{shape:'tube', tint:'#cfd3da', label:'2剤'} },
    { id:'st-8',  cat:'straight', straightType:'straight2', brand:'ナプラ',    name:'エヌドット ストレート 2剤 400g',           price:990,  stock:'in', badge:null,     pop:56, added:40, same:true, ph:{shape:'tube', tint:'#dde0e6', label:'2剤'} },
    { id:'st-9',  cat:'straight', straightType:'treat',    brand:'ハホニコ',   name:'縮毛矯正 前処理 ケラチン 500mL',           price:1980, stock:'in', badge:null,     pop:52, added:38, same:true, ph:{shape:'pump', tint:'#c8b89a', label:'処理'} },
    { id:'st-10', cat:'straight', straightType:'treat',    brand:'ハホニコ',   name:'酸熱トリートメント（後処理）500mL',         price:3300, stock:'in', badge:null,     pop:62, added:60, same:true, ph:{shape:'pump', tint:'#b8a07a', label:'酸熱'} },

    /* ===== トリートメント ===== */
    { id:'tr-001', cat:'treatment', brand:'オージュア', name:'クエンチ モイスチャー トリートメント 250g',  price:2420, stock:'in',  badge:'popular', pop:94, added:72, same:true,  ph:{shape:'tube', tint:'#2b6cb0'} },
    { id:'tr-002', cat:'treatment', brand:'ルベル',     name:'イオ ディープマスク トリートメント 170g',     price:2090, stock:'in',  badge:null,      pop:80, added:60, same:true,  ph:{shape:'jar', tint:'#b8869a'} },
    { id:'tr-003', cat:'treatment', brand:'ナプラ',     name:'N. シアトリートメント スムース 750g（詰替）',  price:3520, stock:'in',  badge:null,      pop:84, added:64, same:true,  ph:{shape:'pouch', tint:'#c2c4c9'} },
    { id:'tr-004', cat:'treatment', brand:'ケラスターゼ', name:'マスク アンタンス 500mL',                    price:7480, stock:'in',  badge:'new',     pop:70, added:95, same:true,  ph:{shape:'jar', tint:'#3a3030'} },
    { id:'tr-005', cat:'treatment', brand:'デミ',       name:'ミレアム ヘアトリートメント 1800g',           price:3960, stock:'low', badge:'low',     pop:66, added:50, same:true,  ph:{shape:'jar', tint:'#7aa0c0'} },
    { id:'tr-006', cat:'treatment', brand:'ハホニコ',   name:'ザ・ラメラメ No.1 トリートメント 1000g',       price:4070, stock:'wait' , badge:null,    pop:60, added:40, same:false, ph:{shape:'tube', tint:'#c08a2a'} },

    /* ===== SEE/SAW（タカラベルモントのデザインブランド／通常商品・契約不要） ===== */
    { id:'ss-001', cat:'styling', brand:'SEE/SAW', name:'フォギーフィックス ドライテクスチャー 180g', price:2200, stock:'in', badge:null, pop:80, added:72, same:true, ph:{shape:'box',    tint:'#5b6473', label:'SEE/SAW'} },
    { id:'ss-002', cat:'outbath', brand:'SEE/SAW', name:'スリーク オイル 100mL',                     price:2860, stock:'in', badge:null, pop:74, added:64, same:true, ph:{shape:'bottle', tint:'#6e2f57'} },

    /* ===== シャンプー追加（炭酸／ドライ） ===== */
    { id:'sh-101', cat:'shampoo', brand:'ナプラ',   name:'インプライム スパークリングスパ 炭酸シャンプー 320g', price:2640, stock:'in', badge:'popular', pop:88, added:84, same:true, ph:{shape:'pump',  tint:'#5aa6c4'} },
    { id:'sh-102', cat:'shampoo', brand:'ミルボン', name:'プラーミア 炭酸クレンジングフォーム 200g',           price:2860, stock:'in', badge:'new',     pop:80, added:90, same:true, ph:{shape:'pump',  tint:'#6fb0cf'} },
    { id:'sh-103', cat:'shampoo', brand:'資生堂',   name:'サブリミック ドライシャンプー（水のいらない）150g',    price:1760, stock:'in', badge:null,      pop:64, added:60, same:true, ph:{shape:'bottle',tint:'#bcd3e6'} },

    /* ===== スタイリング剤（stylingType＝ワックス/クリーム/ジェル/スプレー/ポマード/バーム/フォーム/オイル） ===== */
    { id:'sy-1',  cat:'styling', brand:'ナカノ',   name:'スタイリング ワックス 5 ハード 90g',        price:990,  stock:'in', badge:'popular', pop:90, added:70, same:true, ph:{shape:'jar',    tint:'#c98a2a', label:'WAX'} },
    { id:'sy-2',  cat:'styling', brand:'アリミノ', name:'スパイス シャワー ワックス フリーズキープ 100g', price:1100, stock:'in', badge:null,  pop:82, added:62, same:true, ph:{shape:'jar',    tint:'#3a7d6b', label:'WAX'} },
    { id:'sy-3',  cat:'styling', brand:'ルベル',   name:'トリエ ジューシーワックス 5 50g',           price:1320, stock:'in', badge:null,      pop:74, added:56, same:true, ph:{shape:'jar',    tint:'#caa64a', label:'WAX'} },
    { id:'sy-4',  cat:'styling', brand:'アリミノ', name:'スパイス スーパーハード ジェル 200mL',      price:1210, stock:'in', badge:null,      pop:70, added:52, same:true, ph:{shape:'tube',   tint:'#2f6f8c', label:'GEL'} },
    { id:'sy-5',  cat:'styling', brand:'ナンバースリー', name:'デューサー ハードジェル 5 200g',     price:1430, stock:'in', badge:null,      pop:62, added:48, same:true, ph:{shape:'tube',   tint:'#356d8c', label:'GEL'} },
    { id:'sy-6',  cat:'styling', brand:'ルベル',   name:'トリエ スプレー 10（ハード）170g',          price:1540, stock:'in', badge:null,      pop:78, added:58, same:true, ph:{shape:'bottle', tint:'#6b7280', label:'SPRAY'} },
    { id:'sy-7',  cat:'styling', brand:'資生堂',   name:'ステージワークス ハードスプレー 250g',      price:1320, stock:'in', badge:null,      pop:66, added:50, same:true, ph:{shape:'bottle', tint:'#5b6473', label:'SPRAY'} },
    { id:'sy-8',  cat:'styling', brand:'阪本高生堂', name:'クールグリース G ポマード 210g',          price:1100, stock:'in', badge:'popular', pop:84, added:66, same:true, ph:{shape:'jar',    tint:'#2f5fa8', label:'POMADE'} },
    { id:'sy-9',  cat:'styling', brand:'阪本高生堂', name:'クックグリース XXX ポマード 210g',        price:1320, stock:'low', badge:'low',     pop:72, added:54, same:true, ph:{shape:'jar',    tint:'#1f4e8c', label:'POMADE'} },
    { id:'sy-10', cat:'styling', brand:'product', name:'ヘアワックス（ナチュラルバーム）42g',        price:2200, stock:'in', badge:null,      pop:76, added:64, same:true, ph:{shape:'jar',    tint:'#8a7a3a', label:'BALM'} },
    { id:'sy-11', cat:'styling', brand:'ミルボン', name:'ニゼル ジェリー ムース M 145g',            price:1980, stock:'in', badge:null,      pop:60, added:46, same:true, ph:{shape:'pump',   tint:'#7a6ea5', label:'FOAM'} },
    { id:'sy-12', cat:'styling', brand:'ナプラ',   name:'N. スタイリングクリーム 50g',              price:1980, stock:'in', badge:'popular', pop:86, added:72, same:true, ph:{shape:'tube',   tint:'#cfc6b0', label:'CREAM'} },

    /* ===== アウトバス追加（スプレー／クリーム＝オイル/エマルジョンは既存） ===== */
    { id:'ob-1', cat:'outbath', brand:'ミルボン', name:'エルジューダ サントリートメント セラム（ミスト）120mL', price:2640, stock:'in', badge:'popular', pop:88, added:76, same:true, ph:{shape:'bottle', tint:'#e3c1cf', label:'MIST'} },
    { id:'ob-2', cat:'outbath', brand:'ルベル',   name:'イオ エッセンス ミスト リーブイン 150mL',  price:1980, stock:'in', badge:null,      pop:70, added:58, same:true, ph:{shape:'bottle', tint:'#9ec4cf', label:'MIST'} },
    { id:'ob-3', cat:'outbath', brand:'ミルボン', name:'ジェミールフラン メルティバター クリーム 100g', price:2420, stock:'in', badge:null,    pop:72, added:60, same:true, ph:{shape:'jar',    tint:'#d8b48a', label:'CREAM'} },

    /* ===== 契約商品・メーカー発注サイトで発注（追加分。オージュア=sh-007/tr-001・ケラスターゼ=sh-008/tr-004 は上に既出） ===== */
    { id:'su-101', cat:'shampoo',   brand:'サブリミック',       name:'アクアインテンシブ シャンプー D 250mL',   price:2200, stock:'in', badge:null, pop:77, added:66, same:true, ph:{shape:'pump',   tint:'#9a2f3a'} },
    { id:'su-102', cat:'treatment', brand:'サブリミック',       name:'アクアインテンシブ トリートメント M 250g', price:2640, stock:'in', badge:null, pop:73, added:60, same:true, ph:{shape:'tube',   tint:'#7a2530'} },
    { id:'da-101', cat:'shampoo',   brand:'ダヴィネス',         name:'エッセンシャル モモ シャンプー 250mL',     price:3300, stock:'in', badge:null, pop:69, added:58, same:true, ph:{shape:'bottle', tint:'#2f6f5e'} },
    { id:'gm-101', cat:'treatment', brand:'グローバルミルボン', name:'スムージング トリートメント 200g',         price:4180, stock:'in', badge:null, pop:78, added:70, same:true, ph:{shape:'tube',   tint:'#1f6f8c'} },

    /* ===== 契約商品・菊池発注（契約後にSalonProで購入。トキオ=sh-002 は上のシャンプーに既出） ===== */
    { id:'ct-101', cat:'shampoo',   brand:'コタ',             name:'コタ アイケア シャンプー 9 300mL',     price:2860, stock:'in', badge:null, pop:84, added:74, same:true, ph:{shape:'pump',   tint:'#8a4a2f'} },
    { id:'ct-102', cat:'treatment', brand:'コタ',             name:'コタ アイケア トリートメント 9 200g',   price:3080, stock:'in', badge:null, pop:80, added:68, same:true, ph:{shape:'tube',   tint:'#7a3f28'} },
    { id:'bk-101', cat:'scalp',     brand:'バイカルテ',       name:'スキャルプ エッセンス 120mL',          price:4400, stock:'in', badge:null, pop:66, added:58, same:true, ph:{shape:'bottle', tint:'#4a5b7a'} },
    { id:'ar-101', cat:'treatment', brand:'アルタイムリペア', name:'リペアトリートメント 200g',            price:3520, stock:'in', badge:null, pop:70, added:62, same:true, ph:{shape:'jar',    tint:'#6e2f57'} },

    /* ===== ネイル（biz:['nail']／美容室会員には出さない） ===== */
    { id:'na-001', cat:'nail-gel',  brand:'プリジェル',   name:'プリジェル カラーEX ミルキー 4g',           price:1320, stock:'in',  badge:'popular', pop:88, added:80, same:true,  biz:['nail'], ph:{shape:'jar',    tint:'#d98aa0'} },
    { id:'na-002', cat:'nail-gel',  brand:'バイオジェル', name:'バイオスカルプチュア ベースジェル 15g',     price:3300, stock:'in',  badge:null,      pop:78, added:60, same:true,  biz:['nail'], ph:{shape:'bottle', tint:'#cfa6c4'} },
    { id:'na-003', cat:'nail-gel',  brand:'ジェリーネイル', name:'ノンワイプ トップジェル 14g',             price:1980, stock:'in',  badge:'new',     pop:72, added:95, same:true,  biz:['nail'], ph:{shape:'bottle', tint:'#b9a7d6'} },
    { id:'na-004', cat:'nail-care', brand:'ネイルパフェ', name:'ウォッシャブルファイル 180/240（10本）',    price:1100, stock:'in',  badge:null,      pop:60, added:40, same:true,  biz:['nail'], ph:{shape:'box',    tint:'#d8c0a0', label:'FILE'} },
    { id:'na-005', cat:'nail-care', brand:'ネイルパフェ', name:'ジェルクリーナー＆リムーバー 500mL',        price:1540, stock:'low', badge:'low',     pop:54, added:36, same:true,  biz:['nail'], ph:{shape:'pump',   tint:'#a6c4cf'} },

    /* ===== エステ（biz:['esthe']／美容室会員には出さない） ===== */
    { id:'es-001', cat:'es-face',   brand:'ビーエスコスメ',   name:'業務用 クレンジングジェル 500g',           price:2860, stock:'in', badge:'popular', pop:84, added:70, same:true,  biz:['esthe'], ph:{shape:'pump', tint:'#7fa6b0'} },
    { id:'es-002', cat:'es-face',   brand:'スキンサイエンス', name:'業務用 モイスチャーパック 1000g',          price:6600, stock:'in', badge:null,      pop:70, added:55, same:true,  biz:['esthe'], ph:{shape:'jar',  tint:'#cdbfae'} },
    { id:'es-003', cat:'es-body',   brand:'タカラベルモント', name:'スリミング マッサージジェル 1000g',        price:4400, stock:'in', badge:'new',     pop:66, added:90, same:true,  biz:['esthe'], ph:{shape:'pump', tint:'#9ab38c'} },
    { id:'es-004', cat:'es-body',   brand:'ビーエスコスメ',   name:'業務用 ボディトリートメントオイル 1000mL', price:3960, stock:'in', badge:null,      pop:58, added:48, same:true,  biz:['esthe'], ph:{shape:'bottle', tint:'#c2a878'} },

    /* ===== アイ（まつげ）biz:['eye']／美容師免許が必要・ヘア商材も取扱可 ===== */
    { id:'ey-001', cat:'eye-ext',  brand:'マツエクプロ',   name:'セーブルラッシュ Jカール 0.15 (12列)',       price:1980, stock:'in',  badge:'popular', pop:86, added:82, same:true, biz:['eye'], ph:{shape:'box',    tint:'#2b2b2e', label:'LASH J'} },
    { id:'ey-002', cat:'eye-ext',  brand:'マツエクプロ',   name:'フラットラッシュ Cカール 0.15 (12列)',       price:2200, stock:'in',  badge:null,      pop:80, added:70, same:true, biz:['eye'], ph:{shape:'box',    tint:'#3a3030', label:'LASH C'} },
    { id:'ey-003', cat:'eye-ext',  brand:'グルーラボ',     name:'プログレード グルー 5mL（速乾・低刺激）',     price:3300, stock:'in',  badge:'new',     pop:78, added:96, same:true, biz:['eye'], ph:{shape:'bottle', tint:'#1f2330'} },
    { id:'ey-004', cat:'eye-lift', brand:'ラッシュリフト', name:'ラッシュリフト ロッド＆ロッション セット',     price:4180, stock:'in',  badge:null,      pop:70, added:60, same:true, biz:['eye'], ph:{shape:'box',    tint:'#9a6e84', label:'LIFT'} },
    { id:'ey-005', cat:'eye-tool', brand:'アイツール',     name:'ツイーザー ストレート／I型 2本セット',         price:2640, stock:'in',  badge:null,      pop:62, added:48, same:true, biz:['eye'], ph:{shape:'box',    tint:'#9aa0a6', label:'TWEEZER'} },
    { id:'ey-006', cat:'eye-tool', brand:'アイケア',       name:'まつげ美容液 業務用 10mL',                   price:1760, stock:'low', badge:'low',     pop:58, added:44, same:true, biz:['eye'], ph:{shape:'bottle', tint:'#5a6e7a'} },

    /* ===== 共通 消耗品・備品（biz＝common：全業種で表示） ===== */
    { id:'sp-001', cat:'supply', brand:'共通', name:'業務用 フェイスタオル（12枚セット）',       price:2200, stock:'in', badge:null,      pop:64, added:50, same:true, biz:['common'], ph:{shape:'box',  tint:'#cdd2d8', label:'TOWEL'} },
    { id:'sp-002', cat:'supply', brand:'共通', name:'ニトリル手袋 パウダーフリー（100枚）',     price:990,  stock:'in', badge:'popular', pop:80, added:60, same:true, biz:['common'], ph:{shape:'box',  tint:'#6b7da0', label:'GLOVE'} },
    { id:'sp-003', cat:'supply', brand:'共通', name:'手指消毒用アルコール 1000mL',              price:1320, stock:'in', badge:null,      pop:58, added:45, same:true, biz:['common'], ph:{shape:'pump', tint:'#cfe0e6'} },
    { id:'sp-004', cat:'supply', brand:'共通', name:'コットン 業務用（660枚）',                 price:880,  stock:'in', badge:null,      pop:55, added:42, same:true, biz:['common'], ph:{shape:'box',  tint:'#e6e2d8', label:'COTTON'} },

    /* ===== 設備・什器（大型・機器／全業種・取寄せ多め） ===== */
    { id:'eq-001', cat:'equipment', brand:'タカラベルモント', name:'シャンプー台 ユニット（バックシャンプー）', price:528000, stock:'order', badge:null, pop:70, added:55, same:false, biz:['common'], ph:{shape:'box', tint:'#5b6473', label:'SHAMPOO'} },
    { id:'eq-002', cat:'equipment', brand:'タカラベルモント', name:'セットチェア（油圧式）',                 price:132000, stock:'order', badge:null, pop:74, added:52, same:false, biz:['common'], ph:{shape:'box', tint:'#3a3030', label:'CHAIR'} },
    { id:'eq-003', cat:'equipment', brand:'共通',           name:'スタイリングワゴン 5段',                  price:18700,  stock:'in',    badge:null, pop:66, added:48, same:true,  biz:['common'], ph:{shape:'box', tint:'#9aa0a6', label:'WAGON'} },
    { id:'eq-004', cat:'equipment', brand:'共通',           name:'ヘアスチーマー（ロボット型）',             price:198000, stock:'order', badge:null, pop:60, added:46, same:false, biz:['common'], ph:{shape:'box', tint:'#7d8fa6', label:'STEAMER'} },
    { id:'eq-005', cat:'equipment', brand:'共通',           name:'ミラー付きセット面（W900）',               price:96800,  stock:'order', badge:null, pop:58, added:44, same:false, biz:['common'], ph:{shape:'box', tint:'#cdd2d8', label:'MIRROR'} },
    { id:'eq-006', cat:'equipment', brand:'共通',           name:'タオルウォーマー 18L',                    price:24200,  stock:'in',    badge:null, pop:62, added:50, same:true,  biz:['common'], ph:{shape:'box', tint:'#b9a78a', label:'WARMER'} },

    /* ===== 業界誌・書籍（mag:true＝定期購読サブスク対応／subは月額。booksは単発） =====
       ※ 誌名・出版社・価格はプロトタイプの仮置き（要確認・差し替え可）。 */
    { id:'bk-preppy',   cat:'book', brand:'女性モード社',   name:'PREPPY（プレッピー）',           price:1500, mag:true, cycle:'月刊',  sub:1400, stock:'in', badge:'popular', pop:96, added:90, same:false, biz:['hair','eye'],          ph:{shape:'box', tint:'#1f4e8c', label:'PREPPY'} },
    { id:'bk-shinbiyo', cat:'book', brand:'新美容出版',     name:'SHINBIYO（新美容）',             price:1600, mag:true, cycle:'月刊',  sub:1500, stock:'in', badge:null,      pop:90, added:84, same:false, biz:['hair'],                ph:{shape:'box', tint:'#6e2f57', label:'新美容'} },
    { id:'bk-hairmode', cat:'book', brand:'女性モード社',   name:'HAIR MODE（ヘアモード）',        price:1500, mag:true, cycle:'月刊',  sub:1400, stock:'in', badge:null,      pop:84, added:80, same:false, biz:['hair'],                ph:{shape:'box', tint:'#3a3030', label:'HAIR MODE'} },
    { id:'bk-keiei',    cat:'book', brand:'女性モード社',   name:'BeautyTHROUGH 美容と経営',       price:1400, mag:true, cycle:'月刊',  sub:1300, stock:'in', badge:'new',     pop:80, added:95, same:false, biz:['hair','nail','esthe'], ph:{shape:'box', tint:'#1f6f8c', label:'美容と経営'} },
    { id:'bk-nailmax',  cat:'book', brand:'ライブ',         name:'NAIL MAX（ネイルマックス）',     price:1200, mag:true, cycle:'隔月刊', sub:1100, stock:'in', badge:null,      pop:78, added:70, same:false, biz:['nail'],                ph:{shape:'box', tint:'#cf7a93', label:'NAIL MAX'} },
    { id:'bk-nailvenus',cat:'book', brand:'ネイルヴィーナス社', name:'NAIL VENUS（ネイルヴィーナス）', price:1500, mag:true, cycle:'季刊',  sub:1400, stock:'in', badge:null,      pop:70, added:64, same:false, biz:['nail'],                ph:{shape:'box', tint:'#9a4f9e', label:'NAIL VENUS'} },
    { id:'bk-esthe',    cat:'book', brand:'BABジャパン',    name:'エステティック通信',             price:1500, mag:true, cycle:'月刊',  sub:1400, stock:'in', badge:null,      pop:66, added:60, same:false, biz:['esthe'],               ph:{shape:'box', tint:'#1f7a5a', label:'エステ通信'} },
    /* --- 技術書・テキスト（単発購入） --- */
    { id:'bk-cut',      cat:'book', brand:'女性モード社',   name:'最新ベーシックカット理論 改訂版', price:3960, mag:false, stock:'in', badge:null, pop:74, added:58, same:false, biz:['hair'],  ph:{shape:'box', tint:'#5b6473', label:'CUT'} },
    { id:'bk-color',    cat:'book', brand:'新美容出版',     name:'カラーデザイン大全',             price:4400, mag:false, stock:'in', badge:null, pop:72, added:56, same:false, biz:['hair'],  ph:{shape:'box', tint:'#8b6a2c', label:'COLOR'} },
    { id:'bk-nailtext', cat:'book', brand:'ライブ',         name:'ネイリスト技能検定 公式テキスト',  price:3300, mag:false, stock:'in', badge:null, pop:64, added:50, same:false, biz:['nail'],  ph:{shape:'box', tint:'#cf7a93', label:'NAIL'} },
    { id:'bk-mgmt',     cat:'book', brand:'BABジャパン',    name:'サロン経営の教科書',             price:1980, mag:false, stock:'in', badge:null, pop:68, added:62, same:false, biz:['hair','nail','esthe'], ph:{shape:'box', tint:'#3a3030', label:'経営'} },

    /* ===== ホームのおすすめ用（cat:'_rec' はカテゴリ一覧に出ない／カート集計用）===== */
    { id:'rec-1', cat:'_rec', brand:'oggi otto', name:'セラム CMC ミスト 200ml',                 price:3630, stock:'in', badge:null, pop:0, added:0, same:true, ph:{shape:'bottle', tint:'#3a3030'} },
    { id:'rec-2', cat:'_rec', brand:'ルベル',     name:'イオ クレンジング リラックスメント 600ml', price:3520, stock:'in', badge:null, pop:0, added:0, same:true, ph:{shape:'pump',   tint:'#c0392b'} },
    { id:'rec-3', cat:'_rec', brand:'ナプラ',     name:'N. エヌドット ポリッシュオイル 150ml',     price:3740, stock:'in', badge:null, pop:0, added:0, same:true, ph:{shape:'bottle', tint:'#cfcfd6'} },
    { id:'rec-4', cat:'_rec', brand:'ミルボン',   name:'ディーセス エルジューダ エマルジョン+ 120g', price:2860, stock:'in', badge:null, pop:0, added:0, same:true, ph:{shape:'tube',   tint:'#2b2b2e'} },
  ];

  /* ===== カラー剤を「ライン×色×明るさ」で生成（ミルボン › アディクシー › サファイア › 各明るさ）===== */
  const COLOR_LINES = [
    // アルカリ（おしゃれ染め／ファッションカラー）
    { line: 'アディクシー', maker: 'ミルボン', type: 'alkaline', families: [
      { family: 'サファイア', tint: '#1f4e8c', levels: [3, 5, 7, 9, 11] },
      { family: 'アメジスト', tint: '#7a4f9e', levels: [5, 7, 9, 11] },
      { family: 'エメラルド', tint: '#1f7a5a', levels: [5, 7, 9, 11] },
      { family: 'シルバー', tint: '#9aa0a6', levels: [5, 7, 9, 11, 13] },
      { family: 'パープルガーネット', tint: '#6e2f57', levels: [5, 7, 9] },
      { family: 'グレーパール', tint: '#8f9398', levels: [7, 9, 11] },
    ] },
    { line: 'オルディーブ', maker: 'ミルボン', type: 'alkaline', families: [
      { family: 'ベージュ', tint: '#b9a78a', levels: [6, 8, 10] },
      { family: 'アッシュ', tint: '#6b7280', levels: [6, 8, 10] },
      { family: 'ピンク', tint: '#cf7a93', levels: [8, 10, 12] },
    ] },
    // アリミノのファッションカラー。美容師は「アリミノのアドミオ」と呼ぶ（カラーストーリー＝シリーズ名は知らない人も多い）→ line＝アドミオ で メーカー直下に。
    { line: 'アドミオ', maker: 'アリミノ', type: 'alkaline', families: [
      { family: 'アッシュ', tint: '#6b7280', levels: [5, 7, 9, 11] },
      { family: 'マットアッシュ', tint: '#6f7350', levels: [7, 9, 11] },
      { family: 'ベージュ', tint: '#b9a78a', levels: [7, 9, 11] },
      { family: 'グレージュ', tint: '#9a8a78', levels: [7, 9, 11] },
      { family: 'ピンク', tint: '#cf7a93', levels: [8, 10, 12] },
    ] },
    { line: 'プロマスターEX', maker: 'ホーユー', type: 'alkaline', families: [
      { family: 'クールブルー', tint: '#356d8c', levels: [5, 7, 9] },
      { family: 'ウォームブラウン', tint: '#8a5a2f', levels: [5, 7, 9] },
    ] },
    // 白髪染め（グレイカラー）
    { line: 'オルディーブ ボーテ', maker: 'ミルボン', type: 'gray', families: [
      { family: 'ナチュラルブラウン', tint: '#6b4f3a', levels: [5, 7, 9] },
      { family: 'ピンクブラウン', tint: '#8a5560', levels: [5, 7, 9] },
      { family: 'アッシュベージュ', tint: '#8b7d6b', levels: [6, 8, 10] },
    ] },
    { line: 'プロマスターEX グレイ', maker: 'ホーユー', type: 'gray', families: [
      { family: 'ナチュラル', tint: '#5b4a3a', levels: [4, 6, 8] },
      { family: 'ベージュ', tint: '#9a8a6f', levels: [6, 8, 10] },
      { family: 'オリーブ', tint: '#6f7350', levels: [5, 7, 9] },
    ] },
  ];
  // 色味グループ（ブランド跨ぎの「色味×明るさ」横断検索用）。各社の色名を共通トーンに正規化。
  const TONE_MAP = {
    'サファイア': 'ブルー', 'クールブルー': 'ブルー',
    'アッシュ': 'アッシュ', 'アッシュベージュ': 'ベージュ',
    'アメジスト': 'バイオレット', 'パープルガーネット': 'バイオレット',
    'シルバー': 'グレー', 'グレーパール': 'グレー',
    'エメラルド': 'マット', 'オリーブ': 'マット',
    'ベージュ': 'ベージュ',
    'ピンク': 'ピンク', 'ピンクブラウン': 'ピンク',
    'ウォームブラウン': 'ブラウン', 'ナチュラルブラウン': 'ブラウン', 'ナチュラル': 'ブラウン',
  };
  (function () {
    var n = 0;
    COLOR_LINES.forEach(function (L) {
      L.families.forEach(function (F) {
        F.levels.forEach(function (lv) {
          n++;
          products.push({
            id: 'co-' + n, cat: 'color', colorType: L.type || 'alkaline', tone: TONE_MAP[F.family] || 'その他',
            brand: L.line, maker: L.maker, line: L.line, family: F.family, level: lv,
            name: L.line + ' ' + F.family + ' ' + lv, price: 1210, stock: 'in', badge: null,
            pop: 90 - n, added: 60 - n, same: true, senbai: true,
            ph: { shape: 'box', tint: F.tint, label: F.family + ' ' + lv },
          });
        });
      });
    });
  })();
  // 色味×明るさ 横断検索の選択肢（チップ表示順）
  const COLOR_TONES = ['アッシュ', 'ブルー', 'バイオレット', 'グレー', 'マット', 'ベージュ', 'ブラウン', 'ピンク'];
  const COLOR_LEVELS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

  // 業種の既定はヘア（美容室）。美容室専売品（プレステージ系）に senbai フラグ。
  const SENBAI = ['sh-001', 'sh-007', 'sh-008', 'tr-001', 'tr-004'];

  /* =========================================================
     契約ブランド（契約しないと購入できない特殊商品）
     菊地の強み＝契約ブランドの多さ。サロンが「契約一覧」に持つブランドの商品が出る。
     mode＝発注のしかた：
       direct … 契約商品・メーカー発注サイトでのみ発注（菊地では発注不可・外部誘導）
       online … 契約商品・菊池発注（オンライン契約→以降は菊池=SalonProで購入）
       apply  … オンライン不可・申込→菊地担当者より連絡（連絡待ち。※コードは保持・現状未使用）
     ※ メーカー名・説明・キット費用・発注URLはプロトタイプの仮置きです（要確認・差し替え可）。
     ========================================================= */
  const CONTRACT_BRANDS = [
    /* --- 契約商品・メーカー発注サイトでのみ発注（菊地では発注できない） --- */
    {
      id: 'aujua', brand: 'オージュア', maker: 'ミルボン', mode: 'direct', fee: 0, accent: '#1f4e8c',
      orderUrl: 'https://order.example-maker.jp/aujua',
      tagline: '一人ひとりの髪悩みに応える、日本生まれのオーダーメイド ヘアケア。',
      lead: '認定サロン専用のプレステージライン。ご契約・ご発注はメーカーの専用発注サイトから行います。菊地は導入相談・研修・運用をサポートします。',
      points: [
        { t: 'オーダーメイド設計', s: '悩み別ラインを組み合わせ、サロン独自のケアメニューを構築できます。' },
        { t: '高い店販単価', s: 'プレステージ価格帯で店販売上と利益率を底上げします。' },
        { t: '認定サロンの信頼', s: '研修・認定を経た取扱いで、顧客への提案力と信頼につながります。' },
      ],
      specs: [
        ['契約区分', '認定サロン契約'],
        ['ご発注', 'メーカー発注サイト（菊地では発注不可）'],
        ['初期費用', 'メーカー規定による'],
        ['対象業種', 'ヘア（美容室）／アイサロン'],
      ],
    },
    {
      id: 'globalmilbon', brand: 'グローバルミルボン', maker: 'ミルボン', mode: 'direct', fee: 0, accent: '#1f6f8c',
      orderUrl: 'https://order.example-maker.jp/global-milbon',
      tagline: '世界基準の品質を、サロンから。ミルボンのグローバルライン。',
      lead: '海外市場でも展開するミルボンのグローバルブランド。ご発注はメーカーの専用発注サイトから。菊地が導入・運用をサポートします。',
      points: [
        { t: '世界基準の品質', s: 'グローバル展開の確かな処方で満足度が高まります。' },
        { t: 'ブランド力', s: '世界基準の安心感が提案力につながります。' },
        { t: '店販の軸', s: 'プレミアム価格帯で店販単価を底上げします。' },
      ],
      specs: [
        ['契約区分', '取扱い契約'],
        ['ご発注', 'メーカー発注サイト（菊地では発注不可）'],
        ['初期費用', 'メーカー規定による'],
        ['対象業種', 'ヘア（美容室）'],
      ],
    },
    {
      id: 'sublimic', brand: 'サブリミック', maker: '資生堂プロフェッショナル', mode: 'direct', fee: 0, accent: '#9a2f3a',
      orderUrl: 'https://order.example-maker.jp/sublimic',
      tagline: 'カウンセリングで仕上げる、サロン発想のカスタムヘアケア。',
      lead: '悩み別に処方を選定するサロン専売ライン。ご発注はメーカーの専用発注サイトから。菊地が導入・研修をサポートします。',
      points: [
        { t: 'カスタム提案', s: '悩み別の処方で、サロンならではのケアを提案できます。' },
        { t: '安定した供給', s: '大手メーカーの安定供給で欠品リスクを抑えられます。' },
        { t: '研修サポート', s: '導入時の研修で、スタッフ全員が提案できる体制に。' },
      ],
      specs: [
        ['契約区分', '取扱い登録'],
        ['ご発注', 'メーカー発注サイト（菊地では発注不可）'],
        ['初期費用', 'メーカー規定による'],
        ['対象業種', 'ヘア（美容室）'],
      ],
    },
    {
      id: 'kerastase', brand: 'ケラスターゼ', maker: 'ロレアル プロフェッショナル', mode: 'direct', fee: 0, accent: '#8a6d2f',
      orderUrl: 'https://order.example-maker.jp/kerastase',
      tagline: 'サロン体験を自宅へ。世界が認めるラグジュアリー ヘアケア。',
      lead: 'サロン施術と連動するプレステージライン。ご発注はメーカーの専用発注サイトから。菊地が導入をサポートします。',
      points: [
        { t: 'ラグジュアリー体験', s: '香り・質感・パッケージまで含めたブランド体験を提供できます。' },
        { t: '施術と店販の連動', s: 'サロンメニューとホームケアを一気通貫で提案できます。' },
        { t: 'ブランド集客力', s: '世界的ブランドの認知が新規顧客の来店動機になります。' },
      ],
      specs: [
        ['契約区分', '正規取扱店契約'],
        ['ご発注', 'メーカー発注サイト（菊地では発注不可）'],
        ['初期費用', 'メーカー規定による'],
        ['対象業種', 'ヘア（美容室）'],
      ],
    },
    {
      id: 'davines', brand: 'ダヴィネス', maker: 'Davines', mode: 'direct', fee: 0, accent: '#2f6f5e',
      orderUrl: 'https://order.example-maker.jp/davines',
      tagline: 'サステナビリティと美を両立する、イタリア発のプレミアム。',
      lead: '世界観・什器まで含めて選定される流通ブランド。ご発注はメーカーの専用発注サイトから。菊地が導入・審査をサポートします。',
      points: [
        { t: 'ブランド世界観', s: 'デザイン性の高い什器で店内の世界観を高めます。' },
        { t: '感度の高い客層', s: 'サステナ志向の新規顧客の獲得につながります。' },
        { t: '高付加価値', s: 'プレミアム価格帯で客単価アップが見込めます。' },
      ],
      specs: [
        ['契約区分', '選定流通・取扱い審査'],
        ['ご発注', 'メーカー発注サイト（菊地では発注不可）'],
        ['初期費用', 'メーカー規定による'],
        ['対象業種', 'ヘア（美容室）'],
      ],
    },
    /* --- 契約商品・菊池発注（オンライン契約→以降は菊池=SalonProで購入） --- */
    {
      id: 'baikarute', brand: 'バイカルテ', maker: 'バイカルテ', mode: 'online', fee: 22000, accent: '#4a5b7a',
      tagline: '頭皮から整える、サロン発想のスキャルプケア。',
      lead: '菊地と契約後は、菊地（SalonPro）から通常商品と同じくご発注いただけます。導入研修・運用も菊地がサポートします。',
      points: [
        { t: '頭皮ケア訴求', s: 'スキャルプ需要に応え、客単価アップにつながります。' },
        { t: '菊地発注で安心', s: '契約後は使い慣れた菊地のサイトから発注できます。' },
        { t: '導入サポート', s: '研修・販促物まで菊地がサポートします。' },
      ],
      specs: [
        ['契約区分', '取扱い契約（菊地）'],
        ['ご発注', '菊地（SalonPro）'],
        ['契約キット', '複数プラン（¥16,500〜）'],
        ['対象業種', 'ヘア（美容室）'],
      ],
      kits: [
        { id: 'starter', name: 'スターターキット', price: 16500, tagline: 'まずは試したいサロンに', contents: ['バイカルテ 主要商品 各1点', '頭皮ケア サンプル 5個', 'オンライン研修 1回'] },
        { id: 'standard', name: 'スタンダードキット', price: 27500, badge: '人気No.1', value: 'サンプル・販促物込みで実質お得', tagline: '導入から定着までフルサポート', contents: ['主要商品 各2点', '店販用サンプル 20個', '店頭POP・メニュー表 一式', '来店研修1回＋オンライン', '初回販促サポート'] },
        { id: 'premium', name: 'プレミアムキット', price: 44000, tagline: '本格展開・複数スタッフ向け', contents: ['主要商品 各4点', 'サンプル 50個', '什器・ディスプレイ一式', '研修 無制限（3ヶ月）', '専任担当の販促コンサル'] },
      ],
    },
    {
      id: 'cota', brand: 'コタ', maker: 'コタ', mode: 'online', fee: 33000, accent: '#8a4a2f',
      tagline: '一貫したブランド体験で、サロンのファンをつくる。',
      lead: 'コタ アイ ケアなどで知られるブランド。菊地と契約後は、菊地（SalonPro）から通常商品と同じくご発注いただけます。',
      points: [
        { t: 'ブランドの一貫性', s: '香り・世界観の統一でファン化を促します。' },
        { t: '高いリピート', s: '指名買いされやすく、店販が安定します。' },
        { t: '菊地発注で安心', s: '契約後は菊地のサイトからスムーズに発注できます。' },
      ],
      specs: [
        ['契約区分', '取扱い契約（菊地）'],
        ['ご発注', '菊地（SalonPro）'],
        ['契約キット', '複数プラン（¥22,000〜）'],
        ['対象業種', 'ヘア（美容室）'],
      ],
      kits: [
        { id: 'starter', name: 'スターターキット', price: 22000, tagline: 'まずは試したいサロンに', contents: ['コタ 主要商品 各1点', '香り体験サンプル 5個', 'オンライン研修 1回'] },
        { id: 'standard', name: 'スタンダードキット', price: 38500, badge: '人気No.1', value: '香り体験サンプル・什器込みで実質お得', tagline: 'ブランド体験まで含めて定着', contents: ['主要商品 各2点', '香り体験サンプル 20個', '店頭POP・什器ミニ', '来店研修1回＋オンライン', '初回販促サポート'] },
        { id: 'premium', name: 'プレミアムキット', price: 60500, tagline: '本格展開・複数スタッフ向け', contents: ['主要商品 各4点', 'サンプル 50個', 'ブランド什器一式', '研修 無制限（3ヶ月）', '専任担当の販促コンサル'] },
      ],
    },
    {
      id: 'tokio', brand: 'トキオ', maker: 'TOKIO', mode: 'online', fee: 27500, accent: '#2b2b2e',
      tagline: '話題のインカラミ技術。サロンの差別化メニューに。',
      lead: 'TOKIO IE インカラミで知られるブランド。菊地と契約後は、菊地（SalonPro）から通常商品と同じくご発注いただけます。',
      points: [
        { t: '差別化メニュー', s: '話題性のある技術で集客のフックになります。' },
        { t: '高い話題性', s: 'SNS等で話題になりやすく新規につながります。' },
        { t: '菊地発注で安心', s: '契約後は菊地のサイトから発注できます。' },
      ],
      specs: [
        ['契約区分', '取扱い契約（菊地）'],
        ['ご発注', '菊地（SalonPro）'],
        ['契約キット', '複数プラン（¥19,800〜）'],
        ['対象業種', 'ヘア（美容室）'],
      ],
      kits: [
        { id: 'starter', name: 'スターターキット', price: 19800, tagline: 'まずは話題の技術を体験', contents: ['トキオ 主要商品 各1点', 'インカラミ体験サンプル 5個', 'オンライン研修 1回'] },
        { id: 'standard', name: 'スタンダードキット', price: 33000, badge: '人気No.1', value: 'インカラミ体験キット込みでお得', tagline: '差別化メニューの導入に最適', contents: ['主要商品 各2点', '体験サンプル 20個', '店頭POP・メニュー表', '来店研修1回＋オンライン', 'SNS販促サポート'] },
        { id: 'premium', name: 'プレミアムキット', price: 49500, tagline: '本格展開・複数スタッフ向け', contents: ['主要商品 各4点', 'サンプル 50個', '什器・ディスプレイ一式', '研修 無制限（3ヶ月）', '専任担当の販促コンサル'] },
      ],
    },
    {
      id: 'altimerepair', brand: 'アルタイムリペア', maker: 'アルタイムリペア', mode: 'online', fee: 19800, accent: '#6e2f57',
      tagline: '時短と仕上がりを両立する、次世代リペアトリートメント。',
      lead: '菊地と契約後は、菊地（SalonPro）から通常商品と同じくご発注いただけます。回転率の高いサロンにおすすめです。',
      points: [
        { t: '時短施術', s: '短時間で高い仕上がり。回転率アップに貢献します。' },
        { t: '高い満足度', s: '仕上がりの実感がリピートにつながります。' },
        { t: '菊地発注で安心', s: '契約後は菊地のサイトから発注できます。' },
      ],
      specs: [
        ['契約区分', '取扱い契約（菊地）'],
        ['ご発注', '菊地（SalonPro）'],
        ['契約キット', '複数プラン（¥14,300〜）'],
        ['対象業種', 'ヘア（美容室）'],
      ],
      kits: [
        { id: 'starter', name: 'スターターキット', price: 14300, tagline: 'まずは時短メニューを試す', contents: ['アルタイムリペア 主要商品 各1点', '体験サンプル 5個', 'オンライン研修 1回'] },
        { id: 'standard', name: 'スタンダードキット', price: 24200, badge: '人気No.1', value: '時短メニュー販促物込みでお得', tagline: '回転率アップまでフルサポート', contents: ['主要商品 各2点', 'サンプル 20個', '店頭POP・メニュー表', '来店研修1回＋オンライン', '初回販促サポート'] },
        { id: 'premium', name: 'プレミアムキット', price: 38500, tagline: '本格展開・複数スタッフ向け', contents: ['主要商品 各4点', 'サンプル 50個', '什器・ディスプレイ一式', '研修 無制限（3ヶ月）', '専任担当の販促コンサル'] },
      ],
    },
  ];
  const CB_BY_BRAND = {};
  CONTRACT_BRANDS.forEach(b => { CB_BY_BRAND[b.brand] = b.id; });

  /* メーカー発注ブランドの「契約申し込みフォーム」規定（ブランドごとに異なる。共通項目＋ブランド別の追加項目/写真/同意事項）。
     ※ 菊地がメーカーと契約締結するため、サロン情報・写真の審査が必要。 */
  const APPLY_FORMS = {
    aujua: {
      note: '認定サロン制のため、サロン情報の審査後に菊地が契約手続きを行います。',
      requirements: ['オージュアソムリエ認定講習の受講に同意します', 'ブランド指定のカウンセリング・陳列スペースを確保できます'],
      extraFields: [{ key: 'menu', label: '導入予定のオージュアメニュー・想定提案数/月', type: 'textarea', required: false }],
      extraPhotos: [{ key: 'shelf', label: '陳列・カウンセリング予定スペースの写真', required: true }],
    },
    globalmilbon: {
      note: 'グローバル基準の取扱い審査があります。サロン情報を確認のうえ契約します。',
      requirements: ['グローバルミルボン取扱い基準に同意します'],
      extraFields: [{ key: 'target', label: '主な客層・想定販売数/月', type: 'text', required: false }],
      extraPhotos: [],
    },
    sublimic: {
      note: '販売店経由の取扱い登録です。サロン情報を確認のうえ手続きします。',
      requirements: ['資生堂プロフェッショナル取扱い規約に同意します'],
      extraFields: [],
      extraPhotos: [],
    },
    kerastase: {
      note: 'ブランド什器の設置と正規取扱い基準の審査があります。',
      requirements: ['ブランド什器の設置スペースを確保できます', '正規取扱い基準に同意します'],
      extraFields: [],
      extraPhotos: [{ key: 'corner', label: 'ブランドコーナー設置予定場所の写真', required: true }],
    },
    davines: {
      note: '世界観・内装を含む選定流通の審査があります。',
      requirements: ['サステナビリティ方針に共感し体現します', '選定流通基準の審査に同意します'],
      extraFields: [{ key: 'concept', label: 'サロンのコンセプト・サステナ方針', type: 'textarea', required: true }],
      extraPhotos: [{ key: 'interior2', label: '内装・世界観が分かる写真', required: true }],
    },
  };
  CONTRACT_BRANDS.forEach(b => { if (APPLY_FORMS[b.id]) b.applyForm = APPLY_FORMS[b.id]; });

  // 菊池 実商品カタログ（catalog.js）を取込（data.js より前に読込まれていれば）。画像は後でメーカー支給に差替。
  if (window.SP_RAW_CATALOG) {
    (window.SP_RAW_CATALOG.newCategories || []).forEach(c => { if (!categories.find(x => x.id === c.id)) categories.push(c); });
    (window.SP_RAW_CATALOG.products || []).forEach(p => products.push(p));
  }

  /* =========================================================
     マルチディーラー（中立マーケットプレイス）デモ用データ
     ・dealer: 'cosmo' = 出店ディーラー「コスモ（全国）」。未指定は 'kikuchi'。
     ・jan 一致＝菊地とコスモで同一商品 → 先契約（このサロン＝菊地）を表示、後発コスモは既定非表示（全表示モードで両方表示）。
     ※ サンプルです（実際の取扱い・価格・JANは要差し替え）。
     ========================================================= */
  const KIKUCHI_OVERLAP = [
    { id:'kov-1', cat:'outbath', brand:'ナプラ',   name:'N. ポリッシュオイル 150mL',      price:2860, stock:'in', badge:'popular', pop:90, added:70, same:true, ph:{shape:'bottle', tint:'#caa64a'}, jan:'JAN-NP150' },
    { id:'kov-2', cat:'outbath', brand:'ミルボン', name:'エルジューダ エマルジョン+ 120g', price:2640, stock:'in', badge:null,      pop:85, added:66, same:true, ph:{shape:'tube',   tint:'#e3c1cf'}, jan:'JAN-ELEM' },
  ];
  const COSMO_PRODUCTS = [
    { id:'cov-1', cat:'outbath',   brand:'ナプラ',         name:'N. ポリッシュオイル 150mL',           price:2970, stock:'in', badge:null,      pop:88, added:64, same:true, ph:{shape:'bottle', tint:'#caa64a'}, jan:'JAN-NP150', dealer:'cosmo' },
    { id:'cov-2', cat:'outbath',   brand:'ミルボン',       name:'エルジューダ エマルジョン+ 120g',      price:2480, stock:'in', badge:null,      pop:84, added:62, same:true, ph:{shape:'tube',   tint:'#e3c1cf'}, jan:'JAN-ELEM', dealer:'cosmo' },
    { id:'cos-1', cat:'outbath',   brand:'モロッカンオイル', name:'モロッカンオイル トリートメント 100mL', price:4180, stock:'in', badge:'popular', pop:95, added:80, same:true, ph:{shape:'bottle', tint:'#b9923f'}, dealer:'cosmo' },
    { id:'cos-2', cat:'shampoo',   brand:'シュワルツコフ', name:'BC クア カラーセーブ シャンプー 1000mL', price:4400, stock:'in', badge:null,      pop:78, added:58, same:true, ph:{shape:'pump',   tint:'#1f2d4d'}, dealer:'cosmo' },
    { id:'cos-3', cat:'treatment', brand:'ウエラ',         name:'インヴィゴ カラーブリリアンス マスク 500mL', price:3960, stock:'in', badge:null,  pop:74, added:54, same:true, ph:{shape:'tube',   tint:'#6b4f8a'}, dealer:'cosmo' },
    { id:'cos-4', cat:'styling',   brand:'ナンバースリー', name:'フォーム デザインスプレー 180g',       price:1650, stock:'in', badge:null,      pop:66, added:50, same:true, ph:{shape:'bottle', tint:'#3a7d6b'}, dealer:'cosmo' },
    { id:'cos-5', cat:'color', colorType:'oxy',    brand:'ウエラ',         name:'ウエロキシド 6%（2剤）1000mL',         price:990,  stock:'in', badge:null,      pop:70, added:48, same:true, ph:{shape:'pouch',  tint:'#cdd2da'}, dealer:'cosmo' },
    { id:'cos-6', cat:'supply',    brand:'コスモ',         name:'業務用 カラーボウル（5個セット）',      price:1320, stock:'in', badge:null,      pop:60, added:44, same:true, ph:{shape:'box',    tint:'#9aa0a8'}, biz:['common'], dealer:'cosmo' },
  ];
  KIKUCHI_OVERLAP.forEach(p => products.push(p));
  COSMO_PRODUCTS.forEach(p => products.push(p));

  products.forEach(p => {
    if (!p.biz) p.biz = ['hair'];
    if (!p.dealer) p.dealer = 'kikuchi'; // 既定の取扱ディーラー（マルチディーラー対応）
    if (SENBAI.indexOf(p.id) >= 0) p.senbai = true;
    // 契約ブランドの商品は契約フラグを付与（一覧では契約済みのときだけ表示）
    if (CB_BY_BRAND[p.brand] && p.cat !== '_rec') p.contract = CB_BY_BRAND[p.brand];
    // 設備・什器（大型機器）はリース申込の対象（年利3〜5%・申込でディーラーに通知）
    if (p.cat === 'equipment') p.lease = true;
    // タイプ・チップ用の自動分類（明示指定が無い既存商品を商品名から推定）
    const _n = p.name || '';
    if (p.cat === 'shampoo' && !p.shampooType) {
      p.shampooType =
        /炭酸|スパークリング|フィズ|fizz/i.test(_n) ? 'carbonated' :
        /ドライシャンプー|水のいらない/.test(_n) ? 'dry' :
        /スキャルプ|スカルプ|頭皮|クリアスパ/.test(_n) ? 'scalp' :
        /カラーケア|カラーセーブ|ムラサキ|パープル|purple/i.test(_n) ? 'colorcare' : 'normal';
    }
    // 容量（サイズ）バケットを商品名から推定（タイプ×サイズの掛け合わせ用・全カテゴリ）
    if (!p.sizeBucket) {
      let vol = 0, mm; const re = /(\d+(?:\.\d+)?)\s*(mL|ml|ＭＬ|kg|g|ｇ|L|l)/g;
      while ((mm = re.exec(_n))) {
        let num = parseFloat(mm[1]); const u = mm[2].toLowerCase();
        if (u === 'kg' || u === 'l') num *= 1000;
        if (num > vol) vol = num;
      }
      if (vol > 0) p.sizeBucket = vol < 300 ? 's1' : vol < 600 ? 's2' : vol < 1000 ? 's3' : 's4';
    }
    if (p.cat === 'treatment' && !p.treatmentType) {
      p.treatmentType = /マスク|mask/i.test(_n) ? 'mask' : 'treatment';
    }
    if (p.cat === 'outbath' && !p.outbathType) {
      p.outbathType =
        /ミスト|スプレー|spray/i.test(_n) ? 'spray' :
        /ミルク|エマルジョン|emulsion/i.test(_n) ? 'emulsion' :
        /クリーム|バーム|balm/i.test(_n) ? 'cream' :
        /オイル|oil/i.test(_n) ? 'oil' : 'oil';
    }
    if (p.cat === 'styling' && !p.stylingType) {
      p.stylingType =
        /ワックス|wax/i.test(_n) ? 'wax' :
        /ジェル|ジェリー|gel/i.test(_n) ? 'gel' :
        /スプレー|spray/i.test(_n) ? 'spray' :
        /ポマード|グリース|pomade/i.test(_n) ? 'pomade' :
        /バーム|balm/i.test(_n) ? 'balm' :
        /ムース|フォーム|foam|mousse/i.test(_n) ? 'foam' :
        /オイル|oil/i.test(_n) ? 'oil' :
        /クリーム|cream/i.test(_n) ? 'cream' : 'wax';
    }
  });

  /* =========================================================
     セミナー／イベント（菊地が宣伝したい目玉。日時固定のライブ・会場ものを優先表示）
     kind: live（オンライン生配信）/ venue（会場）/ archive（録画・いつでも）
     ※ 日付・講師・定員はプロトタイプのサンプルです（要差し替え）。
     ========================================================= */
  const SEMINARS = [
    {
      id: 'sem-1', featured: true, kind: 'live', tag: 'ライブ配信', tcls: 'live',
      title: '2026夏の最新トレンドカラー実践セミナー', host: 'ALBUM OCE 監修',
      date: '2026-07-03', dow: '木', time: '19:00–20:30', fee: '参加無料', seats: '残席わずか',
      place: 'オンライン生配信（見逃し配信あり）', img: 'cat_kyoiku.jpg',
      lead: '夏に向けた最新トレンドカラーを、現役トップスタイリストがライブで実演。チャットで質疑応答もできます。',
    },
    {
      id: 'sem-2', kind: 'venue', tag: '会場セミナー', tcls: 'venue',
      title: '札幌会場｜ブリーチワーク実技講習（少人数）', host: '菊地 教育チーム',
      date: '2026-06-28', dow: '日', time: '13:00–17:00', fee: '¥5,500', seats: '残り3席',
      place: '菊地 本社セミナールーム（札幌）', img: 'people.png',
      lead: 'モデル実技中心で学ぶ少人数制の実技講習。お一人ずつ講師がフォローします。',
    },
    {
      id: 'sem-3', kind: 'live', tag: '経営セミナー', tcls: 'keiei',
      title: 'サロン経営｜客単価を上げる店販設計の基本', host: 'サロン経営アドバイザー',
      date: '2026-07-15', dow: '火', time: '20:00–21:00', fee: '参加無料', seats: '受付中',
      place: 'オンライン生配信', img: 'cat_keiei.jpg',
      lead: '店販の組み立てを、数字とカウンセリングトークの両面から。明日から使える内容です。',
    },
    {
      id: 'sem-4', kind: 'live', tag: 'メーカー共催', tcls: 'maker',
      title: '新生活提案セミナー｜頭皮ケアの最新トレンド', host: 'メーカー技術講師',
      date: '2026-07-24', dow: '木', time: '19:30–20:30', fee: '参加無料', seats: '受付中',
      place: 'オンライン生配信', img: 'new_terra.jpg',
      lead: '頭皮ケア市場の最新動向と、サロンでの提案方法をメーカー講師が解説します。',
    },
  ];

  /* =========================================================
     お知らせ（菊地が告知したい情報。トップ上部のスリムなバーに表示）
     セミナー・新商品・イベント・運営連絡などを簡潔に。tag で色分け。
     ========================================================= */
  const NEWS = [
    { tag: 'セミナー', tcls: 'live', t: '【7/3】最新トレンドカラー ライブ配信セミナー 受付中' },
    { tag: '新商品', tcls: 'maker', t: 'terra by ESSENSITY 新色 入荷しました' },
    { tag: 'イベント', tcls: 'venue', t: '【6/28】札幌会場 ブリーチ実技講習 残席わずか' },
    { tag: 'お知らせ', tcls: 'keiei', t: '当日出荷は平日 朝10:00まで（北海道）／土日は出荷休業' },
  ];

  window.SP = window.SP || {};
  window.SP.DATA = { categories, products };

  /* マルチディーラー（中立マーケットプレイス）：出店ディーラー定義。
     各社が自社の決済手段・送料ルール・締め時間・与信を持つ（営業所単位の想定）。 */
  const DEALERS = {
    kikuchi: { id:'kikuchi', name:'菊地', full:'菊地（KIKUCHI PRODUCE）', area:'北海道・本州', accent:'#b9923f',
      pays:['invoice','card','bank'], ship:{ freeOver:3000, fee:550, cutoff:'平日 10:00まで', eta:'最短当日出荷' }, credit:1840000, rep:'菊地 太郎' },
    cosmo:   { id:'cosmo',   name:'コスモ', full:'コスモ（COSMO）', area:'全国', accent:'#2b6cb0',
      pays:['invoice','card','cod'], ship:{ freeOver:5000, fee:660, cutoff:'平日 12:00まで', eta:'全国 翌日目安' }, credit:1000000, rep:'コスモ 担当' },
  };
  window.SP.DEALERS = DEALERS;
  window.SP.primaryDealer = 'kikuchi'; // このサロンが先に取引しているディーラー＝重複(JAN一致)時の優先表示
  window.SP.dealer = id => DEALERS[id] || DEALERS.kikuchi;

  // テナント設定（マルチテナント）公開＋保存/プリセット
  window.SP.TENANT = TENANT;
  window.SP.DEFAULT_TENANT = DEFAULT_TENANT;
  window.SP.TENANT_PRESETS = TENANT_PRESETS;
  window.SP.saveTenant = function (t) { try { localStorage.setItem('sp.tenant.v1', JSON.stringify(t)); } catch (e) {} window.SP.TENANT = TENANT = t; return t; };
  window.SP.applyPreset = function (key) { const p = TENANT_PRESETS[key]; if (!p) return TENANT; return window.SP.saveTenant(deepMerge(TENANT, p.patch)); };
  window.SP.CONTRACT_BRANDS = CONTRACT_BRANDS;
  window.SP.contractBrand = id => CONTRACT_BRANDS.find(b => b.id === id) || null;
  // 曜日(dow)は日付から自動計算して整合（手書きのズレを防止）
  (function () {
    var WD = ['日', '月', '火', '水', '木', '金', '土'];
    SEMINARS.forEach(function (s) { if (s.date) { var p = s.date.split('-'); s.dow = WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; } });
  })();
  /* =========================================================
     キャンペーン（メーカー恒例の「10＋1」など。特集ページで常時チェックさせる）
     kind: buyXgetY＝対象から x本選ぶと y本無料（color line を対象に自由選択）／ link＝バナーのみ
     ※ 期間・内容はプロトタイプのサンプル。
     ========================================================= */
  const CAMPAIGNS = [
    { id: 'adicy-10-1', kind: 'buyXgetY', x: 10, y: 1, line: 'アディクシー', maker: 'ミルボン', dealer: 'kikuchi', tempu: true, claimMaker: true, accent: '#1f4e8c', badge: '10＋1', period: '〜2026/7/31',
      title: 'アディクシー 10＋1 添付', lead: 'メーカー添付（無償現品）。アディクシー カラー剤を10本ごとに、お好きな1本が無料添付。色・明るさは自由に組み合わせOK。' },
    { id: 'ordeve-10-1', kind: 'buyXgetY', x: 10, y: 1, line: 'オルディーブ', maker: 'ミルボン', dealer: 'kikuchi', tempu: true, claimMaker: true, accent: '#1f6f8c', badge: '10＋1', period: '〜2026/8/15',
      title: 'オルディーブ 10＋1 添付', lead: 'メーカー添付（無償現品）。オルディーブを10本ごとに1本が無料添付。サロンの定番カラーをまとめて。' },
    { id: 'summer-color', kind: 'link', accent: '#6e2f57', badge: 'FAIR', period: '夏季限定', href: 'index.html?cat=color',
      title: 'サマー カラーフェア', lead: '今期おすすめのカラー剤を特集。トレンドカラーをまとめてチェック。' },
  ];

  // カラー剤の製品タイプ（タイプ先選択。drill=ブランド→色→明るさのドリル対象）。icon は home の catIcon と同形のpath。
  const COLOR_TYPES = [
    { id: 'alkaline',       label: 'アルカリ（おしゃれ染め）', sub: '1剤＋2剤', drill: true,  icon: '<path d="M9 3h6v5a3 3 0 0 1-6 0z"/><path d="M10 11v8a2 2 0 0 0 4 0v-8"/>' },
    { id: 'gray',           label: '白髪染め（グレイ）',       sub: '1剤＋2剤', drill: true,  icon: '<path d="M4 14a8 8 0 0 1 16 0"/><path d="M8 14v5M12 12v7M16 14v5"/>' },
    { id: 'bleach',         label: 'ブリーチ／ライトナー',     sub: '脱色・脱染', drill: false, icon: '<path d="M12 3s5 5 5 9a5 5 0 0 1-10 0c0-4 5-9 5-9z"/>' },
    { id: 'oxy',            label: 'オキシ（2剤）',           sub: '6%/3%/1.5%', drill: false, icon: '<path d="M9 3h6v4l3.2 9.6A2 2 0 0 1 16.3 19H7.7a2 2 0 0 1-1.9-2.4L9 7z"/><path d="M8.5 13h7"/>' },
    { id: 'manicure',       label: 'ヘアマニキュア',          sub: '酸性・1剤', drill: false, icon: '<path d="M7 14a5 5 0 0 1 10 0v6H7z"/><path d="M9 14V8a3 3 0 0 1 6 0v6"/>' },
    { id: 'henna',          label: 'ヘナ',                    sub: '植物・1剤', drill: false, icon: '<path d="M12 3c5 2 7 6 7 10a7 7 0 0 1-14 0c0-4 2-8 7-10z"/><path d="M12 7v9"/>' },
    { id: 'colortreatment', label: 'カラートリートメント',     sub: '1剤・低ダメージ', drill: false, icon: '<path d="M8 3h8l-1 5H9z"/><path d="M9 8v13h6V8"/>' },
    { id: 'basic',          label: '塩基性／カラーバター',     sub: '1剤・ビビッド', drill: false, icon: '<rect x="6" y="8" width="12" height="12" rx="2"/><path d="M9 8V5h6v3"/>' },
  ];
  // パーマ剤のタイプ（還元剤系統×技法）
  const PERM_TYPES = [
    { id: 'cold-thio', label: 'コールド（チオ）' },
    { id: 'cold-cys',  label: 'コールド（システアミン）' },
    { id: 'acid',      label: '酸性パーマ' },
    { id: 'creep',     label: 'クリープ' },
    { id: 'digital',   label: 'デジタルパーマ' },
    { id: 'air',       label: 'エアウェーブ' },
    { id: 'cosme',     label: 'コスメパーマ' },
    { id: 'perm2',     label: '2剤（パーマ用）' },
    { id: 'treat',     label: '処理剤' },
  ];
  // ストレート剤のタイプ
  const STRAIGHT_TYPES = [
    { id: 'alkaline',  label: 'アルカリ縮毛矯正' },
    { id: 'acid',      label: '酸性ストレート' },
    { id: 'creep',     label: 'クリープ系' },
    { id: 'cosme',     label: 'コスメ系' },
    { id: 'straight2', label: '2剤（ストレート用）' },
    { id: 'treat',     label: '処理剤' },
  ];
  // シャンプーのタイプ（通常／炭酸／頭皮／カラーケア／ドライ）※業務用サイズは「容量」フィルタに分離
  const SHAMPOO_TYPES = [
    { id: 'normal',    label: 'シャンプー' },
    { id: 'carbonated', label: '炭酸シャンプー' },
    { id: 'scalp',     label: 'スキャルプ／頭皮ケア' },
    { id: 'colorcare', label: 'カラーケア' },
    { id: 'dry',       label: 'ドライシャンプー' },
  ];
  // 容量（サイズ）の独立フィルタ。タイプ×サイズの掛け合わせ検索用。商品名から自動判定。
  const SIZE_BUCKETS = [
    { id: 's1', label: '〜300',        max: 300 },
    { id: 's2', label: '300〜600',     min: 300, max: 600 },
    { id: 's3', label: '600〜1000',    min: 600, max: 1000 },
    { id: 's4', label: '業務用(1000〜)', min: 1000 },
  ];
  // トリートメントのタイプ（インバス）
  const TREATMENT_TYPES = [
    { id: 'treatment', label: 'トリートメント' },
    { id: 'mask',      label: 'マスク' },
  ];
  // アウトバス（洗い流さない）のタイプ
  const OUTBATH_TYPES = [
    { id: 'oil',      label: 'オイル' },
    { id: 'emulsion', label: 'エマルジョン／ミルク' },
    { id: 'spray',    label: 'スプレー／ミスト' },
    { id: 'cream',    label: 'クリーム／バーム' },
  ];
  // スタイリング剤のタイプ
  const STYLING_TYPES = [
    { id: 'wax',    label: 'ワックス' },
    { id: 'cream',  label: 'クリーム' },
    { id: 'gel',    label: 'ジェル' },
    { id: 'spray',  label: 'スプレー' },
    { id: 'pomade', label: 'ポマード／グリース' },
    { id: 'balm',   label: 'バーム' },
    { id: 'foam',   label: 'フォーム／ムース' },
    { id: 'oil',    label: 'オイル' },
  ];

  window.SP.SEMINARS = SEMINARS;
  window.SP.NEWS = NEWS;
  window.SP.COLOR_LINES = COLOR_LINES;
  window.SP.COLOR_TYPES = COLOR_TYPES;
  window.SP.COLOR_TONES = COLOR_TONES;
  window.SP.COLOR_LEVELS = COLOR_LEVELS;
  window.SP.SHAMPOO_TYPES = SHAMPOO_TYPES;
  window.SP.SIZE_BUCKETS = SIZE_BUCKETS;
  window.SP.TREATMENT_TYPES = TREATMENT_TYPES;
  window.SP.OUTBATH_TYPES = OUTBATH_TYPES;
  window.SP.STYLING_TYPES = STYLING_TYPES;
  window.SP.PERM_TYPES = PERM_TYPES;
  window.SP.STRAIGHT_TYPES = STRAIGHT_TYPES;
  window.SP.CAMPAIGNS = CAMPAIGNS;
  window.SP.campaign = id => CAMPAIGNS.find(c => c.id === id) || null;

  /* =========================================================
     中古美容機器（再販）＝閉店・改装で引き上げた機器をディーラーが再販。
     ビューティガレージが強い中古市場に対抗。各品は1点もの（在庫1）。
     ※ 品目・状態・価格はプロトタイプの仮置き（要差し替え）。
     ========================================================= */
  const USED_EQUIPMENT = [
    { id: 'u-001', name: 'シャンプー台 ユニット（バックシャンプー）', brand: 'タカラベルモント', cond: 'B', year: 2021, list: 528000, price: 198000, source: '閉店店舗より引上げ', ph: { tint: '#5b6473', label: 'SHAMPOO' } },
    { id: 'u-002', name: 'セットチェア 油圧式（2脚セット）',          brand: 'タカラベルモント', cond: 'A', year: 2022, list: 264000, price: 118000, source: '改装店舗より',     ph: { tint: '#3a3030', label: 'CHAIR' } },
    { id: 'u-003', name: 'ヘアスチーマー ロボット型',                brand: 'タカラベルモント', cond: 'B', year: 2019, list: 198000, price: 78000,  source: '閉店店舗より引上げ', ph: { tint: '#7d8fa6', label: 'STEAMER' } },
    { id: 'u-004', name: 'ミラー付きセット面 W900',                  brand: '共通',           cond: 'A', year: 2023, list: 96800,  price: 52000,  source: '改装店舗より',     ph: { tint: '#cdd2d8', label: 'MIRROR' } },
    { id: 'u-005', name: 'バックバー什器 W1200',                    brand: '共通',           cond: 'B', year: 2020, list: 88000,  price: 34000,  source: '閉店店舗より引上げ', ph: { tint: '#b9a78a', label: 'BACKBAR' } },
    { id: 'u-006', name: 'タオルウォーマー 18L',                    brand: '共通',           cond: 'C', year: 2018, list: 24200,  price: 9800,   source: '改装店舗より',     ph: { tint: '#9aa0a6', label: 'WARMER' } },
  ];

  /* =========================================================
     紹介パートナー（開業・運営に必要なあらゆる業者をディーラーが紹介）。
     紹介フォーム→ディーラー（菊地）に通知＋成約で紹介料（マージン）が入る。
     各カテゴリはディーラーが表示/非表示を選べる（tenant.partners）。
     ※ 会社名・紹介料はプロトタイプの仮置き（要差し替え）。
     ========================================================= */
  const PARTNERS = [
    { id: 'koumuten', name: '内装・店舗工事（工務店）', icon: '<path d="M3 21h18M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/>',
      tagline: '新規開業・改装の施工パートナー', desc: '地域で実績のある工務店をご紹介。新装・改装・一部リフォームまで、見積り無料で対応します。',
      feeNote: '成約工事額の 3〜5%（目安）',
      fields: [ { k: 'kind', label: '工事内容', type: 'select', opts: ['新規開業（新装）', '改装・リニューアル', '一部リフォーム'] }, { k: 'when', label: '希望時期', type: 'text', ph: '例：3ヶ月以内' }, { k: 'size', label: '規模（坪数・セット面）', type: 'text', ph: '例：20坪・6セット' } ] },
    { id: 'towel', name: 'リネン・タオル', icon: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 6v12M17 6v12"/>',
      tagline: 'タオルのレンタル・買取・洗濯', desc: 'サロン専用リネンサプライ。レンタル（洗濯込み）・買取・洗濯のみから選べます。',
      feeNote: '成約で初月分の紹介料（目安）',
      fields: [ { k: 'mode', label: 'ご希望', type: 'select', opts: ['レンタル（洗濯込み）', '買取', '洗濯のみ'] }, { k: 'vol', label: '枚数の目安', type: 'text', ph: '例：1日100枚' } ] },
    { id: 'tax', name: '税理士', icon: '<path d="M9 3h6l1 4H8z"/><path d="M6 7h12l-1 14H7z"/><path d="M10 12h4M10 16h4"/>',
      tagline: '確定申告・記帳・節税・法人化', desc: '美容業に強い税理士をご紹介。記帳代行・確定申告・節税・法人化のご相談まで。',
      feeNote: '成約初年度顧問料の一部（目安）',
      fields: [ { k: 'form', label: '事業形態', type: 'select', opts: ['個人事業', '法人'] }, { k: 'need', label: 'ご相談', type: 'select', opts: ['顧問契約', '確定申告のみ', '法人化の相談'] } ] },
    { id: 'sharoshi', name: '社会保険労務士', icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M17 11l2 2 4-4"/>',
      tagline: '就業規則・社会保険・助成金', desc: 'スタッフ採用・社会保険手続き・就業規則・助成金申請まで、労務の専門家をご紹介。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'staff', label: '従業員数', type: 'text', ph: '例：5名' }, { k: 'need', label: 'ご相談', type: 'select', opts: ['就業規則の作成', '社会保険の手続き', '助成金の申請', '労務トラブル'] } ] },
    { id: 'payment', name: 'クレジット／キャッシュレス決済', icon: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 9.5h19"/><path d="M6 14h4"/>',
      tagline: '店販・施術のカード/QR決済導入', desc: '低率・即日入金のキャッシュレス決済をご紹介。カード端末・QR・電子マネー・オンライン決済に対応。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'sales', label: '月商の目安', type: 'text', ph: '例：300万円' }, { k: 'need', label: 'ご希望', type: 'select', opts: ['カード端末', 'QR・電子マネー', 'オンライン決済', 'まとめて相談'] } ] },
    { id: 'insurance', name: '法人保険（サロン）', icon: '<path d="M12 3l8 3v6c0 4.4-3.2 7.9-8 9-4.8-1.1-8-4.6-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
      tagline: '店舗総合・賠償責任・休業補償', desc: '保険資格を持つ専任スタッフが、サロン（法人・個人事業）向けの店舗総合保険・施術の賠償責任保険・休業補償までまとめてご相談に対応します。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'type', label: '保険の種類', type: 'select', opts: ['店舗総合保険', '賠償責任保険（施術）', '休業補償', 'サイバー・情報漏えい', 'まとめて相談'] }, { k: 'staff', label: '従業員数', type: 'text', ph: '例：6名' } ] },
    { id: 'insurancePersonal', name: '美容師個人の保険', icon: '<circle cx="12" cy="7" r="3.4"/><path d="M5.5 21a6.5 6.5 0 0 1 13 0"/><path d="M19 8l1.5 1.5L23 7"/>',
      tagline: '生命・医療・所得補償・個人賠償', desc: '美容師さん個人向けの保険もご案内。ケガ・病気で働けないときの所得補償（就業不能）、生命・医療保険、個人の賠償責任まで、資格を持つ担当者がライフプランに合わせてご相談します。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'who', label: '対象', type: 'select', opts: ['スタッフ個人', 'オーナー個人', '面貸し・業務委託の方'] }, { k: 'type', label: 'ご関心', type: 'select', opts: ['所得補償（就業不能）', '生命・医療保険', '個人賠償・PL', '積立・年金', 'まとめて相談'] } ] },
    { id: 'utility', name: '電気・ガス（光熱費の見直し）', icon: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
      tagline: '新電力・新ガスの切替で固定費を削減', desc: '開業・移転時の電気/ガスの新規開通から、既存店舗の料金見直し（新電力・新ガス）まで。サロンの光熱費の削減をご提案します。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'target', label: '対象', type: 'select', opts: ['電気', 'ガス', '電気・ガス両方'] }, { k: 'state', label: 'ご状況', type: 'select', opts: ['新規開業（新規開通）', '既存店舗の見直し', '移転'] }, { k: 'cost', label: '現在の月額・規模（任意）', type: 'text', ph: '例：月3万円／20坪' } ] },
    { id: 'internet', name: 'インターネット・通信', icon: '<path d="M5 12.5a10 10 0 0 1 14 0"/><path d="M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1"/>',
      tagline: '回線開通・店舗Wi-Fi・固定電話', desc: '開業時のインターネット回線の開通、店舗Wi-Fi、固定電話・予約電話、決済端末の通信まわりまでご紹介します。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'state', label: 'ご状況', type: 'select', opts: ['新規開業（開通）', '乗り換え・見直し'] }, { k: 'need', label: 'ご希望', type: 'select', opts: ['光回線', '店舗Wi-Fi', '固定電話・予約番号', 'まとめて相談'] }, { k: 'when', label: '希望時期', type: 'text', ph: '例：開店の1ヶ月前' } ] },
    { id: 'recruit', name: '求人・採用支援', icon: '<circle cx="9" cy="8" r="3.2"/><path d="M3 21a6 6 0 0 1 12 0"/><path d="M18 8v6M15 11h6"/>',
      tagline: 'スタイリスト・アシスタントの採用', desc: '美容業界に強い求人媒体・人材紹介をご紹介。新卒・中途・面貸し（業務委託）人材まで、採用と定着をサポートします。',
      feeNote: '採用決定で紹介料（目安）',
      fields: [ { k: 'role', label: '募集職種', type: 'select', opts: ['スタイリスト', 'アシスタント', '受付・事務', '業務委託・面貸し'] }, { k: 'count', label: '募集人数', type: 'text', ph: '例：2名' }, { k: 'when', label: '希望時期', type: 'text', ph: '例：来春・急ぎ 等' } ] },
    { id: 'lease', name: 'リース・割賦／開業資金', icon: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/>',
      tagline: '設備リース・割賦・開業/運転資金の相談', desc: '機器・什器・POS・看板などのリース／割賦（分割）から、開業・運転資金の融資相談まで、ファイナンスのパートナーをご紹介します。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'kind', label: 'ご相談', type: 'select', opts: ['設備・什器のリース', '割賦（分割払い）', '開業資金の融資', '運転資金', 'まとめて相談'] }, { k: 'amount', label: '金額の目安（任意）', type: 'text', ph: '例：300万円' } ] },
    { id: 'security', name: '防犯・セキュリティ', icon: '<path d="M12 3l7 3v5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><circle cx="12" cy="11" r="2"/><path d="M12 13v3"/>',
      tagline: '防犯カメラ・機械警備・レジ防犯', desc: '防犯カメラの設置、機械警備（夜間・休業時）、レジ・釣銭の防犯まで。スタッフとお客様が安心できる環境づくりをご紹介します。',
      feeNote: '成約で紹介料（目安）',
      fields: [ { k: 'need', label: 'ご希望', type: 'select', opts: ['防犯カメラ設置', '機械警備（警備会社）', 'レジ・現金防犯', 'まとめて相談'] }, { k: 'size', label: '店舗規模', type: 'text', ph: '例：20坪・出入口2' } ] },
  ];

  window.SP.USED_EQUIPMENT = USED_EQUIPMENT;
  window.SP.PARTNERS = PARTNERS;
  window.SP.partner = id => PARTNERS.find(p => p.id === id) || null;

  /* =========================================================
     スタッフメイト＝メーカーのスタッフ個人向け特別価格プログラム。
     スタッフ個人の発注でのみ購入可（店舗＝サロンの発注では不可）。
     通常商品とは別管理（カタログ/カートには出さない）＝staffmate.html専用。
     ※ 商品・価格はプロトタイプの仮置き（要差し替え）。
     ========================================================= */
  const STAFFMATE = {
    period: '〜2026/7/15',
    items: [
      { id: 'sm-1', brand: 'ミルボン',   name: 'エルジューダ エマルジョン+ 120g', list: 2640, price: 1320, ph: { shape: 'tube',   tint: '#e3c1cf' } },
      { id: 'sm-2', brand: 'ナプラ',     name: 'N. ポリッシュオイル 150mL',        list: 2860, price: 1430, ph: { shape: 'bottle', tint: '#caa64a' } },
      { id: 'sm-3', brand: 'ルベル',     name: 'イオ クレンジング 600mL',          list: 3080, price: 1540, ph: { shape: 'pump',   tint: '#c0392b' } },
      { id: 'sm-4', brand: 'ミルボン',   name: 'オージュア クエンチ トリートメント 250g', list: 2420, price: 1210, ph: { shape: 'tube', tint: '#2b6cb0' } },
      { id: 'sm-5', brand: 'ナカノ',     name: 'スタイリング ワックス 5 90g',      list: 990,  price: 490,  ph: { shape: 'jar',    tint: '#c98a2a' } },
      { id: 'sm-6', brand: '阪本高生堂', name: 'クールグリース G 210g',            list: 1100, price: 550,  ph: { shape: 'jar',    tint: '#2f5fa8' } },
    ],
  };
  window.SP.STAFFMATE = STAFFMATE;
})();

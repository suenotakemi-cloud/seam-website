// 商品写真ガイド（種類別・5枚の撮り方）— photo-guide.html と スマホ登録画面（index.html の撮影画面）で共用
//   ディーラー EC（通販サイト）の商品写真と同じ見え方に揃えるための「種類ごとの 5 枚の角度」と、商品名・カテゴリから種類を当てる規則。
//   window.PhotoGuide = { KINDS, byKey(key), guessKind(product) → key, slotSvg(key, slot) → svg文字列, exampleSvg(type) }
(function (root) {
  'use strict';
  var KINDS = [
    { key: 'colorbox', icon: '🎨', label: 'カラー剤（箱入り・1剤）', examples: 'ヘアカラー・グレイカラー・ファッションカラー・ブリーチ（箱）', shape: 'box',
      lead: 'EC ではお客様が<b>「箱の正面の色番号」</b>で探します。1枚目は必ず箱の正面。色番号（例: 7-NB）と商品名が読めること。',
      slots: [
        { title: '箱の正面', sub: '色番号・商品名が正面。箱は立てて、底を線に。' },
        { title: '箱の裏面', sub: '成分・使用上の注意が読めるように。1枚目と同じ大きさ。' },
        { title: 'チューブ本体（正面）', sub: '箱から出して、ラベルを正面に。キャップは上。' },
        { title: '色番号の面に寄る', sub: '箱の側面か上面の色番号・レベルを大きく（色見本があればそれも）。' },
        { title: '箱＋チューブ', sub: '箱の前にチューブを立てて並べる。セットで何が入るかが分かる。' },
      ],
      tips: '同じシリーズは<b>全色まったく同じ構図</b>にする（色番号だけが違って見えるのが正解）。箱の角を少しでも潰さない。',
      ng: '箱を寝かせる／ななめ置き／色番号がラベルの影で読めない／チューブだけを 1枚目にする。' },
    { key: 'oxy', icon: '🧴', label: '2剤・オキシ・業務用ボトル', examples: 'オキシダン 6%・2剤 1000ml・過酸化水素', shape: 'bottle',
      lead: '大きなボトルは<b>ラベルの濃度（3% / 6%）</b>が一番大事。正面ラベルの濃度表記が真ん中に来るように。',
      slots: [
        { title: '正面（濃度が読める）', sub: 'ラベルの濃度・容量を正面に。キャップは上。' },
        { title: '裏面', sub: '成分・使い方。' },
        { title: '斜め', sub: '少し斜めから。ボトルの厚みが分かるように。' },
        { title: 'キャップ・注ぎ口', sub: '開け口の形（計量キャップなど）に寄る。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさを伝える。背景は白いまま。' },
      ],
      tips: '同じ商品の 3% と 6% は<b>同じ位置・同じ大きさ</b>で。濃度の文字が読めるかを保存前に確認。' },
    { key: 'perm', icon: '🌀', label: 'パーマ剤・縮毛矯正（1剤/2剤）', examples: 'パーマ液・ストレート剤・システアミン・酸熱', shape: 'bottle',
      lead: '1剤と2剤がある商品は、<b>1枚目は 1剤の正面</b>。3枚目で 1剤・2剤を並べて「セット」を見せます。',
      slots: [
        { title: '1剤の正面', sub: '「1」「1剤」「H/N」などの表記が読める面を正面に。' },
        { title: '1剤の裏面', sub: '成分・使い方。' },
        { title: '1剤＋2剤を並べる', sub: '左に 1剤、右に 2剤。同じ高さで。箱があれば後ろに。' },
        { title: '口元・キャップ', sub: '注ぎ口・ノズルの形に寄る。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさを伝える。' },
      ],
      tips: '1剤と2剤で<b>ラベルの向き・高さ</b>を揃える。強さ違い（H / N / S）はラベルの記号が真ん中に来るように。' },
    { key: 'bottle', icon: '🚿', label: 'シャンプー・トリートメント（ボトル・ポンプ）', examples: 'シャンプー 250ml・コンディショナー・ポンプボトル', shape: 'bottle',
      lead: 'いちばん数が多い形。<b>ラベル正面・キャップ（ポンプ）は上</b>。同じシリーズは並べたときに同じ高さに見えるように。',
      slots: [
        { title: '正面', sub: 'ラベルを正面に。ポンプのノズルは横向きで OK（同じシリーズは同じ向き）。' },
        { title: '裏面', sub: '成分表示・使い方が読める。' },
        { title: '斜め・側面', sub: '少し斜めから。厚み・形が分かる。' },
        { title: 'ポンプ・キャップ', sub: 'ポンプの頭・開け口に寄る。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさ。250ml と 750ml の違いが伝わる。' },
      ],
      tips: '透明・黒いボトルは<b>窓に対して横向き</b>に置くと反射しにくい。ポンプの向きはシリーズで統一。' },
    { key: 'jar', icon: '🫙', label: 'ジャー・缶（トリートメント・ワックス）', examples: 'ヘアマスク・ワックス・グリース・クレイ', shape: 'jar',
      lead: '<b>ラベル正面が 1枚目</b>。4枚目で<b>フタを開けて中身の質感</b>を見せると EC で選ばれやすくなります。',
      slots: [
        { title: '正面（ラベル）', sub: 'フタを閉めたまま、ラベルを正面に。' },
        { title: '裏面・底', sub: '成分・使い方（底に書いてあれば底）。' },
        { title: '上から（フタ）', sub: '真上からフタのデザイン・商品名。' },
        { title: 'フタを開けて中身', sub: '真上か少し斜めから、中身の色・質感が分かるように。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさ。' },
      ],
      tips: 'フタを開けた写真は<b>中身をきれいに（指の跡を消して）</b>。テクスチャは白い背景の上でスプーンに取ってもよい。' },
    { key: 'tube', icon: '🧷', label: 'チューブ・パウチ・詰め替え', examples: '詰め替え用・レフィル・チューブ入りトリートメント', shape: 'tube',
      lead: '自立しないものは<b>白い紙に平置きして真上から</b>。ラベルの文字が読める向きに（上下を逆にしない）。',
      slots: [
        { title: '正面（平置き・真上）', sub: '袋は平らにならして真上から。チューブは立てられるなら立てる。' },
        { title: '裏面', sub: '成分・使い方。' },
        { title: '斜め（厚み）', sub: '少し斜めから、厚み・ふくらみが分かる。' },
        { title: '注ぎ口・キャップ', sub: '口の形（切り口・キャップ）に寄る。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさ。詰め替えは「入れ替え先のボトル」と並べてもよい。' },
      ],
      tips: '袋のシワ・反射が出やすい。<b>上から押さえて平らに</b>して、光は横から。' },
    { key: 'spray', icon: '💨', label: 'スプレー・ミスト・オイル', examples: 'ヘアスプレー・ミスト・アウトバスオイル・セラム', shape: 'bottle',
      lead: '<b>ラベル正面・ノズルは上</b>。オイルなど透明なものは<b>白い背景で中身の色</b>が見えるように。',
      slots: [
        { title: '正面', sub: 'ラベルを正面に。キャップは付けたまま。' },
        { title: '裏面', sub: '成分・使い方。' },
        { title: '斜め', sub: '少し斜めから。' },
        { title: 'ノズル・ヘッド（キャップを外す）', sub: 'スプレーの頭・ノズルの形に寄る。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさ。' },
      ],
      tips: '缶スプレーは<b>反射しやすい</b>。背景を白にする強さを「弱」にし、窓と反対側に向ける。' },
    { key: 'device', icon: '🔌', label: '機器・器具（ドライヤー・アイロン・シザー）', examples: 'ドライヤー・ヘアアイロン・ブラシ・シザー・クリッパー', shape: 'none',
      lead: '<b>1枚目は本体の全体（箱があれば箱の正面）</b>。3枚目以降で<b>プレート・先端・付属品</b>を見せます。',
      slots: [
        { title: '本体の全体（正面）', sub: '横向きに置いて全体が入るように。コードはまとめて後ろへ。' },
        { title: '反対側・銘板', sub: '型番・電圧・メーカーの表示が読める面。' },
        { title: '斜め（立体感）', sub: '少し斜め上から、厚み・ボタンの位置が分かる。' },
        { title: 'プレート・先端に寄る', sub: 'アイロンはプレート、ドライヤーは吹き出し口、シザーは刃先。' },
        { title: '箱＋付属品一式', sub: '箱・アタッチメント・説明書を並べて「入っているもの」を見せる。' },
      ],
      tips: '黒い機器は<b>白い背景で輪郭が出る</b>ように、光を横から。コードは丸めて本体の後ろに隠す。' },
    { key: 'colortube', icon: '🖍️', label: 'ヘアマニキュア・塩基性カラー・カラーシャンプー', examples: 'ヘアマニキュア・塩基性カラー・カラートリートメント・カラーシャンプー・ポイントコンシーラー', shape: 'tube',
      lead: '箱が無い色物。<b>1枚目は本体の正面（色名・色番号が読める）</b>。4枚目で<b>色名・色見本に寄る</b>と EC で色違いを選びやすくなります。',
      slots: [
        { title: '本体の正面（色名が読める）', sub: 'チューブ・ボトルを立てて、色名・番号を正面に。' },
        { title: '裏面', sub: '成分・使い方。' },
        { title: '斜め', sub: '少し斜めから。形・厚みが分かる。' },
        { title: '色名・色見本に寄る', sub: 'ラベルの色名・色見本のチップを大きく。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさ。' },
      ],
      tips: '同じシリーズの全色を<b>同じ構図</b>で。色名の文字が読めるかを保存前に確認。' },
    { key: 'kit', icon: '🧪', label: 'システムトリートメント・キット', examples: 'システムトリートメント（No.1〜3）・キット・複数本セット', shape: 'bottle',
      lead: '複数の容器で 1 商品のもの。<b>1枚目は全部を並べた「セット全体」</b>。2枚目以降で 1 本ずつ。',
      slots: [
        { title: 'セット全体を並べる', sub: '番号順に左から。同じ高さ・同じ間隔で。' },
        { title: '1本目の正面', sub: 'No.1（主剤）のラベルを正面に。' },
        { title: '裏面', sub: '主剤の成分・使い方。' },
        { title: '番号・ラベルに寄る', sub: '各容器の No.／記号が読めるように寄る。' },
        { title: '大きさ（手に持つ）', sub: '主剤を手に持って大きさ。' },
      ],
      tips: 'キットの箱があるときは 1枚目を<b>箱の正面</b>にし、2枚目で中身を並べる。' },
    { key: 'cosme', icon: '💄', label: 'コスメ（メイクアップ・ベースメイク）', examples: 'リップ・アイシャドウ・マスカラ・ファンデーション・チーク', shape: 'none',
      lead: '小さいので<b>枠いっぱいに寄る</b>。1枚目はパッケージ（ケース）の正面。3枚目で<b>中身を出した状態</b>、4枚目で<b>色（塗った色見本）</b>。',
      slots: [
        { title: 'ケースの正面（閉じたまま）', sub: '商品名・色番号が読める面。小さいものは枠いっぱいに寄る。' },
        { title: '裏面・底（色番号）', sub: '底のシールの色番号・成分。' },
        { title: '開けた状態', sub: 'フタを開ける／繰り出す。中身の形が分かる。' },
        { title: '色見本', sub: '白い紙に塗った色、またはパレットの色に寄る。' },
        { title: '大きさ（手に持つ）', sub: '手に持って大きさ。' },
      ],
      tips: '色違いが多いので<b>色番号が読めるか</b>が一番大事。ラメ・ツヤは反射しやすいので光を横から。' },
    { key: 'small', icon: '🧤', label: '小物・消耗品', examples: 'ペーパー・手袋・ロッド・ヘアクリップ・カップ・刷毛', shape: 'none',
      lead: '<b>1枚目はパッケージ正面</b>（袋・箱）。3枚目で<b>中身を取り出して</b>、5枚目で<b>入数</b>が分かるように。',
      slots: [
        { title: 'パッケージ正面', sub: '袋・箱のまま、商品名・入数が読める面を正面に。' },
        { title: 'パッケージ裏面', sub: '仕様・注意書き。' },
        { title: '中身を取り出して', sub: '1〜3 個を白い背景に並べる。' },
        { title: '寄り（質感・形）', sub: '1 個に寄って、素材・形が分かる。' },
        { title: '入数が分かる', sub: '手に持つか、全部を並べて「何個入り」が伝わるように。' },
      ] },
  ];
  var BY = {}; KINDS.forEach(function (k) { BY[k.key] = k; });

  // 商品名・カテゴリ・ブランドから種類を当てる（上から順に最初に当たったもの）
  var RULES = [
    ['device', /ドライヤー|アイロン|コテ|クリッパー|バリカン|シザー|はさみ|ハサミ|ブラシ|コーム|ミラー|スチーマー|加湿|機器|器具|充電|電源/],
    ['small', /ペーパー|手袋|グローブ|ロッド|クリップ|ダッカール|カップ|刷毛|ハケ|ボウル|ケープ|タオル|コットン|綿棒|エプロン|マット|スポンジ|ピン|ゴム|ラップ|ホイル|アルミ/],
    ['colorbox', /ヘアカラー|グレイカラー|ファッションカラー|カラー剤|カラー\s*1剤|ブリーチ|ライトナー|マニキュア|ヘアマニキュア|白髪染め|おしゃれ染め|カラー\b|カラー[０-９0-9]|\b\d{1,2}\s*-?\s*[A-Z]{1,3}\b|[０-９0-9]{1,2}(NB|N|A|M|P|V|R|B|G|BB|MT|PB|OR)\b/],
    ['oxy', /オキシ|OXY|2剤|２剤|過酸化|ディベロッパー|デベロッパー|クリームデベロ|[0-9０-９.．]+\s*[%％]/i],
    ['perm', /パーマ|ストレート|縮毛|矯正|ウェーブ|システアミン|チオ|酸熱|還元|1剤|１剤|2液|１液|2液/],
    ['spray', /スプレー|ミスト|フォーム|ムース|オイル|セラム|エッセンス|ローション|トニック|ウォーター|ヘアミルク/],
    ['jar', /ジャー|ワックス|グリース|クレイ|ポマード|バター|マスク|パック|缶/],
    ['tube', /詰め替え|詰替|レフィル|パウチ|袋|チューブ|リフィル/],
    ['bottle', /シャンプー|トリートメント|コンディショナー|リンス|クレンジング|ボディ|ソープ|ポンプ|ボトル|\b\d+\s*(ml|mL|ML|L|ℓ)\b/],
  ];
  // カテゴリ（大 > 中 > 小 の文字列）→ 種類。ディーラーの分類（スマイルの カテゴリ大/中/小）に合わせたもの。上から順に最初に当たったもの
  var CATEGORY_MAP = [
    ['device', /ヘアアイロン|ヘアドライヤー|シャワーヘッド|電化製品|美容家電|光美容器|美顔器|ドライヤー\s*スタンド/],
    ['oxy', /2剤|２剤|オキシ/],
    ['colorbox', /ヘアカラー1剤|ヘアカラー１剤|香草カラー|植物系|クリームブリーチ|ブリーチ\/脱染剤$|脱染剤|ヘアカラー保護/],
    ['colortube', /ヘアマニキュア|塩基性カラー|カラーシャンプー|カラートリートメント|カラースプレー/],
    ['tube', /パウダーブリーチ|詰め替え|レフィル/],
    ['perm', /パーマ剤|コールドウェーブ|ストレート\/デジタル|ウェーブ用|ストレート用/],
    ['kit', /システムトリートメン/],
    ['jar', /集中ケア\/マスク|ワックス|グリース\/ポマード|バーム\/バター|クリーム\/バーム\/ジェ|サプリメント/],
    ['spray', /スプレー|ムース\/フォーム|ミスト|オイル|エマルジョン\/ミルク|ローション/],
    ['tube', /クリーム\/ミルク|ジェル\/セットローシ/],
    ['cosme', /メイクアップ|ベースメイク/],
    ['bottle', /スキンケア|ボディケア|シャンプー|トリートメント|ヘアケア|処理剤|除去剤|プレックス|ヘッドスパ|リムーバー|専用部品|エステ/],
    ['small', /理美容小物|店舗用品|カラー用品|シャンプー用品|スタイリング用品|タオル|ギフト|衛生/],
  ];
  function kindOfCategory(cat) {
    var c = cat == null ? '' : String(cat); if (!c) return null;
    for (var i = 0; i < CATEGORY_MAP.length; i++) if (CATEGORY_MAP[i][1].test(c)) return CATEGORY_MAP[i][0];
    return null;
  }
  function guessKind(p) {
    if (!p) return 'bottle';
    var byCat = kindOfCategory(p.category);
    // カテゴリが「ヘアケア > シャンプー」でも商品名が「詰め替え」なら袋。名前の強い手がかりだけ先に見る
    var name = [p.name, p.brand].map(function (x) { return x == null ? '' : String(x); }).join(' ');
    if (/詰め替え|詰替|レフィル|パウチ|リフィル/.test(name)) return 'tube';
    if (byCat) return byCat;
    var text = [p.category, p.brand, p.name, p.maker].map(function (x) { return x == null ? '' : String(x); }).join(' ');
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(text)) return RULES[i][0];
    return 'bottle';
  }
  // ディーラーの分類一覧（菊池 スマイルの カテゴリ大 > 中 > 小）。ガイドの対応表に出す
  var CATEGORY_LIST = [
    'カラー剤 > ヘアカラー1剤 > グレイ', 'カラー剤 > ヘアカラー1剤 > ファッション', 'カラー剤 > ヘアカラー1剤 > 低アルカリ', 'カラー剤 > ヘアカラー1剤 > ノンアルカリ', 'カラー剤 > ヘアカラー1剤',
    'カラー剤 > ヘアカラー2剤 > カラーオキシ', 'カラー剤 > ヘアマニキュア', 'カラー剤 > 塩基性カラー', 'カラー剤 > 植物系 > 香草カラー',
    'カラー剤 > ブリーチ/脱染剤 > パウダーブリーチ', 'カラー剤 > ブリーチ/脱染剤 > クリームブリーチ', 'カラー剤 > ブリーチ/脱染剤 > 脱染剤', 'カラー剤 > ブリーチ/脱染剤',
    'カラー剤 > カラーシャンプー/トリートメント > カラーシャンプー', 'カラー剤 > カラーシャンプー/トリートメント > カラートリートメント', 'カラー剤 > カラースプレー/その他', 'カラー剤 > ヘアカラーリムーバー', 'カラー剤 > ヘアカラー保護クリーム',
    'パーマ剤 > コールドウェーブ > コスメ系', 'パーマ剤 > コールドウェーブ > シス系', 'パーマ剤 > コールドウェーブ > チオ系', 'パーマ剤 > コールドウェーブ > ウェーブ用2剤',
    'パーマ剤 > ストレート/デジタル > コスメ系', 'パーマ剤 > ストレート/デジタル > シス系', 'パーマ剤 > ストレート/デジタル > チオ系', 'パーマ剤 > ストレート/デジタル > ストレート用2剤', 'パーマ剤 > 処理剤/除去剤 > パーマ用処理剤',
    'ヘアケア > シャンプー > ケア', 'ヘアケア > シャンプー > スキャルプ', 'ヘアケア > シャンプー > ナチュラル/オーガニック', 'ヘアケア > トリートメント > ケア', 'ヘアケア > トリートメント > スキャルプ', 'ヘアケア > トリートメント > 集中ケア/マスク',
    'ヘアケア > アウトバストリートメント > オイル', 'ヘアケア > アウトバストリートメント > エマルジョン/ミルク', 'ヘアケア > アウトバストリートメント > ミスト/ローション/スプレー', 'ヘアケア > アウトバストリートメント > クリーム/バーム/ジェル', 'ヘアケア > アウトバストリートメント > 頭皮用', 'ヘアケア > アウトバストリートメント > スキャルプ', 'ヘアケア > 専用部品',
    '業務用ヘアケア > シャンプー（業務用）', '業務用ヘアケア > トリートメント（業務用）', '業務用ヘアケア > システムトリートメント', '業務用ヘアケア > ヘッドスパ', '業務用ヘアケア > 処理剤/除去剤 > カラー用処理剤', '業務用ヘアケア > 処理剤/除去剤 > パーマ用処理剤', '業務用ヘアケア > 処理剤/除去剤 > プレックス剤・添加剤', '業務用ヘアケア > 処理剤/除去剤 > 除去・消臭系', '業務用ヘアケア > アウトバストリートメント > ミスト/ローション/スプレー',
    'スタイリング剤 > スプレー', 'スタイリング剤 > ムース/フォーム', 'スタイリング剤 > ミスト/ウォーター', 'スタイリング剤 > スタイリングオイル', 'スタイリング剤 > ワックス', 'スタイリング剤 > グリース/ポマード', 'スタイリング剤 > バーム/バター', 'スタイリング剤 > クリーム/ミルク', 'スタイリング剤 > ジェル/セットローション',
    'コスメ > メイクアップ > リップ', 'コスメ > メイクアップ > アイシャドウ', 'コスメ > メイクアップ > マスカラ', 'コスメ > メイクアップ > アイブロウ', 'コスメ > メイクアップ > アイライナー', 'コスメ > ベースメイク > ファンデーション', 'コスメ > ベースメイク > チーク', 'コスメ > ベースメイク > コンシーラ', 'コスメ > ベースメイク > フェイスパウダー', 'コスメ > ベースメイク > 化粧下地', 'コスメ > ベースメイク > 日焼け止め/UVケア',
    'コスメ > スキンケア > 化粧水', 'コスメ > スキンケア > 乳液', 'コスメ > スキンケア > 美容液', 'コスメ > スキンケア > クリーム', 'コスメ > スキンケア > クレンジング/洗顔', 'コスメ > ボディケア/フェムケア', 'コスメ > インナービューティー > サプリメント',
    '理美容小物 > スタイリング用品 > ヘアアイロン/カール', '理美容小物 > スタイリング用品 > ヘアドライヤー', '理美容小物 > シャンプー用品 > シャワーヘッド', '理美容小物 > スタイリング用品 > ブラシ', '理美容小物 > スタイリング用品 > コーム', '理美容小物 > カラー用品 > ハケ/カップ/ホイル', '理美容小物 > カラー用品 > その他(カラー用品)', '理美容小物 > タオル/ひざかけ', '理美容小物 > その他',
    '店舗用品 > 電化製品', '店舗用品 > ギフト', '店舗用品 > 衛生', '店舗用品 > その他', '美容家電 > フェイス/スカルプ/ボディ > 光美容器', '美容家電 > フェイス/スカルプ/ボディ > 美顔器', 'エステ > エステティック備品',
  ];

  // ── イラスト（100×100 の座標系、白背景）─────────────────────────────
  var C = { line: '#2B2926', fill: '#F3EEE6', accent: '#A87456', paper: '#fff', dash: '#E0A45A', hand: '#F5D9C4' };
  function frame() { // 点線の枠と底線（アプリの撮影画面と同じ）
    return '<rect x="15" y="11" width="70" height="78" rx="2" fill="none" stroke="' + C.dash + '" stroke-width="0.7" stroke-dasharray="2 1.4"/><line x1="8" y1="89" x2="92" y2="89" stroke="' + C.dash + '" stroke-width="0.9"/>';
  }
  function txt(x, y, s, size, anchor, color) { return '<text x="' + x + '" y="' + y + '" font-size="' + (size || 4) + '" text-anchor="' + (anchor || 'middle') + '" fill="' + (color || C.line) + '" font-family="sans-serif" font-weight="600">' + s + '</text>'; }
  var S = 'fill="' + C.fill + '" stroke="' + C.line + '" stroke-width="1"';
  function box(x, y, w, h, opts) { // カラー剤の箱（正面）。opts.num: 色番号 / opts.back: 裏面 / opts.side: 側面
    opts = opts || {};
    var s = '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="1.5" ' + S + '/>';
    if (opts.back) { for (var i = 0; i < 6; i++) s += '<line x1="' + (x + 4) + '" y1="' + (y + 10 + i * (h - 16) / 6) + '" x2="' + (x + w - 4) + '" y2="' + (y + 10 + i * (h - 16) / 6) + '" stroke="' + C.line + '" stroke-width="0.6" opacity=".5"/>'; s += txt(x + w / 2, y + 7, '成分・注意', 3.6); return s; }
    if (opts.side) { s += txt(x + w / 2, y + h / 2 + 2, opts.num || '7-NB', Math.min(7, w / 2.2)); s += '<rect x="' + (x + 3) + '" y="' + (y + h - 12) + '" width="' + (w - 6) + '" height="7" fill="' + C.accent + '" opacity=".8"/>'; return s; }
    s += '<rect x="' + (x + 3) + '" y="' + (y + 3) + '" width="' + (w - 6) + '" height="' + (h * 0.42) + '" fill="' + C.accent + '" opacity=".85"/>';
    s += txt(x + w / 2, y + h * 0.62, opts.num || '7-NB', Math.min(8, w / 2.4), 'middle', C.line);
    s += txt(x + w / 2, y + h * 0.78, opts.name || 'COLOR', 3.2, 'middle', C.line);
    return s;
  }
  function tube(x, y, w, h, opts) { opts = opts || {}; var s = '<rect x="' + (x + w * 0.3) + '" y="' + y + '" width="' + (w * 0.4) + '" height="' + (h * 0.12) + '" rx="1" ' + S + '/>';
    s += '<path ' + S + ' d="M' + (x + w * 0.2) + ' ' + (y + h * 0.12) + ' h' + (w * 0.6) + ' l' + (w * 0.1) + ' ' + (h * 0.62) + ' h-' + (w * 0.8) + ' z"/>';
    s += '<path fill="' + C.line + '" d="M' + (x + w * 0.1) + ' ' + (y + h * 0.74) + ' h' + (w * 0.8) + ' v' + (h * 0.05) + ' h-' + (w * 0.8) + ' z"/>';
    if (!opts.back) s += txt(x + w / 2, y + h * 0.5, opts.num || '7-NB', Math.min(6, w / 2.4)); else s += txt(x + w / 2, y + h * 0.5, '成分', 3.4); return s; }
  function bottle(x, y, w, h, opts) { opts = opts || {}; var s = '';
    if (opts.pump) s += '<rect x="' + (x + w * 0.42) + '" y="' + y + '" width="' + (w * 0.16) + '" height="' + (h * 0.12) + '" ' + S + '/><rect x="' + (x + w * 0.42) + '" y="' + y + '" width="' + (w * 0.4) + '" height="' + (h * 0.05) + '" rx="1" ' + S + '/>';
    else s += '<rect x="' + (x + w * 0.36) + '" y="' + y + '" width="' + (w * 0.28) + '" height="' + (h * 0.1) + '" rx="1" ' + S + '/>';
    s += '<path ' + S + ' d="M' + (x + w * 0.3) + ' ' + (y + h * 0.12) + ' h' + (w * 0.4) + ' q' + (w * 0.3) + ' 3 ' + (w * 0.3) + ' ' + (h * 0.14) + ' v' + (h * 0.68) + ' q0 ' + (h * 0.06) + ' -' + (w * 0.1) + ' ' + (h * 0.06) + ' h-' + (w * 0.8) + ' q-' + (w * 0.1) + ' 0 -' + (w * 0.1) + ' -' + (h * 0.06) + ' v-' + (h * 0.68) + ' q0 -' + (h * 0.11) + ' ' + (w * 0.3) + ' -' + (h * 0.14) + ' z"/>';
    s += '<rect x="' + (x + w * 0.12) + '" y="' + (y + h * 0.4) + '" width="' + (w * 0.76) + '" height="' + (h * 0.3) + '" fill="#fff" stroke="' + C.line + '" stroke-width="0.6"/>';
    if (opts.back) { for (var i = 0; i < 4; i++) s += '<line x1="' + (x + w * 0.18) + '" y1="' + (y + h * (0.46 + i * 0.06)) + '" x2="' + (x + w * 0.82) + '" y2="' + (y + h * (0.46 + i * 0.06)) + '" stroke="' + C.line + '" stroke-width="0.5" opacity=".5"/>'; }
    else s += txt(x + w / 2, y + h * 0.57, opts.label || 'SHAMPOO', Math.min(4.2, w / 5.5)) + (opts.sub ? txt(x + w / 2, y + h * 0.65, opts.sub, 3.2) : '');
    return s; }
  function jar(x, y, w, h, opts) { opts = opts || {}; var s = '<rect x="' + (x + w * 0.05) + '" y="' + y + '" width="' + (w * 0.9) + '" height="' + (h * 0.22) + '" rx="2" ' + S + '/>';
    s += '<rect x="' + x + '" y="' + (y + h * 0.22) + '" width="' + w + '" height="' + (h * 0.78) + '" rx="3" ' + S + '/>';
    if (opts.back) { for (var i = 0; i < 4; i++) s += '<line x1="' + (x + 5) + '" y1="' + (y + h * (0.4 + i * 0.1)) + '" x2="' + (x + w - 5) + '" y2="' + (y + h * (0.4 + i * 0.1)) + '" stroke="' + C.line + '" stroke-width="0.5" opacity=".5"/>'; }
    else s += txt(x + w / 2, y + h * 0.62, opts.label || 'WAX', 5); return s; }
  function jarTop(cx, cy, r, open) { var s = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" ' + S + '/>';
    if (open) { s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.78) + '" fill="#E8D3B8" stroke="' + C.line + '" stroke-width="0.6"/><path d="M' + (cx - r * 0.3) + ' ' + (cy + r * 0.1) + ' q' + (r * 0.3) + ' -' + (r * 0.5) + ' ' + (r * 0.6) + ' 0" fill="none" stroke="#fff" stroke-width="1.2" opacity=".8"/>'; }
    else s += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (r * 0.55) + '" fill="none" stroke="' + C.line + '" stroke-width="0.6"/>' + txt(cx, cy + 1.6, 'WAX', 4.5); return s; }
  function spray(x, y, w, h, opts) { opts = opts || {}; var s = '';
    if (opts.nozzle) s += '<rect x="' + (x + w * 0.4) + '" y="' + y + '" width="' + (w * 0.2) + '" height="' + (h * 0.1) + '" rx="1" ' + S + '/><rect x="' + (x + w * 0.3) + '" y="' + (y + h * 0.08) + '" width="' + (w * 0.4) + '" height="' + (h * 0.07) + '" ' + S + '/>';
    else s += '<rect x="' + (x + w * 0.28) + '" y="' + y + '" width="' + (w * 0.44) + '" height="' + (h * 0.15) + '" rx="2" ' + S + '/>';
    s += '<rect x="' + (x + w * 0.15) + '" y="' + (y + h * 0.15) + '" width="' + (w * 0.7) + '" height="' + (h * 0.85) + '" rx="3" ' + S + '/>';
    if (opts.back) { for (var i = 0; i < 4; i++) s += '<line x1="' + (x + w * 0.22) + '" y1="' + (y + h * (0.4 + i * 0.08)) + '" x2="' + (x + w * 0.78) + '" y2="' + (y + h * (0.4 + i * 0.08)) + '" stroke="' + C.line + '" stroke-width="0.5" opacity=".5"/>'; }
    else s += '<rect x="' + (x + w * 0.2) + '" y="' + (y + h * 0.4) + '" width="' + (w * 0.6) + '" height="' + (h * 0.25) + '" fill="#fff" stroke="' + C.line + '" stroke-width="0.6"/>' + txt(x + w / 2, y + h * 0.55, opts.label || 'SPRAY', 3.8);
    return s; }
  function pouch(x, y, w, h, opts) { opts = opts || {}; var s = '<path ' + S + ' d="M' + (x + 3) + ' ' + y + ' h' + (w - 6) + ' q3 0 3 3 v' + (h - 6) + ' q0 3 -3 3 h-' + (w - 6) + ' q-3 0 -3 -3 v-' + (h - 6) + ' q0 -3 3 -3 z"/>';
    s += '<rect x="' + (x + w * 0.62) + '" y="' + (y - 3) + '" width="' + (w * 0.14) + '" height="8" rx="1" ' + S + '/>';
    if (opts.back) { for (var i = 0; i < 5; i++) s += '<line x1="' + (x + 8) + '" y1="' + (y + 12 + i * 8) + '" x2="' + (x + w - 8) + '" y2="' + (y + 12 + i * 8) + '" stroke="' + C.line + '" stroke-width="0.5" opacity=".5"/>'; }
    else s += '<rect x="' + (x + w * 0.15) + '" y="' + (y + h * 0.3) + '" width="' + (w * 0.7) + '" height="' + (h * 0.35) + '" fill="#fff" stroke="' + C.line + '" stroke-width="0.6"/>' + txt(x + w / 2, y + h * 0.5, 'REFILL', 4.5);
    return s; }
  function dryer(x, y, w, h) { return '<path ' + S + ' d="M' + x + ' ' + (y + h * 0.15) + ' h' + (w * 0.62) + ' q' + (w * 0.2) + ' 0 ' + (w * 0.2) + ' ' + (h * 0.18) + ' v' + (h * 0.1) + ' q0 ' + (h * 0.18) + ' -' + (w * 0.2) + ' ' + (h * 0.18) + ' h-' + (w * 0.62) + ' z"/><path ' + S + ' d="M' + (x + w * 0.3) + ' ' + (y + h * 0.6) + ' l' + (w * 0.12) + ' ' + (h * 0.4) + ' h' + (w * 0.2) + ' l' + (w * 0.05) + ' -' + (h * 0.4) + ' z"/><line x1="' + (x + w * 0.82) + '" y1="' + (y + h * 0.28) + '" x2="' + (x + w * 0.82) + '" y2="' + (y + h * 0.5) + '" stroke="' + C.line + '" stroke-width="1.5"/>'; }
  function iron(x, y, w, h) { return '<path ' + S + ' d="M' + x + ' ' + (y + h * 0.35) + ' h' + (w * 0.55) + ' l' + (w * 0.45) + ' ' + (h * 0.1) + ' v' + (h * 0.1) + ' l-' + (w * 0.45) + ' ' + (h * 0.1) + ' h-' + (w * 0.55) + ' z"/><path ' + S + ' d="M' + x + ' ' + (y + h * 0.7) + ' h' + (w * 0.55) + ' l' + (w * 0.45) + ' -' + (h * 0.02) + ' v' + (h * 0.1) + ' l-' + (w * 0.45) + ' 0 h-' + (w * 0.55) + ' z"/><rect x="' + (x + w * 0.55) + '" y="' + (y + h * 0.45) + '" width="' + (w * 0.42) + '" height="' + (h * 0.24) + '" fill="#C9C2B8" stroke="' + C.line + '" stroke-width="0.6"/>'; }
  function hand(x, y) { return '<path fill="' + C.hand + '" stroke="' + C.line + '" stroke-width="0.8" d="M' + x + ' ' + y + ' q-10 2 -12 12 v18 q0 8 8 8 h18 q8 0 8 -8 v-14 q0 -3 -3 -3 q-3 0 -3 3 v-8 q0 -3 -3 -3 q-3 0 -3 3 v-3 q0 -3 -3 -3 q-3 0 -3 3 v-2 q0 -3 -2 -3 z"/>'; }
  function glove(x, y, w, h) { return '<path ' + S + ' d="M' + (x + w * 0.2) + ' ' + (y + h) + ' v-' + (h * 0.45) + ' l-' + (w * 0.15) + ' -' + (h * 0.25) + ' q-2 -4 2 -4 l' + (w * 0.2) + ' ' + (h * 0.18) + ' v-' + (h * 0.35) + ' q0 -3 3 -3 q3 0 3 3 v' + (h * 0.3) + ' v-' + (h * 0.38) + ' q0 -3 3 -3 q3 0 3 3 v' + (h * 0.38) + ' v-' + (h * 0.34) + ' q0 -3 3 -3 q3 0 3 3 v' + (h * 0.34) + ' v-' + (h * 0.25) + ' q0 -3 3 -3 q3 0 3 3 v' + (h * 0.7) + ' z"/>'; }

  // 種類 × 枚目 → 構図
  function scene(key, slot) {
    var k = key, s = '';
    var big = { x: 30, y: 15, w: 40, h: 74 }; // 枠いっぱい（底 89）
    if (k === 'colorbox') {
      if (slot === 1) s = box(28, 17, 44, 72, { num: '7-NB', name: 'COLOR' });
      else if (slot === 2) s = box(28, 17, 44, 72, { back: true });
      else if (slot === 3) s = tube(32, 17, 36, 72, { num: '7-NB' });
      else if (slot === 4) s = box(22, 30, 56, 40, { side: true, num: '7-NB' }) + txt(50, 24, '側面・上面の色番号に寄る', 3.6);
      else s = box(38, 17, 44, 72, { num: '7-NB' }) + tube(16, 33, 26, 56, { num: '7' });
    } else if (k === 'oxy') {
      if (slot === 1) s = bottle(25, 13, 50, 76, { label: 'OXY 6%', sub: '1000ml' });
      else if (slot === 2) s = bottle(25, 13, 50, 76, { back: true });
      else if (slot === 3) s = '<g transform="skewY(-6) translate(0 6)">' + bottle(27, 13, 46, 76, { label: 'OXY 6%' }) + '</g>';
      else if (slot === 4) s = '<rect x="30" y="22" width="40" height="14" rx="3" ' + S + '/><rect x="36" y="36" width="28" height="30" ' + S + '/><rect x="26" y="66" width="48" height="22" rx="2" ' + S + '/>' + txt(50, 18, '計量キャップに寄る', 3.6);
      else s = hand(48, 48) + bottle(36, 13, 32, 60, { label: 'OXY' });
    } else if (k === 'perm') {
      if (slot === 1) s = bottle(28, 13, 44, 76, { label: 'PERM 1', sub: '1剤' });
      else if (slot === 2) s = bottle(28, 13, 44, 76, { back: true });
      else if (slot === 3) s = bottle(14, 21, 34, 68, { label: '1剤' }) + bottle(52, 21, 34, 68, { label: '2剤' });
      else if (slot === 4) s = '<path ' + S + ' d="M40 28 h20 v10 l-4 6 h-12 l-4 -6 z"/><rect x="36" y="44" width="28" height="44" rx="3" ' + S + '/><line x1="50" y1="18" x2="50" y2="28" stroke="' + C.line + '" stroke-width="1"/>' + txt(50, 14, 'ノズル・注ぎ口', 3.6);
      else s = hand(48, 48) + bottle(36, 13, 32, 60, { label: '1剤' });
    } else if (k === 'bottle') {
      if (slot === 1) s = bottle(27, 12, 46, 77, { pump: true, label: 'SHAMPOO', sub: '250ml' });
      else if (slot === 2) s = bottle(27, 12, 46, 77, { pump: true, back: true });
      else if (slot === 3) s = '<g transform="skewY(-6) translate(0 6)">' + bottle(29, 12, 42, 77, { pump: true, label: 'SHAMPOO' }) + '</g>';
      else if (slot === 4) s = '<rect x="44" y="20" width="12" height="30" ' + S + '/><rect x="44" y="20" width="30" height="7" rx="2" ' + S + '/><rect x="30" y="50" width="40" height="38" rx="3" ' + S + '/>' + txt(50, 15, 'ポンプの頭に寄る', 3.6);
      else s = hand(48, 48) + bottle(36, 13, 30, 60, { pump: true, label: '250ml' });
    } else if (k === 'jar') {
      if (slot === 1) s = jar(22, 30, 56, 59, { label: 'WAX' });
      else if (slot === 2) s = jar(22, 30, 56, 59, { back: true });
      else if (slot === 3) s = jarTop(50, 50, 30, false) + txt(50, 90, '真上から', 3.6);
      else if (slot === 4) s = jarTop(50, 50, 30, true) + txt(50, 90, 'フタを開けて中身', 3.6);
      else s = hand(46, 50) + jar(30, 26, 44, 46, { label: 'WAX' });
    } else if (k === 'tube') {
      if (slot === 1) s = pouch(20, 22, 60, 62, {}) + txt(50, 94, '平置き・真上から', 3.6);
      else if (slot === 2) s = pouch(20, 22, 60, 62, { back: true });
      else if (slot === 3) s = '<g transform="skewY(-8) translate(0 8)">' + pouch(22, 22, 56, 60, {}) + '</g>';
      else if (slot === 4) s = '<rect x="40" y="22" width="20" height="16" rx="2" ' + S + '/><path ' + S + ' d="M28 38 h44 v40 q0 6 -6 6 h-32 q-6 0 -6 -6 z"/>' + txt(50, 16, '注ぎ口・キャップ', 3.6);
      else s = hand(48, 48) + pouch(30, 18, 42, 44, {});
    } else if (k === 'spray') {
      if (slot === 1) s = spray(30, 12, 40, 77, { label: 'SPRAY' });
      else if (slot === 2) s = spray(30, 12, 40, 77, { back: true });
      else if (slot === 3) s = '<g transform="skewY(-6) translate(0 6)">' + spray(31, 12, 38, 77, { label: 'SPRAY' }) + '</g>';
      else if (slot === 4) s = spray(26, 22, 48, 66, { nozzle: true, label: '' }) + txt(50, 16, 'キャップを外してノズル', 3.6);
      else s = hand(48, 48) + spray(38, 13, 28, 60, { label: '' });
    } else if (k === 'device') {
      if (slot === 1) s = dryer(20, 22, 62, 60);
      else if (slot === 2) s = '<g transform="scale(-1 1) translate(-100 0)">' + dryer(20, 22, 62, 60) + '</g><rect x="30" y="40" width="22" height="9" fill="#fff" stroke="' + C.line + '" stroke-width="0.5"/>' + txt(41, 46.5, '型番 100V', 2.8);
      else if (slot === 3) s = '<g transform="skewY(-8) translate(0 10)">' + dryer(20, 20, 62, 60) + '</g>';
      else if (slot === 4) s = iron(14, 20, 74, 60) + txt(50, 92, 'プレート・先端に寄る', 3.6);
      else s = box(12, 20, 40, 66, { num: '', name: 'BOX' }) + '<g transform="scale(.55) translate(100 60)">' + dryer(20, 22, 62, 60) + '</g><rect x="60" y="66" width="26" height="18" rx="2" ' + S + '/>' + txt(73, 77, '付属品', 3.4);
    } else if (k === 'colortube') {
      if (slot === 1) s = tube(32, 15, 36, 74, { num: 'PINK' });
      else if (slot === 2) s = tube(32, 15, 36, 74, { back: true });
      else if (slot === 3) s = '<g transform="skewY(-6) translate(0 6)">' + tube(33, 15, 34, 74, { num: 'PINK' }) + '</g>';
      else if (slot === 4) s = '<rect x="22" y="30" width="56" height="40" rx="2" ' + S + '/><rect x="28" y="36" width="18" height="18" fill="#D98FB0" stroke="' + C.line + '" stroke-width="0.5"/>' + txt(60, 48, 'PINK', 5, 'middle') + txt(50, 24, '色名・色見本に寄る', 3.6);
      else s = hand(48, 48) + tube(38, 15, 26, 58, { num: 'PINK' });
    } else if (k === 'kit') {
      if (slot === 1) s = bottle(8, 27, 26, 62, { label: 'No.1' }) + bottle(37, 27, 26, 62, { label: 'No.2' }) + bottle(66, 27, 26, 62, { label: 'No.3' });
      else if (slot === 2) s = bottle(28, 13, 44, 76, { label: 'No.1' });
      else if (slot === 3) s = bottle(28, 13, 44, 76, { back: true });
      else if (slot === 4) s = '<rect x="22" y="30" width="56" height="40" rx="2" ' + S + '/>' + txt(50, 56, 'No.1', 12) + txt(50, 24, '番号・ラベルに寄る', 3.6);
      else s = hand(48, 48) + bottle(36, 13, 32, 60, { label: 'No.1' });
    } else if (k === 'cosme') {
      var lip = function (x, y, w, h, open) { var r = '<rect x="' + x + '" y="' + (y + h * 0.45) + '" width="' + w + '" height="' + (h * 0.55) + '" rx="2" ' + S + '/>'; if (open) r += '<rect x="' + (x + w * 0.2) + '" y="' + (y + h * 0.25) + '" width="' + (w * 0.6) + '" height="' + (h * 0.22) + '" ' + S + '/><path fill="#D9556B" stroke="' + C.line + '" stroke-width="0.6" d="M' + (x + w * 0.25) + ' ' + (y + h * 0.25) + ' v-' + (h * 0.18) + ' l' + (w * 0.5) + ' -' + (h * 0.07) + ' v' + (h * 0.25) + ' z"/>'; else r += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + (h * 0.47) + '" rx="2" ' + S + '/>'; return r; };
      if (slot === 1) s = lip(38, 14, 24, 75, false) + txt(50, 70, 'CR870', 4.5);
      else if (slot === 2) s = lip(38, 14, 24, 75, false) + '<circle cx="50" cy="60" r="7" fill="#fff" stroke="' + C.line + '" stroke-width="0.6"/>' + txt(50, 61.5, '870', 3.6);
      else if (slot === 3) s = lip(38, 14, 24, 75, true);
      else if (slot === 4) s = '<rect x="18" y="20" width="64" height="60" rx="3" fill="#fff" stroke="' + C.line + '" stroke-width="0.6"/><path d="M28 50 q12 -14 24 0 t20 0" fill="none" stroke="#D9556B" stroke-width="9" stroke-linecap="round"/>' + txt(50, 92, '白い紙に塗った色', 3.6);
      else s = hand(48, 48) + lip(42, 14, 16, 58, false);
    } else if (k === 'small') {
      if (slot === 1) s = pouch(20, 20, 60, 66, {}) + txt(50, 54, 'GLOVES ×100', 4.2);
      else if (slot === 2) s = pouch(20, 20, 60, 66, { back: true });
      else if (slot === 3) s = glove(14, 30, 30, 56) + glove(40, 30, 30, 56) + glove(66, 30, 30, 56);
      else if (slot === 4) s = glove(28, 16, 46, 74);
      else s = hand(48, 48) + pouch(28, 18, 44, 46, {}) + txt(50, 42, '×100', 4);
    }
    return s;
  }
  function slotSvg(key, slot) {
    var k = BY[key] || BY.bottle;
    return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="' + C.paper + '"/>' + frame() + scene(k.key, slot) + '</svg>';
  }
  function exampleSvg(type) {
    var s = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="' + C.paper + '"/>' + frame();
    if (type === 'ok') s += bottle(27, 12, 46, 77, { pump: true, label: 'SHAMPOO' });
    else if (type === 'tilt') s += '<g transform="rotate(-14 50 50) translate(0 -4)">' + bottle(27, 16, 46, 70, { pump: true, label: 'SHAMPOO' }) + '</g>';
    else if (type === 'small') s += bottle(40, 45, 20, 34, { pump: true, label: '' });
    else if (type === 'cut') s += bottle(22, -14, 56, 100, { pump: true, label: 'SHAMPOO' });
    else if (type === 'shadow') s += '<rect x="0" y="70" width="100" height="30" fill="#D9CDBA"/><ellipse cx="62" cy="86" rx="26" ry="5" fill="#000" opacity=".25"/>' + bottle(27, 12, 46, 77, { pump: true, label: 'SHAMPOO' });
    else if (type === 'hand') s += hand(48, 48) + bottle(36, 13, 30, 60, { pump: true, label: '' });
    if (type !== 'ok') s += '<circle cx="86" cy="14" r="8" fill="#B4432F"/>' + txt(86, 17.5, '×', 9, 'middle', '#fff');
    else s += '<circle cx="86" cy="14" r="8" fill="#2E7D5B"/>' + txt(86, 17.5, '○', 8, 'middle', '#fff');
    return s + '</svg>';
  }
  root.PhotoGuide = { KINDS: KINDS, byKey: function (k) { return BY[k] || null; }, guessKind: guessKind, kindOfCategory: kindOfCategory, CATEGORY_LIST: CATEGORY_LIST, slotSvg: slotSvg, exampleSvg: exampleSvg };
})(typeof window !== 'undefined' ? window : (typeof module !== 'undefined' ? module.exports : this));

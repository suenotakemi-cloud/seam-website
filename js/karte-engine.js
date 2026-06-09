/**
 * SEAM Hair Karte v3.8 — Rule Engine
 * 21推論ルール × 4排他ルール × 16 Hair DNA タイプ
 * フロント完結・バックエンド不要
 */

'use strict';

// ============================================================
// DESIGN TOKENS (参照用)
// ============================================================
const SEAM_TOKENS = {
  colors: {
    obsidian: '#0A0A0A',
    ivory: '#F4F1EA',
    ivoryDeep: '#EDE7D7',
    champagne: '#D7C7A3',
    champagneDeep: '#B89E6F',
    smoke: '#6B6660',
    line: '#E5DFD3',
    paper: '#FDFBF5',
    crit: '#A8493E',
  }
};

// ============================================================
// 16 HAIR DNA TYPES
// ============================================================
const HAIR_DNA_TYPES = {
  'urban-mineral': {
    id: 'urban-mineral',
    name: 'Urban Mineral',
    jp: 'アーバン・ミネラル',
    essence: 'ミネラル過剰・ビルドアップ蓄積タイプ。硬水・整髪料の積み重ねが髪に無機質な重さをもたらしている。',
    palette: ['#8B9BB4', '#C4CAD4', '#4A5568'],
    motif: '都市の空気と水が髪に刻んだ地層',
    keyword: 'ビルドアップ除去・ミネラルバランス・リセット',
    tags: ['ビルドアップ', '硬水', '重さ', 'クレンズ'],
    prescriptionOrder: ['クレンジングシャンプー', 'バランシングトリートメント', '軽量スタイリング'],
    stopCare: ['ヘビーオイル毎日使い', '洗い流さないミルク重ね塗り', '低洗浄力シャンプーのみ'],
    addCare: ['週1クレンジングシャンプー', 'ミネラルウォーターリンス', '軽量ミストのみ仕上げ'],
    morning: 'ミスト → 軽量ミルク(少量) → セット。余分なオイルを足さない。',
    night: 'クレンジングシャンプー(週1) または 通常シャンプー → 軽トリートメント → 自然乾燥後ドライ',
    weekly: 'スカルプスクラブ or クレンズマスク。ミネラルオフのビネガーリンスも有効。',
    brands: ['AVEDA', 'DAVINES', 'R+Co'],
    shopNote: '「ビルドアップ除去」「クレンジングシャンプー」「ミネラルバランス」でスタッフにご相談ください。'
  },
  'phoenix-reborn': {
    id: 'phoenix-reborn',
    name: 'Phoenix Reborn',
    jp: 'フェニックス・リボーン',
    essence: 'ブリーチ残存ダメージタイプ。髪内部の空洞化が進み、潤いと強度の両立が課題。',
    palette: ['#E8C547', '#F0A500', '#8B4513'],
    motif: '炎を潜り抜けた後の再生',
    keyword: 'タンパク補充・内部充填・段階的補修',
    tags: ['ブリーチ', 'ダメージ', '空洞化', '補修'],
    prescriptionOrder: ['プロテイントリートメント', 'モイスチャートリートメント', 'ヒートプロテクト'],
    stopCare: ['高温アイロン毎日', 'アルカリシャンプー', '泡立て不足の摩擦洗い'],
    addCare: ['週2プロテイントリートメント', '低温ドライヤー習慣', 'ケラチン補充ミスト'],
    morning: 'アウトバストリートメント → アイロン前ヒートプロテクト → 低温スタイリング',
    night: '優しいシャンプー → ディープリペアトリートメント(5分放置) → ドライヤー低温',
    weekly: '自宅サロントリートメント(プロテイン系) 週1-2回。ハイライト部分は重点的に。',
    brands: ['Olaplex', 'OWAY', 'Wella SP'],
    shopNote: '「ブリーチダメージ補修」「プロテイントリートメント」「内部充填」でスタッフにご相談ください。'
  },
  'coastal-drift': {
    id: 'coastal-drift',
    name: 'Coastal Drift',
    jp: 'コースタル・ドリフト',
    essence: '根元うねり・乾燥うねりタイプ。水分コントロールの失調が波打ちの原因。',
    palette: ['#5B8DB8', '#88B4C8', '#C4DDE8'],
    motif: '潮風にゆれる波打ち際',
    keyword: '保湿・うねり制御・ヒューミクタント補充',
    tags: ['うねり', '乾燥', '根元', 'くせ毛'],
    prescriptionOrder: ['高保湿シャンプー', 'モイスチャーマスク', 'ヒューミクタントクリーム'],
    stopCare: ['タオルでゴシゴシ', 'ドライヤーなし自然乾燥(湿気環境)', '軽すぎるシャンプー'],
    addCare: ['根元からの保湿ミスト', 'スムージングクリーム', '低温ドライヤー根元引き'],
    morning: 'モイストミスト → スムージングクリーム(根元除く) → 低温ドライヤー根元引き → 冷風仕上げ',
    night: '保湿シャンプー → モイスチャートリートメント(5分) → タオルで押し拭き → ドライヤー',
    weekly: 'ディープモイストマスク(週1)。シルクナイトキャップで就寝時の乾燥防止。',
    brands: ['Davines', 'KERASTASE', 'ALIVE'],
    shopNote: '「うねり」「保湿」「スムージング」でスタッフにご相談ください。'
  },
  'sahara-scalp': {
    id: 'sahara-scalp',
    name: 'Sahara Scalp',
    jp: 'サハラ・スカルプ',
    essence: '熱ダメージ優位タイプ。ドライヤー・アイロンの蓄積熱が表皮を荒らし、パサつきと摩擦感を生む。',
    palette: ['#D4A853', '#C17F24', '#8B5E3C'],
    motif: '乾いた砂漠の大地',
    keyword: '熱保護・キューティクル修復・潤い皮膜',
    tags: ['熱ダメージ', 'アイロン', 'パサつき', 'キューティクル'],
    prescriptionOrder: ['ヒートプロテクトスプレー', 'キューティクルオイル', '低温スタイリング'],
    stopCare: ['200度以上アイロン', '濡れたままアイロン', '乾燥させてからアイロン重ね'],
    addCare: ['必ずヒートプロテクト', 'アイロン温度160度以下', 'セラミドオイル仕上げ'],
    morning: 'ヒートプロテクトスプレー → アイロン(160度以下) → セラミドオイル(毛先のみ)',
    night: '低刺激シャンプー → リペアトリートメント → 完全乾燥(根元から毛先へ)',
    weekly: 'ホットオイルトリートメント(週1)。アイロンなし日を週2以上設ける。',
    brands: ['GHD', 'OWAY', 'LEBEL'],
    shopNote: '「熱ダメージ」「ヒートプロテクト」「キューティクル補修」でスタッフにご相談ください。'
  },
  'aurora-gloss': {
    id: 'aurora-gloss',
    name: 'Aurora Gloss',
    jp: 'オーロラ・グロス',
    essence: 'カラー黄ばみ・退色タイプ。アンダートーンの黄味が出やすく、ツヤと発色の維持が鍵。',
    palette: ['#9B59B6', '#6C3483', '#D7BDE2'],
    motif: 'オーロラの光が髪に宿る',
    keyword: 'カラーキープ・紫シャンプー・pH管理',
    tags: ['カラー', '黄ばみ', '退色', 'ブロンド'],
    prescriptionOrder: ['パープルシャンプー(週2)', 'カラーキープトリートメント', 'UVプロテクト'],
    stopCare: ['毎日パープルシャンプー(過剰)', '塩素プールで紫外線', '高温シャワー'],
    addCare: ['パープルシャンプー週2', 'アシッドリンス', 'UVスプレー外出前'],
    morning: 'UVプロテクトスプレー → 保護スタイリング(乳液系) → 外出',
    night: '通常 or パープルシャンプー → カラーキープトリートメント → 低温乾燥',
    weekly: 'パープルシャンプー(10分放置) × 週2回。グロスリンスでツヤ補充。',
    brands: ['Fanola', 'Schwarzkopf', 'R+Co'],
    shopNote: '「カラーキープ」「黄ばみ対策」「パープルシャンプー」でスタッフにご相談ください。'
  },
  'twilight-smoke': {
    id: 'twilight-smoke',
    name: 'Twilight Smoke',
    jp: 'トワイライト・スモーク',
    essence: 'ボリューム喪失・細毛タイプ。毛髪密度の低下と重力に負ける柔らかさが特徴。',
    palette: ['#7F8C8D', '#95A5A6', '#BDC3C7'],
    motif: '夕暮れにたなびく煙のような繊細さ',
    keyword: 'ボリュームアップ・スカルプケア・軽量処方',
    tags: ['ボリューム', '細毛', 'ペタンコ', 'スカルプ'],
    prescriptionOrder: ['ボリュームシャンプー', 'スカルプトニック', '軽量スタイリング'],
    stopCare: ['重いオイル', 'コンディショナー根元付け', 'ドライヤーなし'],
    addCare: ['頭皮マッサージ毎日', '根元立ち上げスプレー', '軽量ムース'],
    morning: '根元リフトスプレー → ドライヤー根元から上向きに → 軽量ワックス(毛先のみ)',
    night: 'スカルプシャンプー → 軽量トリートメント(毛先のみ) → スカルプマッサージ → 完全乾燥',
    weekly: 'スカルプエッセンス(週3-4回)。頭皮ケア特化マスク月1。',
    brands: ['KERASTASE', 'Nioxin', 'AUJUA'],
    shopNote: '「ボリュームアップ」「スカルプケア」「細毛対策」でスタッフにご相談ください。'
  },
  'wabi-sabi': {
    id: 'wabi-sabi',
    name: 'Wabi Sabi',
    jp: 'ワビ・サビ',
    essence: '頭皮エイジングタイプ。皮脂・水分バランスの変化が、毛質・ハリ・においに影響。',
    palette: ['#8D7B68', '#A5957E', '#C4B5A2'],
    motif: '時を経た素材の深みと味わい',
    keyword: '頭皮エイジングケア・抗酸化・皮脂バランス',
    tags: ['エイジング', '頭皮', '皮脂', 'ハリ'],
    prescriptionOrder: ['エイジングケアシャンプー', 'スカルプエッセンス', 'アンチエイジングトリートメント'],
    stopCare: ['強い洗浄シャンプー毎日', '頭皮ケア後のすすぎ不足', '熱すぎるシャワー'],
    addCare: ['頭皮抗酸化エッセンス', '低刺激エイジングシャンプー', 'マッサージブラシ'],
    morning: '軽量スタイリング → 頭皮UVケア(夏季)',
    night: 'エイジングケアシャンプー → スカルプエッセンス → トリートメント(毛先) → 完全乾燥',
    weekly: 'スカルプデトックスパック(週1)。食事で亜鉛・ビオチン補充も。',
    brands: ['AUJUA', 'TOKIO', 'Davines'],
    shopNote: '「エイジングケア」「頭皮環境」「ハリコシ」でスタッフにご相談ください。'
  },
  'garden-rain': {
    id: 'garden-rain',
    name: 'Garden Rain',
    jp: 'ガーデン・レイン',
    essence: '産後・ホルモン変動タイプ。急激な抜け毛と髪質変化に適した穏やかなケアが必要。',
    palette: ['#82B366', '#9DC88D', '#D5E8D4'],
    motif: '雨上がりの庭に芽吹く新芽',
    keyword: '産後ケア・低刺激・育毛サポート',
    tags: ['産後', 'ホルモン', '抜け毛', '低刺激'],
    prescriptionOrder: ['無添加シャンプー', '育毛エッセンス', '低刺激トリートメント'],
    stopCare: ['強い薬剤処理', '無理なカラー・パーマ', '頭皮を強くこする'],
    addCare: ['低刺激スカルプシャンプー', '育毛サポートエッセンス', 'やさしいブラッシング'],
    morning: 'やさしいブラッシング → 軽量スタイリング(赤ちゃんへの安全配慮)',
    night: '低刺激シャンプー → 育毛エッセンス → やさしいマッサージ → 完全乾燥',
    weekly: '頭皮クレンジング(低刺激)(月2回)。ストレスケアも抜け毛対策に有効。',
    brands: ['NATULIQUE', 'Oway', 'AVEDA'],
    shopNote: '「産後ケア」「育毛」「低刺激」でスタッフにご相談ください。授乳中でも使えるものを選びます。'
  },
  'sun-bleached': {
    id: 'sun-bleached',
    name: 'Sun Bleached',
    jp: 'サン・ブリーチド',
    essence: 'UV・塩素ダメージタイプ。外的酸化ストレスが退色と乾燥を加速させている。',
    palette: ['#F4D03F', '#E8B84B', '#D4A017'],
    motif: '陽光に晒され輝く麦わら',
    keyword: 'UV対策・抗酸化・水分補給',
    tags: ['UV', '日焼け', '塩素', '退色'],
    prescriptionOrder: ['UVプロテクトスプレー', '抗酸化トリートメント', '高保湿ミスト'],
    stopCare: ['ノーケアでの長時間外出', 'プール後のすすぎ不足', '日中アイロン'],
    addCare: ['外出前UVスプレー', 'プール後即シャンプー', 'ビタミンCトリートメント'],
    morning: 'UVプロテクトスプレー → 保護スタイリング → 帽子・スカーフ活用',
    night: '酸化除去シャンプー → ディープモイストトリートメント → 低温乾燥',
    weekly: '抗酸化マスク(週1)。夏季は週2に増加。塩素除去シャワーヘッドも検討。',
    brands: ['OWAY', 'Wella SP', 'KERASTASE'],
    shopNote: '「UV対策」「日焼けダメージ」「抗酸化ケア」でスタッフにご相談ください。'
  },
  'velvet-porous': {
    id: 'velvet-porous',
    name: 'Velvet Porous',
    jp: 'ベルベット・ポーラス',
    essence: '多孔質・過吸収タイプ。開いたキューティクルが水分と薬剤を過吸収し、べたつきと乾燥が共存。',
    palette: ['#8E44AD', '#9B59B6', '#C39BD3'],
    motif: 'ビロードのような吸収力',
    keyword: 'キューティクル封入・pH調整・軽量補修',
    tags: ['多孔質', 'ダメージ', 'べたつき', '吸収過多'],
    prescriptionOrder: ['アシッドリンス', 'タンパク質補充トリートメント', 'キューティクルシーラー'],
    stopCare: ['アルカリ性製品の重ね使い', '毎日ヘビーマスク', '放置しすぎ'],
    addCare: ['酸性シャンプー', 'ケラチン系トリートメント', '冷水リンス仕上げ'],
    morning: 'キューティクルオイル(少量) → 低温スタイリング',
    night: '酸性シャンプー → 3分プロテイントリートメント → 冷水リンス → 低温乾燥',
    weekly: 'ケラチントリートメント(週1)。放置15分で効果最大化。',
    brands: ['Olaplex', 'Schwarzkopf', 'LEBEL'],
    shopNote: '「多孔質」「ダメージ補修」「キューティクル」でスタッフにご相談ください。'
  },
  'wild-coil-resilient': {
    id: 'wild-coil-resilient',
    name: 'Wild Coil Resilient',
    jp: 'ワイルド・コイル',
    essence: 'パーマだれ・コイル復元タイプ。ウェーブの弾力が落ち、スタイルが1日持たない状態。',
    palette: ['#27AE60', '#2ECC71', '#A9DFBF'],
    motif: '野生の弦のような弾力',
    keyword: 'カール復元・水分保持・ウェーブ定着',
    tags: ['パーマ', 'うねり', 'カール', 'ウェーブ'],
    prescriptionOrder: ['カール専用シャンプー', 'ウェーブリバイバーミスト', 'カールクリーム'],
    stopCare: ['ブラシでとかす', '泡立て強めシャンプー', 'タオルでゴシゴシ'],
    addCare: ['スクランチ乾燥法', 'カール用ムース', 'リフレッシュウォーター'],
    morning: 'ウェーブリバイバーミスト → カールクリーム(スクランチ) → ディフューザー乾燥',
    night: 'カール専用シャンプー → ディープコンディショナー → スクランチタオル → ディフューザー',
    weekly: 'プロテイントリートメント(週1)でコイル強度を保つ。パーマ後6週以降に検討。',
    brands: ['Ouidad', 'Devacurl', 'Davines'],
    shopNote: '「パーマ」「カール復元」「ウェーブケア」でスタッフにご相談ください。'
  },
  'moonlit-veil': {
    id: 'moonlit-veil',
    name: 'Moonlit Veil',
    jp: 'ムーンリット・ヴェール',
    essence: '細毛・季節乾燥タイプ。繊細な毛径が季節の乾燥を受けやすく、静電気とパサつきが悩み。',
    palette: ['#AEB6BF', '#CBD4DC', '#EBF5FB'],
    motif: '月明かりに透ける薄いヴェール',
    keyword: '静電気防止・超軽量保湿・繊細ケア',
    tags: ['細毛', '乾燥', '静電気', '季節'],
    prescriptionOrder: ['超軽量保湿シャンプー', 'アンチスタティックミスト', '軽量モイストクリーム'],
    stopCare: ['重いオイル', 'ヘビーマスク頻用', 'プラスチックブラシ'],
    addCare: ['天然ブリッスルブラシ', 'アンチスタティックスプレー', '超軽量アウトバス'],
    morning: 'アンチスタティックミスト → 軽量モイストクリーム → 天然ブリッスルブラシで整える',
    night: '保湿シャンプー → 軽量コンディショナー → 完全乾燥(根元から)',
    weekly: '加湿器の使用。シルク枕カバーで摩擦・静電気を軽減。',
    brands: ['Bumble and bumble', 'AUJUA', 'KERASTASE'],
    shopNote: '「細毛」「静電気対策」「乾燥ケア」でスタッフにご相談ください。'
  },
  'midnight-silk': {
    id: 'midnight-silk',
    name: 'Midnight Silk',
    jp: 'ミッドナイト・シルク',
    essence: '健康維持・予防フェーズ。現状の良好な髪質を守りながら、将来のダメージを先手で防ぐ。',
    palette: ['#1A1A2E', '#16213E', '#0F3460'],
    motif: '夜の絹のような静かな光沢',
    keyword: '予防ケア・維持・ベースライン向上',
    tags: ['健康', '予防', '維持', 'ツヤ'],
    prescriptionOrder: ['バランスシャンプー', 'メンテナンストリートメント', '軽量プロテクト'],
    stopCare: ['ケア過剰(オーバートリートメント)', '毎日ヘビートリートメント'],
    addCare: ['週1メンテナンストリートメント', 'UVケア習慣', '食事・睡眠管理'],
    morning: '軽量スタイリング → UVスプレー(外出時)',
    night: 'バランスシャンプー → 軽量コンディショナー → 完全乾燥',
    weekly: '週1トリートメント。栄養バランスの良い食事で内側からもケア。',
    brands: ['Davines', 'AVEDA', 'Wella SP'],
    shopNote: '「維持」「ツヤケア」「予防的ケア」でスタッフにご相談ください。'
  },
  'bronze-ember': {
    id: 'bronze-ember',
    name: 'Bronze Ember',
    jp: 'ブロンズ・エンバー',
    essence: '退色加速タイプ。カラーの色持ちが悪く、2〜3週間で退色が目立つ状態。',
    palette: ['#CA6F1E', '#E59866', '#FAD7A0'],
    motif: 'くすぶる炎のような深みある色',
    keyword: 'カラー退色防止・閉鎖処理・酸性ケア',
    tags: ['退色', 'カラー', 'フェード', '色持ち'],
    prescriptionOrder: ['カラーキープシャンプー', 'グロスリンス', '低温スタイリング'],
    stopCare: ['高温シャワー', 'アルカリシャンプー', 'カラー翌日シャンプー'],
    addCare: ['カラー後48時間シャンプー我慢', 'カラーキープシャンプー', 'グロストリートメント'],
    morning: 'カラープロテクトスプレー → 低温スタイリング',
    night: 'カラーキープシャンプー(ぬるま湯) → カラートリートメント → 低温乾燥',
    weekly: 'グロスリンス(週1)。カラーリタッチ間隔を延ばすための集中ケア。',
    brands: ['Schwarzkopf', 'Wella', 'KERASTASE'],
    shopNote: '「色持ち」「退色防止」「カラーキープ」でスタッフにご相談ください。'
  },
  'steel-resolve': {
    id: 'steel-resolve',
    name: 'Steel Resolve',
    jp: 'スチール・リゾルブ',
    essence: '剛毛・重さタイプ。太く硬い毛質がスタイルを重くし、まとまりにくさの原因に。',
    palette: ['#616A6B', '#808B96', '#AAB7B8'],
    motif: '鋼のような強さと重さ',
    keyword: '軟化・ソフトニング・重力制御',
    tags: ['剛毛', '硬毛', '重い', 'まとまらない'],
    prescriptionOrder: ['ソフトニングシャンプー', 'ヘビーコンディショナー', 'スムージングクリーム'],
    stopCare: ['ボリュームアップシャンプー', '軽量すぎるスタイリング', '乾燥したままのスタイリング'],
    addCare: ['ディープコンディショニング週2', 'ホットオイル処理', 'スムージングクリーム'],
    morning: 'スムージングクリーム(全体) → ドライヤー + ブラシでストレートに',
    night: 'ソフトニングシャンプー → ヘビーコンディショナー(5分) → 完全乾燥',
    weekly: 'ホットオイルトリートメント(週1)。縮毛矯正・髪質改善トリートメント相談も。',
    brands: ['TOKIO', 'LEBEL', 'Milbon'],
    shopNote: '「剛毛」「ストレートケア」「まとまり」でスタッフにご相談ください。'
  },
  'crystal-bloom': {
    id: 'crystal-bloom',
    name: 'Crystal Bloom',
    jp: 'クリスタル・ブルーム',
    essence: '予防・ブルーム期タイプ。悩みが少ない現在が最大のチャンス。先手のケアで10年後の髪質を変える。',
    palette: ['#85C1E9', '#AED6F1', '#D6EAF8'],
    motif: '清らかな水晶が花開くように',
    keyword: '先行投資ケア・ツヤ磨き・長期維持',
    tags: ['予防', 'ツヤ', '健康', '先行投資'],
    prescriptionOrder: ['ニュートリションシャンプー', 'グロストリートメント', 'UVプロテクト'],
    stopCare: ['ケアの手抜き', '紫外線ノーケア', '睡眠不足'],
    addCare: ['週1グロスマスク', 'UVケア継続', '頭皮マッサージ習慣'],
    morning: 'グロスミスト → 軽量スタイリング → UVスプレー',
    night: 'ニュートリションシャンプー → グロストリートメント → 完全乾燥',
    weekly: '週1グロスマスクで輝きを最大化。食事・睡眠・ストレスケアも並行して。',
    brands: ['AVEDA', 'Davines', 'LEBEL'],
    shopNote: '「ツヤ磨き」「予防ケア」「長期ヘアケア設計」でスタッフにご相談ください。'
  }
};

// ============================================================
// 21 INFERENCE RULES
// ============================================================
const RULES = [
  {
    id: 'R01',
    name: 'ブリーチ残存ダメージ',
    priority: 'CRITICAL',
    priority_score: 100,
    weight: 1.0,
    dna: 'phoenix-reborn',
    all_of: [
      (q) => q.q3 && (q.q3.includes('bleach') || q.q3.includes('color')),
      (q) => q.q4 && (q.q4.includes('s1') || q.q4.includes('s5'))
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('damage'),
      (q) => q.q7 && q.q7.includes('iron')
    ],
    boost: [
      { condition: (q) => q.q8 && q.q8 === 'bleach_heavy', value: 0.2 },
      { condition: (q) => q.q3 && q.q3.includes('bleach'), value: 0.15 }
    ],
    excludes: []
  },
  {
    id: 'R02',
    name: '根元うねり・乾燥うねり',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'coastal-drift',
    all_of: [
      (q) => q.q2 && (q.q2.includes('wavy') || q.q2.includes('curly')),
      (q) => q.q4 && q.q4.includes('s3')
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('frizz'),
      (q) => q.q5 && q.q5.includes('dry')
    ],
    boost: [
      { condition: (q) => q.q9 && q.q9.includes('humid'), value: 0.15 }
    ],
    excludes: []
  },
  {
    id: 'R03',
    name: 'パーマだれ・コイル復元',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'wild-coil-resilient',
    all_of: [
      (q) => q.q3 && q.q3.includes('perm'),
      (q) => q.q4 && (q.q4.includes('s3') || q.q4.includes('s6'))
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('curl'),
      (q) => q.q6 && q.q6.includes('natural')
    ],
    boost: [
      { condition: (q) => q.q10 && q.q10.includes('curl_cream'), value: 0.1 }
    ],
    excludes: []
  },
  {
    id: 'R04',
    name: '髪質改善・ストレート処理残存',
    priority: 'CRITICAL',
    priority_score: 100,
    weight: 1.0,
    dna: 'steel-resolve',
    all_of: [
      (q) => q.q3 && (q.q3.includes('straight') || q.q3.includes('treatment')),
      (q) => q.q4 && q.q4.includes('s2')
    ],
    any_of: [
      (q) => q.q2 && q.q2.includes('thick'),
      (q) => q.q1 && q.q1.includes('heavy')
    ],
    boost: [
      { condition: (q) => q.q8 && q.q8 === 'bleach_heavy', value: 0.1 }
    ],
    excludes: ['R01']
  },
  {
    id: 'R05',
    name: 'ビルドアップ蓄積',
    priority: 'CRITICAL',
    priority_score: 100,
    weight: 1.0,
    dna: 'urban-mineral',
    all_of: [
      (q) => q.q4 && q.q4.includes('s4'),
      (q) => q.q10 && (q.q10.includes('heavy_oil') || q.q10.includes('styling'))
    ],
    any_of: [
      (q) => q.q5 && q.q5.includes('oily'),
      (q) => q.q1 && q.q1.includes('buildup')
    ],
    boost: [
      { condition: (q) => q.q9 && q.q9.includes('hard_water'), value: 0.2 }
    ],
    excludes: ['R19', 'R14']
  },
  {
    id: 'R06',
    name: '熱ダメージ蓄積',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'sahara-scalp',
    all_of: [
      (q) => q.q7 && (q.q7.includes('iron') || q.q7.includes('high_heat')),
      (q) => q.q4 && (q.q4.includes('s1') || q.q4.includes('s2'))
    ],
    any_of: [
      (q) => q.q1 && (q.q1.includes('damage') || q.q1.includes('dry')),
      (q) => q.q6 && q.q6.includes('smooth')
    ],
    boost: [
      { condition: (q) => q.q7 && q.q7.includes('daily'), value: 0.15 }
    ],
    excludes: []
  },
  {
    id: 'R07',
    name: 'UV・塩素外的ダメージ',
    priority: 'MEDIUM',
    priority_score: 40,
    weight: 1.0,
    dna: 'sun-bleached',
    all_of: [
      (q) => q.q4 && (q.q4.includes('s1') || q.q4.includes('s8'))
    ],
    any_of: [
      (q) => q.q9 && (q.q9.includes('outdoor') || q.q9.includes('pool')),
      (q) => q.q1 && q.q1.includes('color_fade')
    ],
    boost: [
      { condition: (q) => q.q9 && q.q9.includes('outdoor'), value: 0.15 },
      { condition: (q) => q.q9 && q.q9.includes('pool'), value: 0.1 }
    ],
    excludes: []
  },
  {
    id: 'R08',
    name: '退色加速',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'bronze-ember',
    all_of: [
      (q) => q.q3 && q.q3.includes('color'),
      (q) => q.q4 && q.q4.includes('s8')
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('color_fade'),
      (q) => q.q7 && q.q7.includes('iron')
    ],
    boost: [
      { condition: (q) => q.q9 && q.q9.includes('outdoor'), value: 0.1 }
    ],
    excludes: []
  },
  {
    id: 'R09',
    name: 'カラー黄ばみ',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'aurora-gloss',
    all_of: [
      (q) => q.q3 && (q.q3.includes('bleach') || q.q3.includes('color')),
      (q) => q.q4 && q.q4.includes('s5')
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('color_fade'),
      (q) => q.q6 && q.q6.includes('glossy')
    ],
    boost: [
      { condition: (q) => q.q8 && q.q8 === 'bleach_heavy', value: 0.2 }
    ],
    excludes: ['R08']
  },
  {
    id: 'R10',
    name: '頭皮エイジング',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'wabi-sabi',
    all_of: [
      (q) => q.q5 && (q.q5.includes('aging') || q.q5.includes('sensitive')),
      (q) => q.q4 && (q.q4.includes('s6') || q.q4.includes('s7'))
    ],
    any_of: [
      (q) => q.q1 && (q.q1.includes('thinning') || q.q1.includes('aging')),
      (q) => q.q11 && q.q11.includes('aging')
    ],
    boost: [
      { condition: (q) => q.q11 && q.q11.includes('aging'), value: 0.15 }
    ],
    excludes: []
  },
  {
    id: 'R11',
    name: 'ダメージ複合型',
    priority: 'HIGH',
    priority_score: 70,
    weight: 0.9,
    dna: 'velvet-porous',
    all_of: [
      (q) => q.q4 && q.q4.length >= 3,
      (q) => q.q3 && (q.q3.includes('color') || q.q3.includes('bleach') || q.q3.includes('perm'))
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('damage'),
      (q) => q.q7 && q.q7.includes('iron')
    ],
    boost: [
      { condition: (q) => q.q4 && q.q4.length >= 4, value: 0.15 }
    ],
    excludes: []
  },
  {
    id: 'R12',
    name: '産後・ホルモン変動',
    priority: 'CRITICAL',
    priority_score: 100,
    weight: 1.0,
    dna: 'garden-rain',
    all_of: [
      (q) => q.q11 && q.q11.includes('postpartum'),
      (q) => q.q4 && q.q4.includes('s7')
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('thinning'),
      (q) => q.q5 && q.q5.includes('sensitive')
    ],
    boost: [
      { condition: (q) => q.q4 && q.q4.includes('s7'), value: 0.2 }
    ],
    excludes: ['R10']
  },
  {
    id: 'R13',
    name: '細毛・季節乾燥',
    priority: 'MEDIUM',
    priority_score: 40,
    weight: 1.0,
    dna: 'moonlit-veil',
    all_of: [
      (q) => q.q2 && q.q2.includes('fine'),
      (q) => q.q4 && q.q4.includes('s3')
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('dry'),
      (q) => q.q9 && q.q9.includes('dry_climate')
    ],
    boost: [
      { condition: (q) => q.q9 && q.q9.includes('dry_climate'), value: 0.1 },
      { condition: (q) => {
        const month = new Date().getMonth() + 1;
        return month >= 11 || month <= 2;
      }, value: 0.1 }
    ],
    excludes: []
  },
  {
    id: 'R14',
    name: '多孔質・過吸収',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'velvet-porous',
    all_of: [
      (q) => q.q4 && (q.q4.includes('s1') && q.q4.includes('s4'))
    ],
    any_of: [
      (q) => q.q1 && (q.q1.includes('damage') || q.q1.includes('sticky')),
      (q) => q.q3 && (q.q3.includes('bleach') || q.q3.includes('color'))
    ],
    boost: [
      { condition: (q) => q.q10 && q.q10.includes('heavy_oil'), value: 0.1 }
    ],
    excludes: []
  },
  {
    id: 'R15',
    name: 'ボリューム喪失',
    priority: 'HIGH',
    priority_score: 70,
    weight: 1.0,
    dna: 'twilight-smoke',
    all_of: [
      (q) => q.q2 && q.q2.includes('fine'),
      (q) => q.q4 && q.q4.includes('s6')
    ],
    any_of: [
      (q) => q.q1 && (q.q1.includes('volume') || q.q1.includes('flat')),
      (q) => q.q6 && q.q6.includes('volume')
    ],
    boost: [
      { condition: (q) => q.q11 && q.q11.includes('aging'), value: 0.15 }
    ],
    excludes: []
  },
  {
    id: 'R16',
    name: '剛毛・重さ',
    priority: 'MEDIUM',
    priority_score: 40,
    weight: 1.0,
    dna: 'steel-resolve',
    all_of: [
      (q) => q.q2 && q.q2.includes('thick'),
      (q) => q.q4 && q.q4.includes('s2')
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('heavy'),
      (q) => q.q6 && q.q6.includes('smooth')
    ],
    boost: [],
    excludes: []
  },
  {
    id: 'R17',
    name: 'ツヤ・グロス欠如',
    priority: 'MEDIUM',
    priority_score: 40,
    weight: 0.9,
    dna: 'crystal-bloom',
    all_of: [
      (q) => q.q4 && q.q4.includes('s2'),
      (q) => q.q6 && q.q6.includes('glossy')
    ],
    any_of: [
      (q) => q.q1 && (q.q1.includes('dull') || q.q1.includes('dry')),
      (q) => q.q3 && q.q3.includes('none')
    ],
    boost: [],
    excludes: []
  },
  {
    id: 'R18',
    name: 'ボリューム・剛毛複合',
    priority: 'MEDIUM',
    priority_score: 40,
    weight: 0.9,
    dna: 'twilight-smoke',
    all_of: [
      (q) => q.q4 && q.q4.includes('s6'),
      (q) => q.q2 && (q.q2.includes('thick') || q.q2.includes('fine'))
    ],
    any_of: [
      (q) => q.q1 && (q.q1.includes('volume') || q.q1.includes('heavy')),
    ],
    boost: [],
    excludes: []
  },
  {
    id: 'R19',
    name: '整髪料依存・重さ',
    priority: 'LOW',
    priority_score: 10,
    weight: 0.8,
    dna: 'urban-mineral',
    all_of: [
      (q) => q.q10 && (q.q10.includes('heavy_oil') || q.q10.includes('wax'))
    ],
    any_of: [
      (q) => q.q4 && q.q4.includes('s4'),
      (q) => q.q1 && q.q1.includes('buildup')
    ],
    boost: [],
    excludes: []
  },
  {
    id: 'R20',
    name: '健康・予防フェーズ',
    priority: 'LOW',
    priority_score: 10,
    weight: 0.8,
    dna: 'midnight-silk',
    all_of: [
      (q) => q.q4 && q.q4.length === 0
    ],
    any_of: [
      (q) => q.q1 && q.q1.includes('none'),
      (q) => !q.q1 || q.q1.length === 0
    ],
    boost: [],
    excludes: []
  },
  {
    id: 'R21',
    name: '先行投資・ブルーム期',
    priority: 'LOW',
    priority_score: 10,
    weight: 0.8,
    dna: 'crystal-bloom',
    all_of: [
      (q) => q.q4 && (q.q4.length === 0 || (q.q4.length === 1 && q.q4.includes('s0')))
    ],
    any_of: [
      (q) => q.q6 && q.q6.includes('glossy'),
      (q) => q.q11 && q.q11.includes('none')
    ],
    boost: [],
    excludes: []
  }
];

// ============================================================
// RULE ENGINE CORE
// ============================================================
class KarteEngine {
  constructor() {
    this.rules = RULES;
    this.dnaTypes = HAIR_DNA_TYPES;
  }

  /**
   * メインエントリ：回答データを受け取り診断結果を返す
   * @param {Object} answers - Q1〜Q12の回答
   * @param {boolean} isLiteMode - Liteモード（Q8〜Q12未回答）
   * @returns {Object} 診断結果
   */
  evaluate(answers, isLiteMode = false) {
    const q = this._normalizeAnswers(answers);
    const firedRules = this._evaluateRules(q, isLiteMode);
    const sorted = this._sortRules(firedRules);
    const top3 = sorted.slice(0, 3);
    const dna = this._resolveDNA(top3);
    const karteId = this._generateKarteId();

    return {
      karteId,
      primaryDNA: dna.primary,
      subDNA: dna.sub,
      firedRules: top3,
      allFiredRules: sorted,
      isLiteMode,
      timestamp: Date.now(),
      answers: q
    };
  }

  /**
   * 回答データの正規化
   */
  _normalizeAnswers(answers) {
    return {
      q1: answers.q1 || [],
      q2: answers.q2 ? (Array.isArray(answers.q2) ? answers.q2 : [answers.q2]) : [],
      q3: answers.q3 || [],
      q4: answers.q4 || [],
      q5: answers.q5 ? (Array.isArray(answers.q5) ? answers.q5 : [answers.q5]) : [],
      q6: answers.q6 ? (Array.isArray(answers.q6) ? answers.q6 : [answers.q6]) : [],
      q7: answers.q7 ? (Array.isArray(answers.q7) ? answers.q7 : [answers.q7]) : [],
      q8: answers.q8 || null,
      q9: answers.q9 || [],
      q10: answers.q10 || [],
      q11: answers.q11 || [],
      q12: answers.q12 || null
    };
  }

  /**
   * 全21ルールを評価
   */
  _evaluateRules(q, isLiteMode) {
    const results = [];

    for (const rule of this.rules) {
      let confidence = 0;

      // all_of: 全条件を満たす場合 +0.5
      const allOfPass = rule.all_of.every(cond => {
        try { return cond(q); } catch(e) { return false; }
      });
      if (!allOfPass) continue; // all_ofが通らなければスキップ

      confidence += 0.5;

      // any_of: いずれか通過で +0.25
      const anyOfPass = rule.any_of.some(cond => {
        try { return cond(q); } catch(e) { return false; }
      });
      if (anyOfPass) confidence += 0.25;

      // boost: 追加点
      for (const boost of rule.boost) {
        try {
          if (boost.condition(q)) confidence += boost.value;
        } catch(e) {}
      }

      // Liteモードは confidence を 0.70 にキャップ
      if (isLiteMode) confidence = Math.min(confidence, 0.70);

      // confidence ≥ 0.5 で発火
      if (confidence >= 0.5) {
        const final_score = rule.priority_score * confidence * rule.weight;
        results.push({
          ...rule,
          confidence,
          final_score
        });
      }
    }

    // 排他ルール適用
    return this._applyExclusions(results);
  }

  /**
   * 排他ルール適用（4ケース）
   * R05 fires → R19, R14 抑制
   * R09 fires → R08 抑制
   * R04 fires → R01 抑制
   * R12 fires → R10 抑制
   */
  _applyExclusions(firedRules) {
    const firedIds = new Set(firedRules.map(r => r.id));
    const suppressed = new Set();

    // 排他ルールを収集
    for (const rule of firedRules) {
      if (rule.excludes && rule.excludes.length > 0) {
        for (const exId of rule.excludes) {
          if (firedIds.has(exId)) {
            suppressed.add(exId);
          }
        }
      }
    }

    return firedRules.filter(r => !suppressed.has(r.id));
  }

  /**
   * ソート
   * 第1キー: priority_score (CRITICAL=100, HIGH=70, MEDIUM=40, LOW=10)
   * 第2キー: confidence
   * 第3キー: rule_id (決定論的)
   */
  _sortRules(firedRules) {
    return [...firedRules].sort((a, b) => {
      if (b.final_score !== a.final_score) return b.final_score - a.final_score;
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return a.id.localeCompare(b.id);
    });
  }

  /**
   * 16 Hair DNA への重み付き投票
   * Primary DNA: 最高スコア
   * Sub DNA: スコア差20%以内のとき併記
   */
  _resolveDNA(top3) {
    if (top3.length === 0) {
      return {
        primary: this.dnaTypes['midnight-silk'],
        sub: null
      };
    }

    const primary = this.dnaTypes[top3[0].dna] || this.dnaTypes['midnight-silk'];
    let sub = null;

    // スコア差20%以内かつ異なるDNA
    if (top3.length >= 2 && top3[1].dna !== top3[0].dna) {
      const diff = (top3[0].final_score - top3[1].final_score) / top3[0].final_score;
      if (diff <= 0.20) {
        sub = this.dnaTypes[top3[1].dna] || null;
      }
    }

    return { primary, sub };
  }

  /**
   * カルテID生成
   */
  _generateKarteId() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `SK-${timestamp}-${rand}`;
  }
}

// ============================================================
// QUIZ QUESTIONS DEFINITION
// ============================================================
const QUIZ_QUESTIONS = [
  {
    id: 'q1',
    step: 1,
    label: 'Q1',
    title: '一番気になるお悩みは？',
    subtitle: '当てはまるものをすべて選んでください',
    type: 'multi',
    required: true,
    options: [
      { value: 'damage', label: 'ダメージ・切れ毛', icon: '✂️' },
      { value: 'dry', label: 'パサつき・乾燥', icon: '🌵' },
      { value: 'frizz', label: 'くせ・うねり', icon: '🌊' },
      { value: 'volume', label: 'ボリューム不足', icon: '🪶' },
      { value: 'heavy', label: '重さ・まとまらない', icon: '⚓' },
      { value: 'color_fade', label: '色落ち・退色', icon: '🎨' },
      { value: 'thinning', label: '抜け毛・薄毛', icon: '🌱' },
      { value: 'buildup', label: 'べたつき・重さ', icon: '💧' },
      { value: 'aging', label: 'エイジングサイン', icon: '⏳' },
      { value: 'dull', label: 'ツヤがない', icon: '✨' },
      { value: 'curl', label: 'パーマがとれやすい', icon: '🌀' },
      { value: 'none', label: '特にない（予防したい）', icon: '🛡️' }
    ]
  },
  {
    id: 'q2',
    step: 2,
    label: 'Q2',
    title: '髪の長さとクセを教えてください',
    subtitle: 'あなたの髪質に近い組み合わせを選んでください',
    type: 'matrix',
    required: true,
    rows: [
      { value: 'short', label: 'ショート' },
      { value: 'medium', label: 'ミディアム' },
      { value: 'long', label: 'ロング' }
    ],
    cols: [
      { value: 'straight', label: 'ストレート', sub: 'クセなし' },
      { value: 'wavy', label: 'ウェーブ', sub: '少しクセあり' },
      { value: 'curly', label: 'カーリー', sub: 'クセが強い' }
    ],
    // 追加属性（毛量・毛の太さ）
    extraOptions: [
      {
        key: 'thickness',
        label: '毛の太さ',
        options: [
          { value: 'fine', label: '細め' },
          { value: 'medium', label: '普通' },
          { value: 'thick', label: '太め・多い' }
        ]
      }
    ]
  },
  {
    id: 'q3',
    step: 3,
    label: 'Q3',
    title: '過去6ヶ月以内の施術履歴は？',
    subtitle: '該当するものをすべて選んでください',
    type: 'multi',
    required: true,
    options: [
      { value: 'none', label: 'カットのみ / なし', icon: '✂️' },
      { value: 'color', label: 'カラー（ヘアカラー）', icon: '🎨' },
      { value: 'bleach', label: 'ブリーチ', icon: '⚡' },
      { value: 'perm', label: 'パーマ', icon: '🌀' },
      { value: 'straight', label: '縮毛矯正', icon: '➡️' },
      { value: 'treatment', label: '髪質改善トリートメント', icon: '💎' }
    ]
  },
  {
    id: 'q4',
    step: 4,
    label: 'Q4',
    title: '今の髪の状態で当てはまるものは？',
    subtitle: 'できるだけ正確に選んでください（複数可）',
    type: 'multi',
    required: true,
    options: [
      { value: 's1', label: 'ブリーチや薬剤でチリチリしている', icon: '⚡', flag: 'damage' },
      { value: 's2', label: '水に濡れると急に重くなる', icon: '💧', flag: 'porous' },
      { value: 's3', label: '乾燥するとアホ毛・うねりが出る', icon: '🌊', flag: 'moisture' },
      { value: 's4', label: 'スタイリング後にべたつく', icon: '🔒', flag: 'buildup' },
      { value: 's5', label: '黄ばみ・ブラスが気になる', icon: '🌕', flag: 'tone' },
      { value: 's6', label: '根元からぺたんこ・ボリューム0', icon: '🪶', flag: 'volume' },
      { value: 's7', label: 'ここ3〜6ヶ月で急に抜け毛が増えた', icon: '🌱', flag: 'shed' },
      { value: 's8', label: 'カラーが2週間で退色する', icon: '🎨', flag: 'fade' },
      { value: 's0', label: 'これといった症状はない', icon: '✅', flag: 'healthy' }
    ]
  },
  {
    id: 'q5',
    step: 5,
    label: 'Q5',
    title: '頭皮の状態は？',
    subtitle: '最も近いものを選んでください',
    type: 'single',
    required: true,
    options: [
      { value: 'normal', label: '普通（特に気にならない）', icon: '😊' },
      { value: 'oily', label: 'べたつき・脂っぽい', icon: '💦' },
      { value: 'dry', label: 'かさつき・乾燥', icon: '🌵' },
      { value: 'sensitive', label: 'かゆみ・敏感', icon: '🔥' },
      { value: 'aging', label: 'ハリ・コシが減ってきた', icon: '⏳' }
    ]
  },
  {
    id: 'q6',
    step: 6,
    label: 'Q6',
    title: '目指す仕上がりのイメージは？',
    subtitle: '最も近いものを選んでください',
    type: 'single',
    required: true,
    options: [
      { value: 'glossy', label: 'ツヤツヤ・しっとり', icon: '✨' },
      { value: 'smooth', label: 'さらさら・スムース', icon: '🌬️' },
      { value: 'volume', label: 'ふんわり・ボリューム', icon: '☁️' },
      { value: 'natural', label: 'ナチュラル・ありのまま', icon: '🌿' },
      { value: 'curl', label: 'くせ活かし・カール', icon: '🌀' }
    ]
  },
  {
    id: 'q7',
    step: 7,
    label: 'Q7',
    title: '熱系スタイリングの頻度は？',
    subtitle: 'ドライヤー以外で使う道具を教えてください',
    type: 'multi',
    required: true,
    options: [
      { value: 'none', label: '使わない', icon: '🙅' },
      { value: 'dryer_only', label: 'ドライヤーのみ', icon: '💨' },
      { value: 'iron', label: 'ストレートアイロン（週3回以上）', icon: '🔥' },
      { value: 'curl_iron', label: 'カールアイロン（週3回以上）', icon: '🌀' },
      { value: 'high_heat', label: '180度以上で使うことが多い', icon: '🌡️' },
      { value: 'daily', label: '毎日熱処理している', icon: '📅' }
    ]
  },
  // ---- 以下、オプション（Standard）Q8〜Q12 ----
  {
    id: 'q8',
    step: 8,
    label: 'Q8',
    title: 'ブリーチの詳細',
    subtitle: 'ブリーチ経験がある方のみお答えください',
    type: 'single',
    required: false,
    optional: true,
    options: [
      { value: 'none', label: 'ブリーチ経験なし', icon: '🚫' },
      { value: 'bleach_once', label: '1回のみ', icon: '1️⃣' },
      { value: 'bleach_multi', label: '複数回（2〜3回）', icon: '2️⃣' },
      { value: 'bleach_heavy', label: '4回以上 or 全体ブリーチ', icon: '⚡' },
      { value: 'bleach_highlight', label: 'ハイライト（部分）', icon: '✨' }
    ]
  },
  {
    id: 'q9',
    step: 9,
    label: 'Q9',
    title: '生活・環境について',
    subtitle: '当てはまるものをすべて選んでください',
    type: 'multi',
    required: false,
    optional: true,
    options: [
      { value: 'outdoor', label: '屋外活動が多い（UV多め）', icon: '☀️' },
      { value: 'pool', label: 'プール・海に頻繁に行く', icon: '🏊' },
      { value: 'hard_water', label: '水道水の水質が気になる', icon: '💧' },
      { value: 'humid', label: '湿気の多い環境', icon: '🌧️' },
      { value: 'dry_climate', label: '乾燥した環境・エアコン多用', icon: '❄️' },
      { value: 'none', label: '特になし', icon: '🏠' }
    ]
  },
  {
    id: 'q10',
    step: 10,
    label: 'Q10',
    title: '現在使っているホームケア',
    subtitle: '日常的に使っているものをすべて選んでください',
    type: 'multi',
    required: false,
    optional: true,
    options: [
      { value: 'basic', label: 'シャンプー＋コンディショナーのみ', icon: '🧴' },
      { value: 'treatment', label: 'トリートメント・マスクを週1以上', icon: '💎' },
      { value: 'heavy_oil', label: 'ヘアオイルを毎日大量使い', icon: '🛢️' },
      { value: 'styling', label: 'ワックス・スプレーを毎日使う', icon: '✨' },
      { value: 'curl_cream', label: 'カールクリーム・ムース', icon: '🌀' },
      { value: 'wax', label: 'ヘアワックス', icon: '🕯️' },
      { value: 'nothing', label: 'ほぼケアしていない', icon: '🤷' }
    ]
  },
  {
    id: 'q11',
    step: 11,
    label: 'Q11',
    title: 'ライフステージ・体の変化',
    subtitle: '当てはまるものをすべて選んでください（スキップ可）',
    type: 'multi',
    required: false,
    optional: true,
    options: [
      { value: 'none', label: '特になし', icon: '😊' },
      { value: 'postpartum', label: '産後（6ヶ月以内）', icon: '👶' },
      { value: 'aging', label: '40代以降・エイジングが気になる', icon: '⏳' },
      { value: 'stress', label: 'ストレス・睡眠不足が続いている', icon: '😓' },
      { value: 'diet', label: 'ダイエット・食事制限中', icon: '🥗' },
      { value: 'menopause', label: '更年期・ホルモン変化', icon: '🔄' }
    ]
  },
  {
    id: 'q12',
    step: 12,
    label: 'Q12',
    title: 'ホームケアの予算感',
    subtitle: 'シャンプー＋トリートメント合計（月額）',
    type: 'single',
    required: false,
    optional: true,
    options: [
      { value: 'budget', label: '〜3,000円', icon: '💰' },
      { value: 'standard', label: '3,000〜8,000円', icon: '💳' },
      { value: 'premium', label: '8,000〜15,000円', icon: '💎' },
      { value: 'luxury', label: '15,000円以上', icon: '👑' }
    ]
  }
];

// エンジンインスタンス（グローバル）
window.KarteEngine = KarteEngine;
window.QUIZ_QUESTIONS = QUIZ_QUESTIONS;
window.HAIR_DNA_TYPES = HAIR_DNA_TYPES;
window.RULES = RULES;

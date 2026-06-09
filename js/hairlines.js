/**
 * SEAM Hair Care Line Data
 * 髪のお悩み検索用ラインデータ
 *
 * Tag categories:
 *   concerns  : 悩みタグ（+3点）
 *   hairTypes : 髪質タグ（+2点）
 *   finishes  : 仕上がりタグ（+2点）
 *   keywords  : 補助キーワード（+1点）
 */

/* ────────────────────────────────────────
   共通 SVG アイコン定義
   すべて viewBox="0 0 24 24"、stroke-only、currentColor
──────────────────────────────────────── */
var _SVG = {
  /* 💧 水滴 — 乾燥・パサつき */
  dry:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 3C12 3 5 10.5 5 15a7 7 0 0 0 14 0C19 10.5 12 3 12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M9 16a3.5 3.5 0 0 0 3.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>',

  /* 🌀 波線 — 広がり・うねり */
  wave:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M3 8c2 0 2 2.5 4 2.5S9 8 11 8s2 2.5 4 2.5S17 8 21 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M3 13c2 0 2 2.5 4 2.5S9 13 11 13s2 2.5 4 2.5S17 13 21 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M3 18c2 0 2 2.5 4 2.5S9 18 11 18s2 2.5 4 2.5S17 18 21 18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>',

  /* ⚡ 雷 — ブリーチ・ハイダメージ */
  bolt:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M13 2L4.5 13.5H12L11 22L19.5 10.5H12L13 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>',

  /* 🔥 炎 — 熱ダメージ・アイロン */
  flame:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 22c4 0 7-3 7-7 0-3-1.5-5-3.5-6.5.5 1.5.5 3-.5 4C14.5 11 14 9 13 7c0 0-1 2.5-1 4.5-1-1-1.5-3-1.5-3C8.5 10 5 13 5 15c0 4 3 7 7 7Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M12 22c1.5 0 3-1.5 3-3 0-1.5-1-2.5-2-3 .2.8.1 1.8-.5 2.5C12.2 18 12 16.5 11.5 16c-.5 1-.5 2 .5 3-.5-.5-.5-1-.5-1-.5 1 0 4 .5 4Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>' +
    '</svg>',

  /* 🎨 パレット — カラーの色持ち */
  palette:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 2C6.48 2 2 6.48 2 12c0 5 3.87 9.13 8.76 9.5a2.5 2.5 0 0 0 2.74-2.5c0-.66-.26-1.26-.68-1.72a.5.5 0 0 1 .38-.84H15a7 7 0 0 0 7-7c0-5.52-4.48-7.44-10-7.44Z" stroke="currentColor" stroke-width="1.5"/>' +
    '<circle cx="7" cy="13" r="1.2" fill="currentColor"/>' +
    '<circle cx="8.5" cy="9" r="1.2" fill="currentColor"/>' +
    '<circle cx="12" cy="7" r="1.2" fill="currentColor"/>' +
    '<circle cx="16" cy="9" r="1.2" fill="currentColor"/>' +
    '</svg>',

  /* 🌿 葉 — 頭皮ケア */
  leaf:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 22V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M12 12C12 12 4 11 4 4c0 0 8-1 12 5 2 3 2 6 0 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M12 12c0 0 4-3 6-7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="2 2"/>' +
    '</svg>',

  /* 〜 毛束（3本線） — 細毛・絡まり */
  hair:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M8 4c0 5 4 5 4 10s-4 5-4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M12 4c0 5 4 5 4 10s-4 5-4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M16 4c0 5 4 5 4 10s-4 5-4 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>',

  /* ◇ ダイヤ — ツヤ・高級感 */
  diamond:
    '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M12 3L3 10l9 11 9-11L12 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M3 10h18" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M8 10L12 3M16 10L12 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>' +
    '</svg>',

  /* 店舗アイコン — 来店相談ボタン用 */
  store:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M3 9.5L12 3l9 6.5V21H3V9.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M9 21V12h6v9" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '</svg>',

  /* 鍵アイコン — 会員限定ショップボタン用 */
  key:
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="9" cy="10" r="5.5" stroke="currentColor" stroke-width="1.5"/>' +
    '<path d="M13.5 14l7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M18 19l-1.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '<path d="M20.5 17l-1.5 1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
    '</svg>',

  /* 虫眼鏡 — 結果なし */
  search:
    '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="17" cy="17" r="10" stroke="#b8aea0" stroke-width="1.8"/>' +
    '<path d="M24.5 24.5L33 33" stroke="#b8aea0" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M13 17h8M17 13v8" stroke="#b8aea0" stroke-width="1.6" stroke-linecap="round"/>' +
    '</svg>',

  /* リセット矢印 */
  reset:
    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M4 12a8 8 0 1 0 1.8-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M4 6v6h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>',

  /* 下矢印 — トグル */
  chevronDown:
    '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>'
};

/* グローバルに公開（JS側から参照できるように） */
window.SEAM_SVG = _SVG;

window.SEAM_HAIR_LINES = [
  {
    id: 'aujua-quench',
    brand: 'Aujua',
    line: 'QUENCH',
    brandLine: 'Aujua / QUENCH',
    tagline: { ja: '深海成分で潤いを閉じ込める、究極の保湿ライン', en: 'Deep-sea moisture lock for ultimate hydration' },
    desc: {
      ja: '乾燥・パサつきに特化した、Aujuaの保湿特化ライン。深海コンブエキスが毛髪内部から水分を補給し、しなやかでまとまりのある髪へ導きます。ダメージを受けた髪にも。',
      en: 'Aujua\'s dedicated moisturizing line for dry, frizzy hair. Deep-sea kelp extract replenishes moisture from within the hair for supple, manageable locks.',
      zh: '专为干燥毛糙发质设计的Aujua保湿线。深海海带精华从发丝内部补充水分，打造柔顺易梳理的头发。',
      tw: '專為乾燥毛糙髮質設計的Aujua保濕線。深海海帶精華從髮絲內部補充水分，打造柔順易梳理的頭髮。',
      ko: '건조하고 푸석한 모발을 위한 Aujua 보습 전용 라인. 심해 다시마 추출물이 모발 내부에서 수분을 보충해 부드럽고 관리하기 쉬운 모발로 이끕니다.'
    },
    concerns: ['乾燥・パサつき', '広がり・うねり', 'カラーの色持ち'],
    hairTypes: ['細毛・軟毛', '普通毛', 'カラー毛'],
    finishes: ['しっとり', 'まとまり', 'ツヤ'],
    keywords: ['保湿', '水分補給', '深海', '乾燥肌'],
    priority: 5,
    color: '#7ea8b8',
    icon: _SVG.dry,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'aujua-inmetry',
    brand: 'Aujua',
    line: 'INMETRY',
    brandLine: 'Aujua / INMETRY',
    tagline: { ja: '細毛・軟毛のボリュームと芯を取り戻す', en: 'Restore body and strength to fine, limp hair' },
    desc: {
      ja: '細毛・軟毛でペタンとしがちな髪に。毛髪内部のタンパク質バランスを整え、ふんわりとしたボリューム感と芯のある質感へ。軽やかな仕上がりで毎日使いやすい。',
      en: 'For fine, limp hair lacking volume. Balances protein inside the hair to restore bouncy volume and a sense of strength.',
      zh: '专为细软、塌瘪发质设计。平衡发丝内部蛋白质，恢复蓬松感和发质韧性，轻盈感让您每天都想使用。',
      tw: '專為細軟、塌癟髮質設計。平衡髮絲內部蛋白質，恢復蓬鬆感和髮質韌性，輕盈感讓您每天都想使用。',
      ko: '가늘고 힘없이 처지는 모발에 적합. 모발 내부 단백질 균형을 잡아 풍성한 볼륨감과 탄력 있는 질감으로 이끕니다.'
    },
    concerns: ['細毛・絡まり', '乾燥・パサつき'],
    hairTypes: ['細毛・軟毛', '猫っ毛'],
    finishes: ['ふんわり', 'サラサラ', 'ボリューム'],
    keywords: ['ボリューム', 'コシ', 'ペタンコ'],
    priority: 4,
    color: '#c4a882',
    icon: _SVG.hair,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'aujua-flarm',
    brand: 'Aujua',
    line: 'FLARM',
    brandLine: 'Aujua / FLARM',
    tagline: { ja: 'うねり・くせ毛をやわらかくコントロール', en: 'Softly control frizz and natural wave' },
    desc: {
      ja: 'くせ毛・うねり毛特有のまとまりにくさ、広がりをケア。毛髪表面をなめらかに整え、湿気の影響を受けにくい状態にします。スタイリングがしやすいしなやかな質感へ。',
      en: 'Controls frizzy, wavy hair that tends to puff and spread. Smooths the hair surface to resist humidity and create manageable, flexible texture.',
      zh: '改善卷发、波浪发的蓬乱和扩散问题。抚平发丝表面，增强防潮能力，打造易于造型的柔顺发质。',
      tw: '改善捲髮、波浪髮的蓬亂和擴散問題。撫平髮絲表面，增強防潮能力，打造易於造型的柔順髮質。',
      ko: '곱슬·웨이브 모발 특유의 부스스함과 퍼짐을 케어. 모발 표면을 매끄럽게 정돈해 습기의 영향을 받기 어려운 상태로 만듭니다.'
    },
    concerns: ['広がり・うねり', '乾燥・パサつき'],
    hairTypes: ['くせ毛', '多毛・硬毛'],
    finishes: ['まとまり', 'しっとり', 'サラサラ'],
    keywords: ['くせ毛', '湿気', 'うねり', '広がり'],
    priority: 4,
    color: '#a0b89a',
    icon: _SVG.wave,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'aujua-mesharge',
    brand: 'Aujua',
    line: 'MESHARGE',
    brandLine: 'Aujua / MESHARGE',
    tagline: { ja: 'ダメージ・切れ毛に徹底リペア。毛髪強化ライン', en: 'Intensive repair and strengthening for damaged hair' },
    desc: {
      ja: 'ブリーチ・カラー・パーマによるダメージ、切れ毛・枝毛に。毛髪内部の空洞化した部分を集中補修し、弾力と強度を取り戻します。ダメージヘアへの直接的なリペアケア。',
      en: 'For bleached, colored, or permed damaged hair with breakage and split ends. Intensively repairs hollow areas inside the hair to restore elasticity and strength.',
      zh: '针对漂发、染发、烫发造成的损伤、断发和分叉。集中修复发丝内部空洞部分，恢复弹性和强度。',
      tw: '針對漂髮、染髮、燙髮造成的損傷、斷髮和分叉。集中修復髮絲內部空洞部分，恢復彈性和強度。',
      ko: '블리치·컬러·퍼머로 인한 손상, 끊어짐, 갈라짐에. 모발 내부의 공동화된 부분을 집중 보수해 탄력과 강도를 되찾습니다.'
    },
    concerns: ['ブリーチ・ハイダメージ', '熱ダメージ・アイロン', 'カラーの色持ち'],
    hairTypes: ['ブリーチ毛', 'カラー毛', 'ダメージ毛'],
    finishes: ['ツヤ', 'まとまり', 'しっとり'],
    keywords: ['リペア', '補修', 'ダメージ', '切れ毛', '枝毛'],
    priority: 5,
    color: '#d4a8a8',
    icon: _SVG.bolt,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'bykarte-line',
    brand: 'BYKARTE',
    line: 'BYKARTE',
    brandLine: 'BYKARTE',
    tagline: { ja: 'サロンクオリティのホームケアを日常に', en: 'Salon-quality home care for everyday use' },
    desc: {
      ja: '美容師とともに開発された、サロン発のホームケアブランド。ケラチンとシルクタンパク質が髪を内側から補修・強化。カラー・ブリーチ毛のダメージケアからツヤ出しまで幅広く対応。',
      en: 'A salon-born home care brand developed with hairdressers. Keratin and silk protein repair and strengthen hair from within—ideal for colored or bleached hair.',
      zh: '与美发师共同开发的沙龙级居家护发品牌。角蛋白和丝蛋白从内部修复强化发丝，适合染发、漂发后的损伤护理和增亮。',
      tw: '與美髮師共同開發的沙龍級居家護髮品牌。角蛋白和絲蛋白從內部修復強化髮絲，適合染髮、漂髮後的損傷護理和增亮。',
      ko: '미용사와 함께 개발한 살롱 기반 홈케어 브랜드. 케라틴과 실크 단백질이 모발을 내부에서 보수·강화. 컬러·블리치 모발의 데미지 케어부터 윤기 부여까지.'
    },
    concerns: ['ブリーチ・ハイダメージ', '乾燥・パサつき', 'カラーの色持ち', 'ツヤ・高級感'],
    hairTypes: ['ブリーチ毛', 'カラー毛', 'ダメージ毛', '普通毛'],
    finishes: ['ツヤ', 'まとまり', 'しっとり'],
    keywords: ['ケラチン', 'シルク', 'ホームケア', 'リペア'],
    priority: 5,
    color: '#b8a0c8',
    icon: _SVG.diamond,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'sublimic-aqua',
    brand: 'SUBLIMIC',
    line: 'Aqua Intensive',
    brandLine: 'SUBLIMIC / Aqua Intensive',
    tagline: { ja: 'シュワルツコフの最上位。極乾燥・ダメージへの集中ケア', en: 'Schwarzkopf\'s finest—intensive care for extremely dry, damaged hair' },
    desc: {
      ja: 'Schwarzkopf Professionalのサロン専売最高峰ライン。著しく乾燥・ダメージした髪をリストア。カスタマイズ処方のフュージョナーが髪の芯に浸透し、指通り抜群の質感を実現。',
      en: 'Schwarzkopf Professional\'s premium salon line. Restores severely dry and damaged hair. The Fusioner formula penetrates deep into the hair core for incredibly smooth texture.',
      zh: '施华蔻专业版最高端沙龙专售线。修复严重干燥损伤的发质，专属配方Fusioner深入发芯，实现极佳的梳理顺滑度。',
      tw: '施華蔻專業版最高端沙龍專售線。修復嚴重乾燥損傷的髮質，專屬配方Fusioner深入髮芯，實現極佳的梳理順滑度。',
      ko: '슈왈츠코프 프로페셔널의 살롱 전용 최상위 라인. 극도로 건조하고 손상된 모발을 리스토어. 커스터마이즈 처방 퓨저너가 모발 심부에 침투해 탁월한 매끄러움을 실현.'
    },
    concerns: ['乾燥・パサつき', 'ブリーチ・ハイダメージ', '細毛・絡まり'],
    hairTypes: ['ダメージ毛', 'ブリーチ毛', '多毛・硬毛'],
    finishes: ['しっとり', 'ツヤ', 'まとまり'],
    keywords: ['Schwarzkopf', '保湿', 'インテンシブ', '極乾燥'],
    priority: 4,
    color: '#8ab4c8',
    icon: _SVG.dry,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'sublimic-wind',
    brand: 'SUBLIMIC',
    line: 'Wind Dance',
    brandLine: 'SUBLIMIC / Wind Dance',
    tagline: { ja: 'くせ・広がりを抑え、やわらかく動く髪へ', en: 'Tame frizz and bring soft, fluid movement to hair' },
    desc: {
      ja: 'SUBLIMIC（シュワルツコフ）のくせ毛・広がり専用ライン。独自のモーションコントロール技術で、湿気や摩擦による広がりを抑制。指通りの良い、なめらかでしなやかな動きのある髪に。',
      en: 'SUBLIMIC\'s dedicated line for frizzy, voluminous hair. Proprietary MotionControl technology suppresses spread from humidity and friction for smooth, fluid hair.',
      zh: 'SUBLIMIC针对卷曲、扩散发质的专用线。独有的运动控制技术，抑制因湿气和摩擦引起的蓬乱，打造顺滑柔顺有动感的头发。',
      tw: 'SUBLIMIC針對捲曲、擴散髮質的專用線。獨有的運動控制技術，抑制因濕氣和摩擦引起的蓬亂，打造順滑柔順有動感的頭髮。',
      ko: 'SUBLIMIC의 곱슬·퍼짐 전용 라인. 독자 모션 컨트롤 기술로 습기와 마찰에 의한 퍼짐을 억제. 부드럽고 자연스러운 움직임이 있는 매끄러운 모발로.'
    },
    concerns: ['広がり・うねり', '乾燥・パサつき'],
    hairTypes: ['くせ毛', '多毛・硬毛', '普通毛'],
    finishes: ['サラサラ', 'まとまり', 'ふんわり'],
    keywords: ['くせ毛', '広がり', '湿気', 'Wind'],
    priority: 3,
    color: '#a0c4a0',
    icon: _SVG.wave,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'tokio-inkarami',
    brand: 'TOKIO IE',
    line: 'INKARAMI',
    brandLine: 'TOKIO IE / INKARAMI',
    tagline: { ja: 'Instagramで話題のプラチナムトリートメント', en: 'The viral Platinum Treatment — as seen on Instagram' },
    desc: {
      ja: 'SNSで圧倒的な話題を集めるサロン発トリートメント。独自のINKARAMI技術が毛髪内部に深く浸透し、ダメージした繊維を高密度に補修。サロン施術後の驚くほどの手触りを自宅で再現。',
      en: 'The salon treatment that went viral on social media. Proprietary INKARAMI technology penetrates deep inside the hair to densely repair damaged fibers at home.',
      zh: '在社交媒体上引发热议的沙龙护发产品。独有的INKARAMI技术深层渗透发丝内部，高密度修复损伤纤维，在家重现沙龙护理后令人惊叹的手感。',
      tw: '在社交媒體上引發熱議的沙龍護髮產品。獨有的INKARAMI技術深層滲透髮絲內部，高密度修復損傷纖維，在家重現沙龍護理後令人驚嘆的手感。',
      ko: 'SNS에서 압도적인 화제를 모은 살롱 발 트리트먼트. 독자 INKARAMI 기술이 모발 내부에 깊이 침투해 손상된 섬유를 고밀도로 보수. 살롱 시술 후의 놀라운 촉감을 집에서 재현.'
    },
    concerns: ['ブリーチ・ハイダメージ', '熱ダメージ・アイロン', '乾燥・パサつき', 'ツヤ・高級感'],
    hairTypes: ['ブリーチ毛', 'ダメージ毛', 'カラー毛'],
    finishes: ['ツヤ', 'しっとり', 'まとまり'],
    keywords: ['INKARAMI', 'プラチナム', 'トリートメント', 'SNS', 'Instagram'],
    priority: 5,
    color: '#d4c080',
    icon: _SVG.flame,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'tokio-ie-limited',
    brand: 'TOKIO IE',
    line: 'LIMITED',
    brandLine: 'TOKIO IE / LIMITED',
    tagline: { ja: 'TOKIOの最高峰。最上質のツヤと手触りへ', en: 'TOKIO\'s pinnacle—ultimate shine and silken touch' },
    desc: {
      ja: 'TOKIO IEシリーズの最高峰ライン。プレミアムな処方で毛髪に贅沢なツヤとシルクのような手触りを付与。特別なシーンや、仕上がりにこだわりたい方に。',
      en: 'The pinnacle of the TOKIO IE series. Premium formula bestows luxurious shine and a silky touch—for special occasions or those who demand the finest finish.',
      zh: 'TOKIO IE系列最高端线。高级配方赋予发丝奢华光泽和丝绸般的触感，专为特殊场合或追求极致效果的您而设计。',
      tw: 'TOKIO IE系列最高端線。高級配方賦予髮絲奢華光澤和絲綢般的觸感，專為特殊場合或追求極致效果的您而設計。',
      ko: 'TOKIO IE 시리즈의 최상위 라인. 프리미엄 처방으로 모발에 사치스러운 광택과 실크 같은 촉감을 부여. 특별한 자리나 마무리에 집착하는 분께.'
    },
    concerns: ['ツヤ・高級感', 'ブリーチ・ハイダメージ', 'カラーの色持ち'],
    hairTypes: ['ブリーチ毛', 'カラー毛', 'ダメージ毛', '普通毛'],
    finishes: ['ツヤ', 'しっとり', 'まとまり'],
    keywords: ['LIMITED', 'プレミアム', '最高峰', 'ツヤ', '光沢'],
    priority: 5,
    color: '#c8a850',
    icon: _SVG.diamond,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'tsururincho',
    brand: 'つるりんちょ',
    line: 'つるりんちょ',
    brandLine: 'つるりんちょ',
    tagline: { ja: '絡まり・引っかかりをなくす、梳かしやすい髪へ', en: 'Eliminate tangles for effortlessly combable hair' },
    desc: {
      ja: '絡まりやすい・引っかかりやすい髪に特化したライン。独自のスムーズ成分が毛髪表面のキューティクルを整え、絡まらない、引っかからない指通り滑らかな髪へ導きます。細毛さんにも。',
      en: 'A line dedicated to tangling and snagging hair. Proprietary smooth ingredients align the cuticle surface so hair glides through fingers with zero tangles.',
      zh: '专为容易打结缠绕的发质设计。独有顺滑成分整理发丝表面毛鳞片，实现不纠缠、不挂钩、顺滑如丝的梳理体验，细发也适用。',
      tw: '專為容易打結纏繞的髮質設計。獨有順滑成分整理髮絲表面毛鱗片，實現不糾纏、不掛鉤、順滑如絲的梳理體驗，細髮也適用。',
      ko: '엉키기 쉬운·걸리기 쉬운 모발에 특화된 라인. 독자 스무스 성분이 모발 표면 큐티클을 정돈해 엉키지 않는, 걸리지 않는 미끄러운 모발로.'
    },
    concerns: ['細毛・絡まり', '広がり・うねり'],
    hairTypes: ['細毛・軟毛', 'くせ毛', '普通毛'],
    finishes: ['サラサラ', 'まとまり', 'ふんわり'],
    keywords: ['絡まり', '引っかかり', 'キューティクル', 'スムーズ'],
    priority: 4,
    color: '#e8c4a0',
    icon: _SVG.hair,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'likera-emulsion',
    brand: 'リケラエマルジョン',
    line: 'リケラ',
    brandLine: 'リケラエマルジョン',
    tagline: { ja: 'パーマ・カラーの持ちを格上げ。毛髪内部を整えるリケアライン', en: 'Elevate perm and color longevity with internal hair repair' },
    desc: {
      ja: 'パーマ・カラーの色持ち・型持ちに着目した処方。毛髪内部のタンパク質を整え、施術ダメージを軽減しながらパーマのウェーブ・カラーの発色を長持ちさせます。サロン施術後の継続ケアに。',
      en: 'Formulated to extend the life of perms and color. Repairs internal protein while reducing treatment damage, keeping waves and color vibrant longer.',
      zh: '专注于延长烫发和染发效果的配方。修复发内蛋白质，减少烫染损伤，同时延长烫发卷度和染发色彩的持久度。沙龙护理后持续使用效果更佳。',
      tw: '專注於延長燙髮和染髮效果的配方。修復髮內蛋白質，減少燙染損傷，同時延長燙髮捲度和染髮色彩的持久度。沙龍護理後持續使用效果更佳。',
      ko: '퍼머·컬러의 지속력에 주목한 처방. 모발 내부 단백질을 정돈하고 시술 데미지를 줄이면서 웨이브와 컬러 발색을 오래 유지. 살롱 시술 후 지속 케어에.'
    },
    concerns: ['カラーの色持ち', 'ブリーチ・ハイダメージ', '乾燥・パサつき'],
    hairTypes: ['カラー毛', 'ダメージ毛', '普通毛'],
    finishes: ['まとまり', 'ツヤ', 'しっとり'],
    keywords: ['カラー持ち', 'パーマ', 'リケア', 'タンパク質'],
    priority: 4,
    color: '#c4b8d0',
    icon: _SVG.palette,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'kerastase-nutritive',
    brand: 'KÉRASTASE',
    line: 'NUTRITIVE',
    brandLine: 'KÉRASTASE / NUTRITIVE',
    tagline: { ja: 'ケラスターゼの栄養補給ライン。感動の滑らかさ', en: 'Kérastase nourishing line for incomparable smoothness' },
    desc: {
      ja: 'フランス発のプレステージサロンブランドKÉRASTASEの乾燥・栄養補給ライン。ハチミツ由来成分と保湿複合成分が毛髪を深部から栄養補給。贅沢なテクスチャーで毎日のケアを特別なひとときに。',
      en: 'Kérastase\'s prestige nourishing line from France. Honey-derived ingredients and moisture complex deeply nourish hair—turn daily care into a luxurious ritual.',
      zh: '法国顶级沙龙品牌KÉRASTASE的滋养补水线。蜂蜜来源成分和保湿复合物从深层滋养发丝，奢华质地让每日护理成为特别享受。',
      tw: '法國頂級沙龍品牌KÉRASTASE的滋養補水線。蜂蜜來源成分和保濕複合物從深層滋養髮絲，奢華質地讓每日護理成為特別享受。',
      ko: '프랑스 발 프레스티지 살롱 브랜드 KÉRASTASE의 건조·영양 보급 라인. 꿀 유래 성분과 보습 복합 성분이 모발을 심부에서 영양 보급. 사치스러운 텍스처로 매일의 케어를 특별한 시간으로.'
    },
    concerns: ['乾燥・パサつき', 'ツヤ・高級感', 'カラーの色持ち'],
    hairTypes: ['普通毛', 'カラー毛', 'ダメージ毛'],
    finishes: ['しっとり', 'ツヤ', 'まとまり'],
    keywords: ['ケラスターゼ', 'Kérastase', 'フランス', 'ハチミツ', 'プレステージ'],
    priority: 4,
    color: '#d0c0a0',
    icon: _SVG.diamond,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'davines-nounou',
    brand: 'DAVINES',
    line: 'NOUNOU',
    brandLine: 'DAVINES / NOUNOU',
    tagline: { ja: 'サステナブル×サロン専売。ダメージ・乾燥をやさしく補修', en: 'Sustainable & salon-exclusive. Gently repair damage and dryness' },
    desc: {
      ja: 'イタリア発のサステナブルサロンブランドDAVINES。食品由来の自然成分が毛髪をやさしく補修・保湿。環境に配慮しながら、ダメージ毛・乾燥毛を健やかでしなやかな髪へ。',
      en: 'DAVINES, Italy\'s sustainable salon brand. Natural, food-grade ingredients gently repair and moisturize hair—restoring damaged, dry hair to health while caring for the planet.',
      zh: '意大利可持续沙龙品牌DAVINES。食品来源天然成分温和修复和保湿发丝，在关爱环境的同时，让损伤、干燥的发质恢复健康柔顺。',
      tw: '義大利可持續沙龍品牌DAVINES。食品來源天然成分溫和修復和保濕髮絲，在關愛環境的同時，讓損傷、乾燥的髮質恢復健康柔順。',
      ko: '이탈리아 발 서스테이너블 살롱 브랜드 DAVINES. 식품 유래 자연 성분이 모발을 온화하게 보수·보습. 환경을 배려하면서 손상모·건조모를 건강하고 유연한 모발로.'
    },
    concerns: ['乾燥・パサつき', 'ブリーチ・ハイダメージ', 'ツヤ・高級感'],
    hairTypes: ['ダメージ毛', '普通毛', 'カラー毛'],
    finishes: ['しっとり', 'まとまり', 'ツヤ'],
    keywords: ['DAVINES', 'ダヴィネス', 'イタリア', 'サステナブル', 'オーガニック'],
    priority: 3,
    color: '#a8c0a0',
    icon: _SVG.leaf,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'milbon-scalp',
    brand: 'ミルボン',
    line: 'スカルプ',
    brandLine: 'ミルボン / スカルプケア',
    tagline: { ja: '頭皮から健康な髪をつくる、ミルボンのスカルプライン', en: 'Build healthy hair from the scalp—Milbon\'s scalp care line' },
    desc: {
      ja: 'サロン専売の国内最大手ミルボンのスカルプケアライン。頭皮環境を整え、フケ・かゆみ・過剰な皮脂を改善。毛根から健やかな髪が育つ土台づくりに。抜け毛・薄毛が気になる方にも。',
      en: 'Milbon\'s scalp care line from Japan\'s leading salon-exclusive brand. Balances scalp environment, reduces dandruff, itching, and excess sebum—builds the foundation for healthy hair growth.',
      zh: '日本最大沙龙专售品牌MILBON的头皮护理线。调理头皮环境，改善头屑、瘙痒和过多皮脂，从发根打下健康生长的基础。也适合有脱发、稀发困扰的人。',
      tw: '日本最大沙龍專售品牌MILBON的頭皮護理線。調理頭皮環境，改善頭屑、搔癢和過多皮脂，從髮根打下健康生長的基礎。也適合有脫髮、稀髮困擾的人。',
      ko: '살롱 전용의 국내 최대 기업 밀본의 스칼프 케어 라인. 두피 환경을 정돈해 비듬·가려움·과잉 피지를 개선. 모근에서 건강한 모발이 자라는 기반 조성. 탈모·얇아짐이 신경 쓰이는 분께도.'
    },
    concerns: ['頭皮ケア', '細毛・絡まり'],
    hairTypes: ['細毛・軟毛', '普通毛', '多毛・硬毛'],
    finishes: ['さっぱり', 'ふんわり', 'サラサラ'],
    keywords: ['頭皮', 'スカルプ', 'フケ', 'かゆみ', 'ミルボン'],
    priority: 5,
    color: '#a0b8a0',
    icon: _SVG.leaf,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  },
  {
    id: 'wella-scalp',
    brand: 'Wella',
    line: 'Elements',
    brandLine: 'Wella / Elements',
    tagline: { ja: '地肌にやさしい、ウエラのナチュラルスカルプライン', en: 'Wella\'s gentle natural scalp line—kind to skin' },
    desc: {
      ja: 'ウエラのナチュラル処方スカルプケアライン。パラベン・人工香料フリーで、敏感な頭皮にもやさしい。自然由来成分が頭皮の皮脂バランスを整え、根元からボリューム感のある健やかな髪へ。',
      en: 'Wella\'s natural-formula scalp care line. Paraben and artificial fragrance free—gentle even on sensitive scalps. Natural ingredients balance sebum for voluminous, healthy hair from roots.',
      zh: 'Wella天然配方头皮护理线。不含对羟基苯甲酸酯和人工香料，对敏感头皮也十分温和。天然成分平衡头皮皮脂，打造从发根开始蓬松健康的头发。',
      tw: 'Wella天然配方頭皮護理線。不含對羥基苯甲酸酯和人工香料，對敏感頭皮也十分溫和。天然成分平衡頭皮皮脂，打造從髮根開始蓬鬆健康的頭髮。',
      ko: '웰라의 내추럴 처방 스칼프 케어 라인. 파라벤·인공 향료 프리로 민감한 두피에도 온화. 자연 유래 성분이 두피 피지 밸런스를 정돈해 뿌리에서 볼륨감 있는 건강한 모발로.'
    },
    concerns: ['頭皮ケア', '細毛・絡まり', '乾燥・パサつき'],
    hairTypes: ['細毛・軟毛', '普通毛'],
    finishes: ['さっぱり', 'ふんわり', 'ボリューム'],
    keywords: ['Wella', 'ウエラ', 'スカルプ', 'パラベンフリー', '地肌'],
    priority: 3,
    color: '#b0c8b0',
    icon: _SVG.leaf,
    ctaShop: 'https://shop.seam.site/',
    ctaStore: '#stores'
  }
];

/**
 * 8 concern categories (悩みカテゴリ)
 */
window.SEAM_CONCERNS = [
  { id: 'dry',    label: { ja: '乾燥・パサつき',       en: 'Dry & Frizzy',         zh: '干燥・毛糙',  tw: '乾燥・毛糙',  ko: '건조·푸석함'   }, icon: _SVG.dry,     value: '乾燥・パサつき' },
  { id: 'spread', label: { ja: '広がり・うねり',       en: 'Frizz & Wave',         zh: '扩散・波浪',  tw: '擴散・波浪',  ko: '퍼짐·웨이브'   }, icon: _SVG.wave,    value: '広がり・うねり' },
  { id: 'bleach', label: { ja: 'ブリーチ・ハイダメージ', en: 'Bleach & High Damage', zh: '漂发・高损伤', tw: '漂髮・高損傷', ko: '블리치·고손상'  }, icon: _SVG.bolt,    value: 'ブリーチ・ハイダメージ' },
  { id: 'heat',   label: { ja: '熱ダメージ・アイロン',  en: 'Heat & Iron Damage',   zh: '热损伤・熨烫', tw: '熱損傷・熨燙', ko: '열손상·고데기'  }, icon: _SVG.flame,   value: '熱ダメージ・アイロン' },
  { id: 'color',  label: { ja: 'カラーの色持ち',       en: 'Color Longevity',      zh: '染发持色',    tw: '染髮持色',    ko: '컬러 지속력'   }, icon: _SVG.palette, value: 'カラーの色持ち' },
  { id: 'scalp',  label: { ja: '頭皮ケア',            en: 'Scalp Care',           zh: '头皮护理',    tw: '頭皮護理',    ko: '두피 케어'     }, icon: _SVG.leaf,    value: '頭皮ケア' },
  { id: 'fine',   label: { ja: '細毛・絡まり',         en: 'Fine & Tangled',       zh: '细发・缠绕',  tw: '細髮・纏繞',  ko: '가는모발·엉킴' }, icon: _SVG.hair,    value: '細毛・絡まり' },
  { id: 'shine',  label: { ja: 'ツヤ・高級感',         en: 'Shine & Luxury',       zh: '光泽・高级感', tw: '光澤・高級感', ko: '윤기·고급감'   }, icon: _SVG.diamond, value: 'ツヤ・高級感' }
];

/**
 * 8 hair types (髪質タグ)
 */
window.SEAM_HAIR_TYPES = [
  { id: 'fine',    label: { ja: '細毛・軟毛',  en: 'Fine / Soft',    zh: '细发・软发',   tw: '細髮・軟髮',   ko: '가는모발·부드러운모발' }, value: '細毛・軟毛' },
  { id: 'normal',  label: { ja: '普通毛',      en: 'Normal',         zh: '普通发',       tw: '普通髮',       ko: '보통 모발'              }, value: '普通毛' },
  { id: 'thick',   label: { ja: '多毛・硬毛',  en: 'Thick / Coarse', zh: '浓密・粗硬发', tw: '濃密・粗硬髮', ko: '많은머리·굵은모발'      }, value: '多毛・硬毛' },
  { id: 'curly',   label: { ja: 'くせ毛',      en: 'Curly / Wavy',   zh: '卷发',         tw: '捲髮',         ko: '곱슬모발'               }, value: 'くせ毛' },
  { id: 'color',   label: { ja: 'カラー毛',    en: 'Color-treated',  zh: '染发',         tw: '染髮',         ko: '컬러 모발'              }, value: 'カラー毛' },
  { id: 'bleach',  label: { ja: 'ブリーチ毛',  en: 'Bleached',       zh: '漂白发',       tw: '漂白髮',       ko: '블리치 모발'            }, value: 'ブリーチ毛' },
  { id: 'damaged', label: { ja: 'ダメージ毛',  en: 'Damaged',        zh: '受损发',       tw: '受損髮',       ko: '손상 모발'              }, value: 'ダメージ毛' },
  { id: 'neko',    label: { ja: '猫っ毛',      en: 'Limp / Flat',    zh: '猫毛（细软）', tw: '貓毛（細軟）', ko: '고양이 털(약한 모발)'   }, value: '猫っ毛' }
];

/**
 * 8 finish types (仕上がりタグ)
 */
window.SEAM_FINISHES = [
  { id: 'moist',   label: { ja: 'しっとり',  en: 'Moist',    zh: '湿润', tw: '濕潤', ko: '촉촉함'   }, value: 'しっとり' },
  { id: 'shiny',   label: { ja: 'ツヤ',      en: 'Shiny',    zh: '光泽', tw: '光澤', ko: '윤기'     }, value: 'ツヤ' },
  { id: 'fluffy',  label: { ja: 'ふんわり',  en: 'Fluffy',   zh: '蓬松', tw: '蓬鬆', ko: '폭신함'   }, value: 'ふんわり' },
  { id: 'silky',   label: { ja: 'サラサラ',  en: 'Silky',    zh: '顺滑', tw: '順滑', ko: '찰랑거림' }, value: 'サラサラ' },
  { id: 'compact', label: { ja: 'まとまり',  en: 'Compact',  zh: '服帖', tw: '服貼', ko: '정돈됨'   }, value: 'まとまり' },
  { id: 'volume',  label: { ja: 'ボリューム', en: 'Volume',   zh: '蓬量', tw: '蓬量', ko: '볼륨'     }, value: 'ボリューム' },
  { id: 'fresh',   label: { ja: 'さっぱり',  en: 'Fresh',    zh: '清爽', tw: '清爽', ko: '개운함'   }, value: 'さっぱり' },
  { id: 'natural', label: { ja: 'ナチュラル', en: 'Natural',  zh: '自然', tw: '自然', ko: '내추럴'   }, value: 'ナチュラル' }
];

/* SEAM: 言語版の <title>/description が日本語のままだった 34枚（読みもの13・journal・press・privacy・terms・tokushoho・求人15・rekera）に meta 訳を焼き込む（2026-09-10）
 *
 * 【なぜ】9/7 に 33枚（読みもの13・journal・press・privacy・terms・tokushoho・求人15）を多言語化したが
 *   本文だけ訳して meta.title / meta.description を辞書に入れなかった。
 *   その結果 /en /zh /tw /ko の 132枚が ja と同じ日本語 <title> を持ち
 *   「同じタイトルのページが5枚」という重複信号になっていた（順位が下がったと感じる主因の1つ）。
 *
 * 【やること】
 *   1. 各ページの辞書 window.SEAM_PAGE_I18N に meta.title / meta.description を5言語ぶん足す
 *      （ja は HTML の <title>/description をそのまま。訳はこの表）
 *   2. hreflang の相互申告ブロックが無い ja ページ 34枚（上の33 + ginza-spa-journey）に
 *      shop.html と同じ形の <link rel="alternate" hreflang> 6本を入れる
 *      （言語版は ja 側の head を継承するので ja に入れれば 5言語とも揃う）
 *   3. 求人の description に「福岡福岡エリア」「大阪大阪エリア」（県名+市名の二重）が出ていたのを直す
 *
 * 【注意】辞書は JSON.stringify で往復できる形（事前に34枚で確認）。parse → 追加 → stringify で戻す。
 *   2回走らせても同じ結果（既にあるものは足さない）。
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '.';
const BASE = 'https://seam.site';

// ── 求人ページは 地域×職種 の型から作る ──
const AREA = {
  fukuoka:    { en: ['Fukuoka', 'Fukuoka (Tenjin / Daimyo)'],            zh: ['福冈', '福冈（天神・大名）'],         tw: ['福岡', '福岡（天神・大名）'],         ko: ['후쿠오카', '후쿠오카(텐진·다이묘)'] },
  ginza:      { en: ['Ginza', 'Ginza, Tokyo (Ginza / Yurakucho)'],       zh: ['银座', '东京银座（银座・有乐町）'],   tw: ['銀座', '東京銀座（銀座・有樂町）'],   ko: ['긴자', '도쿄 긴자(긴자·유라쿠초)'] },
  omotesando: { en: ['Omotesando', 'Omotesando, Tokyo (Omotesando / Aoyama)'], zh: ['表参道', '东京表参道（表参道・青山）'], tw: ['表參道', '東京表參道（表參道・青山）'], ko: ['오모테산도', '도쿄 오모테산도(오모테산도·아오야마)'] },
  sapporo:    { en: ['Sapporo', 'Sapporo, Hokkaido (Odori / Sapporo Station)'], zh: ['札幌', '北海道札幌（大通・札幌站）'], tw: ['札幌', '北海道札幌（大通・札幌站）'], ko: ['삿포로', '홋카이도 삿포로(오도리·삿포로역)'] },
  nagoya:     { en: ['Nagoya', 'Nagoya, Aichi (Sakae / Yabacho)'],       zh: ['名古屋', '爱知名古屋（荣・矢场町）'], tw: ['名古屋', '愛知名古屋（榮・矢場町）'], ko: ['나고야', '아이치 나고야(사카에·야바초)'] },
  osaka:      { en: ['Osaka', 'Osaka (Minami-Horie / Shinsaibashi)'],    zh: ['大阪', '大阪（南堀江・心斋桥）'],     tw: ['大阪', '大阪（南堀江・心齋橋）'],     ko: ['오사카', '오사카(미나미호리에·신사이바시)'] },
};
const STORE = { en: a => 'SEAM ' + AREA[a].en[0], zh: a => 'SEAM' + AREA[a].zh[0], tw: a => 'SEAM' + AREA[a].tw[0], ko: a => 'SEAM ' + AREA[a].ko[0] };

// {A}=地域短 {L}=地域長 {S}=店名
const ROLE = {
  stylist: {
    en: ['Hair Stylist Jobs in {A} | ¥300,000+/month, 50% commission | {S} (Full-time)',
         'Hair stylist position in {L}. Monthly salary from ¥300,000; ¥350,000 with ¥700,000 in designated sales (50% commission). Two full days off a week, 100% return rate after maternity leave, training in NY and Hawaii. A career you can keep for life at SEAM, a front-shop salon with 197 salon-exclusive brands.'],
    zh: ['{A}美发师・发型师招聘｜月薪30万日元起 提成50%｜{S}（正式员工）',
         '{L}的美发师・发型师招聘。月薪30万日元起，指名业绩70万日元时月薪35万日元（提成50%）。完全每周双休，产假育儿假复职率100%，纽约・夏威夷研修。在拥有197个沙龙专售品牌的前店型沙龙SEAM，实现一辈子做美发师的工作方式。'],
    tw: ['{A}美髮師・髮型師招募｜月薪30萬日圓起 抽成50%｜{S}（正職）',
         '{L}的美髮師・髮型師招募。月薪30萬日圓起，指名業績70萬日圓時月薪35萬日圓（抽成50%）。完全週休二日，產假育嬰假復職率100%，紐約・夏威夷研修。在擁有197個沙龍專售品牌的前店型沙龍SEAM，實現一輩子當美髮師的工作方式。'],
    ko: ['{A} 미용사·스타일리스트 채용｜월급 30만엔~ 인센티브 50%｜{S}(정규직)',
         '{L}의 미용사·스타일리스트 채용. 월급 30만엔부터, 지명 매출 70만엔이면 월급 35만엔(인센티브 50%). 완전 주 2일 휴무, 출산·육아휴직 복귀율 100%, 뉴욕·하와이 연수. 살롱 전용 197개 브랜드의 프런트숍형 살롱 SEAM에서 평생 미용사로 일할 수 있는 방식을.'],
  },
  assistant: {
    en: ['Hair Salon Assistant Jobs in {A} | ¥250,000+/month | {S} (Full-time)',
         'Hair salon assistant position in {L}. Monthly salary from ¥250,000, two full days off a week, 100% return rate after maternity leave. Learn both technique and product knowledge from the ground up at SEAM, a front-shop salon with 197 salon-exclusive brands.'],
    zh: ['{A}美发助理招聘｜月薪25万日元起｜{S}（正式员工）',
         '{L}的美发助理招聘。月薪25万日元起，完全每周双休，产假育儿假复职率100%。在拥有197个沙龙专售品牌的前店型沙龙SEAM，从基础开始培养技术与商品知识。'],
    tw: ['{A}美髮助理招募｜月薪25萬日圓起｜{S}（正職）',
         '{L}的美髮助理招募。月薪25萬日圓起，完全週休二日，產假育嬰假復職率100%。在擁有197個沙龍專售品牌的前店型沙龍SEAM，從基礎開始培養技術與商品知識。'],
    ko: ['{A} 미용사 어시스턴트 채용｜월급 25만엔~｜{S}(정규직)',
         '{L}의 미용사 어시스턴트 채용. 월급 25만엔부터, 완전 주 2일 휴무, 출산·육아휴직 복귀율 100%. 살롱 전용 197개 브랜드의 프런트숍형 살롱 SEAM에서 기술과 상품 지식을 기초부터 익힐 수 있는 환경.'],
  },
  parttime: {
    en: ['Part-time Shop Staff Jobs in {A} | ¥1,500/hour | {S}',
         'Part-time beauty shop staff in {L}. ¥1,500 per hour, weekend availability required. No hair care knowledge needed to start and no sales quotas. Serve customers on a shop floor lined with 197 salon-exclusive brands.'],
    zh: ['{A}店铺员工招聘（兼职）｜时薪1,500日元｜{S}',
         '{L}的美妆店铺兼职招聘。时薪1,500日元，需周末可上班。护发知识入职后再学即可，无业绩指标。在陈列197个沙龙专售品牌的卖场接待顾客。'],
    tw: ['{A}店鋪人員招募（兼職）｜時薪1,500日圓｜{S}',
         '{L}的美妝店鋪兼職招募。時薪1,500日圓，需週末可上班。護髮知識入職後再學即可，無業績指標。在陳列197個沙龍專售品牌的賣場接待顧客。'],
    ko: ['{A} 숍 스태프 채용(아르바이트)｜시급 1,500엔｜{S}',
         '{L}의 뷰티숍 아르바이트 채용. 시급 1,500엔, 주말 근무 가능한 분. 헤어케어 지식은 입사 후 배우면 됩니다. 노르마 없음. 살롱 전용 197개 브랜드가 진열된 매장에서의 접객.'],
  },
  shopmanager: {
    en: ['Shop Manager Jobs in {A} | ¥250,000+/month, bonus | {S} (Full-time)',
         'Beauty shop manager position in {L}. Monthly salary from ¥250,000 with performance bonus, two full days off a week, full social insurance. From building the shop floor of 197 salon-exclusive brands to product development and PR.'],
    zh: ['{A}店铺管理者招聘｜月薪25万日元起 有奖金｜{S}（正式员工）',
         '{L}的美妆店铺管理者招聘。月薪25万日元起，按业绩发放奖金，完全每周双休，社会保险齐全。从197个沙龙专售品牌的卖场打造，到商品开发与宣传，都能参与的工作。'],
    tw: ['{A}店鋪管理者招募｜月薪25萬日圓起 有獎金｜{S}（正職）',
         '{L}的美妝店鋪管理者招募。月薪25萬日圓起，依業績發放獎金，完全週休二日，社會保險齊全。從197個沙龍專售品牌的賣場打造，到商品開發與宣傳，都能參與的工作。'],
    ko: ['{A} 숍 관리자 채용｜월급 25만엔~ 상여 있음｜{S}(정규직)',
         '{L}의 뷰티숍 관리자 채용. 월급 25만엔부터, 실적에 따른 상여, 완전 주 2일 휴무, 사회보험 완비. 살롱 전용 197개 브랜드의 매장 만들기부터 상품 개발·홍보까지 참여할 수 있는 일.'],
  },
  spanist: {
    en: ['Head Spa Therapist (Spanist) Jobs in {A} | ¥300,000+/month | {S} (Full-time)',
         'Head spa therapist position in {L}. Monthly salary from ¥300,000. One-on-one head spa in a fully private room, no cuts or colour and no contact with colour chemicals. Two full days off a week, 100% return rate after maternity leave. A new career for licensed hairdressers.'],
    zh: ['{A}头疗师招聘（头皮SPA专职）｜月薪30万日元起｜{S}（正式员工）',
         '{L}的头疗师・头皮SPA师招聘。月薪30万日元起。在完全独立包间一对一进行头皮SPA的专职岗位，不做剪染、不接触染发剂。完全每周双休，产假育儿假复职率100%。发挥美发师执照的新职业道路。'],
    tw: ['{A}頭療師招募（頭皮SPA專職）｜月薪30萬日圓起｜{S}（正職）',
         '{L}的頭療師・頭皮SPA師招募。月薪30萬日圓起。在完全獨立包廂一對一進行頭皮SPA的專職，不做剪染、不接觸染髮劑。完全週休二日，產假育嬰假復職率100%。發揮美髮師執照的新職涯。'],
    ko: ['{A} 스파니스트 채용(헤드스파 전문직)｜월급 30만엔~｜{S}(정규직)',
         '{L}의 스파니스트·헤드스파 전문직 채용. 월급 30만엔부터. 완전 개인실에서 1대1 헤드스파 전문직, 컷·염색 없음, 염모제를 만지지 않는 근무 방식. 완전 주 2일 휴무, 출산·육아휴직 복귀율 100%. 미용사 면허를 살리는 새로운 커리어.'],
  },
};
function recruit(role, area) {
  const out = {};
  for (const l of ['en', 'zh', 'tw', 'ko']) {
    const [A, L] = AREA[area][l], S = STORE[l](area);
    out[l] = ROLE[role][l].map(s => s.replace(/\{A\}/g, A).replace(/\{L\}/g, L).replace(/\{S\}/g, S));
  }
  return out;
}

// ── 個別ページ ──
const META = {
  'guide-bleach': {
    en: ['Caring for Bleached Hair: Order and Product Choice | SEAM Hair Journal',
         'The order and choice of shampoo, treatment and leave-in care for bleached hair. A rubbery, stretchy feel when wet is a warning sign. Take the free Hair Finder that reads your hair history.'],
    zh: ['漂发后的护理 顺序与选法｜SEAM 头发专栏',
         '漂过的头发该怎么选、怎么用洗发水・护发素・免洗护理。湿发时像橡皮筋一样拉伸是危险信号。从发质履历出发的免费发质诊断。'],
    tw: ['漂髮後的護理 順序與選法｜SEAM 頭髮專欄',
         '漂過的頭髮該怎麼選、怎麼用洗髮精・護髮素・免沖洗護理。濕髮時像橡皮筋一樣拉伸是危險訊號。從髮質履歷出發的免費髮質診斷。'],
    ko: ['탈색모 케어 순서와 고르는 법｜SEAM 헤어 읽을거리',
         '탈색한 머리의 샴푸·트리트먼트·아웃배스 순서와 고르는 법. 젖으면 고무처럼 늘어나는 감촉은 주의 신호. 이력으로 보는 무료 모발 진단으로.'],
  },
  'guide-colorfade': {
    en: ['Daily Habits That Keep Hair Colour from Fading | SEAM Hair Journal',
         'Why hair colour fades fast and the daily habits that make it last: water temperature, heat, UV, how you wash, and how to choose a colour-care shampoo, explained by hair care professionals. Take the free Hair Finder to see how prone your hair is to fading.'],
    zh: ['防止染发褪色的每日习惯｜SEAM 头发专栏',
         '染发为什么容易掉色，以及让颜色更持久的每日习惯。水温・热・紫外线・洗法的重新检视，以及护色洗发水的选法，由护发专家解说。免费发质诊断可了解你的头发是否容易掉色。'],
    tw: ['防止染髮褪色的每日習慣｜SEAM 頭髮專欄',
         '染髮為什麼容易掉色，以及讓顏色更持久的每日習慣。水溫・熱・紫外線・洗法的重新檢視，以及護色洗髮精的選法，由護髮專家解說。免費髮質診斷可了解你的頭髮是否容易掉色。'],
    ko: ['헤어 컬러 색 빠짐을 막는 매일의 습관｜SEAM 헤어 읽을거리',
         '헤어 컬러가 빨리 빠지는 이유와 색을 오래 유지하는 매일의 습관. 물 온도·열·자외선·감는 법을 다시 보는 방법과 컬러 케어 샴푸 고르는 법을 헤어케어 전문가가 설명. 색 빠짐 정도를 알 수 있는 무료 모발 진단으로.'],
  },
  'guide-damage': {
    en: ['How to Care for Damaged and Bleached Hair | SEAM Hair Journal',
         'Why hair with a history of heat, friction, colour and bleach gets damaged, and how to care for it every day: drying that protects from heat, handling wet hair, and care matched to your hair and its history with the Hair Finder and at the salon.'],
    zh: ['受损发・漂发的呵护方法｜SEAM 头发专栏',
         '经历热・摩擦・染发・漂发的头发为什么会受损，以及每日的呵护方法。防热的吹干方式、湿发的处理，通过发质诊断和沙龙找到适合自己头发与履历的护理。'],
    tw: ['受損髮・漂髮的呵護方法｜SEAM 頭髮專欄',
         '經歷熱・摩擦・染髮・漂髮的頭髮為什麼會受損，以及每日的呵護方法。防熱的吹乾方式、濕髮的處理，透過髮質診斷和沙龍找到適合自己頭髮與履歷的護理。'],
    ko: ['손상모·탈색모를 돌보는 법｜SEAM 헤어 읽을거리',
         '열과 마찰, 컬러·탈색 이력이 쌓인 머리가 상하는 이유와 매일의 돌보는 법. 열로부터 지키는 말리는 법, 젖은 머리 다루기, 내 머리와 이력에 맞는 케어를 모발 진단과 살롱에서.'],
  },
  'guide-kamishitsu-shindan': {
    en: ['What Is a Hair Type Diagnosis? Free Hair Check and 5 Ways to Read Your Hair | SEAM',
         'What a hair type diagnosis actually looks at: thickness, volume, curl, damage and scalp, five things you can check yourself, what a diagnosis can and cannot tell you, and where to take the free Hair Finder. SEAM.'],
    zh: ['什么是发质诊断｜免费发质检测 了解自己头发的5个视角｜SEAM',
         '发质诊断到底在看什么。粗细・发量・卷曲・受损・头皮5个方面的自我检测方法，诊断能知道与不能知道的事，以及免费发质诊断的入口。SEAM。'],
    tw: ['什麼是髮質診斷｜免費髮質檢測 了解自己頭髮的5個視角｜SEAM',
         '髮質診斷到底在看什麼。粗細・髮量・捲曲・受損・頭皮5個方面的自我檢測方法，診斷能知道與不能知道的事，以及免費髮質診斷的入口。SEAM。'],
    ko: ['모발 진단이란｜무료 모발 체크 내 머리를 아는 5가지 시각｜SEAM',
         '모발 진단은 무엇을 보는가. 굵기·모량·곱슬·손상·두피 5가지를 스스로 확인하는 법과 진단으로 알 수 있는 것·없는 것, 무료 모발 진단 입구까지. SEAM.'],
  },
  'guide-kansou': {
    en: ['For Dry, Frizzy Hair | SEAM Hair Journal',
         'Why hair gets dry and frizzy, and what you can do every day: avoid over-washing, hold moisture with leave-in care, and find care that suits hair that changes with the season and age, with the Hair Finder and at the salon.'],
    zh: ['给干燥・毛躁的头发｜SEAM 头发专栏',
         '头发干燥・毛躁的原因与每天能做的事。避免过度清洗、用免洗护理锁住水分，随季节与年龄变化的头发，通过发质诊断和沙龙找到适合自己的护理。'],
    tw: ['給乾燥・毛躁的頭髮｜SEAM 頭髮專欄',
         '頭髮乾燥・毛躁的原因與每天能做的事。避免過度清洗、用免沖洗護理鎖住水分，隨季節與年齡變化的頭髮，透過髮質診斷和沙龍找到適合自己的護理。'],
    ko: ['푸석함·건조가 신경 쓰이는 머리에｜SEAM 헤어 읽을거리',
         '머리가 푸석하고 건조해지는 이유와 매일 할 수 있는 것. 과도한 세정을 피하고 아웃배스로 수분을 지키기. 계절과 나이로 달라지는 머리에 맞는 케어를 모발 진단과 살롱에서.'],
  },
  'guide-mens': {
    en: ["Men's Hair and Scalp | SEAM Hair Journal",
         "Hair care for men: oily scalp, odour, volume and how long styling holds. It starts with knowing your hair type. The Hair Finder works for men too, and you can talk it through at any SEAM salon in Japan."],
    zh: ['男士的头发与头皮｜SEAM 头发专栏',
         '男士护发。头皮油腻・异味・发量・造型持久度，从了解自己的发质开始。发质诊断男士也适用，全国的SEAM沙龙均可咨询。'],
    tw: ['男士的頭髮與頭皮｜SEAM 頭髮專欄',
         '男士護髮。頭皮油膩・異味・髮量・造型持久度，從了解自己的髮質開始。髮質診斷男士也適用，全國的SEAM沙龍均可諮詢。'],
    ko: ['남성의 머리카락과 두피｜SEAM 헤어 읽을거리',
         '남성 헤어케어. 두피 번들거림·냄새·볼륨·스타일링 유지력은 내 모발 타입을 아는 것부터. 모발 진단은 남성도 OK, 전국 SEAM 살롱에서 상담.'],
  },
  'guide-mirai-soap': {
    en: ['Before the Foam, a Story About Water: MIRAI SOAP | SEAM',
         'MIRAI SOAP, a whole-body soap born from the functional water used in SEAM head spas. Hydrogen and carbonate worked into natural terahertz water from Takachiho, made without heat, with about 60% less surfactant. A new idea: "off" before the hair care.'],
    zh: ['在泡沫之前 先说水的故事 MIRAI SOAP｜SEAM',
         '源自SEAM头皮SPA所用机能水的全身皂 MIRAI SOAP（未来皂）。以高千穗天然太赫兹水揉入氢与碳酸的非加热制法，表面活性剂减少约60%。在新的护发之前，先「卸下」的提案。'],
    tw: ['在泡沫之前 先說水的故事 MIRAI SOAP｜SEAM',
         '源自SEAM頭皮SPA所用機能水的全身皂 MIRAI SOAP（未來皂）。以高千穗天然太赫茲水揉入氫與碳酸的非加熱製法，界面活性劑減少約60%。在新的護髮之前，先「卸下」的提案。'],
    ko: ['거품보다 먼저 물 이야기 MIRAI SOAP｜SEAM',
         'SEAM 헤드스파에 쓰는 기능수에서 태어난 전신 비누 MIRAI SOAP(미라이 소프). 다카치호의 천연 테라헤르츠수에 수소와 탄산을 넣은 비가열 제법, 계면활성제 약 60% 컷. 새 헤어케어 앞의 "오프"라는 제안.'],
  },
  'guide-perm': {
    en: ['Care and Styling That Make a Perm Last | SEAM',
         'For perms that drop or loosen quickly: how to dry, how to choose styling products, and the difference between digital and cold perms, explained by hair care professionals. Take the free Hair Finder to see how well your hair holds a curl.'],
    zh: ['让烫发更持久的护理与造型｜SEAM',
         '烫发很快就塌・容易掉的人。吹干方式与造型品的选法，数码烫与冷烫的区别，由护发专家解说。免费发质诊断可了解卷度的持久性。'],
    tw: ['讓燙髮更持久的護理與造型｜SEAM',
         '燙髮很快就塌・容易掉的人。吹乾方式與造型品的選法，數位燙與冷燙的區別，由護髮專家解說。免費髮質診斷可了解捲度的持久性。'],
    ko: ['펌을 오래 유지하는 케어와 스타일링｜SEAM',
         '펌이 금방 풀리는·잘 빠지는 분께. 말리는 법과 스타일링제 고르는 법, 디지털 펌과 콜드 펌의 차이를 헤어케어 전문가가 설명. 컬 유지력을 알 수 있는 무료 모발 진단으로.'],
  },
  'guide-salon-senyo': {
    en: ['What Are Salon-Exclusive Hair Products? Where to Buy, How They Differ from Retail, Online and Stores | SEAM',
         'What salon-exclusive (professional) hair products are, where to buy them, how they differ from drugstore products, how to choose a salon shampoo, how to buy online, the main brands (Aujua, Milbon, Sublimic, TOKIO and 197 more) and why buying from an authorized retailer matters. SEAM.'],
    zh: ['什么是沙龙专售品｜哪里能买？与市售的区别・网购・销售店｜SEAM',
         '沙龙专售品（美发沙龙专售品）是什么、在哪里能买、与市售品有什么区别。沙龙专售洗发水的选法、网购方式、主要品牌（Aujua・Milbon・Sublimic・TOKIO 等197个）以及在正规销售店购买的好处。SEAM。'],
    tw: ['什麼是沙龍專售品｜哪裡能買？與市售的區別・網購・銷售店｜SEAM',
         '沙龍專售品（美髮沙龍專售品）是什麼、在哪裡能買、與市售品有什麼區別。沙龍專售洗髮精的選法、網購方式、主要品牌（Aujua・Milbon・Sublimic・TOKIO 等197個）以及在正規銷售店購買的好處。SEAM。'],
    ko: ['살롱 전용 제품이란｜어디서 살 수 있나? 시판과의 차이·통판·판매점｜SEAM',
         '살롱 전용 제품(미용실 전용 제품)이란 무엇인지, 어디서 살 수 있는지, 시판과의 차이는 무엇인지. 살롱 전용 샴푸 고르는 법, 통판으로 사는 법, 주요 브랜드(오쥬아·밀본·서브리믹·TOKIO 외 197)와 정규 판매점에서 사는 장점까지. SEAM.'],
  },
  'guide-scalp': {
    en: ['Healthy Hair Starts at the Scalp | SEAM Hair Journal',
         'The scalp is the foundation of hair. Why it gets dry, oily, smelly or tight, plus daily washing and scalp massage tips. For a healthy scalp, take the Hair Finder and visit a private-room head spa.'],
    zh: ['从头皮开始调理头发｜SEAM 头发专栏',
         '头发的根基是头皮。干燥・油腻・异味・紧绷的原因，以及每日洗法・头皮按摩的提示。为了健康的头皮环境，欢迎使用发质诊断与独立包间头皮SPA。'],
    tw: ['從頭皮開始調理頭髮｜SEAM 頭髮專欄',
         '頭髮的根基是頭皮。乾燥・油膩・異味・緊繃的原因，以及每日洗法・頭皮按摩的提示。為了健康的頭皮環境，歡迎使用髮質診斷與獨立包廂頭皮SPA。'],
    ko: ['두피부터 머리를 가다듬다｜SEAM 헤어 읽을거리',
         '머리카락의 토대는 두피. 건조·번들거림·냄새·뻣뻣함의 이유와 매일 감는 법·두피 마사지 힌트. 건강한 두피 환경을 위해 모발 진단과 개인실 헤드스파로.'],
  },
  'guide-shiraga': {
    en: ['Living with Grey Hair | SEAM Hair Journal',
         'For hair and scalp where greys are starting to show: why grey hair increases, daily care tips, and the freedom to hide it, embrace it or colour it. Find care that suits you with the Hair Finder and at SEAM certified salons across Japan.'],
    zh: ['与白发相处的方法｜SEAM 头发专栏',
         '给开始在意白发的头发与头皮。白发为什么会增加、每日护理的提示，遮盖・活用・染色都自由。通过发质诊断和全国的SEAM认定沙龙找到适合自己的护理。'],
    tw: ['與白髮相處的方法｜SEAM 頭髮專欄',
         '給開始在意白髮的頭髮與頭皮。白髮為什麼會增加、每日護理的提示，遮蓋・活用・染色都自由。透過髮質診斷和全國的SEAM認定沙龍找到適合自己的護理。'],
    ko: ['새치와 함께하는 법｜SEAM 헤어 읽을거리',
         '새치가 신경 쓰이기 시작한 머리와 두피에. 새치가 늘어나는 이유, 매일 케어 힌트, 가리든 살리든 염색하든 자유. 내게 맞는 케어를 모발 진단과 전국 SEAM 인정 살롱에서.'],
  },
  'guide-straightening': {
    en: ['Choosing Shampoo and Treatment after Straightening | SEAM',
         'Home care for straightened hair: washing on the day, choosing your daily shampoo and treatment, and how to use irons, explained by hair care professionals. Take the free Hair Finder that reads your straightening history.'],
    zh: ['缩毛矫正后的洗发水・护发素选法｜SEAM',
         '缩毛矫正后头发的居家护理。当天的洗发、每日洗发水与护发素的选法、与直发夹的相处方式，由护发专家解说。从矫正履历出发的免费发质诊断。'],
    tw: ['縮毛矯正後的洗髮精・護髮素選法｜SEAM',
         '縮毛矯正後頭髮的居家護理。當天的洗髮、每日洗髮精與護髮素的選法、與離子夾的相處方式，由護髮專家解說。從矯正履歷出發的免費髮質診斷。'],
    ko: ['매직 스트레이트 후 샴푸·트리트먼트 고르는 법｜SEAM',
         '매직 스트레이트한 머리의 홈케어. 당일 세발, 매일의 샴푸와 트리트먼트 고르는 법, 고데기와의 관계를 헤어케어 전문가가 설명. 스트레이트 이력으로 보는 무료 모발 진단으로.'],
  },
  'guide-uneri': {
    en: ['Living with Wavy, Curly and Frizzy Hair | SEAM Hair Journal',
         'Why hair frizzes in humidity and waves as the day goes on, with daily tips on drying and handling curly hair. Straighten it or embrace it, your way. Get to know your hair with the Hair Finder.'],
    zh: ['与卷曲・自然卷相处的方法｜SEAM 头发专栏',
         '湿气一来就毛躁、时间一长就卷曲。自然卷・卷曲发的原因，以及每日吹干・打理的提示。拉直或活用，都做自己。用发质诊断了解自己的头发。'],
    tw: ['與捲曲・自然捲相處的方法｜SEAM 頭髮專欄',
         '濕氣一來就毛躁、時間一長就捲曲。自然捲・捲曲髮的原因，以及每日吹乾・打理的提示。拉直或活用，都做自己。用髮質診斷了解自己的頭髮。'],
    ko: ['웨이브·곱슬머리와 함께하는 법｜SEAM 헤어 읽을거리',
         '습기에 퍼지고 시간이 지나면 웨이브가 생기는 곱슬·웨이브 머리의 이유와 매일 말리는 법·다루는 법 힌트. 펴든 살리든 나답게. 내 머리를 아는 모발 진단으로.'],
  },
  'journal': {
    en: ['Hair Journal | SEAM — Guides for Every Hair Concern and the Hair Finder',
         'Wavy, damaged, dry, grey, scalp, men and more: hair care professionals gently explain how to approach each hair concern. Take the free Hair Finder to learn your hair type and history, and visit SEAM at 7 stores across Japan.'],
    zh: ['头发专栏｜SEAM — 头发烦恼指南与发质诊断',
         '卷曲・受损・干燥・白发・头皮・男士等，各种头发烦恼的应对方法，由护发专家温和解说。免费发质诊断了解自己的发质与履历，欢迎前往全国7家SEAM门店。'],
    tw: ['頭髮專欄｜SEAM — 頭髮煩惱指南與髮質診斷',
         '捲曲・受損・乾燥・白髮・頭皮・男士等，各種頭髮煩惱的應對方法，由護髮專家溫和解說。免費髮質診斷了解自己的髮質與履歷，歡迎前往全國7家SEAM門市。'],
    ko: ['헤어 읽을거리｜SEAM — 머리 고민 가이드와 모발 진단',
         '웨이브·손상·건조·새치·두피·남성 등 머리 고민별로 마주하는 법을 헤어케어 전문가가 부드럽게 설명. 내 모발 타입과 이력을 알 수 있는 무료 모발 진단과 전국 7개 매장의 SEAM으로.'],
  },
  'press': {
    en: ['Press, Media, Trade and Pop-up Enquiries | SEAM',
         'Contact point for press and media coverage of SEAM, and for stocking our products, pop-ups and joint projects. A select shop and hair salon for 197 salon-exclusive hair care brands with 7 stores across Japan. Company profile and interview topics are here too.'],
    zh: ['媒体・采访／合作・快闪店咨询｜SEAM',
         'SEAM的采访・报道，以及商品经销、快闪店、联合企划的咨询窗口。汇集197个沙龙专售护发品牌的精选店＆美发沙龙，全国7家门店。公司概要与可供采访的主题也在此。'],
    tw: ['媒體・採訪／合作・快閃店諮詢｜SEAM',
         'SEAM的採訪・報導，以及商品經銷、快閃店、聯合企劃的諮詢窗口。匯集197個沙龍專售護髮品牌的精選店＆美髮沙龍，全國7家門市。公司概要與可供採訪的主題也在此。'],
    ko: ['미디어·취재／거래·팝업 문의｜SEAM',
         'SEAM의 취재·게재 및 상품 취급, 팝업, 공동 기획 문의 창구. 살롱 전용 헤어케어 197개 브랜드의 셀렉트숍＆헤어살롱, 전국 7개 매장. 회사 개요와 취재 가능한 주제도 여기에.'],
  },
  'privacy': {
    en: ['Privacy Policy | SEAM',
         'Privacy policy of SEAM (seam.site): information we collect, purposes of use, third-party disclosure, cookies and analytics, security management and disclosure requests.'],
    zh: ['隐私政策｜SEAM',
         'SEAM（seam.site）的隐私政策。收集的信息、使用目的、第三方提供、Cookie・访问分析、安全管理、开示请求。'],
    tw: ['隱私權政策｜SEAM',
         'SEAM（seam.site）的隱私權政策。收集的資訊、使用目的、第三方提供、Cookie・存取分析、安全管理、開示請求。'],
    ko: ['개인정보 처리방침｜SEAM',
         'SEAM(seam.site)의 개인정보 처리방침. 수집하는 정보, 이용 목적, 제3자 제공, 쿠키·접속 분석, 안전 관리, 공개 청구에 대해.'],
  },
  'terms': {
    en: ['Terms of Use | SEAM',
         'Terms of use of SEAM (seam.site): ownership of copyright and intellectual property, prohibition of unauthorized reproduction, scraping, automated collection and use for AI training, trademarks and disclaimers.'],
    zh: ['使用条款｜SEAM',
         'SEAM（seam.site）的使用条款。著作权・知识产权的归属，禁止擅自复制・转载・抓取・自动收集・用于AI学习，商标与免责事项。'],
    tw: ['使用條款｜SEAM',
         'SEAM（seam.site）的使用條款。著作權・智慧財產權的歸屬，禁止擅自複製・轉載・抓取・自動收集・用於AI學習，商標與免責事項。'],
    ko: ['이용약관｜SEAM',
         'SEAM(seam.site)의 이용약관. 저작권·지식재산권의 귀속, 무단 복제·전재·스크래핑·자동 수집·AI 학습 목적 이용 금지, 상표, 면책에 대해.'],
  },
  'tokushoho': {
    en: ['Notice under the Act on Specified Commercial Transactions | SEAM',
         'Notice of SEAM (seam.site) under the Act on Specified Commercial Transactions.'],
    zh: ['基于特定商业交易法的标示｜SEAM',
         'SEAM（seam.site）基于特定商业交易法的标示。'],
    tw: ['基於特定商業交易法的標示｜SEAM',
         'SEAM（seam.site）基於特定商業交易法的標示。'],
    ko: ['특정상거래법에 근거한 표기｜SEAM',
         'SEAM(seam.site)의 특정상거래법에 근거한 표기.'],
  },
  'recruit': {
    en: ['Hair Stylist Careers at SEAM | Facing Clients, Income, Days Off and Your Future',
         'For hairdressers who want to keep going for the long run. SEAM (hanico Inc.) is a salon that faces new-client acquisition, income, days off, parenting, technical education and future careers head-on. Two full days off a week, 50% commission on designated sales, 100% return rate after maternity leave. Now hiring in Ginza, Sapporo, Osaka, Nagoya, Fukuoka and more.'],
    zh: ['美发师招聘・招聘信息｜正视集客・收入・休假・未来烦恼的SEAM',
         '致想长久做美发师的你。SEAM（株式会社hanico）是一家正视新客集客、收入、休假、育儿、技术教育与未来职业发展的美发沙龙。完全每周双休、指名提成50%、产假育儿假复职率100%。银座・札幌・大阪・名古屋・福冈等地招聘中。'],
    tw: ['美髮師招募・徵才資訊｜正視集客・收入・休假・未來煩惱的SEAM',
         '致想長久當美髮師的你。SEAM（株式會社hanico）是一家正視新客集客、收入、休假、育兒、技術教育與未來職涯的美髮沙龍。完全週休二日、指名抽成50%、產假育嬰假復職率100%。銀座・札幌・大阪・名古屋・福岡等地招募中。'],
    ko: ['미용사 채용·채용 정보｜집객·수입·휴일·장래의 고민과 마주하는 SEAM',
         '미용사를 오래 하고 싶은 분께. SEAM(주식회사 hanico)은 신규 집객, 수입, 휴일, 육아, 기술 교육, 장래의 커리어와 마주하는 미용실입니다. 완전 주 2일 휴무, 지명 인센티브 50%, 출산·육아휴직 복귀율 100%. 긴자·삿포로·오사카·나고야·후쿠오카 등에서 채용 중.'],
  },
  'rekera': {
    en: ['Rekera Retailer | Rekera Emulsion, Mist and Oil | SEAM',
         'SEAM is an authorized retailer of Rekera (Rekera Emulsion, Rekera Mist, Rekera Oil). Shopping-only visits are welcome at all 7 stores across Japan. Register in store and you can also buy from our members-only online shop.'],
    zh: ['Rekera 销售店・正规授权零售商｜Rekera乳液・喷雾・护发油｜SEAM',
         'SEAM是Rekera（Rekera乳液・Rekera喷雾・Rekera护发油）的正规销售店。全国7家门店欢迎只为购物到店。在店头登录后，也可在会员制在线商店购买。'],
    tw: ['Rekera 銷售店・正規授權零售商｜Rekera乳液・噴霧・護髮油｜SEAM',
         'SEAM是Rekera（Rekera乳液・Rekera噴霧・Rekera護髮油）的正規銷售店。全國7家門市歡迎只為購物到店。在店頭登錄後，也可在會員制線上商店購買。'],
    ko: ['리케라 취급점·정규 판매점｜리케라 에멀전｜SEAM',
         'SEAM은 리케라(리케라 에멀전·리케라 미스트·리케라 오일)의 정규 취급점입니다. 전국 7개 매장에서 구매만 하셔도 환영합니다. 매장에서 등록하시면 회원제 온라인숍에서도 구매하실 수 있습니다.'],
  },
  'recruit-assistant-fukuoka':      recruit('assistant',   'fukuoka'),
  'recruit-parttime-ginza':         recruit('parttime',    'ginza'),
  'recruit-parttime-omotesando':    recruit('parttime',    'omotesando'),
  'recruit-shopmanager-ginza':      recruit('shopmanager', 'ginza'),
  'recruit-shopmanager-omotesando': recruit('shopmanager', 'omotesando'),
  'recruit-shopmanager-sapporo':    recruit('shopmanager', 'sapporo'),
  'recruit-spanist-ginza':          recruit('spanist',     'ginza'),
  'recruit-spanist-nagoya':         recruit('spanist',     'nagoya'),
  'recruit-spanist-osaka':          recruit('spanist',     'osaka'),
  'recruit-stylist-fukuoka':        recruit('stylist',     'fukuoka'),
  'recruit-stylist-ginza':          recruit('stylist',     'ginza'),
  'recruit-stylist-nagoya':         recruit('stylist',     'nagoya'),
  'recruit-stylist-osaka':          recruit('stylist',     'osaka'),
  'recruit-stylist-sapporo':        recruit('stylist',     'sapporo'),
};

// hreflang を入れる ja ページ（meta を足す33 + 既に訳はあるが hreflang だけ無い ginza-spa-journey）
const HREFLANG_PAGES = [...Object.keys(META), 'ginza-spa-journey'];

// 辞書の範囲を取り出す（build-i18n.js と同じ 波括弧走査）
function dictSpan(src) {
  const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src);
  if (!m) return null;
  const bs = src.indexOf('{', m.index);
  let d = 0, mode = null, esc = false;
  for (let i = bs; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return [bs, i + 1]; }
  }
  return null;
}
const unesc = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

let metaAdded = 0, hrefAdded = 0, dupFixed = 0, skipped = [];
for (const page of HREFLANG_PAGES) {
  const f = path.join(ROOT, page + '.html');
  if (!fs.existsSync(f)) { skipped.push(page + '（無い）'); continue; }
  let src = fs.readFileSync(f, 'utf8');
  const before = src;

  // 3. 県名+市名の二重
  if (/福岡福岡エリア|大阪大阪エリア/.test(src)) {
    src = src.replace(/福岡福岡エリア/g, '福岡エリア').replace(/大阪大阪エリア/g, '大阪エリア');
    dupFixed++;
  }

  // 1. meta 訳
  if (META[page]) {
    const span = dictSpan(src);
    if (!span) { skipped.push(page + '（辞書なし）'); continue; }
    const raw = src.slice(span[0], span[1]);
    let dict;
    try { dict = JSON.parse(raw); } catch (e) { skipped.push(page + '（JSONでない）'); continue; }
    if (JSON.stringify(dict) !== raw) { skipped.push(page + '（往復でずれる）'); continue; }
    if (!dict.ja || !dict.en) { skipped.push(page + '（ja/en 無し）'); continue; }
    if (dict.en['meta.title'] === undefined) {
      const title = unesc((/<title>([^<]*)<\/title>/.exec(src) || [, ''])[1].trim());
      const desc = unesc((/<meta name="description" content="([^"]*)"/.exec(src) || [, ''])[1]);
      if (!title) { skipped.push(page + '（title 無し）'); continue; }
      const put = (lang, t, d) => {
        // 先頭に置く（読んだとき meta が最初に見える）
        dict[lang] = Object.assign({ 'meta.title': t, 'meta.description': d }, dict[lang]);
      };
      put('ja', title, desc);
      for (const l of ['en', 'zh', 'tw', 'ko']) {
        if (!dict[l]) { skipped.push(page + '（' + l + ' 無し）'); continue; }
        put(l, META[page][l][0], META[page][l][1]);
      }
      src = src.slice(0, span[0]) + JSON.stringify(dict) + src.slice(span[1]);
      metaAdded++;
    }
  }

  // 2. hreflang
  if (!/hreflang=/.test(src)) {
    const u = BASE + '/' + page;
    const block = [
      '<!-- seam:hreflang:start -->',
      `<link rel="alternate" hreflang="ja" href="${u}">`,
      `<link rel="alternate" hreflang="en" href="${BASE}/en/${page}">`,
      `<link rel="alternate" hreflang="zh-Hans" href="${BASE}/zh/${page}">`,
      `<link rel="alternate" hreflang="zh-Hant" href="${BASE}/tw/${page}">`,
      `<link rel="alternate" hreflang="ko" href="${BASE}/ko/${page}">`,
      `<link rel="alternate" hreflang="x-default" href="${u}">`,
      '<!-- seam:hreflang:end -->',
    ].join('\n');
    const i = src.indexOf('</head>');
    if (i < 0) { skipped.push(page + '（</head> 無し）'); continue; }
    src = src.slice(0, i) + block + '\n' + src.slice(i);
    hrefAdded++;
  }

  if (src !== before) fs.writeFileSync(f, src, 'utf8');
}
console.log(`  meta 訳を足した ${metaAdded}枚 / hreflang を足した ${hrefAdded}枚 / 県名二重を直した ${dupFixed}枚`);
if (skipped.length) console.log('  飛ばした: ' + skipped.join(' '));

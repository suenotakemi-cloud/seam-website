/* SEAM: 決まった型の訳を作る（2026-09-07）
 *
 * 【なぜ】ブランド×エリアのページは同じ文をブランド名と地名だけ差し替えて使っている。
 *   「{B}<br>{A}で"買うだけ"OK」だけで112本ある。1本ずつ手で訳すと
 *   同じ文を何十回も書くことになり 表記もぶれる。
 *   型に当てはまるものは 型の訳＋固有名詞の差し替えで作る。
 *
 * 【固有名詞】ブランド名はラテン表記のまま（既存の訳の作法：ミルボン→Milbon）。
 *   資生堂だけ zh/tw は漢字。地名は言語ごとの読み（銀座→Ginza/银座/銀座/긴자）。
 *   台帳に無いブランド・地名が出たら 素通しにせず ✘ を出して止める。
 *
 * 【型の当て方】原文の固有名詞を印に置き換えてから 型の表と突き合わせる。
 *   長いものから置換しないと「オッジオット」が「オッジィオット」に負ける。
 *
 * 出力: 標準出力に i18n_add.js が食べられる形。
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = process.argv[2];
const LANGS = ['en', 'zh', 'tw', 'ko'];
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'source.json'), 'utf8'));

const BRAND = {
  'オージュア': ['Aujua', 'Aujua', 'Aujua', 'Aujua'],
  'ケラスターゼ': ['Kérastase', 'Kérastase', 'Kérastase', 'Kérastase'],
  'ミルボン': ['Milbon', 'Milbon', 'Milbon', 'Milbon'],
  'バイカルテ': ['By Karte', 'By Karte', 'By Karte', 'By Karte'],
  'ダヴィネス': ['Davines', 'Davines', 'Davines', 'Davines'],
  'エルジューダ': ['Elujuda', 'Elujuda', 'Elujuda', 'Elujuda'],
  'オッジィオット': ['Oggi otto', 'Oggi otto', 'Oggi otto', 'Oggi otto'],
  'オッジオット': ['Oggi otto', 'Oggi otto', 'Oggi otto', 'Oggi otto'],
  'サブリミック': ['SUBLIMIC', 'SUBLIMIC', 'SUBLIMIC', 'SUBLIMIC'],
  'シュウ ウエムラ': ['Shu Uemura', 'Shu Uemura', 'Shu Uemura', 'Shu Uemura'],
  'ラッシュアディクト': ['Lash Addict', 'Lash Addict', 'Lash Addict', 'Lash Addict'],
  'トキオ インカラミ': ['TOKIO INKARAMI', 'TOKIO INKARAMI', 'TOKIO INKARAMI', 'TOKIO INKARAMI'],
  'システムプロフェッショナル': ['System Professional', 'System Professional', 'System Professional', 'System Professional'],
  '資生堂プロフェッショナル': ['Shiseido Professional', '资生堂 Professional', '資生堂 Professional', 'Shiseido Professional'],
  'つるりんちょ。': ['Tsururincho', 'Tsururincho', 'Tsururincho', 'Tsururincho'],
  'レケラ': ['REKERA', 'REKERA', 'REKERA', 'REKERA'],
  'SEE/SAW': ['SEE/SAW', 'SEE/SAW', 'SEE/SAW', 'SEE/SAW'],
  '1DK': ['1DK', '1DK', '1DK', '1DK'],
  'TOKIO': ['TOKIO', 'TOKIO', 'TOKIO', 'TOKIO'],
};
const AREA = {
  '南青山': ['Minami-Aoyama', '南青山', '南青山', '미나미아오야마'],
  '表参道': ['Omotesando', '表参道', '表參道', '오모테산도'],
  '宇都宮': ['Utsunomiya', '宇都宫', '宇都宮', '우쓰노미야'],
  '名古屋': ['Nagoya', '名古屋', '名古屋', '나고야'],
  '銀座': ['Ginza', '银座', '銀座', '긴자'],
  '大阪': ['Osaka', '大阪', '大阪', '오사카'],
  '堀江': ['Horie', '堀江', '堀江', '호리에'],
  '福岡': ['Fukuoka', '福冈', '福岡', '후쿠오카'],
  '天神': ['Tenjin', '天神', '天神', '텐진'],
  '札幌': ['Sapporo', '札幌', '札幌', '삿포로'],
  '大通': ['Odori', '大通', '大通', '오도리'],
  '東京': ['Tokyo', '东京', '東京', '도쿄'],
  '栄': ['Sakae', '荣', '榮', '사카에'],
};
const STORE = ['SEAM GINZA', 'SEAM OMOTESANDO', 'SEAM OSAKA', 'SEAM NAGOYA', 'SEAM FUKUOKA',
  'SEAM SAPPORO', 'SEAM UTSUNOMIYA', 'gallica / SEAM', 'gigi SEAM'];

/* 型の表。鍵は 固有名詞を印に置き換えた日本語 */
const TPL = {
  '{B}は美容室専売品（サロン専売品）です SEAMは正規取扱店として<strong class="font-normal text-ink" data-i18n="bp.ui.shoponly">販売のみのご来店</strong>を歓迎しています 施術も予約も要りません<br>店頭でご登録いただくと 買い足しは<a href="onlineshop.html" class="border-b border-line" data-i18n="bp.ui.memberShop">会員制のネットショップ</a>から通販でご注文いただけます': [
    '{B} is a salon-exclusive brand. As an authorized retailer, SEAM welcomes <strong class="font-normal text-ink" data-i18n="bp.ui.shoponly">buy-only visits</strong> \u2014 no treatment and no booking needed.<br>Register in store and you can reorder from our <a href="onlineshop.html" class="border-b border-line" data-i18n="bp.ui.memberShop">members-only online shop</a>.',
    '{B} 是沙龙专售品。SEAM 作为授权经销商 欢迎<strong class="font-normal text-ink" data-i18n="bp.ui.shoponly">只购买的到店</strong> 无需护理 也无需预约<br>在店内登记后 补货可从<a href="onlineshop.html" class="border-b border-line" data-i18n="bp.ui.memberShop">会员制网店</a>下单邮寄',
    '{B} 是沙龍專售品。SEAM 作為授權經銷商 歡迎<strong class="font-normal text-ink" data-i18n="bp.ui.shoponly">只購買的到店</strong> 無需護理 也無需預約<br>在店內登記後 補貨可從<a href="onlineshop.html" class="border-b border-line" data-i18n="bp.ui.memberShop">會員制網路商店</a>下單寄送',
    '{B}는 살롱 전용 제품입니다. SEAM은 정규 취급점으로서 <strong class="font-normal text-ink" data-i18n="bp.ui.shoponly">구매만 하는 방문</strong>을 환영합니다. 시술도 예약도 필요 없습니다<br>매장에서 등록하시면 재구매는 <a href="onlineshop.html" class="border-b border-line" data-i18n="bp.ui.memberShop">회원제 온라인 숍</a>에서 주문하실 수 있습니다'],
  '<a href="{IG}" target="_blank" rel="noopener" class="text-gold hover:underline underline-offset-4" data-i18n="bp.igLink">店舗アカウントを見る \u2197</a>(在庫のお問い合わせもこちらへ)': [
    '<a href="{IG}" target="_blank" rel="noopener" class="text-gold hover:underline underline-offset-4" data-i18n="bp.igLink">See the store account \u2197</a> (stock enquiries here too)',
    '<a href="{IG}" target="_blank" rel="noopener" class="text-gold hover:underline underline-offset-4" data-i18n="bp.igLink">查看门店账号 \u2197</a>（库存咨询也请由此）',
    '<a href="{IG}" target="_blank" rel="noopener" class="text-gold hover:underline underline-offset-4" data-i18n="bp.igLink">查看門市帳號 \u2197</a>（庫存洽詢也請由此）',
    '<a href="{IG}" target="_blank" rel="noopener" class="text-gold hover:underline underline-offset-4" data-i18n="bp.igLink">매장 계정 보기 \u2197</a>（재고 문의도 이곳으로）'],
  '{B}<br>{A}で"買うだけ"OK': [
    '{B}<br>Buy only, in {A}', '{B}<br>在{A}只购买也OK', '{B}<br>在{A}只購買也OK', '{B}<br>{A}에서 구매만 OK'],
  '施術もご予約もいりません<br>{店}は {B}をメーカー公認の正規ルートで取り扱うヘアケアショップ<br>お買い物だけのご来店を歓迎しています': [
    'No treatment, no booking.<br>{店} is a hair care shop carrying {B} through the maker-authorized route.<br>Shopping-only visits are welcome.',
    '无需护理 也无需预约<br>{店} 是通过厂商公认正规渠道经销 {B} 的护发商店<br>欢迎只为购物到店',
    '無需護理 也無需預約<br>{店} 是透過廠商公認正規通路經銷 {B} 的護髮商店<br>歡迎只為購物到店',
    '시술도 예약도 필요 없습니다<br>{店}은 {B}를 제조사 공인 정규 루트로 취급하는 헤어케어 숍입니다<br>구매만 하시는 방문을 환영합니다'],
  '施術もご予約もいりません<br>{店} HORIEは {B}をメーカー公認の正規ルートで取り扱うヘアケアショップ<br>お買い物だけのご来店を歓迎しています': [
    'No treatment, no booking.<br>{店} HORIE is a hair care shop carrying {B} through the maker-authorized route.<br>Shopping-only visits are welcome.',
    '无需护理 也无需预约<br>{店} HORIE 是通过厂商公认正规渠道经销 {B} 的护发商店<br>欢迎只为购物到店',
    '無需護理 也無需預約<br>{店} HORIE 是透過廠商公認正規通路經銷 {B} 的護髮商店<br>歡迎只為購物到店',
    '시술도 예약도 필요 없습니다<br>{店} HORIE는 {B}를 제조사 공인 정규 루트로 취급하는 헤어케어 숍입니다<br>구매만 하시는 방문을 환영합니다'],
  '{A}で{B}を買う →': ['Buy {B} in {A} →', '在{A}购买 {B} →', '在{A}購買 {B} →', '{A}에서 {B} 구매 →'],
  '{B}が今の髪に合うか<br>3分でわかります': [
    'See whether {B} suits your hair now<br>in three minutes',
    '{B} 是否适合现在的头发<br>3分钟就知道',
    '{B} 是否適合現在的頭髮<br>3分鐘就知道',
    '{B}가 지금 내 모발에 맞는지<br>3분이면 알 수 있습니다'],
  '{B}取扱店': ['{B} authorized retailer', '{B} 授权经销店', '{B} 授權經銷店', '{B} 정규 취급점'],
  '{B}の取扱店一覧（全国）': ['{B} authorized retailers (nationwide)', '{B} 授权经销店一览（全国）', '{B} 授權經銷店一覽（全國）', '{B} 정규 취급점 목록（전국）'],
  '{A}のどこで{B}が買えますか': ['Where in {A} can I buy {B}?', '在{A}的哪里能买到 {B}', '在{A}的哪裡能買到 {B}', '{A}의 어디에서 {B}를 살 수 있나요'],
  '{B}の商品を見る →': ['See {B} products →', '查看 {B} 商品 →', '查看 {B} 商品 →', '{B} 제품 보기 →'],
  '{B}のどのラインを扱っていますか': ['Which {B} lines do you carry?', '经销 {B} 的哪些系列', '經銷 {B} 的哪些系列', '{B}의 어떤 라인을 취급하나요'],
  'SEAM {A}の店舗情報をみる →': ['See SEAM {A} store details →', '查看 SEAM {A} 门店信息 →', '查看 SEAM {A} 門市資訊 →', 'SEAM {A} 매장 정보 보기 →'],
  '募集要項 — 美容師スタイリスト（{A}）': ['Role details — Stylist ({A})', '招聘要项 — 美发师造型师（{A}）', '徵才資訊 — 美髮師造型師（{A}）', '모집 요강 — 헤어 스타일리스트（{A}）'],
  '{A}の美容師求人（スタイリスト）': ['Hairdresser jobs in {A} (stylist)', '{A}的美发师招聘（造型师）', '{A}的美髮師徵才（造型師）', '{A}의 미용사 채용（스타일리스트）'],
  '{A}の美容師求人 →': ['Hairdresser jobs in {A} →', '{A}的美发师招聘 →', '{A}的美髮師徵才 →', '{A}의 미용사 채용 →'],
  '{A}の美容師<br>スタイリスト求人': ['Hairdresser and stylist<br>jobs in {A}', '{A}的美发师<br>造型师招聘', '{A}的美髮師<br>造型師徵才', '{A}의 미용사<br>스타일리스트 채용'],
  '{A}の店舗情報': ['{A} store details', '{A}的门店信息', '{A}的門市資訊', '{A} 매장 정보'],
  '{A}のヘアサロン': ['Hair salon in {A}', '{A}的美发沙龙', '{A}的美髮沙龍', '{A}의 헤어살롱'],
  '{A}のスタイリスト求人': ['Stylist jobs in {A}', '{A}的造型师招聘', '{A}的造型師徵才', '{A}의 스타일리스트 채용'],
  '{A}のどのあたりですか': ['Whereabouts in {A} is it?', '在{A}的哪一带', '在{A}的哪一帶', '{A}의 어느 부근인가요'],
  '{A}店の詳細': ['{A} store details', '{A}店详情', '{A}店詳情', '{A}점 상세'],
  '{A}のヘッドスパ': ['Head spa in {A}', '{A}的头部水疗', '{A}的頭部水療', '{A}의 헤드스파'],
  '{A}の個室美容室': ['Private-room salon in {A}', '{A}的包厢美发沙龙', '{A}的包廂美髮沙龍', '{A}의 프라이빗 룸 살롱'],
  '{A}で買える': ['Buy it in {A}', '在{A}买得到', '在{A}買得到', '{A}에서 살 수 있습니다'],
  '{A}で{B}を買うなら': ['Where to buy {B} in {A}', '在{A}购买 {B} 的话', '在{A}購買 {B} 的話', '{A}에서 {B}를 산다면'],
  '{B}を{A}で買う': ['Buy {B} in {A}', '在{A}购买 {B}', '在{A}購買 {B}', '{A}에서 {B} 구매'],
};

/* 頭の一句だけ訳す型
 *
 * 「ほかのエリアで探す <a data-i18n="bp.area.ginza">銀座</a> …」のように
 * 後ろの <a> が自前の data-i18n を持っているものは
 * 中身の訳は build 側が当ててくれる。頭の日本語だけ差し替えればよい。
 * 尻尾はバイト単位でそのまま残す（リンク先と鍵を壊さないため）。
 */
const PREFIX = {
  'ほかのエリアで探す ': ['Find it in another area ', '在其他地区寻找 ', '在其他地區尋找 ', '다른 지역에서 찾기 '],
  'ほかのエリアで探す　': ['Find it in another area ', '在其他地区寻找 ', '在其他地區尋找 ', '다른 지역에서 찾기 '],
  '関連ページ ': ['Related pages ', '相关页面 ', '相關頁面 ', '관련 페이지 '],
  'エリア別のご案内 ': ['By area ', '各地区的介绍 ', '各地區的介紹 ', '지역별 안내 '],
};

/* 尻尾の中のラベルも訳す
 *
 * 【実際にやらかした】頭の一句だけ訳して尻尾をそのまま残したら
 *   親の innerHTML 差し替えで子が毎回 日本語に戻され 中国語ページに
 *   「銀座で買うだけOK」が16枚残った。子を訳し直しても 次の周で親がまた上書きする。
 *   親の訳の中に日本語を残さないのが正解。
 *   各ページの辞書がすでに持っている bp.* の訳を集めて 尻尾の中身に当てる。
 */
const LABEL = (() => {
  const map = {};                       // 日本語 → [en, zh, tw, ko]
  // 地名は先に入れておく（宇都宮のように 単独の要素として出てこないと
  // 台帳にも辞書にも載らず 尻尾に日本語のまま残る。実測96枚）
  for (const [ja, row] of Object.entries(AREA)) map[ja] = row;
  const DICT = /window\.SEAM_PAGE_I18N\s*=\s*\{/;
  for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f))) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const m = DICT.exec(html);
    if (!m) continue;
    let i = html.indexOf('{', m.index), depth = 0, inStr = null, esc = false, end = -1;
    for (let j = i; j < html.length; j++) {
      const c = html[j];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (inStr) { if (c === inStr) inStr = null; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === '{') depth++; else if (c === '}') { depth--; if (!depth) { end = j + 1; break; } }
    }
    if (end < 0) continue;
    const box = { window: {} }; vm.createContext(box);
    try { vm.runInContext('window.SEAM_PAGE_I18N=' + html.slice(i, end), box, { timeout: 5000 }); } catch { continue; }
    const d = box.window.SEAM_PAGE_I18N; if (!d || !d.ja) continue;
    for (const [k, ja] of Object.entries(d.ja)) {
      if (k.startsWith('x.') || typeof ja !== 'string' || !/[ぁ-んァ-ヴ]/.test(ja)) continue;
      const row = LANGS.map(l => d[l] && d[l][k]);
      if (row.some(v => v === undefined)) continue;
      if (!map[ja]) map[ja] = row;
    }
  }
  // 原文台帳の訳も混ぜる。ページ辞書に bp.area.* が4言語そろっていない場合があり
  //   それだけだと「銀座」が96枚の尻尾に残った（実測）。
  const T0 = Object.fromEntries(LANGS.map(l => {
    const q = path.join(ROOT, 'i18n', l + '.json');
    return [l, fs.existsSync(q) ? JSON.parse(fs.readFileSync(q, 'utf8')) : {}];
  }));
  const src0 = path.join(ROOT, 'i18n', 'source.json');
  if (fs.existsSync(src0)) {
    for (const [k, ja] of Object.entries(JSON.parse(fs.readFileSync(src0, 'utf8')))) {
      if (typeof ja !== 'string' || !/[ぁ-んァ-ヴ一-龥]/.test(ja) || ja.includes('<')) continue;
      const row = LANGS.map(l => T0[l][k]);
      if (row.some(v => v === undefined)) continue;
      if (!map[ja]) map[ja] = row;
    }
  }
  return map;
})();
const LABEL_KEYS = Object.keys(LABEL).sort((a, b) => b.length - a.length);

function fillLabels(tail, li) {
  for (const ja of LABEL_KEYS) if (tail.includes('>' + ja + '<')) tail = tail.split('>' + ja + '<').join('>' + LABEL[ja][li] + '<');
  return tail;
}

/* 決まり文句の型（漢字だけの語まで拾うようにして出てきたぶん）
 *   ・値段行「250ml ・ 定価 ¥3,850 税込」
 *   ・住所や人名は日本語のまま（道案内に使うので訳さないのが正しい）
 *   ・地名そのもの
 */
const PRICE = /^(?:(.+?)\s*・\s*)?定価\s*(¥[\d,]+)\s*税込$/;
const PRICE_T = [
  (q, v) => (q ? q + ' · ' : '') + 'List price ' + v + ' incl. tax',
  (q, v) => (q ? q + ' ・ ' : '') + '定价 ' + v + ' 含税',
  (q, v) => (q ? q + ' ・ ' : '') + '定價 ' + v + ' 含稅',
  (q, v) => (q ? q + ' ・ ' : '') + '정가 ' + v + ' 세금 포함',
];
const JA_ONLY = /^(北海道|東京都|大阪府|愛知県|福岡県|栃木県|神奈川県)/;   // 住所は日本語のまま

/* ── 型あて ── */
const brandKeys = Object.keys(BRAND).sort((a, b) => b.length - a.length);
const areaKeys = Object.keys(AREA).sort((a, b) => b.length - a.length);
const storeKeys = [...STORE].sort((a, b) => b.length - a.length);

function abstract(s) {
  const found = { B: null, A: null, 店: null, IG: null };
  const ig = s.match(/https:\/\/www\.instagram\.com\/[^"]+/);
  if (ig) { found.IG = ig[0]; s = s.split(ig[0]).join('{IG}'); }
  for (const k of storeKeys) if (s.includes(k)) { found.店 = k; s = s.split(k).join('{店}'); break; }
  for (const k of brandKeys) if (s.includes(k)) { found.B = k; s = s.split(k).join('{B}'); break; }
  for (const k of areaKeys) if (s.includes(k)) { found.A = k; s = s.split(k).join('{A}'); break; }
  return { tpl: s, found };
}

const out = Object.fromEntries(LANGS.map(l => [l, {}]));
let n = 0;
for (const [key, ja] of Object.entries(source)) {
  // ① 頭の一句だけの型（尻尾はそのまま）
  const pre = Object.keys(PREFIX).find(p => ja.startsWith(p));
  if (pre && /^<a /.test(ja.slice(pre.length)) && ja.slice(pre.length).includes('data-i18n=')) {
    const tail = ja.slice(pre.length);
    LANGS.forEach((l, i) => { out[l][key] = PREFIX[pre][i] + fillLabels(tail, i); });
    n++;
    continue;
  }
  // ② 値段行
  let pm;
  if ((pm = PRICE.exec(ja))) {
    LANGS.forEach((l, i) => { out[l][key] = PRICE_T[i](pm[1] || '', pm[2]); });
    n++; continue;
  }
  // ③ 住所は日本語のまま（訳すと道案内に使えない）
  if (JA_ONLY.test(ja)) { LANGS.forEach(l => { out[l][key] = ja; }); n++; continue; }
  // ④ 地名そのもの
  if (AREA[ja]) { LANGS.forEach((l, i) => { out[l][key] = AREA[ja][i]; }); n++; continue; }

  const { tpl, found } = abstract(ja);
  const T = TPL[tpl];
  if (!T) continue;
  LANGS.forEach((l, i) => {
    let v = T[i];
    if (found.B) v = v.split('{B}').join(BRAND[found.B][i]);
    if (found.A) v = v.split('{A}').join(AREA[found.A][i]);
    if (found.店) v = v.split('{店}').join(found.店);
    if (found.IG) v = v.split('{IG}').join(found.IG);
    out[l][key] = v;
  });
  n++;
}

/* 型に印が残っていたら差し替え漏れ。黙って出さない */
const leak = [];
for (const l of LANGS) for (const [k, v] of Object.entries(out[l]))
  if (/\{(?:B|A|店|IG)\}/.test(v)) leak.push(l + ':' + k);
if (leak.length) { console.error('  ✘ 印が残った ' + leak.length + '件 ' + leak.slice(0, 3)); process.exit(1); }

console.error(`  型から作った ${n}本 × 4言語`);
console.log(JSON.stringify(out, null, 1));

/* SEAM: サロン/スパ語の惜しい順位を押し上げる（2026-09-18）
 *
 * 【なぜ】9/17 の実測（順位道具/順位表_2026-09-17）で スパは「自社しか書けない語」だけが付いていた。
 *   銀座 ヘッドスパ 個室 Google 7・Yahoo 7 ／ ジャパニーズヘッドスパ Google 2 ／ 銀座 ヘッドスパ 頭浸浴 Yahoo 23
 *   銀座 ヘッドスパ 予約 Yahoo 17 ／ ヘッドスパ 栄 Yahoo 14 ／ ヘッドスパ 堀江 Yahoo 15（いずれも惜しい）
 *   素の「ヘッドスパ 銀座」「美容室 銀座」は HPB・楽天・ozmall が上位で圏外 → そこは追わず 上の語を厚くする。
 *
 * 【やること】
 *   1. headspa-ginza / nagoya：FAQ「頭浸浴つきのコースはありますか」（見える FAQ と JSON-LD の両方）
 *   2. headspa-ginza / nagoya / osaka：予約 FAQ の答えに店名と「ヘッドスパ予約」を入れる（鍵 s51 は頁の辞書を直接・JSON-LD も）
 *   3. headspa：エリア別のアンカーを「銀座のヘッドスパ」「名古屋 栄のヘッドスパ」「大阪 堀江のヘッドスパ」に
 *   4. トップ（home-hybrid-finished.js）：スパのタイル「スパサロン」→「完全個室のヘッドスパ」（5言語）
 *   5. 訳を足して i18n_extract → i18n_add → i18n_merge を回す（x. の鍵は外して置き 振り直してもらう）
 *      ついでに 台帳に載ったまま訳の無かった5本（brand の取扱店アンカー4・recruit の「フォーム」）も埋める
 *
 * 【書き方の決まり】句点「。」は使わない・言えることだけ書く（料金は各頁の表の値）
 * 冪等（印 <!-- seo-spa:xxx --> か 置き換え後の文があれば何もしない）
 *   使い方: node scripts/seo_spa_terms.js .
 */
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const ROOT = process.argv[2] || '.';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s, 'utf8');
const keyOf = s => 'x.' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 8); // i18n_extract.js と同じ
const log = [];

function dictSpan(src) {
  const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src); if (!m) return null;
  const bs = src.indexOf('{', m.index); let d = 0, mode = null, esc = false;
  for (let i = bs; i < src.length; i++) { const c = src[i];
    if (esc) { esc = false; continue; } if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return [bs, i + 1]; } }
  return null;
}
function withDict(file, fn) {           // fn(dict) → 変えた数
  let src = rd(file); const span = dictSpan(src); if (!span) throw new Error(file + ': 辞書なし');
  const raw = src.slice(span[0], span[1]); const dict = JSON.parse(raw);
  if (JSON.stringify(dict) !== raw) throw new Error(file + ': 辞書が往復できない');
  const n = fn(dict); if (n) wr(file, src.slice(0, span[0]) + JSON.stringify(dict) + src.slice(span[1])); return n;
}
// JSON-LD の FAQPage を直す：無い問答は足す・ある問いの答えが違えば差し替える
function syncFaqLd(file, qas) {
  let src = rd(file); let done = 0;
  src = src.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (all, body) => {
    let j; try { j = JSON.parse(body); } catch { return all; }
    const arr = Array.isArray(j) ? j : (j['@graph'] || [j]);
    let hit = false;
    for (const n of arr) { if (n['@type'] !== 'FAQPage') continue; hit = true;
      for (const [q, a] of qas) {
        const cur = n.mainEntity.find(x => x.name === q);
        if (!cur) { n.mainEntity.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }); done++; }
        else if (cur.acceptedAnswer.text !== a) { cur.acceptedAnswer.text = a; done++; }
      } }
    return hit && done ? '<script type="application/ld+json">' + JSON.stringify(j) + '</script>' : all;
  });
  if (done) { wr(file, src); log.push('  ◎ ' + file + ': FAQPage(JSON-LD) ' + done + '問'); }
}
const add = { en: {}, zh: {}, tw: {}, ko: {} };
function trans(ja, t) { const k = keyOf(ja); for (const l of Object.keys(add)) add[l][k] = t[l]; return k; }

// ── 1. 頭浸浴の FAQ（銀座・名古屋。大阪は全コースが頭浸浴なので既にある FAQ で足りる） ──
const Q_TOU = '頭浸浴つきのコースはありますか';
trans(Q_TOU, { en: 'Is there a course with head bathing?', zh: '有含头浸浴的方案吗', tw: '有含頭浸浴的方案嗎', ko: '두침욕이 포함된 코스가 있나요' });
const TOU = {
  'headspa-ginza.html': ['90分以上のコースに頭浸浴が付きます 首肩までほどけるクリームヘッドスパ 90min ¥17,800 深く落ちるプレミアムヘッドスパ 120min ¥20,800 プレミアムスパ 150min ¥25,000 いずれも完全個室です', {
    en: 'Every course of 90 minutes or more includes head bathing: the cream head spa 90 min ¥17,800, the premium head spa 120 min ¥20,800 and the premium spa 150 min ¥25,000, all in a fully private room',
    zh: '90分钟以上的方案均含头浸浴 奶油头部水疗90分钟 ¥17,800 深度放松高阶头部水疗120分钟 ¥20,800 高阶水疗150分钟 ¥25,000 均为完全包厢',
    tw: '90分鐘以上的方案均含頭浸浴 奶油頭部水療90分鐘 ¥17,800 深度放鬆高階頭部水療120分鐘 ¥20,800 高階水療150分鐘 ¥25,000 均為完全包廂',
    ko: '90분 이상 코스에 두침욕이 포함됩니다 크림 헤드스파 90분 ¥17,800 프리미엄 헤드스파 120분 ¥20,800 프리미엄 스파 150분 ¥25,000 모두 완전 프라이빗 룸입니다' }],
  'headspa-nagoya.html': ['首肩までほどけるクリームヘッドスパ 90min ¥13,200 と 深く落ちるプレミアムヘッドスパ 120min ¥17,600 に頭浸浴が付きます いずれも完全個室です', {
    en: 'Head bathing is included in the cream head spa 90 min ¥13,200 and the premium head spa 120 min ¥17,600, both in a fully private room',
    zh: '奶油头部水疗90分钟 ¥13,200 与深度放松高阶头部水疗120分钟 ¥17,600 含头浸浴 均为完全包厢',
    tw: '奶油頭部水療90分鐘 ¥13,200 與深度放鬆高階頭部水療120分鐘 ¥17,600 含頭浸浴 均為完全包廂',
    ko: '크림 헤드스파 90분 ¥13,200 과 프리미엄 헤드스파 120분 ¥17,600 에 두침욕이 포함됩니다 모두 완전 프라이빗 룸입니다' }],
};
for (const [f, [a, t]] of Object.entries(TOU)) {
  trans(a, t);
  let s = rd(f);
  if (!s.includes('seo-spa:tou')) {
    const k = s.lastIndexOf('</details>'); const dict = s.indexOf('window.SEAM_PAGE_I18N');
    if (k < 0 || k > dict) { log.push('  ✘ ' + f + ': FAQ の差し込み位置が無い'); continue; }
    const blk = `<!-- seo-spa:tou --><details class="group border-b border-line py-4"><summary class="flex items-start justify-between gap-4 cursor-pointer list-none"><span class="font-serif text-[14.5px] text-ink">${Q_TOU}</span><span aria-hidden="" class="flex-none text-gold transition-transform group-open:rotate-45">＋</span></summary><p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;">${a}</p></details>`;
    wr(f, s.slice(0, k + 10) + blk + s.slice(k + 10)); log.push('  ◎ ' + f + ': FAQ 頭浸浴');
  }
  syncFaqLd(f, [[Q_TOU, a]]);
}

// ── 2. 予約 FAQ の答え（鍵 s51 は頁ごとの辞書 → 直接書く） ──
const OLD_BOOK = 'ホットペッパービューティーから24時間ご予約いただけます ページ内のボタンからそのまま進めます';
const BOOK = {
  'headspa-ginza.html': { ja: '銀座店のヘッドスパ予約はホットペッパービューティーから24時間できます ページ内のボタンからそのまま進めます',
    en: 'Head spa bookings for the Ginza store are open 24 hours a day on Hot Pepper Beauty. Use the button on this page to go straight there.',
    zh: '银座店的头部水疗可通过Hot Pepper Beauty 24小时预约 点击页面内的按钮即可前往', tw: '銀座店的頭部水療可透過Hot Pepper Beauty 24小時預約 點擊頁面內的按鈕即可前往',
    ko: '긴자점 헤드스파 예약은 Hot Pepper Beauty에서 24시간 가능합니다 페이지 내 버튼에서 바로 진행됩니다' },
  'headspa-nagoya.html': { ja: '名古屋 栄店のヘッドスパ予約はホットペッパービューティーから24時間できます ページ内のボタンからそのまま進めます',
    en: 'Head spa bookings for the Nagoya Sakae store are open 24 hours a day on Hot Pepper Beauty. Use the button on this page to go straight there.',
    zh: '名古屋 荣店的头部水疗可通过Hot Pepper Beauty 24小时预约 点击页面内的按钮即可前往', tw: '名古屋 榮店的頭部水療可透過Hot Pepper Beauty 24小時預約 點擊頁面內的按鈕即可前往',
    ko: '나고야 사카에점 헤드스파 예약은 Hot Pepper Beauty에서 24시간 가능합니다 페이지 내 버튼에서 바로 진행됩니다' },
  'headspa-osaka.html': { ja: '大阪 堀江店のヘッドスパ予約はホットペッパービューティーから24時間できます ページ内のボタンからそのまま進めます',
    en: 'Head spa bookings for the Osaka Horie store are open 24 hours a day on Hot Pepper Beauty. Use the button on this page to go straight there.',
    zh: '大阪 堀江店的头部水疗可通过Hot Pepper Beauty 24小时预约 点击页面内的按钮即可前往', tw: '大阪 堀江店的頭部水療可透過Hot Pepper Beauty 24小時預約 點擊頁面內的按鈕即可前往',
    ko: '오사카 호리에점 헤드스파 예약은 Hot Pepper Beauty에서 24시간 가능합니다 페이지 내 버튼에서 바로 진행됩니다' },
};
for (const [f, v] of Object.entries(BOOK)) {
  let s = rd(f); const from = `data-i18n="s51">${OLD_BOOK}<`;
  if (s.includes(from)) { wr(f, s.replace(from, `data-i18n="s51">${v.ja}<`)); log.push('  ◎ ' + f + ': 予約 FAQ の答え'); }
  else if (!s.includes(`data-i18n="s51">${v.ja}<`)) log.push('  ✘ ' + f + ': s51 の文が想定と違う');
  withDict(f, dict => { let c = 0; for (const l of Object.keys(v)) if (dict[l] && dict[l].s51 !== v[l]) { dict[l].s51 = v[l]; c++; } return c; });
  syncFaqLd(f, [['予約はどこからできますか', v.ja]]);
}

// ── 3. headspa のエリア別アンカー（x. 鍵は外す → extract が振り直す） ──
{
  const f = 'headspa.html'; let s = rd(f); let n = 0;
  const AREA = [
    ['x.f2f42b53', '銀座（有楽町・京橋）', '銀座のヘッドスパ（有楽町・京橋）', { en: 'Ginza head spa (Yurakucho and Kyobashi)', zh: '银座的头部水疗（有乐町・京桥）', tw: '銀座的頭部水療（有樂町・京橋）', ko: '긴자 헤드스파（유라쿠초·교바시）' }],
    ['x.a185efb6', '名古屋（栄・矢場町・大須）', '名古屋 栄のヘッドスパ（矢場町・大須）', { en: 'Nagoya Sakae head spa (Yabacho and Osu)', zh: '名古屋 荣的头部水疗（矢场町・大须）', tw: '名古屋 榮的頭部水療（矢場町・大須）', ko: '나고야 사카에 헤드스파（야바초·오스）' }],
    ['x.cf9d11f2', '大阪（堀江・心斎橋・四ツ橋）', '大阪 堀江のヘッドスパ（心斎橋・四ツ橋）', { en: 'Osaka Horie head spa (Shinsaibashi and Yotsubashi)', zh: '大阪 堀江的头部水疗（心斋桥・四桥）', tw: '大阪 堀江的頭部水療（心齋橋・四橋）', ko: '오사카 호리에 헤드스파（신사이바시·요쓰바시）' }],
  ];
  for (const [k, old, nu, t] of AREA) {
    trans(nu, t);
    const from = ` data-i18n="${k}">${old}</a>`;
    if (s.includes(from)) { s = s.replace(from, `>${nu}</a>`); n++; }
  }
  if (n) { wr(f, s); log.push('  ◎ ' + f + ': エリア別アンカー ' + n + '本'); }
}

// ── 4. トップのスパのタイル（辞書は sfText の中） ──
{
  const f = 'js/home-hybrid-finished.js'; let s = rd(f); let n = 0;
  const R = [['<b>スパサロン</b>', '<b>完全個室のヘッドスパ</b>'], ["spa:'Head spa',", "spa:'Private-room head spa',"], ["spa:'头皮SPA',", "spa:'完全包厢 头皮SPA',"], ["spa:'頭皮SPA',", "spa:'完全包廂 頭皮SPA',"], ["spa:'헤드 스파',", "spa:'완전 개인실 헤드 스파',"]];
  for (const [a, b] of R) if (s.includes(a)) { s = s.replace(a, b); n++; }
  if (n) { wr(f, s); log.push('  ◎ ' + f + ': スパのタイル ' + n + '箇所'); }
}

// ── 5. 台帳に載ったまま訳の無い5本 ──
for (const [ja, t] of [
  ['エルジューダ 取扱店', { en: 'Elujuda retailers', zh: 'Elujuda 经销店', tw: 'Elujuda 經銷店', ko: 'Elujuda 취급점' }],
  ['ダヴィネス 取扱店', { en: 'Davines retailers', zh: 'Davines 经销店', tw: 'Davines 經銷店', ko: 'Davines 취급점' }],
  ['オッジオット 取扱店', { en: 'oggi otto retailers', zh: 'oggi otto 经销店', tw: 'oggi otto 經銷店', ko: 'oggi otto 취급점' }],
  ['リケラ 取扱店', { en: 'REKERA retailers', zh: 'REKERA 经销店', tw: 'REKERA 經銷店', ko: 'REKERA 취급점' }],
  ['フォーム', { en: 'Form', zh: '表单', tw: '表單', ko: '양식' }],
]) trans(ja, t);

// ── 訳を流す：extract（鍵を振る）→ add（訳）→ merge（頁の辞書へ） ──
const tmp = path.join(os.tmpdir(), 'seo_spa_terms_' + Date.now() + '.json');
fs.writeFileSync(tmp, JSON.stringify(add));
const env = { ...process.env, NODE_PATH: path.resolve(ROOT, 'node_modules') };
for (const args of [['scripts/i18n_extract.js', ROOT], ['scripts/i18n_add.js', ROOT, tmp], ['scripts/i18n_merge.js', ROOT]])
  log.push('  ' + args[0] + ': ' + execFileSync('node', args.map(a => a.startsWith('scripts/') ? path.join(ROOT, a) : a), { env, encoding: 'utf8' }).trim().split('\n').pop());
fs.unlinkSync(tmp);

// 検算：足した鍵が5言語そろって頁の辞書に入ったか
const src = JSON.parse(rd('i18n/source.json'));
const miss = Object.keys(add.en).filter(k => !(k in src));
console.log(log.join('\n'));
console.log(miss.length ? `  ✘ 台帳に無い鍵 ${miss.length}本: ${miss.join(' ')}` : `  ◎ 訳 ${Object.keys(add.en).length}本 すべて台帳に載っている`);
if (miss.length) process.exit(1);

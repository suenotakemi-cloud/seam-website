/* SEAM: title/h1 に入れ切れなかった狙い語を 本文の見出し・段落・FAQ に入れる（2026-09-10）
 *
 * 【なぜ】scripts/seo_keyword_coverage.js で「本文だけ」「どこにも無い」と出た語。
 *   title を伸ばすと切れて読めなくなるので 見出しと段落で受ける。
 *   書いていない語は拾われない（headspa.html は title に「水素×炭酸」「ジャパニーズ」と書きながら本文に一度も無かった）。
 *
 * 【やること】
 *   headspa.html   : 導入の h2/p に 眼精疲労・肩こり・眠り・水素×炭酸・ジャパニーズヘッドスパ・専門
 *                    FAQ に「眼精疲労や肩こり」「睡眠」の2問
 *   shop.html      : h2「メーカー公認の正規販売店」に「197ブランドのヘアケア セレクトショップ」
 *   finder.html    : h2「わかること」→「髪質診断でわかること くせ毛の傾向とシャンプーの選び方」
 *                    （finder は自前辞書 js/finder-i18n.js。原文一致の鍵なので 4言語ぶん足し ?v を上げる）
 *   英語版の title : headspa / headspa-ginza / salon-ginza / shop に japanese head spa・hair salon ginza english・
 *                    japanese hair care tokyo を入れる（辞書 en.meta.title）
 *
 * 【辞書の扱い】
 *   ・x.<hash> の共有鍵を持つ要素の文を変えるときは data-i18n を外す
 *     → scripts/i18n_extract.js が新しい鍵を振り 台帳に載せる → 訳を i18n_add.js で足す → i18n_merge.js
 *   ・ページ固有の鍵（authorized.title など）と meta.* は ここで5言語まとめて書く
 *
 * 冪等（2回目は何もしない）。
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '.';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s, 'utf8');
let log = [];

// 辞書（JSON 往復できるページだけ。できなければ止める）
function dictSpan(src) {
  const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src); if (!m) return null;
  const bs = src.indexOf('{', m.index); let d = 0, mode = null, esc = false;
  for (let i = bs; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return [bs, i + 1]; }
  }
  return null;
}
function setDict(file, patch) {
  let src = rd(file); const span = dictSpan(src); if (!span) throw new Error(file + ': 辞書なし');
  const raw = src.slice(span[0], span[1]); const dict = JSON.parse(raw);
  if (JSON.stringify(dict) !== raw) throw new Error(file + ': 辞書が往復できない');
  let n = 0;
  for (const [lang, kv] of Object.entries(patch)) {
    if (!dict[lang]) throw new Error(file + ': ' + lang + ' 無し');
    for (const [k, v] of Object.entries(kv)) if (dict[lang][k] !== v) { dict[lang][k] = v; n++; }
  }
  if (n) { wr(file, src.slice(0, span[0]) + JSON.stringify(dict) + src.slice(span[1])); }
  return n;
}
// 文字列の置換（無ければ何もしない・2回目は何もしない）
function rep(file, from, to, label) {
  let src = rd(file);
  if (src.includes(to)) return false;
  if (!src.includes(from)) { log.push('  ✘ ' + file + ': ' + label + ' の元の文が無い'); return false; }
  wr(file, src.replace(from, to)); log.push('  ◎ ' + file + ': ' + label); return true;
}

// ── headspa.html ──
rep('headspa.html',
  '<h2 data-i18n="x.48278cdd">朝から夜まで<br>画面の前で力を抜けない</h2>',
  '<h2>眼精疲労 肩こり 睡眠の浅さ<br>朝から夜まで 画面の前で力を抜けない</h2>',
  '導入 h2 に 眼精疲労・肩こり・眠り');
rep('headspa.html',
  '<p data-i18n="x.ec100cf3">仕事のパソコン 移動中のスマホ 画面に集中するほど顔は前へ 首は支え続け 肩には無意識に力が入ります 何時間も続いた緊張は 休んだだけでは抜けきらないことも SEAMは その力が入った場所を見つけ ひとつずつ手でほぐします</p>',
  '<p>仕事のパソコン 移動中のスマホ 画面に集中するほど顔は前へ 首は支え続け 肩には無意識に力が入ります 何時間も続いた緊張は 休んだだけでは抜けきらないことも SEAMは その力が入った場所を見つけ ひとつずつ手でほぐします 水素と炭酸を含む機能水と ヘッドスパ専門のスパニストの手による 完全個室のジャパニーズヘッドスパです</p>',
  '導入 p に 水素×炭酸・専門・ジャパニーズヘッドスパ');
rep('headspa.html',
  '      <nav class="sn-area-links" aria-label="地域別ヘッドスパ案内">',
  '      <details><summary>眼精疲労や肩こりにも向いていますか <span>＋</span></summary><p>はい 目のまわり 首 肩に力が入りやすい方ほど 変化を感じやすい部位です 画面を見る時間が長い方の眼精疲労や肩こりの重さに ヘッドスパは選ばれています</p></details>\n' +
  '      <details><summary>睡眠の質は変わりますか <span>＋</span></summary><p>その日の夜は眠りが深かったという声を多くいただきます 施術中に眠られる方も多く 睡眠が浅い時期のリセットとしてもご利用ください</p></details>\n' +
  '      <nav class="sn-area-links" aria-label="地域別ヘッドスパ案内">',
  'FAQ に 眼精疲労・肩こり／睡眠 の2問');

// ── shop.html（ページ固有の鍵 authorized.title は5言語ここで）──
rep('shop.html',
  'data-i18n="authorized.title">メーカー公認の正規販売店</h2>',
  'data-i18n="authorized.title">メーカー公認の正規販売店｜197ブランドのヘアケア セレクトショップ</h2>',
  'h2 に ヘアケア セレクトショップ');
log.push('  辞書 shop.html authorized.title ' + setDict('shop.html', {
  ja: { 'authorized.title': 'メーカー公認の正規販売店｜197ブランドのヘアケア セレクトショップ' },
  en: { 'authorized.title': 'An authorized official retailer | A hair care select shop of 197 brands' },
  zh: { 'authorized.title': '厂商公认的正规销售店｜197个品牌的护发精选店' },
  tw: { 'authorized.title': '原廠公認的正規販售店｜197個品牌的護髮精選店' },
  ko: { 'authorized.title': '제조사 공인 정규 판매점｜197개 브랜드의 헤어케어 셀렉트숍' },
}) + '本');

// ── 英語版の title（海外からの検索語を入れる。「Simple English OK」は据え置き＝言えることだけ言う）──
log.push('  辞書 en.meta.title ' + (
  setDict('headspa.html',       { en: { 'meta.title': 'Japanese Head Spa in Tokyo (Ginza), Nagoya and Osaka | Private Room, Simple English OK | SEAM' } }) +
  setDict('headspa-ginza.html', { en: { 'meta.title': 'Japanese Head Spa in Ginza, Tokyo | Private Room, Simple English OK | SEAM GINZA' } }) +
  setDict('salon-ginza.html',   { en: { 'meta.title': 'Hair Salon in Ginza, Tokyo (Simple English OK) | Straightening, Hair-Improving Treatment and Colour in a Private Room | SEAM GINZA' } }) +
  setDict('shop.html',          { en: { 'meta.title': 'Japanese Salon-Exclusive Hair Care Shops in Tokyo and 5 More Cities | Tax-Free at All 7 Stores | SEAM' } })
) + '本');

// ── finder.html（自前辞書）──
const FH2_OLD = '<h2 style="font-size:19px;font-weight:500;margin:0 0 14px;">わかること</h2>';
const FH2_NEW = '<h2 style="font-size:19px;font-weight:500;margin:0 0 14px;">髪質診断でわかること くせ毛の傾向とシャンプーの選び方</h2>';
if (rep('finder.html', FH2_OLD, FH2_NEW, 'h2 に 髪質診断・くせ毛・シャンプー')) {
  // 辞書は原文一致。4言語の "わかること" の行の直後に新しい行を足す
  let js = rd('js/finder-i18n.js');
  const TR = { en: 'What the hair type diagnosis tells you: your curl tendency and how to choose a shampoo',
               zh: '发质诊断能知道什么 自然卷倾向与洗发水的选法',
               tw: '髮質診斷能知道什麼 自然捲傾向與洗髮精的選法',
               ko: '모발 진단으로 알 수 있는 것 곱슬 경향과 샴푸 고르는 법' };
  const KEY = '髪質診断でわかること くせ毛の傾向とシャンプーの選び方';
  let added = 0;
  for (const [lang, v] of Object.entries(TR)) {
    // その言語ブロックの "わかること" 行を探す（"en": { の後 最初の一致）
    const bi = js.indexOf('"' + lang + '": {'); if (bi < 0) throw new Error('finder-i18n: ' + lang + ' ブロック無し');
    const li = js.indexOf('"わかること":', bi); if (li < 0) throw new Error('finder-i18n: ' + lang + ' に わかること 無し');
    const eol = js.indexOf('\n', li);
    if (js.slice(bi, eol).includes(JSON.stringify(KEY))) continue;
    js = js.slice(0, eol + 1) + JSON.stringify(KEY) + ': ' + JSON.stringify(v) + ',\n' + js.slice(eol + 1);
    added++;
  }
  wr('js/finder-i18n.js', js);
  log.push('  finder-i18n.js に ' + added + '言語ぶん足した');
  // 辞書が変わったので取り直させる
  rep('finder.html', "s.src='js/finder-i18n.js?v=29';", "s.src='js/finder-i18n.js?v=30';", 'finder-i18n の ?v を 30 に');
}

console.log(log.join('\n'));

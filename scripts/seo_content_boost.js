/* SEAM: 順位が付かない語のページを厚くする（2026-09-13）
 *
 * 【なぜ】9/13 の実測で「髪質診断」「サロン専売品」の一般語は Google/Yahoo で圏外〜16位。
 *   上位（beautyfarm・salonia・ma-kko・medulla 等）は 3,000〜8,000字の解説ページ。
 *   こちらの guide は 1,600〜1,800字・finder の静的本文は 1,400字で 中身の量で負けている。
 *   店舗ページは検索結果の title が「SEAM GINZA - 銀座のヘアケア専門店」に書き換えられていた
 *   （36.5字の title が長すぎて 検索エンジンが h1 と組み直した）→ 32字以内に切る。
 *
 * 【やること】
 *   1. guide-kamishitsu-shindan：27タイプの見方・自分で確かめる手順・髪格診断との違い・FAQ 4問
 *   2. guide-salon-senyo：入手ルートの比較表・通販の見分け方・選び方3手順・FAQ 4問
 *   3. finder：27タイプの表と「くせ毛診断・シャンプー診断としても」（finder は自前辞書 → finder-i18n.js に足す）
 *   4. headspa-ginza/nagoya/osaka：「眼精疲労 肩こり 眠りの浅さに」の節と FAQ 2問
 *   5. ブランド16枚の h2「{B}を取り扱う SEAMの店舗」→「{B}はどこで買える？ SEAMの取扱店」（5言語）
 *   6. 地域ブランド128枚のアンカー：「無料で髪格診断する」→「無料の髪質診断（髪格診断）をする」
 *      「全国の店舗一覧」→「サロン専売品の販売店 全国7店舗」（5言語・鍵は bp.* なので辞書を直接）
 *   7. FAQPage の JSON-LD に足した問答を入れる（見えている FAQ と JSON-LD を一致させる）
 *
 * 【書き方の決まり】句点「。」は使わない・読点は空白・言えることだけ書く（会員価格の率など根拠の無い数字は書かない）
 * 【辞書】x. の共有鍵は付けずに置く → scripts/i18n_extract.js が鍵を振る → 訳を i18n_add → i18n_merge
 * 冪等（印 <!-- seo-boost:xxx --> があれば何もしない）
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '.';
const rd = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const wr = (f, s) => fs.writeFileSync(path.join(ROOT, f), s, 'utf8');
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
function insertBefore(file, marker, anchor, block, label) {
  let src = rd(file); if (src.includes(marker)) return false;
  const i = src.indexOf(anchor); if (i < 0) { log.push('  ✘ ' + file + ': ' + label + ' の差し込み位置が無い'); return false; }
  wr(file, src.slice(0, i) + marker + '\n' + block + '\n' + src.slice(i)); log.push('  ◎ ' + file + ': ' + label); return true;
}
// JSON-LD の FAQPage に問答を足す（見えている FAQ と一致させる）
function addFaqLd(file, qas) {
  let src = rd(file); let done = 0;
  src = src.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (all, body) => {
    let j; try { j = JSON.parse(body); } catch { return all; }
    const arr = Array.isArray(j) ? j : (j['@graph'] || [j]);
    let hit = false;
    for (const n of arr) { if (n['@type'] !== 'FAQPage') continue;
      for (const [q, a] of qas) { if (n.mainEntity.some(x => x.name === q)) continue;
        n.mainEntity.push({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }); done++; }
      hit = true; }
    return hit && done ? '<script type="application/ld+json">' + JSON.stringify(j) + '</script>' : all;
  });
  if (done) { wr(file, src); log.push('  ◎ ' + file + ': FAQPage(JSON-LD) に ' + done + '問'); }
}

const H2 = 'class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink"';
const H3 = 'class="mt-7 font-serif text-[16px] text-ink"';
const P1 = 'class="mt-4 text-[14px] text-charcoal/80"', P = 'class="mt-3 text-[14px] text-charcoal/80"';
const TBL = 'class="mt-4 w-full text-[13.5px] text-charcoal/80 border-collapse"';
const TH = 'class="text-left font-medium text-ink border-b border-line py-2 pr-3"', TD = 'class="border-b border-line/60 py-2 pr-3 align-top"';

// ── 1. guide-kamishitsu-shindan ──
{
  const f = 'guide-kamishitsu-shindan.html';
  const block1 = `<!-- seo-boost:types -->
<h2 ${H2}>髪質の種類 太さ×量×くせの27タイプ</h2>
<p ${P1}>太さ（細い 普通 太い） 量（少ない 普通 多い） くせ（直毛 ゆるいくせ 強いくせ） この3つの掛け合わせで 髪質は27の型に分けられます SEAMではこれを「髪格」と呼び 診断の土台にしています</p>
<table ${TBL}><thead><tr><th ${TH} style="white-space:nowrap">見方</th><th ${TH}>3つの段階</th><th ${TH}>選び方が変わるところ</th></tr></thead><tbody>
<tr><td ${TD} style="white-space:nowrap">太さ</td><td ${TD}>細い ・ 普通 ・ 太い</td><td ${TD}>細いほど軽い質感のものへ 太いほど水分を入れる手助けを</td></tr>
<tr><td ${TD} style="white-space:nowrap">量</td><td ${TD}>少ない ・ 普通 ・ 多い</td><td ${TD}>多いほど洗いとすすぎを丁寧に 少ないほど重さを出さない</td></tr>
<tr><td ${TD} style="white-space:nowrap">くせ</td><td ${TD}>直毛 ・ ゆるいくせ ・ 強いくせ</td><td ${TD}>くせが強いほど乾かし方が先 抑えるものはあと</td></tr>
</tbody></table>
<p ${P}>ダメージやカラー・矯正の履歴は「いまの状態」なので 型とは別に見ます 混ぜてしまうと ダメージが強い人はみな同じ答えになるためです</p>

<h2 ${H2}>自分で髪質チェックする手順（5分）</h2>
<ol class="mt-4 list-decimal pl-5 text-[14px] text-charcoal/80 space-y-2" style="list-style:decimal;padding-left:1.4em;">
<li>乾いた髪の日に 抜けた髪を一本とっておく（太さ）</li>
<li>後ろでひとつに束ねて 根元の太さを見る（量）</li>
<li>洗ったあと 濡れた状態と乾いた状態を鏡で見比べる（くせ）</li>
<li>濡れた毛先を指で挟んで すべらせる（ダメージ）</li>
<li>朝と夕方の根元を見比べる（頭皮）</li>
</ol>
<p ${P}>結果はメモに残しておくと 店頭での相談が早くなります 3か月から半年ごとに見直すと 変化に気づけます</p>
`;
  insertBefore(f, '<!-- seo-boost:types -->', `<h2 ${H2} data-i18n="x.bb9d9d0d">髪質は変わる</h2>`, block1, '27タイプの表と手順');

  const block2 = `<!-- seo-boost:diff -->
<h2 ${H2}>髪質診断と髪格診断の違い</h2>
<p ${P1}>一般に「髪質診断」と呼ばれるものは ダメージの度合いや悩みを聞く形が多いものです SEAMの髪格診断は 変わらないもの（太さ 量 くせ）と いまの状態（ダメージ 履歴）を分けて見ます 分けるから 悩みが同じでも 別の答えが出ます</p>
<p ${P}>質問は10問ほどで 3分で終わります 会員登録は要りません 結果はカルテとして 全国7店舗の店頭でそのまま使えます</p>
`;
  insertBefore(f, '<!-- seo-boost:diff -->', `<div class="mt-10 rounded-[3px] border border-line bg-cream/40 px-5 py-6">`, block2, '髪格診断との違い');

  const faq = [
    ['くせ毛の診断もできますか', 'はい くせは3つの軸のひとつです 濡れたときと乾いたときの違いから ゆるいくせと強いくせを分けて見ます 乾かし方の提案までお出しします'],
    ['メンズでも髪質診断はできますか', 'はい 髪の太さ 量 くせは性別で分けていません 頭皮のべたつきや短い髪のスタイリングの持ちも 同じ見方で整理できます'],
    ['髪質診断のアプリは必要ですか', 'いいえ ブラウザで開くだけです インストールも会員登録も要りません スマートフォンでもパソコンでもできます'],
    ['診断の結果はどう使えばいいですか', '結果はカルテとして保存でき 全国7店舗のSEAMでそのまま相談に使えます 店頭では197のサロン専売ブランドから 結果に合う一本をお選びします'],
  ];
  const block3 = `<!-- seo-boost:faq -->\n` + faq.map(([q, a]) => `<h3 ${H3}>${q}</h3><p ${P}>${a}</p>`).join('\n') + '\n';
  insertBefore(f, '<!-- seo-boost:faq -->', `\n<h2 ${H2} data-i18n="x.5eb1ec52">あわせて読む</h2>`, block3, 'FAQ 4問');
  addFaqLd(f, faq);
  // あわせて読む に診断への入口
  let s = rd(f); if (!s.includes('seo-boost:link')) { s = s.replace(`<li><a href="guide-uneri.html"`, `<li><!-- seo-boost:link --><a href="finder.html" class="underline decoration-line underline-offset-4 hover:text-ink">無料の髪質診断（髪格診断）を受ける</a></li>\n  <li><a href="guide-uneri.html"`); wr(f, s); log.push('  ◎ ' + f + ': あわせて読む に診断の入口'); }
}

// ── 2. guide-salon-senyo ──
{
  const f = 'guide-salon-senyo.html';
  const anchor = rd(f).match(/\n\s*<h2 [^>]*data-i18n="x\.e163e1aa">主なサロン専売ブランド<\/h2>/);
  if (!anchor) log.push('  ✘ guide-salon-senyo: 主なサロン専売ブランド の h2 が無い');
  const block1 = `<!-- seo-boost:routes -->
    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">入手ルートの比較 どこで買うと安心か</h2>
    <table ${TBL}><thead><tr><th ${TH} style="white-space:nowrap">ルート</th><th ${TH}>相談</th><th ${TH}>品質の保証</th><th ${TH}>向いている人</th></tr></thead><tbody>
    <tr><td ${TD} style="white-space:nowrap">美容室</td><td ${TD}>担当者に相談できる</td><td ${TD}>正規</td><td ${TD}>施術と合わせて選びたい</td></tr>
    <tr><td ${TD} style="white-space:nowrap">正規取扱のセレクトショップ（SEAM）</td><td ${TD}>複数ブランドを見比べられる</td><td ${TD}>正規</td><td ${TD}>予約なしで見比べて選びたい 購入だけの来店も歓迎</td></tr>
    <tr><td ${TD} style="white-space:nowrap">メーカーや正規代理店の公式通販</td><td ${TD}>相談はしにくい</td><td ${TD}>正規</td><td ${TD}>使うものが決まっている</td></tr>
    <tr><td ${TD} style="white-space:nowrap">正規取扱店の会員制オンラインショップ</td><td ${TD}>店頭で決めたものを買い足せる</td><td ${TD}>正規</td><td ${TD}>続けて使いたい（SEAMは来店後にご案内）</td></tr>
    <tr><td ${TD} style="white-space:nowrap">フリマ・非正規の出品</td><td ${TD}>なし</td><td ${TD}>保証なし 保管状態や真贋が分からない</td><td ${TD}>おすすめしません</td></tr>
    </tbody></table>

    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">サロン専売品の通販 正規ルートで買う方法</h2>
    <p ${P1}>通販で買うときの目安は「正規取扱店かどうか」の一点です メーカーが正規と認めた店は 商品の保管や鮮度に責任を持っています 価格が極端に安い出品は 中身や保管状態が保証されません</p>
    <p ${P}>SEAMの会員制オンラインショップは 店頭で一度ご案内した方だけの通販です 髪を見て選んだものを 次からは迷わずご自宅へお届けします 初めての方は全国7店舗の店頭でご案内しています</p>

    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">サロン専売シャンプーの選び方 3つの手順</h2>
    <ol class="mt-4 list-decimal pl-5 text-[14px] text-charcoal/80 space-y-2" style="list-style:decimal;padding-left:1.4em;">
    <li>太さ・量・くせで「変わらない土台」を知る（無料の髪質診断なら3分）</li>
    <li>カラー・縮毛矯正・ブリーチの履歴で「いまの状態」を足す</li>
    <li>仕上がりの好み（軽い しっとり まとまる）で最後に選ぶ</li>
    </ol>
    <p ${P}>この順で選ぶと「有名だから」で外すことが減ります 迷ったら店頭で髪を見せてください 197ブランドから 今の髪に合う一本を選びます</p>
`;
  if (anchor) insertBefore(f, '<!-- seo-boost:routes -->', anchor[0], block1, '入手ルート比較・通販・選び方');

  const faq = [
    ['サロン専売品は安く買えますか', '正規取扱店では会員価格や季節のご案内があることが多く SEAMでも店頭でご案内しています 極端に安い非正規の出品は 中身や保管状態が保証されないので おすすめしません'],
    ['ドラッグストアやスーパーでサロン専売品は買えますか', '基本的に扱いはありません 美容室や正規取扱店を通じて届けることを前提に作られているためです'],
    ['サロン専売シャンプーは市販より髪に良いですか', '「良い悪い」ではなく「合うか」です 髪質や履歴に合わせて選ぶ設計なので 合えば変化は大きく 合わなければ市販品のほうがよいこともあります'],
    ['美容室専売品とサロン専売品は同じものですか', '同じ意味で使われています 美容室（サロン）向けに流通するヘアケアの呼び方の違いです'],
  ];
  const s = rd(f);
  const m = /(<dl[^>]*>)([\s\S]*?)(\n\s*<\/dl>)/.exec(s);
  if (m && !s.includes('seo-boost:faq')) {
    const dtClass = (/<dt class="([^"]*)"/.exec(m[2]) || [, ''])[1], ddClass = (/<dd class="([^"]*)"/.exec(m[2]) || [, ''])[1], divClass = (/<div class="([^"]*)">\s*<dt/.exec(m[2]) || [, ''])[1];
    const add = '\n      <!-- seo-boost:faq -->' + faq.map(([q, a]) => `\n      <div class="${divClass}">\n        <dt class="${dtClass}">${q}</dt>\n        <dd class="${ddClass}">${a}</dd>\n      </div>`).join('');
    wr(f, s.slice(0, m.index + m[1].length + m[2].length) + add + s.slice(m.index + m[1].length + m[2].length)); log.push('  ◎ ' + f + ': FAQ 4問');
  } else if (!m) log.push('  ✘ ' + f + ': FAQ の dl が無い');
  addFaqLd(f, faq);
}

// ── 3. finder（自前辞書）──
{
  const f = 'finder.html';
  const block = `<!-- seo-boost:types -->
    <h2 style="font-size:19px;font-weight:500;margin:0 0 14px;">髪格 27タイプの見方</h2>
    <p style="margin:0 0 12px;font-size:14.5px;">太さ（細い 普通 太い） 量（少ない 普通 多い） くせ（直毛 ゆるいくせ 強いくせ） この3つの掛け合わせが27の髪格です</p>
    <table style="width:100%;border-collapse:collapse;font-size:13.5px;margin:0 0 12px;">
      <tr><td style="padding:6px 8px 6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;white-space:nowrap;">太さ</td><td style="padding:6px 8px 6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;">細い ・ 普通 ・ 太い</td><td style="padding:6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;">細いほど軽い質感へ 太いほど水分を入れる手助けを</td></tr>
      <tr><td style="padding:6px 8px 6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;white-space:nowrap;">量</td><td style="padding:6px 8px 6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;">少ない ・ 普通 ・ 多い</td><td style="padding:6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;">多いほど洗いとすすぎを丁寧に 少ないほど重さを出さない</td></tr>
      <tr><td style="padding:6px 8px 6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;white-space:nowrap;">くせ</td><td style="padding:6px 8px 6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;">直毛 ・ ゆるいくせ ・ 強いくせ</td><td style="padding:6px 0;border-bottom:1px solid #E8E2D9;vertical-align:top;">くせが強いほど乾かし方が先 抑えるものはあと</td></tr>
    </table>
    <p style="margin:0 0 28px;font-size:14.5px;">くせ毛診断やシャンプー診断として使う方も多くいらっしゃいます くせの出方 太さ 量から 今使うシャンプーの方向を先に決めます</p>
`;
  insertBefore(f, '<!-- seo-boost:types -->', `    <h2 style="font-size:19px;font-weight:500;margin:0 0 14px;">かかるもの</h2>`, block, '27タイプの表');
}

// ── 4. headspa-ginza / nagoya / osaka ──
for (const f of ['headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html']) {
  const block = `<!-- seo-boost:tension --><section class="mt-11"><h2 class="font-serif text-[19px] text-ink">眼精疲労 肩こり 眠りの浅さに</h2><p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;">画面を見る時間が長い方の眼精疲労 首から肩の重さ 眠りが浅い時期 ヘッドスパは そのもとになる緊張をほどきます 目のまわり 首 肩に力が入りやすい方ほど 変化を感じやすい部位です</p><p class="mt-2 text-[13.5px] text-charcoal/80" style="line-height:2;">水素と炭酸を含む機能水と ヘッドスパ専門のスパニストの手で 完全個室でお受けいただくジャパニーズヘッドスパです</p></section>`;
  const s = rd(f); const i = s.indexOf('<!-- seam:eye-block:end -->');
  if (i < 0) { log.push('  ✘ ' + f + ': eye-block が無い'); continue; }
  if (!s.includes('seo-boost:tension')) { const j = i + '<!-- seam:eye-block:end -->'.length; wr(f, s.slice(0, j) + '\n' + block + s.slice(j)); log.push('  ◎ ' + f + ': 眼精疲労・肩こり・眠り の節'); }
  const faq = [
    ['眼精疲労や肩こりにも向いていますか', 'はい 目のまわり 首 肩に力が入りやすい方ほど 変化を感じやすい部位です 画面を見る時間が長い方の眼精疲労や肩こりの重さに ヘッドスパは選ばれています'],
    ['睡眠の質は変わりますか', 'その日の夜は眠りが深かったという声を多くいただきます 施術中に眠られる方も多く 睡眠が浅い時期のリセットとしてもご利用ください'],
  ];
  let s2 = rd(f);
  if (!s2.includes('seo-boost:faq')) {
    const k = s2.lastIndexOf('</details>');
    const add = faq.map(([q, a]) => `<details class="group border-b border-line py-4"><summary class="flex items-start justify-between gap-4 cursor-pointer list-none"><span class="font-serif text-[14.5px] text-ink">${q}</span><span aria-hidden="" class="flex-none text-gold transition-transform group-open:rotate-45">＋</span></summary><p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;">${a}</p></details>`).join('');
    wr(f, s2.slice(0, k + 10) + '<!-- seo-boost:faq -->' + add + s2.slice(k + 10)); log.push('  ◎ ' + f + ': FAQ 2問');
  }
  addFaqLd(f, faq);
}

// ── 5. ブランド16枚の h2 ──
{
  const files = fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !/-(ginza|omotesando|osaka|nagoya|fukuoka|sapporo|utsunomiya|tokyo|aichi|hokkaido|kanto|kansai|kyushu|tochigi)\.html$/.test(f) && rd(f).includes('bp.hubStores'));
  let n = 0;
  for (const f of files) {
    let src = rd(f);
    const changed = withDict(f, dict => {
      const ja = dict.ja && dict.ja['bp.hubStores']; if (!ja) return 0;
      const m = /^(.+?)を取り扱う SEAMの店舗$/.exec(ja); if (!m) return 0;
      const B = m[1];
      const en = (/^SEAM stores that carry (.+)$/.exec(dict.en['bp.hubStores'] || '') || [, B])[1];
      const zh = (/^销售(.+?)的SEAM门店$/.exec(dict.zh['bp.hubStores'] || '') || [, en])[1];
      const tw = (/^銷售(.+?)的SEAM門市$/.exec(dict.tw['bp.hubStores'] || '') || [, en])[1];
      const ko = (/^(.+?)를 취급하는 SEAM 매장$/.exec(dict.ko['bp.hubStores'] || '') || /^(.+?)을 취급하는 SEAM 매장$/.exec(dict.ko['bp.hubStores'] || '') || [, en])[1];
      const v = { ja: `${B}はどこで買える？ SEAMの取扱店`, en: `Where to buy ${en}: SEAM's authorized stores`, zh: `${zh}在哪里买？SEAM的正规销售门店`, tw: `${tw}在哪裡買？SEAM的正規銷售門市`, ko: `${ko} 어디서 살 수 있나요? SEAM 정규 취급점` };
      let c = 0; for (const l of Object.keys(v)) if (dict[l] && dict[l]['bp.hubStores'] !== v[l]) { dict[l]['bp.hubStores'] = v[l]; c++; }
      src = src.replace(`data-i18n="bp.hubStores">${ja}<`, `data-i18n="bp.hubStores">${v.ja}<`);
      return c;
    });
    if (changed) { const cur = rd(f); const span = dictSpan(cur); // 辞書は withDict が書いた。HTML 側の h2 文も書く
      const html = cur.replace(/data-i18n="bp\.hubStores">(.+?)を取り扱う SEAMの店舗</, (all, B) => `data-i18n="bp.hubStores">${B}はどこで買える？ SEAMの取扱店<`); if (html !== cur) wr(f, html); n++; }
  }
  log.push('  ◎ ブランドの h2「どこで買える？」 ' + n + '枚');
}

// ── 6. 地域ブランド128枚のアンカー（bp.finderCta / bp.ui.allStores）──
{
  const V = {
    'bp.finderCta':   { ja: '無料の髪質診断（髪格診断）をする', en: 'Take the free hair diagnosis (Hair Finder)', zh: '免费发质诊断（Hair Finder）', tw: '免費髮質診斷（Hair Finder）', ko: '무료 모발 진단(Hair Finder) 받기' },
    'bp.ui.allStores': { ja: 'サロン専売品の販売店 全国7店舗', en: 'Salon-exclusive retailers: 7 stores nationwide', zh: '沙龙专售品销售店 全国7家', tw: '沙龍專售品銷售店 全國7家', ko: '살롱 전용 제품 판매점 전국 7곳' },
  };
  let n = 0;
  for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f))) {
    const s = rd(f); if (!/bp\.finderCta|bp\.ui\.allStores/.test(s)) continue;
    const c = withDict(f, dict => { let k = 0; for (const [key, v] of Object.entries(V)) for (const l of Object.keys(v)) if (dict[l] && dict[l][key] !== undefined && dict[l][key] !== v[l]) { dict[l][key] = v[l]; k++; } return k; });
    let s2 = rd(f);
    const s3 = s2.replace(/(data-i18n="bp\.finderCta"[^>]*>)無料で髪格診断する</g, `$1${V['bp.finderCta'].ja}<`).replace(/(data-i18n="bp\.ui\.allStores"[^>]*>)全国の店舗一覧</g, `$1${V['bp.ui.allStores'].ja}<`);
    if (s3 !== s2) wr(f, s3);
    if (c || s3 !== s2) n++;
  }
  log.push('  ◎ 地域ブランドのアンカー（診断・販売店） ' + n + '枚');
}

console.log(log.join('\n'));

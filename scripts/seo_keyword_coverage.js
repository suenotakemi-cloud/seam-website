/* SEAM: 狙う語が ページのどこに入っているかを測る（2026-09-10）
 *
 * 【なぜ】順位が付かない語の多くは 「その語がページの title/h1/本文に無い」だけだった。
 *   例: 「髪質診断」は月間で最も引かれる語なのに /finder の title は「髪格診断」だけ。
 *   Google は書いていない語では拾わない。まず書いてあるかを数える。
 *
 * 【見るところ】title / meta description / h1 / h2〜h3 / 本文（script・style は除く）
 *   「本文にある」だけでは弱く、title か h1 に入って初めて狙ったことになる。
 *
 * 【語の決め方】実際に検索される言い回し（販売店・取扱店・どこで買える・通販・とは・無料・個室）。
 *   自作語（髪格診断）は既に1位なので狙いから外し、一般語を足す側に置く。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const SHOW = process.argv.includes('--all');

// 語 → 持ち主ページ（複数可・先頭が本命）
const TARGETS = [
  // ── 診断（月間で最も引かれる。自作語「髪格診断」は1位なので一般語を足す）
  ['髪質診断',            ['finder.html', 'guide-kamishitsu-shindan.html', 'index.html']],
  ['髪質診断 無料',        ['finder.html', 'guide-kamishitsu-shindan.html']],
  ['髪質 チェック',        ['finder.html', 'guide-kamishitsu-shindan.html']],
  ['髪質 タイプ',          ['finder.html', 'guide-kamishitsu-shindan.html']],
  ['くせ毛 診断',          ['finder.html', 'guide-uneri.html']],
  ['シャンプー 診断',       ['finder.html']],
  ['髪質 シャンプー 選び方', ['finder.html', 'guide-salon-senyo.html']],
  // ── 専売品（カテゴリの本丸）
  ['サロン専売品',          ['shop.html', 'guide-salon-senyo.html', 'index.html']],
  ['美容室専売品',          ['shop.html', 'guide-salon-senyo.html', 'index.html']],
  ['サロン専売 シャンプー',   ['shop.html', 'guide-salon-senyo.html']],
  ['美容室専売 シャンプー',   ['shop.html', 'guide-salon-senyo.html']],
  ['サロン専売品 販売店',     ['shop.html', 'store-ginza.html']],
  ['美容室専売品 販売店',     ['shop.html', 'store-ginza.html']],
  ['サロン専売品 どこで買える', ['guide-salon-senyo.html', 'shop.html']],
  ['美容室専売品 どこで買える', ['guide-salon-senyo.html', 'shop.html']],
  ['サロン専売品 通販',       ['onlineshop.html', 'guide-salon-senyo.html']],
  ['美容室専売品 通販',       ['onlineshop.html', 'guide-salon-senyo.html']],
  ['サロン専売品 とは',       ['guide-salon-senyo.html']],
  ['美容室専売品 とは',       ['guide-salon-senyo.html']],
  ['サロン専売品 市販 違い',   ['guide-salon-senyo.html']],
  // ── ブランド × 取扱（メーカー公式に次ぐ「買える場所」の受け皿）
  ['オージュア 取扱店',       ['aujua.html']],
  ['オージュア 販売店',       ['aujua.html']],
  ['オージュア どこで買える',   ['aujua.html']],
  ['オージュア 通販',        ['aujua.html', 'onlineshop.html']],
  ['ケラスターゼ 取扱店',     ['kerastase.html']],
  ['ケラスターゼ 販売店',     ['kerastase.html']],
  ['ケラスターゼ どこで買える', ['kerastase.html']],
  ['ミルボン 取扱店',        ['milbon.html']],
  ['ミルボン 販売店',        ['milbon.html']],
  ['エルジューダ 取扱店',     ['elujuda.html']],
  ['エルジューダ 販売店',     ['elujuda.html']],
  ['ダヴィネス 取扱店',       ['davines.html']],
  ['オッジオット 取扱店',     ['oggi-otto.html']],
  ['オッジィオット 販売店',    ['oggi-otto.html']],
  ['サブリミック 取扱店',     ['sublimic.html']],
  ['TOKIO インカラミ 取扱店', ['tokio.html']],
  ['トキオ インカラミ 販売店', ['tokio.html']],
  ['バイカルテ 取扱店',       ['bykarte.html']],
  ['つるりんちょ 販売店',     ['tsururincho.html']],
  ['つるりんちょ 取扱店',     ['tsururincho.html']],
  ['シュウウエムラ ヘアケア 取扱店', ['shu-uemura.html']],
  ['システムプロフェッショナル 取扱店', ['system-professional.html']],
  ['資生堂プロフェッショナル 取扱店', ['shiseido-professional.html']],
  ['ラッシュアディクト 取扱店', ['lashaddict.html']],
  // ── ヘッドスパ × 地名（Google 6〜8位・DDG 2〜3位。押せば上がる帯）
  ['ヘッドスパ 銀座',        ['headspa-ginza.html', 'headspa.html']],
  ['銀座 ヘッドスパ 個室',    ['headspa-ginza.html']],
  ['銀座 ヘッドスパ 専門店',   ['headspa-ginza.html']],
  ['銀座 ヘッドスパ 頭浸浴',    ['headspa-ginza.html']],   // ドライヘッドスパはメニューに無いので狙わない（9/10）
  ['ヘッドスパ 名古屋',       ['headspa-nagoya.html']],
  ['名古屋 ヘッドスパ 個室',   ['headspa-nagoya.html']],
  ['名古屋 ヘッドスパ 専門店',  ['headspa-nagoya.html']],
  ['ヘッドスパ 栄',          ['headspa-nagoya.html']],
  ['ヘッドスパ 大阪',        ['headspa-osaka.html']],
  ['大阪 ヘッドスパ 個室',    ['headspa-osaka.html']],
  ['ヘッドスパ 堀江',        ['headspa-osaka.html']],
  ['ヘッドスパ 心斎橋',       ['headspa-osaka.html']],
  ['ヘッドスパ 専門店',       ['headspa.html']],
  ['ヘッドスパ 個室',        ['headspa.html']],
  ['睡眠 ヘッドスパ',        ['headspa.html']],
  ['水素 ヘッドスパ',        ['headspa.html']],
  ['炭酸 ヘッドスパ',        ['headspa.html']],
  ['ジャパニーズヘッドスパ',    ['headspa.html', 'headspa-ginza.html']],
  ['ヘッドスパ 眼精疲労',     ['headspa.html']],
  ['ヘッドスパ 肩こり',       ['headspa.html']],
  // ── 美容室 × 地名（ホットペッパー優位だが 個室・髪質改善は狙える）
  ['銀座 美容室 個室',       ['salon-ginza.html', 'hairsalon.html']],
  ['銀座 完全個室 美容室',    ['salon-ginza.html']],
  ['銀座 髪質改善',          ['salon-ginza.html']],
  ['銀座 縮毛矯正',          ['salon-ginza.html']],
  ['大阪 美容室 個室',       ['salon-osaka.html']],
  ['堀江 美容室',           ['salon-osaka.html']],
  ['大阪 髪質改善',          ['salon-osaka.html']],
  ['札幌 美容室 個室',       ['salon-sapporo.html']],
  ['札幌 髪質改善',          ['salon-sapporo.html']],
  ['福岡 美容室 個室',       ['salon-fukuoka.html']],
  ['天神 美容室',           ['salon-fukuoka.html']],
  ['福岡 髪質改善',          ['salon-fukuoka.html']],
  ['個室 美容室',           ['hairsalon.html']],
  ['髪質改善 美容室',        ['hairsalon.html']],
  // ── 店舗（買える場所として）
  ['銀座 ヘアケア 専門店',    ['store-ginza.html']],
  ['銀座 シャンプー 専門店',   ['store-ginza.html']],
  ['表参道 ヘアケア 専門店',   ['store-omotesando.html']],
  ['大阪 ヘアケア 専門店',    ['store-osaka.html']],
  ['名古屋 ヘアケア 専門店',   ['store-nagoya.html']],
  ['福岡 ヘアケア 専門店',    ['store-fukuoka.html']],
  ['札幌 ヘアケア 専門店',    ['store-sapporo.html']],
  ['宇都宮 ヘアケア 専門店',   ['store-utsunomiya.html']],
  ['ヘアケア セレクトショップ', ['shop.html', 'index.html']],
  // ── インバウンド（英語版の title/h1 で見る）
  ['head spa tokyo',        ['en/headspa.html', 'en/headspa-ginza.html']],
  ['head spa ginza',        ['en/headspa-ginza.html']],
  ['japanese head spa',     ['en/headspa.html', 'en/headspa-ginza.html']],
  ['head spa osaka',        ['en/headspa-osaka.html']],
  ['head spa nagoya',       ['en/headspa-nagoya.html']],
  ['hair salon ginza english', ['en/salon-ginza.html', 'en/hairsalon.html']],
  ['japanese hair care tokyo', ['en/shop.html', 'en/index.html']],
  ['salon exclusive hair care japan', ['en/shop.html', 'en/index.html']],
];

const norm = s => (s || '').toLowerCase().replace(/[\s　・･]/g, '').replace(/ー/g, 'ー');
// 語の各パーツが全部入っていれば「ある」
const has = (hay, kw) => { const h = norm(hay); return kw.split(/\s+/).every(p => h.includes(norm(p))); };

const cache = {};
function load(f) {
  if (cache[f]) return cache[f];
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) return (cache[f] = null);
  const d = new JSDOM(fs.readFileSync(p, 'utf8')).window.document;
  const title = (d.querySelector('title') || {}).textContent || '';
  const desc = (d.querySelector('meta[name="description"]') || {}).content || '';
  const h1 = [...d.querySelectorAll('h1')].map(e => e.textContent).join(' ');
  const h23 = [...d.querySelectorAll('h2,h3')].map(e => e.textContent).join(' ');
  d.querySelectorAll('script,style,noscript').forEach(e => e.remove());
  const body = d.body ? d.body.textContent : '';
  return (cache[f] = { title, desc, h1, h23, body });
}

let miss = [], weak = [], ok = 0;
for (const [kw, pages] of TARGETS) {
  let best = null;
  for (const f of pages) {
    const pg = load(f); if (!pg) continue;
    const s = { f, title: has(pg.title, kw), desc: has(pg.desc, kw), h1: has(pg.h1, kw), h23: has(pg.h23, kw), body: has(pg.body, kw) };
    s.score = (s.title ? 4 : 0) + (s.h1 ? 3 : 0) + (s.desc ? 1 : 0) + (s.h23 ? 1 : 0) + (s.body ? 1 : 0);
    if (!best || s.score > best.score) best = s;
  }
  if (!best) { miss.push([kw, pages[0], '（ページ無し）']); continue; }
  const where = ['title', 'h1', 'desc', 'h23', 'body'].filter(k => best[k]).join('/') || '無';
  if (best.title || best.h1) ok++;
  else if (best.body || best.h23 || best.desc) weak.push([kw, best.f, where]);
  else miss.push([kw, pages[0], where]);
}
console.log(`  狙う語 ${TARGETS.length}本 → title/h1 に入っている ${ok}本 ・ 本文だけ ${weak.length}本 ・ どこにも無い ${miss.length}本`);
console.log('\n  ── どこにも無い（書いていないので拾われない）──');
miss.forEach(([k, f]) => console.log('    ' + k.padEnd(26) + '→ ' + f));
console.log('\n  ── 本文にはあるが title/h1 に無い（弱い）──');
weak.forEach(([k, f, w]) => console.log('    ' + k.padEnd(26) + '→ ' + f.padEnd(28) + w));

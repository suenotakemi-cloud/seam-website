/* SEAM: 日本語コピーの「AIっぽさ」を機械で数える（2026-09-14）
 * 台帳 i18n/source.json（客先ページの日本語 2,200本＝見えている文そのもの）を対象に
 * Wikipedia「Signs of AI writing」の型を日本語に置き換えて数える。
 *   強い型（1つで直す）：否定→肯定の持ち上げ（〜ではなく〜／〜だけでなく）・段取り前置き（このページでは／ご紹介します）
 *                        ・締めの格言（〜こそ／〜が近道／〜に尽きる）・宣伝語（極上・至福・贅沢・厳選・こだわり・ワンランク上）
 *   弱い型（複数で直す）：三つ組（A・B・C）・〜することができます・〜に寄り添う・安心/丁寧/しっかり・ダッシュ（— –）
 * 使い方: node scripts/copy_ai_tells.js <root> [--pages]  （--pages でページ別の集計）
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '.';
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'source.json'), 'utf8'));
const strip = h => h.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
const STRONG = [
  ['否定→肯定', /ではなく|だけでなく|だけではなく|のみならず|ではありません[^。]{0,40}です|というより/],
  ['前置き', /このページでは|ここでは|本記事|ご紹介します|解説します|見ていきましょう|お伝えします|まとめました|整理します/],
  ['締めの格言', /こそが|こそ[がは]|が近道|に尽きます|がすべてです|の役目です|がいちばんの|が大切です|が何より/],
  ['宣伝語', /極上|至福|贅沢|厳選|こだわり|ワンランク上|上質な|特別な時間|最高の|唯一無二|圧倒的|理想の|本格的|豊富な|幅広い|充実の|多彩な|魅力/],
  ['ダッシュ', /[—–]/],
];
const WEAK = [
  ['三つ組', /^[^・]{1,12}・[^・]{1,12}・[^・]{1,12}$|[^・]{2,10}・[^・]{2,10}・[^・]{2,10}(?![^・]*・)/],
  ['〜することができます', /することができます|することが可能です|が可能です/],
  ['寄り添う', /寄り添|サポートします|お手伝い/],
  ['安心・丁寧', /安心|丁寧に|しっかり/],
  ['ぜひ', /ぜひ|お気軽に/],
];
const rows = [];
for (const [k, html] of Object.entries(src)) {
  const t = strip(html); if (!t) continue;
  const hits = [];
  for (const [n, re] of STRONG) if (re.test(t)) hits.push(n);
  const weak = []; for (const [n, re] of WEAK) if (re.test(t)) weak.push(n);
  const score = hits.length * 2 + weak.length;
  if (score) rows.push({ k, t, hits, weak, score });
}
rows.sort((a, b) => b.score - a.score || b.t.length - a.t.length);
const total = Object.keys(src).length;
console.log(`台帳 ${total}本 → 型が当たる ${rows.length}本（強い型あり ${rows.filter(r => r.hits.length).length}本）`);
const cnt = {}; for (const r of rows) for (const h of [...r.hits, ...r.weak]) cnt[h] = (cnt[h] || 0) + 1;
console.log('型ごと: ' + Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ' ' + v).join(' / '));
if (process.argv.includes('--pages')) {
  const { JSDOM } = require('jsdom');
  const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|finder|skinfinder|recruit)/;
  const strong = new Set(rows.filter(r => r.hits.length).map(r => r.k));
  const use = {};
  for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
    const d = new JSDOM(fs.readFileSync(path.join(ROOT, f), 'utf8')).window.document;
    d.querySelectorAll('[data-i18n]').forEach(e => { const k = e.getAttribute('data-i18n'); if (strong.has(k)) (use[k] = use[k] || new Set()).add(f); });
  }
  console.log('\n── 強い型（使われている枚数の多い順）──');
  rows.filter(r => r.hits.length).map(r => ({ ...r, pages: use[r.k] ? use[r.k].size : 0 })).sort((a, b) => b.pages - a.pages)
    .forEach(r => console.log(`  ${String(r.pages).padStart(3)}枚 ${r.k} [${r.hits.join(',')}] ${r.t.slice(0, 90)}`));
} else {
  rows.slice(0, 60).forEach(r => console.log(`  ${r.k} [${[...r.hits, ...r.weak].join(',')}] ${r.t.slice(0, 100)}`));
}

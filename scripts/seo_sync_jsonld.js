/* SEAM: JSON-LD の name/headline/description を <title>/meta description にそろえる（2026-09-13）
 * 【なぜ】title を書き直したあと JSON-LD の WebPage.name / Article.headline が旧 title のままだった（36枚中31枚）。
 *   検索エンジンは両方を読むので 食い違いは弱い信号になる。
 * 【やること】WebPage / Article / CollectionPage / AboutPage / ContactPage の name・headline を title に
 *   description があれば meta description に。Article に日付が無ければ datePublished（git の初回日）と dateModified（今日）を足す。
 *   Store / HairSalon / DaySpa / Organization の name は店名・社名なので触らない。
 * 冪等。
 */
const fs = require('fs'), path = require('path'); const { execSync } = require('child_process');
const ROOT = process.argv[2] || '.';
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|skinfinder)/;
const TYPES = new Set(['WebPage', 'Article', 'CollectionPage', 'AboutPage', 'ContactPage', 'BlogPosting', 'NewsArticle']);
const unesc = s => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const TODAY = new Date().toISOString().slice(0, 10);
let pages = 0, changed = 0, fields = 0;
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const p = path.join(ROOT, f); let src = fs.readFileSync(p, 'utf8');
  const title = unesc((/<title>([^<]*)<\/title>/.exec(src) || [, ''])[1].trim());
  const desc = unesc((/<meta name="description" content="([^"]*)"/.exec(src) || [, ''])[1].trim());
  if (!title) continue; pages++;
  let n = 0;
  src = src.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (all, body) => {
    let j; try { j = JSON.parse(body); } catch { return all; }
    const arr = Array.isArray(j) ? j : (j['@graph'] || [j]); let hit = 0;
    for (const node of arr) {
      const t = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      if (!t.some(x => TYPES.has(x))) continue;
      if ('name' in node && node.name !== title) { node.name = title; hit++; }
      if ('headline' in node && node.headline !== title) { node.headline = title; hit++; }
      if ('description' in node && desc && node.description !== desc) { node.description = desc; hit++; }
      if (t.includes('Article')) {
        if (!node.datePublished) { try { const d = execSync(`git log --diff-filter=A --format=%aI -- "${f}"`, { cwd: ROOT }).toString().trim().split('\n').pop().slice(0, 10); if (d) { node.datePublished = d; hit++; } } catch {} }
        if (!node.dateModified || node.dateModified < TODAY) { const modified = execSync(`git status --porcelain -- "${f}"`, { cwd: ROOT }).toString().trim(); if (modified) { node.dateModified = TODAY; hit++; } }
      }
    }
    if (!hit) return all; n += hit;
    return '<script type="application/ld+json">' + JSON.stringify(j) + '</script>';
  });
  if (n) { fs.writeFileSync(p, src, 'utf8'); changed++; fields += n; }
}
console.log(`  ${pages}枚を見て ${changed}枚 / ${fields}項目を title・description にそろえた`);

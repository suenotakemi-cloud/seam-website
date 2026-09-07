/* SEAM: まだ訳していない原文を 使い回しの多い順に出す（2026-09-07）
 * 使い方: node scripts/i18n_todo.js <root> [出す本数] [--count]
 *   --count を付けると 残り本数だけ数える
 */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const N = parseInt(process.argv[3] || '60', 10);
const COUNT = process.argv.includes('--count');
const LANGS = ['en', 'zh', 'tw', 'ko'];
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-no1|ginza-salonboard|hpb-|seo-|strategy|write|404|finder|skinfinder)/;
const rd = f => { const p = path.join(ROOT, 'i18n', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}; };

const source = rd('source.json');
const T = Object.fromEntries(LANGS.map(l => [l, rd(l + '.json')]));

// 鍵がいくつのページで使われているか
const use = {};
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const d = new JSDOM(fs.readFileSync(path.join(ROOT, f), 'utf8')).window.document;
  d.querySelectorAll('[data-i18n]').forEach(e => {
    const k = e.getAttribute('data-i18n');
    if (k.startsWith('x.')) use[k] = (use[k] || 0) + 1;
  });
}

const todo = Object.keys(source)
  .filter(k => LANGS.some(l => T[l][k] === undefined))
  .sort((a, b) => (use[b] || 0) - (use[a] || 0) || source[a].length - source[b].length);

if (COUNT) {
  const chars = todo.reduce((a, k) => a + source[k].length, 0);
  console.log(`  残り ${todo.length}本 / ${chars.toLocaleString()}字（全 ${Object.keys(source).length}本）`);
  const done = Object.keys(source).length - todo.length;
  console.log(`  済み ${done}本 (${(done / Object.keys(source).length * 100).toFixed(1)}%)`);
} else {
  const out = {};
  for (const k of todo.slice(0, N)) out[k] = source[k];
  console.log(JSON.stringify(out, null, 1));
}

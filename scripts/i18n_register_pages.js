/* SEAM: 言語版がまだ作られていない客先ページを 生成の対象に足す（2026-09-07）
 *
 * 【なぜ】辞書と data-i18n は入れたのに build-i18n.js の PAGES に無いページは
 *   en/zh/tw/ko が生成されず 日本語しか出ない。
 *   読みもの・求人・法務・ガイドが丸ごとそこに落ちていた。
 *
 * 【足さないもの】
 *   ・社内ページ（admin・strategy・hpb-系・ginza-menu・treatment など）
 *   ・404（エラーページ）
 *   ・finder / skinfinder（自前の多言語を持っている）
 *
 * 冪等（すでに並んでいるものは足さない）。
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const BUILD = path.join(ROOT, '.github/scripts/build-i18n.js');

const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|finder|skinfinder)/;

let src = fs.readFileSync(BUILD, 'utf8');
const already = new Set([...src.matchAll(/file:\s*'([^']+\.html)'/g)].map(m => m[1]));

// 辞書を持っているページだけ足す（持っていないと build が SKIP する）
const add = fs.readdirSync(ROOT)
  .filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f) && !already.has(f))
  .filter(f => fs.readFileSync(path.join(ROOT, f), 'utf8').includes('SEAM_PAGE_I18N'))
  .sort();

if (!add.length) { console.log('  足すページなし'); process.exit(0); }

const lines = add.map(f => `  { file: '${f}', url: '/${f.replace(/\.html$/, '')}' },`).join('\n');
const marker = /\n\];\n/;                       // PAGES の閉じ
const i = src.search(marker);
if (i < 0) { console.error('  ✘ PAGES の終わりが見つからない'); process.exit(1); }

src = src.slice(0, i) + '\n\n  // 2026-09-07 追加: 読みもの・求人・法務・ガイドも多言語化する\n'
      + lines + src.slice(i);
fs.writeFileSync(BUILD, src);
console.log(`  ${add.length}枚を生成対象に足した`);
add.forEach(f => console.log('    ' + f));

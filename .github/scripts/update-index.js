/**
 * update-index.js
 * ranking.json の内容で index.html の window.SEAM_RANKING ブロックを書き換える
 */
const fs = require('fs');

const ranking = JSON.parse(fs.readFileSync('.github/scripts/ranking.json', 'utf8'));
let html = fs.readFileSync('index.html', 'utf8');

// window.SEAM_RANKING = { ... }; のブロックを置換
const newBlock = `window.SEAM_RANKING = ${JSON.stringify(ranking, null, 4)};`;

// ★ 毎月のランキング — ここだけ編集 〜 }; の範囲を置換
const re = /(window\.SEAM_RANKING\s*=\s*\{[\s\S]*?\};)/;
if (!re.test(html)) {
  console.error('❌ index.html に window.SEAM_RANKING が見つかりません');
  process.exit(1);
}

html = html.replace(re, newBlock);
fs.writeFileSync('index.html', html);
console.log(`✅ index.html 更新完了 (${ranking.month})`);

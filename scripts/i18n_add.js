/* SEAM: 訳をひとまとまり足す（2026-09-07）
 * 使い方: node scripts/i18n_add.js <root> <訳のJSONファイル>
 *   ファイルの形: { "en": {鍵:訳}, "zh": {...}, "tw": {...}, "ko": {...} }
 * 既にある訳は上書きする（直しを入れられるように）。
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2], IN = process.argv[3];
const LANGS = ['en', 'zh', 'tw', 'ko'];
const add = JSON.parse(fs.readFileSync(IN, 'utf8'));
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'i18n', 'source.json'), 'utf8'));

let n = 0, unknown = [];
for (const l of LANGS) {
  const p = path.join(ROOT, 'i18n', l + '.json');
  const cur = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  for (const [k, v] of Object.entries(add[l] || {})) {
    if (!(k in source)) { unknown.push(l + ':' + k); continue; }
    if (cur[k] !== v) { cur[k] = v; n++; }
  }
  fs.writeFileSync(p, JSON.stringify(cur, null, 1), 'utf8');
}
// 4言語そろっていない鍵は言い落とし。数えて出す
const have = Object.fromEntries(LANGS.map(l => {
  const p = path.join(ROOT, 'i18n', l + '.json');
  return [l, fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}];
}));
const partial = Object.keys(source).filter(k =>
  LANGS.some(l => have[l][k] !== undefined) && LANGS.some(l => have[l][k] === undefined));
console.log(`  足した ${n}件` + (unknown.length ? ` ・台帳に無い鍵 ${unknown.length}本 ${unknown.slice(0, 3)}` : ''));
if (partial.length) console.log(`  ✘ 4言語そろっていない鍵 ${partial.length}本: ${partial.slice(0, 5).join(' ')}`);

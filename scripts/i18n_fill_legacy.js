/* SEAM: 既存の鍵（bp.* など）に訳が無いところを 同じ日本語の訳で埋める（2026-09-07）
 *
 * 【なぜ】data-i18n="bp.buyin.ginza" のように前から鍵はあるのに
 *   そのページの辞書に zh/en/tw/ko の値が無い、という穴が残っていた。
 *   同じ日本語は別の鍵（x.<hash>）で既に訳してあるので それを回す。
 *
 * 【当て方】要素の innerHTML（空白を詰めたもの）を原文台帳の逆引きに使う。
 *   台帳に無い日本語は触らない（勝手な訳を作らない）。
 *
 * 冪等。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), vm = require('vm');

const ROOT = process.argv[2];
const LANGS = ['en', 'zh', 'tw', 'ko'];
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|finder|skinfinder)/;
const rd = f => { const p = path.join(ROOT, 'i18n', f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}; };

const source = rd('source.json');
const T = Object.fromEntries(LANGS.map(l => [l, rd(l + '.json')]));
// 日本語 → 鍵 の逆引き
const byJa = {};
for (const [k, v] of Object.entries(source)) byJa[v] = k;

const DICT_ASSIGN = /window\.SEAM_PAGE_I18N\s*=\s*\{/;
function readDict(html) {
  const m = DICT_ASSIGN.exec(html);
  if (!m) return null;
  let i = html.indexOf('{', m.index), depth = 0, inStr = null, esc = false, end = -1;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (inStr) { if (c === inStr) inStr = null; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (!depth) { end = j + 1; break; } }
  }
  if (end < 0) return null;
  const box = { window: {} }; vm.createContext(box);
  try { vm.runInContext('window.SEAM_PAGE_I18N=' + html.slice(i, end), box, { timeout: 5000 }); } catch { return null; }
  return { dict: box.window.SEAM_PAGE_I18N, start: i, end };
}

let nPage = 0, nAdd = 0;
const noSource = new Set();
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const p = path.join(ROOT, f);
  let html = fs.readFileSync(p, 'utf8');
  const got = readDict(html);
  if (!got) continue;
  const dict = got.dict;
  for (const l of ['ja', ...LANGS]) dict[l] = dict[l] || {};

  const d = new JSDOM(html).window.document;
  let added = 0;
  for (const e of d.querySelectorAll('[data-i18n]')) {
    const k = e.getAttribute('data-i18n');
    if (k.startsWith('x.')) continue;                 // 自分で打った鍵は差し込み側でやっている
    if (LANGS.every(l => dict[l][k] !== undefined)) continue;
    const ja = e.innerHTML.replace(/\s+/g, ' ').trim();
    const src = byJa[ja];
    if (!src) { if (/[ぁ-んァ-ヴ]/.test(ja)) noSource.add(ja.slice(0, 40)); continue; }
    if (dict.ja[k] === undefined) { dict.ja[k] = ja; added++; }
    for (const l of LANGS) {
      const v = T[l][src];
      if (v !== undefined && dict[l][k] !== v) { dict[l][k] = v; added++; }
    }
  }
  if (!added) continue;
  html = html.slice(0, got.start) + JSON.stringify(dict, null, 0) + html.slice(got.end);
  fs.writeFileSync(p, html);
  nPage++; nAdd += added;
}
console.log(`  埋めた ${nPage}枚 / ${nAdd}件` + (noSource.size ? ` ・台帳に無い日本語 ${noSource.size}本` : ''));
if (noSource.size) [...noSource].slice(0, 6).forEach(s => console.log('    ' + s));

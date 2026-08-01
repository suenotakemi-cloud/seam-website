// 既存の多言語ページ(index/shop/brand/hairsalon/headspa/onlineshop)で
// data-i18n が付いていなかったブロックを埋める。
//
// 既存の辞書リテラルは手書きなので触らない。あとから「マージするスクリプト」を
// </body> 直前に足す方式にする(build-i18n の extractI18N は SEAM_PAGE_I18N を含む
// 全スクリプトを同じ sandbox で順に流してマージする設計＝この足し方を想定している)。
// キーは g1,g2… 既存キー(hero.title 等 / t1 等)と衝突しない名前空間。
const fs = require('fs');
const path = require('path');
const SP = process.env.SP;
const { JSDOM } = require(path.join(SP, 'node_modules/jsdom'));
const ROOT = process.argv[2];
const DRY = process.argv.includes('--dry');

const DICT = JSON.parse(fs.readFileSync(path.join(SP, 'dict_all.json'), 'utf8'));
const LANGS = ['ja', 'en', 'zh', 'tw', 'ko'];
const INLINE = new Set(['BR','SPAN','A','STRONG','EM','B','I','SMALL','SUP','SUB','U','MARK','CODE','WBR','TIME','ABBR','S','DEL','INS','BDI','RUBY','RT','RP']);
const SKIP = new Set(['SCRIPT','STYLE','NOSCRIPT','TEMPLATE']);
const HTMLNS = 'http://www.w3.org/1999/xhtml';
const isForeign = n => n.namespaceURI && n.namespaceURI !== HTMLNS;
const TAG = n => (n.tagName || '').toUpperCase();
const hasJa = s => /[ぁ-んァ-ヶ]/.test(s || '');
const hasAnyJa = s => /[ぁ-んァ-ヶ一-龠]/.test(s || '');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function hasBlockJaDescendant(el) {
  for (const c of el.children) {
    if (SKIP.has(TAG(c)) || isForeign(c)) continue;
    if (!INLINE.has(TAG(c)) && hasAnyJa(c.textContent)) return true;
    if (hasBlockJaDescendant(c)) return true;
  }
  return false;
}
function renderFor(el, lang) {
  let out = '', missing = 0;
  const walk = node => {
    for (const n of node.childNodes) {
      if (n.nodeType === 3) {
        const raw = n.nodeValue;
        if (!hasAnyJa(raw)) { out += esc(raw); continue; }
        const key = raw.replace(/\s+/g, ' ').trim();
        const tr = DICT[key];
        if (!tr) { missing++; out += esc(raw); continue; }
        out += (raw.match(/^\s*/)[0] ? ' ' : '') + esc(lang === 'ja' ? key : tr[lang]) + (raw.match(/\s*$/)[0] ? ' ' : '');
      } else if (n.nodeType === 8) {
        out += `<!--${n.nodeValue}-->`;      // メンテ用の注記コメントを落とさない
      } else if (n.nodeType === 1) {
        if (SKIP.has(TAG(n)) || isForeign(n)) { out += n.outerHTML; continue; }
        const tag = n.tagName.toLowerCase();
        const attrs = [...n.attributes].map(a =>
          ` ${a.name}="${a.value.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`).join('');
        if (!n.innerHTML && n.children.length === 0) { out += `<${tag}${attrs}>`; continue; }
        out += `<${tag}${attrs}>`; walk(n); out += `</${tag}>`;
      }
    }
  };
  walk(el);
  return { html: out, missing };
}

const FILES = ['index.html', 'shop.html', 'brand.html', 'hairsalon.html', 'headspa.html', 'onlineshop.html'];
const pending = [], ngs = [], report = [];
let totMiss = 0;

for (const f of FILES) {
  const p = path.join(ROOT, f);
  const src = fs.readFileSync(p, 'utf8');
  if (src.includes('SEAM_I18N_GAPFILL')) { report.push(`SKIP ${f} (適用済み)`); continue; }

  const doc = new JSDOM(src).window.document;
  const dict = {}; LANGS.forEach(L => dict[L] = {});
  let i = 0, miss = 0;

  const walk = (el, tagged) => {
    for (const c of el.children) {
      if (SKIP.has(TAG(c)) || isForeign(c)) continue;
      const t = tagged || c.hasAttribute('data-i18n');
      const hasTaggedInside = !!c.querySelector('[data-i18n]');
      if (!t && !hasTaggedInside && hasJa(c.textContent) && !hasBlockJaDescendant(c)) {
        const orig = c.innerHTML.replace(/\s+/g, ' ').trim();
        if (!orig) continue;
        const key = 'g' + (++i);
        c.setAttribute('data-i18n', key);
        for (const L of LANGS) {
          const r = renderFor(c, L);
          dict[L][key] = r.html.replace(/\s+/g, ' ').trim();
          if (L === 'en') miss += r.missing;
        }
        if (dict.ja[key] !== orig) ngs.push({ f, key, orig, back: dict.ja[key] });
        continue;
      }
      walk(c, t);
    }
  };
  walk(doc.body, false);

  if (!i) { report.push(`--   ${f} (埋める箇所なし)`); continue; }

  let out = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  const merge = '<script>/* SEAM_I18N_GAPFILL: あとから追加されたブロックの訳を既存辞書へマージする */\n'
    + '(function(){var G=' + JSON.stringify(dict) + ';var D=window.SEAM_PAGE_I18N||{};'
    + 'for(var k in G){D[k]=Object.assign(D[k]||{},G[k]);}window.SEAM_PAGE_I18N=D;})();\n</script>\n';
  out = out.replace('</body>', merge + '</body>');
  pending.push({ p, out });
  totMiss += miss;
  report.push(`OK   ${f}  追加${i}件  未訳${miss}`);
}

console.log(report.join('\n'));
console.log('\n未訳:', totMiss, '/ ja往復の不一致:', ngs.length);
if (ngs.length) {
  ngs.slice(0, 4).forEach(x => {
    let i = 0; while (x.orig[i] === x.back[i] && i < x.orig.length) i++;
    console.log(`\n-- ${x.f} ${x.key} (位置 ${i})`);
    console.log(' 元:', JSON.stringify(x.orig.slice(Math.max(0, i - 30), i + 70)));
    console.log(' 復:', JSON.stringify(x.back.slice(Math.max(0, i - 30), i + 70)));
  });
  console.error('\n❌ 中止');
  process.exit(1);
}
if (DRY) console.log('(dry run)');
else { pending.forEach(x => fs.writeFileSync(x.p, x.out)); console.log('✅ 書き込み:', pending.length, 'ファイル'); }

/* SEAM: 子を書き直したのに親の辞書が旧文のままの箇所を直す（2026-09-15）
 * 親（data-i18n を持ち 中に data-i18n の子を持つ要素）の辞書値は 子の文をそのまま抱えている。
 * 子の鍵だけ直すと 言語版では親の innerHTML 差し替えで旧文が戻る（3周当てても親が勝つ箇所がある）。
 * 親の各言語の値を HTML として読み 子と同じ位置の要素の中身を 子の訳（その言語）に置き換えて書き戻す。
 * 冪等。JSON 往復できるページだけ。
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
const ROOT = process.argv[2] || '.';
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|finder|skinfinder)/;
const LANGS = ['ja', 'en', 'zh', 'tw', 'ko'];
function span(s) { const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(s); if (!m) return null; let d = 0, i = s.indexOf('{', m.index), st = i, mode = null, esc = false;
  for (; i < s.length; i++) { const c = s[i]; if (esc) { esc = false; continue; } if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; } if (c === "'" || c === '"' || c === '`') { mode = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return [st, i + 1]; } } return null; }
const ent = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const bare = h => ent(String(h).replace(/<[^>]*>/g, '')).replace(/[\s　]/g, '');
// 要素の親からの経路（子要素の添字の列）
const pathOf = (root, el) => { const p = []; let e = el; while (e && e !== root) { p.unshift([...e.parentElement.children].indexOf(e)); e = e.parentElement; } return p; };
const walk = (root, p) => { let e = root; for (const i of p) { e = e.children[i]; if (!e) return null; } return e; };
let fixed = 0, pages = 0, skipped = [];
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const p = path.join(ROOT, f); const s = fs.readFileSync(p, 'utf8'); const sp = span(s); if (!sp) continue;
  const raw = s.slice(sp[0], sp[1]); let D; try { D = JSON.parse(raw); } catch { continue; }
  if (JSON.stringify(D) !== raw) { skipped.push(f); continue; }
  const dom = new JSDOM(s); const d = dom.window.document; let n = 0;
  d.querySelectorAll('[data-i18n]').forEach(parent => {
    const kids = [...parent.querySelectorAll('[data-i18n]')]; if (!kids.length) return;
    const k = parent.getAttribute('data-i18n'); if (!D.ja || D.ja[k] === undefined) return;
    if (bare(parent.textContent) === bare(D.ja[k])) return;                       // 親は最新
    for (const l of LANGS) {
      if (!D[l] || D[l][k] === undefined) continue;
      const frag = new JSDOM('<div id="r">' + D[l][k] + '</div>').window.document.getElementById('r');
      let changed = false;
      for (const kid of kids) {
        const ck = kid.getAttribute('data-i18n'); const val = l === 'ja' ? kid.innerHTML : (D[l][ck]);
        if (val === undefined) continue;
        const target = walk(frag, pathOf(parent, kid)); if (!target) continue;
        const clean = String(val).replace(/\s+data-i18n="[^"]*"/g, '');
        if (target.innerHTML !== clean) { target.innerHTML = clean; changed = true; }
      }
      if (changed) { D[l][k] = frag.innerHTML.replace(/\s+data-i18n="[^"]*"/g, ''); n++; }
    }
  });
  dom.window.close();
  if (n) { fs.writeFileSync(p, s.slice(0, sp[0]) + JSON.stringify(D) + s.slice(sp[1]), 'utf8'); pages++; fixed += n; }
}
console.log(`  親を直した ${pages}枚 / ${fixed}件` + (skipped.length ? '  飛ばした(往復NG): ' + skipped.join(' ') : ''));

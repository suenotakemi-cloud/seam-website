/* SEAM: HTML の日本語と辞書 ja の食い違いを直す（2026-09-10）
 *
 * 【なぜ】HTML の文を直しても 辞書（window.SEAM_PAGE_I18N）の ja が古いままのものが 42箇所あった。
 *   ・ja の辞書は 言語切替で日本語に戻すとき当たる → 直したはずの句点や古い文が戻る
 *   ・親の innerHTML を訳で差し替えるので 後から足した子リンク（髪質診断とは）が言語版で消える
 *   ・見出し（headspa-* の s4）は文を変えたのに 4言語の訳が旧文のまま
 *
 * 【やること】
 *   A. 子に data-i18n が無い要素で 文字だけ比べて食い違う → 辞書 ja を HTML の innerHTML にそろえる
 *   B. *-tokyo の s27/s28（関連リンク）に 5言語とも「髪質診断とは」のリンクを足す
 *   C. headspa-ginza/nagoya/osaka の s4（h1）を 5言語とも新しい文にする
 *   D. salon-nagoya の s43（FAQ 見出し）に 5言語とも 2問目「縮毛矯正やパーマもできますか」を足す
 *
 * 冪等。辞書は JSON 往復できるページだけ触る（できないページは名前を出して飛ばす）。
 */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { JSDOM } = require('jsdom');
const ROOT = process.argv[2] || '.';
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|finder|skinfinder)/;
const LANGS = ['ja', 'en', 'zh', 'tw', 'ko'];

function dictSpan(src) {
  const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src); if (!m) return null;
  const bs = src.indexOf('{', m.index); let d = 0, mode = null, esc = false;
  for (let i = bs; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') d++; else if (c === '}') { d--; if (d === 0) return [bs, i + 1]; }
  }
  return null;
}
const ent = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const bare = h => ent(String(h).replace(/<[^>]*>/g, '')).replace(/[\s　]/g, '');
// 辞書へ書く形: 子の data-i18n 属性は落とす（既存の辞書と同じ形）・空白は1つに
const asDict = html => html.replace(/\s+data-i18n="[^"]*"/g, '').replace(/\s+/g, ' ').trim();

// B/C/D の固定値
const LINK_LABEL = { ja: '髪質診断とは', en: 'What is the Hair Finder?', zh: '什么是发质诊断', tw: '什麼是髮質診斷', ko: '모발 진단이란' };
const H1 = {
  'headspa-ginza.html':  { ja: '銀座 完全個室のヘッドスパ専門店',      en: 'Ginza · Head spa specialists in a fully private room',         zh: '银座 完全独立包间的头皮SPA专门店',   tw: '銀座 完全獨立包廂的頭皮SPA專門店',   ko: '긴자 완전 개인실 헤드스파 전문점' },
  'headspa-nagoya.html': { ja: '名古屋 栄 完全個室のヘッドスパ専門店', en: 'Nagoya Sakae · Head spa specialists in a fully private room',  zh: '名古屋 荣 完全独立包间的头皮SPA专门店', tw: '名古屋 榮 完全獨立包廂的頭皮SPA專門店', ko: '나고야 사카에 완전 개인실 헤드스파 전문점' },
  'headspa-osaka.html':  { ja: '大阪 堀江 完全個室のヘッドスパ専門店', en: 'Osaka Horie · Head spa specialists in a fully private room',   zh: '大阪 堀江 完全独立包间的头皮SPA专门店', tw: '大阪 堀江 完全獨立包廂的頭皮SPA專門店', ko: '오사카 호리에 완전 개인실 헤드스파 전문점' },
};
const Q2 = { ja: '縮毛矯正やパーマもできますか', en: 'Can I also get straightening or a perm?', zh: '也可以做缩毛矫正或烫发吗', tw: '也可以做縮毛矯正或燙髮嗎', ko: '매직 스트레이트나 펌도 가능한가요' };

let nA = 0, nB = 0, nC = 0, nD = 0, skipped = [], pages = 0;
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const p = path.join(ROOT, f);
  let src = fs.readFileSync(p, 'utf8');
  const span = dictSpan(src); if (!span) continue;
  const raw = src.slice(span[0], span[1]);
  let dict; try { dict = JSON.parse(raw); } catch { skipped.push(f + '（JSONでない）'); continue; }
  if (JSON.stringify(dict) !== raw) { skipped.push(f + '（往復でずれる）'); continue; }
  if (!dict.ja) continue;
  pages++;
  const dom = new JSDOM(src), d = dom.window.document;
  let changed = 0;
  d.querySelectorAll('[data-i18n]').forEach(e => {
    const k = e.getAttribute('data-i18n');
    if (dict.ja[k] === undefined) return;
    if (bare(e.textContent) === bare(dict.ja[k])) return;
    const html = asDict(e.innerHTML);
    if (H1[f] && k === 's4') {                                  // C
      for (const l of LANGS) if (dict[l] && dict[l][k] !== H1[f][l]) { dict[l][k] = H1[f][l]; changed++; nC++; }
      return;
    }
    if (/-tokyo\.html$/.test(f) && /^s2[78]$/.test(k) && /髪質診断とは/.test(e.textContent)) {   // B
      for (const l of LANGS) {
        if (!dict[l] || dict[l][k] === undefined || /guide-kamishitsu-shindan/.test(dict[l][k])) continue;
        dict[l][k] = dict[l][k].trim() + ' ／ <a href="guide-kamishitsu-shindan.html" class="border-b border-line">' + LINK_LABEL[l] + '</a>';
        changed++; nB++;
      }
      return;
    }
    if (f === 'salon-nagoya.html' && k === 's43') {              // D
      for (const l of LANGS) {
        if (!dict[l] || dict[l][k] === undefined || /縮毛矯正やパーマ|straightening or a perm|缩毛矫正或烫发|縮毛矯正或燙髮|매직 스트레이트나 펌/.test(dict[l][k])) continue;
        // HTML と同じ骨組み（span の class もそろえる）
        const m = /<span class="([^"]*)"[^>]*>縮毛矯正やパーマもできますか<\/span>/.exec(e.innerHTML);
        const cls = m ? m[1] : '';
        dict[l][k] = dict[l][k].trim() + '<span class="' + cls + '">' + Q2[l] + '</span>';
        changed++; nD++;
      }
      return;
    }
    if (e.querySelector('[data-i18n]')) return;                  // 子に鍵があるものは A の対象外（訳の構造が変わるため）
    dict.ja[k] = html; changed++; nA++;                          // A
  });
  dom.window.close();
  if (changed) fs.writeFileSync(p, src.slice(0, span[0]) + JSON.stringify(dict) + src.slice(span[1]), 'utf8');
}
console.log(`  調べた ${pages}枚 → A ja をHTMLにそろえた ${nA}本 / B 髪質診断リンクを足した ${nB}本 / C headspa h1 ${nC}本 / D salon-nagoya s43 ${nD}本`);
if (skipped.length) console.log('  飛ばした: ' + skipped.join(' '));

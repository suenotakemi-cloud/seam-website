/* SEAM: ブランド本頁の 1画面目に「SEAM で買えます」を出す（2026-09-26）
 * 【なぜ】「◯◯ 取扱店」で来る人は買える場所を探している。本頁の 1画面目はブランドの写真と言葉だけで
 *   どこで買えるかが無かった（kerastase 実測）。答えが先の milbon-ginza は Google「ミルボン 取扱店」6位
 * 【やること】<main> の頭（無ければ最初の <section> の前）に 2行の帯を置き 「◯◯はどこで買える？」の見出しへ飛ばす
 *   ブランド名の各言語は 頁の辞書 bp.hubStores から取る。訳は頁の辞書へ直接（鍵 fv.buy1 / fv.buy2）
 * 冪等。使い方: node scripts/design_firstview_brand.js .
 */
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2] || '.';
const span = src => { const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src); if (!m) return null; const bs = src.indexOf('{', m.index); let d = 0, q = null, e = false;
  for (let i = bs; i < src.length; i++) { const c = src[i]; if (e) { e = false; continue; } if (q) { if (c === '\\') e = true; else if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '{') d++; else if (c === '}') { d--; if (!d) return [bs, i + 1]; } } return null; };
const RX = { ja: /^(.+?)はどこで買える？/, en: /^Where to buy (.+?): /, zh: /^(.+?)在哪里买？/, tw: /^(.+?)在哪裡買？/, ko: /^(.+?) 어디서 살 수/ };
const STORES = { ja: '銀座・表参道・名古屋 栄・大阪 堀江・福岡 天神・札幌 大通・宇都宮（在庫は店舗ごと）', en: 'Ginza · Omotesando · Nagoya Sakae · Osaka Horie · Fukuoka Tenjin · Sapporo Odori · Utsunomiya (stock varies by store)', zh: '银座・表参道・名古屋 荣・大阪 堀江・福冈 天神・札幌 大通・宇都宫（库存因店而异）', tw: '銀座・表參道・名古屋 榮・大阪 堀江・福岡 天神・札幌 大通・宇都宮（庫存依門市而異）', ko: '긴자・오모테산도・나고야 사카에・오사카 호리에・후쿠오카 텐진・삿포로 오도리・우쓰노미야（재고는 매장마다 다릅니다）' };
const LINE1 = { ja: b => `<b>${b}</b>は SEAM 全国7店舗で買えます　買うだけでも歓迎・メーカー公認の正規取扱　<a href="#where-to-buy" style="color:#8A6A3C;text-decoration:underline;text-underline-offset:3px;white-space:nowrap">店舗を見る →</a>`,
  en: b => `<b>${b}</b> is sold at all 7 SEAM stores. Walk in just to shop · authorized retailer　<a href="#where-to-buy" style="color:#8A6A3C;text-decoration:underline;text-underline-offset:3px;white-space:nowrap">See stores →</a>`,
  zh: b => `<b>${b}</b>可在SEAM全国7家门店购买　只购物也欢迎・品牌授权正规经销　<a href="#where-to-buy" style="color:#8A6A3C;text-decoration:underline;text-underline-offset:3px;white-space:nowrap">查看门店 →</a>`,
  tw: b => `<b>${b}</b>可在SEAM全國7家門市購買　只購物也歡迎・品牌授權正規經銷　<a href="#where-to-buy" style="color:#8A6A3C;text-decoration:underline;text-underline-offset:3px;white-space:nowrap">查看門市 →</a>`,
  ko: b => `SEAM 전국 7개 매장에서 <b>${b}</b> 구매 가능　구매만 하셔도 환영・정규 취급점　<a href="#where-to-buy" style="color:#8A6A3C;text-decoration:underline;text-underline-offset:3px;white-space:nowrap">매장 보기 →</a>` };
const log = [];
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z-]+\.html$/.test(f))) {
  const p = path.join(ROOT, f); let s = fs.readFileSync(p, 'utf8');
  if (!s.includes('data-i18n="bp.hubStores"') || /-(ginza|omotesando|osaka|nagoya|fukuoka|sapporo|utsunomiya|tokyo)\.html$/.test(f)) continue;
  if (s.includes('seam:fv-buy')) continue;
  const sp = span(s); if (!sp) { log.push('  ✘ ' + f + ': 辞書なし'); continue; }
  const dict = JSON.parse(s.slice(sp[0], sp[1]));
  const name = {}; for (const l of Object.keys(RX)) { const m = RX[l].exec((dict[l] || {})['bp.hubStores'] || ''); name[l] = m ? m[1] : null; }
  if (Object.values(name).some(v => !v)) { log.push('  ✘ ' + f + ': ブランド名が取れない ' + JSON.stringify(name)); continue; }
  const bar = `<!-- seam:fv-buy --><div style="max-width:1080px;margin:10px auto 0;padding:0 16px"><div style="background:#FFFFFF;border:1px solid #E6E0D8;border-radius:10px;padding:10px 14px;font-size:13px;line-height:1.75;color:#2A2D34"><p style="margin:0" data-i18n="fv.buy1">${LINE1.ja(name.ja)}</p><p style="margin:2px 0 0;font-size:11.5px;color:#6B665F" data-i18n="fv.buy2">${STORES.ja}</p></div></div>\n`;
  let at = s.indexOf('<main id="seam-main">'); if (at >= 0) at += '<main id="seam-main">'.length; else { const h = s.indexOf('</header>'); at = h >= 0 ? h + 9 : s.search(/<section[\s>]/); }
  if (at < 0) { log.push('  ✘ ' + f + ': 差し込み位置なし'); continue; }
  s = s.slice(0, at) + '\n' + bar + s.slice(at);
  s = s.replace(/(<[a-z0-9]+)([^>]*data-i18n="bp\.hubStores")/, (m0, t, rest) => rest.includes('id=') ? m0 : `${t} id="where-to-buy"${rest}`);
  const sp2 = span(s); const d2 = JSON.parse(s.slice(sp2[0], sp2[1]));
  for (const l of ['ja', 'en', 'zh', 'tw', 'ko']) { d2[l] = d2[l] || {}; d2[l]['fv.buy1'] = LINE1[l](name[l]); d2[l]['fv.buy2'] = STORES[l]; }
  s = s.slice(0, sp2[0]) + JSON.stringify(d2) + s.slice(sp2[1]);
  fs.writeFileSync(p, s); log.push('  ◎ ' + f + ': ' + name.ja);
}
console.log(log.join('\n'));

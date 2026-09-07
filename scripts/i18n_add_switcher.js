/* SEAM: 言語切替の入口を全ページに足す（2026-09-07）
 *
 * 【なぜ】en/zh/tw/ko の生成はできても 切替リンクが store-* にしか無かった。
 *   日本語ページから他言語へ行く道も 他言語から日本語へ戻る道も無い状態。
 *   検索から直接来た人しか多言語版にたどり着けない。
 *
 * 【形】store-ginza.html と同じ <p class="legal-links" data-langlinks>。
 *   リンクは / 起点の絶対パスなので 言語版にそのまま焼き込んでも壊れない。
 *   data-langlinks が付いているので 訳の対象からも外れる（言語名は各言語のまま）。
 *
 * 【置き場所】法務リンク（利用規約・プライバシー…）の直後。
 *   store-* と同じ並びになる。法務リンクが無いページには足さない
 *   （そういうページはフッタの形が違うので 勝手に入れると崩れる）。
 *
 * 冪等。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path');
const ROOT = process.argv[2];
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-menu|ginza-no1|ginza-salonboard|hpb-|treatment|seo-|strategy|write|404|finder|skinfinder)/;
const LANGS = [['', '日本語'], ['/en', 'English'], ['/zh', '简体中文'], ['/tw', '繁體中文'], ['/ko', '한국어']];

// 法務リンクの段落（切替ではないほう）を見つける。
//
// 【罠・実際にやらかした】「もう入っているか」を生の文字列で見ると
//   辞書 SEAM_PAGE_I18N の中に同じ HTML が訳として入っているページを
//   「入っている」と誤判定して飛ばす（hairsalon がそれで抜けた）。
//   入っているかは DOM で見る。
//
// 【置き場所】class="legal-links" が付いていないページもあるので
//   利用規約・プライバシー・特定商取引の3つを含む段落を探す。
const LEGAL = /<p class="legal-links"(?![^>]*data-langlinks)[^>]*>[\s\S]*?<\/p>/;
const LEGAL2 = /<p\b(?![^>]*data-langlinks)[^>]*>(?:(?!<\/p>)[\s\S])*?terms\.html(?:(?!<\/p>)[\s\S])*?tokushoho\.html(?:(?!<\/p>)[\s\S])*?<\/p>/;

let n = 0, noLegal = [];
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const p = path.join(ROOT, f);
  const html = fs.readFileSync(p, 'utf8');
  if (new JSDOM(html).window.document.querySelector('[data-langlinks]')) continue;   // もうある
  const m = LEGAL.exec(html) || LEGAL2.exec(html);
  if (!m) { noLegal.push(f); continue; }

  const slug = '/' + f.replace(/\.html$/, '');
  const links = LANGS.map(([pre, label]) =>
    `<a href="${pre}${slug}" style="text-decoration:underline;">${label}</a>`).join(' ');
  const block = `\n<p class="legal-links" data-langlinks style="margin-top:6px;text-align:center;font-size:12px;line-height:1.8;color:rgba(58,50,42,.62);">${links}</p>`;

  const out = html.slice(0, m.index + m[0].length) + block + html.slice(m.index + m[0].length);
  fs.writeFileSync(p, out);
  n++;
}
console.log(`  切替を足した ${n}枚` + (noLegal.length ? ` ・法務リンクが無くて足せなかった ${noLegal.length}枚: ${noLegal.slice(0, 5).join(' ')}` : ''));

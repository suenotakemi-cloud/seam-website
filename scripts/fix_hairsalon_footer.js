/* SEAM: hairsalon の法務リンクと言語切替を DOM で入れる（2026-09-07）
 *
 * 【なぜ道具を分けたか】hairsalon は辞書 GAPFILL の中に
 *   同じ HTML（</footer> や p.legal-links）を文字列として持っている。
 *   生テキストの rfind／正規表現だと そちらを掴んで辞書の中へ差し込んでしまう。
 *   実際2回やらかした。要素は DOM で探して DOM で足す。
 *
 * 【元の穴】g73 という鍵に法務リンクのHTMLが入っているが
 *   それを当てる data-i18n="g73" の要素がページに無い＝一度も画面に出ない。
 *   生の href 検索で数えると「ある」に見える偽の緑だった。
 *
 * 冪等。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs');
const F = 'hairsalon.html';
const raw = fs.readFileSync(F, 'utf8');
const dom = new JSDOM(raw), d = dom.window.document;

if (d.querySelector('[data-langlinks]')) { console.log('  すでに入っている'); process.exit(0); }
const foot = d.querySelector('footer');
if (!foot) { console.error('  ✘ footer が無い'); process.exit(1); }

const S = 'text-decoration:underline;display:inline-block;min-height:44px;line-height:44px;';
const base = 'margin-top:8px;text-align:center;font-size:12px;line-height:1.8;color:rgba(58,50,42,.62);';
const legal = d.createElement('p');
legal.className = 'legal-links';
legal.setAttribute('style', base);
legal.innerHTML = `<a href="terms.html" style="${S}">利用規約</a> `
  + `<a href="privacy.html" style="${S}" data-i18n="x.6bc76e56">プライバシーポリシー</a> `
  + `<a href="tokushoho.html" style="${S}" data-i18n="x.46ebe8a3">特定商取引法に基づく表記</a>`;

const sw = d.createElement('p');
sw.className = 'legal-links';
sw.setAttribute('data-langlinks', '');
sw.setAttribute('style', base.replace('margin-top:8px', 'margin-top:6px'));
sw.innerHTML = [['', '日本語'], ['/en', 'English'], ['/zh', '简体中文'], ['/tw', '繁體中文'], ['/ko', '한국어']]
  .map(([p, n]) => `<a href="${p}/hairsalon" style="text-decoration:underline;">${n}</a>`).join(' ');

foot.appendChild(legal);
foot.appendChild(sw);

let out = dom.serialize().replace(/^<!DOCTYPE html><html/i, '<!DOCTYPE html>\n<html');
if (!out.endsWith('\n')) out += '\n';
fs.writeFileSync(F, out);
const c = new JSDOM(out).window.document;
console.log('  入れた。DOM上 legal-links=' + c.querySelectorAll('p.legal-links').length
  + ' langlinks=' + c.querySelectorAll('[data-langlinks]').length);

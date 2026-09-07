/* SEAM: 多言語の穴を埋める ①抜き出し（2026-09-07）
 *
 * 【なぜ】客先197枚のうち152枚で 中国語版・英語版に日本語がそのまま出ていた。
 *   原因は data-i18n が付いていない要素（作り直しや導線追加で後から入った文）。
 *   辞書の鍵が無い＝訳しようがないので 生成しても日本語のまま素通しする。
 *
 * 【やり方】
 *   ・かなを持つ要素に data-i18n="x.<中身のhash8>" を付ける
 *     → 同じ日本語は同じ鍵になるので 112枚で使い回している文も訳は1本で済む
 *   ・lang.js も build-i18n.js も el.innerHTML = dict[key] で当てるので
 *     中に <br> や <a> を持つ要素は innerHTML ごと原文にする（タグを訳文に残す）
 *   ・親子どちらもかなを持つときは親だけ採る（親の innerHTML が子を含むため）
 *
 * 【触らないもの】
 *   ・社内ページ（admin・strategy・hpb-系・write など）は身内しか見ない
 *     ※ここに hpb-<星>/write と書くと星スラッシュがコメントを閉じて構文エラーになる
 *   ・finder / skinfinder は自前の多言語を持っている
 *   ・すでに訳が当たっている要素
 *
 * 出力: i18n/source.json（原文の台帳）。訳は i18n/<lang>.json に貯める。
 * 冪等。
 */
const { JSDOM } = require('jsdom');
const fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = process.argv[2];
const DRY = process.argv.includes('--dry');   // 台帳だけ作って HTML は触らない
const SKIP = /^(admin|entrance|august-|exec-|finder-spec|gbp-|ginza-2026|ginza-earn|ginza-no1|ginza-salonboard|hpb-|seo-|strategy|write|404|finder|skinfinder)/;
const kana = s => (s.match(/[ぁ-んァ-ヴ]/g) || []).length;
const keyOf = s => 'x.' + crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

const SRC = path.join(ROOT, 'i18n', 'source.json');
const source = fs.existsSync(SRC) ? JSON.parse(fs.readFileSync(SRC, 'utf8')) : {};

let nPage = 0, nEl = 0, nNew = 0;
const files = fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f));

for (const f of files) {
  const p = path.join(ROOT, f);
  const html = fs.readFileSync(p, 'utf8');
  const dom = new JSDOM(html);
  const d = dom.window.document;

  const m = html.match(/window\.SEAM_PAGE_I18N\s*=\s*(\{[\s\S]*?\})\s*;/);
  let have = {};
  if (m) { try { have = JSON.parse(m[1]).zh || {}; } catch { try { have = eval('(' + m[1] + ')').zh || {}; } catch {} } }

  // かなを 自分の文字ノードに持つ要素（script/style の中は除く）
  //
  // 【罠】言語切替リンクの「日本語」もかなを持つ。ここを訳すと
  //   中国語ページで日本語への入口が消える。切替まわりは丸ごと外す。
  const cand = [...d.querySelectorAll('body *')].filter(e => {
    if (e.closest('script,style,noscript')) return false;
    if (e.closest('[data-langlinks],[data-lang],.lang-switch,.legal-links')) return false;
    const k = e.getAttribute('data-i18n');
    if (k && have[k] !== undefined) return false;          // もう訳せている
    const own = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('');
    return kana(own) > 0;
  });
  // 親子で重なったら親だけ（親の innerHTML が子を飲み込むため）
  const pick = cand.filter(e => !cand.some(o => o !== e && o.contains(e)));
  if (!pick.length) continue;

  let touched = false;
  for (const e of pick) {
    const raw = e.innerHTML.replace(/\s+/g, ' ').trim();
    if (!raw || !kana(raw)) continue;
    const k = keyOf(raw);
    if (e.getAttribute('data-i18n') !== k) { e.setAttribute('data-i18n', k); touched = true; }
    if (!source[k]) { source[k] = raw; nNew++; }
    nEl++;
  }
  if (touched && !DRY) {
    // serialize() は DOCTYPE の改行と末尾改行を落とすだけ（実測±9字）。戻しておく
    let out = dom.serialize().replace(/^<!DOCTYPE html><html/i, '<!DOCTYPE html>\n<html');
    if (!out.endsWith('\n')) out += '\n';
    fs.writeFileSync(p, out);
    nPage++;
  } else if (touched) { nPage++; }
}

fs.mkdirSync(path.join(ROOT, 'i18n'), { recursive: true });
fs.writeFileSync(SRC, JSON.stringify(source, null, 1), 'utf8');
console.log(`  鍵を付けた ${nPage}枚 / ${nEl}箇所 ・ 原文台帳 ${Object.keys(source).length}本（新規 ${nNew}）`);

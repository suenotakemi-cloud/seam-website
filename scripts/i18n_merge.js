/* SEAM: 多言語の穴を埋める ②差し込み（2026-09-07）
 *
 * i18n/source.json（原文）と i18n/en|zh|tw|ko.json（訳）を
 * 各ページの window.SEAM_PAGE_I18N へ入れる。
 *
 * 【辞書の読み方】build-i18n.js と同じく vm で評価する。
 *   単引用符のJS体（brand・index）も混ざっているので JSON.parse では読めない。
 *   書き戻しは JSON にそろえる（評価できる形なので build も lang.js も困らない）。
 *
 * 【入れるもの】そのページが実際に使っている data-i18n の鍵だけ。
 *   使っていない鍵まで配ると 1枚あたりの辞書が2,336本になって重くなる。
 *
 * 【ja も入れる】訳が無い言語では ja に落ちるのではなく元のHTMLがそのまま出る。
 *   ja を辞書に持たせておくと 言語切替で日本語に戻したとき確実に戻る。
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

const DICT_ASSIGN = /window\.SEAM_PAGE_I18N\s*=\s*\{/;

function readDict(html) {
  const m = DICT_ASSIGN.exec(html);
  if (!m) return null;
  // 代入の { から 対応する } までをブレース数えで取る（正規表現では入れ子に負ける）
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
  const lit = html.slice(i, end);
  const box = { window: {} };
  vm.createContext(box);
  try { vm.runInContext('window.SEAM_PAGE_I18N=' + lit, box, { timeout: 5000 }); } catch { return null; }
  return { dict: box.window.SEAM_PAGE_I18N, start: i, end };
}

let nPage = 0, nAdd = 0, noTrans = new Set();
for (const f of fs.readdirSync(ROOT).filter(f => /^[a-z0-9-]+\.html$/.test(f) && !SKIP.test(f))) {
  const p = path.join(ROOT, f);
  let html = fs.readFileSync(p, 'utf8');
  const d = new JSDOM(html).window.document;

  const keys = new Set();
  d.querySelectorAll('[data-i18n]').forEach(e => keys.add(e.getAttribute('data-i18n')));
  d.querySelectorAll('[data-i18n-attr]').forEach(e =>
    e.getAttribute('data-i18n-attr').split(';').forEach(pair => {
      const i = pair.indexOf(':'); if (i >= 0) keys.add(pair.slice(i + 1).trim());
    }));
  const mine = [...keys].filter(k => k.startsWith('x.'));
  if (!mine.length) continue;

  const got = readDict(html);
  const dict = got ? got.dict : { ja: {}, en: {}, zh: {}, tw: {}, ko: {} };
  for (const l of ['ja', ...LANGS]) dict[l] = dict[l] || {};

  let added = 0;
  for (const k of mine) {
    if (source[k] !== undefined && dict.ja[k] !== source[k]) { dict.ja[k] = source[k]; added++; }
    for (const l of LANGS) {
      const v = T[l][k];
      if (v === undefined) { noTrans.add(k); continue; }
      if (dict[l][k] !== v) { dict[l][k] = v; added++; }
    }
  }
  if (!added) continue;

  const body = JSON.stringify(dict, null, 0);
  if (got) {
    html = html.slice(0, got.start) + body + html.slice(got.end);
  } else {
    const tag = `<script>window.SEAM_PAGE_I18N = ${body};</script>\n`;
    html = html.replace(/<\/body>/i, tag + '</body>');
  }
  fs.writeFileSync(p, html);
  nPage++; nAdd += added;
}
console.log(`  差し込み ${nPage}枚 / ${nAdd}件 ・ まだ訳が無い鍵 ${noTrans.size}本`);

/* ════════════════════════════════════════════════════════════
   SEAM 多言語プリレンダ (Node + jsdom, CIで実行)
   目的: クライアントJS翻訳(単一URL)では en/zh/tw/ko が検索に出ない。
        各言語の翻訳を焼き込んだ静的ページを /en/ /zh/ /tw/ /ko/ に生成し、
        検索エンジンに各言語コンテンツを直接見せる(hreflangはPass2)。
   方式: 各ページの window.SEAM_PAGE_I18N(辞書) と lang.js の data-i18n 適用ロジックを
        Node側で再現(同じ辞書・同じkey)。相対パスは / 起点へ書換(サブディレクトリ対策)。
   Pass1: 言語ディレクトリ生成 + sitemap更新のみ(既存jaページは不変=ライブ安全)。
   ════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { JSDOM } = require('jsdom');

const BASE = 'https://seam.site';
const ROOT = path.resolve(__dirname, '..', '..'); // seam-public/

// 翻訳対象=コンテンツ6ページ(finderはReactアプリのため除外)
const PAGES = [
  { file: 'index.html',      url: '/' },
  { file: 'shop.html',       url: '/shop' },
  { file: 'hairsalon.html',  url: '/hairsalon' },
  { file: 'headspa.html',    url: '/headspa' },
  { file: 'brand.html',      url: '/brand' },
  { file: 'onlineshop.html', url: '/onlineshop' },
];
// ja=ルート(既存)。生成するのは以下4言語。値は <html lang> 用。
const LANGS = { en: 'en', zh: 'zh-Hans', tw: 'zh-Hant', ko: 'ko' };

function isRel(v) {
  return !!v && !/^(https?:|\/\/|#|mailto:|tel:|data:|javascript:|\/)/i.test(v);
}

function rewriteUrlsToRoot(doc) {
  // サブディレクトリ(/en/ 等)配下でも相対アセット/リンクが解決するよう / 起点へ
  doc.querySelectorAll('[src],[href],[poster],[data-src]').forEach(el => {
    ['src', 'href', 'poster', 'data-src'].forEach(a => {
      const v = el.getAttribute(a);
      if (isRel(v)) el.setAttribute(a, '/' + v);
    });
  });
  doc.querySelectorAll('[srcset]').forEach(el => {
    const v = el.getAttribute('srcset');
    if (!v) return;
    const out = v.split(',').map(part => {
      const seg = part.trim().split(/\s+/);
      if (seg[0] && isRel(seg[0])) seg[0] = '/' + seg[0];
      return seg.join(' ');
    }).join(', ');
    el.setAttribute('srcset', out);
  });
}

function extractI18N(doc) {
  const scripts = [...doc.querySelectorAll('script:not([src])')];
  for (const s of scripts) {
    if (!s.textContent || s.textContent.indexOf('SEAM_PAGE_I18N') < 0) continue;
    const sandbox = { window: {}, document: {}, location: {}, navigator: {}, localStorage: {} };
    vm.createContext(sandbox);
    try { vm.runInContext(s.textContent, sandbox, { timeout: 3000 }); } catch (e) { /* 辞書代入は通る */ }
    if (sandbox.window.SEAM_PAGE_I18N) return sandbox.window.SEAM_PAGE_I18N;
    // フォールバック: 辞書代入の前にアプリコードがDOM APIで落ちるページ(brand等)は
    // `window.SEAM_PAGE_I18N = {...}` のオブジェクトリテラルだけをブレーススキャンで
    // 切り出し、代入文のみを評価する(文字列' " ` とエスケープを考慮)。
    const lit = extractDictLiteral(s.textContent);
    if (lit) {
      const sb = { window: {} };
      vm.createContext(sb);
      try { vm.runInContext('window.SEAM_PAGE_I18N=' + lit, sb, { timeout: 5000 }); } catch (e) {}
      if (sb.window.SEAM_PAGE_I18N) return sb.window.SEAM_PAGE_I18N;
    }
  }
  return null;
}

function extractDictLiteral(src) {
  const idx = src.indexOf('window.SEAM_PAGE_I18N');
  if (idx < 0) return null;
  const bs = src.indexOf('{', idx);
  if (bs < 0) return null;
  let d = 0, mode = null, esc = false;
  for (let i = bs; i < src.length; i++) {
    const c = src[i];
    if (esc) { esc = false; continue; }
    if (mode) { if (c === '\\') esc = true; else if (c === mode) mode = null; continue; }
    if (c === "'" || c === '"' || c === '`') { mode = c; continue; }
    if (c === '{') d++;
    else if (c === '}') { d--; if (d === 0) return src.slice(bs, i + 1); }
  }
  return null;
}

function applyLang(doc, dict, shortLang, htmlLang) {
  let n = 0;
  doc.documentElement.setAttribute('lang', htmlLang);
  doc.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if (dict[k] !== undefined) { el.innerHTML = dict[k]; n++; }
  });
  doc.querySelectorAll('[data-i18n-attr]').forEach(el => {
    el.getAttribute('data-i18n-attr').split(';').forEach(pair => {
      const i = pair.indexOf(':'); if (i < 0) return;
      const attr = pair.slice(0, i).trim(), k = pair.slice(i + 1).trim();
      if (attr && dict[k] !== undefined) el.setAttribute(attr, dict[k]);
    });
  });
  doc.querySelectorAll('[data-lang]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-lang') === shortLang);
  });
  doc.querySelectorAll('[data-lang-inline]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-lang-inline') === shortLang);
  });
  if (dict['meta.title'] !== undefined) {
    const t = doc.querySelector('title');
    if (t) t.textContent = dict['meta.title'];
  }
  return n;
}

function setHead(doc, shortLang, htmlLang, pageUrl) {
  const head = doc.querySelector('head');
  // canonical をこの言語URLへ
  const selfUrl = BASE + '/' + shortLang + (pageUrl === '/' ? '/' : pageUrl);
  // 元ページに canonical が複数あると querySelector は先頭しか拾わず、
  // 残りが ja のURLを指したまま言語版に混入する(=言語版が ja へ正規化されて消える)。
  // 2件目以降は必ず除去してから 1本だけ張り直す。
  const cans = doc.querySelectorAll('link[rel="canonical"]');
  for (let i = 1; i < cans.length; i++) cans[i].remove();
  let can = cans[0];
  if (!can) { can = doc.createElement('link'); can.setAttribute('rel', 'canonical'); head.appendChild(can); }
  can.setAttribute('href', selfUrl);
  // og:locale
  const ogLoc = { en: 'en_US', zh: 'zh_CN', tw: 'zh_TW', ko: 'ko_KR' }[shortLang] || 'ja_JP';
  let og = doc.querySelector('meta[property="og:locale"]');
  if (!og) { og = doc.createElement('meta'); og.setAttribute('property', 'og:locale'); head.appendChild(og); }
  og.setAttribute('content', ogLoc);
  // 初回訪問(localStorage無し)で lang.js が ja に戻すのを防ぐ: 先頭で言語を保存
  const force = doc.createElement('script');
  force.textContent = "try{localStorage.setItem('seamLang','" + shortLang + "')}catch(e){}";
  head.insertBefore(force, head.firstChild);
}

function build() {
  const summary = [];
  for (const lang of Object.keys(LANGS)) {
    const htmlLang = LANGS[lang];
    const outDir = path.join(ROOT, lang);
    fs.mkdirSync(outDir, { recursive: true });
    for (const pg of PAGES) {
      const src = path.join(ROOT, pg.file);
      if (!fs.existsSync(src)) { summary.push(`SKIP ${lang}/${pg.file} (no source)`); continue; }
      const html = fs.readFileSync(src, 'utf-8');
      const dom = new JSDOM(html); // scripts は実行しない(既定)
      const doc = dom.window.document;
      const I18N = extractI18N(doc);
      if (!I18N || !I18N[lang]) { summary.push(`SKIP ${lang}/${pg.file} (no dict)`); continue; }
      const applied = applyLang(doc, I18N[lang], lang, htmlLang);
      rewriteUrlsToRoot(doc);
      setHead(doc, lang, htmlLang, pg.url);
      let out = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
      // DOM属性以外(JS文字列・inline style url等)の相対アセットパスも / 起点へ。
      // 例: index.html が gem画像を src="images/karte/gems/"+id+".jpg" とJSで組む箇所。
      // 絶対URL("/images/ や "https://.../images/")はクォート直後が images でないため不一致＝安全。
      out = out.replace(/(["'`])(images|js|css|fonts|vendor|videos)\//g, '$1/$2/');
      fs.writeFileSync(path.join(outDir, pg.file), out, 'utf-8');
      const title = (doc.querySelector('title') || {}).textContent || '';
      summary.push(`OK   ${lang}/${pg.file}  i18n=${applied}  bytes=${out.length}  title="${title.slice(0, 40)}"`);
    }
  }

  // sitemap.xml 再生成: ja(7+ジャーナル) + 各言語×6
  // ジャーナル/ガイドはJA専用コンテンツ(多言語prerender対象外)＝ja URLのみ収録
  const jaUrls = ['/', '/finder', '/skinfinder', '/brand', '/shop', '/onlineshop', '/hairsalon', '/headspa',
    '/journal', '/guide-uneri', '/guide-damage', '/guide-kansou',
    '/guide-shiraga', '/guide-scalp', '/guide-mens',
    '/guide-bleach', '/guide-straightening', '/guide-colorfade', '/guide-perm', '/guide-salon-senyo',
    '/store-ginza', '/store-omotesando', '/store-osaka', '/store-nagoya',
    '/store-fukuoka', '/store-sapporo', '/store-utsunomiya',
    '/aujua', '/kerastase', '/tokio', '/bykarte', '/shu-uemura', '/lashaddict', '/sublimic', '/shiseido-professional', '/tsururincho', '/system-professional', '/milbon', '/aujua-ginza', '/aujua-omotesando', '/aujua-sapporo', '/aujua-osaka', '/aujua-nagoya', '/aujua-fukuoka', '/aujua-utsunomiya', '/kerastase-ginza', '/kerastase-omotesando', '/kerastase-sapporo', '/kerastase-osaka', '/kerastase-nagoya', '/kerastase-fukuoka', '/kerastase-utsunomiya', '/tokio-ginza', '/tokio-omotesando', '/tokio-sapporo', '/tokio-osaka', '/tokio-nagoya', '/tokio-fukuoka', '/tokio-utsunomiya', '/bykarte-ginza', '/bykarte-omotesando', '/bykarte-sapporo', '/bykarte-osaka', '/bykarte-nagoya', '/bykarte-fukuoka', '/bykarte-utsunomiya', '/shu-uemura-ginza', '/shu-uemura-omotesando', '/shu-uemura-sapporo', '/shu-uemura-osaka', '/shu-uemura-nagoya', '/shu-uemura-fukuoka', '/shu-uemura-utsunomiya', '/lashaddict-ginza', '/lashaddict-omotesando', '/lashaddict-sapporo', '/lashaddict-osaka', '/lashaddict-nagoya', '/lashaddict-fukuoka', '/lashaddict-utsunomiya', '/sublimic-ginza', '/sublimic-omotesando', '/sublimic-sapporo', '/sublimic-osaka', '/sublimic-nagoya', '/sublimic-fukuoka', '/sublimic-utsunomiya', '/shiseido-professional-ginza', '/shiseido-professional-omotesando', '/shiseido-professional-sapporo', '/shiseido-professional-osaka', '/shiseido-professional-nagoya', '/shiseido-professional-fukuoka', '/shiseido-professional-utsunomiya', '/tsururincho-ginza', '/tsururincho-omotesando', '/tsururincho-sapporo', '/tsururincho-osaka', '/tsururincho-nagoya', '/tsururincho-fukuoka', '/tsururincho-utsunomiya', '/system-professional-ginza', '/system-professional-omotesando', '/system-professional-sapporo', '/system-professional-osaka', '/system-professional-nagoya', '/system-professional-fukuoka', '/system-professional-utsunomiya', '/milbon-ginza', '/milbon-omotesando', '/milbon-sapporo', '/milbon-osaka', '/milbon-nagoya', '/milbon-fukuoka', '/milbon-utsunomiya',
    '/recruit',
    '/recruit-stylist-ginza',
    '/recruit-stylist-sapporo',
    '/recruit-stylist-osaka',
    '/recruit-stylist-nagoya',
    '/recruit-stylist-fukuoka',
    '/recruit-spanist-ginza',
    '/recruit-spanist-osaka',
    '/recruit-spanist-nagoya'];
  // ja側も実在チェック(言語版と同じ扱い)。存在しないページをsitemapに載せない=404申告の防止
  const missingJa = jaUrls.filter(u => !fs.existsSync(path.join(ROOT, u === '/' ? 'index.html' : u.slice(1) + '.html')));
  if (missingJa.length) summary.push(`WARN sitemap: 実体なしのjaページを除外 ${missingJa.join(', ')}`);
  const urls = jaUrls.filter(u => !missingJa.includes(u));
  for (const lang of Object.keys(LANGS)) {
    for (const pg of PAGES) {
      // 生成に失敗したページをsitemapに載せない(404防止)。実在ファイルのみ収録
      if (!fs.existsSync(path.join(ROOT, lang, pg.file))) continue;
      urls.push('/' + lang + (pg.url === '/' ? '/' : pg.url));
    }
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(u => '  <url><loc>' + BASE + u + '</loc></url>').join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf-8');
  summary.push(`sitemap.xml urls=${urls.length}`);

  console.log(summary.join('\n'));
}

build();

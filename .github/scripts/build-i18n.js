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
  let can = doc.querySelector('link[rel="canonical"]');
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
  const jaUrls = ['/', '/finder', '/brand', '/shop', '/onlineshop', '/hairsalon', '/headspa',
    '/journal', '/guide-uneri', '/guide-damage', '/guide-kansou'];
  const urls = [...jaUrls];
  for (const lang of Object.keys(LANGS)) {
    for (const pg of PAGES) urls.push('/' + lang + (pg.url === '/' ? '/' : pg.url));
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

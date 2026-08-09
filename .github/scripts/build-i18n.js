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
  { file: 'ginza-spa-journey.html', url: '/ginza-spa-journey' },

  // 2026-08-01 追加: 海外からの検索の受け皿。店舗7 + 地域LP19。
  // 辞書は scratchpad の共通辞書から一括生成して各HTMLに焼き込み済み(data-i18n方式)。
  { file: 'store-ginza.html',       url: '/store-ginza' },
  { file: 'store-omotesando.html',  url: '/store-omotesando' },
  { file: 'store-osaka.html',       url: '/store-osaka' },
  { file: 'store-nagoya.html',      url: '/store-nagoya' },
  { file: 'store-fukuoka.html',     url: '/store-fukuoka' },
  { file: 'store-sapporo.html',     url: '/store-sapporo' },
  { file: 'store-utsunomiya.html',  url: '/store-utsunomiya' },

  { file: 'headspa-ginza.html',     url: '/headspa-ginza' },
  { file: 'headspa-nagoya.html',    url: '/headspa-nagoya' },
  { file: 'headspa-osaka.html',     url: '/headspa-osaka' },

  { file: 'salon-ginza.html',       url: '/salon-ginza' },
  { file: 'salon-sapporo.html',     url: '/salon-sapporo' },
  { file: 'salon-osaka.html',       url: '/salon-osaka' },
  { file: 'salon-nagoya.html',      url: '/salon-nagoya' },
  { file: 'salon-fukuoka.html',     url: '/salon-fukuoka' },

  { file: 'aujua-tokyo.html',                 url: '/aujua-tokyo' },
  { file: 'kerastase-tokyo.html',             url: '/kerastase-tokyo' },
  { file: 'tokio-tokyo.html',                 url: '/tokio-tokyo' },
  { file: 'bykarte-tokyo.html',               url: '/bykarte-tokyo' },
  { file: 'shu-uemura-tokyo.html',            url: '/shu-uemura-tokyo' },
  { file: 'lashaddict-tokyo.html',            url: '/lashaddict-tokyo' },
  { file: 'sublimic-tokyo.html',              url: '/sublimic-tokyo' },
  { file: 'shiseido-professional-tokyo.html', url: '/shiseido-professional-tokyo' },
  { file: 'tsururincho-tokyo.html',           url: '/tsururincho-tokyo' },
  { file: 'system-professional-tokyo.html',   url: '/system-professional-tokyo' },
  { file: 'milbon-tokyo.html',                url: '/milbon-tokyo' },
];
// ja=ルート(既存)。生成するのは以下4言語。値は <html lang> 用。
const LANGS = { en: 'en', zh: 'zh-Hans', tw: 'zh-Hant', ko: 'ko' };

function isRel(v) {
  return !!v && !/^(https?:|\/\/|#|mailto:|tel:|data:|javascript:|\/)/i.test(v);
}

// 言語版が存在するページのファイル名。ここに載っているリンクは同じ言語へ送る。
const TRANSLATED = new Set(PAGES.map(p => p.file));

function rewriteUrlsToRoot(doc, shortLang) {
  // サブディレクトリ(/en/ 等)配下でも相対アセット/リンクが解決するよう / 起点へ。
  // ただし【リンク先に言語版がある場合は /en/ 等へ送る】。
  // これが無いと 英語ページから1回クリックしただけで日本語サイトに戻ってしまい、
  // 海外のお客様が読み進められない(2026-08-01 修正)。
  doc.querySelectorAll('[src],[href],[poster],[data-src]').forEach(el => {
    ['src', 'href', 'poster', 'data-src'].forEach(a => {
      const v = el.getAttribute(a);
      if (!isRel(v)) return;
      if (a === 'href' && shortLang) {
        // "shop.html#stores" / "brand.html?mode=product" からファイル名だけ取り出す
        const file = v.split(/[?#]/)[0];
        if (TRANSLATED.has(file)) {
          el.setAttribute(a, '/' + shortLang + '/' + v);
          return;
        }
      }
      el.setAttribute(a, '/' + v);
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
  // 辞書は「本体を定義するスクリプト」と「あとから追記するスクリプト」に分かれている
  // ことがある(headspa の店舗別メニュー辞書 = 1キー→[ja,en,zh,tw,ko] を後段でマージ)。
  // 最初の1本を見つけた時点で return すると追記分が丸ごと落ち、その範囲だけ日本語のまま
  // 多言語ページに焼き込まれる(2026-07-28 に実際にそうなった)。
  // 該当する全スクリプトを「同じsandbox」で document 順に流し、マージ後の辞書を返す。
  const scripts = [...doc.querySelectorAll('script:not([src])')]
    .filter(s => s.textContent && s.textContent.indexOf('SEAM_PAGE_I18N') >= 0);
  if (!scripts.length) return null;

  const sandbox = { window: {}, document: {}, location: {}, navigator: {}, localStorage: {} };
  vm.createContext(sandbox);
  for (const s of scripts) {
    try { vm.runInContext(s.textContent, sandbox, { timeout: 3000 }); } catch (e) { /* 辞書代入は通る */ }
    if (sandbox.window.SEAM_PAGE_I18N) continue;
    // フォールバック: 辞書代入の前にアプリコードがDOM APIで落ちるページ(brand等)は
    // `window.SEAM_PAGE_I18N = {...}` のオブジェクトリテラルだけをブレーススキャンで
    // 切り出し、代入文のみを評価する(文字列' " ` とエスケープを考慮)。
    const lit = extractDictLiteral(s.textContent);
    if (lit) {
      try { vm.runInContext('window.SEAM_PAGE_I18N=' + lit, sandbox, { timeout: 5000 }); } catch (e) {}
    }
  }
  return sandbox.window.SEAM_PAGE_I18N || null;
}

function extractDictLiteral(src) {
  // 【罠】identifier を indexOf で探すと、辞書を"読む"側のコードを先に拾ってしまう。
  // brand.html には辞書の定義より前に
  //   const T = (window.SEAM_PAGE_I18N && window.SEAM_PAGE_I18N[...]) || {};
  // があり、そこの `{}` を辞書literalとして切り出して 空の辞書を返していた
  //   → build() が「no dict」でSKIP → en/zh/tw/ko の brand が再生成されず古いまま
  //     (説明文が日本語のまま本番に出ていた。2026-08-01 修正)
  // 代入文 `window.SEAM_PAGE_I18N = {` だけに当てる。
  const m = /window\.SEAM_PAGE_I18N\s*=\s*\{/.exec(src);
  if (!m) return null;
  const bs = src.indexOf('{', m.index);
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
  // meta description / og:description（2026-08-01 追加）
  // これが無かったため title だけ翻訳され、検索結果のスニペットが全言語で日本語のままだった。
  // og が辞書に無いときは description で代用する(日本語が出るよりは同文のほうが良い)。
  if (dict['meta.description'] !== undefined) {
    const head = doc.querySelector('head');
    let d = doc.querySelector('meta[name="description"]');
    if (!d && head) {
      d = doc.createElement('meta'); d.setAttribute('name', 'description'); head.appendChild(d);
    }
    if (d) d.setAttribute('content', dict['meta.description']);

    const ogText = dict['meta.ogDescription'] !== undefined
      ? dict['meta.ogDescription'] : dict['meta.description'];
    // og:description と twitter:description を揃える(片方だけ日本語が残る事故を防ぐ)
    [['meta[property="og:description"]', 'property', 'og:description'],
     ['meta[name="twitter:description"]', 'name', 'twitter:description']].forEach(([sel, attr, key]) => {
      let el = doc.querySelector(sel);
      if (!el && head) { el = doc.createElement('meta'); el.setAttribute(attr, key); head.appendChild(el); }
      if (el) el.setAttribute('content', ogText);
    });
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
      rewriteUrlsToRoot(doc, lang);
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
    '/ginza-spa-journey', '/headspa-ginza', '/headspa-nagoya', '/headspa-osaka', '/salon-ginza', '/salon-sapporo', '/salon-osaka', '/salon-nagoya', '/salon-fukuoka', '/aujua-tokyo', '/kerastase-tokyo', '/tokio-tokyo', '/bykarte-tokyo', '/shu-uemura-tokyo', '/lashaddict-tokyo', '/sublimic-tokyo', '/shiseido-professional-tokyo', '/tsururincho-tokyo', '/system-professional-tokyo', '/milbon-tokyo',
    '/recruit',
    '/press',
    '/recruit-stylist-ginza',
    '/recruit-stylist-sapporo',
    '/recruit-stylist-osaka',
    '/recruit-stylist-nagoya',
    '/recruit-stylist-fukuoka',
    '/recruit-spanist-ginza',
    '/recruit-spanist-osaka',
    '/recruit-spanist-nagoya',
    '/recruit-assistant-fukuoka',
    '/recruit-shopmanager-ginza',
    '/recruit-shopmanager-omotesando',
    '/recruit-shopmanager-sapporo',
    '/recruit-parttime-ginza',
    '/recruit-parttime-omotesando'];
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
  // ── sitemapに言語版の相互リンク(xhtml:link)を入れる ──
  // 【なぜ要るか】2026-08-09の実測で、sitemapに載せた en/zh/tw/ko 各33ページのうち
  // 索引に入っていたのは合計9ページだけだった(zhとkoはトップ1枚のみ)。HTML側のhreflangは
  // 全ページに正しく入っているのに読まれていない。sitemapにも同じ組を書くと、
  // 「この5本は同じページの言語違い」とまとめて認識され、1本見つかれば残りも辿られる。
  // hreflangは相互申告が必須なので、ja側にも同じ組を書く(片側だけだと無視される)。
  const HREF = { ja: 'ja', en: 'en', zh: 'zh-Hans', tw: 'zh-Hant', ko: 'ko' };
  function altsFor(u) {
    // u は ja の絶対パス(/headspa 等)。言語版が実在するものだけ組にする
    const pg = PAGES.find(p => (p.url === '/' ? '/' : p.url) === u);
    if (!pg) return null;                       // 多言語対象外(ジャーナル等)は単独のまま
    const set = [['ja', BASE + u]];
    for (const lang of Object.keys(LANGS)) {
      if (!fs.existsSync(path.join(ROOT, lang, pg.file))) continue;
      set.push([HREF[lang], BASE + '/' + lang + (pg.url === '/' ? '/' : pg.url)]);
    }
    if (set.length < 2) return null;            // 訳が1本も無ければ組にしない
    set.push(['x-default', BASE + u]);
    return set;
  }
  // 言語版URLからja側のパスを引く(同じ組を全言語のエントリに書くため)
  function jaPathOf(u) {
    const m = /^\/(en|zh|tw|ko)(\/.*)$/.exec(u);
    if (!m) return u;
    return m[2] === '/' ? '/' : m[2];
  }
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n' +
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
    urls.map(u => {
      const set = altsFor(jaPathOf(u));
      if (!set) return '  <url><loc>' + BASE + u + '</loc></url>';
      const links = set.map(([h, href]) =>
        '\n    <xhtml:link rel="alternate" hreflang="' + h + '" href="' + href + '"/>').join('');
      return '  <url><loc>' + BASE + u + '</loc>' + links + '\n  </url>';
    }).join('\n') +
    '\n</urlset>\n';
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf-8');
  const withAlts = urls.filter(u => altsFor(jaPathOf(u))).length;
  summary.push(`sitemap.xml urls=${urls.length} (言語版の組つき ${withAlts})`);

  console.log(summary.join('\n'));
}

build();

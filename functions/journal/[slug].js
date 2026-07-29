// SEAM 読みもの(ブログ) — D1の記事を /journal/<slug> でサーバレンダリングする
// 静的な guide-*.html と同じ誌面(白背景・句点なしの家風)に流し込む。
// 本文はプレーンテキスト前提で全文エスケープ(書き手を信用しつつ事故を防ぐ)。
//   空行     → 段落
//   行内改行 → <br>
//   行頭「## 」→ 見出し(h2) / 行頭「・」→ そのまま(リスト風の見た目は本文側で)
// ビルド不要で記事が増やせる=「どんどん溜めていく」ためのルート。

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBody(body) {
  const blocks = String(body).replace(/\r\n/g, '\n').split(/\n{2,}/);
  return blocks.map(b => {
    const t = b.trim();
    if (!t) return '';
    if (t.startsWith('## ')) {
      return '<h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">' + esc(t.slice(3)) + '</h2>';
    }
    return '<p class="mt-4 text-[13.5px] sm:text-[14px] text-charcoal/80">' +
      t.split('\n').map(esc).join('<br>\n      ') + '</p>';
  }).join('\n    ');
}

function fmtDate(ts) {
  try {
    const d = new Date(ts);
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  } catch (e) { return ''; }
}

export async function onRequestGet(context) {
  const { params, env, request } = context;
  const slug = String(params.slug || '').toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{2,59}$/.test(slug)) {
    return new Response('not found', { status: 404 });
  }
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return new Response('not found', { status: 404 });
  }
  let row = null;
  try {
    row = await env.DB.prepare(
      'SELECT * FROM journal_posts WHERE slug = ? AND published = 1'
    ).bind(slug).first();
  } catch (e) { row = null; }
  if (!row) return new Response('記事が見つかりません', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

  const title = esc(row.title);
  const desc = esc(row.description || row.title);
  const eyebrow = esc(row.eyebrow || 'Journal');
  const author = esc(row.author || '');
  const date = fmtDate(row.created_at);
  const canonical = 'https://seam.site/journal/' + slug;
  // OG画像: 記事のヒーローがあればそれ(同一オリジンimages/のみ保存時に検証済み)
  const og = row.hero_image ? ('https://seam.site/' + esc(row.hero_image)) : 'https://seam.site/images/og/seam-og.jpg';
  const hero = row.hero_image
    ? '<img src="/' + esc(row.hero_image) + '" alt="" width="1200" height="800" fetchpriority="high" class="mt-8 w-full h-auto rounded-[3px]">'
    : '';
  const bodyHtml = renderBody(row.body);

  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'Organization', '@id': 'https://seam.site/#organization', name: 'SEAM', url: 'https://seam.site/', logo: 'https://seam.site/images/apple-touch-icon.png', sameAs: ['https://www.instagram.com/seam_japan'] },
      { '@type': 'Article', headline: row.title, description: row.description || row.title, inLanguage: 'ja', datePublished: new Date(row.created_at).toISOString(), dateModified: new Date(row.updated_at).toISOString(), mainEntityOfPage: canonical, image: og, author: { '@id': 'https://seam.site/#organization' }, publisher: { '@id': 'https://seam.site/#organization' } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'ホーム', item: 'https://seam.site/' },
        { '@type': 'ListItem', position: 2, name: '髪の読みもの', item: 'https://seam.site/journal' },
        { '@type': 'ListItem', position: 3, name: row.title, item: canonical } ] }
    ]
  });

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>${title} | SEAM 髪の読みもの</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="${canonical}">
  <meta property="og:site_name" content="SEAM">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${title} | SEAM">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${og}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="${og}">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="apple-touch-icon" href="/images/apple-touch-icon.png">
  <link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Noto+Serif+JP:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/tailwind.css">
  <script type="application/ld+json">${ld}</script>
</head>
<body class="bg-white text-ink antialiased">

  <header class="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-line">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
      <a href="/index.html" class="wm text-[19px] text-ink" aria-label="SEAM ホーム">SEAM</a>
      <nav class="flex items-center gap-5 text-[12px] text-charcoal/80">
        <a href="/journal.html" class="hover:text-ink">読みもの</a>
        <a href="/finder.html" class="hover:text-ink">髪格診断</a>
      </nav>
    </div>
  </header>

  <article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
    <nav class="font-mono tracking-widest2 text-[10px] text-charcoal/50 uppercase mb-6">
      <a href="/journal.html" class="hover:text-ink">Journal</a> <span class="mx-1">/</span> ${eyebrow}
    </nav>
    <h1 class="font-serif text-[27px] sm:text-[34px] leading-[1.4] text-ink font-medium">${title}</h1>
    <p class="mt-3 font-mono tracking-widest2 text-[10px] text-charcoal/45 uppercase">${date}${author ? ' · ' + author : ''}</p>
    ${hero}
    ${bodyHtml}

    <div class="mt-12 rounded-[4px] bg-cream/60 border border-line px-6 py-9 text-center">
      <p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Hair Finder</p>
      <h3 class="font-serif text-[19px] sm:text-[22px] text-ink leading-snug">あなたの髪に合う一本を</h3>
      <p class="mt-4 text-[12.5px] sm:text-[13.5px] text-charcoal/75 max-w-sm mx-auto">髪の太さ・量・くせから 27タイプの髪格を導き 今のあなたに合う3〜5本をご提案します</p>
      <a href="/finder.html" class="mt-6 inline-flex items-center justify-center gap-3 px-7 py-3.5 text-white font-serif text-[14.5px] rounded-full shadow-card" style="background:#B57C5A;letter-spacing:.02em;">
        <span>髪格診断をはじめる</span><span class="inline-flex items-center justify-center w-8 h-8 rounded-full" style="background:#fff;color:#B57C5A;">→</span>
      </a>
    </div>

    <div class="mt-12 flex items-center justify-between text-[12px] text-charcoal/60">
      <a href="/journal.html" class="hover:text-ink">← 読みもの一覧</a>
      <a href="/finder.html" class="hover:text-ink">髪格診断 →</a>
    </div>
  </article>

  <footer class="border-t border-line mt-12">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
      <a href="/index.html" class="wm text-[16px] text-ink">SEAM</a>
      <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-charcoal/70">
        <a href="/finder.html" class="hover:text-ink">髪格診断</a>
        <a href="/headspa.html" class="hover:text-ink">ヘッドスパ</a>
        <a href="/shop.html" class="hover:text-ink">店舗</a>
        <a href="/brand.html" class="hover:text-ink">取扱ブランド</a>
      </nav>
      <p class="font-mono text-[10px] tracking-widest2 uppercase text-charcoal/40">© SEAM</p>
    </div>
  <p class="legal-links" style="margin:8px auto 0;text-align:center;font-size:10.5px;line-height:1.8;color:rgba(58,50,42,.62);max-width:720px;padding:0 20px;"><a href="/terms.html" style="text-decoration:underline;">利用規約</a>　<a href="/privacy.html" style="text-decoration:underline;">プライバシーポリシー</a>　<a href="/tokushoho.html" style="text-decoration:underline;">特定商取引法に基づく表記</a></p>
</footer>

  <script src="/js/seam-analytics.js?v=7" defer></script>
  <script>window.addEventListener('load',function(){try{window.seamTrack&&seamTrack('guide_view',{p:location.pathname})}catch(e){}});</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // 更新から最大60秒で反映(記事は頻繁に変わらないのでD1保護を優先)
      'cache-control': 'public, max-age=60, s-maxage=60'
    }
  });
}

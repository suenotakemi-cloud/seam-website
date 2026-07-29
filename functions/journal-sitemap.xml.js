// /journal-sitemap.xml — D1保存の読みもの記事だけのサイトマップ(静的sitemap.xmlと併走)
// robots.txt の Sitemap: 行から参照。記事0本でも空のurlsetを返す(=常に有効なXML)。

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function onRequestGet(context) {
  const { env } = context;
  let rows = [];
  if (env.DB && typeof env.DB.prepare === 'function') {
    try {
      const r = await env.DB.prepare(
        'SELECT slug, updated_at FROM journal_posts WHERE published = 1 ORDER BY created_at DESC LIMIT 500'
      ).all();
      rows = (r && r.results) || [];
    } catch (e) { rows = []; }
  }
  const urls = rows.map(p => {
    const lastmod = new Date(p.updated_at || Date.now()).toISOString().slice(0, 10);
    return '  <url>\n    <loc>https://seam.site/journal/' + esc(p.slug) + '</loc>\n' +
      '    <lastmod>' + lastmod + '</lastmod>\n  </url>';
  }).join('\n');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n';
  return new Response(xml, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=600, s-maxage=600'
    }
  });
}

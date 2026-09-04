// 商品画像の配信: GET /pim-img/products/<account_id>/<jan>/<slot>.webp  → R2 "PRODUCT_IMAGES" から返す
//   出力CSVに載る画像URLはこれ。EC側が読みに来るので合言葉は要らない（商品写真は公開情報）。
//   URL には ?v=保存時刻 が付くので長期キャッシュにしてよい。
export async function onRequestGet({ request, env, params }) {
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const key = parts.join('/');
  if (!/^products\/\d{1,10}\/\d{8,14}\/[1-5]\.webp$/.test(key)) return new Response('Not found', { status: 404 });
  if (!env.PRODUCT_IMAGES || typeof env.PRODUCT_IMAGES.get !== 'function') return new Response('Image store not configured', { status: 503 });
  const obj = await env.PRODUCT_IMAGES.get(key);
  if (!obj) return new Response('Not found', { status: 404 });
  const etag = obj.httpEtag;
  if (etag && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { etag } });
  const h = new Headers();
  h.set('content-type', 'image/webp');
  h.set('cache-control', 'public, max-age=31536000, immutable');
  h.set('access-control-allow-origin', '*');
  if (etag) h.set('etag', etag);
  return new Response(obj.body, { headers: h });
}

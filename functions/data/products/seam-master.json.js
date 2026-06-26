/*
 * SEAM — 商品DB(seam-master.json)の直リク・スクレイプ抑止ゲート
 * - seam.site / プレビュー(*.pages.dev / localhost)からの同一オリジン fetch は許可し next() で静的JSONを配信
 * - Referer も Sec-Fetch も無い bare curl / python-requests 等は 403
 * - Referrer-Policy は strict-origin-when-cross-origin のため同一オリジンfetchは必ずRefererを送る＝実ブラウザは誤遮断しない
 * 注: スプーフ(Referer偽装)で回避は可能＝あくまで「lazyな一発スクレイプのコストを上げる」措置
 */
export async function onRequest(context) {
  const { request, next } = context;
  const ref = (request.headers.get('Referer') || '').toLowerCase();
  const origin = (request.headers.get('Origin') || '').toLowerCase();
  const sfs = request.headers.get('Sec-Fetch-Site'); // same-origin | same-site | cross-site | none | null

  const ALLOW_HOSTS = ['seam.site', 'localhost', '127.0.0.1', '.pages.dev'];
  const hostMatch = (s) => !!s && ALLOW_HOSTS.some((h) => s.includes(h));

  const allow =
    sfs === 'same-origin' ||
    sfs === 'same-site' ||
    hostMatch(ref) ||
    hostMatch(origin);

  if (!allow) {
    return new Response(
      'Forbidden — direct access to this data is not permitted. See Terms: https://seam.site/terms',
      {
        status: 403,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'no-store',
          'x-seam-guard': 'product-db',
        },
      }
    );
  }

  return next();
}

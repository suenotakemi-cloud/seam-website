/**
 * SEAM 銀座 — Square 決済バックエンド（Cloudflare Worker）
 *
 * 役割: フロント(pay.html)が作ったカードトークンを受け取り、Square Payments API で実際に課金する。
 *       Access Token（秘密鍵）はここ(サーバー側)だけで使う。フロントには絶対に置かない。
 *
 * 必要なシークレット / 変数（wrangler で設定。README.md 参照）:
 *   SQUARE_ACCESS_TOKEN  … Square Developer の Access Token（秘密）. `wrangler secret put SQUARE_ACCESS_TOKEN`
 *   SQUARE_ENV           … 'sandbox' か 'production'（wrangler.toml の [vars]）
 *   ALLOW_ORIGIN         … 決済フォームを置くオリジン（CORS許可）例) https://booking.seam.site  ※未設定なら '*'
 */

const SQUARE_VERSION = '2025-01-23'; // 必要に応じて最新版に更新

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.endsWith('/pay')) {
      return json({ error: 'Not found' }, 404, cors);
    }
    if (!env.SQUARE_ACCESS_TOKEN) {
      return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
    }

    let payload;
    try { payload = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
    const { sourceId, verificationToken, amount, currency } = payload || {};
    if (!sourceId || !amount) return json({ error: 'sourceId と amount は必須です' }, 400, cors);

    const base = (env.SQUARE_ENV === 'production')
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';

    const body = {
      source_id: sourceId,
      idempotency_key: crypto.randomUUID(),
      amount_money: { amount: Math.round(amount), currency: currency || 'JPY' }, // JPYは最小単位=円
    };
    if (verificationToken) body.verification_token = verificationToken; // 3DSの結果

    let sq;
    try {
      const r = await fetch(base + '/v2/payments', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + env.SQUARE_ACCESS_TOKEN,
          'Square-Version': SQUARE_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      sq = await r.json();
      if (!r.ok) {
        const msg = (sq.errors && sq.errors[0] && sq.errors[0].detail) || ('Square API ' + r.status);
        return json({ error: msg }, 502, cors);
      }
    } catch (e) {
      return json({ error: 'Square API 呼び出しに失敗: ' + e.message }, 502, cors);
    }

    return json({
      ok: true,
      paymentId: sq.payment && sq.payment.id,
      status: sq.payment && sq.payment.status,
    }, 200, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(cors || {}) },
  });
}

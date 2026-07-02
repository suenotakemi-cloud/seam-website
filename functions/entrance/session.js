// SEAM 入場受付 — ログインセッション発行（Cloudflare Pages Function）
// ルート: POST /entrance/session
// Body: { mail: "xxx", pass: "xxx" }
//   →  { ok: true, uid: "xxx", token: "xxx", name: "SEAM銀座QR受付", shop_id: "xxx" }
//   →  { ok: false, reason: "invalid_credentials" }
//
// salon.town の /login をサーバーサイドで呼び出し、パスワードはレスポンスに含めない。
// CORS は seam.site のみ許可（開発中は localhost も許可）。

const ALLOWED_ORIGINS = [
  'https://seam.site',
  'https://www.seam.site',
];

function corsHeaders(origin) {
  const allowed =
    ALLOWED_ORIGINS.includes(origin) ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin)
      ? origin
      : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

// プリフライト
export async function onRequestOptions(context) {
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

export async function onRequestPost(context) {
  const { request } = context;
  const origin = request.headers.get('Origin') || '';
  const cors = corsHeaders(origin);

  const H = {
    ...cors,
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return J({ ok: false, reason: 'bad_request' }, H, 400);
    }

    const mail = (body.mail || '').trim();
    const pass = (body.pass || '').trim();

    if (!mail || !pass) {
      return J({ ok: false, reason: 'missing_fields' }, H, 400);
    }

    const base = 'https://seam.salon.town';
    const r = await fetch(base + '/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mail, pass }),
    });

    const j = await r.json().catch(() => ({}));

    // salon.town の成功レスポンス: { result: true, data: { id, token, name, shop_id, ... } }
    if (!j || !j.result || !j.data || !j.data.token) {
      return J({ ok: false, reason: 'invalid_credentials' }, H, 401);
    }

    const { id, token, name, shop_id } = j.data;

    return J(
      {
        ok: true,
        uid:     String(id    || ''),
        token:   String(token || ''),
        name:    String(name  || ''),
        shop_id: String(shop_id || ''),
      },
      H,
    );

  } catch (e) {
    return J({ ok: false, reason: 'error' }, H, 500);
  }
}

function J(o, h, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: h });
}

// SEAM 入場受付 — 会員名ルックアップ（Cloudflare Pages Function）
// ルート: GET /entrance/lookup?code=<account_id>&token=<salon_token>&uid=<salon_user_id>
//   →  { ok: true, name: "山田" }（姓のみ）
//   →  { ok: false, reason: "no_auth" }  ← token/uid 未指定時
//   →  { ok: false, reason: "not_found" }
//
// セッショントークンはフロントエンドから毎回渡す方式（環境変数ログイン情報なし）。
// D1キャッシュは不要。

export async function onRequestGet(context) {
  const { request } = context;
  const H = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  try {
    const url = new URL(request.url);
    const code  = (url.searchParams.get('code')  || '').trim().slice(0, 128);
    const token = (url.searchParams.get('token') || '').trim();
    const uid   = (url.searchParams.get('uid')   || '').trim();

    if (!code)          return J({ ok: false, reason: 'no_code' }, H, 400);
    if (!token || !uid) return J({ ok: false, reason: 'no_auth' }, H, 401);

    const base = 'https://seam.salon.town';

    const name = await fetchName(base, { token, user_id: uid }, code);
    if (name) return J({ ok: true, name: surname(name).slice(0, 20) }, H);
    return J({ ok: false, reason: 'not_found' }, H);

  } catch (e) {
    return J({ ok: false, reason: 'error' }, H, 500);
  }
}

// ── account_id → 氏名 ──
async function fetchName(base, sess, code) {
  const r = await fetch(base + '/get/account', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      user_id: sess.user_id,
      token: sess.token,
      filter: { account_id: code },
      is_all: true,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (j && j.result && Array.isArray(j.data) && j.data[0] && j.data[0].name) {
    return String(j.data[0].name);
  }
  return '';
}

function surname(name) {
  return String(name).trim().split(/[\s　]+/)[0] || '';
}

function J(o, h, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: h });
}

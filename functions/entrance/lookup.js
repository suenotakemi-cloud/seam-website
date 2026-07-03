// SEAM 入場受付 — 会員名ルックアップ（Cloudflare Pages Function）
// ルート: GET /entrance/lookup?code=<account_id>&token=<salon_token>&uid=<salon_user_id>
//   →  { ok: true, name: "山田" }（姓のみ）
//   →  { ok: false, reason: "no_auth"  }  ← token/uid 未指定 or token失効（再ログインが必要）
//   →  { ok: false, reason: "error"    }  ← salon APIに到達不可 / 5xx（通信・システム側の問題）
//   →  { ok: false, reason: "not_found" } ← セッションは有効だが該当会員なし（＝本当に非会員）
//
// ★ reason を厳密に分けるのが肝。フロントは error/no_auth のとき「会員を弾く」画面を出さず、
//   通信やtoken失効を会員本人のせいにしない（本物のVIP会員を万引き犯扱いする事故の防止）。
//
// セッショントークンはフロントエンドから毎回渡す方式（環境変数ログイン情報なし）。

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

    const r = await lookup(base, { token, user_id: uid }, code);
    if (r.name) return J({ ok: true, name: surname(r.name).slice(0, 20) }, H);
    return J({ ok: false, reason: r.reason || 'not_found' }, H, r.reason === 'error' ? 502 : 200);

  } catch (e) {
    return J({ ok: false, reason: 'error' }, H, 500);
  }
}

// ── account_id → { name } または { reason } ──
async function lookup(base, sess, code) {
  let r;
  try {
    r = await fetch(base + '/get/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_id: sess.user_id,
        token: sess.token,
        filter: { account_id: code },
        is_all: true,
      }),
    });
  } catch (e) {
    return { reason: 'error' };            // salon APIに到達できない（ネットワーク断など）
  }
  if (!r.ok) return { reason: 'error' };    // 5xx 等はシステム側の問題

  const j = await r.json().catch(() => ({}));
  if (j && j.result && Array.isArray(j.data) && j.data[0] && j.data[0].name) {
    return { name: String(j.data[0].name) };
  }
  // token失効・無効ユーザー → 再ログインが必要（会員が存在しないのとは別物）
  if (j && j.result === false && (j.error === 1002 || /NOT FOUND USER/i.test(j.msg || ''))) {
    return { reason: 'no_auth' };
  }
  return { reason: 'not_found' };           // セッションは有効だが該当なし＝本当に非会員
}

function surname(name) {
  return String(name).trim().split(/[\s　]+/)[0] || '';
}

function J(o, h, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: h });
}

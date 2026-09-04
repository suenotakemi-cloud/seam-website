// /api/pim/* 共通の関所
//   /api/pim/auth/login          … 誰でも（ID + パスワード）
//   /api/pim/admin/*             … SEAM 管理（ADMIN_KEY）
//   それ以外                     … ディーラーのトークン（x-seam-token）
//                                  または ADMIN_KEY + x-seam-account: <login_id>（そのディーラーとして操作）
//   通ったら context.data.account に { id, login_id, name, role, token_version } を入れる
import { json, hasDb, hasR2, ensureSchema, verifyToken } from './_lib.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const path = new URL(request.url).pathname.replace(/\/+$/, '');
  if (!hasDb(env)) return json({ ok: false, reason: 'no_db', configured: false, r2: hasR2(env) }, 503);
  try { await ensureSchema(env); } catch (e) { return json({ ok: false, reason: 'schema_error', error: String(e && e.message || e) }, 500); }

  const adminKey = ((env && env.ADMIN_KEY) || '').trim();
  const givenKey = (request.headers.get('x-seam-key') || '').trim();
  const isAdmin = !!adminKey && !!givenKey && givenKey === adminKey;

  if (path.endsWith('/auth/login')) return next();
  if (path.indexOf('/api/pim/admin/') >= 0) {
    if (!isAdmin) return json({ ok: false, reason: 'unauthorized', keyConfigured: !!adminKey, admin: true }, 401);
    context.data.isAdmin = true;
    return next();
  }

  // ディーラーのトークン
  const token = (request.headers.get('x-seam-token') || '').trim();
  let account = null;
  if (token) {
    const t = await verifyToken(env, token);
    if (t) {
      const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE id=?').bind(t.id).first();
      if (a && a.active && a.token_version === t.ver) account = a;
      else if (a && !a.active) return json({ ok: false, reason: 'account_disabled', message: 'このアカウントは停止されています。SEAM にお問い合わせください' }, 401);
      else return json({ ok: false, reason: 'token_expired', message: 'パスワードが変更されたか、ログインの期限が切れました。もう一度ログインしてください' }, 401);
    }
  }
  // 管理者が特定ディーラーとして操作（EC 連携・代行）
  if (!account && isAdmin) {
    const lid = (request.headers.get('x-seam-account') || new URL(request.url).searchParams.get('account') || '').trim().toLowerCase();
    if (lid) {
      const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE login_id=?').bind(lid).first();
      if (!a) return json({ ok: false, reason: 'no_account', message: 'アカウント ' + lid + ' がありません' }, 404);
      account = a; context.data.isAdmin = true;
    } else return json({ ok: false, reason: 'need_account', message: '管理キーで商品を扱うには x-seam-account（ディーラーの ID）が必要です' }, 400);
  }
  if (!account) return json({ ok: false, reason: 'unauthorized', keyConfigured: !!adminKey }, 401);
  context.data.account = account;
  return next();
}

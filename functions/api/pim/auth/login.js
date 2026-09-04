// POST /api/pim/auth/login  { login_id, password }  → { token, account }
//   1ディーラー1アカウント。スタッフは同じ ID を共用し、端末ごとに「担当者名」を名乗る。
//   失敗が続いたら 15 分ロック（総当たり対策）。
import { json, verifyPassword, signToken, publicAccount, normalizeLoginId, nowIso, secretConfigured } from '../_lib.js';

const MAX_FAIL = 10, LOCK_MIN = 15;

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const lid = normalizeLoginId(b.login_id);
  const pw = String(b.password || '');
  if (!lid || !pw) return json({ ok: false, reason: 'missing', message: 'ID とパスワードを入れてください' }, 400);
  if (!secretConfigured(env)) return json({ ok: false, reason: 'no_secret', message: 'サーバの設定が足りません（Cloudflare の環境変数 ADMIN_KEY または PIM_SECRET）。db/SETUP_PIM.md を参照' }, 503);

  // ロック確認（ID + 接続元IP で数える。よそから間違いを連打されても、社内の正しいスタッフまで締め出されないように）
  const ip = (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64);
  const lockKey = lid + '@' + ip;
  const f = await env.DB.prepare('SELECT count, last_at FROM pim_login_fail WHERE login_id=?').bind(lockKey).first();
  if (f && f.count >= MAX_FAIL && f.last_at && Date.now() - Date.parse(f.last_at) < LOCK_MIN * 60000) {
    return json({ ok: false, reason: 'locked', message: '失敗が続いたため ' + LOCK_MIN + ' 分ほどロックしています。しばらくしてからお試しください' }, 429);
  }
  const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE login_id=?').bind(lid).first();
  const okPw = a ? await verifyPassword(pw, a.pass_hash) : await verifyPassword(pw, 'pbkdf2$30000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='); // 無い ID でも同じ時間をかける
  if (!a || !okPw) {
    await env.DB.prepare('INSERT INTO pim_login_fail(login_id, count, last_at) VALUES(?, 1, ?) ON CONFLICT(login_id) DO UPDATE SET count=count+1, last_at=excluded.last_at').bind(lockKey, nowIso()).run();
    return json({ ok: false, reason: 'bad_credentials', message: 'ID かパスワードが違います' }, 401);
  }
  if (!a.active) return json({ ok: false, reason: 'account_disabled', message: 'このアカウントは停止されています。SEAM にお問い合わせください' }, 403);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pim_login_fail WHERE login_id=? OR login_id LIKE ?').bind(lockKey, lid + '@%'),
    env.DB.prepare('UPDATE pim_accounts SET last_login_at=? WHERE id=?').bind(nowIso(), a.id),
  ]);
  const token = await signToken(env, a.id, a.token_version);
  return json({ ok: true, token, account: publicAccount(a) });
}

// POST /api/pim/auth/password { current, password } → { token }
//   ディーラー自身がパスワードを変える（スタッフが辞めたときなど）。
//   token_version を進めるので、それまでのトークンは全端末で無効になる。呼び出した端末には新しいトークンを返す。
import { json, verifyPassword, hashPassword, passwordProblem, signToken, nowIso } from '../_lib.js';

export async function onRequestPost({ request, env, data }) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const a = data.account;
  if (data.isAdmin && !(request.headers.get('x-seam-token') || '').trim()) {
    return json({ ok: false, reason: 'use_admin', message: '管理キーからの変更は /api/pim/admin/accounts の reset を使ってください' }, 400);
  }
  if (!(await verifyPassword(String(b.current || ''), a.pass_hash))) return json({ ok: false, reason: 'bad_current', message: '今のパスワードが違います' }, 401);
  const prob = passwordProblem(b.password);
  if (prob) return json({ ok: false, reason: 'weak', message: prob }, 400);
  if (String(b.password) === String(b.current)) return json({ ok: false, reason: 'same', message: '今と同じパスワードです' }, 400);
  const hash = await hashPassword(String(b.password));
  const ver = (a.token_version || 1) + 1;
  await env.DB.prepare('UPDATE pim_accounts SET pass_hash=?, token_version=?, pass_changed_at=?, updated_at=? WHERE id=?').bind(hash, ver, nowIso(), nowIso(), a.id).run();
  const token = await signToken(env, a.id, ver);
  return json({ ok: true, token, message: 'パスワードを変えました。ほかの端末はログインし直しが必要です' });
}

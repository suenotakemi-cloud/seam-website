// SEAM 管理（ADMIN_KEY）— ディーラーアカウントの発行・管理
//   GET  /api/pim/admin/accounts                  → 一覧（商品数・写真あり数つき）
//   POST /api/pim/admin/accounts { action, ... }
//        create     { login_id, name, password, note }   … 発行
//        reset      { id, password }                     … パスワード再設定（全端末ログアウト）
//        disable    { id } / enable { id }               … 停止 / 再開（停止中はログイン不可・トークンも無効）
//        rename     { id, name, note }
//        logout_all { id }                               … パスワードはそのまま、全端末を強制ログアウト
import { json, hashPassword, passwordProblem, normalizeLoginId, publicAccount, nowIso } from '../_lib.js';

export async function onRequestGet({ env }) {
  const rs = await env.DB.prepare(
    'SELECT a.*, ' +
    '(SELECT COUNT(*) FROM pim_products p WHERE p.account_id=a.id) AS products, ' +
    '(SELECT COUNT(*) FROM pim_products p WHERE p.account_id=a.id AND p.image_count>0) AS with_images, ' +
    '(SELECT COUNT(*) FROM pim_issues i WHERE i.account_id=a.id AND i.status=\'open\') AS open_issues ' +
    'FROM pim_accounts a ORDER BY a.id'
  ).all();
  return json({ ok: true, accounts: (rs.results || []).map((a) => Object.assign(publicAccount(a), { note: a.note, products: a.products, with_images: a.with_images, open_issues: a.open_issues })) });
}

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const action = String(b.action || '');
  const ts = nowIso();

  if (action === 'create') {
    const lid = normalizeLoginId(b.login_id);
    const name = String(b.name || '').trim().slice(0, 100);
    if (!lid || lid.length < 3) return json({ ok: false, reason: 'bad_login_id', message: 'ID は英数字 3 文字以上（使える記号: . _ @ -）' }, 400);
    if (!name) return json({ ok: false, reason: 'no_name', message: 'ディーラー名を入れてください' }, 400);
    const prob = passwordProblem(b.password);
    if (prob) return json({ ok: false, reason: 'weak', message: prob }, 400);
    const dup = await env.DB.prepare('SELECT id FROM pim_accounts WHERE login_id=?').bind(lid).first();
    if (dup) return json({ ok: false, reason: 'exists', message: 'この ID は既に使われています' }, 409);
    const hash = await hashPassword(String(b.password));
    const r = await env.DB.prepare('INSERT INTO pim_accounts(login_id, name, pass_hash, role, active, token_version, note, created_at, updated_at, pass_changed_at) VALUES(?,?,?,?,1,1,?,?,?,?)')
      .bind(lid, name, hash, 'dealer', String(b.note || '').slice(0, 500), ts, ts, ts).run();
    const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE id=?').bind(r.meta.last_row_id).first();
    return json({ ok: true, account: publicAccount(a) });
  }

  const id = parseInt(b.id, 10);
  if (!id) return json({ ok: false, reason: 'no_id' }, 400);
  const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE id=?').bind(id).first();
  if (!a) return json({ ok: false, reason: 'not_found' }, 404);

  if (action === 'reset') {
    const prob = passwordProblem(b.password);
    if (prob) return json({ ok: false, reason: 'weak', message: prob }, 400);
    const hash = await hashPassword(String(b.password));
    await env.DB.prepare('UPDATE pim_accounts SET pass_hash=?, token_version=token_version+1, pass_changed_at=?, updated_at=? WHERE id=?').bind(hash, ts, ts, id).run();
    await env.DB.prepare('DELETE FROM pim_login_fail WHERE login_id=?').bind(a.login_id).run();
    return json({ ok: true, message: 'パスワードを再設定しました。全端末で再ログインが必要です' });
  }
  if (action === 'logout_all') {
    await env.DB.prepare('UPDATE pim_accounts SET token_version=token_version+1, updated_at=? WHERE id=?').bind(ts, id).run();
    return json({ ok: true, message: '全端末をログアウトしました' });
  }
  if (action === 'disable' || action === 'enable') {
    await env.DB.prepare('UPDATE pim_accounts SET active=?, token_version=token_version+1, updated_at=? WHERE id=?').bind(action === 'enable' ? 1 : 0, ts, id).run();
    return json({ ok: true, message: action === 'enable' ? '再開しました' : '停止しました（ログイン不可・全端末ログアウト）' });
  }
  if (action === 'rename') {
    const name = String(b.name == null ? a.name : b.name).trim().slice(0, 100) || a.name;
    await env.DB.prepare('UPDATE pim_accounts SET name=?, note=?, updated_at=? WHERE id=?').bind(name, String(b.note == null ? (a.note || '') : b.note).slice(0, 500), ts, id).run();
    return json({ ok: true });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

// SEAM 管理（ADMIN_KEY）— ディーラーアカウントの発行・管理
//   GET  /api/pim/admin/accounts                  → 一覧（商品数・写真あり数つき）
//   POST /api/pim/admin/accounts { action, ... }
//        create     { login_id, name, password, note }   … 発行
//        reset      { id, password }                     … パスワード再設定（全端末ログアウト）
//        disable    { id } / enable { id }               … 停止 / 再開（停止中はログイン不可・トークンも無効）
//        rename     { id, name, note }
//        logout_all { id }                               … パスワードはそのまま、全端末を強制ログアウト
//        api_key    { id }  / api_key_revoke { id }       … EC 連携用の読み取り専用キーを発行（再発行で古いものは無効）/ 無効化
//        webhook    { id, url }                          … 変更を EC 側へ push する URL（https）。署名用の秘密を返す（再設定で秘密も変わる）
//        webhook_clear { id } / webhook_test { id }      … 解除 / テスト送信（結果を返す）
//        ec_key     { id, key, url } / ec_clear { id } / ec_test { id }
//                                                        … SalonPro（EC）へ写真を送るキーを代わりに設定する（ディーラーが PC を触れないとき）
import { json, hashPassword, passwordProblem, normalizeLoginId, publicAccount, nowIso, newApiKey, newWebhookSecret, notifyWebhook, webhookUrlOk } from '../_lib.js';
import { ecKeyOk, ecUrlOk, ecPing, EC_DEFAULT_URL } from '../_salonpro.js';

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

export async function onRequestPost(context) {
  const { request, env } = context;
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
    await env.DB.prepare('DELETE FROM pim_login_fail WHERE login_id=? OR login_id LIKE ?').bind(a.login_id, a.login_id + '@%').run();
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
  if (action === 'api_key') {
    const key = newApiKey();
    await env.DB.prepare('UPDATE pim_accounts SET api_key=?, updated_at=? WHERE id=?').bind(key, ts, id).run();
    return json({ ok: true, api_key: key, message: '連携キーを発行しました（この画面を閉じると再表示できません）' });
  }
  if (action === 'api_key_revoke') {
    await env.DB.prepare('UPDATE pim_accounts SET api_key=NULL, updated_at=? WHERE id=?').bind(ts, id).run();
    return json({ ok: true, message: '連携キーを無効にしました' });
  }
  if (action === 'webhook') {
    const url = String(b.url || '').trim().slice(0, 500);
    if (!webhookUrlOk(url)) return json({ ok: false, reason: 'bad_url', message: 'https:// で始まる URL を入れてください' }, 400);
    const secret = newWebhookSecret();
    await env.DB.prepare('UPDATE pim_accounts SET webhook_url=?, webhook_secret=?, webhook_last_at=NULL, webhook_last_status=NULL, updated_at=? WHERE id=?').bind(url, secret, ts, id).run();
    return json({ ok: true, webhook_url: url, webhook_secret: secret, message: 'Webhook を設定しました（署名の秘密はこの画面を閉じると再表示できません）' });
  }
  if (action === 'webhook_clear') {
    await env.DB.prepare('UPDATE pim_accounts SET webhook_url=NULL, webhook_secret=NULL, updated_at=? WHERE id=?').bind(ts, id).run();
    return json({ ok: true, message: 'Webhook を解除しました' });
  }
  if (action === 'webhook_test') {
    if (!a.webhook_url) return json({ ok: false, reason: 'no_webhook', message: 'Webhook が未設定です' }, 400);
    const status = await notifyWebhook(context, a, 'test', ['0000000000000'], 'admin');
    return json({ ok: true, status, message: '送信しました → 相手の応答: ' + status });
  }
  if (action === 'ec_key') {
    const key = String(b.key || '').trim();
    const url = (String(b.url || '').trim() || a.ec_url || EC_DEFAULT_URL).replace(/\/+$/, '');
    if (!ecKeyOk(key)) return json({ ok: false, reason: 'bad_key', message: 'SalonPro のキー（spk_ で始まる文字列）を入れてください' }, 400);
    if (!ecUrlOk(url)) return json({ ok: false, reason: 'bad_url', message: 'URL は https:// で始めてください' }, 400);
    await env.DB.prepare('UPDATE pim_accounts SET ec_key=?, ec_url=?, updated_at=? WHERE id=?').bind(key, url, ts, id).run();
    const ping = await ecPing({ ec_key: key, ec_url: url });
    return json({ ok: true, ping, message: '保存しました。' + ping.message });
  }
  if (action === 'ec_clear') {
    await env.DB.prepare('UPDATE pim_accounts SET ec_key=NULL, ec_auto=0, updated_at=? WHERE id=?').bind(ts, id).run();
    return json({ ok: true, message: 'SalonPro への送信を解除しました' });
  }
  if (action === 'ec_test') {
    if (!ecKeyOk(a.ec_key)) return json({ ok: false, reason: 'no_key', message: 'キーが未設定です' }, 400);
    const ping = await ecPing(a);
    return json({ ok: true, ping, message: ping.message });
  }
  if (action === 'clone_settings') { // 初期設定パック: 別のディーラー（例: 菊池）の 表記の辞書 をコピー（無いものだけ足す）
    const from = await env.DB.prepare('SELECT id, name FROM pim_accounts WHERE login_id=?').bind(String(b.from || '').trim().toLowerCase()).first();
    if (!from) return json({ ok: false, reason: 'no_from', message: 'コピー元のアカウントがありません' }, 404);
    const rows = await env.DB.prepare('SELECT kind, src, dst FROM pim_dict WHERE account_id=?').bind(from.id).all();
    let n = 0;
    for (const r of (rows.results || [])) { const q = await env.DB.prepare('INSERT OR IGNORE INTO pim_dict(account_id, kind, src, dst, created_at, created_by) VALUES(?,?,?,?,?,?)').bind(id, r.kind, r.src, r.dst, ts, 'ひな形: ' + from.name).run(); n += (q.meta && q.meta.changes) || 0; }
    return json({ ok: true, copied: n, message: '「' + from.name + '」の表記の辞書 ' + n + ' 件をコピーしました（写真ガイド・分類対応表は全ディーラー共通で最初から使えます）' });
  }
  if (action === 'rename') {
    const name = String(b.name == null ? a.name : b.name).trim().slice(0, 100) || a.name;
    await env.DB.prepare('UPDATE pim_accounts SET name=?, note=?, updated_at=? WHERE id=?').bind(name, String(b.note == null ? (a.note || '') : b.note).slice(0, 500), ts, id).run();
    return json({ ok: true });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

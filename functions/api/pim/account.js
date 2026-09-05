// ディーラー自身のアカウント設定（PC「設定」タブ。管理画面に頼らず自分で変えられるもの）
//   GET  /api/pim/account → { account:{…, report_emails, report_enabled, has_api_key, webhook_url, has_inbox_key}, inbox_url }
//   POST /api/pim/account { action, ... }
//        rename        { name }                          … ディーラー名
//        login_id      { login_id, password }            … ログイン ID の変更（今のパスワードで確認。全端末で再ログイン）
//        emails        { emails, report_enabled }        … 日報・通知メール（カンマ区切り・10 件まで）
//        api_key / api_key_revoke                        … EC 連携キー（読み取り専用）
//        webhook { url } / webhook_clear / webhook_test  … 変更の push 先
//        inbox_key / inbox_key_revoke                    … 自動取り込み用 URL の鍵（メール転送・共有フォルダの監視スクリプトから POST する）
//   連携キー・管理者の代行では変更不可（本人のトークンだけ）
import { json, nowIso, normalizeLoginId, verifyPassword, publicAccount, newApiKey, newWebhookSecret, webhookUrlOk, notifyWebhook, newInboxKey, parseEmails } from './_lib.js';

export async function onRequestGet({ request, env, data }) {
  const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE id=?').bind(data.account.id).first();
  const origin = new URL(request.url).origin;
  return json({ ok: true, account: publicAccount(a), inbox_url: a.inbox_key ? origin + '/api/pim/inbox?key=' + a.inbox_key : null, report_url: origin + '/api/pim/report' });
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  if (data.readonly || data.isAdmin) return json({ ok: false, reason: 'self_only', message: 'この設定はディーラー本人のログインでのみ変更できます' }, 403);
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const id = data.account.id, ts = nowIso(), action = String(b.action || '');
  const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE id=?').bind(id).first();
  const origin = new URL(request.url).origin;

  if (action === 'rename') {
    const name = String(b.name || '').trim().slice(0, 100);
    if (!name) return json({ ok: false, reason: 'no_name', message: 'ディーラー名を入れてください' }, 400);
    await env.DB.prepare('UPDATE pim_accounts SET name=?, updated_at=? WHERE id=?').bind(name, ts, id).run();
    return json({ ok: true, message: 'ディーラー名を変えました' });
  }
  if (action === 'login_id') {
    const lid = normalizeLoginId(b.login_id);
    if (!lid || lid.length < 3) return json({ ok: false, reason: 'bad_login_id', message: 'ID は英数字 3 文字以上（使える記号: . _ @ -）' }, 400);
    if (!(await verifyPassword(String(b.password || ''), a.pass_hash))) return json({ ok: false, reason: 'bad_password', message: '今のパスワードが違います' }, 403);
    if (lid === a.login_id) return json({ ok: true, message: '同じ ID です' });
    const dup = await env.DB.prepare('SELECT id FROM pim_accounts WHERE login_id=?').bind(lid).first();
    if (dup) return json({ ok: false, reason: 'exists', message: 'この ID は既に使われています' }, 409);
    await env.DB.prepare('UPDATE pim_accounts SET login_id=?, token_version=token_version+1, updated_at=? WHERE id=?').bind(lid, ts, id).run();
    return json({ ok: true, login_id: lid, message: 'ログイン ID を「' + lid + '」に変えました。全端末で新しい ID で再ログインしてください' });
  }
  if (action === 'emails') {
    const emails = parseEmails(b.emails);
    const enabled = b.report_enabled ? 1 : 0;
    if (enabled && !emails.length) return json({ ok: false, reason: 'no_emails', message: '日報を送るにはメールアドレスを 1 つ以上入れてください' }, 400);
    await env.DB.prepare('UPDATE pim_accounts SET report_emails=?, report_enabled=?, updated_at=? WHERE id=?').bind(emails.join(','), enabled, ts, id).run();
    return json({ ok: true, emails, report_enabled: !!enabled, message: emails.length ? 'メールアドレスを保存しました（' + emails.length + ' 件）' : 'メールアドレスを空にしました' });
  }
  if (action === 'api_key') {
    const key = newApiKey();
    await env.DB.prepare('UPDATE pim_accounts SET api_key=?, updated_at=? WHERE id=?').bind(key, ts, id).run();
    return json({ ok: true, api_key: key, export_url: origin + '/api/pim/export?format=source&api_key=' + key, message: '連携キーを発行しました（この画面を閉じると再表示できません）' });
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
    const status = await notifyWebhook(context, a, 'test', ['0000000000000'], data.account.name);
    return json({ ok: true, status, message: '送信しました → 相手の応答: ' + status });
  }
  if (action === 'inbox_key') {
    const key = newInboxKey();
    await env.DB.prepare('UPDATE pim_accounts SET inbox_key=?, updated_at=? WHERE id=?').bind(key, ts, id).run();
    return json({ ok: true, inbox_url: origin + '/api/pim/inbox?key=' + key, message: '自動取り込み用 URL を発行しました' });
  }
  if (action === 'inbox_key_revoke') {
    await env.DB.prepare('UPDATE pim_accounts SET inbox_key=NULL, updated_at=? WHERE id=?').bind(ts, id).run();
    return json({ ok: true, message: '自動取り込み用 URL を無効にしました' });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

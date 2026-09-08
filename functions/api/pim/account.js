// ディーラー自身のアカウント設定（PC「設定」タブ。管理画面に頼らず自分で変えられるもの）
//   GET  /api/pim/account → { account:{…, report_emails, report_enabled, has_api_key, webhook_url, has_inbox_key}, inbox_url }
//   POST /api/pim/account { action, ... }
//        rename        { name }                          … ディーラー名
//        login_id      { login_id, password }            … ログイン ID の変更（今のパスワードで確認。全端末で再ログイン）
//        emails        { emails, report_enabled }        … 日報・通知メール（カンマ区切り・10 件まで）
//        api_key / api_key_revoke                        … EC 連携キー（読み取り専用）
//        webhook { url } / webhook_clear / webhook_test  … 変更の push 先
//        inbox_key / inbox_key_revoke                    … 自動取り込み用 URL の鍵（メール転送・共有フォルダの監視スクリプトから POST する）
//        ec_key { key, url? } / ec_clear / ec_test / ec_auto { on }
//                                                        … SalonPro（EC）へ写真を送るキー。キーは保存後に画面へ出さない
//   連携キー・管理者の代行では変更不可（本人のトークンだけ）
import { json, nowIso, normalizeLoginId, verifyPassword, publicAccount, newApiKey, newWebhookSecret, webhookUrlOk, notifyWebhook, newInboxKey, parseEmails } from './_lib.js';
import { ecUrlOk, ecKeyOk, ecBase, ecPing, EC_DEFAULT_URL } from './_salonpro.js';

export async function onRequestGet({ request, env, data }) {
  if (data.readonly) return json({ ok: false, reason: 'readonly', message: '連携キーではアカウント設定を見られません' }, 403); // 自動取り込み用 URL が読み取り専用キーから漏れないように
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
  if (action === 'ec_key') {
    const key = String(b.key || '').trim();
    const url = String(b.url || '').trim() || (a.ec_url || EC_DEFAULT_URL);
    if (!ecKeyOk(key)) return json({ ok: false, reason: 'bad_key', message: 'SalonPro のキー（spk_ で始まる文字列）を入れてください' }, 400);
    if (!ecUrlOk(url)) return json({ ok: false, reason: 'bad_url', message: 'SalonPro の URL は https:// で始めてください' }, 400);
    await env.DB.prepare('UPDATE pim_accounts SET ec_key=?, ec_url=?, updated_at=? WHERE id=?').bind(key, url.replace(/\/+$/, ''), ts, id).run();
    const ping = await ecPing({ ec_key: key, ec_url: url });
    return json({ ok: true, ec_url: ecBase({ ec_url: url }), ping, message: 'SalonPro のキーを保存しました。' + ping.message });
  }
  if (action === 'ec_clear') {
    await env.DB.prepare('UPDATE pim_accounts SET ec_key=NULL, ec_auto=0, updated_at=? WHERE id=?').bind(ts, id).run();
    return json({ ok: true, message: 'SalonPro への送信を解除しました' });
  }
  if (action === 'ec_test') {
    if (!ecKeyOk(a.ec_key)) return json({ ok: false, reason: 'no_key', message: 'SalonPro のキーが未設定です' }, 400);
    const ping = await ecPing(a);
    return json({ ok: true, ping, message: ping.message });
  }
  if (action === 'ec_auto') {
    const on = b.on ? 1 : 0;
    if (on && !ecKeyOk(a.ec_key)) return json({ ok: false, reason: 'no_key', message: '先に SalonPro のキーを保存してください' }, 400);
    await env.DB.prepare('UPDATE pim_accounts SET ec_auto=?, updated_at=? WHERE id=?').bind(on, ts, id).run();
    return json({ ok: true, ec_auto: !!on, message: on ? '写真を撮ったら自動で SalonPro に送ります' : '自動送信をやめました（PC の「EC 送信」から送れます）' });
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

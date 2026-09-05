// GET /api/pim/status → 保存先の状態と件数（画面の初期表示・ログイン確認）。ログイン中のアカウントの分だけ
import { json, hasR2, publicAccount, imageStore } from './_lib.js';

export async function onRequestGet({ env, data }) {
  const acct = data.account.id;
  const c = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM pim_products WHERE account_id=?1) AS products, ' +
    '(SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count>0) AS with_images, ' +
    '(SELECT COUNT(*) FROM pim_images WHERE account_id=?1) AS images, ' +
    '(SELECT COUNT(*) FROM pim_issues WHERE account_id=?1 AND status=\'open\') AS open_issues'
  ).bind(acct).first();
  return json({ ok: true, configured: true, r2: hasR2(env), image_store: imageStore(env), counts: c, account: publicAccount(data.account), admin: !!data.isAdmin });
}

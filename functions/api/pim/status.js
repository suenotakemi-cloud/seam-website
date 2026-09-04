// GET /api/pim/status → 保存先の状態と件数（画面の初期表示・ログイン確認）
import { json, hasR2 } from './_lib.js';

export async function onRequestGet({ env }) {
  const c = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM pim_products) AS products, ' +
    '(SELECT COUNT(*) FROM pim_products WHERE image_count>0) AS with_images, ' +
    '(SELECT COUNT(*) FROM pim_images) AS images, ' +
    '(SELECT COUNT(*) FROM pim_issues WHERE status=\'open\') AS open_issues'
  ).first();
  return json({ ok: true, configured: true, r2: hasR2(env), counts: c });
}

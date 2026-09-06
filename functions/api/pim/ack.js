// EC 側の「受け取り確認」— EC が商品・写真を取り込み終えたら、その JAN を知らせる。PC の商品一覧に「EC 反映済み／未反映」が出る
//   POST /api/pim/ack { jans:[...], at? }   （連携キー api_key でも可。最大 500 件）→ { ok, acked }
//   GET  /api/pim/ack?limit=500             → { jans:[...], total }  EC 未反映（ec_synced_at が無い／商品の更新より古い）の JAN 一覧（EC が取りに来る用）
//   「未反映」= ec_synced_at IS NULL または ec_synced_at < updated_at（写真の追加・削除でも updated_at が進む）
import { json, cleanJan, nowIso } from './_lib.js';

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const limit = Math.min(2000, Math.max(1, parseInt(new URL(request.url).searchParams.get('limit') || '500', 10) || 500));
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_products WHERE account_id=? AND (ec_synced_at IS NULL OR ec_synced_at < updated_at)').bind(acct).first();
  const rs = await env.DB.prepare('SELECT jan, updated_at FROM pim_products WHERE account_id=? AND (ec_synced_at IS NULL OR ec_synced_at < updated_at) ORDER BY updated_at LIMIT ?').bind(acct, limit).all();
  return json({ ok: true, total: total ? total.n : 0, jans: (rs.results || []).map((r) => r.jan), items: rs.results || [] });
}
export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b || !Array.isArray(b.jans)) return json({ ok: false, reason: 'bad_json', message: '{ jans:[...] } を送ってください' }, 400);
  const jans = b.jans.map((j) => cleanJan(j)).filter(Boolean).slice(0, 500);
  let at = nowIso();
  if (b.at) { const d = new Date(b.at); if (!isNaN(d.getTime())) at = d.toISOString(); }
  let acked = 0;
  for (let i = 0; i < jans.length; i += 90) {
    const chunk = jans.slice(i, i + 90);
    const r = await env.DB.prepare('UPDATE pim_products SET ec_synced_at=? WHERE account_id=? AND jan IN (' + chunk.map(() => '?').join(',') + ')').bind(at, acct, ...chunk).run();
    acked += (r.meta && r.meta.changes) || 0;
  }
  return json({ ok: true, acked, at });
}

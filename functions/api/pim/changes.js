// 変更の記録（EC 側の差分取得用・読み取り専用キーで可）
//   GET /api/pim/changes?since_id=<最後に見た id>&since=<ISO日時>&limit=1000
//     → { changes:[{id,jan,kind,ts,by}], latest_id, has_more }
//   使い方: EC 側は latest_id を覚えておき、次回 since_id=<それ> で呼ぶ。返ってきた JAN だけ
//           /api/pim/export?format=source（か products?jan=）で取り直せばよい。kind=delete は EC 側でも消す
import { json } from './_lib.js';

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const sinceId = Math.max(0, parseInt(url.searchParams.get('since_id') || '0', 10) || 0);
  const since = (url.searchParams.get('since') || '').trim();
  const limit = Math.min(5000, Math.max(1, parseInt(url.searchParams.get('limit') || '1000', 10) || 1000));
  const where = ['account_id=?', 'id>?'], binds = [acct, sinceId];
  if (since) { const d = new Date(since); if (isNaN(d.getTime())) return json({ ok: false, reason: 'bad_since' }, 400); where.push('ts>=?'); binds.push(d.toISOString()); }
  const rs = await env.DB.prepare('SELECT id, jan, kind, ts, by FROM pim_changes WHERE ' + where.join(' AND ') + ' ORDER BY id LIMIT ?').bind(...binds, limit + 1).all();
  const rows = rs.results || [];
  const hasMore = rows.length > limit; if (hasMore) rows.pop();
  const latest = await env.DB.prepare('SELECT MAX(id) AS id FROM pim_changes WHERE account_id=?').bind(acct).first();
  return json({ ok: true, changes: rows, latest_id: (latest && latest.id) || 0, has_more: hasMore, count: rows.length });
}

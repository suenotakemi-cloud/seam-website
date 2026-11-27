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
  // latest_id は「次に since_id へ渡す番号」。返した最後の行の番号にする（全体の最大にすると、has_more のときの残りや、
  //   この 2 つの問い合わせの間に入った変更を飛ばしてしまう）。1 行も無いときは、問い合わせる前に見た最大（それより後は次回に拾える）
  const before = await env.DB.prepare('SELECT MAX(id) AS id FROM pim_changes WHERE account_id=?').bind(acct).first();
  const rs = await env.DB.prepare('SELECT id, jan, kind, ts, by FROM pim_changes WHERE ' + where.join(' AND ') + ' ORDER BY id LIMIT ?').bind(...binds, limit + 1).all();
  const rows = rs.results || [];
  const hasMore = rows.length > limit; if (hasMore) rows.pop();
  const latestId = rows.length ? rows[rows.length - 1].id : Math.max(sinceId, (before && before.id) || 0);
  return json({ ok: true, changes: rows, latest_id: latestId, has_more: hasMore, count: rows.length });
}

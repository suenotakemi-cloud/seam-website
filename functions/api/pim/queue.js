// 撮影キュー（スマホ）— 「次に撮る商品」を棚の並び順で返す
//   GET /api/pim/queue?mode=noimg|retake|few&maker=&after=<jan>&limit=30
//     noimg  … 写真が1枚も無い商品（メーカー → ブランド → 商品名 の順）
//     few    … 写真が 1〜4 枚の商品（2周目用）
//     retake … 検品で「撮り直し」が付いた写真がある商品
//     after  … この JAN の「次」から返す（ページ送り。並び順は maker, brand, name, jan）
//   返り値: { items:[{jan,name,maker,brand,image_count,retake_slots:[]}], total, remaining }
import { json, cleanJan } from './_lib.js';

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const mode = ['few', 'retake'].indexOf(url.searchParams.get('mode')) >= 0 ? url.searchParams.get('mode') : 'noimg';
  const maker = (url.searchParams.get('maker') || '').trim().slice(0, 100);
  const after = cleanJan(url.searchParams.get('after') || '');
  const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '30', 10) || 30));

  const where = ['p.account_id=?'], binds = [acct];
  if (maker) { where.push('p.maker=?'); binds.push(maker); }
  if (mode === 'noimg') where.push('p.image_count=0');
  else if (mode === 'few') where.push('p.image_count BETWEEN 1 AND 4');
  else where.push('EXISTS (SELECT 1 FROM pim_images i WHERE i.account_id=p.account_id AND i.jan=p.jan AND i.review=\'retake\')');
  const W = ' WHERE ' + where.join(' AND ');
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_products p' + W).bind(...binds).first();

  // 「after の次」= 並び順で after より後ろ。SQLite の行値比較で実現
  let W2 = W, binds2 = binds.slice();
  if (after) {
    const cur = await env.DB.prepare('SELECT maker, brand, name, jan FROM pim_products WHERE account_id=? AND jan=?').bind(acct, after).first();
    if (cur) {
      W2 += ' AND (COALESCE(p.maker,\'\'), COALESCE(p.brand,\'\'), p.name, p.jan) > (?, ?, ?, ?)';
      binds2 = binds2.concat([cur.maker || '', cur.brand || '', cur.name, cur.jan]);
    }
  }
  const rs = await env.DB.prepare(
    'SELECT p.jan, p.name, p.maker, p.brand, p.image_count, p.sku FROM pim_products p' + W2 +
    ' ORDER BY COALESCE(p.maker,\'\'), COALESCE(p.brand,\'\'), p.name, p.jan LIMIT ?'
  ).bind(...binds2, limit).all();
  const items = rs.results || [];
  if (mode === 'retake' && items.length) {
    const jans = items.map((i) => i.jan);
    const rr = await env.DB.prepare('SELECT jan, slot, review_note FROM pim_images WHERE account_id=? AND review=\'retake\' AND jan IN (' + jans.map(() => '?').join(',') + ')').bind(acct, ...jans).all();
    const by = {}; for (const r of (rr.results || [])) (by[r.jan] = by[r.jan] || []).push({ slot: r.slot, note: r.review_note || '' });
    items.forEach((i) => { i.retake = by[i.jan] || []; });
  }
  const remaining = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_products p' + W2).bind(...binds2).first();
  const makers = await env.DB.prepare('SELECT maker, COUNT(*) AS n FROM pim_products WHERE account_id=? AND image_count=0 AND maker<>\'\' GROUP BY maker ORDER BY n DESC LIMIT 60').bind(acct).all();
  return json({ ok: true, mode, maker, total: total ? total.n : 0, remaining: remaining ? remaining.n : 0, items, makers: makers.results || [] });
}

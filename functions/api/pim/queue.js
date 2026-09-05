// 撮影キュー（スマホ）— 「次に撮る商品」を棚の並び順で返す
//   GET /api/pim/queue?mode=noimg|retake|few&maker=&after=<jan>&limit=30
//     noimg  … 写真が1枚も無い商品（メーカー → ブランド → 商品名 の順）
//     few    … 写真が 1〜4 枚の商品（2周目用）
//     retake … 検品で「撮り直し」が付いた写真がある商品
//     after  … この JAN の「次」から返す（ページ送り。並び順は maker, brand, name, jan）
//   返り値: { items:[{jan,name,maker,brand,image_count,retake_slots:[]}], total, remaining }
import { json, cleanJan, userOf, nowIso } from './_lib.js';

// 「いま誰かが撮っている」商品を 10 分だけ他の人のキューから外す（2人が同じ商品を同時に撮る無駄を防ぐ）
const CLAIM_MIN = 10;
function claimCutoff() { return new Date(Date.now() - CLAIM_MIN * 60000).toISOString(); }

// POST /api/pim/queue { jan, action:'claim'|'release' } … 商品を開いたら claim、閉じたら release
export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b) return json({ ok: false, reason: 'bad_json' }, 400);
  const jan = cleanJan(b.jan || ''); const by = userOf(request) || '(名前なし)';
  if (!jan) return json({ ok: false, reason: 'no_jan' }, 400);
  if (b.action === 'release') {
    await env.DB.prepare('UPDATE pim_products SET claimed_by=NULL, claimed_at=NULL WHERE account_id=? AND jan=? AND claimed_by=?').bind(acct, jan, by).run();
    return json({ ok: true });
  }
  const cur = await env.DB.prepare('SELECT claimed_by, claimed_at FROM pim_products WHERE account_id=? AND jan=?').bind(acct, jan).first();
  if (!cur) return json({ ok: false, reason: 'not_found' }, 404);
  const other = cur.claimed_by && cur.claimed_by !== by && cur.claimed_at && cur.claimed_at > claimCutoff() ? cur.claimed_by : null;
  await env.DB.prepare('UPDATE pim_products SET claimed_by=?, claimed_at=? WHERE account_id=? AND jan=?').bind(by, nowIso(), acct, jan).run();
  return json({ ok: true, other }); // other があれば「〇〇さんも開いています」と出す（止めはしない）
}

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const me = userOf(request) || '(名前なし)';
  const url = new URL(request.url);
  const mode = ['few', 'retake'].indexOf(url.searchParams.get('mode')) >= 0 ? url.searchParams.get('mode') : 'noimg';
  const maker = (url.searchParams.get('maker') || '').trim().slice(0, 100);
  const after = cleanJan(url.searchParams.get('after') || '');
  const limit = Math.min(90, Math.max(1, parseInt(url.searchParams.get('limit') || '30', 10) || 30)); // D1 のバインド上限 100 に収める（retake の IN (...)）

  const where = ['p.account_id=?'], binds = [acct];
  if (maker) { where.push('p.maker=?'); binds.push(maker); }
  // 他の人が 10 分以内に開いた商品は飛ばす（自分が開いたものは残す）
  where.push('(p.claimed_at IS NULL OR p.claimed_at < ? OR p.claimed_by = ?)'); binds.push(claimCutoff(), me);
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
    'SELECT p.jan, p.name, p.maker, p.brand, p.image_count, p.sku, p.claimed_by FROM pim_products p' + W2 +
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

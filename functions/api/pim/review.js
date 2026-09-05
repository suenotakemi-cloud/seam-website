// 写真の検品（PC）— 撮った写真に OK / 撮り直し を付ける。撮り直しはスマホの撮影キューに出る
//   GET  /api/pim/review?status=pending|ok|retake|warn|all&maker=&limit=60&offset=0   （warn = 登録時の自動チェックで注意が付いた未検品の写真） → { images:[{jan,slot,url,name,maker,created_by,created_at,review,review_note}], total }
//   POST /api/pim/review { jan, slot, review:'ok'|'retake'|null, note }   … 1枚に付ける
//   POST /api/pim/review { items:[{jan,slot,review,note}] }                … まとめて（最大 200）
//   写真を撮り直す（同じ番号に上げ直す）と review は自動で外れる（images.js）
import { json, cleanJan, imageUrl, nowIso, userOf } from './_lib.js';

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  if (status === 'dup') return dupPhotos(env, acct, url.origin); // 同じ写真が別の商品に
  const maker = (url.searchParams.get('maker') || '').trim().slice(0, 100);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '60', 10) || 60));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const where = ['i.account_id=?'], binds = [acct];
  if (status === 'pending') where.push('i.review IS NULL');
  else if (status === 'ok' || status === 'retake') { where.push('i.review=?'); binds.push(status); }
  else if (status === 'warn') where.push('i.quality_warn IS NOT NULL AND i.review IS NULL');
  if (maker) { where.push('p.maker=?'); binds.push(maker); }
  const W = ' FROM pim_images i JOIN pim_products p ON p.account_id=i.account_id AND p.jan=i.jan WHERE ' + where.join(' AND ');
  const total = await env.DB.prepare('SELECT COUNT(*) AS n' + W).bind(...binds).first();
  const rs = await env.DB.prepare(
    'SELECT i.jan, i.slot, i.width, i.height, i.bytes, i.created_by, i.created_at, i.ver, i.review, i.review_note, i.reviewed_by, i.quality_warn, p.name, p.maker, p.brand, p.sku' + W +
    ' ORDER BY i.created_at DESC LIMIT ? OFFSET ?'
  ).bind(...binds, limit, offset).all();
  const origin = url.origin;
  const images = (rs.results || []).map((r) => Object.assign(r, { url: imageUrl(origin, acct, r.jan, r.slot, r.ver || r.created_at) }));
  return json({ ok: true, total: total ? total.n : 0, limit, offset, images });
}

// 同じ写真（phash が同じ）が 2 つ以上の商品に登録されている組を出す（撮り間違い・貼り間違い）
async function dupPhotos(env, acct, origin) {
  const rs = await env.DB.prepare('SELECT phash, COUNT(DISTINCT jan) AS n FROM pim_images WHERE account_id=? AND phash IS NOT NULL GROUP BY phash HAVING n>=2 ORDER BY n DESC LIMIT 100').bind(acct).all();
  const groups = [];
  for (const g of (rs.results || [])) {
    const r = await env.DB.prepare('SELECT i.jan, i.slot, i.created_by, i.created_at, i.ver, p.name, p.maker, p.sku FROM pim_images i JOIN pim_products p ON p.account_id=i.account_id AND p.jan=i.jan WHERE i.account_id=? AND i.phash=? ORDER BY i.jan, i.slot').bind(acct, g.phash).all();
    groups.push({ phash: g.phash, products: g.n, images: (r.results || []).map((x) => Object.assign(x, { url: imageUrl(origin, acct, x.jan, x.slot, x.ver || x.created_at) })) });
  }
  return json({ ok: true, total: groups.length, groups });
}

export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const by = userOf(request);
  const ts = nowIso();
  const items = Array.isArray(b.items) ? b.items.slice(0, 200) : [b];
  const stmts = [];
  for (const it of items) {
    const jan = cleanJan(it.jan || ''); const slot = parseInt(it.slot, 10);
    if (!jan || !(slot >= 1 && slot <= 5)) continue;
    const review = it.review === 'ok' || it.review === 'retake' ? it.review : null;
    const note = String(it.note || '').slice(0, 300);
    stmts.push(env.DB.prepare('UPDATE pim_images SET review=?, review_note=?, reviewed_by=?, reviewed_at=? WHERE account_id=? AND jan=? AND slot=?')
      .bind(review, review ? note : null, review ? (by || null) : null, review ? ts : null, acct, jan, slot));
  }
  if (!stmts.length) return json({ ok: false, reason: 'no_items' }, 400);
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
  return json({ ok: true, updated: stmts.length });
}

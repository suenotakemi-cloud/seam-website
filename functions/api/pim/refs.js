// 撮影の「見本」（お手本写真）— 同じ種類・同じ枚目の商品を、同じ位置・同じ大きさ・同じ角度で撮るために、
// 先に撮った 1 枚をカメラ画面に薄く重ねて表示する。見本は「登録済みの写真（JAN＋枚目）を指す」だけなので、
// ディーラー内の全員のスマホで同じ見本が出る。
//   GET  /api/pim/refs                 → { refs:[{ id, kind, slot, scope, jan, src_slot, name, brand, url, created_by, created_at }] }
//   POST /api/pim/refs { action:'set', kind, slot, jan, src_slot, scope }   scope: '' = その種類すべて / 'brand:<ブランド名>' = そのブランドだけ
//        { action:'delete', id }
//   kind は photo-guide.js の形の key（colorbox / pump / jar …）
import { json, cleanJan, userOf, nowIso, imageUrl, logChanges } from './_lib.js';

async function list(env, origin, acct) {
  const rs = await env.DB.prepare(
    'SELECT r.*, p.name, p.brand, i.ver, i.created_at AS img_at FROM pim_refs r LEFT JOIN pim_products p ON p.account_id=r.account_id AND p.jan=r.jan ' +
    'LEFT JOIN pim_images i ON i.account_id=r.account_id AND i.jan=r.jan AND i.slot=r.src_slot WHERE r.account_id=? ORDER BY r.kind, r.slot, r.scope'
  ).bind(acct).all();
  return (rs.results || []).map((r) => ({ id: r.id, kind: r.kind, slot: r.slot, scope: r.scope || '', jan: r.jan, src_slot: r.src_slot, note: r.note || '', name: r.name || '', brand: r.brand || '',
    url: r.img_at ? imageUrl(origin, acct, r.jan, r.src_slot, r.ver || r.img_at) : null, created_by: r.created_by || '', created_at: r.created_at }));
}
export async function onRequestGet({ request, env, data }) {
  return json({ ok: true, refs: await list(env, new URL(request.url).origin, data.account.id) });
}
export async function onRequestPost(context) {
  const { request, env, data } = context;
  const acct = data.account.id, by = userOf(request), origin = new URL(request.url).origin;
  let b; try { b = await request.json(); } catch (e) { return json({ ok: false, reason: 'bad_json' }, 400); }
  const action = String(b.action || '');
  if (action === 'set') {
    const kind = String(b.kind || '').trim().slice(0, 40), slot = parseInt(b.slot, 10), srcSlot = parseInt(b.src_slot, 10) || slot, jan = cleanJan(b.jan || '');
    const scope = String(b.scope || '').trim().slice(0, 120);
    if (!/^[a-z]+$/.test(kind) || !(slot >= 1 && slot <= 5) || !(srcSlot >= 1 && srcSlot <= 5) || !jan) return json({ ok: false, reason: 'bad_params', message: '種類・枚目・JAN が必要です' }, 400);
    const im = await env.DB.prepare('SELECT 1 AS x FROM pim_images WHERE account_id=? AND jan=? AND slot=?').bind(acct, jan, srcSlot).first();
    if (!im) return json({ ok: false, reason: 'no_image', message: 'その写真がまだ登録されていません' }, 404);
    await env.DB.prepare(
      'INSERT INTO pim_refs(account_id, kind, slot, scope, jan, src_slot, note, created_at, created_by) VALUES(?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT(account_id, kind, slot, scope) DO UPDATE SET jan=excluded.jan, src_slot=excluded.src_slot, note=excluded.note, created_at=excluded.created_at, created_by=excluded.created_by'
    ).bind(acct, kind, slot, scope, jan, srcSlot, String(b.note || '').slice(0, 200), nowIso(), by || null).run();
    return json({ ok: true, refs: await list(env, origin, acct) });
  }
  if (action === 'delete') {
    const id = parseInt(b.id, 10) || 0;
    await env.DB.prepare('DELETE FROM pim_refs WHERE id=? AND account_id=?').bind(id, acct).run();
    return json({ ok: true, refs: await list(env, origin, acct) });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

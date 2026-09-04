// 商品の読み書き
//   GET  /api/pim/products?jan=4901234567890          → 1件（画像付き）
//   GET  /api/pim/products?q=検索語&maker=&noimg=1&limit=50&offset=0 → 一覧
//   PUT  /api/pim/products  body {jan,name,price,...}  → 1件を登録/更新（スマホ画面の手入力・新規登録）
//   DELETE /api/pim/products?jan=                       → 1件削除（画像も消す）
import { json, cleanJan, janShapeOk, sanitizeProduct, upsertStmt, withImages, loadImages, nowIso, hasR2, imageKey, SLOT_MAX } from './_lib.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;
  const jan = cleanJan(url.searchParams.get('jan') || '');
  if (jan) {
    const row = await env.DB.prepare('SELECT * FROM pim_products WHERE jan=?').bind(jan).first();
    if (!row) return json({ ok: false, reason: 'not_found', jan }, 404);
    const imgs = await loadImages(env, [jan]);
    return json({ ok: true, product: withImages(origin, [row], imgs)[0] });
  }
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const maker = (url.searchParams.get('maker') || '').trim().slice(0, 100);
  const noimg = url.searchParams.get('noimg') === '1';
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const where = [], binds = [];
  if (q) {
    const qd = q.replace(/[^0-9]/g, '');
    if (qd.length >= 6 && qd.length === q.length) { where.push('jan LIKE ?'); binds.push(qd + '%'); }
    else { where.push('(name LIKE ? OR brand LIKE ? OR sku LIKE ? OR maker LIKE ?)'); binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%'); }
  }
  if (maker) { where.push('maker=?'); binds.push(maker); }
  if (noimg) where.push('image_count=0');
  const W = where.length ? ' WHERE ' + where.join(' AND ') : '';
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_products' + W).bind(...binds).first();
  const rs = await env.DB.prepare('SELECT * FROM pim_products' + W + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?').bind(...binds, limit, offset).all();
  const rows = rs.results || [];
  const imgs = await loadImages(env, rows.map((r) => r.jan));
  const makers = await env.DB.prepare('SELECT maker, COUNT(*) AS n FROM pim_products WHERE maker<>\'\' GROUP BY maker ORDER BY n DESC LIMIT 100').all();
  return json({ ok: true, total: total ? total.n : 0, limit, offset, products: withImages(origin, rows, imgs), makers: makers.results || [] });
}

export async function onRequestPut({ request, env }) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const p = sanitizeProduct(body);
  if (!p.jan || !janShapeOk(p.jan)) return json({ ok: false, reason: 'bad_jan', message: 'JANは13桁または8桁の数字で入力してください' }, 400);
  if (!p.name) return json({ ok: false, reason: 'no_name', message: '商品名は必須です' }, 400);
  const ts = nowIso();
  await upsertStmt(env, p, null, ts).run();
  const row = await env.DB.prepare('SELECT * FROM pim_products WHERE jan=?').bind(p.jan).first();
  const imgs = await loadImages(env, [p.jan]);
  return json({ ok: true, product: withImages(new URL(request.url).origin, [row], imgs)[0] });
}

export async function onRequestDelete({ request, env }) {
  const jan = cleanJan(new URL(request.url).searchParams.get('jan') || '');
  if (!jan) return json({ ok: false, reason: 'no_jan' }, 400);
  if (hasR2(env)) {
    for (let s = 1; s <= SLOT_MAX; s++) { try { await env.PRODUCT_IMAGES.delete(imageKey(jan, s)); } catch (e) { /* 無ければ無いでよい */ } }
  }
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pim_images WHERE jan=?').bind(jan),
    env.DB.prepare('DELETE FROM pim_products WHERE jan=?').bind(jan),
  ]);
  return json({ ok: true, jan });
}

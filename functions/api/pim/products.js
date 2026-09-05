// 商品の読み書き（ログイン中のアカウントの分だけ）
//   GET  /api/pim/products?jan=4901234567890          → 1件（画像付き）。未登録なら 200 で {ok:false, reason:'not_found'}
//   GET  /api/pim/products?q=検索語&maker=&noimg=1&limit=50&offset=0 → 一覧
//   PUT  /api/pim/products  body {jan,name,price,..., expected_updated_at?, insert_only?}
//        → 1件を登録/更新（スマホ画面の手入力・新規登録）
//        expected_updated_at … その後に他の人が更新していれば 409 で今の内容を返す（上書き事故の防止）
//        insert_only         … 無いときだけ登録。既にあれば 409 でその内容を返す
//   DELETE /api/pim/products?jan=                       → 1件削除（画像も消す）
import { json, cleanJan, janShapeOk, sanitizeProduct, upsertStmt, withImages, loadImages, nowIso, imageKey, SLOT_MAX, userOf, blobDelete, loadDict, applyDict, logChanges, notifyWebhook } from './_lib.js';

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const origin = url.origin;
  const jan = cleanJan(url.searchParams.get('jan') || '');
  if (jan) {
    const row = await env.DB.prepare('SELECT * FROM pim_products WHERE account_id=? AND jan=?').bind(acct, jan).first();
    if (!row) return json({ ok: false, reason: 'not_found', jan }); // 「未登録」は正常な答えなので 200
    const imgs = await loadImages(env, acct, [jan]);
    return json({ ok: true, product: withImages(origin, acct, [row], imgs)[0] });
  }
  const q = (url.searchParams.get('q') || '').trim().slice(0, 100);
  const maker = (url.searchParams.get('maker') || '').trim().slice(0, 100);
  const noimg = url.searchParams.get('noimg') === '1';
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0', 10) || 0);
  const where = ['account_id=?'], binds = [acct];
  if (q) {
    const qd = q.replace(/[^0-9]/g, '');
    if (qd.length >= 6 && qd.length === q.length) { where.push('jan LIKE ?'); binds.push(qd + '%'); }
    else { where.push('(name LIKE ? OR brand LIKE ? OR sku LIKE ? OR maker LIKE ?)'); binds.push('%' + q + '%', '%' + q + '%', '%' + q + '%', '%' + q + '%'); }
  }
  if (maker) { where.push('maker=?'); binds.push(maker); }
  if (noimg) where.push('image_count=0');
  const W = ' WHERE ' + where.join(' AND ');
  const total = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_products' + W).bind(...binds).first();
  const rs = await env.DB.prepare('SELECT * FROM pim_products' + W + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?').bind(...binds, limit, offset).all();
  const rows = (rs.results || []).map((r) => { const o = Object.assign({}, r); delete o.raw; return o; });
  const imgs = await loadImages(env, acct, rows.map((r) => r.jan));
  const makers = await env.DB.prepare('SELECT maker, COUNT(*) AS n FROM pim_products WHERE account_id=? AND maker<>\'\' GROUP BY maker ORDER BY n DESC LIMIT 100').bind(acct).all();
  return json({ ok: true, total: total ? total.n : 0, limit, offset, products: withImages(origin, acct, rows, imgs), makers: makers.results || [] });
}

export async function onRequestPut(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const p = applyDict(await loadDict(env, acct), sanitizeProduct(body)); // 表記の辞書（メーカー・ブランド・カテゴリ）を当てる
  if (!p.jan || !janShapeOk(p.jan)) return json({ ok: false, reason: 'bad_jan', message: 'JANは13桁または8桁の数字で入力してください' }, 400);
  if (!p.name) return json({ ok: false, reason: 'no_name', message: '商品名は必須です' }, 400);
  const origin = new URL(request.url).origin;
  const by = userOf(request);
  const ts = nowIso();
  const current = () => env.DB.prepare('SELECT * FROM pim_products WHERE account_id=? AND jan=?').bind(acct, p.jan).first();
  const expected = body.expected_updated_at ? String(body.expected_updated_at) : null;
  if (expected) {
    // 楽観ロック: 見ていた時点の updated_at と同じときだけ更新する
    const r = await env.DB.prepare(
      'UPDATE pim_products SET ' + ['name', 'price', 'tax_included', 'tax_rate', 'price_ex', 'price_in', 'retail_price', 'cost_price', 'amount', 'unit', 'maker', 'brand', 'category', 'description', 'sku', 'jan_valid', 'name_key'].map((c) => c + '=?').join(', ') +
      ', updated_at=?, updated_by=? WHERE account_id=? AND jan=? AND updated_at=?'
    ).bind(p.name, p.price, p.tax_included, p.tax_rate, p.price_ex, p.price_in, p.retail_price, p.cost_price, p.amount, p.unit, p.maker, p.brand, p.category, p.description, p.sku, p.jan_valid, p.name_key, ts, by || null, acct, p.jan, expected).run();
    if (!(r.meta && r.meta.changes)) {
      const cur = await current();
      if (cur) {
        const imgs0 = await loadImages(env, acct, [p.jan]);
        return json({ ok: false, reason: 'conflict', message: (cur.updated_by ? cur.updated_by + ' さんが' : '他の人が') + '先に更新しました。最新の内容を表示します', product: withImages(origin, acct, [cur], imgs0)[0] }, 409);
      }
      await upsertStmt(env, acct, p, null, ts, by, 'upsert').run(); // 消されていたら作り直す
    }
  } else if (body.insert_only) {
    const r = await upsertStmt(env, acct, p, null, ts, by, 'insert_only').run();
    if (!(r.meta && r.meta.changes)) {
      const cur = await current();
      const imgs0 = await loadImages(env, acct, [p.jan]);
      return json({ ok: false, reason: 'exists', message: 'この JAN は' + (cur && cur.updated_by ? cur.updated_by + ' さんが' : '他の人が') + '先に登録しました。その内容を表示します', product: withImages(origin, acct, [cur], imgs0)[0] }, 409);
    }
  } else await upsertStmt(env, acct, p, null, ts, by, 'upsert').run();
  const row = await current();
  const imgs = await loadImages(env, acct, [p.jan]);
  await logChanges(env, acct, [p.jan], 'product', by); notifyWebhook(context, data.account, 'product', [p.jan], by);
  return json({ ok: true, product: withImages(origin, acct, [row], imgs)[0] });
}

export async function onRequestDelete(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  const jan = cleanJan(new URL(request.url).searchParams.get('jan') || '');
  if (!jan) return json({ ok: false, reason: 'no_jan' }, 400);
  for (let s = 1; s <= SLOT_MAX; s++) await blobDelete(env, imageKey(acct, jan, s)); // 無ければ無いでよい
  await env.DB.batch([
    env.DB.prepare('DELETE FROM pim_images WHERE account_id=? AND jan=?').bind(acct, jan),
    env.DB.prepare('DELETE FROM pim_products WHERE account_id=? AND jan=?').bind(acct, jan),
  ]);
  const by = userOf(request);
  await logChanges(env, acct, [jan], 'delete', by); notifyWebhook(context, data.account, 'delete', [jan], by);
  return json({ ok: true, jan });
}

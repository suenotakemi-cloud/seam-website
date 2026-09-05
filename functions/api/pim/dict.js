// 表記の辞書 — メーカー・ブランド・カテゴリの揃え（「㈱アリミノ」「アリミノ株式会社」→「アリミノ」）
//   GET  /api/pim/dict                      → { rows:[{id,kind,src,dst}], candidates:{maker:[{v,n}], brand:[...]} }
//   POST /api/pim/dict { action:'set', kind, src, dst }        … 追加／変更（同じ src は上書き）
//                     { action:'delete', id }
//                     { action:'bulk', rows:[{kind,src,dst}] } … まとめて（CSV 貼り付け用・最大 500）
//                     { action:'apply' }                       … 登録済みの商品に辞書を当て直す → { changed }
//   取り込み・スマホ編集の保存時にも自動で当たる（_lib.js applyDict）
import { json, nowIso, userOf, loadDict, applyDict, logChanges, notifyWebhook } from './_lib.js';

const KINDS = ['maker', 'brand', 'category'];
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 200);

export async function onRequestGet({ env, data }) {
  const acct = data.account.id;
  const rs = await env.DB.prepare('SELECT id, kind, src, dst, created_by FROM pim_dict WHERE account_id=? ORDER BY kind, src').bind(acct).all();
  const cand = {};
  for (const k of ['maker', 'brand']) {
    const c = await env.DB.prepare('SELECT ' + k + ' AS v, COUNT(*) AS n FROM pim_products WHERE account_id=? AND ' + k + '<>\'\' GROUP BY ' + k + ' ORDER BY n DESC LIMIT 200').bind(acct).all();
    cand[k] = c.results || [];
  }
  const cc = await env.DB.prepare('SELECT category AS v, COUNT(*) AS n FROM pim_products WHERE account_id=? AND category<>\'\' GROUP BY category ORDER BY n DESC LIMIT 300').bind(acct).all();
  cand.category = cc.results || [];
  return json({ ok: true, rows: rs.results || [], candidates: cand });
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  if (data.readonly) return json({ ok: false, reason: 'readonly' }, 403);
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const by = userOf(request), ts = nowIso();
  const action = String(b.action || '');
  const upsert = (kind, src, dst) => env.DB.prepare('INSERT INTO pim_dict(account_id, kind, src, dst, created_at, created_by) VALUES(?,?,?,?,?,?) ON CONFLICT(account_id, kind, src) DO UPDATE SET dst=excluded.dst, created_at=excluded.created_at, created_by=excluded.created_by').bind(acct, kind, src, dst, ts, by || null);

  if (action === 'set' || action === 'bulk') {
    const rows = (action === 'bulk' ? (Array.isArray(b.rows) ? b.rows : []) : [b]).slice(0, 500)
      .map((r) => ({ kind: String(r.kind || ''), src: clean(r.src), dst: clean(r.dst) }))
      .filter((r) => KINDS.indexOf(r.kind) >= 0 && r.src && r.dst && r.src !== r.dst);
    if (!rows.length) return json({ ok: false, reason: 'no_rows', message: '種類（メーカー/ブランド/カテゴリ）・届く表記・揃える表記 を入れてください（同じ表記どうしは登録できません）' }, 400);
    for (let i = 0; i < rows.length; i += 50) await env.DB.batch(rows.slice(i, i + 50).map((r) => upsert(r.kind, r.src, r.dst)));
    return json({ ok: true, saved: rows.length });
  }
  if (action === 'delete') {
    const id = parseInt(b.id, 10);
    await env.DB.prepare('DELETE FROM pim_dict WHERE id=? AND account_id=?').bind(id, acct).run();
    return json({ ok: true });
  }
  if (action === 'apply') {
    const dict = await loadDict(env, acct);
    if (dict.empty) return json({ ok: true, changed: 0 });
    let changed = 0; const touched = [];
    // メーカー・ブランドは値ごとに UPDATE。カテゴリは「大 > 中 > 小」の各段にも当てるので、値を列挙して 1 つずつ
    for (const k of ['maker', 'brand']) {
      for (const src of Object.keys(dict[k])) {
        const r = await env.DB.prepare('SELECT jan FROM pim_products WHERE account_id=? AND ' + k + '=?').bind(acct, src).all();
        const jans = (r.results || []).map((x) => x.jan); if (!jans.length) continue;
        const u = await env.DB.prepare('UPDATE pim_products SET ' + k + '=?, updated_at=?, updated_by=? WHERE account_id=? AND ' + k + '=?').bind(dict[k][src], ts, by || null, acct, src).run();
        changed += (u.meta && u.meta.changes) || 0; touched.push(...jans);
      }
    }
    if (Object.keys(dict.category).length) {
      const cats = await env.DB.prepare('SELECT DISTINCT category FROM pim_products WHERE account_id=? AND category<>\'\'').bind(acct).all();
      for (const row of (cats.results || [])) {
        const to = applyDict(dict, { category: row.category }).category;
        if (to === row.category) continue;
        const r = await env.DB.prepare('SELECT jan FROM pim_products WHERE account_id=? AND category=?').bind(acct, row.category).all();
        const u = await env.DB.prepare('UPDATE pim_products SET category=?, updated_at=?, updated_by=? WHERE account_id=? AND category=?').bind(to, ts, by || null, acct, row.category).run();
        changed += (u.meta && u.meta.changes) || 0; touched.push(...(r.results || []).map((x) => x.jan));
      }
    }
    await logChanges(env, acct, touched, 'product', by); notifyWebhook(context, data.account, 'product', touched, by);
    return json({ ok: true, changed });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

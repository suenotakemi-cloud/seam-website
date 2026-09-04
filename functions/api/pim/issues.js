// 注意（JAN重複など）の一覧と解決
//   GET  /api/pim/issues?status=open            → { issues:[...] }（existing/incoming は JSON 展開済み）
//   POST /api/pim/issues { id, resolution, index }
//        resolution = keep_existing … 登録済みを残す（届いた方は捨てる）
//                     keep_incoming … 届いた方で上書き（dup_db）
//                     keep_index    … 同一ファイル内の何番目を採用するか（dup_file・index=0..）
//                     dismiss       … 何もせず閉じる
import { json, sanitizeProduct, upsertStmt, nowIso, janShapeOk } from './_lib.js';

function parse(r) {
  const o = Object.assign({}, r);
  try { o.existing = r.existing ? JSON.parse(r.existing) : null; } catch (e) { o.existing = null; }
  try { o.incoming = r.incoming ? JSON.parse(r.incoming) : null; } catch (e) { o.incoming = null; }
  return o;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const status = url.searchParams.get('status') === 'resolved' ? 'resolved' : (url.searchParams.get('status') === 'all' ? null : 'open');
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10) || 200));
  const rs = status
    ? await env.DB.prepare('SELECT * FROM pim_issues WHERE status=? ORDER BY id DESC LIMIT ?').bind(status, limit).all()
    : await env.DB.prepare('SELECT * FROM pim_issues ORDER BY id DESC LIMIT ?').bind(limit).all();
  const open = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_issues WHERE status=\'open\'').first();
  return json({ ok: true, open: open ? open.n : 0, issues: (rs.results || []).map(parse) });
}

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const id = parseInt(b.id, 10);
  if (!id) return json({ ok: false, reason: 'no_id' }, 400);
  const row = await env.DB.prepare('SELECT * FROM pim_issues WHERE id=?').bind(id).first();
  if (!row) return json({ ok: false, reason: 'not_found' }, 404);
  const is = parse(row);
  const resolution = String(b.resolution || '');
  const ts = nowIso();
  let saved = null;

  if (resolution === 'keep_incoming' || resolution === 'keep_index') {
    let cand = null;
    if (Array.isArray(is.incoming)) {
      const idx = resolution === 'keep_index' ? (parseInt(b.index, 10) || 0) : 0;
      cand = is.incoming[idx] || null;
    } else cand = is.incoming;
    if (!cand) return json({ ok: false, reason: 'no_candidate' }, 400);
    const p = sanitizeProduct(cand);
    if (!p.jan || !janShapeOk(p.jan) || !p.name) return json({ ok: false, reason: 'bad_candidate', message: 'JANか商品名が不正なため登録できません' }, 400);
    await upsertStmt(env, p, row.import_id, ts).run();
    saved = p.jan;
  } else if (resolution !== 'keep_existing' && resolution !== 'dismiss') {
    return json({ ok: false, reason: 'bad_resolution' }, 400);
  }
  const res = resolution === 'keep_index' ? 'keep_index:' + (parseInt(b.index, 10) || 0) : resolution;
  await env.DB.prepare('UPDATE pim_issues SET status=\'resolved\', resolution=?, resolved_at=? WHERE id=?').bind(res, ts, id).run();
  return json({ ok: true, id, resolution: res, saved });
}

// 注意（JAN重複など）の一覧と解決（ログイン中のアカウントの分だけ）
//   GET  /api/pim/issues?status=open            → { issues:[...] }（existing/incoming は JSON 展開済み）
//   POST /api/pim/issues { id, resolution, index }
//        resolution = keep_existing … 登録済みを残す（届いた方は捨てる）
//                     keep_incoming … 届いた方で上書き（dup_db）
//                     keep_index    … 同一ファイル内の何番目を採用するか（dup_file・index=0..）
//                     dismiss       … 何もせず閉じる
//   2人が同時に同じ注意を押しても、先に「解決済み」へ切り替えた1人だけが保存に進む（後の人は 409）
import { json, sanitizeProduct, upsertStmt, nowIso, janShapeOk, userOf } from './_lib.js';

function parse(r) {
  const o = Object.assign({}, r);
  try { o.existing = r.existing ? JSON.parse(r.existing) : null; } catch (e) { o.existing = null; }
  try { o.incoming = r.incoming ? JSON.parse(r.incoming) : null; } catch (e) { o.incoming = null; }
  return o;
}

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const status = url.searchParams.get('status') === 'resolved' ? 'resolved' : (url.searchParams.get('status') === 'all' ? null : 'open');
  const limit = Math.min(500, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10) || 200));
  const rs = status
    ? await env.DB.prepare('SELECT * FROM pim_issues WHERE account_id=? AND status=? ORDER BY id DESC LIMIT ?').bind(acct, status, limit).all()
    : await env.DB.prepare('SELECT * FROM pim_issues WHERE account_id=? ORDER BY id DESC LIMIT ?').bind(acct, limit).all();
  const open = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_issues WHERE account_id=? AND status=\'open\'').bind(acct).first();
  return json({ ok: true, open: open ? open.n : 0, issues: (rs.results || []).map(parse) });
}

export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const id = parseInt(b.id, 10);
  if (!id) return json({ ok: false, reason: 'no_id' }, 400);
  const row = await env.DB.prepare('SELECT * FROM pim_issues WHERE id=? AND account_id=?').bind(id, acct).first();
  if (!row) return json({ ok: false, reason: 'not_found' }, 404);
  const is = parse(row);
  const resolution = String(b.resolution || '');
  const ts = nowIso();
  const by = userOf(request);
  if (row.status !== 'open') return json({ ok: false, reason: 'already_resolved', message: 'この注意は' + (row.resolved_by ? row.resolved_by + ' さんが' : '他の人が') + '先に処理しました（' + (row.resolution || '') + '）', issue: is }, 409);
  const res = resolution === 'keep_index' ? 'keep_index:' + (parseInt(b.index, 10) || 0) : resolution;
  if (['keep_incoming', 'keep_index', 'keep_existing', 'dismiss'].indexOf(resolution) < 0) return json({ ok: false, reason: 'bad_resolution' }, 400);
  const lock = await env.DB.prepare('UPDATE pim_issues SET status=\'resolved\', resolution=?, resolved_at=?, resolved_by=? WHERE id=? AND status=\'open\'').bind(res, ts, by || null, id).run();
  if (!(lock.meta && lock.meta.changes)) return json({ ok: false, reason: 'already_resolved', message: '他の人が先に処理しました' }, 409);

  let saved = null;
  if (resolution === 'keep_incoming' || resolution === 'keep_index') {
    let cand = null;
    if (Array.isArray(is.incoming)) cand = is.incoming[resolution === 'keep_index' ? (parseInt(b.index, 10) || 0) : 0] || null;
    else cand = is.incoming;
    const p = cand ? sanitizeProduct(cand) : null;
    if (!p || !p.jan || !janShapeOk(p.jan) || !p.name) {
      await env.DB.prepare('UPDATE pim_issues SET status=\'open\', resolution=NULL, resolved_at=NULL, resolved_by=NULL WHERE id=?').bind(id).run(); // ロックを戻す
      return json({ ok: false, reason: 'bad_candidate', message: 'JANか商品名が不正なため登録できません' }, 400);
    }
    await upsertStmt(env, acct, p, row.import_id, ts, by, 'upsert').run();
    saved = p.jan;
  }
  return json({ ok: true, id, resolution: res, saved });
}

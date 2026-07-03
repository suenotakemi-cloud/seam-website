// SEAM 入場受付 — 入場ログ参照（Cloudflare Pages Function）
// ルート: GET /entrance/stats?key=<ADMIN_KEY>&limit=300
//   → { ok:true, configured:true, total, rows:[{ts,code,name,ok,revisit}...] }（新しい順）
//
// 保護: 既存adminと同じ env.ADMIN_KEY（x-seam-key ヘッダ or ?key=）。
// データ元は functions/entrance/log.js が書く D1 テーブル entrance_log。
// 集計（本日/種別/リピーター）は JST 差を正しく扱うため、生ログを返してダッシュボード側で行う。

export async function onRequestGet(context) {
  const { request, env } = context;
  const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const url = new URL(request.url);
  const key = request.headers.get('x-seam-key') || url.searchParams.get('key') || '';

  if (!env || !env.ADMIN_KEY) {
    return J({ ok: false, configured: false, reason: 'no_key',
      message: 'オーナーがCloudflareで ADMIN_KEY を設定してください' }, H, 200);
  }
  if (key !== env.ADMIN_KEY) {
    return J({ ok: false, reason: 'unauthorized' }, H, 401);
  }
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return J({ ok: false, configured: false, reason: 'no_d1',
      message: 'D1 binding "DB" が未設定です（Cloudflareダッシュボードで設定してください）' }, H, 200);
  }

  const limit = Math.min(1000, Math.max(50, Number(url.searchParams.get('limit')) || 300));
  try {
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS entrance_log(ts TEXT, code TEXT, name TEXT, shop TEXT, ok INTEGER, revisit INTEGER)'
    ).run();
    const cnt = await env.DB.prepare('SELECT COUNT(*) AS n FROM entrance_log').first();
    const res = await env.DB.prepare(
      'SELECT ts, code, name, ok, revisit FROM entrance_log ORDER BY ts DESC LIMIT ?1'
    ).bind(limit).all();
    const rows = (res && res.results) || [];
    return J({ ok: true, configured: true, total: (cnt && cnt.n) || rows.length, rows }, H);
  } catch (e) {
    return J({ ok: false, reason: 'error', message: String(e && e.message || e) }, H, 500);
  }
}

function J(o, h, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: h }); }

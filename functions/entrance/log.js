// SEAM 入場受付 — 入場ログ収集（Cloudflare Pages Function）
// ルート: POST /entrance/log  body { code, name, shop, ok, revisit }
//
// D1 binding "DB" があれば entrance_log テーブルに永続保存（管理ダッシュボードの来店集計用）。
// D1が無い環境でも 204 を返して受付を絶対に止めない（functions/api/ev.js と同じ方針）。
// 端末側にも localStorage のログが残るため、ここが落ちてもデータは失われない。

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const b = await request.json().catch(() => ({}));

    const code    = String(b.code || '').slice(0, 64);
    const name    = String(b.name || '').slice(0, 40);
    const shop    = String(b.shop || '').slice(0, 40);
    const ok      = b.ok ? 1 : 0;
    const revisit = b.revisit ? 1 : 0;

    if (code && env && env.DB && typeof env.DB.prepare === 'function') {
      context.waitUntil((async () => {
        try {
          await env.DB.prepare(
            'CREATE TABLE IF NOT EXISTS entrance_log(' +
            'ts TEXT, code TEXT, name TEXT, shop TEXT, ok INTEGER, revisit INTEGER)'
          ).run();
          await env.DB.prepare(
            'INSERT INTO entrance_log(ts, code, name, shop, ok, revisit) VALUES(?1, ?2, ?3, ?4, ?5, ?6)'
          ).bind(new Date().toISOString(), code, name, shop, ok, revisit).run();
        } catch (e) { /* 集計失敗で受付を壊さない */ }
      })());
    }

    return new Response(null, { status: 204 });
  } catch (e) {
    return new Response(null, { status: 204 });
  }
}

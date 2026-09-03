// SEAM 入場受付 — 入場ログ収集（Cloudflare Pages Function）
// ルート: POST /entrance/log  body { code, name, shop, ok, revisit }
//
// D1 binding "DB" があれば entrance_log テーブルに永続保存（管理ダッシュボードの来店集計用）。
// D1が無い環境でも 204 を返して受付を絶対に止めない（functions/api/ev.js と同じ方針）。
// 端末側にも localStorage のログが残るため、ここが落ちてもデータは失われない。

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // ★誰でも叩ける口だった。受付iPad(seam.site上の /entrance)以外からの書き込みは
    //   受け取らずに 204 で返す（ダッシュボードの来店数を外から水増しされないため）。
    //   同一オリジンの fetch は Sec-Fetch-Site: same-origin を必ず送る。
    //   古いブラウザ向けに Origin/Referer も見る。偽装は可能なので「lazyな妨害を弾く」措置。
    const sfs = request.headers.get('Sec-Fetch-Site');
    let host = '';
    try { host = new URL(request.headers.get('Origin') || request.headers.get('Referer') || '').hostname.toLowerCase(); } catch (e) { host = ''; }
    const ownHost = host === 'seam.site' || host.endsWith('.seam.site') || host.endsWith('.pages.dev') ||
                    host === 'localhost' || host === '127.0.0.1';
    if (!(sfs === 'same-origin' || sfs === 'same-site' || ownHost)) {
      return new Response(null, { status: 204 });
    }

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

// SEAM 第一者イベント収集 — Cloudflare Pages Function（cookieなし・個人情報なし）
// Analytics Engine の binding "SEAM_AE"(ダッシュボードで設定)があれば書き込み、無ければログのみ。
// 計測でサイトを壊さないため常に 204 を返し、例外は握りつぶす。
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const ev = await request.json().catch(() => ({}));
    const name = String(ev.e || 'unknown').slice(0, 40);
    // 集計に使う最小フィールドのみ（個人情報は持たない）
    const blobs = [
      name,
      String(ev.p || '').slice(0, 64),       // path
      String(ev.type || '').slice(0, 8),     // origin code (例 NNW)
      String(ev.advice || '').slice(0, 16),  // adviceKey
      String(ev.mode || '').slice(0, 4),     // a / b
      String(ev.gender || '').slice(0, 8),
    ];
    const doubles = [Number(ev.tier) || 0];  // damageTier 1-3
    if (env && env.SEAM_AE && typeof env.SEAM_AE.writeDataPoint === 'function') {
      env.SEAM_AE.writeDataPoint({ indexes: [name], blobs, doubles });
    } else {
      // binding 未設定でも CF Pages のリアルタイムログで確認可能
      console.log('[seam-ev]', JSON.stringify({ name, p: ev.p, type: ev.type, advice: ev.advice, tier: ev.tier, mode: ev.mode }));
    }
  } catch (e) { /* no-op */ }
  return new Response(null, { status: 204 });
}
// 動作確認用
export const onRequestGet = () => new Response('seam-ev ok', { status: 200, headers: { 'content-type': 'text/plain' } });

// SEAM 第一者イベント収集 — Cloudflare Pages Function（cookieなし・個人情報なし）
// 保存先の優先: ① D1 binding "DB"（永続・集計用） ② Analytics Engine "SEAM_AE" ③ ログのみ
// 計測でサイトを壊さないため常に 204 を返し、例外は握りつぶす。
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const ev = await request.json().catch(() => ({}));
    // 集計に使う最小フィールドのみ（個人情報は持たない）
    const name   = String(ev.e || 'unknown').slice(0, 40);
    const path   = String(ev.p || '').slice(0, 64);
    const type   = String(ev.type || '').slice(0, 8);    // origin code (例 NNW)
    const advice = String(ev.advice || '').slice(0, 16); // adviceKey
    const mode   = String(ev.mode || '').slice(0, 4);    // a / b
    const gender = String(ev.gender || '').slice(0, 8);
    const target = String(ev.target || '').slice(0, 20); // finder_cta: reserve_hpb / shop / product
    const label  = String(ev.label || '').slice(0, 24);  // finder_cta の文脈
    const tier   = Number(ev.tier) || 0;                 // damageTier 1-3

    // 流入属性（どこから来たか）— 個人は特定しない（チャネル名/自社UTM/端末種別/入口/国レベル）
    const ref     = String(ev.ref || '').slice(0, 24);          // 正規化チャネル: google/instagram/x/line/direct…
    const utmSrc  = String(ev.utm_source || '').slice(0, 32);
    const utmCmp  = String(ev.utm_campaign || '').slice(0, 48);
    const device  = String(ev.device || '').slice(0, 8);        // mobile / desktop
    const landing = String(ev.landing || '').slice(0, 64);      // 初回入口パス
    const country = String((request.cf && request.cf.country) || '').slice(0, 4); // CFが国コードを無料付与(非個人情報)

    // 予備JSON（utm_medium / lang / 診断プロファイルmeta = finder-app.jsx buildProfileMeta 参照）
    const metaObj = {};
    if (ev.utm_medium) metaObj.utm_medium = String(ev.utm_medium).slice(0, 24);
    if (ev.lang)       metaObj.lang = String(ev.lang).slice(0, 8);
    if (ev.meta && typeof ev.meta === 'object') Object.assign(metaObj, ev.meta);
    const meta = Object.keys(metaObj).length ? JSON.stringify(metaObj).slice(0, 1024) : null;

    let stored = false;

    // ① D1（推奨・行を永続保存して正確に集計）
    if (env && env.DB && typeof env.DB.prepare === 'function') {
      stored = true;
      context.waitUntil(
        env.DB.prepare(
          'INSERT INTO events (ts,name,path,type,advice,tier,mode,gender,target,label,ref,utm_source,utm_campaign,device,country,landing,meta) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(Date.now(), name, path, type, advice, tier || null, mode, gender, target, label, ref, utmSrc, utmCmp, device, country, landing, meta)
         .run().catch(() => {})
      );
    }

    // ② Analytics Engine（設定があれば併用）
    if (env && env.SEAM_AE && typeof env.SEAM_AE.writeDataPoint === 'function') {
      stored = true;
      env.SEAM_AE.writeDataPoint({ indexes: [name], blobs: [name, path, type, advice, mode, gender, target, label, ref, utmSrc, utmCmp, device, country, landing], doubles: [tier] });
    }

    // ③ どちらも未設定でも CF Pages のリアルタイムログで確認可能
    if (!stored) {
      console.log('[seam-ev]', JSON.stringify({ name, path, type, advice, tier, mode, gender, target, label, ref, utmSrc, utmCmp, device, country, landing }));
    }
  } catch (e) { /* no-op */ }
  return new Response(null, { status: 204 });
}
// 動作確認用
export const onRequestGet = () => new Response('seam-ev ok', { status: 200, headers: { 'content-type': 'text/plain' } });

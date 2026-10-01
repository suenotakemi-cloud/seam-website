// SEAM 診断の公開集計 — 完了数 / 完了率（集計値のみ・個人情報なし）
// トップの信頼指標に「本当の数字」を出すための読み取り専用エンドポイント。
// D1 binding "DB" が無い／データが無い時は completed:0 を返し、フロント側で非表示にする。
export async function onRequestGet(context) {
  const { env } = context;
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    // D1保護＆軽さ優先で10分キャッシュ（“ほぼ本当”の最新を安価に表示）
    'cache-control': 'public, max-age=600, s-maxage=600'
  };
  try {
    if (env && env.DB && typeof env.DB.prepare === 'function') {
      // 【計測修正の境目】これ以前は カルテ復元・共有リンクの表示でも finder_complete を
      // 送っていたため completed が水増しされている(日別の完了率が105〜109%と100%を超えていた)。
      // 過去は書き換えられないので、境目以降だけで計算した「クリーンな完答率」を併せて返す。
      // 境目 = 修正コミット d85e50e(13:03 JST)のCloudflare反映後。日付境界(00:00)にすると
      // 反映前の13時間分が混ざるため 安全側に13:15を採る。
      const CUTOVER = Date.parse('2026-07-30T13:15:00+09:00');
      const row = await env.DB.prepare(
        "SELECT " +
        "(SELECT COUNT(*) FROM events WHERE name='finder_start')    AS started, " +
        "(SELECT COUNT(*) FROM events WHERE name='finder_complete') AS completed, " +
        "(SELECT COUNT(*) FROM events WHERE name='finder_start'    AND ts >= ?) AS started2, " +
        "(SELECT COUNT(*) FROM events WHERE name='finder_complete' AND ts >= ?) AS completed2, " +
        // 9/3 14:24〜10/2 00:07 は完了の計測が抜けていた（結果画面の作り直しで移し忘れ）。
        // 最後の設問 headSpaInterest への到達で数える（admin/stats.js の GAP_WHERE と同じ条件・所有者 10/2「正しいものに」）
        "(SELECT COUNT(*) FROM events WHERE name='finder_step' AND label='headSpaInterest' AND ts > 1788413089971 AND ts < " + Date.parse('2026-10-02T00:07:22+09:00') +
        " AND NOT (ts BETWEEN " + Date.parse('2026-10-01T22:07:00+09:00') + " AND " + Date.parse('2026-10-01T22:16:30+09:00') + " AND ref='direct' AND landing='/finder')" +
        " AND (utm_campaign IS NULL OR utm_campaign<>'__test__')) AS gap"
      ).bind(CUTOVER, CUTOVER).first();
      const gap = Math.max(0, Number(row && row.gap) || 0);
      const started   = Math.max(0, Number(row && row.started)   || 0);
      const completed = Math.max(0, Number(row && row.completed) || 0) + gap;
      const started2   = Math.max(0, Number(row && row.started2)   || 0);
      const completed2 = Math.max(0, Number(row && row.completed2) || 0) + gap;
      // 完了率は開始が十分ある時だけ（0除算・過小サンプルの誤誘導を避ける）
      const rate = started >= 20 ? Math.round((completed / started) * 100) : null;
      // クリーン値も同じ下限を守る(サンプルが溜まるまでは null=出さない)
      const rateClean = started2 >= 20 ? Math.round((completed2 / started2) * 100) : null;
      return new Response(JSON.stringify({
        started, completed, rate,
        // 公表用: 計測修正後だけの値。started2が20を超えるまでは rateClean は null
        since: CUTOVER, started_since: started2, completed_since: completed2, rate_clean: rateClean
      }), { headers });
    }
  } catch (e) { /* no-op: 計測でサイトを壊さない */ }
  return new Response(JSON.stringify({ started: 0, completed: 0, rate: null }), { headers });
}

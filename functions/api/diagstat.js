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
      const row = await env.DB.prepare(
        "SELECT " +
        "(SELECT COUNT(*) FROM events WHERE name='finder_start')    AS started, " +
        "(SELECT COUNT(*) FROM events WHERE name='finder_complete') AS completed"
      ).first();
      const started   = Math.max(0, Number(row && row.started)   || 0);
      const completed = Math.max(0, Number(row && row.completed) || 0);
      // 完了率は開始が十分ある時だけ（0除算・過小サンプルの誤誘導を避ける）
      const rate = started >= 20 ? Math.round((completed / started) * 100) : null;
      return new Response(JSON.stringify({ started, completed, rate }), { headers });
    }
  } catch (e) { /* no-op: 計測でサイトを壊さない */ }
  return new Response(JSON.stringify({ started: 0, completed: 0, rate: null }), { headers });
}

// CSPの違反を受け取る口（Cloudflare Pages Function）
// ルート: POST /csp-report
//
// _headers の Content-Security-Policy-Report-Only が、
// 「本当はここで止めたい」という形を書いている。
// いきなり止めると画面が死ぬので、まず違反だけを集める。
//
// 集まったものを見て
//   ・うちが本当に使っている先 → 許可に足す
//   ・見覚えのない先          → 差し込まれたコードの疑い
// を分けてから、Report-Only を外して本当に止める。
//
// ★ここは誰でも叩ける口なので、
//   ・中身は決まった長さで切る
//   ・同じ違反は1日1行にまとめる（同じ人が何万回も出せるため）
//   ・個人情報は入れない（URLのクエリは落とす）

export async function onRequestPost(context) {
  const { request, env } = context;
  const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  const J = (o, s = 204) => new Response(s === 204 ? null : JSON.stringify(o), { status: s, headers: H });

  if (!env || !env.DB) return J({}, 204);

  let body;
  try { body = await request.json(); } catch { return J({}, 204); }
  const r = (body && (body['csp-report'] || body)) || {};

  /* URLのクエリは落とす。合言葉や電話番号が混ざることがある */
  const clean = (v) => {
    let s = String(v == null ? '' : v).slice(0, 300);
    const q = s.indexOf('?');
    return q >= 0 ? s.slice(0, q) : s;
  };

  const directive = String(r['effective-directive'] || r['violated-directive'] || '').slice(0, 60);
  const blocked = clean(r['blocked-uri']);
  const doc = clean(r['document-uri']);
  const day = new Date().toISOString().slice(0, 10);
  const key = [day, directive, blocked, doc].join('|').slice(0, 400);

  try {
    await env.DB.prepare(
      `CREATE TABLE IF NOT EXISTS csp_report (
         key TEXT PRIMARY KEY, day TEXT, directive TEXT, blocked TEXT,
         doc TEXT, sample TEXT, n INTEGER DEFAULT 1, at TEXT)`
    ).run();
    /* 同じ違反は数だけ増やす */
    await env.DB.prepare(
      `INSERT INTO csp_report (key,day,directive,blocked,doc,sample,n,at)
       VALUES (?,?,?,?,?,?,1,?)
       ON CONFLICT(key) DO UPDATE SET n = csp_report.n + 1, at = excluded.at`
    ).bind(key, day, directive, blocked, doc,
      String(r['script-sample'] || '').slice(0, 120), new Date().toISOString()).run();
  } catch (e) { /* 集計が落ちても画面には影響させない */ }

  return J({}, 204);
}

/* 集まったものを見る口。合言葉が要る。
   例: /csp-report?key=... */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = request.headers.get('x-seam-key') || url.searchParams.get('key') || '';
  const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  if (!env || !env.ADMIN_KEY || key !== env.ADMIN_KEY)
    return new Response(JSON.stringify({ ok: false }), { status: 401, headers: H });
  if (!env.DB) return new Response(JSON.stringify({ ok: false, reason: 'no_db' }), { status: 500, headers: H });
  try {
    const res = await env.DB.prepare(
      `SELECT day,directive,blocked,doc,n,at FROM csp_report ORDER BY n DESC, at DESC LIMIT 300`
    ).all();
    return new Response(JSON.stringify({ ok: true, rows: res.results || [] }), { headers: H });
  } catch (e) {
    return new Response(JSON.stringify({ ok: true, rows: [] }), { headers: H });
  }
}

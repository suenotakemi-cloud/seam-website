// 求人ページの入口→応募までの通り道を数える（2026-09-16・所有者「アクセスは良いが問い合わせが来ない」の診断用）
// GET /api/admin/recruit-funnel?days=30   … x-seam-key or ?key= が ADMIN_KEY と一致必須（/admin-inbox.html が使う）
//
// 元データは events 表（js/seam-analytics.js が送る第一者イベント・個人情報なし）:
//   page_view(path) / page_engage(meta.sec 実閲覧秒, meta.sd 最大スクロール深度%) / sec_view(label 露出) / sec_click(label タップ)
//   recruit_form_sent / recruit_save / recruit_apply_line
// 5 件未満の内訳は出さない（n<5 は伏せる）。

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function checkKey(request, env) {
  const url = new URL(request.url);
  const key = (request.headers.get('x-seam-key') || url.searchParams.get('key') || '').trim();
  const want = (env.ADMIN_KEY || '').trim();
  if (!want) return { ok: false, keyConfigured: false };
  return { ok: key === want, keyConfigured: true };
}
const MIN = 5;
const hide = rows => rows.filter(r => (r.c || 0) >= MIN);
function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); }

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ configured: false });
  const auth = checkKey(request, env);
  if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);
  const url = new URL(request.url);
  const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10) || 30, 1), 365);
  const since = Date.now() - days * 86400000;
  const R = "(path LIKE '/recruit%' OR path LIKE '/%/recruit%')";
  const q = async (sql, ...b) => { try { const r = await db.prepare(sql).bind(...b).all(); return r.results || []; } catch (e) { return []; } };

  const [views, sources, devices, daily, exposure, clicks, sent, saved, engageRows, landings] = await Promise.all([
    q("SELECT path, COUNT(*) c FROM events WHERE name='page_view' AND " + R + " AND ts>=? GROUP BY path ORDER BY c DESC LIMIT 30", since),
    q("SELECT COALESCE(NULLIF(ref,''),'(なし)') ref, COALESCE(NULLIF(utm_campaign,''),'') cmp, COUNT(*) c FROM events WHERE name='page_view' AND " + R + " AND ts>=? GROUP BY ref, cmp ORDER BY c DESC LIMIT 20", since),
    q("SELECT COALESCE(NULLIF(device,''),'?') d, COUNT(*) c FROM events WHERE name='page_view' AND " + R + " AND ts>=? GROUP BY d ORDER BY c DESC", since),
    q("SELECT date(ts/1000,'unixepoch','localtime') d, SUM(name='page_view') v, SUM(name='sec_click' AND label IN ('recruit_apply_line','recruit_apply_ig')) k, SUM(name='recruit_form_sent') f FROM events WHERE " + R + " AND ts>=? GROUP BY d ORDER BY d", since),
    q("SELECT label, COUNT(*) c FROM events WHERE name='sec_view' AND label LIKE 'recruit%' AND ts>=? GROUP BY label ORDER BY c DESC", since),
    q("SELECT label, path, COUNT(*) c FROM events WHERE name='sec_click' AND label LIKE 'recruit%' AND ts>=? GROUP BY label, path ORDER BY c DESC LIMIT 40", since),
    q("SELECT COUNT(*) c, COALESCE(NULLIF(ref,''),'(なし)') ref FROM events WHERE name='recruit_form_sent' AND ts>=? GROUP BY ref ORDER BY c DESC", since),
    q("SELECT COUNT(*) c FROM events WHERE name='recruit_save' AND ts>=?", since),
    q("SELECT path, meta FROM events WHERE name='page_engage' AND " + R + " AND ts>=? ORDER BY ts DESC LIMIT 4000", since),
    q("SELECT COALESCE(NULLIF(landing,''),'?') l, COUNT(*) c FROM events WHERE name='page_view' AND " + R + " AND ts>=? GROUP BY l ORDER BY c DESC LIMIT 10", since),
  ]);

  // 実閲覧秒・スクロール深度の中央値（path ごと）
  const eng = {};
  for (const r of engageRows) {
    let m = null; try { m = JSON.parse(r.meta || '{}'); } catch (e) {}
    if (!m) continue;
    const e = (eng[r.path] = eng[r.path] || { sec: [], sd: [], n: 0 });
    if (typeof m.sec === 'number') e.sec.push(m.sec);
    if (typeof m.sd === 'number') e.sd.push(m.sd);
    e.n++;
  }
  const engage = Object.entries(eng).filter(([, e]) => e.n >= MIN).map(([path, e]) => ({ path, n: e.n, secMedian: median(e.sec), sdMedian: median(e.sd), reachedForm: e.sd.length ? Math.round(100 * e.sd.filter(v => v >= 85).length / e.sd.length) : null })).sort((a, b) => b.n - a.n);

  const totalViews = views.reduce((a, r) => a + r.c, 0);
  const totalClicks = clicks.reduce((a, r) => a + r.c, 0);
  const totalSent = sent.reduce((a, r) => a + r.c, 0);
  return json({
    configured: true, days, since,
    summary: { views: totalViews, exposure: exposure.reduce((a, r) => a + r.c, 0), clicks: totalClicks, sent: totalSent, saved: (saved[0] && saved[0].c) || 0 },
    views: hide(views), sources: hide(sources), devices: hide(devices), landings: hide(landings), daily,
    exposure: hide(exposure), clicks: hide(clicks), sentBySource: hide(sent), engage,
    minCell: MIN,
  });
}

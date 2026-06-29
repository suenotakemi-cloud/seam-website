// SEAM 診断データ 集計API（管理画面用）— D1 を集計して JSON で返す
// 保護: env.ADMIN_KEY と一致するキー（x-seam-key ヘッダ or ?key=）が無いと 401
// D1 binding "DB" 未設定なら configured:false を返す（画面側で設定手順を表示）
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const key = request.headers.get('x-seam-key') || url.searchParams.get('key') || '';

  if (!env || !env.ADMIN_KEY || key !== env.ADMIN_KEY) {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return json({ configured: false, message: 'D1 binding "DB" が未設定です（CFダッシュボードで設定してください）' }, 200);
  }

  const db = env.DB;
  const days = Math.min(365, Math.max(7, Number(url.searchParams.get('days')) || 90));
  const since = Date.now() - 1000 * 60 * 60 * 24 * days;

  try {
    const q = (sql, ...binds) => {
      const st = db.prepare(sql);
      return (binds.length ? st.bind(...binds) : st).all();
    };
    const [totals, byType, byAdvice, byTier, byGender, byMode, ctaTarget, daily,
           bySource, byCampaign, byDevice, byCountry, byLanding, sourceFunnel, recent] = await Promise.all([
      q("SELECT name, COUNT(*) c FROM events GROUP BY name"),
      q("SELECT type t, COUNT(*) c FROM events WHERE name='finder_complete' AND type<>'' GROUP BY type ORDER BY c DESC"),
      q("SELECT advice a, COUNT(*) c FROM events WHERE name='finder_complete' AND advice<>'' GROUP BY advice ORDER BY c DESC"),
      q("SELECT tier, COUNT(*) c FROM events WHERE name='finder_complete' AND tier>0 GROUP BY tier ORDER BY tier"),
      q("SELECT gender g, COUNT(*) c FROM events WHERE name='finder_complete' AND gender<>'' GROUP BY gender ORDER BY c DESC"),
      q("SELECT mode m, COUNT(*) c FROM events WHERE name='finder_start' AND mode<>'' GROUP BY mode"),
      q("SELECT target, COUNT(*) c FROM events WHERE name='finder_cta' AND target<>'' GROUP BY target ORDER BY c DESC"),
      q("SELECT date(ts/1000,'unixepoch','localtime') d, COUNT(*) c FROM events WHERE name='finder_complete' AND ts>=? GROUP BY d ORDER BY d", since),
      // ── 流入（どこから来たか） ──
      q("SELECT ref, COUNT(*) c FROM events WHERE name='finder_complete' AND ref<>'' GROUP BY ref ORDER BY c DESC"),
      q("SELECT utm_campaign u, COUNT(*) c FROM events WHERE name='finder_complete' AND utm_campaign<>'' GROUP BY utm_campaign ORDER BY c DESC LIMIT 20"),
      q("SELECT device d, COUNT(*) c FROM events WHERE name='finder_complete' AND device<>'' GROUP BY device ORDER BY c DESC"),
      q("SELECT country, COUNT(*) c FROM events WHERE name='finder_complete' AND country<>'' GROUP BY country ORDER BY c DESC LIMIT 15"),
      q("SELECT landing, COUNT(*) c FROM events WHERE name='finder_complete' AND landing<>'' GROUP BY landing ORDER BY c DESC LIMIT 15"),
      // チャネル別ファネル（流入元→開始/完了/予約CTA）
      q("SELECT ref, name, COUNT(*) c FROM events WHERE name IN ('finder_start','finder_complete','finder_cta') AND ref<>'' GROUP BY ref, name"),
      // 最近のアクティビティ（履歴ログ）
      q("SELECT ts, name, type, advice, tier, ref, utm_campaign, target, device, gender FROM events WHERE name IN ('finder_complete','finder_cta') ORDER BY ts DESC LIMIT 60"),
    ]);
    const tmap = {};
    (totals.results || []).forEach(r => { tmap[r.name] = r.c; });

    // チャネル別ファネルを ref ごとに集約 [{ref, starts, completes, ctas}]
    const sf = {};
    (sourceFunnel.results || []).forEach(r => {
      const o = sf[r.ref] || (sf[r.ref] = { ref: r.ref, starts: 0, completes: 0, ctas: 0 });
      if (r.name === 'finder_start') o.starts = r.c;
      else if (r.name === 'finder_complete') o.completes = r.c;
      else if (r.name === 'finder_cta') o.ctas = r.c;
    });
    const sourceFunnelArr = Object.keys(sf).map(k => sf[k])
      .sort((a, b) => (b.completes || b.starts) - (a.completes || a.starts));

    return json({
      configured: true,
      generatedAt: Date.now(),
      windowDays: days,
      summary: {
        starts: tmap['finder_start'] || 0,
        completes: tmap['finder_complete'] || 0,
        ctas: tmap['finder_cta'] || 0,
      },
      byType: byType.results || [],
      byAdvice: byAdvice.results || [],
      byTier: byTier.results || [],
      byGender: byGender.results || [],
      byMode: byMode.results || [],
      ctaTarget: ctaTarget.results || [],
      daily: daily.results || [],
      bySource: bySource.results || [],
      byCampaign: byCampaign.results || [],
      byDevice: byDevice.results || [],
      byCountry: byCountry.results || [],
      byLanding: byLanding.results || [],
      sourceFunnel: sourceFunnelArr,
      recent: recent.results || [],
    });
  } catch (e) {
    return json({ configured: true, error: String((e && e.message) || e) }, 500);
  }
}

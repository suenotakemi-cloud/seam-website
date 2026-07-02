// SEAM 診断データ 集計API（管理画面用）— D1 を集計して JSON で返す
// 保護: env.ADMIN_KEY と一致するキー（x-seam-key ヘッダ or ?key=）が無いと 401
// D1 binding "DB" 未設定なら configured:false を返す（画面側で設定手順を表示）
function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

// ── 診断プロファイル集計 ──────────────────────────────────
// meta(JSON) の短縮キーは finder-app.jsx buildProfileMeta と同期:
//   age th dn wv rv sc cl cf bl st pm pt plz gy gf gt gl hs cs[] sf[] ms[] tl[] tp
// 判定の定義（admin.html の注記とも同期）:
//   くせあり      = wv ∈ {humid,surface,root,midEnd,whole}（straightened=矯正中は別掲）
//   ブリーチ経験  = bl ≠ none
//   白髪ケア中    = gy=yes または cl=gray（白髪染め）
//   白髪悩み      = cs に grayFade
//   パーマ現役    = pm ∈ {yearly,biannual,quarterly,frequent,digital,loose}
//   パーマ経験    = 現役 + endsRemain + past
//   カール意欲    = sf に curl または hold
const KUSE_SET = { humid: 1, surface: 1, root: 1, midEnd: 1, whole: 1 };
const PERM_NOW = { yearly: 1, biannual: 1, quarterly: 1, frequent: 1, digital: 1, loose: 1 };

export function aggregateProfiles(rows) { // export=ブラウザからの単体検証用(CF Functionsでは無害)
  const inc = (o, k, by) => { if (k == null || k === '') return; o[k] = (o[k] || 0) + (by || 1); };
  const inc2 = (o, k1, k2) => { if (k1 == null || k2 == null) return; (o[k1] = o[k1] || {}); o[k1][k2] = (o[k1][k2] || 0) + 1; };
  const P = {
    n: 0,
    byAge: {},                       // 年代分布
    concernTotal: {},  concernByAge: {},   // 悩み(複数)
    textureTotal: {},  textureByAge: {},   // 理想の質感
    goalTotal: {},                          // 髪の目標
    waveTotal: {},                          // くせ分布(生値)
    kuseByAge: {},     straightenedByAge: {}, // くせあり/矯正中(年代別 分子)
    bleachTotal: {},   bleachByAge: {},     // ブリーチ内訳 + 経験(年代別 分子)
    grayCareByAge: {}, grayConcernByAge: {}, grayFreqTotal: {}, // 白髪
    permTotal: {}, permTypeTotal: {}, permLooseTotal: {},
    permNowByAge: {},  permExpByAge: {},  curlWantByAge: {},   // パーマ・カール(年代別 分子)
    straightenTotal: {},
    thicknessTotal: {}, thicknessWave: {},  // 髪質マップ th × {none|kuse|straightened}
    stylingFinishTotal: {}, menStylingTotal: {}, tempTotal: {}, toolsTotal: {},
    scalpTotal: {}, spaByAge: {},
    concernTexture: {},                     // 「悩み→求める質感」ペア
    monthly: {},                            // YYYY-MM → {n,kuse,bleach,gray,permNow,curlWant}
  };
  for (const row of rows) {
    let m;
    try { m = JSON.parse(row.meta); } catch (e) { continue; }
    if (!m || !m.age) continue; // プロファイル付き完了のみ（旧イベントは対象外）
    P.n++;
    const age = m.age;
    inc(P.byAge, age);
    const cs = Array.isArray(m.cs) ? m.cs : [];
    const sf = Array.isArray(m.sf) ? m.sf : [];
    // 悩み
    for (const c of cs) { inc(P.concernTotal, c); inc2(P.concernByAge, c, age); }
    // 質感・目標
    inc(P.textureTotal, m.gt); if (m.gt) inc2(P.textureByAge, m.gt, age);
    inc(P.goalTotal, m.gl);
    // くせ
    inc(P.waveTotal, m.wv);
    const isKuse = !!KUSE_SET[m.wv];
    if (isKuse) inc(P.kuseByAge, age);
    if (m.wv === 'straightened') inc(P.straightenedByAge, age);
    // ブリーチ
    inc(P.bleachTotal, m.bl);
    const isBleach = !!m.bl && m.bl !== 'none';
    if (isBleach) inc(P.bleachByAge, age);
    // 白髪
    const isGrayCare = m.gy === 'yes' || m.cl === 'gray';
    if (isGrayCare) inc(P.grayCareByAge, age);
    if (cs.indexOf('grayFade') > -1) inc(P.grayConcernByAge, age);
    inc(P.grayFreqTotal, m.gf);
    // パーマ・カール
    inc(P.permTotal, m.pm); inc(P.permTypeTotal, m.pt); inc(P.permLooseTotal, m.plz);
    const isPermNow = !!PERM_NOW[m.pm];
    const isPermExp = isPermNow || m.pm === 'endsRemain' || m.pm === 'past';
    const isCurlWant = sf.indexOf('curl') > -1 || sf.indexOf('hold') > -1;
    if (isPermNow) inc(P.permNowByAge, age);
    if (isPermExp) inc(P.permExpByAge, age);
    if (isCurlWant) inc(P.curlWantByAge, age);
    // 縮毛矯正
    inc(P.straightenTotal, m.st);
    // 髪質マップ
    inc(P.thicknessTotal, m.th);
    if (m.th) inc2(P.thicknessWave, m.th, m.wv === 'straightened' ? 'straightened' : (isKuse ? 'kuse' : 'none'));
    // スタイリング・頭皮・スパ
    for (const s of sf) inc(P.stylingFinishTotal, s);
    for (const s of (Array.isArray(m.ms) ? m.ms : [])) inc(P.menStylingTotal, s);
    for (const t of (Array.isArray(m.tl) ? m.tl : [])) inc(P.toolsTotal, t);
    inc(P.tempTotal, m.tp);
    inc(P.scalpTotal, m.sc);
    if (m.hs === 'yes') inc(P.spaByAge, age);
    // 悩み × 質感（広告コピー素材: 何に悩み 何を求めるか）
    if (m.gt) for (const c of cs) inc(P.concernTexture, c + '|' + m.gt);
    // 月次トレンド
    const ym = new Date(row.ts).toISOString().slice(0, 7);
    const mo = P.monthly[ym] || (P.monthly[ym] = { n: 0, kuse: 0, bleach: 0, gray: 0, permNow: 0, curlWant: 0 });
    mo.n++;
    if (isKuse) mo.kuse++;
    if (isBleach) mo.bleach++;
    if (isGrayCare) mo.gray++;
    if (isPermNow) mo.permNow++;
    if (isCurlWant) mo.curlWant++;
  }
  return P;
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
    // 診断プロファイル（meta JSON）— 期間内の完了イベントをJS側で集計（列追加なし・D1マイグレーション不要）
    const profileRows = await q(
      "SELECT ts, meta FROM events WHERE name='finder_complete' AND meta IS NOT NULL AND ts>=? ORDER BY ts DESC LIMIT 100000", since
    );
    const profile = aggregateProfiles(profileRows.results || []);
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
      profile,
    });
  } catch (e) {
    return json({ configured: true, error: String((e && e.message) || e) }, 500);
  }
}

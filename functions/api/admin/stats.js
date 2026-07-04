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
//   矯正現役      = st ∈ {yearly,biannual,quarterly,frequent,kaizen}（past/noneは除外）
const ST_NOW = { yearly: 1, biannual: 1, quarterly: 1, frequent: 1, kaizen: 1 };

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
    stHiddenN: 0,                           // 隠れ矯正(sth=1: サロン呼称は髪質改善・仕上がりは矯正系)
    rediagN: 0, rediagDaysSum: 0,           // 再診断(rd=1)とその間隔合計(平均=Sum/N)
    thicknessTotal: {}, thicknessWave: {},  // 髪質マップ th × {none|kuse|straightened}
    stylingFinishTotal: {}, menStylingTotal: {}, tempTotal: {}, toolsTotal: {},
    scalpTotal: {}, spaByAge: {},
    concernTexture: {},                     // 「悩み→求める質感」ペア
    chemCross: {},                          // 薬剤履歴の重なり(ブリーチ×矯正現役×パーマ現役の8区分)
    // ── ディーラー・仕入れ詳細(v2 追加キー: ln ss sa[] blc hp[] ht[] it[] ci[] ls[] ev wl[] dv[]) ──
    lengthTotal: {},                        // 髪の長さ
    scalpSensTotal: {}, allergyTotal: {},   // 頭皮の敏感さ / 薬剤反応・アレルギー
    bleachLocTotal: {},                     // ブリーチ残存箇所
    heatProtectTotal: {},                   // 熱保護アイテムの使用
    troubleTotal: {}, bibiriByAge: {},      // 過去のヘアトラブル / ビビリ毛経験(年代別 分子)
    itemsTotal: {},                         // 使用中ホームケアアイテム
    concernsItemTotal: {},                  // 今のアイテムへの不満(スイッチングシグナル)
    lifestyleTotal: {}, envTotal: {},       // ライフスタイル / 環境
    wellnessTotal: {},                      // ウェルネス症状(スパ商材文脈)
    deviceTotal: {}, deviceWantByAge: {},   // 美容家電の希望 / 希望あり率(年代別 分子)
    // ── v3 価格受容性(bs/bt/bo/bm=1回に払う金額帯・up=値上がり許容・ic=投資カテゴリ・bp=購入場所[]) ──
    budgetSh: {}, budgetTr: {}, budgetOb: {}, budgetMk: {},
    upgradeTotal: {}, upgradeYesByAge: {},  // 「合うなら投資したい」率(年代別 分子)=プレミアム許容の金脈
    investCatTotal: {}, buyPlaceTotal: {},
    monthly: {},                            // YYYY-MM → {n,kuse,bleach,gray,permNow,curlWant}
  };
  for (const row of rows) {
    let m;
    if (row.__m) { m = row.__m; }
    else { try { m = JSON.parse(row.meta); } catch (e) { continue; } }
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
    if (m.sth) P.stHiddenN++;
    if (m.rd) { P.rediagN++; P.rediagDaysSum += Number(m.rdd) || 0; }
    // 価格受容性
    inc(P.budgetSh, m.bs); inc(P.budgetTr, m.bt); inc(P.budgetOb, m.bo); inc(P.budgetMk, m.bm);
    inc(P.upgradeTotal, m.up);
    if (m.up === 'yes') inc(P.upgradeYesByAge, age);
    inc(P.investCatTotal, m.ic);
    for (const v of (Array.isArray(m.bp) ? m.bp : [])) inc(P.buyPlaceTotal, v);
    // 薬剤履歴の重なり（メーカー向け: ダブル/トリプルプロセス毛の実サイズ）
    const isStNow = !!ST_NOW[m.st];
    inc(P.chemCross, isBleach
      ? (isStNow ? (isPermNow ? 'triple' : 'bleachStraight') : (isPermNow ? 'bleachPerm' : 'bleachOnly'))
      : (isStNow ? (isPermNow ? 'straightPerm' : 'straightOnly') : (isPermNow ? 'permOnly' : 'none')));
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
    // ── ディーラー・仕入れ詳細 ──
    inc(P.lengthTotal, m.ln);
    inc(P.scalpSensTotal, m.ss);
    for (const v of (Array.isArray(m.sa) ? m.sa : [])) inc(P.allergyTotal, v);
    inc(P.bleachLocTotal, m.blc);
    for (const v of (Array.isArray(m.hp) ? m.hp : [])) inc(P.heatProtectTotal, v);
    const ht = Array.isArray(m.ht) ? m.ht : [];
    for (const v of ht) if (v !== 'none') inc(P.troubleTotal, v);
    if (ht.indexOf('bibiri') > -1) inc(P.bibiriByAge, age);
    for (const v of (Array.isArray(m.it) ? m.it : [])) inc(P.itemsTotal, v);
    for (const v of (Array.isArray(m.ci) ? m.ci : [])) if (v !== 'none') inc(P.concernsItemTotal, v);
    for (const v of (Array.isArray(m.ls) ? m.ls : [])) inc(P.lifestyleTotal, v);
    inc(P.envTotal, m.ev);
    for (const v of (Array.isArray(m.wl) ? m.wl : [])) if (v !== 'well') inc(P.wellnessTotal, v);
    const dv = (Array.isArray(m.dv) ? m.dv : []).filter(v => v !== 'none');
    for (const v of dv) inc(P.deviceTotal, v);
    if (dv.length) inc(P.deviceWantByAge, age);
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
    // テスト行の自動除外 — utm_campaign='__test__' 印は全集計に含めない
    // （テストは https://seam.site/finder?utm_campaign=__test__ で行う運用）
    const NT = "(utm_campaign IS NULL OR utm_campaign<>'__test__')";
    const [totals, byType, byAdvice, byTier, byGender, byMode, ctaTarget, daily,
           bySource, byCampaign, byDevice, byCountry, byLanding, sourceFunnel, recent] = await Promise.all([
      q("SELECT name, COUNT(*) c FROM events WHERE " + NT + " GROUP BY name"),
      q("SELECT type t, COUNT(*) c FROM events WHERE name='finder_complete' AND type<>'' AND " + NT + " GROUP BY type ORDER BY c DESC"),
      q("SELECT advice a, COUNT(*) c FROM events WHERE name='finder_complete' AND advice<>'' AND " + NT + " GROUP BY advice ORDER BY c DESC"),
      q("SELECT tier, COUNT(*) c FROM events WHERE name='finder_complete' AND tier>0 AND " + NT + " GROUP BY tier ORDER BY tier"),
      q("SELECT gender g, COUNT(*) c FROM events WHERE name='finder_complete' AND gender<>'' AND " + NT + " GROUP BY gender ORDER BY c DESC"),
      q("SELECT mode m, COUNT(*) c FROM events WHERE name='finder_start' AND mode<>'' AND " + NT + " GROUP BY mode"),
      q("SELECT target, COUNT(*) c FROM events WHERE name='finder_cta' AND target<>'' AND " + NT + " GROUP BY target ORDER BY c DESC"),
      q("SELECT date(ts/1000,'unixepoch','localtime') d, COUNT(*) c FROM events WHERE name='finder_complete' AND ts>=? AND " + NT + " GROUP BY d ORDER BY d", since),
      // ── 流入（どこから来たか） ──
      q("SELECT ref, COUNT(*) c FROM events WHERE name='finder_complete' AND ref<>'' AND " + NT + " GROUP BY ref ORDER BY c DESC"),
      q("SELECT utm_campaign u, COUNT(*) c FROM events WHERE name='finder_complete' AND utm_campaign<>'' AND " + NT + " GROUP BY utm_campaign ORDER BY c DESC LIMIT 20"),
      q("SELECT device d, COUNT(*) c FROM events WHERE name='finder_complete' AND device<>'' AND " + NT + " GROUP BY device ORDER BY c DESC"),
      q("SELECT country, COUNT(*) c FROM events WHERE name='finder_complete' AND country<>'' AND " + NT + " GROUP BY country ORDER BY c DESC LIMIT 15"),
      q("SELECT landing, COUNT(*) c FROM events WHERE name='finder_complete' AND landing<>'' AND " + NT + " GROUP BY landing ORDER BY c DESC LIMIT 15"),
      // チャネル別ファネル（流入元→開始/完了/予約CTA）
      q("SELECT ref, name, COUNT(*) c FROM events WHERE name IN ('finder_start','finder_complete','finder_cta') AND ref<>'' AND " + NT + " GROUP BY ref, name"),
      // 最近のアクティビティ（履歴ログ）
      q("SELECT ts, name, type, advice, tier, ref, utm_campaign, target, device, gender FROM events WHERE name IN ('finder_complete','finder_cta') AND " + NT + " ORDER BY ts DESC LIMIT 60"),
    ]);
    // ── 行動計測 v3: 検索ワード / ブランド関心 / ページ閲覧・滞在 / セクション露出→タップ ──
    const [brandSearch, brandClick, pageViews, pageEngage, secEngageRaw, funnelRaw, finderFunnelRaw] = await Promise.all([
      q("SELECT label, COUNT(*) c FROM events WHERE name='brand_search' AND label<>'' AND ts>=? AND " + NT + " GROUP BY label ORDER BY c DESC LIMIT 30", since),
      q("SELECT label, COUNT(*) c FROM events WHERE name='brand_click' AND label<>'' AND ts>=? AND " + NT + " GROUP BY label ORDER BY c DESC LIMIT 30", since),
      q("SELECT path, COUNT(*) c FROM events WHERE name='page_view' AND ts>=? AND " + NT + " GROUP BY path ORDER BY c DESC LIMIT 24", since),
      q("SELECT path, COUNT(*) c, ROUND(AVG(CAST(json_extract(meta,'$.sec') AS REAL))) sec, ROUND(AVG(CAST(json_extract(meta,'$.sd') AS REAL))) sd FROM events WHERE name='page_engage' AND meta IS NOT NULL AND ts>=? AND " + NT + " GROUP BY path ORDER BY c DESC LIMIT 24", since),
      q("SELECT label, name, COUNT(*) c FROM events WHERE name IN ('sec_view','sec_click') AND label<>'' AND ts>=? AND " + NT + " GROUP BY label, name", since),
      q("SELECT name, path, label, COUNT(*) c FROM events WHERE ts>=? AND " + NT + " AND ((name='page_view' AND path IN ('/hairsalon','/hairsalon.html','/headspa','/headspa.html')) OR (name='sec_view' AND label IN ('salon_booking','spa_booking')) OR (name='sec_click' AND label IN ('salon_reserve_hpb','salon_reserve_stylist','spa_reserve_hpb','spa_reserve_spanist','book_sticky','book_sticky_spa'))) GROUP BY name, path, label", since),
      // ファインダー通過ファネル: ページを開いた(page_view /finder) → 診断を始めた(finder_start) → 完了(finder_complete)
      q("SELECT name, COUNT(*) c FROM events WHERE ts>=? AND " + NT + " AND ((name='page_view' AND path IN ('/finder','/finder.html')) OR name IN ('finder_start','finder_complete')) GROUP BY name", since),
    ]);
    // 露出→タップをラベルごとに集約 [{label, views, clicks}]
    const seMap = {};
    (secEngageRaw.results || []).forEach(r => {
      const o = seMap[r.label] || (seMap[r.label] = { label: r.label, views: 0, clicks: 0 });
      if (r.name === 'sec_view') o.views = r.c; else o.clicks = r.c;
    });
    const secEngage = Object.keys(seMap).map(k => seMap[k]).sort((a, b) => (b.views || b.clicks) - (a.views || a.clicks));
    // ファインダー通過ファネル: 開いた → 始めた → 完了（期間内・回数ベース／Cookie無しのため「人数」ではなく「回数」）
    const finderFunnel = { opened: 0, started: 0, completed: 0 };
    (finderFunnelRaw.results || []).forEach(r => {
      if (r.name === 'page_view') finderFunnel.opened = r.c;
      else if (r.name === 'finder_start') finderFunnel.started = r.c;
      else if (r.name === 'finder_complete') finderFunnel.completed = r.c;
    });
    // 予約ファネル: ページ閲覧 → 予約エリア到達(sec_view) → 予約クリック(HPB遷移/指名/追従)
    const bookingFunnel = { salon: { pv: 0, area: 0, hpb: 0, stylist: 0, sticky: 0 }, spa: { pv: 0, area: 0, hpb: 0, spanist: 0, sticky: 0 } };
    (funnelRaw.results || []).forEach(r => {
      if (r.name === 'page_view') {
        if (String(r.path).indexOf('/hairsalon') === 0) bookingFunnel.salon.pv += r.c;
        else if (String(r.path).indexOf('/headspa') === 0) bookingFunnel.spa.pv += r.c;
      } else if (r.name === 'sec_view') {
        if (r.label === 'salon_booking') bookingFunnel.salon.area += r.c;
        if (r.label === 'spa_booking')   bookingFunnel.spa.area += r.c;
      } else if (r.name === 'sec_click') {
        if (r.label === 'salon_reserve_hpb')     bookingFunnel.salon.hpb += r.c;
        if (r.label === 'salon_reserve_stylist') bookingFunnel.salon.stylist += r.c;
        if (r.label === 'book_sticky')           bookingFunnel.salon.sticky += r.c;
        if (r.label === 'spa_reserve_hpb')       bookingFunnel.spa.hpb += r.c;
        if (r.label === 'spa_reserve_spanist')   bookingFunnel.spa.spanist += r.c;
        if (r.label === 'book_sticky_spa')       bookingFunnel.spa.sticky += r.c;
      }
    });
    // 診断プロファイル（meta JSON）— 期間内の完了イベントをJS側で集計（列追加なし・D1マイグレーション不要）
    // セグメント(プロファイル系にのみ適用): sage=年代コード / scs=悩みコード
    const sage = (url.searchParams.get('sage') || '').slice(0, 16);
    const scs  = (url.searchParams.get('scs')  || '').slice(0, 24);
    const since2 = since - 1000 * 60 * 60 * 24 * days; // 前期(同じ長さの直前ウィンドウ)
    const profileRows = await q(
      "SELECT ts, meta FROM events WHERE name='finder_complete' AND meta IS NOT NULL AND ts>=? AND " + NT + " ORDER BY ts DESC LIMIT 100000", since2
    );
    const segTest = (m) => (!sage || m.age === sage) && (!scs || (Array.isArray(m.cs) && m.cs.indexOf(scs) > -1));
    const curRows = [], prevRows = [];
    for (const r of (profileRows.results || [])) {
      let m; try { m = JSON.parse(r.meta); } catch (e) { continue; }
      if (!segTest(m)) continue;
      r.__m = m;
      (r.ts >= since ? curRows : prevRows).push(r);
    }
    const profile = aggregateProfiles(curRows);
    const profilePrev = aggregateProfiles(prevRows);
    // KPIの今期/前期(開始・完了・CTA) — セグメントは掛けない(プロファイル無イベント含むため)
    const kpiWinRaw = await q(
      "SELECT name, CASE WHEN ts>=? THEN 'cur' ELSE 'prev' END w, COUNT(*) c FROM events WHERE name IN ('finder_start','finder_complete','finder_cta') AND ts>=? AND " + NT + " GROUP BY name, w",
      since, since2
    );
    const kpiWin = { cur: {}, prev: {} };
    (kpiWinRaw.results || []).forEach(r => { kpiWin[r.w][r.name] = r.c; });
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
      brandSearch: brandSearch.results || [],
      brandClick: brandClick.results || [],
      pageViews: pageViews.results || [],
      finderFunnel,
      bookingFunnel,
      pageEngage: pageEngage.results || [],
      secEngage,
      profile,
      profilePrev,
      kpiWin,
      seg: { age: sage || null, cs: scs || null },
    });
  } catch (e) {
    return json({ configured: true, error: String((e && e.message) || e) }, 500);
  }
}

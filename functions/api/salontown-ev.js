// salon.town アクセス計測API（cookieなし・個人情報なし）
// POST /api/salontown-ev                 … ページ側 st-track.js からの匿名イベント（常に 204）
// GET  /api/salontown-ev?days=30&key=…   … 管理画面向けの集計（ADMIN_KEY か STAFF_KEY）
// 保存先: Cloudflare D1（binding DB）テーブル salontown_events
//
// 記録するのは「どのページ」「どの章をどれだけ」「どのボタン」「どこから来たか」「端末種別」「言語」だけ。
// 氏名・連絡先・IPアドレス・入力内容は記録しない。

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
export function checkKey(request, env) {
  const url = new URL(request.url);
  const key = (request.headers.get('x-seam-key') || url.searchParams.get('key') || '').trim();
  const admin = (env.ADMIN_KEY || '').trim();
  const staff = (env.STAFF_KEY || '').trim();
  if (!admin && !staff) return { ok: false, keyConfigured: false, role: '' };
  if (admin && key === admin) return { ok: true, keyConfigured: true, role: 'admin' };
  if (staff && key === staff) return { ok: true, keyConfigured: true, role: 'staff' };
  return { ok: false, keyConfigured: true, role: '' };
}
let ready = false;
async function ensureTable(db) {
  if (ready) return;
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS salontown_events (" +
    "id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, name TEXT NOT NULL, path TEXT, section TEXT, label TEXT, kind TEXT," +
    "ref TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, src TEXT, landing TEXT, device TEXT, lang TEXT, country TEXT," +
    "vid TEXT, sid TEXT, dur INTEGER, depth INTEGER)"
  ).run();
  await db.prepare("CREATE INDEX IF NOT EXISTS idx_st_events_ts ON salontown_events(ts)").run().catch(() => {});
  ready = true;
}
async function tableExists(db, name) {
  const r = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
  return !!r;
}
const s = (v, n) => (v == null ? '' : String(v)).slice(0, n);
const ALLOWED = { pv: 1, sec: 1, leave: 1, click: 1, form_sent: 1, ai_start: 1, ai_end: 1 };

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const db = env.DB;
    if (!db) return new Response(null, { status: 204 });
    const b = await request.json().catch(() => ({}));
    const ctx = b.ctx || {};
    const evs = Array.isArray(b.ev) ? b.ev.slice(0, 50) : [];
    if (!evs.length) return new Response(null, { status: 204 });
    const country = s(request.cf && request.cf.country, 4);
    const ref = s(ctx.ref, 64).toLowerCase(), utmS = s(ctx.utm_source, 32), utmM = s(ctx.utm_medium, 24), utmC = s(ctx.utm_campaign, 48);
    const src = s(ctx.src, 32), landing = s(ctx.landing, 96), device = s(ctx.device, 8), vid = s(ctx.vid, 24), sid = s(ctx.sid, 24);
    const ts = Date.now();
    await ensureTable(db);
    const stmt = db.prepare(
      'INSERT INTO salontown_events (ts,name,path,section,label,kind,ref,utm_source,utm_medium,utm_campaign,src,landing,device,lang,country,vid,sid,dur,depth) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    );
    const batch = [];
    for (const ev of evs) {
      const name = s(ev.e, 16);
      if (!ALLOWED[name]) continue;
      const dur = Math.min(86400, Math.max(0, parseInt(ev.dur, 10) || 0));
      const depth = Math.min(100, Math.max(0, parseInt(ev.depth, 10) || 0));
      batch.push(stmt.bind(ts, name, s(ev.p, 96), s(ev.sec, 40), s(ev.label, 64), s(ev.kind, 16), ref, utmS, utmM, utmC, src, landing, device, s(ev.lang, 8), country, vid, sid, dur || null, depth || null));
    }
    if (batch.length) context.waitUntil(db.batch(batch).catch(() => {}));
  } catch (e) { /* 計測でサイトを壊さない */ }
  return new Response(null, { status: 204 });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  const auth = checkKey(request, env);
  if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);
  const url = new URL(request.url);
  const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days'), 10) || 30));
  const now = Date.now();
  const since = now - days * 86400000, prev = since - days * 86400000;
  const out = { days, since, role: auth.role, generatedAt: now, tracking: false };
  if (!(await tableExists(db, 'salontown_events'))) {
    out.totals = { pv: 0, visitors: 0, sessions: 0 };
    out.prev = { pv: 0, visitors: 0, sessions: 0 };
    out.daily = []; out.pages = []; out.sections = []; out.clicks = []; out.refs = []; out.utm = []; out.landing = []; out.device = []; out.lang = []; out.country = []; out.hours = [];
  } else {
    out.tracking = true;
    const q = (sql, ...args) => db.prepare(sql).bind(...args).all().then(r => r.results || []);
    const one = (sql, ...args) => db.prepare(sql).bind(...args).first();
    const tot = await one("SELECT COUNT(*) pv, COUNT(DISTINCT vid) visitors, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=?", since);
    const ptot = await one("SELECT COUNT(*) pv, COUNT(DISTINCT vid) visitors, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? AND ts<?", prev, since);
    const stay = await one("SELECT AVG(dur) avg_dur, AVG(depth) avg_depth FROM salontown_events WHERE name='leave' AND ts>=?", since);
    const clicks = await one("SELECT SUM(CASE WHEN kind='cta_form' THEN 1 ELSE 0 END) cta_form, SUM(CASE WHEN kind='cta_ai' THEN 1 ELSE 0 END) cta_ai, SUM(CASE WHEN kind='cta_screens' THEN 1 ELSE 0 END) cta_screens, SUM(CASE WHEN kind='lang' THEN 1 ELSE 0 END) lang FROM salontown_events WHERE name='click' AND ts>=?", since);
    const conv = await one("SELECT SUM(CASE WHEN name='form_sent' THEN 1 ELSE 0 END) form_sent, SUM(CASE WHEN name='ai_start' THEN 1 ELSE 0 END) ai_start, SUM(CASE WHEN name='ai_end' THEN 1 ELSE 0 END) ai_end FROM salontown_events WHERE ts>=?", since);
    out.totals = Object.assign({}, tot, stay, clicks, conv);
    out.prev = ptot;
    // 日別（日本時間）
    out.daily = await q("SELECT date(ts/1000+32400,'unixepoch') d, COUNT(*) pv, COUNT(DISTINCT vid) visitors, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY d ORDER BY d", since);
    out.hours = await q("SELECT CAST(strftime('%H', ts/1000+32400,'unixepoch') AS INTEGER) h, COUNT(*) pv FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY h ORDER BY h", since);
    // ページ
    out.pages = await q("SELECT path, COUNT(*) pv, COUNT(DISTINCT vid) visitors, (SELECT ROUND(AVG(dur)) FROM salontown_events l WHERE l.name='leave' AND l.path=e.path AND l.ts>=?) avg_dur, (SELECT ROUND(AVG(depth)) FROM salontown_events l WHERE l.name='leave' AND l.path=e.path AND l.ts>=?) avg_depth FROM salontown_events e WHERE name='pv' AND ts>=? GROUP BY path ORDER BY pv DESC LIMIT 30", since, since, since);
    // 章ごとの興味（見た訪問数・合計滞在秒・平均滞在秒・その章で押されたボタン数）
    out.sections = await q("SELECT path, section, COUNT(DISTINCT sid) views, SUM(dur) total_dur, ROUND(AVG(dur),1) avg_dur, (SELECT COUNT(*) FROM salontown_events c WHERE c.name='click' AND c.section=e.section AND c.path=e.path AND c.ts>=?) clicks FROM salontown_events e WHERE name='sec' AND ts>=? AND section<>'' GROUP BY path, section ORDER BY views DESC, total_dur DESC LIMIT 60", since, since);
    // ボタン
    out.clicks = await q("SELECT path, section, kind, label, COUNT(*) n FROM salontown_events WHERE name='click' AND ts>=? GROUP BY path, section, kind, label ORDER BY n DESC LIMIT 60", since);
    // 流入
    out.refs = await q("SELECT CASE WHEN utm_source<>'' THEN 'utm:'||utm_source WHEN src<>'' THEN 'src:'||src WHEN ref<>'' THEN ref ELSE '(直接・ブックマーク・QR等)' END source, COUNT(DISTINCT sid) sessions, COUNT(DISTINCT vid) visitors FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY source ORDER BY sessions DESC LIMIT 30", since);
    out.utm = await q("SELECT utm_source, utm_medium, utm_campaign, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? AND (utm_source<>'' OR utm_campaign<>'') GROUP BY utm_source, utm_medium, utm_campaign ORDER BY sessions DESC LIMIT 30", since);
    out.landing = await q("SELECT landing, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY landing ORDER BY sessions DESC LIMIT 20", since);
    out.device = await q("SELECT device, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY device ORDER BY sessions DESC", since);
    out.lang = await q("SELECT lang, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY lang ORDER BY sessions DESC", since);
    out.country = await q("SELECT country, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE name='pv' AND ts>=? GROUP BY country ORDER BY sessions DESC LIMIT 10", since);
    // 流入元 × 問い合わせ行動（どの経路の人が相談ボタンを押したか）
    out.refConv = await q("SELECT CASE WHEN utm_source<>'' THEN 'utm:'||utm_source WHEN src<>'' THEN 'src:'||src WHEN ref<>'' THEN ref ELSE '(直接)' END source, COUNT(DISTINCT sid) sessions FROM salontown_events WHERE ts>=? AND (name IN ('form_sent','ai_start') OR (name='click' AND kind IN ('cta_form','cta_ai'))) GROUP BY source ORDER BY sessions DESC LIMIT 15", since);
  }
  // 受信件数（フォーム・AI受付）は問い合わせテーブルから
  out.inbox = { form: 0, ai: 0, open: 0 };
  if (await tableExists(db, 'salontown_inquiries')) {
    const r = await db.prepare("SELECT COUNT(*) n, SUM(CASE WHEN handled=1 THEN 0 ELSE 1 END) o FROM salontown_inquiries WHERE created_at>=?").bind(since).first();
    out.inbox.form = r.n || 0; out.inbox.open += r.o || 0;
  }
  if (await tableExists(db, 'salontown_ai_calls')) {
    const r = await db.prepare("SELECT COUNT(*) n, SUM(CASE WHEN handled=1 THEN 0 ELSE 1 END) o, ROUND(AVG(duration_secs)) d FROM salontown_ai_calls WHERE created_at>=?").bind(since).first();
    out.inbox.ai = r.n || 0; out.inbox.open += r.o || 0; out.inbox.ai_avg_secs = r.d || 0;
  }
  return json(out);
}

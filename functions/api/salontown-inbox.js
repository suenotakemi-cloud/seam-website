// 受信箱API：フォーム（salontown_inquiries）とAI受付（salontown_ai_calls）をまとめて返す
// GET   /api/salontown-inbox?key=ADMIN_KEY          … 新しい順にまとめて返す
// PATCH /api/salontown-inbox  {source, id, handled}  … 対応済みの切替（キー必須）
// 認証は /api/recruit と同じ（ADMIN_KEY、x-seam-key or ?key=）

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
function checkKey(request, env) {
  const url = new URL(request.url);
  const key = (request.headers.get('x-seam-key') || url.searchParams.get('key') || '').trim();
  const want = (env.ADMIN_KEY || '').trim();
  if (!want) return { ok: false, keyConfigured: false };
  return { ok: key === want, keyConfigured: true };
}
async function tableExists(db, name) {
  const r = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").bind(name).first();
  return !!r;
}

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  const auth = checkKey(request, env);
  if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);

  if (request.method === 'GET') {
    const url = new URL(request.url);
    const conv = (url.searchParams.get('transcript') || '').trim();
    if (conv) {
      if (!(await tableExists(db, 'salontown_ai_calls'))) return json({ transcript: [] });
      const r = await db.prepare("SELECT transcript FROM salontown_ai_calls WHERE conversation_id=?").bind(conv).first();
      let t = []; try { t = JSON.parse((r && r.transcript) || '[]'); } catch (e) {}
      return json({ transcript: t });
    }
    const out = [];
    if (await tableExists(db, 'salontown_inquiries')) {
      const r = await db.prepare(
        "SELECT id,type,shop,name,contact,prefer,message,lang,created_at,handled FROM salontown_inquiries ORDER BY created_at DESC LIMIT 300"
      ).all();
      for (const x of (r.results || [])) out.push({ source: 'form', id: x.id, at: x.created_at, handled: !!x.handled,
        type: x.type, company: x.shop, name: x.name, contact: x.contact, prefer: x.prefer, message: x.message, lang: x.lang });
    }
    if (await tableExists(db, 'salontown_ai_calls')) {
      const r = await db.prepare(
        "SELECT id,conversation_id,title,summary,company,name,contact,prefer,topic,duration_secs,started_at,created_at,handled FROM salontown_ai_calls ORDER BY COALESCE(NULLIF(started_at,0)*1000,created_at) DESC LIMIT 300"
      ).all();
      for (const x of (r.results || [])) out.push({ source: 'ai', id: x.id, at: x.started_at ? x.started_at * 1000 : x.created_at, handled: !!x.handled,
        conversation_id: x.conversation_id, title: x.title, message: x.summary, company: x.company, name: x.name, contact: x.contact, prefer: x.prefer, topic: x.topic, duration_secs: x.duration_secs });
    }
    out.sort((a, b) => b.at - a.at);
    return json({ entries: out, webhookConfigured: !!(env.ELEVENLABS_WEBHOOK_SECRET || '').trim() });
  }

  if (request.method === 'PATCH') {
    let b; try { b = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
    const id = parseInt(b.id, 10);
    const table = b.source === 'ai' ? 'salontown_ai_calls' : b.source === 'form' ? 'salontown_inquiries' : '';
    if (!id || !table) return json({ error: 'source と id が必要です' }, 400);
    if (!(await tableExists(db, table))) return json({ error: 'no table' }, 404);
    await db.prepare(`UPDATE ${table} SET handled=? WHERE id=?`).bind(b.handled ? 1 : 0, id).run();
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}

// 株式会社サロンタウン お問い合わせフォームAPI — D1に保存する
// POST /api/salontown-contact … フォーム受付(公開・キー不要)
// GET  /api/salontown-contact … 一覧。x-seam-key or ?key= が ADMIN_KEY と一致必須
// PATCH /api/salontown-contact … {id, handled} で対応済みにする(キー必須)
//
// 方針(2026-09-06 代表指示)：サイトにも AI受付にも、当社の電話番号・メールアドレスは出さない。
// 問い合わせは AI受付とこのフォームで受け、担当がこちらから連絡する。
// 認証・テーブル自動作成・スパム除けは /api/recruit と同じ形。

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS salontown_inquiries (" +
    " id INTEGER PRIMARY KEY AUTOINCREMENT," +
    " type TEXT DEFAULT ''," +            // salon / dealer / maker / media / other
    " shop TEXT DEFAULT ''," +            // サロン名・会社名
    " name TEXT NOT NULL," +
    " contact TEXT NOT NULL," +           // メール or 電話(相手の連絡先)
    " prefer TEXT DEFAULT ''," +          // 希望の連絡方法・時間帯
    " message TEXT NOT NULL," +
    " lang TEXT DEFAULT 'ja'," +
    " src TEXT DEFAULT ''," +
    " ua TEXT DEFAULT ''," +
    " created_at INTEGER NOT NULL," +
    " handled INTEGER DEFAULT 0)"
  ).run();
}

function checkKey(request, env) {
  const url = new URL(request.url);
  const key = (request.headers.get('x-seam-key') || url.searchParams.get('key') || '').trim();
  const want = (env.ADMIN_KEY || '').trim();
  if (!want) return { ok: false, keyConfigured: false };
  return { ok: key === want, keyConfigured: true };
}

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);

  if (request.method === 'POST') {
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }

    const name = clip(b.name, 60);
    const contact = clip(b.contact, 120);
    const message = clip(b.message, 3000);
    if (!name || !contact || !message) return json({ error: 'name, contact, message は必須です' }, 400);

    // 素朴なスパム除け：URLだらけの本文とハニーポットは静かに捨てる
    const links = (message.match(/https?:\/\//g) || []).length;
    if (links >= 3) return json({ ok: true, skipped: true });
    if (clip(b.hp, 10)) return json({ ok: true, skipped: true });

    await ensureTable(db);
    await db.prepare(
      "INSERT INTO salontown_inquiries (type,shop,name,contact,prefer,message,lang,src,ua,created_at)" +
      " VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      clip(b.type, 16), clip(b.shop, 80), name, contact, clip(b.prefer, 120), message,
      clip(b.lang, 5) || 'ja', clip(b.src, 60), clip(request.headers.get('user-agent'), 200), Date.now()
    ).run();
    return json({ ok: true });
  }

  if (request.method === 'GET') {
    const auth = checkKey(request, env);
    if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);
    await ensureTable(db);
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);
    const r = await db.prepare(
      "SELECT id,type,shop,name,contact,prefer,message,lang,src,created_at,handled" +
      " FROM salontown_inquiries ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ entries: r.results || [] });
  }

  if (request.method === 'PATCH') {
    const auth = checkKey(request, env);
    if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);
    let b; try { b = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
    const id = parseInt(b.id, 10);
    if (!id) return json({ error: 'id が必要です' }, 400);
    await ensureTable(db);
    await db.prepare("UPDATE salontown_inquiries SET handled=? WHERE id=?").bind(b.handled ? 1 : 0, id).run();
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}

// SEAM 採用の応募・見学相談API — D1に保存する
// POST /api/recruit        … 応募/見学相談の受付(公開・キー不要)
// GET  /api/recruit        … 一覧。x-seam-key or ?key= が ADMIN_KEY と一致必須
//
// 認証は /api/journal と同一パターン(env.ADMIN_KEY・空白吸収)。
// テーブルは初回書き込み時に自動作成(冪等)。
//
// 【個人情報の扱い】
//  ここに入るのは応募者の氏名と連絡先。診断データとは完全に別テーブルにし
//  GETは必ずキー必須にする(POSTだけ無認証)。外部には一切送らない。

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS recruit_entries (" +
    " id INTEGER PRIMARY KEY AUTOINCREMENT," +
    " name TEXT NOT NULL," +
    " contact TEXT NOT NULL," +          // LINE ID / メール / 電話 どれでもよい
    " role TEXT DEFAULT ''," +           // 希望職種
    " store TEXT DEFAULT ''," +          // 希望店舗
    " experience TEXT DEFAULT ''," +     // 経験年数
    " message TEXT DEFAULT ''," +        // 自由記入
    " kind TEXT DEFAULT 'apply'," +      // apply(応募) / visit(見学) / ask(質問)
    " src TEXT DEFAULT ''," +            // 広告などの流入元(?src=)
    " ua TEXT DEFAULT ''," +
    " created_at INTEGER NOT NULL," +
    " handled INTEGER DEFAULT 0)"        // 担当者が対応済みにする用
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

  // ── 受付(公開) ──
  if (request.method === 'POST') {
    let b;
    try { b = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }

    const name = clip(b.name, 60);
    const contact = clip(b.contact, 120);
    if (!name || !contact) return json({ error: 'name と contact は必須です' }, 400);

    // 素朴なスパム除け。URLだらけの投稿と 長すぎる本文を落とす
    const message = clip(b.message, 2000);
    const links = (message.match(/https?:\/\//g) || []).length;
    if (links >= 3) return json({ ok: true, skipped: true });     // 静かに捨てる
    if (clip(b.hp, 10)) return json({ ok: true, skipped: true }); // ハニーポット

    await ensureTable(db);
    await db.prepare(
      "INSERT INTO recruit_entries (name,contact,role,store,experience,message,kind,src,ua,created_at)" +
      " VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      name, contact, clip(b.role, 40), clip(b.store, 40), clip(b.experience, 40),
      message, clip(b.kind, 12) || 'apply', clip(b.src, 60),
      clip(request.headers.get('user-agent'), 200), Date.now()
    ).run();

    return json({ ok: true });
  }

  // ── 一覧(担当者のみ) ──
  if (request.method === 'GET') {
    const auth = checkKey(request, env);
    if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);
    await ensureTable(db);
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 500);
    const r = await db.prepare(
      "SELECT id,name,contact,role,store,experience,message,kind,src,created_at,handled" +
      " FROM recruit_entries ORDER BY created_at DESC LIMIT ?"
    ).bind(limit).all();
    return json({ entries: r.results || [] });
  }

  // ── 対応済みにする(担当者のみ) ──
  if (request.method === 'PATCH') {
    const auth = checkKey(request, env);
    if (!auth.ok) return json({ error: 'unauthorized', keyConfigured: auth.keyConfigured }, 401);
    let b; try { b = await request.json(); } catch (e) { return json({ error: 'invalid json' }, 400); }
    const id = parseInt(b.id, 10);
    if (!id) return json({ error: 'id が必要です' }, 400);
    await ensureTable(db);
    await db.prepare("UPDATE recruit_entries SET handled=? WHERE id=?")
      .bind(b.handled ? 1 : 0, id).run();
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}

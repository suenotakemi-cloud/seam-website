// SEAM フランチャイズ加盟のご相談 受付 API — D1 に保存する（2026-09-16・トップの一番下のフォームから）
// POST  /api/franchise        … 受付（公開・キー不要）
// GET   /api/franchise        … 一覧。x-seam-key or ?key= が ADMIN_KEY と一致必須（/admin-inbox.html が使う）
// PATCH /api/franchise        … {id, handled} 対応済みの切替（キー必須）
//
// 型は /api/recruit と同じ（認証・自動作成・ハニーポット・URL だらけの投稿は静かに捨てる）。
// 【個人情報】会社名・氏名・連絡先が入る。診断データとは別テーブル。GET は必ずキー必須。外部には一切送らない。

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS franchise_inquiries (" +
    " id INTEGER PRIMARY KEY AUTOINCREMENT," +
    " company TEXT DEFAULT ''," +        // 会社名・屋号（個人は空でよい）
    " name TEXT NOT NULL," +             // お名前
    " contact TEXT NOT NULL," +          // メール or 電話（どちらでも）
    " area TEXT DEFAULT ''," +           // 出店を考えている地域
    " business TEXT DEFAULT ''," +       // 今の業態・店舗数など
    " message TEXT DEFAULT ''," +        // ご相談内容
    " lang TEXT DEFAULT 'ja'," +         // 送信した画面の言語
    " src TEXT DEFAULT ''," +            // 流入元（?src=）
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
    if (!name || !contact) return json({ error: 'name と contact は必須です' }, 400);
    if (!/[@0-9]/.test(contact)) return json({ error: 'contact はメールアドレスか電話番号を入れてください' }, 400);

    const message = clip(b.message, 2000);
    const links = (message.match(/https?:\/\//g) || []).length;
    if (links >= 3) return json({ ok: true, skipped: true });     // URL だらけ＝広告。静かに捨てる
    if (clip(b.hp, 10)) return json({ ok: true, skipped: true }); // ハニーポット

    await ensureTable(db);
    await db.prepare(
      "INSERT INTO franchise_inquiries (company,name,contact,area,business,message,lang,src,ua,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)"
    ).bind(
      clip(b.company, 80), name, contact, clip(b.area, 60), clip(b.business, 120), message,
      clip(b.lang, 8) || 'ja', clip(b.src, 60), clip(request.headers.get('user-agent'), 200), Date.now()
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
      "SELECT id,company,name,contact,area,business,message,lang,src,created_at,handled FROM franchise_inquiries ORDER BY created_at DESC LIMIT ?"
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
    await db.prepare("UPDATE franchise_inquiries SET handled=? WHERE id=?").bind(b.handled ? 1 : 0, id).run();
    return json({ ok: true });
  }

  return json({ error: 'method not allowed' }, 405);
}

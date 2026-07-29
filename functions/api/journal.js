// SEAM 読みもの(ブログ)の記事API — D1保存でどんどん溜められるようにする
// GET  /api/journal            … 公開記事の一覧(公開情報のみ・キー不要)
// GET  /api/journal?slug=xxx   … 1件取得(下書き含む・キー必要なし=公開のみ / key付きなら下書きも)
// POST /api/journal            … 作成/更新(upsert)。x-seam-key or ?key= が ADMIN_KEY と一致必須
// DELETE /api/journal?slug=xxx … 削除。同じくキー必須
//
// 認証は /api/admin/stats と同一パターン(env.ADMIN_KEY・空白吸収)。
// テーブルは初回書き込み時に自動作成(冪等)。診断データとは別テーブルで、
// 記事は公開物なので一覧GETは無認証(インサイトは一切持たない)。

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]{2,59}$/;
// 既存の静的ページと衝突させない(スラッグは /journal/<slug> に載る)
const RESERVED = new Set(['index', 'new', 'edit', 'admin', 'api']);

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS journal_posts (" +
    " slug TEXT PRIMARY KEY," +
    " title TEXT NOT NULL," +
    " description TEXT DEFAULT ''," +
    " eyebrow TEXT DEFAULT ''," +          // カードの英語ラベル(例: Mirai Soap)
    " hero_image TEXT DEFAULT ''," +        // images/ 配下の相対パスのみ許可
    " body TEXT NOT NULL," +                // プレーンテキスト(空行=段落) 表示時にエスケープ
    " author TEXT DEFAULT ''," +
    " published INTEGER DEFAULT 1," +
    " created_at INTEGER NOT NULL," +
    " updated_at INTEGER NOT NULL)"
  ).run();
}

function checkKey(request, env) {
  const url = new URL(request.url);
  const key = (request.headers.get('x-seam-key') || url.searchParams.get('key') || '').trim();
  const stored = ((env && env.ADMIN_KEY) || '').trim();
  if (!stored) return { ok: false, res: json({ error: 'unauthorized', keyConfigured: false }, 401) };
  if (key !== stored) return { ok: false, res: json({ error: 'unauthorized', keyConfigured: true }, 401) };
  return { ok: true };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return json({ configured: false, posts: [] });
  }
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  try {
    await ensureTable(env.DB);
    if (slug) {
      // 1件。下書きはキー保持者だけが見られる
      const row = await env.DB.prepare('SELECT * FROM journal_posts WHERE slug = ?').bind(slug).first();
      if (!row) return json({ error: 'not_found' }, 404);
      if (!row.published) {
        const auth = checkKey(request, env);
        if (!auth.ok) return json({ error: 'not_found' }, 404);
      }
      return json({ post: row });
    }
    // 一覧は公開のみ・公開情報のみ(bodyは重いので除外)
    const rows = await env.DB.prepare(
      'SELECT slug, title, description, eyebrow, hero_image, created_at FROM journal_posts ' +
      'WHERE published = 1 ORDER BY created_at DESC LIMIT 100'
    ).all();
    return json({ posts: (rows && rows.results) || [] });
  } catch (e) {
    return json({ error: 'db_error' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const auth = checkKey(request, env);
  if (!auth.ok) return auth.res;
  if (!env.DB || typeof env.DB.prepare !== 'function') {
    return json({ error: 'D1 binding "DB" が未設定です' }, 500);
  }
  let b;
  try { b = await request.json(); } catch (e) { return json({ error: 'invalid_json' }, 400); }

  const slug = String(b.slug || '').trim().toLowerCase();
  const title = String(b.title || '').trim();
  const description = String(b.description || '').trim();
  const eyebrow = String(b.eyebrow || '').trim();
  const author = String(b.author || '').trim();
  let heroImage = String(b.hero_image || '').trim();
  const body = String(b.body || '').replace(/\r\n/g, '\n').trim();
  const published = b.published === 0 || b.published === false ? 0 : 1;

  if (!SLUG_RE.test(slug) || RESERVED.has(slug)) {
    return json({ error: 'slug は 半角英小文字・数字・ハイフン 3〜60字にしてください' }, 400);
  }
  if (!title || title.length > 60)   return json({ error: 'title は 1〜60字にしてください' }, 400);
  if (description.length > 160)      return json({ error: 'description は 160字以内にしてください' }, 400);
  if (eyebrow.length > 30)           return json({ error: 'eyebrow は 30字以内にしてください' }, 400);
  if (author.length > 30)            return json({ error: 'author は 30字以内にしてください' }, 400);
  if (!body || body.length > 40000)  return json({ error: '本文は 1〜40,000字にしてください' }, 400);
  // 画像はこのサイトの images/ 配下だけ(外部URLの混入・スクリプト注入を防ぐ)
  if (heroImage && !/^images\/[A-Za-z0-9_\-\/.]+\.(jpg|jpeg|png|webp|avif)$/.test(heroImage)) {
    heroImage = '';
  }

  try {
    await ensureTable(env.DB);
    const now = Date.now();
    await env.DB.prepare(
      'INSERT INTO journal_posts (slug, title, description, eyebrow, hero_image, body, author, published, created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ' +
      'ON CONFLICT(slug) DO UPDATE SET title=excluded.title, description=excluded.description, ' +
      'eyebrow=excluded.eyebrow, hero_image=excluded.hero_image, body=excluded.body, ' +
      'author=excluded.author, published=excluded.published, updated_at=excluded.updated_at'
    ).bind(slug, title, description, eyebrow, heroImage, body, author, published, now, now).run();
    return json({ ok: true, slug, url: '/journal/' + slug });
  } catch (e) {
    return json({ error: 'db_error' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const auth = checkKey(request, env);
  if (!auth.ok) return auth.res;
  if (!env.DB || typeof env.DB.prepare !== 'function') return json({ error: 'no_db' }, 500);
  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').trim();
  if (!SLUG_RE.test(slug)) return json({ error: 'bad_slug' }, 400);
  try {
    await ensureTable(env.DB);
    await env.DB.prepare('DELETE FROM journal_posts WHERE slug = ?').bind(slug).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'db_error' }, 500);
  }
}

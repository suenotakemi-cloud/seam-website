// SEAM 商品マスタ統一（PIM）— API 共通部品
//   認証:
//     ・ディーラー: ID + パスワードでログイン → トークン（x-seam-token）。1ディーラー1アカウント、スタッフは同じIDを共用
//       パスワードを変えると token_version が進み、それまでのトークンは全端末で無効になる（退職者対策）
//     ・SEAM 管理: env.ADMIN_KEY（x-seam-key）。アカウントの発行・パスワード再設定・停止。
//       x-seam-account: <login_id> を付けると、そのディーラーとして商品 API を使える（EC 連携・代行作業）
//   保存: D1 binding "DB"（商品・画像台帳・注意・アカウント）/ R2 binding "PRODUCT_IMAGES"（画像の実体・必ず webp）
//   データはすべて account_id で分かれる（他のディーラーの商品は見えない・触れない）

export function json(obj, status, extra) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra || {}),
  });
}

export function hasDb(env) { return !!(env && env.DB && typeof env.DB.prepare === 'function'); }
export function hasR2(env) { return !!(env && env.PRODUCT_IMAGES && typeof env.PRODUCT_IMAGES.put === 'function'); }
export function nowIso() { return new Date().toISOString(); }

// 担当者名（x-seam-user ヘッダ・URLエンコード済み）。複数人で同時に登録するとき「誰が入れたか」を残す
export function userOf(request) {
  try { return decodeURIComponent(request.headers.get('x-seam-user') || '').replace(/\s+/g, ' ').trim().slice(0, 40); } catch (e) { return ''; }
}

// ── JAN（サーバ側の最終確認。整形はブラウザ側 js/pim-normalize.js が担う）──
export function cleanJan(raw) {
  let d = String(raw == null ? '' : raw).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^0-9]/g, '');
  if (d.length === 14 && d[0] === '0') d = d.slice(1);
  if (d.length === 12) d = '0' + d;
  return d;
}
export function janShapeOk(jan) { return jan.length === 13 || jan.length === 8; }
export function checkDigitOk(d) {
  let sum = 0; const L = d.length;
  for (let i = 0; i < L - 1; i++) sum += (d.charCodeAt(i) - 48) * (((L - 1 - i) % 2 === 1) ? 3 : 1);
  return ((10 - (sum % 10)) % 10) === (d.charCodeAt(L - 1) - 48);
}

// ── 画像の置き場所（アカウントごとに分ける）──
export const SLOT_MIN = 1, SLOT_MAX = 5;
export function imageKey(acct, jan, slot) { return 'products/' + acct + '/' + jan + '/' + slot + '.webp'; }
export function imageUrl(origin, acct, jan, slot, ver) { return origin + '/pim-img/' + imageKey(acct, jan, slot) + (ver ? '?v=' + encodeURIComponent(ver) : ''); }
export const R2_META = { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } };

// ── 画像の実体の置き場所 ──
//   R2（PRODUCT_IMAGES）があれば R2。無ければ D1 の pim_blobs に入れる（実証実験で R2 の紐付けが間に合わなくても止まらない）。
//   読むときは R2 → D1 の順に探すので、後から R2 を足しても D1 に入った分はそのまま見える。
const D1_BLOB_MAX = 1500000; // D1 の 1行 2MB 制限に収める
export async function blobPut(env, key, buf) {
  if (hasR2(env)) return env.PRODUCT_IMAGES.put(key, buf, R2_META);
  if (buf.length > D1_BLOB_MAX) throw new Error('画像が大きすぎます（R2 未設定のため ' + Math.round(D1_BLOB_MAX / 1000) + 'KB まで）');
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); // D1 の BLOB は ArrayBuffer で渡す
  await env.DB.prepare('INSERT INTO pim_blobs(key, data, bytes, created_at) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET data=excluded.data, bytes=excluded.bytes, created_at=excluded.created_at')
    .bind(key, ab, buf.length, nowIso()).run();
}
export async function blobGet(env, key) {
  if (hasR2(env)) {
    const obj = await env.PRODUCT_IMAGES.get(key);
    if (obj) return { body: obj.body, etag: obj.httpEtag || null, from: 'r2' };
  }
  if (!hasDb(env)) return null;
  let row = null;
  try { row = await env.DB.prepare('SELECT data, created_at FROM pim_blobs WHERE key=?').bind(key).first(); } catch (e) { return null; } // 表がまだ無い等
  if (!row || !row.data) return null;
  // D1 の BLOB は環境により ArrayBuffer / 数値配列 / {type:'Buffer',data:[]} で返るので、必ず ArrayBuffer に揃える
  let body = row.data;
  if (Array.isArray(body)) body = Uint8Array.from(body).buffer;
  else if (body && body.type === 'Buffer' && Array.isArray(body.data)) body = Uint8Array.from(body.data).buffer;
  else if (ArrayBuffer.isView(body)) body = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
  if (!(body instanceof ArrayBuffer)) return null;
  return { body, etag: '"d1-' + String(row.created_at || '').replace(/[^0-9]/g, '') + '"', from: 'd1' };
}
export async function blobDelete(env, key) {
  if (hasR2(env)) { try { await env.PRODUCT_IMAGES.delete(key); } catch (e) { /* */ } }
  if (hasDb(env)) { try { await env.DB.prepare('DELETE FROM pim_blobs WHERE key=?').bind(key).run(); } catch (e) { /* */ } }
}
export function imageStore(env) { return hasR2(env) ? 'r2' : 'd1'; }

// ── パスワード（PBKDF2-SHA256・Web Crypto）──
const enc = new TextEncoder();
function b64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function unb64(s) { return Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); }
function b64url(buf) { return b64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function unb64url(s) { return unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - s.length % 4) % 4)); }
const PBKDF2_ITER = 30000; // 反復回数はハッシュ文字列に入るので、後で上げても古いものはそのまま検証できる
async function pbkdf2(password, salt, iter) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, key, 256);
}
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const bits = await pbkdf2(password, salt, PBKDF2_ITER);
  return 'pbkdf2$' + PBKDF2_ITER + '$' + b64(salt) + '$' + b64(bits);
}
export async function verifyPassword(password, stored) {
  try {
    const [alg, iter, salt, hash] = String(stored || '').split('$');
    if (alg !== 'pbkdf2') return false;
    const bits = new Uint8Array(await pbkdf2(password, unb64(salt), parseInt(iter, 10)));
    const want = unb64(hash);
    if (bits.length !== want.length) return false;
    let diff = 0; for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ want[i];
    return diff === 0;
  } catch (e) { return false; }
}
// パスワードの最低条件（8文字以上・空白のみ不可）
export function passwordProblem(pw) {
  const s = String(pw || '');
  if (s.length < 8) return 'パスワードは8文字以上にしてください';
  if (s.length > 128) return 'パスワードが長すぎます';
  if (!/\S/.test(s)) return 'パスワードに空白以外の文字を入れてください';
  return '';
}
export function normalizeLoginId(s) { return String(s || '').trim().toLowerCase().replace(/[^a-z0-9._@-]/g, '').slice(0, 64); }

// ── トークン（HMAC-SHA256・署名付き・状態を持たない）──
//   中身: account_id . token_version . 有効期限(unix秒)。パスワード変更で token_version が進むと全部無効
const TOKEN_DAYS = 180;
function secretOf(env) { return String((env && (env.PIM_SECRET || env.ADMIN_KEY)) || '').trim(); }
export function secretConfigured(env) { return secretOf(env).length >= 8; }
async function hmac(secret, data) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', key, enc.encode(data));
}
export async function signToken(env, accountId, tokenVersion) {
  if (!secretConfigured(env)) throw new Error('no_secret'); // 鍵なしで署名すると誰でも偽造できるので拒む
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  const payload = accountId + '.' + tokenVersion + '.' + exp;
  const sig = b64url(await hmac(secretOf(env), payload));
  return b64url(enc.encode(payload)) + '.' + sig;
}
export async function verifyToken(env, token) {
  try {
    if (!secretConfigured(env)) return null;
    const [p, sig] = String(token || '').split('.');
    if (!p || !sig) return null;
    const payload = new TextDecoder().decode(unb64url(p));
    const want = b64url(await hmac(secretOf(env), payload));
    if (want.length !== sig.length) return null;
    let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
    if (diff !== 0) return null;
    const [id, ver, exp] = payload.split('.').map((x) => parseInt(x, 10));
    if (!id || !ver || !exp || exp < Math.floor(Date.now() / 1000)) return null;
    return { id, ver, exp };
  } catch (e) { return null; }
}
export function publicAccount(a) {
  if (!a) return null;
  return { id: a.id, login_id: a.login_id, name: a.name, role: a.role, active: !!a.active, created_at: a.created_at, pass_changed_at: a.pass_changed_at, last_login_at: a.last_login_at };
}

// ── スキーマ（db/pim-schema.sql と同じ内容。未投入でも動くよう初回に作る）──
let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady || !hasDb(env)) return;
  // 旧版（account_id の無い表）が残っていたら退避する（本番投入前の試作データ。消さず名前だけ変える）
  try {
    const cols = await env.DB.prepare('PRAGMA table_info(pim_products)').all();
    const names = (cols.results || []).map((c) => c.name);
    if (names.length && names.indexOf('account_id') < 0) {
      const stamp = Date.now();
      for (const t of ['pim_products', 'pim_images', 'pim_imports', 'pim_issues']) {
        try { await env.DB.prepare('ALTER TABLE ' + t + ' RENAME TO ' + t + '_v1_' + stamp).run(); } catch (e) { /* 無ければ無いでよい */ }
      }
      // 旧表に付いたままの索引名を空ける（同名だと新表の CREATE INDEX IF NOT EXISTS が素通りして索引無しになる）
      for (const ix of ['idx_pim_products_name', 'idx_pim_products_maker', 'idx_pim_products_imgs', 'idx_pim_products_upd', 'idx_pim_issues_status', 'idx_pim_issues_jan']) {
        try { await env.DB.prepare('DROP INDEX IF EXISTS ' + ix).run(); } catch (e) { /* */ }
      }
    }
  } catch (e) { /* PRAGMA が使えない環境でも先へ */ }
  const stmts = [
    `CREATE TABLE IF NOT EXISTS pim_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, login_id TEXT NOT NULL UNIQUE, name TEXT NOT NULL, pass_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'dealer', active INTEGER NOT NULL DEFAULT 1, token_version INTEGER NOT NULL DEFAULT 1,
      note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, pass_changed_at TEXT, last_login_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS pim_login_fail (login_id TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, last_at TEXT)`,
    `CREATE TABLE IF NOT EXISTS pim_products (
      account_id INTEGER NOT NULL, jan TEXT NOT NULL, jan_valid INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
      price INTEGER, tax_included INTEGER NOT NULL DEFAULT 0, tax_rate INTEGER NOT NULL DEFAULT 10,
      price_ex INTEGER, price_in INTEGER, retail_price INTEGER, cost_price INTEGER,
      amount REAL, unit TEXT, maker TEXT, brand TEXT, category TEXT, description TEXT, sku TEXT,
      source TEXT, import_id INTEGER, image_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT,
      PRIMARY KEY (account_id, jan))`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_name ON pim_products(account_id, name)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_maker ON pim_products(account_id, maker)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_imgs ON pim_products(account_id, image_count)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_upd ON pim_products(account_id, updated_at)`,
    `CREATE TABLE IF NOT EXISTS pim_images (
      account_id INTEGER NOT NULL, jan TEXT NOT NULL, slot INTEGER NOT NULL, key TEXT NOT NULL, bytes INTEGER, width INTEGER, height INTEGER,
      original_name TEXT, original_type TEXT, created_at TEXT NOT NULL, created_by TEXT, PRIMARY KEY (account_id, jan, slot))`,
    `CREATE TABLE IF NOT EXISTS pim_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, ts TEXT NOT NULL, filename TEXT, source TEXT, mapping TEXT,
      total INTEGER NOT NULL DEFAULT 0, inserted INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0, invalid INTEGER NOT NULL DEFAULT 0)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_imports_acct ON pim_imports(account_id, id)`,
    `CREATE TABLE IF NOT EXISTS pim_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT, account_id INTEGER NOT NULL, ts TEXT NOT NULL, import_id INTEGER, kind TEXT NOT NULL, jan TEXT,
      message TEXT NOT NULL, existing TEXT, incoming TEXT, status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT, resolved_at TEXT, resolved_by TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_issues_status ON pim_issues(account_id, status, ts)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_issues_jan ON pim_issues(account_id, jan)`,
    `CREATE TABLE IF NOT EXISTS pim_blobs (key TEXT PRIMARY KEY, data BLOB NOT NULL, bytes INTEGER, created_at TEXT NOT NULL)`,
  ];
  await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
  await seedIfEmpty(env);
  schemaReady = true;
}

// ── 最初のアカウント（実証実験用）──
//   アカウントが1つも無いときだけ、テスト用の口座を作る。管理画面を開かなくてもスマホですぐ試せるように。
//   ★ 本番運用に入る前に、管理画面（pim/admin.html）で「PW再設定」か「停止」をすること。
const SEED_ACCOUNTS = [{ login_id: 'takemi', password: 'sueno', name: 'テスト用（末野）', note: '初期テスト用アカウント。実証実験が終わったらパスワード再設定か停止を' }];
async function seedIfEmpty(env) {
  try {
    const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_accounts').first();
    if (c && c.n > 0) return;
    const ts = nowIso();
    for (const a of SEED_ACCOUNTS) {
      const hash = await hashPassword(a.password);
      await env.DB.prepare('INSERT OR IGNORE INTO pim_accounts(login_id, name, pass_hash, role, active, token_version, note, created_at, updated_at, pass_changed_at) VALUES(?,?,?,?,1,1,?,?,?,?)')
        .bind(a.login_id, a.name, hash, 'dealer', a.note, ts, ts, ts).run();
    }
  } catch (e) { /* 作れなくても他の機能は動く（管理画面から発行できる） */ }
}

// ── 商品1件の入力を型どおりに揃える（API 境界の防波堤）──
// "1,100" "¥1100" "1100円" "１１００" も受ける（画面側で整えてくるが、API 直叩きの保険）
const numText = (v) => String(v).replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[,，¥￥円\s]/g, '');
const INT = (v) => { if (v == null || v === '') return null; const n = Math.round(Number(typeof v === 'number' ? v : numText(v))); return isFinite(n) ? n : null; };
const NUM = (v) => { if (v == null || v === '') return null; const n = Number(typeof v === 'number' ? v : numText(v)); return isFinite(n) ? n : null; };
const STR = (v, max) => { const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim(); return max ? s.slice(0, max) : s; };
export function sanitizeProduct(p) {
  const jan = cleanJan(p.jan);
  const taxIncluded = p.tax_included ? 1 : 0;
  const taxRate = INT(p.tax_rate); const rate = taxRate == null ? 10 : taxRate;
  const price = INT(p.price);
  let ex = INT(p.price_ex), inc = INT(p.price_in);
  if (price != null && (ex == null || inc == null)) {
    if (taxIncluded) { inc = price; ex = Math.round(price / (1 + rate / 100)); }
    else { ex = price; inc = Math.floor(price * (1 + rate / 100)); }
  }
  return {
    jan, jan_valid: janShapeOk(jan) && checkDigitOk(jan) ? 1 : 0,
    name: STR(p.name, 300), price, tax_included: taxIncluded, tax_rate: rate, price_ex: ex, price_in: inc,
    retail_price: INT(p.retail_price), cost_price: INT(p.cost_price),
    amount: NUM(p.amount), unit: STR(p.unit, 16),
    maker: STR(p.maker, 100), brand: STR(p.brand, 100), category: STR(p.category, 200),
    description: STR(p.description, 4000), sku: STR(p.sku, 64), source: STR(p.source, 100),
  };
}
export const PRODUCT_COLS = ['jan', 'jan_valid', 'name', 'price', 'tax_included', 'tax_rate', 'price_ex', 'price_in', 'retail_price', 'cost_price', 'amount', 'unit', 'maker', 'brand', 'category', 'description', 'sku', 'source'];

// UPSERT 文（import_id と created_at は挿入時のみ・updated_at/updated_by は毎回）
//   mode 'upsert'      … あれば上書き（本人が「上書き」と決めたとき）
//   mode 'insert_only' … 無いときだけ入れる（新規のつもりのもの。他の人が先に入れていたら何もしない → meta.changes が 0）
export function upsertStmt(env, acct, p, importId, ts, by, mode) {
  const cols = ['account_id'].concat(PRODUCT_COLS, ['import_id', 'created_at', 'updated_at', 'updated_by']);
  const vals = [acct].concat(PRODUCT_COLS.map((c) => p[c] == null ? null : p[c]), [importId == null ? null : importId, ts, ts, by || null]);
  const sets = PRODUCT_COLS.filter((c) => c !== 'jan').map((c) => c + '=excluded.' + c).concat(['updated_at=excluded.updated_at', 'updated_by=excluded.updated_by']).join(', ');
  return env.DB.prepare(
    'INSERT INTO pim_products(' + cols.join(',') + ') VALUES(' + cols.map(() => '?').join(',') + ') ' +
    (mode === 'insert_only' ? 'ON CONFLICT(account_id, jan) DO NOTHING' : 'ON CONFLICT(account_id, jan) DO UPDATE SET ' + sets)
  ).bind(...vals);
}

// 商品行に画像URLを付ける
export function withImages(origin, acct, rows, imagesByJan) {
  return rows.map((r) => {
    const imgs = (imagesByJan[r.jan] || []).slice().sort((a, b) => a.slot - b.slot);
    return Object.assign({}, r, {
      images: imgs.map((im) => ({ slot: im.slot, url: imageUrl(origin, acct, r.jan, im.slot, im.created_at), width: im.width, height: im.height, bytes: im.bytes, created_by: im.created_by, created_at: im.created_at })),
      image_urls: imgs.map((im) => imageUrl(origin, acct, r.jan, im.slot, im.created_at)),
    });
  });
}
export async function loadImages(env, acct, jans) {
  const out = {};
  for (let i = 0; i < jans.length; i += 90) {
    const chunk = jans.slice(i, i + 90);
    const rs = await env.DB.prepare('SELECT jan, slot, width, height, bytes, created_at, created_by FROM pim_images WHERE account_id=? AND jan IN (' + chunk.map(() => '?').join(',') + ')').bind(acct, ...chunk).all();
    for (const im of (rs.results || [])) (out[im.jan] = out[im.jan] || []).push(im);
  }
  return out;
}

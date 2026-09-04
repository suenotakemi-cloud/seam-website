// SEAM 商品マスタ統一（PIM）— API 共通部品
//   認証: env.ADMIN_KEY と x-seam-key ヘッダ（診断ダッシュボードと同じ合言葉）
//   保存: D1 binding "DB"（商品・画像台帳・注意）/ R2 binding "PRODUCT_IMAGES"（画像の実体・必ず webp）

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

export const SLOT_MIN = 1, SLOT_MAX = 5;
export function imageKey(jan, slot) { return 'products/' + jan + '/' + slot + '.webp'; }
export function imageUrl(origin, jan, slot, ver) { return origin + '/pim-img/' + imageKey(jan, slot) + (ver ? '?v=' + encodeURIComponent(ver) : ''); }

// ── スキーマ（db/pim-schema.sql と同じ内容。未投入でも動くよう初回に作る）──
let schemaReady = false;
export async function ensureSchema(env) {
  if (schemaReady || !hasDb(env)) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS pim_products (
      jan TEXT PRIMARY KEY, jan_valid INTEGER NOT NULL DEFAULT 1, name TEXT NOT NULL,
      price INTEGER, tax_included INTEGER NOT NULL DEFAULT 0, tax_rate INTEGER NOT NULL DEFAULT 10,
      price_ex INTEGER, price_in INTEGER, retail_price INTEGER, cost_price INTEGER,
      amount REAL, unit TEXT, maker TEXT, brand TEXT, category TEXT, description TEXT, sku TEXT,
      source TEXT, import_id INTEGER, image_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_name ON pim_products(name)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_maker ON pim_products(maker)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_imgs ON pim_products(image_count)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_products_upd ON pim_products(updated_at)`,
    `CREATE TABLE IF NOT EXISTS pim_images (
      jan TEXT NOT NULL, slot INTEGER NOT NULL, key TEXT NOT NULL, bytes INTEGER, width INTEGER, height INTEGER,
      original_name TEXT, original_type TEXT, created_at TEXT NOT NULL, created_by TEXT, PRIMARY KEY (jan, slot))`,
    `CREATE TABLE IF NOT EXISTS pim_imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, filename TEXT, source TEXT, mapping TEXT,
      total INTEGER NOT NULL DEFAULT 0, inserted INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL DEFAULT 0,
      skipped INTEGER NOT NULL DEFAULT 0, invalid INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS pim_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, import_id INTEGER, kind TEXT NOT NULL, jan TEXT,
      message TEXT NOT NULL, existing TEXT, incoming TEXT, status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT, resolved_at TEXT, resolved_by TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_issues_status ON pim_issues(status, ts)`,
    `CREATE INDEX IF NOT EXISTS idx_pim_issues_jan ON pim_issues(jan)`,
  ];
  await env.DB.batch(stmts.map((s) => env.DB.prepare(s)));
  // 旧スキーマで作られた表への列追加（あればエラーになるだけで無害）
  for (const a of ['ALTER TABLE pim_products ADD COLUMN updated_by TEXT', 'ALTER TABLE pim_images ADD COLUMN created_by TEXT', 'ALTER TABLE pim_issues ADD COLUMN resolved_by TEXT']) {
    try { await env.DB.prepare(a).run(); } catch (e) { /* 既にある */ }
  }
  schemaReady = true;
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
export function upsertStmt(env, p, importId, ts, by, mode) {
  const cols = PRODUCT_COLS.concat(['import_id', 'created_at', 'updated_at', 'updated_by']);
  const vals = PRODUCT_COLS.map((c) => p[c] == null ? null : p[c]).concat([importId == null ? null : importId, ts, ts, by || null]);
  const sets = PRODUCT_COLS.filter((c) => c !== 'jan').map((c) => c + '=excluded.' + c).concat(['updated_at=excluded.updated_at', 'updated_by=excluded.updated_by']).join(', ');
  return env.DB.prepare(
    'INSERT INTO pim_products(' + cols.join(',') + ') VALUES(' + cols.map(() => '?').join(',') + ') ' +
    (mode === 'insert_only' ? 'ON CONFLICT(jan) DO NOTHING' : 'ON CONFLICT(jan) DO UPDATE SET ' + sets)
  ).bind(...vals);
}

// 商品行に画像URLを付ける
export function withImages(origin, rows, imagesByJan) {
  return rows.map((r) => {
    const imgs = (imagesByJan[r.jan] || []).slice().sort((a, b) => a.slot - b.slot);
    return Object.assign({}, r, {
      images: imgs.map((im) => ({ slot: im.slot, url: imageUrl(origin, r.jan, im.slot, im.created_at), width: im.width, height: im.height, bytes: im.bytes })),
      image_urls: imgs.map((im) => imageUrl(origin, r.jan, im.slot, im.created_at)),
    });
  });
}
export async function loadImages(env, jans) {
  const out = {};
  for (let i = 0; i < jans.length; i += 90) {
    const chunk = jans.slice(i, i + 90);
    const rs = await env.DB.prepare('SELECT jan, slot, width, height, bytes, created_at FROM pim_images WHERE jan IN (' + chunk.map(() => '?').join(',') + ')').bind(...chunk).all();
    for (const im of (rs.results || [])) (out[im.jan] = out[im.jan] || []).push(im);
  }
  return out;
}

// フランチャイズ相談 API（functions/api/franchise.js）の最小試験。実行: node .github/tests/franchise.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequest } from '../../functions/api/franchise.js';

class FakeD1 {
  constructor() { this.db = new DatabaseSync(':memory:'); }
  prepare(sql) { const st = this.db.prepare(sql); let args = []; return {
    bind(...a) { args = a.map(v => (v === undefined ? null : v)); return this; },
    async run() { const r = st.run(...args); return { success: true, meta: { changes: r.changes } }; },
    async first() { return st.get(...args) ?? null; },
    async all() { return { results: st.all(...args) }; } }; }
}
const env = { DB: new FakeD1(), ADMIN_KEY: 'k-test' };
const call = (method, body, headers) => onRequest({ request: new Request('https://seam.site/api/franchise', { method, headers: { 'content-type': 'application/json', ...(headers || {}) }, body: body === undefined ? undefined : JSON.stringify(body) }), env });
let n = 0; const ok = s => { n++; console.log('  ✔ ' + s); };

// 1. 受付
{ const r = await call('POST', { company: '株式会社テスト', name: '山田', contact: 'test@example.com', area: '仙台', business: '美容室 2 店舗', message: '出店を検討しています', lang: 'ja' });
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true }); ok('受付できる'); }
// 2. 必須と形式
{ assert.equal((await call('POST', { name: '', contact: 'a@b.c' })).status, 400);
  assert.equal((await call('POST', { name: 'x', contact: 'なし' })).status, 400, '数字も @ も無い連絡先は弾く');
  assert.equal((await call('POST', 'not-json')).status, 400); ok('必須・形式・JSON'); }
// 3. スパム（ハニーポット・URL 3 本）は ok を返して保存しない
{ await call('POST', { name: 'bot', contact: '000', hp: 'x' });
  await call('POST', { name: 'bot', contact: '000', message: 'http://a http://b http://c' });
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS c FROM franchise_inquiries').get().c, 1); ok('スパムは捨てる'); }
// 4. 一覧はキー必須・PATCH で対応済み
{ assert.equal((await call('GET')).status, 401);
  const r = await call('GET', undefined, { 'x-seam-key': 'k-test' }); const j = await r.json();
  assert.equal(j.entries.length, 1); assert.equal(j.entries[0].company, '株式会社テスト'); assert.equal(j.entries[0].handled, 0);
  assert.equal((await call('PATCH', { id: j.entries[0].id, handled: true }, { 'x-seam-key': 'k-test' })).status, 200);
  assert.equal(env.DB.db.prepare('SELECT handled FROM franchise_inquiries').get().handled, 1); ok('一覧はキー必須・対応済み切替'); }
// 5. 長すぎる値は切る
{ await call('POST', { name: 'x'.repeat(200), contact: '090', message: 'm'.repeat(5000) });
  const row = env.DB.db.prepare('SELECT name,message FROM franchise_inquiries ORDER BY id DESC').get();
  assert.equal(row.name.length, 60); assert.equal(row.message.length, 2000); ok('長さの上限'); }
console.log(`franchise: ${n} 件合格`);

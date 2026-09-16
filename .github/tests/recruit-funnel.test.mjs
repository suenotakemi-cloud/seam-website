// 求人ファネル API の最小試験（events 表を node:sqlite で作って数える）。実行: node .github/tests/recruit-funnel.test.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { onRequestGet } from '../../functions/api/admin/recruit-funnel.js';
class FakeD1 { constructor() { this.db = new DatabaseSync(':memory:'); } prepare(sql) { const st = this.db.prepare(sql); let args = []; return { bind(...a) { args = a.map(v => v === undefined ? null : v); return this; }, async all() { return { results: st.all(...args) }; }, async first() { return st.get(...args) ?? null; }, async run() { st.run(...args); return { success: true }; } }; } }
const env = { DB: new FakeD1(), ADMIN_KEY: 'k' };
env.DB.db.exec("CREATE TABLE events (ts INTEGER, name TEXT, path TEXT, type TEXT, advice TEXT, tier INTEGER, mode TEXT, gender TEXT, target TEXT, label TEXT, ref TEXT, utm_source TEXT, utm_campaign TEXT, device TEXT, country TEXT, landing TEXT, meta TEXT)");
const ins = env.DB.db.prepare("INSERT INTO events (ts,name,path,label,ref,utm_campaign,device,landing,meta) VALUES (?,?,?,?,?,?,?,?,?)");
const now = Date.now();
for (let i = 0; i < 40; i++) ins.run(now - i * 3600e3, 'page_view', i % 4 ? '/recruit' : '/recruit-stylist-ginza', '', i % 3 ? 'instagram' : 'direct', i % 3 ? 'recruit_ig_0901' : '', 'mobile', '/recruit', null);
for (let i = 0; i < 12; i++) ins.run(now - i * 3600e3, 'page_engage', '/recruit', '', 'instagram', '', 'mobile', '/recruit', JSON.stringify({ sec: 10 + i, sd: i < 9 ? 20 + i : 95 }));
for (let i = 0; i < 6; i++) ins.run(now - i * 3600e3, 'sec_click', '/recruit-stylist-ginza', 'recruit_apply_line', 'instagram', '', 'mobile', '/recruit', null);
ins.run(now, 'sec_click', '/recruit', 'recruit_apply_ig', 'instagram', '', 'mobile', '/recruit', null); // 1 件＝5 未満なので伏せる
ins.run(now, 'recruit_form_sent', '/recruit', '', 'direct', '', 'mobile', '/recruit', null);
ins.run(now - 40 * 86400e3, 'page_view', '/recruit', '', 'google', '', 'mobile', '/recruit', null); // 期間外
ins.run(now, 'page_view', '/finder', '', 'google', '', 'mobile', '/finder', null); // 求人以外
const call = (qs, key) => onRequestGet({ request: new Request('https://seam.site/api/admin/recruit-funnel' + qs, { headers: key ? { 'x-seam-key': key } : {} }), env });
let n = 0; const ok = s => { n++; console.log('  ✔ ' + s); };
{ assert.equal((await call('', '')).status, 401); ok('キー無しは 401'); }
{ const j = await (await call('?days=30', 'k')).json();
  assert.equal(j.summary.views, 40, '期間外と求人以外は数えない'); assert.equal(j.summary.clicks, 7, '合計は伏せない（内訳だけ n<5 を伏せる）'); assert.equal(j.summary.sent, 1);
  assert.deepEqual(j.views.map(v => v.path), ['/recruit', '/recruit-stylist-ginza']);
  assert.ok(j.clicks.every(c => c.c >= 5), 'n<5 は出さない'); assert.equal(j.sentBySource.length, 0, '1 件の内訳は伏せる');
  const e = j.engage.find(x => x.path === '/recruit'); assert.equal(e.n, 12); assert.equal(e.sdMedian, 26); assert.equal(e.reachedForm, 25, '深度 85% 以上に達した割合');
  assert.ok(j.daily.length >= 1 && j.daily.every(d => 'v' in d && 'k' in d && 'f' in d)); ok('数え方（views/clicks/sent/engage/daily）'); }
{ const j = await (await call('?days=1', 'k')).json(); assert.ok(j.summary.views < 40); ok('days で期間を切れる'); }
console.log(`recruit-funnel: ${n} 件合格`);

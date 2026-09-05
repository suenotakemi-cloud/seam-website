// 自動取り込み（受信箱）— メール転送や共有フォルダの監視スクリプトから CSV を POST するだけで取り込まれる
//   POST /api/pim/inbox?key=inbox_…   multipart: file（CSV/TSV。Excel は受信箱に置くだけ） / または本文そのまま + ?filename=
//     ・key は PC「設定」→ アカウント → 自動取り込み用 URL で発行（漏れたら再発行）
//     ・前に同じ見出しのファイルを取り込んだことがあれば、その列合わせ・税区分で自動的に取り込む（新規は追加。登録済みと被る JAN は上書きせず「注意」へ）
//     ・見出しが初めてのファイル／Excel は「受信箱」に置く（PC の取り込みタブで列を合わせて取り込む）
//   GET  /api/pim/inbox（ログイン）      → 受信箱の一覧
//   GET  /api/pim/inbox?id=（ログイン）  → ファイル本体（PC で開くため）
//   POST /api/pim/inbox（ログイン）{ action:'done'|'delete', id } … 手で取り込んだ／消す
//   メール転送のしくみは workers/pim-inbox-email.js（Cloudflare Email Routing）
import PN from '../../../js/pim-normalize.js'; // UMD。バンドル時は CommonJS 扱いで default に入る。素の ESM なら self.PimNormalize
import { json, nowIso, blobPut, blobGet, blobDelete, hasDb, ensureSchema } from './_lib.js';
import { commitProducts } from './import.js';

const N = (PN && PN.decodeBytes) ? PN : ((typeof self !== 'undefined' && self.PimNormalize) || globalThis.PimNormalize);
const MAX = 1400000; // D1 の 1 行に収める（R2 があればもっと大きくてもよいが、CSV は普通 1MB 以下）

export async function onRequest(context) {
  const { request, env } = context;
  if (!hasDb(env)) return json({ ok: false, reason: 'no_db' }, 503);
  await ensureSchema(env);
  const url = new URL(request.url);
  const key = (url.searchParams.get('key') || request.headers.get('x-seam-inbox-key') || '').trim();
  if (request.method === 'POST' && /^inbox_[0-9a-f]{36}$/.test(key)) return receive(context, key);
  // ここから下はログイン済みの操作（_middleware は inbox を素通しするので、ここでトークンを確かめる）
  const { verifyToken } = await import('./_lib.js');
  const token = (request.headers.get('x-seam-token') || '').trim();
  const t = token ? await verifyToken(env, token) : null;
  const a = t ? await env.DB.prepare('SELECT * FROM pim_accounts WHERE id=?').bind(t.id).first() : null;
  if (!a || !a.active || a.token_version !== t.ver) return json({ ok: false, reason: 'unauthorized' }, 401);
  const acct = a.id;
  if (request.method === 'GET') {
    const id = parseInt(url.searchParams.get('id') || '0', 10);
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM pim_inbox WHERE id=? AND account_id=?').bind(id, acct).first();
      if (!row) return json({ ok: false, reason: 'not_found' }, 404);
      const obj = await blobGet(env, row.key);
      if (!obj) return json({ ok: false, reason: 'blob_missing' }, 404);
      return new Response(obj.body, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(row.filename || 'inbox.csv'), 'cache-control': 'no-store' } });
    }
    const rs = await env.DB.prepare('SELECT id, ts, filename, bytes, source, status, import_id, message FROM pim_inbox WHERE account_id=? ORDER BY id DESC LIMIT 100').bind(acct).all();
    return json({ ok: true, items: rs.results || [], pending: (rs.results || []).filter((r) => r.status === 'pending').length });
  }
  if (request.method === 'POST') {
    const b = await request.json().catch(() => null);
    const id = b && parseInt(b.id, 10);
    if (!id) return json({ ok: false, reason: 'no_id' }, 400);
    const row = await env.DB.prepare('SELECT * FROM pim_inbox WHERE id=? AND account_id=?').bind(id, acct).first();
    if (!row) return json({ ok: false, reason: 'not_found' }, 404);
    if (b.action === 'done') { await env.DB.prepare('UPDATE pim_inbox SET status=\'imported\', import_id=?, message=? WHERE id=?').bind(parseInt(b.import_id, 10) || null, 'PC で取り込み', id).run(); return json({ ok: true }); }
    if (b.action === 'delete') { await blobDelete(env, row.key); await env.DB.prepare('DELETE FROM pim_inbox WHERE id=?').bind(id).run(); return json({ ok: true }); }
    return json({ ok: false, reason: 'bad_action' }, 400);
  }
  return json({ ok: false, reason: 'bad_method' }, 405);
}

async function receive(context, key) {
  const { request, env } = context;
  const a = await env.DB.prepare('SELECT * FROM pim_accounts WHERE inbox_key=?').bind(key).first();
  if (!a || !a.active) return json({ ok: false, reason: 'bad_key', message: '自動取り込み用 URL が無効です（再発行されたか、アカウントが停止中）' }, 401);
  const acct = a.id, ts = nowIso();
  let buf = null, filename = '', source = '';
  const ct = request.headers.get('content-type') || '';
  if (ct.indexOf('multipart/form-data') >= 0) {
    const fd = await request.formData().catch(() => null);
    const f = fd && fd.get('file');
    if (!f || typeof f.arrayBuffer !== 'function') return json({ ok: false, reason: 'no_file', message: 'file を付けてください' }, 400);
    buf = new Uint8Array(await f.arrayBuffer()); filename = f.name || ''; source = String(fd.get('source') || '');
  } else {
    buf = new Uint8Array(await request.arrayBuffer()); filename = new URL(request.url).searchParams.get('filename') || ''; source = new URL(request.url).searchParams.get('source') || '';
  }
  filename = String(filename || 'inbox-' + ts.slice(0, 19).replace(/[:T]/g, '') + '.csv').slice(0, 200);
  source = String(source || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!buf.length) return json({ ok: false, reason: 'empty' }, 400);
  if (buf.length > MAX) return json({ ok: false, reason: 'too_large', message: 'ファイルが大きすぎます（' + Math.round(MAX / 1000) + 'KB まで）。PC の取り込み画面から入れてください' }, 413);
  const bkey = 'inbox/' + acct + '/' + ts.replace(/[^0-9]/g, '') + '-' + Math.random().toString(36).slice(2, 8);
  await blobPut(env, bkey, buf);
  const ins = await env.DB.prepare('INSERT INTO pim_inbox(account_id, ts, filename, bytes, key, source, status) VALUES(?,?,?,?,?,?,\'pending\')').bind(acct, ts, filename, buf.length, bkey, source).run();
  const inboxId = ins.meta.last_row_id;
  const pending = async (msg) => { await env.DB.prepare('UPDATE pim_inbox SET message=? WHERE id=?').bind(msg, inboxId).run(); return json({ ok: true, inbox_id: inboxId, status: 'pending', message: msg }); };

  if (/\.(xlsx|xlsm|xls)$/i.test(filename) || (buf[0] === 0x50 && buf[1] === 0x4b)) return pending('Excel は受信箱に置きました。PC の取り込み画面で列を合わせて取り込んでください');
  let rows, headers, headerRow;
  try {
    const dec = N.decodeBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    rows = N.parseCsv(dec.text, N.detectDelimiter(dec.text));
    if (!rows.length) return pending('行がありません');
    headerRow = N.findHeaderRow(rows);
    headers = rows[headerRow].map((h, i) => String(h || '').trim() || ('(' + (i + 1) + '列目)'));
  } catch (e) { return pending('読み込めませんでした: ' + String(e && e.message || e).slice(0, 200)); }
  // 同じ見出しのファイルを前に取り込んでいれば、その列合わせで自動取り込み
  const tpl = await env.DB.prepare('SELECT id, source, mapping, options, kind FROM pim_imports WHERE account_id=? AND headers=? AND rolled_back_at IS NULL ORDER BY id DESC LIMIT 1').bind(acct, JSON.stringify(headers)).first();
  if (!tpl) return pending('初めての見出しのファイルなので受信箱に置きました。PC の取り込み画面で列を合わせて取り込んでください（次回からは自動で取り込まれます）');
  let mapping = {}, options = {}; try { mapping = JSON.parse(tpl.mapping || '{}'); } catch (e) { /* */ } try { options = JSON.parse(tpl.options || '{}'); } catch (e) { /* */ }
  if (mapping.jan == null || mapping.name == null) return pending('前回の列合わせに JAN か商品名が無いため、PC で取り込んでください');
  const tplSource = String(tpl.source || '').replace(/（[^）]*）$/, '');
  const opts = { taxIncluded: !!options.taxIncluded, taxRate: options.taxRate == null ? 10 : options.taxRate, source: source || tplSource || filename, maker: source || tplSource };
  const items = rows.slice(headerRow + 1).map((r) => { const it = N.normalizeRow(r, mapping, opts); const raw = {}; headers.forEach((h, c) => { raw[h] = r[c] == null ? '' : String(r[c]); }); it.product._raw = raw; return it; });
  const ok = items.filter((i) => !i.errors.length), invalid = items.length - ok.length;
  const fileDups = N.findFileDuplicates(ok);
  const dupIdx = {}; Object.keys(fileDups).forEach((j) => fileDups[j].forEach((ix) => { dupIdx[ix] = j; }));
  const by = 'メール/自動取り込み';
  const imp = await env.DB.prepare('INSERT INTO pim_imports(account_id, ts, filename, source, mapping, headers, kind, total, options) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind(acct, ts, filename, (opts.source.slice(0, 80) + '（' + by + '）').slice(0, 100), JSON.stringify(mapping), JSON.stringify(headers), tpl.kind === 'update' ? 'update' : 'normal', items.length, JSON.stringify(options)).run();
  const importId = imp.meta.last_row_id;
  const products = [], issues = [], seen = {};
  ok.forEach((it, ix) => {
    const p = it.product;
    if (dupIdx[ix]) { // ファイル内の重複は決められないので注意へ
      if (seen[p.jan]) return; seen[p.jan] = 1;
      issues.push({ kind: 'dup_file', jan: p.jan, message: '同じファイル内で JAN ' + p.jan + ' が ' + fileDups[p.jan].length + '行にあります（自動取り込み）。どれを残すか決めてください', incoming: fileDups[p.jan].map((i) => ok[i].product) });
      return;
    }
    products.push(Object.assign({}, p, { _mode: tpl.kind === 'update' ? 'update' : 'new' })); // 登録済みと被る新規は commitProducts が dup_db の注意に回す
  });
  const fields = tpl.kind === 'update' ? (Array.isArray(options.fields) && options.fields.length ? options.fields : ['price']) : [];
  let inserted = 0, updated = 0, conflicts = 0, nIssues = 0;
  for (let i = 0; i < products.length; i += 300) {
    const r = await commitProducts(context, a, by, { import_id: importId, products: products.slice(i, i + 300), issues: i === 0 ? issues : [], fields });
    if (!r.ok) return pending('取り込めませんでした: ' + (r.message || r.reason));
    inserted += r.inserted; updated += r.updated; conflicts += r.conflicts; nIssues += r.issues;
  }
  if (!products.length && issues.length) { const r = await commitProducts(context, a, by, { import_id: importId, products: [], issues, fields }); nIssues += r.issues; }
  await env.DB.prepare('UPDATE pim_imports SET invalid=? WHERE id=?').bind(invalid, importId).run();
  const msg = '自動で取り込みました: 追加 ' + inserted + ' / 更新 ' + updated + ' / 注意 ' + nIssues + (conflicts ? '（登録済みと被った ' + conflicts + ' は上書きせず注意へ）' : '') + ' / 登録できない行 ' + invalid;
  await env.DB.prepare('UPDATE pim_inbox SET status=\'imported\', import_id=?, message=? WHERE id=?').bind(importId, msg, inboxId).run();
  return json({ ok: true, inbox_id: inboxId, status: 'imported', import_id: importId, inserted, updated, conflicts, issues: nIssues, invalid, message: msg });
}

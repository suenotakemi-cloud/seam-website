// CSV/Excel 取り込み（pim/import.html から呼ぶ）。整形はブラウザ側で済ませ、ここは「重複の確認」と「保存」だけ。
//   POST /api/pim/import  body.action =
//     'check'  { jans:[...] }                        → { existing:{ jan: 登録済み商品 } }  ※登録前に「登録済みと被る」を知るため
//     'begin'  { filename, source, mapping, total }  → { import_id }
//     'commit' { import_id, products:[{..., _mode:'new'|'overwrite'}], issues:[...] } → { inserted, updated, conflicts }  ※300件ずつ呼ぶ
//              _mode 'new'       … check の時点で未登録だったもの。保存時にも「無いときだけ入れる」。
//                                  別の人が同時に取り込んでいて先に入っていたら、上書きせず dup_db の注意に回す（conflicts）
//              _mode 'overwrite' … 本人が「届いた方で上書き」と決めたもの
//              _mode 'update'    … 更新取り込み: 登録済みの商品の「選んだ列だけ」を上書き（fields:[...]）。写真・他の列はそのまま。
//                                  未登録なら新規として入れる
//              _mode 'fill'      … メーカーのデータ（空欄だけ埋める）: 登録済みの商品は 商品名・商品コード を絶対に変えず、
//                                  空いている項目（価格・上代・仕入・内容量・メーカー・ブランド・カテゴリ・説明）だけを埋める。
//                                  元CSVの行(raw)も触らない（ディーラーの CSV がベース）。写真は画面側が空いている枠に足す。
//                                  未登録の JAN は fill_new:true のときだけ新規として入れる（既定は入れない → unknown に数える）
//     'finish' { import_id, invalid }                → { import }
//     'rollback' { import_id }                       → その取り込みで入った商品を消し（写真が付いたものは残す）、上書きした商品を取り込み前の内容に戻す
//                                                      （commit のたびに pim_import_backup へ「前の状態」を残しているので戻せる）
//     'template' { headers:[...] }                    → 同じ見出しのファイルを前に取り込んでいれば { mapping, source, options } を返す（列合わせの記憶）
//   check には keys:[name_key...] も渡せる → { similar:{ key:[{jan,name,maker}] } }（登録済みと商品名が似ているものの検出）
//   保存時に「表記の辞書」（pim_dict: メーカー・ブランド・カテゴリ）を当てる
//
// 重複の扱い（要件: JANが被るものは登録せず「注意」として出す）
//   ・同じファイル内で JAN が被る … ブラウザが検知。決めなければ登録せず pim_issues(kind=dup_file) に積む
//   ・登録済みと JAN が被る     … 'check' で知らせる。決めなければ登録せず pim_issues(kind=dup_db) に積む
//   いずれも画面で「どちらを残す」を選ぶと、そのときだけ保存される（issues.js）
import { json, cleanJan, janShapeOk, sanitizeProduct, upsertStmt, nowIso, userOf, loadDict, applyDict, logChanges, notifyWebhook, PRODUCT_COLS, imageKey, blobDelete, SLOT_MAX } from './_lib.js';

async function loadExistingOf(env, acct, jans) {
  const out = {};
  for (let i = 0; i < jans.length; i += 90) {
    const chunk = jans.slice(i, i + 90);
    const rs = await env.DB.prepare('SELECT * FROM pim_products WHERE account_id=? AND jan IN (' + chunk.map(() => '?').join(',') + ')').bind(acct, ...chunk).all();
    for (const r of (rs.results || [])) out[r.jan] = r;
  }
  return out;
}

// 保存の本体（PC の取り込み画面と、自動取り込み inbox.js の両方から使う）
//   b: { import_id, products:[...], issues:[...], fields:[...] } → { ok, inserted, updated, conflicts, issues } / { ok:false, status, reason, message }
export async function commitProducts(context, account, by, b) {
  const env = context.env, acct = account.id;
  const loadExisting = (jans) => loadExistingOf(env, acct, jans);
    const importId = parseInt(b.import_id, 10) || null;
    const ts = nowIso();
    const raw = (Array.isArray(b.products) ? b.products : []).slice(0, 500);
    const ALLOWED_FIELDS = ['name', 'price', 'retail_price', 'cost_price', 'amount', 'maker', 'brand', 'category', 'description', 'sku'];
    const updFields = (Array.isArray(b.fields) ? b.fields : []).filter((f) => ALLOWED_FIELDS.indexOf(f) >= 0);
    if (raw.some((r) => r && r._mode === 'update') && !updFields.length) return { ok: false, status: 400, reason: 'no_fields', message: '更新取り込みでは、上書きする列を1つ以上選んでください' };
    const fillNew = !!b.fill_new;
    const dict = await loadDict(env, acct);
    const products = raw.map((r) => {
      const p = applyDict(dict, sanitizeProduct(r));
      // 元CSVの1行（見出し→値）。「菊池CSVの形＋画像」で出すために、そのまま保管する
      if (r && r._raw && typeof r._raw === 'object') { try { p.raw = JSON.stringify(r._raw); } catch (e) { /* */ } }
      const mode = r && r._mode === 'overwrite' ? 'upsert' : (r && r._mode === 'update' ? 'update' : (r && r._mode === 'fill' ? 'fill' : 'insert_only'));
      return { p, mode };
    }).filter((x) => x.p.jan && janShapeOk(x.p.jan) && (x.p.name || x.mode === 'fill')); // 空欄埋めは商品名が無い行（JAN＋写真だけ）も可
    // 保存（新規のつもりのものは「無いときだけ」。changes=0 なら他の人が先に入れている）
    let inserted = 0, updated = 0, conflicts = 0, filled = 0, unchanged = 0;
    const conflictJans = [], unknownJans = [];
    // 空欄埋め: 「今ある値が空のときだけ」入れる列。商品名・商品コードは絶対に触らない
    const FILL_TEXT = ['retail_price', 'cost_price', 'maker', 'brand', 'category', 'description'];
    const empty = (v) => v == null || String(v).trim() === '';
    const fillStmt = (p, cur) => { // cur: 登録済みの行。埋める列が無ければ null
      const sets = [], vals = [];
      FILL_TEXT.forEach((f) => { if (empty(cur[f]) && !empty(p[f])) { sets.push(f + '=?'); vals.push(p[f]); } });
      if (empty(cur.price_ex) && empty(cur.price_in) && p.price_ex != null) { sets.push('price=?', 'tax_included=?', 'tax_rate=?', 'price_ex=?', 'price_in=?'); vals.push(p.price, p.tax_included, p.tax_rate, p.price_ex, p.price_in); }
      if (empty(cur.amount) && p.amount != null) { sets.push('amount=?', 'unit=?'); vals.push(p.amount, p.unit == null ? '' : p.unit); }
      if (!sets.length) return null;
      sets.push('updated_at=?', 'updated_by=?'); vals.push(ts, by || null);
      return env.DB.prepare('UPDATE pim_products SET ' + sets.join(', ') + ' WHERE account_id=? AND jan=?').bind(...vals, acct, p.jan);
    };
    // 更新取り込み: 選んだ列だけ UPDATE。無ければ INSERT（changes=0 のときに拾う）
    // 元CSVの行(raw)も、通常取り込みの列名に合わせて値を差し替える（改定CSVの「価格」→ 元CSVの「標準売上単価」列へ）
    let rawHeaderOf = {};
    if (products.some((x) => x.mode === 'update')) {
      const base = await env.DB.prepare('SELECT mapping, headers FROM pim_imports WHERE account_id=? AND headers IS NOT NULL AND (kind IS NULL OR kind=\'normal\') ORDER BY id DESC LIMIT 1').bind(acct).first();
      if (base) {
        try {
          const m = JSON.parse(base.mapping || '{}'), h = JSON.parse(base.headers || '[]');
          const F = { price: 'price', retail_price: 'retail', cost_price: 'cost', name: 'name', maker: 'maker', brand: 'brand', description: 'description', sku: 'sku', amount: 'amount' };
          Object.keys(F).forEach((f) => { const idx = m[F[f]]; if (typeof idx === 'number' && h[idx]) rawHeaderOf[f] = h[idx]; });
        } catch (e) { rawHeaderOf = {}; }
      }
    }
    const updateStmt = (p) => {
      const sets = [], vals = [];
      updFields.forEach((f) => { sets.push(f + '=?'); vals.push(p[f] == null ? null : p[f]); });
      if (updFields.indexOf('price') >= 0) { sets.push('tax_included=?', 'tax_rate=?', 'price_ex=?', 'price_in=?'); vals.push(p.tax_included, p.tax_rate, p.price_ex, p.price_in); }
      if (updFields.indexOf('amount') >= 0) { sets.push('unit=?'); vals.push(p.unit); }
      if (updFields.indexOf('name') >= 0) { sets.push('name_key=?'); vals.push(p.name_key); }
      // 元CSVの行は「上書き」でなく「足す」（改定CSVの2列で22列を潰さない）。更新した列は元CSVの列名で差し替える
      const patch = {};
      updFields.forEach((f) => { const h = rawHeaderOf[f]; if (h && p[f] != null) patch[h] = String(p[f]); });
      if (Object.keys(patch).length) { sets.push('raw=json_patch(COALESCE(raw, \'{}\'), ?)'); vals.push(JSON.stringify(patch)); }
      sets.push('updated_at=?', 'updated_by=?', 'import_id=?'); vals.push(ts, by || null, importId);
      return env.DB.prepare('UPDATE pim_products SET ' + sets.join(', ') + ' WHERE account_id=? AND jan=?').bind(...vals, acct, p.jan);
    };
    for (let i = 0; i < products.length; i += 50) {
      const chunk = products.slice(i, i + 50);
      // 取り消し用に「前の状態」を残す（無かった＝NULL。同じ取り込みで2回目以降は最初のものを残す）
      const backupOf = (rows, before) => rows.map((x) => env.DB.prepare('INSERT OR IGNORE INTO pim_import_backup(import_id, account_id, jan, before) VALUES(?,?,?,?)')
        .bind(importId, acct, x.p.jan, before[x.p.jan] ? JSON.stringify(before[x.p.jan]).slice(0, 60000) : null));
      const plain = chunk.filter((x) => x.mode !== 'fill');
      if (importId && plain.length) await env.DB.batch(backupOf(plain, await loadExisting(plain.map((x) => x.p.jan))));
      // 空欄埋め: 登録済みなら「空の列だけ」UPDATE（埋める列が無ければ何もしない）。未登録は fill_new のときだけ新規
      const fillChunk = chunk.filter((x) => x.mode === 'fill');
      if (fillChunk.length) {
        const cur = await loadExisting(fillChunk.map((x) => x.p.jan));
        const st = [], stIdx = [];
        fillChunk.forEach((x) => {
          if (cur[x.p.jan]) { const q = fillStmt(x.p, cur[x.p.jan]); if (q) { st.push(q); stIdx.push(x); } else unchanged++; }
          else if (fillNew && x.p.name) { st.push(upsertStmt(env, acct, x.p, importId, ts, by, 'insert_only')); stIdx.push(x); x.isNew = true; }
          else unknownJans.push(x.p.jan);
        });
        if (st.length) {
          if (importId) await env.DB.batch(backupOf(stIdx, cur)); // 実際に触る行だけ「前の状態」を残す（触らない JAN を取り消しで消さないため）
          const rs = await env.DB.batch(st);
          stIdx.forEach((x, k) => { const ch = rs[k] && rs[k].meta ? rs[k].meta.changes : 1; if (x.isNew) { if (ch) inserted++; else unchanged++; } else if (ch) filled++; else unchanged++; });
        }
      }
      const rest = plain;
      const res = rest.length ? await env.DB.batch(rest.map((x) => x.mode === 'update' ? updateStmt(x.p) : upsertStmt(env, acct, x.p, importId, ts, by, x.mode))) : [];
      const missing = [];
      rest.forEach((x, k) => {
        const ch = res[k] && res[k].meta ? res[k].meta.changes : 1;
        if (x.mode === 'insert_only') { if (ch) inserted++; else { conflicts++; conflictJans.push(x.p.jan); } }
        else if (x.mode === 'update') { if (ch) updated++; else missing.push(x); }
        else updated++;
      });
      if (missing.length) { // 更新対象が無かった＝新規。入れる
        const r2 = await env.DB.batch(missing.map((x) => upsertStmt(env, acct, x.p, importId, ts, by, 'insert_only')));
        missing.forEach((x, k) => { const ch = r2[k] && r2[k].meta ? r2[k].meta.changes : 1; if (ch) inserted++; else updated++; });
      }
    }
    // 注意（未解決の重複）
    const issues = (Array.isArray(b.issues) ? b.issues : []).slice(0, 500);
    // 同時取り込みで先を越されたものは、登録済み側を取り直して dup_db の注意にする
    if (conflictJans.length) {
      const cur = await loadExisting(conflictJans);
      for (const x of products) {
        if (x.mode !== 'insert_only' || !cur[x.p.jan]) continue;
        const ex = cur[x.p.jan];
        issues.push({ kind: 'dup_db', jan: x.p.jan, message: '取り込み中に' + (ex.updated_by ? ex.updated_by + ' さんが' : '他の人が') + '同じ JAN ' + x.p.jan + '「' + ex.name + '」を先に登録しました。届いた「' + x.p.name + '」は登録していません。どちらを残すか決めてください', existing: ex, incoming: x.p });
      }
    }
    const stmts = issues.map((is) => {
      const kind = ['dup_db', 'dup_file', 'invalid_jan', 'missing', 'similar_name'].indexOf(is.kind) >= 0 ? is.kind : 'dup_file';
      return env.DB.prepare(
        'INSERT INTO pim_issues(account_id, ts, import_id, kind, jan, message, existing, incoming) VALUES(?,?,?,?,?,?,?,?)'
      ).bind(acct, ts, importId, kind, cleanJan(is.jan || '').slice(0, 14), String(is.message || '').slice(0, 1000),
        is.existing ? JSON.stringify(is.existing).slice(0, 20000) : null,
        is.incoming ? JSON.stringify(is.incoming).slice(0, 60000) : null);
    });
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    if (importId) {
      await env.DB.prepare('UPDATE pim_imports SET inserted=inserted+?, updated=updated+?, skipped=skipped+? WHERE id=? AND account_id=?')
        .bind(inserted, updated + filled, issues.length + unknownJans.length, importId, acct).run();
    }
    const changed = products.filter((x) => !(x.mode === 'insert_only' && conflictJans.indexOf(x.p.jan) >= 0) && !(x.mode === 'fill' && unknownJans.indexOf(x.p.jan) >= 0)).map((x) => x.p.jan);
    if (changed.length) { await logChanges(env, acct, changed, 'product', by); notifyWebhook(context, account, 'product', changed, by); }
    return { ok: true, inserted, updated, conflicts, filled, unchanged, unknown: unknownJans.length, unknown_jans: unknownJans.slice(0, 50), issues: issues.length };
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const action = String(b.action || '');
  const by = userOf(request);
  const loadExisting = (jans) => loadExistingOf(env, acct, jans);

  if (action === 'check') {
    const jans = Array.from(new Set((Array.isArray(b.jans) ? b.jans : []).map(cleanJan).filter(janShapeOk)));
    const keys = Array.from(new Set((Array.isArray(b.keys) ? b.keys : []).map((k) => String(k || '').slice(0, 200)).filter(Boolean))).slice(0, 5000);
    const similar = {};
    for (let i = 0; i < keys.length; i += 90) {
      const chunk = keys.slice(i, i + 90);
      const rs = await env.DB.prepare('SELECT jan, name, maker, name_key FROM pim_products WHERE account_id=? AND name_key IN (' + chunk.map(() => '?').join(',') + ')').bind(acct, ...chunk).all();
      for (const r of (rs.results || [])) (similar[r.name_key] = similar[r.name_key] || []).push({ jan: r.jan, name: r.name, maker: r.maker });
    }
    return json({ ok: true, existing: await loadExisting(jans), similar });
  }

  if (action === 'template') {
    const headers = Array.isArray(b.headers) ? b.headers.map((h) => String(h == null ? '' : h).slice(0, 200)).slice(0, 200) : [];
    if (!headers.length) return json({ ok: true, template: null });
    const row = await env.DB.prepare('SELECT id, ts, filename, source, mapping, options, kind FROM pim_imports WHERE account_id=? AND headers=? AND rolled_back_at IS NULL ORDER BY id DESC LIMIT 1').bind(acct, JSON.stringify(headers)).first();
    if (!row) return json({ ok: true, template: null });
    let mapping = {}, options = {}; try { mapping = JSON.parse(row.mapping || '{}'); } catch (e) { /* */ } try { options = JSON.parse(row.options || '{}'); } catch (e) { /* */ }
    return json({ ok: true, template: { import_id: row.id, ts: row.ts, filename: row.filename, source: String(row.source || '').replace(/（[^）]*）$/, ''), mapping, options, kind: row.kind === 'update' || row.kind === 'fill' ? row.kind : 'normal' } });
  }

  if (action === 'begin') {
    const headers = Array.isArray(b.headers) ? b.headers.map((h) => String(h == null ? '' : h).slice(0, 200)).slice(0, 200) : null; // 元CSVの見出し（元の形で出力するため）
    const kind = b.kind === 'update' ? 'update' : (b.kind === 'fill' ? 'fill' : 'normal'); // update = 改定CSVなど（列が少ない）/ fill = メーカーのデータ（空欄だけ埋める）。元CSVの形の出力には normal の見出しを使う
    const options = b.options && typeof b.options === 'object' ? JSON.stringify(b.options).slice(0, 2000) : null; // 税区分・税率・更新列など（次回の自動適用用）
    const r = await env.DB.prepare(
      'INSERT INTO pim_imports(account_id, ts, filename, source, mapping, headers, kind, total, options) VALUES(?,?,?,?,?,?,?,?,?)'
    ).bind(acct, nowIso(), String(b.filename || '').slice(0, 200), (String(b.source || '').slice(0, 80) + (by ? '（' + by + '）' : '')).slice(0, 100), JSON.stringify(b.mapping || {}).slice(0, 4000), headers ? JSON.stringify(headers).slice(0, 20000) : null, kind, Math.max(0, parseInt(b.total, 10) || 0), options).run();
    return json({ ok: true, import_id: r.meta && r.meta.last_row_id });
  }

  if (action === 'commit') { const r = await commitProducts(context, data.account, by, b); return json(r, r.status || 200); }

  if (action === 'rollback') {
    const importId = parseInt(b.import_id, 10) || 0;
    const imp = await env.DB.prepare('SELECT * FROM pim_imports WHERE id=? AND account_id=?').bind(importId, acct).first();
    if (!imp) return json({ ok: false, reason: 'not_found' }, 404);
    if (imp.rolled_back_at) return json({ ok: false, reason: 'already', message: 'この取り込みは既に取り消されています（' + imp.rolled_back_at.slice(0, 16).replace('T', ' ') + '）' }, 409);
    // 先に「取り消し中」の印を付けて、2人が同時に押しても1回だけ走るようにする
    const ts = nowIso();
    const lock = await env.DB.prepare('UPDATE pim_imports SET rolled_back_at=?, rolled_back_by=? WHERE id=? AND account_id=? AND rolled_back_at IS NULL').bind(ts, by || null, importId, acct).run();
    if (!(lock.meta && lock.meta.changes)) return json({ ok: false, reason: 'already', message: '他の人が先に取り消しました' }, 409);
    let deleted = 0, restored = 0, keptWithImages = 0, missing = 0;
    const touched = [];
    for (let off = 0; ; off += 200) {
      const rs = await env.DB.prepare('SELECT jan, before FROM pim_import_backup WHERE import_id=? AND account_id=? ORDER BY jan LIMIT 200 OFFSET ?').bind(importId, acct, off).all();
      const rows = rs.results || [];
      if (!rows.length) break;
      const cur = await loadExisting(rows.map((r) => r.jan));
      const stmts = [];
      for (const r of rows) {
        const now = cur[r.jan];
        if (!r.before) {
          // この取り込みで新しく入った商品 → 消す。ただし写真が付いていたら（撮影の成果を失わないよう）残す
          if (!now) { missing++; continue; }
          if (now.image_count > 0) { keptWithImages++; continue; }
          for (let sl = 1; sl <= SLOT_MAX; sl++) await blobDelete(env, imageKey(acct, r.jan, sl));
          stmts.push(env.DB.prepare('DELETE FROM pim_images WHERE account_id=? AND jan=?').bind(acct, r.jan));
          stmts.push(env.DB.prepare('DELETE FROM pim_products WHERE account_id=? AND jan=?').bind(acct, r.jan));
          deleted++; touched.push(r.jan);
        } else {
          let prev = null; try { prev = JSON.parse(r.before); } catch (e) { prev = null; }
          if (!prev) { missing++; continue; }
          const cols = PRODUCT_COLS.filter((c) => c !== 'jan').concat(['raw', 'source', 'import_id']);
          const sets = cols.map((c) => c + '=?').join(', ') + ', updated_at=?, updated_by=?';
          const vals = cols.map((c) => (prev[c] == null ? null : prev[c])).concat([ts, by || null]);
          stmts.push(env.DB.prepare('UPDATE pim_products SET ' + sets + ' WHERE account_id=? AND jan=?').bind(...vals, acct, r.jan));
          restored++; touched.push(r.jan);
        }
      }
      for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
      if (rows.length < 200) break;
    }
    // この取り込みで積んだ未解決の注意も閉じる
    await env.DB.prepare('UPDATE pim_issues SET status=\'resolved\', resolution=\'rolled_back\', resolved_at=?, resolved_by=? WHERE account_id=? AND import_id=? AND status=\'open\'').bind(ts, by || null, acct, importId).run();
    await logChanges(env, acct, touched, 'product', by); notifyWebhook(context, data.account, 'product', touched, by);
    return json({ ok: true, import_id: importId, deleted, restored, kept_with_images: keptWithImages, missing });
  }

  if (action === 'finish') {
    const importId = parseInt(b.import_id, 10) || null;
    if (importId) {
      await env.DB.prepare('UPDATE pim_imports SET invalid=? WHERE id=? AND account_id=?').bind(Math.max(0, parseInt(b.invalid, 10) || 0), importId, acct).run();
      const row = await env.DB.prepare('SELECT * FROM pim_imports WHERE id=? AND account_id=?').bind(importId, acct).first();
      return json({ ok: true, import: row });
    }
    return json({ ok: true });
  }

  return json({ ok: false, reason: 'bad_action' }, 400);
}

// GET /api/pim/import → 取り込み履歴
export async function onRequestGet({ env, data }) {
  const rs = await env.DB.prepare('SELECT i.id, i.ts, i.filename, i.source, i.kind, i.total, i.inserted, i.updated, i.skipped, i.invalid, i.headers IS NOT NULL AS has_headers, i.rolled_back_at, i.rolled_back_by, (SELECT COUNT(*) FROM pim_import_backup b WHERE b.import_id=i.id) AS backup_rows FROM pim_imports i WHERE i.account_id=? ORDER BY i.id DESC LIMIT 50').bind(data.account.id).all();
  return json({ ok: true, imports: rs.results || [] });
}

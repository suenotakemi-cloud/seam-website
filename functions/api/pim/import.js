// CSV/Excel 取り込み（pim/import.html から呼ぶ）。整形はブラウザ側で済ませ、ここは「重複の確認」と「保存」だけ。
//   POST /api/pim/import  body.action =
//     'check'  { jans:[...] }                        → { existing:{ jan: 登録済み商品 } }  ※登録前に「登録済みと被る」を知るため
//     'begin'  { filename, source, mapping, total }  → { import_id }
//     'commit' { import_id, products:[{..., _mode:'new'|'overwrite'}], issues:[...] } → { inserted, updated, conflicts }  ※300件ずつ呼ぶ
//              _mode 'new'       … check の時点で未登録だったもの。保存時にも「無いときだけ入れる」。
//                                  別の人が同時に取り込んでいて先に入っていたら、上書きせず dup_db の注意に回す（conflicts）
//              _mode 'overwrite' … 本人が「届いた方で上書き」と決めたもの
//     'finish' { import_id, invalid, skipped }       → { import }
//
// 重複の扱い（要件: JANが被るものは登録せず「注意」として出す）
//   ・同じファイル内で JAN が被る … ブラウザが検知。決めなければ登録せず pim_issues(kind=dup_file) に積む
//   ・登録済みと JAN が被る     … 'check' で知らせる。決めなければ登録せず pim_issues(kind=dup_db) に積む
//   いずれも画面で「どちらを残す」を選ぶと、そのときだけ保存される（issues.js）
import { json, cleanJan, janShapeOk, sanitizeProduct, upsertStmt, nowIso, userOf } from './_lib.js';

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const action = String(b.action || '');

  if (action === 'check') {
    const jans = Array.from(new Set((Array.isArray(b.jans) ? b.jans : []).map(cleanJan).filter(janShapeOk)));
    const existing = {};
    for (let i = 0; i < jans.length; i += 90) {
      const chunk = jans.slice(i, i + 90);
      const rs = await env.DB.prepare('SELECT * FROM pim_products WHERE jan IN (' + chunk.map(() => '?').join(',') + ')').bind(...chunk).all();
      for (const r of (rs.results || [])) existing[r.jan] = r;
    }
    return json({ ok: true, existing });
  }

  if (action === 'begin') {
    const r = await env.DB.prepare(
      'INSERT INTO pim_imports(ts, filename, source, mapping, total) VALUES(?,?,?,?,?)'
    ).bind(nowIso(), String(b.filename || '').slice(0, 200), (String(b.source || '').slice(0, 80) + (userOf(request) ? '（' + userOf(request) + '）' : '')).slice(0, 100), JSON.stringify(b.mapping || {}).slice(0, 4000), Math.max(0, parseInt(b.total, 10) || 0)).run();
    const id = r.meta && r.meta.last_row_id;
    return json({ ok: true, import_id: id });
  }

  if (action === 'commit') {
    const importId = parseInt(b.import_id, 10) || null;
    const by = userOf(request);
    const ts = nowIso();
    const raw = (Array.isArray(b.products) ? b.products : []).slice(0, 500);
    const products = raw.map((r) => ({ p: sanitizeProduct(r), mode: r && r._mode === 'overwrite' ? 'upsert' : 'insert_only' })).filter((x) => x.p.jan && janShapeOk(x.p.jan) && x.p.name);
    // 保存（新規のつもりのものは「無いときだけ」。changes=0 なら他の人が先に入れている）
    let inserted = 0, updated = 0, conflicts = 0;
    const conflictJans = [];
    for (let i = 0; i < products.length; i += 50) {
      const chunk = products.slice(i, i + 50);
      const res = await env.DB.batch(chunk.map((x) => upsertStmt(env, x.p, importId, ts, by, x.mode)));
      chunk.forEach((x, k) => {
        const ch = res[k] && res[k].meta ? res[k].meta.changes : 1;
        if (x.mode === 'insert_only') { if (ch) inserted++; else { conflicts++; conflictJans.push(x.p.jan); } }
        else updated++;
      });
    }
    const stmts = [];
    // 注意（未解決の重複）
    const issues = (Array.isArray(b.issues) ? b.issues : []).slice(0, 500);
    // 同時取り込みで先を越されたものは、登録済み側を取り直して dup_db の注意にする
    if (conflictJans.length) {
      const cur = {};
      for (let i = 0; i < conflictJans.length; i += 90) {
        const chunk = conflictJans.slice(i, i + 90);
        const rs = await env.DB.prepare('SELECT * FROM pim_products WHERE jan IN (' + chunk.map(() => '?').join(',') + ')').bind(...chunk).all();
        for (const r of (rs.results || [])) cur[r.jan] = r;
      }
      for (const x of products) {
        if (x.mode !== 'insert_only' || !cur[x.p.jan]) continue;
        const ex = cur[x.p.jan];
        issues.push({ kind: 'dup_db', jan: x.p.jan, message: '取り込み中に' + (ex.updated_by ? ex.updated_by + ' さんが' : '他の人が') + '同じ JAN ' + x.p.jan + '「' + ex.name + '」を先に登録しました。届いた「' + x.p.name + '」は登録していません。どちらを残すか決めてください', existing: ex, incoming: x.p });
      }
    }
    for (const is of issues) {
      const kind = ['dup_db', 'dup_file', 'invalid_jan', 'missing'].indexOf(is.kind) >= 0 ? is.kind : 'dup_file';
      stmts.push(env.DB.prepare(
        'INSERT INTO pim_issues(ts, import_id, kind, jan, message, existing, incoming) VALUES(?,?,?,?,?,?,?)'
      ).bind(ts, importId, kind, cleanJan(is.jan || '').slice(0, 14), String(is.message || '').slice(0, 1000),
        is.existing ? JSON.stringify(is.existing).slice(0, 20000) : null,
        is.incoming ? JSON.stringify(is.incoming).slice(0, 60000) : null));
    }
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    if (importId) {
      await env.DB.prepare('UPDATE pim_imports SET inserted=inserted+?, updated=updated+?, skipped=skipped+? WHERE id=?')
        .bind(inserted, updated, issues.length, importId).run();
    }
    return json({ ok: true, inserted, updated, conflicts, issues: issues.length });
  }

  if (action === 'finish') {
    const importId = parseInt(b.import_id, 10) || null;
    if (importId) {
      await env.DB.prepare('UPDATE pim_imports SET invalid=? WHERE id=?').bind(Math.max(0, parseInt(b.invalid, 10) || 0), importId).run();
      const row = await env.DB.prepare('SELECT * FROM pim_imports WHERE id=?').bind(importId).first();
      return json({ ok: true, import: row });
    }
    return json({ ok: true });
  }

  return json({ ok: false, reason: 'bad_action' }, 400);
}

// GET /api/pim/import → 取り込み履歴
export async function onRequestGet({ env }) {
  const rs = await env.DB.prepare('SELECT id, ts, filename, source, total, inserted, updated, skipped, invalid FROM pim_imports ORDER BY id DESC LIMIT 50').all();
  return json({ ok: true, imports: rs.results || [] });
}

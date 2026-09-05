// CSV/Excel 取り込み（pim/import.html から呼ぶ）。整形はブラウザ側で済ませ、ここは「重複の確認」と「保存」だけ。
//   POST /api/pim/import  body.action =
//     'check'  { jans:[...] }                        → { existing:{ jan: 登録済み商品 } }  ※登録前に「登録済みと被る」を知るため
//     'begin'  { filename, source, mapping, total }  → { import_id }
//     'commit' { import_id, products:[{..., _mode:'new'|'overwrite'}], issues:[...] } → { inserted, updated, conflicts }  ※300件ずつ呼ぶ
//              _mode 'new'       … check の時点で未登録だったもの。保存時にも「無いときだけ入れる」。
//                                  別の人が同時に取り込んでいて先に入っていたら、上書きせず dup_db の注意に回す（conflicts）
//              _mode 'overwrite' … 本人が「届いた方で上書き」と決めたもの
//     'finish' { import_id, invalid }                → { import }
//
// 重複の扱い（要件: JANが被るものは登録せず「注意」として出す）
//   ・同じファイル内で JAN が被る … ブラウザが検知。決めなければ登録せず pim_issues(kind=dup_file) に積む
//   ・登録済みと JAN が被る     … 'check' で知らせる。決めなければ登録せず pim_issues(kind=dup_db) に積む
//   いずれも画面で「どちらを残す」を選ぶと、そのときだけ保存される（issues.js）
import { json, cleanJan, janShapeOk, sanitizeProduct, upsertStmt, nowIso, userOf } from './_lib.js';

export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const action = String(b.action || '');
  const by = userOf(request);

  const loadExisting = async (jans) => {
    const out = {};
    for (let i = 0; i < jans.length; i += 90) {
      const chunk = jans.slice(i, i + 90);
      const rs = await env.DB.prepare('SELECT * FROM pim_products WHERE account_id=? AND jan IN (' + chunk.map(() => '?').join(',') + ')').bind(acct, ...chunk).all();
      for (const r of (rs.results || [])) out[r.jan] = r;
    }
    return out;
  };

  if (action === 'check') {
    const jans = Array.from(new Set((Array.isArray(b.jans) ? b.jans : []).map(cleanJan).filter(janShapeOk)));
    return json({ ok: true, existing: await loadExisting(jans) });
  }

  if (action === 'begin') {
    const headers = Array.isArray(b.headers) ? b.headers.map((h) => String(h == null ? '' : h).slice(0, 200)).slice(0, 200) : null; // 元CSVの見出し（元の形で出力するため）
    const r = await env.DB.prepare(
      'INSERT INTO pim_imports(account_id, ts, filename, source, mapping, headers, total) VALUES(?,?,?,?,?,?,?)'
    ).bind(acct, nowIso(), String(b.filename || '').slice(0, 200), (String(b.source || '').slice(0, 80) + (by ? '（' + by + '）' : '')).slice(0, 100), JSON.stringify(b.mapping || {}).slice(0, 4000), headers ? JSON.stringify(headers).slice(0, 20000) : null, Math.max(0, parseInt(b.total, 10) || 0)).run();
    return json({ ok: true, import_id: r.meta && r.meta.last_row_id });
  }

  if (action === 'commit') {
    const importId = parseInt(b.import_id, 10) || null;
    const ts = nowIso();
    const raw = (Array.isArray(b.products) ? b.products : []).slice(0, 500);
    const products = raw.map((r) => {
      const p = sanitizeProduct(r);
      // 元CSVの1行（見出し→値）。「菊池CSVの形＋画像」で出すために、そのまま保管する
      if (r && r._raw && typeof r._raw === 'object') { try { p.raw = JSON.stringify(r._raw); } catch (e) { /* */ } }
      return { p, mode: r && r._mode === 'overwrite' ? 'upsert' : 'insert_only' };
    }).filter((x) => x.p.jan && janShapeOk(x.p.jan) && x.p.name);
    // 保存（新規のつもりのものは「無いときだけ」。changes=0 なら他の人が先に入れている）
    let inserted = 0, updated = 0, conflicts = 0;
    const conflictJans = [];
    for (let i = 0; i < products.length; i += 50) {
      const chunk = products.slice(i, i + 50);
      const res = await env.DB.batch(chunk.map((x) => upsertStmt(env, acct, x.p, importId, ts, by, x.mode)));
      chunk.forEach((x, k) => {
        const ch = res[k] && res[k].meta ? res[k].meta.changes : 1;
        if (x.mode === 'insert_only') { if (ch) inserted++; else { conflicts++; conflictJans.push(x.p.jan); } }
        else updated++;
      });
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
      const kind = ['dup_db', 'dup_file', 'invalid_jan', 'missing'].indexOf(is.kind) >= 0 ? is.kind : 'dup_file';
      return env.DB.prepare(
        'INSERT INTO pim_issues(account_id, ts, import_id, kind, jan, message, existing, incoming) VALUES(?,?,?,?,?,?,?,?)'
      ).bind(acct, ts, importId, kind, cleanJan(is.jan || '').slice(0, 14), String(is.message || '').slice(0, 1000),
        is.existing ? JSON.stringify(is.existing).slice(0, 20000) : null,
        is.incoming ? JSON.stringify(is.incoming).slice(0, 60000) : null);
    });
    for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
    if (importId) {
      await env.DB.prepare('UPDATE pim_imports SET inserted=inserted+?, updated=updated+?, skipped=skipped+? WHERE id=? AND account_id=?')
        .bind(inserted, updated, issues.length, importId, acct).run();
    }
    return json({ ok: true, inserted, updated, conflicts, issues: issues.length });
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
  const rs = await env.DB.prepare('SELECT id, ts, filename, source, total, inserted, updated, skipped, invalid, headers IS NOT NULL AS has_headers FROM pim_imports WHERE account_id=? ORDER BY id DESC LIMIT 50').bind(data.account.id).all();
  return json({ ok: true, imports: rs.results || [] });
}

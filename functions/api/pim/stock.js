// 倉庫の在庫実績（ロケーション・在庫数）
//   倉庫の「在庫実績 CSV」（8 列: 商品規格１, 商品名, ロケーション, 商品コード(=JAN), 賞味期限, ロット・賞味期限別ロケ別在庫数, 引当数, 出力日）を
//   PC「在庫」タブで取り込む。CSV の読み取り（文字コードの判定・列の判定）は画面側、ここは JAN の照合と保存だけ。
//   取り込むたびに、そのディーラーの在庫をまるごと置き換える（前回分は消える）。
//
//   POST /api/pim/stock { action:'begin' }                          → { batch }
//   POST /api/pim/stock { action:'rows', batch, rows:[{row_no, code, location, qty, allocated, exported_on}] }（2000 行まで）
//                                                                  → { matched, not_jan, unregistered }
//        商品コードを JAN に揃え（12 桁は頭に 0 を付けて 13 桁。SalonPro 送信と同じ揃え方）、登録済みの商品と合う行だけを残す
//   POST /api/pim/stock { action:'finish', batch, total, not_jan, unregistered, filename, encoding }
//                                                                  → { info }  ここで表示する在庫を新しい取り込みに切り替え、前回分を消す
//   GET  /api/pim/stock?jan=…                                      → { rows:[{location, qty}], info }  並び: 在庫のある行が先・ロケーション先頭 A>B>C>S
//   GET  /api/pim/stock                                            → { info }（最後の取り込みの結果）
import { json, cleanJan, nowIso, userOf } from './_lib.js';

const BATCH_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z-[0-9a-f]{8}$/;
const INT = (v) => { const n = parseInt(String(v == null ? '' : v).replace(/[,，\s]/g, '').replace(/[－−▲△]/g, '-').replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)), 10); return isFinite(n) ? n : 0; };
// 出力日を YYYY/MM/DD に揃える（「2026/9/1」と「2026/11/10」を文字で比べても新しい方が分かるように）
const DAY = (v) => { const m = String(v == null ? '' : v).trim().match(/^(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/); return m ? m[1] + '/' + m[2].padStart(2, '0') + '/' + m[3].padStart(2, '0') : (STR(v, 20) || null); };
const STR = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
// ロケーションは全角英数（Ａ１－０１）を半角に揃え、英字は大文字に（並び順の A>B>C>S と、同じ棚の合算がずれないように）
const LOC = (v) => { let s = STR(v, 60); try { s = s.normalize('NFKC'); } catch (e) { /* */ } return s.replace(/[‐－―−]/g, '-').toUpperCase(); };

// 表示の並び: 在庫数と引当数がともに 0 の行は出さない → 在庫数のある行が先 → ロケーション先頭の文字 A > B > C > S（その他は後ろ）→ ロケーション昇順
//   同じロケーションが複数行（ロット・賞味期限違い）のときは、数を足して 1 行にする
const LOC_RANK = { A: 0, B: 1, C: 2, S: 3 };
export function stockView(rows) {
  const by = new Map();
  for (const r of rows) {
    const k = LOC(r.location);
    const cur = by.get(k) || { location: k, qty: 0, allocated: 0 };
    cur.qty += r.qty || 0; cur.allocated += r.allocated || 0;
    by.set(k, cur);
  }
  const rank = (loc) => { const c = String(loc || '').charAt(0).toUpperCase(); return c in LOC_RANK ? LOC_RANK[c] : 9; };
  return Array.from(by.values())
    .filter((r) => r.qty !== 0 || r.allocated !== 0)
    .sort((a, b) => ((b.qty > 0) - (a.qty > 0)) || (rank(a.location) - rank(b.location)) || a.location.localeCompare(b.location, 'ja', { numeric: true })) // A-9 は A-10 より前
    .map((r) => ({ location: r.location, qty: r.qty }));
}

async function meta(env, acct) {
  return env.DB.prepare('SELECT batch, imported_at, imported_by, exported_on, filename, encoding, total, matched, unmatched, not_jan, unregistered, products FROM pim_stock_meta WHERE account_id=?').bind(acct).first();
}
function publicInfo(m) {
  if (!m || !m.batch) return null;
  const o = Object.assign({}, m); delete o.batch; return o;
}

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const m = await meta(env, acct);
  const raw = url.searchParams.get('jan');
  if (raw == null) return json({ ok: true, info: publicInfo(m) });
  const jan = cleanJan(raw);
  if (!jan) return json({ ok: false, reason: 'no_jan' }, 400);
  if (!m || !m.batch) return json({ ok: true, jan, rows: [], info: null });
  // いま表示している取り込みの行を 1 文で読む（読んでいる間に次の取り込みが切り替わっても、空にならない）
  const rs = await env.DB.prepare('SELECT s.location, s.qty, s.allocated FROM pim_stock s JOIN pim_stock_meta m ON m.account_id=s.account_id AND m.batch=s.batch WHERE s.account_id=? AND s.jan=? ORDER BY s.row_no').bind(acct, jan).all();
  return json({ ok: true, jan, rows: stockView(rs.results || []), info: publicInfo(m) });
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  if (data.readonly) return json({ ok: false, reason: 'readonly', message: '読み取り専用のキーでは在庫を取り込めません' }, 403);
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);

  if (b.action === 'begin') {
    // 前に途中で止まった取り込み（1 時間より前に始めて、切り替えまで行かなかったもの）の行を片付ける
    const m = await meta(env, acct);
    const old = new Date(Date.now() - 3600 * 1000).toISOString();
    await env.DB.prepare('DELETE FROM pim_stock WHERE account_id=? AND batch<>? AND batch<?').bind(acct, (m && m.batch) || '', old).run();
    const r = crypto.getRandomValues(new Uint8Array(4));
    return json({ ok: true, batch: nowIso() + '-' + Array.from(r, (x) => x.toString(16).padStart(2, '0')).join('') });
  }

  const batch = String(b.batch || '');
  if (!BATCH_RE.test(batch) || Date.parse(batch.slice(0, 24)) > Date.now() + 10 * 60 * 1000) return json({ ok: false, reason: 'bad_batch', message: '取り込みの番号が正しくありません。もう一度ファイルを選び直してください' }, 400); // 先の日時の番号は受けない（それより後の取り込みが全部はじかれるため）

  if (b.action === 'rows') {
    const curR = await meta(env, acct);
    if (curR && curR.batch && batch <= curR.batch) return json({ ok: false, reason: 'closed_batch', message: 'この取り込みはもう終わっています。もう一度ファイルを選び直してください' }, 409); // 表示中・それより前の取り込みに行を足さない（数が倍になる）
    const rows = Array.isArray(b.rows) ? b.rows.slice(0, 2000).filter((r) => r && typeof r === 'object') : [];
    // 商品コード → JAN（12 桁は頭 0 で 13 桁・14 桁の頭 0 は外す）。JAN の形（13 桁か 8 桁）でないものは照合しない
    const items = rows.map((r) => {
      const code = STR(r.code, 40);
      const digits = /^[0-9０-９\s-]+$/.test(code) ? cleanJan(code) : '';
      return { jan: digits.length === 13 || digits.length === 8 ? digits : '', location: LOC(r.location), qty: INT(r.qty), allocated: INT(r.allocated), exported_on: DAY(r.exported_on), row_no: INT(r.row_no) || null };
    });
    const jans = Array.from(new Set(items.map((i) => i.jan).filter(Boolean)));
    const known = new Set();
    for (let i = 0; i < jans.length; i += 90) {
      const part = jans.slice(i, i + 90);
      const rs = await env.DB.prepare('SELECT jan FROM pim_products WHERE account_id=? AND jan IN (' + part.map(() => '?').join(',') + ')').bind(acct, ...part).all();
      for (const x of (rs.results || [])) known.add(x.jan);
    }
    const keep = items.filter((i) => i.jan && known.has(i.jan));
    for (let i = 0; i < keep.length; i += 100) {
      await env.DB.batch(keep.slice(i, i + 100).map((r) => env.DB.prepare('INSERT INTO pim_stock(account_id, batch, jan, location, qty, allocated, exported_on, row_no) VALUES(?,?,?,?,?,?,?,?)').bind(acct, batch, r.jan, r.location, r.qty, r.allocated, r.exported_on, r.row_no)));
    }
    return json({ ok: true, matched: keep.length, not_jan: items.filter((i) => !i.jan).length, unregistered: items.filter((i) => i.jan && !known.has(i.jan)).length });
  }

  if (b.action === 'finish') {
    const cur = await meta(env, acct);
    if (cur && cur.batch === batch) return json({ ok: true, info: publicInfo(cur), again: true }); // 同じ取り込みの「切り替え」が 2 回届いた（返事が届かず送り直した など）→ 何もしない（表示中の在庫を消さない）
    if (cur && cur.batch && cur.batch > batch) { // この取り込みより後に始めた取り込みが先に終わっている
      await env.DB.prepare('DELETE FROM pim_stock WHERE account_id=? AND batch=?').bind(acct, batch).run();
      return json({ ok: false, reason: 'superseded', message: 'この取り込みの途中で、別の人がもっと新しい在庫 CSV を取り込みました。そちらを表示しています', info: publicInfo(cur) }, 409);
    }
    const c = await env.DB.prepare('SELECT COUNT(*) AS n, COUNT(DISTINCT jan) AS p, MAX(exported_on) AS ex FROM pim_stock WHERE account_id=? AND batch=?').bind(acct, batch).first();
    const matched = (c && c.n) || 0, total = Math.max(INT(b.total), matched);
    // 1 件も合わないのに置き換えると、全商品が「在庫情報なし」になる（ちがう CSV を入れたとき）。画面で確かめてからだけ通す
    if (!matched && !b.allow_empty) return json({ ok: false, reason: 'no_match', message: '登録済みの商品と合う行が 1 件もありませんでした。在庫実績の CSV か確かめてください（前回の在庫のままです）' }, 409);
    const ts = nowIso(), by = userOf(request) || (data.isAdmin ? '運営' : '');
    // 2 人が同時に取り込んだら、後から始めた方を残す（先に始めた方が後から終わっても、新しい在庫を古いもので上書きしない）
    const up = await env.DB.batch([
      env.DB.prepare('INSERT INTO pim_stock_meta(account_id, batch, imported_at, imported_by, exported_on, filename, encoding, total, matched, unmatched, not_jan, unregistered, products) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
        'ON CONFLICT(account_id) DO UPDATE SET batch=excluded.batch, imported_at=excluded.imported_at, imported_by=excluded.imported_by, exported_on=excluded.exported_on, filename=excluded.filename, encoding=excluded.encoding, total=excluded.total, matched=excluded.matched, unmatched=excluded.unmatched, not_jan=excluded.not_jan, unregistered=excluded.unregistered, products=excluded.products WHERE pim_stock_meta.batch IS NULL OR excluded.batch > pim_stock_meta.batch')
        .bind(acct, batch, ts, by || null, (c && c.ex) || DAY(b.exported_on), STR(b.filename, 200) || null, STR(b.encoding, 40) || null, total, matched, total - matched, INT(b.not_jan), INT(b.unregistered), (c && c.p) || 0),
    ]);
    if (!(up[0].meta && up[0].meta.changes)) {
      await env.DB.prepare('DELETE FROM pim_stock WHERE account_id=? AND batch=?').bind(acct, batch).run();
      return json({ ok: false, reason: 'superseded', message: 'この取り込みの途中で、別の人がもっと新しい在庫 CSV を取り込みました。そちらを表示しています', info: publicInfo(await meta(env, acct)) }, 409);
    }
    await env.DB.prepare('DELETE FROM pim_stock WHERE account_id=? AND batch<?').bind(acct, batch).run(); // 前回分を消す（これで「毎回最新に差し替え」）。後から始めた取り込みの途中の行は残す
    return json({ ok: true, info: publicInfo(await meta(env, acct)) });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

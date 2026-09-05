// 商品画像（1商品 最大5枚・保存は必ず webp・実体は R2 "PRODUCT_IMAGES"・アカウントごとに分かれる）
//   GET    /api/pim/images?jan=                → { images:[{slot,url,...}] }
//   POST   /api/pim/images  multipart/form-data: jan, slot(1-5 か auto), file(webp), original_name, original_type, width, height
//          slot=auto は「空いている一番若い番号」をサーバ側で確定する。複数人が同時に同じ商品へ写真を入れても
//          お互いを上書きしない（INSERT が (account_id,jan,slot) の主キーで衝突したら次の番号でやり直す）
//          slot=1..5 の指定は「その番号を差し替える」意味（本人が写真をタップして撮り直したとき）
//          ブラウザ側で webp に変換して送る。webp 以外が届いたときは Cloudflare Images binding(IMAGES)があれば変換、無ければ 415
//          quality（JSON・任意）… ブラウザ側の自動チェック結果 {luma, sharp, src_w, src_h, warn:[...]}。warn は検品画面の絞り込みに使う
//          thumb（webp・任意）… 300px のサムネ（EC の一覧用。<slot>_s.webp で配信）。phash（任意）… 同じ写真の検出用ハッシュ（16 桁 hex）
//          返り値の dup_of に「同じ写真が登録されている別の商品」があれば入る（撮り間違いの検出）
//   POST   /api/pim/images  application/json { jan, action:'reorder', order:[3,1,2] } → 並べ替え（order は「今の番号」を新しい順に）
//                                              { jan, action:'main', slot:3 }         → その写真を 1枚目（メイン）にして他を後ろへ
//   DELETE /api/pim/images?jan=&slot=          → 消して、後ろの写真を前に詰める（メルカリ式）
import { json, cleanJan, janShapeOk, imageKey, imageUrl, thumbKey, thumbUrl, nowIso, hasR2, SLOT_MIN, SLOT_MAX, userOf, blobPut, blobGet, blobDelete, imageStore, logChanges, notifyWebhook } from './_lib.js';

const QUALITY_WARNS = ['暗い', 'ピンぼけ', '小さい', '白飛び'];
function parseQuality(raw) {
  if (!raw) return [null, null];
  let q = null; try { q = JSON.parse(String(raw).slice(0, 2000)); } catch (e) { return [null, null]; }
  if (!q || typeof q !== 'object') return [null, null];
  const warn = Array.isArray(q.warn) ? q.warn.filter((w) => QUALITY_WARNS.indexOf(w) >= 0) : [];
  const keep = { luma: q.luma, sharp: q.sharp, src_w: q.src_w, src_h: q.src_h, warn };
  return [JSON.stringify(keep), warn.length ? warn.join(',') : null];
}
async function readBlob(env, key) {
  const obj = await blobGet(env, key);
  if (!obj) return null;
  return obj.body instanceof ArrayBuffer ? new Uint8Array(obj.body) : new Uint8Array(await new Response(obj.body).arrayBuffer());
}

const MAX_BYTES = 8 * 1024 * 1024;

function isWebp(u8) {
  return u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50;
}
async function listImages(env, origin, acct, jan) {
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE account_id=? AND jan=? ORDER BY slot').bind(acct, jan).all();
  return (rs.results || []).map((im) => { const o = Object.assign({}, im, { url: imageUrl(origin, acct, jan, im.slot, im.created_at), thumb_url: im.has_thumb ? thumbUrl(origin, acct, jan, im.slot, im.created_at) : null }); delete o.key; return o; });
}
// 画像枚数を商品側へ同期し、商品の updated_at を返す（画面側が楽観ロックの基準を追従させるため）
async function syncCount(env, acct, jan) {
  const ts = nowIso();
  await env.DB.prepare('UPDATE pim_products SET image_count=(SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND jan=?2), updated_at=?3 WHERE account_id=?1 AND jan=?2').bind(acct, jan, ts).run();
  return ts;
}

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const jan = cleanJan(url.searchParams.get('jan') || '');
  if (!jan) return json({ ok: false, reason: 'no_jan' }, 400);
  return json({ ok: true, jan, r2: hasR2(env), store: imageStore(env), images: await listImages(env, url.origin, acct, jan) });
}

export async function onRequestPost(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  if ((request.headers.get('content-type') || '').indexOf('application/json') >= 0) return reorder(context);
  let fd;
  try { fd = await request.formData(); } catch (e) { return json({ ok: false, reason: 'bad_form' }, 400); }
  const jan = cleanJan(fd.get('jan') || '');
  const slotRaw = String(fd.get('slot') || '');
  const auto = slotRaw === 'auto' || slotRaw === '0' || slotRaw === '';
  const slot = auto ? 0 : parseInt(slotRaw, 10);
  const file = fd.get('file');
  const by = userOf(request);
  if (!jan || !janShapeOk(jan)) return json({ ok: false, reason: 'bad_jan' }, 400);
  if (!auto && !(slot >= SLOT_MIN && slot <= SLOT_MAX)) return json({ ok: false, reason: 'bad_slot', message: '写真は1〜5枚目までです' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, reason: 'no_file' }, 400);
  if (file.size > MAX_BYTES) return json({ ok: false, reason: 'too_large', message: '画像が大きすぎます(8MBまで)' }, 413);
  const prod = await env.DB.prepare('SELECT jan FROM pim_products WHERE account_id=? AND jan=?').bind(acct, jan).first();
  if (!prod) return json({ ok: false, reason: 'no_product', message: 'この JAN の商品が未登録です。先に商品を登録してください' }, 404);

  let buf = new Uint8Array(await file.arrayBuffer());
  if (!isWebp(buf)) {
    if (env.IMAGES && typeof env.IMAGES.input === 'function') {
      try {
        const out = await env.IMAGES.input(new Blob([buf]).stream()).output({ format: 'image/webp', quality: 85 });
        buf = new Uint8Array(await out.response().arrayBuffer());
      } catch (e) {
        return json({ ok: false, reason: 'convert_failed', message: 'webp に変換できませんでした: ' + String(e && e.message || e) }, 415);
      }
      if (!isWebp(buf)) return json({ ok: false, reason: 'not_webp' }, 415);
    } else {
      return json({ ok: false, reason: 'not_webp', message: 'webp 以外の画像が届きました。ブラウザ側で変換されるはずです（対応ブラウザでお試しください）' }, 415);
    }
  }
  const [quality, qualityWarn] = parseQuality(fd.get('quality'));
  const phash = /^[0-9a-f]{16,40}$/.test(String(fd.get('phash') || '')) ? String(fd.get('phash')) : null;
  const thumbFile = fd.get('thumb');
  let thumb = null;
  if (thumbFile && typeof thumbFile.arrayBuffer === 'function' && thumbFile.size > 0 && thumbFile.size < 600000) { const t = new Uint8Array(await thumbFile.arrayBuffer()); if (isWebp(t)) thumb = t; }
  const meta = [buf.length, parseInt(fd.get('width'), 10) || null, parseInt(fd.get('height'), 10) || null,
    String(fd.get('original_name') || '').slice(0, 200), String(fd.get('original_type') || '').slice(0, 100)];
  const put = async (key) => { await blobPut(env, key, buf); };
  const putThumb = async (sl) => { if (thumb) await blobPut(env, thumbKey(acct, jan, sl), thumb); else await blobDelete(env, thumbKey(acct, jan, sl)); };
  const origin = new URL(request.url).origin;
  let ts = nowIso(), usedSlot = slot;

  if (auto) {
    // 空いている一番若い番号へ。台帳(pim_images)の主キーで取り合いを裁く: INSERT が通った人がその番号の持ち主
    let done = false;
    for (let attempt = 0; attempt < SLOT_MAX && !done; attempt++) {
      const free = await env.DB.prepare(
        'SELECT MIN(s.n) AS n FROM (SELECT 1 AS n UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) s ' +
        'WHERE s.n NOT IN (SELECT slot FROM pim_images WHERE account_id=? AND jan=?)'
      ).bind(acct, jan).first();
      if (!free || !free.n) return json({ ok: false, reason: 'full', message: '写真は5枚までです。差し替えるときは写真をタップしてください', images: await listImages(env, origin, acct, jan) }, 409);
      usedSlot = free.n;
      ts = nowIso();
      try {
        await env.DB.prepare(
          'INSERT INTO pim_images(account_id, jan, slot, key, bytes, width, height, original_name, original_type, created_at, created_by, quality, quality_warn, phash, has_thumb) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(acct, jan, usedSlot, imageKey(acct, jan, usedSlot), ...meta, ts, by || null, quality, qualityWarn, phash, thumb ? 1 : 0).run();
        done = true;
      } catch (e) { /* 取られた。次の番号へ */ }
    }
    if (!done) return json({ ok: false, reason: 'busy', message: '同時に登録が集中しています。もう一度お試しください' }, 409);
    try { await put(imageKey(acct, jan, usedSlot)); await putThumb(usedSlot); }
    catch (e) {
      await env.DB.prepare('DELETE FROM pim_images WHERE account_id=? AND jan=? AND slot=?').bind(acct, jan, usedSlot).run(); // 実体を置けなければ台帳も戻す
      return json({ ok: false, reason: 'r2_error', message: '画像の保存に失敗しました: ' + String(e && e.message || e) }, 500);
    }
  } else {
    await put(imageKey(acct, jan, usedSlot)); await putThumb(usedSlot);
    await env.DB.prepare(
      'INSERT INTO pim_images(account_id, jan, slot, key, bytes, width, height, original_name, original_type, created_at, created_by, quality, quality_warn, phash, has_thumb) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT(account_id, jan, slot) DO UPDATE SET key=excluded.key, bytes=excluded.bytes, width=excluded.width, height=excluded.height, original_name=excluded.original_name, original_type=excluded.original_type, created_at=excluded.created_at, created_by=excluded.created_by, review=NULL, review_note=NULL, reviewed_by=NULL, reviewed_at=NULL, quality=excluded.quality, quality_warn=excluded.quality_warn, phash=excluded.phash, has_thumb=excluded.has_thumb'
    ).bind(acct, jan, usedSlot, imageKey(acct, jan, usedSlot), ...meta, ts, by || null, quality, qualityWarn, phash, thumb ? 1 : 0).run();
  }
  const pts = await syncCount(env, acct, jan);
  // 同じ写真が別の商品にも登録されていないか（撮り間違い・貼り間違いの検出）
  let dupOf = [];
  if (phash) {
    const d = await env.DB.prepare('SELECT i.jan, i.slot, p.name FROM pim_images i JOIN pim_products p ON p.account_id=i.account_id AND p.jan=i.jan WHERE i.account_id=? AND i.phash=? AND i.jan<>? LIMIT 5').bind(acct, phash, jan).all();
    dupOf = (d.results || []);
  }
  await logChanges(env, acct, [jan], 'image', by); notifyWebhook(context, data.account, 'image', [jan], by);
  return json({ ok: true, jan, slot: usedSlot, url: imageUrl(origin, acct, jan, usedSlot, ts), bytes: buf.length, product_updated_at: pts, quality_warn: qualityWarn, dup_of: dupOf, images: await listImages(env, origin, acct, jan) });
}

// 並べ替え・メイン差し替え（写真の実体を新しい番号のキーへ置き直し、台帳を作り直す）
async function reorder(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  const b = await request.json().catch(() => null);
  if (!b) return json({ ok: false, reason: 'bad_json' }, 400);
  const jan = cleanJan(b.jan || '');
  if (!jan || !janShapeOk(jan)) return json({ ok: false, reason: 'bad_jan' }, 400);
  const origin = new URL(request.url).origin;
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE account_id=? AND jan=? ORDER BY slot').bind(acct, jan).all();
  const imgs = rs.results || [];
  const cur = imgs.map((i) => i.slot);
  let order;
  if (b.action === 'main') {
    const s = parseInt(b.slot, 10);
    if (cur.indexOf(s) < 0) return json({ ok: false, reason: 'not_found' }, 404);
    order = [s].concat(cur.filter((x) => x !== s));
  } else if (b.action === 'reorder') {
    order = (Array.isArray(b.order) ? b.order : []).map((x) => parseInt(x, 10));
    if (order.length !== cur.length || order.slice().sort().join() !== cur.slice().sort().join()) return json({ ok: false, reason: 'bad_order', message: '並び順が今の写真と合いません。画面を更新してからやり直してください' }, 409);
  } else return json({ ok: false, reason: 'bad_action' }, 400);
  const moves = order.map((oldSlot, i) => ({ from: oldSlot, to: i + 1 })).filter((m) => m.from !== m.to);
  if (!moves.length) return json({ ok: true, jan, images: await listImages(env, origin, acct, jan) });
  // 実体を読み込んでから書き戻す（数枚なので一括で持てる）。読めないものがあれば中止して何も変えない
  const bufs = {}, tbufs = {};
  for (const m of moves) { const u8 = await readBlob(env, imageKey(acct, jan, m.from)); if (!u8) return json({ ok: false, reason: 'blob_missing', message: m.from + '枚目の実体が見つかりません' }, 500); bufs[m.from] = u8; tbufs[m.from] = await readBlob(env, thumbKey(acct, jan, m.from)); }
  for (const m of moves) { await blobPut(env, imageKey(acct, jan, m.to), bufs[m.from]); if (tbufs[m.from]) await blobPut(env, thumbKey(acct, jan, m.to), tbufs[m.from]); else await blobDelete(env, thumbKey(acct, jan, m.to)); }
  const ts = nowIso();
  const stmts = [env.DB.prepare('DELETE FROM pim_images WHERE account_id=? AND jan=?').bind(acct, jan)];
  const byOld = {}; imgs.forEach((im) => { byOld[im.slot] = im; });
  order.forEach((oldSlot, i) => {
    const im = byOld[oldSlot], to = i + 1;
    stmts.push(env.DB.prepare('INSERT INTO pim_images(account_id, jan, slot, key, bytes, width, height, original_name, original_type, created_at, created_by, review, review_note, reviewed_by, reviewed_at, quality, quality_warn, phash, has_thumb) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .bind(acct, jan, to, imageKey(acct, jan, to), im.bytes, im.width, im.height, im.original_name, im.original_type, oldSlot === to ? im.created_at : ts, im.created_by, im.review, im.review_note, im.reviewed_by, im.reviewed_at, im.quality, im.quality_warn, im.phash || null, im.has_thumb || 0));
  });
  await env.DB.batch(stmts);
  const by = userOf(request);
  const pts = await syncCount(env, acct, jan);
  await logChanges(env, acct, [jan], 'image', by); notifyWebhook(context, data.account, 'image', [jan], by);
  return json({ ok: true, jan, product_updated_at: pts, images: await listImages(env, origin, acct, jan) });
}

export async function onRequestDelete(context) {
  const { request, env, data } = context;
  const acct = data.account.id;
  const url = new URL(request.url);
  const jan = cleanJan(url.searchParams.get('jan') || '');
  const slot = parseInt(url.searchParams.get('slot'), 10);
  if (!jan || !(slot >= SLOT_MIN && slot <= SLOT_MAX)) return json({ ok: false, reason: 'bad_params' }, 400);
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE account_id=? AND jan=? ORDER BY slot').bind(acct, jan).all();
  const imgs = rs.results || [];
  if (!imgs.some((im) => im.slot === slot)) return json({ ok: false, reason: 'not_found' }, 404);
  await blobDelete(env, imageKey(acct, jan, slot)); await blobDelete(env, thumbKey(acct, jan, slot)); // 実体が無くても台帳は消す
  await env.DB.prepare('DELETE FROM pim_images WHERE account_id=? AND jan=? AND slot=?').bind(acct, jan, slot).run();
  // 後ろを前に詰める（3枚目を消したら 4→3, 5→4）
  const after = imgs.filter((im) => im.slot > slot).sort((a, b) => a.slot - b.slot);
  for (const im of after) {
    const to = im.slot - 1;
    // 先に台帳で番号を取る。前の番号が（同時登録で）埋まっていたら主キー衝突で失敗する＝詰めずにそのまま残す（他の人の写真を消さない）
    let moved = false;
    try { const r = await env.DB.prepare('UPDATE pim_images SET slot=?, key=?, created_at=? WHERE account_id=? AND jan=? AND slot=?').bind(to, imageKey(acct, jan, to), nowIso(), acct, jan, im.slot).run(); moved = !!(r.meta && r.meta.changes); }
    catch (e) { moved = false; }
    if (moved) {
      const obj = await blobGet(env, im.key);
      if (obj) {
        const buf = obj.body instanceof ArrayBuffer ? new Uint8Array(obj.body) : new Uint8Array(await new Response(obj.body).arrayBuffer());
        await blobPut(env, imageKey(acct, jan, to), buf);
        await blobDelete(env, im.key);
      }
      const tb = await readBlob(env, thumbKey(acct, jan, im.slot));
      if (tb) { await blobPut(env, thumbKey(acct, jan, to), tb); await blobDelete(env, thumbKey(acct, jan, im.slot)); } else await blobDelete(env, thumbKey(acct, jan, to));
    }
    if (!moved) break; // 詰め先が埋まったら、それより後ろも動かさない（順番が入れ替わらないように）
  }
  const pts = await syncCount(env, acct, jan);
  const by = userOf(request);
  await logChanges(env, acct, [jan], 'image', by); notifyWebhook(context, data.account, 'image', [jan], by);
  return json({ ok: true, jan, product_updated_at: pts, images: await listImages(env, url.origin, acct, jan) });
}

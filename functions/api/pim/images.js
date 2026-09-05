// 商品画像（1商品 最大5枚・保存は必ず webp・実体は R2 "PRODUCT_IMAGES"・アカウントごとに分かれる）
//   GET    /api/pim/images?jan=                → { images:[{slot,url,...}] }
//   POST   /api/pim/images  multipart/form-data: jan, slot(1-5 か auto), file(webp), original_name, original_type, width, height
//          slot=auto は「空いている一番若い番号」をサーバ側で確定する。複数人が同時に同じ商品へ写真を入れても
//          お互いを上書きしない（INSERT が (account_id,jan,slot) の主キーで衝突したら次の番号でやり直す）
//          slot=1..5 の指定は「その番号を差し替える」意味（本人が写真をタップして撮り直したとき）
//          ブラウザ側で webp に変換して送る。webp 以外が届いたときは Cloudflare Images binding(IMAGES)があれば変換、無ければ 415
//   DELETE /api/pim/images?jan=&slot=          → 消して、後ろの写真を前に詰める（メルカリ式）
import { json, cleanJan, janShapeOk, imageKey, imageUrl, nowIso, hasR2, SLOT_MIN, SLOT_MAX, userOf, blobPut, blobGet, blobDelete, imageStore } from './_lib.js';

const MAX_BYTES = 8 * 1024 * 1024;

function isWebp(u8) {
  return u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50;
}
async function listImages(env, origin, acct, jan) {
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE account_id=? AND jan=? ORDER BY slot').bind(acct, jan).all();
  return (rs.results || []).map((im) => Object.assign({}, im, { url: imageUrl(origin, acct, jan, im.slot, im.created_at) }));
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

export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
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
  const meta = [buf.length, parseInt(fd.get('width'), 10) || null, parseInt(fd.get('height'), 10) || null,
    String(fd.get('original_name') || '').slice(0, 200), String(fd.get('original_type') || '').slice(0, 100)];
  const put = (key) => blobPut(env, key, buf);
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
          'INSERT INTO pim_images(account_id, jan, slot, key, bytes, width, height, original_name, original_type, created_at, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(acct, jan, usedSlot, imageKey(acct, jan, usedSlot), ...meta, ts, by || null).run();
        done = true;
      } catch (e) { /* 取られた。次の番号へ */ }
    }
    if (!done) return json({ ok: false, reason: 'busy', message: '同時に登録が集中しています。もう一度お試しください' }, 409);
    try { await put(imageKey(acct, jan, usedSlot)); }
    catch (e) {
      await env.DB.prepare('DELETE FROM pim_images WHERE account_id=? AND jan=? AND slot=?').bind(acct, jan, usedSlot).run(); // 実体を置けなければ台帳も戻す
      return json({ ok: false, reason: 'r2_error', message: '画像の保存に失敗しました: ' + String(e && e.message || e) }, 500);
    }
  } else {
    await put(imageKey(acct, jan, usedSlot));
    await env.DB.prepare(
      'INSERT INTO pim_images(account_id, jan, slot, key, bytes, width, height, original_name, original_type, created_at, created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?) ' +
      'ON CONFLICT(account_id, jan, slot) DO UPDATE SET key=excluded.key, bytes=excluded.bytes, width=excluded.width, height=excluded.height, original_name=excluded.original_name, original_type=excluded.original_type, created_at=excluded.created_at, created_by=excluded.created_by'
    ).bind(acct, jan, usedSlot, imageKey(acct, jan, usedSlot), ...meta, ts, by || null).run();
  }
  const pts = await syncCount(env, acct, jan);
  return json({ ok: true, jan, slot: usedSlot, url: imageUrl(origin, acct, jan, usedSlot, ts), bytes: buf.length, product_updated_at: pts, images: await listImages(env, origin, acct, jan) });
}

export async function onRequestDelete({ request, env, data }) {
  const acct = data.account.id;
  const url = new URL(request.url);
  const jan = cleanJan(url.searchParams.get('jan') || '');
  const slot = parseInt(url.searchParams.get('slot'), 10);
  if (!jan || !(slot >= SLOT_MIN && slot <= SLOT_MAX)) return json({ ok: false, reason: 'bad_params' }, 400);
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE account_id=? AND jan=? ORDER BY slot').bind(acct, jan).all();
  const imgs = rs.results || [];
  if (!imgs.some((im) => im.slot === slot)) return json({ ok: false, reason: 'not_found' }, 404);
  await blobDelete(env, imageKey(acct, jan, slot)); // 実体が無くても台帳は消す
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
    }
    if (!moved) break; // 詰め先が埋まったら、それより後ろも動かさない（順番が入れ替わらないように）
  }
  const pts = await syncCount(env, acct, jan);
  return json({ ok: true, jan, product_updated_at: pts, images: await listImages(env, url.origin, acct, jan) });
}

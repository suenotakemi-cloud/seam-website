// 商品画像（1商品 最大5枚・保存は必ず webp・実体は R2 "PRODUCT_IMAGES"）
//   GET    /api/pim/images?jan=                → { images:[{slot,url,...}] }
//   POST   /api/pim/images  multipart/form-data: jan, slot(1-5), file(webp), original_name, original_type, width, height
//          ブラウザ側で webp に変換して送る。webp 以外が届いたときは Cloudflare Images binding(IMAGES)があれば変換、無ければ 415
//   DELETE /api/pim/images?jan=&slot=          → 消して、後ろの写真を前に詰める（メルカリ式）
import { json, cleanJan, janShapeOk, imageKey, imageUrl, nowIso, hasR2, SLOT_MIN, SLOT_MAX } from './_lib.js';

const MAX_BYTES = 8 * 1024 * 1024;

function isWebp(u8) {
  return u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46 && u8[8] === 0x57 && u8[9] === 0x45 && u8[10] === 0x42 && u8[11] === 0x50;
}

async function listImages(env, origin, jan) {
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE jan=? ORDER BY slot').bind(jan).all();
  return (rs.results || []).map((im) => Object.assign({}, im, { url: imageUrl(origin, jan, im.slot, im.created_at) }));
}
async function syncCount(env, jan) {
  await env.DB.prepare('UPDATE pim_products SET image_count=(SELECT COUNT(*) FROM pim_images WHERE jan=?), updated_at=? WHERE jan=?').bind(jan, nowIso(), jan).run();
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const jan = cleanJan(url.searchParams.get('jan') || '');
  if (!jan) return json({ ok: false, reason: 'no_jan' }, 400);
  return json({ ok: true, jan, r2: hasR2(env), images: await listImages(env, url.origin, jan) });
}

export async function onRequestPost({ request, env }) {
  if (!hasR2(env)) return json({ ok: false, reason: 'no_r2', message: '画像の保存先(R2: PRODUCT_IMAGES)が未設定です。db/SETUP_PIM.md を参照' }, 503);
  let fd;
  try { fd = await request.formData(); } catch (e) { return json({ ok: false, reason: 'bad_form' }, 400); }
  const jan = cleanJan(fd.get('jan') || '');
  const slot = parseInt(fd.get('slot'), 10);
  const file = fd.get('file');
  if (!jan || !janShapeOk(jan)) return json({ ok: false, reason: 'bad_jan' }, 400);
  if (!(slot >= SLOT_MIN && slot <= SLOT_MAX)) return json({ ok: false, reason: 'bad_slot', message: '写真は1〜5枚目までです' }, 400);
  if (!file || typeof file.arrayBuffer !== 'function') return json({ ok: false, reason: 'no_file' }, 400);
  if (file.size > MAX_BYTES) return json({ ok: false, reason: 'too_large', message: '画像が大きすぎます(8MBまで)' }, 413);
  const prod = await env.DB.prepare('SELECT jan FROM pim_products WHERE jan=?').bind(jan).first();
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
  const key = imageKey(jan, slot);
  await env.PRODUCT_IMAGES.put(key, buf, { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
  const ts = nowIso();
  await env.DB.prepare(
    'INSERT INTO pim_images(jan, slot, key, bytes, width, height, original_name, original_type, created_at) VALUES(?,?,?,?,?,?,?,?,?) ' +
    'ON CONFLICT(jan, slot) DO UPDATE SET key=excluded.key, bytes=excluded.bytes, width=excluded.width, height=excluded.height, original_name=excluded.original_name, original_type=excluded.original_type, created_at=excluded.created_at'
  ).bind(jan, slot, key, buf.length, parseInt(fd.get('width'), 10) || null, parseInt(fd.get('height'), 10) || null,
    String(fd.get('original_name') || '').slice(0, 200), String(fd.get('original_type') || '').slice(0, 100), ts).run();
  await syncCount(env, jan);
  const origin = new URL(request.url).origin;
  return json({ ok: true, jan, slot, url: imageUrl(origin, jan, slot, ts), bytes: buf.length, images: await listImages(env, origin, jan) });
}

export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const jan = cleanJan(url.searchParams.get('jan') || '');
  const slot = parseInt(url.searchParams.get('slot'), 10);
  if (!jan || !(slot >= SLOT_MIN && slot <= SLOT_MAX)) return json({ ok: false, reason: 'bad_params' }, 400);
  const rs = await env.DB.prepare('SELECT * FROM pim_images WHERE jan=? ORDER BY slot').bind(jan).all();
  const imgs = rs.results || [];
  if (!imgs.some((im) => im.slot === slot)) return json({ ok: false, reason: 'not_found' }, 404);
  if (hasR2(env)) { try { await env.PRODUCT_IMAGES.delete(imageKey(jan, slot)); } catch (e) { /* 実体が無くても台帳は消す */ } }
  await env.DB.prepare('DELETE FROM pim_images WHERE jan=? AND slot=?').bind(jan, slot).run();
  // 後ろを前に詰める（3枚目を消したら 4→3, 5→4）
  const after = imgs.filter((im) => im.slot > slot).sort((a, b) => a.slot - b.slot);
  for (const im of after) {
    const to = im.slot - 1;
    if (hasR2(env)) {
      const obj = await env.PRODUCT_IMAGES.get(im.key);
      if (obj) {
        await env.PRODUCT_IMAGES.put(imageKey(jan, to), await obj.arrayBuffer(), { httpMetadata: { contentType: 'image/webp', cacheControl: 'public, max-age=31536000, immutable' } });
        try { await env.PRODUCT_IMAGES.delete(im.key); } catch (e) { /* */ }
      }
    }
    await env.DB.prepare('UPDATE pim_images SET slot=?, key=?, created_at=? WHERE jan=? AND slot=?').bind(to, imageKey(jan, to), nowIso(), jan, im.slot).run();
  }
  await syncCount(env, jan);
  return json({ ok: true, jan, images: await listImages(env, url.origin, jan) });
}

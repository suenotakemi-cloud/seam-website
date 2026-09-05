// 画像URLの取り寄せ（PC の取り込み画面が、メーカー CSV の「画像」列の URL から写真を登録するときに使う）
//   GET /api/pim/fetch?url=https://…  → その画像のバイト列（content-type はそのまま）
//   ブラウザから他社サイトの画像を直接読むと CORS で止まるので、ここが代わりに取りに行く。取った後の縮小・webp 化・
//   自動チェック・サムネ・phash はいつも通りブラウザ側（pim-client.js）で行い、images API に登録する。
//   制限: https（と動作確認用の http://127.0.0.1 / localhost）だけ・画像だけ・12MB まで・ログイン済みだけ（_middleware）。
//   内側のアドレス（10. / 192.168. / 169.254. など）には行かない。
const MAX = 12 * 1024 * 1024;
function urlOk(u) {
  let x; try { x = new URL(u); } catch (e) { return false; }
  const h = x.hostname.toLowerCase();
  if (x.protocol === 'http:') return h === '127.0.0.1' || h === 'localhost';
  if (x.protocol !== 'https:') return false;
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(h) || h === 'localhost' || /^\[/.test(h)) return false;
  return true;
}
export async function onRequestGet({ request, data }) {
  if (data && data.readonly) return new Response(JSON.stringify({ ok: false, reason: 'readonly', message: '連携キーでは使えません' }), { status: 403, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const u = new URL(request.url).searchParams.get('url') || '';
  if (!urlOk(u)) return new Response(JSON.stringify({ ok: false, reason: 'bad_url', message: '画像の URL は https:// で始まるものだけ取り寄せられます' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
  let r;
  try {
    r = await fetch(u, { headers: { accept: 'image/*,*/*;q=0.5', 'user-agent': 'SEAM-PIM/1.0 (+https://seam.site/pim/)' }, redirect: 'follow', signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: 'fetch_failed', message: '取り寄せられませんでした: ' + String(e && e.message || e).slice(0, 200) }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if (!r.ok) return new Response(JSON.stringify({ ok: false, reason: 'http_' + r.status, message: '画像の URL が HTTP ' + r.status + ' を返しました' }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const ct = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const len = parseInt(r.headers.get('content-length') || '0', 10);
  if (len > MAX) return new Response(JSON.stringify({ ok: false, reason: 'too_large', message: '画像が大きすぎます（12MB まで）' }), { status: 413, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const buf = new Uint8Array(await r.arrayBuffer());
  if (buf.length > MAX) return new Response(JSON.stringify({ ok: false, reason: 'too_large', message: '画像が大きすぎます（12MB まで）' }), { status: 413, headers: { 'content-type': 'application/json; charset=utf-8' } });
  // content-type が無い/怪しいときは中身の先頭で判定（jpeg/png/gif/webp/bmp/avif/heic）
  const sig = (b) => (b[0] === 0xff && b[1] === 0xd8) ? 'image/jpeg' : (b[0] === 0x89 && b[1] === 0x50) ? 'image/png' : (b[0] === 0x47 && b[1] === 0x49) ? 'image/gif' : (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) ? 'image/webp' : (b[0] === 0x42 && b[1] === 0x4d) ? 'image/bmp' : (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) ? 'image/avif' : '';
  const type = /^image\//.test(ct) ? ct : sig(buf);
  if (!type) return new Response(JSON.stringify({ ok: false, reason: 'not_image', message: 'この URL は画像ではありません（' + (ct || '種類不明') + '）' }), { status: 415, headers: { 'content-type': 'application/json; charset=utf-8' } });
  return new Response(buf, { status: 200, headers: { 'content-type': type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}

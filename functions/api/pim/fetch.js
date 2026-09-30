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
    // 転送（リダイレクト）は自分でたどり、行き先も毎回確かめる（転送で内側のアドレスへ行かせないため）。4 回まで
    let cur = u;
    for (let hop = 0; ; hop++) {
      r = await fetch(cur, { headers: { accept: 'image/*,*/*;q=0.5', 'user-agent': 'SEAM-PIM/1.0 (+https://seam.site/pim/)' }, redirect: 'manual', signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
      if (!(r.status >= 300 && r.status < 400)) break;
      const loc = r.headers.get('location');
      if (!loc || hop >= 4) return new Response(JSON.stringify({ ok: false, reason: 'redirect', message: '画像の URL の転送が多すぎるか、行き先がありません' }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
      const next = new URL(loc, cur).toString();
      if (!urlOk(next)) return new Response(JSON.stringify({ ok: false, reason: 'bad_url', message: '画像の URL の転送先が取り寄せできない場所です' }), { status: 400, headers: { 'content-type': 'application/json; charset=utf-8' } });
      cur = next;
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, reason: 'fetch_failed', message: '取り寄せられませんでした: ' + String(e && e.message || e).slice(0, 200) }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  }
  if (!r.ok) return new Response(JSON.stringify({ ok: false, reason: 'http_' + r.status, message: '画像の URL が HTTP ' + r.status + ' を返しました' }), { status: 502, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const ct = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const len = parseInt(r.headers.get('content-length') || '0', 10);
  if (len > MAX) return new Response(JSON.stringify({ ok: false, reason: 'too_large', message: '画像が大きすぎます（12MB まで）' }), { status: 413, headers: { 'content-type': 'application/json; charset=utf-8' } });
  // 大きさを名乗らない相手でも、読みながら 12MB を超えたところで打ち切る（全部読んでから数えるとメモリを食う）
  const parts = []; let total = 0;
  if (r.body && r.body.getReader) {
    const rd = r.body.getReader();
    for (;;) { const { done, value } = await rd.read(); if (done) break; total += value.length; if (total > MAX) { try { await rd.cancel(); } catch (e) { /* */ } break; } parts.push(value); }
  } else { const all = new Uint8Array(await r.arrayBuffer()); total = all.length; parts.push(all); }
  if (total > MAX) return new Response(JSON.stringify({ ok: false, reason: 'too_large', message: '画像が大きすぎます（12MB まで）' }), { status: 413, headers: { 'content-type': 'application/json; charset=utf-8' } });
  const buf = new Uint8Array(total); { let o = 0; for (const x of parts) { buf.set(x, o); o += x.length; } }
  if (buf.length > MAX) return new Response(JSON.stringify({ ok: false, reason: 'too_large', message: '画像が大きすぎます（12MB まで）' }), { status: 413, headers: { 'content-type': 'application/json; charset=utf-8' } });
  // content-type が無い/怪しいときは中身の先頭で判定（jpeg/png/gif/webp/bmp/avif/heic）
  const sig = (b) => (b[0] === 0xff && b[1] === 0xd8) ? 'image/jpeg' : (b[0] === 0x89 && b[1] === 0x50) ? 'image/png' : (b[0] === 0x47 && b[1] === 0x49) ? 'image/gif' : (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) ? 'image/webp' : (b[0] === 0x42 && b[1] === 0x4d) ? 'image/bmp' : (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) ? 'image/avif' : '';
  const type = /^image\//.test(ct) ? ct : sig(buf);
  if (!type) return new Response(JSON.stringify({ ok: false, reason: 'not_image', message: 'この URL は画像ではありません（' + (ct || '種類不明') + '）' }), { status: 415, headers: { 'content-type': 'application/json; charset=utf-8' } });
  return new Response(buf, { status: 200, headers: { 'content-type': type, 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
}

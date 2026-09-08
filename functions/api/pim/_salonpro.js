// SalonPro（EC）へ商品写真を送る部品
//   相手の API: POST /api/v1/product-images  Authorization: Bearer spk_…
//   ・JAN で商品を指すので、SalonPro 側に同じ JAN の商品が先に登録されている必要がある（無ければ 404 product_not_found）
//   ・こちらの写真は「1枚目＝主画像」なので、毎回 mode=replace で 1..5 枚目をまとめて送り、並び順ごと合わせる
//   ・キーはディーラーごと（pim_accounts.ec_key）。SEAM 側では中身を画面に出さない
import { imageKey, blobGet, nowIso } from './_lib.js';

export const EC_DEFAULT_URL = 'https://pro-console.salon.town';
export function ecUrlOk(url) { return /^https:\/\/[^\s?#]+$/.test(String(url || '')) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(String(url || '')); }
export function ecKeyOk(key) { return /^spk_[A-Za-z0-9_.-]{8,200}$/.test(String(key || '')); }
export function ecBase(account) { return String((account && account.ec_url) || EC_DEFAULT_URL).replace(/\/+$/, ''); }

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
  return btoa(s);
}
async function readBlob(env, key) {
  const obj = await blobGet(env, key);
  if (!obj) return null;
  return obj.body instanceof ArrayBuffer ? new Uint8Array(obj.body) : new Uint8Array(await new Response(obj.body).arrayBuffer());
}
async function ecFetch(account, path, init) {
  const headers = Object.assign({ authorization: 'Bearer ' + account.ec_key }, (init && init.headers) || {});
  const opt = Object.assign({}, init, { headers });
  if (AbortSignal.timeout) opt.signal = AbortSignal.timeout(20000);
  const r = await fetch(ecBase(account) + path, opt);
  let body = null;
  try { body = JSON.parse(await r.text()); } catch (e) { /* JSON でない応答（502 の HTML など） */ }
  return { status: r.status, body };
}

// 相手の応答から「人が読む一言」を作る
function messageOf(status, body) {
  const err = body && body.error;
  if (err && err.message) return String(err.message).slice(0, 300);
  if (status === 401) return 'SalonPro のキーが無効です（設定でキーを入れ直してください）';
  if (status === 0) return 'SalonPro につながりませんでした';
  return 'SalonPro が ' + status + ' を返しました';
}
function codeOf(status, body) {
  const err = body && body.error;
  if (err && err.code) return String(err.code).slice(0, 40);
  return status === 200 ? 'ok' : 'http_' + status;
}

// 1商品ぶんの写真を送る。images は pim_images の行（slot 昇順）
export async function pushOne(env, account, jan, images) {
  if (!images.length) return { jan, ok: false, code: 'no_images', message: '写真がまだありません' };
  const payload = [];
  for (const im of images) {
    const buf = await readBlob(env, im.key || imageKey(account.id, jan, im.slot));
    if (!buf) return { jan, ok: false, code: 'blob_missing', message: (im.slot) + '枚目の画像データが見つかりません' };
    payload.push({ data: 'data:image/webp;base64,' + b64(buf) });
  }
  let res;
  try {
    res = await ecFetch(account, '/api/v1/product-images', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jan, mode: 'replace', images: payload }),
    });
  } catch (e) { return { jan, ok: false, code: 'network', message: 'SalonPro につながりませんでした: ' + String((e && e.message) || e).slice(0, 120) }; }
  const ok = res.status === 200 && res.body && res.body.ok;
  return { jan, ok: !!ok, status: res.status, code: codeOf(res.status, res.body), message: ok ? '' : messageOf(res.status, res.body), sent: payload.length, added: (res.body && res.body.added) || 0, product: (res.body && res.body.product) || null };
}

// 複数の JAN を送って、結果を商品行に書き戻す
export async function pushJans(env, account, jans, by) {
  const acct = account.id, out = [];
  for (const jan of jans) {
    // 送る直前の updated_at を控えておく。送っている間に誰かが写真を足したら「送信ずみ」にしない（次の送信で最新が届く）
    const snap = await env.DB.prepare('SELECT updated_at FROM pim_products WHERE account_id=? AND jan=?').bind(acct, jan).first();
    const was = snap ? snap.updated_at : null;
    const rs = await env.DB.prepare('SELECT slot, key FROM pim_images WHERE account_id=? AND jan=? ORDER BY slot').bind(acct, jan).all();
    const r = await pushOne(env, account, jan, rs.results || []);
    const ts = nowIso();
    // 写真が 1 枚も無い商品は「送るものが無い」だけなので、失敗として記録しない
    //   （EC 側の写真を消すのは取り消せないので、こちらからは消さない。EC の管理画面で消してもらう）
    if (r.code === 'no_images') { out.push(Object.assign({ skipped: true }, r)); continue; }
    try {
      if (r.ok) await env.DB.prepare('UPDATE pim_products SET ec_push_at=?, ec_push_status=?, ec_push_msg=NULL, ec_synced_at=? WHERE account_id=? AND jan=? AND updated_at=?').bind(ts, 'ok', ts, acct, jan, was).run();
      else await env.DB.prepare('UPDATE pim_products SET ec_push_at=?, ec_push_status=?, ec_push_msg=? WHERE account_id=? AND jan=?').bind(ts, r.code, r.message || null, acct, jan).run();
    } catch (e) { /* 送信そのものは終わっているので、記録に失敗しても結果は返す */ }
    out.push(Object.assign({ by: by || null }, r));
  }
  return out;
}

// 写真が変わったら自動で送る（設定で「自動送信」を入れているディーラーだけ）。応答は待たせない
export function autoPush(context, account, jans) {
  try {
    if (!account || !account.ec_auto || !ecKeyOk(account.ec_key)) return;
    const list = Array.from(new Set((jans || []).filter(Boolean))).slice(0, 20);
    if (!list.length) return;
    const run = pushJans(context.env, account, list, 'auto').catch(() => []);
    if (context.waitUntil) context.waitUntil(run);
    return run;
  } catch (e) { /* 自動送信で業務は止めない */ }
}

// キーの確認（商品を1件も触らずに、キーが通るかだけ見る）
export async function ecPing(account) {
  let res;
  try { res = await ecFetch(account, '/api/v1/product-images?jan=0000000000000', { method: 'GET' }); } catch (e) { return { ok: false, status: 0, message: 'SalonPro につながりませんでした: ' + String((e && e.message) || e).slice(0, 120) }; }
  // 404 product_not_found はキーが通っている証拠（その JAN の商品が無いだけ）
  if (res.status === 200 || (res.status === 404 && res.body && res.body.error && res.body.error.code === 'product_not_found')) return { ok: true, status: res.status, message: 'SalonPro につながりました（キーは有効です）' };
  return { ok: false, status: res.status, message: messageOf(res.status, res.body) };
}

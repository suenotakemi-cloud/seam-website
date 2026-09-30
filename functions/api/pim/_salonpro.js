// SalonPro（EC）へ商品写真を送る部品
//   相手の API: POST /api/v1/product-images  Authorization: Bearer spk_…（x-api-key ヘッダでも可）
//   ・JAN で商品を指すので、SalonPro 側に同じ JAN の商品が先に登録されている必要がある（無ければ 404 product_not_found）
//   ・こちらの写真は「1枚目＝主画像」なので、毎回 mode=replace で 1..5 枚目をまとめて送り、並び順ごと合わせる
//   ・キーはディーラーごと（pim_accounts.ec_key）。SEAM 側では中身を画面に出さない
//   ・キーの形は spk_<ID 12 文字>_<秘密の部分>。発行後の一覧に見えるのは ID だけで、全体は発行のときに一度しか出ない
//     （2026-09-30: ディーラーが ID の 12 文字だけを貼って「つながらない」になった。keyProblem がその形を見分けて案内する）
import { imageKey, blobGet, nowIso } from './_lib.js';

export const EC_DEFAULT_URL = 'https://pro-console.salon.town';
export function ecUrlOk(url) { return /^https:\/\/[^\s?#]+$/.test(String(url || '')) || /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?(\/|$)/.test(String(url || '')); }
// 貼られた URL を「https://ホスト」だけに揃える（管理画面のページ URL をそのまま貼っても動くように）
export function ecNormalizeUrl(url) {
  const s = String(url || '').trim();
  if (!s) return EC_DEFAULT_URL;
  try { const u = new URL(/^https?:\/\//.test(s) ? s : 'https://' + s); return u.origin; } catch (e) { return s.replace(/\/+$/, ''); }
}
// 貼られたキーの前後の空白・引用符・「」・改行を落とす
export function ecNormalizeKey(raw) { return String(raw || '').replace(/[\s\u3000]+/g, '').replace(/^["'\u300c\u300e\u201c\u2018`]+|["'\u300d\u300f\u201d\u2019`]+$/g, '').trim(); }
export function ecKeyOk(key) { return /^spk_[A-Za-z0-9_.-]{8,200}$/.test(String(key || '')); }
// キーとして受け取れないときの理由（人が読む一言）。受け取れるなら ''
export function keyProblem(key) {
  const k = ecNormalizeKey(key);
  if (!k) return 'SalonPro のキーを入れてください';
  const body = k.replace(/^spk_/, '');
  const idOnly = /^[A-Za-z0-9]{8,24}$/.test(body); // spk_ の後ろが英数字だけ（_ が無い）＝ ID の部分だけ
  if (!/^spk_/.test(k) || idOnly) {
    return 'これはキーの ID の部分だけのようです（' + k.slice(0, 20) + (k.length > 20 ? '…' : '') + '）。SalonPro でキーを発行したときに一度だけ表示された「spk_' + (idOnly ? body : 'XXXXXXXXXXXX') + '_…」という長い文字列の全体を貼ってください。閉じてしまった場合は、SalonPro の 外部連携（APIキー）でそのキーを失効させ、もう一度発行して、表示された全体をコピーしてください';
  }
  if (!ecKeyOk(k)) return 'キーに使えない文字が入っています。発行時に表示された文字列をそのまま貼ってください';
  return '';
}
export function ecBase(account) { return ecNormalizeUrl((account && account.ec_url) || EC_DEFAULT_URL); }

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
  const headers = Object.assign({ authorization: 'Bearer ' + account.ec_key, 'x-api-key': account.ec_key, accept: 'application/json' }, (init && init.headers) || {});
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
  const HINT401 = '発行時に一度だけ表示された spk_…_… の全体を貼り直してください（ID の部分だけ・失効ずみ・別の環境のキー、のどれか）';
  if (status === 401) return (err && err.message ? String(err.message).slice(0, 120) + '。' : 'SalonPro がキーを受け付けませんでした。') + HINT401;
  if (err && err.message) return String(err.message).slice(0, 300);
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
    // キーが通らない・つながらないときは、残りの商品も同じ結果になるので 1 件で止める（商品ごとに失敗を刻まない）
    const fatal = r.code === 'unauthorized' || r.code === 'network' || r.status === 401;
    try {
      if (r.ok) await env.DB.prepare('UPDATE pim_products SET ec_push_at=?, ec_push_status=?, ec_push_msg=NULL, ec_synced_at=? WHERE account_id=? AND jan=? AND updated_at=?').bind(ts, 'ok', ts, acct, jan, was).run();
      else if (!fatal) await env.DB.prepare('UPDATE pim_products SET ec_push_at=?, ec_push_status=?, ec_push_msg=? WHERE account_id=? AND jan=?').bind(ts, r.code, r.message || null, acct, jan).run(); // キー・接続の問題は商品のせいではないので、商品には刻まず「送信待ち」のまま残す
    } catch (e) { /* 送信そのものは終わっているので、記録に失敗しても結果は返す */ }
    out.push(Object.assign({ by: by || null }, r));
    if (fatal) { await recordStatus(env, account, false, r.message); out.push({ jan: null, ok: false, code: 'stopped', message: '残りの商品は送っていません（キーか接続の問題が直ってから送り直してください）' }); break; }
    if (r.ok) await recordStatus(env, account, true, '');
  }
  return out;
}

// 接続の最終結果をアカウントに残す（設定画面で「つながっている／いない」が分かるように）
export async function recordStatus(env, account, ok, message) {
  try { await env.DB.prepare('UPDATE pim_accounts SET ec_status=?, ec_status_at=? WHERE id=?').bind((ok ? 'ok' : 'ng') + (message ? ': ' + String(message).slice(0, 300) : ''), nowIso(), account.id).run(); } catch (e) { /* 列が無い等 */ }
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
//   jan を渡せばその商品で確認する（無ければダミーの JAN。404 product_not_found はキーが通っている証拠）
export async function ecPing(account, jan) {
  let res;
  const j = String(jan || '').replace(/[^0-9]/g, '') || '0000000000000';
  try { res = await ecFetch(account, '/api/v1/product-images?jan=' + j, { method: 'GET' }); } catch (e) { return { ok: false, status: 0, message: 'SalonPro につながりませんでした（' + ecBase(account) + '）: ' + String((e && e.message) || e).slice(0, 120) }; }
  const code = res.body && res.body.error && res.body.error.code;
  if (res.status === 200 || (res.status === 404 && code === 'product_not_found')) return { ok: true, status: res.status, message: 'SalonPro につながりました（キーは有効です）' };
  if (res.status === 404 && !res.body) return { ok: false, status: 404, message: 'その URL に SalonPro の API がありません（' + ecBase(account) + '）。URL は https://pro-console.salon.town のままにしてください' };
  return { ok: false, status: res.status, code: code || null, message: messageOf(res.status, res.body) + (code ? '（SalonPro: ' + code + '）' : '') };
}

// SalonPro（EC）へ商品写真を送る部品
//   相手の API: POST /api/v1/product-images  Authorization: Bearer spk_…（x-api-key ヘッダでも可）
//   ・JAN で商品を指すので、SalonPro 側に同じ JAN の商品が先に登録されている必要がある（無ければ 404 product_not_found）
//   ・こちらの写真は「1枚目＝主画像」なので、毎回 mode=replace で 1..5 枚目をまとめて送り、並び順ごと合わせる
//   ・キーはディーラーごと（pim_accounts.ec_key）。商品登録システム側では中身を画面に出さない
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
async function ecFetch(account, path, init, timeoutMs) {
  const headers = Object.assign({ authorization: 'Bearer ' + account.ec_key, 'x-api-key': account.ec_key, accept: 'application/json' }, (init && init.headers) || {});
  const opt = Object.assign({}, init, { headers });
  if (AbortSignal.timeout) opt.signal = AbortSignal.timeout(timeoutMs || 20000);
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
  const startedAt = Date.now();
  try {
    res = await ecFetch(account, '/api/v1/product-images', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jan, mode: 'replace', images: payload }),
    }, 60000); // 5 枚まとめて送るので長めに待つ（途中で切ると、SalonPro 側では入ったのにこちらは失敗、になる）
  } catch (e) {
    // タイムアウト・通信切れでも、SalonPro 側では登録が終わっていることがある → 実際に入っているかを見に行く
    const v = await verifyOne(account, jan, payload.length, startedAt);
    if (v.ok) return { jan, ok: true, status: 200, code: 'ok', message: '', sent: payload.length, added: v.count, verified: true };
    return { jan, ok: false, code: 'network', message: 'SalonPro につながりませんでした: ' + String((e && e.message) || e).slice(0, 120) };
  }
  if (isSuccess(res)) return { jan, ok: true, status: res.status, code: 'ok', message: '', sent: payload.length, added: (res.body && res.body.added) || payload.length, product: (res.body && res.body.product) || null };
  // 失敗に見える応答でも、キーの問題（401）や未登録（404）でなければ、実際に入っていないか確かめてから失敗とする
  const code = codeOf(res.status, res.body);
  if (res.status !== 401 && code !== 'product_not_found' && code !== 'product_ambiguous' && code !== 'dealer_mismatch') {
    const v = await verifyOne(account, jan, payload.length, startedAt);
    if (v.ok) return { jan, ok: true, status: res.status, code: 'ok', message: '', sent: payload.length, added: v.count, verified: true };
  }
  // 200 でも中身が読めない・写真 0 枚の返事は失敗。印に 'ok' を書くと「送信ずみ」に見えてしまうので別の名前にする
  const fcode = code === 'ok' ? 'bad_response' : code;
  const fmsg = code === 'ok' ? 'SalonPro の返事を読み取れませんでした（写真が入ったか確認できません。URL が正しいか、もう一度送ってください）' : messageOf(res.status, res.body);
  return { jan, ok: false, status: res.status, code: fcode, message: fmsg, sent: payload.length, added: 0, product: (res.body && res.body.product) || null };
}

// 「送れた」の判定。SalonPro は 200 + {ok:true} を返すが、201 や ok の無い本文（images だけ）でも入っている
function isSuccess(res) {
  if (!(res.status >= 200 && res.status < 300)) return false;
  const b = res.body;
  if (!b) return false; // JSON でない 2xx は中身が分からないので、呼び出し側で確かめる
  if (b.ok === false || b.error) return false;
  // 2xx でも写真が 1 枚も入っていない返事（images:[] / added:0）は成功にしない（呼び出し側で確かめる）
  return b.ok === true || (Array.isArray(b.images) && b.images.length > 0) || (typeof b.added === 'number' && b.added > 0);
}

// SalonPro の写真が since 以降に作られたものか（mode=replace は毎回作り直すので、今回の送信で入ったなら全部新しい）
//   createdAt が返ってこないときは判定できないので true（枚数だけで見る）
const CLOCK_SKEW_MS = 2 * 60 * 1000; // 相手の時計とのずれの余裕（広すぎると、直前に送った古い写真を今回の分と取り違える）
function freshEnough(imgs, sinceMs) {
  if (!sinceMs) return true;
  const ts = imgs.map((im) => Date.parse(im && (im.createdAt || im.created_at) || '')).filter((t) => !isNaN(t));
  if (!ts.length) return true;
  return ts.length === imgs.length && ts.every((t) => t >= sinceMs - CLOCK_SKEW_MS);
}

// SalonPro に、その JAN の写真が want 枚以上、since 以降に入っているか（入っていれば「送れた」とみなす）
//   since を渡さないと枚数だけで見る。前回送った古い写真が同じ枚数残っていて誤判定しないよう、送信直後の確認では必ず渡す
export async function verifyOne(account, jan, want, sinceMs) {
  let res;
  try { res = await ecFetch(account, '/api/v1/product-images?jan=' + encodeURIComponent(jan), { method: 'GET' }, 20000); } catch (e) { return { ok: false, reason: 'network' }; }
  const code = res.body && res.body.error && res.body.error.code;
  if (res.status === 404 && code === 'product_not_found') return { ok: false, reason: 'product_not_found', message: messageOf(res.status, res.body) };
  if (res.status === 401) return { ok: false, reason: 'unauthorized', message: messageOf(res.status, res.body) };
  const imgs = res.body && Array.isArray(res.body.images) ? res.body.images : null;
  if (!(res.status >= 200 && res.status < 300) || !imgs) return { ok: false, reason: 'http_' + res.status };
  // mode=replace は送った枚数ちょうどになる。多くても少なくても「今回の分」ではない（前回の写真が残っている・途中で切れた）
  const enough = imgs.length > 0 && imgs.length === (want || 1);
  const fresh = freshEnough(imgs, sinceMs);
  return { ok: enough && fresh, count: imgs.length, stale: enough && !fresh };
}

// 複数の JAN を送って、結果を商品行に書き戻す
export async function pushJans(env, account, jans, by, budgetMs) {
  const acct = account.id, out = [], t0 = Date.now();
  for (const jan of jans) {
    // 時間の上限を超えたら新しい商品には手を付けない（残りは送信待ちのまま。次の送信で続きから）
    if (budgetMs && Date.now() - t0 > budgetMs) { out.push({ jan: null, ok: false, code: 'budget', message: '時間がかかっているので、残りは次の送信に回しました' }); break; }
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
      if (r.ok) {
        // 送っている間に写真が変わっていなければ「送信ずみ」。変わっていたら送信待ちのまま（次の送信で最新が届く）
        const u = await env.DB.prepare('UPDATE pim_products SET ec_push_at=?, ec_push_status=?, ec_push_msg=NULL, ec_synced_at=? WHERE account_id=? AND jan=? AND updated_at=?').bind(ts, 'ok', ts, acct, jan, was).run();
        // どちらでも、前の失敗の印は消す（SalonPro には届いているのに「送れなかったもの」に残り続けないように）
        if (!(u.meta && u.meta.changes)) await env.DB.prepare("UPDATE pim_products SET ec_push_status='ok', ec_push_msg=NULL WHERE account_id=? AND jan=?").bind(acct, jan).run();
      }
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
export const AUTO_SETTLE_MS = 3000;
export function autoPush(context, account, jans) {
  try {
    if (!account || !account.ec_auto || !ecKeyOk(account.ec_key)) return;
    const list = Array.from(new Set((jans || []).filter(Boolean))).slice(0, 20);
    if (!list.length) return;
    // 連写・送信待ちの一斉送信で、同じ商品の送信が重なると古い枚数が後から届いて上書きすることがある。
    //   少し待って、その間にまた写真が変わっていたら送らない（後の変更の自動送信が最新をまとめて送る）
    const env = context.env;
    const run = (async () => {
      const snap = {};
      for (const j of list) { const r = await env.DB.prepare('SELECT updated_at FROM pim_products WHERE account_id=? AND jan=?').bind(account.id, j).first(); snap[j] = r && r.updated_at; }
      await new Promise((r) => setTimeout(r, AUTO_SETTLE_MS));
      const still = [];
      for (const j of list) { const r = await env.DB.prepare('SELECT updated_at FROM pim_products WHERE account_id=? AND jan=?').bind(account.id, j).first(); if (r && r.updated_at === snap[j]) still.push(j); }
      return still.length ? pushJans(env, account, still, 'auto', 15000) : []; // 応答後の処理は 30 秒ほどで打ち切られるので、その手前で止める
    })().catch(() => []);
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
  const looksApi = res.body && (res.body.ok === true || Array.isArray(res.body.images) || res.body.product);
  if ((res.status === 200 && looksApi) || (res.status === 404 && code === 'product_not_found')) return { ok: true, status: res.status, message: 'SalonPro につながりました（キーは有効です）' };
  if (res.status === 200 && !looksApi) return { ok: false, status: 200, message: 'その URL は SalonPro の API ではないようです（' + ecBase(account) + '）。URL は https://pro-console.salon.town のままにしてください' };
  if (res.status === 404 && !res.body) return { ok: false, status: 404, message: 'その URL に SalonPro の API がありません（' + ecBase(account) + '）。URL は https://pro-console.salon.town のままにしてください' };
  return { ok: false, status: res.status, code: code || null, message: messageOf(res.status, res.body) + (code ? '（SalonPro: ' + code + '）' : '') };
}

// 「送れなかったもの」を SalonPro 側で確かめ直す。写真が入っていれば「送信ずみ」に直す（2026-09-30: 届いているのに失敗表示が残った件）
//   写真の枚数がこちらと同じか多ければ届いているとみなす。未登録（404）はそのまま残す
export async function reconcile(env, account, jans, opts) {
  const o = opts || {}, acct = account.id, t0 = Date.now();
  const out = { checked: 0, fixed: 0, still: 0, not_found: 0, stale: 0, stopped: false, more: false, items: [] };
  for (const jan of jans) {
    if (o.budgetMs && Date.now() - t0 > o.budgetMs) { out.more = true; break; }
    const cnt = await env.DB.prepare('SELECT image_count, updated_at, ec_push_at FROM pim_products WHERE account_id=? AND jan=?').bind(acct, jan).first();
    if (!cnt) continue;
    // 最後に送ろうとした時刻より後に作られた写真だけを「今回届いたもの」とみなす（それより古いのは前回の残り）
    const since = cnt.ec_push_at ? Date.parse(cnt.ec_push_at) - 90 * 1000 : 0;
    const v = await verifyOne(account, jan, cnt.image_count || 1, since);
    out.checked++;
    if (v.reason === 'unauthorized' || v.reason === 'network') { out.stopped = true; await recordStatus(env, account, false, v.message || 'SalonPro につながりませんでした'); break; }
    const ts = nowIso();
    if (v.ok) {
      // 最後に送ろうとした後で写真が変わっていたら、SalonPro にあるのは前の写真。失敗の印だけ消して送信待ちに残す（次の送信で最新が届く）
      const changedSince = cnt.ec_push_at && cnt.updated_at > cnt.ec_push_at;
      const u = changedSince ? { meta: { changes: 0 } } : await env.DB.prepare("UPDATE pim_products SET ec_push_at=?, ec_push_status='ok', ec_push_msg=NULL, ec_synced_at=? WHERE account_id=? AND jan=? AND updated_at=?").bind(ts, ts, acct, jan, cnt.updated_at).run();
      // 確かめている間に写真が変わっていたら、失敗の印だけ消して送信待ちに残す
      if (!(u.meta && u.meta.changes)) await env.DB.prepare("UPDATE pim_products SET ec_push_status='ok', ec_push_msg=NULL WHERE account_id=? AND jan=?").bind(acct, jan).run();
      out.fixed++; out.items.push({ jan, ok: true, count: v.count });
    } else {
      if (v.reason === 'product_not_found') { out.not_found++; await env.DB.prepare("UPDATE pim_products SET ec_push_status='product_not_found', ec_push_msg=? WHERE account_id=? AND jan=?").bind(v.message || 'SalonPro に商品が未登録です', acct, jan).run(); }
      if (v.stale) out.stale++;
      out.still++; out.items.push({ jan, ok: false, reason: v.reason || (v.stale ? 'stale' : 'fewer'), count: v.count || 0 });
    }
  }
  if (out.fixed && !out.stopped) await recordStatus(env, account, true, '');
  return out;
}

// SEAM 入場受付 — 端末の鍵（Cloudflare Pages Function）
// ルート: POST /entrance/device
//
// これまで、受付のiPadは「自動で復帰」を選ぶと
// メールアドレスとパスワードを、そのまま端末の中（localStorage）に置いていた。
// iPadを持ち去られたら、そのままログインできてしまう。
// 画面に差し込まれた悪いコードからも、まとめて読み出せる。
//
// 代わりに、この口が「端末の鍵」を1本発行する。
//   ・端末が持つのは、意味のない長い文字列だけ
//   ・その文字列からパスワードは取り出せない（鍵はサーバーにしかない）
//   ・要らなくなったら1本ずつ消せる（他の端末は生きたまま）
//   ・どの端末がいつ使ったかが残る
//
// つかい方
//   POST { action:'issue',  mail, pass }  → { ok, deviceId, token, ... }
//   POST { action:'renew',  deviceId }    → { ok, token, ... }（合言葉は返さない）
//   POST { action:'revoke', deviceId }    → { ok }
//
// ★ DEVICE_SECRET が設定されていないときは、鍵を発行しない。
//   守れないのに「守っているつもり」にするのがいちばん危ないため。

const ALLOWED_ORIGINS = ['https://seam.site', 'https://www.seam.site'];

function corsHeaders(origin) {
  const allowed =
    ALLOWED_ORIGINS.includes(origin) || /^https?:\/\/localhost(:\d+)?$/.test(origin)
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}

export async function onRequestOptions(context) {
  return new Response(null, { status: 204, headers: corsHeaders(context.request.headers.get('Origin') || '') });
}

/* ── しまう・取り出す ──
   合言葉は AES-GCM でしまう。鍵は環境変数 DEVICE_SECRET から作る。
   端末にもD1にも、そのままの合言葉は残らない。 */
const enc = new TextEncoder(), dec = new TextDecoder();

async function aesKey(secret) {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(String(secret)));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s) => new Uint8Array(String(s).match(/.{1,2}/g).map((x) => parseInt(x, 16)));

async function seal(secret, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(secret), enc.encode(JSON.stringify(obj)));
  return hex(iv) + ':' + hex(ct);
}
async function open(secret, box) {
  const [i, c] = String(box || '').split(':');
  if (!i || !c) return null;
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unhex(i) }, await aesKey(secret), unhex(c));
    return JSON.parse(dec.decode(pt));
  } catch (e) { return null; }
}

async function ensureTable(env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS entrance_device (
       device_id TEXT PRIMARY KEY,
       box       TEXT NOT NULL,
       label     TEXT DEFAULT '',
       created_at TEXT,
       used_at    TEXT,
       uses       INTEGER DEFAULT 0
     )`
  ).run();
}

/* salon.town へログインして、その場かぎりの token をもらう */
async function login(idOrMail, pass) {
  const body = String(idOrMail).includes('@') ? { mail: idOrMail, pass } : { login_id: idOrMail, pass };
  const r = await fetch('https://seam.salon.town/login', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!j || !j.result || !j.data || !j.data.token) return null;
  return j.data;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const H = {
    ...corsHeaders(request.headers.get('Origin') || ''),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };
  const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: H });

  if (!env || !env.DB) return J({ ok: false, reason: 'no_db' }, 500);
  if (!env.DEVICE_SECRET) return J({ ok: false, reason: 'no_secret' }, 501);

  let b;
  try { b = await request.json(); } catch { return J({ ok: false, reason: 'bad_request' }, 400); }
  const action = String((b && b.action) || '').trim();

  try {
    await ensureTable(env);

    if (action === 'issue') {
      const idOrMail = String(b.mail || b.login_id || '').trim();
      const pass = String(b.pass || '').trim();
      if (!idOrMail || !pass) return J({ ok: false, reason: 'missing_fields' }, 400);

      const d = await login(idOrMail, pass);
      if (!d) return J({ ok: false, reason: 'invalid_credentials' }, 401);

      const deviceId = hex(crypto.getRandomValues(new Uint8Array(32)));
      const box = await seal(env.DEVICE_SECRET, { m: idOrMail, p: pass });
      await env.DB.prepare(
        `INSERT INTO entrance_device (device_id,box,label,created_at,used_at,uses) VALUES (?,?,?,?,?,0)`
      ).bind(deviceId, box, String(b.label || '').slice(0, 40), new Date().toISOString(), new Date().toISOString()).run();

      return J({
        ok: true, deviceId,
        uid: String(d.id || ''), token: String(d.token || ''),
        name: String(d.name || ''), shop_id: String(d.shop_id || ''),
      });
    }

    if (action === 'renew') {
      const deviceId = String(b.deviceId || '').trim();
      if (!/^[0-9a-f]{64}$/.test(deviceId)) return J({ ok: false, reason: 'bad_device' }, 400);
      const row = await env.DB.prepare('SELECT box FROM entrance_device WHERE device_id=?').bind(deviceId).first();
      if (!row) return J({ ok: false, reason: 'revoked' }, 401);

      const cred = await open(env.DEVICE_SECRET, row.box);
      if (!cred) return J({ ok: false, reason: 'revoked' }, 401);

      const d = await login(cred.m, cred.p);
      if (!d) {
        /* 合言葉が変わった等。使えない鍵は残さない */
        await env.DB.prepare('DELETE FROM entrance_device WHERE device_id=?').bind(deviceId).run();
        return J({ ok: false, reason: 'invalid_credentials' }, 401);
      }
      await env.DB.prepare('UPDATE entrance_device SET used_at=?, uses=uses+1 WHERE device_id=?')
        .bind(new Date().toISOString(), deviceId).run();

      /* ★合言葉は返さない。返すのはその場かぎりの token だけ。 */
      return J({
        ok: true,
        uid: String(d.id || ''), token: String(d.token || ''),
        name: String(d.name || ''), shop_id: String(d.shop_id || ''),
      });
    }

    if (action === 'revoke') {
      const deviceId = String(b.deviceId || '').trim();
      if (deviceId) await env.DB.prepare('DELETE FROM entrance_device WHERE device_id=?').bind(deviceId).run();
      return J({ ok: true });
    }

    return J({ ok: false, reason: 'unknown_action' }, 400);
  } catch (e) {
    return J({ ok: false, reason: 'error' }, 500);
  }
}

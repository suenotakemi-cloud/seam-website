// AI受付（ElevenLabs Conversational AI）の会話終了 webhook を受けて D1 に保存する
// POST /api/salontown-ai-webhook   … ElevenLabs からの post_call_transcription
//
// 署名検証：ヘッダ ElevenLabs-Signature: t=<unix秒>,v0=<hmac_sha256(secret, "<t>.<body>")>
// 秘密鍵は Cloudflare Pages の環境変数 ELEVENLABS_WEBHOOK_SECRET。
// 鍵が未設定なら受け付けない（なりすまし防止。「守れないのに守っているつもり」を避ける）。
//
// 保存先：salontown_ai_calls（conversation_id で一意。同じ会話の再送は上書き）
// 抜き出す項目：要約・タイトル・通話秒数・開始時刻・文字起こし（JSON）・
//   data_collection（company / name / contact / prefer / topic）※エージェント側で定義

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function ensureTable(db) {
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS salontown_ai_calls (" +
    " id INTEGER PRIMARY KEY AUTOINCREMENT," +
    " conversation_id TEXT NOT NULL UNIQUE," +
    " agent_id TEXT DEFAULT ''," +
    " title TEXT DEFAULT ''," +
    " summary TEXT DEFAULT ''," +
    " company TEXT DEFAULT ''," +
    " name TEXT DEFAULT ''," +
    " contact TEXT DEFAULT ''," +
    " prefer TEXT DEFAULT ''," +
    " topic TEXT DEFAULT ''," +
    " duration_secs INTEGER DEFAULT 0," +
    " started_at INTEGER DEFAULT 0," +
    " transcript TEXT DEFAULT ''," +
    " status TEXT DEFAULT ''," +
    " created_at INTEGER NOT NULL," +
    " handled INTEGER DEFAULT 0)"
  ).run();
}

const enc = new TextEncoder();
function hex(buf) { return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join(''); }
function safeEq(a, b) {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function verify(request, body, secret) {
  const sig = request.headers.get('elevenlabs-signature') || '';
  const parts = Object.fromEntries(sig.split(',').map(s => s.trim().split('=')).filter(p => p.length === 2));
  const t = parts.t, v0 = parts.v0;
  if (!t || !v0) return false;
  // 30分以上前の署名は受けない（再送攻撃の抑止）
  if (Math.abs(Date.now() / 1000 - Number(t)) > 30 * 60) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = hex(await crypto.subtle.sign('HMAC', key, enc.encode(`${t}.${body}`)));
  return safeEq(mac, v0.toLowerCase());
}

const clip = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
function dc(results, key) {
  const r = results && results[key];
  if (!r) return '';
  return clip(typeof r === 'object' ? (r.value ?? '') : r, 200);
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  const db = env.DB;
  if (!db) return json({ error: 'D1 not bound' }, 500);
  const secret = (env.ELEVENLABS_WEBHOOK_SECRET || '').trim();
  if (!secret) return json({ error: 'webhook secret not configured' }, 401);

  const body = await request.text();
  if (!(await verify(request, body, secret))) return json({ error: 'bad signature' }, 401);

  let ev;
  try { ev = JSON.parse(body); } catch (e) { return json({ error: 'invalid json' }, 400); }
  if (ev.type && ev.type !== 'post_call_transcription') return json({ ok: true, ignored: ev.type });

  const d = ev.data || ev;
  const convId = clip(d.conversation_id, 80);
  if (!convId) return json({ error: 'conversation_id missing' }, 400);
  const wantAgent = (env.ELEVENLABS_AGENT_ID || '').trim();
  if (wantAgent && d.agent_id && d.agent_id !== wantAgent) return json({ ok: true, ignored: 'other agent' });

  const an = d.analysis || {};
  const dcr = an.data_collection_results || {};
  const meta = d.metadata || {};
  const transcript = Array.isArray(d.transcript)
    ? d.transcript.map(t => ({ role: t.role, text: clip(t.message, 2000), t: t.time_in_call_secs }))
    : [];

  await ensureTable(db);
  await db.prepare(
    "INSERT INTO salontown_ai_calls (conversation_id,agent_id,title,summary,company,name,contact,prefer,topic,duration_secs,started_at,transcript,status,created_at)" +
    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)" +
    " ON CONFLICT(conversation_id) DO UPDATE SET title=excluded.title,summary=excluded.summary,company=excluded.company,name=excluded.name," +
    " contact=excluded.contact,prefer=excluded.prefer,topic=excluded.topic,duration_secs=excluded.duration_secs,started_at=excluded.started_at,transcript=excluded.transcript,status=excluded.status"
  ).bind(
    convId, clip(d.agent_id, 80), clip(an.call_summary_title, 120), clip(an.transcript_summary, 4000),
    dc(dcr, 'company'), dc(dcr, 'name'), dc(dcr, 'contact'), dc(dcr, 'prefer'), dc(dcr, 'topic'),
    Number(meta.call_duration_secs) || 0, Number(meta.start_time_unix_secs) || 0,
    JSON.stringify(transcript).slice(0, 60000), clip(d.status, 20), Date.now()
  ).run();
  return json({ ok: true });
}

// /api/pim/* 共通の関所: 合言葉（ADMIN_KEY）と保存先（D1）の有無を確認する
import { json, hasDb, hasR2, ensureSchema } from './_lib.js';

export async function onRequest(context) {
  const { request, env, next } = context;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  const stored = ((env && env.ADMIN_KEY) || '').trim();
  const key = (request.headers.get('x-seam-key') || new URL(request.url).searchParams.get('key') || '').trim();
  if (!stored || !key || key !== stored) {
    return json({ ok: false, reason: 'unauthorized', keyConfigured: !!stored }, 401);
  }
  if (!hasDb(env)) return json({ ok: false, reason: 'no_db', configured: false, r2: hasR2(env) }, 503);
  try { await ensureSchema(env); } catch (e) { return json({ ok: false, reason: 'schema_error', error: String(e && e.message || e) }, 500); }
  return next();
}

// SalonPro（EC）へ写真を送る
//   GET  /api/pim/push                      → { ok, ec:{url,has_key,auto}, pending, failed, items:[…], last }
//        ?limit=  送信待ちの一覧の件数（既定 50）
//   POST /api/pim/push { jans:[…] }         → その JAN だけ送る（50 件まで）
//        POST /api/pim/push { all:true, limit:20 } → 送信待ちの古い順に送る
//   「送信待ち」= 写真が 1 枚以上あり、撮り直しの指示が付いていない商品のうち、
//                 まだ送っていない（ec_push_at が無い）か、送ったあとに写真・内容が変わったもの
//   送信は毎回 mode=replace。SalonPro 側の写真は SEAM の 1〜5 枚目でそっくり置き換わる（並び順の先頭が主画像）
import { json, cleanJan, userOf } from './_lib.js';
import { pushJans, ecKeyOk, ecBase } from './_salonpro.js';

const PENDING_SQL = "(p.image_count>0 AND NOT EXISTS (SELECT 1 FROM pim_images r WHERE r.account_id=p.account_id AND r.jan=p.jan AND r.review='retake') AND (p.ec_push_at IS NULL OR p.ec_push_at < p.updated_at))";

export async function onRequestGet({ request, env, data }) {
  const acct = data.account.id, a = data.account;
  const limit = Math.min(500, Math.max(1, parseInt(new URL(request.url).searchParams.get('limit') || '50', 10) || 50));
  const pending = await env.DB.prepare('SELECT COUNT(*) AS n FROM pim_products p WHERE p.account_id=? AND ' + PENDING_SQL).bind(acct).first();
  const failed = await env.DB.prepare("SELECT COUNT(*) AS n FROM pim_products p WHERE p.account_id=? AND p.ec_push_status IS NOT NULL AND p.ec_push_status<>'ok'").bind(acct).first();
  const sent = await env.DB.prepare("SELECT COUNT(*) AS n FROM pim_products p WHERE p.account_id=? AND p.ec_push_status='ok'").bind(acct).first();
  const items = await env.DB.prepare('SELECT jan, name, sku, brand, image_count, updated_at, ec_push_at, ec_push_status, ec_push_msg FROM pim_products p WHERE p.account_id=? AND ' + PENDING_SQL + ' ORDER BY p.updated_at LIMIT ?').bind(acct, limit).all();
  const errs = await env.DB.prepare("SELECT jan, name, ec_push_at, ec_push_status, ec_push_msg FROM pim_products p WHERE p.account_id=? AND p.ec_push_status IS NOT NULL AND p.ec_push_status<>'ok' ORDER BY p.ec_push_at DESC LIMIT 100").bind(acct).all();
  const last = await env.DB.prepare('SELECT MAX(ec_push_at) AS at FROM pim_products WHERE account_id=?').bind(acct).first();
  return json({
    ok: true,
    ec: { url: ecBase(a), has_key: ecKeyOk(a.ec_key), auto: !!a.ec_auto },
    pending: pending ? pending.n : 0, failed: failed ? failed.n : 0, sent: sent ? sent.n : 0,
    last: last ? last.at : null, items: items.results || [], errors: errs.results || [],
  });
}

export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id, a = data.account;
  if (data.readonly) return json({ ok: false, reason: 'readonly', message: '連携キーでは送信できません' }, 403);
  if (!ecKeyOk(a.ec_key)) return json({ ok: false, reason: 'no_key', message: 'SalonPro のキーが未設定です。PC の設定タブで「EC（SalonPro）へ写真を送る」のキーを入れてください' }, 400);
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const by = userOf(request) || (data.isAdmin ? 'SEAM' : '');

  let jans = [];
  if (Array.isArray(b.jans) && b.jans.length) {
    jans = b.jans.map((j) => cleanJan(j)).filter(Boolean).slice(0, 50);
  } else if (b.all) {
    const limit = Math.min(50, Math.max(1, parseInt(b.limit, 10) || 20));
    const rs = await env.DB.prepare('SELECT jan FROM pim_products p WHERE p.account_id=? AND ' + PENDING_SQL + ' ORDER BY p.updated_at LIMIT ?').bind(acct, limit).all();
    jans = (rs.results || []).map((r) => r.jan);
  } else return json({ ok: false, reason: 'no_jans', message: '{ jans:[…] } か { all:true } を送ってください' }, 400);
  if (!jans.length) return json({ ok: true, results: [], sent: 0, failed: 0, message: '送るものはありません' });

  const results = await pushJans(env, a, jans, by);
  const okN = results.filter((r) => r.ok).length;
  const skipped = results.filter((r) => r.skipped).length;
  const ng = results.filter((r) => !r.ok && !r.skipped);
  const notFound = ng.filter((r) => r.code === 'product_not_found').length;
  let message = okN + ' 件を SalonPro に送りました';
  if (ng.length) message += '／' + ng.length + ' 件は送れませんでした' + (notFound ? '（' + notFound + ' 件は SalonPro に商品が未登録）' : '');
  if (skipped) message += '／' + skipped + ' 件は写真がまだありません';
  return json({ ok: true, sent: okN, failed: ng.length, skipped, not_found: notFound, results, message });
}

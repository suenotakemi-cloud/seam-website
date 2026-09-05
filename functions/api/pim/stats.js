// 進捗（PC の「進捗」タブ・管理画面・スマホの残数）
//   GET /api/pim/stats → {
//     totals: { products, with_images, no_images, images, full5, retake, open_issues },
//     by_day: [{ day, images, products_first }],     … 直近 14 日
//     by_user: [{ user, today, total }],             … 担当者別（写真の登録数）
//     by_maker: [{ maker, products, with_images }],  … メーカー別の残り
//     pace: { avg_per_day_7, days_left }             … 直近 7 日の平均から残り日数
//   }
import { json } from './_lib.js';

export async function onRequestGet({ env, data }) {
  const acct = data.account.id;
  const today = new Date().toISOString().slice(0, 10);
  const since = new Date(Date.now() - 13 * 86400000).toISOString().slice(0, 10);
  const totals = await env.DB.prepare(
    'SELECT (SELECT COUNT(*) FROM pim_products WHERE account_id=?1) AS products, ' +
    '(SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count>0) AS with_images, ' +
    '(SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count=0) AS no_images, ' +
    '(SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count>=5) AS full5, ' +
    '(SELECT COUNT(*) FROM pim_images WHERE account_id=?1) AS images, ' +
    '(SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review=\'retake\') AS retake, ' +
    '(SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review=\'ok\') AS reviewed_ok, ' +
    '(SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review IS NULL) AS unreviewed, ' +
    '(SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review IS NULL AND quality_warn IS NOT NULL) AS quality_warn, ' +
    '(SELECT COUNT(*) FROM pim_issues WHERE account_id=?1 AND status=\'open\') AS open_issues'
  ).bind(acct).first();
  const byDay = await env.DB.prepare(
    'SELECT substr(created_at,1,10) AS day, COUNT(*) AS images, COUNT(DISTINCT jan) AS products FROM pim_images WHERE account_id=? AND created_at>=? GROUP BY day ORDER BY day'
  ).bind(acct, since).all();
  const byUser = await env.DB.prepare(
    'SELECT COALESCE(created_by,\'(名前なし)\') AS user, SUM(CASE WHEN substr(created_at,1,10)=? THEN 1 ELSE 0 END) AS today, COUNT(*) AS total, COUNT(DISTINCT jan) AS products FROM pim_images WHERE account_id=? GROUP BY user ORDER BY total DESC LIMIT 50'
  ).bind(today, acct).all();
  const byMaker = await env.DB.prepare(
    'SELECT COALESCE(maker,\'\') AS maker, COUNT(*) AS products, SUM(CASE WHEN image_count>0 THEN 1 ELSE 0 END) AS with_images FROM pim_products WHERE account_id=? GROUP BY maker ORDER BY products DESC LIMIT 100'
  ).bind(acct).all();
  // ペース: 直近 7 日で「写真が付いた商品」の数 ÷ 稼働日数
  const week = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
  const pace = await env.DB.prepare(
    'SELECT COUNT(DISTINCT jan) AS products, COUNT(DISTINCT substr(created_at,1,10)) AS days FROM pim_images WHERE account_id=? AND created_at>=?'
  ).bind(acct, week).first();
  const perDay = pace && pace.days ? pace.products / pace.days : 0;
  const daysLeft = perDay > 0 ? Math.ceil((totals.no_images || 0) / perDay) : null;
  return json({ ok: true, today, totals, by_day: byDay.results || [], by_user: byUser.results || [], by_maker: byMaker.results || [], pace: { products_7d: pace ? pace.products : 0, active_days_7d: pace ? pace.days : 0, avg_per_day: Math.round(perDay * 10) / 10, days_left: daysLeft } });
}

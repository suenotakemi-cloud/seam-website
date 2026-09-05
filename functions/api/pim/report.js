// 日報 — 「昨日の写真枚数・担当者別・メーカー別の残り・残り日数」を 1 枚に
//   GET /api/pim/report?day=YYYY-MM-DD（省略時は昨日・日本時間）&format=json|html|text
//   PC「設定」→ 日報で確認できる。毎朝のメール送信は .github/workflows/pim-daily-report.yml（admin/report.js から全ディーラー分を取って送る）
import { json } from './_lib.js';

const JST = 9 * 3600000;
function jstDay(d) { return new Date(d.getTime() + JST).toISOString().slice(0, 10); }
export async function buildReport(env, account, day, origin) {
  const acct = account.id;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day || '')) day = jstDay(new Date(Date.now() - 86400000));
  const from = new Date(Date.parse(day + 'T00:00:00Z') - JST).toISOString(), to = new Date(Date.parse(day + 'T00:00:00Z') - JST + 86400000).toISOString();
  const q = (sql, ...b) => env.DB.prepare(sql).bind(...b);
  const dayStat = await q('SELECT COUNT(*) AS images, COUNT(DISTINCT jan) AS products FROM pim_images WHERE account_id=? AND created_at>=? AND created_at<?', acct, from, to).first();
  const byUser = (await q('SELECT COALESCE(created_by,\'(名前なし)\') AS user, COUNT(*) AS images, COUNT(DISTINCT jan) AS products FROM pim_images WHERE account_id=? AND created_at>=? AND created_at<? GROUP BY user ORDER BY images DESC', acct, from, to).all()).results || [];
  const totals = await q('SELECT (SELECT COUNT(*) FROM pim_products WHERE account_id=?1) AS products, (SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count>0) AS with_images, (SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count=0) AS no_images, (SELECT COUNT(*) FROM pim_products WHERE account_id=?1 AND image_count>=5) AS full5, (SELECT COUNT(*) FROM pim_images WHERE account_id=?1) AS images, (SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review=\'retake\') AS retake, (SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review IS NULL) AS unreviewed, (SELECT COUNT(*) FROM pim_images WHERE account_id=?1 AND review IS NULL AND quality_warn IS NOT NULL) AS quality_warn, (SELECT COUNT(*) FROM pim_issues WHERE account_id=?1 AND status=\'open\') AS open_issues, (SELECT COUNT(*) FROM pim_inbox WHERE account_id=?1 AND status=\'pending\') AS inbox_pending', acct).first();
  const byMaker = (await q('SELECT COALESCE(maker,\'\') AS maker, COUNT(*) AS products, SUM(CASE WHEN image_count>0 THEN 1 ELSE 0 END) AS with_images FROM pim_products WHERE account_id=? GROUP BY maker HAVING products-with_images>0 ORDER BY products-with_images DESC LIMIT 15', acct).all()).results || [];
  const week = new Date(Date.parse(from) - 6 * 86400000).toISOString();
  const pace = await q('SELECT COUNT(DISTINCT jan) AS products, COUNT(DISTINCT substr(created_at,1,10)) AS days FROM pim_images WHERE account_id=? AND created_at>=? AND created_at<?', acct, week, to).first();
  const perDay = pace && pace.days ? pace.products / pace.days : 0;
  const daysLeft = perDay > 0 ? Math.ceil((totals.no_images || 0) / perDay) : null;
  const pct = totals.products ? Math.round(totals.with_images / totals.products * 100) : 0;
  const subject = '[SEAM 商品登録] ' + account.name + ' 日報 ' + day + '：写真 ' + dayStat.images + ' 枚 / ' + dayStat.products + ' 商品（残り ' + totals.no_images + '）';
  const lines = [
    account.name + ' — ' + day + ' の日報',
    '',
    '■ この日: 写真 ' + dayStat.images + ' 枚 / 商品 ' + dayStat.products + ' 点に写真が付きました',
    ...byUser.map((u) => '  ・' + u.user + ': ' + u.images + ' 枚（' + u.products + ' 商品）'),
    '',
    '■ 全体: 商品 ' + totals.products + ' / 写真あり ' + totals.with_images + '（' + pct + '%） / 写真なし ' + totals.no_images + ' / 5枚そろい ' + totals.full5,
    '  未検品 ' + totals.unreviewed + ' / 自動チェック注意 ' + totals.quality_warn + ' / 撮り直し ' + totals.retake + ' / 注意（JAN重複など） ' + totals.open_issues + (totals.inbox_pending ? ' / 受信箱に未処理 ' + totals.inbox_pending : ''),
    '  直近7日の平均 ' + (Math.round(perDay * 10) / 10) + ' 商品/日' + (daysLeft != null ? ' → 残り約 ' + daysLeft + ' 稼働日' : ''),
    '',
    '■ メーカー別の残り（多い順）',
    ...byMaker.map((m) => '  ・' + (m.maker || '（未設定）') + ': 残り ' + (m.products - m.with_images) + ' / ' + m.products),
    '',
    'PC: ' + origin + '/pim/import.html  スマホ: ' + origin + '/pim/',
  ];
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<div style="font-family:sans-serif;font-size:14px;line-height:1.6;color:#2B2926"><h2 style="font-size:16px;margin:0 0 8px">' + esc(account.name) + ' — ' + esc(day) + ' の日報</h2>' +
    '<p style="margin:0 0 10px"><b>この日:</b> 写真 <b>' + dayStat.images + '</b> 枚 / 商品 <b>' + dayStat.products + '</b> 点</p>' +
    (byUser.length ? '<table style="border-collapse:collapse;font-size:13px;margin-bottom:12px">' + byUser.map((u) => '<tr><td style="padding:2px 10px 2px 0">' + esc(u.user) + '</td><td style="padding:2px 10px">' + u.images + ' 枚</td><td style="padding:2px 10px">' + u.products + ' 商品</td></tr>').join('') + '</table>' : '<p style="color:#888">この日の登録はありませんでした</p>') +
    '<p style="margin:0 0 4px"><b>全体:</b> 商品 ' + totals.products + ' / 写真あり ' + totals.with_images + '（' + pct + '%） / 写真なし <b>' + totals.no_images + '</b> / 5枚そろい ' + totals.full5 + '</p>' +
    '<p style="margin:0 0 4px">未検品 ' + totals.unreviewed + ' / 自動チェック注意 ' + totals.quality_warn + ' / 撮り直し ' + totals.retake + ' / 注意 ' + totals.open_issues + (totals.inbox_pending ? ' / 受信箱に未処理 <b>' + totals.inbox_pending + '</b>' : '') + '</p>' +
    '<p style="margin:0 0 12px">直近7日の平均 ' + (Math.round(perDay * 10) / 10) + ' 商品/日' + (daysLeft != null ? ' → 残り約 <b>' + daysLeft + '</b> 稼働日' : '') + '</p>' +
    '<p style="margin:0 0 4px"><b>メーカー別の残り</b></p><table style="border-collapse:collapse;font-size:13px;margin-bottom:12px">' + byMaker.map((m) => '<tr><td style="padding:2px 10px 2px 0">' + esc(m.maker || '（未設定）') + '</td><td style="padding:2px 10px">残り ' + (m.products - m.with_images) + ' / ' + m.products + '</td></tr>').join('') + '</table>' +
    '<p style="font-size:12px;color:#888">PC: <a href="' + esc(origin) + '/pim/import.html">' + esc(origin) + '/pim/import.html</a>　スマホ: <a href="' + esc(origin) + '/pim/">' + esc(origin) + '/pim/</a></p></div>';
  return { day, subject, text: lines.join('\n'), html, day_stat: dayStat, by_user: byUser, totals, by_maker: byMaker, pace: { avg_per_day: Math.round(perDay * 10) / 10, days_left: daysLeft } };
}

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const rep = await buildReport(env, data.account, url.searchParams.get('day') || '', url.origin);
  const fmt = url.searchParams.get('format') || 'json';
  if (fmt === 'html') return new Response(rep.html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  if (fmt === 'text') return new Response(rep.text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });
  return json(Object.assign({ ok: true }, rep));
}

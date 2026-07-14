/**
 * SEAM 銀座 — Square バックエンド（Cloudflare Worker）
 *
 * ルート:
 *   POST /pay    … カードトークンを受け取り Square Payments API で課金（前金/デポジット）
 *   GET  /sales  … 期間内の「スタッフ別売上」を集計して返す（Square POS → シフトアプリ連携用）
 *
 * Access Token（秘密鍵）はここ(サーバー側)だけで使う。フロントには絶対に置かない。
 *
 * シークレット / 変数（README.md 参照）:
 *   SQUARE_ACCESS_TOKEN  … Access Token（秘密）  `wrangler secret put SQUARE_ACCESS_TOKEN`
 *   SQUARE_ENV           … 'sandbox' か 'production'（wrangler.toml [vars]）
 *   SQUARE_LOCATION_ID   … 集計対象の店舗ID（公開OK・[vars]）※/sales で使用
 *   ALLOW_ORIGIN         … CORS許可オリジン（未設定なら '*'）
 */

const SQUARE_VERSION = '2025-01-23';

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url);
    if (url.pathname.endsWith('/pay') && request.method === 'POST') return handlePay(request, env, cors);
    if (url.pathname.endsWith('/sales') && request.method === 'GET') return handleSales(url, env, cors);
    if (url.pathname.endsWith('/line/push') && request.method === 'POST') return handleLinePush(request, env, cors);
    if (url.pathname.endsWith('/line/reminders') && request.method === 'POST') return handleLineReminders(request, env, cors);
    return json({ error: 'Not found' }, 404, cors);
  },

  // 前日リマインドの自動送信（Cloudflare Cron Triggers）。
  // wrangler.toml の [triggers] crons を有効化し、明日の予約を D1 等から読んで push する。
  async scheduled(event, env, ctx) {
    // 例: const rows = await env.DB.prepare("SELECT ... WHERE date = ? AND lineUserId != ''").bind(tomorrow).all();
    //     for (const r of rows.results) await linePush(env, r.lineUserId, buildLineMessage('reminder', r));
    // D1 接続後に実装。今は no-op。
  },
};

function apiBase(env) {
  return (env.SQUARE_ENV === 'production')
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}
function sqHeaders(env) {
  return {
    'Authorization': 'Bearer ' + env.SQUARE_ACCESS_TOKEN,
    'Square-Version': SQUARE_VERSION,
    'Content-Type': 'application/json',
  };
}

/* ---------- POST /pay : 課金 ---------- */
async function handlePay(request, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  const { sourceId, verificationToken, amount, currency } = payload || {};
  if (!sourceId || !amount) return json({ error: 'sourceId と amount は必須です' }, 400, cors);

  const body = {
    source_id: sourceId,
    idempotency_key: crypto.randomUUID(),
    amount_money: { amount: Math.round(amount), currency: currency || 'JPY' },
  };
  if (verificationToken) body.verification_token = verificationToken;

  try {
    const r = await fetch(apiBase(env) + '/v2/payments', {
      method: 'POST', headers: sqHeaders(env), body: JSON.stringify(body),
    });
    const sq = await r.json();
    if (!r.ok) {
      const msg = (sq.errors && sq.errors[0] && sq.errors[0].detail) || ('Square API ' + r.status);
      return json({ error: msg }, 502, cors);
    }
    return json({ ok: true, paymentId: sq.payment && sq.payment.id, status: sq.payment && sq.payment.status }, 200, cors);
  } catch (e) {
    return json({ error: 'Square API 呼び出しに失敗: ' + e.message }, 502, cors);
  }
}

/* ---------- GET /sales : スタッフ別売上 ---------- */
// 例) /sales?from=2026-07-13&to=2026-07-13  （省略時は当日・JST）
async function handleSales(url, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
  const locationId = url.searchParams.get('location') || env.SQUARE_LOCATION_ID;
  if (!locationId) return json({ error: 'location（SQUARE_LOCATION_ID）が未設定です' }, 400, cors);

  const from = url.searchParams.get('from'); // YYYY-MM-DD
  const to = url.searchParams.get('to') || from;
  if (!from) return json({ error: 'from（YYYY-MM-DD）は必須です' }, 400, cors);
  const beginTime = `${from}T00:00:00+09:00`;
  const endTime = `${to}T23:59:59+09:00`;

  try {
    // 1) 期間内の決済を全件取得（ページング）してスタッフ別に合計
    const totals = {}; // teamMemberId -> { amount, count }
    let cursor = '';
    do {
      const qs = new URLSearchParams({
        location_id: locationId, begin_time: beginTime, end_time: endTime,
        sort_order: 'ASC', limit: '100',
      });
      if (cursor) qs.set('cursor', cursor);
      const r = await fetch(apiBase(env) + '/v2/payments?' + qs.toString(), { headers: sqHeaders(env) });
      const data = await r.json();
      if (!r.ok) {
        const msg = (data.errors && data.errors[0] && data.errors[0].detail) || ('Square API ' + r.status);
        return json({ error: msg }, 502, cors);
      }
      for (const p of (data.payments || [])) {
        if (p.status && !['COMPLETED', 'APPROVED', 'CAPTURED'].includes(p.status)) continue;
        const key = p.team_member_id || 'unassigned';
        const amt = (p.amount_money && p.amount_money.amount) || 0;
        totals[key] = totals[key] || { amount: 0, count: 0 };
        totals[key].amount += amt;
        totals[key].count += 1;
      }
      cursor = data.cursor || '';
    } while (cursor);

    // 2) スタッフ名を取得（team_member_id -> 氏名）
    const names = await teamMemberNames(env);

    // 3) 整形して返す
    const staff = Object.entries(totals).map(([id, v]) => ({
      teamMemberId: id,
      name: id === 'unassigned' ? '担当者なし' : (names[id] || id),
      totalSales: v.amount,   // JPYは最小単位=円なのでそのまま円
      count: v.count,
    })).sort((a, b) => b.totalSales - a.totalSales);

    const total = staff.reduce((s, x) => s + x.totalSales, 0);
    return json({ ok: true, from, to, currency: 'JPY', total, staff }, 200, cors);
  } catch (e) {
    return json({ error: 'Square API 呼び出しに失敗: ' + e.message }, 502, cors);
  }
}

async function teamMemberNames(env) {
  const map = {};
  try {
    const r = await fetch(apiBase(env) + '/v2/team-members/search', {
      method: 'POST', headers: sqHeaders(env), body: JSON.stringify({ limit: 200 }),
    });
    const data = await r.json();
    for (const m of (data.team_members || [])) {
      map[m.id] = [m.given_name, m.family_name].filter(Boolean).join(' ') || m.email_address || m.id;
    }
  } catch { /* 名前が取れなくてもIDで返す */ }
  return map;
}

/* ---------- LINE Messaging API（予約確認・リマインド） ---------- */
const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push';

function buildLineMessage(type, r) {
  const dt = (r.date || '').replace(/-/g, '/');
  const salon = r.salon || 'SEAM 銀座';
  const body = `${dt} ${r.time || ''}〜\nメニュー: ${r.menu || ''}\n担当: ${r.staff || ''}`;
  if (type === 'reminder') return `【${salon}】明日のご予約のリマインドです\n\n${body}\n\nお気をつけてお越しください。`;
  if (type === 'thanks')   return `【${salon}】本日はご来店ありがとうございました。\nまたのお越しをお待ちしております。${r.bookUrl ? '\n次回のご予約 → ' + r.bookUrl : ''}`;
  return `【${salon}】ご予約ありがとうございます\n\n${body}\n\nご来店をお待ちしております。${r.manageUrl ? '\n変更・キャンセル → ' + r.manageUrl : ''}`;
}

async function linePush(env, userId, text) {
  return fetch(LINE_PUSH_URL, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.LINE_CHANNEL_ACCESS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
  });
}

async function handleLinePush(request, env, cors) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です' }, 500, cors);
  let p; try { p = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  const { userId, type, reservation, text } = p || {};
  if (!userId) return json({ error: 'userId は必須です' }, 400, cors);
  const msg = text || buildLineMessage(type || 'confirm', reservation || {});
  try {
    const res = await linePush(env, userId, msg);
    if (!res.ok) return json({ error: 'LINE API ' + res.status + ': ' + (await res.text()) }, 502, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) { return json({ error: 'LINE push失敗: ' + e.message }, 502, cors); }
}

// 一括リマインド: { reservations:[{userId,date,time,menu,staff}] } を受けて push（cron から呼ぶ想定）
async function handleLineReminders(request, env, cors) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return json({ error: 'LINE_CHANNEL_ACCESS_TOKEN が未設定です' }, 500, cors);
  let p; try { p = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  const list = (p && p.reservations) || [];
  let sent = 0, failed = 0;
  for (const r of list) {
    if (!r.userId) continue;
    try { (await linePush(env, r.userId, buildLineMessage('reminder', r))).ok ? sent++ : failed++; }
    catch { failed++; }
  }
  return json({ ok: true, sent, failed }, 200, cors);
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(cors || {}) },
  });
}

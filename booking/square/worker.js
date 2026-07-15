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

import PostalMime from 'postal-mime';   // HPBメールのMIME/日本語解析（npm install postal-mime）
import { EmailMessage } from 'cloudflare:email';   // オーナー通知（SEND_EMAILバインド・宛先はwrangler.tomlのdestination_address）

const SQUARE_VERSION = '2025-01-23';
const OWNER_FROM = 'yoyaku@seam.site';   // 送信元（seam.siteドメイン）
const OWNER_TO = 'suenotakemi@gmail.com';// 通知先（SEND_EMAILの検証済み宛先）

// オーナーのGmailへ通知メール（Cloudflare SEND_EMAIL・自分の検証済み宛先のみ送信可）
async function notifyOwner(env, subject, text) {
  if (!env.SEND_EMAIL) return;
  const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  const raw = [
    `From: SEAM 予約 <${OWNER_FROM}>`, `To: ${OWNER_TO}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `Message-ID: <${crypto.randomUUID()}@seam.site>`,
    `MIME-Version: 1.0`, `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`, ``, b64(text),
  ].join('\r\n');
  try { await env.SEND_EMAIL.send(new EmailMessage(OWNER_FROM, OWNER_TO, raw)); }
  catch (e) { console.log('notifyOwner失敗:', e.message); }
}

// 予約データ用: 台帳スタッフ・メニュー（アプリと同一）。メール取込のマッピングに使用。
const STAFF = [
  { id: 's1', name: '及川 大輝' }, { id: 's2', name: 'ANZU' }, { id: 's3', name: 'CHIKA' },
];
const MENUS = [
  { id: 'm1', name: 'カット', min: 60 }, { id: 'm2', name: 'カット + カラー', min: 150 },
  { id: 'm3', name: 'カット + パーマ', min: 150 }, { id: 'm4', name: '縮毛矯正', min: 180 },
  { id: 'm5', name: 'ヘッドスパ 60分', min: 60 }, { id: 'm6', name: 'ヘッドスパ 90分', min: 90 },
];

export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url), p = url.pathname, m = request.method;
    if (p.endsWith('/pay') && m === 'POST') return handlePay(request, env, cors);
    if (p.endsWith('/sales') && m === 'GET') return handleSales(url, env, cors);
    if (p.endsWith('/line/push') && m === 'POST') return handleLinePush(request, env, cors);
    if (p.endsWith('/line/reminders') && m === 'POST') return handleLineReminders(request, env, cors);
    if (p.endsWith('/mail/confirm') && m === 'POST') return handleMailConfirm(request, env, cors);
    // 予約データAPI（D1永続化）
    if (p.endsWith('/reservations') && m === 'GET') return handleGetReservations(url, env, cors);
    if (p.endsWith('/reservations') && m === 'POST') return handlePostReservation(request, env, cors);
    if (p.endsWith('/reservations') && m === 'PATCH') return handlePatchReservation(request, env, cors);
    if (p.endsWith('/reservations') && m === 'DELETE') return handleDeleteReservation(url, env, cors);
    return json({ error: 'Not found' }, 404, cors);
  },

  // 前日リマインドの自動送信（Cloudflare Cron Triggers）。明日の予約でlineUserIdがあるものにpush。
  async scheduled(event, env, ctx) {
    if (!env.DB || !env.LINE_CHANNEL_ACCESS_TOKEN) return;
    const t = new Date(event.scheduledTime + 24 * 3600 * 1000);
    const tomorrow = `${t.getUTCFullYear()}-${z(t.getUTCMonth() + 1)}-${z(t.getUTCDate())}`;
    const rows = await env.DB.prepare(
      "SELECT * FROM reservations WHERE date = ? AND line_user_id != '' AND status != 'cancelled'"
    ).bind(tomorrow).all();
    for (const r of (rows.results || [])) {
      await linePush(env, r.line_user_id, buildLineMessage('reminder', {
        date: r.date, time: min2hm(r.start), menu: r.menu_id, staff: r.staff_id, salon: 'SEAM 銀座',
      }));
    }
  },

  // HPB予約通知メールの自動取込（Cloudflare Email Routing → このWorkerへ転送）。
  // MIME/日本語エンコード解析は postal-mime（`npm install` 必要・README参照）。
  async email(message, env, ctx) {
    console.log('EMAIL受信 from=', message.from, 'to=', message.to);   // 診断用ログ
    try {
      const parsed = await new PostalMime().parse(message.raw);
      const text = parsed.text || (parsed.html || '').replace(/<[^>]+>/g, ' ');
      console.log('本文長=', text.length, 'DB=', !!env.DB);
      const r = parseSalonBoard(text);
      console.log('パース結果=', r ? `${r.name} ${r.date} ${r.start}` : 'null（解析失敗）');
      if (r && env.DB) {
        await env.DB.prepare(
          `INSERT OR IGNORE INTO reservations (id,date,staff_id,start,end,menu_id,name,phone,email,note,channel,status,hpb_blocked,deposit,line_user_id,created_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        ).bind(r.id, r.date, r.staffId, r.start, r.end, r.menuId, r.name, '', '', r.note, 'hpb', 'booked', 1, 0, '', new Date().toISOString()).run();
        console.log('D1へINSERT完了 id=', r.id);
        // オーナーへ通知（HPB予約が入った）
        await notifyOwner(env, `新規HPB予約 ${r.name}様 ${r.date.slice(5)} ${min2hm(r.start)}`,
          `HOT PEPPERから予約が入りました。\n\n日時: ${r.date.replace(/-/g, '/')} ${min2hm(r.start)}〜\nお客様: ${r.name}\n${r.note}`);
      }
    } catch (e) { console.log('EMAIL処理エラー:', e.message); }
    // スタッフの受信箱にも転送（send_email バインディング経由）
    try { if (env.SEND_EMAIL) await message.forward(env.FORWARD_TO || 'suenotakemi@gmail.com', env.SEND_EMAIL); } catch (e) {
      console.log('転送エラー:', e.message);
    }
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

/* ---------- 予約データAPI（D1永続化） ---------- */
const R2API = r => ({   // D1行 → アプリ形式
  id: r.id, date: r.date, staffId: r.staff_id, start: r.start, end: r.end, menuId: r.menu_id,
  name: r.name, phone: r.phone, email: r.email, note: r.note, channel: r.channel,
  status: r.status, hpbBlocked: !!r.hpb_blocked, deposit: r.deposit, lineUserId: r.line_user_id, createdAt: r.created_at,
});

async function handleGetReservations(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  const from = url.searchParams.get('from'), to = url.searchParams.get('to') || from;
  let q, res;
  if (from) { q = env.DB.prepare('SELECT * FROM reservations WHERE date BETWEEN ? AND ? ORDER BY date,start').bind(from, to); }
  else { q = env.DB.prepare('SELECT * FROM reservations ORDER BY date,start'); }
  res = await q.all();
  return json({ ok: true, reservations: (res.results || []).map(R2API) }, 200, cors);
}

async function handlePostReservation(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.date || !o.staffId || o.start == null) return json({ error: 'date/staffId/start は必須' }, 400, cors);
  // ダブルブッキング判定（キャンセル以外の同一スタッフ・時間重複）
  const clash = await env.DB.prepare(
    "SELECT id,name,start FROM reservations WHERE date=? AND staff_id=? AND status!='cancelled' AND ? < end AND ? > start LIMIT 1"
  ).bind(o.date, o.staffId, o.start, o.end).first();
  if (clash) return json({ ok: false, conflict: { name: clash.name, start: clash.start } }, 409, cors);
  const id = o.id || ('r' + crypto.randomUUID().slice(0, 8));
  await env.DB.prepare(
    `INSERT INTO reservations (id,date,staff_id,start,end,menu_id,name,phone,email,note,channel,status,hpb_blocked,deposit,line_user_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, o.date, o.staffId, o.start, o.end, o.menuId || '', o.name || 'お客様', o.phone || '', o.email || '', o.note || '',
    o.channel || 'own', o.status || 'booked', o.channel === 'hpb' ? 1 : (o.hpbBlocked ? 1 : 0), o.deposit || 0, o.lineUserId || '', new Date().toISOString()).run();
  // オンライン予約（お客様導線）のみオーナー通知。管理側の手動登録は notify を付けない。
  if (o.notify) {
    const ch = { own: '自社サイト', line: 'LINE', google: 'Google', instagram: 'Instagram' }[o.channel] || o.channel;
    await notifyOwner(env, `新規ネット予約 ${o.name || 'お客様'} ${(o.date || '').slice(5)}`,
      `${ch}から予約が入りました。\n\n日時: ${(o.date || '').replace(/-/g, '/')} ${min2hm(o.start)}〜\nお客様: ${o.name || ''}${o.phone ? '（' + o.phone + '）' : ''}`);
  }
  return json({ ok: true, id }, 200, cors);
}

async function handlePatchReservation(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.id) return json({ error: 'id は必須' }, 400, cors);
  const sets = [], vals = [];
  if (o.status !== undefined) { sets.push('status=?'); vals.push(o.status); }
  if (o.hpbBlocked !== undefined) { sets.push('hpb_blocked=?'); vals.push(o.hpbBlocked ? 1 : 0); }
  if (o.note !== undefined) { sets.push('note=?'); vals.push(o.note); }
  if (!sets.length) return json({ error: '更新項目なし' }, 400, cors);
  vals.push(o.id);
  await env.DB.prepare(`UPDATE reservations SET ${sets.join(',')} WHERE id=?`).bind(...vals).run();
  return json({ ok: true }, 200, cors);
}

async function handleDeleteReservation(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id は必須' }, 400, cors);
  await env.DB.prepare('DELETE FROM reservations WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}

/* ---------- HOT PEPPER「SALON BOARD」通知メールのパーサ ---------- */
function parseSalonBoard(raw) {
  const sb = label => { const m = raw.match(new RegExp('■' + label + '[^\\n]*\\n[\\s　]*([^\\n]+)')); return m ? m[1].trim() : ''; };
  const nameRaw = sb('氏名');
  const name = nameRaw.replace(/[（(][^)）]*[)）]\s*$/, '').replace(/\s*様\s*$/, '').trim();
  const dtStr = sb('来店日時');
  const dt = dtStr.match(/(\d{4})[年\/](\d{1,2})[月\/](\d{1,2})日?[^\d]*(\d{1,2}):(\d{2})/);
  if (!dt || !name) return null;
  const stylist = sb('スタイリスト'), menuName = sb('メニュー'), resNo = sb('予約番号');
  const dm = raw.match(/施術時間目安[：:]?\s*(?:(\d+)\s*時間)?\s*(?:(\d+)\s*分)?/);
  const menu = MENUS.filter(m => menuName.includes(m.name)).sort((a, b) => b.name.length - a.name.length)[0] || MENUS[0];
  const dur = (dm && (+dm[1] || +dm[2])) ? ((+dm[1] || 0) * 60 + (+dm[2] || 0)) : menu.min;
  const sname = stylist.replace(/\s/g, '');
  let staff = STAFF.find(s => sname && (sname.includes(s.name.split(' ')[0]) || s.name.replace(/\s/g, '').includes(sname)));
  if (!staff) staff = STAFF[0];
  const start = (+dt[4]) * 60 + (+dt[5]);
  const date = `${dt[1]}-${z(+dt[2])}-${z(+dt[3])}`;
  const note = [resNo && ('予約番号 ' + resNo), stylist && ('HPB担当 ' + stylist), menuName].filter(Boolean).join(' / ');
  return { id: 'r' + crypto.randomUUID().slice(0, 8), date, staffId: staff.id, start, end: start + dur, menuId: menu.id, name, note };
}

const z = n => String(n).padStart(2, '0');
const min2hm = m => `${z(Math.floor(m / 60))}:${z(m % 60)}`;

/* ---------- 予約完了メール（Resend経由・LINE以外/海外客向け） ---------- */
async function handleMailConfirm(request, env, cors) {
  if (!env.RESEND_API_KEY) return json({ error: 'RESEND_API_KEY が未設定です' }, 500, cors);
  let p; try { p = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  const { to, reservation } = p || {};
  if (!to) return json({ error: 'to は必須です' }, 400, cors);
  const r = reservation || {};
  const salon = r.salon || 'SEAM 銀座';
  const subject = `【${salon}】ご予約ありがとうございます`;
  const text = `${salon} をご予約いただきありがとうございます。\n\n`
    + `■ご予約内容\n日時: ${(r.date || '').replace(/-/g, '/')} ${r.time || ''}〜\nメニュー: ${r.menu || ''}\n担当: ${r.staff || ''}\n`
    + (r.total ? `お支払い予定: ¥${Number(r.total).toLocaleString()}\n` : '')
    + `\nご来店をお待ちしております。\n変更・キャンセルは前日までにご連絡ください。`;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'SEAM <onboarding@resend.dev>', to, subject, text }),
    });
    if (!res.ok) return json({ error: 'メール送信失敗: ' + (await res.text()) }, 502, cors);
    return json({ ok: true }, 200, cors);
  } catch (e) { return json({ error: 'メール送信エラー: ' + e.message }, 502, cors); }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...(cors || {}) },
  });
}

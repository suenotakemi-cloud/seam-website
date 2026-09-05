// 担当者（スタッフ）一覧と PIN — 名前の打ち間違いで進捗が割れないよう、登録した名前をタップして選ぶ
//   GET  /api/pim/staff                     → { staff:[{id,name,has_pin,active}], required }  required = 一覧があるので名前は一覧から選ぶ
//   POST /api/pim/staff { action, ... }
//        add     { name, pin? }             … 追加（pin は 4〜6 桁の数字・任意）
//        pin     { id, pin }                … PIN を設定／変更（空なら PIN なしに）
//        rename  { id, name }
//        disable { id } / enable { id }     … 退職など（過去の記録は残る）
//        delete  { id }                     … 完全に消す
//        verify  { id, pin }                → { staff_token }  … スマホ・PC で名前を選んだときの本人確認。以後 x-seam-staff ヘッダで送る
//   一覧に 1 人でも登録があると、書き込み系 API は「一覧にある名前」からしか受け付けない（_middleware.js）。PIN 付きの人は staff_token も必要
import { json, nowIso, hashPassword, verifyPassword, signStaff, userOf } from './_lib.js';

const MAX_FAIL = 8, LOCK_MIN = 10;
function pinProblem(pin) { const s = String(pin == null ? '' : pin).trim(); if (!s) return ''; if (!/^[0-9]{4,6}$/.test(s)) return 'PIN は 4〜6 桁の数字にしてください'; return ''; }
export function publicStaff(r) { return { id: r.id, name: r.name, has_pin: !!r.pin_hash, active: !!r.active, created_at: r.created_at }; }

export async function onRequestGet({ env, data }) {
  const rs = await env.DB.prepare('SELECT * FROM pim_staff WHERE account_id=? ORDER BY active DESC, name').bind(data.account.id).all();
  const list = (rs.results || []).map(publicStaff);
  return json({ ok: true, staff: list, required: list.some((s) => s.active) });
}

export async function onRequestPost({ request, env, data }) {
  const acct = data.account.id;
  if (data.readonly) return json({ ok: false, reason: 'readonly' }, 403);
  const b = await request.json().catch(() => null);
  if (!b || typeof b !== 'object') return json({ ok: false, reason: 'bad_json' }, 400);
  const action = String(b.action || '');
  const ts = nowIso();
  const name = String(b.name == null ? '' : b.name).replace(/\s+/g, ' ').trim().slice(0, 40);

  if (action === 'add') {
    if (!name) return json({ ok: false, reason: 'no_name', message: '名前を入れてください' }, 400);
    const prob = pinProblem(b.pin); if (prob) return json({ ok: false, reason: 'bad_pin', message: prob }, 400);
    const dup = await env.DB.prepare('SELECT id, active FROM pim_staff WHERE account_id=? AND name=?').bind(acct, name).first();
    if (dup) return json({ ok: false, reason: 'exists', message: '「' + name + '」は既に登録されています' + (dup.active ? '' : '（停止中。再開してください）') }, 409);
    const hash = String(b.pin || '').trim() ? await hashPassword(String(b.pin).trim()) : null;
    const r = await env.DB.prepare('INSERT INTO pim_staff(account_id, name, pin_hash, active, created_at, updated_at) VALUES(?,?,?,1,?,?)').bind(acct, name, hash, ts, ts).run();
    const row = await env.DB.prepare('SELECT * FROM pim_staff WHERE id=?').bind(r.meta.last_row_id).first();
    return json({ ok: true, staff: publicStaff(row) });
  }
  const id = parseInt(b.id, 10);
  if (!id) return json({ ok: false, reason: 'no_id' }, 400);
  const row = await env.DB.prepare('SELECT * FROM pim_staff WHERE id=? AND account_id=?').bind(id, acct).first();
  if (!row) return json({ ok: false, reason: 'not_found' }, 404);

  if (action === 'verify') {
    if (!row.active) return json({ ok: false, reason: 'disabled', message: 'この担当者は停止中です' }, 403);
    if (!row.pin_hash) return json({ ok: true, staff_token: await signStaff(env, acct, row.id), staff: publicStaff(row) }); // PIN なし → 選ぶだけ
    const ip = (request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64);
    const key = ('pin:' + acct + ':' + row.id + '@' + ip).slice(0, 120);
    const f = await env.DB.prepare('SELECT count, last_at FROM pim_login_fail WHERE login_id=?').bind(key).first();
    if (f && f.count >= MAX_FAIL && f.last_at && Date.now() - Date.parse(f.last_at) < LOCK_MIN * 60000) return json({ ok: false, reason: 'locked', message: 'PIN の間違いが続いたため ' + LOCK_MIN + ' 分ほど待ってください' }, 429);
    const okPin = await verifyPassword(String(b.pin || '').trim(), row.pin_hash);
    if (!okPin) {
      await env.DB.prepare('INSERT INTO pim_login_fail(login_id, count, last_at) VALUES(?, 1, ?) ON CONFLICT(login_id) DO UPDATE SET count=count+1, last_at=excluded.last_at').bind(key, ts).run();
      return json({ ok: false, reason: 'bad_pin', message: 'PIN が違います' }, 403); // 401 にするとブラウザ側が「ログイン切れ」と解釈するので 403
    }
    await env.DB.prepare('DELETE FROM pim_login_fail WHERE login_id=?').bind(key).run();
    return json({ ok: true, staff_token: await signStaff(env, acct, row.id), staff: publicStaff(row) });
  }
  if (action === 'pin') {
    const prob = pinProblem(b.pin); if (prob) return json({ ok: false, reason: 'bad_pin', message: prob }, 400);
    const hash = String(b.pin || '').trim() ? await hashPassword(String(b.pin).trim()) : null;
    await env.DB.prepare('UPDATE pim_staff SET pin_hash=?, updated_at=? WHERE id=?').bind(hash, ts, id).run();
    return json({ ok: true, message: hash ? 'PIN を設定しました' : 'PIN を外しました' });
  }
  if (action === 'rename') {
    if (!name) return json({ ok: false, reason: 'no_name' }, 400);
    try { await env.DB.prepare('UPDATE pim_staff SET name=?, updated_at=? WHERE id=?').bind(name, ts, id).run(); }
    catch (e) { return json({ ok: false, reason: 'exists', message: 'その名前は既にあります' }, 409); }
    return json({ ok: true });
  }
  if (action === 'disable' || action === 'enable') {
    await env.DB.prepare('UPDATE pim_staff SET active=?, updated_at=? WHERE id=?').bind(action === 'enable' ? 1 : 0, ts, id).run();
    return json({ ok: true });
  }
  if (action === 'delete') {
    await env.DB.prepare('DELETE FROM pim_staff WHERE id=?').bind(id).run();
    return json({ ok: true });
  }
  return json({ ok: false, reason: 'bad_action' }, 400);
}

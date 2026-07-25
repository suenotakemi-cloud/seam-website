/* ---------- salon.town(CUEPON SaaS)予約API ブリッジ ----------
 * 自社予約(D1)を「正」とし、salon.town の予約APIへサーバ側から同期する(SyncProvider=salon)。
 * ブラウザ直叩きはCORS(別ルートドメイン)で不可のため、必ずこのWorker経由で通信する。
 * 設定(wrangler.toml [vars]): SALON_SYNC('on'で有効) / SALON_HOST / SALON_SHOP_ID / SALON_ACCOUNT_ID(任意)
 * 認証: SALON_LOGIN_ID+SALON_PASS(secret)。未設定なら空ログイン(testテナントのみ有効)。token TTL24h。
 * 罠: 日付絞りは reserve_date_start/end（from_date/to_dateは黙って無視）・endは" 23:59"必須・
 *     削除は reservation_id をparams直下。詳細は salon-town/docs/TRAPS.md */
import { json, min2hm } from './util.js';

let _salonTok = null;   // { uid, token, exp } モジュールスコープで簡易キャッシュ
export async function salonToken(env) {
  if (!env.SALON_HOST) throw new Error('SALON_HOST未設定');
  if (_salonTok && _salonTok.exp > Date.now()) return _salonTok;
  // メールアドレス型は mail フィールドで送る（login_idだと not_found_account になる・2026-07-20実証）
  const body = env.SALON_LOGIN_ID
    ? (env.SALON_LOGIN_ID.includes('@')
        ? { mail: env.SALON_LOGIN_ID, pass: env.SALON_PASS || '' }
        : { login_id: env.SALON_LOGIN_ID, pass: env.SALON_PASS || '' })
    : {};
  const res = await fetch(env.SALON_HOST + '/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const j = await res.json();
  const d = j && j.data;
  if (!j.result || !d || !d.token) throw new Error('salon login失敗: ' + ((j && j.msg) || res.status));
  _salonTok = { uid: d.id, token: d.token, exp: Date.now() + 23 * 3600 * 1000 };
  return _salonTok;
}

export async function salonCall(env, path, extra) {
  const t = await salonToken(env);
  const res = await fetch(env.SALON_HOST + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: t.uid, token: t.token, ...extra }),
  });
  return res.json();
}

// 自社予約 → salon.town /save/reservation。返り値 { salonId, reserveNum }
// ★確定パラメータ: account_id=スタイリスト/from_account_id=顧客(直感と逆)、個人情報はprivate_js(暗号化)、info_jsは平文で個人情報禁止。
// ★メニュー(item/クーポン)は送らない(2026-07-27): 名称一致でRPA書込がエラーになるため。RPAは指名/フリー・時間・所要時間・氏名カナだけで予約する。
export async function salonPush(env, r) {
  if (!env.SALON_SHOP_ID) throw new Error('SALON_SHOP_ID未設定');
  const t = await salonToken(env);
  const h2k = (s) => (s || '').replace(/[ぁ-ゖ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  const nm = (r.name || '').trim();                // 「姓 名」
  const kn = h2k((r.kana || '').trim());           // 「セイ メイ」（HotPepperゲストフォーム形式）
  const dur = r.menuMin || (r.end != null && r.start != null ? r.end - r.start : 60);  // 所要時間(分)
  // ★スパ予約はSPA店へ振り分け（ANZUはヘア/スパで別account）。r.spaはページが判定
  const shopId = (r.spa && env.SALON_SPA_SHOP_ID) ? env.SALON_SPA_SHOP_ID : env.SALON_SHOP_ID;
  const stylist = r.staffCu || null;               // スタイリストのCUEPON account_id（スパはcuSpa）
  const nominated = r.nominated !== false;         // 既定=指名。フリーのみ false を明示
  // ★メニュー(item/クーポン)は送らない＝名称一致でエラーになるため（2026-07-27オーナー指示）。
  //   RPAは「指名/フリー・開始時間・所要時間・氏名カナ」だけでサロンボードの予約ボタンを押せる（メニュー欄は任意）
  const data = {
    type: 'shop',
    status: 'pending',
    shop_id: shopId,
    // ★RPAはこの name 欄をサロンボードの顧客名欄へ転記する（メール取込と同形式「姓 名（セイ メイ）」）
    name: kn ? `${nm}（${kn}）` : nm,
    account_id: stylist,                            // ★担当スタイリスト（枠を占有・指名/フリーとも設定）
    from_account_id: env.SALON_ACCOUNT_ID || t.uid, // ★予約する顧客
    input_account_id: t.uid, last_input_account_id: t.uid,
    reserve_date: `${r.date} ${min2hm(r.start)}`,          // 開始時間
    reserve_end_date: `${r.date} ${min2hm(r.end)}`,        // 開始＋所要時間＝終了
    order_limit_date: `${r.date} ${min2hm(r.start)}`,
    required_order: false,
    check_slot_conflict: true,                      // 自枠＋掛け持ちの重複をサーバ拒否（ダブルブッキング防止）
    exclude_overlaps: false,
    info_js: {                                      // RPAが読む: 指名/フリー・所要時間・担当。メニューは含めない（照合不要）
      staff_id: stylist || '', staff_name: r.hbpStylistName || '', duration_min: dur,
      hbp_stylist_id: r.hbpStylistId || '',         // = account.code（サロンボードのスタイリスト選択用）
      nominated: nominated,                          // true=指名予約 / false=フリー
      menu_label: r.menuName || '',                  // 表示用の控えのみ（サロンボード書込の照合には使わない）
      channel: r.channel || 'own', src: 'seam-booking',
    },
    private_js: {                                   // サーバ側で暗号化保存・個人情報はすべてここ
      customer_name: nm,                            // 姓 名
      customer_kana: kn,                            // セイ メイ（HotPepperゲスト予約フォーム用）
      phone: r.phone || '', mail: r.email || '',
    },
  };
  const j = await salonCall(env, '/save/reservation', { data });
  if (!j.result) throw new Error('salon予約作成失敗: ' + (j.msg || ''));
  const made = (j.data || [])[0] || {};
  return { salonId: made.id, reserveNum: made.reserve_num };
}

// salon.town 予約をキャンセル(cancel:true → cancel_date セット。shop権限でも可)
// ※status列の切替はサロン権限アカウントが必要(エンジニア確認・2026-07-16)。cancel_dateは付く。
export async function salonCancel(env, salonId) {
  return salonCall(env, '/save/reservation', { cancel: true, data: { ids: [salonId] } });
}

// salon.town 予約を削除(実APIは reservation_id を params直下に要求)
export async function salonDelete(env, salonId) {
  const t = await salonToken(env);
  const res = await fetch(env.SALON_HOST + '/delete/reservation', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: t.uid, token: t.token, reservation_id: salonId }),
  });
  return res.json();
}

// GET /salon/pull?from=YYYY-MM-DD&to=YYYY-MM-DD … salon.town の予約を読み取り
export async function handleSalonPull(url, env, cors) {
  if (!env.SALON_HOST || !env.SALON_SHOP_ID) return json({ error: 'SALON_HOST/SALON_SHOP_ID未設定' }, 500, cors);
  const from = url.searchParams.get('from'), to = url.searchParams.get('to') || from;
  try {
    // 罠T2/T3修正: reserve_date_start/end が正・endは23:59まで（旧from_date/to_dateは黙って無視されていた）
    const j = await salonCall(env, '/get/reservation', {
      filter: { shop_id: env.SALON_SHOP_ID, reserve_date_start: from, reserve_date_end: to + ' 23:59' },
      add_staff: true, limit: 200,
    });
    const list = (j.data || []).filter(r => !r.delete_date).map(r => ({
      salonId: r.id, reserveNum: r.reserve_num, date: (r.reserve_date || '').slice(0, 10),
      start: r.reserve_date, end: r.reserve_end_date, status: r.status, name: r.name,
      staffId: r.staff_account_id || '',
    }));
    return json({ ok: true, count: list.length, reservations: list }, 200, cors);
  } catch (e) { return json({ error: 'salon pull失敗: ' + e.message }, 502, cors); }
}

// GET /salon/whoami … 認証アカウントの権限・所属・見える店舗数（診断用・秘匿情報は返さない）
export async function handleSalonWhoami(env, cors) {
  if (!env.SALON_HOST) return json({ error: 'SALON_HOST未設定' }, 500, cors);
  try {
    const body = env.SALON_LOGIN_ID
      ? (env.SALON_LOGIN_ID.includes('@')
          ? { mail: env.SALON_LOGIN_ID, pass: env.SALON_PASS || '' }
          : { login_id: env.SALON_LOGIN_ID, pass: env.SALON_PASS || '' })
      : {};
    const res = await fetch(env.SALON_HOST + '/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await res.json();
    const d = j && j.data;
    if (!j.result || !d) return json({ ok: false, error: 'login失敗' }, 502, cors);
    const shopsRes = await fetch(env.SALON_HOST + '/get/shop', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: d.id, token: d.token, limit: 200 }) });
    const shops = ((await shopsRes.json()).data || []).filter(s => !s.delete_date);
    return json({ ok: true, uid: d.id, permission: d.permission, affiliated_shop: d.affilicated_shop_id || null,
      shops_visible: shops.length, shop_names: shops.slice(0, 20).map(s => s.name || s.open_name) }, 200, cors);
  } catch (e) { return json({ ok: false, error: e.message }, 502, cors); }
}

// POST /salon/selftest … login→作成→取得→削除の疎通確認(デプロイ後に本番Workerから叩いて検証)
export async function handleSalonSelftest(env, cors) {
  if (!env.SALON_HOST || !env.SALON_SHOP_ID) return json({ error: 'SALON_HOST/SALON_SHOP_ID未設定' }, 500, cors);
  const steps = [];
  try {
    const t = await salonToken(env); steps.push({ login: !!t.token, uid: t.uid });
    const pushed = await salonPush(env, { date: '2026-07-20', start: 18 * 60, end: 20 * 60, name: 'Worker疎通テスト', channel: 'own' });
    steps.push({ create: pushed });
    // 罠T2/T3修正: 正しい日付キーで当日取得できることを検証（旧キーだと全期間が返り偽陽性だった）
    const j = await salonCall(env, '/get/reservation', {
      filter: { shop_id: env.SALON_SHOP_ID, reserve_date_start: '2026-07-20', reserve_date_end: '2026-07-20 23:59' }, limit: 200,
    });
    const found = (j.data || []).some(r => r.id === pushed.salonId); steps.push({ get_found: found });
    const del = await salonDelete(env, pushed.salonId); steps.push({ delete: del.result });
    return json({ ok: true, steps }, 200, cors);
  } catch (e) { return json({ ok: false, error: e.message, steps }, 502, cors); }
}

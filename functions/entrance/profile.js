// SEAM 顧客カルテ — プロフィール読み取り（Cloudflare Pages Function）
// ルート: GET /entrance/profile?code=<account_id>&token=<salon_token>&uid=<salon_user_id>
//   → { ok:true, name, nameKana, birthday:{month,day}, address:{pref,city}, lang, memberSince, inviteShop }
//
// 入場と同じ接続（seam_ginza_qr_01＝service権限）で会員をQRから引く。/entrance/lookup の兄弟。
// ★ PII最小化：電話・メール・番地以降は返さない（住所は都道府県＋市まで）。
//   誕生日は月日のみ（年は返さない）。氏名フルはスタッフのカルテ用に返す（表示側で姓に丸める）。

export async function onRequestGet(context) {
  const { request } = context;
  const H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };
  try {
    const u = new URL(request.url);
    const code  = (u.searchParams.get('code')  || '').trim().slice(0, 128);
    const token = (u.searchParams.get('token') || '').trim();
    const uid   = (u.searchParams.get('uid')   || '').trim();
    if (!code)          return J({ ok: false, reason: 'no_code' }, H, 400);
    if (!token || !uid) return J({ ok: false, reason: 'no_auth' }, H, 401);

    let r;
    try {
      r = await fetch('https://seam.salon.town/get/account', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ user_id: uid, token, filter: { account_id: code }, is_all: true }),
      });
    } catch (e) { return J({ ok: false, reason: 'error' }, H, 502); }
    if (!r.ok) return J({ ok: false, reason: 'error' }, H, 502);

    const j = await r.json().catch(() => ({}));
    const m = (j && j.result && Array.isArray(j.data) && j.data[0]) || null;
    if (!m) {
      if (j && j.result === false && (j.error === 1002 || /NOT FOUND USER/i.test(j.msg || '')))
        return J({ ok: false, reason: 'no_auth' }, H);
      return J({ ok: false, reason: 'not_found' }, H);
    }

    // 誕生日：'YYYY-MM-DD' から月日のみ（年は返さない＝PII配慮）
    let birthday = null;
    const bm = String(m.birthday || '').trim().match(/^\d{2,4}[-/](\d{1,2})[-/](\d{1,2})/);
    if (bm) birthday = { month: +bm[1], day: +bm[2] };

    return J({
      ok: true,
      name:     String(m.name || ''),
      nameKana: String(m.name_kana || ''),
      birthday,
      address:  { pref: String(m.addr_state || ''), city: String(m.addr_city || '') }, // 番地以降は返さない
      lang:     String(m.lang || ''),
      memberSince: String(m.regist_date || m.create_date || '').slice(0, 10),
      inviteShop:  String(m.affilicated_shop_name || ''),
    }, H);
  } catch (e) {
    return J({ ok: false, reason: 'error' }, H, 500);
  }
}

function J(o, h, s = 200) { return new Response(JSON.stringify(o), { status: s, headers: h }); }

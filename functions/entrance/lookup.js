// SEAM 入場受付 — 会員名ルックアップ（Cloudflare Pages Function）
// ルート: GET /entrance/lookup?code=<account_id>&token=<salon_token>&uid=<salon_user_id>
//   →  { ok: true, name: "山田" }（姓のみ）
//   →  { ok: false, reason: "no_auth"  }  ← token/uid 未指定 or token失効（再ログインが必要）
//   →  { ok: false, reason: "error"    }  ← salon APIに到達不可 / 5xx（通信・システム側の問題）
//   →  { ok: false, reason: "not_found" } ← セッションは有効だが該当会員なし（＝本当に非会員）
//
// ★ reason を厳密に分けるのが肝。フロントは error/no_auth のとき「会員を弾く」画面を出さず、
//   通信やtoken失効を会員本人のせいにしない（本物のVIP会員を万引き犯扱いする事故の防止）。
//
// セッショントークンはフロントエンドから毎回渡す方式（環境変数ログイン情報なし）。

export async function onRequestGet(context) {
  const { request } = context;
  const H = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  };

  try {
    const url = new URL(request.url);
    const code  = (url.searchParams.get('code')  || '').trim().slice(0, 128);
    const token = (url.searchParams.get('token') || '').trim();
    const uid   = (url.searchParams.get('uid')   || '').trim();

    if (!code)          return J({ ok: false, reason: 'no_code' }, H, 400);
    if (!token || !uid) return J({ ok: false, reason: 'no_auth' }, H, 401);

    const base = 'https://seam.salon.town';

    const r = await lookup(base, { token, user_id: uid }, code);
    if (r.name) return J({ ok: true, name: smartSurname(r.name).slice(0, 20) }, H);
    return J({ ok: false, reason: r.reason || 'not_found' }, H, r.reason === 'error' ? 502 : 200);

  } catch (e) {
    return J({ ok: false, reason: 'error' }, H, 500);
  }
}

// ── account_id → { name } または { reason } ──
async function lookup(base, sess, code) {
  let r;
  try {
    r = await fetch(base + '/get/account', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        user_id: sess.user_id,
        token: sess.token,
        filter: { account_id: code },
        is_all: true,
      }),
    });
  } catch (e) {
    return { reason: 'error' };            // salon APIに到達できない（ネットワーク断など）
  }
  if (!r.ok) return { reason: 'error' };    // 5xx 等はシステム側の問題

  const j = await r.json().catch(() => ({}));
  if (j && j.result && Array.isArray(j.data) && j.data[0] && j.data[0].name) {
    return { name: String(j.data[0].name) };
  }
  // token失効・無効ユーザー → 再ログインが必要（会員が存在しないのとは別物）
  if (j && j.result === false && (j.error === 1002 || /NOT FOUND USER/i.test(j.msg || ''))) {
    return { reason: 'no_auth' };
  }
  return { reason: 'not_found' };           // セッションは有効だが該当なし＝本当に非会員
}

// 会員DBは氏名が1項目(name)のみで姓・名が分かれていない。
// スペースがあれば先頭＝姓。無い漢字名は「3文字姓の辞書優先＋既定は先頭2文字」で姓を推定。
// かな/ローマ字でスペース無しは分割不能なのでそのまま返す。
const SURNAME4 = new Set(['勅使河原', '武者小路', '大豆生田']);
const SURNAME3 = new Set([
  '佐々木', '長谷川', '五十嵐', '小笠原', '久保田', '佐久間', '宇佐美', '小野寺', '大久保', '小早川',
  '大河原', '大河内', '阿久津', '安孫子', '波多野', '御手洗', '小田島', '大和田', '日比野', '東海林',
  '小宮山', '二階堂', '九十九', '小長谷', '宇都宮', '伊集院', '八重樫', '喜多村', '喜屋武', '我那覇',
  '阿波根', '安慶名', '小久保', '小谷野', '長谷部', '宇佐見', '大工原', '小手川', '宇田川', '大城戸',
  '小田切', '宇田津', '小柳津',
]);
function smartSurname(raw) {
  const s = String(raw).trim();
  if (!s) return '';
  // スペース区切りがあれば確実に先頭＝姓
  const parts = s.split(/[\s　]+/);
  if (parts.length > 1) return parts[0];
  // 漢字の先頭ひとかたまりの後にかなが続く（例: 伊藤みなみ）→ 先頭の漢字＝姓
  const km = s.match(/^([一-鿿々〆ヶ]+)[ぁ-んァ-ヶ]/);
  if (km) return km[1];
  // 漢字のみ（々〆ヶ含む）でなければ分割できない → そのまま
  if (!/^[一-鿿々〆ヶ]+$/.test(s)) return s;
  if (s.length <= 2) return s;
  if (s.length >= 4 && SURNAME4.has(s.slice(0, 4))) return s.slice(0, 4);
  if (SURNAME3.has(s.slice(0, 3))) return s.slice(0, 3);
  return s.slice(0, 2); // 既定：日本人の姓は2文字が最頻
}

function J(o, h, s = 200) {
  return new Response(JSON.stringify(o), { status: s, headers: h });
}

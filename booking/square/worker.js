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
import { json, z, min2hm } from './util.js';   // 共有ユーティリティ
import { salonPush, salonCancel, salonDelete, salonCall, salonSaveAccountRaw, handleSalonPull, handleSalonSelftest, handleSalonWhoami, handleSalonCleanupNoname } from './salon-bridge.js';   // salon.town(CUEPON)ブリッジ
import { handleAiChat } from './ai-chat.js';   // BYO AI（本人キーでClaude/ChatGPT）

/* 電話番号を数字だけに寄せる。全角も拾う。カルテのキーはこの形で統一する
   （同姓同名でも取り違えないよう、電話が本人の見分け方の軸になる） */
const cleanupTok = (url, env) => !!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN);
const telN = v => String(v || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^0-9]/g, '');

/* ───────── お名前の正規化と検証（サロンボード/ホットペッパーに入る形だけ通す） ─────────
   背景: 姓と名は `姓 + ' ' + 名` で1本にまとめて保存し、RPAがスペースで姓/名に割り戻す。
   そのため **姓や名の内部に空白が混ざると割り戻しが壊れる**（「山田 太 花子」で3分割になる）。
   さらに絵文字・記号・数字・半角カナはサロンボードの顧客名として通らない/文字化けの原因になる。
   方針:
     ・直せるもの（前後の空白・全角英数・半角カナ・ゼロ幅文字）は黙って直す
     ・直せないもの（記号・数字・絵文字・内部の空白）は **予約を通さない**
   ※このルールはクライアント(booking/index.html の nmOk/knOk)と必ず同じにする。 */
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF\u0000-\u001F\u007F]/g;
// 姓名に使える文字: 漢字・ひらがな・全角カタカナ・長音/々/〆/ヵヶ・中黒・半角英字
const NAME_OK = /^[\u4E00-\u9FFF\u3005\u3006\u3007\u30F6\u30F5\u3041-\u309F\u30A1-\u30FAー・A-Za-z]+$/;
const KANA_OK = /^[\u30A1-\u30FAー・]+$/;
const NAME_MAX = 16;
function normName(v) {
  let s = String(v == null ? '' : v).replace(ZERO_WIDTH, '');
  try { s = s.normalize('NFKC'); } catch (e) {}   // 半角カナ→全角カナ / 全角英数→半角
  // 前後の空白は打ち間違いなので黙って落とす。**内部の空白は落とさない**
  //（「山田 太」を黙って「山田太」に繋ぐと 別人の名前でサロンボードに登録されてしまう）
  return s.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '');
}
const hira2kataW = v => String(v || '').replace(/[\u3041-\u3096]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60));
/* 姓・名・セイ・メイを検証して返す。ng に理由が入っていたら予約を通さない。 */
function checkNameParts(sei, mei, seiK, meiK) {
  const S = normName(sei), M = normName(mei);
  const SK = hira2kataW(normName(seiK)), MK = hira2kataW(normName(meiK));
  if (!S) return { ng: '姓を入力してください' };
  if (!M) return { ng: '名を入力してください' };
  // 内部の空白は「姓の欄にフルネームを入れた」等の入力間違い。直さずに弾く
  if (/[\s\u3000]/.test(S)) return { ng: '姓の欄に空白は使えません（姓と名は別の欄に分けてください）' };
  if (/[\s\u3000]/.test(M)) return { ng: '名の欄に空白は使えません（姓と名は別の欄に分けてください）' };
  if (/[\s\u3000]/.test(SK)) return { ng: 'セイの欄に空白は使えません' };
  if (/[\s\u3000]/.test(MK)) return { ng: 'メイの欄に空白は使えません' };
  if (S.length > NAME_MAX || M.length > NAME_MAX) return { ng: 'お名前が長すぎます（姓・名それぞれ' + NAME_MAX + '文字以内）' };
  if (!NAME_OK.test(S)) return { ng: '姓に使えない文字が含まれています（記号・数字・絵文字は使えません）' };
  if (!NAME_OK.test(M)) return { ng: '名に使えない文字が含まれています（記号・数字・絵文字は使えません）' };
  if (!SK) return { ng: 'セイを入力してください' };
  if (!MK) return { ng: 'メイを入力してください' };
  if (SK.length > NAME_MAX || MK.length > NAME_MAX) return { ng: 'フリガナが長すぎます（' + NAME_MAX + '文字以内）' };
  if (!KANA_OK.test(SK)) return { ng: 'セイはカタカナで入力してください' };
  if (!KANA_OK.test(MK)) return { ng: 'メイはカタカナで入力してください' };
  return { sei: S, mei: M, seiK: SK, meiK: MK, name: S + ' ' + M, kana: SK + ' ' + MK };
}
/* 「姓 名」の形で来た1本の文字列を検証する（旧クライアント・LINE経由の受け口用） */
function checkNameJoined(name, kana) {
  const parts = String(name == null ? '' : name).split(/[\s\u3000]+/).filter(Boolean);
  const kparts = String(kana == null ? '' : kana).split(/[\s\u3000]+/).filter(Boolean);
  if (parts.length !== 2) return { ng: 'お名前は「姓 名」の形で入力してください（間は1つのスペース）' };
  if (kparts.length && kparts.length !== 2) return { ng: 'フリガナは「セイ メイ」の形で入力してください' };
  return checkNameParts(parts[0], parts[1], kparts[0] || '', kparts[1] || '');
}

/* 海外のお客様が母国語で書いた自由記入に、日本語の下訳を付ける。
   ★これは「参考」であって「事実」ではない。実測で以下の誤りが出たため、原文を必ず主として残す：
     ・"bleached twice" → 「二度毛染めをしました」（ブリーチが毛染めに化けた）
     ・"염모제 알레르기 / 두피가 붓고" → パーマ剤を足し、腫れを落とした
   したがって施術の安全に関わる事実は、日本語で保存される選択肢（お体のことのチップ）が担う。
   自由記入の訳は下訳として、原文とセットで、必ず「機械翻訳・要確認」の印つきで出す。
   Workers AI を使うので外部のAPIキーを預からない（鍵がブラウザやiPadに渡らない）。 */
const AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
/* 施術名の取り違えは事故につながる（実測で 염모제=染毛剤 が「パーマ」と訳された）。
   間違えやすい語だけ対訳を渡して、勝手な言い換えを防ぐ。 */
const AI_GLOSSARY = [
  'bleach / 탈색 / 漂发 / 漂髮 = ブリーチ',
  'hair dye, hair colour / 염모제, 염색 / 染发剂 / 染髮劑 = 染毛剤（ヘアカラー）',
  'perm / 펌, 파마 / 烫发 / 燙髮 = パーマ',
  'straightening, relaxer / 매직, 스트레이트 / 离子烫, 直发 / 離子燙 = 縮毛矯正',
  'treatment / 트리트먼트 / 护发 / 護髮 = トリートメント',
  'scalp / 두피 / 头皮 / 頭皮 = 頭皮',
  'itchy / 가렵다 / 发痒 / 發癢 = かゆみ',
  'swollen / 붓다 / 肿 / 腫 = 腫れ',
  'rash, hives / 두드러기 / 起疹子 / 起疹子 = 発疹',
  'pregnant / 임신 / 怀孕 / 懷孕 = 妊娠中',
].join('／');
const AI_SYS = '次の文を自然な日本語に訳してください。美容室のカウンセリング用紙の記入です。'
  + 'アレルギー・薬剤・施術名・体調に関わる語は、絶対に省略・言い換え・追加をしないでください。'
  + '施術名の取り違えは事故につながるため、次の対訳に必ず従ってください：' + AI_GLOSSARY + '。'
  + '分からない語はそのまま残してください。訳文だけを、日本語で出力してください。';
/* 下訳として出してよい出力かを見る。実測で次の2つの壊れ方が出たので厳しく弾く：
     ①中国語のまま返る（訳されていない）
     ②意味不明な文字列が延々と返る（モデルの出力崩壊）
   偽の下訳を出すより、原文だけの方が誤解が少ない。 */
function saneJa(out, src) {
  const v = String(out || '').trim();
  if (!v || v === src) return false;
  if (!/[ぁ-んァ-ヶ]/.test(v)) return false;                 // かなが無い＝日本語になっていない
  if (/[A-Za-z]{14,}/.test(v)) return false;                 // 長い英字の連なり＝崩壊
  if (/[\u0400-\u04FF\u0600-\u06FF\u0E00-\u0E7F\uAC00-\uD7AF]/.test(v)) return false;  // 別言語の混入＝崩壊
  const latin = (v.match(/[A-Za-z]/g) || []).length;
  if (latin / v.length > 0.25) return false;                 // 英字が多すぎる＝崩壊
  const r = v.length / Math.max(1, String(src).length);
  if (r < 0.3 || r > 3.5) return false;                      // 長さが原文と釣り合わない
  // 原文の一部をそのまま抱えていたら訳せていない（「原文＋です」で通り抜けるのを防ぐ）
  const src8 = String(src);
  for (let i = 0; i + 8 <= v.length; i++) { if (src8.includes(v.slice(i, i + 8))) return false; }
  return true;
}
async function toJa(env, text, lang) {
  const t = String(text || '').trim();
  if (!t || !env.AI || lang === 'ja' || !['en', 'zh', 'tw', 'ko'].includes(lang)) return '';
  const once = async (extra) => {
    const r = await env.AI.run(AI_MODEL, {
      messages: [{ role: 'system', content: AI_SYS + (extra || '') }, { role: 'user', content: t.slice(0, 900) }],
      max_tokens: 400,
    });
    return String((r && (r.response || r.result)) || '').trim().replace(/^["「]|["」]$/g, '');
  };
  try {
    let out = await once();
    if (!saneJa(out, t)) {
      // 一度だけやり直す。それでもだめなら下訳は付けない
      out = await once('必ず日本語（ひらがな・カタカナを含む文）で、原文と同じくらいの長さで出力してください。原文の言語のまま返してはいけません。');
    }
    return saneJa(out, t) ? out : '';
  } catch (e) { return ''; }
}

const SQUARE_VERSION = '2025-01-23';
const OWNER_FROM = 'yoyaku@seam.site';   // 送信元（seam.siteドメイン）
const OWNER_TO = 'suenotakemi@gmail.com';// 通知先（SEND_EMAILの検証済み宛先）

// Resend（DKIM署名付き・seam.site認証済み）でメール送信。受信箱に確実に届く。
async function sendResend(env, to, subject, text) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || `SEAM 予約 <${OWNER_FROM}>`, to, subject, text }),
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()));
}

// オーナーのGmailへ通知メール。Resend優先（DKIM=受信箱に届く）、無ければ SEND_EMAIL にフォールバック。
async function notifyOwner(env, subject, text) {
  if (env.RESEND_API_KEY) {
    try { await sendResend(env, OWNER_TO, subject, text); return; }
    catch (e) { console.log('notifyOwner(Resend)失敗→SEND_EMAILへ:', e.message); }
  }
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

// 管理API認証: Authorization: Bearer <ADMIN_TOKEN> を検証。OKなら null、NGなら 401/500 レスポンス。
// 顧客導線(予約作成POST /reservations・/pay・/line/login)は認証不要。管理系(GET予約=個人情報・売上・削除等)は必須。
function requireAdmin(request, env, cors) {
  if (!env.ADMIN_TOKEN) return json({ error: '管理トークンがサーバに未設定です' }, 500, cors);
  const tok = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!tok || tok !== env.ADMIN_TOKEN) return json({ error: '認証が必要です（管理トークン）' }, 401, cors);
  return null;
}

// 予約確認メール（顧客宛）。予約作成時にサーバ側から送る（フロントからの直接呼び出しは廃止）。
async function sendConfirmMail(env, to, r) {
  if (!env.RESEND_API_KEY || !to) return;
  const salon = r.salon || 'SEAM 銀座';
  const subject = `【${salon}】ご予約ありがとうございます`;
  const text = `${salon} をご予約いただきありがとうございます。\n\n`
    + `■ご予約内容\n日時: ${(r.date || '').replace(/-/g, '/')} ${r.time || ''}〜\nメニュー: ${r.menu || ''}\n担当: ${r.staff || ''}\n`
    + (r.total ? `お支払い予定: ¥${Number(r.total).toLocaleString()}\n` : '')
    + `\nご来店をお待ちしております。\n変更・キャンセルは前日までにご連絡ください。`;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM || 'SEAM <onboarding@resend.dev>', to, subject, text }),
  });
}

// 予約データ用: 台帳スタッフ・メニュー（アプリと同一）。メール取込のマッピングに使用。
const STAFF = [
  { id: 's1', name: '及川 大輝' }, { id: 's2', name: 'ANZU' }, { id: 's3', name: 'CHIKA' },
];
// 再push(同期漏れ修復)用のCUEPON/HPB ID(booking/index.html STAFFと同期)
const STAFF_CU = {
  s1: { name: '及川 大輝', cu: '20260720172047980eihPaAi', hpb: 'T001096152' },
  s2: { name: 'ANZU', cu: '20260720172048371VVaiHGf', cuSpa: '20260721104016592jgjicee', hpb: 'T001097192', hpbSpa: 'W001374984' },
  s3: { name: 'CHIKA', cu: '20260720172736440ZYIefdT', hpb: 'W001412775' },
};
// booking/index.html の MENUS と同期（2026-07-26）。リマインドの名称表示とメール取込の照合に使用。
// ★ページ側のMENUSを変えたらここも更新すること（IDずれると顧客向けリマインドに生IDが出る）。
const MENUS = [
  { id: 'cp1', name: '【完全個室】カット＋ケアカラー＋トリートメント', min: 150 },
  { id: 'cp2', name: '【完全個室】カット＋ケアカラー＋ヘッドスパ45min＋トリートメント', min: 195 },
  { id: 'cp3', name: '【完全個室】カット＋髪質改善トリートメント', min: 150 },
  { id: 'cp4', name: '【完全個室】カット＋ケアカラー＋髪質改善トリートメント', min: 180 },
  { id: 'cp5', name: '【完全個室】カット＋美髪縮毛矯正＋トリートメント', min: 240 },
  { id: 'cp6', name: '【完全個室】ケアカラー＋トリートメント', min: 120 },
  { id: 'cp7', name: '【完全個室】ケアカラー＋45minヘッドスパ', min: 135 },
  { id: 'cp8', name: '【メンズ】カット＋お悩みに合わせた頭皮ケア', min: 75 },
  { id: 'cp9', name: '【完全個室】カット＋トリートメント', min: 90 },
  { id: 'cp10', name: '【完全個室】カット＋【30min】クイックヘッドスパ', min: 90 },
  { id: 'cp11', name: '睡眠クリームヘッドスパ　ライトコース【６０min】完全個室&ブロー付き', min: 75 },
  { id: 'cp12', name: 'カット+微還元トリートメント', min: 90 },
  { id: 'cp13', name: '【完全個室】カット+頭浸浴付ヘッドスパ90min', min: 150 },
  { id: 'm1', name: 'SEAMカット', min: 60 }, { id: 'm2', name: '前髪カット', min: 20 },
  { id: 'm3', name: 'ケアリタッチカラー', min: 90 }, { id: 'm4', name: '艶ケアカラー', min: 120 },
  { id: 'm5', name: 'ケアブリーチWカラー（ハイライト、全頭）', min: 210 },
  { id: 'm6', name: 'ケアパーマ', min: 120 }, { id: 'm7', name: '前髪パーマ', min: 60 },
  { id: 'm8', name: 'カット＋美髪縮毛矯正', min: 210 }, { id: 'm9', name: '前髪縮毛矯正', min: 90 },
  { id: 'm10', name: '髪質改善トリートメント（酸熱系。サブリミック o r つるりんちょ)', min: 120 },
  { id: 'm11', name: '高濃度トリートメント(バイカルテor TOKIO）', min: 60 },
  { id: 'm12', name: 'トリートメント（Quick Step treatment）', min: 30 },
  { id: 'm13', name: '完全個室45min コース', min: 45 },
  { id: 'm14', name: '完全個室60min コース', min: 60 },
  { id: 'm15', name: 'ヘッドスパ90分', min: 90 },
];

export default {
  async fetch(request, env) {
    // CORS: 許可オリジンをホワイトリスト化（* を廃止）。ALLOW_ORIGIN はカンマ区切りで上書き可。
    const ALLOWED = (env.ALLOW_ORIGIN || 'https://suenotakemi-cloud.github.io,http://localhost:3600').split(',').map(s => s.trim());
    const reqOrigin = request.headers.get('Origin') || '';
    const cors = {
      'Access-Control-Allow-Origin': ALLOWED.includes(reqOrigin) ? reqOrigin : ALLOWED[0],
      'Vary': 'Origin',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    const url = new URL(request.url), p = url.pathname, m = request.method;
    const A = () => requireAdmin(request, env, cors);   // 管理系: 認証NGならレスポンス、OKならnull

    // ===== 公開（顧客導線・認証不要） =====
    if (p.endsWith('/pay') && m === 'POST') return handlePay(request, env, cors);
    // 【調査用・読み取りだけ】Squareの売上（注文）と商品台帳が、こちらの商品と突き合わせられるかを見る。
    // 何も書き込まない。トークンも返さない。
    if (p.endsWith('/admin/square-probe') && m === 'GET') {
      if (!cleanupTok(url, env)) return json({ error: 'forbidden' }, 403, cors);
      if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 400, cors);
      const H = { 'Square-Version': '2025-01-23', 'Authorization': 'Bearer ' + env.SQUARE_ACCESS_TOKEN, 'Content-Type': 'application/json' };
      const base = 'https://connect.squareup.com';
      const out = {};
      // 1) 店舗一覧（ショップ系のLocationを拾う）
      try {
        const r = await fetch(base + '/v2/locations', { headers: H });
        const j = await r.json();
        out.locations = (j.locations || []).map(l => ({ id: l.id, name: l.name }));
      } catch (e) { out.locations = 'ERR ' + e.message; }
      // 2) 注文（売れたもの）を読めるか。直近14日・指定Locationまたは全店舗
      const locs = (url.searchParams.get('loc') || '').split(',').map(x => x.trim()).filter(Boolean);
      const days = Math.min(60, Math.max(1, +(url.searchParams.get('days') || 14)));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      try {
        const body = {
          location_ids: locs.length ? locs : (out.locations || []).map(l => l.id).slice(0, 10),
          limit: 50,
          query: {
            filter: {
              date_time_filter: { closed_at: { start_at: since } },
              state_filter: { states: ['COMPLETED'] },   // 完了した売上だけ（下書き・取消は除く）
            },
            sort: { sort_field: 'CLOSED_AT', sort_order: 'DESC' },
          },
        };
        const r = await fetch(base + '/v2/orders/search', { method: 'POST', headers: H, body: JSON.stringify(body) });
        const j = await r.json();
        if (!r.ok) out.orders = { ok: false, error: (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || ('HTTP ' + r.status) };
        else {
          const os = j.orders || [];
          const items = [];
          for (const o of os) for (const li of (o.line_items || [])) items.push({
            loc: o.location_id, at: (o.closed_at || o.created_at || '').slice(0, 10),
            name: li.name || '', qty: li.quantity || '', catalogId: li.catalog_object_id || '', variation: li.variation_name || '',
          });
          out.orders = { ok: true, count: os.length, lineItems: items.length, sample: items.slice(0, 8) };
        }
      } catch (e) { out.orders = { ok: false, error: e.message }; }
      // 3) （商品台帳の全件読みは上限に当たるため、調査から外した）
      // 4) いちばん大事な数字：実際に売れた明細のうち、何割をこちらの商品に結び付けられるか。
      //    ★商品台帳を丸ごと読むと「1回の実行で読める上限」に当たる（実測）。
      //    そこで本番の同期と同じ方式にする＝売れた商品のIDだけを個別に引く（数が少ない）。
      try {
        const locs2 = (url.searchParams.get('loc') || '').split(',').map(x => x.trim()).filter(Boolean);
        const ids = locs2.length ? locs2 : (out.locations || []).map(l => l.id).slice(0, 10);
        let lines = [], oc = '', op = 0;
        do {
          const body = { location_ids: ids, limit: 200, cursor: oc || undefined,
            query: { filter: { date_time_filter: { closed_at: { start_at: since } }, state_filter: { states: ['COMPLETED'] } },
                     sort: { sort_field: 'CLOSED_AT', sort_order: 'DESC' } } };
          const r = await fetch(base + '/v2/orders/search', { method: 'POST', headers: H, body: JSON.stringify(body) });
          const j = await r.json(); if (!r.ok) break;
          for (const o3 of (j.orders || [])) for (const li of (o3.line_items || []))
            lines.push({ name: li.name || '', qty: +(li.quantity || 0), cat: li.catalog_object_id || '' });
          oc = j.cursor || ''; op++;
        } while (oc && op < 3);
        // 売れた商品のIDだけを引く（重複は1回だけ。まとめて取れるAPIを使う）
        const uniq = [...new Set(lines.map(l => l.cat).filter(Boolean))];
        const info = new Map();
        for (let i = 0; i < uniq.length && i < 900; i += 100) {
          const part = uniq.slice(i, i + 100);
          const r = await fetch(base + '/v2/catalog/batch-retrieve', { method: 'POST', headers: H,
            body: JSON.stringify({ object_ids: part }) });
          const txt = await r.text();
          let j = {}; try { j = JSON.parse(txt); } catch (e) {}
          if (url.searchParams.get('raw') === '1' && !out.rawCatalog) out.rawCatalog = { status: r.status, sent: part.slice(0, 3), body: txt.slice(0, 600) };
          if (!r.ok) { out.catalogFetchError = (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || ('HTTP ' + r.status); break; }
          for (const o4 of (j.objects || [])) {
            const v = o4.item_variation_data || {};
            info.set(o4.id, { gtin: v.upc || '', sku: v.sku || '', name: v.name || '' });
          }
        }
        const gtins = [...new Set([...info.values()].map(v => v.gtin).filter(Boolean))];
        const names = [...new Set(lines.map(l => l.name).filter(Boolean))];
        const okBc = new Set(), okNm = new Set();
        for (let i = 0; i < gtins.length; i += 90) { const part = gtins.slice(i, i + 90);
          const q = await env.DB.prepare(`SELECT barcode FROM products WHERE barcode IN (${part.map(() => '?').join(',')})`).bind(...part).all();
          for (const r of (q.results || [])) okBc.add(r.barcode); }
        for (let i = 0; i < names.length; i += 90) { const part = names.slice(i, i + 90);
          const q = await env.DB.prepare(`SELECT name FROM products WHERE name IN (${part.map(() => '?').join(',')})`).bind(...part).all();
          for (const r of (q.results || [])) okNm.add(r.name); }
        let byBarcode = 0, byName = 0, unmatched = 0, noCat = 0, noGtinInOurs = 0, noGtinAtAll = 0;
        const miss = [];
        for (const l of lines) {
          if (!l.cat) { noCat++; continue; }
          const g = (info.get(l.cat) || {}).gtin || '';
          if (g && okBc.has(g)) byBarcode++;
          else if (okNm.has(l.name)) byName++;
          else { unmatched++; if (g) noGtinInOurs++; else noGtinAtAll++;
            if (miss.length < 12) miss.push({ name: l.name, gtin: g || '（なし）' }); }
        }
        out.match = { 明細数: lines.length, 売れた商品の種類: uniq.length, 引けた商品情報: info.size,
          バーコードで一致: byBarcode, 名前で一致: byName, 結び付かない: unmatched, 商品IDなし_技術売上など: noCat,
          GTINはあるがこちらに無い: noGtinInOurs, GTINが付いていない: noGtinAtAll,
          結び付かない例: miss };
      } catch (e) { out.match = { error: e.message }; }
      return json({ ok: true, ...out }, 200, cors);
    }
    // Squareの設定確認（読み取りだけ・課金なし）。
    // 同じトークンを本番とサンドボックスの両方に投げて、どちらで通るか＝どちらのトークンかを判定し、
    // その環境の店舗一覧（Location ID）も返す。トークン自体は絶対に返さない。
    if (p.endsWith('/admin/square-check') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) return json({ error: 'forbidden' }, 403, cors);
      if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 400, cors);
      const probe = async (host) => {
        try {
          const r = await fetch(host + '/v2/locations', {
            headers: { 'Square-Version': '2025-01-23', 'Authorization': 'Bearer ' + env.SQUARE_ACCESS_TOKEN, 'Content-Type': 'application/json' },
          });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return { ok: false, status: r.status, error: (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || ('HTTP ' + r.status) };
          return {
            ok: true, status: r.status,
            locations: (j.locations || []).map(l => ({
              id: l.id, name: l.name, status: l.status, country: l.country, currency: l.currency,
              type: l.type || '', capabilities: l.capabilities || [],
            })),
          };
        } catch (e) { return { ok: false, error: String(e.message || e) }; }
      };
      const [prod, sand] = await Promise.all([probe('https://connect.squareup.com'), probe('https://connect.squareupsandbox.com')]);
      const which = prod.ok ? 'production' : (sand.ok ? 'sandbox' : 'unknown');
      const list = prod.ok ? prod.locations : (sand.ok ? sand.locations : []);
      return json({
        ok: true,
        tokenIs: which,                                  // トークンがどちら向けか（実測）
        envNow: env.SQUARE_ENV === 'production' ? 'production' : 'sandbox',
        appIdIs: (env.SQUARE_APP_ID || '').startsWith('sq0idp-') ? 'production' : 'sandbox',
        locationIdNow: env.SQUARE_LOCATION_ID || '',
        locationIdValid: list.some(l => l.id === env.SQUARE_LOCATION_ID),
        locations: list,
        production: { ok: prod.ok, error: prod.error || '' },
        sandbox: { ok: sand.ok, error: sand.error || '' },
      }, 200, cors);
    }
    // 前金決済の公開設定。ブラウザが Square SDK を初期化するのに使う3つだけを返す。
    // ★アクセストークンは絶対に返さない（サーバー内だけで使う）。
    if (p.endsWith('/pay/config') && m === 'GET') {
      const appId = env.SQUARE_APP_ID || '';
      const locId = env.SQUARE_LOCATION_ID || '';
      const prod = env.SQUARE_ENV === 'production';
      // ★環境とアプリIDの食い違いを自動で止める。
      // 本番のアプリID(sq0idp-)をサンドボックスのSDKに渡す（逆も）と必ず失敗するため、
      // 揃うまでは ready:false にしてカード欄を出さない（お客様に壊れた画面を見せない）。
      const idIsProd = appId.startsWith('sq0idp-');
      const match = !appId || (prod === idIsProd);
      return json({
        ok: true,
        // 揃って初めて「決済できる」。欠けていたら画面はカード欄を出さない
        ready: !!(appId && locId && env.SQUARE_ACCESS_TOKEN && match),
        mismatch: !match ? (prod ? 'SQUARE_ENV=production だがアプリIDが本番のものではありません'
                                 : 'アプリIDは本番用ですが SQUARE_ENV がまだ sandbox です') : '',
        env: prod ? 'production' : 'sandbox',
        appId, locationId: locId,
        sdk: prod ? 'https://web.squarecdn.com/v1/square.js' : 'https://sandbox.web.squarecdn.com/v1/square.js',
      }, 200, cors);
    }
    if (p.endsWith('/reservations') && m === 'POST') return handlePostReservation(request, env, cors); // 顧客の予約作成
    if (p.endsWith('/availability') && m === 'GET') return handleAvailability(url, env, cors);           // 空き判定用(PII無し・公開)
    /* ---- メールのワンタイムパスワード(OTP)。Google以外のメールで予約する方の本人確認 ----
       送信: POST /otp/send {email} → 6桁を発行しメール送信(60秒に1回まで)
       照合: POST /otp/verify {email,code} → 一致で verified=1(10分有効・5回まで) */
    if (p.endsWith('/otp/send') && m === 'POST') {
      if (!env.DB || !env.RESEND_API_KEY) return json({ error: 'メール送信が未設定です' }, 500, cors);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      const email = String(o.email || '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'メールアドレスの形式が正しくありません' }, 400, cors);
      await ensureRegisterTables(env);
      const prev = await env.DB.prepare('SELECT created_at FROM otp WHERE email=?').bind(email).first().catch(() => null);
      if (prev && (Date.now() - Date.parse(prev.created_at)) < 60000) return json({ error: '少し時間をおいてからお試しください' }, 429, cors);
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT OR REPLACE INTO otp (email,code,expires,verified,tries,created_at) VALUES (?,?,?,0,0,?)')
        .bind(email, code, expires, new Date().toISOString()).run();
      try {
        await fetch('https://api.resend.com/emails', { method: 'POST',
          headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: env.MAIL_FROM || 'SEAM 銀座 <yoyaku@seam.site>', to: [email],
            subject: `【SEAM 銀座】確認コード ${code}`,
            text: `確認コードは ${code} です。\n\n予約ページの入力欄にこの6桁を入れてください。\n10分以内にご入力ください。\n\nこのメールに心当たりがない場合は破棄してください。\nSEAM 銀座` }) });
      } catch (e) { return json({ error: 'メール送信に失敗しました' }, 502, cors); }
      return json({ ok: true }, 200, cors);
    }
    if (p.endsWith('/otp/verify') && m === 'POST') {
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      const email = String(o.email || '').trim().toLowerCase(), code = String(o.code || '').trim();
      await ensureRegisterTables(env);
      const row = await env.DB.prepare('SELECT * FROM otp WHERE email=?').bind(email).first();
      if (!row) return json({ ok: false, error: 'もう一度コードを送信してください' }, 400, cors);
      if (Date.parse(row.expires) < Date.now()) return json({ ok: false, error: 'コードの有効期限が切れました' }, 400, cors);
      if ((row.tries || 0) >= 5) return json({ ok: false, error: '回数の上限です。もう一度送信してください' }, 429, cors);
      if (row.code !== code) {
        await env.DB.prepare('UPDATE otp SET tries=tries+1 WHERE email=?').bind(email).run();
        return json({ ok: false, error: 'コードが違います' }, 400, cors);
      }
      await env.DB.prepare('UPDATE otp SET verified=1 WHERE email=?').bind(email).run();
      return json({ ok: true }, 200, cors);
    }
    // ノーショー履歴の事前判定(公開・電話番号→前金必須フラグのみ返す。氏名等のPIIは一切返さない)
    if (p.endsWith('/precheck') && m === 'GET') {
      const ph = (url.searchParams.get('phone') || '').replace(/[^0-9]/g, '');
      if (!env.DB || ph.length < 10) return json({ requireDeposit: false }, 200, cors);
      try {
        const hit = await env.DB.prepare(
          "SELECT 1 AS x FROM reservations WHERE status='noshow' AND REPLACE(REPLACE(phone,'-',''),' ','')=? LIMIT 1"
        ).bind(ph).first();
        return json({ requireDeposit: !!hit }, 200, cors);
      } catch (e) { return json({ requireDeposit: false }, 200, cors); }
    }
    if (p.endsWith('/admin/purge-test') && m === 'POST') return handlePurgeTest(url, env, cors);         // テスト予約掃除(専用トークン)
    if (p.endsWith('/admin/diag-resv') && m === 'GET') return handleDiagResv(url, env, cors);            // 両店予約の診断読取(専用トークン)
    // 顧客accountの確認(専用トークン・kwd=電話で検索してid/code/name返却。saveAccount検証用)
    if (p.endsWith('/admin/account-check') && m === 'GET') {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      try {
        const filter = {};
        if (url.searchParams.get('kwd')) filter.kwd = url.searchParams.get('kwd');
        if (url.searchParams.get('code')) filter.code = url.searchParams.get('code');
        if (url.searchParams.get('phone')) filter.phone = url.searchParams.get('phone');
        if (url.searchParams.get('id')) filter.id = url.searchParams.get('id');
        // staff_shop指定時は店舗スタッフ一覧(codeを含む)を返す
        if (url.searchParams.get('staff_shop')) {
          const js = await salonCall(env, '/get/account/shop/staff', { filter: { shop_id: url.searchParams.get('staff_shop') } });
          return json({ ok: true, accounts: (js.data || []).map(a => ({ id: a.id, code: a.code || '', name: a.name || a.open_name || '', kana: a.kana || '', deleted: !!a.delete_date })) }, 200, cors);
        }
        const j = await salonCall(env, '/get/account', { filter, limit: 5 });
        return json({ ok: true, accounts: (j.data || []).map(a => ({ id: a.id, code: a.code || '', name: a.name || '', kana: a.kana || '', deleted: !!a.delete_date })) }, 200, cors);
      } catch (e) { return json({ error: e.message }, 502, cors); }
    }
    // スタッフaccountのcode設定(専用トークン)。RPAのスタイリスト解決キー=account.code(スパ垢が空でSTYLIST_NOT_FOUNDの修復用)
    if (p.endsWith('/admin/account-setcode') && m === 'POST') {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      const id = url.searchParams.get('id'), code = url.searchParams.get('code');
      if (!id || !code) return json({ error: 'id/code必須' }, 400, cors);
      try { const j = await salonSaveAccountRaw(env, { id, code }); return json({ ok: !!j.result, result: j }, 200, cors); }
      catch (e) { return json({ error: e.message }, 502, cors); }
    }
    // テスト顧客accountの削除(専用トークン・id指定1件)
    if (p.endsWith('/admin/account-del') && m === 'POST') {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      const id = url.searchParams.get('id'); if (!id) return json({ error: 'id必須' }, 400, cors);
      try { const j = await salonCall(env, '/delete/account', { ids: [id] }); return json({ ok: !!j.result, result: j }, 200, cors); }
      catch (e) { return json({ error: e.message }, 502, cors); }
    }
    // 同期漏れの再push(専用トークン)。salonPush失敗でD1にだけ入った予約(salon_id空)をsalon.townへ送り直す。
    // GET=ドライラン一覧 / POST=実行。cronでも毎朝自動実行(自己修復)。
    if (p.endsWith('/admin/salon-repush') && (m === 'GET' || m === 'POST')) {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      return json(await repushMissing(env, m === 'POST'), 200, cors);
    }
    // D1⇔salon.town台帳の突き合わせ(専用トークン)。salon.townで削除/キャンセル済みなのにD1でbookedの
    // 「亡霊予約」をcancelledへ修復(誤リマインド防止)。GET=ドライラン / POST=反映。
    if (p.endsWith('/admin/d1-sync') && (m === 'GET' || m === 'POST')) {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      return handleD1Sync(env, cors, m === 'POST');
    }
    // 指定IDのsalon.town予約のinfo_jsを更新(専用トークン)。個室(hbp_facility)の後付け等。bodyに{id, info_js}。
    if (p.endsWith('/admin/salon-patch') && m === 'POST') {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.id || !o.info_js) return json({ error: 'id/info_js必須' }, 400, cors);
      try { const d = await salonCall(env, '/save/reservation', { data: { id: o.id, info_js: o.info_js } });
        return json({ ok: !!d.result, result: d }, 200, cors); }
      catch (e) { return json({ error: e.message }, 502, cors); }
    }
    // 指定IDのsalon.town予約を1件削除(専用トークン)。孤児ミラー(親を消した後に残るブロック)の外科的掃除用。
    if (p.endsWith('/admin/salon-del') && m === 'POST') {
      const tk = url.searchParams.get('token') || '';
      if (!env.CLEANUP_TOKEN || tk !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
      const sid = url.searchParams.get('id') || '';
      if (!sid) return json({ error: 'id必須' }, 400, cors);
      try { const d = await salonDelete(env, sid); return json({ ok: !!d.result, result: d }, 200, cors); }
      catch (e) { return json({ error: e.message }, 502, cors); }
    }
    if (p.endsWith('/line/login/state') && m === 'POST') return handleLineLoginState(request, env, cors);
    if (p.endsWith('/line/login/result') && m === 'GET') return handleLineLoginResult(url, env, cors);

    // ===== 管理（要 Authorization: Bearer ADMIN_TOKEN） =====
    // Square Terminal（端末カード決済）
    if (p.endsWith('/terminal/device-code') && m === 'POST') return A() || handleTermDeviceCode(request, env, cors);
    if (p.endsWith('/terminal/device-code') && m === 'GET') return A() || handleTermDeviceStatus(url, env, cors);
    if (p.endsWith('/terminal/checkout') && m === 'POST') return A() || handleTermCheckout(request, env, cors);
    if (p.endsWith('/terminal/checkout') && m === 'GET') return A() || handleTermStatus(url, env, cors);
    if (p.endsWith('/terminal/cancel') && m === 'POST') return A() || handleTermCancel(request, env, cors);
    if (p.endsWith('/sales') && m === 'GET') return A() || handleSales(url, env, cors);
    if (p.endsWith('/line/push') && m === 'POST') return A() || handleLinePush(request, env, cors);
    if (p.endsWith('/line/reminders') && m === 'POST') return A() || handleLineReminders(request, env, cors);
    if (p.endsWith('/mail/confirm') && m === 'POST') return A() || handleMailConfirm(request, env, cors);
    if (p.endsWith('/ai/chat') && m === 'POST') return A() || handleAiChat(request, env, cors);
    if (p.endsWith('/salon/selftest') && m === 'POST') return A() || handleSalonSelftest(env, cors);
    if (p.endsWith('/salon/pull') && m === 'GET') return A() || handleSalonPull(url, env, cors);
    if (p.endsWith('/salon/whoami') && m === 'GET') return A() || handleSalonWhoami(env, cors);
    // 無記名ミラー残骸の掃除: GET=ドライラン一覧 / POST=削除実行（?commit=1）。管理トークン or CLEANUP_TOKEN。
    // 削除対象は「親予約が消えた孤児ミラー」のみ(本物予約の兼任ブロックは残す)。
    const cleanupOk = env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN;
    if (p.endsWith('/salon/noname') && m === 'GET') return (cleanupOk ? null : A()) || handleSalonCleanupNoname(url, env, cors, false);
    if (p.endsWith('/salon/noname') && m === 'POST') return (cleanupOk ? null : A()) || handleSalonCleanupNoname(url, env, cors, url.searchParams.get('commit') === '1');
    // 予約データ（GET=全顧客PII / PATCH / DELETE は管理のみ。POSTのみ公開＝上記）
    if (p.endsWith('/reservations') && m === 'GET') return A() || handleGetReservations(url, env, cors);
    if (p.endsWith('/reservations') && m === 'PATCH') return A() || handlePatchReservation(request, env, cors);
    if (p.endsWith('/reservations') && m === 'DELETE') return A() || handleDeleteReservation(url, env, cors);
    // レジ・会計（お会計・レジ締め）D1永続化
    if (p.endsWith('/checkouts') && m === 'GET') return A() || handleGetCheckouts(url, env, cors);
    if (p.endsWith('/checkouts') && m === 'POST') return A() || handlePostCheckout(request, env, cors);
    if (p.endsWith('/checkouts') && m === 'DELETE') return A() || handleDeleteCheckout(url, env, cors);
    if (p.endsWith('/settlements') && m === 'GET') return A() || handleGetSettlements(url, env, cors);
    if (p.endsWith('/settlements') && m === 'POST') return A() || handlePostSettlement(request, env, cors);
    if (p.endsWith('/settlements') && m === 'DELETE') return A() || handleDeleteSettlement(url, env, cors);
    if (p.endsWith('/settings') && m === 'GET') return A() || handleGetSettings(env, cors);
    if (p.endsWith('/settings') && m === 'POST') return A() || handlePostSetting(request, env, cors);
    /* 【調査・読み取りだけ】salon.town の商品(ec/item)から、こちらの商品の価格を更新できるか確かめる。
     * 取り込んだ商品IDが salon.town の item.id と一致するはずなので、それで引けるかを試す。 */
    if (p.endsWith('/admin/salontown-item-probe') && m === 'GET') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      const out = {};
      // こちらが持っている商品IDを数件取り出す
      const rs = await env.DB.prepare("SELECT id,name,price,barcode,ext_id FROM products WHERE ext_id<>'' LIMIT 3").all();
      out.ours = (rs.results || []).map(r => ({ name: r.name, price: r.price, jan: r.barcode, extId: r.ext_id }));
      const ids = out.ours.map(x => x.extId);
      const tries = [];
      // 記録されている罠（filter.id が黙って無視される等）があるので、形をいくつか試す
      const shapes = [
        { label: 'filter.id（単体）', body: { filter: { id: ids[0] }, limit: 5 } },
        { label: 'filter.ids（配列）', body: { filter: { ids }, limit: 5 } },
        { label: 'filter.jan', body: { filter: { jan: out.ours[0] && out.ours[0].jan }, limit: 5 } },
        { label: 'filter.kwd（商品名）', body: { filter: { kwd: (out.ours[0] && out.ours[0].name || '').slice(0, 10) }, limit: 5 } },
        { label: 'shop_id（ヘア店）', body: { filter: { shop_id: env.SALON_SHOP_ID }, limit: 5 } },
        { label: 'フィルタなし', body: { limit: 5 } },
        { label: 'filter.company_id（メーカー）', body: { filter: { company_id: url.searchParams.get('company') || '' }, limit: 5 } },
        { label: 'filter.maker_id', body: { filter: { maker_id: url.searchParams.get('company') || '' }, limit: 5 } },
        { label: 'filter.code（商品ID）', body: { filter: { code: ids[0] }, limit: 5 } },
        { label: 'filter.item_id', body: { filter: { item_id: ids[0] }, limit: 5 } },
        { label: 'data.id（保存形と同じ）', body: { data: { id: ids[0] }, limit: 5 } },
      ];
      for (const sh of shapes) {
        try {
          const r = await salonCall(env, '/get/ec/item', sh.body);
          const list = (r && (r.data || r.items || r.list || r.result)) || [];
          const arr = Array.isArray(list) ? list : (list.items || []);
          tries.push({ 形: sh.label, 件数: arr.length,
            例: arr.slice(0, 2).map(x => ({ id: x.id, name: x.name, price: x.price, retail: x.retail_sell_price, sell: x.sell_price, jan: x.jan, brand: x.brand_name })),
            生の鍵: arr.length ? Object.keys(arr[0]).slice(0, 18) : Object.keys(r || {}).slice(0, 10) });
        } catch (e) { tries.push({ 形: sh.label, エラー: String(e.message || e) }); }
      }
      out.tries = tries;
      return json({ ok: true, ...out }, 200, cors);
    }
    /* Squareの商品台帳を取り込む（ショップを自作POSに移すため）。
     * ★1回で全部読むと上限に当たるので、1ページ（100件）ずつ処理して次のcursorを返す。
     *   呼び出し側がcursorが空になるまで繰り返す。
     * 突き合わせ：Squareの商品ID → JAN(GTIN) → SKU(メーカー品番) → 名前 の順。
     * 価格と名前は「実際に売っているSquare側を正」とする（上代ではなく売値にする）。 */
    if (p.endsWith('/admin/square-catalog') && m === 'POST') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 400, cors);
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const H = { 'Square-Version': '2025-01-23', 'Authorization': 'Bearer ' + env.SQUARE_ACCESS_TOKEN, 'Content-Type': 'application/json' };
      const cur = url.searchParams.get('cursor') || '';
      // 対象店舗（既定＝ショップと免税）。ここに置いていない商品は取り込まない
      const wantLocs = (url.searchParams.get('loc') || [env.SQUARE_LOCATION_ID_SHOP, 'L356YMPP0J4R9'].filter(Boolean).join(','))
        .split(',').map(x => x.trim()).filter(Boolean);

      // ★ページをまたぐと親の商品名が引けなくなるので、2段構えにする。
      //   phase=items で商品名だけ控えを作り、phase=vars でバリエーションを入れる。
      const phase = url.searchParams.get('phase') === 'vars' ? 'vars' : 'items';
      let j;
      try {
        const types = phase === 'items' ? 'ITEM' : 'ITEM_VARIATION';
        const r = await fetch('https://connect.squareup.com/v2/catalog/list?types=' + types + (cur ? '&cursor=' + encodeURIComponent(cur) : ''), { headers: H });
        j = await r.json();
        if (!r.ok) return json({ error: (j.errors && j.errors[0] && (j.errors[0].detail || j.errors[0].code)) || ('HTTP ' + r.status) }, 502, cors);
      } catch (e) { return json({ error: 'Square取得に失敗: ' + e.message }, 502, cors); }

      const objs = j.objects || [];
      if (phase === 'items') {
        const st = [];
        for (const o2 of objs) if (o2.type === 'ITEM' && o2.item_data)
          st.push(env.DB.prepare('INSERT OR REPLACE INTO sq_items (item_id,name) VALUES (?,?)').bind(o2.id, o2.item_data.name || ''));
        try { for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50)); }
        catch (e) { return json({ error: '商品名の控えに失敗: ' + e.message }, 500, cors); }
        const c0 = await env.DB.prepare('SELECT COUNT(*) c FROM sq_items').first().catch(() => ({ c: 0 }));
        return json({ ok: true, phase, cursor: j.cursor || '', seen: objs.length, names: (c0 && c0.c) || 0 }, 200, cors);
      }
      // 控えから名前を引く
      const itemIds = [...new Set(objs.map(o2 => (o2.item_variation_data || {}).item_id).filter(Boolean))];
      const itemName = new Map();
      for (let i = 0; i < itemIds.length; i += 90) {
        const part = itemIds.slice(i, i + 90);
        const q = await env.DB.prepare(`SELECT item_id,name FROM sq_items WHERE item_id IN (${part.map(() => '?').join(',')})`).bind(...part).all();
        for (const r of (q.results || [])) itemName.set(r.item_id, r.name || '');
      }
      const vars = [];
      for (const o2 of objs) {
        if (o2.type !== 'ITEM_VARIATION' || !o2.item_variation_data) continue;
        const v = o2.item_variation_data;
        const locs = o2.present_at_all_locations ? null : (o2.present_at_location_ids || []);
        // 対象店舗に置いていないものは飛ばす（他店舗の商品を混ぜない）
        if (locs && wantLocs.length && !locs.some(l => wantLocs.includes(l))) continue;
        const base = itemName.get(v.item_id) || '';
        const vn = (v.name || '').trim();
        const name = (base && vn && vn !== '通常' && vn !== 'Regular') ? `${base} ${vn}` : (base || vn);
        if (!name) continue;
        vars.push({
          sqId: o2.id, name,
          price: Math.round(((v.price_money && v.price_money.amount) || 0)),   // Squareは税込で持っている想定
          gtin: (v.upc || '').replace(/[^0-9A-Za-z-]/g, ''),
          sku: (v.sku || '').trim(),
        });
      }

      // 既存の照合をまとめて引く（引数上限があるので90個ずつ）
      const bySq = new Map(), byBc = new Map(), bySku = new Map(), byNm = new Map();
      const look = async (col, vals, map) => {
        const u = [...new Set(vals.filter(Boolean))];
        for (let i = 0; i < u.length; i += 90) {
          const part = u.slice(i, i + 90);
          const q = await env.DB.prepare(`SELECT id,${col} k FROM products WHERE ${col} IN (${part.map(() => '?').join(',')})`).bind(...part).all();
          for (const r of (q.results || [])) if (r.k) map.set(r.k, r.id);
        }
      };
      try {
        await look('sq_id', vars.map(v => v.sqId), bySq);
        await look('barcode', vars.map(v => v.gtin), byBc);
        await look('maker_code', vars.map(v => v.sku), bySku);
        // 名前引きは使わない
      } catch (e) { return json({ error: '照合に失敗: ' + e.message }, 500, cors); }

      const now = new Date().toISOString();
      const stmts = [];
      let added = 0, updated = 0;
      const used = new Set();
      for (const v of vars) {
        // ★名前での突き合わせはしない（Squareとアイテム一覧で表記が違うのが前提＝誤って別商品に結び付く）
        let id = bySq.get(v.sqId) || (v.gtin && byBc.get(v.gtin)) || (v.sku && bySku.get(v.sku)) || '';
        if (id && used.has(id)) continue;   // 同じ行を二重に触らない
        if (id) {
          used.add(id);
          // ★JANで一致した商品は、名前と価格を上書きしない。
          //   アイテム一覧（メーカー正規・salon.townと同じ）を正とし、Squareの表記ゆれを持ち込まない。
          //   Squareの商品IDと、空だったバーコード／メーカー品番だけを埋める。
          stmts.push(env.DB.prepare(
            `UPDATE products SET sq_id=?, barcode=CASE WHEN COALESCE(barcode,'')='' THEN ? ELSE barcode END,
                 maker_code=CASE WHEN COALESCE(maker_code,'')='' THEN ? ELSE maker_code END, active=1 WHERE id=?`
          ).bind(v.sqId, v.gtin, v.sku, id));
          updated++;
        } else {
          // アイテム一覧に無い商品（棚にはあるが正規リストに載っていない）。
          //   棚卸しで数えられるように登録するが、出所を square として区別する。
          const nid = 'p' + crypto.randomUUID().slice(0, 8);
          stmts.push(env.DB.prepare("INSERT INTO products (id,name,price,barcode,stock,ext_id,maker_code,brand,sq_id,source,active,created_at) VALUES (?,?,?,?,0,?,?,?,?,'square',1,?)")
            .bind(nid, v.name, v.price, v.gtin, '', v.sku, '', v.sqId, now));
          added++; used.add(nid);
          if (v.gtin) byBc.set(v.gtin, nid);
          byNm.set(v.name, nid); bySq.set(v.sqId, nid);
        }
      }
      try { for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50)); }
      catch (e) { return json({ error: '書き込みに失敗: ' + e.message, added, updated }, 500, cors); }
      const cnt = await env.DB.prepare('SELECT COUNT(*) c FROM products').first().catch(() => ({ c: 0 }));
      return json({ ok: true, phase, cursor: j.cursor || '', seen: objs.length, variations: vars.length,
        JANで一致_名前と価格は据え置き: updated, Squareにしか無い_新規登録: added,
        total: (cnt && cnt.c) || 0 }, 200, cors);
    }
    /* 商品の一括取り込み（5000点規模を流し込む）。
     * ★1商品ごとにDBへ問い合わせると、1回の実行で許される回数(サブリクエスト上限)を超えて落ちる。
     *   → 「既存の照合を1回のSELECTで済ませ、書き込みは batch() でまとめて1回」にする。
     * バーコード/商品ID/名前で既存を見つけて更新、無ければ追加。在庫は指定があるときだけ触る。 */
    if (p.endsWith('/products/import') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      const rows = Array.isArray(o.items) ? o.items : [];
      if (!rows.length) return json({ error: 'items が空です' }, 400, cors);
      if (rows.length > 150) return json({ error: '一度に送れるのは150件までです（分けて送ってください）' }, 400, cors);

      // 送られてきた行を整える
      const clean = [];
      let skipped = 0;
      for (const r of rows) {
        const name = String(r.name || '').trim();
        if (!name) { skipped++; continue; }
        clean.push({
          name,
          price: Math.max(0, Math.round(+r.price || 0)),
          barcode: String(r.barcode || '').replace(/[^0-9A-Za-z-]/g, '').trim(),
          extId: String(r.extId || '').trim(),
          makerCode: String(r.makerCode || '').trim(),
          brand: String(r.brand || '').trim(),
          hasStock: r.stock !== undefined && r.stock !== null && r.stock !== '',
          stock: Math.max(0, Math.round(+r.stock || 0)),
        });
      }
      if (!clean.length) return json({ ok: true, added: 0, updated: 0, skipped, total: 0 }, 200, cors);

      // 既存の照合。★DBは1回の問い合わせに渡せる値の数に上限があるので、90個ずつに割って引く
      //（まとめすぎるとエラーになり、取り込みが丸ごと落ちる）
      const byExt = new Map(), byBc = new Map(), byNm = new Map();
      const lookup = async (col, values) => {
        const vals = [...new Set(values.filter(Boolean))];
        for (let i = 0; i < vals.length; i += 90) {
          const part = vals.slice(i, i + 90);
          const res = await env.DB.prepare(
            `SELECT id,name,barcode,ext_id FROM products WHERE ${col} IN (${part.map(() => '?').join(',')})`
          ).bind(...part).all();
          for (const r of (res.results || [])) {
            if (r.ext_id) byExt.set(r.ext_id, r.id);
            if (r.barcode) byBc.set(r.barcode, r.id);
            if (r.name) byNm.set(r.name, r.id);
          }
        }
      };
      try {
        await lookup('ext_id', clean.map(x => x.extId));
        await lookup('barcode', clean.map(x => x.barcode));
        await lookup('name', clean.map(x => x.name));
      } catch (e) {
        return json({ error: '既存商品の照合に失敗: ' + (e && e.message || e) }, 500, cors);
      }

      // 書き込みは1回のbatchにまとめる（サブリクエストを使い切らない）
      const now = new Date().toISOString();
      const stmts = [];
      let added = 0, updated = 0;
      const seen = new Set();   // 同じ送信内での重複（同一IDへの二重更新）を防ぐ
      for (const x of clean) {
        let id = (x.extId && byExt.get(x.extId)) || (x.barcode && byBc.get(x.barcode)) || byNm.get(x.name) || '';
        if (id && seen.has(id)) id = '';        // 既に同じ行を更新済み → 新規として扱わず見送る
        if (id) {
          seen.add(id);
          stmts.push(x.hasStock
            ? env.DB.prepare('UPDATE products SET name=?, price=?, barcode=?, stock=?, ext_id=?, maker_code=?, brand=?, active=1 WHERE id=?')
                .bind(x.name, x.price, x.barcode, x.stock, x.extId, x.makerCode, x.brand, id)
            : env.DB.prepare('UPDATE products SET name=?, price=?, barcode=?, ext_id=?, maker_code=?, brand=?, active=1 WHERE id=?')
                .bind(x.name, x.price, x.barcode, x.extId, x.makerCode, x.brand, id));
          updated++;
        } else {
          const nid = 'p' + crypto.randomUUID().slice(0, 8);
          stmts.push(env.DB.prepare('INSERT INTO products (id,name,price,barcode,stock,ext_id,maker_code,brand,active,created_at) VALUES (?,?,?,?,?,?,?,?,1,?)')
            .bind(nid, x.name, x.price, x.barcode, x.hasStock ? x.stock : 0, x.extId, x.makerCode, x.brand, now));
          added++;
          if (x.extId) byExt.set(x.extId, nid);
          if (x.barcode) byBc.set(x.barcode, nid);
          byNm.set(x.name, nid);
          seen.add(nid);
        }
      }
      // 書き込みも割って実行する（1回のbatchが大きすぎると落ちるため）
      try {
        for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
      } catch (e) {
        return json({ error: '書き込みに失敗: ' + (e && e.message || e), added, updated }, 500, cors);
      }
      const cnt = await env.DB.prepare('SELECT COUNT(*) c FROM products').first().catch(() => ({ c: 0 }));
      return json({ ok: true, added, updated, skipped, total: (cnt && cnt.c) || 0 }, 200, cors);
    }
    /* 重複した商品をひとつにまとめる。
     * 残す側にJANを寄せて（旧JANも読めるように）、消す側は無効化して記録を残す（削除しない＝戻せる）。 */
    if (p.endsWith('/admin/merge-products') && m === 'POST') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      const pairs = Array.isArray(o.merges) ? o.merges : [];
      if (!pairs.length) return json({ error: 'merges が空です' }, 400, cors);
      if (pairs.length > 100) return json({ error: '一度に送れるのは100組までです' }, 400, cors);
      const now = new Date().toISOString();
      let merged = 0, moved = 0;
      const done = [];
      for (const mg of pairs) {
        const keep = String(mg.keepId || ''), drops = (mg.dropIds || []).map(String).filter(x => x && x !== keep);
        if (!keep || !drops.length) continue;
        const k = await env.DB.prepare('SELECT id,barcode,alt_barcodes,maker_code,sq_id FROM products WHERE id=?').bind(keep).first();
        if (!k) continue;
        const ds = await env.DB.prepare(`SELECT id,barcode,maker_code,sq_id FROM products WHERE id IN (${drops.map(() => '?').join(',')})`).bind(...drops).all();
        // JANを集める（重複は除く）
        const codes = new Set(String(k.alt_barcodes || '').split(',').filter(Boolean));
        if (k.barcode) codes.add(k.barcode);
        let sq = k.sq_id || '', mk = k.maker_code || '';
        for (const d of (ds.results || [])) {
          if (d.barcode) codes.add(d.barcode);
          if (!sq && d.sq_id) sq = d.sq_id;
          if (!mk && d.maker_code) mk = d.maker_code;
        }
        // 主バーコードは既にあるものを尊重し、無ければ集めた中の1つを使う
        const main = k.barcode || [...codes][0] || '';
        const alt = ',' + [...codes].filter(Boolean).join(',') + ',';
        const st = [
          env.DB.prepare('UPDATE products SET barcode=?, alt_barcodes=?, sq_id=?, maker_code=? WHERE id=?')
            .bind(main, codes.size ? alt : '', sq, mk, keep),
        ];
        for (const d of (ds.results || [])) {
          // 在庫が入っていたら残す側へ寄せる（いまは0だが、あとで統合しても取りこぼさない）
          st.push(env.DB.prepare(`INSERT INTO stock_by_shop (shop_id,product_id,qty,updated_at)
              SELECT shop_id, ?, qty, ? FROM stock_by_shop WHERE product_id=? AND qty<>0
              ON CONFLICT(shop_id,product_id) DO UPDATE SET qty=stock_by_shop.qty+excluded.qty, updated_at=excluded.updated_at`)
            .bind(keep, now, d.id));
          st.push(env.DB.prepare('DELETE FROM stock_by_shop WHERE product_id=?').bind(d.id));
          st.push(env.DB.prepare("UPDATE products SET active=0, merged_into=?, barcode='' WHERE id=?").bind(keep, d.id));
          moved++;
        }
        await env.DB.batch(st);
        merged++;
        done.push({ keep, drops: (ds.results || []).map(x => x.id), codes: [...codes] });
      }
      return json({ ok: true, merged, dropped: moved, done: done.slice(0, 50) }, 200, cors);
    }
    /* ===== 店舗ごとの在庫 =====
     * 免税は銀座と同じ商品を扱うため、在庫は銀座と一体（Square店舗は2つ／在庫はひとつ）。 */
    if (p.endsWith('/shops') && m === 'GET') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      await ensureRegisterTables(env);
      const r = await env.DB.prepare('SELECT * FROM shops WHERE active<>0 ORDER BY sort_num').all();
      return json({ ok: true, shops: r.results || [] }, 200, cors);
    }
    // 1商品の全店在庫（「どこにあるか」を即答するための画面用）
    if (p.endsWith('/stock/product') && m === 'GET') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      await ensureRegisterTables(env);
      const pid = url.searchParams.get('productId') || '';
      if (!pid) return json({ error: 'productId は必須' }, 400, cors);
      const r = await env.DB.prepare(`SELECT s.id shop_id, s.name shop_name, COALESCE(b.qty,0) qty
        FROM shops s LEFT JOIN stock_by_shop b ON b.shop_id=s.id AND b.product_id=?
        WHERE s.active<>0 ORDER BY s.sort_num`).bind(pid).all();
      const pr = await env.DB.prepare('SELECT id,name,price,barcode,brand FROM products WHERE id=?').bind(pid).first();
      return json({ ok: true, product: pr || null, stocks: r.results || [] }, 200, cors);
    }
    // 在庫の増減（会計・入荷・手直し）。店舗を指定して足し引きする
    if (p.endsWith('/stock/adjust') && m === 'POST') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      const shop = String(o.shopId || 'ginza'), pid = String(o.productId || '');
      const d = Math.round(+o.delta || 0);
      if (!pid || !d) return json({ error: 'productId と delta は必須' }, 400, cors);
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO stock_by_shop (shop_id,product_id,qty,updated_at) VALUES (?,?,?,?)
        ON CONFLICT(shop_id,product_id) DO UPDATE SET qty=stock_by_shop.qty+excluded.qty, updated_at=excluded.updated_at`)
        .bind(shop, pid, d, now).run();
      const cur = await env.DB.prepare('SELECT qty FROM stock_by_shop WHERE shop_id=? AND product_id=?').bind(shop, pid).first();
      // 記録を残す（あとで「いつ何が動いたか」を追える）
      await env.DB.prepare('INSERT INTO stock_adjust (id,take_id,product_id,before_qty,after_qty,diff,reason,staff,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind('sa' + crypto.randomUUID().slice(0, 8), '', pid, ((cur && cur.qty) || 0) - d, (cur && cur.qty) || 0, d, o.reason || '手直し', o.staff || '', now).run().catch(() => {});
      return json({ ok: true, shopId: shop, qty: (cur && cur.qty) || 0 }, 200, cors);
    }
    // ★店舗間の在庫移動。出す店から引いて、入れる店に足し、記録を残す
    if (p.endsWith('/stock/move') && m === 'POST') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      const pid = String(o.productId || ''), from = String(o.fromShop || ''), to = String(o.toShop || '');
      const qty = Math.round(+o.qty || 0);
      if (!pid || !from || !to) return json({ error: '商品と、出す店・入れる店が必要です' }, 400, cors);
      if (from === to) return json({ error: '同じ店舗には移動できません' }, 400, cors);
      if (qty <= 0) return json({ error: '数量は1以上にしてください' }, 400, cors);
      // 出す店の在庫が足りるか（マイナスにしない）
      const src = await env.DB.prepare('SELECT qty FROM stock_by_shop WHERE shop_id=? AND product_id=?').bind(from, pid).first();
      const have = (src && src.qty) || 0;
      if (have < qty && o.force !== true) {
        return json({ error: `出す店の在庫が足りません（${have}個しかありません）`, have }, 400, cors);
      }
      const now = new Date().toISOString();
      const mid = 'mv' + crypto.randomUUID().slice(0, 8);
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO stock_by_shop (shop_id,product_id,qty,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(shop_id,product_id) DO UPDATE SET qty=stock_by_shop.qty-?, updated_at=excluded.updated_at`).bind(from, pid, -qty, now, qty),
        env.DB.prepare(`INSERT INTO stock_by_shop (shop_id,product_id,qty,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(shop_id,product_id) DO UPDATE SET qty=stock_by_shop.qty+?, updated_at=excluded.updated_at`).bind(to, pid, qty, now, qty),
        env.DB.prepare('INSERT INTO stock_moves (id,product_id,from_shop,to_shop,qty,staff,note,created_at) VALUES (?,?,?,?,?,?,?,?)')
          .bind(mid, pid, from, to, qty, o.staff || '', o.note || '', now),
      ]);
      const a = await env.DB.prepare('SELECT qty FROM stock_by_shop WHERE shop_id=? AND product_id=?').bind(from, pid).first();
      const b = await env.DB.prepare('SELECT qty FROM stock_by_shop WHERE shop_id=? AND product_id=?').bind(to, pid).first();
      return json({ ok: true, id: mid, from: { shopId: from, qty: (a && a.qty) || 0 }, to: { shopId: to, qty: (b && b.qty) || 0 } }, 200, cors);
    }
    // 移動の履歴
    if (p.endsWith('/stock/moves') && m === 'GET') {
      if (!cleanupTok(url, env)) { const auth = A(); if (auth) return auth; }
      await ensureRegisterTables(env);
      const r = await env.DB.prepare(`SELECT mv.*, p.name product_name, sf.name from_name, st.name to_name
        FROM stock_moves mv LEFT JOIN products p ON p.id=mv.product_id
        LEFT JOIN shops sf ON sf.id=mv.from_shop LEFT JOIN shops st ON st.id=mv.to_shop
        ORDER BY mv.created_at DESC LIMIT 200`).all();
      return json({ ok: true, moves: r.results || [] }, 200, cors);
    }
    /* ===== 棚卸し（商品5000点規模）=====
     * 現場の速さを最優先にした作り：
     *  ・スキャン1回＝1往復（サーバーでバーコードを引いて数を+1して返す）。全件をブラウザに載せない
     *  ・数えた数はサーバーに置く → 中断・再開できる／複数の端末で同時に数えられる
     *  ・数えている間は理論在庫を返さない（数字に引っ張られて実数を間違えないため）
     *  ・締めてから差分だけを見せる。確定すると増減の記録を残す */
    if (p.endsWith('/stocktake') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o = {}; try { o = await request.json(); } catch (e) {}
      // 開いている棚卸しがあれば、それを返して続きから数えられるようにする
      const open = await env.DB.prepare("SELECT * FROM stocktakes WHERE status='open' ORDER BY started_at DESC LIMIT 1").first();
      if (open) return json({ ok: true, resumed: true, take: open }, 200, cors);
      const id = 'st' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();
      const shop = String(o.shopId || 'ginza');   // どの店舗を数えているか
      await env.DB.prepare('INSERT INTO stocktakes (id,name,staff,status,started_at,shop_id) VALUES (?,?,?,?,?,?)')
        .bind(id, o.name || (now.slice(0, 10) + ' 棚卸し'), o.staff || '', 'open', now, shop).run();
      return json({ ok: true, resumed: false, take: { id, name: o.name || '', staff: o.staff || '', status: 'open', started_at: now, shop_id: shop } }, 200, cors);
    }
    if (p.endsWith('/stocktake') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const id = url.searchParams.get('id');
      if (!id) {   // 一覧（履歴）
        const res = await env.DB.prepare('SELECT * FROM stocktakes ORDER BY started_at DESC LIMIT 30').all();
        return json({ ok: true, takes: res.results || [] }, 200, cors);
      }
      const take = await env.DB.prepare('SELECT * FROM stocktakes WHERE id=?').bind(id).first();
      if (!take) return json({ error: '棚卸しが見つかりません' }, 404, cors);
      const sum = await env.DB.prepare('SELECT COUNT(*) items, COALESCE(SUM(counted),0) qty FROM stocktake_counts WHERE take_id=?').bind(id).first();
      return json({ ok: true, take, items: (sum && sum.items) || 0, qty: (sum && sum.qty) || 0 }, 200, cors);
    }
    // スキャン1回。返すのは「商品名」と「いま数えた数」だけ（理論在庫は返さない）
    if (p.endsWith('/stocktake/scan') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.id) return json({ error: 'id は必須' }, 400, cors);
      const take = await env.DB.prepare("SELECT id,status FROM stocktakes WHERE id=?").bind(o.id).first();
      if (!take) return json({ error: '棚卸しが見つかりません' }, 404, cors);
      if (take.status !== 'open') return json({ error: 'この棚卸しは締められています' }, 400, cors);
      const qty = Number.isFinite(+o.qty) && +o.qty !== 0 ? Math.round(+o.qty) : 1;
      let prod = null;
      if (o.productId) prod = await env.DB.prepare('SELECT id,name,barcode FROM products WHERE id=?').bind(o.productId).first();
      else if (o.barcode) {
        const bcx = String(o.barcode).trim();
        prod = await env.DB.prepare('SELECT id,name,barcode FROM products WHERE barcode=? AND active<>0 LIMIT 1').bind(bcx).first();
        // 旧パッケージのJANでも同じ商品として数える
        if (!prod) prod = await env.DB.prepare("SELECT id,name,barcode FROM products WHERE alt_barcodes LIKE ? AND active<>0 LIMIT 1").bind('%,' + bcx + ',%').first();
      }
      // 登録の無いバーコードは、その場で登録に回せるように「見つからない」ことを明示して返す
      if (!prod) return json({ ok: false, notFound: true, barcode: String(o.barcode || '') }, 200, cors);
      const now = new Date().toISOString();
      await env.DB.prepare(`INSERT INTO stocktake_counts (take_id,product_id,counted,last_at) VALUES (?,?,?,?)
           ON CONFLICT(take_id,product_id) DO UPDATE SET counted=stocktake_counts.counted+excluded.counted, last_at=excluded.last_at`)
        .bind(o.id, prod.id, qty, now).run();
      const row = await env.DB.prepare('SELECT counted FROM stocktake_counts WHERE take_id=? AND product_id=?').bind(o.id, prod.id).first();
      const sum = await env.DB.prepare('SELECT COUNT(*) items, COALESCE(SUM(counted),0) qty FROM stocktake_counts WHERE take_id=?').bind(o.id).first();
      return json({ ok: true, product: { id: prod.id, name: prod.name, barcode: prod.barcode || '' },
        counted: (row && row.counted) || 0, items: (sum && sum.items) || 0, total: (sum && sum.qty) || 0 }, 200, cors);
    }
    // 数の直し（数え間違いの訂正）。counted をその値に置き換える
    if (p.endsWith('/stocktake/set') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.id || !o.productId) return json({ error: 'id/productId は必須' }, 400, cors);
      const v = Math.max(0, Math.round(+o.counted || 0));
      await env.DB.prepare(`INSERT INTO stocktake_counts (take_id,product_id,counted,last_at) VALUES (?,?,?,?)
           ON CONFLICT(take_id,product_id) DO UPDATE SET counted=excluded.counted, last_at=excluded.last_at`)
        .bind(o.id, o.productId, v, new Date().toISOString()).run();
      return json({ ok: true, counted: v }, 200, cors);
    }
    // 差分。合っているものは返さない（5000点でも見る量が増えないように）
    if (p.endsWith('/stocktake/diff') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'id は必須' }, 400, cors);
      const withUnscanned = url.searchParams.get('unscanned') === '1';
      // 数えた商品のうち、理論在庫と違うものだけ
      const tk = await env.DB.prepare('SELECT shop_id FROM stocktakes WHERE id=?').bind(id).first();
      const shop = (tk && tk.shop_id) || 'ginza';
      // 比べる相手は「その店舗の在庫」
      const dif = await env.DB.prepare(`
        SELECT p.id, p.name, p.barcode, p.price, COALESCE(b.qty,0) AS theory, c.counted
        FROM stocktake_counts c JOIN products p ON p.id=c.product_id
        LEFT JOIN stock_by_shop b ON b.shop_id=? AND b.product_id=p.id
        WHERE c.take_id=? AND c.counted <> COALESCE(b.qty,0) ORDER BY (c.counted - COALESCE(b.qty,0)) ASC LIMIT 2000`).bind(shop, id).all();
      // 一度も読まれていない商品（在庫があるのに読めていない＝紛失の可能性）
      let un = { results: [] };
      if (withUnscanned) {
        un = await env.DB.prepare(`
          SELECT p.id, p.name, p.barcode, p.price, b.qty AS theory
          FROM stock_by_shop b JOIN products p ON p.id=b.product_id
          WHERE b.shop_id=? AND b.qty<>0 AND p.active<>0
            AND p.id NOT IN (SELECT product_id FROM stocktake_counts WHERE take_id=?)
          ORDER BY b.qty DESC LIMIT 2000`).bind(shop, id).all();
      }
      const okCnt = await env.DB.prepare(`
        SELECT COUNT(*) c FROM stocktake_counts c JOIN products p ON p.id=c.product_id
        LEFT JOIN stock_by_shop b ON b.shop_id=? AND b.product_id=p.id
        WHERE c.take_id=? AND c.counted = COALESCE(b.qty,0)`).bind(shop, id).first();
      return json({ ok: true,
        diffs: (dif.results || []).map(r => ({ ...r, diff: (r.counted || 0) - (r.theory || 0) })),
        unscanned: (un.results || []),
        matched: (okCnt && okCnt.c) || 0 }, 200, cors);
    }
    // 確定。数えた数を在庫にして、増減を記録に残す（あとで「いつどれだけズレたか」を追える）
    if (p.endsWith('/stocktake/commit') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.id) return json({ error: 'id は必須' }, 400, cors);
      const take = await env.DB.prepare('SELECT * FROM stocktakes WHERE id=?').bind(o.id).first();
      if (!take) return json({ error: '棚卸しが見つかりません' }, 404, cors);
      if (take.status !== 'open') return json({ error: 'すでに確定しています' }, 400, cors);
      const zeroUnscanned = o.zeroUnscanned === true;   // 読めなかったものを0にするか（既定はしない）
      const shop = take.shop_id || 'ginza';
      const rows = await env.DB.prepare(`
        SELECT p.id, COALESCE(b.qty,0) AS theory, c.counted FROM stocktake_counts c JOIN products p ON p.id=c.product_id
        LEFT JOIN stock_by_shop b ON b.shop_id=? AND b.product_id=p.id
        WHERE c.take_id=? AND c.counted <> COALESCE(b.qty,0)`).bind(shop, o.id).all();
      const now = new Date().toISOString();
      let changed = 0;
      // まとめて書く（1件ずつだと回数の上限に当たる）
      const st = [];
      for (const r of (rows.results || [])) {
        st.push(env.DB.prepare(`INSERT INTO stock_by_shop (shop_id,product_id,qty,updated_at) VALUES (?,?,?,?)
          ON CONFLICT(shop_id,product_id) DO UPDATE SET qty=excluded.qty, updated_at=excluded.updated_at`).bind(shop, r.id, r.counted, now));
        st.push(env.DB.prepare('INSERT INTO stock_adjust (id,take_id,product_id,before_qty,after_qty,diff,reason,staff,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind('sa' + crypto.randomUUID().slice(0, 8), o.id, r.id, r.theory || 0, r.counted || 0, (r.counted || 0) - (r.theory || 0), '棚卸し', o.staff || take.staff || '', now));
        changed++;
      }
      for (let i = 0; i < st.length; i += 50) await env.DB.batch(st.slice(i, i + 50));
      let zeroed = 0;
      if (zeroUnscanned) {
        const un = await env.DB.prepare(`SELECT b.product_id id, b.qty FROM stock_by_shop b JOIN products p ON p.id=b.product_id
            WHERE b.shop_id=? AND b.qty<>0 AND p.active<>0
            AND b.product_id NOT IN (SELECT product_id FROM stocktake_counts WHERE take_id=?)`).bind(shop, o.id).all();
        const zs = [];
        for (const r of (un.results || [])) {
          zs.push(env.DB.prepare('UPDATE stock_by_shop SET qty=0, updated_at=? WHERE shop_id=? AND product_id=?').bind(now, shop, r.id));
          zs.push(env.DB.prepare('INSERT INTO stock_adjust (id,take_id,product_id,before_qty,after_qty,diff,reason,staff,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
            .bind('sa' + crypto.randomUUID().slice(0, 8), o.id, r.id, r.qty || 0, 0, -(r.qty || 0), '棚卸し（読み取りなし→0）', o.staff || take.staff || '', now));
          zeroed++;
        }
        for (let i = 0; i < zs.length; i += 50) await env.DB.batch(zs.slice(i, i + 50));
      }
      await env.DB.prepare("UPDATE stocktakes SET status='done', closed_at=?, note=? WHERE id=?")
        .bind(now, o.note || '', o.id).run();
      return json({ ok: true, changed, zeroed }, 200, cors);
    }
    if (p.endsWith('/stocktake/cancel') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const id = url.searchParams.get('id');
      if (!id) return json({ error: 'id は必須' }, 400, cors);
      await env.DB.prepare("UPDATE stocktakes SET status='cancelled', closed_at=? WHERE id=?").bind(new Date().toISOString(), id).run();
      await env.DB.prepare('DELETE FROM stocktake_counts WHERE take_id=?').bind(id).run();
      return json({ ok: true }, 200, cors);
    }
    // 在庫の増減記録（棚卸し以外の手直しも含めて後から追える）
    if (p.endsWith('/stock/adjust') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const res = await env.DB.prepare(`SELECT a.*, p.name FROM stock_adjust a LEFT JOIN products p ON p.id=a.product_id
        ORDER BY a.created_at DESC LIMIT 300`).all();
      return json({ ok: true, adjusts: res.results || [] }, 200, cors);
    }
    if (p.endsWith('/products') && m === 'GET') return (cleanupTok(url, env) ? null : A()) || handleGetProducts(url, env, cors);
    if (p.endsWith('/products') && m === 'POST') return A() || handlePostProduct(request, env, cors);
    if (p.endsWith('/products') && m === 'DELETE') return A() || handleDeleteProduct(url, env, cors);
    if (p.endsWith('/intakes') && m === 'GET') return A() || handleGetIntakes(url, env, cors);
    if (p.endsWith('/intakes') && m === 'POST') return A() || handlePostIntake(request, env, cors);
    if (p.endsWith('/intakes') && m === 'DELETE') return A() || handleDeleteIntake(url, env, cors);
    // 自社ポイント台帳（付与/利用の増減行）。DELETEはref=会計ID単位（会計取消時の巻き戻し）
    if (p.endsWith('/points') && m === 'GET') return A() || handleGetPoints(url, env, cors);
    if (p.endsWith('/points') && m === 'POST') return A() || handlePostPoint(request, env, cors);
    if (p.endsWith('/points') && m === 'DELETE') return A() || handleDeletePoints(url, env, cors);
    // ギフト券（発行/更新はPOSTのupsert・無効化はDELETE）
    if (p.endsWith('/gifts') && m === 'GET') return A() || handleGetGifts(env, cors);
    if (p.endsWith('/gifts') && m === 'POST') return A() || handlePostGift(request, env, cors);
    if (p.endsWith('/gifts') && m === 'DELETE') return A() || handleDeleteGift(url, env, cors);
    // 回数券・パス
    if (p.endsWith('/passes') && m === 'GET') return A() || handleGetPasses(env, cors);
    if (p.endsWith('/passes') && m === 'POST') return A() || handlePostPass(request, env, cors);
    if (p.endsWith('/passes') && m === 'DELETE') return A() || handleDeletePass(url, env, cors);
    // カウンセリングシート＋同意書（来店時にiPadで記入 → カルテに保存）
    if (p.endsWith('/counseling') && m === 'POST') {
      // スタッフの管理トークン、または運用トークン(検証用)のどちらかで受け付ける
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.name) return json({ error: 'お名前は必須です' }, 400, cors);
      {
        // 受付シートの名前もサロンボードへ渡るため 予約と同じ規則で通す
        const chk = (o.sei != null || o.mei != null)
          ? checkNameParts(o.sei, o.mei, o.seiK, o.meiK)
          : checkNameJoined(o.name, o.kana);
        if (chk.ng) return json({ error: chk.ng }, 400, cors);
        o.name = chk.name; if (chk.kana) o.kana = chk.kana;
      }
      if (!o.consent || !o.consent.agreed) return json({ error: '同意のチェックが必要です' }, 400, cors);
      // 電話番号は必須。カルテのキーを常に電話にすることで、同姓同名でも取り違えない
      const ph = String(o.phone || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/[^0-9]/g, '');
      if (ph.length < 8) return json({ error: '電話番号は必須です（数字8桁以上）' }, 400, cors);
      const key = ph;
      // 母国語で書かれた自由記入は、この時点で日本語にして一緒に保存する（原文はそのまま残す）
      const lang = ['ja', 'en', 'zh', 'tw', 'ko'].includes(o.lang) ? o.lang : 'ja';
      if (lang !== 'ja' && o.answers) {
        const [wj, cj] = await Promise.all([toJa(env, o.answers.want, lang), toJa(env, o.answers.caution, lang)]);
        if (wj) o.answers.wantJa = wj;
        if (cj) o.answers.cautionJa = cj;
      }
      const id = 'cs' + crypto.randomUUID().slice(0, 8);
      await env.DB.prepare(
        `INSERT INTO counseling (id,key,name,phone,kind,lang,answers,consent,sign,staff,date,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      ).bind(id, key, o.name, ph, o.kind || 'hair', lang,
        JSON.stringify(o.answers || {}),
        JSON.stringify(o.consent || {}), (o.sign || '').slice(0, 300000), o.staff || '',
        o.date || new Date().toISOString().slice(0, 10), new Date().toISOString()).run();
      // 施術上の注意（アレルギー等）と写真/音声AIの可否をカルテの重要メモへ自動反映＝施術前に必ず目に入る
      // ★赤い警告（重要メモ）に機械翻訳は入れない。
      // 実測で「染毛剤」が消える／出力が崩壊する事故が出たため、警告文はお客様の原文のままにし、
      // 外国語であることを印で伝えて、担当者が本人に確認する動きを作る。
      // 下訳はシート側(answers.cautionJa)に持ち、カルテで原文と並べて「要確認」つきで見せる。
      const cRaw = (o.answers && o.answers.caution || '').trim();
      const caution = (cRaw && lang !== 'ja') ? (cRaw + '（外国語の記入・要確認）') : cRaw;
      const cs = o.consent || {};
      // 撮影の可否は毎回「最新の意思」で上書きする（前回OKでも今回NGならNGが正しい）
      // ★未選択を 'karte' に丸めていたのは誤り（選んでいない同意を記録することになる）→ 空のまま持つ
      const photo = ['no', 'karte', 'sns'].includes(cs.photo) ? cs.photo : (cs.photo === true ? 'sns' : '');
      const voice = cs.voice === 'no' ? 'no' : 'ok';
      const video = ['no', 'karte', 'sns'].includes(cs.video) ? cs.video : '';
      if (caution || photo || voice) {
        const prev = await env.DB.prepare('SELECT caution,birthday FROM customer_notes WHERE key=?').bind(key).first().catch(() => null);
        let merged = (prev && prev.caution) || '';
        if (caution && !merged.includes(caution)) merged = [merged, caution].filter(Boolean).join(' / ');
        await env.DB.prepare(`INSERT INTO customer_notes (key,caution,birthday,photo_policy,face_ng,video_policy,voice_policy,updated_at)
             VALUES (?,?,?,?,?,?,?,?)
             ON CONFLICT(key) DO UPDATE SET caution=excluded.caution, birthday=COALESCE(NULLIF(excluded.birthday,''),customer_notes.birthday),
               photo_policy=excluded.photo_policy, face_ng=excluded.face_ng, video_policy=excluded.video_policy,
               voice_policy=excluded.voice_policy, updated_at=excluded.updated_at`)
          .bind(key, merged, (o.answers && o.answers.birthMonth) || (prev && prev.birthday) || '',
            photo, cs.faceNg ? 1 : 0, video, voice, new Date().toISOString()).run().catch(() => {});
      }
      return json({ ok: true, id }, 200, cors);
    }
    // 顧客データの一枚まとめ（担当者が施術前にこれだけ見れば分かる状態にする）
    // 予約・会計・シート・髪格診断・同意・重要メモ・ポイント・回数券を1つのJSONに集約
    if (p.endsWith('/customer/profile') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const raw = url.searchParams.get('key') || '';
      if (!raw) return json({ error: 'key が必要です' }, 400, cors);
      const ph = raw.replace(/[^0-9]/g, '');
      const key = ph || raw;                       // 電話が無い方は 'n:氏名' キー
      const like = ph ? null : String(raw).replace(/^n:/, '');
      const P = (q, ...b) => env.DB.prepare(q).bind(...b).all().then(r => r.results || []).catch(() => []);
      const jp = v => { try { return JSON.parse(v || '{}'); } catch { return {}; } };

      // 予約は電話の表記ゆれを吸収して突き合わせる。会計/回数券/写真は氏名キーなので氏名で引く
      const nameGuess = await (async () => {
        const r = await env.DB.prepare('SELECT name FROM counseling WHERE key=? ORDER BY created_at DESC LIMIT 1').bind(key).first().catch(() => null);
        if (r && r.name) return r.name;
        if (like) return like;
        const r2 = await env.DB.prepare("SELECT name FROM reservations WHERE replace(replace(phone,'-',''),' ','')=? ORDER BY date DESC LIMIT 1").bind(ph).first().catch(() => null);
        return (r2 && r2.name) || '';
      })();
      // 同姓同名がいるかを先に判定する。いる場合、電話を持たない古い行は
      // どちらの人のものか決められないので、氏名での取り込みをやめる（誤って両方に足さない）
      let sameName = 0;
      if (nameGuess) {
        const r = await env.DB.prepare('SELECT COUNT(DISTINCT key) c FROM counseling WHERE name=? AND key<>?').bind(nameGuess, key).first().catch(() => null);
        sameName = (r && r.c) || 0;
      }
      const byName = sameName === 0 ? nameGuess : '\u0000';   // 同姓同名がいるときは氏名一致を無効化
      const [notes, sheets, resv, chk, pts, pass, photos] = await Promise.all([
        env.DB.prepare('SELECT * FROM customer_notes WHERE key=?').bind(key).first().catch(() => null),
        P('SELECT * FROM counseling WHERE key=? ORDER BY created_at DESC LIMIT 30', key),
        ph ? P("SELECT id,date,start,end,menu_id,staff_id,name,status,channel,note,deposit FROM reservations WHERE replace(replace(phone,'-',''),' ','')=? ORDER BY date DESC LIMIT 60", ph)
           : P('SELECT id,date,start,end,menu_id,staff_id,name,status,channel,note,deposit FROM reservations WHERE name=? ORDER BY date DESC LIMIT 60', like),
        // 電話があれば電話で引く。電話を持たない古い行だけ氏名で拾う（同姓同名の混在を防ぐ）
        ph ? P("SELECT id,date,tech,retail,discount,total,method,nominated,retail_items FROM checkouts WHERE phone=? OR (COALESCE(phone,'')='' AND customer=?) ORDER BY date DESC LIMIT 60", ph, byName)
           : (nameGuess ? P('SELECT id,date,tech,retail,discount,total,method,nominated,retail_items FROM checkouts WHERE customer=? ORDER BY date DESC LIMIT 60', nameGuess) : []),
        ph ? P("SELECT delta,reason,date FROM points WHERE replace(replace(phone,'-',''),' ','')=? ORDER BY date DESC LIMIT 200", ph)
           : (nameGuess ? P('SELECT delta,reason,date FROM points WHERE name=? ORDER BY date DESC LIMIT 200', nameGuess) : []),
        ph ? P("SELECT id,label,remaining,expires FROM passes WHERE (phone=? OR (COALESCE(phone,'')='' AND customer=?)) AND void=0", ph, byName)
           : (nameGuess ? P('SELECT id,label,remaining,expires FROM passes WHERE customer=? AND void=0', nameGuess) : []),
        ph ? P("SELECT id,date FROM karte_photos WHERE phone=? OR (COALESCE(phone,'')='' AND name=?) ORDER BY date DESC LIMIT 40", ph, byName)
           : (nameGuess ? P('SELECT id,date FROM karte_photos WHERE name=? ORDER BY date DESC LIMIT 40', nameGuess) : []),
      ]);

      const live = sheets.filter(x => !x.voided);
      const parsed = live.map(x => ({ ...x, answers: jp(x.answers), consent: jp(x.consent), sign: x.sign ? true : false }));
      const latest = parsed[0] || null;
      const finder = (parsed.find(x => x.answers.finder) || { answers: {} }).answers.finder || null;
      // 施術上の注意は、重要メモとシートの自由記入を合わせて拾う（見落としを作らない）
      const cautions = [...new Set([(notes && notes.caution) || '', ...parsed.map(x => x.answers.caution || '')].filter(Boolean))];
      const paid = chk.reduce((a, c) => a + (+c.total || 0), 0);
      // 同姓同名がいる場合、電話を持たない古い会計は誰のものか決められない。件数だけ伝える
      let legacyUnlinked = 0;
      if (sameName > 0 && nameGuess) {
        const r = await env.DB.prepare("SELECT COUNT(*) c FROM checkouts WHERE customer=? AND COALESCE(phone,'')=''").bind(nameGuess).first().catch(() => null);
        legacyUnlinked = (r && r.c) || 0;
      }
      const visits = resv.filter(r => r.status === 'done').length;
      const merge = (k) => [...new Set(parsed.flatMap(x => [].concat(x.answers[k] || [])))].filter(Boolean);

      return json({
        ok: true, key,
        name: nameGuess || (latest && latest.name) || '',
        phone: ph || '', lang: (latest && latest.lang) || 'ja',
        birthday: (notes && notes.birthday) || '',
        cautions,
        consent: notes ? {
          photo: notes.photo_policy || '', faceNg: !!notes.face_ng,
          video: notes.video_policy || '', voice: notes.voice_policy || '',
        } : null,
        finder,
        profile: { concern: merge('concern'), history: merge('history'), body: merge('body'), scalp: merge('scalp'), care: merge('care'), henna: (latest && latest.answers.henna) || '' },
        wants: parsed.map(x => ({ date: x.date, lang: x.lang || 'ja', text: x.answers.want || '', ja: x.answers.wantJa || '' })).filter(x => x.text),
        sheets: parsed.map(x => ({ id: x.id, date: x.date, kind: x.kind, lang: x.lang || 'ja', signed: x.sign, agreed: !!x.consent.agreed })),
        voidedSheets: sheets.filter(x => x.voided).length,
        visits, sales: paid, checkouts: chk.length,
        reservations: resv.slice(0, 20),
        points: pts.reduce((a, r) => a + (+r.delta || 0), 0), passes: pass, photos: photos.length,
        sameName: sameName,   // 同姓同名の他の方がいるか（電話が違えば別人＝取り違え注意の目印）
        legacyUnlinked: legacyUnlinked,   // 同姓同名のため、どちらの方か決められない古い記録の件数
      }, 200, cors);
    }
    // 同意書は消さない（オーナー方針 2026-07-30）。あとで何かあったときに記録が無いのが一番まずい。
    // 二重提出などは「取り消し」印をつけるだけ＝一覧では薄く出るが記録そのものは残る。
    if (p.endsWith('/counseling/void') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.id) return json({ error: 'id が必要です' }, 400, cors);
      const row = await env.DB.prepare('SELECT id FROM counseling WHERE id=?').bind(o.id).first();
      if (!row) return json({ error: 'シートが見つかりません' }, 404, cors);
      const undo = o.undo === true;
      await env.DB.prepare('UPDATE counseling SET voided=?, void_reason=? WHERE id=?')
        .bind(undo ? 0 : 1, undo ? '' : String(o.reason || '取り消し'), o.id).run();
      return json({ ok: true, id: o.id, voided: !undo }, 200, cors);
    }
    // 髪格診断(seam.site/finder)の結果を、提出済みのカウンセリングシートに後から紐付ける
    // お客様が待ち時間に診断→スタッフの手を介さずカルテに届く導線
    if (p.endsWith('/counseling/attach') && m === 'POST') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.id || !o.finder) return json({ error: 'id と finder が必要です' }, 400, cors);
      const row = await env.DB.prepare('SELECT answers FROM counseling WHERE id=?').bind(o.id).first();
      if (!row) return json({ error: 'シートが見つかりません' }, 404, cors);
      let a = {}; try { a = JSON.parse(row.answers || '{}'); } catch (e) {}
      const f = o.finder;
      a.finder = {
        typeId: String(f.typeId || ''), typeName: String(f.typeName || ''),
        damageTier: String(f.damageTier || ''), originName: String(f.originName || ''),
        mainGoalName: String(f.mainGoalName || ''), radar: f.radar || null,
        savedAt: String(f.savedAt || new Date().toISOString())
      };
      await env.DB.prepare('UPDATE counseling SET answers=? WHERE id=?').bind(JSON.stringify(a), o.id).run();
      return json({ ok: true, id: o.id }, 200, cors);
    }
    // カウンセリング集計（毎月のミーティング用・悩み/ことば/同意率を数字で見る）
    if (p.endsWith('/counseling/stats') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const from = url.searchParams.get('from') || '2000-01-01', to = url.searchParams.get('to') || '2999-12-31';
      const kindQ = url.searchParams.get('kind') || '';
      const res = await env.DB.prepare(
        `SELECT id,name,kind,date,lang,answers,consent,voided FROM counseling WHERE date>=? AND date<=? ORDER BY date DESC LIMIT 5000`
      ).bind(from, to).all();
      let rows = (res.results || []).filter(r => !/^(テスト|検証|再検証|ダミー)/.test(r.name || '') && !r.voided);
      if (kindQ) rows = rows.filter(r => r.kind === kindQ);

      const bump = (m2, k) => { if (!k) return; m2[k] = (m2[k] || 0) + 1; };
      const chips = { concern: {}, history: {}, body: {}, scalp: {}, care: {} };
      const consent = { photo: {}, video: {}, voice: {}, faceNg: 0 };
      const byMonth = {}, quotes = [];
      const words = {}, wordEg = {};
      const finder = { done: 0, type: {}, damage: {}, goal: {}, origin: {} };
      const byLang = {};
      // 助詞・言い回しは数えない（「ことば」として意味を持つ語だけ残す）
      const STOP = new Set(['ください', 'おねがい', 'お願い', 'したい', 'ほしい', '思います', 'カット', 'カラー', 'サロン', 'ヘア']);

      for (const r of rows) {
        let a = {}, c = {};
        try { a = JSON.parse(r.answers || '{}'); } catch (e) {}
        try { c = JSON.parse(r.consent || '{}'); } catch (e) {}
        bump(byMonth, (r.date || '').slice(0, 7));
        bump(byLang, r.lang || 'ja');
        for (const k of Object.keys(chips)) {
          const v = a[k];
          if (Array.isArray(v)) v.forEach(x => bump(chips[k], x));
          else if (v) bump(chips[k], v);
        }
        const ph = ['no', 'karte', 'sns'].includes(c.photo) ? c.photo : (c.photo === true ? 'sns' : (c.photo === false ? 'no' : 'unset'));
        bump(consent.photo, ph);
        bump(consent.voice, c.voice === 'no' ? 'no' : 'ok');
        if (c.faceNg) consent.faceNg++;
        bump(consent.video, ['no', 'karte', 'sns'].includes(c.video) ? c.video : 'unset');

        if (a.finder) { finder.done++;
          bump(finder.type, a.finder.typeName || a.finder.typeId);
          bump(finder.damage, a.finder.damageTier); bump(finder.goal, a.finder.mainGoalName);
          bump(finder.origin, a.finder.originName); }
        // 自由記入＝お客様のことば。原文も残す（会議で読む用）
        const texts = [a.want, a.caution, a.careFree].filter(Boolean).map(String);
        for (const t of texts) {
          if (t.trim().length > 3) quotes.push({ date: r.date, kind: r.kind, text: t.trim().slice(0, 200) });
          // カタカナ語・漢字語を2文字以上のまとまりで拾う（形態素解析なしの実用近似）
          const cand = (t.match(/[ァ-ヴー]{2,}|[一-龥]{2,}/g) || []);
          const seen = new Set();
          for (let w of cand) {
            w = w.replace(/^(の|に|は|を|が|で|と)+/, '');
            if (w.length < 2 || w.length > 8 || STOP.has(w) || seen.has(w)) continue;
            seen.add(w); bump(words, w);
            if (!wordEg[w]) wordEg[w] = t.trim().slice(0, 120);
          }
        }
      }
      const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ k, n: v }));
      return json({
        ok: true, total: rows.length, from, to,
        byMonth: Object.entries(byMonth).sort().map(([k, v]) => ({ k, n: v })),
        byLang: Object.entries(byLang).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ k, n: v })),
        concern: top(chips.concern, 30), history: top(chips.history, 30), body: top(chips.body, 30),
        scalp: top(chips.scalp, 30), care: top(chips.care, 30),
        consent, words: top(words, 40).map(w => ({ ...w, eg: wordEg[w.k] || '' })),
        finder: { done: finder.done, type: top(finder.type, 30), damage: top(finder.damage, 10), goal: top(finder.goal, 20), origin: top(finder.origin, 20) },
        quotes: quotes.slice(0, 80)
      }, 200, cors);
    }
    if (p.endsWith('/counseling') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const key = url.searchParams.get('key');
      const res = key
        ? await env.DB.prepare('SELECT * FROM counseling WHERE key=? ORDER BY created_at DESC LIMIT 20').bind(key).all()
        : await env.DB.prepare('SELECT id,key,name,phone,kind,date,created_at FROM counseling ORDER BY created_at DESC LIMIT 100').all();
      return json({ ok: true, sheets: (res.results || []).map(r => ({ ...r,
        answers: (() => { try { return JSON.parse(r.answers || '{}'); } catch { return {}; } })(),
        consent: (() => { try { return JSON.parse(r.consent || '{}'); } catch { return {}; } })() })) }, 200, cors);
    }
    // 顧客ノート(重要メモ/誕生月)
    if (p.endsWith('/custnotes') && m === 'GET') {
      if (!(env.CLEANUP_TOKEN && url.searchParams.get('token') === env.CLEANUP_TOKEN)) { const auth = A(); if (auth) return auth; }
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const res = await env.DB.prepare('SELECT * FROM customer_notes LIMIT 2000').all();
      return json({ ok: true, notes: res.results || [] }, 200, cors);
    }
    if (p.endsWith('/custnotes') && m === 'POST') {
      const auth = A(); if (auth) return auth;
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.key) return json({ error: 'key必須' }, 400, cors);
      // 重要メモ/誕生月だけを更新する。写真・音声AIの同意はお客様の意思表示なのでここでは触らない
      await env.DB.prepare(`INSERT INTO customer_notes (key,caution,birthday,updated_at) VALUES (?,?,?,?)
           ON CONFLICT(key) DO UPDATE SET caution=excluded.caution, birthday=excluded.birthday, updated_at=excluded.updated_at`)
        .bind(o.key, o.caution || '', o.birthday || '', new Date().toISOString()).run();
      return json({ ok: true }, 200, cors);
    }
    // カルテ写真(顧客名キー・圧縮JPEG dataURL)
    if (p.endsWith('/karte/photos') && m === 'GET') {
      const auth = A(); if (auth) return auth;
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const nm = url.searchParams.get('name') || '';
      const res = await env.DB.prepare('SELECT id,name,date,data,created_at FROM karte_photos WHERE name=? ORDER BY created_at DESC LIMIT 40').bind(nm).all();
      return json({ ok: true, photos: res.results || [] }, 200, cors);
    }
    if (p.endsWith('/karte/photo') && m === 'POST') {
      const auth = A(); if (auth) return auth;
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
      if (!o.name || !o.data || !/^data:image\/jpeg;base64,/.test(o.data)) return json({ error: 'name/data(JPEG dataURL)必須' }, 400, cors);
      if (o.data.length > 600000) return json({ error: '画像が大きすぎます(圧縮後600KBまで)' }, 400, cors);
      const id = 'kp' + crypto.randomUUID().slice(0, 8);
      await env.DB.prepare('INSERT INTO karte_photos (id,name,phone,date,data,created_at) VALUES (?,?,?,?,?,?)')
        .bind(id, o.name, telN(o.phone), o.date || new Date().toISOString().slice(0, 10), o.data, new Date().toISOString()).run();
      return json({ ok: true, id }, 200, cors);
    }
    if (p.endsWith('/karte/photo') && m === 'DELETE') {
      const auth = A(); if (auth) return auth;
      if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
      await ensureRegisterTables(env);
      const id = url.searchParams.get('id'); if (!id) return json({ error: 'id必須' }, 400, cors);
      await env.DB.prepare('DELETE FROM karte_photos WHERE id=?').bind(id).run();
      return json({ ok: true }, 200, cors);
    }
    return json({ error: 'Not found' }, 404, cors);
  },

  // 前日リマインドの自動送信（Cloudflare Cron Triggers）。明日の予約でlineUserIdがあるものにpush。
  async scheduled(event, env, ctx) {
    if (!env.DB || !env.LINE_CHANNEL_ACCESS_TOKEN) return;
    const t = new Date(event.scheduledTime + 24 * 3600 * 1000);
    const tomorrow = `${t.getUTCFullYear()}-${z(t.getUTCMonth() + 1)}-${z(t.getUTCDate())}`;
    const rows = await env.DB.prepare(
      "SELECT * FROM reservations WHERE date = ? AND line_user_id != '' AND status = 'booked'"
    ).bind(tomorrow).all();
    const list = rows.results || [];
    if (!list.length) return;
    // ★台帳ドリフト対策(2026-07-26): salon.town側で削除/キャンセル済みの予約へリマインドを送らない。
    //   送信前に明日分の生存予約IDを両店から取得して照合。消えていたらD1もcancelledへ自己修復。
    //   API不通/空応答(稀にブレる)時は照合スキップ=従来通り送る(リマインド全停止を避ける)。
    let live = null;
    if (env.SALON_SYNC === 'on' && env.SALON_HOST) {
      try {
        const set = new Set(); let okAll = true, total = 0;
        for (const sid of [env.SALON_SHOP_ID, env.SALON_SPA_SHOP_ID].filter(Boolean)) {
          const j = await salonCall(env, '/get/reservation', {
            filter: { shop_id: sid, reserve_date_start: tomorrow, reserve_date_end: tomorrow + ' 23:59' }, limit: 300,
          });
          if (!j.result) { okAll = false; break; }
          for (const r of (j.data || [])) { total++; if (!r.delete_date && !r.cancel_date) set.add(r.id); }
        }
        if (okAll) live = set;   // result:false や例外時は null のまま=照合しない
      } catch (e) { live = null; }
    }
    for (const r of list) {
      if (live && r.salon_id && !live.has(r.salon_id)) {
        await env.DB.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").bind(r.id).run().catch(() => {});
        console.log('リマインドskip(salon.townで消滅)→D1をcancelledに:', r.id, r.name);
        continue;
      }
      const mn = MENUS.find(x => x.id === r.menu_id), st = STAFF.find(x => x.id === r.staff_id);
      await linePush(env, r.line_user_id, buildLineMessage('reminder', {
        date: r.date, time: min2hm(r.start), menu: (mn && mn.name) || '', staff: (st && st.name) || '', salon: 'SEAM 銀座',
      }));
    }
    // ===== 来店後の自動フォロー(A2サンクス/A1周期/B3休眠) — 失敗してもリマインドには影響させない =====
    try { await runFollowups(env, event.scheduledTime); } catch (e) { console.log('フォロー送信エラー:', e.message); }
    // ===== 同期漏れの自己修復: salonPush失敗でD1にだけ残った予約を毎朝再push =====
    try { const rp = await repushMissing(env, true); if (rp.missing) console.log('再push:', JSON.stringify(rp.results)); } catch (e) { console.log('再pushエラー:', e.message); }
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
      console.log('パース結果=', r ? `${r.shop} ${r.name} ${r.date} ${r.start} ${r.cancelled ? 'CANCEL' : ''}` : 'null（対象外/解析失敗）');
      if (r && env.DB) {
        const shopName = r.shop === 'spa' ? 'SEAM 銀座（スパ）' : 'SEAM 銀座（ヘア）';
        if (r.cancelled) {
          // キャンセル連絡＝既存台帳を取消へ（予約番号ベースIDで一致）。無ければ何もしない。
          await env.DB.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").bind(r.id).run();
          console.log('D1キャンセル反映 id=', r.id);
          await notifyOwner(env, `HPBキャンセル ${r.name}様 ${r.date.slice(5)} ${min2hm(r.start)}`,
            `${shopName}の予約がキャンセルされました。\n\n日時: ${r.date.replace(/-/g, '/')} ${min2hm(r.start)}〜\nお客様: ${r.name}\n${r.note}`);
        } else {
          await env.DB.prepare(
            `INSERT OR IGNORE INTO reservations (id,date,staff_id,start,end,menu_id,name,phone,email,note,channel,status,hpb_blocked,deposit,line_user_id,created_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          ).bind(r.id, r.date, r.staffId, r.start, r.end, r.menuId, r.name, '', '', r.note, 'hpb', 'booked', 1, 0, '', new Date().toISOString()).run();
          console.log('D1へINSERT完了 id=', r.id, 'shop=', r.shop);
          // オーナーへ通知（どちらの掲載＝ヘア/スパかを明記）
          await notifyOwner(env, `新規HPB予約[${r.shop === 'spa' ? 'スパ' : 'ヘア'}] ${r.name}様 ${r.date.slice(5)} ${min2hm(r.start)}`,
            `${shopName}に予約が入りました。\n\n日時: ${r.date.replace(/-/g, '/')} ${min2hm(r.start)}〜\nお客様: ${r.name}\n${r.note}`);
        }
      }
    } catch (e) { console.log('EMAIL処理エラー:', e.message); }
    // スタッフの受信箱にも転送（send_email バインディング経由）
    // hpb@seam.site に届いたメールを suenotakemi@gmail.com にも転送
    try {
      await message.forward('suenotakemi@gmail.com');
    } catch (e) {
      console.log('転送エラー:', e.message);
    }
  },
};

/* ===== 来店後の自動フォロー(毎朝9時JSTのcronから) =====
 * A2: 来店翌日サンクス+Googleクチコミ依頼 / A1: 施術周期の「そろそろ」リマインド / B3: 90日休眠の呼び戻し+pt。
 * いずれもLINE連携客のみ・nudgesテーブルで一度きり送信・次の予約が既に入っている人には送らない。 */
const MENU_CYCLE = (id) => {
  if (['m13', 'm14', 'm15', 'cp10', 'cp11', 'cp13'].includes(id)) return 21;   // ヘッドスパ
  if (['m8', 'm9', 'cp5'].includes(id)) return 90;                             // 縮毛矯正
  if (['m6', 'm7'].includes(id)) return 56;                                    // パーマ
  if (['m10', 'm11', 'm12'].includes(id)) return 30;                           // トリートメント
  return 42;                                                                   // カット/カラー/その他
};
async function runFollowups(env, nowMs) {
  if (!env.DB || !env.LINE_CHANNEL_ACCESS_TOKEN) return;
  const d0 = new Date(nowMs);
  const ds = (offsetDays) => { const t = new Date(nowMs + offsetDays * 86400000); return `${t.getUTCFullYear()}-${z(t.getUTCMonth() + 1)}-${z(t.getUTCDate())}`; };
  const today = ds(0), yesterday = ds(-1);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS nudges (kind TEXT, key TEXT, date TEXT, PRIMARY KEY(kind,key))`).run().catch(() => {});
  const once = async (kind, key) => {
    const hit = await env.DB.prepare('SELECT 1 AS x FROM nudges WHERE kind=? AND key=?').bind(kind, key).first();
    if (hit) return false;
    await env.DB.prepare('INSERT OR IGNORE INTO nudges (kind,key,date) VALUES (?,?,?)').bind(kind, key, today).run();
    return true;
  };
  const BOOK_URL = env.BOOK_URL || 'https://suenotakemi-cloud.github.io/seam-website/booking/index.html?src=line';
  const REVIEW_URL = env.GOOGLE_REVIEW_URL || ('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('SEAM 銀座 美容室'));
  let sent = 0; const CAP = 30;   // 1回のcronで送る上限(安全弁)

  // A2: 昨日ご来店(会計済=done)のお客様へサンクス+クチコミ依頼
  const doneY = await env.DB.prepare("SELECT * FROM reservations WHERE date=? AND status='done' AND line_user_id!=''").bind(yesterday).all();
  for (const r of (doneY.results || [])) {
    if (sent >= CAP) break;
    if (!(await once('thanks', r.id))) continue;
    await linePush(env, r.line_user_id,
      `【SEAM 銀座】${(r.name || 'お客様')}様\n\n昨日はご来店いただきありがとうございました🌿\n仕上がりはいかがでしょうか。気になる点があればいつでもLINEでご相談ください。\n\nもしよろしければ、Googleでのクチコミがスタッフの励みになります✍️\n${REVIEW_URL}`);
    sent++;
  }

  // A1: 施術周期リマインド(前回done+周期日ちょうど・次の予約なし)
  const past = await env.DB.prepare(
    "SELECT * FROM reservations WHERE status='done' AND line_user_id!='' AND date>=? AND date<=?"
  ).bind(ds(-100), ds(-14)).all();
  for (const r of (past.results || [])) {
    if (sent >= CAP) break;
    const cyc = MENU_CYCLE(r.menu_id);
    const days = Math.round((Date.parse(today) - Date.parse(r.date)) / 86400000);
    if (days !== cyc) continue;
    const future = await env.DB.prepare(
      "SELECT 1 AS x FROM reservations WHERE line_user_id=? AND date>=? AND status='booked' LIMIT 1"
    ).bind(r.line_user_id, today).first();
    if (future) continue;
    if (!(await once('cycle', r.id))) continue;
    const mn = MENUS.find(x => x.id === r.menu_id);
    const wk = Math.round(cyc / 7);
    await linePush(env, r.line_user_id,
      `【SEAM 銀座】${(r.name || 'お客様')}様\n\n前回の${(mn && mn.name) || 'ご来店'}から約${wk}週間が経ちました。そろそろ次のお手入れの時期です✨\n\nご都合の良い時間をこちらからどうぞ（30秒で完了します）\n${BOOK_URL}`);
    sent++;
  }

  // B3: 90日休眠の呼び戻し(最終来店からちょうど90日・次の予約なし・お礼pt付き)
  const wbRow = await env.DB.prepare("SELECT value FROM settings WHERE key='winbackPt'").first().catch(() => null);
  const ptOn = await env.DB.prepare("SELECT value FROM settings WHERE key='pointEnabled'").first().catch(() => null);
  const wbPt = (!ptOn || ptOn.value !== '0') ? Math.max(0, +(wbRow && wbRow.value) || 500) : 0;
  const lastVisits = await env.DB.prepare(
    "SELECT line_user_id, MAX(date) AS last, name FROM reservations WHERE status='done' AND line_user_id!='' GROUP BY line_user_id"
  ).all();
  for (const v of (lastVisits.results || [])) {
    if (sent >= CAP) break;
    const days = Math.round((Date.parse(today) - Date.parse(v.last)) / 86400000);
    if (days !== 90) continue;
    const future = await env.DB.prepare(
      "SELECT 1 AS x FROM reservations WHERE line_user_id=? AND date>=? AND status='booked' LIMIT 1"
    ).bind(v.line_user_id, today).first();
    if (future) continue;
    if (!(await once('winback', v.line_user_id + '-' + v.last))) continue;
    if (wbPt > 0) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO points (id,name,phone,delta,reason,ref,date,created_at) VALUES (?,?,?,?,?,?,?,?)`
      ).bind('pt' + crypto.randomUUID().slice(0, 8), v.name || '', '', wbPt, '休眠復帰ポイント', 'winback-' + v.last, today, new Date().toISOString()).run().catch(() => {});
    }
    await linePush(env, v.line_user_id,
      `【SEAM 銀座】${(v.name || 'お客様')}様\n\nお久しぶりです🌿 その後、髪の調子はいかがですか？\n${wbPt > 0 ? `またお会いできるのを楽しみに、次回のお会計で使える ${wbPt}pt をご用意しました🎁\n\n` : '\n'}ご予約はこちらからどうぞ\n${BOOK_URL}`);
    sent++;
  }
  console.log('フォロー送信:', sent, '件');
}

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

/* ---------- Square Terminal（端末カード決済）----------
 * 端末が届いたら: ①/terminal/device-code でデバイスコード発行→端末に入力してペアリング
 * ②ペアリング完了で device_id 取得 ③会計時に /terminal/checkout で金額を端末へ送信
 * ④/terminal/checkout?id= で状態をポーリング→COMPLETEDで会計確定。本番はSQUARE_ENV=production+本番トークン */
function sqErr(sq, status) { return (sq && sq.errors && sq.errors[0] && sq.errors[0].detail) || ('Square API ' + status); }
async function handleTermDeviceCode(request, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
  let o = {}; try { o = await request.json(); } catch {}
  const body = { idempotency_key: crypto.randomUUID(), device_code: { name: o.name || 'SEAM 銀座 レジ', product_type: 'TERMINAL_API', location_id: env.SQUARE_LOCATION_ID } };
  try {
    const r = await fetch(apiBase(env) + '/v2/devices/codes', { method: 'POST', headers: sqHeaders(env), body: JSON.stringify(body) });
    const sq = await r.json(); if (!r.ok) return json({ error: sqErr(sq, r.status) }, 502, cors);
    const dc = sq.device_code || {}; return json({ ok: true, id: dc.id, code: dc.code, status: dc.status, deviceId: dc.device_id || '' }, 200, cors);
  } catch (e) { return json({ error: e.message }, 502, cors); }
}
async function handleTermDeviceStatus(url, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
  const id = url.searchParams.get('id'); if (!id) return json({ error: 'id 必須' }, 400, cors);
  try {
    const r = await fetch(apiBase(env) + '/v2/devices/codes/' + encodeURIComponent(id), { headers: sqHeaders(env) });
    const sq = await r.json(); if (!r.ok) return json({ error: sqErr(sq, r.status) }, 502, cors);
    const dc = sq.device_code || {}; return json({ ok: true, status: dc.status, deviceId: dc.device_id || '' }, 200, cors);
  } catch (e) { return json({ error: e.message }, 502, cors); }
}
/* レジのモードでSquareの店舗を選ぶ。ショップの売上はショップの店舗に計上する */
function locFor(env, mode) {
  if (mode === 'shop' && env.SQUARE_LOCATION_ID_SHOP) return env.SQUARE_LOCATION_ID_SHOP;
  return env.SQUARE_LOCATION_ID || '';
}
async function handleTermCheckout(request, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.amount || !o.deviceId) return json({ error: 'amount と deviceId は必須です' }, 400, cors);
  const loc = locFor(env, o.mode);
  const body = { idempotency_key: crypto.randomUUID(), checkout: {
    amount_money: { amount: Math.round(o.amount), currency: 'JPY' },
    device_options: { device_id: o.deviceId },
    location_id: loc || undefined,
    note: (o.note || (o.mode === 'shop' ? 'SEAM 銀座 ショップ' : 'SEAM 銀座 サロン')).slice(0, 500) } };
  try {
    const r = await fetch(apiBase(env) + '/v2/terminals/checkouts', { method: 'POST', headers: sqHeaders(env), body: JSON.stringify(body) });
    const sq = await r.json(); if (!r.ok) return json({ error: sqErr(sq, r.status) }, 502, cors);
    const co = sq.checkout || {}; return json({ ok: true, checkoutId: co.id, status: co.status }, 200, cors);
  } catch (e) { return json({ error: e.message }, 502, cors); }
}
async function handleTermStatus(url, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
  const id = url.searchParams.get('id'); if (!id) return json({ error: 'id 必須' }, 400, cors);
  try {
    const r = await fetch(apiBase(env) + '/v2/terminals/checkouts/' + encodeURIComponent(id), { headers: sqHeaders(env) });
    const sq = await r.json(); if (!r.ok) return json({ error: sqErr(sq, r.status) }, 502, cors);
    const co = sq.checkout || {}; return json({ ok: true, status: co.status, paymentIds: co.payment_ids || [] }, 200, cors);
  } catch (e) { return json({ error: e.message }, 502, cors); }
}
async function handleTermCancel(request, env, cors) {
  if (!env.SQUARE_ACCESS_TOKEN) return json({ error: 'SQUARE_ACCESS_TOKEN が未設定です' }, 500, cors);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.checkoutId) return json({ error: 'checkoutId 必須' }, 400, cors);
  try {
    const r = await fetch(apiBase(env) + '/v2/terminals/checkouts/' + encodeURIComponent(o.checkoutId) + '/cancel', { method: 'POST', headers: sqHeaders(env) });
    const sq = await r.json(); if (!r.ok) return json({ error: sqErr(sq, r.status) }, 502, cors);
    return json({ ok: true, status: (sq.checkout || {}).status }, 200, cors);
  } catch (e) { return json({ error: e.message }, 502, cors); }
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
    idempotency_key: payload.idempotencyKey || crypto.randomUUID(),
    amount_money: { amount: Math.round(amount), currency: currency || 'JPY' },
    autocomplete: true,
  };
  if (env.SQUARE_LOCATION_ID) body.location_id = env.SQUARE_LOCATION_ID;   // 対面/オンラインの取引先店舗
  if (payload.note) body.note = String(payload.note).slice(0, 60);          // 「前金 8/12 山田様」等
  if (verificationToken) body.verification_token = verificationToken;      // 3Dセキュア(SCA)の結果

  try {
    const r = await fetch(apiBase(env) + '/v2/payments', {
      method: 'POST', headers: sqHeaders(env), body: JSON.stringify(body),
    });
    const sq = await r.json();
    if (!r.ok) {
      const msg = (sq.errors && sq.errors[0] && sq.errors[0].detail) || ('Square API ' + r.status);
      return json({ error: msg }, 502, cors);
    }
    const pay = sq.payment || {};
    // 手数料は決済確定後に入ることが多い。取れた分だけ返す（あとで照合に使う）
    const fee = (pay.processing_fee || []).reduce((a, f) => a + ((f.amount_money && f.amount_money.amount) || 0), 0);
    return json({
      ok: true, paymentId: pay.id, status: pay.status,
      amount: (pay.amount_money && pay.amount_money.amount) || 0,
      fee, receiptUrl: pay.receipt_url || '',
    }, 200, cors);
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
  status: r.status, hpbBlocked: !!r.hpb_blocked, deposit: r.deposit, lineUserId: r.line_user_id,
  salonId: r.salon_id || '', createdAt: r.created_at,
});

// GET /availability?from=&to= … 空き判定用の「埋まっている枠」だけを返す（公開・認証不要・個人情報は一切返さない）。
// お客様の予約ページ(顧客モード)がこれを読み、実際の予約(自社+LINE+HPB取込)で埋まった枠を×表示にする＝サロンボード超過の予約を防ぐ。
async function handleAvailability(url, env, cors) {
  if (!env.DB) return json({ ok: true, busy: [] }, 200, cors);
  const from = url.searchParams.get('from'), to = url.searchParams.get('to') || from;
  try {
    let rows;
    if (from) {
      rows = await env.DB.prepare(
        "SELECT date,staff_id,start,end FROM reservations WHERE status!='cancelled' AND date>=? AND date<=?"
      ).bind(from, to).all();
    } else {
      // 既定は今日以降（過去枠は空き表示に不要）。日付文字列比較でOK。
      rows = await env.DB.prepare(
        "SELECT date,staff_id,start,end FROM reservations WHERE status!='cancelled' AND date>=date('now')"
      ).all();
    }
    // 個人情報(氏名/電話/メニュー/チャネル等)は返さない。占有区間だけ。
    const busy = (rows.results || []).map(r => ({ date: r.date, staffId: r.staff_id, start: r.start, end: r.end }));
    return json({ ok: true, busy }, 200, cors);
  } catch (e) { return json({ error: 'availability失敗: ' + e.message }, 502, cors); }
}

// 同期漏れの再push: salonPush失敗でD1にだけ入った予約(salon_id空・hpb取込以外)をsalon.townへ送り直す。
// kana/nominatedはD1列(2026-07-29追加)から復元・旧行はkana空でも送る(RPA側のname分解フォールバックあり)。
async function repushMissing(env, commit) {
  if (!env.DB) return { ok: false, error: 'DB未接続' };
  if (env.SALON_SYNC !== 'on' || !env.SALON_HOST) return { ok: false, error: 'SALON_SYNC無効' };
  const rows = await env.DB.prepare(
    "SELECT * FROM reservations WHERE status='booked' AND (salon_id IS NULL OR salon_id='') AND date>=date('now') AND channel!='hpb'"
  ).all();
  const targets = rows.results || [];
  const results = [];
  for (const r of targets.slice(0, 10)) {   // 1回10件まで(安全弁)
    if (!commit) { results.push({ id: r.id, name: r.name, date: r.date, dry: true }); continue; }
    const st = STAFF_CU[r.staff_id] || {};
    const spa = ['m13', 'm14', 'm15'].includes(r.menu_id);
    const mn = MENUS.find(x => x.id === r.menu_id);
    try {
      const salon = await salonPush(env, {
        date: r.date, start: r.start, end: r.end, name: r.name, kana: r.kana || '', phone: r.phone, email: r.email,
        channel: r.channel, deposit: r.deposit || 0, menuMin: mn ? mn.min : (r.end - r.start), menuName: mn ? mn.name : '',
        spa, staffCu: (spa ? (st.cuSpa || st.cu) : st.cu) || '', hbpStylistId: (spa ? (st.hpbSpa || st.hpb) : st.hpb) || '',
        hbpStylistName: st.name || '', nominated: r.nominated != null ? !!r.nominated : true,
      });
      if (salon && salon.salonId) {
        await env.DB.prepare('UPDATE reservations SET salon_id=? WHERE id=?').bind(salon.salonId, r.id).run();
        results.push({ id: r.id, name: r.name, date: r.date, repushed: true, reserveNum: salon.reserveNum });
      } else results.push({ id: r.id, name: r.name, error: 'push応答にsalonIdなし' });
    } catch (e) { results.push({ id: r.id, name: r.name, error: String(e.message || e).slice(0, 120) }); }
  }
  return { ok: true, commit: !!commit, missing: targets.length, results };
}

// GET|POST /admin/d1-sync?token= … D1のbooked予約(salon_id付き・今日以降)をsalon.townと突き合わせ、
// salon.townで消えている(削除/キャンセル)ものをD1でもcancelledへ。誤リマインド(亡霊予約)の一括修復。
// 安全策: 両店のAPI応答が result:true の時だけ判定(空応答ブレで全滅させない)。GET=ドライラン。
async function handleD1Sync(env, cors, commit) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  if (!(env.SALON_SYNC === 'on' && env.SALON_HOST)) return json({ error: 'SALON_SYNC無効' }, 500, cors);
  try {
    const rows = await env.DB.prepare(
      "SELECT id,salon_id,name,date,start,status FROM reservations WHERE status='booked' AND salon_id IS NOT NULL AND salon_id!='' AND date>=date('now')"
    ).all();
    const targets = rows.results || [];
    if (!targets.length) return json({ ok: true, checked: 0, ghosts: [] }, 200, cors);
    const dates = targets.map(r => r.date).sort();
    const live = new Set();
    for (const sid of [env.SALON_SHOP_ID, env.SALON_SPA_SHOP_ID].filter(Boolean)) {
      const j = await salonCall(env, '/get/reservation', {
        filter: { shop_id: sid, reserve_date_start: dates[0], reserve_date_end: dates[dates.length - 1] + ' 23:59' }, limit: 500,
      });
      if (!j.result) return json({ error: 'salon.town応答エラー(安全のため中断)', shop: sid, msg: j.msg || '' }, 502, cors);
      for (const r of (j.data || [])) if (!r.delete_date && !r.cancel_date) live.add(r.id);
    }
    if (!live.size) return json({ error: 'salon.town生存予約0件(空応答ブレの疑い・安全のため中断)' }, 502, cors);
    const ghosts = targets.filter(r => !live.has(r.salon_id));
    if (commit) for (const g of ghosts) {
      await env.DB.prepare("UPDATE reservations SET status='cancelled' WHERE id=?").bind(g.id).run();
    }
    return json({ ok: true, commit: !!commit, checked: targets.length, live_count: live.size,
      ghosts: ghosts.map(g => ({ id: g.id, name: g.name, date: g.date, start: g.start, salon_id: g.salon_id })) }, 200, cors);
  } catch (e) { return json({ error: 'd1-sync失敗: ' + e.message }, 502, cors); }
}

// GET /admin/diag-resv?token=&from=&to= … 両SEAM店(ヘア/スパ)のsalon.town予約を診断用に読み取り(削除なし)。
// RPAが「予約でなく予定」を書く原因調査用。ミラー判定に必要な info_js のキーと status を返す。
async function handleDiagResv(url, env, cors) {
  const token = url.searchParams.get('token') || '';
  if (!env.CLEANUP_TOKEN || token !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
  const from = url.searchParams.get('from') || '2026-07-25';
  const to = url.searchParams.get('to') || '2026-08-05';
  const shops = [{ id: env.SALON_SHOP_ID, label: 'hair' }];
  if (env.SALON_SPA_SHOP_ID) shops.push({ id: env.SALON_SPA_SHOP_ID, label: 'spa' });
  const out = {};
  try {
    for (const sh of shops) {
      const j = await salonCall(env, '/get/reservation', {
        filter: { shop_id: sh.id, reserve_date_start: from, reserve_date_end: to + ' 23:59' },
        add_staff: true, add_info: true, limit: 300,   // add_info:true が無いと info_js が返らない罠(T系)
      });
      out[sh.label] = (j.data || []).map(r => ({
        id: r.id, num: r.reserve_num, name: r.name || '', status: r.status,
        date: r.reserve_date, end: r.reserve_end_date, staff: r.staff_account_id || '',
        account_id: r.account_id || '',   // 担当の正はaccount_id(2026-07-24エンジニア確定仕様)。staff_account_idは旧列
        from_account_id: r.from_account_id || '',   // 顧客のaccount.id(saveAccountで作成/名寄せ・2026-07-28)

        deleted: !!r.delete_date, cancelled: !!r.cancel_date, type: r.type || '',
        // info_jsは平文メタ(個人情報なし設計)。RPAの処理刻印(hbp_*)と設定値をそのまま返して診断する。
        info: r.info_js || null,
      }));
    }
    return json({ ok: true, ...out }, 200, cors);
  } catch (e) { return json({ error: 'diag失敗: ' + e.message }, 502, cors); }
}

// POST /admin/purge-test?token= … 氏名が「テスト」で始まる自社/LINEのテスト予約のみを D1＋salon.town から削除。
// 専用トークン(CLEANUP_TOKEN)必須。検証で誤って作った本番テスト予約の後始末用（実顧客名にはヒットしない狭い条件）。
async function handlePurgeTest(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  const token = url.searchParams.get('token') || '';
  if (!env.CLEANUP_TOKEN || token !== env.CLEANUP_TOKEN) return json({ error: 'forbidden' }, 403, cors);
  // ids= を渡したときは、その予約だけを掃除する（誤登録・検証の後始末用）
  const ids = (url.searchParams.get('ids') || '').split(',').map(x => x.trim()).filter(Boolean);
  const rows = ids.length
    ? await env.DB.prepare(
        `SELECT id, salon_id, name, date, staff_id, start FROM reservations WHERE id IN (${ids.map(() => '?').join(',')})`
      ).bind(...ids).all()
    : await env.DB.prepare(
        "SELECT id, salon_id, name, date, staff_id, start FROM reservations WHERE (name LIKE 'テスト%' OR name LIKE '検証%' OR name LIKE '再検証%') AND channel IN ('line','own')"
      ).all();
  const deleted = [];
  for (const r of (rows.results || [])) {
    if (env.SALON_SYNC === 'on' && env.SALON_HOST && r.salon_id) {
      try { await salonDelete(env, r.salon_id); } catch (e) { console.log('salon削除失敗:', e.message); }
    }
    await env.DB.prepare('DELETE FROM reservations WHERE id=?').bind(r.id).run();
    deleted.push({ id: r.id, name: r.name, date: r.date, start: r.start, salon_id: r.salon_id || '' });
  }
  // 検証で作ったカウンセリングシート・顧客ノートも一緒に掃除（テスト名のみ）
  let cs = 0;
  try {
    const t = await env.DB.prepare("SELECT id,key FROM counseling WHERE name LIKE 'テスト%' OR name LIKE '検証%' OR name LIKE 'ダミー%' OR name='x'").all();
    for (const r of (t.results || [])) {
      await env.DB.prepare('DELETE FROM counseling WHERE id=?').bind(r.id).run();
      await env.DB.prepare('DELETE FROM customer_notes WHERE key=?').bind(r.key).run().catch(() => {});
      cs++;
    }
  } catch (e) {}
  return json({ ok: true, count: deleted.length, counseling: cs, deleted }, 200, cors);
}

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
  // お名前はサロンボードに入る形だけ通す（前後の空白は直す・記号や内部の空白は弾く）
  // 分割4欄で来ていればそれを、1本で来ていれば「姓 名」として検証する
  {
    const chk = (o.sei != null || o.mei != null)
      ? checkNameParts(o.sei, o.mei, o.seiK != null ? o.seiK : o.kanaSei, o.meiK != null ? o.meiK : o.kanaMei)
      : checkNameJoined(o.name, o.kana);
    if (chk.ng) return json({ error: chk.ng }, 400, cors);
    o.name = chk.name; o.kana = chk.kana;   // 正規化後の値で保存＝RPAが姓/名に割り戻せる形を保証
  }
  // ★前金は「実際に決済できた額」しか台帳に載せない。
  // 決済IDが無いのに金額が付いていたら 0 に落とす（受け取っていないお金を受領済みにしない）。
  if ((+o.deposit || 0) > 0 && !o.squarePaymentId) o.deposit = 0;
  // ダブルブッキング判定（キャンセル以外の同一スタッフ・時間重複）
  const clash = await env.DB.prepare(
    "SELECT id,name,start FROM reservations WHERE date=? AND staff_id=? AND status!='cancelled' AND ? < end AND ? > start LIMIT 1"
  ).bind(o.date, o.staffId, o.start, o.end).first();
  if (clash) return json({ ok: false, conflict: { name: clash.name, start: clash.start } }, 409, cors);
  const id = o.id || ('r' + crypto.randomUUID().slice(0, 8));
  try {
    // kana/nominated込み(再push=同期漏れ修復の材料)。列未追加の旧DBはcatchでレガシーINSERTへ
    await env.DB.prepare(
      `INSERT INTO reservations (id,date,staff_id,start,end,menu_id,name,phone,email,note,channel,status,hpb_blocked,deposit,line_user_id,kana,nominated,square_payment_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, o.date, o.staffId, o.start, o.end, o.menuId || '', o.name || 'お客様', o.phone || '', o.email || '', o.note || '',
      o.channel || 'own', o.status || 'booked', o.channel === 'hpb' ? 1 : (o.hpbBlocked ? 1 : 0), o.deposit || 0, o.lineUserId || '',
      o.kana || '', o.nominated === false ? 0 : 1, o.squarePaymentId || '', new Date().toISOString()).run();
  } catch (e) {
    await ensureRegisterTables(env).catch(() => {});   // 列を追加して次回から拡張INSERTが通るように
    await env.DB.prepare(
      `INSERT INTO reservations (id,date,staff_id,start,end,menu_id,name,phone,email,note,channel,status,hpb_blocked,deposit,line_user_id,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).bind(id, o.date, o.staffId, o.start, o.end, o.menuId || '', o.name || 'お客様', o.phone || '', o.email || '', o.note || '',
      o.channel || 'own', o.status || 'booked', o.channel === 'hpb' ? 1 : (o.hpbBlocked ? 1 : 0), o.deposit || 0, o.lineUserId || '', new Date().toISOString()).run();
  }
  // salon.town(CUEPON)へ同期。SALON_SYNC='on'の時のみ。疎結合=失敗しても自社予約は成功扱い。
  let salon = null;
  if (env.SALON_SYNC === 'on' && env.SALON_HOST) {
    try {
      salon = await salonPush(env, o);
      if (salon.salonId) {
        // salon_id列に保存(キャンセル/削除の同期に使用)。note にも予約番号を人向け追記。
        try {
          await env.DB.prepare(
            "UPDATE reservations SET salon_id=?, note = CASE WHEN note IS NULL OR note='' THEN ? ELSE note || ? END WHERE id=?"
          ).bind(salon.salonId, `salon#${salon.reserveNum}`, ` / salon#${salon.reserveNum}`, id).run();
        } catch (e) {
          // salon_id 列が未追加(マイグレーション前)なら note だけ更新してフォールバック
          console.log('salon_id保存失敗(列未追加?):', e.message);
          await env.DB.prepare(
            "UPDATE reservations SET note = CASE WHEN note IS NULL OR note='' THEN ? ELSE note || ? END WHERE id=?"
          ).bind(`salon#${salon.reserveNum}`, ` / salon#${salon.reserveNum}`, id).run();
        }
      }
    } catch (e) { console.log('salon同期失敗:', e.message); salon = { error: String(e.message || e).slice(0, 200) }; }
  }
  // オンライン予約（お客様導線）のみオーナー通知。管理側の手動登録は notify を付けない。
  if (o.notify) {
    const ch = { own: '自社サイト', line: 'LINE', google: 'Google', instagram: 'Instagram', app: 'SEAMアプリ' }[o.channel] || o.channel;
    await notifyOwner(env, `新規ネット予約 ${o.name || 'お客様'} ${(o.date || '').slice(5)}`,
      `${ch}から予約が入りました。\n\n日時: ${(o.date || '').replace(/-/g, '/')} ${min2hm(o.start)}〜\nお客様: ${o.name || ''}${o.phone ? '（' + o.phone + '）' : ''}`
      + (salon && salon.reserveNum ? `\nsalon.town予約番号: ${salon.reserveNum}` : ''));
    // 顧客への予約確認（サーバ側で送信。フロントからの /line/push・/mail/confirm 直叩きは廃止＝管理専用化）
    const cinfo = { salon: 'SEAM 銀座', date: o.date, time: min2hm(o.start),
      menu: o.menuName || (MENUS.find(x => x.id === o.menuId) || {}).name || '',
      staff: o.hbpStylistName || (STAFF.find(x => x.id === o.staffId) || {}).name || '',
      total: o.deposit || undefined };
    // ★LINEとメールの両方に送る(どちらかではなく両方=「予約できたか不安」を無くす)
    try {
      if (o.lineUserId && env.LINE_CHANNEL_ACCESS_TOKEN) {
        await linePush(env, o.lineUserId, buildLineMessage('confirm', cinfo));
        console.log('予約確認をLINEへ送信:', o.name);
      }
      if (o.email && env.RESEND_API_KEY) {
        // Googleログインのメールは本人確認済み。手入力のメールはOTP確認済みのときだけ送る(誤送信防止)
        let sendable = o.emailProvider === 'google';
        if (!sendable && env.DB) {
          const v = await env.DB.prepare('SELECT verified FROM otp WHERE email=?').bind(String(o.email).toLowerCase()).first().catch(() => null);
          sendable = !!(v && v.verified);
        }
        if (sendable) { await sendConfirmMail(env, o.email, cinfo); console.log('予約確認をメールへ送信:', o.email); }
        else console.log('メール未確認のため確認メールは送信せず:', o.email);
      }
      if (!o.lineUserId && !o.email) console.log('連絡先なし＝予約確認を送れません:', o.name);
    } catch (e) { console.log('顧客確認送信失敗:', e.message); }
  }
  return json({ ok: true, id, salon }, 200, cors);
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
  // キャンセルに変更されたら salon.town へも反映(cancel:true)。疎結合=失敗しても自社は成功。
  if (o.status === 'cancelled' && env.SALON_SYNC === 'on' && env.SALON_HOST) {
    try {
      const row = await env.DB.prepare('SELECT salon_id FROM reservations WHERE id=?').bind(o.id).first();
      if (row && row.salon_id) await salonCancel(env, row.salon_id);
    } catch (e) { console.log('salonキャンセル同期失敗:', e.message); }
  }
  return json({ ok: true }, 200, cors);
}

async function handleDeleteReservation(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id は必須' }, 400, cors);
  // salon.town側も削除(削除前に salon_id を取得)。疎結合。
  if (env.SALON_SYNC === 'on' && env.SALON_HOST) {
    try {
      const row = await env.DB.prepare('SELECT salon_id FROM reservations WHERE id=?').bind(id).first();
      if (row && row.salon_id) await salonDelete(env, row.salon_id);
    } catch (e) { console.log('salon削除同期失敗:', e.message); }
  }
  await env.DB.prepare('DELETE FROM reservations WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}

/* ---------- レジ・会計（お会計・レジ締め）D1 ---------- */
// テーブルを遅延作成（CREATE TABLE IF NOT EXISTS・インスタンスごと1回）。手動マイグレーション不要。
let _regTablesReady = false;
async function ensureRegisterTables(env) {
  if (_regTablesReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS checkouts (id TEXT PRIMARY KEY, resv_id TEXT DEFAULT '', date TEXT NOT NULL, staff_id TEXT DEFAULT '', customer TEXT DEFAULT '', tech INTEGER DEFAULT 0, retail INTEGER DEFAULT 0, retail_items TEXT DEFAULT '[]', discount INTEGER DEFAULT 0, total INTEGER DEFAULT 0, method TEXT DEFAULT 'cash', nominated INTEGER DEFAULT 0, created_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_co_date ON checkouts(date)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settlements (date TEXT PRIMARY KEY, float INTEGER DEFAULT 0, cash_sales INTEGER DEFAULT 0, expected_cash INTEGER DEFAULT 0, counted_cash INTEGER DEFAULT 0, diff INTEGER DEFAULT 0, card INTEGER DEFAULT 0, qr INTEGER DEFAULT 0, total INTEGER DEFAULT 0, count INTEGER DEFAULT 0, memo TEXT DEFAULT '', closed_at TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, price INTEGER DEFAULT 0, barcode TEXT DEFAULT '', stock INTEGER DEFAULT 0, active INTEGER DEFAULT 1, created_at TEXT)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS intakes (id TEXT PRIMARY KEY, product_id TEXT DEFAULT '', product_name TEXT DEFAULT '', date TEXT NOT NULL, qty INTEGER DEFAULT 0, unit_cost INTEGER DEFAULT 0, memo TEXT DEFAULT '', created_at TEXT)`),
    // 自社ポイント台帳(HPBの2%徴収の代替)。CUEPONポイントAPIと1:1対応: delta→point(±)/reason→code/
    // name+phone→account_id解決(統合時に/save/point・/use/pointへ移行・use_type_idx:0)。BtoC利用はCUEPON移行後。
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS points (id TEXT PRIMARY KEY, name TEXT DEFAULT '', phone TEXT DEFAULT '', delta INTEGER DEFAULT 0, reason TEXT DEFAULT '', ref TEXT DEFAULT '', date TEXT NOT NULL, created_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_pt_name ON points(name)`),
    // ギフト券台帳。id=券面コード(G-XXXX-XXXX)。balance=残高(分割利用可)・uses=利用履歴JSON[{ref,amount,at}]。
    // 有効期限は既定6ヶ月(資金決済法の適用外に収める)。統合時はCUEPONのdiscount/チケット系へ移行。
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS gifts (id TEXT PRIMARY KEY, label TEXT DEFAULT '', amount INTEGER DEFAULT 0, balance INTEGER DEFAULT 0, buyer TEXT DEFAULT '', memo TEXT DEFAULT '', uses TEXT DEFAULT '[]', issued TEXT DEFAULT '', expires TEXT DEFAULT '', void INTEGER DEFAULT 0, created_at TEXT)`),
    // 回数券・パス(スパ4回券等)。remaining=残回数・1会計で1回消化(施術分をカバー)。期限既定6ヶ月。
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS passes (id TEXT PRIMARY KEY, label TEXT DEFAULT '', customer TEXT DEFAULT '', price INTEGER DEFAULT 0, total INTEGER DEFAULT 0, remaining INTEGER DEFAULT 0, uses TEXT DEFAULT '[]', issued TEXT DEFAULT '', expires TEXT DEFAULT '', void INTEGER DEFAULT 0, created_at TEXT)`),
    // 来店時のカウンセリングシート＋同意書。key=custKey(電話番号 or n:氏名)・sign=手書き署名(dataURL)
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS counseling (id TEXT PRIMARY KEY, key TEXT, name TEXT, phone TEXT, kind TEXT, answers TEXT, consent TEXT, sign TEXT, staff TEXT, date TEXT, created_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_cs_key ON counseling(key)`),
    // 商品5000点規模。バーコード引きを索引で速くする（レジのスキャンと棚卸しの両方で使う）
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_prod_barcode ON products(barcode)`),
    // 棚卸し：セッション（中断・再開できるように、数えた数はサーバーに置く）
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS stocktakes (id TEXT PRIMARY KEY, name TEXT DEFAULT '', staff TEXT DEFAULT '', status TEXT DEFAULT 'open', started_at TEXT, closed_at TEXT DEFAULT '', note TEXT DEFAULT '')`),
    // 棚卸し：数えた数（product_idごと。スキャンのたびに加算）
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS stocktake_counts (take_id TEXT, product_id TEXT, counted INTEGER DEFAULT 0, last_at TEXT, PRIMARY KEY (take_id, product_id))`),
    // 棚卸し：確定時の増減記録（いつ・どれだけズレたかを残す）
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_adjust (id TEXT PRIMARY KEY, take_id TEXT DEFAULT '', product_id TEXT, before_qty INTEGER DEFAULT 0, after_qty INTEGER DEFAULT 0, diff INTEGER DEFAULT 0, reason TEXT DEFAULT '', staff TEXT DEFAULT '', created_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_stadj_take ON stock_adjust(take_id)`),
    // メールのワンタイムパスワード(本人確認)。10分有効・5回まで・60秒に1回送信
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS otp (email TEXT PRIMARY KEY, code TEXT, expires TEXT, verified INTEGER DEFAULT 0, tries INTEGER DEFAULT 0, created_at TEXT)`),
    // 顧客ノート(重要メモ=アレルギー等の注意事項・誕生月)。key=custKey(電話番号 or n:氏名)
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS customer_notes (key TEXT PRIMARY KEY, caution TEXT DEFAULT '', birthday TEXT DEFAULT '', updated_at TEXT)`),
    // カルテ写真(before/after)。dataはクライアント側で圧縮したJPEGのdataURL(〜150KB)。
    // ※本来はR2が適所だがアカウント未有効(code:10042)のためD1暫定。R2有効化後にキー移行(spec参照)。
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS karte_photos (id TEXT PRIMARY KEY, name TEXT NOT NULL, date TEXT, data TEXT, created_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_kp_name ON karte_photos(name)`),
  ]);
  // 既存DBへの列追加（SQLiteはIF NOT EXISTS非対応→重複はcatchで無視）
  try { await env.DB.prepare(`ALTER TABLE checkouts ADD COLUMN nominated INTEGER DEFAULT 0`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE checkouts ADD COLUMN square_payment_id TEXT DEFAULT ''`).run(); } catch (e) {}
  // 再push(同期漏れ修復)の材料: 予約にカナ/指名を保存(2026-07-29)
  // カウンセリングシートの写真/音声AI同意（用途別・2026-07-30）
  try { await env.DB.prepare(`ALTER TABLE customer_notes ADD COLUMN photo_policy TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE customer_notes ADD COLUMN face_ng INTEGER DEFAULT 0`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE customer_notes ADD COLUMN voice_policy TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE customer_notes ADD COLUMN video_policy TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE counseling ADD COLUMN voided INTEGER DEFAULT 0`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE counseling ADD COLUMN lang TEXT DEFAULT 'ja'`).run(); } catch (e) {}
  // salon.town(CUEPON)の商品ID・メーカー品番・ブランド。統合時の照合キーと、レジでの見分けに使う
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN ext_id TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN maker_code TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN brand TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_prod_ext ON products(ext_id)`).run(); } catch (e) {}
  // Squareの商品ID（バリエーション）。ショップの実売台帳と結び付ける
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN sq_id TEXT DEFAULT ''`).run(); } catch (e) {}
  // Squareの商品名の控え。台帳はページで分かれて来るので、名前を別に持っておく
  try { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS sq_items (item_id TEXT PRIMARY KEY, name TEXT DEFAULT '')`).run(); } catch (e) {}
  // 出所。'list'=アイテム一覧（メーカー正規・名前と価格の正）／'square'=Squareにしか無い商品
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN source TEXT DEFAULT 'list'`).run(); } catch (e) {}
  // 1商品に複数のJAN（旧パッケージと新パッケージ等）。前後をカンマで囲って持つ ,JAN,JAN,
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN alt_barcodes TEXT DEFAULT ''`).run(); } catch (e) {}
  // 統合したとき、どの商品にまとめたかを残す（あとで戻せる）
  try { await env.DB.prepare(`ALTER TABLE products ADD COLUMN merged_into TEXT DEFAULT ''`).run(); } catch (e) {}
  // ===== 店舗ごとの在庫 =====
  // 免税（銀座ショップ免税）は銀座と同じ商品を扱うので、在庫は銀座と一体で持つ（オーナー確認済み）
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS shops (id TEXT PRIMARY KEY, name TEXT, sq_locations TEXT DEFAULT '', sort_num INTEGER DEFAULT 0, active INTEGER DEFAULT 1)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_by_shop (shop_id TEXT, product_id TEXT, qty INTEGER DEFAULT 0, updated_at TEXT, PRIMARY KEY (shop_id, product_id))`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sbs_prod ON stock_by_shop(product_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS stock_moves (id TEXT PRIMARY KEY, product_id TEXT, from_shop TEXT, to_shop TEXT, qty INTEGER DEFAULT 0, staff TEXT DEFAULT '', note TEXT DEFAULT '', created_at TEXT)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_moves_at ON stock_moves(created_at)`),
  ]).catch(() => {});
  try { await env.DB.prepare(`ALTER TABLE stocktakes ADD COLUMN shop_id TEXT DEFAULT 'ginza'`).run(); } catch (e) {}
  // 店舗の初期登録（1回だけ入る。名前や並びはあとから変えられる）
  try {
    const c = await env.DB.prepare('SELECT COUNT(*) c FROM shops').first();
    if (!c || !c.c) {
      await env.DB.batch([
        // 銀座は物販店と免税店の2つのSquare店舗を持つが、在庫はひとつ
        env.DB.prepare(`INSERT INTO shops (id,name,sq_locations,sort_num) VALUES ('ginza','SEAM 銀座','L2954TC12Y6QF,L356YMPP0J4R9',1)`),
        env.DB.prepare(`INSERT INTO shops (id,name,sq_locations,sort_num) VALUES ('sapporo','SEAM 札幌','L48Q4Y1923PYB',2)`),
        env.DB.prepare(`INSERT INTO shops (id,name,sq_locations,sort_num) VALUES ('nagoya','SEAM 名古屋','LG5B3TV8MQG9F',3)`),
        env.DB.prepare(`INSERT INTO shops (id,name,sq_locations,sort_num) VALUES ('fukuoka','SEAM 福岡','LQ5YDX8V6M97H',4)`),
        env.DB.prepare(`INSERT INTO shops (id,name,sq_locations,sort_num) VALUES ('horie','SEAM 南堀江','L9E1R5RM7M2JB',5)`),
      ]);
      // いまの在庫（1店舗前提の値）は銀座のものとして移す
      await env.DB.prepare(`INSERT OR IGNORE INTO stock_by_shop (shop_id,product_id,qty,updated_at)
        SELECT 'ginza', id, COALESCE(stock,0), ? FROM products WHERE COALESCE(stock,0)<>0`).bind(new Date().toISOString()).run();
    }
  } catch (e) {}
  try { await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_prod_sq ON products(sq_id)`).run(); } catch (e) {}
  // 同姓同名の取り違えを防ぐため、氏名キーだったテーブルに電話を持たせる（既存行は空のまま＝氏名で拾う）
  try { await env.DB.prepare(`ALTER TABLE checkouts ADD COLUMN phone TEXT DEFAULT ''`).run(); } catch (e) {}
  // レジをサロン用とショップ用に分ける（売上・在庫・端末の宛先が別）
  try { await env.DB.prepare(`ALTER TABLE checkouts ADD COLUMN mode TEXT DEFAULT 'salon'`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE passes ADD COLUMN phone TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE karte_photos ADD COLUMN phone TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE counseling ADD COLUMN void_reason TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE reservations ADD COLUMN square_payment_id TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE reservations ADD COLUMN kana TEXT DEFAULT ''`).run(); } catch (e) {}
  try { await env.DB.prepare(`ALTER TABLE reservations ADD COLUMN nominated INTEGER DEFAULT 1`).run(); } catch (e) {}
  _regTablesReady = true;
}
const CO2API = r => ({
  id: r.id, resvId: r.resv_id || '', date: r.date, staffId: r.staff_id || '', customer: r.customer || '',
  tech: r.tech || 0, retail: r.retail || 0, retailItems: (() => { try { return JSON.parse(r.retail_items || '[]'); } catch { return []; } })(),
  discount: r.discount || 0, total: r.total || 0, method: r.method || 'cash', nominated: !!r.nominated, squarePaymentId: r.square_payment_id || '', at: r.created_at || '',
});
const ST2API = r => ({
  date: r.date, float: r.float || 0, cashSales: r.cash_sales || 0, expectedCash: r.expected_cash || 0,
  countedCash: r.counted_cash || 0, diff: r.diff || 0, card: r.card || 0, qr: r.qr || 0, total: r.total || 0,
  count: r.count || 0, memo: r.memo || '', closedAt: r.closed_at || '',
});

async function handleGetCheckouts(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const from = url.searchParams.get('from'), to = url.searchParams.get('to') || from;
  const q = from
    ? env.DB.prepare('SELECT * FROM checkouts WHERE date BETWEEN ? AND ? ORDER BY created_at').bind(from, to)
    : env.DB.prepare('SELECT * FROM checkouts ORDER BY created_at');
  const res = await q.all();
  return json({ ok: true, checkouts: (res.results || []).map(CO2API) }, 200, cors);
}
async function handlePostCheckout(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.id || !o.date) return json({ error: 'id/date は必須' }, 400, cors);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO checkouts (id,resv_id,date,staff_id,customer,phone,mode,tech,retail,retail_items,discount,total,method,nominated,square_payment_id,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(o.id, o.resvId || '', o.date, o.staffId || '', o.customer || '', telN(o.phone),
    o.mode === 'shop' ? 'shop' : 'salon', o.tech || 0, o.retail || 0,
    JSON.stringify(o.retailItems || []), o.discount || 0, o.total || 0, o.method || 'cash', o.nominated ? 1 : 0, o.squarePaymentId || '', o.at || new Date().toISOString()).run();
  return json({ ok: true, id: o.id }, 200, cors);
}
async function handleDeleteCheckout(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id は必須' }, 400, cors);
  await env.DB.prepare('DELETE FROM checkouts WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}
async function handleGetSettlements(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const from = url.searchParams.get('from'), to = url.searchParams.get('to') || from;
  const q = from
    ? env.DB.prepare('SELECT * FROM settlements WHERE date BETWEEN ? AND ? ORDER BY date').bind(from, to)
    : env.DB.prepare('SELECT * FROM settlements ORDER BY date');
  const res = await q.all();
  return json({ ok: true, settlements: (res.results || []).map(ST2API) }, 200, cors);
}
async function handlePostSettlement(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.date) return json({ error: 'date は必須' }, 400, cors);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO settlements (date,float,cash_sales,expected_cash,counted_cash,diff,card,qr,total,count,memo,closed_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(o.date, o.float || 0, o.cashSales || 0, o.expectedCash || 0, o.countedCash || 0, o.diff || 0,
    o.card || 0, o.qr || 0, o.total || 0, o.count || 0, o.memo || '', o.closedAt || new Date().toISOString()).run();
  return json({ ok: true }, 200, cors);
}
async function handleDeleteSettlement(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const date = url.searchParams.get('date');
  if (!date) return json({ error: 'date は必須' }, 400, cors);
  await env.DB.prepare('DELETE FROM settlements WHERE date=?').bind(date).run();
  return json({ ok: true }, 200, cors);
}
const PR2API = r => ({ id: r.id, name: r.name || '', price: r.price || 0, barcode: r.barcode || '', stock: r.stock || 0, active: r.active == null ? 1 : r.active });
const IN2API = r => ({ id: r.id, productId: r.product_id || '', productName: r.product_name || '', date: r.date, qty: r.qty || 0, unitCost: r.unit_cost || 0, memo: r.memo || '', at: r.created_at || '' });
async function handleGetIntakes(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const res = await env.DB.prepare('SELECT * FROM intakes ORDER BY created_at DESC LIMIT 300').all();
  return json({ ok: true, intakes: (res.results || []).map(IN2API) }, 200, cors);
}

/* ---------- 自社ポイント台帳（増減行の追記型・残高=合計） ---------- */
const PT2API = r => ({ id: r.id, name: r.name || '', phone: r.phone || '', delta: r.delta || 0,
  reason: r.reason || '', ref: r.ref || '', date: r.date, at: r.created_at || '' });
async function handleGetPoints(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const res = await env.DB.prepare('SELECT * FROM points ORDER BY created_at DESC LIMIT 2000').all();
  return json({ ok: true, points: (res.results || []).map(PT2API) }, 200, cors);
}
async function handlePostPoint(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.name || !o.delta) return json({ error: 'name/delta は必須' }, 400, cors);
  const id = o.id || ('pt' + crypto.randomUUID().slice(0, 8));
  await env.DB.prepare(
    `INSERT OR REPLACE INTO points (id,name,phone,delta,reason,ref,date,created_at) VALUES (?,?,?,?,?,?,?,?)`
  ).bind(id, o.name, o.phone || '', Math.round(+o.delta) || 0, o.reason || '', o.ref || '',
    o.date || new Date().toISOString().slice(0, 10), o.at || new Date().toISOString()).run();
  return json({ ok: true, id }, 200, cors);
}
async function handleDeletePoints(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const ref = url.searchParams.get('ref'), id = url.searchParams.get('id');
  if (!ref && !id) return json({ error: 'ref か id が必須' }, 400, cors);
  if (ref) await env.DB.prepare('DELETE FROM points WHERE ref=?').bind(ref).run();
  else await env.DB.prepare('DELETE FROM points WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}

/* ---------- ギフト券（発行・残高・利用履歴） ---------- */
const GF2API = r => ({ id: r.id, label: r.label || '', amount: r.amount || 0, balance: r.balance || 0,
  buyer: r.buyer || '', memo: r.memo || '', uses: (() => { try { return JSON.parse(r.uses || '[]'); } catch { return []; } })(),
  issued: r.issued || '', expires: r.expires || '', void: !!r.void, at: r.created_at || '' });
async function handleGetGifts(env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const res = await env.DB.prepare('SELECT * FROM gifts ORDER BY created_at DESC LIMIT 1000').all();
  return json({ ok: true, gifts: (res.results || []).map(GF2API) }, 200, cors);
}
async function handlePostGift(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.id || o.amount == null) return json({ error: 'id/amount は必須' }, 400, cors);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO gifts (id,label,amount,balance,buyer,memo,uses,issued,expires,void,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(o.id, o.label || '', Math.round(+o.amount) || 0, Math.round(+o.balance != null ? +o.balance : +o.amount) || 0,
    o.buyer || '', o.memo || '', JSON.stringify(o.uses || []), o.issued || new Date().toISOString().slice(0, 10),
    o.expires || '', o.void ? 1 : 0, o.at || new Date().toISOString()).run();
  return json({ ok: true, id: o.id }, 200, cors);
}
async function handleDeleteGift(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id 必須' }, 400, cors);
  await env.DB.prepare('UPDATE gifts SET void=1 WHERE id=?').bind(id).run();   // 物理削除せず無効化(履歴保全)
  return json({ ok: true }, 200, cors);
}

/* ---------- 回数券・パス ---------- */
const PS2API = r => ({ id: r.id, label: r.label || '', customer: r.customer || '', price: r.price || 0,
  total: r.total || 0, remaining: r.remaining || 0,
  uses: (() => { try { return JSON.parse(r.uses || '[]'); } catch { return []; } })(),
  issued: r.issued || '', expires: r.expires || '', void: !!r.void, at: r.created_at || '' });
async function handleGetPasses(env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const res = await env.DB.prepare('SELECT * FROM passes ORDER BY created_at DESC LIMIT 1000').all();
  return json({ ok: true, passes: (res.results || []).map(PS2API) }, 200, cors);
}
async function handlePostPass(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.id || o.total == null) return json({ error: 'id/total は必須' }, 400, cors);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO passes (id,label,customer,phone,price,total,remaining,uses,issued,expires,void,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(o.id, o.label || '', o.customer || '', telN(o.phone), Math.round(+o.price) || 0, Math.round(+o.total) || 0,
    Math.round(+o.remaining != null ? +o.remaining : +o.total) || 0, JSON.stringify(o.uses || []),
    o.issued || new Date().toISOString().slice(0, 10), o.expires || '', o.void ? 1 : 0, o.at || new Date().toISOString()).run();
  return json({ ok: true, id: o.id }, 200, cors);
}
async function handleDeletePass(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id 必須' }, 400, cors);
  await env.DB.prepare('UPDATE passes SET void=1 WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}
async function handlePostIntake(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.id || !o.date) return json({ error: 'id/date は必須' }, 400, cors);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO intakes (id,product_id,product_name,date,qty,unit_cost,memo,created_at) VALUES (?,?,?,?,?,?,?,?)`
  ).bind(o.id, o.productId || '', o.productName || '', o.date, o.qty || 0, o.unitCost || 0, o.memo || '', o.at || new Date().toISOString()).run();
  return json({ ok: true, id: o.id }, 200, cors);
}
async function handleDeleteIntake(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id は必須' }, 400, cors);
  await env.DB.prepare('DELETE FROM intakes WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}
async function handleGetProducts(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  // 商品が数千点あるので、必要な分だけ返せるようにする。
  //   ?barcode=… 1件だけ（レジのスキャン・棚卸しのスキャン）
  //   ?q=…       名前の一部で検索（最大50件）
  //   ?limit=&offset= 一覧の分割取得
  //   引数なしは従来どおり全件（少数店舗の互換のため。5000点でも1回だけなら通る）
  const bc = (url.searchParams.get('barcode') || '').trim();
  if (bc) {
    // まず主バーコード（索引つきで速い）、無ければ追加JAN（旧パッケージ等）を探す
    let r = await env.DB.prepare("SELECT * FROM products WHERE barcode=? AND active<>0 LIMIT 1").bind(bc).first();
    if (!r) r = await env.DB.prepare("SELECT * FROM products WHERE alt_barcodes LIKE ? AND active<>0 LIMIT 1").bind('%,' + bc + ',%').first();
    return json({ ok: true, products: r ? [PR2API(r)] : [] }, 200, cors);
  }
  const q = (url.searchParams.get('q') || '').trim();
  if (q) {
    const res = await env.DB.prepare('SELECT * FROM products WHERE name LIKE ? ORDER BY name LIMIT 50').bind('%' + q + '%').all();
    return json({ ok: true, products: (res.results || []).map(PR2API) }, 200, cors);
  }
  const lim = Math.min(5000, Math.max(1, +(url.searchParams.get('limit') || 5000)));
  const off = Math.max(0, +(url.searchParams.get('offset') || 0));
  const cnt = await env.DB.prepare('SELECT COUNT(*) c FROM products').first().catch(() => ({ c: 0 }));
  const res = await env.DB.prepare('SELECT * FROM products ORDER BY name LIMIT ? OFFSET ?').bind(lim, off).all();
  return json({ ok: true, total: (cnt && cnt.c) || 0, offset: off, products: (res.results || []).map(PR2API) }, 200, cors);
}
async function handlePostProduct(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.id) return json({ error: 'id は必須' }, 400, cors);
  await env.DB.prepare(
    `INSERT OR REPLACE INTO products (id,name,price,barcode,stock,active,created_at) VALUES (?,?,?,?,?,?,?)`
  ).bind(o.id, o.name || '', o.price || 0, o.barcode || '', o.stock || 0, o.active == null ? 1 : (o.active ? 1 : 0), o.createdAt || new Date().toISOString()).run();
  return json({ ok: true, id: o.id }, 200, cors);
}
async function handleDeleteProduct(url, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id は必須' }, 400, cors);
  await env.DB.prepare('DELETE FROM products WHERE id=?').bind(id).run();
  return json({ ok: true }, 200, cors);
}
async function handleGetSettings(env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  const res = await env.DB.prepare('SELECT * FROM settings').all();
  const out = {}; for (const r of (res.results || [])) out[r.key] = r.value;
  return json({ ok: true, settings: out }, 200, cors);
}
async function handlePostSetting(request, env, cors) {
  if (!env.DB) return json({ error: 'DB未接続' }, 500, cors);
  await ensureRegisterTables(env);
  let o; try { o = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  if (!o.key) return json({ error: 'key は必須' }, 400, cors);
  await env.DB.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').bind(o.key, String(o.value ?? '')).run();
  return json({ ok: true }, 200, cors);
}

/* ---------- HOT PEPPER「SALON BOARD」通知メールのパーサ ---------- */
function parseSalonBoard(raw) {
  const sb = label => { const m = raw.match(new RegExp('■' + label + '[^\\n]*\\n[\\s　]*([^\\n]+)')); return m ? m[1].trim() : ''; };
  // ★店舗判定は先頭のサロン名行で行う（例「SEAM 銀座店【シーム】様」）。本文中の他所への言及で誤判定しないよう1行目に限定。
  //   ヘア掲載=「SEAM 銀座」（bt/CLP）／スパ掲載=「SEAM 銀座店」（KLP・リラク）。スパ名はヘア名の上位互換なので銀座店を先に判定。
  //   ★SEAM 銀座以外の掲載（天神大名店・他SEAM掲載など）は銀座の台帳を汚さないよう取り込まない（誤配・宛先追加への保険）。
  const salonLine = (raw.split('\n').find(l => l.trim()) || '').trim();
  if (!/SEAM\s*銀座/.test(salonLine)) return null;   // 銀座ヘア/スパ掲載以外はスキップ
  const shop = /銀座店/.test(salonLine) ? 'spa' : 'hair';
  const shopLabel = shop === 'spa' ? 'スパ' : 'ヘア';
  const nameRaw = sb('氏名');
  const km = nameRaw.match(/[（(]([^)）]*)[)）]/);            // カナ（「釘崎 愛（クギサキ アイ）」→ クギサキ アイ）
  const kana = km ? km[1].trim() : '';
  const name = nameRaw.replace(/[（(][^)）]*[)）]\s*$/, '').replace(/\s*様\s*$/, '').trim();
  const dtStr = sb('来店日時');
  const dt = dtStr.match(/(\d{4})[年\/](\d{1,2})[月\/](\d{1,2})日?[^\d]*(\d{1,2}):(\d{2})/);
  if (!dt || !name) return null;
  // スパ(キレイサロン)掲載はヘアと書式が違う: 「スタイリスト」→「指名スタッフ」/「施術時間目安」→「所要時間目安」(2026-07-29実メール確認)
  const stylist = sb('スタイリスト') || sb('指名スタッフ'), menuName = sb('メニュー'), resNo = sb('予約番号');
  const dm = raw.match(/(?:施術|所要)時間目安[：:]?\s*(?:(\d+)\s*時間)?\s*(?:(\d+)\s*分)?/);
  // 店舗でメニュー候補を絞る（スパ掲載＝ヘッドスパ系）。所要時間はメールの施術時間目安を優先。
  const pool = shop === 'spa' ? MENUS.filter(m => /ヘッドスパ|スパ|個室/.test(m.name)) : MENUS;
  const menu = (pool.length ? pool : MENUS).filter(m => menuName.includes(m.name)).sort((a, b) => b.name.length - a.name.length)[0]
    || (shop === 'spa' ? (MENUS.find(m => /ヘッドスパ/.test(m.name)) || MENUS[0]) : MENUS[0]);
  const dur = (dm && (+dm[1] || +dm[2])) ? ((+dm[1] || 0) * 60 + (+dm[2] || 0)) : menu.min;
  const sname = stylist.replace(/\s/g, '');
  let staff = STAFF.find(s => sname && (sname.includes(s.name.split(' ')[0]) || s.name.replace(/\s/g, '').includes(sname)));
  // 名前一致で拾えない場合の既定担当（スパ＝CHIKA／ヘア＝及川）。ANZUは名前一致で拾える。
  if (!staff) staff = shop === 'spa' ? (STAFF.find(s => s.name === 'CHIKA') || STAFF[0]) : STAFF[0];
  const start = (+dt[4]) * 60 + (+dt[5]);
  const date = `${dt[1]}-${z(+dt[2])}-${z(+dt[3])}`;
  // キャンセル連絡（件名/本文「ご予約のキャンセル」）は取消として扱い、既存台帳をcancelledへ更新する。
  const cancelled = /予約のキャンセル/.test(raw);
  // ★スマート支払い(HPBオンライン事前決済)検知: 決済処理はHPB側=店頭で受け取らない。
  //   noteに刻んでおくとレジ会計が支払方法を自動で「スマート支払い(HPB)」にする。
  const smartPay = /スマート支払い|スマート決済|オンライン決済|事前決済/.test(raw);
  const note = [`[${shopLabel}]`, smartPay && '[スマート支払い]', resNo && ('予約番号 ' + resNo), kana && ('カナ ' + kana),
    stylist && ('HPB担当 ' + stylist), menuName].filter(Boolean).join(' / ');
  // IDは予約番号ベース（BF12345678 → hpb-BF12345678）にして重複INSERT防止
  const id = resNo ? 'hpb-' + resNo.replace(/\s/g, '') : 'r' + crypto.randomUUID().slice(0, 8);
  return { id, date, staffId: staff.id, start, end: start + dur, menuId: menu.id, name, kana, note, shop, cancelled };
}


/* ---------- 予約完了メール（Resend経由・LINE以外/海外客向け） ---------- */
async function handleMailConfirm(request, env, cors) {
  if (!env.RESEND_API_KEY) return json({ error: 'RESEND_API_KEY が未設定です' }, 500, cors);
  let p; try { p = await request.json(); } catch { return json({ error: 'invalid JSON' }, 400, cors); }
  const { to, reservation } = p || {};
  if (!to) return json({ error: 'to は必須です' }, 400, cors);
  try { await sendConfirmMail(env, to, reservation || {}); return json({ ok: true }, 200, cors); }
  catch (e) { return json({ error: 'メール送信エラー: ' + e.message }, 502, cors); }
}

/* ---------- LINE ログイン OAuth2 ----------
 * フロー:
 *   フロント → POST /line/login/state  → { authUrl } を返す（stateをKVかD1に一時保存）
 *   LINEが  → {origin}/line/login/result?code&state  にリダイレクト（フロント中継ページ）
 *   フロント → GET  /line/login/result?code&state  → Worker がtoken交換→profile取得→302
 *
 * 必要シークレット（コードに絶対書かない・wrangler secret put で登録）:
 *   LINE_LOGIN_CLIENT_ID     … チャネルID（wrangler.toml の [vars] に記載でOK・公開情報）
 *   LINE_LOGIN_CLIENT_SECRET … チャネルシークレット（秘密。`npx wrangler secret put LINE_LOGIN_CLIENT_SECRET`）
 *
 * wrangler.toml に追加:
 *   LINE_LOGIN_CALLBACK = "https://suenotakemi-cloud.github.io/seam-website/booking/line/login/result"
 *   LINE_LOGIN_SUCCESS  = "https://suenotakemi-cloud.github.io/seam-website/booking/index.html"
 */

// state を D1 に一時保存（5分TTL相当。古いものは次回クリーンアップ）
async function saveState(env, state) {
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS line_login_state (state TEXT PRIMARY KEY, expires TEXT)`
  ).run().catch(() => {});
  await env.DB.prepare(
    `INSERT OR REPLACE INTO line_login_state (state, expires) VALUES (?, ?)`
  ).bind(state, expires).run();
}

async function verifyState(env, state) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS line_login_state (state TEXT PRIMARY KEY, expires TEXT)`
  ).run().catch(() => {});
  const row = await env.DB.prepare(
    `SELECT expires FROM line_login_state WHERE state = ?`
  ).bind(state).first();
  if (!row) return false;
  await env.DB.prepare(`DELETE FROM line_login_state WHERE state = ?`).bind(state).run();
  return new Date(row.expires) > new Date();
}

// POST /line/login/state — state発行 → LINE認証URLを返す
async function handleLineLoginState(request, env, cors) {
  const clientId = env.LINE_LOGIN_CLIENT_ID;
  const callback = env.LINE_LOGIN_CALLBACK;
  if (!clientId || !callback) return json({ error: 'LINE_LOGIN_CLIENT_ID / LINE_LOGIN_CALLBACK が未設定' }, 500, cors);

  const state = crypto.randomUUID();
  await saveState(env, state);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callback,
    scope: 'profile openid',
    state,
  });
  const authUrl = `https://access.line.me/oauth2/v2.1/authorize?${params}`;
  return json({ authUrl, state }, 200, cors);
}

// GET /line/login/result?code=...&state=... — token交換→profile取得→302リダイレクト
async function handleLineLoginResult(url, env, cors) {
  const code  = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const successUrl = env.LINE_LOGIN_SUCCESS || '/';

  if (!code || !state) return json({ error: 'code / state が不足しています' }, 400, cors);

  const clientId     = env.LINE_LOGIN_CLIENT_ID;
  const clientSecret = env.LINE_LOGIN_CLIENT_SECRET;
  const callback     = env.LINE_LOGIN_CALLBACK;
  if (!clientId || !clientSecret || !callback)
    return json({ error: 'LINE_LOGIN_CLIENT_ID / SECRET / CALLBACK が未設定' }, 500, cors);

  // state検証
  const ok = await verifyState(env, state);
  if (!ok) return json({ error: 'state が無効または期限切れです' }, 403, cors);

  // code → token 交換
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callback,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) return json({ error: 'token交換失敗: ' + (await tokenRes.text()) }, 502, cors);
  const token = await tokenRes.json();

  // profile取得
  const profRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: 'Bearer ' + token.access_token },
  });
  if (!profRes.ok) return json({ error: 'profile取得失敗' }, 502, cors);
  const profile = await profRes.json();

  // userId・displayName をクエリパラメータに乗せてフロントへリダイレクト
  const dest = new URL(successUrl);
  dest.searchParams.set('line_user_id', profile.userId);
  dest.searchParams.set('line_name', profile.displayName);
  if (profile.pictureUrl) dest.searchParams.set('line_picture', profile.pictureUrl);

  return Response.redirect(dest.toString(), 302);
}



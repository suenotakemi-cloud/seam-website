// 求人フォームの応募を recruit@hanico.jp へ知らせる（seam.site の /api/recruit から呼ばれる）
// 宛先は Cloudflare Email Routing の確認済みアドレスに限られる。サイトにはアドレスを出さない。
import { EmailMessage } from 'cloudflare:email';

const FROM = 'recruit-form@seam.site';
const TO = 'recruit@hanico.jp';
const clip = (v, n) => String(v == null ? '' : v).replace(/[\r\n]+/g, ' ').slice(0, n);
const KIND = { visit: '見学したい', online: 'オンラインで15分 話を聞きたい', ask: '条件について聞きたい', apply: '応募したい' };

function b64(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = ''; for (const c of bytes) bin += String.fromCharCode(c);
  return btoa(bin).replace(/.{76}/g, '$&\r\n');
}
const hdr = s => '=?UTF-8?B?' + btoa(String.fromCharCode(...new TextEncoder().encode(s))) + '?=';

export function buildMail(e) {
  const subject = `【求人フォーム】${KIND[e.kind] || e.kind || '応募'}｜${clip(e.name, 40)}`;
  const body = [
    '求人フォームから新しい連絡が届きました',
    '',
    `お名前：${clip(e.name, 60)}`,
    `連絡先：${clip(e.contact, 120)}`,
    `用件：${KIND[e.kind] || clip(e.kind, 20)}`,
    `希望職種：${clip(e.role, 40) || '未選択'}`,
    `希望店舗：${clip(e.store, 40) || '未選択'}`,
    `連絡してよい時間帯：${clip(e.callable, 60) || '指定なし'}`,
    `流入元：${clip(e.src, 60) || '-'}`,
    '',
    'ご用件：',
    String(e.message || '').slice(0, 2000) || '（なし）',
    '',
    '---',
    '2〜3日以内の連絡をお願いします（求人ページでそうご案内しています）',
    '一覧と対応済みの印は SEAM の管理画面（受信箱）から',
  ].join('\r\n');
  const id = `<${crypto.randomUUID()}@seam.site>`;
  return [
    `From: SEAM 求人フォーム <${FROM}>`,
    `To: ${TO}`,
    `Subject: ${hdr(subject)}`,
    `Message-ID: ${id}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64(body),
  ].join('\r\n');
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
    const key = (request.headers.get('x-notify-key') || '').trim();
    if (!env.NOTIFY_KEY || key !== env.NOTIFY_KEY) return new Response('unauthorized', { status: 401 });
    let e; try { e = await request.json(); } catch { return new Response('invalid json', { status: 400 }); }
    if (!e || !e.name || !e.contact) return new Response('name and contact required', { status: 400 });
    try {
      await env.SEND_EMAIL.send(new EmailMessage(FROM, TO, buildMail(e)));
      return Response.json({ ok: true });
    } catch (err) {
      return Response.json({ ok: false, error: String(err && err.message || err).slice(0, 200) }, { status: 502 });
    }
  },
};

// メーカーからの CSV メールを「受信箱」へ転送する Email Worker（Cloudflare Email Routing・無料）
//
// 手順（SEAM 側・1 回だけ）:
//   1. Cloudflare ダッシュボード → seam.site → Email → Email Routing を有効にする（MX レコードが自動で入る）
//   2. Workers → Create → このファイルを貼って deploy（名前は pim-inbox-email など）
//   3. Email Routing → Routing rules → 「csv@seam.site → Send to a Worker: pim-inbox-email」を作る
//      （ディーラーごとに分けるなら csv-kikuchi@seam.site など複数のルールを作り、下の ROUTES に書く）
//   4. ディーラーは PC「設定」→ 自動取り込み用 URL を発行し、その URL を ROUTES に入れて再 deploy
//      （URL を Worker の環境変数 INBOX_DEFAULT に入れてもよい）
//   5. メーカーには「CSV を csv@seam.site に送ってください」と伝えるだけ
//
// 届いたメールの添付（.csv / .tsv / .txt / .xlsx）を、そのまま受信箱の URL に POST する。
// 本文だけのメールは何もしない。送信元のドメインで送り元（メーカー名）を推定して source に入れる。
const ROUTES = {
  // 'csv-kikuchi@seam.site': 'https://seam.site/api/pim/inbox?key=inbox_xxxxxxxx',
};

export default {
  async email(message, env) {
    const to = String(message.to || '').toLowerCase();
    const url = ROUTES[to] || env.INBOX_DEFAULT;
    if (!url) { message.setReject('宛先に対応する受信箱がありません'); return; }
    const raw = new Uint8Array(await new Response(message.raw).arrayBuffer());
    const parts = parseMime(raw, message.headers.get('content-type') || '');
    const from = String(message.from || '');
    const source = (from.match(/@([^>\s]+)/) || [])[1] || '';
    let sent = 0;
    for (const p of parts) {
      if (!/\.(csv|tsv|txt|xlsx|xlsm|xls)$/i.test(p.filename || '')) continue;
      const fd = new FormData();
      fd.append('file', new Blob([p.data]), p.filename);
      fd.append('source', source);
      const r = await fetch(url, { method: 'POST', body: fd });
      if (r.ok) sent++;
    }
    if (!sent) message.setReject('CSV / Excel の添付が見つかりませんでした');
  },
};

// 最小限の MIME 解析（multipart の添付を取り出す。base64 / quoted-printable / 7bit に対応）
function parseMime(raw, contentType) {
  const text = latin1(raw);
  const m = /boundary="?([^";\r\n]+)"?/i.exec(contentType) || /boundary="?([^";\r\n]+)"?/i.exec(text.slice(0, 4000));
  if (!m) return [];
  const out = [];
  const walk = (body, boundary) => {
    const secs = body.split('--' + boundary).slice(1);
    for (let sec of secs) {
      if (sec.startsWith('--')) break;
      const idx = sec.indexOf('\r\n\r\n') >= 0 ? sec.indexOf('\r\n\r\n') : sec.indexOf('\n\n');
      if (idx < 0) continue;
      const head = sec.slice(0, idx), payload = sec.slice(idx + (sec[idx + 1] === '\n' && sec[idx] === '\r' ? 4 : 2)).replace(/\r?\n$/, '');
      const ct = (head.match(/content-type:\s*([^\r\n]+)/i) || [])[1] || '';
      const sub = /boundary="?([^";\r\n]+)"?/i.exec(ct);
      if (/^multipart\//i.test(ct) && sub) { walk(payload, sub[1]); continue; }
      let filename = (head.match(/filename\*?=(?:UTF-8'')?"?([^";\r\n]+)"?/i) || head.match(/name="?([^";\r\n]+)"?/i) || [])[1] || '';
      try { filename = decodeURIComponent(filename); } catch (e) { /* */ }
      const mw = /=\?([^?]+)\?([bq])\?([^?]+)\?=/i.exec(filename);
      if (mw) { try { const bytes = mw[2].toLowerCase() === 'b' ? Uint8Array.from(atob(mw[3]), (c) => c.charCodeAt(0)) : qp(mw[3].replace(/_/g, ' ')); filename = new TextDecoder(mw[1]).decode(bytes); } catch (e) { /* */ } }
      if (!filename) continue;
      const enc = ((head.match(/content-transfer-encoding:\s*([^\r\n]+)/i) || [])[1] || '').trim().toLowerCase();
      let data;
      if (enc === 'base64') data = Uint8Array.from(atob(payload.replace(/[^A-Za-z0-9+/=]/g, '')), (c) => c.charCodeAt(0));
      else if (enc === 'quoted-printable') data = qp(payload);
      else data = Uint8Array.from(payload, (c) => c.charCodeAt(0) & 0xff);
      out.push({ filename, data });
    }
  };
  walk(text, m[1]);
  return out;
}
function latin1(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return s; }
function qp(s) { const bytes = []; s = s.replace(/=\r?\n/g, ''); for (let i = 0; i < s.length; i++) { if (s[i] === '=' && /^[0-9A-Fa-f]{2}$/.test(s.substr(i + 1, 2))) { bytes.push(parseInt(s.substr(i + 1, 2), 16)); i += 2; } else bytes.push(s.charCodeAt(i) & 0xff); } return Uint8Array.from(bytes); }

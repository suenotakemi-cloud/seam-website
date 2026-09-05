// 日報メールの送信（GitHub Actions から毎朝実行。.github/workflows/pim-daily-report.yml）
//   必要な secrets: PIM_ADMIN_KEY（Cloudflare の ADMIN_KEY と同じ）, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM
//   例: Gmail なら SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=xxx@gmail.com SMTP_PASS=<アプリパスワード> MAIL_FROM=xxx@gmail.com（無料）
//   ディーラーごとの送り先と ON/OFF は PC「設定」→ 日報・通知メール で本人が登録する（ここでは何も決めない）
import nodemailer from 'nodemailer';

const BASE = process.env.PIM_BASE || 'https://seam.site';
const key = process.env.PIM_ADMIN_KEY;
if (!key) { console.error('PIM_ADMIN_KEY がありません'); process.exit(1); }
const r = await fetch(BASE + '/api/pim/admin/report', { headers: { 'x-seam-key': key } });
const j = await r.json();
if (!j.ok) { console.error('日報を取得できません', j); process.exit(1); }
console.log('日報 ' + j.count + ' 件');
if (!j.count) process.exit(0);
const tx = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465), secure: String(process.env.SMTP_PORT || '465') === '465', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
let fail = 0;
for (const rep of j.reports) {
  try {
    await tx.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to: rep.emails.join(', '), subject: rep.subject, text: rep.text, html: rep.html });
    console.log('送信: ' + rep.login_id + ' → ' + rep.emails.join(', '));
  } catch (e) { fail++; console.error('失敗: ' + rep.login_id + ' ' + (e && e.message)); }
}
process.exit(fail ? 1 : 0);

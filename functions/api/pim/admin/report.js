// 日報の送信用（ADMIN_KEY）— 日報を有効にしている全ディーラーの分を返す。毎朝 GitHub Actions が取りに来てメールで送る
//   GET /api/pim/admin/report?day=YYYY-MM-DD → { reports:[{ login_id, name, emails:[...], subject, text, html }] }
import { json, parseEmails } from '../_lib.js';
import { buildReport } from '../report.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const rs = await env.DB.prepare('SELECT * FROM pim_accounts WHERE active=1 AND report_enabled=1 AND report_emails IS NOT NULL AND report_emails<>\'\'').all();
  const reports = [];
  for (const a of (rs.results || [])) {
    const emails = parseEmails(a.report_emails);
    if (!emails.length) continue;
    const rep = await buildReport(env, a, url.searchParams.get('day') || '', url.origin);
    reports.push({ login_id: a.login_id, name: a.name, emails, day: rep.day, subject: rep.subject, text: rep.text, html: rep.html });
  }
  return json({ ok: true, count: reports.length, reports });
}

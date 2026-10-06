// node check.mjs — 件名・本文が壊れないか（改行注入・日本語）
import assert from 'node:assert';
globalThis.crypto ??= (await import('node:crypto')).webcrypto;
const src = (await import('node:fs')).readFileSync(new URL('./worker.js', import.meta.url), 'utf8').replace("import { EmailMessage } from 'cloudflare:email';", 'const EmailMessage=class{};');
const { buildMail } = await import('data:text/javascript,' + encodeURIComponent(src));
const raw = buildMail({ name: '山田\r\nBcc: x@evil.test', contact: 'a@b.jp', kind: 'online', message: 'よろしく' });
const head = raw.split('\r\n\r\n')[0];
assert(!/^Bcc:/mi.test(head), 'header injection');
const body = Buffer.from(raw.split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString();
assert(body.includes('オンラインで15分') && body.includes('山田 Bcc') && body.includes('よろしく'));
console.log('ok');

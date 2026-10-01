// 髪格診断を本番で最後まで自動で答え、結果が出て「完了」が送られるかを毎日確かめる（2026-10-02）
// 9/3 は「1 問目で止まる」不具合と「完了が送られない」抜けが 1 か月気づかれなかった。
// 試験の印 utm_campaign=__test__ を付けるので 管理画面の集計には入らない。Meta へは送らない
import { chromium } from 'playwright';
const URL = process.env.FINDER_URL || 'https://seam.site/finder?utm_campaign=__test__';
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
const evs = [], errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('request', r => { if (/\/api\/ev/.test(r.url())) evs.push((r.postData() || '').match(/"e":"([^"]+)"/)?.[1] || ''); });
await p.route(/facebook|google-analytics|googletagmanager/, r => r.abort());
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForSelector('button.fdx-start', { timeout: 30000 });
await p.click('button.fdx-start');
let q = '', stuck = 0, lastQ = '';
for (let i = 0; i < 200 && !evs.includes('finder_complete'); i++) {
  q = await p.evaluate(() => (document.body.innerText.match(/QUESTION\s+\d+\s*\/\s*\d+/) || [''])[0].replace(/\s+/g, ' '));
  stuck = q === lastQ ? stuck + 1 : 0; lastQ = q;
  if (stuck > 25) break;
  await p.evaluate(() => {
    const next = [...document.querySelectorAll('button')].find(e => e.offsetParent && /次へ|結果|カルテを見る|診断する|完了/.test(e.innerText) && !/HOME/.test(e.innerText));
    if (next && !next.disabled) { next.click(); window.__done = null; return; }
    let opts = [...document.querySelectorAll('button.group')].filter(e => e.offsetParent && !e.disabled);
    if (!opts.length) opts = [...document.querySelectorAll('button,[role=radio],[role=option],[role=button],[tabindex]')].filter(e => e.offsetParent && !e.disabled && /円|使わない|はい|いいえ|TEXTURE/.test(e.innerText || ''));
    window.__done = window.__done || new Set();
    const groups = new Map(); for (const o of opts) if (!groups.has(o.parentElement)) groups.set(o.parentElement, o);
    for (const [g, o] of groups) if (!window.__done.has(g)) { window.__done.add(g); o.click(); return; }
    const rest = opts.find(o => !o.dataset.k); if (rest) { rest.dataset.k = 1; rest.click(); }
  });
  await p.waitForTimeout(450);
}
await p.waitForTimeout(4000);
const result = await p.evaluate(() => !!document.querySelector('.mx-result-hero, #result-hero'));
await b.close();
const ok = result && evs.includes('finder_start') && evs.includes('finder_complete');
console.log(JSON.stringify({ ok, result, lastQuestion: q, events: [...new Set(evs)], errors: errs.slice(0, 5) }));
if (!ok) {
  console.log(`::error::髪格診断が最後まで通りませんでした（結果表示=${result} 最後の設問=${q || 'なし'} 送った計測=${[...new Set(evs)].join(',')}）`);
  process.exit(1);
}

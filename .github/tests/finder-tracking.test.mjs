// 髪格診断の結果画面が「完了」を計測しているか（2026-10-02）
// 9/3 に結果画面を作り直したとき finder_complete の送信を移し忘れ 10/2 まで完了が 0 件になった。
// 結果画面を描く関数（mx-result / result-hero）が trackResultShown を呼んでいなければ赤にする。
import { readFileSync } from 'node:fs';

const src = readFileSync('js/finder-app.js', 'utf8');
const fails = [];

if (!/function trackResultShown\(/.test(src) || !/seamTrack\('finder_complete'/.test(src)) {
  fails.push('trackResultShown または finder_complete の送信が見つかりません');
}

// トップレベルの function ごとに切り出し、結果画面の印を持つものを調べる
const starts = [...src.matchAll(/^function (\w+)\(/gm)].map(m => ({ name: m[1], at: m.index }));
starts.forEach((s, i) => {
  const body = src.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : src.length);
  const isResult = /className:\s*'mx-result'/.test(body) || /id:\s*"result-hero"/.test(body);
  if (isResult && !/trackResultShown\(/.test(body)) fails.push(`${s.name} が結果画面を描くのに trackResultShown を呼んでいません`);
});

const checked = starts.filter((s, i) => {
  const body = src.slice(s.at, i + 1 < starts.length ? starts[i + 1].at : src.length);
  return /className:\s*'mx-result'/.test(body) || /id:\s*"result-hero"/.test(body);
}).map(s => s.name);
if (!checked.length) fails.push('結果画面を描く関数が 1 つも見つかりません（印の付け方が変わったならこの試験も直す）');

if (fails.length) {
  fails.forEach(f => console.log(`::error file=js/finder-app.js::${f}`));
  process.exit(1);
}
console.log(`結果画面 ${checked.join(', ')} はどれも完了を計測しています`);

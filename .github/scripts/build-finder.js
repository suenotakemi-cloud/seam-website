/**
 * build-finder.js
 * finder の JSX ソース (js/finder-app.jsx) を Babel で素のJSへ事前コンパイルする。
 * 出力: js/finder-app.js （本番はこれを読み込み、ブラウザ内 babel.min.js を不要にする）
 * CI(GitHub Actions)専用。ローカルにnodeが無いためここで実行する。
 */
const babel = require('@babel/core');
const fs = require('fs');

const SRC = 'js/finder-app.jsx';
const OUT = 'js/finder-app.js';

const code = fs.readFileSync(SRC, 'utf8');

// ブラウザ内の <script type="text/babel" data-presets="react"> と等価＝JSX変換のみ。
// （モダンJS構文は対象ブラウザがネイティブ対応のため変換しない＝従来と同挙動）
const result = babel.transformSync(code, {
  presets: [['@babel/preset-react', { runtime: 'classic' }]],
  compact: false,
  comments: true,
  babelrc: false,
  configFile: false,
  sourceType: 'script',
});

if (!result || !result.code) {
  console.error('❌ Babel transform produced no output');
  process.exit(1);
}

const header = '/* AUTO-GENERATED from js/finder-app.jsx by CI (build-finder.js). DO NOT EDIT — edit the .jsx source. */\n';
fs.writeFileSync(OUT, header + result.code);
console.log(`✅ built ${OUT} (${(header.length + result.code.length)} bytes) from ${SRC} (${code.length} bytes)`);

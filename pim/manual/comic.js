/* 使い方マニュアル用のイラスト（SVG）。外部の絵は使わず、この場で描く。
 *   キャラクター: ミカ（新しく入ったスタッフ）・タナカ先輩（教える人）・ジャン（バーコード模様のねこ）
 *   使い方: <div class="koma" data-who="mika" data-face="smile" data-say="こんにちは！" data-scene="phone"></div>
 *           → 1コマの絵に置き換わる。 data-who: mika | senpai | jan | both
 *           <div class="strip"> … 4つの .koma を横に並べる
 */
(function () {
  'use strict';
  var C = { skin: '#F6D7B8', skin2: '#E8B98E', hairM: '#5A3A28', hairS: '#2B2926', shirtM: '#E9A0A9', shirtS: '#5B8DB8', line: '#2B2926', paper: '#fff', bubble: '#fff', cat: '#F1EBE2', catStripe: '#2B2926' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 目・口
  function face(kind) {
    var eyes = '', mouth = '';
    if (kind === 'wow') { eyes = '<circle cx="-9" cy="-4" r="3.2" fill="#2B2926"/><circle cx="9" cy="-4" r="3.2" fill="#2B2926"/>'; mouth = '<ellipse cx="0" cy="9" rx="4" ry="5" fill="#2B2926"/>'; }
    else if (kind === 'sad') { eyes = '<path d="M-13 -6 q4 -4 8 0" stroke="#2B2926" stroke-width="2" fill="none"/><path d="M5 -6 q4 -4 8 0" stroke="#2B2926" stroke-width="2" fill="none"/>'; mouth = '<path d="M-6 11 q6 -5 12 0" stroke="#2B2926" stroke-width="2" fill="none"/>'; }
    else if (kind === 'think') { eyes = '<circle cx="-9" cy="-4" r="2.4" fill="#2B2926"/><circle cx="9" cy="-4" r="2.4" fill="#2B2926"/>'; mouth = '<path d="M-5 10 h10" stroke="#2B2926" stroke-width="2"/><text x="14" y="-14" font-size="12">?</text>'; }
    else if (kind === 'wink') { eyes = '<circle cx="-9" cy="-4" r="2.4" fill="#2B2926"/><path d="M5 -4 q4 -3 8 0" stroke="#2B2926" stroke-width="2" fill="none"/>'; mouth = '<path d="M-7 8 q7 8 14 0" stroke="#2B2926" stroke-width="2" fill="none"/>'; }
    else { eyes = '<circle cx="-9" cy="-4" r="2.4" fill="#2B2926"/><circle cx="9" cy="-4" r="2.4" fill="#2B2926"/>'; mouth = '<path d="M-7 8 q7 7 14 0" stroke="#2B2926" stroke-width="2" fill="none"/>'; }
    return eyes + mouth + '<circle cx="-15" cy="4" r="3.5" fill="#F4A6A6" opacity=".55"/><circle cx="15" cy="4" r="3.5" fill="#F4A6A6" opacity=".55"/>';
  }
  function mika(kind, x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + (s || 1) + ')">' +
      '<rect x="-20" y="26" width="40" height="44" rx="12" fill="' + C.shirtM + '"/>' + // 体
      '<rect x="-30" y="34" width="12" height="30" rx="6" fill="' + C.skin + '"/><rect x="18" y="34" width="12" height="30" rx="6" fill="' + C.skin + '"/>' +
      '<circle cx="0" cy="0" r="26" fill="' + C.skin + '"/>' +
      '<path d="M-27 -4 q0 -30 27 -30 q27 0 27 30 l-6 0 q-2 -18 -21 -18 q-19 0 -21 18 z" fill="' + C.hairM + '"/>' + // 前髪
      '<path d="M22 -8 q14 6 10 30 q-6 -12 -14 -14 z" fill="' + C.hairM + '"/>' + // ポニーテール
      face(kind) + '</g>';
  }
  function senpai(kind, x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + (s || 1) + ')">' +
      '<rect x="-22" y="26" width="44" height="46" rx="12" fill="' + C.shirtS + '"/>' +
      '<rect x="-32" y="34" width="12" height="30" rx="6" fill="' + C.skin2 + '"/><rect x="20" y="34" width="12" height="30" rx="6" fill="' + C.skin2 + '"/>' +
      '<circle cx="0" cy="0" r="26" fill="' + C.skin2 + '"/>' +
      '<path d="M-27 -6 q2 -28 27 -28 q25 0 27 28 l-5 -2 q-4 -14 -22 -14 q-18 0 -22 14 z" fill="' + C.hairS + '"/>' +
      '<circle cx="-9" cy="-3" r="8" fill="none" stroke="#2B2926" stroke-width="1.6"/><circle cx="9" cy="-3" r="8" fill="none" stroke="#2B2926" stroke-width="1.6"/><path d="M-1 -3 h2" stroke="#2B2926" stroke-width="1.6"/>' + // めがね
      face(kind) + '</g>';
  }
  function cat(kind, x, y, s) {
    return '<g transform="translate(' + x + ',' + y + ') scale(' + (s || 1) + ')">' +
      '<ellipse cx="0" cy="34" rx="26" ry="20" fill="' + C.cat + '" stroke="' + C.line + '" stroke-width="1.5"/>' +
      '<g stroke="' + C.catStripe + '" stroke-width="3"><path d="M-14 20 v22"/><path d="M-6 18 v26"/><path d="M4 18 v26"/><path d="M12 20 v22"/></g>' + // バーコード模様
      '<path d="M-22 -8 l-6 -20 l16 8 z M22 -8 l6 -20 l-16 8 z" fill="' + C.cat + '" stroke="' + C.line + '" stroke-width="1.5"/>' +
      '<circle cx="0" cy="0" r="22" fill="' + C.cat + '" stroke="' + C.line + '" stroke-width="1.5"/>' +
      '<circle cx="-8" cy="-3" r="2.5" fill="#2B2926"/><circle cx="8" cy="-3" r="2.5" fill="#2B2926"/><path d="M-3 5 l3 3 l3 -3" stroke="#2B2926" stroke-width="1.6" fill="none"/>' +
      '<path d="M-20 4 h-10 M-20 8 h-10 M20 4 h10 M20 8 h10" stroke="#2B2926" stroke-width="1.2"/>' +
      (kind === 'wow' ? '<text x="26" y="-26" font-size="14">!</text>' : '') + '</g>';
  }
  // 小道具
  function props(scene) {
    if (scene === 'phone') return '<g transform="translate(150,112)"><rect x="-16" y="-30" width="32" height="58" rx="6" fill="#2B2926"/><rect x="-13" y="-24" width="26" height="44" rx="3" fill="#FBF7F1"/><rect x="-9" y="-10" width="18" height="12" rx="2" fill="none" stroke="#A87456" stroke-width="1.5" stroke-dasharray="2 1.5"/></g>';
    if (scene === 'bottle') return '<g transform="translate(160,120)"><rect x="-14" y="-36" width="28" height="70" rx="8" fill="#DCE8F2" stroke="#2B2926" stroke-width="1.5"/><rect x="-7" y="-46" width="14" height="12" rx="3" fill="#A87456"/><rect x="-10" y="-12" width="20" height="24" fill="#fff" stroke="#2B2926" stroke-width="1"/><path d="M-6 -4 h12 M-6 2 h12 M-6 8 h8" stroke="#2B2926" stroke-width="1"/></g>';
    if (scene === 'paper') return '<g transform="translate(150,150)"><rect x="-70" y="-6" width="140" height="10" rx="2" fill="#fff" stroke="#ccc"/></g>';
    if (scene === 'pc') return '<g transform="translate(150,118)"><rect x="-44" y="-30" width="88" height="56" rx="4" fill="#2B2926"/><rect x="-40" y="-26" width="80" height="48" fill="#FBF7F1"/><rect x="-34" y="-20" width="30" height="6" rx="2" fill="#A87456"/><rect x="-34" y="-8" width="68" height="4" fill="#E7E0D6"/><rect x="-34" y="0" width="68" height="4" fill="#E7E0D6"/><rect x="-34" y="8" width="50" height="4" fill="#E7E0D6"/><rect x="-14" y="26" width="28" height="4" fill="#2B2926"/><rect x="-30" y="30" width="60" height="3" fill="#2B2926"/></g>';
    if (scene === 'csv') return '<g transform="translate(155,118)"><path d="M-26 -34 h36 l16 16 v52 h-52 z" fill="#fff" stroke="#2B2926" stroke-width="1.5"/><path d="M10 -34 v16 h16" fill="none" stroke="#2B2926" stroke-width="1.5"/><text x="-18" y="8" font-size="12" font-weight="700" fill="#2E7D5B">CSV</text><path d="M-18 16 h36 M-18 22 h36 M-18 28 h24" stroke="#ccc"/></g>';
    if (scene === 'sun') return '<circle cx="250" cy="40" r="18" fill="#FFD76A"/><g stroke="#FFD76A" stroke-width="3"><path d="M250 12 v-8 M250 68 v8 M222 40 h-8 M278 40 h8"/></g>';
    if (scene === 'x') return '<g stroke="#B4432F" stroke-width="10" stroke-linecap="round"><path d="M40 40 l220 120 M260 40 l-220 120"/></g>';
    if (scene === 'ok') return '<circle cx="150" cy="100" r="70" fill="none" stroke="#2E7D5B" stroke-width="10"/>';
    if (scene === 'wifi') return '<g transform="translate(240,50)"><path d="M-24 0 q24 -22 48 0" fill="none" stroke="#B4432F" stroke-width="3"/><path d="M-14 10 q14 -12 28 0" fill="none" stroke="#B4432F" stroke-width="3"/><circle cx="0" cy="20" r="3" fill="#B4432F"/><path d="M-26 -12 l52 40" stroke="#B4432F" stroke-width="4"/></g>';
    return '';
  }
  function bubble(text, x, y, w, tail) {
    var lines = String(text).split('\n'); var h = 16 + lines.length * 19;
    var t = tail === 'right' ? '<path d="M' + (x + w - 40) + ' ' + (y + h) + ' l10 16 l14 -16 z" fill="' + C.bubble + '" stroke="' + C.line + '" stroke-width="1.5"/>' : '<path d="M' + (x + 30) + ' ' + (y + h) + ' l-6 16 l20 -16 z" fill="' + C.bubble + '" stroke="' + C.line + '" stroke-width="1.5"/>';
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="12" fill="' + C.bubble + '" stroke="' + C.line + '" stroke-width="1.5"/>' + t + '<rect x="' + (x + 2) + '" y="' + (y + h - 3) + '" width="' + (w - 4) + '" height="5" fill="' + C.bubble + '"/>' +
      lines.map(function (l, i) { return '<text x="' + (x + w / 2) + '" y="' + (y + 22 + i * 19) + '" font-size="14" font-weight="600" text-anchor="middle" fill="#2B2926" font-family="\'Noto Sans JP\',sans-serif">' + esc(l) + '</text>'; }).join('');
  }
  function koma(el) {
    var who = el.getAttribute('data-who') || 'mika', kind = el.getAttribute('data-face') || 'smile', say = el.getAttribute('data-say') || '', scene = el.getAttribute('data-scene') || '', cap = el.getAttribute('data-cap') || '';
    var s = '<svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' + esc(say) + '">';
    s += '<rect x="1" y="1" width="298" height="218" rx="10" fill="#FBF7F1" stroke="#2B2926" stroke-width="2"/>';
    s += props(scene);
    if (who === 'both') { s += senpai(kind === 'wow' ? 'smile' : 'smile', 90, 130, 1); s += mika(kind, 210, 140, 0.95); }
    else if (who === 'senpai') s += senpai(kind, 80, 140, 1.05);
    else if (who === 'jan') s += cat(kind, 80, 140, 1.1);
    else s += mika(kind, 80, 140, 1.05);
    if (say) { var ml = Math.max.apply(null, say.split('\n').map(function (l) { return l.length; })); var bw = Math.min(200, Math.max(120, ml * 13 + 26)); s += bubble(say, 290 - bw, 12, bw, who === 'both' ? 'right' : 'left'); }
    if (cap) s += '<rect x="1" y="196" width="298" height="23" fill="#2B2926"/><text x="150" y="212" font-size="12" text-anchor="middle" fill="#fff" font-family="\'Noto Sans JP\',sans-serif">' + esc(cap) + '</text>';
    el.innerHTML = s + '</svg>';
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll('.koma'), koma); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

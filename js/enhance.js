/* ═══════════════════════════════════════════════════════════════
   SEAM Enhance — runtime hooks for the enhance.css layer
   - フィルムグレインを敷く
   - ヘッダーを View Transition で固定（遷移中ブレない）
   - ヒーロー映像にスクロール駆動パララックスを付与
   すべて try/catch で独立。失敗しても他に波及しない。
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 1. フィルムグレインを一度だけ敷く */
  try {
    if (!reduce && !document.querySelector('.seam-grain')) {
      var g = document.createElement('div');
      g.className = 'seam-grain';
      g.setAttribute('aria-hidden', 'true');
      document.body.appendChild(g);
    }
  } catch (e) {}

  /* 2. （旧）ヘッダーへの永続 view-transition-name は廃止。
        position:sticky 要素に名前を常時付けると、スクロール中にヘッダーが
        別レイヤーとして残り「二重に見える」ゴーストが出るため。
        ページ遷移は root のクロスフェードのみで十分に映画的。 */

  /* 3. ヒーロー映像にパララックス（object-cover で overflow:hidden の中だけ） */
  try {
    if (!reduce && CSS && CSS.supports && CSS.supports('animation-timeline: view()')) {
      var media = document.querySelectorAll('section video, header + * video, main video, [class*="hero"] img, [class*="hero"] video');
      for (var i = 0; i < media.length; i++) {
        var el = media[i];
        var cs = getComputedStyle(el);
        var parent = el.parentElement;
        if (!parent) continue;
        var ps = getComputedStyle(parent);
        // フィルされた絶対配置 × 親が切り抜き、のときだけ安全に適用
        if (cs.position === 'absolute' && (ps.overflow === 'hidden' || ps.overflowY === 'hidden') &&
            el.offsetHeight > 220) {
          el.classList.add('seam-parallax');
          break; /* ファーストビューのヒーロー1つだけ */
        }
      }
    }
  } catch (e) {}
})();

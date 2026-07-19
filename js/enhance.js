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

  /* 4. 画像の自己修復 —
        SW/ブラウザのキャッシュに壊れた（切れた）コピーが居座る、または
        <picture> の AVIF がデコード失敗しても webp/jpg へ落ちない、という
        2つの壊れ方に対して、その場で一度だけ復旧する。
        ・キャッシュ回避クエリ(?heal=時刻)で新URL化 → SW/HTTPキャッシュを迂回し必ず取り直す
        ・<picture> は source を外して、確実にデコードできる jpg(=img.src) へ退避
        再訪問やバージョン更新を待たずに、この閲覧のうちに直る。 */
  try {
    window.addEventListener('error', function (ev) {
      var img = ev && ev.target;
      if (!img || img.tagName !== 'IMG' || img.dataset.seamHealed) return;
      var cur = img.currentSrc || img.src || '';
      if (!cur || cur.slice(0, 5) === 'data:') return;
      var sameOrigin;
      try { sameOrigin = new URL(cur, location.href).origin === location.origin; } catch (e) { sameOrigin = false; }
      if (!sameOrigin) return; /* 署名付き外部URL等は触らない */
      img.dataset.seamHealed = '1'; /* 復旧は一度だけ（無限ループ防止） */
      var pic = img.closest && img.closest('picture');
      if (pic) {
        var srcs = pic.querySelectorAll('source');
        for (var i = 0; i < srcs.length; i++) { srcs[i].parentNode.removeChild(srcs[i]); }
      }
      var u = String(img.getAttribute('src') || cur).split('#')[0];
      img.src = u + (u.indexOf('?') > -1 ? '&' : '?') + 'heal=' + Date.now();
    }, true); /* capture: <img> の error はバブルしない */
  } catch (e) {}
})();

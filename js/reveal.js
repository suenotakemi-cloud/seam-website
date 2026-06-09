/* ══════════════════════════════════════
   SEAM — Scroll Reveal Engine
   data-reveal 要素を IntersectionObserver で監視し、
   視界に入ったら .is-revealed を付与。一度きり(戻さない)。
══════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    var els = document.querySelectorAll('[data-reveal]');
    if (!els.length) return;

    // 非対応 or reduced-motion → 即表示
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!('IntersectionObserver' in window) || reduce) {
      els.forEach(function (el) { el.classList.add('is-revealed'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-revealed');
          io.unobserve(e.target); // 一度出たら監視解除
        }
      });
    }, {
      root: null,
      // 画面下から15%入ったら発火 → 早すぎず遅すぎず
      rootMargin: '0px 0px -12% 0px',
      threshold: 0.08
    });

    els.forEach(function (el) {
      // すでに画面内(ファーストビュー)にある要素は即表示してチラつき防止
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9 && r.bottom > 0) {
        el.classList.add('is-revealed');
      } else {
        io.observe(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

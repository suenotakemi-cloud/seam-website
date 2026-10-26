/* SEAM の動き「縫い目と光」（10/26・BAL 型から作り替え・GSAP は使わない）
   home-hybrid-finished.js の組み立て（0/30/40ms）のあとに動く
   最初の画面にあるもの・縦長の画面（検索の描画）・動きを減らす設定では、何も隠さない */
(() => {
'use strict';
document.addEventListener('DOMContentLoaded', () => setTimeout(init, 80), {once: true});

function init() {
  const page = document.querySelector('.sf-page'); if (!page) return;
  // 数え上がりはやめ、事実の数字をそのまま見せる
  const facts = [...page.querySelectorAll('.sf-proof strong')].map(el => [el, el.textContent]);
  const keep = new MutationObserver(() => facts.forEach(([el, t]) => { if (el.textContent !== t) el.textContent = t; }));
  facts.forEach(([el]) => keep.observe(el, {childList: true, characterData: true, subtree: true}));

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tall = innerHeight > 1400;
  const below = el => el.getBoundingClientRect().top > innerHeight * .85;

  // 写真の器（3 本柱）：中央の金の糸と、ゆっくり動く内側
  const pillars = [...page.querySelectorAll('.sf-pillar .sf-p-img')];
  pillars.forEach(box => {
    const img = box.querySelector('img'); if (!img || box.querySelector('.sm-ph')) return;
    const ph = document.createElement('span'), inner = document.createElement('span'), thread = document.createElement('i');
    ph.className = 'sm-ph'; inner.className = 'sm-inner'; thread.className = 'sm-thread';
    img.before(ph); ph.appendChild(inner); inner.appendChild(img); box.appendChild(thread);
  });
  // 店舗のカード：写真を幕の器に
  const stores = [...page.querySelectorAll('.sf-store')];
  stores.forEach((card, i) => {
    const img = card.querySelector('img'); if (!img || img.parentNode.classList.contains('sm-curtain')) return;
    const c = document.createElement('span'); c.className = 'sm-curtain'; c.style.setProperty('--sm-d', (i % 6) * .09 + 's');
    img.before(c); c.appendChild(img);
  });
  // 窓辺の特等席：扉
  const stage = page.querySelector('.sf-interlude');
  if (stage && !stage.querySelector('.sm-door')) stage.insertAdjacentHTML('afterbegin', '<i class="sm-door l" aria-hidden="true"></i><i class="sm-door r" aria-hidden="true"></i>');
  // 足元：金のステッチ
  const foot = page.querySelector('.sf-footer');
  if (foot && !foot.querySelector('.sm-stitch')) foot.insertAdjacentHTML('afterbegin', '<svg class="sm-stitch" viewBox="0 0 560 14" aria-hidden="true" focusable="false"><line x1="0" y1="7" x2="560" y2="7" stroke="currentColor" stroke-width="1" stroke-dasharray="7 6" stroke-linecap="round"/><circle cx="0" cy="7" r="2.2" fill="currentColor"/></svg>');
  const stitch = foot && foot.querySelector('.sm-stitch'), mark = foot && foot.querySelector('b');

  if (calm) return; // 動かさない。すべて見えたまま

  // ヒーロー：息をする写真・横切る光・縫われる金の線
  const heroPhoto = page.querySelector('.sf-hero-photo');
  if (heroPhoto) { heroPhoto.classList.add('sm-breathe'); heroPhoto.insertAdjacentHTML('beforeend', '<span class="sm-sheen" aria-hidden="true"></span>'); }
  const rule = page.querySelector('.hc-rule'); if (rule) rule.classList.add('sm-sew');

  // 上端の金の縫い目
  const bar = document.createElement('i'); bar.className = 'sm-progress'; bar.setAttribute('aria-hidden', 'true'); document.body.appendChild(bar);

  // 見出しの光（中身を包んで、包んだほうを動かす）
  const headSel = '.sf-pillar h2,.sf-section>h2,.sf-identity>h2,.sf-online h2,.sf-concerns h2,.sf-seo h2,.sf-statement .sf-st-body';
  function wrapHeads() {
    page.querySelectorAll(headSel).forEach(h => {
      if (h.querySelector(':scope > .sm-h')) return;
      const s = document.createElement('span'); s.className = 'sm-h';
      while (h.firstChild) s.appendChild(h.firstChild);
      h.appendChild(s);
    });
  }
  wrapHeads();

  // 待たせるもの（最初の画面より下だけ）
  const waits = [];
  const hold = (el, kind) => { if (!el || tall || !below(el)) return; el.classList.add(kind === 'seam' ? 'sm-seam' : 'sm-wait'); waits.push([el, kind]); };
  page.querySelectorAll('.sm-h').forEach(el => hold(el, 'h'));
  pillars.forEach(el => hold(el, 'seam'));
  page.querySelectorAll('.sm-curtain').forEach(el => hold(el, 'c'));
  hold(stitch, 's'); hold(mark, 's');

  function play(el, kind) {
    if (kind === 'seam') { el.classList.add('sm-open'); return; }
    el.classList.remove('sm-wait'); el.classList.add('sm-go');
    if (kind === 'h') setTimeout(() => el.classList.add('sm-done'), 1700);
  }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; io.unobserve(e.target);
    const w = waits.find(x => x[0] === e.target); if (w) play(w[0], w[1]);
  }), {rootMargin: '0px 0px -12% 0px'});
  waits.forEach(([el]) => io.observe(el));
  // 速く飛ばしたときの取りこぼし
  function catchUp() { waits.forEach(([el, k]) => { if (!el.classList.contains('sm-go') && !el.classList.contains('sm-open') && el.getBoundingClientRect().top < innerHeight * .9) { io.unobserve(el); play(el, k); } }); }

  // スクロールに合わせる：上端の線・写真の内側・扉
  const inners = [...page.querySelectorAll('.sm-ph .sm-inner')];
  let tick = false;
  function frame() {
    tick = false;
    const vh = innerHeight, max = document.documentElement.scrollHeight - vh;
    bar.style.setProperty('--sm-p', max > 0 ? Math.min(1, scrollY / max).toFixed(4) : 0);
    inners.forEach(el => {
      const r = el.parentNode.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh) return;
      const p = (r.top + r.height / 2 - vh / 2) / vh; // -1〜1
      el.style.setProperty('--sm-y', (p * -r.height * .05).toFixed(1) + 'px');
    });
    if (stage) {
      const r = stage.getBoundingClientRect();
      // 画面の下 85% に入ってから、真ん中に来るまでで開ききる
      const o = Math.max(0, Math.min(1, (vh * .85 - r.top) / (vh * .85 - (vh - r.height) / 2)));
      stage.style.setProperty('--sm-o', tall ? 1 : (o * o * (3 - 2 * o)).toFixed(3));
    }
  }
  const onScroll = () => { if (!tick) { tick = true; requestAnimationFrame(frame); } catchUp(); };
  addEventListener('scroll', onScroll, {passive: true});
  addEventListener('resize', onScroll, {passive: true});
  frame();

  // 言語を切り替えたら、見出しを包み直す（新しい文字は待たせない）
  addEventListener('seam:langchange', () => setTimeout(() => { wrapHeads(); page.querySelectorAll('.sm-h').forEach(el => { if (!el.classList.contains('sm-wait')) el.classList.add('sm-done'); }); }, 50));
}
})();

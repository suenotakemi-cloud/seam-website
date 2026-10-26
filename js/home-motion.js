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
  const kinds = ['shelf', 'seam', 'ripple']; // ショップの棚・個室サロン・ヘッドスパ
  pillars.forEach((box, i) => {
    const img = box.querySelector('img'); if (!img || box.querySelector('.sm-ph')) return;
    const ph = document.createElement('span'), inner = document.createElement('span');
    ph.className = 'sm-ph'; inner.className = 'sm-inner';
    img.before(ph); ph.appendChild(inner); inner.appendChild(img);
    box.dataset.smKind = kinds[i % 3];
    if (box.dataset.smKind === 'seam') box.insertAdjacentHTML('beforeend', '<i class="sm-thread" aria-hidden="true"></i>');
    if (box.dataset.smKind === 'ripple') box.insertAdjacentHTML('beforeend', '<i class="sm-ring" aria-hidden="true"></i><i class="sm-ring" aria-hidden="true"></i>');
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
  // 足元：オートクチュールの織りネーム（SEAM をネームで包み、縁を縫う）
  const foot = page.querySelector('.sf-footer'), mark = foot && foot.querySelector('b');
  let label = foot && foot.querySelector('.sm-label');
  if (mark && !label) {
    label = document.createElement('span'); label.className = 'sm-label';
    mark.before(label); label.appendChild(mark);
    label.insertAdjacentHTML('beforeend', '<span class="sm-label-sub" aria-hidden="true">SALON HAIR CARE · HAIR SALON · HEAD SPA</span>');
  }

  if (calm) return; // 動かさない。すべて見えたまま

  // ヒーロー：その日最初の来訪は hero-intro（紡ぐ）が受け持つ。2 回目からは写真がゆっくり息をし、金の線が縫われる
  if (document.documentElement.dataset.hi !== '1') {
    const heroPhoto = page.querySelector('.sf-hero-photo'); if (heroPhoto) heroPhoto.classList.add('sm-breathe');
    const rule = page.querySelector('.hc-rule'); if (rule) rule.classList.add('sm-sew');
  }

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
  const hold = (el, kind) => { if (!el || tall || !below(el)) return; if (kind === 'seam') el.classList.add('sm-k', 'sm-k-' + el.dataset.smKind); else el.classList.add('sm-wait'); waits.push([el, kind]); };
  page.querySelectorAll('.sm-h').forEach(el => {
    el.classList.add(el.closest('.sf-pillar') ? 'sm-rise' : el.closest('.sf-statement') ? 'sm-trace' : 'sm-weave');
    hold(el, 'h');
  });
  pillars.forEach(el => hold(el, 'seam'));
  page.querySelectorAll('.sm-curtain').forEach(el => hold(el, 'c'));
  if (label) { hold(label, 'label'); if (label.classList.contains('sm-wait')) mark.classList.add('sm-wait'); }

  function play(el, kind) {
    if (kind === 'seam') { el.classList.add('sm-open'); return; }
    if (kind === 'label') sew(el);
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

  // 織りネームを縫う：糸が曲線で降りる → 針が縁を二重に縫い付ける
  function sew(lab) {
    const w = lab.offsetWidth, h = lab.offsetHeight, ns = 'http://www.w3.org/2000/svg';
    if (!w || !h) return;
    const r = 3, rect = (o) => `M${o} ${o + r} Q${o} ${o} ${o + r} ${o} H${w - o - r} Q${w - o} ${o} ${w - o} ${o + r} V${h - o - r} Q${w - o} ${h - o} ${w - o - r} ${h - o} H${o + r} Q${o} ${h - o} ${o} ${h - o - r} Z`;
    const tail = `M${w * .5} ${-70} C${w * .5} ${-30} ${w * .1} ${-36} ${2} ${r + 2}`;
    lab.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${w} ${h}" aria-hidden="true" focusable="false"><defs><mask id="smm1" maskUnits="userSpaceOnUse"><path d="${rect(2)}" stroke="#fff" stroke-width="6" fill="none"/></mask><mask id="smm2" maskUnits="userSpaceOnUse"><path d="${rect(7)}" stroke="#fff" stroke-width="6" fill="none"/></mask></defs><path class="tail" d="${tail}"/><path class="st" d="${rect(2)}" mask="url(#smm1)"/><path class="st st2" d="${rect(7)}" mask="url(#smm2)"/><path class="needle" d="M-7 -1.1 L7 0 L-7 1.1 Z"/></svg>`);
    const svg = lab.querySelector('svg'), tailP = svg.querySelector('.tail'), m1 = svg.querySelector('#smm1 path'), m2 = svg.querySelector('#smm2 path'), needle = svg.querySelector('.needle');
    const prep = p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; return L; };
    const LT = prep(tailP), L1 = prep(m1), L2 = prep(m2);
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const T0 = performance.now(), dT = 900, d1 = 2400, d2 = 2400, lag = 500;
    function step(now) {
      const t = now - T0;
      const a = Math.min(1, t / dT), b = Math.min(1, Math.max(0, (t - dT) / d1)), c = Math.min(1, Math.max(0, (t - dT - lag) / d2));
      tailP.style.strokeDashoffset = LT * (1 - ease(a));
      m1.style.strokeDashoffset = L1 * (1 - ease(b));
      m2.style.strokeDashoffset = L2 * (1 - ease(c));
      // 針：糸の先 → 外の縁の先
      const onTail = b === 0, p = onTail ? tailP.getPointAtLength(LT * ease(a)) : m1.getPointAtLength(L1 * ease(b));
      const p2 = onTail ? tailP.getPointAtLength(Math.min(LT, LT * ease(a) + 1)) : m1.getPointAtLength(Math.min(L1, L1 * ease(b) + 1));
      const ang = Math.atan2(p2.y - p.y, p2.x - p.x) * 180 / Math.PI;
      needle.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${ang})`);
      needle.style.opacity = b >= 1 ? Math.max(0, 1 - (t - dT - d1) / 500) : 1;
      if (c < 1 || t < dT + d1 + 500) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    lab.classList.remove('sm-wait'); lab.classList.add('sm-go');
    if (mark) setTimeout(() => { mark.classList.remove('sm-wait'); mark.classList.add('sm-go'); }, dT + 900);
  }

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

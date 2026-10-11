/* 店舗ページの登場：金のアーチ→写真が下から満ちて寄る→店名が一文字ずつ→金の区切り（所有者 10/11）
   見出しのめくれと写真の静かな登場は毎回（一度見えたら止まる） */
(() => {
  const root = document.documentElement, add = c => root.classList.add(c);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const all = () => { add('pi-photo'); add('pi-open'); add('pi-copy'); const h = document.querySelector('.stc-copy h1'); if (h) h.classList.add('pi-ready'); };
  function prepCopy() {
    const h1 = document.querySelector('.stc-copy h1'); if (!h1) return;
    const tn = [...h1.childNodes].find(n => n.nodeType === 3 && n.textContent.trim());
    if (tn && !h1.querySelector('.pi-name')) {
      const name = document.createElement('span'); name.className = 'pi-name'; name.setAttribute('aria-label', tn.textContent.trim());
      [...tn.textContent].forEach((c, i) => { const s = document.createElement('span'); s.className = 'pi-ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i); s.textContent = c; name.appendChild(s); });
      h1.replaceChild(name, tn); name.classList.add('pi-split');
    }
    if (!document.querySelector('.pi-rule')) { const r = document.createElement('span'); r.className = 'pi-rule'; r.setAttribute('aria-hidden', 'true'); h1.after(r); }
    h1.classList.add('pi-ready');
  }
  function intro() {
    const hero = document.querySelector('.st-hero'), pic = hero && hero.querySelector('picture');
    if (!pic || reduce || innerHeight > 1400) return all();
    const W = hero.clientWidth, H = hero.clientHeight; if (!W || !H) return all();
    const a = Math.min(W * .26, H * .3), x = W / 2 - a, top = H * .1, bot = H * .9;
    [['--pi-t', top], ['--pi-b0', bot], ['--pi-b', H - bot], ['--pi-l', x], ['--pi-r', W - x - 2 * a], ['--pi-a', a]].forEach(([k, n]) => root.style.setProperty(k, n + 'px'));
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    svg.setAttribute('class', 'pi-arch'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true');
    p.setAttribute('d', `M${x} ${bot} V${top + a} A${a} ${a} 0 0 1 ${x + 2 * a} ${top + a} V${bot}`);
    svg.appendChild(p); pic.after(svg);
    const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset .9s linear'; p.style.strokeDashoffset = 0;
    setTimeout(() => add('pi-photo'), 1000); setTimeout(() => add('pi-open'), 1400); setTimeout(() => add('pi-copy'), 1700); setTimeout(all, 4500);
  }
  function scrollBits() {
    if (reduce || !('IntersectionObserver' in window)) return;
    const tall = innerHeight > 1400;
    const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; const t = e.target; t.classList.remove('pi-wait'); t.classList.add('pi-go', 'pi-in-view'); io.unobserve(t); }), {rootMargin: '-15% 0px'});
    document.querySelectorAll('main h2').forEach(h => {
      if (h.closest('.st-hero')) return;
      const inner = document.createElement('span'); inner.className = 'pi-in'; while (h.firstChild) inner.appendChild(h.firstChild); h.appendChild(inner); h.classList.add('pi-flip');
      if (tall || h.getBoundingClientRect().top < innerHeight * .8) return;
      h.classList.add('pi-wait'); io.observe(h);
    });
    document.querySelectorAll('.st-gal img, .st-gal picture').forEach((el, i) => {
      if (el.tagName === 'IMG' && el.closest('picture')) return;
      if (tall || el.getBoundingClientRect().top < innerHeight * .9) return;
      el.style.setProperty('--i', i % 4); el.classList.add('pi-rise'); io.observe(el);
    });
  }
  function run() { prepCopy(); if (root.dataset.pi === '1') intro(); else all(); scrollBits(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 30), {once:true}); else setTimeout(run, 30);
})();

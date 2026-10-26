/* トップの写真の出方：紡ぐ（10/26・アーチから作り替え）
   0〜1.0s 金の糸が 7 本、波打ちながら横に紡がれる → 0.9s 写真が織り機のように帯で織り上がる（左右交互）
   → 1.7s 糸が 1 本に寄り集まり消える → 1.9s 美髪を買う が糸で書かれるように → 金の区切り → SEAM */
(() => {
  const root = document.documentElement;
  if (root.dataset.hi !== '1') return;
  const add = c => root.classList.add(c), all = () => ['hi-photo', 'hi-open', 'hi-gather', 'hi-copy'].forEach(add);
  function split() {
    document.querySelectorAll('.sf-page .hc-main').forEach(el => {
      if (el.querySelector('.hc-ch')) return;
      const t = el.textContent; el.setAttribute('aria-label', t); el.textContent = ''; el.classList.add('hc-split');
      [...t].forEach((c, i) => { const s = document.createElement('span'); s.className = 'hc-ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i); s.textContent = c === ' ' ? ' ' : c; el.appendChild(s); });
    });
  }
  function run() {
    split();
    const hero = document.querySelector('.sf-page .sf-hero'), photo = hero && hero.querySelector('.sf-hero-photo');
    if (!photo || innerHeight > 1400 || matchMedia('(prefers-reduced-motion: reduce)').matches) return all(); // 縦長の描画（検索エンジン）では隠さない
    const W = hero.clientWidth, H = photo.clientHeight || hero.clientHeight;
    if (!W || !H) return all();
    const N = 7, loom = document.createElement('div');
    loom.className = 'hi-loom'; loom.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < N; i++) { const b = document.createElement('i'); b.style.setProperty('--i', i); loom.appendChild(b); }
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none');
    const cy = H * .5;
    for (let i = 0; i < N; i++) {
      const y = H * (.2 + i * .1), a = 5 + (i % 3) * 3, p = document.createElementNS(ns, 'path');
      p.setAttribute('d', `M-10 ${y} C${W * .17} ${y - a} ${W * .33} ${y + a} ${W * .5} ${y} S${W * .83} ${y - a} ${W + 10} ${y}`);
      p.style.setProperty('--dy', (cy - y) + 'px'); p.style.setProperty('--i', i);
      svg.appendChild(p);
    }
    loom.appendChild(svg); photo.after(loom);
    svg.querySelectorAll('path').forEach((p, i) => {
      const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect();
      p.style.transition = `stroke-dashoffset 1s cubic-bezier(.65,0,.35,1) ${i * 70}ms, transform 1.1s cubic-bezier(.65,0,.35,1), opacity .7s ease .45s`;
      p.style.strokeDashoffset = 0;
    });
    setTimeout(() => add('hi-photo'), 900);
    setTimeout(() => add('hi-gather'), 1700);
    setTimeout(() => add('hi-open'), 1700);
    setTimeout(() => add('hi-copy'), 1900);
    setTimeout(() => { all(); loom.remove(); }, 4800); // 何があっても 4.8 秒で全部見える
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 40), {once: true}); else setTimeout(run, 40);
})();

/* トップの写真の出方：金のアーチ（所有者 10/11 案1）
   0〜0.9s 金の線が描かれる → 1.0s 写真がアーチの中に → 1.4s 画面いっぱいへ → 1.9s 文字 */
(() => {
  const root = document.documentElement;
  if (root.dataset.hi !== '1') return;
  const add = c => root.classList.add(c), all = () => { add('hi-photo'); add('hi-open'); add('hi-copy'); };
  function run() {
    const hero = document.querySelector('.sf-page .sf-hero'), photo = hero && hero.querySelector('.sf-hero-photo');
    if (!photo || innerHeight > 1400 || matchMedia('(prefers-reduced-motion: reduce)').matches) return all(); // 縦長の描画（検索エンジン）では隠さない
    const W = hero.clientWidth, H = photo.clientHeight || hero.clientHeight;
    if (!W || !H) return all();
    const a = Math.min(W * .3, H * .3), x = W / 2 - a, top = H * .12, bot = H * .9;
    [['--hi-t', top], ['--hi-b', H - bot], ['--hi-l', x], ['--hi-r', W - x - 2 * a], ['--hi-a', a]].forEach(([k, n]) => root.style.setProperty(k, n + 'px'));
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
    svg.setAttribute('class', 'hi-arch'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('aria-hidden', 'true'); svg.style.height = H + 'px';
    p.setAttribute('d', `M${x} ${bot} V${top + a} A${a} ${a} 0 0 1 ${x + 2 * a} ${top + a} V${bot}`);
    svg.appendChild(p); photo.after(svg);
    const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect();
    p.style.transition = 'stroke-dashoffset .9s linear'; p.style.strokeDashoffset = 0;
    setTimeout(() => add('hi-photo'), 1000);
    setTimeout(() => add('hi-open'), 1400);
    setTimeout(() => add('hi-copy'), 1900);
    setTimeout(all, 4000); // 何があっても 4 秒で全部見える
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 40), {once:true}); else setTimeout(run, 40);
})();

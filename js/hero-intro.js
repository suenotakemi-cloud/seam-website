/* トップの写真の出方：紡ぐ＝繋ぎ合わせる（10/26・アーチから作り替え）
   0〜1.3s 写真の左半分と右半分が両側から寄り、中央で出会う → 1.1s 金の糸が縫い目を上から下へ縫い合わせる
   → 2.1s 一枚になり縫い目が溶ける → 2.0s 美髪を買う が一文字ずつ → 金の区切り → SEAM */
(() => {
  const root = document.documentElement;
  if (root.dataset.hi !== '1') return;
  const add = c => root.classList.add(c), all = () => ['hi-photo', 'hi-open', 'hi-join', 'hi-sewn', 'hi-copy'].forEach(add);
  function split() {
    document.querySelectorAll('.sf-page .hc-main').forEach(el => {
      if (el.querySelector('.hc-ch')) return;
      const t = el.textContent; el.setAttribute('aria-label', t); el.textContent = ''; el.classList.add('hc-split');
      [...t].forEach((c, i) => { const s = document.createElement('span'); s.className = 'hc-ch'; s.setAttribute('aria-hidden', 'true'); s.style.setProperty('--i', i); s.textContent = c === ' ' ? ' ' : c; el.appendChild(s); });
    });
  }
  function run() {
    split();
    const hero = document.querySelector('.sf-page .sf-hero'), photo = hero && hero.querySelector('.sf-hero-photo'), img = photo && photo.querySelector('img');
    if (!img || innerHeight > 1400 || matchMedia('(prefers-reduced-motion: reduce)').matches) return all(); // 縦長の描画（検索エンジン）では隠さない
    const W = hero.clientWidth, H = photo.clientHeight || hero.clientHeight;
    if (!W || !H) return all();
    const src = img.currentSrc || img.src;
    const join = document.createElement('div'); join.className = 'hi-join'; join.setAttribute('aria-hidden', 'true');
    ['l', 'r'].forEach(k => { const h = document.createElement('div'), im = document.createElement('img'); h.className = 'hi-half ' + k; im.alt = ''; im.src = src; h.appendChild(im); join.appendChild(h); });
    // 縫い目：中央を上から下へ、斜めの目を交互に
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), cx = W / 2, n = Math.max(10, Math.round(H / 34));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('preserveAspectRatio', 'none');
    let d = '';
    for (let i = 0; i < n; i++) { const y = (i + .5) * H / n, s = 6; d += `M${cx - s} ${y - s * .7} L${cx + s} ${y + s * .7} `; }
    const st = document.createElementNS(ns, 'path'); st.setAttribute('d', d); st.setAttribute('class', 'hi-st');
    const line = document.createElementNS(ns, 'path'); line.setAttribute('d', `M${cx} 0 V${H}`); line.setAttribute('class', 'hi-seamline');
    svg.appendChild(line); svg.appendChild(st); join.appendChild(svg);
    photo.after(join);
    const reveal = p => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; p.getBoundingClientRect(); return L; };
    reveal(line); reveal(st);
    requestAnimationFrame(() => add('hi-join'));                         // 左右が寄る
    setTimeout(() => { line.style.transition = st.style.transition = 'stroke-dashoffset 1s cubic-bezier(.65,0,.35,1)'; line.style.strokeDashoffset = st.style.strokeDashoffset = 0; }, 1100); // 縫い合わせる
    setTimeout(() => add('hi-photo'), 2100);                             // 一枚になる
    setTimeout(() => add('hi-sewn'), 2150);
    setTimeout(() => add('hi-open'), 2150);
    setTimeout(() => add('hi-copy'), 2000);
    setTimeout(() => { all(); join.remove(); }, 4800); // 何があっても 4.8 秒で全部見える
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(run, 40), {once: true}); else setTimeout(run, 40);
})();

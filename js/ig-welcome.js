/* Instagram から トップに来た方へ 2 つの入口（2026-10-02）
 * 10/2 の計測：Instagram からトップへ 30 日で 7,238 回・平均 12 秒・30% までしか見ずに帰っていた。
 * いちばん反応のある「3分の髪格診断」と「銀座のヘッドスパ」を すぐ押せる位置に出す。
 * 日本語のトップで Instagram から来た訪問の最初だけ。× で閉じたらこの訪問では出さない */
(function () {
  try {
    if (!/^\/(index\.html)?$/.test(location.pathname)) return;
    if (!/^ja/i.test(document.documentElement.lang || 'ja')) return;
    var fromIg = /instagram\.com/.test(document.referrer) || /^ig/i.test(new URLSearchParams(location.search).get('utm_source') || '');
    if (!fromIg || sessionStorage.getItem('seam_igw_closed')) return;
  } catch (e) { return; }
  function show() {
    var el = document.createElement('div');
    el.id = 'igWelcome';
    el.setAttribute('data-track-view', 'ig_welcome');
    el.innerHTML =
      '<a href="/finder" data-track-click="ig_welcome_finder"><b>3分で髪格診断</b><span>あなたの髪に合う一本へ</span></a>' +
      '<a href="/headspa-ginza" data-track-click="ig_welcome_spa"><b>銀座のヘッドスパ</b><span>完全個室で整える</span></a>' +
      '<button type="button" aria-label="閉じる">×</button>';
    var st = document.createElement('style');
    st.textContent = '#igWelcome{position:fixed;left:12px;right:12px;bottom:calc(58px + env(safe-area-inset-bottom,0px) + 10px);z-index:60;display:grid;grid-template-columns:1fr 1fr auto;gap:6px;padding:6px;border-radius:16px;background:rgba(22,23,27,.94);box-shadow:0 10px 30px rgba(22,23,27,.25)}' +
      '#igWelcome a{display:flex;flex-direction:column;justify-content:center;min-height:52px;padding:6px 12px;border-radius:11px;background:#fff;color:#16171B;text-decoration:none;touch-action:manipulation}' +
      '#igWelcome a+a{background:#F3EEE6}' +
      '#igWelcome b{font-weight:500;font-size:13.5px;letter-spacing:.02em}#igWelcome span{font-size:10.5px;color:#6b665f;margin-top:2px}' +
      '#igWelcome button{width:36px;border:0;background:transparent;color:#fff;font-size:18px;cursor:pointer}' +
      '#igWelcome a:focus-visible,#igWelcome button:focus-visible{outline:2px solid #B8945A;outline-offset:2px}' +
      '@media(min-width:1024px){#igWelcome{left:auto;right:28px;bottom:28px;width:460px}}';
    document.head.appendChild(st);
    document.body.appendChild(el);
    // 初めての方には Cookie のお知らせが同じ場所に出るので その上に置く（閉じたら元の位置へ）
    function place() {
      var cb = null;
      document.querySelectorAll('body > div, body > section, body > aside').forEach(function (d) {
        if (cb || d === el) return;
        var cs = getComputedStyle(d);
        if (cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden' && /Cookie/i.test(d.textContent || '')) cb = d;
      });
      var r = cb && cb.getBoundingClientRect();
      el.style.bottom = (r && r.height) ? (window.innerHeight - r.top + 8) + 'px' : '';
    }
    place();
    var n = 0, iv = setInterval(function () { place(); if (++n > 40) clearInterval(iv); }, 500);
    el.querySelector('button').addEventListener('click', function () {
      el.remove();
      try { sessionStorage.setItem('seam_igw_closed', '1'); } catch (e) {}
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();

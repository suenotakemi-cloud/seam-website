/* SEAM 管理画面の共通タブ（2026-10-02 所有者「いちいちログインし直すのはタイムロス・タブを上に全部」）
 * ① パスキーを 1 つにそろえる：診断(admin)・受信箱(admin-inbox)・入場(entrance-admin)・執筆(write) は
 *    同じ ADMIN_KEY なのに 保存場所がばらばらで ページを移るたびに入力になっていた。
 *    どこかに保存されていれば 全ページの保存場所へ写す（同じタブ＋この端末に 30 日）。
 * ② 上にタブを並べ 同じタブのままページを移れるようにする。
 * ③ どのページのログアウトでも 全部の保存場所を消す。
 * <head> で読む（各ページの script より先に鍵をそろえるため）。 */
(function () {
  var TTL = 30 * 24 * 3600 * 1000;
  function get(fn) { try { return fn() || ''; } catch (e) { return ''; } }
  var v2 = get(function () { var o = JSON.parse(localStorage.getItem('seam_admin_key_v2') || 'null'); return o && o.k && o.exp > Date.now() ? o.k : ''; });
  var key = get(function () { return sessionStorage.getItem('seam_admin_key'); }) || v2 ||
    get(function () { return localStorage.getItem('seam_entrance_admin_key'); }) ||
    get(function () { return localStorage.getItem('seam_admin_key'); });
  if (key) {
    try {
      sessionStorage.setItem('seam_admin_key', key);
      if (!v2) localStorage.setItem('seam_admin_key_v2', JSON.stringify({ k: key, exp: Date.now() + TTL }));
      localStorage.setItem('seam_entrance_admin_key', key);
      localStorage.setItem('seam_admin_key', key);
    } catch (e) {}
  }
  function clearAll() {
    try {
      sessionStorage.removeItem('seam_admin_key');
      ['seam_admin_key_v2', 'seam_entrance_admin_key', 'seam_admin_key'].forEach(function (k) { localStorage.removeItem(k); });
    } catch (e) {}
  }
  window.SEAMAdminLogout = clearAll;
  // 各ページのログアウトボタン（id か文言で拾う）を押したら 全部消す
  document.addEventListener('click', function (e) {
    var b = e.target && e.target.closest && e.target.closest('button,a');
    if (b && (b.id === 'logoutBtn' || /ログアウト/.test(b.textContent || ''))) clearAll();
  }, true);

  var TABS = [
    ['診断', '/admin', function (p, s) { return /^\/admin(\.html)?$/.test(p) && !/view=skin/.test(s); }],
    ['肌ストーリー', '/admin?view=skin', function (p, s) { return /^\/admin(\.html)?$/.test(p) && /view=skin/.test(s); }],
    ['応募', '/admin-inbox#recruit', function (p, s, h) { return /^\/admin-inbox/.test(p) && (h === '#recruit' || h === '' || h === '#all' || h === '#open'); }],
    ['求人の集計', '/admin-inbox#funnel', function (p, s, h) { return /^\/admin-inbox/.test(p) && h === '#funnel'; }],
    ['フランチャイズ', '/admin-inbox#franchise', function (p, s, h) { return /^\/admin-inbox/.test(p) && h === '#franchise'; }],
    ['入場', '/entrance-admin', function (p) { return /^\/entrance-admin/.test(p); }],
    ['読みもの', '/write', function (p) { return /^\/write/.test(p); }]
  ];
  function draw() {
    var nav = document.getElementById('seamAdminTabs');
    if (!nav) {
      nav = document.createElement('nav');
      nav.id = 'seamAdminTabs';
      nav.setAttribute('aria-label', '管理画面');
      var st = document.createElement('style');
      st.textContent = '#seamAdminTabs{display:flex;gap:4px;overflow-x:auto;padding:8px 12px;background:#16171B;scrollbar-width:none;position:relative;z-index:50}' +
        '#seamAdminTabs::-webkit-scrollbar{display:none}' +
        '#seamAdminTabs a{flex:none;color:#d8d4cc;text-decoration:none;font:500 13px/1 system-ui,-apple-system,"Hiragino Sans",sans-serif;padding:10px 14px;border-radius:999px;white-space:nowrap}' +
        '#seamAdminTabs a:hover{color:#fff;background:rgba(255,255,255,.08)}' +
        '#seamAdminTabs a[aria-current="page"]{background:#fff;color:#16171B}' +
        '#seamAdminTabs a:focus-visible{outline:2px solid #B8945A;outline-offset:2px}';
      document.head.appendChild(st);
      document.body.insertBefore(nav, document.body.firstChild);
    }
    var p = location.pathname, s = location.search, h = location.hash;
    nav.innerHTML = TABS.map(function (t) {
      return '<a href="' + t[1] + '"' + (t[2](p, s, h) ? ' aria-current="page"' : '') + '>' + t[0] + '</a>';
    }).join('');
  }
  if (document.body) draw(); else document.addEventListener('DOMContentLoaded', draw);
  window.addEventListener('hashchange', draw);
  window.addEventListener('popstate', draw);
})();

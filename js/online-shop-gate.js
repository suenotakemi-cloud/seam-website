/*  SEAM Online Shop Gate
    オンラインショップへのリンクをタップ時に、招待コード必須のご案内モーダルを表示する。
    フック対象:
      - <a href$="onlineshop.html">
      - <a data-online-shop-gate>
*/
(function () {
  if (window.__seamOnlineShopGateInit) return;
  window.__seamOnlineShopGateInit = true;

  // ── モーダル DOM 構築 ─────────────────────────────────
  var modal = document.createElement('div');
  modal.id = 'seam-online-shop-gate';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'seam-gate-title');
  modal.style.cssText = [
    'display:none',
    'position:fixed',
    'inset:0',
    'z-index:9998',
    'background:rgba(26,24,21,0.55)',
    '-webkit-backdrop-filter:blur(6px)',
    'backdrop-filter:blur(6px)',
    'align-items:center',
    'justify-content:center',
    'padding:24px',
    'opacity:0',
    'transition:opacity 220ms ease'
  ].join(';');

  modal.innerHTML = '\
<div id="seam-gate-card" style="background:#FAF8F4; border:1px solid #E2DDD3; border-radius:3px; max-width:380px; width:100%; padding:38px 28px 26px; text-align:center; box-shadow:0 24px 60px rgba(26,24,21,0.22); position:relative; transform:translateY(8px); transition:transform 260ms ease;">\
  <span aria-hidden="true" style="position:absolute; top:12px; left:12px; width:12px; height:12px; border-top:1px solid #B8945A; border-left:1px solid #B8945A;"></span>\
  <span aria-hidden="true" style="position:absolute; top:12px; right:12px; width:12px; height:12px; border-top:1px solid #B8945A; border-right:1px solid #B8945A;"></span>\
  <span aria-hidden="true" style="position:absolute; bottom:12px; left:12px; width:12px; height:12px; border-bottom:1px solid #B8945A; border-left:1px solid #B8945A;"></span>\
  <span aria-hidden="true" style="position:absolute; bottom:12px; right:12px; width:12px; height:12px; border-bottom:1px solid #B8945A; border-right:1px solid #B8945A;"></span>\
  <p style="font-family:Inter,\'Noto Sans JP\',sans-serif; letter-spacing:0.32em; text-transform:uppercase; font-size:10px; color:#B8945A; margin:0 0 14px; font-weight:500;">— Members Only</p>\
  <h3 id="seam-gate-title" style="font-family:\'Cormorant Garamond\',\'Noto Serif JP\',serif; font-weight:500; font-size:22px; line-height:1.45; color:#3D3833; margin:0 0 14px; letter-spacing:-0.005em;">招待コードが必要です</h3>\
  <p style="font-family:\'Noto Serif JP\',serif; font-size:13px; line-height:2; color:#8C7A63; margin:0 0 24px;">SEAM オンラインショップは会員制です<br>招待コードは<strong style="color:#3D3833; font-weight:500;">店頭でのみ</strong>ご案内しています</p>\
  <a id="seam-gate-find-store" href="haircareshop.html#stores" style="display:flex; align-items:center; justify-content:center; gap:10px; background:#3D3833; color:#FAF8F4; padding:14px 16px; font-family:Inter,\'Noto Sans JP\',sans-serif; letter-spacing:0.26em; text-transform:uppercase; font-size:10.5px; text-decoration:none; border-radius:2px; margin-bottom:12px; transition:background 180ms;">店舗を探す <span aria-hidden="true" style="color:#D9BE93;">→</span></a>\
  <a id="seam-gate-member" href="https://salon.town/home" target="_blank" rel="noopener" style="display:block; color:#8C7A63; font-family:\'Noto Serif JP\',serif; font-size:12px; line-height:1.6; letter-spacing:0.04em; text-decoration:none; padding:4px 12px 2px;">すでに会員の方は <span style="color:#3D3833; border-bottom:1px solid #C9A76A; padding-bottom:1px;">こちらから入店</span> <span aria-hidden="true" style="color:#B8945A;">→</span></a>\
  <button id="seam-gate-close" type="button" style="background:none; border:none; color:#8C7A63; font-family:Inter,\'Noto Sans JP\',sans-serif; letter-spacing:0.22em; text-transform:uppercase; font-size:10.5px; padding:10px 12px; cursor:pointer; margin-top:2px;">閉じる</button>\
</div>';

  function ensureMounted() {
    if (!modal.isConnected) document.body.appendChild(modal);
  }

  // ── 開閉 ────────────────────────────────────────────
  function openGate() {
    ensureMounted();
    modal.style.display = 'flex';
    // フレーム揺らがないため次フレームで opacity を上げる
    requestAnimationFrame(function () {
      modal.style.opacity = '1';
      var card = modal.querySelector('#seam-gate-card');
      if (card) card.style.transform = 'translateY(0)';
    });
    document.documentElement.style.overflow = 'hidden';
  }
  function closeGate() {
    modal.style.opacity = '0';
    var card = modal.querySelector('#seam-gate-card');
    if (card) card.style.transform = 'translateY(8px)';
    setTimeout(function () {
      modal.style.display = 'none';
      document.documentElement.style.overflow = '';
    }, 200);
  }

  // ── イベント結線 ─────────────────────────────────────
  function bindModalControls() {
    modal.addEventListener('click', function (e) {
      if (e.target === modal) closeGate();
    });
    var closeBtn = modal.querySelector('#seam-gate-close');
    if (closeBtn) closeBtn.addEventListener('click', closeGate);
  }

  function bindLinkHooks() {
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a') : null;
      if (!a) return;
      var href = a.getAttribute('href') || '';
      var isOnline =
        href === 'onlineshop.html' ||
        /\/onlineshop\.html(?:$|[?#])/.test(href) ||
        a.hasAttribute('data-online-shop-gate');
      if (isOnline) {
        e.preventDefault();
        e.stopPropagation();
        openGate();
      }
    }, true);
  }

  // ESC で閉じる
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.style.display === 'flex') closeGate();
  });

  // W11: onlineshop.html を URL 直接アクセスされた場合、初回ロード時に強制ゲート表示
  //   (Google検索 / ブックマーク / 共有 経由でも招待コード必須を案内)
  //   sessionStorage で 1セッション中は再表示しない (戻る/進むで連続表示を回避)
  function autoOpenOnDirectAccess() {
    try {
      var path = location.pathname || '';
      var isOnlineShopPage = /onlineshop\.html(?:$|[?#])/.test(path) || path.endsWith('/onlineshop.html');
      if (!isOnlineShopPage) return;
      if (sessionStorage.getItem('seam-shop-gate-shown')) return;
      sessionStorage.setItem('seam-shop-gate-shown', '1');
      openGate();
    } catch (e) {}
  }

  // 初期化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      ensureMounted();
      bindModalControls();
      bindLinkHooks();
      autoOpenOnDirectAccess();
    });
  } else {
    ensureMounted();
    bindModalControls();
    bindLinkHooks();
    autoOpenOnDirectAccess();
  }

  // 外部からも呼べるように公開
  window.SEAMOnlineShopGate = { open: openGate, close: closeGate };
})();

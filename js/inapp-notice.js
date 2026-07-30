/* ══════════════════════════════════════
   SEAM — アプリ内ブラウザ検知バナー(共通)
   Instagram/LINE等のアプリ内ブラウザでは 結果の保存・LINE送信・
   端末ダウンロードが制限されるため ページを開いた瞬間に
   「外部ブラウザへの切り替え方」をわかりやすく案内する。
   - 対象ページ: finder.html / skinfinder.html (scriptタグで読み込み)
   - 動作確認用: URLに ?inapp=instagram|line|facebook を付けると強制表示
   - ✕で閉じるとそのセッション中は再表示しない(sessionStorage)
══════════════════════════════════════ */
(function () {
  'use strict';

  var force = null;
  try { force = new URLSearchParams(location.search).get('inapp'); } catch (e) {}
  var ua = navigator.userAgent || '';
  var app = force ||
    (/Instagram/i.test(ua) ? 'instagram' :
     /FBAN|FBAV|FB_IAB/i.test(ua) ? 'facebook' :
     /\bLine\//i.test(ua) ? 'line' :
     /TikTok|musical_ly|Bytedance/i.test(ua) ? 'tiktok' :
     /MicroMessenger/i.test(ua) ? 'wechat' :
     /Twitter/i.test(ua) ? 'twitter' : null);
  if (!app) return;
  try { if (!force && sessionStorage.getItem('seamInappNoticeOff') === '1') return; } catch (e) {}

  var APP_NAME = { instagram:'Instagram', facebook:'Facebook', line:'LINE', tiktok:'TikTok', wechat:'WeChat', twitter:'X' };
  if (!APP_NAME[app]) app = 'instagram';
  var HOW = {
    instagram:'画面右上の「<b>⋯</b>」→「<b>外部ブラウザで開く</b>」',
    facebook:'画面右下の「<b>⋯</b>」→「<b>外部ブラウザで開く</b>」',
    line:'画面下のメニュー →「<b>Safariで開く</b>」(Androidは「他のアプリで開く」)',
    tiktok:'画面右上の「<b>⋯</b>」→「<b>ブラウザで開く</b>」',
    wechat:'画面右上の「<b>⋯</b>」→「<b>ブラウザで開く</b>」',
    twitter:'画面下の「<b>⋯</b>」→「<b>ブラウザで開く</b>」'
  };

  function mount() {
    if (document.getElementById('seamInappNotice')) return;
    var bn = document.createElement('div');
    bn.id = 'seamInappNotice';
    bn.setAttribute('role', 'note');
    bn.style.cssText = 'margin:0;padding:14px 16px;background:linear-gradient(135deg,#FFF9EC,#F8F1E2);border-bottom:1px solid rgba(184,148,90,.5);font-family:"Noto Sans JP",sans-serif;color:#2A2D34;position:relative;z-index:40;';
    bn.innerHTML =
      '<div style="max-width:680px;margin:0 auto;display:flex;gap:10px;align-items:flex-start;">' +
        '<span aria-hidden="true" style="flex-shrink:0;font-size:15px;line-height:1.5;">&#128241;</span>' +
        '<div style="min-width:0;font-size:12px;line-height:1.9;">' +
          '<p style="margin:0;font-weight:700;font-size:12.5px;">' + APP_NAME[app] + 'のブラウザでは 結果の保存・LINEで送るが使えません</p>' +
          '<p style="margin:2px 0 0;">' + HOW[app] + ' に切り替えると このまま全部使えます</p>' +
          '<p style="margin:2px 0 0;font-size:10.5px;color:rgba(60,54,46,.65);">Saving &amp; sharing are limited in this in-app browser &mdash; please open in Safari or Chrome.</p>' +
          '<button type="button" id="seamInappCopy" style="margin-top:8px;padding:9px 14px;border:1px solid rgba(184,148,90,.6);border-radius:2px;background:#fff;font-size:11.5px;color:#2A2D34;cursor:pointer;">リンクをコピー（ブラウザに貼り付け用）</button>' +
        '</div>' +
        '<button type="button" id="seamInappClose" aria-label="閉じる" style="flex-shrink:0;background:none;border:0;font-size:16px;line-height:1;color:rgba(60,54,46,.5);padding:2px 4px;cursor:pointer;">&#10005;</button>' +
      '</div>';

    var header = document.getElementById('seam-appheader');
    if (header) header.insertAdjacentElement('afterend', bn);
    else document.body.insertBefore(bn, document.body.firstChild);

    document.getElementById('seamInappClose').onclick = function () {
      try { sessionStorage.setItem('seamInappNoticeOff', '1'); } catch (e) {}
      bn.parentNode && bn.parentNode.removeChild(bn);
    };
    document.getElementById('seamInappCopy').onclick = function () {
      var url = location.origin + location.pathname;
      var btn = this;
      function done() { btn.textContent = 'コピーしました ✓ SafariやChromeを開いて貼り付けてください'; }
      function fallback() {
        try {
          var ta = document.createElement('textarea');
          ta.value = url; ta.style.cssText = 'position:fixed;opacity:0;';
          document.body.appendChild(ta); ta.select();
          document.execCommand('copy'); ta.parentNode.removeChild(ta); done();
        } catch (e2) { btn.textContent = url; }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, fallback);
        else fallback();
      } catch (e) { fallback(); }
    };
    try { navigator.sendBeacon && navigator.sendBeacon('/api/ev', JSON.stringify({ name:'inapp_notice_shown', path:location.pathname })); } catch (e) {}
  }

  // app-header注入(defer)より後に差し込みたいので1tick遅らせる
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 0); });
  else setTimeout(mount, 0);
})();

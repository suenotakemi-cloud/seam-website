/* SEAM 商品マスタ統一（PIM）— ブラウザ共通部品
 *   ・合言葉（ADMIN_KEY）の保持と API 呼び出し
 *   ・画像 → webp 変換（どんな形式で来ても、保存されるのは webp だけ）
 *   ・スキャン音・バイブ
 * pim/index.html（スマホ）と pim/import.html（PC）の両方から使う。
 */
(function (root) {
  'use strict';
  var KEY_LS = 'seam_pim_key';

  var Auth = {
    get: function () { try { return localStorage.getItem(KEY_LS) || sessionStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } },
    set: function (k, remember) {
      try { if (remember) localStorage.setItem(KEY_LS, k); else sessionStorage.setItem(KEY_LS, k); } catch (e) { /* private mode */ }
    },
    clear: function () { try { localStorage.removeItem(KEY_LS); sessionStorage.removeItem(KEY_LS); } catch (e) { /* */ } },
  };

  // API 呼び出し（401 なら合言葉を消して {auth:true} を投げる）
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'x-seam-key': Auth.get() }, opts.headers || {});
    var init = { method: opts.method || 'GET', headers: headers, cache: 'no-store' };
    if (opts.body != null) {
      if (opts.body instanceof FormData) init.body = opts.body;
      else { headers['content-type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    }
    return fetch('/api/pim/' + path, init).then(function (r) {
      return r.json().catch(function () { return { ok: false, reason: 'bad_response', status: r.status }; }).then(function (j) {
        if (r.status === 401) { throw { auth: true, keyConfigured: j && j.keyConfigured !== false, info: j }; }
        if (r.status === 503 && j && j.reason === 'no_db') { throw { setup: true, info: j }; }
        if (!r.ok && j && j.ok !== true) { j.status = r.status; }
        return j;
      });
    });
  }

  // ── 画像 → webp ───────────────────────────────────────────
  // file: File/Blob（jpg/png/gif/bmp/heic(対応ブラウザ)/webp/avif …）
  // opts: { max: 長辺px(既定1600), quality: 0〜1(既定0.85) }
  // 返り値 Promise<{ blob, width, height, originalType, originalName }>
  function decodeImage(file) {
    if (typeof createImageBitmap === 'function') {
      return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(function () {
        return createImageBitmap(file); // 古いブラウザは向きオプション非対応
      }).catch(function () { return decodeViaImg(file); });
    }
    return decodeViaImg(file);
  }
  function decodeViaImg(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('この画像は読み込めません(' + (file.type || file.name || '不明な形式') + ')')); };
      img.src = url;
    });
  }
  function toWebp(file, opts) {
    opts = opts || {};
    var max = opts.max || 1600, quality = opts.quality == null ? 0.85 : opts.quality;
    return decodeImage(file).then(function (src) {
      var w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
      if (!w || !h) throw new Error('画像の大きさが取れません');
      var scale = Math.min(1, max / Math.max(w, h));
      var cw = Math.max(1, Math.round(w * scale)), ch = Math.max(1, Math.round(h * scale));
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch); // 透過PNGは白地に
      ctx.drawImage(src, 0, 0, cw, ch);
      if (src.close) { try { src.close(); } catch (e) { /* */ } }
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (!blob || blob.type !== 'image/webp') {
            // toBlob が webp を作れないブラウザ（古い Safari など）
            reject(new Error('このブラウザは webp 変換に対応していません。iOS 16 以降 / Chrome / Edge / Firefox をお使いください'));
            return;
          }
          resolve({ blob: blob, width: cw, height: ch, originalType: file.type || '', originalName: file.name || '' });
        }, 'image/webp', quality);
      });
    });
  }
  // このブラウザが webp を作れるか（起動時の案内用）
  function canMakeWebp() {
    try { var c = document.createElement('canvas'); c.width = c.height = 2; return c.toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; }
  }

  // 画像アップロード（webp 変換 → POST）
  function uploadImage(jan, slot, file, opts) {
    return toWebp(file, opts).then(function (r) {
      var fd = new FormData();
      fd.append('jan', jan);
      fd.append('slot', String(slot));
      fd.append('file', r.blob, jan + '_' + slot + '.webp');
      fd.append('original_name', r.originalName);
      fd.append('original_type', r.originalType);
      fd.append('width', String(r.width));
      fd.append('height', String(r.height));
      return api('images', { method: 'POST', body: fd });
    });
  }

  // ── スキャン音・バイブ ────────────────────────────────────
  var actx = null;
  function beep(ok) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = ok ? 1480 : 330;
      g.gain.value = 0.08;
      o.connect(g); g.connect(actx.destination);
      o.start(); o.stop(actx.currentTime + (ok ? 0.09 : 0.25));
    } catch (e) { /* 音が鳴らなくても困らない */ }
    try { if (navigator.vibrate) navigator.vibrate(ok ? 40 : [60, 40, 60]); } catch (e) { /* */ }
  }

  function fmtYen(v) { return v == null || v === '' ? '—' : '¥' + Number(v).toLocaleString('ja-JP'); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  root.PimClient = { Auth: Auth, api: api, toWebp: toWebp, canMakeWebp: canMakeWebp, uploadImage: uploadImage, beep: beep, fmtYen: fmtYen, esc: esc };
})(window);

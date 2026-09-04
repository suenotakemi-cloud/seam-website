/* SEAM 商品マスタ統一（PIM）— ブラウザ共通部品
 *   ・合言葉（ADMIN_KEY）の保持と API 呼び出し
 *   ・画像 → webp 変換（どんな形式で来ても、保存されるのは webp だけ）
 *   ・スキャン音・バイブ
 * pim/index.html（スマホ）と pim/import.html（PC）の両方から使う。
 */
(function (root) {
  'use strict';
  var KEY_LS = 'seam_pim_key', USER_LS = 'seam_pim_user';

  var Auth = {
    get: function () { try { return localStorage.getItem(KEY_LS) || sessionStorage.getItem(KEY_LS) || ''; } catch (e) { return ''; } },
    set: function (k, remember) {
      try { if (remember) localStorage.setItem(KEY_LS, k); else sessionStorage.setItem(KEY_LS, k); } catch (e) { /* private mode */ }
    },
    clear: function () { try { localStorage.removeItem(KEY_LS); sessionStorage.removeItem(KEY_LS); } catch (e) { /* */ } },
    // 担当者名（複数人で同時に登録するとき、誰が入れたかを残す）
    user: function () { try { return (localStorage.getItem(USER_LS) || '').slice(0, 40); } catch (e) { return ''; } },
    setUser: function (n) { try { localStorage.setItem(USER_LS, String(n || '').trim().slice(0, 40)); } catch (e) { /* */ } },
  };

  // API 呼び出し（401 なら合言葉を消して {auth:true} を投げる）
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'x-seam-key': Auth.get(), 'x-seam-user': encodeURIComponent(Auth.user()) }, opts.headers || {});
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
  // ── 商品写真の統一加工 ─────────────────────────────────────
  //   ・正方形にする（camera: 中央を切り抜く / pad: 白で余白を足して収める）
  //   ・白背景に均す（縁からつながる「ほぼ白」を純白に。白い紙・シートの上で撮る前提）
  //   ・色かぶりを補正（縁の色を基準に、白が白になるようチャンネル別にゲイン）
  //   出力は size×size（既定 1200）。誰が・どの端末で撮っても同じ大きさ・同じ構図・同じ白になる
  var WHITEN_TOL = { off: 0, weak: 26, normal: 40, strong: 58 };
  function processProductImage(src, opts) {
    opts = opts || {};
    var size = opts.size || 1200;
    var mode = opts.square === false ? 'none' : (opts.square || 'pad');   // 'pad' | 'crop' | 'none'
    var whiten = opts.whiten == null ? 'normal' : opts.whiten;            // 'off' | 'weak' | 'normal' | 'strong'
    var sw = src.width || src.naturalWidth || src.videoWidth, sh = src.height || src.naturalHeight || src.videoHeight;
    if (!sw || !sh) throw new Error('画像の大きさが取れません');
    var canvas = document.createElement('canvas'), cw, ch, ctx;
    if (mode === 'crop') {
      var side = Math.min(sw, sh);
      cw = ch = size; canvas.width = cw; canvas.height = ch; ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
      var sx = opts.cropX != null ? opts.cropX : (sw - side) / 2, sy = opts.cropY != null ? opts.cropY : (sh - side) / 2;
      var cs = opts.cropSize || side;
      ctx.drawImage(src, sx, sy, cs, cs, 0, 0, cw, ch);
    } else if (mode === 'pad') {
      cw = ch = size; canvas.width = cw; canvas.height = ch; ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
      var scale = (size * 0.92) / Math.max(sw, sh); // 縁に 4% の余白（商品が枠に触れない）
      var dw = Math.round(sw * scale), dh = Math.round(sh * scale);
      ctx.drawImage(src, Math.round((cw - dw) / 2), Math.round((ch - dh) / 2), dw, dh);
    } else {
      var sc = Math.min(1, (opts.max || 1600) / Math.max(sw, sh));
      cw = Math.max(1, Math.round(sw * sc)); ch = Math.max(1, Math.round(sh * sc));
      canvas.width = cw; canvas.height = ch; ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cw, ch);
      ctx.drawImage(src, 0, 0, cw, ch);
    }
    if (WHITEN_TOL[whiten]) whitenBackground(ctx, cw, ch, WHITEN_TOL[whiten]);
    return canvas;
  }
  // 縁から flood fill で「背景」を決めて白にする。返り値: 白にした割合（0〜1）／背景が白っぽくないときは 0（何もしない）
  function whitenBackground(ctx, w, h, tol) {
    var img = ctx.getImageData(0, 0, w, h), d = img.data, n = w * h;
    // 縁の色（明るいものだけ）の平均 = 紙の白
    var rs = 0, gs = 0, bs = 0, cnt = 0, total = 0;
    var take = function (i) { var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2]; total++; if ((r + g + b) / 3 > 150) { rs += r; gs += g; bs += b; cnt++; } };
    for (var x = 0; x < w; x += 3) { take(x); take((h - 1) * w + x); }
    for (var y = 0; y < h; y += 3) { take(y * w); take(y * w + w - 1); }
    if (cnt < total * 0.4) return 0; // 縁が暗い＝白背景で撮っていない。触らない
    var rr = rs / cnt, rg = gs / cnt, rb = bs / cnt;
    // 色かぶり補正: 紙の白が (250,250,250) になるようチャンネル別ゲイン（1.0〜1.35 に制限）
    var gr = Math.min(1.35, Math.max(1, 250 / rr)), gg = Math.min(1.35, Math.max(1, 250 / rg)), gb = Math.min(1.35, Math.max(1, 250 / rb));
    if (gr > 1.005 || gg > 1.005 || gb > 1.005) {
      for (var i = 0; i < n * 4; i += 4) { d[i] = Math.min(255, d[i] * gr); d[i + 1] = Math.min(255, d[i + 1] * gg); d[i + 2] = Math.min(255, d[i + 2] * gb); }
      rr = Math.min(255, rr * gr); rg = Math.min(255, rg * gg); rb = Math.min(255, rb * gb);
    }
    // flood fill（縁から。基準は紙の白。影は暗いので tol の範囲だけ拾う）
    var mask = new Uint8Array(n), stack = [], push = function (idx) { if (!mask[idx] && near(idx)) { mask[idx] = 1; stack.push(idx); } };
    var near = function (idx) { var j = idx * 4; return Math.abs(d[j] - rr) < tol && Math.abs(d[j + 1] - rg) < tol && Math.abs(d[j + 2] - rb) < tol; };
    for (var x2 = 0; x2 < w; x2++) { push(x2); push((h - 1) * w + x2); }
    for (var y2 = 0; y2 < h; y2++) { push(y2 * w); push(y2 * w + w - 1); }
    while (stack.length) {
      var p = stack.pop(), px = p % w, py = (p - px) / w;
      if (px > 0) push(p - 1); if (px < w - 1) push(p + 1); if (py > 0) push(p - w); if (py < h - 1) push(p + w);
    }
    // 白に塗る。境界の1px は半分だけ寄せて、切り抜き線が硬くならないように
    var filled = 0;
    for (var k = 0; k < n; k++) {
      var j = k * 4;
      if (mask[k]) { d[j] = d[j + 1] = d[j + 2] = 255; filled++; continue; }
      var kx = k % w, ky = (k - kx) / w;
      if ((kx > 0 && mask[k - 1]) || (kx < w - 1 && mask[k + 1]) || (ky > 0 && mask[k - w]) || (ky < h - 1 && mask[k + w])) {
        d[j] = (d[j] + 255) >> 1; d[j + 1] = (d[j + 1] + 255) >> 1; d[j + 2] = (d[j + 2] + 255) >> 1;
      }
    }
    ctx.putImageData(img, 0, 0);
    return filled / n;
  }
  // canvas → webp（canvas が作れなければ wasm）
  function canvasToWebp(canvas, quality) {
    var ctx = canvas.getContext('2d'), cw = canvas.width, ch = canvas.height;
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob && blob.type === 'image/webp') { resolve({ blob: blob, encoder: 'canvas', width: cw, height: ch }); return; }
        // toBlob が webp を作れないブラウザ（iPhone / iPad の Safari など）は wasm のエンコーダで作る
        var img = ctx.getImageData(0, 0, cw, ch);
        encodeWebpWasm(img, quality).then(function (u8) {
          resolve({ blob: new Blob([u8], { type: 'image/webp' }), encoder: 'wasm', width: cw, height: ch });
        }).catch(reject);
      }, 'image/webp', quality == null ? 0.85 : quality);
    });
  }
  // file → 統一加工 → webp
  //   opts: { size:1200, square:'pad'|'crop'|false, whiten:'off'|'weak'|'normal'|'strong', quality:0.85 }
  function toWebp(file, opts) {
    opts = opts || {};
    return decodeImage(file).then(function (src) {
      var canvas = processProductImage(src, opts);
      if (src.close) { try { src.close(); } catch (e) { /* */ } }
      return canvasToWebp(canvas, opts.quality).then(function (r) {
        return Object.assign(r, { originalType: file.type || '', originalName: file.name || '' });
      });
    });
  }
  // wasm 版 WebP エンコーダ（vendor/webp/ libwebp + @jsquash/webp）。初回だけ読み込む
  var wasmEnc = null;
  var WEBP_DEFAULTS = { quality: 75, target_size: 0, target_PSNR: 0, method: 4, sns_strength: 50, filter_strength: 60, filter_sharpness: 0, filter_type: 1, partitions: 0, segments: 4, pass: 1, show_compressed: 0, preprocessing: 0, autofilter: 0, partition_limit: 0, alpha_compression: 1, alpha_filtering: 1, alpha_quality: 100, lossless: 0, exact: 0, image_hint: 0, emulate_jpeg_size: 0, thread_level: 0, low_memory: 0, near_lossless: 100, use_delta_palette: 0, use_sharp_yuv: 0 };
  function encoderBase() {
    var sc = document.querySelector('script[src*="pim-client.js"]');
    var src = sc ? sc.getAttribute('src') : '../js/pim-client.js';
    return new URL(src.replace(/js\/pim-client\.js.*$/, 'vendor/webp/'), location.href).href;
  }
  function encodeWebpWasm(imageData, quality) {
    if (typeof WebAssembly === 'undefined') return Promise.reject(new Error('このブラウザは webp 変換に対応していません（WebAssembly なし）。Chrome / Safari 15 以降をお使いください'));
    if (!wasmEnc) {
      var base = encoderBase();
      wasmEnc = (new Function('u', 'return import(u)'))(base + 'webp_enc.js').then(function (mod) {
        return mod.default({ noInitialRun: true, locateFile: function (f) { return base + f; } });
      }).catch(function (e) { wasmEnc = null; throw new Error('webp 変換部品を読み込めませんでした: ' + ((e && e.message) || e)); });
    }
    return wasmEnc.then(function (m) {
      var out = m.encode(imageData.data, imageData.width, imageData.height, Object.assign({}, WEBP_DEFAULTS, { quality: Math.round((quality == null ? 0.85 : quality) * 100) }));
      if (!out) throw new Error('webp 変換に失敗しました');
      return new Uint8Array(out.buffer || out);
    });
  }
  // このブラウザが webp を作れるか（起動時の案内用）
  function canMakeWebp() {
    try { var c = document.createElement('canvas'); c.width = c.height = 2; return c.toDataURL('image/webp').indexOf('data:image/webp') === 0; } catch (e) { return false; }
  }

  // 画像アップロード（webp 変換 → POST）
  // slot は 1〜5 か 'auto'（サーバが空いている一番若い番号を確定する。複数人が同時に同じ商品へ入れても衝突しない）
  function uploadImage(jan, slot, file, opts) {
    return toWebp(file, opts).then(function (r) {
      var fd = new FormData();
      fd.append('jan', jan);
      fd.append('slot', String(slot));
      fd.append('file', r.blob, jan + '_' + slot + '.webp');
      fd.append('encoder', r.encoder || '');
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

  root.PimClient = { Auth: Auth, api: api, toWebp: toWebp, canvasToWebp: canvasToWebp, processProductImage: processProductImage, whitenBackground: whitenBackground, canMakeWebp: canMakeWebp, uploadImage: uploadImage, beep: beep, fmtYen: fmtYen, esc: esc };
})(window);

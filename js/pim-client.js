/* SEAM 商品マスタ統一（PIM）— ブラウザ共通部品
 *   ・合言葉（ADMIN_KEY）の保持と API 呼び出し
 *   ・画像 → webp 変換（どんな形式で来ても、保存されるのは webp だけ）
 *   ・スキャン音・バイブ
 * pim/index.html（スマホ）と pim/import.html（PC）の両方から使う。
 */
(function (root) {
  'use strict';
  var TOKEN_LS = 'seam_pim_token', ACCT_LS = 'seam_pim_account', USER_LS = 'seam_pim_user', ADMIN_LS = 'seam_pim_admin_key', STAFF_LS = 'seam_pim_staff';
  function lsGet(k) { try { return localStorage.getItem(k) || sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function lsSet(k, v, remember) { try { if (remember === false) sessionStorage.setItem(k, v); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  function lsDel(k) { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* */ } }

  // ── ログイン状態 ──
  //   ディーラー: ID + パスワード → トークン（端末に記憶）。スタッフは同じ ID を共用し、端末ごとに担当者名を名乗る
  //   SEAM 管理: ADMIN_KEY（pim/admin.html だけ）
  var Auth = {
    get: function () { return lsGet(TOKEN_LS); },                       // トークン
    account: function () { try { return JSON.parse(lsGet(ACCT_LS) || 'null'); } catch (e) { return null; } },
    set: function (token, account, remember) { lsSet(TOKEN_LS, token, remember); lsSet(ACCT_LS, JSON.stringify(account || null), remember); },
    clear: function () { lsDel(TOKEN_LS); lsDel(ACCT_LS); lsDel(STAFF_LS); },
    user: function () { return lsGet(USER_LS).slice(0, 40); },           // 担当者名
    setUser: function (n) { lsSet(USER_LS, String(n || '').trim().slice(0, 40)); },
    staffToken: function () { return lsGet(STAFF_LS); },                // 担当者の PIN 確認後の署名（x-seam-staff）
    setStaff: function (name, token) { Auth.setUser(name); if (token) lsSet(STAFF_LS, token); else lsDel(STAFF_LS); },
    adminKey: function () { return lsGet(ADMIN_LS); },
    setAdminKey: function (k, remember) { lsSet(ADMIN_LS, k, remember); },
    clearAdmin: function () { lsDel(ADMIN_LS); },
    // ID + パスワードでログイン → トークン保存
    login: function (loginId, password, remember) {
      return fetch('/api/pim/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ login_id: loginId, password: password }), cache: 'no-store' })
        .then(function (r) {
          return r.json().catch(function () { return { ok: false, reason: 'not_json' }; }).then(function (j) {
            j.status = r.status;
            // 理由が分かるように、サーバの状態ごとに文言を変える（現場で「ログインできません」だけだと原因が追えない）
            if (!j.ok && !j.message) {
              if (j.reason === 'no_db') j.message = 'サーバの保存先（D1 の DB binding）が未設定です。Cloudflare の設定を確認してください（db/SETUP_PIM.md ①）';
              else if (j.reason === 'not_json' && r.status === 404) j.message = 'この URL にはまだ商品登録の仕組みが配信されていません（404）。ブランチが main に取り込まれているか、プレビュー URL を確認してください';
              else if (j.reason === 'not_json') j.message = 'サーバから想定外の応答です（HTTP ' + r.status + '）。Functions が配信されているか確認してください';
              else if (r.status === 500) j.message = 'サーバ内部エラー（500）です。Cloudflare の Functions ログを確認してください';
              else j.message = 'ログインできません（' + (j.reason || ('HTTP ' + r.status)) + '）';
            }
            return j;
          });
        })
        .then(function (j) { if (j.ok) Auth.set(j.token, j.account, remember); return j; });
    },
    // パスワード変更（成功すると新しいトークンに差し替わる。他の端末は再ログインが必要）
    changePassword: function (current, password) {
      return api('auth/password', { method: 'POST', body: { current: current, password: password } }).then(function (j) {
        if (j.ok && j.token) { var remembered = false; try { remembered = !!localStorage.getItem(TOKEN_LS); } catch (e) { /* */ } Auth.set(j.token, Auth.account(), remembered); }
        return j;
      });
    },
  };

  // API 呼び出し（401 なら {auth:true, ...} を投げる）
  //   opts.admin=true のときは ADMIN_KEY（pim/admin.html 用）。opts.asAccount で管理者が特定ディーラーとして操作
  function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign({ 'x-seam-user': encodeURIComponent(Auth.user()) }, opts.headers || {});
    if (opts.admin) { headers['x-seam-key'] = Auth.adminKey(); if (opts.asAccount) headers['x-seam-account'] = opts.asAccount; }
    else { headers['x-seam-token'] = Auth.get(); var st = Auth.staffToken(); if (st) headers['x-seam-staff'] = st; }
    var init = { method: opts.method || 'GET', headers: headers, cache: 'no-store' };
    if (opts.keepalive) init.keepalive = true; // 画面を閉じる瞬間でも送り切る（撮影中フラグの解除など）
    if (opts.body != null) {
      if (opts.body instanceof FormData) init.body = opts.body;
      else { headers['content-type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    }
    return fetch('/api/pim/' + path, init).then(function (r) {
      return r.json().catch(function () { return { ok: false, reason: 'bad_response', status: r.status }; }).then(function (j) {
        if (r.status === 401) { throw { auth: true, reason: j && j.reason, message: j && j.message, keyConfigured: j && j.keyConfigured !== false, info: j }; }
        if (r.status === 403 && j && j.staff_required) { throw { staff: true, reason: j.reason, message: j.message, info: j }; } // 担当者を選び直す必要あり
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
      var sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
      var canvas = processProductImage(src, opts);
      if (src.close) { try { src.close(); } catch (e) { /* */ } }
      var q = null; try { q = analyzeImage(canvas, { srcW: sw, srcH: sh }); } catch (e) { q = null; }
      return finishImage(canvas, opts.quality).then(function (r) {
        return Object.assign(r, { originalType: file.type || '', originalName: file.name || '', quality: q });
      });
    });
  }
  // 加工済み canvas → 本体 webp ＋ 300px サムネ webp ＋ 同じ写真の検出用ハッシュ（dHash 64bit）
  function finishImage(canvas, quality) {
    return canvasToWebp(canvas, quality).then(function (r) {
      var ph = null; try { ph = phash(canvas); } catch (e) { /* */ }
      var t = document.createElement('canvas'); t.width = t.height = 300; var tx = t.getContext('2d'); tx.fillStyle = '#fff'; tx.fillRect(0, 0, 300, 300);
      var sc = 300 / Math.max(canvas.width, canvas.height), tw = Math.round(canvas.width * sc), th = Math.round(canvas.height * sc);
      tx.drawImage(canvas, Math.round((300 - tw) / 2), Math.round((300 - th) / 2), tw, th); // 正方形でない元も潰さず、白で余白
      return canvasToWebp(t, 0.8).then(function (tr) { return Object.assign(r, { thumb: tr.blob, phash: ph }); }, function () { return Object.assign(r, { thumb: null, phash: ph }); });
    });
  }
  // 写真の指紋: dHash（9×8 グレースケールの隣との明暗差・64bit）＋ 2×2 の平均色（各 4bit）→ 28 桁の hex
  //   同じ写真を別の商品に入れてしまった検出用（完全一致で見る）。色も含めるので、形が同じで色違いの商品は別物になる
  function phash(src) {
    var c = document.createElement('canvas'); c.width = 9; c.height = 8; var x = c.getContext('2d'); x.drawImage(src, 0, 0, 9, 8);
    var d = x.getImageData(0, 0, 9, 8).data, g = [], i;
    for (i = 0; i < 72; i++) g.push(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
    var hex = '';
    for (var y = 0; y < 8; y++) { var b = 0; for (var xx = 0; xx < 8; xx++) b = (b << 1) | (g[y * 9 + xx] < g[y * 9 + xx + 1] ? 1 : 0); hex += (b & 0xFF).toString(16).padStart(2, '0'); }
    var c2 = document.createElement('canvas'); c2.width = 2; c2.height = 2; var x2 = c2.getContext('2d'); x2.drawImage(src, 0, 0, 2, 2);
    var d2 = x2.getImageData(0, 0, 2, 2).data;
    for (i = 0; i < 12; i++) hex += (d2[Math.floor(i / 3) * 4 + (i % 3)] >> 4).toString(16);
    return hex;
  }
  function appendImageExtras(fd, r) { if (r.quality) fd.append('quality', JSON.stringify(r.quality)); if (r.phash) fd.append('phash', r.phash); if (r.thumb) fd.append('thumb', r.thumb, 'thumb.webp'); }

  // ── 送信待ち（電波が切れたときの一時保存。IndexedDB）──────────────────
  //   画像の POST がネットワークで失敗したら端末に貯めて、電波が戻ったら順に送る
  var IDB_NAME = 'seam_pim_outbox', IDB_STORE = 'items';
  function idb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no idb')); return; }
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true }); };
      req.onsuccess = function () { resolve(req.result); }; req.onerror = function () { reject(req.error); };
    });
  }
  function idbTx(mode, fn) { return idb().then(function (db) { return new Promise(function (resolve, reject) { var tx = db.transaction(IDB_STORE, mode); var st = tx.objectStore(IDB_STORE); var out = fn(st); tx.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : out); }; tx.onerror = function () { reject(tx.error); }; }); }); }
  var Outbox = {
    add: function (item) { item.ts = Date.now(); return idbTx('readwrite', function (st) { return st.add(item); }); },
    list: function () { return idbTx('readonly', function (st) { var req = st.getAll(); return req; }).catch(function () { return []; }); },
    remove: function (id) { return idbTx('readwrite', function (st) { st.delete(id); return null; }); },
    count: function () { return Outbox.list().then(function (l) { return l.length; }); },
    // 貯まっている分を順に送る。1 つでも失敗（ネットワーク）したらそこで止める。認証切れは呼び出し側へ
    flush: function (onEach) {
      return Outbox.list().then(function (items) {
        items.sort(function (a, b) { return a.id - b.id; });
        var sent = 0, chain = Promise.resolve(true);
        items.forEach(function (it) {
          chain = chain.then(function (go) {
            if (!go) return false;
            var fd = new FormData(); Object.keys(it.fields || {}).forEach(function (k) { fd.append(k, it.fields[k]); });
            fd.append('file', it.blob, it.name || 'x.webp'); if (it.thumb) fd.append('thumb', it.thumb, 'thumb.webp');
            return api('images', { method: 'POST', body: fd }).then(function (j) {
              var terminal = j && (j.ok || ['full', 'no_product', 'bad_jan', 'bad_slot', 'not_webp', 'too_large'].indexOf(j.reason) >= 0); // 直らない失敗は捨てる（理由は画面に出す）
              if (!terminal) return false; // 混雑・サーバ側の一時的な失敗 → 次回また
              return Outbox.remove(it.id).then(function () { if (j.ok) sent++; if (onEach) onEach(it, j); return true; });
            }, function (e) { if (e && (e.auth || e.staff)) throw e; return false; });
          });
        });
        return chain.then(function () { return sent; });
      });
    },
  };
  function isNetworkError(e) { return e && (e.name === 'TypeError' || /fetch|network|Failed to fetch|Load failed/i.test(String(e.message || e))) && !e.auth && !e.staff; }

  // ── EAN-13 バーコード（SVG）──────────────────────────────────────
  //   JAN の無い商品に振った仮コード（20…）をラベルに印刷するため。スマホの読み取りは EAN-13 として動くのでそのまま読める
  var EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
  var EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
  var EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
  var EAN_P = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];
  function ean13Svg(code, opts) {
    opts = opts || {};
    var d = String(code || '').replace(/[^0-9]/g, ''); if (d.length !== 13) return '';
    var pat = EAN_P[+d[0]], bits = '101';
    for (var i = 1; i <= 6; i++) bits += (pat[i - 1] === 'L' ? EAN_L : EAN_G)[+d[i]];
    bits += '01010';
    for (var j = 7; j <= 12; j++) bits += EAN_R[+d[j]];
    bits += '101';
    var mw = opts.module || 2, h = opts.height || 60, W = bits.length * mw + 22 * mw, s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + (h + 18) + '" width="' + W + '" height="' + (h + 18) + '"><rect width="100%" height="100%" fill="#fff"/>';
    for (var k = 0; k < bits.length; k++) { if (bits[k] === '1') { var guard = (k < 3 || (k >= 45 && k < 50) || k >= 92); s += '<rect x="' + (11 * mw + k * mw) + '" y="0" width="' + mw + '" height="' + (h + (guard ? 6 : 0)) + '" fill="#000"/>'; } }
    var fs = 11 * (mw / 2);
    s += '<text x="' + (5 * mw) + '" y="' + (h + 14) + '" font-family="monospace" font-size="' + fs + '">' + d[0] + '</text>';
    s += '<text x="' + (11 * mw + 3 * mw + 21 * mw) + '" y="' + (h + 14) + '" font-family="monospace" font-size="' + fs + '" text-anchor="middle">' + d.slice(1, 7).split('').join(' ') + '</text>';
    s += '<text x="' + (11 * mw + 50 * mw + 21 * mw) + '" y="' + (h + 14) + '" font-family="monospace" font-size="' + fs + '" text-anchor="middle">' + d.slice(7).split('').join(' ') + '</text>';
    return s + '</svg>';
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
      appendImageExtras(fd, r);
      fd.append('original_name', r.originalName);
      fd.append('original_type', r.originalType);
      fd.append('width', String(r.width));
      fd.append('height', String(r.height));
      return api('images', { method: 'POST', body: fd });
    });
  }

  // ── 写真の自動チェック（暗い・ピンぼけ・小さい・白飛び）────────────────
  //   登録の瞬間に「この写真は使えるか」を機械的に見る。検品の手戻りを減らすための目安で、止めはしない。
  //   src: 加工済み canvas。opts.srcW/srcH: 元画像の大きさ（小さすぎる元を拡大していないか）
  //   返り値 { luma, sharp, src_w, src_h, warn:['暗い','ピンぼけ','小さい','白飛び'] }
  var QUALITY = { dark: 150, sharp: 12, small: 500, blown: 0.93 };
  function analyzeImage(src, opts) {
    opts = opts || {};
    var N = 256, c = document.createElement('canvas'); c.width = N; c.height = N;
    var ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0, N, N);
    var d = ctx.getImageData(0, 0, N, N).data, g = new Float32Array(N * N);
    var sum = 0, white = 0, i;
    for (i = 0; i < N * N; i++) { var l = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; g[i] = l; sum += l; if (l > 250) white++; }
    var luma = sum / (N * N);
    // 縁（外側 6%）の明るさ = 白い紙・シートの写り。暗ければ「照明不足」（黒いボトルなど商品自体が暗いのとは区別できる）
    var es = 0, ec = 0, E = Math.round(N * 0.06);
    for (var ey = 0; ey < N; ey++) for (var ex = 0; ex < N; ex++) { if (ey < E || ey >= N - E || ex < E || ex >= N - E) { es += g[ey * N + ex]; ec++; } }
    var edgeLuma = ec ? es / ec : luma;
    // 中央 60% の領域（商品が写るところ）だけで、被写体の明るさとピントを見る（白背景に引きずられないように）
    var a = Math.round(N * 0.2), b = Math.round(N * 0.8), n2 = 0, s2 = 0, v = 0, cnt = 0, nonWhite = 0;
    for (var y = a; y < b; y++) for (var x = a; x < b; x++) { var k = y * N + x; if (g[k] < 245) { nonWhite++; s2 += g[k]; } n2++; }
    var subjectLuma = nonWhite ? s2 / nonWhite : luma;
    // ラプラシアンの分散（ピントの目安）。被写体（白でない画素）の周りだけ
    for (var y2 = a + 1; y2 < b - 1; y2++) for (var x2 = a + 1; x2 < b - 1; x2++) {
      var k2 = y2 * N + x2; if (g[k2] >= 245) continue;
      var lap = 4 * g[k2] - g[k2 - 1] - g[k2 + 1] - g[k2 - N] - g[k2 + N];
      v += lap * lap; cnt++;
    }
    var sharp = cnt ? Math.sqrt(v / cnt) : 0;
    var warn = [];
    if (edgeLuma < QUALITY.dark) warn.push('暗い');
    if (cnt > 200 && sharp < QUALITY.sharp) warn.push('ピンぼけ');
    if (opts.srcW && opts.srcH && Math.min(opts.srcW, opts.srcH) < QUALITY.small) warn.push('小さい');
    if (white / (N * N) > QUALITY.blown && nonWhite < n2 * 0.05) warn.push('白飛び');
    return { luma: Math.round(luma), edge_luma: Math.round(edgeLuma), subject_luma: Math.round(subjectLuma), sharp: Math.round(sharp * 10) / 10, src_w: opts.srcW || null, src_h: opts.srcH || null, warn: warn };
  }

  // ── zip 書き出し（圧縮なし・ブラウザ側で作る）────────────────────────
  //   写真は webp で既に圧縮済みなので「格納のみ」で十分。サーバの CPU を使わず、何万枚でも順に流せる。
  //   使い方: var z = zipWriter(sink); await z.add(name, uint8); ... await z.close();
  //   sink: { write(Uint8Array) → Promise | void }（showSaveFilePicker の WritableStream でも、配列に貯めて Blob にしてもよい）
  var CRC_T = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
  function crc32(u8) { var c = 0xFFFFFFFF; for (var i = 0; i < u8.length; i++) c = CRC_T[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function dosTime(d) { return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xFFFF; }
  function dosDate(d) { return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF; }
  function zipWriter(sink) {
    var enc = new TextEncoder(), entries = [], offset = 0, now = new Date();
    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }
    function write(u8) { offset += u8.length; return Promise.resolve(sink.write(u8)); }
    return {
      add: function (name, data) {
        var nm = enc.encode(name), crc = crc32(data);
        var hdr = new Uint8Array([].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(dosTime(now)), u16(dosDate(now)), u32(crc), u32(data.length), u32(data.length), u16(nm.length), u16(0)));
        entries.push({ nm: nm, crc: crc, size: data.length, off: offset });
        return write(hdr).then(function () { return write(nm); }).then(function () { return write(data); });
      },
      close: function () {
        var cdStart = offset, parts = [];
        entries.forEach(function (e) {
          parts.push(new Uint8Array([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(dosTime(now)), u16(dosDate(now)), u32(e.crc), u32(e.size), u32(e.size), u16(e.nm.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(e.off))));
          parts.push(e.nm);
        });
        var cdLen = parts.reduce(function (a, p) { return a + p.length; }, 0);
        parts.push(new Uint8Array([].concat(u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cdLen), u32(cdStart), u16(0))));
        var chain = Promise.resolve(); parts.forEach(function (p) { chain = chain.then(function () { return write(p); }); });
        return chain.then(function () { return { entries: entries.length, bytes: offset }; });
      },
      count: function () { return entries.length; },
      bytes: function () { return offset; },
    };
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

  root.PimClient = { Auth: Auth, api: api, toWebp: toWebp, canvasToWebp: canvasToWebp, processProductImage: processProductImage, whitenBackground: whitenBackground, analyzeImage: analyzeImage, QUALITY: QUALITY, zipWriter: zipWriter, crc32: crc32, finishImage: finishImage, phash: phash, appendImageExtras: appendImageExtras, Outbox: Outbox, isNetworkError: isNetworkError, ean13Svg: ean13Svg, canMakeWebp: canMakeWebp, uploadImage: uploadImage, beep: beep, fmtYen: fmtYen, esc: esc };
})(window);

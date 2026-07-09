/* =========================================================
   Salon Town Pro / Admin Ops — 運営モジュール（菊地フィードバック対応）
   サロン管理・商品マスタ(SMILE)・受注管理(入金照合/CSV)・契約販売設定・記事作成・通知設定
   設計方針：基幹システムSMILEが「正」／ECは拡張層（SMILEに書き戻さない）
   - 価格：サロン別販売価は SMILE 参照（CSVに単価を持たず参照フラグ）
   - 配送先：SMILE 登録届け先から選択（自由入力なし）
   - 商品マスタ：SMILE構成は不変。EC表示名・画像・正規化はEC拡張テーブルで別持ち
   - サロンコード：商品毎の設定を継続
   - 2重値引き防止：請求時値引ありサロンはECクーポンを構造的にロック
   すべてデモデータ。本番はSMILE連携API/CSVバッチに接続。
   ========================================================= */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  if (!$('opsSalons')) return;
  var yen = function (n) { return '¥' + Math.round(n || 0).toLocaleString('ja-JP'); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toast = function (m) { if (window.SP_toast) return SP_toast(m); var t = $('toast'); if (!t) return; t.textContent = m; t.classList.add('is-show'); setTimeout(function () { t.classList.remove('is-show'); }, 2400); };
  var tag = function (text, fg, bg) { return '<span style="display:inline-block;font-size:10.5px;font-weight:800;border-radius:6px;padding:2px 8px;color:' + fg + ';background:' + bg + ';white-space:nowrap">' + text + '</span>'; };
  var T = {
    ok: function (s) { return tag(s, '#1f8f53', '#e3f4ea'); },
    warn: function (s) { return tag(s, '#9a6b15', '#fdf4e7'); },
    grey: function (s) { return tag(s, '#6b6b74', '#ececf0'); },
    gold: function (s) { return tag(s, '#8a6a1f', '#f5edd8'); },
    lock: function (s) { return tag('🔒 ' + s, '#6b6b74', '#ececf0'); }
  };
  var store = {
    get: function (k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ===================== 1. サロン管理 ===================== */
  var SALONS = [
    { code: '10234', name: 'SALON LUXE 表参道店', cls: 'プラチナ', rate: 1.9, invDisc: true, accounts: [{ n: '高橋 誠', r: 'オーナー' }, { n: '井上 里奈', r: '発注担当' }, { n: '受付iPad 共用', r: '閲覧' }] },
    { code: '10412', name: 'hair atelier MELT 中目黒', cls: 'ゴールド', rate: 2.4, invDisc: false, accounts: [{ n: '森 大輔', r: 'オーナー' }] },
    { code: '10577', name: 'BARBER K 渋谷', cls: 'シルバー', rate: 2.8, invDisc: true, accounts: [{ n: '佐藤 健', r: 'オーナー' }, { n: '佐藤 隆', r: '発注担当' }] },
    { code: '10603', name: 'Atelier NOa 自由が丘', cls: 'ゴールド', rate: 2.2, invDisc: false, accounts: [{ n: '野田 千尋', r: 'オーナー' }, { n: 'スタッフ共用', r: '閲覧' }] },
    { code: '10711', name: 'Lien hair design 札幌大通', cls: 'レギュラー', rate: 3.2, invDisc: false, accounts: [{ n: '林 拓也', r: 'オーナー' }] }
  ];
  var couponOn = store.get('sp.admin.coupon.v1', { '10412': true, '10603': true, '10711': false });
  var openAcc = {};
  var ROLE_TAG = { 'オーナー': T.gold('オーナー・全権'), '発注担当': T.ok('発注担当'), '閲覧': T.grey('閲覧のみ') };

  function renderSalons() {
    var rows = SALONS.map(function (s) {
      var coupon = s.invDisc
        ? T.lock('自動停止（2重値引き防止）')
        : '<button data-cp="' + s.code + '" style="border:1px solid ' + (couponOn[s.code] ? '#1f9d57' : 'var(--line-strong)') + ';background:' + (couponOn[s.code] ? '#e3f4ea' : '#fff') + ';color:' + (couponOn[s.code] ? '#1f7a4d' : 'var(--ink-2)') + ';border-radius:999px;padding:4px 11px;font-size:10.5px;font-weight:800;cursor:pointer">' + (couponOn[s.code] ? '適用可' : '停止中') + '</button>';
      var main = '<tr>' +
        '<td class="num">' + s.code + '</td>' +
        '<td><b>' + esc(s.name) + '</b></td>' +
        '<td>' + T.gold(s.cls) + ' <span class="num" style="font-weight:800">' + s.rate.toFixed(1) + '%</span></td>' +
        '<td>' + (s.invDisc ? T.warn('請求時値引あり') : T.grey('なし')) + '</td>' +
        '<td>' + coupon + '</td>' +
        '<td><button data-acc="' + s.code + '" style="border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 11px;font-size:10.5px;font-weight:800;cursor:pointer">' + s.accounts.length + '名 ' + (openAcc[s.code] ? '▲' : '▼') + '</button></td>' +
        '<td style="font-size:11px;color:var(--ink-3)">今朝 6:00</td>' +
        '</tr>';
      var detail = openAcc[s.code]
        ? '<tr><td colspan="7" style="background:var(--surface-2)"><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:4px 2px">' +
          s.accounts.map(function (a) { return '<span style="display:inline-flex;gap:6px;align-items:center;border:1px solid var(--line);background:#fff;border-radius:999px;padding:5px 11px;font-size:11px;font-weight:700">' + esc(a.n) + ' ' + (ROLE_TAG[a.r] || '') + '</span>'; }).join('') +
          '<button data-addacc="' + s.code + '" style="border:1px dashed var(--line-strong);background:#fff;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:800;color:var(--gold-strong);cursor:pointer">＋ アカウント追加（デモ）</button>' +
          '</div></td></tr>'
        : '';
      return main + detail;
    }).join('');
    $('opsSalons').innerHTML =
      '<table class="adm-table"><thead><tr><th>サロンコード<br><small style="font-weight:600;color:var(--ink-3)">SMILE</small></th><th>サロン</th><th>クラス・実質料率</th><th>請求時値引<br><small style="font-weight:600;color:var(--ink-3)">SMILE請求</small></th><th>ECクーポン</th><th>アカウント</th><th>SMILE同期</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="font-size:11px;color:var(--ink-3);margin-top:10px;line-height:1.7">' +
      '・<b>2重値引き防止：</b>「請求時値引あり」のサロンはECクーポンを構造的にロック（担当者の解除操作でのみ例外可・監査記録）。クーポンを使う場合も受注CSVでは<b>独立列</b>で出力＝SMILE請求と衝突しません。<br>' +
      '・<b>1サロン複数アカウント：可能。</b>権限は3種＝オーナー（全権）／発注担当（発注・履歴）／閲覧（価格非表示も選択可）。請求と与信は<b>サロン単位</b>（アカウントが増えても掛け枠は1つ）。<br>' +
      '・サービス条件（クラス・値引・クーポン・添付条件・担当者）をこの1画面に集約＝サロン毎の条件管理の煩雑さに対応。</div>';
    [].forEach.call(document.querySelectorAll('#opsSalons [data-cp]'), function (b) {
      b.addEventListener('click', function () { var c = b.getAttribute('data-cp'); couponOn[c] = !couponOn[c]; store.set('sp.admin.coupon.v1', couponOn); renderSalons(); toast('ECクーポンを' + (couponOn[c] ? '適用可' : '停止') + 'にしました'); });
    });
    [].forEach.call(document.querySelectorAll('#opsSalons [data-acc]'), function (b) {
      b.addEventListener('click', function () { var c = b.getAttribute('data-acc'); openAcc[c] = !openAcc[c]; renderSalons(); });
    });
    [].forEach.call(document.querySelectorAll('#opsSalons [data-addacc]'), function (b) {
      b.addEventListener('click', function () {
        var c = b.getAttribute('data-addacc'), s = SALONS.filter(function (x) { return x.code === c; })[0];
        s.accounts.push({ n: '新規スタッフ ' + s.accounts.length, r: '発注担当' });
        renderSalons(); toast('発注担当アカウントを追加しました（デモ）');
      });
    });
  }

  /* ===================== 2. 商品マスタ（SMILE連携＋カラー剤名寄せ） ===================== */
  var MASTER = [
    { code: 'MB-070-GP7', jan: '…3457', smile: 'ｵﾙﾃﾞｨｰﾌﾞ ｱﾃﾞｨｸｼｰ GP-7 80G', spec: '80g×10', sc: '○', kake: 'A', norm: { b: 'ミルボン', s: 'オルディーブ アディクシー', t: 'グレーパール', l: 7 }, done: false },
    { code: 'WL-210-OC8', jan: '…8821', smile: 'ｲﾙﾐﾅｶﾗｰ ｵｰｼｬﾝ 8/ 80G', spec: '80g×6', sc: '○', kake: 'A', norm: { b: 'ウエラ', s: 'イルミナカラー', t: 'オーシャン', l: 8 }, done: false },
    { code: 'HY-118-N8', jan: '…4402', smile: 'ﾌﾟﾛﾏｽﾀｰ EX N-8 80G', spec: '80g×10', sc: '○', kake: 'B', norm: { b: 'ホーユー', s: 'プロマスター', t: 'ナチュラル', l: 8 }, done: false },
    { code: 'LB-330-SG8', jan: '…1177', smile: 'ﾏﾃﾘｱ G SG-8 80G', spec: '80g×10', sc: '○', kake: 'A', norm: { b: 'ルベル', s: 'マテリア G', t: 'シーグレー', l: 8 }, done: false },
    { code: 'BX-045-AS8', jan: '…9034', smile: 'ｽﾛｳ AS8 ｼｮｸﾓｳ 80G', spec: '80g×?', sc: '○', kake: '—', norm: null, done: false }
  ];
  var nayoseDone = false;

  function renderMaster() {
    var rows = MASTER.map(function (m) {
      var normCell = !nayoseDone
        ? '<span style="color:var(--ink-3);font-size:11px">— 未処理</span>'
        : (m.norm
          ? '<b>' + m.norm.b + '</b> ' + m.norm.s + '　' + T.ok(m.norm.t + ' ' + m.norm.l)
          : T.warn('要確認（命名ルール未登録）'));
      return '<tr>' +
        '<td class="num">' + m.code + '</td>' +
        '<td class="num" style="color:var(--ink-3)">' + m.jan + '</td>' +
        '<td style="font-family:var(--font-num);font-size:12px">' + esc(m.smile) + '</td>' +
        '<td class="num">' + m.spec + '</td>' +
        '<td style="text-align:center">' + m.sc + '</td>' +
        '<td style="text-align:center" class="num">' + m.kake + '</td>' +
        '<td>' + normCell + '</td>' +
        '<td>' + (nayoseDone && m.norm ? T.ok('公開') : T.grey('非公開')) + '</td>' +
        '</tr>';
    }).join('');
    $('opsMaster').innerHTML =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + T.grey('SMILE側＝構成変更不可（左5列）') + T.ok('EC拡張＝別テーブルで保持（右2列・SMILEに書き戻さない）') + T.gold('サロンコード設定は継続') + '</div>' +
      '<div style="overflow-x:auto"><table class="adm-table" style="min-width:760px"><thead><tr>' +
      '<th>商品コード</th><th>JAN</th><th>品名（SMILE原文）</th><th>規格・入数</th><th>サロンコード</th><th>掛率区分</th><th>EC正規化（名寄せ後）</th><th>EC公開</th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div style="font-size:11px;color:var(--ink-3);margin-top:10px;line-height:1.7">' +
      '・<b>カラー剤の名寄せ：</b>メーカー毎にバラバラな命名（半角カナ・記号・番手表記）を<b>メーカー別ルール辞書</b>で「ブランド／シリーズ／色味／レベル」に自動分解。ルール未登録のメーカーは<b>要確認キュー</b>へ（勝手に公開しない）。<br>' +
      '・SMILEの品名・構成はそのまま＝<b>編集はEC拡張列だけ</b>。サンプルと違うデータの持ち方でも、取込み時にこの正規化を通すため元データの編集は不要です。</div>';
  }
  var nayoseBtn = $('opsNayose');
  if (nayoseBtn) nayoseBtn.addEventListener('click', function () {
    nayoseDone = true; renderMaster();
    var okN = MASTER.filter(function (m) { return m.norm; }).length;
    toast(MASTER.length + '件中 ' + okN + '件を自動名寄せ・' + (MASTER.length - okN) + '件は要確認');
  });

  /* ===================== 3. 受注管理（入金照合・SMILE取込CSV） ===================== */
  var ORDERS = [
    { no: 'SP-2401', salon: 'SALON LUXE 表参道店', code: '10234', amount: 18920, pay: 'bank', st: 'wait_pay', when: '今日 10:12', items: [['MB-070-GP7', 6], ['LB-330-SG8', 4]] },
    { no: 'SP-2400', salon: 'Lien hair design 札幌大通', code: '10711', amount: 9350, pay: 'bank', st: 'wait_pay', when: '今日 9:41', items: [['HY-118-N8', 5]] },
    { no: 'SP-2399', salon: 'hair atelier MELT 中目黒', code: '10412', amount: 24310, pay: 'invoice', st: 'wait_credit', when: '昨日 17:05', items: [['WL-210-OC8', 8], ['MB-070-GP7', 3]] },
    { no: 'SP-2398', salon: 'BARBER K 渋谷', code: '10577', amount: 7150, pay: 'card', st: 'ok', when: '昨日 11:30', items: [['HY-118-N8', 4]] },
    { no: 'SP-2397', salon: 'Atelier NOa 自由が丘', code: '10603', amount: 31900, pay: 'invoice', st: 'shipped', when: '7/7 15:20', items: [['LB-330-SG8', 12], ['WL-210-OC8', 6]] }
  ];
  var ST = {
    wait_pay: { l: '入金待ち', t: T.warn('入金待ち') }, wait_credit: { l: '与信待ち', t: T.gold('与信承認待ち') },
    ok: { l: '承認済', t: T.ok('承認済・出荷手配') }, shipped: { l: '出荷済', t: T.grey('出荷済') }
  };
  var PAYL = { bank: '銀行振込', invoice: '掛け払い', card: 'カード', cod: '代引' };
  var juchuFilter = '';

  function renderJuchu() {
    var list = ORDERS.filter(function (o) { return !juchuFilter || o.st === juchuFilter; });
    var chips = [['', 'すべて'], ['wait_pay', '入金待ち'], ['wait_credit', '与信待ち'], ['ok', '承認済'], ['shipped', '出荷済']].map(function (c) {
      var n = c[0] ? ORDERS.filter(function (o) { return o.st === c[0]; }).length : ORDERS.length;
      var on = juchuFilter === c[0];
      return '<button data-jf="' + c[0] + '" style="height:32px;padding:0 12px;border-radius:999px;border:1px solid ' + (on ? 'var(--dark)' : 'var(--line-strong)') + ';background:' + (on ? 'var(--dark)' : '#fff') + ';color:' + (on ? '#fff' : 'var(--ink-2)') + ';font-size:11.5px;font-weight:800;cursor:pointer">' + c[1] + ' ' + n + '</button>';
    }).join('');
    var rows = list.map(function (o) {
      return '<tr><td class="num"><b>' + o.no + '</b></td><td>' + esc(o.salon) + ' <span class="num" style="color:var(--ink-3);font-size:11px">' + o.code + '</span></td><td class="num">' + yen(o.amount) + '</td><td style="font-size:11.5px">' + PAYL[o.pay] + '</td><td>' + ST[o.st].t + '</td><td style="font-size:11px;color:var(--ink-3)">' + o.when + '</td></tr>';
    }).join('');
    $('opsJuchu').innerHTML =
      '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">' + chips + '</div>' +
      '<table class="adm-table"><thead><tr><th>注文番号</th><th>サロン（コード）</th><th>金額</th><th>支払</th><th>ステータス</th><th>受注</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">' +
      '<div style="font-size:12.5px;font-weight:800;margin-bottom:6px">銀行入金の照合（デモ：ネットバンキング明細の貼り付け想定）</div>' +
      '<textarea id="opsBankLines" rows="3" style="width:100%;border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;font-size:12.5px;font-family:var(--font-num),monospace;resize:vertical">07/09 ﾌﾘｺﾐ ｶ)ｻﾛﾝﾗｸｽ SP2401 18,920\n07/09 ﾌﾘｺﾐ ﾊﾔｼ ﾀｸﾔ 9,350</textarea>' +
      '<button class="btn btn--primary" id="opsBankMatch" style="margin-top:8px;height:38px;padding:0 16px">照合する</button>' +
      '<div id="opsBankResult" style="margin-top:10px"></div>' +
      '<div style="font-size:11px;color:var(--ink-3);margin-top:10px;line-height:1.7">' +
      '・<b>運用ルール（銀行振込）：</b>①振込名義の後ろに<b>注文番号</b>を入れる案内をカート・注文完了画面に明記　②入金確認までは<b>「入金待ち」ステータス</b>で出荷保留　③振込手数料は<b>お客様負担</b>を明記。<br>' +
      '・番号なし入金も<b>金額一致で候補提示</b>→担当者がワンクリック照合（取り違え防止のため自動確定はしない）。</div></div>';
    [].forEach.call(document.querySelectorAll('#opsJuchu [data-jf]'), function (b) {
      b.addEventListener('click', function () { juchuFilter = b.getAttribute('data-jf'); renderJuchu(); });
    });
    var nav = $('navJuchu'); if (nav) { var c = ORDERS.filter(function (o) { return o.st === 'wait_pay' || o.st === 'wait_credit'; }).length; nav.textContent = c; nav.style.display = c ? '' : 'none'; }
    var mb = $('opsBankMatch');
    if (mb) mb.addEventListener('click', function () {
      var lines = ($('opsBankLines').value || '').split('\n').filter(function (l) { return l.trim(); });
      var out = [];
      lines.forEach(function (line) {
        var m = line.match(/SP-?(\d{3,})/i);
        if (m) {
          var no = 'SP-' + m[1];
          var o = ORDERS.filter(function (x) { return x.no === no; })[0];
          if (o && o.st === 'wait_pay') { o.st = 'ok'; out.push('<div style="font-size:12px;font-weight:700;color:#1f8f53;padding:6px 0">✔ ' + no + ' ' + yen(o.amount) + ' を自動照合（名義に注文番号）→ 承認・出荷手配へ</div>'); }
          else if (o) { out.push('<div style="font-size:12px;color:var(--ink-3);padding:6px 0">・' + no + ' は既に ' + ST[o.st].l + '</div>'); }
          else { out.push('<div style="font-size:12px;color:#b3261e;padding:6px 0">✕ ' + no + ' に該当する注文がありません</div>'); }
        } else {
          var amt = (line.match(/([\d,]{3,})\s*$/) || [])[1];
          var v = amt ? +amt.replace(/,/g, '') : 0;
          var cand = ORDERS.filter(function (x) { return x.st === 'wait_pay' && x.amount === v; })[0];
          out.push(cand
            ? '<div style="font-size:12px;padding:6px 0">⚠ 注文番号なし（' + esc(line.replace(/[\d,]+\s*$/, '').trim()) + '）→ 金額一致の候補 <b>' + cand.no + '</b>（' + esc(cand.salon) + '）<button data-manual="' + cand.no + '" style="margin-left:8px;border:1px solid #1f9d57;background:#e3f4ea;color:#1f7a4d;border-radius:999px;padding:3px 11px;font-size:10.5px;font-weight:800;cursor:pointer">この注文と照合する</button></div>'
            : '<div style="font-size:12px;color:#b3261e;padding:6px 0">✕ 照合できない明細：' + esc(line) + '</div>');
        }
      });
      $('opsBankResult').innerHTML = out.join('');
      [].forEach.call(document.querySelectorAll('#opsBankResult [data-manual]'), function (b2) {
        b2.addEventListener('click', function () {
          var o = ORDERS.filter(function (x) { return x.no === b2.getAttribute('data-manual'); })[0];
          if (o) { o.st = 'ok'; toast(o.no + ' を手動照合しました → 承認・出荷手配'); renderJuchu(); }
        });
      });
      renderJuchuTableOnly();
      toast('照合が完了しました');
    });
  }
  function renderJuchuTableOnly() { /* 照合結果を残したまま表・バッジだけ更新 */
    var res = $('opsBankResult') ? $('opsBankResult').innerHTML : '';
    var lines = $('opsBankLines') ? $('opsBankLines').value : null;
    renderJuchu();
    if (res && $('opsBankResult')) $('opsBankResult').innerHTML = res;
    if (lines != null && $('opsBankLines')) $('opsBankLines').value = lines;
    [].forEach.call(document.querySelectorAll('#opsBankResult [data-manual]'), function (b2) {
      b2.addEventListener('click', function () {
        var o = ORDERS.filter(function (x) { return x.no === b2.getAttribute('data-manual'); })[0];
        if (o) { o.st = 'ok'; toast(o.no + ' を手動照合しました → 承認・出荷手配'); renderJuchuTableOnly(); }
      });
    });
  }
  var csvBtn = $('opsJuchuCsv');
  if (csvBtn) csvBtn.addEventListener('click', function () {
    var head = ['受注日', '注文番号', 'サロンコード', '支払方法', '入金ステータス', '商品コード', '数量', '単価', 'ECクーポン値引(別枠)', '備考'];
    var rows = [];
    ORDERS.forEach(function (o) {
      o.items.forEach(function (it, i) {
        rows.push(['2026/07/09', o.no, o.code, PAYL[o.pay], ST[o.st].l, it[0], it[1], 'SMILE参照', i === 0 && couponOn[o.code] ? '500' : '0', i === 0 ? '' : '同注文明細']);
      });
    });
    var csv = '﻿' + [head].concat(rows).map(function (r) { return r.join(','); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'salontownpro_juchu_smile.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast('SMILE取込用CSVを出力しました（単価はSMILE参照・クーポンは別枠列）');
  });

  /* ===================== 4. 契約商品の販売設定 ===================== */
  var CT_BRANDS = ['コタ', 'トキオ', 'ハホニコ', 'ムコタ'];
  var ctSales = store.get('sp.admin.ctsales.v1', { 'コタ': { '10234': true, '10603': true }, 'トキオ': { '10234': true, '10412': true }, 'ハホニコ': { '10577': true }, 'ムコタ': {} });
  function renderContract() {
    $('opsContract').innerHTML = CT_BRANDS.map(function (b) {
      var on = ctSales[b] || {};
      var n = SALONS.filter(function (s) { return on[s.code]; }).length;
      return '<div style="border:1px solid var(--line);border-radius:10px;padding:12px;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="font-size:13px">' + b + '</b><span style="font-size:11px;color:var(--ink-3)">販売中 ' + n + ' / ' + SALONS.length + ' サロン</span></div>' +
        '<div style="display:flex;gap:6px;flex-wrap:wrap">' + SALONS.map(function (s) {
          var o = !!on[s.code];
          return '<button data-ct="' + b + '|' + s.code + '" style="height:30px;padding:0 11px;border-radius:999px;border:1px solid ' + (o ? '#1f9d57' : 'var(--line-strong)') + ';background:' + (o ? '#e3f4ea' : '#fff') + ';color:' + (o ? '#1f7a4d' : 'var(--ink-3)') + ';font-size:10.5px;font-weight:800;cursor:pointer">' + esc(s.name.split(' ')[0]) + (o ? ' ✓' : '') + '</button>';
        }).join('') + '</div></div>';
    }).join('') +
      '<div style="font-size:11px;color:var(--ink-3);margin-top:4px;line-height:1.7">・契約申込審査の<b>承認と連動</b>（承認＝ON）。OFFにすると該当サロンのカタログから即非表示・購入不可。<br>・契約商品の価格もSMILEのサロン別販売価を参照（サイト側で価格は作らない）。</div>';
    [].forEach.call(document.querySelectorAll('#opsContract [data-ct]'), function (btn) {
      btn.addEventListener('click', function () {
        var p = btn.getAttribute('data-ct').split('|');
        ctSales[p[0]] = ctSales[p[0]] || {};
        ctSales[p[0]][p[1]] = !ctSales[p[0]][p[1]];
        store.set('sp.admin.ctsales.v1', ctSales);
        renderContract();
        toast(p[0] + ' の販売設定を更新しました');
      });
    });
  }

  /* ===================== 5. 記事作成 ===================== */
  var articles = store.get('sp.admin.articles.v1', [
    { kind: 'キャンペーン', title: '夏のスタイリング剤 まとめ買い 10%OFF', to: '全サロン', at: '7/1' },
    { kind: 'お知らせ', title: 'お盆期間の出荷スケジュールについて', to: '全サロン', at: '7/5' }
  ]);
  var KIND_TAG = { 'お知らせ': T.grey('お知らせ'), 'キャンペーン': T.gold('キャンペーン'), 'コラム': T.ok('コラム') };
  function renderArticles() {
    $('opsArticles').innerHTML =
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">' +
      '<label style="font-size:11.5px;font-weight:800;color:var(--ink-2)">種別<select id="artKind" style="width:100%;margin-top:4px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font-size:13px;background:#fff"><option>お知らせ</option><option>キャンペーン</option><option>コラム</option></select></label>' +
      '<label style="font-size:11.5px;font-weight:800;color:var(--ink-2)">配信先<select id="artTo" style="width:100%;margin-top:4px;border:1px solid var(--line-strong);border-radius:8px;padding:9px;font-size:13px;background:#fff"><option>全サロン</option><option>ヘア業種のみ</option><option>プラチナ・ゴールドのみ</option><option>特定サロン指定</option></select></label>' +
      '<label style="grid-column:1/-1;font-size:11.5px;font-weight:800;color:var(--ink-2)">タイトル<input id="artTitle" placeholder="例：9月セミナー 早割のご案内" style="width:100%;margin-top:4px;border:1px solid var(--line-strong);border-radius:8px;padding:9px 12px;font-size:13px"></label>' +
      '<label style="grid-column:1/-1;font-size:11.5px;font-weight:800;color:var(--ink-2)">本文<textarea id="artBody" rows="3" placeholder="本文（画像・商品リンク挿入は本番エディタで対応）" style="width:100%;margin-top:4px;border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;font-size:13px;resize:vertical"></textarea></label>' +
      '</div><button class="btn btn--primary" id="artPub" style="margin-top:8px;height:38px;padding:0 16px">公開する（デモ）</button>' +
      '<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:10px"><div style="font-size:12.5px;font-weight:800;margin-bottom:8px">公開中の記事</div>' +
      articles.map(function (a, i) {
        return '<div style="display:flex;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2)">' + (KIND_TAG[a.kind] || '') + '<b style="flex:1;font-size:12.5px">' + esc(a.title) + '</b><span style="font-size:11px;color:var(--ink-3)">' + esc(a.to) + ' ・ ' + esc(a.at) + '</span><button data-artdel="' + i + '" style="border:0;background:none;color:#b3261e;font-size:11px;font-weight:800;cursor:pointer">削除</button></div>';
      }).join('') + '</div>' +
      '<div style="font-size:11px;color:var(--ink-3);margin-top:8px;line-height:1.6">公開すると お知らせ／キャンペーンページに掲載され、通知設定に応じてPush/LINE/メールで配信されます（本番接続）。</div>';
    var pb = $('artPub');
    if (pb) pb.addEventListener('click', function () {
      var t = ($('artTitle').value || '').trim();
      if (!t) { toast('タイトルを入力してください'); return; }
      articles.unshift({ kind: $('artKind').value, title: t, to: $('artTo').value, at: '今日' });
      store.set('sp.admin.articles.v1', articles);
      renderArticles(); toast('記事を公開しました（デモ）');
    });
    [].forEach.call(document.querySelectorAll('#opsArticles [data-artdel]'), function (b) {
      b.addEventListener('click', function () { articles.splice(+b.getAttribute('data-artdel'), 1); store.set('sp.admin.articles.v1', articles); renderArticles(); });
    });
  }

  /* ===================== 6. 通知設定・テンプレート ===================== */
  var NT_EVENTS = [
    { id: 'pay_ok', l: '入金を確認しました（銀行振込）', tpl: '{{salon}}様\nご入金を確認しました。ご注文 {{order_no}}（{{amount}}）は本日出荷手配に入ります。' },
    { id: 'shipped', l: '出荷しました（送り状番号）', tpl: '{{salon}}様\nご注文 {{order_no}} を出荷しました。お届け予定：{{eta}}。' },
    { id: 'restock', l: '入荷お知らせ（再入荷）', tpl: '{{salon}}様\nお待ちの「{{product}}」が入荷しました。在庫があるうちにどうぞ。' },
    { id: 'class', l: 'クラス変動（実質料率）', tpl: '{{salon}}様\n今月のクラスは {{class}}（実質 {{rate}}%）です。あと{{next}}で次のクラスに上がります。' },
    { id: 'camp', l: 'キャンペーン開始', tpl: '{{salon}}様\n「{{title}}」が始まりました。詳しくはアプリのキャンペーンページへ。' }
  ];
  var SAMPLE = { salon: 'SALON LUXE 表参道', order_no: 'SP-2401', amount: '¥18,920', eta: '7/10（金）', product: 'ザ・ラメラメ No.1', 'class': 'ゴールド', rate: '2.4', next: '¥26,000の仕入', title: '夏のまとめ買い10%OFF' };
  var ntCh = store.get('sp.admin.notify.v1', { pay_ok: { push: true, line: true, mail: true }, shipped: { push: true, line: true, mail: false }, restock: { push: true, line: false, mail: false }, 'class': { push: true, line: false, mail: false }, camp: { push: true, line: true, mail: false } });
  var ntTpl = store.get('sp.admin.ntpl.v1', {});
  var ntSel = 'pay_ok';
  function renderNotify() {
    var rows = NT_EVENTS.map(function (e) {
      var ch = ntCh[e.id] || {};
      var cb = function (k, lbl) {
        var on = !!ch[k];
        return '<button data-nt="' + e.id + '|' + k + '" style="height:28px;padding:0 10px;border-radius:999px;border:1px solid ' + (on ? '#1f9d57' : 'var(--line-strong)') + ';background:' + (on ? '#e3f4ea' : '#fff') + ';color:' + (on ? '#1f7a4d' : 'var(--ink-3)') + ';font-size:10.5px;font-weight:800;cursor:pointer">' + lbl + (on ? ' ✓' : '') + '</button>';
      };
      return '<tr><td style="font-size:12px;font-weight:700">' + e.l + '</td><td><div style="display:flex;gap:5px;flex-wrap:wrap">' + cb('push', 'Push') + cb('line', 'LINE') + cb('mail', 'メール') + '</div></td><td><button data-nted="' + e.id + '" style="border:1px solid var(--line-strong);background:#fff;border-radius:999px;padding:4px 11px;font-size:10.5px;font-weight:800;cursor:pointer">テンプレ編集</button></td></tr>';
    }).join('');
    var ev = NT_EVENTS.filter(function (e) { return e.id === ntSel; })[0];
    var tplVal = ntTpl[ntSel] != null ? ntTpl[ntSel] : ev.tpl;
    var preview = tplVal.replace(/\{\{(\w+)\}\}/g, function (_, k) { return SAMPLE[k] || '{{' + k + '}}'; });
    $('opsNotify').innerHTML =
      '<table class="adm-table"><thead><tr><th>イベント</th><th>チャネル</th><th>テンプレート</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">' +
      '<div style="font-size:12.5px;font-weight:800;margin-bottom:6px">テンプレート編集：' + ev.l + '</div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:6px">' + ['salon', 'order_no', 'amount', 'product', 'class', 'rate'].map(function (v) { return '<button data-ntvar="' + v + '" style="height:26px;padding:0 9px;border-radius:6px;border:1px dashed var(--line-strong);background:var(--surface-2);font-size:10.5px;font-weight:800;color:var(--ink-2);cursor:pointer">{{' + v + '}}</button>'; }).join('') + '</div>' +
      '<textarea id="ntTplBox" rows="3" style="width:100%;border:1px solid var(--line-strong);border-radius:8px;padding:10px 12px;font-size:12.5px;resize:vertical">' + esc(tplVal) + '</textarea>' +
      '<div style="display:flex;gap:8px;margin-top:8px;align-items:center"><button class="btn btn--primary" id="ntSave" style="height:36px;padding:0 16px">保存（デモ）</button><span style="font-size:11px;color:var(--ink-3)">プレビュー（実データ差し込み）：</span></div>' +
      '<div style="background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:11px 13px;font-size:12px;line-height:1.7;margin-top:8px;white-space:pre-wrap">' + esc(preview) + '</div></div>';
    [].forEach.call(document.querySelectorAll('#opsNotify [data-nt]'), function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-nt').split('|');
        ntCh[p[0]] = ntCh[p[0]] || {}; ntCh[p[0]][p[1]] = !ntCh[p[0]][p[1]];
        store.set('sp.admin.notify.v1', ntCh); renderNotify();
      });
    });
    [].forEach.call(document.querySelectorAll('#opsNotify [data-nted]'), function (b) {
      b.addEventListener('click', function () { ntSel = b.getAttribute('data-nted'); renderNotify(); });
    });
    [].forEach.call(document.querySelectorAll('#opsNotify [data-ntvar]'), function (b) {
      b.addEventListener('click', function () { var box = $('ntTplBox'); box.value += '{{' + b.getAttribute('data-ntvar') + '}}'; box.focus(); });
    });
    var sv = $('ntSave');
    if (sv) sv.addEventListener('click', function () { ntTpl[ntSel] = $('ntTplBox').value; store.set('sp.admin.ntpl.v1', ntTpl); renderNotify(); toast('テンプレートを保存しました（デモ）'); });
  }

  renderSalons(); renderMaster(); renderJuchu(); renderContract(); renderArticles(); renderNotify();
})();

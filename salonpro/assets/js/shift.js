/* =========================================================
   SP.SHIFT — シフト＆労務の単一の真実（管理者PC manage / 個人 me / 経営 owner が共有）
   グリッド編集・労務設定（有給/みなし残業/残業の表示切替）を localStorage で連携。
   ※デモ。本番は予約・POS・勤怠の実データ＋給与計算に接続。
   ========================================================= */
(function () {
  window.SP = window.SP || {};
  var LS_GRID = 'sp.shift.grid.v1', LS_SET = 'sp.shift.set.v1';
  function read(k, f) { try { var v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch (e) { return f; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // スタッフ名簿（売上・目標・基本給・みなし残業手当・有給消化日数）。一人一P&L/manage/me で共通。
  // buai＝歩合率（指名売上連動）。総支給の歩合部分 = max(基本給, 指名売上(税抜)×歩合率) − 基本給
  var ROSTER = [
    { n: '田中 美咲', role: 'ディレクター', base: 320000, minashi: 35000, yukyu: 2, sales: 920000, target: 900000, shimei: 67, kyaku: 13800, tenpan: 22, buai: 0.5 },
    { n: '佐藤 健', role: 'トップスタイリスト', base: 250000, minashi: 30000, yukyu: 1, sales: 820000, target: 800000, shimei: 58, kyaku: 12900, tenpan: 21, buai: 0.5 },
    { n: '高橋 駿', role: 'スタイリスト', base: 215000, minashi: 20000, yukyu: 0, sales: 690000, target: 680000, shimei: 47, kyaku: 11500, tenpan: 19, buai: 0.4 },
    { n: '鈴木 彩', role: 'スタイリスト', base: 205000, minashi: 20000, yukyu: 1, sales: 680000, target: 620000, shimei: 77, kyaku: 16900, tenpan: 24, buai: 0.4 },
    { n: '渡辺 結衣', role: 'スタイリスト', base: 200000, minashi: 20000, yukyu: 2, sales: 590000, target: 600000, shimei: 71, kyaku: 12800, tenpan: 23, buai: 0.4 },
    { n: '伊藤 蓮', role: 'ジュニア', base: 150000, minashi: 10000, yukyu: 0, sales: 360000, target: 400000, shimei: 41, kyaku: 9700, tenpan: 18, buai: 0.3 }
  ];
  var DAYS = [['月', '6/30'], ['火', '7/1'], ['水', '7/2'], ['木', '7/3'], ['金', '7/4'], ['土', '7/5'], ['日', '7/6']];
  // 各シフトの [ラベル, 時間, 実働時間, 絵文字]
  var SHIFTS = { a: ['早番', '9:00–18:00', 8, '🌅'], m: ['中番', '10:00–19:00', 8, '☀️'], p: ['遅番', '11:00–20:00', 8, '🌆'] };
  var WEEKS = 4.3, STD_MONTH = 160, OT_RATE = 1.25;

  function seededGrid() {
    return ROSTER.map(function (s, i) {
      var rnd = mulberry32(700 + i * 17);
      return DAYS.map(function () { return rnd() < 0.26 ? 'off' : ['a', 'm', 'p'][Math.floor(rnd() * 3)]; });
    });
  }
  var grid = read(LS_GRID, null) || seededGrid();
  // 労務設定（サロンごとに異なる項目を表示/非表示。みなし・残業は人件費にも連動）
  var settings = read(LS_SET, null) || { yukyu: true, minashi: false, zangyo: true, buai: true };
  if (settings.buai == null) settings.buai = true; // 既存保存分への後方互換

  function workdays(i) { return grid[i].filter(function (c) { return c !== 'off'; }).length; }
  function monthlyHours(i) { return Math.round(workdays(i) * 8 * WEEKS); }
  function overtimeHours(i) { return Math.min(45, Math.max(0, monthlyHours(i) - STD_MONTH)); } // 36協定の月45h上限
  function overtimeYen(i) { var hourly = ROSTER[i].base / STD_MONTH; return Math.round(overtimeHours(i) * hourly * OT_RATE); }
  /* ---- 歩合（指名売上連動・確定ルール） ----
     総支給(基本給+歩合) = max(基本給, 指名売上(税抜) × 歩合率)。
     例）基本給25万・50%：指名売上70万→総支給35万(25万+10万)／80万→40万(25万+15万)
         50万までは25万のまま（保障）／51万→25.5万(25万+5,000円)。40%・30%も同式。 */
  function shimeiSales(i) { var s = ROSTER[i]; return Math.round(s.sales * s.shimei / 100); }
  function buaiFor(i) {
    var s = ROSTER[i], rate = s.buai || 0, sh = shimeiSales(i);
    var pay = Math.max(s.base, Math.round(sh * rate));
    return { rate: rate, shimeiSales: sh, line: rate > 0 ? Math.round(s.base / rate) : 0, pay: pay, extra: pay - s.base };
  }
  function breakdownFor(i) {
    var s = ROSTER[i];
    var minashi = settings.minashi ? s.minashi : 0;
    var zangyo = settings.zangyo ? overtimeYen(i) : 0;
    var buai = settings.buai ? buaiFor(i).extra : 0;
    return { base: s.base, buai: buai, minashi: minashi, zangyo: zangyo, total: s.base + buai + minashi + zangyo, yukyu: settings.yukyu ? s.yukyu : 0, otHours: overtimeHours(i) };
  }
  function laborFor(i) { return breakdownFor(i).total; }
  function laborTotal() { var t = 0; for (var i = 0; i < ROSTER.length; i++) t += laborFor(i); return t; }

  window.SP.SHIFT = {
    roster: ROSTER, days: DAYS, shifts: SHIFTS,
    grid: function () { return grid; },
    setCell: function (r, c, code) { grid[r][c] = code; save(LS_GRID, grid); },
    resetGrid: function () { grid = seededGrid(); save(LS_GRID, grid); },
    settings: function () { return settings; },
    setSetting: function (k, v) { settings[k] = v; save(LS_SET, settings); },
    workdays: workdays, monthlyHours: monthlyHours, overtimeHours: overtimeHours, overtimeYen: overtimeYen,
    shimeiSales: shimeiSales, buaiFor: buaiFor,
    breakdownFor: breakdownFor, laborFor: laborFor, laborTotal: laborTotal
  };
})();

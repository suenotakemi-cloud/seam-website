/* =========================================================
   Salon Town Pro / 実質料率モデル（単一ソース）
   「カード決済 × 仕入の連動」で実質料率を決める計算を一元化。
   - rate.html（サロン向けゲージ）と rate-calc.html（菊地・交渉用試算）が共用。
   - ここのしきい値・原価・卸粗利を変えると両画面が揃って変わる。
   すべてデモ／想定値。本番は決済代行の確定料率・菊地の実原価で置き換える。
   ========================================================= */
window.SP = window.SP || {};
SP.RATE = (function () {
  var COST = 2.6;                       // 決済原価ブレンド%（IC++想定。Visa/MC/JCB/Amex混在の実勢）
  var OFFER = { best: 1.9, mid: 2.4, std: 3.2 }; // サロン提示の実質料率
  var GATE = { best: 8, mid: 5 };       // 仕入率%（仕入 ÷ カード決済）のしきい値
  var WSM = 18;                         // 菊地の卸粗利%（補填の原資）

  function rateFor(ratioPct) {          // 仕入率→適用料率（ゲート判定）
    return ratioPct >= GATE.best ? OFFER.best : ratioPct >= GATE.mid ? OFFER.mid : OFFER.std;
  }
  function tierKey(ratioPct) {
    return ratioPct >= GATE.best ? 'best' : ratioPct >= GATE.mid ? 'mid' : 'std';
  }

  /* ---- クラス制ステータス（楽天SPU型・重ねがけ） ----
     ベース3.2%から「仕入連動（排他）＋切替条件（加算）」で引き下げ、下限1.9%。
     仕入8%以上は単独で−1.3%＝1.9%（従来ゲートの約束を維持）。
     切替条件の幅は取次収益が原資として持つ範囲（rate-calcで検算可能）。 */
  var BASE = OFFER.std, FLOOR = OFFER.best;
  var TIER_OFF = { best: 1.3, mid: 0.8, std: 0 };      // 仕入率ゲートの引き下げ幅
  var INFRA = [                                         // 切替・利用系の条件（income＝菊地側の月次原資・デモ想定値）
    { id: 'power',     icon: '⚡', short: '電気', label: '菊地でんき（電気の切替）',     sub: '店舗の電気をまとめて切替・手続きは菊地が代行', off: 0.2, income: 1200, href: 'contact.html',   cta: '見積もりを相談' },
    { id: 'mobile',    icon: '📱', short: 'スマホ回線', label: 'スマホ・店舗回線の切替',       sub: 'スタッフ回線／店舗Wi-Fiをまとめて取次',       off: 0.2, income: 2400, href: 'contact.html',   cta: 'プランを相談' },
    { id: 'subscribe', icon: '🔁', short: '定期便', label: '定期便・自動補充を利用',       sub: '毎月の定番を自動でお届け（いつでも解約可）',   off: 0.1, income: 2700, href: 'subscribe.html', cta: '定期便を見る' },
    { id: 'tenpan',    icon: '🛍', short: '店販EC', label: '店販EC（スタッフEC）を稼働',   sub: 'お客様向け店販ECを利用中にする',               off: 0.1, income: 2000, href: 'tenpan.html',    cta: '店販ECを見る' }
  ];
  var CLASSES = [                                       // 適用料率→クラス（上から判定）
    { key: 'platinum', label: 'プラチナ',  max: FLOOR },
    { key: 'gold',     label: 'ゴールド',  max: 2.4 },
    { key: 'silver',   label: 'シルバー',  max: 3.0 },
    { key: 'regular',  label: 'レギュラー', max: 99 }
  ];
  var LS_STATUS = 'sp.rate.status.v1';
  function loadStatus() { try { return JSON.parse(localStorage.getItem(LS_STATUS)) || {}; } catch (e) { return {}; } }
  function saveStatus(st) { try { localStorage.setItem(LS_STATUS, JSON.stringify(st || {})); } catch (e) {} }
  function tierOff(ratioPct) { return TIER_OFF[tierKey(ratioPct)]; }
  function infraOff(status) { status = status || {}; return INFRA.reduce(function (a, c) { return a + (status[c.id] ? c.off : 0); }, 0); }
  function stackRate(ratioPct, status) {                // 重ねがけ後の実質料率（下限FLOOR）
    return Math.max(FLOOR, Math.round((BASE - tierOff(ratioPct) - infraOff(status)) * 100) / 100);
  }
  function classOf(rate) {
    for (var i = 0; i < CLASSES.length; i++) { if (rate <= CLASSES[i].max + 1e-9) return CLASSES[i]; }
    return CLASSES[CLASSES.length - 1];
  }
  function saasFor(staff) {             // 人数別 月額システム利用料
    staff = staff || 1;
    return staff <= 1 ? 10000 : staff <= 3 ? 20000 : staff <= 6 ? 35000 : 50000;
  }
  function ratioPct(card, wholesale) { return card > 0 ? wholesale / card * 100 : 0; }
  function needFor(card, gatePct) { return card * gatePct / 100; } // ある料率に必要な仕入額

  // 決済の損益（+なら菊地が決済で稼ぐ / −なら補填）
  function paymentPL(card, rate, cost) { cost = cost == null ? COST : cost; return (rate - cost) / 100 * card; }
  // 損益分岐の仕入率（卸粗利で補填がトントンになる仕入率%）
  function breakEvenRatio(rate, cost, wsm) {
    cost = cost == null ? COST : cost; wsm = wsm == null ? WSM : wsm;
    return Math.max(0, (cost - rate) / wsm * 100);
  }
  // 「一定数」＝SaaSだけで補填を賄えるカード決済額の上限
  function freeThreshold(saas, cost, offered) {
    cost = cost == null ? COST : cost; var gap = (cost - offered) / 100;
    return gap > 0 ? saas / gap : Infinity;
  }
  // 菊地の月間ネット貢献
  function net(o) {
    var cost = o.cost == null ? COST : o.cost, wsm = o.wsm == null ? WSM : o.wsm;
    var r = ratioPct(o.card, o.wholesale), rate = rateFor(r);
    var pay = paymentPL(o.card, rate, cost), saas = saasFor(o.staff), ws = o.wholesale * wsm / 100, ec = o.ec || 0;
    return { ratio: r, rate: rate, pay: pay, saas: saas, ws: ws, ec: ec, net: pay + saas + ws + ec };
  }
  return {
    COST: COST, OFFER: OFFER, GATE: GATE, WSM: WSM,
    BASE: BASE, FLOOR: FLOOR, TIER_OFF: TIER_OFF, INFRA: INFRA, CLASSES: CLASSES,
    rateFor: rateFor, tierKey: tierKey, saasFor: saasFor, ratioPct: ratioPct, needFor: needFor,
    paymentPL: paymentPL, breakEvenRatio: breakEvenRatio, freeThreshold: freeThreshold, net: net,
    loadStatus: loadStatus, saveStatus: saveStatus, tierOff: tierOff, infraOff: infraOff, stackRate: stackRate, classOf: classOf
  };
})();

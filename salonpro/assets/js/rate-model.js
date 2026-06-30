/* =========================================================
   SalonPro / 実質料率モデル（単一ソース）
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
    rateFor: rateFor, tierKey: tierKey, saasFor: saasFor, ratioPct: ratioPct, needFor: needFor,
    paymentPL: paymentPL, breakEvenRatio: breakEvenRatio, freeThreshold: freeThreshold, net: net
  };
})();

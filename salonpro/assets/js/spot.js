/* =========================================================
   salon town recruit / 即日採用の手配 単一ソース（SP.SPOT）
   サロン側(spot.html)の「手配」→ localStorage → ワーカー側(spot-worker.html)の
   「届いた手配リクエスト」に反映。別タブでも storage イベントで即時同期。
   ※ すべてデモ。実サービスはサーバー経由の手配・通知に置き換える。
   ========================================================= */
window.SP = window.SP || {};
SP.SPOT = (function () {
  var LS = 'sp.spot.dispatch.v1';
  function read() { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } }
  function write(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) { } }
  // サロン→ワーカーへ手配を送る
  function dispatch(o) {
    var a = read();
    o.id = 'd' + Date.now() + Math.floor(Math.random() * 1000);
    o.ts = Date.now();
    o.status = 'pending';
    a.unshift(o);
    write(a);
    return o;
  }
  function list() { return read(); }
  function pending() { return read().filter(function (x) { return x.status === 'pending'; }); }
  function setStatus(id, st) { var a = read(); a.forEach(function (x) { if (x.id === id) x.status = st; }); write(a); }
  function clear() { write([]); }
  // 別タブの変更を購読（storageイベント）
  function onChange(cb) {
    window.addEventListener('storage', function (e) { if (e.key === LS) cb(); });
  }
  return { LS: LS, dispatch: dispatch, list: list, pending: pending, setStatus: setStatus, clear: clear, onChange: onChange };
})();

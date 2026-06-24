/* =========================================================
   SalonPro / Salon store — サロンの在庫＆店販売上（POS連動）
   仕入れ→在庫→店販(POS)→在庫減→補充発注 のループを支える。
   localStorage 永続。subscribe で在庫/売上UIを更新。
   ========================================================= */
(function () {
  const LS_INV = 'sp.inv.v1';
  const LS_SALES = 'sp.sales.v1';
  const LOW = 3;          // これ以下で「残りわずか」
  const load = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const product = id => (window.SP.DATA.products || []).find(p => p.id === id);

  // 初期在庫（未設定時のみシード：店販でよく扱う商品）
  const SEED = {
    'sh-001': 8, 'sh-003': 3, 'sh-005': 12, 'sh-010': 0, 'sh-002': 9, 'sh-017': 2,
    'co-3': 2, 'co-7': 5, 'co-22': 1, 'co-23': 4,
    'tr-001': 6, 'tr-002': 2, 'rec-2': 4, 'rec-3': 7, 'rec-4': 1,
  };
  let inv = load(LS_INV, null);
  if (!inv) { inv = { ...SEED }; save(LS_INV, inv); }
  let sales = load(LS_SALES, []);

  const listeners = new Set();
  function emit() { save(LS_INV, inv); save(LS_SALES, sales); listeners.forEach(fn => fn()); }
  function sameDay(ts) { const d = new Date(ts), n = new Date(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate(); }

  const Salon = {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    LOW,

    /* ---- 在庫 ---- */
    stock(id) { return inv[id] != null ? inv[id] : 0; },
    setStock(id, n) { inv[id] = Math.max(0, n | 0); emit(); },
    addStock(id, d) { inv[id] = Math.max(0, (inv[id] || 0) + d); emit(); },
    items() { return Object.keys(inv).map(id => ({ id, qty: inv[id], p: product(id) })).filter(x => x.p); },
    lowItems() { return Salon.items().filter(x => x.qty <= LOW); },

    /* ---- 店販売上（POS）---- */
    recordSale(lines, total) {
      // lines: [{id, qty, price}]
      sales.push({ ts: Date.now(), lines, total });
      lines.forEach(l => { inv[l.id] = Math.max(0, (inv[l.id] || 0) - l.qty); });
      emit();
    },
    todaySales() {
      const t = sales.filter(s => sameDay(s.ts));
      return { count: t.length, total: t.reduce((a, s) => a + s.total, 0), units: t.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.qty, 0), 0) };
    },
    recentSales(n = 10) { return sales.slice(-n).reverse(); },
  };

  window.SP = window.SP || {};
  window.SP.Salon = Salon;
})();

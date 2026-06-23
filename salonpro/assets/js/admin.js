/* =========================================================
   SalonPro / Admin — 会員審査キュー・在庫アラート
   ========================================================= */
(function () {
  const { Salon, placeholder, svg, fmtYen } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const toast = m => (window.SP_toast ? SP_toast(m) : null);

  let REVIEW = [
    { id: 1, name: '高橋 美咲', salon: 'hair atelier MELT 中目黒', type: 'サロン勤務', doc: '美容師免許', when: '10分前' },
    { id: 2, name: '佐藤 健', salon: 'BARBER K 渋谷', type: 'オーナー', doc: '理容師免許', when: '1時間前' },
    { id: 3, name: '鈴木 あや', salon: 'モード美容専門学校', type: '美容学生', doc: '学生証', when: '本日' },
    { id: 4, name: '山本 拓也', salon: 'フリーランス', type: 'フリーランス', doc: '名刺＋免許', when: '昨日' },
  ];

  // 掛け払い 与信承認キュー（承認すると発送指示。amount > credit は与信超過＝未集金リスク）
  let CREDIT = [
    { id: 'k1', no: 'SP-…5454', salon: 'SALON LUXE 表参道店', rep: '菊地 太郎', amount: 10648, credit: 1840000, items: 3, when: '5分前' },
    { id: 'k2', no: 'SP-…5450', salon: 'hair atelier MELT 中目黒', rep: '菊地 太郎', amount: 286000, credit: 300000, items: 22, when: '40分前' },
    { id: 'k3', no: 'SP-…5448', salon: 'BARBER K 渋谷', rep: '田中 彩', amount: 512000, credit: 400000, items: 41, when: '本日' },
  ];

  function renderReview() {
    qs('#navReview').textContent = REVIEW.length;
    qs('#kpiReview').textContent = REVIEW.length;
    if (!REVIEW.length) { qs('#reviewList').innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">審査待ちはありません 🎉</div>'; return; }
    qs('#reviewList').innerHTML = REVIEW.map(r => `
      <div class="review-item" data-id="${r.id}">
        <span class="review-item__av">${r.name.slice(0, 1)}</span>
        <span class="review-item__main">
          <span class="review-item__name">${r.name}</span>
          <span class="review-item__meta">${r.salon}・${r.type}・${r.when}</span>
          <span class="doc-chip">${svg('checkc')}${r.doc}</span>
        </span>
        <span class="review-item__act">
          <button class="btn btn--ghost" data-act="reject" data-id="${r.id}">差戻し</button>
          <button class="btn btn--primary" data-act="approve" data-id="${r.id}">承認</button>
        </span>
      </div>`).join('');
  }

  function renderCredit() {
    const el = qs('#creditList'); if (!el) return;
    qs('#navCredit').textContent = CREDIT.length;
    if (!CREDIT.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">承認待ちの掛け払い注文はありません 🎉</div>'; return; }
    el.innerHTML = CREDIT.map(c => {
      const over = c.amount > c.credit;
      const chip = over
        ? `<span class="doc-chip" style="background:#fbe7e6;border-color:#efd6d4;color:#c0453f">${svg('alert')}与信超過 ¥${c.amount.toLocaleString()}／枠 ¥${c.credit.toLocaleString()}</span>`
        : `<span class="doc-chip">${svg('checkc')}掛け払い ¥${c.amount.toLocaleString()}／枠 残り ¥${c.credit.toLocaleString()}</span>`;
      return `
      <div class="review-item" data-id="${c.id}">
        <span class="review-item__av">${c.salon.slice(0, 1)}</span>
        <span class="review-item__main">
          <span class="review-item__name">${c.salon} <span style="font-weight:600;color:var(--ink-3);font-size:12px">${c.no}</span>${c.held ? ' <span class="tag tag--prep">保留中</span>' : ''}</span>
          <span class="review-item__meta">担当：${c.rep}・${c.items}点・${c.when}</span>
          ${chip}
        </span>
        <span class="review-item__act">
          <button class="btn btn--ghost" data-act="hold" data-id="${c.id}">保留</button>
          <button class="btn btn--ghost" data-act="reject" data-id="${c.id}">差戻し</button>
          <button class="btn btn--primary" data-act="approve" data-id="${c.id}">承認・発送</button>
        </span>
      </div>`;
    }).join('');
  }

  // 契約申込 審査キュー（contracts.html の申込フォーム → Store.addContractApp → ここで審査）
  function renderContractApps() {
    const el = qs('#contractAppList'); if (!el) return;
    const apps = SP.Store.pendingContractApps();
    const nav = qs('#navContract'); if (nav) nav.textContent = apps.length;
    if (!apps.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">審査待ちの契約申込はありません 🎉</div>'; return; }
    el.innerHTML = apps.map(a => {
      const f = a.fields || {};
      const salon = f['サロン名'] || '—';
      const size = [f['セット面数'] ? 'セット面' + f['セット面数'] : '', f['スタッフ数'] ? 'スタッフ' + f['スタッフ数'] + '名' : ''].filter(Boolean).join('・');
      const chips = `<span class="doc-chip">${svg('checkc')}写真${(a.photos || []).length}点</span>` + ((a.requirements || []).length ? `<span class="doc-chip">${svg('checkc')}同意${a.requirements.length}項目</span>` : '');
      const detail = Object.keys(f).map(k => `<div><b style="color:var(--ink-3);font-weight:700">${k}</b>：${f[k] || '—'}</div>`).join('') +
        `<div><b style="color:var(--ink-3);font-weight:700">提出写真</b>：${(a.photos || []).join(' ／ ') || '—'}</div>` +
        `<div><b style="color:var(--ink-3);font-weight:700">同意事項</b>：${(a.requirements || []).join(' ／ ') || '—'}</div>`;
      return `
      <div class="ca-wrap">
        <div class="review-item" data-id="${a.id}">
          <span class="review-item__av">${(a.brand || '?').slice(0, 1)}</span>
          <span class="review-item__main">
            <span class="review-item__name">${a.brand} <span style="font-weight:600;color:var(--ink-3);font-size:12px">${a.maker || ''}</span></span>
            <span class="review-item__meta">${salon}${size ? '・' + size : ''}</span>
            ${chips}
          </span>
          <span class="review-item__act">
            <button class="btn btn--ghost" data-act="detail" data-id="${a.id}">内容</button>
            <button class="btn btn--ghost" data-act="reject" data-id="${a.id}">差戻し</button>
            <button class="btn btn--primary" data-act="approve" data-id="${a.id}">承認・契約</button>
          </span>
        </div>
        <div class="ca-detail" data-detail="${a.id}" hidden style="padding:10px 14px 14px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--ink-2);line-height:1.7">${detail}</div>
      </div>`;
    }).join('');
  }

  // セミナー申込・リマインド配信（seminar.html の申込 → Store.addSeminarApp → ここで確認・前日リマインド送信）
  function renderSeminars() {
    const el = qs('#seminarList'); if (!el) return;
    const WD = ['日', '月', '火', '水', '木', '金', '土'];
    const md = d => { const p = (d || '').split('-'); return p.length === 3 ? (+p[1]) + '/' + (+p[2]) : (d || ''); };
    const dow = d => { try { const p = d.split('-'); return WD[new Date(+p[0], +p[1] - 1, +p[2]).getDay()]; } catch (e) { return ''; } };
    const sems = (SP.SEMINARS || []).filter(s => s.date && SP.Store.seminarAppCount(s.id) > 0);
    const nav = qs('#navSeminar'); if (nav) nav.textContent = SP.Store.getSeminarApps().length;
    if (!sems.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">セミナー申込はまだありません</div>'; return; }
    el.innerHTML = sems.map(s => {
      const apps = SP.Store.getSeminarApps().filter(a => a.seminarId === s.id);
      const heads = apps.reduce((n, a) => n + (parseInt(a.count, 10) || 1), 0);
      const reminded = apps.every(a => a.reminded);
      const detail = apps.map(a => `<div><b style="color:var(--ink-3);font-weight:700">${a.name}</b>（${a.salon}）・${a.email}・${a.count || 1}名${a.reminded ? ' <span style="color:var(--gold-strong)">✓送信済</span>' : ''}</div>`).join('');
      return `
      <div class="ca-wrap">
        <div class="review-item" data-id="${s.id}">
          <span class="review-item__av">${s.kind === 'venue' ? '会' : 'L'}</span>
          <span class="review-item__main">
            <span class="review-item__name">${s.title}</span>
            <span class="review-item__meta">${md(s.date)}（${s.dow}）${s.time}・申込 ${apps.length}件/${heads}名${reminded ? ' ・リマインド済' : ''}</span>
          </span>
          <span class="review-item__act">
            <button class="btn btn--ghost" data-act="detail" data-id="${s.id}">申込者</button>
            <button class="btn btn--primary" data-act="remind" data-id="${s.id}"${reminded ? ' disabled' : ''}>${reminded ? '送信済み' : '前日リマインド送信'}</button>
          </span>
        </div>
        <div class="ca-detail" data-detail="${s.id}" hidden style="padding:10px 14px 14px;border-top:1px dashed var(--line);font-size:12.5px;color:var(--ink-2);line-height:1.7">${detail}</div>
      </div>`;
    }).join('');
  }

  function renderLow() {
    const low = Salon.lowItems();
    if (!low.length) { qs('#lowStock').innerHTML = '<div style="padding:14px;color:var(--ink-3);font-size:13px">在庫アラートはありません</div>'; return; }
    qs('#lowStock').innerHTML = low.map(it => `
      <div class="review-item">
        <span class="review-item__main">
          <span class="review-item__name" style="font-size:13px">${it.p.brand} ${it.p.name}</span>
          <span class="review-item__meta">在庫 ${it.qty}</span>
        </span>
        <span class="tag ${it.qty <= 0 ? 'tag--prep' : 'tag--new'}">${it.qty <= 0 ? '欠品' : '残少'}</span>
      </div>`).join('');
  }

  // メーカー添付 請求台帳（無償現品をメーカー別に集計）
  function renderClaims() {
    const host = qs('#claimList'); if (!host) return;
    const claims = (SP.Store.getClaims && SP.Store.getClaims()) || [];
    if (!claims.length) { host.innerHTML = '<div style="padding:14px;color:var(--ink-3);font-size:13px">添付（無償現品）の記録はありません</div>'; return; }
    const byMaker = {};
    claims.forEach(c => { const m = c.maker || 'メーカー'; (byMaker[m] = byMaker[m] || { units: 0, items: [] }); byMaker[m].units += (c.qty || 1); byMaker[m].items.push(c); });
    const total = claims.reduce((a, c) => a + (c.qty || 1), 0);
    host.innerHTML = `<div style="font-size:12px;color:var(--ink-2);padding:2px 0 10px">無償添付 合計 <b>${total}</b>本（メーカーへ請求対象・個別JANで計上）</div>` +
      Object.keys(byMaker).map(m => {
        const g = byMaker[m];
        const lines = g.items.map(c => `<span class="review-item__meta" style="font-size:11px;display:block">・${c.name || c.line} ×${c.qty || 1}（JAN: ${c.jan || '-'}）</span>`).join('');
        return `<div class="review-item"><span class="review-item__main"><span class="review-item__name" style="font-size:13px">${m}</span>${lines}</span><span class="tag tag--new">${g.units}本</span></div>`;
      }).join('') +
      `<div style="display:flex;gap:8px;margin-top:10px"><button class="btn btn--ghost" data-claim-bill>請求書を作成（デモ）</button><button class="btn btn--ghost" data-claim-csv>CSV出力</button></div>`;
  }
  const _cl = qs('#claimList');
  if (_cl) _cl.addEventListener('click', e => {
    if (e.target.closest('[data-claim-bill]')) { toast('メーカー別の添付請求書を作成しました（デモ）'); return; }
    if (e.target.closest('[data-claim-csv]')) {
      const claims = (SP.Store.getClaims && SP.Store.getClaims()) || [];
      const rows = [['メーカー', 'ライン', '商品', 'JAN', '数量', 'キャンペーン', '日時']].concat(claims.map(c => [c.maker, c.line, c.name, c.jan, c.qty, c.campaign, c.at]));
      const csv = rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '添付請求台帳.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast('CSVを出力しました'); return;
    }
  });

  // 入荷お知らせ（再入荷リクエスト）＝欠品商品の需要シグナル。入荷したら通知を送信（＝登録を解除）
  function renderRestock() {
    const host = qs('#restockList'); if (!host) return;
    const ids = (SP.Store.getRestockAlerts && SP.Store.getRestockAlerts()) || [];
    const nav = qs('#navRestock'); if (nav) nav.textContent = ids.length;
    if (!ids.length) {
      host.innerHTML = '<div style="padding:14px;color:var(--ink-3);font-size:12.5px;line-height:1.7">入荷お知らせの登録はまだありません。<br>欠品（入荷待ち）商品の商品ページ・一覧で「入荷お知らせ」に登録されると、ここに需要シグナルとして集まります。</div>';
      return;
    }
    const prods = (SP.DATA && SP.DATA.products) || [];
    host.innerHTML = `<div style="font-size:12px;color:var(--ink-2);padding:2px 0 10px">入荷待ち商品への入荷お知らせ <b>${ids.length}</b>件（需要シグナル）</div>` +
      ids.map(id => {
        const p = prods.find(x => x.id === id) || { name: id, brand: '', stock: 'wait' };
        const stLabel = p.stock === 'wait' ? '入荷待ち' : (p.stock === 'order' ? '取寄せ' : '入荷済み');
        return `<div class="review-item" data-id="${id}">
          <span class="review-item__av">告</span>
          <span class="review-item__main">
            <span class="review-item__name" style="font-size:13px">${p.brand ? p.brand + ' ' : ''}${p.name} <span class="tag ${p.stock === 'wait' ? 'tag--mute' : 'tag--shipped'}">${stLabel}</span></span>
            <span class="review-item__meta">入荷お知らせ 登録あり ・ 入荷時に登録サロンへ通知</span>
          </span>
          <span class="review-item__act">
            <button class="btn btn--primary" data-act="notify" data-id="${id}">入荷済み・お知らせ送信</button>
          </span>
        </div>`;
      }).join('');
  }
  const _rl = qs('#restockList');
  if (_rl) _rl.addEventListener('click', e => {
    const b = e.target.closest('[data-act="notify"]'); if (!b) return;
    const id = b.dataset.id;
    const p = ((SP.DATA && SP.DATA.products) || []).find(x => x.id === id);
    SP.Store.removeRestockAlert(id);   // 通知送信＝登録を解消（本番はWeb Push/メール送信に接続）
    toast(`${p ? p.name : id} の入荷お知らせを送信しました`);
    renderRestock();
  });

  // サロン別 添付条件（5＋1 / 10＋1 等）の編集（菊地が承認サロンごとに設定）
  function renderBundleConds() {
    const host = qs('#bundleCondList'); if (!host) return;
    const camps = (SP.CAMPAIGNS || []).filter(c => c.kind === 'buyXgetY');
    if (!camps.length) { host.innerHTML = '<div style="padding:12px;color:var(--ink-3);font-size:13px">添付対象のキャンペーンがありません</div>'; return; }
    host.innerHTML = '<div style="font-size:11.5px;color:var(--ink-2);padding:0 0 8px">サロン「SALON LUXE 表参道店」の添付条件（デモ）</div>' + camps.map(c => {
      const cond = SP.Store.salonBundleCond(c.id);
      return `<div class="review-item" data-camp="${c.id}" style="flex-wrap:wrap;gap:8px">
        <span class="review-item__main"><span class="review-item__name" style="font-size:13px">${c.line}（${c.maker || ''}）</span></span>
        <span style="display:flex;align-items:center;gap:6px;font-size:13px">
          <input type="number" min="1" max="99" value="${cond.x}" data-bx style="width:54px;border:1px solid var(--line-strong);border-radius:6px;padding:6px;font-family:var(--font-num);text-align:center">本 ＋
          <input type="number" min="1" max="9" value="${cond.y}" data-by style="width:48px;border:1px solid var(--line-strong);border-radius:6px;padding:6px;font-family:var(--font-num);text-align:center">本
          <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--ink-2);margin-left:6px"><input type="checkbox" data-ben ${cond.enabled ? 'checked' : ''}>適用</label>
        </span></div>`;
    }).join('');
  }
  const _bc = qs('#bundleCondList');
  if (_bc) _bc.addEventListener('change', e => {
    const row = e.target.closest('[data-camp]'); if (!row) return;
    const campId = row.dataset.camp;
    const x = qs('[data-bx]', row).value, y = qs('[data-by]', row).value, en = qs('[data-ben]', row).checked;
    SP.Store.setSalonBundleCond(campId, x, y, en);
    toast(`添付条件を保存：${x}＋${y}${en ? '' : '（適用OFF）'}`);
  });

  qs('#reviewList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = +b.dataset.id;
    const r = REVIEW.find(x => x.id === id); if (!r) return;
    if (b.dataset.act === 'approve') { openApproveModal(r); return; } // 承認時に添付条件を初期登録
    REVIEW = REVIEW.filter(x => x.id !== id);
    renderReview();
    toast(`${r.name} さんへ差戻ししました`);
  });

  // 承認 ＋ 添付条件の初期登録モーダル
  const amModal = qs('#approveModal');
  let amCurrent = null;
  function buildAmBrands() {
    const camps = (SP.CAMPAIGNS || []).filter(c => c.kind === 'buyXgetY');
    qs('#amBrands').innerHTML = camps.map(c => `
      <div class="review-item" data-camp="${c.id}" style="flex-wrap:wrap;gap:8px">
        <span class="review-item__main"><span class="review-item__name" style="font-size:13px">${c.line}（${c.maker || ''}）</span></span>
        <span style="display:flex;align-items:center;gap:6px;font-size:13px">
          <input type="number" min="1" max="99" value="${c.x}" data-bx style="width:54px;border:1px solid var(--line-strong);border-radius:6px;padding:6px;font-family:var(--font-num);text-align:center">本 ＋
          <input type="number" min="1" max="9" value="${c.y}" data-by style="width:48px;border:1px solid var(--line-strong);border-radius:6px;padding:6px;font-family:var(--font-num);text-align:center">本
          <label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;color:var(--ink-2);margin-left:6px"><input type="checkbox" data-ben checked>適用</label>
        </span></div>`).join('');
  }
  function openApproveModal(r) {
    amCurrent = r;
    qs('#amSub').textContent = `${r.name}（${r.salon}）の承認時に、メーカー添付の条件を登録します（あとから変更可）。`;
    buildAmBrands();
    if (amModal) amModal.style.display = 'block';
  }
  function closeApprove() { if (amModal) amModal.style.display = 'none'; amCurrent = null; }
  if (amModal) amModal.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeApprove(); });
  const _amc = qs('#amConfirm');
  if (_amc) _amc.addEventListener('click', () => {
    if (!amCurrent) return;
    const conds = {};
    [].forEach.call(qs('#amBrands').querySelectorAll('[data-camp]'), row => {
      conds[row.dataset.camp] = { x: +qs('[data-bx]', row).value || 1, y: +qs('[data-by]', row).value || 1, enabled: qs('[data-ben]', row).checked };
    });
    SP.Store.setSalonCondsFor(amCurrent.salon, conds);
    REVIEW = REVIEW.filter(x => x.id !== amCurrent.id);
    renderReview(); renderSalonConds();
    toast(`${amCurrent.salon} を承認＝添付条件を登録しました`);
    closeApprove();
  });

  // 承認済みサロンの添付条件 一覧
  function renderSalonConds() {
    const host = qs('#salonCondsList'); if (!host) return;
    const all = SP.Store.getSalonCondsAll ? SP.Store.getSalonCondsAll() : {};
    const names = Object.keys(all);
    if (!names.length) { host.innerHTML = '<div style="padding:12px;color:var(--ink-3);font-size:13px">まだ登録された添付条件はありません（会員審査の承認時に登録されます）</div>'; return; }
    host.innerHTML = names.map(nm => {
      const conds = all[nm];
      const chips = Object.keys(conds).filter(k => conds[k].enabled !== false).map(k => {
        const c = (SP.CAMPAIGNS || []).find(x => x.id === k) || {};
        return `<span style="display:inline-block;font-size:11px;font-weight:800;background:var(--gold-soft);color:var(--gold-strong);border-radius:999px;padding:3px 10px;margin:3px 4px 0 0">${c.line || k} ${conds[k].x}＋${conds[k].y}</span>`;
      }).join('') || '<span style="font-size:11px;color:var(--ink-3)">適用ブランドなし</span>';
      return `<div class="review-item"><span class="review-item__main"><span class="review-item__name" style="font-size:13px">${nm}</span><span>${chips}</span></span></div>`;
    }).join('');
  }

  // ── サロン別 メーカー割引（ディーラーが店舗ごとにブランド/メーカーの割引率を登録）──
  const KNOWN_SALONS = (function () {
    const cur = SP.Store.currentSalon ? SP.Store.currentSalon() : 'SALON LUXE 表参道店';
    const set = [cur, 'hair atelier MELT 中目黒', 'BARBER K 渋谷', 'Atelier NOa 自由が丘'];
    const all = SP.Store.getSalonDiscountsAll ? SP.Store.getSalonDiscountsAll() : {};
    Object.keys(all).forEach(n => { if (set.indexOf(n) < 0) set.push(n); });
    return set;
  })();
  const BRAND_OPTS = (function () {
    const cnt = {};
    ((SP.DATA && SP.DATA.products) || []).forEach(p => { if (p.brand) cnt[p.brand] = (cnt[p.brand] || 0) + 1; });
    return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  })();
  function fillDiscForm() {
    const cur = SP.Store.currentSalon ? SP.Store.currentSalon() : '';
    const ss = qs('#discSalon'); if (ss) ss.innerHTML = KNOWN_SALONS.map(n => `<option value="${n}">${n}${n === cur ? '（ログイン中）' : ''}</option>`).join('');
    const bs = qs('#discBrand'); if (bs) bs.innerHTML = BRAND_OPTS.map(b => `<option value="${b}">${b}</option>`).join('');
  }
  function renderSalonDiscounts() {
    const host = qs('#salonDiscList'); if (!host) return;
    const all = SP.Store.getSalonDiscountsAll ? SP.Store.getSalonDiscountsAll() : {};
    const cur = SP.Store.currentSalon ? SP.Store.currentSalon() : '';
    const names = Object.keys(all).filter(n => {
      const d = all[n] || {}; return Object.keys(d.brands || {}).length || Object.keys(d.makers || {}).length;
    });
    if (!names.length) { host.innerHTML = '<div style="padding:12px;color:var(--ink-3);font-size:13px">まだ割引は登録されていません。上のフォームから店舗ごとに登録できます。</div>'; return; }
    host.innerHTML = names.map(nm => {
      const d = all[nm] || {}, mk = d.makers || {}, br = d.brands || {};
      const chips = Object.keys(br).map(k => ({ kind: 'brand', name: k, rate: br[k] }))
        .concat(Object.keys(mk).map(k => ({ kind: 'maker', name: k, rate: mk[k] })))
        .map(c => `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:800;background:#1f4e8c12;color:#1f4e8c;border-radius:999px;padding:4px 7px 4px 11px;margin:3px 4px 0 0">${c.name} ${Math.round(c.rate * 100)}%OFF<button data-rmdisc data-salon="${nm}" data-kind="${c.kind}" data-name="${c.name}" aria-label="削除" style="border:none;background:#1f4e8c;color:#fff;width:16px;height:16px;border-radius:50%;font-size:11px;line-height:1;cursor:pointer">×</button></span>`).join('');
      return `<div class="review-item"><span class="review-item__main"><span class="review-item__name" style="font-size:13px">${nm}${nm === cur ? ' <span class="tag tag--new">ログイン中</span>' : ''}</span><span>${chips}</span></span></div>`;
    }).join('');
  }
  const _discAdd = qs('#discAdd');
  if (_discAdd) _discAdd.addEventListener('click', () => {
    const salon = qs('#discSalon').value, brand = qs('#discBrand').value, rate = parseFloat(qs('#discRate').value) || 0;
    if (!salon || !brand || !rate) return;
    const cur = SP.Store.getSalonDiscounts(salon); // {makers, brands}
    cur.brands[brand] = rate;
    SP.Store.setSalonDiscountsFor(salon, cur);
    renderSalonDiscounts();
    toast(`${salon}：${brand} を ${Math.round(rate * 100)}%OFF で登録しました`);
  });
  const _discList = qs('#salonDiscList');
  if (_discList) _discList.addEventListener('click', e => {
    const b = e.target.closest('[data-rmdisc]'); if (!b) return;
    const salon = b.dataset.salon, kind = b.dataset.kind, name = b.dataset.name;
    const cur = SP.Store.getSalonDiscounts(salon);
    if (kind === 'brand') delete cur.brands[name]; else delete cur.makers[name];
    SP.Store.setSalonDiscountsFor(salon, cur);
    renderSalonDiscounts();
    toast(`${salon}：${name} の割引を削除しました`);
  });

  qs('#creditList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id;
    const c = CREDIT.find(x => x.id === id); if (!c) return;
    const act = b.dataset.act;
    if (act === 'hold') { c.held = true; renderCredit(); toast(`${c.salon} を保留にしました`); return; }
    CREDIT = CREDIT.filter(x => x.id !== id);
    renderCredit();
    toast(act === 'approve' ? `${c.salon} を承認＝発送指示を出しました` : `${c.salon} を差し戻しました`);
  });

  qs('#contractAppList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'detail') { const d = qs('[data-detail="' + id + '"]'); if (d) d.hidden = !d.hidden; return; }
    const a = SP.Store.getContractApps().find(x => x.id === id);
    if (act === 'approve') { SP.Store.approveContractApp(id); toast(`${a ? a.brand : ''} の契約を締結＝サロンで取扱い可にしました`); }
    else { SP.Store.rejectContractApp(id); toast(`${a ? a.brand : ''} の申込を差し戻しました`); }
    renderContractApps();
  });

  qs('#seminarList').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'detail') { const d = qs('#seminarList [data-detail="' + id + '"]'); if (d) d.hidden = !d.hidden; return; }
    if (act === 'remind') {
      const n = SP.Store.markSeminarReminded(id);
      const s = (SP.SEMINARS || []).find(x => x.id === id);
      toast(`${s ? s.title : 'セミナー'} のリマインドを ${n}件 に送信しました`);
      renderSeminars();
    }
  });

  // デモ用：セミナー申込が無ければサンプルを投入（実際は seminar.html の申込フォームから届く）
  if (SP.Store.getSeminarApps().length === 0) {
    [{ seminarId: 'sem-1', title: '2026夏の最新トレンドカラー実践セミナー', name: '高橋 美咲', salon: 'hair atelier MELT 中目黒', email: 'melt@example.jp', count: '2', at: Date.now() },
     { seminarId: 'sem-1', title: '2026夏の最新トレンドカラー実践セミナー', name: '佐藤 健', salon: 'BARBER K 渋谷', email: 'k@example.jp', count: '1', at: Date.now() },
     { seminarId: 'sem-2', title: '札幌会場｜ブリーチワーク実技講習（少人数）', name: '鈴木 あや', salon: 'Atelier NOa 自由が丘', email: 'noa@example.jp', count: '1', at: Date.now() }
    ].forEach(r => SP.Store.addSeminarApp(r));
  }

  // デモ用：契約申込が無ければサンプルを1件投入（実際は contracts.html の申込フォームから届く）
  if (SP.Store.getContractApps().length === 0) {
    SP.Store.addContractApp({
      brandId: 'kerastase', brand: 'ケラスターゼ', maker: 'ロレアル プロフェッショナル',
      fields: { 'サロン名': 'hair atelier MELT 中目黒', 'ご担当者名': '高橋 美咲', '電話番号': '03-1234-5678', 'メールアドレス': 'melt@example.jp', 'ご住所': '東京都目黒区青葉台1-2-3', 'セット面数': '8', 'スタッフ数': '6' },
      photos: ['サロン外観の写真', '内観・セット面の写真', 'ブランドコーナー設置予定場所の写真'],
      requirements: ['ブランド什器の設置スペースを確保できます', '正規取扱い基準に同意します'], at: Date.now(),
    });
  }

  // デモ用：添付請求が無ければサンプルを投入（実際は campaigns.html の添付ビルダーから記録）
  if (SP.Store.getClaims && SP.Store.getClaims().length === 0) {
    [{ campaign: 'adicy-10-1', maker: 'ミルボン', line: 'アディクシー', dealer: 'kikuchi', name: 'アディクシー サファイア 8', jan: '4900000000201', qty: 1, at: Date.now() },
     { campaign: 'adicy-10-1', maker: 'ミルボン', line: 'アディクシー', dealer: 'kikuchi', name: 'アディクシー アメジスト 6', jan: '4900000000202', qty: 1, at: Date.now() }
    ].forEach(r => SP.Store.addClaim(r));
  }

  // リース・機器 申込キュー（equipment.html の申込 → Store.addLeaseApp → ここで担当者が連絡・審査）
  const LEASE_ST = { pending: ['受付', 'tag--prep'], contacted: ['連絡済み', 'tag--new'], approved: ['承認', 'tag--shipped'], rejected: ['見送り', 'tag--mute'] };
  function renderLeases() {
    const el = qs('#leaseList'); if (!el) return;
    const apps = SP.Store.getLeaseApps ? SP.Store.getLeaseApps() : [];
    const nav = qs('#navLease'); if (nav) nav.textContent = apps.filter(a => a.status === 'pending').length;
    if (!apps.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">リース・機器の申込はまだありません</div>'; return; }
    el.innerHTML = apps.map(a => {
      const st = LEASE_ST[a.status] || LEASE_ST.pending;
      const line = a.plan === 'lease'
        ? `リース ${a.term}回・年利${a.rate}%・月々 ¥${(a.monthly || 0).toLocaleString()}（総額 ¥${(a.total || 0).toLocaleString()}）`
        : a.plan === 'used'
          ? `中古機器 ¥${(a.price || 0).toLocaleString()}`
          : '購入（お見積り依頼）';
      const done = a.status === 'approved' || a.status === 'rejected';
      return `
      <div class="review-item" data-id="${a.id}">
        <span class="review-item__av">${a.plan === 'lease' ? 'L' : a.plan === 'used' ? '中' : '購'}</span>
        <span class="review-item__main">
          <span class="review-item__name">${a.name} <span class="tag ${st[1]}">${st[0]}</span></span>
          <span class="review-item__meta">${a.salon || '—'}${a.contact ? '・' + a.contact : ''}</span>
          <span class="doc-chip">${svg('checkc')}${line}</span>
        </span>
        <span class="review-item__act">
          ${done ? '' : '<button class="btn btn--ghost" data-act="reject" data-id="' + a.id + '">見送り</button>'}
          ${done ? '' : '<button class="btn btn--ghost" data-act="contact" data-id="' + a.id + '">連絡済み</button>'}
          <button class="btn btn--primary" data-act="approve" data-id="${a.id}"${a.status === 'approved' ? ' disabled' : ''}>${a.status === 'approved' ? '承認済み' : '承認・契約へ'}</button>
        </span>
      </div>`;
    }).join('');
  }
  const _ll = qs('#leaseList');
  if (_ll) _ll.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    const map = { reject: 'rejected', contact: 'contacted', approve: 'approved' };
    SP.Store.setLeaseStatus(id, map[act] || 'pending');
    toast(act === 'approve' ? '承認しました（契約手続きへ）' : act === 'contact' ? '「連絡済み」にしました' : '見送りにしました');
    renderLeases();
  });

  // デモ用：リース申込が無ければサンプルを投入（実際は equipment.html の申込から届く）
  if (SP.Store.getLeaseApps && SP.Store.getLeaseApps().length === 0) {
    SP.Store.addLeaseApp({ equipId: 'eq-001', name: 'シャンプー台 ユニット（バックシャンプー）', brand: 'タカラベルモント', price: 528000, plan: 'lease', term: 60, rate: 4.0, monthly: 9728, total: 583680, salon: 'hair atelier MELT 中目黒', contact: '高橋 / 03-1234-5678', note: '7月中に1台導入希望' });
    SP.Store.addLeaseApp({ equipId: 'eq-002', name: 'セットチェア（油圧式）', brand: 'タカラベルモント', price: 132000, plan: 'buy', salon: 'BARBER K 渋谷', contact: '佐藤', note: '2脚の見積希望' });
    SP.Store.addLeaseApp({ equipId: 'u-001', name: 'シャンプー台 ユニット（中古）', brand: 'タカラベルモント', price: 198000, plan: 'used', salon: 'Atelier NOa 自由が丘', contact: '田中 / 090-2222-3333', note: '中古で1台導入したい' });
  }

  // 大型機器 買取査定キュー（equipment.html の買取依頼 → Store.addBuyback → ここで担当者が査定・買取→中古として出品）
  const BUYBACK_ST = { pending: ['受付', 'tag--prep'], contacted: ['連絡済み', 'tag--new'], quoted: ['査定提示', 'tag--shipped'], agreed: ['買取成立', 'tag--shipped'], listed: ['中古に出品済み', 'tag--shipped'], rejected: ['見送り', 'tag--mute'] };
  // 機器種類 → 中古カードの色/ラベル（中古再販グリッドの体裁を既存在庫に合わせる）
  const BB_PH = {
    'セット椅子': { tint: '#3a3030', label: 'CHAIR' }, 'シャンプー台': { tint: '#5b6473', label: 'SHAMPOO' },
    'スチーマー': { tint: '#7d8fa6', label: 'STEAMER' }, 'ミラー・セット面什器': { tint: '#cdd2d8', label: 'MIRROR' },
    'パーマ機（デジパ/コスメ）': { tint: '#6a5a74', label: 'PERM' }, '薬剤保管庫・ロッカー': { tint: '#8a8f96', label: 'LOCKER' },
    '受付カウンター': { tint: '#b9a78a', label: 'COUNTER' }, 'その他大型機器': { tint: '#5b6473', label: 'EQUIP' },
  };
  const COND_GRADE = { '良好': 'A', '普通': 'B', '要修理': 'C' };
  const YEAR_BACK = { '〜3年': 2, '3〜5年': 4, '5〜10年': 7, '10年〜': 12 };
  function renderBuybacks() {
    const el = qs('#buybackList'); if (!el) return;
    const apps = SP.Store.getBuybacks ? SP.Store.getBuybacks() : [];
    const nav = qs('#navBuyback'); if (nav) nav.textContent = apps.filter(a => a.status === 'pending').length;
    if (!apps.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">機器買取のご依頼はまだありません</div>'; return; }
    el.innerHTML = apps.map(a => {
      const st = BUYBACK_ST[a.status] || BUYBACK_ST.pending;
      const spec = `${a.type} ×${a.qty || 1}・状態${a.cond}・${a.years || '—'}・写真${a.photoCount || (a.photos ? a.photos.length : 0)}枚`;
      const quoteLine = (a.quote != null && a.quote !== '') ? ` ・ 査定額 ¥${(+a.quote).toLocaleString()}` : '';
      let actions;
      if (a.status === 'listed' || a.status === 'rejected') {
        actions = '';
      } else if (a.status === 'agreed') {
        actions = '<button class="btn btn--primary" data-act="list" data-id="' + a.id + '">中古として出品</button>';
      } else {
        actions = '<button class="btn btn--ghost" data-act="reject" data-id="' + a.id + '">見送り</button>'
          + '<button class="btn btn--ghost" data-act="contact" data-id="' + a.id + '">連絡済み</button>'
          + '<button class="btn btn--ghost" data-act="quote" data-id="' + a.id + '">査定額を提示</button>'
          + '<button class="btn btn--primary" data-act="agree" data-id="' + a.id + '">買取成立にする</button>';
      }
      return `
      <div class="review-item" data-id="${a.id}">
        <span class="review-item__av">買</span>
        <span class="review-item__main">
          <span class="review-item__name">${a.maker ? a.maker + ' ' : ''}${a.type} <span class="tag ${st[1]}">${st[0]}</span></span>
          <span class="review-item__meta">${a.salon || '—'}${a.contact ? '・' + a.contact : ''}${a.when ? '・引取希望:' + a.when : ''}</span>
          <span class="doc-chip">${svg('checkc')}${spec}${quoteLine}</span>
        </span>
        <span class="review-item__act">${actions}</span>
      </div>`;
    }).join('');
  }
  const _bbl = qs('#buybackList');
  if (_bbl) _bbl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    if (act === 'quote') {
      const cur = (SP.Store.getBuybacks().find(x => x.id === id) || {}).quote || '';
      const v = prompt('査定額（税抜・円）を入力してください', cur);
      if (v == null) return;
      const n = Math.max(0, Math.round(+String(v).replace(/[^\d.]/g, '') || 0));
      SP.Store.setBuybackStatus(id, 'quoted', n);
      toast(`査定額 ¥${n.toLocaleString()} を提示しました`);
      renderBuybacks(); return;
    }
    if (act === 'list') { openListModal(id); return; }
    const map = { reject: 'rejected', contact: 'contacted', agree: 'agreed' };
    SP.Store.setBuybackStatus(id, map[act] || 'pending');
    toast(act === 'agree' ? '買取成立にしました。続けて中古として出品できます' : act === 'contact' ? '「連絡済み」にしました' : '見送りにしました');
    renderBuybacks();
  });

  // 買取成立 → 「中古として出品」モーダル（中古在庫に登録＝equipment.html の中古再販に自動掲載）
  let listCurrent = null;
  function openListModal(buybackId) {
    const a = SP.Store.getBuybacks().find(x => x.id === buybackId); if (!a) return;
    listCurrent = a;
    const Y = new Date().getFullYear();
    const ph = BB_PH[a.type] || BB_PH['その他大型機器'];
    qs('#ulSub').textContent = `${a.salon || ''} からの買取機器を中古在庫に出品します`;
    qs('#ulName').value = (a.maker ? a.maker + ' ' : '') + a.type + (a.qty > 1 ? `（${a.qty}点）` : '');
    qs('#ulBrand').value = a.maker ? String(a.maker).split('/')[0].trim() : '共通';
    qs('#ulGrade').value = COND_GRADE[a.cond] || 'B';
    qs('#ulYear').value = Y - (YEAR_BACK[a.years] || 6);
    qs('#ulList').value = '';
    qs('#ulPrice').value = a.quote ? Math.round(a.quote * 1.6 / 1000) * 1000 : '';  // 仕入の目安1.6倍を初期提案（編集可）
    qs('#ulSource').value = '買取（閉店・改装より）';
    qs('#ulQuoteRef').textContent = a.quote ? `仕入（査定額）¥${(+a.quote).toLocaleString()}` : '仕入（査定額）未設定';
    qs('#usedListOv').style.display = 'flex';
  }
  function closeListModal() { qs('#usedListOv').style.display = 'none'; listCurrent = null; }
  const _ulx = qs('#usedListOv');
  if (_ulx) _ulx.addEventListener('click', e => { if (e.target === _ulx || e.target.hasAttribute('data-ul-close')) closeListModal(); });
  const _ulSubmit = qs('#ulSubmit');
  if (_ulSubmit) _ulSubmit.addEventListener('click', () => {
    if (!listCurrent) return;
    const price = Math.max(0, Math.round(+String(qs('#ulPrice').value).replace(/[^\d.]/g, '') || 0));
    if (!price) { toast('販売価格を入力してください'); return; }
    const list = Math.max(0, Math.round(+String(qs('#ulList').value).replace(/[^\d.]/g, '') || 0));
    const ph = BB_PH[listCurrent.type] || BB_PH['その他大型機器'];
    SP.Store.addUsedItem({
      name: qs('#ulName').value.trim() || listCurrent.type,
      brand: qs('#ulBrand').value.trim() || '共通',
      cond: qs('#ulGrade').value || 'B',
      year: +qs('#ulYear').value || new Date().getFullYear(),
      list: list || 0, price: price,
      source: qs('#ulSource').value.trim() || '買取より',
      ph: { tint: ph.tint, label: ph.label },
      fromBuyback: listCurrent.id,
    });
    SP.Store.setBuybackStatus(listCurrent.id, 'listed');
    toast('中古在庫に出品しました（中古再販ページに掲載）');
    closeListModal();
    renderBuybacks(); renderUsedInventory();
  });

  // 出品中の中古在庫（ディーラーが出品＝買取成立分。equipment.html の中古再販に掲載中）
  function renderUsedInventory() {
    const el = qs('#usedInvList'); if (!el) return;
    const items = SP.Store.getUsedInventory ? SP.Store.getUsedInventory() : [];
    if (!items.length) { el.innerHTML = '<div style="padding:14px;text-align:center;color:var(--ink-3);font-size:12.5px">出品中の中古在庫はありません。買取査定キューで「買取成立」→「中古として出品」で掲載されます。</div>'; return; }
    el.innerHTML = items.map(p => {
      const off = p.list ? Math.round((1 - p.price / p.list) * 100) : 0;
      return `
      <div class="review-item" data-id="${p.id}">
        <span class="review-item__av">中</span>
        <span class="review-item__main">
          <span class="review-item__name">${p.name} <span class="tag tag--shipped">掲載中</span></span>
          <span class="review-item__meta">${p.brand || ''}・状態${p.cond}・${p.year}年式・${p.source || ''}</span>
          <span class="doc-chip">${svg('checkc')}販売 ¥${(p.price || 0).toLocaleString()}${p.list ? ` ／ 参考上代 ¥${p.list.toLocaleString()}${off > 0 ? `（${off}%OFF）` : ''}` : ''}</span>
        </span>
        <span class="review-item__act">
          <button class="btn btn--ghost" data-act="remove" data-id="${p.id}">取り下げ</button>
        </span>
      </div>`;
    }).join('');
  }
  const _uil = qs('#usedInvList');
  if (_uil) _uil.addEventListener('click', e => {
    const b = e.target.closest('[data-act="remove"]'); if (!b) return;
    SP.Store.removeUsedItem(b.dataset.id);
    toast('中古在庫から取り下げました（中古再販ページから非掲載）');
    renderUsedInventory();
  });

  // デモ用：買取依頼が無ければサンプルを投入（実際は equipment.html の買取フォームから届く）
  if (SP.Store.getBuybacks && SP.Store.getBuybacks().length === 0) {
    SP.Store.addBuyback({ type: 'セット椅子', cond: '普通', maker: 'タカラベルモント / レガロ', qty: 2, years: '5〜10年', photos: ['全体写真', '座面の傷', '型番ラベル'], photoCount: 3, salon: 'hair atelier MELT 中目黒', contact: '高橋 / 03-1234-5678', when: '改装に合わせて来月', note: '2脚まとめて引き取り希望' });
    SP.Store.addBuyback({ type: 'シャンプー台', cond: '良好', maker: '', qty: 1, years: '3〜5年', photos: ['全体写真', 'ボウル内'], photoCount: 2, salon: 'Atelier NOa 自由が丘', contact: '田中 / 090-2222-3333', when: '', note: 'バックシャンプー1台' });
  }

  // パートナー紹介 申込キュー（partners.html の紹介依頼 → Store.addPartnerLead → ここで担当者が連絡・成約）
  const PT_ST = { pending: ['受付', 'tag--prep'], contacted: ['連絡済み', 'tag--new'], done: ['成約', 'tag--shipped'], rejected: ['見送り', 'tag--mute'] };
  function renderPartners() {
    const el = qs('#partnerList'); if (!el) return;
    const leads = SP.Store.getPartnerLeads ? SP.Store.getPartnerLeads() : [];
    const nav = qs('#navPartner'); if (nav) nav.textContent = leads.filter(l => l.status === 'pending').length;
    if (!leads.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">パートナー紹介の依頼はまだありません</div>'; return; }
    el.innerHTML = leads.map(a => {
      const st = PT_ST[a.status] || PT_ST.pending;
      const done = a.status === 'done' || a.status === 'rejected';
      return `
      <div class="review-item" data-id="${a.id}">
        <span class="review-item__av">紹</span>
        <span class="review-item__main">
          <span class="review-item__name">${a.partnerName} <span class="tag ${st[1]}">${st[0]}</span></span>
          <span class="review-item__meta">${a.salon || '—'}${a.contact ? '・' + a.contact : ''}${a.summary ? '・' + a.summary : ''}</span>
          <span class="doc-chip">${svg('checkc')}紹介料：${a.feeNote || '成約でディーラーに入ります'}</span>
        </span>
        <span class="review-item__act">
          ${done ? '' : '<button class="btn btn--ghost" data-act="reject" data-id="' + a.id + '">見送り</button>'}
          ${done ? '' : '<button class="btn btn--ghost" data-act="contact" data-id="' + a.id + '">連絡済み</button>'}
          <button class="btn btn--primary" data-act="done" data-id="${a.id}"${a.status === 'done' ? ' disabled' : ''}>${a.status === 'done' ? '成約済み' : '成約にする'}</button>
        </span>
      </div>`;
    }).join('');
  }
  const _pl = qs('#partnerList');
  if (_pl) _pl.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    const map = { reject: 'rejected', contact: 'contacted', done: 'done' };
    SP.Store.setPartnerLeadStatus(id, map[act] || 'pending');
    toast(act === 'done' ? '成約にしました（紹介料がディーラーに入ります）' : act === 'contact' ? '「連絡済み」にしました' : '見送りにしました');
    renderPartners();
  });

  // デモ用：パートナー紹介依頼が無ければサンプルを投入（実際は partners.html の紹介フォームから届く）
  if (SP.Store.getPartnerLeads && SP.Store.getPartnerLeads().length === 0) {
    SP.Store.addPartnerLead({ partnerId: 'koumuten', partnerName: '内装・店舗工事（工務店）', feeNote: '成約工事額の 3〜5%（目安）', salon: 'hair atelier MELT 中目黒', contact: '高橋 / 03-1234-5678', summary: '改装・リニューアル・3ヶ月以内・20坪', note: '居抜きを改装したい' });
    SP.Store.addPartnerLead({ partnerId: 'tax', partnerName: '税理士', feeNote: '成約初年度顧問料の一部（目安）', salon: 'BARBER K 渋谷', contact: '佐藤', summary: '法人・法人化の相談', note: '' });
  }

  /* ===== 充実化：注文管理・商品管理・分析・KPI・ナビ ===== */
  const yen = n => '¥' + Math.round(n || 0).toLocaleString('ja-JP');
  const CAT_LABEL = {};
  ((SP.DATA && SP.DATA.categories) || []).forEach(c => { CAT_LABEL[c.id] = c.label; });
  const catName = id => CAT_LABEL[id] || id;

  // デモ注文（注文管理＋KPIの元データ）
  const ORDER_ST = { new: ['新規', 'tag--new'], prep: ['準備中', 'tag--prep'], shipped: ['出荷済', 'tag--shipped'], credit: ['与信待ち', 'tag--mute'] };
  let ORDERS = [
    { no: 'SP-2381', salon: 'SALON LUXE 表参道店', date: '本日', items: 12, amount: 18920, pay: '請求書', status: 'prep' },
    { no: 'SP-2380', salon: 'hair atelier MELT 中目黒', date: '本日', items: 5, amount: 7150, pay: 'カード', status: 'new' },
    { no: 'SP-2379', salon: 'BARBER K 渋谷', date: '本日', items: 3, amount: 3520, pay: '請求書', status: 'shipped' },
    { no: 'SP-2378', salon: 'Atelier NOa 自由が丘', date: '本日', items: 18, amount: 24310, pay: '請求書', status: 'credit' },
    { no: 'SP-2377', salon: 'SALON LUXE 表参道店', date: '昨日', items: 8, amount: 12480, pay: 'カード', status: 'shipped' },
    { no: 'SP-2376', salon: 'hair atelier MELT 中目黒', date: '昨日', items: 2, amount: 528000, pay: 'リース', status: 'prep' },
    { no: 'SP-2375', salon: 'Lumiere 銀座', date: '昨日', items: 22, amount: 41200, pay: '請求書', status: 'shipped' },
    { no: 'SP-2374', salon: 'BARBER K 渋谷', date: '6/20', items: 6, amount: 9680, pay: 'コンビニ', status: 'shipped' },
    { no: 'SP-2373', salon: 'Atelier NOa 自由が丘', date: '6/20', items: 14, amount: 19250, pay: '請求書', status: 'shipped' },
    { no: 'SP-2372', salon: 'hair room SOL 吉祥寺', date: '6/20', items: 9, amount: 13740, pay: 'カード', status: 'shipped' },
    { no: 'SP-2371', salon: 'Lumiere 銀座', date: '6/19', items: 31, amount: 132000, pay: 'リース', status: 'shipped' },
    { no: 'SP-2370', salon: 'SALON LUXE 表参道店', date: '6/19', items: 7, amount: 10980, pay: '請求書', status: 'shipped' },
    { no: 'SP-2369', salon: 'hair room SOL 吉祥寺', date: '6/18', items: 11, amount: 16320, pay: 'カード', status: 'shipped' },
    { no: 'SP-2368', salon: 'BARBER K 渋谷', date: '6/18', items: 4, amount: 5280, pay: '請求書', status: 'shipped' },
  ];

  // KPI（実データ連動：店舗状態＋注文データから算出）
  function computeKpis() {
    const set = (id, v) => { const el = qs('#' + id); if (el) el.textContent = v; };
    set('kpiGmv', yen(ORDERS.reduce((a, o) => a + o.amount, 0)));
    set('kpiOrders', ORDERS.filter(o => o.date === '本日').length);
    set('kpiSalons', new Set(ORDERS.map(o => o.salon)).size + 54);
    set('kpiRestock', (SP.Store.restockCount && SP.Store.restockCount()) || 0);
    set('kpiBuyback', (SP.Store.pendingBuybacks && SP.Store.pendingBuybacks().length) || 0);
    set('kpiPartner', (SP.Store.pendingPartnerLeads && SP.Store.pendingPartnerLeads().length) || 0);
  }

  // 分析（SVGチャート）：月次GMV推移（デモ）＋カテゴリ別取扱い点数（実データ）＋人気ブランドTOP（実データ）
  function vbars(data, unit) {
    const max = Math.max.apply(null, data.map(d => d.v)) || 1;
    const bw = 320 / data.length, pad = bw * 0.26;
    const bars = data.map((d, i) => {
      const h = Math.round((d.v / max) * 96);
      const x = i * bw + pad, y = 120 - h, w = bw - pad * 2;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--gold)"/>` +
        `<text x="${x + w / 2}" y="${y - 4}" text-anchor="middle" font-size="9" fill="var(--ink-2)" font-family="var(--font-num)">${d.t || ''}</text>` +
        `<text x="${x + w / 2}" y="133" text-anchor="middle" font-size="9" fill="var(--ink-3)">${d.label}</text>`;
    }).join('');
    return `<svg viewBox="0 0 320 140" style="width:100%;height:auto">${bars}</svg>`;
  }
  function hbars(data) {
    const max = Math.max.apply(null, data.map(d => d.v)) || 1;
    return '<div style="display:grid;gap:7px">' + data.map(d => {
      const pct = Math.round((d.v / max) * 100);
      return `<div style="display:grid;grid-template-columns:96px 1fr 42px;align-items:center;gap:8px;font-size:12px">
        <span style="color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.label}</span>
        <span style="background:var(--surface-2);border-radius:999px;height:9px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:var(--gold);border-radius:999px"></i></span>
        <span style="text-align:right;font-family:var(--font-num);font-weight:700;color:var(--ink)">${d.v}</span>
      </div>`;
    }).join('') + '</div>';
  }
  function renderAnalytics() {
    const host = qs('#analyticsBody'); if (!host) return;
    const prods = (SP.DATA && SP.DATA.products) || [];
    const gmv = [
      { label: '1月', v: 382 }, { label: '2月', v: 410 }, { label: '3月', v: 458 },
      { label: '4月', v: 437 }, { label: '5月', v: 489 }, { label: '6月', v: 482, t: '今月' }
    ];
    const catCnt = {}; prods.forEach(p => { if (p.cat && p.cat !== '_rec') catCnt[p.cat] = (catCnt[p.cat] || 0) + 1; });
    const cats = Object.keys(catCnt).map(k => ({ label: catName(k), v: catCnt[k] })).sort((a, b) => b.v - a.v).slice(0, 8);
    const brCnt = {}; prods.forEach(p => { if (p.brand) brCnt[p.brand] = (brCnt[p.brand] || 0) + 1; });
    const brands = Object.keys(brCnt).map(k => ({ label: k, v: brCnt[k] })).sort((a, b) => b.v - a.v).slice(0, 6);
    const ranks = [{ label: 'ブロンズ', v: 28 }, { label: 'シルバー', v: 34 }, { label: 'ゴールド', v: 21 }, { label: 'プラチナ', v: 12 }];
    host.innerHTML = `
      <div style="display:grid;gap:18px;grid-template-columns:1fr;">
        <div>
          <div style="font-size:12.5px;font-weight:800;margin-bottom:8px">月次 流通額（GMV）推移 <span style="color:var(--ink-3);font-weight:600;font-size:11px">単位：万円・デモ</span></div>
          ${vbars(gmv)}
        </div>
        <div style="display:grid;gap:18px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">カテゴリ別 取扱い点数</div>${hbars(cats)}</div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">取扱いブランド TOP6（点数）</div>${hbars(brands)}</div>
        </div>
        <div style="max-width:520px"><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">会員ランク分布 <span style="color:var(--ink-3);font-weight:600;font-size:11px">デモ</span></div>${hbars(ranks)}</div>
      </div>`;
  }

  // 商品管理（検索・カテゴリ／在庫フィルタ・CSV）
  function setupProductAdmin() {
    const body = qs('#productAdminBody'); if (!body) return;
    const prods = (SP.DATA && SP.DATA.products || []).filter(p => p.cat !== '_rec');
    const sel = qs('#prodCat');
    if (sel) {
      const cats = Array.from(new Set(prods.map(p => p.cat)));
      sel.innerHTML = '<option value="">カテゴリすべて</option>' + cats.map(c => `<option value="${c}">${catName(c)}</option>`).join('');
    }
    const STK = { in: ['在庫あり', 'tag--shipped'], low: ['残りわずか', 'tag--prep'], order: ['取寄せ', 'tag--new'], wait: ['入荷待ち', 'tag--mute'] };
    function filtered() {
      const q = (qs('#prodSearch').value || '').trim().toLowerCase();
      const c = qs('#prodCat').value, s = qs('#prodStock').value;
      return prods.filter(p =>
        (!q || (p.name + ' ' + p.brand).toLowerCase().indexOf(q) >= 0) &&
        (!c || p.cat === c) && (!s || (p.stock || 'in') === s));
    }
    function render() {
      const list = filtered();
      qs('#prodCount').textContent = `${list.length}件 / 全${prods.length}件`;
      const rows = list.slice(0, 40).map(p => {
        const st = STK[p.stock || 'in'] || STK.in;
        const rate = (SP.discountRate ? SP.discountRate(p) : 0);
        const eff = (SP.priceOf ? SP.priceOf(p) : p.price);
        return `<tr>
          <td><a href="product.html?id=${p.id}" style="color:var(--ink);font-weight:700;text-decoration:none">${p.name}</a><div style="font-size:11px;color:var(--ink-3)">${p.brand}</div></td>
          <td>${catName(p.cat)}</td>
          <td class="num">${yen(eff)}${rate > 0 ? `<div style="font-size:10.5px;color:#1f4e8c;font-weight:800">貴店 ${Math.round(rate * 100)}%OFF</div>` : ''}</td>
          <td><span class="tag ${st[1]}">${st[0]}</span></td>
        </tr>`;
      }).join('');
      body.innerHTML = `<table class="adm-table"><thead><tr><th>商品</th><th>カテゴリ</th><th>会員価格</th><th>在庫</th></tr></thead><tbody>${rows}</tbody></table>` +
        (list.length > 40 ? `<div style="text-align:center;color:var(--ink-3);font-size:12px;padding:10px">ほか ${list.length - 40} 件（検索で絞り込み）</div>` : '');
    }
    ['#prodSearch', '#prodCat', '#prodStock'].forEach(s => { const el = qs(s); if (el) el.addEventListener('input', render); });
    const csv = qs('#prodCsv');
    if (csv) csv.addEventListener('click', () => {
      const rows = [['ID', '商品名', 'ブランド', 'カテゴリ', '会員価格', '在庫']].concat(filtered().map(p => [p.id, p.name, p.brand, catName(p.cat), p.price, (STK[p.stock || 'in'] || STK.in)[0]]));
      const out = rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out], { type: 'text/csv;charset=utf-8;' }));
      a.download = '商品一覧.csv'; document.body.appendChild(a); a.click(); a.remove();
      toast('商品一覧をCSV出力しました');
    });
    render();
  }

  // 注文管理（ステータス絞り込み・出荷）
  let orderFilter = '';
  function renderOrders() {
    const body = qs('#orderAdminBody'); if (!body) return;
    const fil = qs('#orderFilters');
    if (fil && !fil.dataset.ready) {
      const chips = [['', 'すべて'], ['new', '新規'], ['prep', '準備中'], ['credit', '与信待ち'], ['shipped', '出荷済']];
      fil.innerHTML = chips.map(([k, l]) => `<button class="btn btn--ghost ofb" data-of="${k}" style="${k === orderFilter ? 'border-color:var(--gold);color:var(--gold-strong);font-weight:800' : ''}">${l}</button>`).join('');
      fil.dataset.ready = '1';
      fil.addEventListener('click', e => { const b = e.target.closest('[data-of]'); if (!b) return; orderFilter = b.dataset.of; [].forEach.call(fil.children, c => c.style.cssText = ''); b.style.cssText = 'border-color:var(--gold);color:var(--gold-strong);font-weight:800'; renderOrders(); });
    }
    const list = ORDERS.filter(o => !orderFilter || o.status === orderFilter);
    const pend = ORDERS.filter(o => o.status === 'new' || o.status === 'prep' || o.status === 'credit').length;
    qs('#orderSummary').textContent = `全${ORDERS.length}件・未出荷${pend}件・流通額 ${yen(ORDERS.reduce((a, o) => a + o.amount, 0))}`;
    body.innerHTML = `<table class="adm-table"><thead><tr><th>注文番号</th><th>サロン</th><th>日付</th><th>点数</th><th>金額</th><th>支払</th><th>状態</th><th></th></tr></thead><tbody>` +
      list.map(o => {
        const st = ORDER_ST[o.status] || ORDER_ST.new;
        const canShip = o.status !== 'shipped';
        return `<tr data-no="${o.no}">
          <td class="num">${o.no}</td><td>${o.salon}</td><td>${o.date}</td>
          <td class="num">${o.items}</td><td class="num">${yen(o.amount)}</td><td>${o.pay}</td>
          <td><span class="tag ${st[1]}">${st[0]}</span></td>
          <td>${canShip ? `<button class="btn btn--ghost" data-ship="${o.no}" style="padding:4px 10px">出荷</button>` : ''}</td>
        </tr>`;
      }).join('') + '</tbody></table>';
  }
  const _ob = qs('#orderAdminBody');
  if (_ob) _ob.addEventListener('click', e => {
    const b = e.target.closest('[data-ship]'); if (!b) return;
    const o = ORDERS.find(x => x.no === b.dataset.ship); if (!o) return;
    o.status = 'shipped'; toast(`${o.no} を出荷済みにしました`); renderOrders(); computeKpis();
  });

  // サイドバー：セクションへスクロール＋スクロールスパイで現在地ハイライト
  function setupAdminNav() {
    const links = [].slice.call(document.querySelectorAll('.adm-side a[data-jump]'));
    const targets = links.map(a => ({ a, el: qs(a.getAttribute('data-jump')) })).filter(x => x.el);
    links.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const t = qs(a.getAttribute('data-jump')); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    let raf = 0;
    window.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const y = window.scrollY + 130; let cur = targets[0];
        targets.forEach(t => { if (t.el.getBoundingClientRect().top + window.scrollY <= y) cur = t; });
        if (cur) { links.forEach(x => x.classList.remove('is-active')); cur.a.classList.add('is-active'); }
      });
    }, { passive: true });
  }

  Salon.subscribe(renderLow);
  renderReview();
  renderCredit();
  renderContractApps();
  renderSeminars();
  renderLeases();
  renderBuybacks();
  renderUsedInventory();
  renderPartners();
  renderLow();
  renderClaims();
  renderRestock();
  renderBundleConds();
  renderSalonConds();
  fillDiscForm();
  renderSalonDiscounts();
  renderAnalytics();
  setupProductAdmin();
  renderOrders();
  computeKpis();
  setupAdminNav();
})();

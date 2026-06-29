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
      const disp = d.disp != null ? d.disp : (typeof d.v === 'number' ? d.v.toLocaleString('ja-JP') : d.v);
      return `<div style="display:grid;grid-template-columns:112px 1fr 64px;align-items:center;gap:8px;font-size:12px">
        <span style="color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.label}</span>
        <span style="background:var(--surface-2);border-radius:999px;height:9px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:${d.color || 'var(--gold)'};border-radius:999px"></i></span>
        <span style="text-align:right;font-family:var(--font-num);font-weight:700;color:var(--ink)">${disp}</span>
      </div>`;
    }).join('') + '</div>';
  }

  /* =========================================================
     販売データ・インテリジェンス（菊地の財産＝取引データの分析と活用）
     ※デモ：取引履歴を擬似生成（シード固定で再現性あり）。本番は
       受発注DB（注文明細・サロンマスタ・担当者）からの集計に差し替え。
     ========================================================= */
  const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月'];
  const BIZ_LABEL = { hair: 'ヘア', eye: 'アイ', nail: 'ネイル', esthe: 'エステ' };
  const REPS = ['佐藤 達也', '鈴木 香織', '高橋 誠', '田中 裕子', '渡辺 拓海', '伊藤 麻衣'];
  const SALON_NAMES = ['SALON LUXE 表参道店', 'hair atelier MELT 中目黒', 'BARBER K 渋谷', 'Atelier NOa 自由が丘', 'Lumiere 銀座', 'hair room SOL 吉祥寺', 'CIEL 代官山', "mod's hair 新宿", 'GARDEN 青山', 'Belle 恵比寿', 'tricca 下北沢', 'ALBUM 池袋', 'nail salon Lumie 表参道', 'EYELASH BiBi 横浜', 'Total Beauty AILE 大宮', 'esthe room Sara 二子玉川', 'hair design Liv 川崎', 'BARBER STAND 五反田', 'agnes 麻布十番', 'LiNK 立川', 'of HAIR 吉祥寺', 'SHIMA 原宿', 'nail&eye Cocon 柏', 'RELAX 武蔵小杉', 'Salon de Reve 鎌倉', 'grace 横浜元町', 'Hair&Spa Anela 本厚木', 'eyelash room Lien 大宮', 'BiOTOPE 中野', 'NORA 表参道', 'LANVERY 銀座', 'Octa 池袋', 'mint nail 町田', 'Beaute 自由が丘', 'Cha Cha 渋谷', 'RITZ 横浜', 'un ami 新百合ヶ丘', 'PRIVATE SALON Rire 浦和', 'hair make EARTH 柏', 'Lano 国分寺'];

  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  const SALES = (function buildSales() {
    const prods = (SP.DATA && SP.DATA.products) || [];
    const catCnt = {}; prods.forEach(p => { if (p.cat && p.cat !== '_rec') catCnt[p.cat] = (catCnt[p.cat] || 0) + 1; });
    let cats = Object.keys(catCnt).sort((a, b) => catCnt[b] - catCnt[a]).slice(0, 8).map(id => ({ id, label: catName(id) }));
    if (!cats.length) cats = [{ id: 'all', label: '商品' }];
    const rnd = mulberry32(20260628);
    const pick = arr => arr[Math.floor(rnd() * arr.length)];
    const RANKS = [['プラチナ', 0.10, 36, 62], ['ゴールド', 0.24, 18, 34], ['シルバー', 0.40, 8, 17], ['ブロンズ', 0.26, 3, 9]];
    function pickRank() { let r = rnd(); for (let i = 0; i < RANKS.length; i++) { if (r < RANKS[i][1]) return RANKS[i]; r -= RANKS[i][1]; } return RANKS[RANKS.length - 1]; }
    const BIZW = [['hair', 0.6], ['eye', 0.15], ['nail', 0.15], ['esthe', 0.1]];
    function pickBiz() { let r = rnd(); for (let i = 0; i < BIZW.length; i++) { if (r < BIZW[i][1]) return BIZW[i][0]; r -= BIZW[i][1]; } return 'hair'; }
    function bizFor(name) { const n = name.toLowerCase(); if (n.indexOf('nail') >= 0) return 'nail'; if (n.indexOf('eye') >= 0 || n.indexOf('lash') >= 0) return 'eye'; if (n.indexOf('esthe') >= 0 || n.indexOf('spa') >= 0 || n.indexOf('beaut') >= 0) return 'esthe'; return null; }
    const salons = SALON_NAMES.map(name => {
      const rank = pickRank(), biz = bizFor(name) || pickBiz(), rep = pick(REPS);
      const base = Math.round((rank[2] + rnd() * (rank[3] - rank[2])) * 10000);
      const trend = (rnd() - 0.55) * 0.10;
      const gmv = [];
      for (let m = 0; m < 6; m++) { const noise = 0.85 + rnd() * 0.3; gmv.push(Math.max(0, Math.round(base * Math.pow(1 + trend, m) * noise))); }
      const total = gmv.reduce((a, b) => a + b, 0);
      const avg3 = Math.round((gmv[3] + gmv[4] + gmv[5]) / 3);
      const cycle = 14 + Math.floor(rnd() * 32);
      const lapseBias = trend < -0.02 ? 1.8 : (trend < 0.03 ? 1.1 : 0.7);
      const last = Math.max(1, Math.round(cycle * (0.3 + rnd() * 1.4 * lapseBias)));
      const w = cats.map(() => (rnd() < 0.25 ? 0 : 0.2 + rnd())); let wsum = w.reduce((a, b) => a + b, 0); if (wsum === 0) { w[0] = 1; wsum = 1; }
      const catAmt = {}; cats.forEach((c, ci) => { catAmt[c.id] = Math.round(total * w[ci] / wsum); });
      const mom = gmv[4] ? (gmv[5] - gmv[4]) / gmv[4] : 0;
      return { name, biz, rep, rank: rank[0], gmv, total, avg3, cycle, last, catAmt, mom, atRisk: last > cycle * 1.5, orders: Math.max(1, Math.round(total / Math.max(8000, base / 2))) };
    });
    return { salons, cats };
  })();

  function segOf(s) { if (s.last > s.cycle * 1.5) return 'churn'; if (s.avg3 >= 250000 && s.mom >= -0.02) return 'vip'; if (s.mom >= 0.03) return 'grow'; return 'stable'; }
  const SEG = { vip: ['優良', '#1f7a4d'], grow: ['育成・伸長', '#b8860b'], stable: ['安定', '#5b6470'], churn: ['離反リスク', '#c0392b'] };
  function downloadCsv(filename, rows) {
    const out = rows.map(r => r.map(v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + out], { type: 'text/csv;charset=utf-8;' }));
    a.download = filename; document.body.appendChild(a); a.click(); a.remove(); toast(filename + ' を出力しました');
  }
  const manYen = n => (n / 10000).toLocaleString('ja-JP', { maximumFractionDigits: 0 });
  const pctStr = x => (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';

  // 分析（売上ベース）：月次GMV推移＋前月比／カテゴリ別 売上／業種別／担当者別／ランク別
  function renderAnalytics() {
    const host = qs('#analyticsBody'); if (!host) return;
    const S = SALES.salons;
    const months = MONTHS.map((label, mi) => ({ label, v: Math.round(S.reduce((a, s) => a + s.gmv[mi], 0) / 10000) }));
    const mLast = months[5].v, mPrev = months[4].v; months[5].t = '今月 ' + pctStr((mLast - mPrev) / (mPrev || 1));
    const catTot = {}; SALES.cats.forEach(c => catTot[c.id] = 0); S.forEach(s => SALES.cats.forEach(c => catTot[c.id] += s.catAmt[c.id] || 0));
    const catBars = SALES.cats.map(c => ({ label: c.label, v: Math.round(catTot[c.id] / 10000) })).sort((a, b) => b.v - a.v);
    const bizTot = {}; S.forEach(s => bizTot[s.biz] = (bizTot[s.biz] || 0) + s.total);
    const bizBars = Object.keys(bizTot).map(k => ({ label: BIZ_LABEL[k] || k, v: Math.round(bizTot[k] / 10000) })).sort((a, b) => b.v - a.v);
    const repTot = {}, repCnt = {}; S.forEach(s => { repTot[s.rep] = (repTot[s.rep] || 0) + s.total; repCnt[s.rep] = (repCnt[s.rep] || 0) + 1; });
    const repBars = Object.keys(repTot).map(k => ({ label: k + '（' + repCnt[k] + '店）', v: Math.round(repTot[k] / 10000) })).sort((a, b) => b.v - a.v);
    const rkTot = {}; S.forEach(s => rkTot[s.rank] = (rkTot[s.rank] || 0) + s.total);
    const rkBars = ['プラチナ', 'ゴールド', 'シルバー', 'ブロンズ'].filter(k => rkTot[k]).map(k => ({ label: k, v: Math.round(rkTot[k] / 10000) }));
    const total6 = S.reduce((a, s) => a + s.total, 0);
    host.innerHTML = `
      <div style="display:grid;gap:20px;grid-template-columns:1fr;">
        <div>
          <div style="font-size:12.5px;font-weight:800;margin-bottom:8px">月次 流通額（GMV）推移 <span style="color:var(--ink-3);font-weight:600;font-size:11px">単位：万円・取引${S.length}サロン・デモ</span></div>
          ${vbars(months)}
          <div style="font-size:11.5px;color:var(--ink-3);margin-top:4px">6ヶ月累計 ${yen(total6)}／月平均 ${yen(Math.round(total6 / 6))}</div>
        </div>
        <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">カテゴリ別 売上 <span style="color:var(--ink-3);font-weight:600;font-size:11px">万円</span></div>${hbars(catBars)}</div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">業種別 売上 <span style="color:var(--ink-3);font-weight:600;font-size:11px">万円</span></div>${hbars(bizBars)}</div>
        </div>
        <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">担当者別 流通額 <span style="color:var(--ink-3);font-weight:600;font-size:11px">万円</span></div>${hbars(repBars)}</div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">会員ランク別 売上 <span style="color:var(--ink-3);font-weight:600;font-size:11px">万円</span></div>${hbars(rkBars)}</div>
        </div>
      </div>`;
  }

  // データ活用：離反リスク架電リスト・サロンセグメント(RFM)・再注文サイン・クロスセル・CSV出力
  function renderInsights() {
    const S = SALES.salons;
    const navB = qs('#navInsight');
    const risk = S.filter(s => s.atRisk).sort((a, b) => b.avg3 - a.avg3);
    if (navB) navB.textContent = risk.length;
    const riskMonthly = risk.reduce((a, s) => a + s.avg3, 0);
    const total6 = S.reduce((a, s) => a + s.total, 0);
    const momAvg = S.reduce((a, s) => a + s.mom, 0) / (S.length || 1);
    const segCnt = { vip: 0, grow: 0, stable: 0, churn: 0 }, segAmt = { vip: 0, grow: 0, stable: 0, churn: 0 };
    S.forEach(s => { const g = segOf(s); segCnt[g]++; segAmt[g] += s.total; });

    const sum = qs('#insightSummary');
    if (sum) {
      const tile = (l, v, d, cls) => `<div class="kpi"><div class="kpi__l">${l}</div><div class="kpi__v">${v}</div><div class="kpi__d ${cls || ''}">${d}</div></div>`;
      const segBars = Object.keys(SEG).map(k => ({ label: SEG[k][0] + '（' + segCnt[k] + '店）', v: Math.round(segAmt[k] / 10000), color: SEG[k][1], disp: manYen(segAmt[k]) }));
      sum.innerHTML =
        `<div class="adm-kpis" style="margin-bottom:14px">
          ${tile('取引サロン', S.length + '店', '担当 ' + REPS.length + '名', '')}
          ${tile('6ヶ月 流通額', yen(total6), '月平均 ' + yen(Math.round(total6 / 6)), 'up')}
          ${tile('離反リスク', risk.length + '店', '要架電', 'warn')}
          ${tile('失う恐れの月商', yen(riskMonthly), 'リスク額', 'warn')}
        </div>
        <div style="font-size:12.5px;font-weight:800;margin:6px 0 10px">サロン セグメント <span style="color:var(--ink-3);font-weight:600;font-size:11px">売上構成・万円</span></div>
        ${hbars(segBars)}
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">セグメントは 最終発注からの経過・直近月商・伸び率（MoM平均 ${pctStr(momAvg)}）から自動分類。離反リスク＝通常サイクルの1.5倍を超えて発注の無いサロン＝担当者が今すぐ動くべき先。</div>`;
    }

    const ch = qs('#insightChurn');
    if (ch) {
      const rows = risk.slice(0, 12).map(s => {
        const over = s.last > s.cycle * 2;
        return `<tr>
          <td><b>${esc(s.name)}</b><div style="font-size:11px;color:var(--ink-3)">${BIZ_LABEL[s.biz]}・${s.rank}</div></td>
          <td>${esc(s.rep)}</td>
          <td class="num" style="color:${over ? '#c0392b' : 'var(--ink)'};font-weight:800">${s.last}日前${over ? ' ⚠' : ''}</td>
          <td class="num" style="color:var(--ink-3)">通常${s.cycle}日</td>
          <td class="num">${yen(s.avg3)}<div style="font-size:10.5px;color:var(--ink-3)">/月</div></td>
          <td><button class="btn btn--ghost" data-call="${esc(s.name)}" style="height:34px;padding:0 12px">架電予定</button></td>
        </tr>`;
      }).join('');
      ch.innerHTML = risk.length
        ? `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>担当</th><th>最終発注</th><th>サイクル</th><th>直近月商</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
           ${risk.length > 12 ? `<div style="text-align:center;color:var(--ink-3);font-size:12px;padding:8px">ほか ${risk.length - 12} 店（CSVに全件出力）</div>` : ''}`
        : '<div style="padding:18px;text-align:center;color:var(--ink-3)">離反リスクのサロンはありません 🎉</div>';
    }

    const nx = qs('#insightNext');
    if (nx) {
      const due = S.filter(s => !s.atRisk && s.last >= s.cycle * 0.85).sort((a, b) => b.avg3 - a.avg3).slice(0, 8);
      const topCatOf = s => { let best = '—', bv = -1; SALES.cats.forEach(c => { if ((s.catAmt[c.id] || 0) > bv) { bv = s.catAmt[c.id] || 0; best = c.label; } }); return best; };
      const dueRows = due.map(s => `<tr><td><b>${esc(s.name)}</b><div style="font-size:11px;color:var(--ink-3)">${esc(s.rep)}</div></td><td class="num">${s.last}/${s.cycle}日</td><td>${esc(topCatOf(s))}</td></tr>`).join('');
      const big = SALES.cats.slice(0).sort((a, b) => S.reduce((x, s) => x + (s.catAmt[b.id] || 0), 0) - S.reduce((x, s) => x + (s.catAmt[a.id] || 0), 0));
      const cross = [];
      S.forEach(s => { for (let i = 0; i < Math.min(3, big.length); i++) { if (!(s.catAmt[big[i].id] > 0) && s.avg3 > 60000) { cross.push({ s, c: big[i].label }); break; } } });
      cross.sort((a, b) => b.s.avg3 - a.s.avg3);
      const crossRows = cross.slice(0, 8).map(x => `<tr><td><b>${esc(x.s.name)}</b><div style="font-size:11px;color:var(--ink-3)">${esc(x.s.rep)}</div></td><td>${esc(x.c)}</td></tr>`).join('');
      nx.innerHTML = `
        <div class="ins-2col" style="display:grid;gap:18px;grid-template-columns:1fr 1fr">
          <div>
            <div style="font-size:12.5px;font-weight:800;margin-bottom:8px">再注文サイン <span style="color:var(--ink-3);font-weight:600;font-size:11px">そろそろ発注（経過/サイクル）</span></div>
            ${due.length ? `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>経過</th><th>主力カテゴリ</th></tr></thead><tbody>${dueRows}</tbody></table></div>` : '<div style="color:var(--ink-3);font-size:12px;padding:8px">該当なし</div>'}
          </div>
          <div>
            <div style="font-size:12.5px;font-weight:800;margin-bottom:8px">クロスセル余地 <span style="color:var(--ink-3);font-weight:600;font-size:11px">主力なのに未購入</span></div>
            ${cross.length ? `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>提案カテゴリ</th></tr></thead><tbody>${crossRows}</tbody></table></div>` : '<div style="color:var(--ink-3);font-size:12px;padding:8px">該当なし</div>'}
          </div>
        </div>`;
    }

    const sl = qs('#insightSalons');
    if (sl) {
      const all = S.slice(0).sort((a, b) => b.total - a.total);
      const rows = all.slice(0, 20).map(s => {
        const g = segOf(s);
        return `<tr>
          <td><b>${esc(s.name)}</b></td><td>${BIZ_LABEL[s.biz]}</td><td>${esc(s.rep)}</td><td>${s.rank}</td>
          <td><span class="tag" style="background:${SEG[g][1]}1a;color:${SEG[g][1]}">${SEG[g][0]}</span></td>
          <td class="num">${yen(s.total)}</td>
          <td class="num" style="color:${s.mom >= 0 ? '#1f7a4d' : '#c0392b'};font-weight:800">${pctStr(s.mom)}</td>
          <td class="num">${s.last}日前</td>
        </tr>`;
      }).join('');
      sl.innerHTML = `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>業種</th><th>担当</th><th>ランク</th><th>セグメント</th><th>6ヶ月売上</th><th>MoM</th><th>最終発注</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div style="text-align:center;color:var(--ink-3);font-size:12px;padding:8px">上位20店を表示・全${all.length}店はCSVに出力</div>`;
    }

    document.querySelectorAll('[data-call]').forEach(b => { b.addEventListener('click', () => { b.textContent = '架電予定 ✓'; b.style.cssText = 'height:34px;padding:0 12px;border-color:#1f7a4d;color:#1f7a4d;font-weight:800'; toast(b.dataset.call + ' を架電予定に追加しました'); }); });
    const cC = qs('#csvChurn'); if (cC) cC.addEventListener('click', () => downloadCsv('離反リスク_架電リスト.csv', [['サロン', '担当', '業種', 'ランク', '最終発注(日前)', '通常サイクル(日)', '直近3ヶ月平均月商', '6ヶ月売上', 'MoM']].concat(risk.map(s => [s.name, s.rep, BIZ_LABEL[s.biz], s.rank, s.last, s.cycle, s.avg3, s.total, Math.round(s.mom * 100) + '%']))));
    const cS = qs('#csvSalons'); if (cS) cS.addEventListener('click', () => downloadCsv('サロン別_売上分析.csv', [['サロン', '業種', '担当', 'ランク', 'セグメント', '6ヶ月売上', '直近3ヶ月平均月商', 'MoM', '最終発注(日前)', '通常サイクル(日)', '発注回数']].concat(S.slice(0).sort((a, b) => b.total - a.total).map(s => [s.name, BIZ_LABEL[s.biz], s.rep, s.rank, SEG[segOf(s)][0], s.total, s.avg3, Math.round(s.mom * 100) + '%', s.last, s.cycle, s.orders]))));
  }

  /* ===== サイト分析（流入・検索・動線）：菊地の財産＝行動データ。
     デモ集計＋この端末の実計測(SP.Track)をマージ。本番は解析基盤/サーバー集計に差替。 ===== */
  function siteSeed() {
    return {
      visits: 5240,
      sources: [
        { source: 'Instagram', n: 182, color: '#c13584' },
        { source: 'Google 検索', n: 104, color: '#4285f4' },
        { source: '紹介コード（担当者）', n: 86, color: '#b8860b' },
        { source: '直接 / ブックマーク', n: 58, color: '#5b6470' },
        { source: 'セミナー / 展示会', n: 26, color: '#2f7a4d' },
        { source: 'LINE', n: 18, color: '#06c755' },
        { source: 'X / Twitter', n: 12, color: '#1d9bf0' },
      ],
      searches: [
        { q: 'イルミナ', n: 142 }, { q: 'オキシ 6%', n: 128 }, { q: '縮毛矯正剤', n: 96 },
        { q: 'エルジューダ', n: 88 }, { q: 'アディクシー', n: 78 }, { q: 'カラーバター', n: 74 },
        { q: 'マテリア', n: 63 }, { q: 'ブリーチ', n: 60 }, { q: 'パーマ液', n: 52 },
        { q: 'N. シャンプー', n: 48 }, { q: 'ピース ワックス', n: 44 }, { q: 'イゴラ', n: 38 },
        { q: '過水', n: 33 }, { q: 'トリートメント 業務用', n: 29 },
      ],
      zero: [
        { q: 'デミ ウェーボ ドゥ', n: 14 }, { q: 'ロレアル イノア スプリーム', n: 11 },
        { q: 'ジェミール ヒートグロス 詰替', n: 9 }, { q: 'ナンバースリー ミュリアム', n: 8 },
        { q: '資生堂 クリスタリア', n: 7 }, { q: 'ベルジュバンス', n: 6 },
      ],
      funnel: [
        { step: '訪問', n: 5240 }, { step: '検索・カテゴリ閲覧', n: 3120 }, { step: '商品詳細', n: 1860 },
        { step: 'カート投入', n: 720 }, { step: '会員申請', n: 486 }, { step: '審査承認', n: 402 },
      ],
      entries: [
        { page: 'top.html（公開トップ）', n: 1840 }, { page: 'home.html', n: 1520 },
        { page: 'product.html（商品詳細）', n: 980 }, { page: 'campaigns.html', n: 410 },
        { page: 'index.html（探す）', n: 290 }, { page: 'seminar.html', n: 200 },
      ],
      device: { mobile: 78, desktop: 22 },
    };
  }
  function funnelHtml(steps) {
    const top = steps[0].n || 1;
    return '<div style="display:grid;gap:8px">' + steps.map(function (s, i) {
      const pct = Math.max(4, Math.round(s.n / top * 100));
      const conv = i > 0 ? Math.round(s.n / (steps[i - 1].n || 1) * 100) : 100;
      return `<div style="display:grid;grid-template-columns:128px 1fr 104px;align-items:center;gap:10px;font-size:12px">
        <span style="color:var(--ink-2);font-weight:700">${esc(s.step)}</span>
        <span style="background:var(--surface-2);border-radius:6px;height:24px;overflow:hidden"><i style="display:block;height:100%;width:${pct}%;background:var(--gold);border-radius:6px"></i></span>
        <span style="text-align:right;font-family:var(--font-num);font-weight:800">${s.n.toLocaleString('ja-JP')}${i > 0 ? ` <span style="color:var(--ink-3);font-weight:600;font-size:11px">${conv}%</span>` : ''}</span>
      </div>`;
    }).join('') + '</div>';
  }
  function renderSiteAnalytics() {
    const S = siteSeed();
    // この端末の実計測（SP.Track）をマージ＝ヒアリング中の実検索・実申請がそのまま乗る
    const ev = (window.SP && SP.Track) ? SP.Track.events() : [];
    const liveAttr = (window.SP && SP.Track) ? SP.Track.attr() : null;
    let liveSearch = 0, liveReg = 0;
    ev.forEach(function (e) {
      if (e.t === 'search' && e.q) {
        liveSearch++;
        const bucket = (e.n === 0) ? S.zero : S.searches;
        const hit = bucket.find(function (x) { return x.q === e.q; });
        if (hit) { hit.n += 1; hit.live = true; } else bucket.push({ q: e.q, n: (e.n === 0 ? 1 : 1), live: true });
      } else if (e.t === 'register') {
        liveReg++;
        const src = e.source || '直接';
        const hit = S.sources.find(function (x) { return x.source === src || x.source.indexOf(src) === 0; });
        if (hit) { hit.n += 1; hit.live = true; } else S.sources.push({ source: src, n: 1, color: '#c0392b', live: true });
      }
    });
    S.sources.sort(function (a, b) { return b.n - a.n; });
    S.searches.sort(function (a, b) { return b.n - a.n; });
    const totalReg = S.funnel[4].n, totalApprove = S.funnel[5].n;
    const cvr = Math.round(totalReg / (S.visits || 1) * 1000) / 10;
    const topSrc = S.sources[0];

    // --- サマリー ---
    const sum = qs('#siteSummary');
    if (sum) {
      const tile = (l, v, d, cls) => `<div class="kpi"><div class="kpi__l">${l}</div><div class="kpi__v">${v}</div><div class="kpi__d ${cls || ''}">${d}</div></div>`;
      const dev = S.device;
      sum.innerHTML =
        `<div class="adm-kpis" style="margin-bottom:14px">
          ${tile('訪問（30日）', S.visits.toLocaleString('ja-JP'), 'デモ集計', '')}
          ${tile('会員申請', totalReg.toLocaleString('ja-JP') + '件', '承認 ' + totalApprove + '件', 'up')}
          ${tile('訪問→申請 CVR', cvr + '%', '業界比 良好', 'up')}
          ${tile('最多の流入元', topSrc.source, Math.round(topSrc.n / S.sources.reduce((a, s) => a + s.n, 0) * 100) + '%', '')}
        </div>
        <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">入口ページ <span style="color:var(--ink-3);font-weight:600;font-size:11px">最初に見たページ</span></div>
            ${hbars(S.entries.map(e => ({ label: e.page, v: e.n })))}</div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">デバイス</div>
            ${hbars([{ label: 'モバイル', v: dev.mobile, disp: dev.mobile + '%' }, { label: 'PC', v: dev.desktop, disp: dev.desktop + '%' }])}
            <div style="font-size:11.5px;color:var(--ink-3);margin-top:10px">${(window.SP && SP.Track) ? 'この端末の実計測：検索 ' + liveSearch + ' 件 / 申請 ' + liveReg + ' 件を下のログに記録中。' : ''}</div>
          </div>
        </div>`;
    }

    // --- 会員申請の流入元（最重要の問い：どこから申請したか） ---
    const src = qs('#siteSources');
    if (src) {
      const tot = S.sources.reduce((a, s) => a + s.n, 0);
      const bars = S.sources.map(s => ({ label: s.source + (s.live ? ' ●' : ''), v: s.n, color: s.color || '#5b6470', disp: s.n + '（' + Math.round(s.n / tot * 100) + '%）' }));
      src.innerHTML = hbars(bars) +
        `<div style="font-size:11.5px;color:var(--ink-3);margin-top:10px">会員申請が「どこから来たか」をファーストタッチで集計（UTM＞紹介コード＞リファラ＞直接）。<b>●＝この端末の実計測</b>。流入元別に獲得施策の費用対効果が分かります。</div>`;
    }

    // --- 行動ファネル ---
    const fn = qs('#siteFunnel');
    if (fn) fn.innerHTML = funnelHtml(S.funnel) +
      `<div style="font-size:11.5px;color:var(--ink-3);margin-top:10px">右の％は前段からの遷移率。離脱が大きい段（例：商品詳細→カート）が改善の打ち所です。</div>`;

    // --- 検索ワード／0件ヒット ---
    const sc = qs('#siteSearch');
    if (sc) {
      sc.innerHTML = `
        <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">検索ワード TOP <span style="color:var(--ink-3);font-weight:600;font-size:11px">需要シグナル</span></div>
            ${hbars(S.searches.slice(0, 12).map(s => ({ label: s.q + (s.live ? ' ●' : ''), v: s.n })))}</div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">0件ヒット検索 <span style="color:#c0392b;font-weight:700;font-size:11px">取りこぼし＝仕入れ機会</span></div>
            <table class="adm-table"><thead><tr><th>検索ワード</th><th>回数</th></tr></thead><tbody>${S.zero.sort((a, b) => b.n - a.n).slice(0, 10).map(z => `<tr><td>${esc(z.q)}${z.live ? ' <span style="color:#c0392b">●</span>' : ''}</td><td class="num">${z.n}</td></tr>`).join('')}</tbody></table>
            <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">0件＝サロンが欲しいのに無い商品。取扱い追加・代替提案の判断材料に。</div>
          </div>
        </div>`;
    }

    // --- 実計測ログ（この端末・ライブ） ---
    const lv = qs('#siteLive');
    if (lv) {
      const recent = ev.slice(-16).reverse();
      const fmtT = ms => { try { const d = new Date(ms); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); } catch (e) { return ''; } };
      const TY = { view: ['閲覧', 'tag--new'], search: ['検索', 'tag--prep'], register: ['会員申請', 'tag--shipped'], product_view: ['商品閲覧', 'tag--new'], add_cart: ['カート投入', 'tag--prep'], color_pick: ['カラー選択', 'tag--mute'], brand_view: ['ライン閲覧', 'tag--mute'] };
      const attrLine = liveAttr
        ? `<div style="font-size:12px;color:var(--ink-2);margin-bottom:10px">この端末の流入元：<b>${esc(liveAttr.source)}</b>（${esc(liveAttr.medium || '')}${liveAttr.campaign ? ' / ' + esc(liveAttr.campaign) : ''}）・入口 <b>${esc(liveAttr.landing || '')}</b>・${esc(liveAttr.device || '')}</div>`
        : '<div style="font-size:12px;color:var(--ink-3);margin-bottom:10px">計測データはまだありません。</div>';
      lv.innerHTML = attrLine + (recent.length
        ? `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>時刻</th><th>種別</th><th>内容</th><th>ページ</th></tr></thead><tbody>${recent.map(e => {
          const ty = TY[e.t] || [e.t, 'tag--mute'];
          const detail = e.t === 'search' ? `「${esc(e.q || '')}」→ ${e.n != null ? e.n + '件' : ''}`
            : e.t === 'register' ? '流入元 ' + esc(e.source || '')
            : (e.t === 'product_view' || e.t === 'add_cart') ? esc((e.maker || '') + (e.line ? ' / ' + e.line : ''))
            : e.t === 'color_pick' ? esc((e.line || '') + ' ' + (e.family || ''))
            : (e.ref ? '← ' + esc(e.ref) : '');
          return `<tr><td class="num" style="color:var(--ink-3)">${fmtT(e.at)}</td><td><span class="tag ${ty[1]}">${ty[0]}</span></td><td>${detail}</td><td style="font-size:11px;color:var(--ink-3)">${esc(e.page || '')}</td></tr>`;
        }).join('')}</tbody></table></div>`
        : '<div style="padding:14px;text-align:center;color:var(--ink-3)">この端末ではまだ操作ログがありません。サイトで検索・会員申請するとここに表示されます。</div>');
    }

    // --- ボタン配線（CSV） ---
    const cSrc = qs('#csvSources'); if (cSrc) cSrc.onclick = () => downloadCsv('会員申請_流入元.csv', [['流入元', '申請数', '構成比']].concat(S.sources.map(s => { const tot = S.sources.reduce((a, x) => a + x.n, 0); return [s.source, s.n, Math.round(s.n / tot * 100) + '%']; })));
    const cSe = qs('#csvSearch'); if (cSe) cSe.onclick = () => downloadCsv('検索ワード.csv', [['検索ワード', '回数', '種別']].concat(S.searches.map(s => [s.q, s.n, 'ヒット'])).concat(S.zero.map(z => [z.q, z.n, '0件ヒット'])));
  }

  /* ===== メーカー/ブランド分析（メーカーが欲しい：競合横断シェア・検索需要・転換・番手別需要）
     菊地の財産＝メーカーへ提供／販売できるデータ。カタログ実体＋seededパフォーマンス＋実計測マージ。 ===== */
  const L2M = {
    'ニゼル': 'ミルボン', 'エルジューダ': 'ミルボン', 'オージュア': 'ミルボン', 'グローバルミルボン': 'ミルボン', 'プラーミア': 'ミルボン', 'ディーセス': 'ミルボン', 'ジェミールフラン': 'ミルボン', 'リンケージミュー': 'ミルボン', 'アディクシー': 'ミルボン', 'オルディーブ': 'ミルボン', 'オルディーブ ボーテ': 'ミルボン',
    'トリエ': 'ルベル', 'ジオ': 'ルベル', 'イオ': 'ルベル', 'マテリア': 'ルベル', 'マテリアG': 'ルベル', 'プロエディット': 'ルベル',
    'イルミナカラー': 'ウエラ', 'コレストンパーフェクト': 'ウエラ', 'EIMI': 'ウエラ', 'ウエラプレックス': 'ウエラ', 'SP': 'ウエラ',
    'イノア': 'ロレアル', 'マジレル': 'ロレアル', 'セリエ エキスパート': 'ロレアル', 'テクニアート': 'ロレアル', 'スマートボンド': 'ロレアル',
    'イゴラ ロイヤル': 'シュワルツコフ', 'OSiS+': 'シュワルツコフ', 'BCボナキュア': 'シュワルツコフ', 'ファイバープレックス': 'シュワルツコフ',
    'アドミオ': 'アリミノ', 'ピース': 'アリミノ',
    'プロマスターEX': 'ホーユー', 'プロマスターEX グレイ': 'ホーユー', 'アプリエ': 'ホーユー', 'プロマスター': 'ホーユー',
    // 表記ゆれ・同一企業の統合
    'ウエラプロフェッショナル': 'ウエラ', 'ウェラ': 'ウエラ', 'グローバルミルボン': 'ミルボン', '資生堂': '資生堂プロフェッショナル',
  };
  function buildMakerData() {
    const P = (SP.DATA && SP.DATA.products) || [];
    const makerOf = p => { const m = p.maker || p.brand; return L2M[m] || m; };
    const rnd = mulberry32(20260630);
    const M = {};
    P.forEach(p => {
      if (p.cat === '_rec') return;
      const m = makerOf(p); if (!m) return;
      const e = M[m] || (M[m] = { maker: m, sku: 0, lines: {}, cats: {}, shades: {} });
      e.sku++;
      const ln = p.line || p.brand; e.lines[ln] = (e.lines[ln] || 0) + 1;
      e.cats[p.cat] = (e.cats[p.cat] || 0) + 1;
      if (p.cat === 'color' && p.family && p.level) { const k = (p.line || p.brand) + ' ' + p.family + ' ' + p.level; e.shades[k] = Math.round(18 + rnd() * 170); }
    });
    const makers = Object.keys(M).map(m => {
      const e = M[m], sku = e.sku;
      const gmv = Math.round(sku * (7000 + rnd() * 9000));
      const search = Math.round(sku * 0.9 + rnd() * 130);
      const views = Math.round(gmv / (900 + rnd() * 700));
      const carts = Math.round(views * (0.16 + rnd() * 0.12));
      const buys = Math.round(carts * (0.42 + rnd() * 0.22));
      const salons = Math.min(40, 5 + Math.round(rnd() * 32));
      const mom = Math.round((rnd() - 0.45) * 24) / 100;
      return { maker: m, sku: sku, lines: e.lines, cats: e.cats, shades: e.shades, gmv: gmv, search: search, views: views, carts: carts, buys: buys, salons: salons, mom: mom };
    }).sort((a, b) => b.gmv - a.gmv);
    // 実計測（この端末）をマージ：閲覧/カート/検索/番手選択
    const ev = (window.SP && SP.Track) ? SP.Track.events() : [];
    const findM = name => name ? (makers.find(x => x.maker === name) || makers.find(x => name.indexOf(x.maker) >= 0)) : null;
    ev.forEach(e => {
      if (e.t === 'product_view') { const m = findM(e.maker); if (m) { m.views += 1; m.live = true; } }
      else if (e.t === 'add_cart') { const m = findM(e.maker); if (m) { m.carts += 1; m.buys += 0; m.live = true; } }
      else if (e.t === 'search' && e.q) { makers.forEach(m => { if (e.q.indexOf(m.maker) >= 0) { m.search += 1; m.live = true; } }); }
      else if (e.t === 'color_pick' && e.line) { const m = findM(L2M[e.line] || e.line); if (m) { const k = e.line + ' ' + (e.family || ''); m.shades[k] = (m.shades[k] || 0) + 40; m.live = true; } }
    });
    return makers;
  }
  let _makerSel = null;
  function drawMakerDetail(makers) {
    const host = qs('#makerDetail'); if (!host) return;
    const m = makers.find(x => x.maker === _makerSel) || makers[0]; if (!m) return;
    const lineBars = Object.keys(m.lines).map(l => ({ label: l, v: m.lines[l] })).sort((a, b) => b.v - a.v).slice(0, 10);
    const catBars = Object.keys(m.cats).map(c => ({ label: catName(c), v: m.cats[c] })).sort((a, b) => b.v - a.v).slice(0, 8);
    const shadeRows = Object.keys(m.shades).map(k => ({ k: k, v: m.shades[k] })).sort((a, b) => b.v - a.v).slice(0, 8);
    const cvrVC = m.views ? Math.round(m.carts / m.views * 100) : 0, cvrCB = m.carts ? Math.round(m.buys / m.carts * 100) : 0;
    host.innerHTML = `
      <div class="adm-kpis" style="margin-bottom:14px">
        <div class="kpi"><div class="kpi__l">6ヶ月流通額</div><div class="kpi__v">${yen(m.gmv)}</div><div class="kpi__d ${m.mom >= 0 ? 'up' : 'warn'}">MoM ${(m.mom >= 0 ? '+' : '') + Math.round(m.mom * 100)}%</div></div>
        <div class="kpi"><div class="kpi__l">取扱SKU</div><div class="kpi__v">${m.sku}</div><div class="kpi__d">${Object.keys(m.lines).length}ライン</div></div>
        <div class="kpi"><div class="kpi__l">導入サロン</div><div class="kpi__v">${m.salons}店</div><div class="kpi__d">検索 ${m.search}回</div></div>
        <div class="kpi"><div class="kpi__l">閲覧→カート→購入</div><div class="kpi__v">${cvrVC}% · ${cvrCB}%</div><div class="kpi__d">閲覧${m.views}/カート${m.carts}/購入${m.buys}</div></div>
      </div>
      <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
        <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">ライン別 取扱（SKU）</div>${hbars(lineBars)}</div>
        <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">カテゴリ構成（SKU）</div>${hbars(catBars)}</div>
      </div>
      ${shadeRows.length ? `<div style="margin-top:16px"><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">人気カラー番手 TOP <span style="color:var(--ink-3);font-weight:600;font-size:11px">需要指数・生産/在庫計画の指標</span></div><table class="adm-table"><thead><tr><th>ライン・色・明るさ</th><th>需要指数</th></tr></thead><tbody>${shadeRows.map(s => `<tr><td>${esc(s.k)}</td><td class="num">${s.v}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    const csv = qs('#csvMaker');
    if (csv) csv.onclick = () => {
      const rows = [['メーカーレポート', m.maker], ['取扱SKU', m.sku], ['6ヶ月流通額', m.gmv], ['導入サロン', m.salons], ['検索数', m.search], ['閲覧', m.views], ['カート', m.carts], ['購入', m.buys], ['MoM', Math.round(m.mom * 100) + '%'], [], ['ライン', 'SKU']]
        .concat(Object.keys(m.lines).sort((a, b) => m.lines[b] - m.lines[a]).map(l => [l, m.lines[l]]))
        .concat([[], ['カラー番手', '需要指数']]).concat(Object.keys(m.shades).sort((a, b) => m.shades[b] - m.shades[a]).slice(0, 40).map(k => [k, m.shades[k]]));
      downloadCsv('メーカーレポート_' + m.maker + '.csv', rows);
    };
  }
  function renderMakerAnalytics() {
    const makers = buildMakerData();
    if (!makers.length) return;
    const totGmv = makers.reduce((a, m) => a + m.gmv, 0) || 1;
    const sumEl = qs('#makerSummary');
    if (sumEl) {
      const rows = makers.slice(0, 14).map(m => {
        const cvr = m.views ? Math.round(m.buys / m.views * 1000) / 10 : 0;
        return `<tr>
          <td><b>${esc(m.maker)}</b>${m.live ? ' <span style="color:#1f7a4d">●</span>' : ''}</td>
          <td class="num">${m.sku.toLocaleString('ja-JP')}</td>
          <td class="num">${yen(m.gmv)}</td>
          <td class="num"><b>${Math.round(m.gmv / totGmv * 100)}%</b></td>
          <td class="num">${m.search.toLocaleString('ja-JP')}</td>
          <td class="num">${m.salons}</td>
          <td class="num">${cvr}%</td>
          <td class="num" style="color:${m.mom >= 0 ? '#1f7a4d' : '#c0392b'};font-weight:800">${(m.mom >= 0 ? '+' : '') + Math.round(m.mom * 100)}%</td>
        </tr>`;
      }).join('');
      sumEl.innerHTML = `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>メーカー</th><th>取扱SKU</th><th>6ヶ月流通額</th><th>シェア</th><th>検索</th><th>導入サロン</th><th>閲覧→購入</th><th>MoM</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">各メーカーが自社では取れない<b>競合横断のシェア・検索需要・転換率・導入サロン数</b>を1画面で。メーカーへ提供／販売できるデータの母体です。●＝この端末の実計測。</div>`;
    }
    const sel = qs('#makerSelect');
    if (sel && !sel.dataset.ready) {
      sel.innerHTML = makers.map(m => `<option value="${esc(m.maker)}">${esc(m.maker)}（SKU ${m.sku}）</option>`).join('');
      sel.dataset.ready = '1';
      sel.addEventListener('change', () => { _makerSel = sel.value; drawMakerDetail(makers); });
    }
    _makerSel = _makerSel || (makers[0] && makers[0].maker);
    if (sel && _makerSel) sel.value = _makerSel;
    drawMakerDetail(makers);
    const cross = qs('#makerCross');
    if (cross) {
      const bySearch = makers.slice().sort((a, b) => b.search - a.search).slice(0, 10).map(m => ({ label: m.maker + (m.live ? ' ●' : ''), v: m.search }));
      const allShades = {};
      makers.forEach(m => Object.keys(m.shades).forEach(k => { allShades[k] = Math.max(allShades[k] || 0, m.shades[k]); }));
      const shadeBars = Object.keys(allShades).map(k => ({ k: k, v: allShades[k] })).sort((a, b) => b.v - a.v).slice(0, 12);
      cross.innerHTML = `
        <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">検索需要シェア（メーカー別・回）</div>${hbars(bySearch)}</div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">人気カラー番手 横断 TOP <span style="color:var(--ink-3);font-weight:600;font-size:11px">生産・在庫計画</span></div>
            <table class="adm-table"><thead><tr><th>ライン・色・明るさ</th><th>需要指数</th></tr></thead><tbody>${shadeBars.map(s => `<tr><td>${esc(s.k)}</td><td class="num">${s.v}</td></tr>`).join('')}</tbody></table></div>
        </div>`;
    }
  }

  /* ===== 薬剤ミックス分析（サロン/美容師ごとのカラー・パーマ・矯正・Tr・ブリーチ比率）
     比率→営業の打ち手・今の兆候・セミナー×メーカー誘致に落とす。 ===== */
  const RX = ['カラー', 'パーマ', '縮毛矯正', 'トリートメント', 'ブリーチ'];
  const RX_COLORS = ['#c0392b', '#8e44ad', '#2f7a4d', '#2f6f8c', '#caa64a'];
  const RX_SEM = [
    { sem: '最新カラーデザイン＆薬剤運用', maker: 'ミルボン（アディクシー）' },
    { sem: 'デザインパーマ実技', maker: 'アリミノ（コスメカール）' },
    { sem: '弱酸性ストレート／縮毛矯正', maker: 'ミルボン（リシオ）' },
    { sem: 'サロンTrのメニュー化・物販', maker: 'ミルボン（リンケージミュー）／TOKIO' },
    { sem: 'ケアブリーチ＆ハイトーン', maker: 'シュワルツコフ（ファイバープレックス）' },
  ];
  const RX_SIGNAL = ['新色・ハイトーン需要→カラーライン提案', 'パーマ回帰の兆候→デジパー機器・薬剤提案', '梅雨/夏の矯正需要→ストレート剤・セミナー', 'Tr・店販強化志向→上位Trライン提案', 'ハイトーン化→ケアブリーチ/ボンド剤提案'];
  function fixTo100(mix) { const d = 100 - mix.reduce((a, b) => a + b, 0); const i = mix.indexOf(Math.max.apply(null, mix)); mix[i] += d; return mix; }
  function buildRxData() {
    const rnd = mulberry32(20260701);
    const ARCH = [
      { name: 'カラー特化', w: [62, 8, 6, 14, 10] },
      { name: '縮毛矯正・パーマ強', w: [34, 20, 30, 10, 6] },
      { name: 'バランス型', w: [44, 16, 14, 16, 10] },
      { name: 'トリートメント強', w: [40, 10, 10, 32, 8] },
      { name: 'ハイトーン・ブリーチ強', w: [40, 6, 6, 12, 36] },
    ];
    const FIRST = ['佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤', '山本', '吉田', '松本'];
    const ROLE = ['ディレクター', 'トップスタイリスト', 'スタイリスト', 'スタイリスト', 'ジュニア'];
    const src = (SALES.salons || []).filter(s => s.biz === 'hair' || s.biz === 'eye');
    const salons = src.map((s, si) => {
      const arch = ARCH[Math.floor(rnd() * ARCH.length)];
      let w = arch.w.map(x => Math.max(2, x + (rnd() - 0.5) * 14));
      const sum = w.reduce((a, b) => a + b, 0);
      const mix = fixTo100(w.map(x => Math.round(x / sum * 100)));
      const rxTotal = Math.round(s.total * (0.45 + rnd() * 0.25));
      const amounts = mix.map(p => Math.round(rxTotal * p / 100));
      const trend = RX.map(() => Math.round((rnd() - 0.5) * 16));
      const nSt = 2 + Math.floor(rnd() * 4);
      const stylists = [];
      for (let k = 0; k < nSt; k++) {
        let sw = mix.map(x => Math.max(1, x + (rnd() - 0.5) * 34));
        const ss = sw.reduce((a, b) => a + b, 0);
        const sm = fixTo100(sw.map(x => Math.round(x / ss * 100)));
        stylists.push({ name: FIRST[(si * 3 + k) % FIRST.length] + ' ' + ROLE[Math.min(ROLE.length - 1, k)], mix: sm, share: Math.round((0.5 + rnd()) * 100) / 100 });
      }
      return { name: s.name, rep: s.rep, rank: s.rank, arch: arch.name, mix: mix, amounts: amounts, rxTotal: rxTotal, trend: trend, stylists: stylists };
    });
    return { RX: RX, salons: salons };
  }
  function rxAction(m) {
    if (m[1] < 6 && m[2] < 8) return ['パーマ・矯正が手薄', 'パーマ/縮毛矯正メニューの導入提案（客単価UP）'];
    if (m[0] >= 55 && m[3] < 14) return ['カラー偏重', 'システムTr・店販クロスセルで単価UP'];
    if (m[4] >= 22) return ['ハイトーン強', 'ケアブリーチ／ボンド剤（プレックス系）の提案'];
    if (m[2] >= 24) return ['縮毛矯正が主力', '矯正剤の銘柄切替・技術セミナー誘致'];
    if (m[3] >= 28) return ['トリートメント強', '上位Trライン・物販強化の提案'];
    return ['バランス型', '新カラーライン（アディクシー/イルミナ）の試験導入'];
  }
  function stackBar(mix) {
    return '<span style="display:flex;height:16px;border-radius:4px;overflow:hidden;min-width:130px;border:1px solid var(--line)">' +
      mix.map((p, i) => p > 0 ? `<i style="width:${p}%;background:${RX_COLORS[i]}" title="${RX[i]} ${p}%"></i>` : '').join('') + '</span>';
  }
  function rxLegend() {
    return '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--ink-2);margin:2px 0 12px">' +
      RX.map((r, i) => `<span style="display:inline-flex;align-items:center;gap:5px"><i style="width:11px;height:11px;border-radius:2px;background:${RX_COLORS[i]};display:inline-block"></i>${r}</span>`).join('') + '</div>';
  }
  let _rxSalonSel = null;
  function drawRxStylists(D) {
    const host = qs('#rxStylists'); if (!host) return;
    const s = D.salons.find(x => x.name === _rxSalonSel) || D.salons[0]; if (!s) return;
    const rows = s.stylists.map(st => `<tr>
      <td><b>${esc(st.name)}</b></td>
      <td style="min-width:140px">${stackBar(st.mix)}</td>
      ${st.mix.map(p => `<td class="num">${p}%</td>`).join('')}
    </tr>`).join('');
    host.innerHTML = `<div style="font-size:12px;color:var(--ink-2);margin-bottom:8px">${esc(s.name)} ／ 担当 ${esc(s.rep)} ／ タイプ <b>${esc(s.arch)}</b>（美容師 ${s.stylists.length}名）</div>
      <div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>美容師</th><th>薬剤比率</th>${RX.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
      <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">美容師ごとの得意領域が分かる＝指名・教育・サンプル配布の設計に。例：矯正比率が高い美容師に矯正剤の新銘柄を試してもらう。</div>`;
  }
  function renderRxAnalytics() {
    const D = buildRxData();
    if (!D.salons.length) return;
    // --- サマリー（全体構成） ---
    const tot = RX.map((_, i) => D.salons.reduce((a, s) => a + s.amounts[i], 0));
    const totSum = tot.reduce((a, b) => a + b, 0) || 1;
    const stylistN = D.salons.reduce((a, s) => a + s.stylists.length, 0);
    const avgColor = Math.round(D.salons.reduce((a, s) => a + s.mix[0], 0) / D.salons.length);
    const maxI = tot.indexOf(Math.max.apply(null, tot));
    const sum = qs('#rxSummary');
    if (sum) {
      const tile = (l, v, d, cls) => `<div class="kpi"><div class="kpi__l">${l}</div><div class="kpi__v">${v}</div><div class="kpi__d ${cls || ''}">${d}</div></div>`;
      sum.innerHTML = `<div class="adm-kpis" style="margin-bottom:14px">
          ${tile('対象サロン', D.salons.length + '店', 'ヘア／アイ', '')}
          ${tile('美容師', stylistN + '名', '個人別の比率も', '')}
          ${tile('最多の薬剤', RX[maxI], Math.round(tot[maxI] / totSum * 100) + '%', '')}
          ${tile('平均カラー比率', avgColor + '%', '薬剤に占める', '')}
        </div>
        <div style="font-size:12.5px;font-weight:800;margin:4px 0 8px">全体の薬剤構成 <span style="color:var(--ink-3);font-weight:600;font-size:11px">流通額ベース</span></div>
        ${rxLegend()}
        ${stackBar(fixTo100(tot.map(v => Math.round(v / totSum * 100))))}
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:10px">サロン／美容師ごとの薬剤ミックスを把握し、①不足カテゴリへの営業 ②伸びている薬剤の兆候つかみ ③主力薬剤に合うメーカーのセミナー誘致 に使えます。</div>`;
    }
    // --- サロン別 薬剤比率＋営業の打ち手 ---
    const sl = qs('#rxSalons');
    if (sl) {
      const list = D.salons.slice().sort((a, b) => b.rxTotal - a.rxTotal);
      const rows = list.slice(0, 16).map(s => {
        const act = rxAction(s.mix);
        return `<tr>
          <td><b>${esc(s.name)}</b><div style="font-size:11px;color:var(--ink-3)">${esc(s.rep)}・${esc(s.arch)}</div></td>
          <td style="min-width:140px">${stackBar(s.mix)}</td>
          ${s.mix.map(p => `<td class="num">${p}%</td>`).join('')}
          <td style="font-size:11.5px"><b style="color:var(--gold-strong)">${esc(act[0])}</b><br>${esc(act[1])}</td>
        </tr>`;
      }).join('');
      sl.innerHTML = `${rxLegend()}<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>薬剤比率</th>${RX.map(r => `<th>${r}</th>`).join('')}<th>営業の打ち手</th></tr></thead><tbody>${rows}</tbody></table></div>`;
      const csv = qs('#csvRx');
      if (csv) csv.onclick = () => downloadCsv('サロン別_薬剤ミックス.csv', [['サロン', '担当', 'タイプ'].concat(RX.map(r => r + '%')).concat(['薬剤流通額', '所見', '打ち手'])]
        .concat(D.salons.map(s => [s.name, s.rep, s.arch].concat(s.mix).concat([s.rxTotal, rxAction(s.mix)[0], rxAction(s.mix)[1]]))));
    }
    // --- 美容師別ドリル ---
    const sel = qs('#rxSalonSelect');
    if (sel && !sel.dataset.ready) {
      sel.innerHTML = D.salons.map(s => `<option value="${esc(s.name)}">${esc(s.name)}</option>`).join('');
      sel.dataset.ready = '1';
      sel.addEventListener('change', () => { _rxSalonSel = sel.value; drawRxStylists(D); });
    }
    _rxSalonSel = _rxSalonSel || (D.salons[0] && D.salons[0].name);
    if (sel && _rxSalonSel) sel.value = _rxSalonSel;
    drawRxStylists(D);
    // --- セミナー×メーカー マッチング＋兆候 ---
    const sm = qs('#rxSeminar');
    if (sm) {
      // 主力薬剤に合うセミナーを誘致（強みを深める）
      const match = D.salons.slice().sort((a, b) => b.rxTotal - a.rxTotal).slice(0, 10).map(s => {
        const i = s.mix.indexOf(Math.max.apply(null, s.mix));
        return { name: s.name, rep: s.rep, cat: RX[i], sem: RX_SEM[i] };
      });
      // 兆候：薬剤比率が伸びているサロン（trend上位）
      const movers = [];
      D.salons.forEach(s => { const i = s.trend.indexOf(Math.max.apply(null, s.trend)); if (s.trend[i] >= 6) movers.push({ name: s.name, rep: s.rep, cat: RX[i], pt: s.trend[i], sig: RX_SIGNAL[i] }); });
      movers.sort((a, b) => b.pt - a.pt);
      sm.innerHTML = `
        <div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:8px">セミナー×メーカー 誘致マッチング <span style="color:var(--ink-3);font-weight:600;font-size:11px">主力薬剤で深掘り</span></div>
            <div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>主力</th><th>おすすめセミナー（協賛メーカー）</th></tr></thead><tbody>${match.map(m => `<tr><td><b>${esc(m.name)}</b><div style="font-size:11px;color:var(--ink-3)">${esc(m.rep)}</div></td><td>${esc(m.cat)}</td><td style="font-size:12px">${esc(m.sem.sem)}<br><b style="color:var(--gold-strong)">${esc(m.sem.maker)}</b></td></tr>`).join('')}</tbody></table></div>
          </div>
          <div><div style="font-size:12.5px;font-weight:800;margin-bottom:8px">今の兆候（伸びている薬剤） <span style="color:#c0392b;font-weight:700;font-size:11px">先月比</span></div>
            ${movers.length ? `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>サロン</th><th>薬剤</th><th>変化</th><th>提案</th></tr></thead><tbody>${movers.slice(0, 10).map(m => `<tr><td><b>${esc(m.name)}</b></td><td>${esc(m.cat)}</td><td class="num" style="color:#2f7a4d;font-weight:800">+${m.pt}pt</td><td style="font-size:11.5px">${esc(m.sig)}</td></tr>`).join('')}</tbody></table></div>` : '<div style="color:var(--ink-3);font-size:12px;padding:8px">目立った兆候はありません</div>'}
          </div>
        </div>`;
    }
  }

  /* ===== カテゴリ内訳（カラー剤のメーカーシェア／色味6分類×ブランド／パーマ・ストレートのタイプ別／人気銘柄ランキング）===== */
  function buildCatData() {
    const P = (SP.DATA && SP.DATA.products || []).filter(p => p.cat !== '_rec');
    const rnd = mulberry32(20260702);
    const makerOf = p => { const m = p.maker || p.brand; return L2M[m] || m; };
    const DEM = {}; P.forEach(p => { DEM[p.id] = Math.max(1, Math.round((p.pop || 40) * 1.4 + rnd() * 60)); });
    const dem = p => DEM[p.id] || 1;
    // 色味を赤・青・黄・紫・オレンジ・緑にざっくり束ねる（アッシュ→青、マット→緑 等）
    function color6(s) {
      s = s || '';
      if (/レッド|ガーネット|ローズ|チェリー|ピンク|コーラル|ボルドー|赤/.test(s)) return '赤';
      if (/バイオレット|パープル|アメジスト|ラベンダー|オーキッド|トワイライト|紫/.test(s)) return '紫';
      if (/マット|オリーブ|エメラルド|グリーン|カーキ|緑/.test(s)) return '緑';
      if (/イエロー|ゴールド|サンド|ベージュ|ヌード|キャメル|黄/.test(s)) return '黄';
      if (/オレンジ|コッパー|ブラウン|モカ|ウォーム|ナチュラル|橙/.test(s)) return 'オレンジ';
      if (/アッシュ|ブルー|サファイア|オーシャン|ネイビー|グレー|シルバー|フォギー|グレージュ|グレイッシュ|青/.test(s)) return '青';
      return 'その他';
    }
    const colorP = P.filter(p => p.cat === 'color');
    const cmk = {}; colorP.forEach(p => { const m = makerOf(p); cmk[m] = (cmk[m] || 0) + dem(p); });
    const tone = {}, toneMk = {};
    colorP.filter(p => p.family && p.level).forEach(p => {
      const b = color6((p.family || '') + ' ' + (p.tone || '') + ' ' + (p.name || ''));
      if (b === 'その他') return;
      tone[b] = (tone[b] || 0) + dem(p);
      const mk = makerOf(p) + '／' + (p.line || p.brand);
      toneMk[b] = toneMk[b] || {}; toneMk[b][mk] = (toneMk[b][mk] || 0) + dem(p);
    });
    const PT = { 'cold-thio': 'チオ系', 'cold-cys': 'システアミン', 'acid': '酸性', 'creep': 'クリープ', 'digital': 'デジタル', 'air': 'エアウェーブ', 'cosme': 'コスメ', 'perm2': '2剤', 'treat': '処理剤' };
    const ST = { 'alkaline': 'アルカリ縮毛矯正', 'straight2': '2剤', 'acid': '酸性ストレート', 'creep': 'クリープ', 'cosme': 'コスメ', 'treat': '処理剤' };
    function byType(cat, map, key) {
      const sh = {}, mk = {};
      P.filter(p => p.cat === cat).forEach(p => { const t = map[p[key]] || 'その他'; sh[t] = (sh[t] || 0) + dem(p); mk[t] = mk[t] || {}; const m = makerOf(p); mk[t][m] = (mk[t][m] || 0) + dem(p); });
      return { sh, mk };
    }
    const perm = byType('perm', PT, 'permType'), straight = byType('straight', ST, 'straightType');
    // 人気銘柄ランキング（line単位・薬剤カテゴリ横断）
    const RANKCATS = { color: 'カラー', perm: 'パーマ', straight: 'ストレート', treatment: 'トリートメント' };
    const agg = {};
    P.filter(p => RANKCATS[p.cat]).forEach(p => { const ln = p.line || p.brand; const e = agg[ln] || (agg[ln] = { line: ln, maker: makerOf(p), cat: p.cat, dem: 0 }); e.dem += dem(p); });
    const ranking = Object.keys(agg).map(k => agg[k]).sort((a, b) => b.dem - a.dem).slice(0, 15);
    return { cmk: cmk, tone: tone, toneMk: toneMk, perm: perm, straight: straight, ranking: ranking };
  }
  function renderCatAnalytics() {
    const D = buildCatData();
    const COL6 = [['赤', '#c0392b'], ['青', '#2f6f9e'], ['黄', '#d4a017'], ['紫', '#8e44ad'], ['オレンジ', '#d97b29'], ['緑', '#2f7a4d']];
    // 1. カラー剤 メーカーシェア
    const cm = qs('#catColor');
    if (cm) {
      const tot = Object.keys(D.cmk).reduce((a, k) => a + D.cmk[k], 0) || 1;
      const bars = Object.keys(D.cmk).map(k => ({ label: k, v: D.cmk[k], disp: Math.round(D.cmk[k] / tot * 100) + '%' })).sort((a, b) => b.v - a.v).slice(0, 10);
      cm.innerHTML = `<div style="font-size:12.5px;font-weight:800;margin-bottom:10px">カラー剤 メーカー別シェア <span style="color:var(--ink-3);font-weight:600;font-size:11px">注文需要ベース</span></div>${hbars(bars)}
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:10px">カラー剤の中でどのメーカーがどれだけ出ているか（ミルボン◯%・ルベル◯%…）。仕入れ構成・取引条件交渉・新ライン導入判断の基礎データ。</div>`;
    }
    // 2. 色味6分類 × ブランド
    const tn = qs('#catTone');
    if (tn) {
      const totT = COL6.reduce((a, c) => a + (D.tone[c[0]] || 0), 0) || 1;
      const stack = '<span style="display:flex;height:18px;border-radius:5px;overflow:hidden;border:1px solid var(--line)">' + COL6.map(c => { const p = Math.round((D.tone[c[0]] || 0) / totT * 100); return p > 0 ? `<i style="width:${p}%;background:${c[1]}" title="${c[0]} ${p}%"></i>` : ''; }).join('') + '</span>';
      const legend = '<div style="display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:var(--ink-2);margin:8px 0 12px">' + COL6.map(c => `<span style="display:inline-flex;align-items:center;gap:5px"><i style="width:11px;height:11px;border-radius:2px;background:${c[1]};display:inline-block"></i>${c[0]} ${Math.round((D.tone[c[0]] || 0) / totT * 100)}%</span>`).join('') + '</div>';
      const rows = COL6.map(c => {
        const mk = D.toneMk[c[0]] || {}; const top = Object.keys(mk).map(k => ({ k: k, v: mk[k] })).sort((a, b) => b.v - a.v).slice(0, 3);
        return `<tr><td><span style="display:inline-flex;align-items:center;gap:7px"><i style="width:12px;height:12px;border-radius:3px;background:${c[1]};display:inline-block"></i><b>${c[0]}</b></span></td><td class="num">${Math.round((D.tone[c[0]] || 0) / totT * 100)}%</td><td style="font-size:12px">${top.map(t => esc(t.k)).join('、') || '—'}</td></tr>`;
      }).join('');
      tn.innerHTML = `<div style="font-size:12.5px;font-weight:800;margin-bottom:8px">菊地全体の人気カラー（色味6分類）</div>${legend}${stack}
        <table class="adm-table" style="margin-top:14px"><thead><tr><th>色味</th><th>シェア</th><th>人気メーカー／ブランド TOP3</th></tr></thead><tbody>${rows}</tbody></table>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">アッシュ＝青、マット＝緑 等にざっくり束ねた色味別の出方と、各色で強いメーカー／ブランド。需要の地図として。</div>`;
    }
    // 3. パーマ・ストレート タイプ別
    const ch = qs('#catChem');
    if (ch) {
      function typeTable(o, title) {
        const tot = Object.keys(o.sh).reduce((a, k) => a + o.sh[k], 0) || 1;
        const rows = Object.keys(o.sh).map(k => ({ k: k, v: o.sh[k] })).sort((a, b) => b.v - a.v).map(t => {
          const mk = o.mk[t.k] || {}; const top = Object.keys(mk).sort((a, b) => mk[b] - mk[a])[0] || '—';
          return `<tr><td><b>${esc(t.k)}</b></td><td class="num">${Math.round(t.v / tot * 100)}%</td><td>${esc(top)}</td></tr>`;
        }).join('');
        return `<div><div style="font-size:12.5px;font-weight:800;margin-bottom:10px">${title}</div><div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>薬剤タイプ</th><th>シェア</th><th>人気メーカー</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
      }
      ch.innerHTML = `<div class="ins-2col" style="display:grid;gap:20px;grid-template-columns:1fr 1fr">${typeTable(D.perm, 'パーマ剤 タイプ別')}${typeTable(D.straight, 'ストレート剤 タイプ別')}</div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:10px">チオ／システアミン／酸性／クリープ／デジタル等、どの薬剤が出ているか。サロンの技術トレンドと、提案・セミナーの方向づけに。</div>`;
    }
    // 4. 人気銘柄ランキング
    const rk = qs('#catRank');
    if (rk) {
      const CATB = { color: ['カラー', '#c0392b'], perm: ['パーマ', '#8e44ad'], straight: ['ストレート', '#2f7a4d'], treatment: ['トリートメント', '#2f6f9e'] };
      const rows = D.ranking.map((r, i) => { const cb = CATB[r.cat] || ['', '#5b6470']; return `<tr><td class="num" style="font-weight:800">${i + 1}</td><td><b>${esc(r.line)}</b></td><td>${esc(r.maker)}</td><td><span class="tag" style="background:${cb[1]}1a;color:${cb[1]}">${cb[0]}</span></td><td class="num">${r.dem.toLocaleString('ja-JP')}</td></tr>`; }).join('');
      rk.innerHTML = `<div style="overflow-x:auto"><table class="adm-table"><thead><tr><th>#</th><th>銘柄（ライン）</th><th>メーカー</th><th>薬剤</th><th>需要指数</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div style="font-size:11.5px;color:var(--ink-3);margin-top:8px">美容師がよく注文する銘柄ランキング（カラー・パーマ・ストレート・Tr 横断）。品揃え・欠品優先度・販促の軸に。</div>`;
      const csv = qs('#csvCatRank');
      if (csv) csv.onclick = () => downloadCsv('人気銘柄ランキング.csv', [['順位', '銘柄', 'メーカー', '薬剤', '需要指数']].concat(D.ranking.map((r, i) => [i + 1, r.line, r.maker, (CATB[r.cat] || [''])[0], r.dem])));
    }
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
  // サイドバーで「1画面1セクション」に切替（タブ方式）。各カードを見出しでビューに自動振り分け。
  function setupAdminNav() {
    const links = [].slice.call(document.querySelectorAll('.adm-side a[data-jump]'));
    const cards = [].slice.call(document.querySelectorAll('.adm-main .adm-card'));
    const kpis = qs('.adm-kpis');
    const h1 = qs('#admTop');
    const MAP = [
      ['データ活用', 'insights'], ['離反リスク', 'insights'], ['次の一手', 'insights'], ['サロン一覧', 'insights'],
      ['サイト分析', 'site'], ['会員申請の流入元', 'site'], ['行動ファネル', 'site'], ['検索ワード', 'site'], ['実計測ログ', 'site'],
      ['メーカー分析', 'makers'], ['メーカー詳細', 'makers'], ['横断インサイト', 'makers'],
      ['薬剤ミックス', 'rx'], ['サロン別 薬剤', 'rx'], ['美容師別 薬剤', 'rx'], ['セミナー×メーカー', 'rx'],
      ['カテゴリ内訳', 'cat'], ['色味', 'cat'], ['薬剤タイプ', 'cat'], ['人気銘柄', 'cat'],
      ['分析', 'analytics'], ['請求台帳', 'analytics'],
      ['商品管理', 'products'], ['注文管理', 'orders'], ['最近の注文', 'dashboard'],
      ['代理発注', 'proxy'], ['在庫アラート', 'stock'], ['入荷お知らせ', 'restock'],
      ['会員審査', 'review'], ['承認済みサロン', 'review'], ['サロン別 添付', 'review'], ['サロン別 メーカー', 'review'],
      ['掛け払い 与信', 'credit'], ['契約申込', 'contract'], ['セミナー', 'seminar'],
      ['リース', 'lease'], ['機器買取', 'buyback'], ['中古在庫', 'buyback'], ['パートナー', 'partner'],
    ];
    const NAVVIEW = {
      '#admTop': 'dashboard', '#view-insights': 'insights', '#view-site': 'site', '#view-makers': 'makers', '#view-rx': 'rx', '#view-cat': 'cat', '#view-analytics': 'analytics', '#view-products': 'products', '#view-orders': 'orders',
      '#view-proxy': 'proxy', '#view-stock': 'stock', '#restockList': 'restock', '#reviewList': 'review',
      '#creditList': 'credit', '#contractAppList': 'contract', '#seminarList': 'seminar', '#leaseList': 'lease',
      '#buybackList': 'buyback', '#partnerList': 'partner',
    };
    cards.forEach(c => {
      const t = (c.querySelector('.adm-card__title') || {}).textContent || '';
      let v = 'dashboard';
      for (let i = 0; i < MAP.length; i++) { if (t.indexOf(MAP[i][0]) >= 0) { v = MAP[i][1]; break; } }
      c.dataset.view = v;
    });
    const labelOf = a => { const tn = [].slice.call(a.childNodes).find(n => n.nodeType === 3 && n.textContent.trim()); return tn ? tn.textContent.trim() : 'ダッシュボード'; };
    function show(view, label) {
      if (kpis) kpis.style.display = (view === 'dashboard') ? '' : 'none';
      cards.forEach(c => { c.style.display = (c.dataset.view === view) ? '' : 'none'; });
      links.forEach(a => a.classList.toggle('is-active', NAVVIEW[a.getAttribute('data-jump')] === view));
      if (h1 && label) h1.textContent = label;
      window.scrollTo(0, 0);
    }
    // サイドバー＋ビュー内の「○○を開く」リンク（data-jump）どちらでも切替
    [].slice.call(document.querySelectorAll('[data-jump]')).forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      const view = NAVVIEW[a.getAttribute('data-jump')] || 'dashboard';
      const navLink = links.find(l => NAVVIEW[l.getAttribute('data-jump')] === view);
      show(view, navLink ? labelOf(navLink) : 'ダッシュボード');
    }));
    show('dashboard', 'ダッシュボード');
  }

  /* ===== 代理発注（FAX/電話注文の代行入力） ===== */
  const PX_ST = { pending: ['未確定', 'tag--prep'], confirmed: ['確定・出荷へ', 'tag--shipped'], canceled: ['取消', 'tag--mute'] };
  let pxMatched = [];
  function fillPxSalon() {
    const sel = qs('#pxSalon'); if (!sel) return;
    sel.innerHTML = KNOWN_SALONS.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  }
  function pxMatchLine(line) {
    const raw = line.trim(); if (!raw) return null;
    const parts = raw.split(/[\s,，、\t×]+/).filter(Boolean);   // ×（全角）と空白等で区切る。品番中の x は割らない（cox-001 等）
    let qty = 1;
    if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) qty = Math.max(1, parseInt(parts.pop(), 10) || 1);
    const key = parts.join(' ').trim(); if (!key) return null;
    const P = (SP.DATA.products || []);
    const p = P.find(x => x.id === key) || P.find(x => x.jan === key) || P.find(x => (x.name || '').indexOf(key) >= 0);
    return { key, qty, p: p || null };
  }
  const pxPrice = p => (SP.priceOf ? SP.priceOf(p) : p.price);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function renderPxPreview() {
    const rows = (qs('#pxInput').value || '').split(/\n/).map(pxMatchLine).filter(Boolean);
    pxMatched = rows.filter(r => r.p);
    const ng = rows.filter(r => !r.p);
    const total = pxMatched.reduce((a, r) => a + pxPrice(r.p) * r.qty, 0);
    const host = qs('#pxPreview');
    if (!rows.length) { host.innerHTML = ''; qs('#pxCreate').disabled = true; return; }
    host.innerHTML =
      pxMatched.map(r => `<div class="review-item"><span class="review-item__main"><span class="review-item__name" style="font-size:13px">${esc(r.p.brand)} ${esc(r.p.name)} ×${r.qty}</span><span class="review-item__meta">${esc(r.p.id)}</span></span><span class="num" style="font-weight:700">${yen(pxPrice(r.p) * r.qty)}</span></div>`).join('') +
      (ng.length ? `<div style="font-size:12px;color:#c0453f;margin-top:6px">照合できなかった行：${esc(ng.map(r => r.key).join(' / '))}（品番での指定がおすすめ）</div>` : '') +
      `<div style="display:flex;justify-content:space-between;font-weight:800;margin-top:8px;padding-top:8px;border-top:1px solid var(--line)"><span>${pxMatched.length}品目 合計（税抜）</span><span class="num">${yen(total)}</span></div>`;
    qs('#pxCreate').disabled = !pxMatched.length;
  }
  function renderPxList() {
    const el = qs('#pxList'); if (!el) return;
    const list = SP.Store.getProxyOrders ? SP.Store.getProxyOrders() : [];
    const nav = qs('#navProxy'); if (nav) nav.textContent = list.filter(o => o.status === 'pending').length;
    if (!list.length) { el.innerHTML = '<div style="padding:12px;color:var(--ink-3);font-size:12.5px">代理発注の履歴はありません</div>'; return; }
    el.innerHTML = list.map(o => {
      const st = PX_ST[o.status] || PX_ST.pending;
      const items = (o.items || []).map(i => `${esc(i.name)}×${i.qty}`).join('、');
      const done = o.status !== 'pending';
      return `<div class="review-item" data-id="${o.id}">
        <span class="review-item__av">代</span>
        <span class="review-item__main">
          <span class="review-item__name">${esc(o.salon)} <span class="tag ${st[1]}">${st[0]}</span></span>
          <span class="review-item__meta">担当 ${esc(o.rep || '—')}・${esc(o.via || '')}${o.memo ? '・' + esc(o.memo) : ''}</span>
          <span class="doc-chip">${svg('checkc')}${items} 　/　 ${yen(o.amount || 0)}</span>
        </span>
        <span class="review-item__act">
          ${done ? '' : '<button class="btn btn--ghost" data-act="cancel" data-id="' + o.id + '">取消</button>'}
          ${done ? '' : '<button class="btn btn--primary" data-act="confirm" data-id="' + o.id + '">確定（出荷へ）</button>'}
        </span>
      </div>`;
    }).join('');
  }
  const _pxParse = qs('#pxParse'); if (_pxParse) _pxParse.addEventListener('click', renderPxPreview);
  const _pxInput = qs('#pxInput'); if (_pxInput) _pxInput.addEventListener('input', () => { const c = qs('#pxCreate'); if (c) c.disabled = true; });
  const _pxCreate = qs('#pxCreate');
  if (_pxCreate) _pxCreate.addEventListener('click', () => {
    if (!pxMatched.length) return;
    const total = pxMatched.reduce((a, r) => a + pxPrice(r.p) * r.qty, 0);
    SP.Store.addProxyOrder({
      salon: qs('#pxSalon').value, rep: qs('#pxRep').value.trim() || '担当者', via: qs('#pxVia').value,
      memo: qs('#pxMemo').value.trim(), amount: total,
      items: pxMatched.map(r => ({ id: r.p.id, name: r.p.name, brand: r.p.brand, qty: r.qty }))
    });
    toast(`${qs('#pxSalon').value} の代理発注を作成しました`);
    qs('#pxInput').value = ''; qs('#pxMemo').value = ''; qs('#pxPreview').innerHTML = ''; pxMatched = []; qs('#pxCreate').disabled = true;
    renderPxList();
  });
  const _pxList = qs('#pxList');
  if (_pxList) _pxList.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const map = { confirm: 'confirmed', cancel: 'canceled' };
    SP.Store.setProxyOrderStatus(b.dataset.id, map[b.dataset.act] || 'pending');
    toast(b.dataset.act === 'confirm' ? '代理発注を確定しました（出荷へ）' : '代理発注を取消しました');
    renderPxList();
  });

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
  renderInsights();
  renderSiteAnalytics();
  renderMakerAnalytics();
  renderRxAnalytics();
  renderCatAnalytics();
  setupProductAdmin();
  renderOrders();
  fillPxSalon();
  renderPxList();
  computeKpis();
  setupAdminNav();
})();

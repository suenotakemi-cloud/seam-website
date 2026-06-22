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

  // 大型機器 買取査定キュー（equipment.html の買取依頼 → Store.addBuyback → ここで担当者が査定・買取／成立は中古再販へ）
  const BUYBACK_ST = { pending: ['受付', 'tag--prep'], contacted: ['連絡済み', 'tag--new'], quoted: ['査定提示', 'tag--shipped'], agreed: ['買取成立', 'tag--shipped'], rejected: ['見送り', 'tag--mute'] };
  function renderBuybacks() {
    const el = qs('#buybackList'); if (!el) return;
    const apps = SP.Store.getBuybacks ? SP.Store.getBuybacks() : [];
    const nav = qs('#navBuyback'); if (nav) nav.textContent = apps.filter(a => a.status === 'pending').length;
    if (!apps.length) { el.innerHTML = '<div style="padding:18px;text-align:center;color:var(--ink-3)">機器買取のご依頼はまだありません</div>'; return; }
    el.innerHTML = apps.map(a => {
      const st = BUYBACK_ST[a.status] || BUYBACK_ST.pending;
      const spec = `${a.type} ×${a.qty || 1}・状態${a.cond}・${a.years || '—'}・写真${a.photoCount || (a.photos ? a.photos.length : 0)}枚`;
      const quoteLine = (a.quote != null && a.quote !== '') ? ` ・ 査定額 ¥${(+a.quote).toLocaleString()}` : '';
      const done = a.status === 'agreed' || a.status === 'rejected';
      return `
      <div class="review-item" data-id="${a.id}">
        <span class="review-item__av">買</span>
        <span class="review-item__main">
          <span class="review-item__name">${a.maker ? a.maker + ' ' : ''}${a.type} <span class="tag ${st[1]}">${st[0]}</span></span>
          <span class="review-item__meta">${a.salon || '—'}${a.contact ? '・' + a.contact : ''}${a.when ? '・引取希望:' + a.when : ''}</span>
          <span class="doc-chip">${svg('checkc')}${spec}${quoteLine}</span>
        </span>
        <span class="review-item__act">
          ${done ? '' : '<button class="btn btn--ghost" data-act="reject" data-id="' + a.id + '">見送り</button>'}
          ${done ? '' : '<button class="btn btn--ghost" data-act="contact" data-id="' + a.id + '">連絡済み</button>'}
          ${done ? '' : '<button class="btn btn--ghost" data-act="quote" data-id="' + a.id + '">査定額を提示</button>'}
          <button class="btn btn--primary" data-act="agree" data-id="${a.id}"${a.status === 'agreed' ? ' disabled' : ''}>${a.status === 'agreed' ? '買取成立' : '買取成立にする'}</button>
        </span>
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
    const map = { reject: 'rejected', contact: 'contacted', agree: 'agreed' };
    SP.Store.setBuybackStatus(id, map[act] || 'pending');
    toast(act === 'agree' ? '買取成立にしました（中古として再販へ）' : act === 'contact' ? '「連絡済み」にしました' : '見送りにしました');
    renderBuybacks();
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

  Salon.subscribe(renderLow);
  renderReview();
  renderCredit();
  renderContractApps();
  renderSeminars();
  renderLeases();
  renderBuybacks();
  renderPartners();
  renderLow();
  renderClaims();
  renderBundleConds();
  renderSalonConds();
  fillDiscForm();
  renderSalonDiscounts();
})();

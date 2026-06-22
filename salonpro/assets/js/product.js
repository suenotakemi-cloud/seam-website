/* =========================================================
   SalonPro / Product detail — ?id から商品詳細を描画
   購買・学習・導入判断を1ページで完結（仕様 6.7）
   ========================================================= */
(function () {
  const { Store, placeholder, svg, fmtYen, STOCK } = SP;
  const qs = (s, r = document) => r.querySelector(s);
  const catLabel = id => (SP.DATA.categories.find(c => c.id === id) || {}).label || '—';
  const toast = m => (window.SP_toast ? SP_toast(m) : null);

  const id = new URLSearchParams(location.search).get('id');
  const p = SP.DATA.products.find(x => x.id === id) || SP.DATA.products.find(x => x.cat !== '_rec');

  const STOCK_TAGCLS = { in: 'stock-in', low: 'stock-low', order: 'stock-order', wait: 'stock-order' };
  const volume = (p.name.match(/(\d[\d,]*\s?(?:mL|ml|ｍｌ|g|ｇ|L|kg|個|本|枚))/) || [])[0] || '—';
  // 契約商品：mode別に出し分け（online=契約／apply=申込→連絡待ち／direct=メーカー直送）。
  const cb = p.contract ? SP.contractBrand(p.contract) : null;
  const mode = cb ? cb.mode : null;
  const direct = mode === 'direct';
  const applied = p.contract ? Store.hasApplied(p.contract) : false;
  const locked = !!(p.contract && !direct && !Store.hasContract(p.contract)); // online/apply 未契約
  const isWait = p.stock === 'wait' && !locked && !direct;                     // 欠品（入荷待ち）＝購入の代わりに入荷お知らせ

  function relatedCard(x) {
    return `<a class="rec-card" href="product.html?id=${x.id}" style="text-decoration:none">
      <div class="rec-card__media">${placeholder(x.ph, x.brand)}</div>
      <div class="rec-card__brand">${x.brand}</div>
      <div class="rec-card__name">${x.name}</div>
      <div class="rec-card__price">${fmtYen(x.price)}<small>（税抜）</small></div>
    </a>`;
  }
  function videoCard(v) {
    return `<article class="video-card">
      <div class="video-card__thumb" style="background:linear-gradient(135deg,${v.tint},${v.tint}bb)">
        <span class="video-card__tag video-card__tag--${v.tcls}">${v.tag}</span>
        <span class="video-card__play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>
        <span class="video-card__dur">${v.dur}</span>
      </div>
      <div class="video-card__title">${v.title}</div>
      <div class="video-card__who">講師：${v.who}</div>
    </article>`;
  }

  function render() {
    const s = STOCK[p.stock] || STOCK.in;
    const eff = (SP.priceOf ? SP.priceOf(p) : p.price);              // サロン別割引を反映した実効価格（税抜）
    const sOff = Math.round((SP.discountRate ? SP.discountRate(p) : 0) * 100);
    const tax = Math.round(eff * 1.1);
    const list = p.list || Math.round(p.price * 1.28 / 10) * 10;     // メーカー希望小売価格（税抜・無ければ導出）
    const off = Math.max(0, Math.round((1 - p.price / list) * 100));
    const pts = Math.round(eff / 100);                               // 獲得ポイント（1%）
    const related = SP.DATA.products.filter(x => x.cat === p.cat && x.id !== p.id && x.cat !== '_rec').slice(0, 8);
    const fav = Store.isFav(p.id);

    qs('#pdRoot').innerHTML = `
      <div class="pd-gallery">${placeholder(p.ph, p.brand)}</div>

      <div class="pd-head">
        <div class="pd-brand">${p.brand}<button id="pdBrandFav" class="pd-brandfav" aria-pressed="${Store.isFavBrand(p.brand)}" aria-label="${p.brand}をブランドお気に入り">${svg('heart')}<span>ブランドを保存</span></button></div>
        <h1 class="pd-name">${p.name}</h1>
        <div class="pd-tags">
          <span class="pd-tag pd-tag--${STOCK_TAGCLS[p.stock]}">${svg(s.icon)}${s.text}</span>
          <span class="pd-tag pd-tag--ship">${p.same ? '当日出荷可（14時まで）' : '取寄せ 3〜5営業日'}</span>
          ${p.contract
            ? (direct
              ? `<span class="pd-tag" style="background:#34507a;color:#eaf1fb">メーカー発注</span>`
              : `<span class="pd-tag" style="background:#2b2b2e;color:#e6c878">${locked ? '契約商品' : '契約中'}</span>`)
            : '<span class="pd-tag pd-tag--pro">プロ専用</span>'}
        </div>
      </div>

      <div class="pd-price">
        <div style="font-size:12px;font-weight:700;color:var(--ink-3)">${sOff > 0 ? '貴店価格' : '会員価格'}</div>
        <div class="pd-price__main"><span class="pd-price__yen">${fmtYen(eff)}</span><span class="pd-price__tax">税抜</span>${sOff > 0
          ? `<span style="margin-left:10px;background:#1f4e8c1a;color:#1f4e8c;font-weight:800;font-size:12px;padding:3px 9px;border-radius:6px">貴店割引 ${sOff}%</span>`
          : (off > 0 ? `<span style="margin-left:10px;background:var(--badge-low-bg);color:var(--badge-low-tx);font-weight:800;font-size:12px;padding:3px 9px;border-radius:6px">${off}%OFF</span>` : '')}</div>
        <div style="font-size:12.5px;color:var(--ink-3);margin-top:3px">${sOff > 0
          ? `通常会員価格 <s>${fmtYen(p.price)}</s>`
          : `メーカー希望小売価格 <s>${fmtYen(list)}</s>`} ・ 税込 <b style="color:var(--ink-2)">${fmtYen(tax)}</b></div>
        <div class="pd-price__member">${svg('checkc')} ${SP.MEMBER_RANK}会員価格が適用中 ・ 獲得 <b>${pts}pt</b></div>
        <div class="pd-tiers"><b>まとめ買い割引</b>　6個以上 <b>5%OFF</b> ／ 12個以上 <b>10%OFF</b></div>
      </div>

      ${direct ? `
      <div class="pd-lock pd-lock--direct">
        <div class="pd-lock__h">${svg('truck')}<b>${cb ? cb.brand : p.brand}</b> はメーカー発注サイトでのみご注文いただけます</div>
        <p class="pd-lock__t">この契約商品は、菊地（SalonPro）では発注できません。ご注文はメーカーの発注サイトからお願いします（在庫・納期もメーカーが管理）。契約手続き・導入相談は菊地の担当者がサポートします。</p>
        <a class="pd-lock__cta" href="${cb && cb.orderUrl ? cb.orderUrl : '#'}" target="_blank" rel="noopener">${svg('truck')}メーカー発注サイトで注文する${svg('chevright')}</a>
        <a class="pd-lock__sub" href="contracts.html?b=${p.contract}">このブランドについて</a>
      </div>` : locked ? `
      <div class="pd-lock">
        <div class="pd-lock__h">${svg('shield')}<b>${cb ? cb.brand : p.brand}</b> は契約ブランドです</div>
        <p class="pd-lock__t">${mode === 'apply'
          ? 'こちらはオンラインでの即時契約ができないブランドです。お申し込みいただくと、菊地の担当者より契約手続きをご案内します。'
          : 'こちらは契約しないとご購入いただけない商品です。メーカー説明をご確認のうえ契約すると、以降は通常商品と同じくご購入いただけます。'}</p>
        ${mode === 'apply' && applied
          ? `<div class="pd-applied">${svg('clock')}お申し込み済みです。担当者からのご連絡をお待ちください。</div>`
          : `<a class="pd-lock__cta" href="contracts.html?b=${p.contract}">${svg('shield')}${mode === 'apply' ? '契約を申し込む' : '内容を見て契約に進む'}${svg('chevright')}</a>`}
        <a class="pd-lock__sub" href="contracts.html">契約ブランド一覧を見る</a>
      </div>` : isWait ? `
      <div class="pd-restock" data-id="${p.id}">
        <div class="pd-restock__h">${svg('clock')}ただいま<b>入荷待ち</b>です</div>
        <p class="pd-restock__t">入荷お知らせにご登録いただくと、再入荷したタイミングでお知らせします。担当ディーラー（菊地）にも入荷リクエストとして届きます。</p>
        <button class="pd-restock__cta${Store.hasRestockAlert(p.id) ? ' is-on' : ''}" id="pdRestock" data-act="restock" data-id="${p.id}" aria-pressed="${Store.hasRestockAlert(p.id) ? 'true' : 'false'}">${svg(Store.hasRestockAlert(p.id) ? 'checkc' : 'bell')}<span class="btn-restock__t">${Store.hasRestockAlert(p.id) ? '入荷お知らせ登録済み' : '入荷お知らせを受け取る'}</span></button>
      </div>` : `
      <div class="pd-buy">
        <div class="stepper" id="pdStepper">
          <button data-act="dec" aria-label="数量を減らす">${svg('minus')}</button>
          <input type="number" id="pdQty" inputmode="numeric" value="1" min="1" max="99" aria-label="数量">
          <button data-act="inc" aria-label="数量を増やす">${svg('plus')}</button>
        </div>
        <button class="btn-cart" id="pdAdd">${svg('cart')}カートに入れる</button>
      </div>`}
      <div class="pd-sub-actions">
        <button id="pdFav" aria-pressed="${fav}">${svg('heart')}お気に入り</button>
        <button data-soon="定番セット登録">${svg('reorder')}定番に登録</button>
      </div>

      <section class="pd-sec">
        <h2 class="pd-sec__title">商品説明</h2>
        <p class="pd-text">${p.brand}「${p.name}」。サロンワークで培われたプロ仕様の処方で、施術後の仕上がりとご自宅での再現性を両立します。${catLabel(p.cat)}として、髪質や悩みに合わせた毎日のケアに。店販としてもおすすめしやすい一本です。</p>
      </section>

      <section class="pd-sec">
        <h2 class="pd-sec__title">仕様</h2>
        <div class="spec">
          <div class="spec__row"><div class="spec__k">ブランド</div><div class="spec__v">${p.brand}</div></div>
          <div class="spec__row"><div class="spec__k">カテゴリ</div><div class="spec__v">${catLabel(p.cat)}</div></div>
          <div class="spec__row"><div class="spec__k">容量</div><div class="spec__v">${volume}</div></div>
          <div class="spec__row"><div class="spec__k">区分</div><div class="spec__v">業務用 / 店販用</div></div>
          <div class="spec__row"><div class="spec__k">商品コード</div><div class="spec__v" style="font-family:var(--font-num)">${p.id.toUpperCase()}</div></div>
        </div>
      </section>

      <section class="pd-sec">
        <h2 class="pd-sec__title">使い方</h2>
        <div class="usage">
          <div class="usage__step"><p>適量を手に取り、髪全体になじませます。</p></div>
          <div class="usage__step"><p>毛先から中間にかけて、やさしく塗布します。</p></div>
          <div class="usage__step"><p>数分置いてから、ぬるま湯で十分にすすぎます。</p></div>
        </div>
      </section>

      <section class="pd-sec">
        <h2 class="pd-sec__title">向いているケース / 向いていないケース</h2>
        <div class="fit">
          <div class="fit__card fit__card--yes">
            <div class="fit__h">${svg('checkc')}向いているサロン</div>
            <div class="fit__list">・乾燥やダメージのケアを重視<br>・店販で再現性を提案したい<br>・${catLabel(p.cat)}を強化したい</div>
          </div>
          <div class="fit__card fit__card--no">
            <div class="fit__h">${svg('alert')}向いていないケース</div>
            <div class="fit__list">・超軽さ最優先の極細毛<br>・香り付きを避けたい場合<br>・即効性のみを求める場合</div>
          </div>
        </div>
      </section>

      <section class="pd-sec">
        <h2 class="pd-sec__title">関連動画</h2>
        <div class="h-scroll">
          ${videoCard({ tag: '商品活用動画', tcls: 'use', dur: '08:20', title: `${p.brand} ${p.name} の使い方`, who: 'SalonPro 教育チーム', tint: '#b1a079' })}
          ${videoCard({ tag: '技術セミナー', tcls: 'tech', dur: '22:40', title: `${catLabel(p.cat)}で差がつく仕上げ`, who: 'ALBUM OCE', tint: '#a87d90' })}
        </div>
      </section>

      <section class="pd-sec">
        <h2 class="pd-sec__title">導入事例・店販提案</h2>
        <div class="note-card">
          <div class="note-card__q">導入サロンの声</div>
          カウンセリングで悩みに合わせて提案したところ、リピート率が向上。レジ前の声かけと併用で店販単価が上がりました。
        </div>
        <div class="note-card" style="margin-top:var(--s-3)">
          <div class="note-card__q">店販トーク例</div>
          「この${catLabel(p.cat)}は、今日の施術の仕上がりをご自宅でも続けられます。週◯回のご使用がおすすめです。」
        </div>
      </section>

      <section class="pd-sec">
        <div class="sec__head"><h2 class="pd-sec__title" style="margin:0">代替・関連商品</h2></div>
        <div class="h-scroll">${related.map(relatedCard).join('') || '<span style="color:var(--ink-3);font-size:13px">関連商品は準備中です</span>'}</div>
      </section>
    `;

    qs('#pdBarPrice').textContent = fmtYen(eff);
    qs('#pdBar').hidden = isWait;   // 入荷待ちは下部の購入バーを出さない（本文の入荷お知らせCTAに一本化）
    if (direct) {
      qs('#pdBarAdd').innerHTML = 'メーカー発注サイトへ' + svg('chevright');
    } else if (locked) {
      qs('#pdBarAdd').innerHTML = (mode === 'apply' ? (applied ? '申し込み済み' : '契約を申し込む') : '契約して購入する') + svg('chevright');
    }
    document.title = `${p.name}｜SalonPro`;

    // パンくず（タップ履歴）：探す › カテゴリ › ブランド › 商品。カテゴリ/ブランドで戻れる
    const sep = '<span class="pd-crumb__sep">›</span>';
    const crumb = qs('#pdCrumb');
    if (crumb) crumb.innerHTML =
      '<a href="index.html">探す</a>' + sep +
      '<a href="index.html?cat=' + p.cat + '">' + catLabel(p.cat) + '</a>' + sep +
      '<a href="index.html?q=' + encodeURIComponent(p.brand) + '">' + p.brand + '</a>' + sep +
      '<span class="pd-crumb__cur">' + p.name + '</span>';
  }

  function addToCart() {
    if (direct) { if (cb && cb.orderUrl) window.open(cb.orderUrl, '_blank', 'noopener'); return; }
    if (locked) { location.href = 'contracts.html?b=' + p.contract; return; }
    const qty = Math.max(1, parseInt(qs('#pdQty').value, 10) || 1);
    Store.addToCart(p.id, qty);
    toast(`カートに追加しました（${qty}点）`);
  }

  function bind() {
    const root = qs('#pdRoot');
    root.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      const input = qs('#pdQty');
      if (act === 'inc') input.value = Math.min(99, (parseInt(input.value, 10) || 1) + 1);
      else if (act === 'dec') input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1);
      else if (e.target.closest('#pdAdd')) addToCart();
      else if (e.target.closest('#pdFav')) {
        const on = Store.toggleFav(p.id);
        e.target.closest('#pdFav').setAttribute('aria-pressed', on);
        toast(on ? 'お気に入りに追加しました' : 'お気に入りから削除しました');
      }
      else if (e.target.closest('#pdBrandFav')) {
        const on = Store.toggleFavBrand(p.brand);
        e.target.closest('#pdBrandFav').setAttribute('aria-pressed', on);
        toast(on ? `${p.brand}をお気に入りブランドに追加` : 'お気に入りブランドから削除');
      }
    });
    qs('#pdBarAdd').addEventListener('click', addToCart);
  }

  render();
  bind();
})();

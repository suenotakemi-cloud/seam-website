# -*- coding: utf-8 -*-
"""ブランド別SEOランディングページ生成器
「{ブランド名} 取扱店 / 正規販売店」検索を取りにいく静的ja ページを生成する
- 実データ駆動: 商品数/ライン/代表アイテムは seam-master.json から
- 店舗NAPは store-*.html のJSON-LDから抽出(常に実ページと同期)
- JSON-LD: Organization/WebPage/BreadcrumbList/FAQPage(生成時にjson.loadsで検証)
- 併せて sitemap.xml / store-*.html(取扱ブランド) / brand.html(内部リンク) をidempotentに更新
再生成: python3 scripts/build_brand_pages.py  (seam-public/ 直下で実行)
"""
import json, re, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

STORES = ['ginza','omotesando','sapporo','osaka','nagoya','fukuoka','utsunomiya']

BRANDS = [
  dict(slug='aujua', ja='オージュア', en='Aujua', masters=['Aujua'], maker='ミルボン',
       blurb='髪質と悩みに合わせてラインを選ぶ サロン専売ヘアケアの代表格<br>シャンプー・トリートメント・アウトバスを揃えて使う設計で 選び方がなにより大切なブランドです',
       cross=[('milbon','ミルボン')], q='オージュア 取扱店'),
  dict(slug='kerastase', ja='ケラスターゼ', en='KÉRASTASE', masters=['Kérastase'], maker='ロレアル グループ',
       blurb='パリ発のラグジュアリーヘアケア<br>ダメージケアからスカルプまで ラインの幅広さと世界観で愛され続けるブランドです',
       cross=[('shu-uemura','シュウ ウエムラ')], q='ケラスターゼ 取扱店'),
  dict(slug='tokio', ja='トキオ インカラミ', en='TOKIO INKARAMI', masters=['TOKIO INKARAMI'], maker='ドクタージュニア',
       blurb='特許技術インカラミによる集中補修で知られるサロン専売ブランド<br>ハイダメージ・ブリーチ毛のホームケアの定番です',
       cross=[('bykarte','バイカルテ')], q='TOKIO トリートメント 取扱店'),
  dict(slug='bykarte', ja='バイカルテ', en='BYKARTE', masters=['BYKARTE'], maker='ホーユー',
       blurb='「カルテから生まれる」をコンセプトにしたサロン専売ヘアケア<br>SEAMの人気ランキングでも常連のブランドです',
       cross=[('tokio','トキオ インカラミ')], q='バイカルテ 取扱店'),
  dict(slug='shu-uemura', ja='シュウ ウエムラ', en='shu uemura Art of Hair', masters=[], maker='ロレアル グループ',
       blurb='シュウ ウエムラのヘアケアライン アートオブヘアを店頭でお取り扱いしています<br>ラインナップ・在庫は店舗により異なります 詳しくは店頭でご案内します',
       cross=[('kerastase','ケラスターゼ')], q='シュウウエムラ ヘアケア 取扱店'),
  dict(slug='lashaddict', ja='ラッシュアディクト', en='Lashaddict', masters=[], maker=None,
       blurb='サロン専売のまつげ美容液ブランドを正規ルートでお取り扱いしています<br>在庫・価格・使い方は店頭でご案内します',
       cross=[], q='ラッシュアディクト 正規取扱店', nofinder=True),
  dict(slug='sublimic', ja='サブリミック', en='SUBLIMIC', masters=['SUBLIMIC'], maker='資生堂プロフェッショナル',
       blurb='資生堂プロフェッショナルのサロン専売ヘアケア<br>髪と頭皮を診て組み合わせる 処方型のラインが特徴です',
       cross=[('shiseido-professional','資生堂プロフェッショナル')], q='サブリミック 取扱店'),
  dict(slug='shiseido-professional', ja='資生堂プロフェッショナル', en='SHISEIDO PROFESSIONAL', masters=['SUBLIMIC'], maker='資生堂',
       blurb='資生堂のサロン向けブランド サブリミックやフェンテフォルテなどを正規取扱<br>頭皮ケアからダメージケアまで 目的で選べます',
       cross=[('sublimic','サブリミック')], q='資生堂プロフェッショナル 取扱店'),
  dict(slug='tsururincho', ja='つるりんちょ。', en='TSURURINCHO', masters=['つるりんちょ。'], maker=None,
       blurb='名前で覚えるかたも多い サロン専売の洗い流さないトリートメント<br>大容量サイズまで店頭でお選びいただけます',
       cross=[], q='つるりんちょ 取扱店'),
  dict(slug='system-professional', ja='システムプロフェッショナル', en='System Professional', masters=['System Professional'], maker='ウエラ',
       blurb='髪と頭皮の状態から組み合わせる パーソナライズ型のサロン専売ケア<br>SEAMでも取扱点数の多い主力ブランドです',
       cross=[('kerastase','ケラスターゼ')], q='システムプロフェッショナル 取扱店'),
  dict(slug='milbon', ja='ミルボン', en='MILBON', masters=['Global Milbon','Global Milbon Premium Position','Elujuda','Milbon'], maker='ミルボン',
       blurb='グローバルミルボン・エルジューダ・ジェミールフランなど サロン専売の総合メーカー<br>オージュアも同社のブランドです(専用ページあり)',
       cross=[('aujua','オージュア')], q='ミルボン 取扱店'),
]

# ── 店舗NAP抽出(store-*.htmlのJSON-LDから) ──────────────────
def load_stores():
    out=[]
    for s in STORES:
        p=f'store-{s}.html'
        t=open(p,encoding='utf-8').read()
        m=re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S)
        g=json.loads(m.group(1))
        node=[n for n in g['@graph'] if n.get('@type') in ('HairSalon','LocalBusiness','Store')][0]
        a=node.get('address',{})
        addr=f"{a.get('addressRegion','')}{a.get('addressLocality','')}{a.get('streetAddress','')}"
        out.append(dict(slug=s, name=node.get('name',f'SEAM {s.upper()}'), addr=addr))
    return out

# ── 商品データ ────────────────────────────────────────────
def load_products():
    m=json.load(open('data/products/seam-master.json'))
    return m if isinstance(m,list) else m.get('products',m.get('items',[]))

def brand_stats(prods, masters):
    items=[p for p in prods if p.get('brand') in masters]
    lines=[]
    for p in items:
        ln=(p.get('line') or '').strip()
        if ln and ln not in lines: lines.append(ln)
    tops=[p for p in items if p.get('priceApprox') and p.get('image')][:3]
    return len(items), lines[:8], tops

E=html.escape

def page_html(b, stores, count, lines, tops):
    ja,en,slug=b['ja'],b['en'],b['slug']
    url=f'https://seam.site/{slug}'
    store_names='銀座・表参道・札幌・大阪・名古屋・福岡・宇都宮'
    title=f'{ja} 取扱店・正規販売店｜SEAM 全国7店舗({store_names})'
    desc_count=f'取扱{count}点 ' if count else ''
    desc=f'{ja}({en})をメーカー公認の正規ルートで取扱 全国7店舗と会員制オンラインショップ {desc_count}在庫は店舗により異なります 無料の髪格診断で自分に合う一本を'
    if b.get('nofinder'):
        desc=f'{ja}({en})を正規ルートでお取り扱い 全国7店舗({store_names}) 在庫・価格は店頭でご案内します'

    # FAQ(構造化データと本文で共通)
    faqs=[(f'{ja}は正規品ですか',
           f'SEAMはメーカー公認の正規取扱店です {ja}は正規ルートの商品のみをお取り扱いしています'),
          (f'{ja}はどの店舗で買えますか',
           f'SEAMの全国7店舗({store_names})でお取り扱いしています 在庫状況は店舗・時期により異なるため 確実にお求めの場合は店舗へお問い合わせください'),
          (f'{ja}は通販で買えますか',
           'SEAMの会員制オンラインショップでお求めいただけます ご登録は店頭のみのご案内です フリマや非正規の出品は真贋や保管状態が分からないため 正規の取扱店をおすすめします')]
    if b.get('nofinder'):
        faqs.append((f'{ja}について詳しく知りたい','在庫・価格・選び方は店頭のスタッフがご案内します お買い物だけのご来店も歓迎です'))
    else:
        faqs.append((f'{ja}が自分に合うか分かりません','合うケアは髪の太さ 量 くせ カラーや矯正の履歴によって変わります SEAMの無料の髪格診断で 今の髪に合うアイテムをご提案します'))

    ld={"@context":"https://schema.org","@graph":[
        {"@type":"Organization","@id":"https://seam.site/#organization","name":"SEAM","url":"https://seam.site/","logo":"https://seam.site/images/apple-touch-icon.png","sameAs":["https://www.instagram.com/seam_japan"]},
        {"@type":"WebPage","@id":url,"url":url,"name":title,"description":desc,"inLanguage":"ja",
         "about":{"@type":"Brand","name":ja,"alternateName":en},
         "publisher":{"@id":"https://seam.site/#organization"}},
        {"@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","position":1,"name":"ホーム","item":"https://seam.site/"},
            {"@type":"ListItem","position":2,"name":"取扱ブランド","item":"https://seam.site/brand"},
            {"@type":"ListItem","position":3,"name":f'{ja} 正規取扱店',"item":url}]},
        {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
        {"@type":"ItemList","name":f'{ja} 取扱店舗',"itemListElement":[
            {"@type":"ListItem","position":i+1,"item":{"@id":f'https://seam.site/store-{s["slug"]}#store',"name":s['name']}} for i,s in enumerate(stores)]},
    ]}
    json.loads(json.dumps(ld,ensure_ascii=False))  # 検証

    maker_row=f'<div class="catrow"><div class="k">メーカー</div><div class="v">{E(b["maker"])}</div></div>' if b.get('maker') else ''
    count_row=f'<div class="catrow"><div class="k">取扱点数</div><div class="v">{count}点(SEAMセレクト掲載分)</div></div>' if count else ''
    lines_html=''
    if lines:
        chips=''.join(f'<span>{E(l)}</span>' for l in lines)
        lines_html=f'<h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">主な取扱ライン</h2>\n    <div class="brandchips mt-5">{chips}</div>\n    <p class="mt-3 text-[12.5px] text-charcoal/65">ラインナップは時期により変わります　<a href="brand.html" class="text-gold hover:underline underline-offset-4">全取扱ブランドを見る →</a></p>'

    tops_html=''
    if tops:
        cards=''
        for p in tops:
            nm=E(f"{p.get('brand')} {p.get('name','')}".strip())
            pr=f'定価 ¥{p["priceApprox"]:,} 税込'
            img=E(p.get('image',''))
            cards+=(f'<div class="rounded-[4px] border border-line bg-white p-4 flex items-center gap-4">'
                    f'<img src="{img}" alt="{nm}" width="64" height="64" loading="lazy" style="width:64px;height:64px;object-fit:contain;flex:none;">'
                    f'<div><p class="text-[13px] text-ink leading-snug">{nm}</p>'
                    f'<p class="mt-1 text-[12px] text-charcoal/65 nums">{pr}</p></div></div>')
        tops_html=(f'<h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">取扱アイテムの例</h2>'
                   f'<div class="mt-5 space-y-3">{cards}</div>'
                   f'<p class="mt-3 text-[12.5px] text-charcoal/65">価格は変わる場合があります　最新は店頭・会員オンラインでご確認ください</p>')

    stores_html=''.join(
        f'<li class="py-3 flex items-start justify-between gap-3"><div>'
        f'<p class="text-[13.5px] text-ink">{E(s["name"])}</p>'
        f'<p class="mt-0.5 text-[12px] text-charcoal/65">{E(s["addr"])}</p></div>'
        f'<a href="store-{s["slug"]}.html" class="shrink-0 text-[12px] text-gold hover:underline underline-offset-4 pt-1">店舗情報 →</a></li>'
        for s in stores)

    if b.get('nofinder'):
        cta=( '<div class="mt-12 rounded-[4px] bg-cream/60 border border-line px-6 py-9 text-center">'
              '<p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Visit</p>'
              f'<h3 class="font-serif text-[19px] sm:text-[22px] text-ink leading-snug">{E(ja)}のご相談は店頭で</h3>'
              '<p class="mt-4 text-[12.5px] sm:text-[13.5px] text-charcoal/75 max-w-sm mx-auto">在庫・価格・選び方はスタッフがご案内します<br>お買い物だけのご来店も歓迎です</p>'
              '<a href="shop.html#stores" class="mt-6 inline-flex items-center justify-center gap-3 px-7 py-3.5 text-white font-serif text-[14.5px] rounded-full shadow-card" style="background:#B57C5A;letter-spacing:.02em;">'
              '<span>近くの店舗を探す</span><span class="inline-flex items-center justify-center w-8 h-8 rounded-full" style="background:#fff;color:#B57C5A;">→</span></a></div>')
    else:
        cta=( '<div class="mt-12 rounded-[4px] bg-cream/60 border border-line px-6 py-9 text-center">'
              '<p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Hair Finder</p>'
              f'<h3 class="font-serif text-[19px] sm:text-[22px] text-ink leading-snug">{E(ja)}が今の髪に合うか<br>3分でわかります</h3>'
              '<p class="mt-4 text-[12.5px] sm:text-[13.5px] text-charcoal/75 max-w-sm mx-auto">髪の太さ・量・くせ・カラーや矯正の履歴から<br>140ブランド横断であなたに合うアイテムをご提案します</p>'
              '<a href="finder.html" class="mt-6 inline-flex items-center justify-center gap-3 px-7 py-3.5 text-white font-serif text-[14.5px] rounded-full shadow-card" style="background:#B57C5A;letter-spacing:.02em;">'
              '<span>無料で髪格診断する</span><span class="inline-flex items-center justify-center w-8 h-8 rounded-full" style="background:#fff;color:#B57C5A;">→</span></a>'
              '<p class="mt-4 text-[12px] text-charcoal/60">実際に見て選びたい方は <a href="shop.html" class="text-gold hover:underline underline-offset-4">SEAMの店舗</a> へ（購入だけの来店OK）</p></div>')

    faq_html=''.join(
        f'<div class="py-4"><dt class="font-serif text-[14.5px] text-ink">{E(q)}</dt>'
        f'<dd class="mt-2 text-[13px] leading-[1.9] text-charcoal/75">{E(a)}</dd></div>' for q,a in faqs)

    cross_html=''
    links=[('guide-salon-senyo','サロン専売品とは')]+[(f'{s}',n+' 取扱店') for s,n in b.get('cross',[])]
    cross_html=' '.join(f'<a href="{s}.html" class="hover:text-ink border-b border-line pb-0.5">{E(n)}</a>' for s,n in links)

    return f'''<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{E(title)}</title>
  <meta name="description" content="{E(desc)}">
  <link rel="canonical" href="{url}">
  <meta property="og:site_name" content="SEAM">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{E(ja)} 取扱店・正規販売店 | SEAM">
  <meta property="og:description" content="{E(desc)}">
  <meta property="og:image" content="https://seam.site/images/og/seam-og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="https://seam.site/images/og/seam-og.jpg">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="apple-touch-icon" href="images/apple-touch-icon.png">
  <link rel="icon" href="images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Noto+Serif+JP:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/tailwind.css">
  <script type="application/ld+json">{json.dumps(ld,ensure_ascii=False,separators=(",",":"))}</script>
  <style>
    body{{font-family:'Noto Serif JP',serif;background:#FFFFFF;color:#2B2926;-webkit-font-smoothing:antialiased;}}
    .wm{{font-family:'Cormorant Garamond',serif;letter-spacing:.24em;}}
    .prose p{{line-height:2.05;}}
    a{{color:inherit;}}
    .brandchips{{display:flex;flex-wrap:wrap;gap:7px;}}
    .brandchips span{{display:inline-block;font-size:12px;line-height:1;padding:8px 12px;border-radius:999px;background:#F6F1EA;border:1px solid rgba(60,54,46,.1);color:#4A4238;white-space:nowrap;}}
    .catrow{{display:flex;gap:10px;align-items:flex-start;}}
    .catrow .k{{flex:none;width:5.5em;font-size:12.5px;color:#A87456;padding-top:1px;}}
    .catrow .v{{font-size:13.5px;color:rgba(43,41,38,.82);line-height:1.9;}}
    .nums{{font-variant-numeric:tabular-nums;}}
  </style>
</head>
<body>
  <header class="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-line">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
      <a href="index.html" class="wm text-[19px] text-ink" aria-label="SEAM ホーム">SEAM</a>
      <nav class="flex items-center gap-5 text-[12px] text-charcoal/80">
        <a href="brand.html" class="hover:text-ink">取扱ブランド</a>
        <a href="shop.html" class="hover:text-ink">店舗</a>
        <a href="finder.html" class="hover:text-ink">髪格診断</a>
      </nav>
    </div>
  </header>

  <article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
    <nav class="font-mono tracking-widest2 text-[10px] text-charcoal/50 uppercase mb-6">
      <a href="index.html" class="hover:text-ink">Home</a> <span class="mx-1">/</span> <a href="brand.html" class="hover:text-ink">Brands</a> <span class="mx-1">/</span> {E(en)}
    </nav>
    <p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Authorized Dealer</p>
    <h1 class="font-serif text-[27px] sm:text-[34px] leading-[1.4] text-ink font-medium">{E(ja)}<span class="block mt-1 text-[16px] sm:text-[19px] text-charcoal/70 font-normal">（{E(en)}）正規取扱店</span></h1>
    <p class="mt-6 text-[14px] sm:text-[15px] text-charcoal/80">{b['blurb']}</p>

    <div class="mt-7 space-y-3">
      <div class="catrow"><div class="k">取扱形態</div><div class="v">メーカー公認 正規取扱店（正規ルート品のみ）</div></div>
      {maker_row}
      {count_row}
      <div class="catrow"><div class="k">購入方法</div><div class="v">全国7店舗の店頭 ＋ 会員制オンラインショップ（ご登録は店頭のみ）</div></div>
    </div>

    {lines_html}

    {tops_html}

    <h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">{E(ja)}を取り扱う SEAMの店舗</h2>
    <ul class="mt-4 divide-y divide-line">{stores_html}</ul>
    <p class="mt-3 text-[12.5px] text-charcoal/65">取扱・在庫状況は店舗により異なります　お買い物だけのご来店も歓迎です</p>

    {cta}

    <h2 class="mt-14 font-serif text-[19px] sm:text-[22px] text-ink">よくある質問</h2>
    <dl class="mt-5 divide-y divide-line">{faq_html}</dl>

    <p class="mt-10 text-[13px] text-charcoal/75">関連ページ　{cross_html}</p>

    <div class="mt-12 flex items-center justify-between text-[12px] text-charcoal/60">
      <a href="brand.html" class="hover:text-ink">← 取扱ブランド一覧</a>
      <a href="shop.html" class="hover:text-ink">店舗一覧を見る →</a>
    </div>
  </article>

  <footer class="border-t border-line mt-12">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
      <a href="index.html" class="wm text-[16px] text-ink">SEAM</a>
      <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-charcoal/70">
        <a href="finder.html" class="hover:text-ink">髪格診断</a>
        <a href="shop.html" class="hover:text-ink">店舗</a>
        <a href="hairsalon.html" class="hover:text-ink">ヘアサロン</a>
        <a href="brand.html" class="hover:text-ink">取扱ブランド</a>
      </nav>
      <p class="font-mono text-[10px] tracking-widest2 uppercase text-charcoal/40">© SEAM</p>
    </div>
  <p class="legal-links" style="margin:8px auto 0;text-align:center;font-size:10.5px;line-height:1.8;color:rgba(58,50,42,.62);max-width:720px;padding:0 20px;"><a href="terms.html" style="text-decoration:underline;">利用規約</a>　<a href="privacy.html" style="text-decoration:underline;">プライバシーポリシー</a>　<a href="tokushoho.html" style="text-decoration:underline;">特定商取引法に基づく表記</a></p>
</footer>

  <script src="js/seam-analytics.js?v=5" defer></script>
  <script>window.addEventListener('load',function(){{try{{window.seamTrack&&seamTrack('guide_view',{{p:location.pathname}})}}catch(e){{}}}});</script>
</body>
</html>
'''

def main():
    stores=load_stores()
    prods=load_products()
    made=[]
    for b in BRANDS:
        count,lines,tops=brand_stats(prods,b['masters']) if b['masters'] else (0,[],[])
        out=page_html(b,stores,count,lines,tops)
        open(f'{b["slug"]}.html','w',encoding='utf-8').write(out)
        made.append((b['slug'],count,len(lines),len(tops)))
    # sitemap
    sm=open('sitemap.xml',encoding='utf-8').read()
    add=''.join(f'  <url><loc>https://seam.site/{b["slug"]}</loc></url>\n' for b in BRANDS
                if f'/{b["slug"]}</loc>' not in sm)
    if add:
        sm=sm.replace('</urlset>', add+'</urlset>')
        open('sitemap.xml','w',encoding='utf-8').write(sm)
    # 店舗ページに取扱ブランドリンク(idempotent)
    MARK='<!-- BRAND_LP_LINKS -->'
    pills=''.join(f'<a href="{b["slug"]}.html" style="display:inline-block;font-size:12px;line-height:1;padding:8px 12px;border-radius:999px;background:#F6F1EA;border:1px solid rgba(60,54,46,.1);color:#4A4238;white-space:nowrap;text-decoration:none;">{html.escape(b["ja"])}</a>' for b in BRANDS)
    block=(f'\n  {MARK}\n  <section class="max-w-3xl mx-auto px-5 sm:px-8 pb-12">\n'
           '    <h2 class="font-serif text-[17px] sm:text-[20px]" style="color:#2B2926;">この店舗で探せる主な正規取扱ブランド</h2>\n'
           f'    <div style="display:flex;flex-wrap:wrap;gap:7px;margin-top:14px;">{pills}</div>\n'
           '    <p style="margin-top:10px;font-size:12px;color:rgba(43,41,38,.6);">取扱・在庫は店舗により異なります　<a href="brand.html" style="color:#B8945A;text-decoration:underline;text-underline-offset:3px;">全ブランド一覧 →</a></p>\n'
           '  </section>\n')
    patched=0
    for s in STORES:
        p=f'store-{s}.html'; t=open(p,encoding='utf-8').read()
        if MARK in t: continue
        i=t.rfind('<footer')
        if i<0: continue
        t=t[:i]+block+t[i:]
        open(p,'w',encoding='utf-8').write(t); patched+=1
    # brand.htmlに内部リンク集(idempotent)
    t=open('brand.html',encoding='utf-8').read()
    if MARK not in t:
        links=' '.join(f'<a href="{b["slug"]}.html" style="color:inherit;border-bottom:1px solid rgba(60,54,46,.25);padding-bottom:1px;text-decoration:none;">{html.escape(b["ja"])} 取扱店</a>' for b in BRANDS)
        bblock=(f'\n  {MARK}\n  <section class="max-w-5xl mx-auto px-5 sm:px-8 pb-12">\n'
                '    <p style="font-size:12.5px;line-height:2.2;color:rgba(43,41,38,.62);">正規取扱について：'+links+
                '　<a href="guide-salon-senyo.html" style="color:#B8945A;">サロン専売品とは →</a></p>\n  </section>\n')
        i=t.rfind('<footer')
        if i>=0:
            t=t[:i]+bblock+t[i:]
            open('brand.html','w',encoding='utf-8').write(t)
            patched+=1
    print('generated:', made)
    print('patched files:', patched)

if __name__=='__main__':
    main()

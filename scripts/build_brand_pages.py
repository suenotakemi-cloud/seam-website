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
  dict(slug='aujua', logo='images/logo_aujua.jpg', ja='オージュア', en='Aujua', masters=['Aujua'], maker='ミルボン',
       blurb='髪質と悩みに合わせてラインを選ぶ サロン専売ヘアケアの代表格<br>シャンプー・トリートメント・アウトバスを揃えて使う設計で 選び方がなにより大切なブランドです',
       cross=[('milbon','ミルボン')], q='オージュア 取扱店'),
  dict(slug='kerastase', logo='images/logo_kerastase.jpg', ja='ケラスターゼ', en='KÉRASTASE', masters=['Kérastase'], maker='ロレアル グループ',
       blurb='パリ発のラグジュアリーヘアケア<br>ダメージケアからスカルプまで ラインの幅広さと世界観で愛され続けるブランドです',
       cross=[('shu-uemura','シュウ ウエムラ')], q='ケラスターゼ 取扱店'),
  dict(slug='tokio', logo='images/logo_tokio_inkarami.jpg', ja='トキオ インカラミ', en='TOKIO INKARAMI', masters=['TOKIO INKARAMI'], maker='ドクタージュニア',
       blurb='特許技術インカラミによる集中補修で知られるサロン専売ブランド<br>ハイダメージ・ブリーチ毛のホームケアの定番です',
       cross=[('bykarte','バイカルテ')], q='TOKIO トリートメント 取扱店'),
  dict(slug='bykarte', logo='images/logo_bykarte.jpg', ja='バイカルテ', en='BYKARTE', masters=['BYKARTE'], maker='ホーユー',
       blurb='「カルテから生まれる」をコンセプトにしたサロン専売ヘアケア<br>SEAMの人気ランキングでも常連のブランドです',
       cross=[('tokio','トキオ インカラミ')], q='バイカルテ 取扱店'),
  dict(slug='shu-uemura', logo='images/logo_shu_uemura.jpg', ja='シュウ ウエムラ', en='shu uemura Art of Hair', masters=[], maker='ロレアル グループ',
       blurb='シュウ ウエムラのヘアケアライン アートオブヘアを店頭でお取り扱いしています<br>ラインナップ・在庫は店舗により異なります 詳しくは店頭でご案内します',
       cross=[('kerastase','ケラスターゼ')], q='シュウウエムラ ヘアケア 取扱店'),
  dict(slug='lashaddict', logo='images/logo_lashaddict.webp', ja='ラッシュアディクト', en='Lashaddict', masters=[], maker=None,
       blurb='サロン専売のまつげ美容液ブランドを正規ルートでお取り扱いしています<br>在庫・価格・使い方は店頭でご案内します',
       cross=[], q='ラッシュアディクト 正規取扱店', nofinder=True),
  dict(slug='sublimic', logo='images/logo_sublimic.jpg', ja='サブリミック', en='SUBLIMIC', masters=['SUBLIMIC'], maker='資生堂プロフェッショナル',
       blurb='資生堂プロフェッショナルのサロン専売ヘアケア<br>髪と頭皮を診て組み合わせる 処方型のラインが特徴です',
       cross=[('shiseido-professional','資生堂プロフェッショナル')], q='サブリミック 取扱店'),
  dict(slug='shiseido-professional', logo=None, ja='資生堂プロフェッショナル', en='SHISEIDO PROFESSIONAL', masters=['SUBLIMIC'], maker='資生堂',
       blurb='資生堂のサロン向けブランド サブリミックやフェンテフォルテなどを正規取扱<br>頭皮ケアからダメージケアまで 目的で選べます',
       cross=[('sublimic','サブリミック')], q='資生堂プロフェッショナル 取扱店'),
  dict(slug='tsururincho', logo='images/lp/store_logos/logo_kaminidoramawo.svg', ja='つるりんちょ。', en='TSURURINCHO', masters=['つるりんちょ。'], maker=None,
       blurb='名前で覚えるかたも多い サロン専売の洗い流さないトリートメント<br>大容量サイズまで店頭でお選びいただけます',
       cross=[], q='つるりんちょ 取扱店'),
  dict(slug='system-professional', logo='images/logo_system_professional.jpg', ja='システムプロフェッショナル', en='System Professional', masters=['System Professional'], maker='ウエラ',
       blurb='髪と頭皮の状態から組み合わせる パーソナライズ型のサロン専売ケア<br>SEAMでも取扱点数の多い主力ブランドです',
       cross=[('kerastase','ケラスターゼ')], q='システムプロフェッショナル 取扱店'),
  dict(slug='milbon', logo='images/logo_milbon.webp', ja='ミルボン', en='MILBON', masters=['Global Milbon','Global Milbon Premium Position','Elujuda','Milbon'], maker='ミルボン',
       blurb='グローバルミルボン・エルジューダ・ジェミールフランなど サロン専売の総合メーカー<br>オージュアも同社のブランドです(専用ページあり)',
       cross=[('aujua','オージュア')], q='ミルボン 取扱店'),
]

AREA_JA={'ginza':'銀座','omotesando':'表参道','sapporo':'札幌','osaka':'大阪',
         'nagoya':'名古屋','fukuoka':'福岡','utsunomiya':'宇都宮'}

# エリア固有コンテンツ(重複回避 = 各エリアの実在アクセス+街の性格を厚めにユニーク化)
# access は store-*.html 本文の実記載と一致 / paras は既知の街の地理・性格+SEAMの実ポリシー(買うだけOK/会員はオンライン)のみ(客層等の憶測は書かない)
AREA_INFO={
 'ginza':      dict(access='銀座一丁目駅 7番出口から徒歩1分（銀座駅・京橋駅からも歩けます）', paras=[
   '銀座は百貨店やラグジュアリーブランドが集まる 日本を代表する商業地です。美容室やコスメの路面店も多く ヘアケアを見比べながら選びたい方に向いた街です。',
   'SEAM GINZAは銀座一丁目駅 7番出口から徒歩1分。銀座駅・京橋駅からも歩け 松屋や銀座三越といった百貨店エリアからも近い立地です。',
   '施術もご予約もいりません。銀座での買い物や会食のついでに サロン専売ヘアケアだけを"買うだけ"で選べます。会員価格で続けたい方は 店頭でそのままメンバー登録も可能です。']),
 'omotesando': dict(access='表参道駅 A4出口から徒歩3分（南青山エリア）', paras=[
   '表参道・南青山は ファッションとビューティの発信地です。感度の高いショップが軒を連ね 新しいヘアケアをいち早く手に取れる街として知られています。',
   'SEAMは表参道駅 A4出口から徒歩3分 青山通りやキャットストリートにも近い南青山エリアにあります。',
   '美容室帰りや買い物の途中に 気になっていた一本を実際に見て選べます。予約は不要で お買い物だけのご来店を歓迎しています。']),
 'sapporo':    dict(access='地下鉄大通駅から徒歩1分', paras=[
   '札幌の中心・大通は 大通公園や狸小路商店街に近い街の中心部です。地下歩行空間からもアクセスしやすく 天候を気にせず立ち寄れます。',
   'SEAMは地下鉄大通駅から徒歩1分。すすきの方面へも歩ける立地で 都心でのお出かけの動線に組み込みやすい場所です。',
   '寒暖差や乾燥の気になる北海道では 保湿・補修のホームケアを切らさず揃えたいもの。施術なしで サロン専売品だけを買い足せます。']),
 'osaka':      dict(access='四ツ橋駅 6番出口から徒歩2分（南堀江）', paras=[
   '南堀江は セレクトショップやカフェが並ぶ大阪・ミナミのおしゃれエリアです。アメリカ村や心斎橋・なんばからも歩ける距離にあります。',
   'SEAMは四ツ橋駅 6番出口から徒歩2分。堀江での買い物やカフェめぐりの合間に立ち寄りやすい立地です。',
   '施術・予約は不要。ホームケアをまとめて揃えたいときも サロン専売品だけを"買うだけ"で選べます。会員登録は店頭でご案内しています。']),
 'nagoya':     dict(access='矢場町駅からすぐ（栄エリア・1階と2階のフロア）', paras=[
   '栄は パルコや松坂屋が集まる名古屋随一の商業地です。矢場町駅からすぐの通り沿いに SEAMは1階と2階のフロアで構えています。',
   '栄での買い物の帰りに そのまま立ち寄れる動線の良さが特長です。',
   '実際に手に取りながら サロン専売ヘアケアを選べます。施術は不要で お買い物だけのご来店も歓迎。会員価格で続けたい方は店頭で登録できます。']),
 'fukuoka':    dict(access='西鉄天神駅から徒歩5分（大名）', paras=[
   '大名は 天神に隣接する福岡の流行発信地です。路面のセレクトショップやカフェが集まり 買い物の合間に立ち寄りやすいエリアです。',
   'SEAMは西鉄天神駅から徒歩5分。天神の百貨店エリアからも歩ける大名の一角にあります。',
   'アウトバスやスタイリングなど 気になっていたアイテムを実際に試しながら選べます。予約不要 お買い物だけのご来店も歓迎です。']),
 'utsunomiya': dict(access='鶴田駅から徒歩6分（お車での来店もしやすい立地）', paras=[
   'SEAMの宇都宮店は 市内・鶴田エリアにあります。ロードサイドで駐車もしやすく お車での立ち寄りに向いた立地です。',
   'JR鶴田駅からは徒歩6分。日々の買い物やお出かけの動線に組み込みやすい場所です。',
   'シャンプー・トリートメントの買い足しから 大容量サイズまで。施術なしで サロン専売ヘアケアだけを"買うだけ"で選べます。']),
}

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
        # 営業時間(あれば) と Instagram
        hours=''
        oh=node.get('openingHoursSpecification') or node.get('openingHours')
        if isinstance(oh,list) and oh and isinstance(oh[0],dict):
            o=oh[0]
            if o.get('opens') and o.get('closes'):
                hours=f"{o['opens']}–{o['closes']}"
        elif isinstance(oh,str):
            hours=oh
        ig=''
        for u in node.get('sameAs',[]) or []:
            if 'instagram.com' in u: ig=u; break
        out.append(dict(slug=s, name=node.get('name',f'SEAM {s.upper()}'), addr=addr,
                        area=AREA_JA[s], hours=hours, ig=ig))
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
    title=f'{ja} 取扱店・正規販売店｜SEAM'  # 32字以内(検索結果の切れ防止)
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
              '<a href="shop.html#stores" class="mt-6 inline-flex items-center justify-center gap-3 px-7 py-3.5 text-white font-serif text-[14.5px] rounded-full shadow-card" style="background:#16171B;letter-spacing:.02em;">'
              '<span>近くの店舗を探す</span><span class="inline-flex items-center justify-center w-8 h-8 rounded-full" style="background:#fff;color:#B57C5A;">→</span></a></div>')
    else:
        cta=( '<div class="mt-12 rounded-[4px] bg-cream/60 border border-line px-6 py-9 text-center">'
              '<p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Hair Finder</p>'
              f'<h3 class="font-serif text-[19px] sm:text-[22px] text-ink leading-snug">{E(ja)}が今の髪に合うか<br>3分でわかります</h3>'
              '<p class="mt-4 text-[12.5px] sm:text-[13.5px] text-charcoal/75 max-w-sm mx-auto">髪の太さ・量・くせ・カラーや矯正の履歴から<br>197ブランド横断であなたに合うアイテムをご提案します</p>'
              '<a href="finder.html" class="mt-6 inline-flex items-center justify-center gap-3 px-7 py-3.5 text-white font-serif text-[14.5px] rounded-full shadow-card" style="background:#16171B;letter-spacing:.02em;">'
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
    <p class="mt-4 text-[13px] text-charcoal/75" style="line-height:2.1;">エリア別のご案内　{' '.join(f'<a href="{slug}-{s["slug"]}.html" class="hover:text-ink border-b border-line pb-0.5">{E(s["area"])}で買うだけOK</a>' for s in stores)}</p>

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

def area_article_html(b, st, stores, lines, tops):
    """「{ブランド} {エリア}で買うだけOK」記事 — ShellBear型の購入意図ページ"""
    ja,en,slug=b['ja'],b['en'],b['slug']
    area=st['area']; page=f'{slug}-{st["slug"]}'
    url=f'https://seam.site/{page}'
    ainfo=AREA_INFO.get(st['slug'],{})
    access=ainfo.get('access','')
    title=f'{ja} {area}で買える｜正規取扱店 SEAM'  # 32字以内(検索結果の切れ防止)
    desc=f'{area}で{ja}({en})を"買うだけ"で来店OK 施術・予約なしで店頭購入できます {st["name"]}({access or st["addr"]}) メーカー公認の正規取扱店 在庫は店舗にご確認ください'
    hours_line=f'　営業時間 {st["hours"]}' if st.get('hours') else ''
    access_line=f' {access}' if access else ''

    faqs=[(f'{area}で{ja}を買うだけの来店はできますか',
           f'はい {st["name"]}では施術やご予約がなくても {ja}をお買い求めいただけます お買い物だけのご来店を歓迎しています'),
          (f'{area}店へのアクセスは',
           f'{access or st["addr"]}です{hours_line}'),
          ('予約は必要ですか',
           f'不要です{access_line} 営業時間内にそのままお越しください'),
          ('会員でなくても買えますか',
           '店頭はどなたでもご購入いただけます 会員制はオンラインショップのみで ご登録は店頭でご案内しています'),
          (f'{ja}の在庫はありますか',
           f'在庫は時期により変わります 確実にお求めの場合は {st["name"]}のInstagramや店頭でご確認ください')]

    ld={"@context":"https://schema.org","@graph":[
        {"@type":"Organization","@id":"https://seam.site/#organization","name":"SEAM","url":"https://seam.site/","logo":"https://seam.site/images/apple-touch-icon.png","sameAs":["https://www.instagram.com/seam_japan"]},
        {"@type":"WebPage","@id":url,"url":url,"name":title,"description":desc,"inLanguage":"ja",
         "about":{"@type":"Brand","name":ja,"alternateName":en},
         "mainEntity":{"@id":f'https://seam.site/store-{st["slug"]}#store'},
         "publisher":{"@id":"https://seam.site/#organization"}},
        {"@type":"BreadcrumbList","itemListElement":[
            {"@type":"ListItem","position":1,"name":"ホーム","item":"https://seam.site/"},
            {"@type":"ListItem","position":2,"name":f'{ja} 正規取扱店',"item":f'https://seam.site/{slug}'},
            {"@type":"ListItem","position":3,"name":f'{area}で買うだけOK',"item":url}]},
        {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in faqs]},
    ]}
    json.loads(json.dumps(ld,ensure_ascii=False))

    ig_row=f'<div class="catrow"><div class="k">Instagram</div><div class="v"><a href="{E(st["ig"])}" target="_blank" rel="noopener" class="text-gold hover:underline underline-offset-4">店舗アカウントを見る ↗</a>(在庫のお問い合わせもこちらへ)</div></div>' if st.get('ig') else ''
    hours_row=f'<div class="catrow"><div class="k">営業時間</div><div class="v nums">{E(st["hours"])}</div></div>' if st.get('hours') else ''
    access_row=f'<div class="catrow"><div class="k">アクセス</div><div class="v">{E(access)}</div></div>' if access else ''
    # エリア固有セクション(重複回避のユニークコンテンツ)
    area_html=''
    if ainfo and ainfo.get('paras'):
        paras=''.join(f'<p class="mt-4 text-[13.5px] sm:text-[14px] text-charcoal/80" style="line-height:2.05;">{E(t)}</p>' for t in ainfo['paras'])
        area_html=f'<h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">{E(area)}での立ち寄り方</h2>{paras}'

    # ブランドロゴ帯(ロゴ無しは銘板)
    if b.get('logo'):
        logo_html=(f'<div class="mt-7 rounded-[4px] border border-line bg-white px-6 py-5 flex items-center justify-center">'
                   f'<img src="{E(b["logo"])}" alt="{E(ja)} ロゴ" loading="lazy" decoding="async" style="max-height:44px;max-width:70%;object-fit:contain;mix-blend-mode:multiply;"></div>')
    else:
        logo_html=(f'<div class="mt-7 rounded-[4px] border border-line bg-white px-6 py-6 text-center">'
                   f'<span class="font-serif text-[17px] tracking-[0.18em] text-ink">{E(en)}</span></div>')

    lines_html=''
    if lines:
        chips=''.join(f'<span>{E(l)}</span>' for l in lines[:6])
        lines_html=f'<h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">この店舗で出会える {E(ja)}</h2>\n    <div class="brandchips mt-5">{chips}</div>'

    # 商品詳細カード(公式画像+容量+定価+ひとことコピー)
    tops_html=''
    if tops:
        cards=''
        for p in tops[:3]:
            nm=E(p.get('name',''))
            size=E(p.get('primarySize','') or '')
            pitch=E((p.get('pitchCopy') or p.get('cardCopy') or '').strip())
            img=E(p.get('image',''))
            meta=' ・ '.join(x for x in [size, f'定価 ¥{p["priceApprox"]:,} 税込'] if x)
            cards+=(f'<div class="rounded-[4px] border border-line bg-white p-4">'
                    f'<div class="flex items-start gap-4">'
                    f'<img src="{img}" alt="{E(ja)} {nm}" width="72" height="72" loading="lazy" decoding="async" style="width:72px;height:72px;object-fit:contain;flex:none;">'
                    f'<div class="min-w-0"><p class="text-[13.5px] text-ink leading-snug">{nm}</p>'
                    f'<p class="mt-1 text-[11.5px] text-charcoal/60 nums">{meta}</p>'
                    f'<p class="mt-2 text-[12px] leading-[1.8] text-charcoal/75">{pitch}</p></div></div></div>')
        tops_html=(f'<h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">取扱アイテムと ひとこと詳細</h2>'
                   f'<div class="mt-5 space-y-3">{cards}</div>'
                   f'<p class="mt-3 text-[12px] text-charcoal/60">価格・仕様は変わる場合があります　このほかの{E(ja)}も店頭に揃っています</p>')

    # ショップ/オンラインショップ誘導(会員制の原則: 店頭は誰でも・オンラインは会員のみ)
    guide_html=(
        '<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">買い方は 2とおり</h2>'
        '<div class="mt-5 space-y-3">'
        f'<a href="store-{st["slug"]}.html" class="block rounded-[4px] border border-line bg-cream/50 px-5 py-5 hover:border-gold transition-colors">'
        f'<p class="font-mono tracking-widest2 text-[9.5px] text-gold uppercase">In Store</p>'
        f'<p class="mt-1.5 font-serif text-[15.5px] text-ink">{E(st["name"])}の店頭で選ぶ →</p>'
        f'<p class="mt-1 text-[12px] text-charcoal/70">どなたでも購入OK ・ 予約不要 ・ {E(ja)}を実際に手に取れます</p></a>'
        '<a href="onlineshop.html" class="block rounded-[4px] px-5 py-5 transition-opacity hover:opacity-90" style="background:#15120E;">'
        '<p class="font-mono tracking-widest2 text-[9.5px] uppercase" style="color:#D9BE93;">Members Only</p>'
        '<p class="mt-1.5 font-serif text-[15.5px] text-white">会員制オンラインショップ →</p>'
        '<p class="mt-1 text-[12px]" style="color:rgba(255,255,255,.75);">サロン専売品を会員価格で ・ ご登録は店頭のみ</p></a>'
        '</div>')

    others=' '.join(f'<a href="{slug}-{o["slug"]}.html" class="hover:text-ink border-b border-line pb-0.5">{E(o["area"])}</a>' for o in stores if o['slug']!=st['slug'])

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
  <meta property="og:type" content="article">
  <meta property="og:url" content="{url}">
  <meta property="og:title" content="{E(ja)} {E(area)}で買うだけOK | SEAM">
  <meta property="og:description" content="{E(desc)}">
  <meta property="og:image" content="https://seam.site/images/og/seam-og.jpg">
  <meta name="twitter:card" content="summary_large_image">
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
    .catrow .k{{flex:none;width:6.5em;font-size:12.5px;color:#A87456;padding-top:1px;}}
    .catrow .v{{font-size:13.5px;color:rgba(43,41,38,.82);line-height:1.9;}}
    .nums{{font-variant-numeric:tabular-nums;}}
    .step{{display:flex;gap:12px;align-items:flex-start;}}
    .step .n{{flex:none;width:26px;height:26px;border-radius:999px;background:#16171B;color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center;}}
  </style>
</head>
<body>
  <header class="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-line">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
      <a href="index.html" class="wm text-[19px] text-ink" aria-label="SEAM ホーム">SEAM</a>
      <nav class="flex items-center gap-5 text-[12px] text-charcoal/80">
        <a href="{slug}.html" class="hover:text-ink">{E(ja)}取扱店</a>
        <a href="store-{st['slug']}.html" class="hover:text-ink">店舗情報</a>
      </nav>
    </div>
  </header>

  <article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
    <nav class="font-mono tracking-widest2 text-[10px] text-charcoal/50 uppercase mb-6">
      <a href="index.html" class="hover:text-ink">Home</a> <span class="mx-1">/</span> <a href="{slug}.html" class="hover:text-ink">{E(en)}</a> <span class="mx-1">/</span> {E(st['slug'].upper())}
    </nav>
    <p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Buy Only ・ Walk-in Welcome</p>
    <h1 class="font-serif text-[26px] sm:text-[33px] leading-[1.45] text-ink font-medium">{E(ja)}<br>{E(area)}で"買うだけ"OK</h1>
    <p class="mt-6 text-[14px] sm:text-[15px] text-charcoal/80">
      施術もご予約もいりません<br>{E(st['name'])}は {E(ja)}をメーカー公認の正規ルートで取り扱うヘアケアショップ<br>お買い物だけのご来店を歓迎しています
    </p>

    {logo_html}

    <h2 class="mt-10 font-serif text-[19px] sm:text-[22px] text-ink">店舗のご案内</h2>
    <div class="mt-5 space-y-3">
      <div class="catrow"><div class="k">店名</div><div class="v">{E(st['name'])}</div></div>
      <div class="catrow"><div class="k">住所</div><div class="v">{E(st['addr'])}</div></div>
      {access_row}
      {hours_row}
      {ig_row}
      <div class="catrow"><div class="k">くわしく</div><div class="v"><a href="store-{st['slug']}.html" class="text-gold hover:underline underline-offset-4">店舗ページ(アクセス・写真) →</a></div></div>
    </div>

    {area_html}

    {lines_html}
    {tops_html}

    {guide_html}

    <div class="mt-12 rounded-[4px] bg-cream/60 border border-line px-6 py-8 text-center">
      <p class="font-mono tracking-widest2 text-[10px] text-gold uppercase mb-3">Hair Finder</p>
      <h3 class="font-serif text-[18px] sm:text-[21px] text-ink leading-snug">来店前に 合うかどうか知りたい方へ</h3>
      <p class="mt-3 text-[12.5px] sm:text-[13.5px] text-charcoal/75 max-w-sm mx-auto">無料の髪格診断で 髪質・履歴から<br>あなたに合うアイテムを先にチェックできます</p>
      <a href="finder.html" class="mt-5 inline-flex items-center justify-center gap-3 px-7 py-3 text-white font-serif text-[14px] rounded-full shadow-card" style="background:#16171B;letter-spacing:.02em;">
        <span>無料で髪格診断する</span><span aria-hidden>→</span>
      </a>
    </div>

    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">よくある質問</h2>
    <dl class="mt-5 divide-y divide-line">{''.join(f'<div class="py-4"><dt class="font-serif text-[14.5px] text-ink">{E(q)}</dt><dd class="mt-2 text-[13px] leading-[1.9] text-charcoal/75">{E(a)}</dd></div>' for q,a in faqs)}</dl>

    <p class="mt-10 text-[13px] text-charcoal/75" style="line-height:2.1;">ほかのエリアで探す　{others}</p>

    <div class="mt-10 flex items-center justify-between text-[12px] text-charcoal/60">
      <a href="{slug}.html" class="hover:text-ink">← {E(ja)} 正規取扱店トップ</a>
      <a href="store-{st['slug']}.html" class="hover:text-ink">{E(st['name'])} →</a>
    </div>
  </article>

  <footer class="border-t border-line mt-12">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 py-10 flex flex-col sm:flex-row items-center justify-between gap-5">
      <a href="index.html" class="wm text-[16px] text-ink">SEAM</a>
      <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-charcoal/70">
        <a href="finder.html" class="hover:text-ink">髪格診断</a>
        <a href="shop.html" class="hover:text-ink">店舗</a>
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
        # エリア×ブランド記事(買うだけOK型) 7本/ブランド
        for st in stores:
            art=area_article_html(b,st,stores,lines,tops)
            open(f'{b["slug"]}-{st["slug"]}.html','w',encoding='utf-8').write(art)
    # sitemapはCI(build-i18n.js)が再生成する管理物=直接書かず jaUrls を同期する
    ci='.github/scripts/build-i18n.js'
    t=open(ci,encoding='utf-8').read()
    slugs=[f'/{b["slug"]}' for b in BRANDS]+[f'/{b["slug"]}-{s}' for b in BRANDS for s in STORES]
    miss=[s for s in slugs if f"'{s}'" not in t]
    if miss:
        i=t.index('];', t.index('const jaUrls'))
        t=t[:i]+',\n    '+', '.join(f"'{s}'" for s in miss)+t[i:]
        open(ci,'w',encoding='utf-8').write(t)
        print('build-i18n.js jaUrls 同期:', len(miss))
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
    # 店舗→自エリアのブランド別記事(買うだけOK)への内部リンク(idempotent・別マーカー)
    MARK2='<!-- AREA_LP_LINKS -->'
    for s in STORES:
        p=f'store-{s}.html'; t=open(p,encoding='utf-8').read()
        if MARK2 in t: continue
        ja=AREA_JA[s]
        alinks='　'.join(f'<a href="{b["slug"]}-{s}.html" style="color:inherit;border-bottom:1px solid rgba(60,54,46,.25);padding-bottom:1px;text-decoration:none;">{html.escape(b["ja"])}</a>' for b in BRANDS)
        ablk=(f'\n  {MARK2}\n  <section class="max-w-3xl mx-auto px-5 sm:px-8 pb-12">\n'
              f'    <h2 class="font-serif text-[17px] sm:text-[20px]" style="color:#2B2926;">{ja}でブランド別に見る（買うだけOK）</h2>\n'
              f'    <p style="margin-top:12px;font-size:12.5px;line-height:2.3;color:rgba(43,41,38,.72);">{alinks}</p>\n'
              f'    <p style="margin-top:10px;font-size:12px;color:rgba(43,41,38,.6);">各ブランドの{ja}での購入案内です　施術・予約なしで店頭購入OK</p>\n'
              '  </section>\n')
        i=t.rfind('<footer')
        if i<0: continue
        t=t[:i]+ablk+t[i:]; open(p,'w',encoding='utf-8').write(t); patched+=1
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

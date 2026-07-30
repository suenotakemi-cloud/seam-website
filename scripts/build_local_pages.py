#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
地域×サービス のローカルLPを生成する。

狙い(オーナー指定):
  「大阪ヘッドスパ / 心斎橋ヘッドスパ / 堀江ヘッドスパ」
  「名古屋ヘッドスパ / 栄ヘッドスパ / 矢場町ヘッドスパ」
  ヘアサロンも同様 ／ ブランド×都市(オージュア 東京 など)
  買うだけ・販売のみ・ネットショップ

設計方針(重要):
  同じ1店舗を街名ごとに別ページへ割ると Google のドアウェイページ判定に当たる。
  よって「1店舗=1ページ」に統一し、その1枚の中で近隣の街・駅名を
  “実際に近い順に・虚偽の徒歩分数なしで” 網羅する。分数を書くのは
  store-*.html のJSON-LDに載っている実測アクセスだけ。

出力: repo-root。seam-public/ へは呼び出し側でコピーする。
"""
import json, os, re, html as H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = 'https://seam.site'
E = lambda s: H.escape(str(s), quote=True)

# ── 実データ (store-*.html の JSON-LD / headspa.html / hairsalon.html から抽出済) ──
STORES = {
 'ginza': dict(
   area='銀座', name='SEAM GINZA', pref='東京都', locality='中央区',
   street='銀座1-8-19 ONE GINZA 3F', lat='35.67437', lng='139.768539',
   access='銀座一丁目駅 7番出口 徒歩1分', hours='11:00–20:00',
   opens='11:00', closes='20:00',
   # 近隣: 徒歩分数は書かない(実測がないため)。エリアとしての近さのみ述べる
   near=['銀座', '銀座一丁目', '有楽町', '京橋', '東銀座', '日本橋'],
   nearline='銀座一丁目駅の7番出口から徒歩1分 有楽町・京橋・東銀座からも歩いて来られる場所です',
   note='ONE GINZA の3階　銀座で夜20時まで開いている数少ないサロン専売ショップです　ヘアサロンとヘッドスパを同じフロアに構えています',
   photo='images/stores/store_ginza.jpg', pw=1024, ph=576,
   ig='seam.ginza',
   salon_hpb='H000802192', spa_hpb='H000802373', spa_set='ginza'),
 'omotesando': dict(
   area='表参道', name='gallica / SEAM', pref='東京都', locality='港区',
   street='南青山3-15-15 Louis IIビル', lat='35.664959', lng='139.715393',
   access='表参道駅 A4出口 徒歩3分', hours='10:00–20:00',
   opens='10:00', closes='20:00',
   near=['表参道', '南青山', '青山', '外苑前', '原宿'],
   nearline='表参道駅のA4出口から徒歩3分 南青山・外苑前・原宿からも歩ける立地です',
   note='南青山のLouis IIビル　表参道・外苑前・原宿のいずれからも歩ける立地で 夜20時まで開いています',
   photo='images/stores/store_omotesando.jpg', pw=765, ph=1024,
   ig='gallica_seam',
   salon_hpb=None, spa_hpb=None, spa_set=None),
 'sapporo': dict(
   area='札幌', name='SEAM SAPPORO', pref='北海道', locality='札幌市中央区',
   street='南2条西3-15-2', lat='43.058239', lng='141.3535',
   access='地下鉄大通駅 徒歩1分', hours='平日 10:00–20:00 ／ 土 10:00–19:00 ／ 日 10:00–17:30',
   opens='10:00', closes='20:00',
   near=['札幌', '大通', '狸小路', 'すすきの', '札幌駅'],
   nearline='地下鉄大通駅から徒歩1分 狸小路・すすきの・札幌駅からも地下歩行空間でつながっています',
   note='南2条西 大通駅から地下でつながる立地　平日は夜20時まで 土日も営業しています　個室は半個室でご用意しています',
   photo='images/stores/store_sapporo.jpg', pw=765, ph=1024,
   ig='seam.sapporo',
   awards=('HOT PEPPER Beauty AWARD 2026　BEST SALON GOLD Prize 受賞',
           'HOT PEPPER Beauty AWARD 2025　サロン部門 GOLD Prize 受賞'),
   salon_hpb='H000417753', spa_hpb=None, spa_set=None),
 'osaka': dict(
   area='大阪', name='SEAM OSAKA HORIE', pref='大阪府', locality='大阪市西区',
   street='南堀江1-11-21 STORK南堀江 1F', lat='34.672447', lng='135.496017',
   access='四ツ橋駅 6番出口 徒歩2分', hours='11:00–19:00',
   opens='11:00', closes='19:00',
   near=['大阪', '堀江', '南堀江', '心斎橋', '四ツ橋', 'アメリカ村', 'なんば'],
   nearline='四ツ橋駅の6番出口から徒歩2分 心斎橋・アメリカ村・なんばからも歩いて来られる南堀江です',
   note='STORK南堀江の1階　スコープで頭皮を見る診断つきのコースを置いている店舗です　フェイシャルエステやハーブピーリングも同じ個室でお受けいただけます　料金体系も他店と異なります',
   photo='images/stores/store_osaka.jpg', pw=572, ph=1024,
   ig='seam.osaka',
   salon_hpb='H000791476', spa_hpb='H000791418', spa_set='osaka'),
 'nagoya': dict(
   area='名古屋', name='SEAM NAGOYA', pref='愛知県', locality='名古屋市中区',
   street='栄5-16-19 ネイリックス 1F・2F', lat='35.163364', lng='136.909698',
   access='矢場町駅 すぐ', hours='11:00–19:00',
   opens='11:00', closes='19:00',
   near=['名古屋', '栄', '矢場町', '大須', '伏見', '上前津'],
   nearline='矢場町駅からすぐ 栄・大須・上前津からも歩ける栄エリアです',
   note='ネイリックスの1階と2階 2フロアを使った店舗です　栄・矢場町・大須から歩けて ヘアサロンとヘッドスパを併設しています',
   photo='images/stores/store_nagoya.jpg', pw=819, ph=1024,
   ig='seam.nagoya',
   # 2026-07 スタイリスト不在のためヘアの受付を休止中(ヘッドスパとショップは営業)
   salon_paused=True,
   salon_hpb='H000800028', spa_hpb='H000800971', spa_set='nagoya'),
 'fukuoka': dict(
   area='福岡', name='SEAM FUKUOKA', pref='福岡県', locality='福岡市中央区',
   street='大名2丁目1-53 BPRスクエア天神大名 1F', lat='33.589043', lng='130.395996',
   access='西鉄天神駅 徒歩5分', hours='10:00–19:00（日曜 〜18:00）',
   opens='10:00', closes='19:00',
   near=['福岡', '天神', '大名', '今泉', '赤坂', '警固'],
   nearline='西鉄天神駅から徒歩5分 今泉・赤坂・警固からも歩ける大名です',
   note='BPRスクエア天神大名の1階　天神・今泉・赤坂から歩ける大名エリアです　日曜は18時までの営業　個室は半個室でご用意しています',
   photo='images/stores/store_fukuoka.jpg', pw=1100, ph=821,
   ig='seam.fukuoka',
   salon_hpb='H000734442', spa_hpb=None, spa_set=None),
 'utsunomiya': dict(
   area='宇都宮', name='gigi SEAM', pref='栃木県', locality='宇都宮市',
   street='鶴田町419-7 インターパーク内', lat='36.542316', lng='139.856384',
   access='JR鶴田駅 徒歩6分', hours='9:00–19:00（火曜定休）',
   opens='9:00', closes='19:00',
   near=['宇都宮', '鶴田', 'インターパーク'],
   nearline='JR鶴田駅から徒歩6分 お車での来店もしやすいインターパーク内です',
   note='インターパーク内　お車での来店がしやすく 朝9時から開いています　火曜定休です',
   photo='images/stores/store_gigi.jpg', pw=1024, ph=819,
   ig='gigi_seam_utsunomiya',
   salon_hpb=None, spa_hpb=None, spa_set=None),
}

# ── ヘッドスパ 実メニュー(headspa.html から) ──
# sameAs で自社の店舗ページ(store-*.html)を指すために、キーを各店舗dictへ持たせる
for _slug, _st in STORES.items():
    _st['slug'] = _slug
    _st.setdefault('awards', ())   # 受賞はHPB掲載で裏が取れる店だけに出す
    # ヘアの受付を休止している店。受けられない予約をサイトから送らないための旗
    _st.setdefault('salon_paused', False)

# ヘッドスパの料金・コース名はホットペッパービューティーの掲載(実測 2026-07-28)に合わせる。
# 「合わせる」とは、掲載に無いコースをサイト独自に載せないということ。
# 3店とも別の値付け・別のラインナップなので、店舗ごとに独立した表を持つ(共用しない)。
# 銀座のHPB表記は「頭身浴」だが、サイト側の表記は「頭浸浴」で統一(オーナー指定)。
SPA_MENU = {
 'ginza': [
   ('ショートヘッドスパ', '45min', '¥12,000', '短時間でも整う 予定の合間に', ''),
   ('深眠クリームヘッドスパ ライト', '60min', '¥13,800', '完全個室＆ブロー付き 初めての方に', '来店〜退店 約75分'),
   ('首肩までほどけるクリームヘッドスパ', '90min', '¥17,800', '頭浸浴付き 首・肩・デコルテまで 人気No.1', '来店〜退店 約90分'),
   ('深く落ちるプレミアムヘッドスパ', '120min', '¥20,800', '頭浸浴付き 足元から頭の先まで全身リセット', '来店〜退店 約120分'),
   ('プレミアムスパ', '150min', '¥25,000', '頭浸浴付き 深く落ちる最上位コース', '来店〜退店 約150分'),
 ],
 'nagoya': [
   ('個室シャンプーヘッドスパ', '60min', '¥8,800', '睡眠×肩こり 初めての方に人気', ''),
   ('頭皮ケア・眼精疲労ヘッドスパ', '60min', '¥8,800', 'メンズ限定 目の疲れと頭皮に', ''),
   ('首肩までほどけるクリームヘッドスパ', '90min', '¥13,200', '頭浸浴付き 人気No.1', ''),
   ('深く落ちるプレミアムヘッドスパ', '120min', '¥17,600', '頭浸浴付き じっくりリカバリー', ''),
   ('トリートメント付プレミアムスパ', '150min', '¥21,800', '最上位 選べるトリートメント付き', ''),
 ],
 'osaka': [
   ('頭浸浴×ウェットヘッドスパ', '60min', '¥11,800', '深層筋までゆるめる本格ウェットヘッドスパ', ''),
   ('頭皮診断＋頭浸浴＋ウェットヘッドスパ', '60min', '¥12,800', 'スコープで施術前後の頭皮を確認', ''),
   ('頭浸浴×ウェットヘッドスパ', '90min', '¥15,800', 'シャンプーしながら寝落ちする究極睡眠 人気No.1', ''),
   ('頭皮診断＋頭浸浴＋ウェットヘッドスパ＋首肩ケア', '90min', '¥16,800', '毛穴汚れをリセット 首肩まで', ''),
   ('頭皮診断＋頭浸浴＋ウェットヘッドスパ＋デコルテ', '120min', '¥19,800', 'オーダーメイドで根本から', ''),
 ],
}

SPA_OPT = {
 'ginza': [('マッサージ 15分延長', '+¥2,200'), ('マッサージ 30分延長', '+¥4,400'),
           ('プレミアム美髪トリートメント', '+¥10,350'), ('眼のマッサージ', '+¥1,100')],
 'nagoya': [('マッサージ 15分延長', '+¥2,200'), ('マッサージ 30分延長', '+¥4,400')],
 'osaka': [('システムトリートメント追加', '+¥3,300'), ('バイカルテトリートメント', '+¥9,900')],
}

# ── ヘアサロン 実メニュー(hairsalon.html から) ──
SALON_MENU = {
 'ginza': [('【完全個室】カット＋トリートメント', '¥9,900'),
           ('【完全個室】カット＋髪質改善トリートメント', '¥22,000'),
           ('【完全個室】カット＋ケアカラー＋トリートメント', '¥24,000'),
           ('睡眠クリームヘッドスパ', '¥13,800')],
 'sapporo': [('【ヘアリセット】カット＋オージュアTR＋毛髪クレンジング', '¥11,000'),
             ('【頭皮改善】カット＋頭皮洗浄', '¥6,600'),
             ('【髪へ水分補給を】シルクカラー＋高濃度水素バイカルテTR', '¥16,700'),
             ('【最上級のストレート】超高濃度水素シルク縮毛矯正＋カット＋バイカルテ', '¥26,600')],
 'fukuoka': [('【お気軽体験】オージュアTR', '¥3,300'),
             ('【個室で疲労回復】筋膜リリース&アミノクレンジング&オージュアTR', '¥6,600'),
             ('【顔まわりで印象チェンジ】顔周りカット＋ケアカラー＋3stepTR', '¥11,000'),
             ('【迷ったらこれ】似合わせカット＋ケアカラー＋3stepTR', '¥13,200'),
             ('【広がり、うねりを整える】髪質改善ストレート＋カット＋3stepTR', '¥21,000')],
 'osaka': [('【毛髪診断】オーダーメイドトリートメント BYKARTE / Aujua / TOKIO', '¥9,900'),
           ('日々の疲れに 頭浸浴×ウェットヘッドスパ', '¥14,000'),
           ('人気No.1 オーダーメイドトリートメント＆極上ヘッドスパ30分', '¥14,900'),
           ('頭浸浴×ウエットヘッドスパ 90分', '¥16,800')],
 'nagoya': [],   # 現行サイトに掲載がない= 捏造しない。HPBへ誘導する
}

BRANDS = [
 ('aujua','オージュア','Aujua'), ('kerastase','ケラスターゼ','KÉRASTASE'),
 ('tokio','トキオ インカラミ','TOKIO INKARAMI'), ('bykarte','バイカルテ','BYKARTE'),
 ('shu-uemura','シュウ ウエムラ','shu uemura Art of Hair'), ('lashaddict','ラッシュアディクト','Lashaddict'),
 ('sublimic','サブリミック','SUBLIMIC'), ('shiseido-professional','資生堂プロフェッショナル','SHISEIDO PROFESSIONAL'),
 ('tsururincho','つるりんちょ。','TSURURINCHO'), ('system-professional','システムプロフェッショナル','System Professional'),
 ('milbon','ミルボン','MILBON'),
]

FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com">\n'
 '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
 '  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500'
 '&family=Noto+Serif+JP:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500&display=swap" rel="stylesheet">')

STYLE = """  <style>
    body{font-family:'Noto Serif JP',serif;background:#FFFFFF;color:#2B2926;-webkit-font-smoothing:antialiased;}
    .wm{font-family:'Cormorant Garamond',serif;letter-spacing:.24em;}
    .prose p{line-height:2.05;}
    a{color:inherit;}
    .nums{font-variant-numeric:tabular-nums;}
    .chips{display:flex;flex-wrap:wrap;gap:7px;}
    .chips span{display:inline-block;font-size:12px;line-height:1;padding:8px 12px;border-radius:999px;background:#F6F1EA;border:1px solid rgba(60,54,46,.1);color:#4A4238;white-space:nowrap;}
    .menu{border-top:1px solid rgba(60,54,46,.12);}
    .menu li{border-bottom:1px solid rgba(60,54,46,.12);padding:14px 0;}
    .kv{display:flex;gap:10px;align-items:flex-start;}
    .kv .k{flex:none;width:5.5em;font-size:12px;color:#A87456;padding-top:2px;}
    .kv .v{font-size:13.5px;color:rgba(43,41,38,.85);line-height:1.9;}
  </style>"""


def head(title, desc, url, ld, ogtitle):
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
  <meta property="og:title" content="{E(ogtitle)}">
  <meta property="og:description" content="{E(desc)}">
  <meta property="og:image" content="https://seam.site/images/og/seam-og.jpg">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="theme-color" content="#FFFFFF">
  <link rel="apple-touch-icon" href="images/apple-touch-icon.png">
  <link rel="icon" href="images/favicon.svg" type="image/svg+xml">
  {FONTS}
  <link rel="stylesheet" href="css/tailwind.css">
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False, separators=(",", ":"))}</script>
{STYLE}
</head>
<body>'''


def header_nav(links):
    nav = ' '.join(f'<a href="{h}" class="hover:text-ink">{E(t)}</a>' for h, t in links)
    return f'''
  <header class="sticky top-0 z-40 bg-white/92 backdrop-blur-md border-b border-line">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
      <a href="index.html" class="wm text-[19px] text-ink" aria-label="SEAM ホーム">SEAM</a>
      <nav class="flex items-center gap-5 text-[12px] text-charcoal/80">{nav}</nav>
    </div>
  </header>'''


def crumbs(items):
    inner = ' <span class="text-charcoal/35">/</span> '.join(
        (f'<a href="{h}" class="hover:text-ink border-b border-line pb-0.5">{E(t)}</a>' if h else f'<span class="text-charcoal/60">{E(t)}</span>')
        for t, h in items)
    return f'<nav class="text-[11.5px] text-charcoal/70" aria-label="パンくず">{inner}</nav>'


def faq_html(qa):
    rows = ''.join(
        '<details class="group border-b border-line py-4">'
        f'<summary class="flex items-start justify-between gap-4 cursor-pointer list-none">'
        f'<span class="font-serif text-[14.5px] text-ink">{E(q)}</span>'
        '<span aria-hidden class="flex-none text-gold transition-transform group-open:rotate-45">＋</span></summary>'
        f'<p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;">{a}</p></details>'
        for q, a in qa)
    return rows


def ld_faq(qa):
    return {"@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub(r'<[^>]+>', '', a)}}
        for q, a in qa]}


def ld_bc(items):
    return {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": t, "item": (BASE + '/' + h.replace('.html', '') if h else None)}
        for i, (t, h) in enumerate(items) if True]}


def price_range(rows):
    """そのページに実際に載っている料金だけから価格帯を作る（相場の捏造はしない）"""
    yen = [int(re.sub(r'[^0-9]', '', c)) for r in rows for c in r if isinstance(c, str) and c.startswith('¥')]
    if not yen:
        return None
    lo, hi = min(yen), max(yen)
    return f'¥{lo:,}' if lo == hi else f'¥{lo:,}〜¥{hi:,}'


def ld_place(st, kind, url, menu=None):
    """kind: HairSalon / DaySpa

    店舗ページ(store-*.html)と同じ「同一エンティティである」という線を必ず張る。
    sameAs に Instagram店舗アカウント・ホットペッパー掲載・自社の店舗ページを並べると、
    Google はこのLPと実在の店舗を1つの事業所として結びつけられる。
    ここが無いと、地域LPが「どこの店の話かわからないページ」として独立評価される。
    ヘアはサロン掲載、スパはスパ掲載(kr/)と、種別に対応する掲載だけを指す。
    """
    d = {"@type": kind, "@id": url + '#place', "name": st['name'],
         "url": url, "image": BASE + '/' + st['photo'],
         "address": {"@type": "PostalAddress", "streetAddress": st['street'],
                     "addressLocality": st['locality'], "addressRegion": st['pref'],
                     "addressCountry": "JP"},
         "geo": {"@type": "GeoCoordinates", "latitude": st['lat'], "longitude": st['lng']},
         "hasMap": map_url(st),
         "openingHoursSpecification": [{"@type": "OpeningHoursSpecification",
                                        "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
                                        "opens": st['opens'], "closes": st['closes']}],
         "areaServed": [{"@type": "Place", "name": n} for n in st['near']],
         "parentOrganization": {"@type": "Organization", "name": "SEAM", "url": BASE + "/"}}

    same = [f"https://www.instagram.com/{st['ig']}/", f"{BASE}/store-{st['slug']}"]
    hpb = st['spa_hpb'] if kind == 'DaySpa' else st['salon_hpb']
    if hpb:
        same.append(f"https://beauty.hotpepper.jp/{'kr/' if kind == 'DaySpa' else ''}sln{hpb}/")
    d['sameAs'] = same

    pr = price_range(menu or [])
    if pr:
        d['priceRange'] = pr
    return d


FOOTER_NOTE = ('<p class="mt-10 text-[11.5px] text-charcoal/55" style="line-height:1.95;">'
               '掲載の料金・営業時間は変更になる場合があります 最新の情報は各予約ページでご確認ください</p>')

# store-*.html と同じ形式のGoogleマップ検索URL(埋め込みではなく検索リンク=APIキー不要)
def map_url(st):
    from urllib.parse import quote
    q = f"SEAM {st['pref']}{st['locality']}{st['street']}"
    return 'https://www.google.com/maps/search/?api=1&query=' + quote(q)


def photo_block(st, caption):
    """店舗の実写真。avif/webp を優先し、実寸を入れてCLSを出さない。"""
    base = st['photo'].rsplit('.', 1)[0]
    return (f'<figure class="mt-7 overflow-hidden rounded-[4px]">'
            f'<picture>'
            f'<source srcset="{base}.avif" type="image/avif">'
            f'<source srcset="{base}.webp" type="image/webp">'
            f'<img src="{st["photo"]}" alt="{E(st["name"])}の店内" '
            f'width="{st["pw"]}" height="{st["ph"]}" loading="lazy" decoding="async" '
            f'class="w-full h-auto object-cover" style="max-height:380px;object-position:center;">'
            f'</picture>'
            f'<figcaption class="mt-2 text-[11.5px] text-charcoal/55">{E(caption)}</figcaption></figure>')


# store-*.html に載っている実際の取扱ブランド(一次情報)
STORE_BRANDS = ['オージュア（Aujua）', 'ミルボン / グローバルミルボン', 'サブリミック（SUBLIMIC）',
                'システムプロフェッショナル', 'ケラスターゼ（Kérastase）', 'TOKIO インカラミ',
                'Oggi otto（オッジオット）', 'REKERA（リケラ）', 'LOA（ロア）', 'つるりんちょ。',
                'エルジューダ', 'ダヴィネス（Davines）', 'ハホニコ', 'ルベル']


def brands_block(slug, area):
    chips = ''.join(f'<span>{E(b)}</span>' for b in STORE_BRANDS[:6])
    return (f'<section class="mt-12">'
            f'<h2 class="font-serif text-[19px] text-ink">{E(area)}店で買える主なブランド</h2>'
            f'<p class="mt-2.5 text-[13px] text-charcoal/75" style="line-height:2;">'
            f'197のサロン専売ブランドを正規取扱しています　施術を受けなくても'
            f'<a href="store-{slug}.html" class="border-b border-line">購入だけのご来店</a>ができます</p>'
            f'<div class="chips mt-4">{chips}</div>'
            f'<p class="mt-3.5 text-[12px] text-charcoal/60">在庫は店舗・時期により異なります　'
            f'<a href="brand.html" class="border-b border-line">取扱ブランド一覧を見る →</a></p></section>')


def flow_block(steps, note=''):
    rows = ''.join(
        f'<div class="flex gap-3.5 items-start">'
        f'<span class="flex-none mt-0.5 font-mono text-[10px] tracking-widest2 text-gold nums">{i+1:02d}</span>'
        f'<span class="text-[13.5px] text-charcoal/85" style="line-height:1.95;">'
        f'<strong class="font-normal text-ink">{E(t)}</strong><br>{E(d)}</span></div>'
        for i, (t, d) in enumerate(steps))
    tail = f'<p class="mt-4 text-[12px] text-charcoal/60">{E(note)}</p>' if note else ''
    return (f'<section class="mt-12"><h2 class="font-serif text-[19px] text-ink">当日の流れ</h2>'
            f'<div class="mt-5 space-y-4">{rows}</div>{tail}</section>')


def access_block(st, extra_rows=()):
    rows = ''.join(f'<div class="kv"><span class="k">{E(k)}</span><span class="v">{v}</span></div>'
                   for k, v in extra_rows)
    return (f'<section class="mt-12">'
            f'<h2 class="font-serif text-[19px] text-ink">{E(st["area"])}店の場所と営業時間</h2>'
            f'<div class="mt-4 space-y-2.5">'
            f'<div class="kv"><span class="k">店舗</span><span class="v">{E(st["name"])}</span></div>'
            f'<div class="kv"><span class="k">住所</span><span class="v">{E(st["pref"])}{E(st["locality"])}{E(st["street"])}</span></div>'
            f'<div class="kv"><span class="k">アクセス</span><span class="v">{E(st["access"])}</span></div>'
            f'<div class="kv"><span class="k">営業時間</span><span class="v nums">{E(st["hours"])}</span></div>'
            f'{rows}</div>'
            f'<a href="{map_url(st)}" target="_blank" rel="noopener" '
            f'class="mt-4 inline-block text-[12.5px] border-b border-line hover:text-ink">Googleマップで開く ↗</a>'
            f'</section>')


def area_articles_block(slug, area):
    """その街のブランド別「買うだけOK」記事へ内部リンク(既存77本を活かす)"""
    ls = ' '.join(f'<a href="{b}-{slug}.html" class="hover:text-ink border-b border-line pb-0.5">{E(ja)}</a>'
                  for b, ja, _ in BRANDS)
    return (f'<section class="mt-12"><h2 class="font-serif text-[19px] text-ink">'
            f'{E(area)}でブランド別に買う</h2>'
            f'<p class="mt-3 text-[13px] text-charcoal/75" style="line-height:2.1;">{ls}</p></section>')


def sticky_cta(label, href, track):
    """モバイル追従の予約ボタン。本文が隠れないよう body に余白を足す。"""
    return (f'<div class="fixed inset-x-0 bottom-0 z-50 sm:hidden px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3" '
            f'style="background:linear-gradient(to top,rgba(255,255,255,.98) 62%,rgba(255,255,255,0));">'
            f'<a href="{href}" target="_blank" rel="noopener" data-track-click="{track}" '
            f'class="flex items-center justify-center rounded-[6px] px-5 py-3.5 text-[14px] text-white" '
            f'style="background:#16171B;">{E(label)}</a></div>')


def foot():
    return '''
  <footer class="border-t border-line mt-16">
    <div class="max-w-3xl mx-auto px-5 sm:px-8 py-10 text-[12px] text-charcoal/70">
      <p class="wm text-[17px] text-ink">SEAM</p>
      <p class="mt-2">サロン専売ヘアケアの正規取扱店 ／ 全国7店舗</p>
      <p class="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        <a href="index.html" class="hover:text-ink">ホーム</a>
        <a href="shop.html" class="hover:text-ink">店舗で買う</a>
        <a href="onlineshop.html" class="hover:text-ink">ネットショップ（会員制）</a>
        <a href="brand.html" class="hover:text-ink">取扱ブランド</a>
        <a href="hairsalon.html" class="hover:text-ink">ヘアサロン</a>
        <a href="headspa.html" class="hover:text-ink">ヘッドスパ</a>
        <a href="finder.html" class="hover:text-ink">髪格診断</a>
      </p>
    </div>
  </footer>
</body>
</html>
'''


# ══════════════════════════════════════ ヘッドスパ 店舗別LP ══════════════════════════════════════
def awards_block(st):
    """受賞は「その店舗が獲ったもの」だけを出す。無ければ何も出さない。

    【重要・2026-07-28 オーナー訂正】
    福岡のHPB掲載にも「ホットペッパービューティーアワードゴールド受賞／髪カリスマ
    カット部門受賞」と書かれているが、**これは札幌店が獲った受賞**で、掲載上は
    「札幌の受賞サロンが福岡に出店する」という意味で載せている。福岡店の受賞ではない。
    したがって awards を持つのは札幌のみ。HPB掲載に受賞の文字があることを根拠に
    他店へ広げてはいけない。
    """
    if not st['awards']:
        return ''
    items = ''.join(
        f'<li class="flex items-start gap-2"><span aria-hidden style="color:#B8945A;">✦</span>'
        f'<span>{E(a)}</span></li>' for a in st['awards'])
    return ('<section class="mt-8 rounded-[10px] px-4 py-4" style="border:1px solid rgba(184,148,90,.42);background:rgba(184,148,90,.06);">'
            '<p class="font-mono text-[9.5px] tracking-widest2 uppercase" style="color:#B8945A;">Award</p>'
            f'<ul class="mt-2 space-y-1.5 text-[13px] text-charcoal/85" style="line-height:1.85;">{items}</ul>'
            '</section>')


def note_x(x):
    """コース補足。HPBに掲載が無い項目は空欄のまま出す(推測で埋めない)"""
    return f'　<span class="text-charcoal/50">{E(x)}</span>' if x else ''


def build_spa(slug):
    st = STORES[slug]; a = st['area']
    url = f'{BASE}/headspa-{slug}'
    menus = SPA_MENU[st['spa_set']]
    kw = '・'.join(st['near'][:4])
    title = f'{a}のヘッドスパ｜完全個室 {st["name"]}'
    if len(title) > 32: title = f'{a}のヘッドスパ｜完全個室のSEAM'
    desc = (f'{a}で完全個室のヘッドスパをお探しの方へ｜{kw}エリアの{st["name"]}｜'
            f'{menus[0][2]}〜のコースをスパニストが担当します｜{st["access"]}｜営業時間 {st["hours"]}')[:120]

    qa = [
     (f'{a}のどのあたりにありますか', f'{st["nearline"]}　住所は{st["pref"]}{st["locality"]}{st["street"]}です'),
     ('完全個室ですか', 'はい 施術は完全個室でご案内します 人目を気にせず眠ってしまう方も多い時間です'),
     ('頭皮の状態は見てもらえますか', 'はい 大阪 堀江店にはスコープで頭皮を確認する診断つきのコースがあります 施術前後の変化を目で見て確かめられます'
      if st['spa_set'] == 'osaka' else '施術の前に頭や首肩の張りをうかがってから力加減を合わせます スコープで頭皮を見る診断つきのコースは大阪 堀江店でご用意しています'),
     ('ヘアケア用品だけ買いに行くこともできますか',
      f'できます {st["name"]}は<a href="store-{slug}.html" class="border-b border-line">サロン専売品の正規取扱店</a>を併設していて 予約なし・施術なしの販売のみのご来店も歓迎です'),
     ('予約はどこからできますか', 'ホットペッパービューティーから24時間ご予約いただけます ページ内のボタンからそのまま進めます'),
    ]
    ld = {"@context": "https://schema.org", "@graph": [
        ld_place(st, "DaySpa", url, SPA_MENU[st["spa_set"]]),
        {"@type": "WebPage", "@id": url + '#page', "url": url, "name": title, "description": desc,
         "inLanguage": "ja", "isPartOf": {"@type": "WebSite", "name": "SEAM", "url": BASE + "/"}},
        ld_bc([('ホーム', 'index.html'), ('ヘッドスパ', 'headspa.html'), (f'{a}のヘッドスパ', f'headspa-{slug}.html')]),
        ld_faq(qa),
    ]}

    mrows = ''.join(
        f'<li class="flex items-baseline justify-between gap-4">'
        f'<span><span class="font-serif text-[14.5px] text-ink">{E(n)}</span>'
        f'<span class="ml-2 font-mono text-[10.5px] tracking-widest2 text-gold">{E(t)}</span>'
        f'<span class="block mt-1 text-[12.5px] text-charcoal/70">{E(d)}{note_x(x)}</span></span>'
        f'<span class="flex-none nums font-serif text-[15px] text-ink">{E(p)}</span></li>'
        for n, t, p, d, x in menus)
    opts = ' ／ '.join(f'{E(n)} {E(p)}' for n, p in SPA_OPT[st['spa_set']])
    spa_url = f'https://beauty.hotpepper.jp/kr/sln{st["spa_hpb"]}/'
    others = ' '.join(f'<a href="headspa-{s}.html" class="hover:text-ink border-b border-line pb-0.5">{E(STORES[s]["area"])}</a>'
                      for s in ('ginza', 'nagoya', 'osaka') if s != slug)

    shortest = min(menus, key=lambda m: int(m[2].replace('¥', '').replace(',', '')))
    flow = flow_block([
        ('ご来店・カウンセリング', f'頭や首肩の張り 睡眠や目の疲れなど 今の状態をうかがいます'),
        ('完全個室へご案内', 'まわりを気にせず過ごせる個室です　途中で眠ってしまう方も多い時間です'),
        ('施術', f'いちばん短いコースで{menus[0][1]}　完全個室でそのままお休みいただけます'),
        ('仕上げ・ホームケアのご相談', f'ご希望があれば197ブランドから今の頭皮と髪に合うものをご案内します'),
    ], note=f'いちばん短いコースは{shortest[0]}（{shortest[1]}・{shortest[2]}）です')

    return head(title, desc, url, ld, f'{a}のヘッドスパ｜完全個室 {st["name"]} | SEAM') + header_nav(
        [('headspa.html', 'ヘッドスパ'), (f'store-{slug}.html', '店舗情報')]) + f'''
  <main class="max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-4" style="padding-bottom:88px;">
    {crumbs([('ホーム', 'index.html'), ('ヘッドスパ', 'headspa.html'), (f'{a}のヘッドスパ', None)])}
    <p class="mt-7 font-mono tracking-widest2 text-[10px] uppercase text-gold">Head Spa · {E(a)}</p>
    <h1 class="mt-3 font-serif text-[27px] sm:text-[34px] leading-[1.3] text-ink" style="letter-spacing:.02em;font-weight:500;">{E(a)}で完全個室のヘッドスパ</h1>
    <p class="mt-4 text-[14px] text-charcoal/85" style="line-height:2.05;">{E(st['nearline'])}<br>頭も首も肩も ほどけていく時間を完全個室でご用意しています</p>
    <div class="chips mt-5">{''.join(f'<span>{E(n)}</span>' for n in st['near'])}</div>
    {photo_block(st, f'{st["name"]}（{st["access"]}）')}

    <section class="mt-10 border-l-2 pl-4" style="border-color:#D9BE93;">
      <h2 class="font-serif text-[16px] text-ink">この店舗について</h2>
      <p class="mt-2 text-[13.5px] text-charcoal/80" style="line-height:2;">{E(st['note'])}</p>
    </section>
    {awards_block(st)}

    <section class="mt-11">
      <h2 class="font-serif text-[19px] text-ink">コースと料金</h2>
      <p class="mt-2 text-[12.5px] text-charcoal/65">{E(st['name'])}の料金です　会員価格・当日空き状況はホットペッパービューティーで</p>
      <ul class="menu mt-5">{mrows}</ul>
      <p class="mt-4 text-[12.5px] text-charcoal/70">オプション　{opts}</p>
      <a href="{spa_url}" target="_blank" rel="noopener" data-track-click="spa_reserve_hpb"
         class="mt-6 inline-block rounded-[4px] px-6 py-3.5 text-[13.5px] text-white transition-opacity hover:opacity-90" style="background:#16171B;">{E(a)}のヘッドスパを予約する →</a>
    </section>

    {flow}

    {access_block(st, [('ご予約', 'ホットペッパービューティーから24時間受付')])}

    {brands_block(slug, a)}

    <section class="mt-12 rounded-[4px] px-5 py-6" style="background:#F6F1EA;">
      <h2 class="font-serif text-[17px] text-ink">ヘアケア用品の購入だけでもどうぞ</h2>
      <p class="mt-2.5 text-[13.5px] text-charcoal/80" style="line-height:2;">
        {E(st['name'])}は美容室専売品（サロン専売品）の正規取扱店です　施術を受けなくても
        <a href="store-{slug}.html" class="border-b border-line">販売のみのご来店</a>ができます　予約も不要です<br>
        店頭でご登録いただくと 買い足しは<a href="onlineshop.html" class="border-b border-line">会員制のネットショップ</a>からもご注文いただけます</p>
      <p class="mt-4 text-[12.5px] text-charcoal/70">
        <a href="store-{slug}.html" class="border-b border-line">{E(a)}の店舗情報</a>
        <a href="salon-{slug}.html" class="border-b border-line">{E(a)}のヘアサロン</a>
        <a href="finder.html" class="border-b border-line">髪格診断で髪質を知る</a></p>
    </section>

    {area_articles_block(slug, a)}

    <section class="mt-12">
      <h2 class="font-serif text-[19px] text-ink">よくあるご質問</h2>
      <div class="mt-4">{faq_html(qa)}</div>
    </section>

    <p class="mt-10 text-[12.5px] text-charcoal/70">ほかのエリアのヘッドスパ　{others}</p>
    {FOOTER_NOTE}
  </main>
  {sticky_cta(f'{a}のヘッドスパを予約', spa_url, 'spa_reserve_sticky')}''' + foot()


# ══════════════════════════════════════ ヘアサロン 店舗別LP ══════════════════════════════════════
def build_salon(slug):
    st = STORES[slug]; a = st['area']
    url = f'{BASE}/salon-{slug}'
    menus = SALON_MENU[slug]
    kw = '・'.join(st['near'][:4])
    title = f'{a}のヘアサロン・美容室｜{st["name"]}'
    if len(title) > 32: title = f'{a}のヘアサロン・美容室｜SEAM'
    price = f'{menus[0][1]}〜のメニュー例つき｜' if menus else ''
    desc = (f'{a}でカット・カラー・パーマ・縮毛矯正まで完全個室のヘアサロン｜{kw}エリアの{st["name"]}｜'
            f'{price}197のサロン専売ブランドを知るプロが担当します｜{st["access"]}')[:120]

    qa = [
     (f'{a}のどのあたりですか', f'{st["nearline"]}　住所は{st["pref"]}{st["locality"]}{st["street"]}です'),
     ('個室で受けられますか', '完全個室をご用意しています（札幌・福岡は半個室です）　まわりを気にせずご相談いただけます'),
     ('縮毛矯正やパーマもできますか', 'カット・カラー・パーマ・縮毛矯正・トリートメントまでお受けしています　髪の履歴をうかがったうえでご提案します'),
     ('施術を受けずに商品だけ買えますか',
      f'買えます {st["name"]}は美容室専売品の正規取扱店を併設していて <a href="store-{slug}.html" class="border-b border-line">販売のみのご来店</a>も歓迎です'),
     ('どんなヘアケアを扱っていますか',
      'オージュア・ケラスターゼ・ミルボン・システムプロフェッショナル・バイカルテなど197ブランドから 髪質と履歴に合うものをお選びします'),
    ]
    ld = {"@context": "https://schema.org", "@graph": [
        ld_place(st, "HairSalon", url, SALON_MENU[slug]),
        {"@type": "WebPage", "@id": url + '#page', "url": url, "name": title, "description": desc,
         "inLanguage": "ja", "isPartOf": {"@type": "WebSite", "name": "SEAM", "url": BASE + "/"}},
        ld_bc([('ホーム', 'index.html'), ('ヘアサロン', 'hairsalon.html'), (f'{a}のヘアサロン', f'salon-{slug}.html')]),
        ld_faq(qa),
    ]}

    if menus:
        mrows = ''.join(
            f'<li class="flex items-baseline justify-between gap-4">'
            f'<span class="text-[13.5px] text-charcoal/85">{E(n)}</span>'
            f'<span class="flex-none nums font-serif text-[15px] text-ink">{E(p)}</span></li>' for n, p in menus)
        menu_block = (f'<h2 class="font-serif text-[19px] text-ink">この店舗のメニュー例</h2>'
                      f'<p class="mt-2 text-[12.5px] text-charcoal/65">最新の全メニューと空き状況はホットペッパービューティーで</p>'
                      f'<ul class="menu mt-5">{mrows}</ul>')
    else:
        menu_block = (f'<h2 class="font-serif text-[19px] text-ink">メニューと空き状況</h2>'
                      f'<p class="mt-2.5 text-[13.5px] text-charcoal/80" style="line-height:2;">'
                      f'カット・カラー・パーマ・縮毛矯正・トリートメントまでお受けしています　'
                      f'{E(a)}店の最新メニューと料金はホットペッパービューティーでご確認ください</p>')

    salon_url = f'https://beauty.hotpepper.jp/sln{st["salon_hpb"]}/'
    # 休止中はヘアの予約先を出さない。ヘッドスパが動いていればそちらへ送る
    paused = st['salon_paused']
    if paused and st['spa_hpb']:
        cta_url = f'https://beauty.hotpepper.jp/kr/sln{st["spa_hpb"]}/'
        cta_text, cta_track, cta_blank = f'{a}のヘッドスパを予約する', 'spa_reserve_hpb', ' target="_blank" rel="noopener"'
    elif paused:
        cta_url = f'store-{slug}.html'
        cta_text, cta_track, cta_blank = f'{a}の店舗情報を見る', 'store_info', ''
    else:
        cta_url = salon_url
        cta_text, cta_track, cta_blank = f'{a}のサロンを予約する', 'salon_reserve_hpb', ' target="_blank" rel="noopener"'
    pause_note = (
        '<p class="mt-6 rounded-[10px] px-4 py-3 text-[13px]" '
        'style="border:1px solid rgba(184,148,90,.42);background:rgba(184,148,90,.06);'
        'color:#6B6358;line-height:1.95;">'
        + E(a) + '店のヘアサロンは現在受付を休止しています　'
        'ヘッドスパとサロン専売品のショップは通常どおり営業しています</p>') if paused else ''
    spa_link = (f'　<a href="headspa-{slug}.html" class="border-b border-line">{E(a)}のヘッドスパ</a>'
                if st['spa_hpb'] else '')
    others = ' '.join(f'<a href="salon-{s}.html" class="hover:text-ink border-b border-line pb-0.5">{E(STORES[s]["area"])}</a>'
                      for s in ('ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka') if s != slug)

    room = '半個室' if slug in ('sapporo', 'fukuoka') else '完全個室'
    flow = flow_block([
        ('カウンセリング', 'なりたい仕上がりと 今の髪の履歴（カラー・パーマ・縮毛矯正・ブリーチ）をうかがいます'),
        (f'{room}で施術', f'{room}をご用意しています　まわりを気にせずご相談いただけます'),
        ('仕上げ', 'ご自宅で再現できるよう 乾かし方とスタイリングまでお伝えします'),
        ('ホームケアのご提案', '197のサロン専売ブランドから 髪質と履歴に合うものだけをお選びします　購入は任意です'),
    ])
    concerns = ('<section class="mt-12"><h2 class="font-serif text-[19px] text-ink">こんなお悩みの方へ</h2>'
                '<p class="mt-3 text-[13px] text-charcoal/75" style="line-height:2.1;">'
                '<a href="guide-uneri.html" class="hover:text-ink border-b border-line pb-0.5">うねり・広がり</a> '
                '<a href="guide-damage.html" class="hover:text-ink border-b border-line pb-0.5">ダメージ</a> '
                '<a href="guide-kansou.html" class="hover:text-ink border-b border-line pb-0.5">乾燥</a> '
                '<a href="guide-colorfade.html" class="hover:text-ink border-b border-line pb-0.5">色落ち</a> '
                '<a href="guide-straightening.html" class="hover:text-ink border-b border-line pb-0.5">縮毛矯正後のケア</a> '
                '<a href="guide-perm.html" class="hover:text-ink border-b border-line pb-0.5">パーマの持ち</a> '
                '<a href="guide-bleach.html" class="hover:text-ink border-b border-line pb-0.5">ブリーチ毛</a> '
                '<a href="guide-shiraga.html" class="hover:text-ink border-b border-line pb-0.5">白髪</a> '
                '<a href="guide-scalp.html" class="hover:text-ink border-b border-line pb-0.5">頭皮</a></p></section>')

    return head(title, desc, url, ld, f'{a}のヘアサロン｜{st["name"]} | SEAM') + header_nav(
        [('hairsalon.html', 'ヘアサロン'), (f'store-{slug}.html', '店舗情報')]) + f'''
  <main class="max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-4" style="padding-bottom:88px;">
    {crumbs([('ホーム', 'index.html'), ('ヘアサロン', 'hairsalon.html'), (f'{a}のヘアサロン', None)])}
    <p class="mt-7 font-mono tracking-widest2 text-[10px] uppercase text-gold">Hair Salon · {E(a)}</p>
    <h1 class="mt-3 font-serif text-[27px] sm:text-[34px] leading-[1.3] text-ink" style="letter-spacing:.02em;font-weight:500;">{E(a)}で髪を知る人に任せる</h1>
    <p class="mt-4 text-[14px] text-charcoal/85" style="line-height:2.05;">{E(st['nearline'])}<br>カット・カラー・パーマ・縮毛矯正・トリートメントまで 197のサロン専売ブランドを知るプロが{E(room)}で仕上げます</p>
    <div class="chips mt-5">{''.join(f'<span>{E(n)}</span>' for n in st['near'])}</div>
    {pause_note}
    {photo_block(st, f'{st["name"]}（{st["access"]}）')}

    <section class="mt-10 border-l-2 pl-4" style="border-color:#D9BE93;">
      <h2 class="font-serif text-[16px] text-ink">この店舗について</h2>
      <p class="mt-2 text-[13.5px] text-charcoal/80" style="line-height:2;">{E(st['note'])}</p>
    </section>
    {awards_block(st)}

    <section class="mt-11">{menu_block}
      <a href="{cta_url}"{cta_blank} data-track-click="{cta_track}"
         class="mt-6 inline-block rounded-[4px] px-6 py-3.5 text-[13.5px] text-white transition-opacity hover:opacity-90" style="background:#16171B;">{E(cta_text)} →</a>
    </section>

    {flow}

    {access_block(st, [('個室', f'{room}をご用意しています'), ('ご予約', 'ホットペッパービューティーから24時間受付')])}

    {concerns}

    {brands_block(slug, a)}

    <section class="mt-12 rounded-[4px] px-5 py-6" style="background:#F6F1EA;">
      <h2 class="font-serif text-[17px] text-ink">施術なし 販売のみのご来店も歓迎です</h2>
      <p class="mt-2.5 text-[13.5px] text-charcoal/80" style="line-height:2;">
        {E(st['name'])}は美容室専売品（サロン専売品）の正規取扱店です
        <a href="store-{slug}.html" class="border-b border-line">買うだけのご来店</a>もどうぞ　予約は要りません<br>
        店頭でご登録いただくと 買い足しは<a href="onlineshop.html" class="border-b border-line">会員制のネットショップ</a>からもご注文いただけます</p>
      <p class="mt-4 text-[12.5px] text-charcoal/70">
        <a href="store-{slug}.html" class="border-b border-line">{E(a)}の店舗情報</a>{spa_link}
        <a href="finder.html" class="border-b border-line">髪格診断で髪質を知る</a></p>
    </section>

    {area_articles_block(slug, a)}

    <section class="mt-12">
      <h2 class="font-serif text-[19px] text-ink">よくあるご質問</h2>
      <div class="mt-4">{faq_html(qa)}</div>
    </section>

    <p class="mt-10 text-[12.5px] text-charcoal/70">ほかのエリアのヘアサロン　{others}</p>
    {FOOTER_NOTE}
  </main>
  {sticky_cta(cta_text.replace('する', ''), cta_url, cta_track + '_sticky')}''' + foot()


# ══════════════════════════════════════ ブランド × 都市(東京) ══════════════════════════════════════
# 「オージュア 東京」等の都市名クエリ用。銀座+表参道の2店舗をまとめて比較する内容にして
# 既存の {brand}-ginza / {brand}-omotesando と役割を分ける。
CITY = {
 'tokyo': dict(ja='東京', stores=['ginza', 'omotesando'],
               lead='東京では銀座と表参道の2店舗でお取り扱いしています'),
}


BRAND_FACTS = json.load(open(os.path.join(ROOT, 'scripts', 'brand_facts.json'), encoding='utf-8'))


def build_brand_city(slug, ja, en, city):
    c = CITY[city]; cj = c['ja']
    url = f'{BASE}/{slug}-{city}'
    sts = [STORES[s] for s in c['stores']]
    bf = BRAND_FACTS.get(slug, {})
    lines, n, maker, blurb = bf.get('lines', []), bf.get('n', 0), bf.get('maker', ''), bf.get('blurb', '')
    title = f'{ja} {cj}で買える｜正規取扱店 SEAM'
    if len(title) > 32: title = f'{ja} {cj}の正規取扱店｜SEAM'
    areas = '・'.join(s['area'] for s in sts)
    linehint = f'{"・".join(lines[:3])}など{n}点を掲載｜' if lines else ''
    desc = (f'{cj}で{ja}（{en}）を買うだけの来店OK 施術・予約なしで店頭購入できます｜'
            f'{areas}の2店舗で正規取扱｜{linehint}販売のみのご来店も歓迎 会員制ネットショップでの買い足しにも対応')[:120]

    # ブランド固有のQ&A(1問目)= ページごとに中身が変わる
    if lines:
        q_line = (f'{ja}のどのラインを扱っていますか',
                  f'{"・".join(lines)}などを掲載しています　SEAMの商品ページでは{ja}を{n}点ご紹介しています　'
                  f'店頭の在庫は店舗により異なります')
    else:
        q_line = (f'{ja}はどんなブランドですか', blurb or f'{ja}（{en}）をメーカー公認の正規ルートでお取り扱いしています')

    qa = [
     q_line,
     (f'{cj}のどこで{ja}が買えますか',
      '　'.join(f'{s["name"]}（{s["pref"]}{s["locality"]}{s["street"]} / {s["access"]}）' for s in sts)),
     ('施術を受けずに購入だけできますか',
      f'できます 予約も施術も不要です {ja}を含む美容室専売品を販売のみでお求めいただけます'),
     ('ネットショップでも買えますか',
      f'店頭でご登録いただいた方向けの<a href="onlineshop.html" class="border-b border-line">会員制ネットショップ</a>をご用意しています　'
      f'買い足しはオンラインからご注文いただけます　ご登録は全国7店舗の店頭で承ります'),
     ('正規品ですか',
      f'{ja}は{maker + "の" if maker else ""}メーカー公認の正規ルートでお取り扱いしています'
      if maker else f'{ja}はメーカー公認の正規ルートでお取り扱いしています'),
    ]
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "@id": url + '#page', "url": url, "name": title, "description": desc,
         "inLanguage": "ja", "about": {"@type": "Brand", "name": ja, "alternateName": en},
         "isPartOf": {"@type": "WebSite", "name": "SEAM", "url": BASE + "/"}},
        ld_bc([('ホーム', 'index.html'), (f'{ja}取扱店', f'{slug}.html'), (f'{cj}で買える', f'{slug}-{city}.html')]),
        ld_faq(qa),
    ] + [ld_place(s, "HairSalon", url) for s in sts]}

    if lines:
        chips = ''.join(f'<span>{E(l)}</span>' for l in lines)
        brand_lines_block = (
            f'<p class="mt-5 font-mono tracking-widest2 text-[9.5px] uppercase text-gold">Lines</p>'
            f'<div class="chips mt-2.5">{chips}</div>'
            f'<p class="mt-3.5 text-[12.5px] text-charcoal/70">'
            f'SEAMの商品ページでは{E(ja)}を<span class="nums">{n}</span>点ご紹介しています'
            f'{"　メーカーは「" + E(maker) + "」" if maker else ""}　'
            f'<a href="brand.html?mode=product&amp;brand={slug}" class="border-b border-line">{E(ja)}の商品を見る →</a></p>')
    else:
        brand_lines_block = (
            f'<p class="mt-4 text-[12.5px] text-charcoal/70">'
            f'ラインナップと在庫は店舗により異なります　詳しくは店頭でご案内します　'
            f'<a href="{slug}.html" class="border-b border-line">{E(ja)}の取扱店一覧 →</a></p>')

    def card(s_slug, s):
        b = s['photo'].rsplit('.', 1)[0]
        return (f'<div class="rounded-[4px] border border-line overflow-hidden">'
                f'<picture><source srcset="{b}.avif" type="image/avif"><source srcset="{b}.webp" type="image/webp">'
                f'<img src="{s["photo"]}" alt="{E(s["name"])}の店内" width="{s["pw"]}" height="{s["ph"]}" '
                f'loading="lazy" decoding="async" class="w-full h-auto object-cover" style="max-height:180px;"></picture>'
                f'<div class="px-5 py-5">'
                f'<p class="font-mono tracking-widest2 text-[9.5px] uppercase text-gold">{E(s["area"])}</p>'
                f'<p class="mt-1.5 font-serif text-[16px] text-ink">{E(s["name"])}</p>'
                f'<div class="mt-3 space-y-2">'
                f'<div class="kv"><span class="k">住所</span><span class="v">{E(s["pref"])}{E(s["locality"])}{E(s["street"])}</span></div>'
                f'<div class="kv"><span class="k">アクセス</span><span class="v">{E(s["access"])}</span></div>'
                f'<div class="kv"><span class="k">営業時間</span><span class="v nums">{E(s["hours"])}</span></div></div>'
                f'<p class="mt-3.5 text-[12.5px]"><a href="{slug}-{s_slug}.html" class="border-b border-line">{E(s["area"])}で{E(ja)}を買う →</a>　'
                f'<a href="{map_url(s)}" target="_blank" rel="noopener" class="border-b border-line">地図 ↗</a></p>'
                f'</div></div>')
    cards = ''.join(card(s_slug, s) for s_slug, s in zip(c['stores'], sts))

    return head(title, desc, url, ld, f'{ja} {cj}で買うだけOK | SEAM') + header_nav(
        [(f'{slug}.html', f'{ja}取扱店'), ('shop.html', '店舗一覧')]) + f'''
  <main class="max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-4">
    {crumbs([('ホーム', 'index.html'), (f'{ja}取扱店', f'{slug}.html'), (f'{cj}で買える', None)])}
    <p class="mt-7 font-mono tracking-widest2 text-[10px] uppercase text-gold">{E(en)} · {E(cj)}</p>
    <h1 class="mt-3 font-serif text-[27px] sm:text-[34px] leading-[1.3] text-ink" style="letter-spacing:.02em;font-weight:500;">{E(cj)}で{E(ja)}を買うなら</h1>
    <p class="mt-4 text-[14px] text-charcoal/85" style="line-height:2.05;">{E(c['lead'])}<br>
      施術を受けなくても大丈夫です　予約も要りません　販売のみのご来店を歓迎しています</p>
    <div class="chips mt-5"><span>正規取扱</span><span>買うだけOK</span><span>販売のみ歓迎</span><span>予約不要</span><span>美容室専売品</span></div>

    <section class="mt-11">
      <h2 class="font-serif text-[19px] text-ink">{E(ja)}について</h2>
      <p class="mt-3 text-[13.5px] text-charcoal/85" style="line-height:2.05;">{E(blurb)}</p>
      {brand_lines_block}
    </section>

    <section class="mt-12">
      <h2 class="font-serif text-[19px] text-ink">{E(cj)}の取扱店舗</h2>
      <div class="mt-5 grid gap-4 sm:grid-cols-2">{cards}</div>
    </section>

    <section class="mt-12">
      <h2 class="font-serif text-[19px] text-ink">買い方は3つあります</h2>
      <div class="mt-4 space-y-3.5 text-[13.5px] text-charcoal/85" style="line-height:2;">
        <p><span class="text-gold">01</span>　<strong class="font-normal text-ink">店頭で買うだけ</strong>　{E(areas)}の店頭でそのままご購入いただけます　施術も予約も不要です</p>
        <p><span class="text-gold">02</span>　<strong class="font-normal text-ink">相談してから選ぶ</strong>　髪質と履歴をうかがって197ブランドから候補を絞り込みます</p>
        <p><span class="text-gold">03</span>　<strong class="font-normal text-ink">ネットショップで買い足す</strong>　店頭でご登録いただくと<a href="onlineshop.html" class="border-b border-line">会員制ネットショップ</a>から通販でご注文いただけます</p>
      </div>
    </section>

    <section class="mt-12 rounded-[4px] px-5 py-6" style="background:#F6F1EA;">
      <h2 class="font-serif text-[17px] text-ink">どれを選べばいいか迷ったら</h2>
      <p class="mt-2.5 text-[13.5px] text-charcoal/80" style="line-height:2;">
        <a href="finder.html" class="border-b border-line">髪格診断</a>で髪の太さ・量・くせと今の状態から
        あなたに合うケアをお出しします　登録不要 約3分です</p>
      <p class="mt-4 text-[12.5px] text-charcoal/70">
        <a href="{slug}.html" class="border-b border-line">{E(ja)}の取扱店一覧（全国）</a>　
        <a href="brand.html" class="border-b border-line">取扱ブランド一覧</a>　
        <a href="guide-salon-senyo.html" class="border-b border-line">美容室専売品とは</a></p>
    </section>

    <section class="mt-12">
      <h2 class="font-serif text-[19px] text-ink">よくあるご質問</h2>
      <div class="mt-4">{faq_html(qa)}</div>
    </section>
    {FOOTER_NOTE}
  </main>''' + foot()


# ══════════════════════════════════════ 実行 ══════════════════════════════════════
def w(name, body):
    p = os.path.join(ROOT, name)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(body)
    return name


if __name__ == '__main__':
    made = []
    for s in ('ginza', 'nagoya', 'osaka'):
        made.append(w(f'headspa-{s}.html', build_spa(s)))
    for s in ('ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka'):
        made.append(w(f'salon-{s}.html', build_salon(s)))
    for slug, ja, en in BRANDS:
        made.append(w(f'{slug}-tokyo.html', build_brand_city(slug, ja, en, 'tokyo')))
    print(f'生成 {len(made)}ファイル')
    for m in made:
        print('  ', m)

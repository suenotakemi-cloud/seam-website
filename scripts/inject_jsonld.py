#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
全ページに JSON-LD 構造化データを静的注入する（再実行で安全に置換）。
- Organization + WebSite を全ページに
- shop には 7店舗の HairSalon（実在のNAP=住所/営業時間/IG/地図）
- 各ページに BreadcrumbList と WebPage
静的HTMLに埋めるのが鉄則（JS挿入は一部クローラに読まれない）。
使い方: python3 scripts/inject_jsonld.py
"""
import json, re, os

BASE = "https://seam.site"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # seam-public/
ORG_ID = BASE + "/#organization"
SITE_ID = BASE + "/#website"

ORG = {
    "@type": "Organization",
    "@id": ORG_ID,
    "name": "SEAM",
    "alternateName": "SEAM — Global Hair Care Select Shop",
    "url": BASE + "/",
    "logo": {"@type": "ImageObject", "url": BASE + "/images/apple-touch-icon.png", "width": 180, "height": 180},
    "image": BASE + "/images/og/seam-og.jpg",
    "description": "世界中のサロン専売ヘアケアブランドを集めたセレクトショップ＆サロン／髪格診断で今のあなたに合う一本へ",
    "sameAs": ["https://www.instagram.com/seam_japan"],
}

WEBSITE = {
    "@type": "WebSite",
    "@id": SITE_ID,
    "name": "SEAM",
    "url": BASE + "/",
    "inLanguage": ["ja", "en", "zh-Hans", "zh-Hant", "ko"],
    "publisher": {"@id": ORG_ID},
}

# 全7店舗 — shop.html の実在データに一致（住所/最寄駅/営業時間/IG/地図/HPB）
STORES = [
    {"id": "ginza", "name": "SEAM GINZA", "region": "東京都", "locality": "中央区",
     "street": "銀座1-8-19 ONE GINZA 3F", "hours": ["Mo-Su 11:00-20:00"],
     "ig": "https://www.instagram.com/seam.ginza/", "hpb": "https://beauty.hotpepper.jp/slnH000802192/",
     "map": "https://www.google.com/maps/search/?api=1&query=SEAM%20%E9%8A%80%E5%BA%A7%201-8-19%20ONE%20GINZA%203F"},
    {"id": "omotesando", "name": "gallica / SEAM", "region": "東京都", "locality": "港区",
     "street": "南青山3-15-15 Louis IIビル", "hours": ["Mo-Su 10:00-20:00"],
     "ig": "https://www.instagram.com/gallica_seam/", "hpb": "https://beauty.hotpepper.jp/slnH000802192/",
     "map": "https://www.google.com/maps/search/?api=1&query=%E3%82%AC%E3%83%AA%E3%82%AB%20%E3%82%B7%E3%83%BC%E3%83%A0%20%E5%8D%97%E9%9D%92%E5%B1%B13-15-15%20Louis%20II%E3%83%93%E3%83%AB"},
    {"id": "osaka", "name": "SEAM OSAKA HORIE", "region": "大阪府", "locality": "大阪市西区",
     "street": "南堀江1-11-21 STORK南堀江 1F", "hours": ["Mo-Su 11:00-19:00"],
     "ig": "https://www.instagram.com/seam.osaka/", "hpb": "https://beauty.hotpepper.jp/slnH000791476/",
     "map": "https://www.google.com/maps/search/?api=1&query=SEAM%20%E5%8D%97%E5%A0%80%E6%B1%9F%201-11-21%20STORK%E5%8D%97%E5%A0%80%E6%B1%9F"},
    {"id": "nagoya", "name": "SEAM NAGOYA", "region": "愛知県", "locality": "名古屋市中区",
     "street": "栄5-16-19 ネイリックス 1F・2F", "hours": ["Mo-Su 11:00-19:00"],
     "ig": "https://www.instagram.com/seam.nagoya/", "hpb": "https://beauty.hotpepper.jp/slnH000800028/",
     "map": "https://www.google.com/maps/search/?api=1&query=SEAM%20%E5%90%8D%E5%8F%A4%E5%B1%8B%E6%A0%84%205-16-19%20%E3%83%8D%E3%82%A4%E3%83%AA%E3%83%83%E3%82%AF%E3%82%B9"},
    {"id": "fukuoka", "name": "SEAM FUKUOKA", "region": "福岡県", "locality": "福岡市中央区",
     "street": "大名2丁目1-53 BPRスクエア天神大名 1F", "hours": ["Mo-Sa 10:00-19:00", "Su 10:00-18:00"],
     "ig": "https://www.instagram.com/seam.fukuoka/", "hpb": "https://beauty.hotpepper.jp/slnH000734442/",
     "map": "https://www.google.com/maps/search/?api=1&query=SEAM%20%E5%A4%A9%E7%A5%9E%E5%A4%A7%E5%90%8D%E5%BA%97%20%E5%A4%A7%E5%90%8D2-1-53%20BPR%E3%82%B9%E3%82%AF%E3%82%A8%E3%82%A2%E5%A4%A9%E7%A5%9E%E5%A4%A7%E5%90%8D"},
    {"id": "sapporo", "name": "SEAM SAPPORO", "region": "北海道", "locality": "札幌市中央区",
     "street": "南2条西3-15-2", "hours": ["Mo-Fr 10:00-20:00", "Sa 10:00-19:00", "Su 10:00-17:30"],
     "ig": "https://www.instagram.com/seam.sapporo/", "hpb": "https://beauty.hotpepper.jp/slnH000417753/",
     "map": "https://www.google.com/maps/search/?api=1&query=SEAM%20%E6%9C%AD%E5%B9%8C%20%E5%8D%97%EF%BC%92%E6%9D%A1%E8%A5%BF%EF%BC%93%E4%B8%81%E7%9B%AE15-2"},
    {"id": "gigi", "name": "gigi SEAM", "region": "栃木県", "locality": "宇都宮市",
     "street": "鶴田町419-7 インターパーク内", "hours": ["Mo 09:00-19:00", "We-Su 09:00-19:00"],
     "ig": "https://www.instagram.com/gigi_seam_utsunomiya/", "hpb": "https://beauty.hotpepper.jp/",
     "map": "https://www.google.com/maps/search/?api=1&query=Gigi%20%E5%AE%87%E9%83%BD%E5%AE%AE%20%E9%B6%B4%E7%94%B0%E7%94%BA419-7"},
]


def hairsalon_node(s):
    return {
        "@type": "HairSalon",
        "@id": BASE + "/shop#" + s["id"],
        "name": s["name"],
        "image": BASE + "/images/stores/store_" + s["id"] + ".jpg",
        "url": BASE + "/shop",
        "parentOrganization": {"@id": ORG_ID},
        "address": {
            "@type": "PostalAddress",
            "streetAddress": s["street"],
            "addressLocality": s["locality"],
            "addressRegion": s["region"],
            "addressCountry": "JP",
        },
        "openingHours": s["hours"],
        "hasMap": s["map"],
        "sameAs": [s["ig"], s["hpb"]],
    }


def page_graph(cfg):
    g = [ORG, WEBSITE]
    webpage = {
        "@type": cfg.get("pageType", "WebPage"),
        "@id": cfg["url"] + "#webpage",
        "url": cfg["url"],
        "name": cfg["name"],
        "isPartOf": {"@id": SITE_ID},
        "about": {"@id": ORG_ID},
        "inLanguage": "ja",
        "primaryImageOfPage": cfg.get("image", BASE + "/images/og/seam-og.jpg"),
    }
    if cfg.get("desc"):
        webpage["description"] = cfg["desc"]
    g.append(webpage)
    g.append({
        "@type": "BreadcrumbList",
        "@id": cfg["url"] + "#breadcrumb",
        "itemListElement": [
            {"@type": "ListItem", "position": i + 1, "name": n, "item": u}
            for i, (n, u) in enumerate(cfg["crumbs"])
        ],
    })
    if cfg.get("webApp"):
        wa = cfg["webApp"]
        g.append({
            "@type": "WebApplication",
            "@id": cfg["url"] + "#app",
            "name": wa["name"],
            "url": cfg["url"],
            "applicationCategory": "LifestyleApplication",
            "operatingSystem": "Web",
            "browserRequirements": "Requires JavaScript",
            "inLanguage": "ja",
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "JPY"},
            "description": wa["desc"],
            "provider": {"@id": ORG_ID},
            "publisher": {"@id": ORG_ID},
        })
    if cfg.get("faq"):
        g.append({
            "@type": "FAQPage",
            "@id": cfg["url"] + "#faq",
            "mainEntity": [
                {"@type": "Question", "name": q,
                 "acceptedAnswer": {"@type": "Answer", "text": a}}
                for (q, a) in cfg["faq"]
            ],
        })
    if cfg.get("stores"):
        for s in STORES:
            g.append(hairsalon_node(s))
    return {"@context": "https://schema.org", "@graph": g}


HOME = ("ホーム", BASE + "/")
PAGES = {
    "index.html": {"url": BASE + "/", "name": "SEAM — Global Hair Care Select Shop",
                   "desc": "世界中のサロン専売ヘアケアブランドを集めたセレクトショップ＆サロン／髪格診断で今のあなたに合う一本へ",
                   "crumbs": [HOME]},
    "shop.html": {"url": BASE + "/shop", "name": "店舗一覧 | SEAM", "pageType": "CollectionPage", "stores": True,
                  "crumbs": [HOME, ("店舗一覧", BASE + "/shop")]},
    "hairsalon.html": {"url": BASE + "/hairsalon", "name": "ヘアサロン | SEAM",
                       "crumbs": [HOME, ("ヘアサロン", BASE + "/hairsalon")]},
    "headspa.html": {"url": BASE + "/headspa", "name": "ヘッドスパ | SEAM",
                     "crumbs": [HOME, ("ヘッドスパ", BASE + "/headspa")]},
    "brand.html": {"url": BASE + "/brand", "name": "取扱ブランド | SEAM", "pageType": "CollectionPage",
                   "crumbs": [HOME, ("取扱ブランド", BASE + "/brand")]},
    "finder.html": {"url": BASE + "/finder", "name": "髪格診断 | SEAM",
                    "crumbs": [HOME, ("髪格診断", BASE + "/finder")],
                    "webApp": {
                        "name": "SEAM 髪格診断",
                        "desc": "髪の太さ・量・動き(くせ)から導く27タイプの無料の髪質診断 あなたの髪格と 今に合うシャンプー・トリートメント・アウトバスをプロの知識で提案します 会員登録不要",
                    },
                    "faq": [
                        ("SEAMの髪格診断は無料ですか", "はい 会員登録なしで無料でご利用いただけます いくつかの質問に答えるだけで あなたの髪格27タイプと 今に合うケアの方向が見えてきます"),
                        ("髪格診断では何が分かりますか", "髪の太さ・量・動き(くせ)から導く27タイプの髪格と あなたの髪に合うシャンプー・トリートメント・アウトバスの方向性が分かります 結果はカルテとして保存でき サロンでもそのまま使えます"),
                        ("診断結果はサロンで使えますか", "はい 診断のカルテを店頭でお見せいただくと 結果を踏まえてプロが直接あなたの髪を見ながら 合うアイテムをご相談いただけます"),
                        ("スマートフォンでもできますか", "はい スマートフォン・タブレット・PCのブラウザでご利用いただけます アプリのインストールは不要です"),
                    ]},
    "onlineshop.html": {"url": BASE + "/onlineshop", "name": "オンラインショップ | SEAM",
                        "crumbs": [HOME, ("オンラインショップ", BASE + "/onlineshop")]},
}

START = "<!-- seam:jsonld:start -->"
END = "<!-- seam:jsonld:end -->"
HREF_START = "<!-- seam:hreflang:start -->"
HREF_END = "<!-- seam:hreflang:end -->"
HREF_LANGS = [("ja", ""), ("en", "/en"), ("zh-Hans", "/zh"), ("zh-Hant", "/tw"), ("ko", "/ko")]
NO_HREFLANG = {"finder.html"}  # 多言語の静的生成対象外(Reactアプリ)のため alternate を張らない


def hreflang_block(page_url):
    # 5言語の相互 alternate + x-default(ja)。jaソースに入れると build-i18n のコピーで en/zh/tw/ko にも同じクラスタが乗る
    path = page_url[len(BASE):] or "/"
    seg = "/" if path == "/" else path
    links = []
    for code, pre in HREF_LANGS:
        href = (BASE + pre + seg) if pre else (BASE + path)
        links.append('<link rel="alternate" hreflang="%s" href="%s">' % (code, href))
    links.append('<link rel="alternate" hreflang="x-default" href="%s">' % (BASE + path))
    return HREF_START + "\n" + "\n".join(links) + "\n" + HREF_END + "\n"


for fn, cfg in PAGES.items():
    p = os.path.join(ROOT, fn)
    if not os.path.exists(p):
        print("SKIP (missing):", fn); continue
    with open(p, encoding="utf-8") as f:
        html = f.read()
    # 既存ブロックを除去（再実行で重複しない）
    html = re.sub(re.escape(START) + r".*?" + re.escape(END) + r"\n?", "", html, flags=re.S)
    html = re.sub(re.escape(HREF_START) + r".*?" + re.escape(HREF_END) + r"\n?", "", html, flags=re.S)
    graph = page_graph(cfg)
    payload = json.dumps(graph, ensure_ascii=False, separators=(",", ":"))
    block = START + '\n<script type="application/ld+json">' + payload + "</script>\n" + END + "\n"
    if fn not in NO_HREFLANG:
        block = block + hreflang_block(cfg["url"])
    if "</head>" not in html:
        print("SKIP (no </head>):", fn); continue
    html = html.replace("</head>", block + "</head>", 1)
    with open(p, "w", encoding="utf-8") as f:
        f.write(html)
    nodes = len(graph["@graph"])
    print("OK %-16s nodes=%d bytes=%d" % (fn, nodes, len(payload)))

print("done")

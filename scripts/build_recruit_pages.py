#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""求人SEO: 職種×都市の求人詳細ページ8枚を生成(冪等)
- recruit-{role}-{slug}.html ×8 (stylist×5 + spanist×3)
- JobPosting/BreadcrumbList/FAQPage 構造化データ(1求人1ページ=Googleしごと検索推奨形)
- recruit.html: JobPosting撤去(一覧ハブ化)+店舗カードから詳細リンク
- .github/scripts/build-i18n.js jaUrls 同期
実行: cd seam-public && python3 scripts/build_recruit_pages.py
"""
import json, re, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

LINE_URL = "https://lin.ee/OoWKoie"
DATE_POSTED = "2026-07-13"
VALID_THROUGH = "2026-10-31"

STORES = {
    "ginza":    {"ja": "銀座",   "pref": "東京",  "area": "銀座・有楽町",  "en": "Tokyo · Ginza"},
    "sapporo":  {"ja": "札幌",   "pref": "北海道", "area": "大通・札幌駅",  "en": "Sapporo · Odori"},
    "osaka":    {"ja": "大阪",   "pref": "大阪",  "area": "南堀江・心斎橋", "en": "Osaka · Horie"},
    "nagoya":   {"ja": "名古屋", "pref": "愛知",  "area": "栄・矢場町",    "en": "Nagoya · Sakae"},
    "fukuoka":  {"ja": "福岡",   "pref": "福岡",  "area": "天神・大名",    "en": "Fukuoka · Tenjin"},
    "omotesando": {"ja": "表参道", "pref": "東京", "area": "表参道・青山", "en": "Tokyo · Omotesando"},
}
STYLIST_STORES = ["ginza", "sapporo", "osaka", "nagoya", "fukuoka"]
SPANIST_STORES = ["ginza", "osaka", "nagoya"]
ASSISTANT_STORES = ["fukuoka"]
SHOPMGR_STORES = ["ginza", "omotesando", "sapporo"]
PARTTIME_STORES = ["ginza", "omotesando"]
# 職種ごとの給与形態。JobPosting の baseSalary と employmentType に効く
PAY = {"stylist": (300000, "MONTH", "FULL_TIME"), "spanist": (300000, "MONTH", "FULL_TIME"),
       "assistant": (250000, "MONTH", "FULL_TIME"), "shopmanager": (250000, "MONTH", "FULL_TIME"),
       "parttime": (1500, "HOUR", "PART_TIME")}

def nap(slug):
    t = open(f"store-{slug}.html", encoding="utf-8").read()
    g = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', t, re.S).group(1))
    n = [x for x in g["@graph"] if x.get("@type") == "HairSalon"][0]
    a = n["address"]
    return {
        "street": a.get("streetAddress", ""), "locality": a.get("addressLocality", ""),
        "region": a.get("addressRegion", ""), "name": n.get("name", ""),
        "hours": n.get("openingHours", ""),
    }

ROLES = {
    "stylist": {
        "ja": "美容師スタイリスト", "short": "スタイリスト",
        "ill": "images/lp/recruit/ill_stylist.webp",
        "chips": ["月給30万円〜", "指名歩合50%", "完全週休2日"],
        "salary_html": "月給30万円〜<br><span style=\"color:#9c8a6a;font-size:12.5px;\">指名売上70万円以上で完全歩合（バック率50%・上限なし）／ 売上70万円→35万円 ・ 100万円→50万円 ・ 150万円→75万円</span>",
        "desc_lead": "サロン専売ヘアケア197ブランドのセレクトショップが入口にある フロントショップ型サロンのスタイリスト職です 物販ノルマはなく 商品が売れる仕組みはお店が持っています",
        "jp_title": "美容師スタイリスト（{city}・正社員）",
        "jp_desc": "フロントショップ型サロンSEAM {city}のスタイリスト。月給30万円〜 指名売上70万円以上で完全歩合(バック率50%・例:売上70万円で月給35万円)。完全週休2日・産休育休は取得実績あり復帰率100%・社会保険完備・NY/ハワイ研修。試用期間2ヶ月(期間中も給与は同額)。今後の商品開発に関わりたい方も歓迎。まずは見学だけの応募も歓迎。",
        "seo_title": "{city}の美容師・スタイリスト求人｜月給30万円〜 歩合50%｜SEAM{city}（正社員）",
        "seo_desc": "{pref}{city}エリア（{area}）の美容師スタイリスト求人 月給30万円〜 指名売上70万円で月給35万円（歩合50%） 完全週休2日 産休育休の復帰率100% NY・ハワイ研修 サロン専売197ブランドのフロントショップ型サロンSEAMで一生美容師でいられる働き方を",
        "h1": "{city}の美容師<br>スタイリスト求人",
        "italic": "for stylists in {slug}",
    },
    "spanist": {
        "ja": "スパニスト", "short": "スパニスト",
        "ill": "images/lp/recruit/ill_spa.webp",
        "chips": ["月給30万円〜", "完全個室 1対1", "カラー剤に触れない"],
        "salary_html": "月給30万円〜<br><span style=\"color:#9c8a6a;font-size:12.5px;\">指名歩合あり ／ くわしくは面談でご説明します</span>",
        "desc_lead": "完全個室で お客様と1対1で向き合うヘッドスパ専門職です カットもカラーもしません カラー剤に触れない働き方で 美容師免許を活かす新しいキャリアがひらけます",
        "jp_title": "スパニスト・ヘッドスパニスト（{city}・正社員）",
        "jp_desc": "完全個室ヘッドスパのスパニスト。月給30万円〜・指名歩合あり。完全週休2日・産休育休は取得実績あり復帰率100%・社会保険完備。美容師免許必須。カットやカラーは行わないヘッドスパ専門職。試用期間2ヶ月(期間中も給与は同額)。今後の商品開発に関わりたい方も歓迎。まずは見学だけの応募も歓迎。",
        "seo_title": "{city}のスパニスト求人（ヘッドスパ専門職）｜月給30万円〜｜SEAM{city}（正社員）",
        "seo_desc": "{pref}{city}エリア（{area}）のスパニスト・ヘッドスパニスト求人 月給30万円〜 完全個室で1対1のヘッドスパ専門職 カットカラーなし・カラー剤に触れない働き方 完全週休2日 産休育休の復帰率100% 美容師免許を活かす新しいキャリア",
        "h1": "{city}のスパニスト求人<br><span style=\"font-size:.62em;letter-spacing:.06em;\">ヘッドスパ専門職</span>",
        "italic": "for spanists in {slug}",
    },
    "assistant": {
        "ja": "アシスタント", "short": "アシスタント",
        "ill": "images/lp/recruit/ill_stylist.webp",
        "chips": ["月給25万円〜", "完全週休2日", "美容師免許"],
        "salary_html": "月給25万円〜<br><span style=\"color:#9c8a6a;font-size:12.5px;\">試用期間2ヶ月（期間中も給与は変わりません）</span>",
        "desc_lead": "技術だけでなく 接客やヘアケアの考え方まで含めて基礎から学べるアシスタント職です サロン専売197ブランドが並ぶ環境で 商品知識も一緒に育ちます",
        "jp_title": "美容師アシスタント（{city}・正社員）",
        "jp_desc": "フロントショップ型サロンSEAM {city}のアシスタント。月給25万円〜。完全週休2日・産休育休は取得実績あり復帰率100%・社会保険完備・NY/ハワイ研修。美容師免許必須。試用期間2ヶ月(期間中も給与は同額)。土日に勤務できる方。まずは見学だけの応募も歓迎。",
        "seo_title": "{city}の美容師アシスタント求人｜月給25万円〜｜SEAM{city}（正社員）",
        "seo_desc": "{pref}{city}エリア（{area}）の美容師アシスタント求人 月給25万円〜 完全週休2日 産休育休の復帰率100% サロン専売197ブランドのフロントショップ型サロンSEAMで 技術も商品知識も基礎から育てられる環境",
        "h1": "{city}の美容師<br>アシスタント求人",
        "italic": "for assistants in {slug}",
    },
    "shopmanager": {
        "ja": "ショップ管理者", "short": "ショップ管理者",
        "ill": "images/lp/recruit/ill_shop.webp",
        "chips": ["月給25万円〜", "実績に応じて賞与", "商品開発・広報も"],
        "salary_html": "月給25万円〜 ／ 実績に応じて賞与<br><span style=\"color:#9c8a6a;font-size:12.5px;\">試用期間6ヶ月</span>",
        "desc_lead": "サロンの入口にあるビューティーショップの運営をお任せします 接客と売場づくりだけでなく 今後は商品開発や広報にも関わっていける仕事です",
        "jp_title": "ショップ管理者（{city}・正社員）",
        "jp_desc": "サロン専売ヘアケア197ブランドのビューティーショップ運営。SEAM {city}。月給25万円〜・実績に応じて賞与。完全週休2日・社会保険完備。試用期間6ヶ月。土日に勤務できる方。今後 商品開発や広報にも関わっていきたい方を歓迎します。",
        "seo_title": "{city}のショップ管理者求人｜月給25万円〜 賞与あり｜SEAM{city}（正社員）",
        "seo_desc": "{pref}{city}エリア（{area}）のビューティーショップ管理者求人 月給25万円〜 実績に応じて賞与 完全週休2日 社会保険完備 サロン専売197ブランドの売場づくりから 商品開発や広報まで関われる仕事",
        "h1": "{city}の<br>ショップ管理者求人",
        "italic": "for shop managers in {slug}",
    },
    "parttime": {
        "ja": "ショップスタッフ", "short": "ショップスタッフ（アルバイト）",
        "ill": "images/lp/recruit/ill_shop.webp",
        "chips": ["時給1,500円", "土日に入れる方", "未経験OK"],
        "salary_html": "時給1,500円<br><span style=\"color:#9c8a6a;font-size:12.5px;\">平日の勤務日数はご相談ください</span>",
        "desc_lead": "ビューティーショップでお客様のご案内とヘアケアのご紹介をお願いします ヘアケアの知識は入ってから覚えていただいて大丈夫です",
        "jp_title": "ショップスタッフ（{city}・アルバイト）",
        "jp_desc": "サロン専売ヘアケアのビューティーショップスタッフ。SEAM {city}。時給1,500円。土日に勤務できる方。ヘアケアの知識は入社後に学べます。ノルマはありません。まずは見学だけの応募も歓迎。",
        "seo_title": "{city}のショップスタッフ求人（アルバイト）｜時給1,500円｜SEAM{city}",
        "seo_desc": "{pref}{city}エリア（{area}）のビューティーショップ アルバイト求人 時給1,500円 土日に勤務できる方 ヘアケアの知識は入ってから覚えられます ノルマなし サロン専売197ブランドが並ぶ売場での接客",
        "h1": "{city}の<br>ショップスタッフ求人",
        "italic": "for shop staff in {slug}",
    },
}

FAQS = [
    ("見学だけでも大丈夫ですか", "はい 見学だけ 話を聞くだけのご連絡も歓迎しています LINEかインスタグラムのDMから一言おくってください"),
    ("履歴書は必要ですか", "あとからで大丈夫です まずはLINEかDMでお名前と希望店舗をおしらせください"),
    ("子育てと両立できますか", "産休・育休は取得実績があり 復帰率は100%です 結婚して子どもがふたり 時短の正社員でサロンワークを続けている勤続10年のスタイリストも在籍しています "),
    ("応募から入社までの流れは", "LINEまたはDMでご連絡 → 店舗見学・面談 → 条件のご相談 → 入社 という流れです 経験やご希望にあわせてご相談いただけます"),
]

ROLE_STORES = {"stylist": STYLIST_STORES, "spanist": SPANIST_STORES,
               "assistant": ASSISTANT_STORES, "shopmanager": SHOPMGR_STORES, "parttime": PARTTIME_STORES}

def other_links(role, slug):
    """同じ職種の他店 → その店で募集している他職種 の順に並べる"""
    items = []
    for s in ROLE_STORES[role]:
        if s == slug: continue
        items.append(f'<a href="recruit-{role}-{s}.html" class="rcd-pill">{STORES[s]["ja"]}</a>')
    for r2, stores2 in ROLE_STORES.items():
        if r2 == role or slug not in stores2: continue
        items.append(f'<a href="recruit-{r2}-{slug}.html" class="rcd-pill" style="border-color:rgba(168,116,86,.5);">{STORES[slug]["ja"]}の{ROLES[r2]["short"]}求人</a>')
    return "\n            ".join(items)

def page_html(role, slug):
    R, S, N = ROLES[role], STORES[slug], nap(slug)
    city, url_slug = S["ja"], f"recruit-{role}-{slug}"
    canonical = f"https://seam.site/{url_slug}"
    seo_title = R["seo_title"].format(city=city)
    seo_desc = R["seo_desc"].format(city=city, pref=S["pref"], area=S["area"])
    h1 = R["h1"].format(city=city)

    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "JobPosting", "title": R["jp_title"].format(city=city),
         "description": R["jp_desc"].format(city=city),
         "datePosted": DATE_POSTED, "validThrough": VALID_THROUGH, "employmentType": PAY[role][2],
         "hiringOrganization": {"@type": "Organization", "name": "株式会社hanico（SEAM）", "sameAs": "https://seam.site/"},
         "jobLocation": {"@type": "Place", "address": {"@type": "PostalAddress", "streetAddress": N["street"], "addressLocality": N["locality"], "addressRegion": N["region"], "addressCountry": "JP"}},
         "baseSalary": {"@type": "MonetaryAmount", "currency": "JPY", "value": {"@type": "QuantitativeValue", "minValue": PAY[role][0], "unitText": PAY[role][1]}},
         "jobBenefits": "社会保険・厚生年金完備 ／ 交通費支給（月1万5千円まで） ／ ヘアケア・美容用品の社員割引 ／ ニューヨーク・ハワイ研修（実績に応じて） ／ 産休・育休（取得実績あり・復帰率100%）",
         "applicantLocationRequirements": {"@type": "Country", "name": "JP"}, "directApply": True,
         "identifier": {"@type": "PropertyValue", "name": "SEAM", "value": url_slug}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://seam.site/"},
            {"@type": "ListItem", "position": 2, "name": "採用情報", "item": "https://seam.site/recruit"},
            {"@type": "ListItem", "position": 3, "name": f"{city}の{R['short']}求人", "item": canonical}]},
        {"@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQS]},
    ]}
    ld_json = json.dumps(ld, ensure_ascii=False, separators=(",", ":"))
    json.loads(ld_json)

    chips = "\n            ".join(f'<span class="rcd-chip">{c}</span>' for c in R["chips"])
    # 雇用形態と試用期間は職種で違う
    EMP = {"stylist": "正社員 ・ 試用期間 2ヶ月 ／ 期間中も給与は変わりません",
           "spanist": "正社員 ・ 試用期間 2ヶ月 ／ 期間中も給与は変わりません",
           "assistant": "正社員 ・ 試用期間 2ヶ月 ／ 期間中も給与は変わりません",
           "shopmanager": "正社員 ・ 試用期間 6ヶ月",
           "parttime": "アルバイト"}
    DEV = "<br>今後 商品開発や広報にも関わっていきたい方を歓迎します"   # 職種を問わず歓迎(2026-07-30)
    QUAL = {"stylist": "美容師免許をお持ちの方 ／ 土日に勤務できる方" + DEV,
            "spanist": "美容師免許をお持ちの方 ／ 土日に勤務できる方" + DEV,
            "assistant": "美容師免許をお持ちの方 ／ 土日に勤務できる方" + DEV,
            "shopmanager": "土日に勤務できる方" + DEV,
            "parttime": "土日に勤務できる方<br>ヘアケアの知識は入ってから覚えていただけます ノルマはありません"}
    HOLIDAY = ("完全週休2日<br>有給休暇 10〜20日 ／ 産休・育休（取得実績あり・復帰率100%）"
               if role != "parttime" else "シフト制 ／ 平日の勤務日数はご相談ください")
    BENEFIT = ("社会保険・厚生年金 完備 ／ 交通費 月1万5千円まで支給 ／ ヘアケア・美容用品の社員割引あり<br>"
               "ニューヨーク・ハワイ研修（実績に応じて）／ ママさん美容師 多数在籍"
               if role != "parttime" else
               "交通費支給（月1万5千円まで）／ ヘアケア・美容用品のスタッフ割引あり")
    lic = QUAL[role]
    hours = f'<div class="rc-spec-row"><div class="rc-spec-key">営業時間</div><div class="rc-spec-val">{N["hours"]}</div></div>' if N["hours"] else ""

    return f"""<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>{seo_title}</title>
  <meta name="description" content="{seo_desc}">
  <link rel="canonical" href="{canonical}">
  <meta property="og:site_name" content="SEAM">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:type" content="website">
  <meta property="og:url" content="{canonical}">
  <meta property="og:title" content="{seo_title}">
  <meta property="og:description" content="{seo_desc}">
  <meta property="og:image" content="https://seam.site/images/og/seam-og.jpg">
  <meta name="theme-color" content="#FFFFFF">
  <meta name="format-detection" content="telephone=no">
  <link rel="apple-touch-icon" href="images/apple-touch-icon.png">
  <link rel="icon" href="images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Instrument+Serif:ital@0;1&family=Noto+Serif+JP:wght@300;400;500;600&family=Noto+Sans+JP:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/tailwind.css">
  <link rel="stylesheet" href="css/lang.css">
  <link rel="stylesheet" href="css/reveal.css?v=5">
  <link rel="stylesheet" href="css/enhance.css?v=1">
  <script type="application/ld+json">{ld_json}</script>
  <style>
    html {{ scroll-behavior:smooth; background:#FFFFFF; -webkit-text-size-adjust:100%; }}
    body {{ background:#FFFFFF; color:#2A2D34; font-family:'Noto Sans JP','Inter',sans-serif; -webkit-font-smoothing:antialiased; padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px)); font-size:15px; line-height:1.85; }}
    @media (min-width:640px) {{ body {{ padding-bottom:0; }} }}
    .bottom-nav {{ padding-bottom: env(safe-area-inset-bottom, 0); }}
    .bottom-nav a {{ min-height:56px; }}
    :root {{ --app-max-width-tablet:980px; --app-max-width-pc:1280px; }}
    @media (min-width:720px) and (max-width:1279px) {{ body {{ max-width:var(--app-max-width-tablet); margin-left:auto; margin-right:auto; }} }}
    @media (min-width:1280px) {{ body {{ max-width:var(--app-max-width-pc); margin-left:auto; margin-right:auto; }} }}
    .rc-italic {{ font-family:'Instrument Serif',serif; font-style:italic; font-weight:400; letter-spacing:.02em; }}
    .rc-arch {{ border-radius:999px; overflow:hidden; background:#F6EFE7; border:1px solid rgba(185,138,126,.3); box-shadow:0 10px 30px rgba(168,116,86,.1); }}
    .rc-arch img {{ width:100%; height:100%; object-fit:cover; mix-blend-mode:multiply; }}
    .rcd-chip {{ display:inline-block; background:#fff; border:1px solid rgba(185,138,126,.35); color:#8a5e44; border-radius:999px; padding:7px 14px; font-size:12.5px; font-family:'Noto Serif JP',serif; letter-spacing:.04em; }}
    .rcd-pill {{ display:inline-block; background:#fff; border:1px solid #E7E1D6; color:#3A322A; border-radius:999px; padding:8px 16px; font-size:12.5px; }}
    .rcd-pill:hover {{ border-color:#A87456; }}
    .rc-spec-row {{ display:flex; gap:14px; padding:16px 2px; border-bottom:1px solid #E7E1D6; }}
    .rc-spec-row:last-child {{ border-bottom:0; }}
    .rc-spec-key {{ flex:0 0 96px; font-family:'Noto Serif JP',serif; color:#9c8a6a; font-size:12.5px; letter-spacing:.04em; padding-top:1px; }}
    @media (min-width:640px) {{ .rc-spec-key {{ flex-basis:140px; font-size:13px; }} }}
    .rc-spec-val {{ flex:1; color:#3A3631; font-size:13.5px; line-height:1.85; }}
    @media (min-width:640px) {{ .rc-spec-val {{ font-size:14.5px; }} }}
    .rcd-hero-grid {{ display:grid; grid-template-columns:1fr; gap:28px; align-items:center; }}
    @media (min-width:900px) {{ .rcd-hero-grid {{ grid-template-columns:1fr 210px; gap:56px; }} }}
    .rcd-fig {{ width:168px; }}
    @media (min-width:900px) {{ .rcd-fig {{ width:100%; }} }}
  </style>
</head>
<body class="font-sans text-charcoal antialiased pb-20 sm:pb-0">
<div class="lang-overlay" id="langOverlay" role="dialog" aria-modal="true" aria-label="言語選択">
  <div class="lang-modal">
    <div class="lang-modal-handle"></div>
    <p class="lang-modal-title">Select Language</p>
    <div class="lang-grid">
      <button class="lang-option" data-l="ja"><span class="lo-label">JA</span><span class="lo-native">日本語</span></button>
      <button class="lang-option" data-l="en"><span class="lo-label">EN</span><span class="lo-native">English</span></button>
      <button class="lang-option" data-l="zh"><span class="lo-label">CN</span><span class="lo-native">简体中文</span></button>
      <button class="lang-option" data-l="tw"><span class="lo-label">TW</span><span class="lo-native">繁體中文</span></button>
      <button class="lang-option full-width" data-l="ko"><span class="lo-label">KR</span><span class="lo-native">한국어</span></button>
    </div>
  </div>
</div>

  <!-- HEADER injected by js/app-header.js -->

  <!-- HERO -->
  <section class="px-6 sm:px-10 pt-10 sm:pt-14 pb-12 sm:pb-16" style="background:linear-gradient(180deg,#F9F1EC,#F4E6DE);" data-track-view="recruit_dtl_{role}_{slug}">
    <div class="max-w-5xl mx-auto rcd-hero-grid">
      <div>
        <div class="flex items-center gap-3 mb-5" data-reveal>
          <span class="block w-8 h-px" style="background:rgba(168,116,86,.55);"></span>
          <p class="font-mono tracking-widest3 text-[10.5px] uppercase" style="color:#A87456;">Recruit — {S["en"]}</p>
        </div>
        <p class="rc-italic" style="font-size:clamp(17px,4vw,24px);color:#B98A7E;margin-bottom:6px;" data-reveal>{R["italic"].format(slug=slug)}</p>
        <h1 class="font-serif text-ink leading-[1.25]" style="font-size:clamp(30px,7.5vw,52px);letter-spacing:.02em;font-weight:500;" data-reveal>{h1}</h1>
        <p class="mt-5 leading-[1.95] max-w-xl text-[14px]" style="color:#4A443D;" data-reveal>{R["desc_lead"]}<br>勤務地は SEAM {city}（{S["area"]}エリア）です</p>
        <div class="mt-6 flex flex-wrap gap-2" data-reveal>
            {chips}
        </div>
        <div class="mt-8 flex flex-wrap items-center gap-3" data-reveal>
          <a href="{LINE_URL}" target="_blank" rel="noopener" data-track-click="recruit_apply_line" style="background:#06C755;color:#fff;" class="inline-flex items-center gap-2.5 rounded-full py-3.5 px-7 shadow-card hover:opacity-90 transition-opacity">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5C6.48 2.5 2 6.14 2 10.63c0 4.02 3.57 7.39 8.39 8.03.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.66 13.86 22 12.3 22 10.63 22 6.14 17.52 2.5 12 2.5z"/></svg>
            <span class="font-serif text-[14.5px]">LINEで応募・見学予約</span>
          </a>
          <a href="https://www.instagram.com/seam_japan" target="_blank" rel="noopener" data-track-click="recruit_apply_ig" class="inline-flex items-center gap-2 border border-ink/20 text-ink rounded-full py-3.5 px-6 hover:border-ink/40 transition-colors bg-white/60">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5.4"/><circle cx="12" cy="12" r="4"/><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/></svg>
            <span class="font-serif text-[13.5px]">DMで相談する</span>
          </a>
        </div>
        <p class="mt-4 text-[11.5px]" style="color:rgba(74,68,61,.65);" data-reveal>見学だけ 話を聞くだけ も歓迎 ・ 履歴書はあとからで大丈夫</p>
      </div>
      <figure class="rc-arch rcd-fig mx-auto" style="aspect-ratio:1/1;" data-reveal>
        <img src="{R["ill"]}" alt="{R["ja"]}の一筆書きイラスト" loading="lazy" decoding="async">
      </figure>
    </div>
  </section>

  <!-- 募集要項 -->
  <section class="bg-ivory py-14 sm:py-20">
    <div class="max-w-3xl mx-auto px-6 sm:px-8">
      <div class="text-center mb-9">
        <p class="font-mono tracking-widest3 text-[10.5px] text-gold uppercase mb-4" data-reveal>Requirements</p>
        <h2 class="font-serif text-ink leading-snug" style="font-size:clamp(21px,5vw,28px);letter-spacing:.04em;font-weight:500;" data-reveal>募集要項 — {R["ja"]}（{city}）</h2>
      </div>
      <div class="bg-white border border-line rounded-[18px] px-6 sm:px-9 py-4 sm:py-6 shadow-soft" data-reveal>
        <div class="rc-spec-row"><div class="rc-spec-key">職種</div><div class="rc-spec-val">{R["ja"]}（{EMP[role]}）</div></div>
        <div class="rc-spec-row"><div class="rc-spec-key">勤務地</div><div class="rc-spec-val">{N["name"] or "SEAM " + city}<br>{N["region"]}{N["locality"]}{N["street"]}</div></div>
        <div class="rc-spec-row"><div class="rc-spec-key">給与</div><div class="rc-spec-val">{R["salary_html"]}</div></div>
        <div class="rc-spec-row"><div class="rc-spec-key">応募資格</div><div class="rc-spec-val">{lic}</div></div>
        <div class="rc-spec-row"><div class="rc-spec-key">休日休暇</div><div class="rc-spec-val">{HOLIDAY}</div></div>
        <div class="rc-spec-row"><div class="rc-spec-key">待遇・福利</div><div class="rc-spec-val">{BENEFIT}</div></div>
        {hours}
        <div class="rc-spec-row"><div class="rc-spec-key">運営会社</div><div class="rc-spec-val">株式会社hanico（SEAM ／ bico ／ HOI ／ BEAPLY）</div></div>
      </div>
      <p class="text-center mt-5 text-[11px] text-charcoal/55 leading-[1.7]" data-reveal>※詳しい条件はお気軽にお問い合わせください 経験やご希望にあわせてご相談いただけます</p>
      <div class="text-center mt-6" data-reveal>
        <a href="store-{slug}.html" class="rcd-pill">SEAM {city}の店舗情報をみる →</a>
      </div>
    </div>
  </section>

  <!-- 先輩の声 -->
  <section class="bg-ivory py-12 sm:py-16">
    <div class="max-w-3xl mx-auto px-6 sm:px-8">
      <figure class="relative bg-white border border-line rounded-[22px] px-7 sm:px-10 pt-10 pb-7 shadow-soft" data-reveal>
        <span aria-hidden="true" style="position:absolute;top:8px;left:16px;font-family:'Instrument Serif',serif;font-size:72px;line-height:1;color:rgba(185,138,126,.28);">“</span>
        <blockquote class="font-serif text-[14px] sm:text-[15px] text-ink leading-[2.1]">
          結婚して 子どもがふたり生まれて いまは時短の正社員として サロンワークを続けています<br>
          担当してきたお客様を失うことなく 安定して働けています スタッフも会社も 本当に助けてくれる場所です
        </blockquote>
        <figcaption class="mt-5 pt-4 flex items-baseline justify-between flex-wrap gap-2" style="border-top:1px solid rgba(185,138,126,.24);">
          <p class="font-serif text-[14.5px] text-ink">板東 裕希</p>
          <p class="text-[11px] text-charcoal/65">グループサロン bico スタイリスト ／ 勤続10年 ・ ふたりの子どものママ</p>
        </figcaption>
      </figure>
    </div>
  </section>

  <!-- FAQ -->
  <section class="py-14 sm:py-20" style="background:linear-gradient(180deg,#F9F1EC,#F3E4DC);">
    <div class="max-w-3xl mx-auto px-6 sm:px-8">
      <div class="text-center mb-9">
        <p class="font-mono tracking-widest3 text-[10.5px] uppercase mb-4" style="color:#B98A7E;" data-reveal>FAQ</p>
        <h2 class="font-serif text-ink leading-snug" style="font-size:clamp(21px,5vw,28px);letter-spacing:.04em;font-weight:500;" data-reveal>よくあるご質問</h2>
      </div>
      <div class="space-y-3">
        {{faq_html}}
      </div>
    </div>
  </section>

  <!-- ENTRY -->
  <section class="bg-ink text-ivory py-16 sm:py-20 text-center">
    <div class="max-w-2xl mx-auto px-6 sm:px-8">
      <p class="font-mono tracking-widest3 text-[10.5px] uppercase mb-5" style="color:#C9B68E;" data-reveal>Entry</p>
      <h2 class="font-serif leading-[1.4]" style="font-size:clamp(21px,5vw,30px);letter-spacing:.03em;font-weight:500;" data-reveal>その一歩を 気軽に聞かせてください</h2>
      <p class="rc-italic" style="font-size:15.5px;color:#D9B8A8;margin-top:10px;" data-reveal>take your first step lightly</p>
      <div class="mt-8 flex flex-col items-center gap-3" data-reveal>
        <a href="{LINE_URL}" target="_blank" rel="noopener" data-track-click="recruit_apply_line" style="background:#06C755;color:#fff;" class="inline-flex items-center gap-2.5 rounded-full py-4 px-9 shadow-card hover:opacity-90 transition-opacity">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5C6.48 2.5 2 6.14 2 10.63c0 4.02 3.57 7.39 8.39 8.03.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.66 13.86 22 12.3 22 10.63 22 6.14 17.52 2.5 12 2.5z"/></svg>
          <span class="font-serif text-[15px]">LINEで応募・見学予約</span>
        </a>
        <a href="https://www.instagram.com/seam_japan" target="_blank" rel="noopener" data-track-click="recruit_apply_ig" class="inline-flex items-center gap-2.5 bg-ivory text-ink rounded-full py-3.5 px-7 shadow-card hover:bg-cream transition-colors">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="18" height="18" rx="5.4"/><circle cx="12" cy="12" r="4"/><circle cx="17.6" cy="6.4" r="1.1" fill="currentColor" stroke="none"/></svg>
          <span class="font-serif text-[14px]">@seam_japan にDMする</span>
        </a>
      </div>
    </div>
  </section>

  <!-- ほかのエリア -->
  <section class="bg-ivory py-12 sm:py-16">
    <div class="max-w-3xl mx-auto px-6 sm:px-8 text-center">
      <p class="font-mono tracking-widest2 text-[10px] text-charcoal/70 uppercase mb-4" data-reveal>Other Areas</p>
      <div class="flex flex-wrap justify-center gap-2.5" data-reveal>
            {{others}}
      </div>
      <p class="mt-6 text-[12.5px]" data-reveal><a href="recruit.html" class="underline text-charcoal hover:text-ink">採用情報トップへもどる</a></p>
    </div>
  </section>

  <footer class="bg-cream/40 border-t border-line py-14 pb-28 sm:pb-10">
    <div class="max-w-6xl mx-auto px-5 sm:px-8 text-center">
      <div class="font-serif text-[19px] tracking-[0.22em] text-ink">SEAM</div>
      <p class="font-mono tracking-widest2 text-[10px] text-charcoal/70 mt-1">GLOBAL HAIR CARE SELECT SHOP</p>
      <p class="mt-5 text-[11px] text-charcoal/70">© 2026 SEAM JAPAN. All Rights Reserved.</p>
      <p style="margin-top:8px;font-size:10.5px;line-height:1.8;color:rgba(58,50,42,.62);"><a href="terms.html" style="text-decoration:underline;">利用規約</a>　<a href="privacy.html" style="text-decoration:underline;">プライバシーポリシー</a>　<a href="tokushoho.html" style="text-decoration:underline;">特定商取引法に基づく表記</a></p>
    </div>
  </footer>

  <nav class="bottom-nav fixed bottom-0 left-0 right-0 z-40 sm:hidden border-t border-line/80 backdrop-blur-md" style="background:rgba(250,247,242,0.94);">
    <div class="grid grid-cols-3 text-center">
      <a href="index.html" class="py-3 flex flex-col items-center gap-1 hover:bg-cream/60 transition-colors">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A87456" stroke-width="1.4"><path d="M3 11l9-7 9 7M5 10v10h14V10"/></svg>
        <span class="text-[11px] font-serif text-ink">ホーム</span>
      </a>
      <a href="recruit.html" class="py-3 flex flex-col items-center gap-1 border-l border-line/70 hover:bg-cream/60 transition-colors">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#A87456" stroke-width="1.4"><path d="M4 7h16v13H4zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        <span class="text-[11px] font-serif text-ink">採用トップ</span>
      </a>
      <a href="{LINE_URL}" target="_blank" rel="noopener" data-track-click="recruit_apply_line" class="py-3 flex flex-col items-center gap-1 border-l border-line/70 hover:bg-cream/60 transition-colors">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#06C755"><path d="M12 2.5C6.48 2.5 2 6.14 2 10.63c0 4.02 3.57 7.39 8.39 8.03.33.07.77.22.89.5.1.26.07.66.03.92l-.14.86c-.04.26-.2 1.02.89.55 1.09-.46 5.87-3.46 8.01-5.92C21.66 13.86 22 12.3 22 10.63 22 6.14 17.52 2.5 12 2.5z"/></svg>
        <span class="text-[11px] font-serif text-ink">LINEで応募</span>
      </a>
    </div>
  </nav>

  <script>
    window.SEAM_PAGE_I18N = {{
      ja: {{ 'nav.home':'ホーム','nav.finder':'髪格診断','nav.shop':'ヘアケアショップ','nav.brand':'取扱ブランド','nav.salon':'ヘアサロン','nav.headspa':'ヘッドスパ','nav.online':'オンラインショップ','nav.recruit':'採用情報' }},
      en: {{ 'nav.home':'Home','nav.finder':'Hair Diagnosis','nav.shop':'Hair Care Shop','nav.brand':'Brands','nav.salon':'Hair Salon','nav.headspa':'Head Spa','nav.online':'Online Shop','nav.recruit':'Recruit' }},
      zh: {{ 'nav.home':'首页','nav.finder':'发质诊断','nav.shop':'护发选物店','nav.brand':'品牌','nav.salon':'美发沙龙','nav.headspa':'头疗','nav.online':'在线商店','nav.recruit':'招聘' }},
      tw: {{ 'nav.home':'首頁','nav.finder':'髮質診斷','nav.shop':'護髮選物店','nav.brand':'品牌','nav.salon':'美髮沙龍','nav.headspa':'頭皮SPA','nav.online':'線上商店','nav.recruit':'徵才' }},
      ko: {{ 'nav.home':'홈','nav.finder':'모발 진단','nav.shop':'헤어케어 숍','nav.brand':'브랜드','nav.salon':'헤어살롱','nav.headspa':'헤드스파','nav.online':'온라인 스토어','nav.recruit':'채용' }}
    }};
  </script>
  <script src="js/seam-analytics.js?v=5" defer></script>
  <script src="js/app-header.js?v=4" defer></script>
  <script src="js/lang.js?v=2"></script>
  <script src="js/reveal.js"></script>
</body>
</html>
"""

def faq_block():
    out = []
    for q, a in FAQS:
        out.append(f"""<div class="bg-white border border-line rounded-[14px] px-6 py-5 shadow-soft" data-reveal>
          <h3 class="font-serif text-[15px] text-ink">Q. {q}</h3>
          <p class="mt-2 text-[13px] text-charcoal/75 leading-[1.9]">{a}</p>
        </div>""")
    return "\n        ".join(out)

def main():
    pages = []
    faqs = faq_block()
    for role, stores in ROLE_STORES.items():
        for slug in stores:
            html = page_html(role, slug)
            html = html.replace("{faq_html}", faqs).replace("{others}", other_links(role, slug))
            html = html.replace("{role}", role).replace("{slug}", slug)
            fn = f"recruit-{role}-{slug}.html"
            open(fn, "w", encoding="utf-8").write(html)
            pages.append(fn)
    print(f"generated {len(pages)} pages")

    # ── recruit.html: JobPosting撤去(一覧ハブ化) ──
    s = open("recruit.html", encoding="utf-8").read()
    m = re.search(r'<script type="application/ld\+json">(.*?)</script>', s, re.S)
    d = json.loads(m.group(1))
    before = len(d["@graph"])
    d["@graph"] = [n for n in d["@graph"] if n.get("@type") != "JobPosting"]
    if len(d["@graph"]) != before:
        s = s.replace(m.group(0), '<script type="application/ld+json">' + json.dumps(d, ensure_ascii=False, separators=(",", ":")) + "</script>")
        print(f"recruit.html: JobPosting {before - len(d['@graph'])}本を詳細ページへ移設")

    # ── recruit.html: 店舗カードに詳細リンク(冪等) ──
    if "recruit-stylist-ginza.html" not in s:
        for slug in STYLIST_STORES:
            links = [f'<a href="recruit-stylist-{slug}.html" class="inline-block text-[11.5px] underline" style="color:#8a5e44;">スタイリスト求人 →</a>']
            if slug in SPANIST_STORES:
                links.append(f'<a href="recruit-spanist-{slug}.html" class="inline-block text-[11.5px] underline" style="color:#8a5e44;">スパニスト求人 →</a>')
            marker = f'<div id="r-{slug}" style="scroll-margin-top:76px;" class="bg-white border border-line rounded-[14px] p-6 shadow-soft" data-reveal>'
            assert marker in s, slug
            # カード末尾(次のdiv閉じ)にリンク行を差す: チップdivの直後
            card_start = s.index(marker)
            chip_end = s.index("</div>", s.index('flex flex-wrap gap-1.5', card_start))
            insertion = "</div>\n          <div class=\"mt-4 flex flex-wrap gap-x-4 gap-y-1\">" + "".join(links) + "</div>"
            s = s[:chip_end] + insertion + s[chip_end + len("</div>"):]
        print("recruit.html: 店舗カードに求人詳細リンク追加")

    # スパニスト帯にも3都市リンク
    if 'recruit-spanist-ginza.html" class="rcd-like' not in s and "スパニストという選択" in s:
        old = '<p class="rc-italic" style="font-size:15px;color:#B98A7E;margin-top:3px;">slow, warm, one to one</p>'
        add = old + '\n          <div class="mt-3 flex flex-wrap gap-2">' + "".join(
            f'<a href="recruit-spanist-{sl}.html" class="rcd-like inline-block text-[11.5px] border border-line rounded-full px-3.5 py-1.5 hover:border-ink/40" style="color:#3A322A;">{STORES[sl]["ja"]}の求人 →</a>' for sl in SPANIST_STORES) + "</div>"
        if old in s:
            s = s.replace(old, add, 1)
            print("recruit.html: スパニスト帯に3都市リンク追加")

    # titleに求人キーワード
    s = s.replace("<title>採用情報 RECRUIT | SEAM — 美容を、ずっと続けよう</title>",
                  "<title>採用情報・美容師求人 RECRUIT | SEAM — 美容を、ずっと続けよう</title>")
    open("recruit.html", "w", encoding="utf-8").write(s)

    # ── jaUrls 同期 ──
    ci = ".github/scripts/build-i18n.js"
    t = open(ci, encoding="utf-8").read()
    added = 0
    ins = t.index("];", t.index("const jaUrls"))
    for fn in pages:
        slug = "/" + fn.replace(".html", "")
        if f"'{slug}'" not in t:
            t = t[:ins] + f",\n    '{slug}'" + t[ins:]
            ins = t.index("];", t.index("const jaUrls"))
            added += 1
    if added:
        open(ci, "w", encoding="utf-8").write(t)
        print(f"build-i18n.js: jaUrls += {added}")

    # ── 検証 ──
    for fn in pages:
        h = open(fn, encoding="utf-8").read()
        ld = json.loads(re.search(r'<script type="application/ld\+json">(.*?)</script>', h, re.S).group(1))
        types = [n["@type"] for n in ld["@graph"]]
        assert types == ["JobPosting", "BreadcrumbList", "FAQPage"], (fn, types)
        assert "{" + "role}" not in h and "{" + "slug}" not in h and "{faq_html}" not in h and "{others}" not in h, fn
        assert "css/lang.css" in h and "langOverlay" in h and "seam-analytics" in h, fn
        for im in re.findall(r'src="(images/[^"]+)"', h):        # 画像の実在も見る
            assert os.path.exists(im), (fn, im)
    print(f"verify OK: {len(pages)} pages / LD types / template vars / shared assets / images")

if __name__ == "__main__":
    main()

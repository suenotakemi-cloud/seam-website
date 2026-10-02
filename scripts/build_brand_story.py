# オージュア・バイカルテのブランドページ（/aujua-story・/bykarte-story）。2026-10-02 所有者
# 事実は ~/Downloads/seam-points-review/ブランドページ_202610/*_公式資料.md（公式サイトを自分の言葉で要約）だけを使う
# 書かないこと：治る・生える・元に戻る・頭皮や育毛の効果・未確認の数字（取扱店数・開発年数・海外の販売国）
# 製品の写真は本物（images/brands/<brand>/）。雰囲気の写真は各メーカーの公式サイトの作風に寄せて生成（製品とロゴは写さない）
# 使い方: python3 scripts/build_brand_story.py
import re, json, sys

BR = {
 'aujua': dict(
  theme='th-aujua', title='Aujua｜日本の髪のために ミルボンが生んだヘアケア｜SEAM',
  desc='日本の気候と日本人の髪から生まれたオージュア 2010年にミルボンが送り出したサロン専売ヘアケアの考え方 オージュアソムリエ 悩みから選ぶラインと価格 SEAM全店で免税対応',
  crumb='オージュア', brandpage='aujua.html',
  eyebrow='SALON HAIR CARE BY MILBON, JAPAN', word='Aujua', h1ja='悩みは 一人ひとり違うから',
  sub='日本の気候と 日本人の髪から生まれたヘアケア',
  intro_big='20', intro_unit='lines', intro_h='全員に 同じ一本を勧めない',
  intro_p='髪の悩みは 人によって違う<br>オージュアは 20 のラインから組み合わせて その人だけのケアをつくる考え方です　2010 年 ミルボンが立ち上げました',
  feature=dict(img='sommelier', alt='美容師がお客様の髪の状態を確かめている様子', eyebrow='AUJUA SOMMELIER', h='髪を見て 選ぶ人がいる',
               p='オージュアソムリエは ミルボン独自の認定制度　専門の教育を受け 検定に合格した人だけが名乗れます<br>髪と地肌の知識 施術の技術 カウンセリングの力を確かめられた人が 組み合わせを提案します'),
  effects=[('inside', '内側へ', '髪の内側の欠けたところを補う'), ('cuticle', '表面を整える', '開いたキューティクルを整え なめらかに'), ('gloss', 'ツヤ', '光をきれいに返す うるおいのある髪へ')],
  lines_h='悩みから選ぶ 8 つのライン',
  lines=[('AQUAVIA', 'アクアヴィア', 'Aujua_アクアヴィア_シャンプー_250mL.webp', 'くせで広がる髪', '髪の中の水分の偏りを整え まとまりやすく', 'シャンプー ¥3,080'),
         ('QUENCH', 'クエンチ', 'Aujua_クエンチ_シャンプー_250mL.webp', '乾燥 パサつき', '水分の逃げを防ぎ うるおいのある髪へ', 'シャンプー ¥3,080'),
         ('SMOOTH', 'スムース', 'Aujua_スムース_シャンプー_250mL.webp', '細く絡まりやすい髪', '表面にすべりをつくり さらさらに', 'シャンプー ¥3,080'),
         ('IMMURISE', 'イミュライズ', 'Aujua_イミュライズ_シャンプー_250mL.webp', '年齢とカラーのダメージ', '独自のケラチン CMADK でしなやかに', 'シャンプー ¥3,850'),
         ('INMETRY', 'インメトリィ', 'Aujua_インメトリィ_シャンプー_250mL.webp', 'うねりとダメージ', 'ゆがみのある髪を ほどくように整える', 'シャンプー ¥5,500'),
         ('FILLMELLOW', 'フィルメロウ', 'Aujua_フィルメロウ_シャンプー_250mL.webp', '熱で硬くなった髪', 'アイロンの熱でこわばった髪を やわらかく', 'シャンプー ¥3,080'),
         ('REPAIRITY', 'リペアリティ', 'Aujua_リペアリティ_シャンプー_250mL.webp', 'ブリーチ毛', 'スカスカになった髪の内側を満たす', 'シャンプー ¥3,850'),
         ('MIRAGERY', 'ミラジェリィ', 'オージュア_ミラジェリィ_シャンプー_250ml.webp', 'いちばん上のライン', '3 種の CMADK で 広がる髪の形を整える', 'シャンプー ¥5,500')],
  story=dict(img='hero', alt='流れる淡いピンクの布', eyebrow='THE BOTTLE', h='ボトルに込めたもの',
             p='ボトルの形は 日本の古典美術に描かれた立ち姿の美しさから　左右がわずかに違う形に やわらかさと強さを込めています<br>銀色のキャップは 研究がこれからも続いていくことのしるしです',
             hist=[('2010', 'ミルボンがオージュアを発売'), ('2013', 'オージュアソムリエの認定が始まる'), ('いま', '20 のラインに広がる')]),
 ),
 'bykarte': dict(
  theme='th-bykarte', title='BYKARTE｜髪のカルテから生まれたヘアケア｜SEAM',
  desc='美容師を髪のお医者さんに見立てた カルテから生まれたサロン専売ヘアケア バイカルテ ホーユー独自のシスチン補修技術と 髪質と仕上がりから選ぶ組み合わせ SEAM全店で免税対応',
  crumb='バイカルテ', brandpage='bykarte.html',
  eyebrow='SALON HAIR CARE BY HOYU, JAPAN', word='BYKARTE', h1ja='髪のカルテから 処方を選ぶ',
  sub='傷む前の 素の髪へ　カルテから生まれたヘアケア',
  intro_big='18', intro_unit='combinations', intro_h='髪質 × 仕上がりで 選ぶ',
  intro_p='名前は 医療の「カルテ」から　美容師を髪のお医者さんに見立て 一人ひとりの髪を診て処方を決める という考え方です<br>シャンプー 3 種とトリートメントの組み合わせで 18 通りから選べます',
  feature=dict(img='lab', alt='白いタイルの上のガラスのビーカー', eyebrow='THE TECHNOLOGY', h='シスチンを 髪の内側へ',
               p='髪の主な成分であるシスチン（アミノ酸）は カラーや紫外線で傷むと 髪の中に空洞をつくります<br>ホーユー独自の CiP SHOT は シスチンがアルカリ性で溶け 弱酸性で固まる性質を使って 髪の内側に届け 空洞を補修する技術です'),
  effects=[('inside', '内側へ', '空洞にシスチンを届けて補修する'), ('cuticle', '表面を整える', 'キューティクルを整え しなやかな手触りに'), ('gloss', 'ツヤ', 'やわらかく 光を返す髪へ')],
  lines_h='髪質と仕上がりで選ぶ',
  lines=[('CH+', 'リペアシャンプー CH+', 'バイカルテ_リペア_シャンプー_CH+_280ml.webp', '普通〜硬い髪', 'やわらかな洗い上がり', 'シャンプー ¥4,180'),
         ('FH+', 'リペアシャンプー FH+', 'バイカルテ_リペア_シャンプー_FH+_280ml.webp', '細い やわらかい髪', 'しなやかな洗い上がり', 'シャンプー ¥4,180'),
         ('UH+', 'リペアシャンプー UH+', 'バイカルテ_リペア_シャンプー_UH+_280ml.webp', 'うねり 広がり', 'さっぱりした洗い上がり', 'シャンプー ¥4,180'),
         ('SS+', 'セラムトリートメント SS+', 'バイカルテ_セラムトリートメント_SS+_250g.webp', 'さらさら', '指通りのよい仕上がり', 'トリートメント ¥4,180'),
         ('MS+', 'セラムトリートメント MS+', 'バイカルテ_セラムトリートメント_MS+_250g.webp', 'しっとり', 'うるおいとまとまり', 'トリートメント ¥4,180'),
         ('HS+', 'セラムトリートメント HS+', 'バイカルテ_セラムトリートメント_HS+_250g.webp', '強いダメージ', 'なめらかな高補修', 'トリートメント ¥4,180'),
         ('MASK', 'セラムマスク', 'バイカルテ_セラムマスク_100g.webp', '週に 1 回', '熱に反応する集中ケア', 'マスク ¥2,420'),
         ('OIL', 'エッセンスオイル', 'バイカルテ_エッセンスオイル_95ml.webp', '乾かす前に', '熱と紫外線から髪を守る', 'オイル ¥3,300')],
  story=dict(img='hero', alt='都会の屋上で遠くを見る女性', eyebrow='THE STORY', h='口コミで 広がってきたブランド',
             p='ヘアカラーで知られるホーユーが 補修の分野に踏み出して生まれたブランド<br>全国に広げる前に 札幌で約 1 年 試験販売をし 広告より口コミで広めてきました　日本では 講習を受けた一部のサロンだけが扱っています',
             hist=[('2021', '発売（ホーユー・名古屋）'), ('2024', 'UH+ と HS+ が加わり 18 通りに'), ('2025', 'セラムマスクとコンセントレイトエッセンス')]),
 ),
}

def build(slug):
    b = BR[slug]; IMG = f'images/brands/{slug}/'; URL = f'https://seam.site/{slug}-story'
    g = open('guide-salon-senyo.html', encoding='utf-8').read()
    head = g[:g.index('<body>')]
    head = re.sub(r'<script type="application/ld\+json">.*?</script>', '@@LD@@', head, flags=re.S)
    head = re.sub(r'<title>.*?</title>', f'<title>{b["title"]}</title>', head)
    for prop in ['name="description"', 'property="og:description"']:
        head = re.sub(rf'<meta {prop} content="[^"]*">', f'<meta {prop} content="{b["desc"]}">', head)
    head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{b["title"]}">', head)
    head = head.replace('seam.site/guide-salon-senyo', f'seam.site/{slug}-story')
    head = head.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Shippori+Mincho:wght@400;500&display=swap">\n<link rel="stylesheet" href="css/brand-story.css?v=2">\n</head>')
    body_head = re.sub(r' data-i18n="[^"]*"', '', g[g.index('<body>'):g.index('<main')])
    tail = re.sub(r' data-i18n="[^"]*"', '', g[g.index('</main>') + 7:])
    tail = re.sub(r'window\.SEAM_PAGE_I18N\s*=\s*\{.*?\};', 'window.SEAM_PAGE_I18N = @@DICT@@;', tail, flags=re.S)
    LAZY, EAGER = ' loading="lazy"', ' fetchpriority="high"'
    pic = lambda n, alt, w, h, lazy=True: f'<picture><source srcset="{IMG}story/{n}.webp" type="image/webp"><img src="{IMG}story/{n}.jpg" alt="{alt}" width="{w}" height="{h}"{LAZY if lazy else EAGER}></picture>'
    f = b['feature']; s = b['story']
    effects = ''.join(f'<figure><div class="bs-eff-img">{pic(n, t, 1200, 900)}</div><figcaption><b>0{i+1}　{t}</b>{c}</figcaption></figure>' for i, (n, t, c) in enumerate(b['effects']))
    lines = ''.join(f'''<article class="bs-line"><div class="bs-line-img"><img src="{IMG}story/p/{img}" alt="{b['word']} {ja}" loading="lazy" width="600" height="600"></div><p class="bs-eyebrow">{en}</p><h3>{ja}<span>{who}</span></h3><p>{what}</p><p class="bs-price">{price}</p></article>''' for en, ja, img, who, what, price in b['lines'])
    hist = ''.join(f'<li><b>{y}</b><span>{t}</span></li>' for y, t in s['hist'])
    main = f'''<main id="seam-main" class="bs {b['theme']}">
  <section class="bs-hero" data-track-view="{slug}_story_hero">
    {pic('hero', b['story']['alt'] if slug=='bykarte' else '流れる淡いピンクの布', 1920, 1086, False)}
    <div class="bs-hero-copy">
      <p class="bs-eyebrow">{b['eyebrow']}</p>
      <h1><span class="bs-word">{b['word']}</span><span class="bs-h1-ja">{b['h1ja']}</span></h1>
      <p>{b['sub']}</p>
    </div>
  </section>
  <section class="bs-intro">
    <p class="bs-big">{b['intro_big']}<small>{b['intro_unit']}</small></p>
    <div><h2>{b['intro_h']}</h2><p>{b['intro_p']}</p></div>
  </section>
  <section class="bs-feature" data-track-view="{slug}_story_feature">
    <div class="bs-feature-img">{pic(f['img'], f['alt'], 1200, 1600)}</div>
    <div><p class="bs-eyebrow">{f['eyebrow']}</p><h2>{f['h']}</h2><p>{f['p']}</p></div>
  </section>
  <section class="bs-effects" data-track-view="{slug}_story_effects">
    <p class="bs-eyebrow">WHAT HAPPENS IN YOUR HAIR</p>
    <h2>髪に起きる 3 つのこと</h2>
    <div class="bs-eff-grid">{effects}</div>
    <p class="bs-note">画像はイメージです</p>
  </section>
  <section class="bs-lines" data-track-view="{slug}_story_lines">
    <p class="bs-eyebrow">THE LINES</p>
    <h2>{b['lines_h']}</h2>
    <div class="bs-line-grid">{lines}</div>
    <p class="bs-note">価格は定価（税込）　容量やほかの品は店頭でご案内します　<a href="{b['brandpage']}">全商品を見る →</a></p>
  </section>
  <section class="bs-story" data-track-view="{slug}_story_story">
    <div><p class="bs-eyebrow">{s['eyebrow']}</p><h2>{s['h']}</h2><p>{s['p']}</p><ol class="bs-history">{hist}</ol></div>
  </section>
  <section class="bs-ginza" data-track-view="{slug}_story_buy">
    <picture><source srcset="images/brands/tokio_inkarami/story/ginza2.webp" type="image/webp"><img src="images/brands/tokio_inkarami/story/ginza2.jpg" alt="夕暮れの銀座四丁目の交差点" loading="lazy" width="1920" height="1086"></picture>
    <div class="bs-buy">
      <p class="bs-eyebrow">AT SEAM</p>
      <h2>銀座で 髪を見て選ぶ</h2>
      <p>SEAM GINZA は ONE GINZA 3F　銀座一丁目駅 7 番出口から徒歩 1 分<br>スタッフが髪を見て ラインと使う順番をご案内します　全 7 店で免税対応　パスポートをお持ちください</p>
      <p class="bs-cta"><a href="shop.html#stores" data-track-click="{slug}_story_stores">店舗を見る</a><a href="finder.html" data-track-click="{slug}_story_finder">髪格診断（3 分・無料）</a><a href="{b['brandpage']}" data-track-click="{slug}_story_items">全商品を見る</a></p>
    </div>
  </section>
</main>'''
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "WebPage", "name": b['title'], "description": b['desc'], "url": URL, "inLanguage": "ja",
         "about": {"@type": "Brand", "name": b['word']}, "publisher": {"@id": "https://seam.site/#organization"}},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://seam.site/"},
            {"@type": "ListItem", "position": 2, "name": b['crumb'], "item": f"https://seam.site/{slug}"},
            {"@type": "ListItem", "position": 3, "name": "ブランドストーリー", "item": URL}]}]}
    out = head.replace('@@LD@@', '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>') + body_head + main + tail.replace('@@DICT@@', json.dumps({"ja": {"meta.title": b['title'], "meta.description": b['desc']}}, ensure_ascii=False))
    open(f'{slug}-story.html', 'w', encoding='utf-8').write(out)
    print(f'{slug}-story.html written')

for s in (sys.argv[1:] or BR):
    build(s)

# オージュア・バイカルテのブランドページ（/aujua-story・/bykarte-story）。2026-10-02 所有者
# 事実は ~/Downloads/seam-points-review/ブランドページ_202610/*_公式資料.md（公式サイトを自分の言葉で要約）だけを使う
# 書かないこと：治る・生える・元に戻る・頭皮や育毛の効果・未確認の数字（取扱店数・開発年数・海外の販売国）
# 製品の写真は本物（images/brands/<brand>/）。雰囲気の写真は各メーカーの公式サイトの作風に寄せて生成（製品とロゴは写さない）
# 使い方: python3 scripts/build_brand_story.py
import re, json, sys

BR = {
 'aujua': dict(
  theme='th-aujua', title='Aujua｜日本の髪のために ミルボンが生んだヘアケア｜SEAM',
  desc='アジアの髪と日本の気候を研究して生まれたオージュア 2010年にミルボンが送り出したサロン専売ヘアケアのこだわり 8つのラインの成分 香り 価格 使い方 SEAM全店で免税対応',
  crumb='オージュア', brandpage='aujua.html',
  eyebrow='SALON HAIR CARE BY MILBON, JAPAN', word='Aujua', h1ja='悩みは 一人ひとり違うから',
  sub='日本の気候と アジアの髪から生まれたヘアケア',
  intro_big='134', intro_unit='concerns', intro_h='悩みを 134 に分けるところから',
  intro_p='開発のはじめに 髪と頭皮の悩みを 134 に分けて整理しました<br>全員に同じ一本を勧めるのではなく 20 を超えるラインから その人の髪に合わせて組み合わせる　2010 年 ミルボンが立ち上げたブランドです',
  feature=dict(img='sommelier', alt='美容師がお客様の髪の状態を確かめている様子', eyebrow='AUJUA SOMMELIER', h='髪を見て 選ぶ人がいる',
               p='オージュアソムリエは ミルボンが認定する美容師　所定の教育を受け 試験に合格した人だけが名乗れます（2013 年〜）<br>髪と地肌の知識 施術の技術 カウンセリングの 3 つを柱に ホームケアの組み合わせ（公式では 120,960 通り）から その人に合うものを選びます'),
  kodawari=[('アジアの髪を研究して', 'くせやうねりが多いこと カラーで髪の脂質が減ってパサつくこと 年齢とともに髪の中に空洞ができること　アジアの人に多い髪の傾向を前提に作られています'),
            ('日本の気候に合わせて', '湿気の多い季節はうねり 乾く季節は乾燥 夏は紫外線　季節で変わる悩みに向けたラインもあります'),
            ('ナノの単位まで見る', '兵庫県の大型放射光施設 SPring-8 などを使い 7 つの手法で髪の内側を分析しています'),
            ('来るたびに組み直す', 'カウンセリング 診断 サロンでのケア ホームケア　決まった処方を繰り返すのではなく その日の髪に合わせて組み直します'),
            ('花で選ぶ香り', '流行を追わず ラインの考え方に合う花を選んでいます　ブリーチ毛向けのリペアリティは 年に 2 回咲くガーベラ'),
            ('美容室だけで', '美容師の助言とともに届けることを前提にした 美容室専売品です')],
  effects=[('inside', '内側へ', 'ケラチン CMADK などで 髪の内側の欠けたところを補う'), ('cuticle', '表面を整える', '開いたキューティクルを整え なめらかに'), ('gloss', 'ツヤ', '光をきれいに返す うるおいのある髪へ')],
  lines_h='悩みから選ぶ 8 つのライン',
  lines=[('AQUAVIA', 'アクアヴィア', 'Aujua_アクアヴィア_シャンプー_250mL.webp', 'くせで広がる髪', '髪の中の水分の偏りを整え まとまりやすく', 'シャンプー ¥3,080',
          [('しくみ', 'TPG が水を抱えて 髪の中の水分を均一に　アルカンオイルで柔らかく'), ('香り', '桜'), ('品目', 'シャンプー・トリートメント・ニュートリエント・セラム'), ('価格', 'シャンプー 250mL ¥3,080／トリートメント 250g ¥4,180／ニュートリエント 150g ¥4,730／セラム 100mL ¥2,860')]),
         ('QUENCH', 'クエンチ', 'Aujua_クエンチ_シャンプー_250mL.webp', '乾燥 パサつき', '水分の逃げを防ぎ うるおいのある髪へ', 'シャンプー ¥3,080',
          [('しくみ', 'オリーブスクワランとモイストリキッドオイルが 髪の中の乱れを補い 水分が逃げるのを抑える'), ('香り', '牡丹'), ('品目', 'シャンプー・トリートメント・ニュートリエント・ミスト・セラム・フルイド'), ('価格', 'シャンプー ¥3,080／トリートメント ¥4,180／ミスト ¥2,200／セラム ¥2,860')]),
         ('SMOOTH', 'スムース', 'Aujua_スムース_シャンプー_250mL.webp', '細く絡まりやすい髪', '表面にすべりをつくり さらさらに', 'シャンプー ¥3,080',
          [('しくみ', 'スムースリペアオイルが キューティクルの上にすべりのよい膜をつくる'), ('香り', '白いバラ'), ('品目', 'シャンプー・トリートメント・セラム'), ('価格', 'シャンプー ¥3,080／トリートメント ¥4,180／セラム ¥2,860')]),
         ('IMMURISE', 'イミュライズ', 'Aujua_イミュライズ_シャンプー_250mL.webp', 'カラーと年齢のダメージ', 'しなやかで 扱いやすい髪へ', 'シャンプー ¥3,850',
          [('しくみ', 'ケラチン CMADK が髪にしっかり付き ロイシンが中まで届けやすくする'), ('香り', 'ローズ・ド・メ'), ('品目', 'シャンプー・トリートメント・ニュートリエント・エクシードセラム・ジェルステムライザー'), ('価格', 'シャンプー ¥3,850／トリートメント ¥4,950／ニュートリエント ¥5,500／セラム ¥4,180')]),
         ('INMETRY', 'インメトリィ', 'Aujua_インメトリィ_シャンプー_250mL.webp', 'くせとダメージ', 'ゆがんだ髪をそろえ ツヤとまとまりを', 'シャンプー ¥5,500',
          [('しくみ', '3D-CMADK と MX-CMADK の 2 つのケラチンで 抜けたタンパク質を補う'), ('香り', '青いバラ'), ('品目', 'シャンプー・トリートメント・コントロールクリーム・セラム・ミルク'), ('価格', 'シャンプー ¥5,500／トリートメント ¥6,600／クリーム ¥4,400／セラム・ミルク ¥5,830')]),
         ('FILLMELLOW', 'フィルメロウ', 'Aujua_フィルメロウ_シャンプー_250mL.webp', '熱で硬くなった髪', 'アイロンの熱でこわばった髪を やわらかく', 'シャンプー ¥3,080',
          [('しくみ', 'ヒドロキシエチルウレア（天然の保湿因子に由来する柔軟成分）'), ('香り', '赤いバラ'), ('品目', 'シャンプー・トリートメント・ミルク'), ('価格', 'シャンプー ¥3,080／トリートメント ¥4,180／ミルク ¥2,860')]),
         ('REPAIRITY', 'リペアリティ', 'Aujua_リペアリティ_シャンプー_250mL.webp', 'ブリーチ毛', 'スカスカで硬くなった髪の内側を満たす', 'シャンプー ¥3,850',
          [('しくみ', 'MX-CMADK が髪にしっかり付き ニーム葉エキスが髪の中の水分を保つ'), ('香り', 'ガーベラ'), ('品目', 'シャンプー・トリートメント・シュペリアエッセンス・シアーフォーム'), ('価格', 'シャンプー ¥3,850／トリートメント ¥4,950／エッセンス ¥4,180／フォーム ¥3,520')]),
         ('MIRAGERY', 'ミラジェリィ', 'オージュア_ミラジェリィ_シャンプー_250ml.webp', 'いちばん上のライン', '広がって崩れた髪の形を整える', 'シャンプー ¥5,500',
          [('しくみ', '3D-CMADK・MX-CMADK・MOIST-CMADK の 3 つのケラチン'), ('香り', 'ウツギの花'), ('品目', 'シャンプー・トリートメント・エッセンス'), ('価格', 'シャンプー ¥5,500／トリートメント ¥6,600／エッセンス ¥5,830')])],
  howto=[('IN BATH　洗う', '38℃前後のお湯でよく流してから シャンプー 2〜3 プッシュを手で泡立て 地肌をもみ洗い'),
         ('IN BATH　補う', 'トリートメントを毛先中心に 約 30 秒なじませる　毛束をねじると行き渡りやすい　週 1〜2 回はニュートリエントで集中ケア'),
         ('OUT BATH　守る', 'タオルで拭いた髪に セラムやミルク 2〜3 プッシュを 毛先 → 内側 → 表面の順に　そのあとドライヤー')],
  salon=dict(h='サロンで受ける オージュアのトリートメント', p='美容師が髪の状態を見て 段階を重ねて補修するサロントリートメントがあります<br>ステップの数はラインによって 3 から 7 まで　家で使う品より持ちがよいように作られています'),
  story=dict(eyebrow='THE BOTTLE', h='ボトルに込めたもの',
             p='やわらかな曲線は 日本の女性のしなやかさとやさしさ<br>左右がわずかに違う形は 進化し続けること　銀色は 研究が前へ進むことを表しています',
             hist=[('2010', 'ミルボンがオージュアを発売'), ('2013', 'オージュアソムリエの認定が始まる'), ('いま', '20 を超えるラインに')]),
 ),
 'bykarte': dict(
  theme='th-bykarte', title='BYKARTE｜髪のカルテから生まれたヘアケア｜SEAM',
  desc='美容師を髪のお医者さんにたとえた カルテから生まれたサロン専売ヘアケア バイカルテ シスチンに着目したホーユーの技術 髪質と仕上がりで選ぶ組み合わせ 成分 香り 価格 使い方 SEAM全店で免税対応',
  crumb='バイカルテ', brandpage='bykarte.html',
  eyebrow='SALON HAIR CARE BY HOYU, JAPAN', word='BYKARTE', h1ja='髪のカルテから 処方を選ぶ',
  sub='目指すのは 傷みのない まっさらな素髪',
  intro_big='18', intro_unit='combinations', intro_h='髪質 × 仕上がりで 選ぶ',
  intro_p='名前は 医療の「カルテ」から　美容師を髪のお医者さんにたとえ 一人ひとりの髪を記録して向き合う という考え方です<br>シャンプーは髪質で トリートメントは仕上がりで 洗い流さないケアは質感で選び 18 通りの組み合わせから決めます',
  feature=dict(img='lab', alt='白いタイルの上のガラスのビーカー', eyebrow='THE TECHNOLOGY', h='シスチンに 着目した',
               p='シスチンは 髪の強さとしなやかさを支える成分　カラーや紫外線で減ると 髪の内側が空洞のようになります<br>ホーユー独自の CiP SHOT は シスチンがアルカリ性で溶け 弱酸性で固まる性質を使って 髪の内側に補う技術　サロンの施術で使われます　家で使う品は その仕上がりを保ち 次の施術に備える役目です'),
  kodawari=[('名前は「カルテ」から', '美容師を髪のお医者さんにたとえ 一人ひとりの髪をカルテのように記録して向き合う'),
            ('目指すのは 素髪', '多くのサロンに理想の髪を聞いて返ってきた答えが 傷みのない まっさらな髪でした'),
            ('約 4 年をかけて', 'シスチンを補う技術は 10 年以上前から社内で検討され 構想から約 4 年かけて 2021 年に発売'),
            ('口コミで 広がった', '広告に頼るより 実際に体験した人の声を大切にして 広めてきました'),
            ('講習を受けたサロンだけ', '全国約 25 万店のうち 講習を受けた約 1% のサロンだけが扱っています（2024〜25 年の発表）'),
            ('電子顕微鏡で 髪を見る', '名古屋大学の大型電子顕微鏡を使い 髪を 10 億分の 1 メートルの単位まで解析しています')],
  effects=[('inside', '内側へ', 'サロンの施術で 空洞にシスチンを補う'), ('cuticle', '表面を整える', '18-MEA 誘導体などで キューティクルを整える'), ('gloss', 'ツヤ', 'やわらかく 光を返す髪へ')],
  lines_h='髪質と仕上がりで選ぶ',
  lines=[('CH+', 'リペアシャンプー CH+', 'バイカルテ_リペア_シャンプー_CH+_280ml.webp', '普通〜硬い髪', 'やわらかな洗い上がり', 'シャンプー ¥4,180',
          [('成分', 'PPT 系の洗浄成分　ケラチンとシルク由来の成分　サルフェートとシリコーンは不使用'), ('容量と価格', '75mL ¥1,320／280mL ¥4,180／600mL ¥6,820')]),
         ('FH+', 'リペアシャンプー FH+', 'バイカルテ_リペア_シャンプー_FH+_280ml.webp', '細い やわらかい髪', 'しなやかな洗い上がり', 'シャンプー ¥4,180',
          [('成分', 'PPT 系の洗浄成分　ケラチンとシルク由来の成分　サルフェートとシリコーンは不使用'), ('容量と価格', '75mL ¥1,320／280mL ¥4,180／600mL ¥6,820')]),
         ('UH+', 'リペアシャンプー UH+', 'バイカルテ_リペア_シャンプー_UH+_280ml.webp', 'くせ うねり', 'さっぱりした洗い上がり', 'シャンプー ¥4,180',
          [('成分', 'ソルビトール・サッカリン Na・ケラチン由来の成分で うねった部分に働きかける'), ('香り', 'みずみずしいペアーにパチュリ'), ('容量と価格', '75mL ¥1,320／280mL ¥4,180／600mL ¥6,820')]),
         ('SS+', 'セラムトリートメント SS+', 'バイカルテ_セラムトリートメント_SS+_250g.webp', 'さらさら', '指通りのよい仕上がり', 'トリートメント ¥4,180',
          [('成分', 'リペアアミノ・18-MEA 誘導体・メドウフォーム-δ-ラクトン'), ('容量と価格', '60g ¥1,320／250g ¥4,180／600g ¥7,920')]),
         ('MS+', 'セラムトリートメント MS+', 'バイカルテ_セラムトリートメント_MS+_250g.webp', 'しっとり', 'うるおいがあり やわらかくまとまる', 'トリートメント ¥4,180',
          [('成分', 'リペアアミノ・18-MEA 誘導体・メドウフォーム-δ-ラクトン'), ('容量と価格', '60g ¥1,320／250g ¥4,180／600g ¥7,920')]),
         ('HS+', 'セラムトリートメント HS+', 'バイカルテ_セラムトリートメント_HS+_250g.webp', '強いダメージ', 'しっとり なめらかな高補修', 'トリートメント ¥4,180',
          [('成分', '共通の補修成分に シア脂とムルムル脂を加えて'), ('香り', 'グレープフルーツとフローラルブーケ'), ('容量と価格', '60g ¥1,320／250g ¥4,180／600g ¥7,920')]),
         ('MASK', 'セラムマスク', 'バイカルテ_セラムマスク_100g.webp', '週に 1〜2 回', 'サロンの仕上がりを長持ちさせる', 'マスク ¥2,420',
          [('処方', 'サロンケアと共通の補修成分に 熱で定着を促す処方'), ('使い方', '水気をよく切り 中間から毛先へ揉み込む　ミディアムでさくらんぼ 2 粒ほど　すすいだら熱を当てて乾かす'), ('容量と価格', '100g ¥2,420')]),
         ('OIL', 'エッセンスオイル', 'バイカルテ_エッセンスオイル_95ml.webp', 'ツヤと指通り', '熱と紫外線から髪を守る', 'オイル ¥3,300',
          [('成分', '熱から守る成分と 紫外線から守る成分'), ('ほかに', 'うるおいとまとまりのエッセンスミルク（95mL ¥3,300）　毛先専用のコンセントレイトエッセンス（40g ¥2,200）'), ('容量と価格', '95mL ¥3,300')])],
  howto=[('洗う', 'シャンプーは髪質で選ぶ　細い髪は FH+ 普通〜硬い髪は CH+ くせやうねりは UH+'),
         ('補う', 'トリートメントは仕上がりで選ぶ　さらさらは SS+ しっとりは MS+ 強いダメージは HS+　週 1〜2 回はセラムマスク'),
         ('守る', 'タオルで拭いた髪に エッセンスオイルかミルク　毛先にはコンセントレイトエッセンスを パール 1〜3 粒')],
  salon=dict(h='サロンで受ける バイカルテのトリートメント', p='サロンでは 何段階かの薬剤を重ねるシステムトリートメントを行います　シスチンを補う CiP SHOT は この施術で使われる技術です<br>家でのケアは 施術の仕上がりを保ち 次の施術に備える役目です'),
  story=dict(eyebrow='THE STORY', h='口コミで 広がってきたブランド',
             p='ヘアカラーで知られるホーユーが 補修の分野に踏み出して生まれたブランド<br>外装はシンプルな形の中で 表面の色や加工にこだわり シャンプーのポンプは箱に同梱しています',
             hist=[('2021', '発売（ホーユー・名古屋）'), ('2024', 'UH+ と HS+ が加わり 組み合わせは 18 通りに'), ('2025', 'セラムマスクとコンセントレイトエッセンス')]),
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
    head = head.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Shippori+Mincho:wght@400;500&display=swap">\n<link rel="stylesheet" href="css/brand-story.css?v=4">\n</head>')
    body_head = re.sub(r' data-i18n="[^"]*"', '', g[g.index('<body>'):g.index('<main')])
    tail = re.sub(r' data-i18n="[^"]*"', '', g[g.index('</main>') + 7:])
    tail = re.sub(r'window\.SEAM_PAGE_I18N\s*=\s*\{.*?\};', 'window.SEAM_PAGE_I18N = @@DICT@@;', tail, flags=re.S)
    LAZY, EAGER = ' loading="lazy"', ' fetchpriority="high"'
    pic = lambda n, alt, w, h, lazy=True: f'<picture><source srcset="{IMG}story/{n}.webp" type="image/webp"><img src="{IMG}story/{n}.jpg" alt="{alt}" width="{w}" height="{h}"{LAZY if lazy else EAGER}></picture>'
    f = b['feature']; s = b['story']
    effects = ''.join(f'<figure><div class="bs-eff-img">{pic(n, t, 1200, 900)}</div><figcaption><b>0{i+1}　{t}</b>{c}</figcaption></figure>' for i, (n, t, c) in enumerate(b['effects']))
    def det(rows): return '<details class="bs-det"><summary>詳しく見る</summary><dl>' + ''.join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in rows) + '</dl></details>'
    lines = ''.join(f'''<article class="bs-line"><div class="bs-line-img"><img src="{IMG}story/p/{img}" alt="{b['word']} {ja}" loading="lazy" width="600" height="600"></div><p class="bs-eyebrow">{en}</p><h3>{ja}<span>{who}</span></h3><p>{what}</p><p class="bs-price">{price}</p>{det(rows)}</article>''' for en, ja, img, who, what, price, rows in b['lines'])
    kod = ''.join(f'<li><b>{k}</b><span>{v}</span></li>' for k, v in b['kodawari'])
    how = ''.join(f'<li><b>{k}</b><span>{v}</span></li>' for k, v in b['howto'])
    hist = ''.join(f'<li><b>{y}</b><span>{t}</span></li>' for y, t in s['hist'])
    main = f'''<main id="seam-main" class="bs {b['theme']}">
  <section class="bs-hero" data-track-view="{slug}_story_hero">
    {pic('hero', {'aujua': '流れる淡いピンクの布', 'bykarte': '都会の屋上で遠くを見る女性'}[slug], 1920, 1086, False)}
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
  <section class="bs-kod" data-track-view="{slug}_story_kodawari">
    <p class="bs-eyebrow">OUR COMMITMENT</p>
    <h2>{b['crumb']}の こだわり</h2>
    <ol class="bs-kod-list">{kod}</ol>
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
    <p class="bs-note">価格はメーカー公式の定価（税込・2026 年 10 月確認）　容量やほかの品は店頭でご案内します　<a href="{b['brandpage']}">全商品を見る →</a></p>
  </section>
  <section class="bs-how" data-track-view="{slug}_story_howto">
    <p class="bs-eyebrow">HOW TO USE</p>
    <h2>毎日の使い方</h2>
    <ol class="bs-how-list">{how}</ol>
  </section>
  <section class="bs-salon" data-track-view="{slug}_story_salon">
    <p class="bs-eyebrow">IN THE SALON</p>
    <h2>{b['salon']['h']}</h2>
    <p>{b['salon']['p']}</p>
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

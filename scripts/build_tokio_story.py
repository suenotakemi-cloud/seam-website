# TOKIO INKARAMI のブランドページ（/tokio-story）。2026-10-02 所有者「公式より深く・リッチに・海外の方が一度は使ってみたいと思うように」
# 事実は ~/Downloads/seam-points-review/ブランドページ_202610/TOKIO_公式資料.md（公式サイトを自分の言葉で要約）だけを使う
# 書かないこと：世界No.1・治る・再生・頭皮や育毛の効果・ノーベル賞との結びつけ・特許番号（未確認）・140%（条件不明）
# 製品の写真は本物（images/brands/tokio_inkarami/ifing/）。雰囲気の写真は生成（製品とロゴは写さない）
import re, json

URL = 'https://seam.site/tokio-story'
TITLE = 'TOKIO INKARAMI｜銀座で生まれたケラチン補修のヘアケア｜SEAM'
DESC = '髪の約7割をつくるケラチンを 内側から補うために生まれた TOKIO インカラミ 銀座のイフイングが2011年に送り出したサロン専売ヘアケアの考え方と技術 4つのラインの選び方 SEAM全店で免税対応'
IMG = 'images/brands/tokio_inkarami/'

g = open('guide-salon-senyo.html', encoding='utf-8').read()
head = g[:g.index('<body>')]
head = re.sub(r'<script type="application/ld\+json">.*?</script>', '@@LD@@', head, flags=re.S)
head = re.sub(r'<title>.*?</title>', f'<title>{TITLE}</title>', head)
for prop in ['name="description"', 'property="og:description"']:
    head = re.sub(rf'<meta {prop} content="[^"]*">', f'<meta {prop} content="{DESC}">', head)
head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{TITLE}">', head)
head = head.replace('seam.site/guide-salon-senyo', 'seam.site/tokio-story')
head = head.replace('</head>', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Shippori+Mincho:wght@400;500&display=swap">\n<link rel="stylesheet" href="css/tokio-story.css?v=5">\n</head>')
body_head = re.sub(r' data-i18n="[^"]*"', '', g[g.index('<body>'):g.index('<main')])
tail = re.sub(r' data-i18n="[^"]*"', '', g[g.index('</main>') + 7:])
tail = re.sub(r'window\.SEAM_PAGE_I18N\s*=\s*\{.*?\};', 'window.SEAM_PAGE_I18N = @@DICT@@;', tail, flags=re.S)

LINES = [
    ('PLATINUM', 'プラチナム', 'story/platinum-cut.webp', '軽く さらりと', 'カラーやパーマで傷んだ髪 細く絡まりやすい髪に<br>軽くしなやかな仕上がり', 'シャンプー・トリートメント 400 各 ¥5,500',
     [('主な成分', '水鳥由来のケラチン ジェミニ型アミノ酸 フラーレン（保湿成分）　洗浄はタウリン系のアミノ酸'), ('香り', 'レモングラス'), ('容量と価格', '200 各 ¥3,300／400 各 ¥5,500／詰め替え 700 各 ¥8,250')]),
    ('PREMIUM', 'プレミアム', 'story/premium-cut.webp', 'しっとり まとまる', 'カラーやアイロンを重ねた 強いダメージの髪に<br>重みのある しっとりした仕上がり', 'シャンプー・トリートメント 400 各 ¥6,270',
     [('主な成分', 'シルクとコラーゲン由来の洗浄成分　分子の大きさが違う 4 種のケラチン 18-MEA セラミド スクワラン'), ('香り', 'シャンプーはラベンダー　トリートメントはスウィートフローラル'), ('容量と価格', '400 各 ¥6,270／詰め替え 700 各 ¥9,350')]),
    ('LIMITED', 'リミテッド', 'story/limited-cut.webp', 'もう一段 上の手触り', 'プラチナム リミテッドは ゴワつきや硬さが気になる髪を柔らかく<br>プレミアム リミテッドは ハリが落ちた髪や毛先のパサつきに', 'シャンプー・トリートメント 400 各 ¥6,490',
     [('香り', 'プラチナム リミテッドはレモングラス　プレミアム リミテッドのトリートメントはスウィートフローラル'), ('容量と価格', '400 各 ¥6,490／詰め替え 700 各 ¥9,460')]),
    ('OUTKARAMI', 'アウトカラミ', 'story/outkarami-cut.webp', '乾かす前のひと手間', '洗い流さないトリートメント 4 種<br>ドライヤーの熱で キューティクルを補修する処方', 'オイル・ミスト ¥4,290〜',
     [('プラチナム オイル', '軽くサラッと ツヤ　レモングラス　100ml ¥4,290'), ('プレミアム エアー', 'ミスト　細くペタッとしやすい髪に　100ml ¥4,290'), ('プラチナム リミテッド クリームオイル', 'ゴワつく髪を柔らかく　100g ¥4,620'), ('プレミアム リミテッド オイル', '毛先の広がりを抑える　100ml ¥4,620')]),
]
STEPS = [('0', '浸透を助ける', '尿素で 硬くなったケラチンを柔らかくし 入りやすくする'), ('1', 'ケラチンの土台', '水鳥由来の小さなケラチンを 傷んだ部分へ'), ('2', '中で結びつける', '髪の中でケラチンをつなぎ 大きくする'), ('3', '補強する', '羊毛由来のケラチンと植物の成分で 内側を補強'), ('4', '表面を整える', '18-MEA やセラミドで 手触りとツヤを仕上げる')]
KODAWARI = [('ケラチンに着目して', '髪の約 7 割はケラチン　ダメージで壊れたケラチンは自然には戻らないため 補修の考え方から見直しました'),
            ('内側で 結びつく', '表面を覆うだけでなく 小さなケラチンが髪の中に入り 中で結びつく　それがインカラミ（メーカーが特許技術としている反応）'),
            ('洗う段階から補修', 'シャンプーは汚れを落とすだけでなく 穏やかな洗浄成分で洗いながら補修する設計'),
            ('家のケアに サロンの成分', 'シャンプーにはサロンの 1 番 トリートメントには 2〜4 番の成分が入っています'),
            ('熱を 補修に使う', 'アウトカラミは ドライヤーの熱を使ってキューティクルを補修する処方'),
            ('東京から 世界へ', '名前は東京（TOKIO）から　日本の美容技術を世界へ届けたいという思いで 2015 年にパリから海外へ')]
HISTORY = [('2003', '銀座でイフイングが始まる'), ('2011', 'TOKIO インカラミが生まれる'), ('2015', 'パリから海外へ'), ('2017', '本社を GINZA SIX へ'), ('2022', 'ブランドを新しくする')]

det = lambda rows: '<details class="ts-det"><summary>詳しく見る</summary><dl>' + ''.join(f'<div><dt>{k}</dt><dd>{v}</dd></div>' for k, v in rows) + '</dl></details>'
lines = ''.join(f'''
      <article class="ts-line" data-track-view="ts_line_{en.lower()}">
        <div class="ts-line-img"><img src="{IMG}{img}" alt="TOKIO INKARAMI {en}" loading="lazy" width="467" height="700"></div>
        <p class="ts-eyebrow">{en}</p>
        <h3>{ja}<span>{feel}</span></h3>
        <p>{body}</p>
        <p class="ts-price">{price}</p>{det(rows)}
      </article>''' for en, ja, img, feel, body, price, rows in LINES)
steps = ''.join(f'<li><b>{n}</b><span>{t}</span><small>{d}</small></li>' for n, t, d in STEPS)
kod = ''.join(f'<li><b>{k}</b><span>{v}</span></li>' for k, v in KODAWARI)
hist = ''.join(f'<li><b>{y}</b><span>{t}</span></li>' for y, t in HISTORY)

main = f'''<main id="seam-main" class="ts">
  <section class="ts-hero" data-track-view="ts_hero">
    <picture><source srcset="{IMG}story/hero.webp" type="image/webp"><img src="{IMG}story/hero.jpg" alt="ツヤのある黒髪のクローズアップ" width="1920" height="1080" fetchpriority="high"></picture>
    <div class="ts-hero-copy">
      <p class="ts-eyebrow">SALON HAIR CARE FROM GINZA, TOKYO</p>
      <h1><span class="ts-word">TOKIO INKARAMI</span><span class="ts-h1-ja">髪の内側から もう一度</span></h1>
      <p>銀座で生まれた ケラチン補修のヘアケア</p>
    </div>
  </section>

  <section class="ts-intro" data-track-view="ts_intro">
    <p class="ts-big">70<small>%</small></p>
    <div>
      <h2>髪の約 7 割は ケラチン</h2>
      <p>カラーや熱で失われたケラチンを 外から覆うのではなく 内側から補う<br>TOKIO インカラミは そのためだけに作られたブランドです</p>
    </div>
  </section>

  <section class="ts-tech" data-track-view="ts_tech">
    <div class="ts-tech-copy">
      <p class="ts-eyebrow">THE TECHNOLOGY</p>
      <h2>IN ＋ KARAMI</h2>
      <p>インカラミは「浸透する（IN）」と「絡む（KARAMI）」を合わせた名前<br>小さなケラチンが髪の内側まで入り 中で結びついて大きくなる だから抜け出しにくい という考え方です</p>
      <svg class="ts-anim" viewBox="0 0 320 120" role="img" aria-label="小さな粒が髪の中に入り つながっていく図">
        <rect x="10" y="40" width="300" height="40" rx="20" fill="none" stroke="currentColor" stroke-opacity=".35"/>
        <g class="ts-dots"><circle cx="40" cy="20" r="4"/><circle cx="80" cy="12" r="4"/><circle cx="120" cy="22" r="4"/><circle cx="160" cy="14" r="4"/><circle cx="200" cy="20" r="4"/><circle cx="240" cy="12" r="4"/><circle cx="280" cy="22" r="4"/></g>
        <path class="ts-link" d="M40 60 L80 60 L120 60 L160 60 L200 60 L240 60 L280 60" fill="none" stroke="currentColor" stroke-width="2"/>
      </svg>
      <p class="ts-note">3 種類のケラチンを使用（メーカーの説明）　インカラミはメーカーが特許技術としている技術です</p>
    </div>
  </section>

  <section class="ts-kod" data-track-view="ts_kodawari">
    <p class="ts-eyebrow">OUR COMMITMENT</p>
    <h2>TOKIO インカラミの こだわり</h2>
    <ol class="ts-kod-list">{kod}</ol>
  </section>

  <section class="ts-effects" data-track-view="ts_effects">
    <p class="ts-eyebrow">WHAT HAPPENS IN YOUR HAIR</p>
    <h2>髪に起きる 3 つのこと</h2>
    <div class="ts-eff-grid">
      <figure><div class="ts-eff-img"><picture><source srcset="{IMG}story/inside.webp" type="image/webp"><img src="{IMG}story/inside.jpg" alt="髪の内側に成分が入るイメージ" loading="lazy" width="1200" height="1600"></picture></div><figcaption><b>01　内側へ</b>失われたケラチンを 髪の内側に補う</figcaption></figure>
      <figure><div class="ts-eff-img"><picture><source srcset="{IMG}story/cuticle.webp" type="image/webp"><img src="{IMG}story/cuticle.jpg" alt="髪の表面のキューティクルが整うイメージ" loading="lazy" width="1920" height="1080"></picture></div><figcaption><b>02　表面を整える</b>開いたキューティクルを整え 手触りをなめらかに</figcaption></figure>
      <figure><div class="ts-eff-img"><picture><source srcset="{IMG}story/hero.webp" type="image/webp"><img src="{IMG}story/hero.jpg" alt="ツヤのある黒髪" loading="lazy" width="1920" height="1080"></picture></div><figcaption><b>03　ツヤ</b>光をまっすぐ返す 毛先までのツヤへ</figcaption></figure>
    </div>
    <p class="ts-note">画像はイメージです</p>
  </section>

  <section class="ts-salon" data-track-view="ts_salon">
    <p class="ts-eyebrow">SALON TO HOME</p>
    <h2>サロンの施術を 毎日の家へ</h2>
    <p>サロンの TOKIO トリートメントは 段階を重ねる施術<br>家で使うシャンプーには 1 の成分を トリートメントには 2〜4 の成分を入れて 次の施術までの間をつなぎます</p>
    <ol class="ts-steps">{steps}</ol>
  </section>

  <section class="ts-lines" data-track-view="ts_lines">
    <p class="ts-eyebrow">THE LINES</p>
    <h2>髪に合わせて 4 つから</h2>
    <div class="ts-line-grid">{lines}
    </div>
    <p class="ts-note">価格はメーカー公式の定価（税込・2026 年 10 月確認）　シャンプーとトリートメントは同じシリーズで使うのがメーカーのおすすめです　店頭の在庫は店舗でご確認ください</p>
  </section>

  <section class="ts-ritual" data-track-view="ts_ritual">
    <div class="ts-ritual-img"><picture><source srcset="{IMG}story/ritual2.webp" type="image/webp"><img src="{IMG}story/ritual2.jpg" alt="窓辺で髪に指を通す女性" loading="lazy" width="1200" height="1600"></picture></div>
    <div>
      <p class="ts-eyebrow">THE RITUAL</p>
      <h2>毎日の 3 つの手順</h2>
      <ol class="ts-ritual-list">
        <li><b>洗う</b>予洗いのあと 指の腹で洗い 泡を目の粗いコームで全体に通してすすぐ</li>
        <li><b>補う</b>トリートメントを揉み込み 粗いコームでなじませて 5 分　浴室の湿気と温かさで入りやすくなります</li>
        <li><b>守る</b>タオルで拭いた髪にアウトカラミ　ドライヤーの熱で仕上げる</li>
      </ol>
    </div>
  </section>

  <section class="ts-story" data-track-view="ts_story">
    <picture><source srcset="{IMG}story/ginza2.webp" type="image/webp"><img src="{IMG}story/ginza2.jpg" alt="夕暮れの銀座四丁目の交差点" loading="lazy" width="1920" height="1080"></picture>
    <div class="ts-story-copy">
      <p class="ts-eyebrow">BORN IN GINZA</p>
      <h2>銀座から 世界へ</h2>
      <p>1990 年代のカラーブームで傷んだ髪を 十分に補修する方法がなかった<br>その答えとして 銀座の会社が 2011 年に送り出したブランドです</p>
      <ol class="ts-history">{hist}</ol>
    </div>
  </section>

  <section class="ts-buy" data-track-view="ts_buy">
    <p class="ts-eyebrow">AT SEAM</p>
    <h2>銀座で 髪を見て選ぶ</h2>
    <p>SEAM GINZA は ONE GINZA 3F　銀座一丁目駅 7 番出口から徒歩 1 分<br>スタッフが髪を見て ラインと使う順番をご案内します　全 7 店で免税対応　パスポートをお持ちください</p>
    <p class="ts-cta"><a href="shop.html#stores" data-track-click="ts_stores">店舗を見る</a><a href="finder.html" data-track-click="ts_finder">髪格診断（3 分・無料）</a><a href="tokio.html" data-track-click="ts_all_items">全商品を見る</a></p>
  </section>
</main>'''

ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "WebPage", "name": TITLE, "description": DESC, "url": URL, "inLanguage": "ja",
     "about": {"@type": "Brand", "name": "TOKIO INKARAMI"}, "publisher": {"@id": "https://seam.site/#organization"}},
    {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://seam.site/"},
        {"@type": "ListItem", "position": 2, "name": "トキオ インカラミ", "item": "https://seam.site/tokio"},
        {"@type": "ListItem", "position": 3, "name": "ブランドストーリー", "item": URL}]}]}
head = head.replace('@@LD@@', '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>')
meta = {"ja": {"meta.title": TITLE, "meta.description": DESC}}
try:
    meta = json.load(open('scripts/tokio_story_meta.json', encoding='utf-8'))
except FileNotFoundError:
    pass
tail = tail.replace('@@DICT@@', json.dumps(meta, ensure_ascii=False))
open('tokio-story.html', 'w', encoding='utf-8').write(head + body_head + main + tail)
print('tokio-story.html written')

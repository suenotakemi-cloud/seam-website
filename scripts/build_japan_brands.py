# 海外のお客様へ「日本のサロン生まれの 4 ブランド」ページ（/japan-salon-brands）を作る。2026-10-02 所有者
# なぜ：海外からのブランドタップ（30 日）は TOKIO 209・グローバルミルボン 150・オージュア 101・バイカルテ 49・ケラスターゼ 20。
#       日本のブランドを深く知りたい方が多い。旅の買い物でわざわざ寄る店として見せる
# 盛らない：「日本でしか買えない」「ケラスターゼより良い」とは書かない（確かめられないため）。
#           同じ悩みに対して 日本のサロンブランドならこれ と店頭で比べられることを伝える
# 使い方: python3 scripts/build_japan_brands.py && node scripts/i18n_extract.js . のあと 訳を足して merge/build
import re, json

URL = 'https://seam.site/japan-salon-brands'
DESC = '日本の美容室で生まれたヘアケア TOKIO インカラミ・オージュア・バイカルテ・グローバルミルボンを 髪を見て選べるサロン専売品の専門店 SEAM 全店免税対応'
TITLE = '日本のサロン生まれのヘアケア｜TOKIO・オージュア・バイカルテ・グローバルミルボン｜SEAM'

BRANDS = [
    ('tokio', 'TOKIO INKARAMI', 'イフイング（日本）', '特許技術インカラミの集中補修で知られるブランド<br>ブリーチやハイダメージの髪のホームケアとして 日本の美容師に定番です',
     '細い髪はプラチナム 太く広がる髪はプレミアム 頭皮はヘッドスパ', 'シャンプー ¥5,500〜¥6,490'),
    ('aujua', 'Aujua', 'ミルボン（日本）', '髪の状態と年齢に合わせて 20 を超えるラインから選ぶ設計<br>シャンプー トリートメント アウトバスを揃えて使います',
     'くせはアクアヴィア 乾燥はクエンチ ブリーチはリペアリティ 最上位はミラジェリィ', 'シャンプー ¥3,080〜¥5,500'),
    ('bykarte', 'BYKARTE', 'ホーユー（日本）', 'カルテから生まれたサロン専売ヘアケア<br>髪の太さとくせでシャンプーを選び分けます',
     '普通〜硬い髪は CH+ 細い髪は FH+ くせは UH+', 'シャンプー ¥4,180'),
    ('milbon', 'Global Milbon', 'ミルボン（日本）', '日本のミルボンが 世界のサロンに向けて作ったライン<br>くせ 乾燥 カラー 年齢など 悩みごとに分かれています',
     'くせはアンチフリッズ 乾燥はモイスチュア カラーはカラープリザーブ', 'シャンプー ¥2,420〜¥3,300'),
]
COMPARE = [
    ('くせ 湿気の広がり', 'ディシプリン', 'オージュア アクアヴィア／グローバルミルボン アンチフリッズ／バイカルテ UH+'),
    ('乾燥 パサつき', 'ニュートリティブ', 'オージュア クエンチ／グローバルミルボン モイスチュア'),
    ('ブリーチ ハイダメージ', 'ブロンドアブソリュ／レジスタンス', 'TOKIO インカラミ プレミアム／オージュア リペアリティ'),
    ('細い髪 ボリューム', 'デンシフィック', 'TOKIO インカラミ プラチナム／バイカルテ FH+'),
    ('年齢によるハリ ツヤ', 'クロノロジスト／ジェネシス', 'オージュア イミュライズ／グローバルミルボン リアウェイクン'),
]

g = open('guide-salon-senyo.html', encoding='utf-8').read()
head = g[:g.index('<body>')]
head = re.sub(r'<script type="application/ld\+json">.*?</script>', '@@LD@@', head, flags=re.S)
head = re.sub(r'<title>.*?</title>', f'<title>{TITLE}</title>', head)
head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{DESC}">', head)
head = re.sub(r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{TITLE}">', head)
head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{DESC}">', head)
head = head.replace('seam.site/guide-salon-senyo', 'seam.site/japan-salon-brands')
body_head = g[g.index('<body>'):g.index('<main')]
body_head = re.sub(r' data-i18n="[^"]*"', '', body_head)
tail = g[g.index('</main>') + len('</main>'):]
tail = re.sub(r' data-i18n="[^"]*"', '', tail)
tail = re.sub(r'window\.SEAM_PAGE_I18N\s*=\s*\{.*?\};', 'window.SEAM_PAGE_I18N = @@DICT@@;', tail, flags=re.S)

TH = 'class="text-left font-medium text-ink border-b border-line py-2 pr-3"'
TD = 'class="border-b border-line/60 py-2 pr-3 align-top"'
STORY = {s: f'\n      <p class="mt-2 text-[13px]"><a href="{s}-story.html" class="underline underline-offset-4" data-track-click="jb_story_{s}">{n} のブランドストーリーを読む →</a></p>'
         for s, n in [('tokio', 'TOKIO INKARAMI'), ('aujua', 'Aujua'), ('bykarte', 'BYKARTE')]}
brands = ''.join(f'''
    <section class="mt-10 pt-6 border-t border-line" data-track-view="jb_{s}">
      <p class="text-[12px] text-gold tracking-wide">{m}</p>
      <h3 class="mt-1 font-serif text-[20px] sm:text-[22px] text-ink">{n}</h3>
      <p class="mt-3 text-[13.5px] sm:text-[14px] text-charcoal/80">{d}</p>
      <div class="mt-3 catrow"><span class="k">選び方</span><span class="v">{how}</span></div>
      <div class="mt-2 catrow"><span class="k">定価（税込）</span><span class="v">{price}</span></div>
      <p class="mt-3 text-[13px]"><a href="{s}.html" class="underline underline-offset-4" data-track-click="jb_brand_{s}">{n} のラインを詳しく見る →</a></p>{STORY.get(s, '')}
    </section>''' for s, n, m, d, how, price in BRANDS)
rows = ''.join(f'<tr><td {TD}>{a}</td><td {TD}>{b}</td><td {TD}>{c}</td></tr>' for a, b, c in COMPARE)
main = f'''<main id="seam-main">
  <article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
    <p class="text-[12px] text-gold tracking-wide">FROM JAPANESE SALONS</p>
    <h1 class="mt-2 font-serif text-[27px] sm:text-[34px] leading-[1.4] text-ink font-medium">日本の美容室で生まれた<br>ヘアケアを 髪に合わせて</h1>
    <p class="mt-6 text-[14px] sm:text-[15px] text-charcoal/80">日本の美容師が毎日の施術で使い分けている サロン専売ヘアケア<br>SEAM はその正規取扱店です 髪を見ながら 4 つのブランドを比べて選べます</p>
    <p class="mt-4 text-[13px] text-charcoal/70">全 7 店で免税対応　パスポートをお持ちください</p>
    <figure class="mt-6"><picture><source srcset="images/stores/store_ginza.avif" type="image/avif"><source srcset="images/stores/store_ginza.webp" type="image/webp"><img src="images/stores/store_ginza.jpg" alt="SEAM GINZA の店内" width="1024" height="576" loading="eager" decoding="async" class="w-full h-auto"></picture><figcaption class="mt-2 text-[12px] text-charcoal/60">SEAM GINZA　ONE GINZA 3F　銀座一丁目駅 7 番出口から徒歩 1 分</figcaption></figure>
    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">日本のサロン生まれの 4 ブランド</h2>
    {brands}
    <h2 class="mt-14 font-serif text-[19px] sm:text-[22px] text-ink">ケラスターゼをお使いの方へ</h2>
    <p class="mt-4 text-[13.5px] sm:text-[14px] text-charcoal/80">SEAM ではケラスターゼも扱っています 同じ悩みに 日本のサロンブランドならどれを選ぶか 店頭で並べて比べられます</p>
    <div class="mt-4 overflow-x-auto" data-track-view="jb_compare"><table class="w-full text-[13.5px] text-charcoal/80 border-collapse"><thead><tr><th {TH}>気になること</th><th {TH}>ケラスターゼ</th><th {TH}>日本のサロンブランドなら</th></tr></thead><tbody>{rows}</tbody></table></div>
    <h2 class="mt-14 font-serif text-[19px] sm:text-[22px] text-ink">お買い物のご案内</h2>
    <div class="mt-4 catrow"><span class="k">免税</span><span class="v">全 7 店で対応しています　パスポートをお持ちください</span></div>
    <div class="mt-2 catrow"><span class="k">選び方</span><span class="v">スタッフが髪を見て ラインと使う順番をご案内します　簡単な英語なら対応できます</span></div>
    <div class="mt-2 catrow"><span class="k">髪のタイプ</span><span class="v">3 分の髪格診断で 27 タイプのどれかが分かります　結果を店頭で見せてください</span></div>
    <p class="mt-8"><a href="shop.html#stores" class="inline-block px-6 py-3 text-white text-[14px]" style="background:#16171B" data-track-click="jb_stores">店舗を見る →</a>　<a href="finder.html" class="underline underline-offset-4 text-[13px]" data-track-click="jb_finder">髪格診断（3 分・無料）</a></p>
    <p class="mt-6 text-[12px] text-charcoal/55">価格は定価（税込）です 在庫と価格は店舗と時期により異なります</p>
  </article>
</main>'''
ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "WebPage", "name": TITLE, "description": DESC, "url": URL, "inLanguage": "ja",
     "publisher": {"@id": "https://seam.site/#organization"}},
    {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://seam.site/"},
        {"@type": "ListItem", "position": 2, "name": "取扱ブランド", "item": "https://seam.site/brand"},
        {"@type": "ListItem", "position": 3, "name": "日本のサロン生まれのヘアケア", "item": URL}]}]}
head = head.replace('@@LD@@', '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>')
META = json.load(open('scripts/japan_brands_meta.json', encoding='utf-8'))
tail = tail.replace('@@DICT@@', json.dumps(META, ensure_ascii=False))
out = head + body_head + main + tail
open('japan-salon-brands.html', 'w', encoding='utf-8').write(out)
print('japan-salon-brands.html', len(out))

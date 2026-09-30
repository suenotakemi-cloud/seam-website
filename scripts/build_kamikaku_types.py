# 髪格 27 タイプ一覧（/kamikaku-types）を作る。2026-09-30
# 元データ＝js/finder-app.js の TYPE_NUMBER_MAP / TYPE_SHORT_NAME / GEM_LORE / CHARACTER_PRODUCT_AFFINITY
#          （node scripts/extract_kamikaku_types.js で JSON に出す）と data/products/seam-master.json
# 使い方: node scripts/extract_kamikaku_types.js js/finder-app.js /tmp/types.json && python3 scripts/build_kamikaku_types.py /tmp/types.json
# 日本語だけのページ（言語版は作らない）。見た目は guide-salon-senyo と同じ部品を使う
import json, re, sys, html

T = json.load(open(sys.argv[1]))
prods = {p['id']: p for p in json.load(open('data/products/seam-master.json'))['products']}
BRAND_PAGE = {'Aujua': 'aujua.html', 'BYKARTE': 'bykarte.html', 'Global Milbon': 'milbon.html', 'Kérastase': 'kerastase.html',
              'SUBLIMIC': 'sublimic.html', 'つるりんちょ。': 'tsururincho.html'}
TH = {'F': '細い', 'N': '普通', 'T': '太い'}
AM = {'L': '少ない', 'N': '普通', 'H': '多い'}
WV = {'S': '直毛', 'W': 'ゆるいくせ', 'C': '強いくせ'}
CT = {'F': '細い髪は重いケアでぺたんとしやすいので 軽い質感のものから選びます',
      'N': '太さは普通なので 履歴と仕上がりの好みで選べる幅が広い髪です',
      'T': '太い髪は水分が抜けると硬く広がるので 水分を入れる手助けをします'}
CA = {'L': '量が少ないので 重さを足さないケアが合います',
      'N': '量は普通なので 重さの調整がしやすい髪です',
      'H': '量が多いので 洗いとすすぎを丁寧にし まとまりを出すケアが合います'}
CW = {'S': '直毛なので 乾かしたあとのツヤと手ざわりが仕上がりを決めます',
      'W': 'ゆるいくせは湿気で広がりやすいので 乾かし方を先に決めます',
      'C': '強いくせは乾かし方を先に決め 抑えるものはそのあとに足します'}
DESC = '髪質診断（髪格診断）の27タイプを一覧で 太さ 量 くせの組み合わせごとの特徴 ケアの方向 合うサロン専売シャンプーとトリートメントの例をまとめました'
URL = 'https://seam.site/kamikaku-types'


def clean(t):  # 文体ルール：句点を使わず 読点は空白に
    return re.sub(r'\s+', ' ', t.replace('。', ' ').replace('、', ' ')).strip()


g = open('guide-salon-senyo.html').read()
head = g[:g.index('<body>')]
head = re.sub(r'<!-- seam:hreflang:start -->.*?<!-- seam:hreflang:end -->', '', head, flags=re.S)
head = re.sub(r'<script type="application/ld\+json">.*?</script>', '@@LD@@', head, flags=re.S)
head = re.sub(r'<title>.*?</title>', '<title>髪格27タイプ一覧｜髪質診断のタイプと合うシャンプー｜SEAM</title>', head)
head = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{DESC}">', head)
head = re.sub(r'<meta property="og:title" content="[^"]*">', '<meta property="og:title" content="髪格27タイプ一覧 | SEAM">', head)
head = re.sub(r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{DESC}">', head)
head = head.replace('https://seam.site/guide-salon-senyo', URL)
header = re.sub(r' data-i18n="[^"]*"', '', g[g.index('<body>'):g.index('</header>') + 9])
foot = g[g.index('<footer'):g.index('</footer>') + 9]
foot = re.sub(r'<p class="legal-links" data-langlinks="".*?</p>', '', foot, flags=re.S)
foot = re.sub(r' data-i18n="[^"]*"', '', foot)

codes = sorted(T['num'], key=lambda c: T['num'][c])
assert len(codes) == 27


def item(p):
    b = html.escape(p['brand'])
    if p['brand'] in BRAND_PAGE:
        b = f'<a href="{BRAND_PAGE[p["brand"]]}" class="underline underline-offset-4">{b}</a>'
    return f'<li class="py-0.5">{b}　{html.escape(p["name"])}</li>'


def section(c):
    sh, gm = T['short'][c], T['gem'].get(c, {})
    picks, seen = [], set()
    for pid in T['aff'][c]:
        p = prods[pid]
        if (p['brand'], p.get('line')) in seen:
            continue
        seen.add((p['brand'], p.get('line')))
        picks.append(p)
        if len(picks) == 3:
            break
    need = html.escape(sh.get('need', '').replace('+', ' と ').replace('・', ' '))
    return f'''
    <section id="type-{c.lower()}" class="mt-10 pt-6 border-t border-line" style="scroll-margin-top:72px">
      <p class="text-[12px] text-gold tracking-wide">{T["num"][c]}　{html.escape(sh.get("en", ""))}</p>
      <h3 class="mt-1 font-serif text-[18px] sm:text-[20px] text-ink">{TH[c[0]]} × {AM[c[1]]} × {WV[c[2]]}</h3>
      <div class="mt-3 catrow"><span class="k">特徴</span><span class="v">{CT[c[0]]}<br>{CA[c[1]]}<br>{CW[c[2]]}</span></div>
      <div class="mt-2 catrow"><span class="k">ケアの方向</span><span class="v">{need}</span></div>
      <div class="mt-2 catrow"><span class="k">合う商品の例</span><span class="v"><ul class="m-0 p-0 list-none">{"".join(item(p) for p in picks)}</ul></span></div>
      <div class="mt-2 catrow"><span class="k">宝石</span><span class="v">{html.escape(gm.get("stone", ""))}<br>{html.escape(clean(gm.get("text", "")))}</span></div>
    </section>'''


groups = [('F', '細い髪 01-09'), ('N', '普通の太さ 10-18'), ('T', '太い髪 19-27')]
secs = ''.join(
    f'\n    <h2 id="g-{k.lower()}" class="mt-14 font-serif text-[19px] sm:text-[22px] text-ink" style="scroll-margin-top:72px">{label}</h2>'
    + ''.join(section(c) for c in codes if c[0] == k) for k, label in groups)
nav = '　'.join(f'<a href="#g-{k.lower()}" class="underline underline-offset-4">{l}</a>' for k, l in groups)
CTA = '<a href="finder.html" class="inline-block px-6 py-3 text-white text-[14px]" style="background:#16171B">無料の髪質診断をはじめる →</a>'
main = f'''
<main id="seam-main">
  <article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
    <nav class="text-[12px] text-charcoal/55 mb-6"><a href="finder.html" class="hover:text-ink">髪格診断</a> / 27タイプ一覧</nav>
    <h1 class="font-serif text-[27px] sm:text-[34px] leading-[1.4] text-ink font-medium">髪格27タイプ一覧<br>髪質診断のタイプと合うシャンプー</h1>
    <p class="mt-6 text-[14px] sm:text-[15px] text-charcoal/80">SEAMの髪質診断（髪格診断）は 髪の太さ 量 くせの3つを組み合わせて 27のタイプに分けます<br>ここではタイプごとの特徴と ケアの方向 合うサロン専売品の例をまとめました<br>自分のタイプが分からないときは 3分の無料診断で調べられます</p>
    <p class="mt-4 text-[12px] text-charcoal/55">内容確認・最終更新 2026年9月30日　SEAM（サロン専売ヘアケア 197ブランド正規取扱）</p>
    <p class="mt-6">{CTA}</p>
    <p class="mt-8 text-[13px] text-charcoal/70">太さで探す　{nav}</p>
    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">27タイプの分け方</h2>
    <p class="mt-4 text-[13.5px] sm:text-[14px] text-charcoal/80">太さ（細い 普通 太い） 量（少ない 普通 多い） くせ（直毛 ゆるいくせ 強いくせ）の掛け合わせで27タイプです<br>この3つは生まれ持ったもので カラーやアイロンでは変わりません<br>ダメージやカラーの履歴は変えられるものなので タイプとは別に診断で確かめます</p>
    {secs}
    <h2 class="mt-14 font-serif text-[19px] sm:text-[22px] text-ink">自分のタイプを知るには</h2>
    <p class="mt-4 text-[13.5px] sm:text-[14px] text-charcoal/80">質問に答えると 3分ほどでタイプと合うケアが出ます 料金も会員登録も要りません<br>結果は店頭でそのまま見せて相談できます</p>
    <p class="mt-6">{CTA}　<a href="shop.html#stores" class="underline underline-offset-4 text-[13px]">店舗で相談する</a></p>
    <p class="mt-6 text-[12px] text-charcoal/55">商品は診断で出るものの一部です　在庫は店舗・時期により異なります</p>
  </article>
</main>
'''
ld = {"@context": "https://schema.org", "@graph": [
    {"@type": "Article", "headline": "髪格27タイプ一覧 髪質診断のタイプと合うシャンプー", "description": DESC, "inLanguage": "ja",
     "datePublished": "2026-09-30", "dateModified": "2026-09-30", "author": {"@id": "https://seam.site/#organization"},
     "publisher": {"@id": "https://seam.site/#organization"}, "mainEntityOfPage": URL, "image": "https://seam.site/images/og/seam-og.jpg"},
    {"@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "ホーム", "item": "https://seam.site/"},
        {"@type": "ListItem", "position": 2, "name": "髪格診断", "item": "https://seam.site/finder"},
        {"@type": "ListItem", "position": 3, "name": "27タイプ一覧", "item": URL}]},
    {"@type": "ItemList", "name": "髪格27タイプ", "numberOfItems": 27, "itemListElement": [
        {"@type": "ListItem", "position": int(T['num'][c]), "name": f"{TH[c[0]]}×{AM[c[1]]}×{WV[c[2]]}", "url": f"{URL}#type-{c.lower()}"} for c in codes]}]}
head = head.replace('@@LD@@', '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>')
out = head + header + main + foot + '\n  <script src="js/seam-analytics.js?v=10" defer=""></script>\n</body></html>\n'
open('kamikaku-types.html', 'w').write(out)
print('kamikaku-types.html', len(out), out.count('<section id="type-'))

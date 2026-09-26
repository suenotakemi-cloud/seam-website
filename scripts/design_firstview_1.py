# SEAM: 1画面目の改善 ①（2026-09-26）
#
# 【なぜ】スマホ 390×844 の実測（順位道具/firstview_audit.mjs）で
#   ・店舗頁 7枚：1画面目の約7割が店の写真で 住所・アクセス・営業時間・予約・地図が 2画面目より下
#     （検索クリックの 54% が店舗頁＝店名で探して行くために開く頁）
#   ・スパ 3枚：1画面目の写真が 物販の棚（銀座）・店の外観（大阪）でスパの写真ではない／料金の目安が無い
# 【やること】
#   1. 店舗頁：css/store-maison.css で写真を低く（HTML の並びは CSS が nth-of-type で頼っているので動かさない）
#   2. headspa-*.html：写真をスパ（頭浸浴）の写真に・説明は「SEAMのヘッドスパ（写真は店舗により異なります）」
#      h1 下の地名チップの後に 料金の目安 1行（値は各頁の料金表の最安）
# 冪等。使い方: python3 scripts/design_firstview_1.py .
import re, sys, os
ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
os.chdir(ROOT)
log = []

# ── 1. 店舗頁 ── css/store-maison.css で写真の高さを 68svh→34svh に（HTML の順番は store-maison.css の nth-of-type が頼っているので動かさない）

# ── 2. スパ頁 ──
PRICE = {'headspa-ginza.html': '¥12,000〜（45分）', 'headspa-nagoya.html': '¥8,800〜（60分）', 'headspa-osaka.html': '¥11,800〜（60分）'}
for f, price in PRICE.items():
    s = open(f, encoding='utf-8').read()
    if 'seam:fv-spa' in s:
        continue
    fig = re.search(r'<figure class="mt-7 overflow-hidden rounded-\[4px\]"><picture>.*?</figure>', s, re.S)
    if not fig:
        log.append('  ✘ ' + f + ': 写真の塊が見つからない'); continue
    new_fig = ('<!-- seam:fv-spa --><p class="mt-5 text-[13.5px] text-ink">ヘッドスパ ' + price + '　<a href="#spa-courses" class="text-gold" style="text-decoration:underline;text-underline-offset:3px">コースと料金</a></p>'
               '<figure class="mt-5 overflow-hidden rounded-[4px]"><picture><source srcset="images/spa-real/03_headbath.avif" type="image/avif"><source srcset="images/spa-real/03_headbath.webp" type="image/webp">'
               '<img src="images/spa-real/03_headbath.jpg" alt="SEAMのヘッドスパ 頭浸浴" loading="eager" fetchpriority="high" decoding="async" class="w-full h-auto object-cover" style="max-height:320px;object-position:center;"></picture>'
               '<figcaption class="mt-2 text-[11.5px] text-charcoal/55">SEAMのヘッドスパ 頭浸浴（写真は店舗により異なります）</figcaption></figure>')
    s = s[:fig.start()] + new_fig + s[fig.end():]
    s = s.replace('<section class="mt-11">\n      <h2 class="font-serif text-[19px] text-ink" data-i18n="s10">', '<section class="mt-11" id="spa-courses">\n      <h2 class="font-serif text-[19px] text-ink" data-i18n="s10">', 1)
    open(f, 'w', encoding='utf-8').write(s); log.append('  ◎ ' + f + ': スパの写真と料金の目安')
print('\n'.join(log))

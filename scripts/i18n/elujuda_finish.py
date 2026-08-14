# SEAM: 新設したエルジューダ8枚を、既存ブランドページと同じ状態にそろえる（2026-08-11）
#
# 【なぜエルジューダを作ったか】オーナー
#   「エルジューダはAmazonなどで検索される一位でありそれがほしくてドンキホーテにもおいてるぐらい」
#   実測でも「エルジューダ 販売店」は **SEAM圏外**（1位 haircarenomadoguchi / 5位 shellbear系）。
#   SEAMは商品マスタに **19点フル展開**（brand='Elujuda'・実価格・画像あり）しているのに、
#   ミルボンLPの中に埋もれていて専用ページが無かった。
#
# 【この後始末が要る理由】生成器 build_brand_pages.py は repo-root に出力する仕様で、
#   その出力は seam-public より **古い**（seam-public には後から手を入れた
#   INTENT_BLOCK・計測?v=8 が入っている）。だから全体コピーは禁止で、
#   新規8枚だけを取り込み、足りない分をここで足す。
#   ※既存94枚を生成器の出力で上書きすると、今日までの改善が全部消える。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]
os.chdir(ROOT)

PAGES = ['elujuda.html'] + sorted(glob.glob('elujuda-*.html'))

STORE_JA = {'ginza': '銀座', 'omotesando': '表参道', 'sapporo': '札幌',
            'osaka': '大阪', 'nagoya': '名古屋', 'fukuoka': '福岡', 'utsunomiya': '宇都宮'}

INTENT = '''<!-- INTENT_BLOCK -->
    <div class="mt-12 rounded-[4px] px-5 py-6" style="background:#F6F1EA;">
      <h2 class="font-serif text-[17px] sm:text-[19px] text-ink">販売のみ・ネットショップでのご購入について</h2>
      <p class="mt-2.5 text-[13.5px] text-charcoal/80" style="line-height:2;">エルジューダは美容室専売品（サロン専売品）です　SEAMは正規取扱店として<strong class="font-normal text-ink">販売のみのご来店</strong>を歓迎しています　施術も予約も要りません<br>店頭でご登録いただくと 買い足しは<a href="onlineshop.html" class="border-b border-line">会員制のネットショップ</a>から通販でご注文いただけます</p>
      <p class="mt-4 text-[12.5px] text-charcoal/70">
<a href="guide-salon-senyo.html" class="border-b border-line">美容室専売品とは</a>　<a href="shop.html" class="border-b border-line">全国の店舗一覧</a>　__EXTRA__
</p>
    </div>
'''

n = 0
for f in PAGES:
    s = open(f, encoding='utf-8').read()
    before = s

    # ① 計測のバージョンを他ページに合わせる（SWがcache-firstなので版が揃っていないと古いJSが配られる）
    s = re.sub(r'seam-analytics\.js\?v=\d+', 'seam-analytics.js?v=8', s)

    # ② 「販売のみ」「美容室専売品」の節。実測で効いている語なので新設ページにも入れる
    if 'INTENT_BLOCK' not in s:
        slug = f[len('elujuda-'):-len('.html')] if f.startswith('elujuda-') else ''
        extra = ('<a href="elujuda-tokyo.html" class="border-b border-line">東京の取扱店</a>'
                 if slug in ('ginza', 'omotesando') else
                 '<a href="elujuda.html" class="border-b border-line">エルジューダ 取扱店</a>'
                 if slug else
                 '<a href="milbon.html" class="border-b border-line">ミルボン 取扱店</a>')
        blk = INTENT.replace('__EXTRA__', extra)
        # 「よくある質問」の直前に置く（他ブランドページと同じ位置）
        m = re.search(r'[ \t]*<h2[^>]*>\s*よくあるご?質問\s*</h2>', s)
        if m:
            start = s.rfind('<div', 0, m.start())
            start = start if start > 0 else m.start()
            s = s[:start] + blk + '    ' + s[start:]
        else:
            i = s.rfind('</main>')
            if i > 0:
                s = s[:i] + blk + s[i:]

    if s != before:
        open(f, 'w', encoding='utf-8').write(s)
        n += 1
    print(f'  {f:26} {"更新" if s != before else "変更なし"}')

print(f'\n{n}枚を更新')

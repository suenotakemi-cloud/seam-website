# SEAM: 地域LP19枚に計測を入れる（2026-08-11）
#
# 【なぜ】これらは**検索の着地先**なのに、読んでいるscriptが
#   構造化データと i18n辞書のインライン1本だけで、`js/seam-analytics.js` が無かった。
#   `data-track-click="salon_reserve_hpb"` 等の属性は**56箇所すでに書かれている**のに、
#   読む側が無いので**1件も記録されていない**。
#   SEOで人を集める先がここなので、効いたかどうかを測る手段が無い状態だった。
#
# 【入れると何が変わるか】既存133ページと同じ扱いになる。
#   ・自前の cookieless 計測（/api/ev）が動く＝予約タップ等が記録される
#   ・Meta Pixel が動く＝広告の効果測定ができる（**19枚で新しく動きはじめる**）
#   ・初回訪問に Cookie 同意バナーが出る（拒否で Pixel は止まる＝オプトアウト方式）
#   オーナー了承のうえで実施。
#
# 【app-tabbar は入れない】地域LPは別の簡易ヘッダーで、下部タブバーを前提にしていない。
#   入れると body の padding-bottom や固定CTAと二重になる。計測だけ足す。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]
os.chdir(ROOT)

TAG = '  <script src="js/seam-analytics.js?v=8" defer=""></script>\n'


def targets():
    fs = [f'headspa-{s}.html' for s in ['ginza', 'nagoya', 'osaka']]
    fs += [f'salon-{s}.html' for s in ['ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka']]
    fs += sorted(glob.glob('*-tokyo.html'))
    return [f for f in fs if os.path.exists(f)]


n = skip = 0
for f in targets():
    s = open(f, encoding='utf-8').read()
    if 'seam-analytics.js' in s:
        print(f'  {f:34} 既にあり'); skip += 1; continue
    i = s.rfind('</body>')
    assert i > 0, f'{f}: </body> が無い'
    s = s[:i] + TAG + s[i:]
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:34} 計測を追加')
    n += 1
print(f'\n追加 {n}枚 / 既存 {skip}枚')

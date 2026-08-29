# SEAM: 髪質診断ガイドへの導線（2026-08-25）
#
# 【なぜ】実測で相関がはっきり出た
#   guide-salon-senyo だけ被リンク159本 → 検索に出る
#   ほかのガイドは4〜12本 → 出ない
#   その159本のうち123本は ブランド×地域ページからの「美容室専売品とは」だった
#
#   髪質診断ガイドも同じ場所から張る 品を選ぶ人が「自分の髪はどれか」を知るのは自然な流れで
#   無理に押し込むリンクではない
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
TARGET = 'guide-kamishitsu-shindan.html'
ANCHOR = '髪質診断とは'
n = 0

for f in sorted(glob.glob('*.html')):
    if f == TARGET:
        continue
    s = open(f, encoding='utf-8').read()
    if TARGET in s:
        continue
    # 既存の「美容室専売品とは」リンクの隣に置く（同じ節・同じ見た目にそろえる）
    m = re.search(r'<a\b[^>]*href="guide-salon-senyo\.html"[^>]*>.*?</a>', s, re.S)
    if not m:
        continue
    cls = re.search(r'class="([^"]*)"', m.group(0))
    cls = cls.group(1) if cls else ''
    add = f'<a href="{TARGET}" class="{cls}">{ANCHOR}</a>'
    # 区切りは元のリンクの直後にある文字をまねる（無ければ中黒）
    tail = s[m.end():m.end()+120]
    sep = ' <span class="mx-1 text-charcoal/30">/</span> ' if '<span' in tail[:40] else ' ／ '
    s = s[:m.end()] + sep + add + s[m.end():]
    open(f, 'w', encoding='utf-8').write(s)
    n += 1

print(f'  {ANCHOR} への導線を {n}枚に追加')

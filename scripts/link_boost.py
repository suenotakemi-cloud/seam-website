# SEAM: 導線の穴を埋める（2026-08-25）
#
# 【なぜ】実測で2つ空いていた
#   ① headspa-{街} の被リンクが7〜9本しかない（store-ginza は42本）
#      ブランド×地域123枚は store-{街} へ4本ずつ張っているのに headspa へは0本だった
#   ② 新しく作った髪質診断ガイドが どこからも辿れない
#
# 冪等。既にあれば足さない。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
AREAS = ['ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya']
HS = {a for a in AREAS if os.path.exists(f'headspa-{a}.html')}      # 実在するものだけ
JA = {'ginza': '銀座', 'nagoya': '名古屋', 'osaka': '大阪'}

n1 = n2 = n3 = 0

# ① ブランド×地域 → 同じ街のヘッドスパ
pat = re.compile(r'^[a-z0-9-]+-(%s)\.html$' % '|'.join(AREAS))
for f in sorted(glob.glob('*.html')):
    m = pat.match(f)
    if not m or f.startswith(('store-', 'salon-', 'headspa-', 'recruit-')):
        continue
    a = m.group(1)
    if a not in HS:
        continue
    s = open(f, encoding='utf-8').read()
    if f'headspa-{a}.html' in s:
        continue
    # store-{街} への既存リンクの直後に並べる（同じ節のなかに置く）
    anchor = re.search(r'<a\b[^>]*href="store-%s\.html"[^>]*>.*?</a>' % a, s, re.S)
    if not anchor:
        continue
    add = (f'<a href="headspa-{a}.html" class="underline decoration-line underline-offset-4 '
           f'hover:text-ink">{JA[a]}のヘッドスパ</a>')
    s = s[:anchor.end()] + ' <span class="mx-1 text-charcoal/30">/</span> ' + add + s[anchor.end():]
    open(f, 'w', encoding='utf-8').write(s)
    n1 += 1

# ② 既存ガイド → 髪質診断ガイド（「あわせて読む」に足す）
for f in sorted(glob.glob('guide-*.html')):
    if f == 'guide-kamishitsu-shindan.html':
        continue
    s = open(f, encoding='utf-8').read()
    if 'guide-kamishitsu-shindan.html' in s:
        continue
    li = re.search(r'<li>\s*<a\b[^>]*href="guide-[a-z-]+\.html".*?</li>', s, re.S)
    if not li:
        continue
    add = ('<li><a href="guide-kamishitsu-shindan.html" class="underline decoration-line '
           'underline-offset-4 hover:text-ink">髪質診断とは 自分の髪を知る5つの見方</a></li>')
    s = s[:li.end()] + add + s[li.end():]
    open(f, 'w', encoding='utf-8').write(s)
    n2 += 1

# ③ finder → 髪質診断ガイド
f = 'finder.html'
s = open(f, encoding='utf-8').read()
if 'guide-kamishitsu-shindan.html' not in s:
    # 「髪質診断とは」の節のあとに置く
    h = re.search(r'<h2[^>]*>\s*髪質診断とは\s*</h2>', s)
    if h:
        end = s.find('</p>', h.end())
        if end > 0:
            end += 4
            add = ('<p class="mt-3 text-[13px] text-charcoal/70"><a href="guide-kamishitsu-shindan.html" '
                   'class="underline decoration-line underline-offset-4 hover:text-ink">'
                   '髪質診断の見方をくわしく</a></p>')
            s = s[:end] + add + s[end:]
            open(f, 'w', encoding='utf-8').write(s); n3 = 1

print(f'  ブランド×地域 → ヘッドスパ  {n1}枚')
print(f'  既存ガイド → 髪質診断ガイド  {n2}枚')
print(f'  finder → 髪質診断ガイド      {n3}枚')

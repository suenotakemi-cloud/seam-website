# SEAM: ブランド×地域 → 同じ街のサロンLP（2026-08-25）
#
# 【なぜ】salon-{街} の被リンクが7〜9本しかない。
#   同じブランド×地域123枚は store-{街} へ4本 headspa-{街} へ1本 張っているのに
#   salon-{街} へは **0本** だった。
#
# 【名古屋は外す】ヘアサロンが受付休止中。予約できない店に送らない。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
# 実態に合わせた呼び名（完全個室 / 半個室）。名古屋は入れない
LABEL = {
  'ginza':   '銀座の個室美容室',
  'osaka':   '大阪の個室美容室',
  'sapporo': '札幌の半個室サロン',
  'fukuoka': '福岡の半個室サロン',
}
AREAS = ['ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya']
pat = re.compile(r'^[a-z0-9-]+-(%s)\.html$' % '|'.join(AREAS))
n = 0

for f in sorted(glob.glob('*.html')):
    m = pat.match(f)
    if not m or f.startswith(('store-', 'salon-', 'headspa-', 'recruit-')):
        continue
    a = m.group(1)
    if a not in LABEL or not os.path.exists(f'salon-{a}.html'):
        continue
    s = open(f, encoding='utf-8').read()
    if f'salon-{a}.html' in s:
        continue
    anchor = re.search(r'<a\b[^>]*href="headspa-%s\.html"[^>]*>.*?</a>' % a, s, re.S)
    if not anchor:
        anchor = re.search(r'<a\b[^>]*href="store-%s\.html"[^>]*>.*?</a>' % a, s, re.S)
    if not anchor:
        continue
    add = (f'<a href="salon-{a}.html" class="underline decoration-line underline-offset-4 '
           f'hover:text-ink">{LABEL[a]}</a>')
    s = s[:anchor.end()] + ' <span class="mx-1 text-charcoal/30">/</span> ' + add + s[anchor.end():]
    open(f, 'w', encoding='utf-8').write(s)
    n += 1

print(f'  サロンLPへの導線を {n}枚に追加（名古屋は休止中のため除外）')

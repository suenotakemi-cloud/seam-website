# SEAM: Cookieバナーを短くする（2026-09-07）
#
# 【なぜ】実測でバナーの高さ122px。ブランドページの見出し
#   （例 tokio の「髪の強さを 美しさに変える」）に重なって
#   初めて開いた人の第一印象を損ねていた（elementFromPoint で覆いを確認）。
#
#   置き場所（下タブの真上・閲覧を止めない）は既に考えられているので触らない。
#   高さの原因は **文が長く3行に折り返すこと** なので 文を短くする。
#   あわせて 句読点も社内の書き方へ（他のコピーと揃える）。
#
#   意味は落とさない：何に使うか（広告の効果測定）と 拒否できることは残す。
#
# 冪等。
import re, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
f = 'js/seam-analytics.js'
s = open(f, encoding='utf-8').read(); before = s

SWAP = [
 ("'当サイトは、広告の効果測定のために Meta ピクセル等の Cookie を利用します。'",
  "'広告の効果を測るために Cookie を使います'"),
 ("'This site uses cookies such as the Meta Pixel to measure ad performance.'",
  "'We use cookies to measure ad performance'"),
 ("'本网站使用 Meta 像素等 Cookie 用于广告成效衡量。'",
  "'我们使用 Cookie 衡量广告成效'"),
 ("'本網站使用 Meta 像素等 Cookie 進行廣告成效評估。'",
  "'我們使用 Cookie 評估廣告成效'"),
 ("'본 사이트는 광고 성과 측정을 위해 Meta 픽셀 등의 쿠키를 사용합니다.'",
  "'광고 성과 측정을 위해 쿠키를 사용합니다'"),
]
n = 0
for a, b in SWAP:
    if a in s:
        s = s.replace(a, b); n += 1

if s != before:
    open(f, 'w', encoding='utf-8').write(s)

import subprocess
r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
print(f'  文を短くした: {n}言語 / 構文: ' + ('○' if r.returncode == 0 else '✗ ' + r.stderr.splitlines()[-1][:60]))
if r.returncode != 0:
    import shutil; shutil.copy('/tmp/analytics.bak.js', f); print('  ★戻しました')

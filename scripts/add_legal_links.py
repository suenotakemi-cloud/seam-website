# SEAM: 法務リンクが無いページに足す（2026-09-07）
#
# 【なぜ】特定商取引法に基づく表記・プライバシーポリシー・利用規約へ
#   辿れないページが 20枚あった。物を売るサイトなので全ページから辿れる必要がある。
#   （finder は JS 側で入れたので ここでは対象外）
#
# 【やり方】既にあるページと同じ <p class="legal-links"> を footer の末尾へ。
#   文言・リンク先・見た目は既存と1文字も変えない（写して置くだけ）。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)

# 見本を既存ページから取る
sample = None
for f in ['tokio.html', 'davines.html', 'store-ginza.html']:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<p class="legal-links".*?</p>', s, re.S)
    if m: sample = m.group(0); break
assert sample, '見本が見つからない'

IN = re.compile(r'^(admin|entrance|seo-|strategy|hpb-|ginza-|august-|exec-|404|write|gbp-|press-kit|finder-spec|treatment|haircareshop|finder)')
n = 0; skip = []
for f in sorted(glob.glob('*.html')):
    if IN.match(f): continue
    s = open(f, encoding='utf-8').read()
    if '特定商取引' in s: continue
    i = s.rfind('</footer>')
    if i < 0:
        skip.append(f); continue
    s = s[:i] + sample + s[i:]
    assert s.count('特定商取引') == 1, f + ' が重複した'
    assert '</body>' in s, f + ' の構造が壊れた'
    open(f, 'w', encoding='utf-8').write(s); n += 1

print(f'  法務リンクを足した: {n}枚')
if skip: print(f'  ★footerが無く置けなかった: {skip}')

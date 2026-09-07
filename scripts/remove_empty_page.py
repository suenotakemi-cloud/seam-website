# SEAM: 空のページ haircareshop を消す（2026-09-07）
#
# 【なぜ】本文が「利用規約 プライバシーポリシー 特定商取引法に基づく表記」だけの空ページ。
#   被リンク0・sitemap外・build一覧にも無い。それでも 200 を返していた。
#   薄いページを置いておく理由が無い。
#
# 【消し方】404 にせず /shop へ 301。過去に拾われている可能性を捨てない。
#   Cloudflare Pages は _redirects を読む（このリポジトリには無かったので新設）。
#
# 冪等。
import sys, os, re

ROOT = sys.argv[1]; os.chdir(ROOT)

# ① ページを消す
if os.path.exists('haircareshop.html'):
    os.remove('haircareshop.html'); print('  haircareshop.html を削除')
else:
    print('  haircareshop.html は既に無い')

# ② sw.js の先読み一覧から外す（消したものを取りに行かせない）
s = open('sw.js', encoding='utf-8').read()
if 'haircareshop' in s:
    s = re.sub(r"\s*'\./haircareshop\.html',", '', s)
    assert 'haircareshop' not in s
    open('sw.js', 'w', encoding='utf-8').write(s); print('  sw.js の先読みから外した')

# ③ /shop へ 301
RULE = '/haircareshop  /shop  301\n'
if os.path.exists('_redirects'):
    r = open('_redirects', encoding='utf-8').read()
else:
    r = '# 消したページの行き先（404 にせず送る）\n'
if '/haircareshop' not in r:
    r += RULE
    open('_redirects', 'w', encoding='utf-8').write(r); print('  _redirects に /haircareshop → /shop (301) を追加')

print('\n  参照が残っていないか:',
      os.popen("grep -rl haircareshop --include='*.html' --include='*.js' . 2>/dev/null | wc -l").read().strip(), '件')

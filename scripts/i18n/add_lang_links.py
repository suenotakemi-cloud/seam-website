# SEAM: フッターに言語版への「辿れる」リンクを入れる（2026-08-09）
#
# 【なぜ】hreflang は全ページの <head> に6本ずつ正しく入っていて、sitemap にも
# 言語の組を書いた。それでも実測で en/zh/tw/ko 132ページのうち索引に入っていたのは9枚だけ。
# 原因は **言語版への <a href> が1本も無かった**こと。切り替えはJS(lang.js)で、
# クローラは辿れない。hreflang は「同じページの別言語がある」という申告であって、
# 「そこへ行く道」ではない。道が無ければ見つけてもらえない。
#
# 【設計】
#  ・日本語ページにだけ入れる。言語版は build-i18n.js が ja から作り直すので自動で伝播する
#  ・href は絶対パス。build-i18n の rewriteUrlsToRoot に触られない形にする
#  ・表示は各言語の自称（English / 简体中文 …）。data-i18n を付けない＝訳さない
#    （どの言語で見ていても自分の言語を探せるように）
#  ・対象は build-i18n.js の PAGES に載っているページだけ。訳が無いページに
#    リンクを張ると404を申告することになる
#
# 冪等。2回流しても増えない。
import re, os, sys, json

ROOT = sys.argv[1]
os.chdir(ROOT)

# build-i18n.js の PAGES から対象を読む（二重管理にしない）
src = open('.github/scripts/build-i18n.js', encoding='utf-8').read()
block = re.search(r'const PAGES\s*=\s*\[(.*?)\n\];', src, re.S).group(1)
PAGES = [(m.group(1), m.group(2)) for m in
         re.finditer(r"\{\s*file:\s*'([^']+)'\s*,\s*url:\s*'([^']+)'", block)]

LANGS = [('en', 'English'), ('zh', '简体中文'), ('tw', '繁體中文'), ('ko', '한국어')]
MARK = 'data-langlinks'

def links_for(url):
    ja = url if url != '/' else '/'
    items = [f'<a href="{ja}" style="text-decoration:underline;">日本語</a>']
    for code, label in LANGS:
        href = f'/{code}/' if url == '/' else f'/{code}{url}'
        items.append(f'<a href="{href}" style="text-decoration:underline;">{label}</a>')
    return ('<p class="legal-links" ' + MARK + ' style="margin-top:6px;text-align:center;'
            'font-size:10.5px;line-height:1.8;color:rgba(58,50,42,.62);">'
            + ' '.join(items) + '</p>')

done = 0
for f, url in PAGES:
    if not os.path.exists(f):
        print(f'  {f:28} ファイル無し'); continue
    s = open(f, encoding='utf-8').read()
    if MARK in s:
        print(f'  {f:28} 既にあり'); continue
    # フッターの一番下に置く（邪魔にならない位置）。
    # 【罠】フッターの作りが2種類ある。トップ系は legal-links(規約リンク)で終わり、
    # 地域LPはそれが無くリンク並びで終わる。どちらも </footer> の直前に入れれば足りる。
    m = None
    for pat in (r'(<p class="legal-links"[^>]*data-i18n="g4"[^>]*>.*?</p>)',):
        m = re.search(pat, s, re.S)
        if m: break
    if m:
        s = s[:m.end()] + '\n        ' + links_for(url) + s[m.end():]
    else:
        i = s.rfind('</footer>')
        if i < 0:
            print(f'  {f:28} ⚠ footerが見つからない'); continue
        s = s[:i] + '        ' + links_for(url) + '\n      ' + s[i:]
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:28} 追加 → {url}')
    done += 1
print(f'\n{done} ページに言語リンクを追加（対象 {len(PAGES)}）')

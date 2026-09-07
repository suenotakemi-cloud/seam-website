# SEAM: 画面に法務リンク／言語切替が出ていない2枚を直す（2026-09-07）
#
# 【なぜ hairsalon が抜けていたか】
#   以前「845枚すべてに法務リンクあり」と数えたのは生のHTMLでの href 検索だった。
#   hairsalon はその HTML が辞書 SEAM_PAGE_I18N_GAPFILL の g73 という値の中にだけあり
#   その g73 を当てる要素がページに無い（data-i18n="g73" の要素 0個）。
#   つまり文字列としては在るが 画面には一度も出ない。生の文字列で数えると緑になる罠。
#   数えるときは DOM で見る。
#
# 【tokushoho】法務リンクは出ているが 自分自身へのリンクが無いだけ（正しい）。
#   言語切替だけ足す。
#
# 冪等。
import re, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
S = 'text-decoration:underline;display:inline-block;min-height:44px;line-height:44px;'
LEGAL = ('<p class="legal-links" style="margin-top:8px;text-align:center;font-size:12px;'
         'line-height:1.8;color:rgba(58,50,42,.62);">'
         f'<a href="terms.html" style="{S}">利用規約</a> '
         f'<a href="privacy.html" style="{S}" data-i18n="x.6bc76e56">プライバシーポリシー</a> '
         f'<a href="tokushoho.html" style="{S}" data-i18n="x.46ebe8a3">特定商取引法に基づく表記</a></p>')

def switcher(slug):
    langs = [('', '日本語'), ('/en', 'English'), ('/zh', '简体中文'), ('/tw', '繁體中文'), ('/ko', '한국어')]
    links = ' '.join(f'<a href="{p}/{slug}" style="text-decoration:underline;">{n}</a>' for p, n in langs)
    return ('<p class="legal-links" data-langlinks style="margin-top:6px;text-align:center;'
            f'font-size:12px;line-height:1.8;color:rgba(58,50,42,.62);">{links}</p>')

for f, want_legal in [('hairsalon.html', True), ('tokushoho.html', False)]:
    s = open(f, encoding='utf-8').read()
    if 'data-langlinks' in s and re.search(r'<p class="legal-links" data-langlinks', s):
        # すでに入っている（辞書の中だけの場合は下でDOM判定していないので簡易に）
        pass
    slug = f[:-5]
    block = '\n' + (LEGAL if want_legal else '') + switcher(slug) + '\n'
    if block.strip() in s:
        print(f'  {f} はすでに入っている'); continue
    # フッタの閉じの直前へ
    i = s.rfind('</footer>')
    if i < 0:
        i = s.rfind('</body>')
    assert i > 0, f + ' に置き場所が無い'
    s = s[:i] + block + s[i:]
    assert '</body>' in s, f + ' が壊れた'
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f} に{"法務リンクと" if want_legal else ""}言語切替を足した')

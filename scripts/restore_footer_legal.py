# SEAM: フッタの法務リンクを戻す（2026-09-07）
#
# 【なぜ】オーナーから「以前フッタに入れていた会社概要やSEO対策が残っているか」と指摘。
#   調べたら **トップページに法務リンクが0本**だった。
#   2026-08-31「トップページをラグジュアリーUIへ刷新」でフッタごと作り替えられ
#   Service の並びだけが残り 利用規約・プライバシー・特商法・著作権表記が落ちていた。
#
#   昔（0fefb9a9）のフッタは Service / Member / Support の3列で
#   Support 側に プライバシー・特商法・お問い合わせ・配送について が入っていた。
#
#   実リンク（href）で数え直すと 9枚が欠けていた。
#   ※文字列だけの照合では i18n 辞書に当たって見落とす（一度これで数え違えた）
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)

# 既存ページから見本を取る（形も文言も1文字も変えない）
sample = None
for f in ['tokio.html', 'davines.html', 'store-ginza.html']:
    s = open(f, encoding='utf-8').read()
    m = re.search(r'<p class="legal-links"(?![^>]*data-langlinks).*?</p>', s, re.S)
    if m: sample = m.group(0); break
assert sample and 'tokushoho' in sample, '見本が取れない'

TARGET = ['index.html', 'hairsalon.html', 'finder.html', 'treatment.html',
          'ginza-2026.html', 'ginza-menu.html', 'ginza-no1.html', 'ginza-spa-journey.html']
n = 0; skip = []
for f in TARGET:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read()
    links = re.findall(r'href="([^"]*)"', s)
    if any('tokushoho' in h for h in links) and any('terms' in h for h in links):
        continue
    i = s.rfind('</footer>')
    if i < 0:
        # footer が無いページは </body> の直前に小さく置く
        i = s.rfind('</body>')
        if i < 0: skip.append(f); continue
        block = '<footer style="padding:0 0 24px;">' + sample + '</footer>\n'
    else:
        block = sample
    s = s[:i] + block + s[i:]
    assert '</body>' in s, f + ' が壊れた'
    open(f, 'w', encoding='utf-8').write(s); n += 1

print(f'  法務リンクを戻した: {n}枚')
if skip: print(f'  ★置けなかった: {skip}')

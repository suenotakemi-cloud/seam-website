# SEAM: rekera.html の欠けを埋める（2026-09-07）
#
# 【なぜ】Codex が足した rekera.html が半分だけの状態で本番に出ていた。
#   同じ atelier-brands-maison.css を使う兄弟の oggi-otto.html と比べると
#     <header> 無し ／ <footer> 無し（＝特商法・プライバシー・利用規約へ辿れない）
#     hreflang 無し ／ lang.js 無し（＝言語が切り替わらない）
#     sitemap の生成一覧にも無い ／ 6.5KB（兄弟は39KB）
#
#   足りないものは全部 oggi-otto から借りる（新しく書かない＝ずれない）。
#
# 冪等。
import re, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
SRC, DST = 'oggi-otto.html', 'rekera.html'
src = open(SRC, encoding='utf-8').read()
s = open(DST, encoding='utf-8').read()
before = s

def block(html, tag):
    i = html.find('<' + tag)
    if i < 0: return None
    j = html.find('</' + tag + '>', i)
    return html[i:j + len(tag) + 3] if j > 0 else None

# ① header
if '<header' not in s:
    h = block(src, 'header')
    if h:
        i = s.find('<body')
        i = s.find('>', i) + 1
        # 「本文へ移動」の直後に置く（順番を兄弟に合わせる）
        skip = s.find('</a>', s.find('本文へ移動')) if '本文へ移動' in s else -1
        pos = (skip + 4) if skip > 0 else i
        s = s[:pos] + '\n' + h + '\n' + s[pos:]

# ② footer（法務リンクを含む）
if '<footer' not in s:
    f = block(src, 'footer')
    if f:
        # rekera 用にパンくずのブランド名だけ差し替える必要は無い（共通部分のみ）
        i = s.rfind('</body>')
        # 末尾の <script> 群より前に置く
        j = s.rfind('<script', 0, i)
        pos = j if j > 0 else i
        s = s[:pos] + f + '\n' + s[pos:]

# ③ hreflang（oggi-otto の並びを rekera に読み替える）
if 'hreflang' not in s:
    hl = re.findall(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">', src)
    if hl:
        hl = [x.replace('oggi-otto', 'rekera') for x in hl]
        i = s.find('</head>')
        s = s[:i] + '  ' + '\n  '.join(hl) + '\n' + s[i:]

# ④ lang.js（言語切替）
if 'lang.js' not in s:
    m = re.search(r'<script src="js/lang\.js[^"]*"[^>]*></script>', src)
    if m:
        i = s.rfind('</body>')
        s = s[:i] + '  ' + m.group(0) + '\n' + s[i:]

if s != before:
    assert s.count('<footer') == 1 and s.count('<header') == 1, '重複した'
    assert '</body>' in s and '</head>' in s, '構造が壊れた'
    open(DST, 'w', encoding='utf-8').write(s)

# ⑤ sitemap の生成一覧へ
b = '.github/scripts/build-i18n.js'
js = open(b, encoding='utf-8').read()
if "'/rekera'" not in js:
    old = "'/elujuda',"
    assert js.count(old) == 1
    open(b, 'w', encoding='utf-8').write(js.replace(old, "'/elujuda',\n'/rekera',", 1))
    print('  sitemap の生成一覧に /rekera を登録')

s2 = open(DST, encoding='utf-8').read()
print(f'  rekera.html {len(before)} → {len(s2)} バイト')
for t in ['<header', '<footer', 'hreflang', 'lang.js', '特定商取引']:
    print(f'   {t:14} {s2.count(t)}件')

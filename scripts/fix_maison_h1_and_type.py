# SEAM: 作り直したページの h1 重複と 極小文字を直す（2026-09-07）
#
# 【① h1 が2本】Codex の作り直しは 元の見出しブロックを CSS で隠して
#   新しい見出しを上に重ねる形。そのため DOM に h1 が2本残り
#   片方は display:none。**隠れた見出し**は検索側が最も嫌う形なので
#   タグを h1 から p に落とす（見た目は1ミリも変えない）。
#
#   位置で隠していた（nav+p+h1+p+div）ので タグを変えると連鎖が切れて
#   隠していたものが出てしまう。→ 明示のクラス .legacy-lede に付け替える。
#
# 【② 極小文字】6px〜11px の指定が各所に残っていた。
#   指示書§3の「11.5px 未満を1つも残さない」に合わせて底上げする。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)

PAGES = {
 'aujua.html': 'aujua-content', 'bykarte.html': 'bykarte-content',
 'kerastase.html': 'kerastase-content', 'milbon.html': 'gm-content',
 'sublimic.html': 'sublimic-content', 'system-professional.html': 'sp-content',
 'tokio.html': 'tokio-content', 'tsururincho.html': None, 'oggi-otto.html': None,
}

# ── ① h1 → p（2本目だけ）
n_h1 = 0
for f in PAGES:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read()
    hs = list(re.finditer(r'<h1\b([^>]*)>', s))
    if len(hs) < 2: continue
    m = hs[1]                                   # 2本目＝元のSEO見出し
    end = s.find('</h1>', m.end())
    if end < 0: continue
    attrs = m.group(1)
    cls = re.search(r'class="([^"]*)"', attrs)
    newattrs = (attrs.replace(cls.group(0), 'class="legacy-lede ' + cls.group(1) + '"')
                if cls else attrs + ' class="legacy-lede"')
    s = s[:m.start()] + '<p' + newattrs + '>' + s[m.end():end] + '</p>' + s[end+len('</h1>'):]
    assert s.count('<h1') == 1, f + ' の h1 が1本にならなかった'
    open(f, 'w', encoding='utf-8').write(s); n_h1 += 1

# ── ①' CSS の位置指定をクラス指定へ（隠れたままにする）
n_css = 0
for f in sorted(glob.glob('css/*maison*.css')):
    s = open(f, encoding='utf-8').read(); before = s
    # 「…>nav+p+h1」等の連鎖を .legacy-lede 起点へ
    def swap(m):
        base = m.group(1)
        return (f'{base}>nav,{base}>nav+p,{base}>.legacy-lede,'
                f'{base}>.legacy-lede+p,{base}>.legacy-lede+p+div')
    s = re.sub(r'(\.[a-z-]+)>nav,\1>nav\+p,\1>nav\+p\+h1,\1>nav\+p\+h1\+p,\1>nav\+p\+h1\+p\+div', swap, s)
    if s != before:
        open(f, 'w', encoding='utf-8').write(s); n_css += 1

# ── ② 極小文字の底上げ
n_font = 0; bumped = 0
for f in sorted(glob.glob('css/*maison*.css')):
    s = open(f, encoding='utf-8').read(); before = s
    def up(m):
        global bumped
        v = float(m.group(1))
        if v >= 11.5: return m.group(0)
        bumped += 1
        return 'font-size:11.5px'
    s = re.sub(r'font-size:([0-9.]+)px', up, s)
    if s != before:
        open(f, 'w', encoding='utf-8').write(s); n_font += 1

print(f'  ① h1を1本に  {n_h1}枚 / CSSの選択子を付け替え {n_css}本')
print(f'  ② 極小文字を11.5pxへ  {n_font}本のCSS / {bumped}箇所')

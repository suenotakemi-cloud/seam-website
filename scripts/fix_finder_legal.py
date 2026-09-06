# SEAM: 髪格診断のページから 特商法・利用規約へ辿れるようにする（2026-09-07）
#
# 【なぜ】/finder は「髪格診断」で1位を取っている顔のページなのに
#   フッタが「SEAM · Salon Selection Store」の一行だけで
#   特定商取引法に基づく表記・利用規約への道が **0本** だった
#   （プライバシーだけ別経路であった）。物を売るサイトとして通らない。
#
# 【なぜ生成物を直すか】build-finder.yml は js/finder-app.jsx の変更で動くが
#   その .jsx はリポジトリに存在しない。つまり workflow は発火せず
#   finder-app.js が事実上の正本。上書きされる心配はない。
#
# 冪等。
import re, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
f = 'js/finder-app.js'
s = open(f, encoding='utf-8').read(); before = s

MARK = 'legal-links-finder'
LINKS = (
 ', /*#__PURE__*/React.createElement("nav", { className: "' + MARK + '",'
 ' style: { marginTop: 10, display: "flex", flexWrap: "wrap", gap: 16,'
 ' alignItems: "center", justifyContent: "center", fontSize: 12,'
 ' textTransform: "none", letterSpacing: "normal" } },'
 ' /*#__PURE__*/React.createElement("a", { href: "terms.html",'
 ' style: { minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "underline" } }, "\\u5229\\u7528\\u898F\\u7D04"),'
 ' /*#__PURE__*/React.createElement("a", { href: "privacy.html",'
 ' style: { minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "underline" } }, "\\u30D7\\u30E9\\u30A4\\u30D0\\u30B7\\u30FC\\u30DD\\u30EA\\u30B7\\u30FC"),'
 ' /*#__PURE__*/React.createElement("a", { href: "tokushoho.html",'
 ' style: { minHeight: 44, display: "inline-flex", alignItems: "center", textDecoration: "underline" } }, "\\u7279\\u5B9A\\u5546\\u53D6\\u5F15\\u6CD5\\u306B\\u57FA\\u3065\\u304F\\u8868\\u8A18"))'
)

if MARK not in s:
    n = 0
    # 2か所のフッタ末尾（"SEAM \xB7 Salon Selection Store"）の直後へ入れる
    needle = '"SEAM \\xB7 Salon Selection Store")'
    out = []
    i = 0
    while True:
        j = s.find(needle, i)
        if j < 0:
            out.append(s[i:]); break
        end = j + len(needle) - 1        # 閉じ括弧の手前
        out.append(s[i:end]); out.append(LINKS); out.append(')')
        i = j + len(needle); n += 1
    s = ''.join(out)
    print(f'  フッタ {n}か所に法務リンクを追加')

if s != before:
    open(f, 'w', encoding='utf-8').write(s)

# 構文が通るか
import subprocess
r = subprocess.run(['node', '--check', f], capture_output=True, text=True)
print('  構文:', '○' if r.returncode == 0 else '✗ ' + r.stderr.splitlines()[-1][:70])
if r.returncode != 0:
    import shutil; shutil.copy('/tmp/finder-app.bak.js', f)
    print('  ★戻しました')

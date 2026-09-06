# SEAM: 作り直したページで消えていたフッタを戻す（2026-09-07）
#
# 【なぜ】Codex の作り直しで入った 9本の *-maison.css がどれも
#   footer{display:none!important} を持っていて 客先の9ページで
#   フッタが丸ごと消えていた。
#
#   中に入っていたのは
#     特定商取引法に基づく表記 ／ プライバシーポリシー ／ 利用規約
#   の3本と サイト内の主要リンク。
#   HTML には在るので検索側は読めるが **人には辿れない**。
#   代わりのフッタは無い（実ブラウザで確認：代替フッタ0件・末尾は下タブだけ）。
#
#   物を売るサイトで特商法の表記に辿れないのは通らないので 見えるように戻す。
#   見た目は 各ページの紙（paper）に合う静かな形へ寄せる。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
OLD = 'footer{display:none!important}'
NEW = (
 '/* フッタは消さない（特商法・プライバシー・利用規約への道）。'
 ' 新しい紙に合わせて静かに置く */'
 'footer{display:block!important;margin-top:64px;padding:36px 24px calc(96px + env(safe-area-inset-bottom));'
 'border-top:1px solid currentColor;border-color:rgba(0,0,0,.12);background:transparent;'
 'font-size:12px;line-height:1.9;opacity:.8}'
 'footer a{min-height:44px;display:inline-flex;align-items:center;text-decoration:none}'
 'footer a:hover{text-decoration:underline}'
)

n = 0
for f in sorted(glob.glob('css/*maison*.css')):
    s = open(f, encoding='utf-8').read()
    if OLD not in s:
        continue
    s = s.replace(OLD, NEW)
    assert 'display:none!important}footer a' not in s
    open(f, 'w', encoding='utf-8').write(s); n += 1
    print(f'  {os.path.basename(f)} のフッタを戻した')

print(f'\n  計 {n}本')

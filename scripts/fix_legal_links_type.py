# SEAM: 法務リンク（特商法・プライバシー・利用規約）を読める大きさにする（2026-09-07）
#
# 【なぜ】<p class="legal-links" style="…font-size:10.5px…"> が全ページに入っていた。
#   物を売るサイトで一番小さい字が特商法の表記、という並びは通らない。
#   §3の下限（11.5px）へ上げ、当たり判定も 44px を確保する。
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
n = 0; hit = 0
for d in ['.', 'en', 'zh', 'tw', 'ko']:
    for f in sorted(glob.glob(os.path.join(d, '*.html'))):
        s = open(f, encoding='utf-8').read(); before = s
        # legal-links の font-size だけを上げる
        def up(m):
            global hit
            body = m.group(0)
            new = re.sub(r'font-size:\s*([0-9.]+)px',
                         lambda x: 'font-size:12px' if float(x.group(1)) < 12 else x.group(0), body)
            if new != body: hit += 1
            return new
        s = re.sub(r'<p class="legal-links"[^>]*>', up, s)
        # リンク自体に押せる高さを与える
        s = s.replace(
            '<a href="terms.html" style="text-decoration:underline;">',
            '<a href="terms.html" style="text-decoration:underline;display:inline-block;min-height:44px;line-height:44px;">')
        s = s.replace(
            '<a href="privacy.html" style="text-decoration:underline;"',
            '<a href="privacy.html" style="text-decoration:underline;display:inline-block;min-height:44px;line-height:44px;"')
        s = s.replace(
            '<a href="tokushoho.html" style="text-decoration:underline;"',
            '<a href="tokushoho.html" style="text-decoration:underline;display:inline-block;min-height:44px;line-height:44px;"')
        if s != before:
            open(f, 'w', encoding='utf-8').write(s); n += 1

print(f'  法務リンクを直した: {n}枚 / font-size を上げた: {hit}箇所')

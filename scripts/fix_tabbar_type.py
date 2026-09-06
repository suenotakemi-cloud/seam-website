# SEAM: 共通の下タブ・ヘッダの極小文字を底上げする（2026-09-07）
#
# 【なぜ】js/app-tabbar.js（25ページが読む）に 7.5〜10.5px の指定があり
#   下タブのラベル（ホーム・オンライン・サロン予約・店舗一覧）が 8.5px
#   フッタの法務リンク（特商法・プライバシー・利用規約）が 10.5px だった。
#   指示書§3の「11.5px 未満を1つも残さない」に合わせる。
#
# 【例外】.shs-short は 42px の丸ボタンの中の "SHOP"。
#   11.5px にすると丸からはみ出すので 10px に留め、
#   絵（買い物袋）と aria-label が意味を運んでいることを頼りにする。
#   ここだけは指示書の下限に届かないので 正直に残す。
#
# 冪等。
import re, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
f = 'js/app-tabbar.js'
s = open(f, encoding='utf-8').read(); before = s

# ① .shs-short だけ先に 10px へ退避（あとの一括から外すため）
s = re.sub(r'(\.shs-short\{[^}]*?)font-size:7\.5px', r'\g<1>font-size:10px', s)

# ② 残りの 11.5px 未満を 11.5px へ
def up(m):
    v = float(m.group(1))
    return m.group(0) if v >= 11.5 or v == 10.0 else 'font-size:11.5px'
# 10px は .shs-short の退避先なので触らない判定を入れる
parts = s.split('.shs-short')
parts[0] = re.sub(r'font-size:([0-9.]+)px', lambda m: 'font-size:11.5px' if float(m.group(1)) < 11.5 else m.group(0), parts[0])
for i in range(1, len(parts)):
    head, sep, tail = parts[i].partition('}')
    tail = re.sub(r'font-size:([0-9.]+)px', lambda m: 'font-size:11.5px' if float(m.group(1)) < 11.5 else m.group(0), tail)
    parts[i] = head + sep + tail
s = '.shs-short'.join(parts)

if s != before:
    open(f, 'w', encoding='utf-8').write(s)

rest = sorted({float(x) for x in re.findall(r'font-size:([0-9.]+)px', s) if float(x) < 11.5})
print(f'  app-tabbar.js を更新')
print(f'  11.5px未満で残したもの: {rest if rest else "なし"}（.shs-short の丸ボタン内だけ）')

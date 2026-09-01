# SEAM: 店舗Instagramの綴りを直す（2026-09-02）
#
# 【なぜ】オーナーから札幌と名古屋がおかしいと指摘。調べたら**4店**が間違っていた。
#   Googlebot の UA で instagram.com を引くと はっきり分かれた
#     存在する … 1.1〜2.0MB ＋ og:title あり
#     存在しない … 全部 621KB 前後の同一サイズ（エラー面）＋ og:title なし
#
#   ✗ seam.ginza / seam.sapporo / seam.nagoya / seam.osaka  … 存在しない
#   ○ seam_ginza / seam_sapporo / seam_nagoya / seam_osaka  … 存在する
#   ○ seam.fukuoka … **ドットのままで正しい**（ここだけ例外なので触らない）
#   ○ gallica_seam / gigi_seam_utsunomiya / seam_japan … 正しい
#
# 冪等。
import re, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
FIX = {
    'seam.ginza':   'seam_ginza',
    'seam.sapporo': 'seam_sapporo',
    'seam.nagoya':  'seam_nagoya',
    'seam.osaka':   'seam_osaka',
}
KEEP = ['seam.fukuoka', 'gallica_seam', 'gigi_seam_utsunomiya', 'seam_japan']

targets = []
for d in ['.', 'en', 'zh', 'tw', 'ko']:
    targets += sorted(glob.glob(os.path.join(d, '*.html')))
targets += sorted(glob.glob('*.json')) + sorted(glob.glob('data/*.json'))
targets += sorted(glob.glob('js/*.js'))

n_files = 0; n_hits = 0
for f in targets:
    if not os.path.exists(f):
        continue
    s = open(f, encoding='utf-8').read()
    before = s
    for bad, good in FIX.items():
        # instagram.com/<handle> の形と @<handle> の形の両方
        s = s.replace('instagram.com/' + bad, 'instagram.com/' + good)
        s = s.replace('@' + bad, '@' + good)
    if s != before:
        # 直したあとに 誤りが1つも残っていないこと
        for bad in FIX:
            assert bad not in s, f'{f} に {bad} が残った'
        # 触ってはいけないものが消えていないこと
        for k in KEEP:
            assert before.count(k) == s.count(k), f'{f} の {k} が変わった'
        open(f, 'w', encoding='utf-8').write(s)
        n_files += 1
        n_hits += sum(before.count(b) for b in FIX)

print(f'  直したファイル {n_files}枚 / 置換 {n_hits}箇所')
for bad, good in FIX.items():
    rest = sum(1 for f in targets if os.path.exists(f) and bad in open(f, encoding='utf-8').read())
    print(f'   {bad:16} → {good:16} 残り {rest}枚')

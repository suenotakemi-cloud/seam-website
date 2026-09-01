# SEAM: 終わったセールの掲出を消し、表参道の開店時刻を直す（2026-09-02）
#
# 【① セール】オーナーから「サマーセールがまだ出ている」と指摘。
#   調べたら /onlineshop の入会無料バッジ #saleJoinFree が **見えたまま**だった。
#   日付ゲート自体は正しい（7/1〜8/1 の窓の外なので hidden を付けている）。
#   ★原因は hidden 属性が効いていないこと。
#     UAの [hidden]{display:none} を、要素のインライン display:inline-flex が上書きしていた。
#     インライン指定は [hidden] より強い。
#   → バッジは会期が終わっているので取り除く。
#   → 同じ事故が二度と起きないよう [hidden]{display:none !important} の保険も足す。
#
# 【② 表参道】開店が 10:00 になっていたが 11:00 が正。
#   10:00 は札幌・福岡では**正しい**ので、表参道のぶんだけ狙って直す。
#   tokyo系ページは銀座(11:00)と表参道(10:00)が並ぶので、表参道側のキーだけ触る。
#
# 冪等。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

# ───────── ① セールバッジを取り除く
n_badge = 0
f = 'onlineshop.html'
s = open(f, encoding='utf-8').read()
before = s
# マークアップ本体（コメントごと）。正規表現だと属性の中の > で切れるので位置で取る
i = s.find('<p id="saleJoinFree"')
if i >= 0:
    j = s.find('</p>', i) + len('</p>')
    c = s.rfind('<!--', 0, i)
    start = c if (c >= 0 and 'サマーセール' in s[c:i]) else i
    s = s[:start] + s[j:]
# 日付ゲートのスクリプト
i = s.find('saleJoinFree')
if i >= 0:
    a = s.rfind('<script>', 0, i)
    b = s.find('</script>', i) + len('</script>')
    if a >= 0 and b > a:
        s = s[:a] + s[b:]
# 辞書の g1（5言語）
m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
if m:
    try: d = json.loads(m.group(2))
    except Exception: d = None
    if d and set(d) >= set(LANGS):
        for lg in LANGS:
            if 'g1' in d.get(lg, {}): del d[lg]['g1']
        m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]
# GAPFILL 側の辞書にも g1 が残るので そこも消す
gm = re.search(r'(SEAM_I18N_GAPFILL.*?=\s*)(\{.*?\})(\s*;)', s, re.S)
if gm:
    try: gd = json.loads(gm.group(2))
    except Exception: gd = None
    if gd:
        touched = False
        for lg in list(gd):
            if isinstance(gd[lg], dict) and 'g1' in gd[lg]:
                del gd[lg]['g1']; touched = True
        if touched:
            gm2 = re.search(r'(SEAM_I18N_GAPFILL.*?=\s*)(\{.*?\})(\s*;)', s, re.S)
            s = s[:gm2.start()] + gm2.group(1) + json.dumps(gd, ensure_ascii=False, sort_keys=True) + gm2.group(3) + s[gm2.end():]

if s != before:
    assert 'saleJoinFree' not in s, 'バッジが残った'
    assert '入会金1,100円' not in s, 'セール文言が残った'
    assert '</body>' in s, '構造が壊れた'
    open(f, 'w', encoding='utf-8').write(s); n_badge = 1

# ───────── ①' [hidden] の保険（全ページ）
GUARD = '<style>[hidden]{display:none !important}</style>'
n_guard = 0
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    if '[hidden]{display:none !important}' in s:
        continue
    i = s.find('</head>')
    if i < 0:
        continue
    s = s[:i] + '  ' + GUARD + '\n' + s[i:]
    open(f, 'w', encoding='utf-8').write(s); n_guard += 1

# ───────── ② 表参道の開店時刻
# 対象は「表参道の営業時間」を表すものだけ。札幌・福岡の 10:00 は触らない。
n_hours = 0
OMO_ONLY = ['store-omotesando.html', 'recruit-shopmanager-omotesando.html', 'recruit-parttime-omotesando.html']
for f in OMO_ONLY:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read(); before = s
    s = s.replace('10:00–20:00', '11:00–20:00').replace('10:00-20:00', '11:00-20:00').replace('"opens":"10:00"', '"opens":"11:00"')
    if s != before:
        open(f, 'w', encoding='utf-8').write(s); n_hours += 1

# tokyo系：銀座(11:00)と表参道(10:00)が並ぶ。表参道側のキーだけ差し替える
for f in sorted(glob.glob('*-tokyo.html')):
    s = open(f, encoding='utf-8').read(); before = s
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not m: continue
    try: d = json.loads(m.group(2))
    except Exception: continue
    # 「表参道駅」を値に持つキーの番号 +1 が その店の営業時間キー
    key = None
    for k, v in d['ja'].items():
        if isinstance(v, str) and '表参道駅' in v:
            mm = re.match(r'^s(\d+)$', k)
            if mm: key = 's' + str(int(mm.group(1)) + 1)
            break
    if not key or key not in d['ja']: continue
    if '10:00' not in d['ja'][key]: continue
    for lg in LANGS:
        if key in d.get(lg, {}):
            d[lg][key] = d[lg][key].replace('10:00', '11:00')
    # 本文側の実体も（その要素だけ）
    mp = re.search(r'(<[a-z0-9]+\b[^>]*data-i18n="%s"[^>]*>)(.*?)(</[a-z0-9]+>)' % re.escape(key), s, re.S)
    if mp and '10:00' in mp.group(2):
        s = s[:mp.start(2)] + mp.group(2).replace('10:00', '11:00') + s[mp.end(2):]
    # JSON-LD：表参道の Place だけ
    s = re.sub(r'(gallica[^}]{0,400}?"opens":")10:00', r'\g<1>11:00', s)
    m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]
    if s != before:
        open(f, 'w', encoding='utf-8').write(s); n_hours += 1

print(f'  ① セールバッジ除去 {n_badge}枚 / [hidden]の保険 {n_guard}枚')
print(f'  ② 表参道の開店時刻 {n_hours}枚')

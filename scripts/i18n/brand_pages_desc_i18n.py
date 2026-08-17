# SEAM: ブランドページに残っていた商品の一言説明32本を5言語に（2026-08-17）
#
# 【なぜ】UI・アクセス・FAQを訳したあと、生成物 en/ に残っていたのはこの層だけ。
#   ブランドページで「その店で出会える3本」を紹介する短い説明で、
#   海外から検索で来た人が最後に読むのがここ。
# 【訳し方】日本語の感覚語をそのまま移し、効能の断定は足さない（薬機法配慮）。
#   商品名・製品ライン名（アクアヴィア等）は訳さない。
# 訳表は brand_pages_desc_table.py。冪等。
import re, json, sys, os, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from brand_pages_desc_table import D

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

n_pages = n_hit = 0
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    if 'bp.backHub' not in s and 'bp.buyin.' not in s:
        continue
    before = s
    dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not dm:
        continue
    try:
        d = json.loads(dm.group(2))
    except Exception:
        continue
    if set(d) != set(LANGS):
        continue
    dict_before = json.dumps(d, ensure_ascii=False, sort_keys=True)

    idx = 0
    for ja_text, vals in D.items():
        pat = re.compile(r'(<([a-z][a-z0-9]*)\b(?![^>]*data-i18n=)[^>]*?)(>)' + re.escape(ja_text) + r'(</\2>)')
        if not pat.search(s):
            continue
        idx += 1
        key = f'bp.desc{idx}'
        s = pat.sub(lambda mo, k=key, t=ja_text: mo.group(1) + f' data-i18n="{k}"' + mo.group(3) + t + mo.group(4), s)
        for L in LANGS:
            d[L][key] = ja_text if L == 'ja' else vals[L]
    if idx == 0:
        continue

    dict_after = json.dumps(d, ensure_ascii=False, sort_keys=True)
    # 【罠】要素を書き換えたぶん位置がずれる。辞書の位置は取り直す
    dm2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not dm2:
        print(f'  {f:30} ★ 辞書を見失った → 書き戻さない'); continue
    s = s[:dm2.start()] + dm2.group(1) + dict_after + dm2.group(3) + s[dm2.end():]

    i = s.find('window.SEAM_PAGE_I18N')
    if not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)) or '</body>' not in s:
        print(f'  {f:30} ★ 構造が壊れた → 書き戻さない'); continue
    if not set(json.loads(dict_before)['ja']) <= set(d['ja']):
        print(f'  {f:30} ★ 既存キーが消えた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    n_pages += 1; n_hit += idx

print(f'  {n_pages}枚 / 説明 {n_hit}件')

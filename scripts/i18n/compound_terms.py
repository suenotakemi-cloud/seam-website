# SEAM: 検索で実際に打たれる compound形を入れる（2026-08-25）
#
# 【なぜ】監査で穴が出た（密度ではなく 語の形の問題）
#   ブランド×地域123枚 「販売店」    0/123   ← 実測クエリは「つるりんちょ 販売店」「エルジューダ 販売店」
#   物販ショップ 7枚    「美容室専売品」1/7
#   ヘッドスパ 4枚      「個室ヘッドスパ」0/4  ← あるのは「完全個室のヘッドスパ」（の入り）だけ
#
# 【入れないもの】
#   「ドライヘッドスパ」… SEAMは水素・炭酸・頭浸浴を使う湿式。嘘になるので入れない
#
# 【罠1】ja は HTML本体が正。辞書の ja は言語切替のときしか使われない。
# 【罠2】「もう入っているか」を要素の中身だけで見ると **テンプレ違いで複数キーを持つページに
#        2回入る**（一度これで4重に入れた）。ページ全体で1回だけと決めて 入れ先は優先順で1つ選ぶ。
#
# 冪等。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
AREAS = ['ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya', 'tokyo']

JOBS = [
  # (対象, 入れ先の優先順, ページ全体での目印, 文言)
  ('brand', ['bp.a1', 'bp.faqA1', 'bp.para1', 's5'], '販売店をお探し',
   {'ja': '　販売店をお探しでしたら そのままお越しください',
    'en': ' If you are looking for where to buy it, just come by.',
    'zh': '　如果您在寻找销售店，欢迎直接前来。',
    'tw': '　如果您在尋找銷售店，歡迎直接前來。',
    'ko': ' 판매점을 찾고 계신다면 그대로 방문해 주세요.'}),
  ('store', ['s21'], '美容室専売品の販売店',
   {'ja': '　美容室専売品の販売店です',
    'en': ' A retailer of salon-exclusive hair care.',
    'zh': '　美容室专卖品的销售店。',
    'tw': '　美容室專賣品的銷售店。',
    'ko': ' 미용실 전용 제품 판매점입니다.'}),
  ('headspa', ['s9'], '個室ヘッドスパをお探し',
   {'ja': '　個室ヘッドスパをお探しの方にも',
    'en': ' A private-room head spa, if that is what you are looking for.',
    'zh': '　如果您在寻找独立包间头皮SPA。',
    'tw': '　如果您在尋找獨立包廂頭皮SPA。',
    'ko': ' 개인실 헤드스파를 찾고 계신 분께도.'}),
]

def targets(kind):
    if kind == 'brand':
        pat = re.compile(r'^[a-z0-9-]+-(%s)\.html$' % '|'.join(AREAS))
        return [f for f in sorted(glob.glob('*.html'))
                if pat.match(f) and not f.startswith(('store-', 'salon-', 'headspa-', 'recruit-'))]
    if kind == 'store':   return sorted(glob.glob('store-*.html'))
    if kind == 'headspa': return sorted(glob.glob('headspa*.html'))
    return []

for kind, keys, mark, line in JOBS:
    n_body = n_dict = skip = 0
    for f in targets(kind):
        s = open(f, encoding='utf-8').read()
        # ★ページ全体で1回だけ。既にあれば何もしない
        if mark in s:
            continue
        before = s
        placed = None
        for key in keys:
            mp = re.search(r'(<[a-z0-9]+\b[^>]*data-i18n="%s"[^>]*>)(.*?)(</[a-z0-9]+>)' % re.escape(key), s, re.S)
            if not mp:
                continue
            s = s[:mp.end(2)] + line['ja'] + s[mp.end(2):]
            placed = key; n_body += 1
            break
        if not placed:
            skip += 1; continue

        m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if m:
            try: d = json.loads(m.group(2))
            except Exception: d = None
            if d and set(d) == set(LANGS):
                touched = False
                for lg in LANGS:
                    v = d[lg].get(placed, '')
                    if v and line[lg] not in v:
                        d[lg][placed] = v + line[lg]; n_dict += 1; touched = True
                if touched:
                    m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
                    s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]

        if s == before: continue
        i = s.find('window.SEAM_PAGE_I18N')
        if i > 0 and not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)):
            print(f'  ★{f} 構造が壊れた → 書き戻さない'); continue
        if '</body>' not in s:
            print(f'  ★{f} </body>が消えた → 書き戻さない'); continue
        open(f, 'w', encoding='utf-8').write(s)

    print(f'  {kind:8} 本文 {n_body}枚 / 辞書 {n_dict}件' + (f' / 入れ先なし {skip}枚' if skip else ''))

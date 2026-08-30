# SEAM: ブランド×地域ページに「そのブランドが何か」を入れる（2026-08-25）
#
# 【なぜ】同じ地域の別ブランド同士で類似度0.913（elujuda-ginza vs milbon-ginza）。
#   原因ははっきりしていて bp.para1（街の説明）が **ブランド名すら入らず完全に同一**。
#   ブランド名を差し替えただけのページが並ぶと 検索側は片方を重複とみなす。
#
# 【直し方】ブランドハブ（elujuda.html など）に既にある正確な説明文を
#   同じブランドの各地域ページへ配る。新しく書き起こさないので嘘が入らない。
#
# 冪等。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
AREAS = ['ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya', 'tokyo']
HUBS = ['aujua', 'kerastase', 'tokio', 'bykarte', 'shu-uemura', 'lashaddict', 'sublimic',
        'shiseido-professional', 'tsururincho', 'system-professional', 'milbon', 'elujuda',
        'davines', 'oggi-otto', 'seesaw', 'onedk']

def hub_desc(h):
    """ハブの h1 直後の説明文だけを取り出す（「取扱形態」以降は定型なので切る）"""
    f = h + '.html'
    if not os.path.exists(f): return None, None
    s = open(f, encoding='utf-8').read()
    b = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
    m = re.search(r'</h1>(.*?)<(?:h2|div class="chips"|section)', b, re.S)
    if not m: return None, None
    t = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', m.group(1))).strip()
    t = t.split('取扱形態')[0].strip()
    if len(t) < 20: return None, None
    # 他言語ぶんも辞書から拾えるなら拾う
    other = {}
    md = re.search(r'window\.SEAM_PAGE_I18N\s*=\s*(\{.*?\})\s*;', s, re.S)
    if md:
        try:
            d = json.loads(md.group(1))
            # ja の本文と一致するキーを探し その同名キーの他言語を取る
            for k, v in d.get('ja', {}).items():
                if isinstance(v, str) and len(v) > 20 and re.sub(r'\s+','',re.sub(r'<[^>]+>','',v))[:24] in re.sub(r'\s+','',t):
                    for lg in LANGS:
                        if lg != 'ja' and d.get(lg, {}).get(k):
                            other[lg] = re.sub(r'<[^>]+>', '', d[lg][k]).strip()
                    break
        except Exception:
            pass
    return t, other

descs = {h: hub_desc(h) for h in HUBS}
pat = re.compile(r'^([a-z0-9-]+)-(%s)\.html$' % '|'.join(AREAS))
n_body = n_dict = 0
no_hub = set()

for f in sorted(glob.glob('*.html')):
    m = pat.match(f)
    if not m or f.startswith(('store-', 'salon-', 'headspa-', 'recruit-')):
        continue
    brand = m.group(1)
    ja, other = descs.get(brand, (None, None))
    if not ja:
        no_hub.add(brand); continue

    s = open(f, encoding='utf-8').read()
    before = s
    mark = ja[:14]          # 既に入っているかの目印

    # 入れ先は bp.para1（街の説明の直後）／無ければ s5
    for key in ('bp.para1', 's5', 'bp.a1', 'bp.faqA1'):
        mp = re.search(r'(<[a-z0-9]+\b[^>]*data-i18n="%s"[^>]*>)(.*?)(</[a-z0-9]+>)' % re.escape(key), s, re.S)
        if not mp:
            continue
        if mark in mp.group(2):
            break
        s = s[:mp.end(2)] + '<br>' + ja + s[mp.end(2):]
        n_body += 1
        # 辞書側
        md = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if md:
            try: d = json.loads(md.group(2))
            except Exception: d = None
            if d and set(d) == set(LANGS):
                touched = False
                for lg in LANGS:
                    v = d[lg].get(key, '')
                    add = ja if lg == 'ja' else other.get(lg)
                    if v and add and add[:14] not in v:
                        d[lg][key] = v + '<br>' + add; n_dict += 1; touched = True
                if touched:
                    m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
                    s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]
        break

    if s == before:
        continue
    i = s.find('window.SEAM_PAGE_I18N')
    if i > 0 and not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)):
        print(f'  ★{f} 構造が壊れた → 書き戻さない'); continue
    if '</body>' not in s:
        print(f'  ★{f} </body>が消えた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)

print(f'  本文 {n_body}枚 / 辞書 {n_dict}件')
if no_hub: print(f'  ハブ説明が取れなかったブランド: {sorted(no_hub)}')

# SEAM: 作り直したページのコピーを社内の書き方に揃える（2026-09-07）
#
# 【なぜ】Codex の新コピー10枚だけ 句点「。」読点「、」を使っていた。
#   手つかずの7枚（davines・shu-uemura・elujuda ほか）は句点0・読点0で
#   読点の位置に半角スペースを置く書き方。SEAMの文体はそちら。
#
# 【やり方】
#   ・文末の「。」は落とす
#   ・文中の「。」は半角スペース（文が続くため）
#   ・「、」は半角スペース
#   ・商品名の中の「。」は残す（つるりんちょ。／いるかのせなか。）
#   ・辞書(JSON)側の同じ文字列も揃える（言語切替で戻らないように）
#
# 冪等。
import re, json, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
PAGES = ['tokio.html','bykarte.html','sublimic.html','system-professional.html','milbon.html',
         'oggi-otto.html','rekera.html','tsururincho.html','aujua.html','kerastase.html','brand.html']
KEEP = ['つるりんちょ。', 'いるかのせなか。']          # 商品名の句点は残す

def clean(t):
    if not isinstance(t, str) or not re.search(r'[。、]', t):
        return t
    # 守るものを退避
    holes = {}
    for i, k in enumerate(KEEP):
        h = f'\x00{i}\x00'
        if k in t:
            t = t.replace(k, h); holes[h] = k
    t = t.replace('、', ' ')
    t = re.sub(r'。\s*$', '', t)          # 文末
    t = t.replace('。', ' ')              # 文中
    t = re.sub(r'[ 　]{2,}', ' ', t).strip()
    for h, k in holes.items():
        t = t.replace(h, k)
    return t

n_html = n_dict = 0
for f in PAGES:
    if not os.path.exists(f): continue
    s = open(f, encoding='utf-8').read(); before = s

    # ① タグの外にある地の文だけを直す（属性やJSは触らない）
    def fix_text(m):
        global n_html
        t = m.group(0)
        c = clean(t)
        if c != t: n_html += 1
        return c
    # >…< に挟まれた部分だけ
    s = re.sub(r'(?<=>)[^<>]*[。、][^<>]*(?=<)', fix_text, s)

    # ② 辞書の値も同じ形へ
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if m:
        try: d = json.loads(m.group(2))
        except Exception: d = None
        if d and 'ja' in d:
            touched = False
            for k, v in d['ja'].items():
                if isinstance(v, str):
                    c = clean(v)
                    if c != v: d['ja'][k] = c; n_dict += 1; touched = True
            if touched:
                m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
                s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]

    if s != before:
        assert '</body>' in s, f + ' が壊れた'
        open(f, 'w', encoding='utf-8').write(s)

print(f'  本文 {n_html}箇所 / 辞書 {n_dict}箇所を直した')

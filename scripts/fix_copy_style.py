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
# 客先の「お店の顔」ぜんぶ。読みもの・法務・求人は長文なので触らない
import glob as _g
_SKIP = re.compile(r'^(admin|entrance|seo-|strategy|hpb-|ginza-earn|ginza-salonboard|august-|exec-|404|write|gbp-|press-kit|finder-spec|privacy|terms|tokushoho|recruit|guide-|journal|press)')
PAGES = [f for f in sorted(_g.glob('*.html')) if not _SKIP.match(f)]
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
    #
    # 【罠・実際にやらかした】<script>…</script> の中身も「> と < に挟まれた文字」なので
    #   素の正規表現だと辞書 window.SEAM_PAGE_I18N ごと拾う。
    #   中国語(zh/tw)は「。」が正しい記号なので、そこから 。を消すと中文が壊れる。
    #   実測: zh/store-ginza の見える中文 22個→0個。先に script/style を退避しておく。
    _blocks = []
    def _stash(m):
        _blocks.append(m.group(0))
        return '\x01%d\x01' % (len(_blocks) - 1)
    s = re.sub(r'<(script|style)\b[^>]*>.*?</\1>', _stash, s, flags=re.S | re.I)
    def fix_text(m):
        global n_html
        t = m.group(0)
        c = clean(t)
        if c != t: n_html += 1
        return c
    # >…< に挟まれた部分だけ
    s = re.sub(r'(?<=>)[^<>]*[。、][^<>]*(?=<)', fix_text, s)

    for _i, _b in enumerate(_blocks):          # 退避したものを戻す
        s = s.replace('\x01%d\x01' % _i, _b)

    # ② 辞書の値も同じ形へ（ja だけ。他言語はその言語の作法に従う）
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

# SEAM: zh/tw の「正规代理店／正規代理店」を「授权零售店／授權零售店」へ（2026-08-17）
#
# 【なぜ】外部レビューの指摘。
#   事実は「メーカー公認の正規取扱店（小売）」であって、代理・流通契約ではない。
#   中国語の「代理店」は代理・総代理の含みがあり、事実より強い表現になっている。
#   en の `authorized retailer` は事実どおりなのでそのまま。
#
# 【なぜ広い範囲を触るか】この語は私の生成器の外にも入っている。
#   ・scripts/i18n/dict.json          … 店舗ページ等の共通辞書
#   ・scripts/i18n/brand_pages_i18n_table.py … bp.backHub 等
#   ・scripts/i18n/inject_pages.js    … **-tokyo ページの <title> にも入る**（検索に出る）
#   生成元を直さないと、次に流したとき戻る。
#
# 冪等。ja の値は一切触らない（ja に「代理店」は0件であることを確認済み）。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
REPL = [('正规代理店', '正规授权零售店'),   # 簡体
        ('正規代理店', '正規授權零售店')]   # 繁体

SRC = ['scripts/i18n/dict.json', 'scripts/i18n/brand_pages_i18n_table.py',
       'scripts/i18n/brand_pages_i18n.py', 'scripts/i18n/inject_pages.js',
       'data/brands_directory.json']
# 【注】brand_pages_ui_i18n.py / brand_pages_faq_i18n.py の HUB_SUFFIX には
#   旧表記を**わざと残して**ある（backHub を新旧どちらでも読めるようにするため）。
#   だからここでは触らない。

n_src = 0
for f in SRC:
    if not os.path.exists(f):
        print(f'  {f} 無し'); continue
    s = open(f, encoding='utf-8').read()
    before = s
    for a, b in REPL:
        s = s.replace(a, b)
    if s != before:
        open(f, 'w', encoding='utf-8').write(s)
        n_src += 1
        print(f'  生成元 {f}')

# ── 既にページへ焼かれている値を差し替える（zh / tw の値だけ）
n_pages = n_val = 0
globals().setdefault('_', None)
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not m:
        continue
    try:
        d = json.loads(m.group(2))
    except Exception:
        # 【罠】index / brand / shop の辞書は **JS単引用符様式**で json では読めない。
        #   ja に「代理店」は0件と確認済みなので、この2語だけ素直に置換する
        t = s
        for a, b in REPL:
            t = t.replace(a, b)
        if t != s:
            open(f, 'w', encoding='utf-8').write(t)
            n_pages += 1; n_val += 1
            print(f'  {f:30} JS様式のため素の置換')
        continue
    if 'zh' not in d or 'tw' not in d:
        continue
    hit = 0
    for L, (a, b) in (('zh', REPL[0]), ('tw', REPL[1])):
        for k, v in list(d[L].items()):
            if a in v:
                d[L][k] = v.replace(a, b); hit += 1
    if not hit:
        continue
    s = s[:m.start()] + m.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m.group(3) + s[m.end():]

    # 構造が壊れていないか（辞書が script の中にあるか・末尾が残っているか）
    i = s.find('window.SEAM_PAGE_I18N')
    if not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)) or '</body>' not in s:
        print(f'  {f:30} ★ 構造が壊れた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    n_pages += 1; n_val += hit

print(f'  生成元 {n_src}本 / ページ {n_pages}枚 / 値 {n_val}件')

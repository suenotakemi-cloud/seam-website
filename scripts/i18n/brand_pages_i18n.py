# SEAM: ブランド×エリアページ96枚を多言語化する（2026-08-14）
#
# 【なぜ】オーナー「TOKIOがアジアで人気・台湾語中国語で福岡/大阪/名古屋/銀座/表参道で一番に」
#   実測: つるりんちょ銀座は **SEAMが1位2位を独占**、TOKIOインカラミ銀座は **2位**。
#   日本語ではもう勝てている。負けているのは多言語版が無いページだけだった。
#   ブランド関連107枚のうち **96枚が日本語のみ**（辞書もdata-i18nもhreflangも無い）。
#   銀座・表参道は `{brand}-tokyo` が多言語だから順位が取れていて、
#   福岡・大阪・名古屋には**その仕組みが存在しなかった**。
#
# 【方針】訳すのは 見出し・FAQ・UI・エリア紹介・meta。
#   商品名・価格・住所は日本語のまま残す（各国のお客様にもそのまま必要な情報で、
#   住所は現地で見せる用途がある）。
#
# 冪等。すでに辞書がある（= -tokyo）ページは触らない。
import re, json, sys, os, importlib.util

ROOT = sys.argv[1]
os.chdir(ROOT)

spec = importlib.util.spec_from_file_location('tbl', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brand_pages_i18n_table.py'))
tbl = importlib.util.module_from_spec(spec); spec.loader.exec_module(tbl)
LANGS, BRAND, CITY, T, AREA_PARAS, HUB = tbl.LANGS, tbl.BRAND, tbl.CITY, tbl.T, tbl.AREA_PARAS, tbl.HUB

AREAS = ['ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya']
STORE = {'ginza': 'SEAM GINZA', 'omotesando': 'SEAM OMOTESANDO', 'sapporo': 'SEAM SAPPORO',
         'osaka': 'SEAM OSAKA HORIE', 'nagoya': 'SEAM NAGOYA', 'fukuoka': 'SEAM FUKUOKA',
         'utsunomiya': 'SEAM UTSUNOMIYA'}

# meta。ここが検索に出る文字なので、地名とブランド名を各言語で先頭に置く
META_T = {
 'title': {'ja': '{B} {C}で買える｜正規取扱店 SEAM',
           'en': 'Buy {B} in {C} | Authorized retailer | SEAM',
           'zh': '在{C}购买{B}｜品牌授权零售商｜SEAM',
           'tw': '在{C}購買{B}｜品牌授權零售商｜SEAM',
           'ko': '{C}에서 {B} 구매｜정규 취급점｜SEAM'},
 'desc':  {'ja': '{C}で{B}を買うだけの来店ができます　施術も予約も不要　{S}は正規取扱店です',
           'en': 'You can visit {S} in {C} just to buy {B}. No treatment, no booking. {S} is an authorized retailer.',
           'zh': '在{C}可以只为购买{B}而到店　无需护理与预约　{S}是品牌授权零售商。',
           'tw': '在{C}可以只為購買{B}而到店　無需護理與預約　{S}是品牌授權零售商。',
           'ko': '{C}에서 {B}만 구매하러 방문하실 수 있습니다. 시술도 예약도 필요 없습니다. {S}는 정규 취급점입니다.'},
}


HUB_META = {
 'title': {'ja': '{B} 取扱店・正規販売店｜SEAM',
           'en': '{B} authorized retailers in Japan | SEAM',
           'zh': '{B} 销售门店・品牌授权零售商｜SEAM',
           'tw': '{B} 銷售門市・品牌授權零售商｜SEAM',
           'ko': '{B} 취급점·정규 판매점｜SEAM'},
 'desc':  {'ja': '{B}を正規取扱するSEAMの店舗一覧　施術も予約もなしで買うだけのご来店ができます',
           'en': 'SEAM stores that carry {B} as an authorized retailer. You can visit just to buy, with no treatment and no booking.',
           'zh': '正规销售{B}的SEAM门店一览　无需护理与预约，也可以只购物。',
           'tw': '正規銷售{B}的SEAM門市一覽　無需護理與預約，也可以只購物。',
           'ko': '{B}를 정규 취급하는 SEAM 매장 목록. 시술도 예약도 없이 구매만 하러 오실 수 있습니다.'},
}


def sub(s, b, a):
    return (s.replace('{B}', BRAND[b]['ja'] if False else '')
            if False else s)


BRAND_EN = {k: v['en'] for k, v in BRAND.items()}


def render(tpl, lang, b, a):
    return (tpl.replace('{E}', BRAND_EN[b])
               .replace('{B}', BRAND[b][lang])
               .replace('{C}', CITY[a][lang] if a else '')
               .replace('{S}', STORE[a] if a else 'SEAM'))


def mark(s, ja, key, used):
    """ja という文字列を持つ要素に data-i18n を付ける。
    すでに data-i18n を持つ要素と、同じ文字列の2つ目以降は触らない。"""
    if not ja or ja in used:
        return s, False
    # >テキスト< の直前のタグに属性を挿す
    pat = re.compile(r'(<(?!/)([a-z0-9]+)((?:(?!data-i18n)[^>])*?))(>\s*)' + re.escape(ja) + r'(\s*</\2>)')
    m = pat.search(s)
    if not m:
        return s, False
    s = s[:m.start()] + m.group(1) + f' data-i18n="{key}"' + m.group(4) + ja + m.group(5) + s[m.end():]
    used.add(ja)
    return s, True


BR = list(BRAND)
targets = []
for b in BR:
    if os.path.exists(f'{b}.html'):
        targets.append((f'{b}.html', b, None))
    for a in AREAS:
        if os.path.exists(f'{b}-{a}.html'):
            targets.append((f'{b}-{a}.html', b, a))

done = skipped = 0
report = []
for f, b, a in targets:
    s = open(f, encoding='utf-8').read()
    if 'SEAM_PAGE_I18N' in s:
        skipped += 1; continue

    d = {L: {} for L in LANGS}
    used = set()
    hit = 0

    # ① 共通のUI・見出し・FAQ
    for key, tr in T.items():
        ja = render(tr['ja'], 'ja', b, a)
        s, ok = mark(s, ja, key, used)
        if ok:
            hit += 1
            for L in LANGS:
                d[L][key] = render(tr[L], L, b, a)

    # ①-2 ハブ（{brand}.html）専用の見出し。エリアページとは構造が違う
    if a is None:
        for key, tr in HUB.items():
            if key == 'bp.hubBuyIn':
                continue
            ja = render(tr['ja'], 'ja', b, a)
            s, ok = mark(s, ja, key, used)
            if ok:
                hit += 1
                for L in LANGS:
                    d[L][key] = render(tr[L], L, b, a)
        # 「{地名}で買うだけOK」は7エリアぶんある
        for a2 in AREAS:
            key = f'bp.buyin.{a2}'
            ja = HUB['bp.hubBuyIn']['ja'].replace('{C}', CITY[a2]['ja'])
            s, ok = mark(s, ja, key, used)
            if ok:
                hit += 1
                for L in LANGS:
                    d[L][key] = HUB['bp.hubBuyIn'][L].replace('{C}', CITY[a2][L])

    # ② エリア紹介の3段落
    if a and a in AREA_PARAS:
        for i, p in enumerate(AREA_PARAS[a], 1):
            key = f'bp.para{i}'
            s, ok = mark(s, p['ja'], key, used)
            if ok:
                hit += 1
                for L in LANGS:
                    d[L][key] = p[L]

    # ③ 地名のリンク（ほかのエリアで探す）
    for a2 in AREAS:
        if a2 == a:
            continue
        key = f'bp.area.{a2}'
        s, ok = mark(s, CITY[a2]['ja'], key, used)
        if ok:
            hit += 1
            for L in LANGS:
                d[L][key] = CITY[a2][L]

    # ④ meta（検索結果に出る文字。ここが要）
    for L in LANGS:
        if a:
            d[L]['meta.title'] = render(META_T['title'][L], L, b, a)
            d[L]['meta.description'] = render(META_T['desc'][L], L, b, a)
        else:
            d[L]['meta.title'] = render(HUB_META['title'][L], L, b, a)
            d[L]['meta.description'] = render(HUB_META['desc'][L], L, b, a)

    if hit < 8:
        report.append((f, hit, '★ 少なすぎる'))
        continue

    # ⑤ 辞書を </body> の直前に入れる
    dict_js = ('<script>\nwindow.SEAM_PAGE_I18N = '
               + json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
               + ';\n</script>\n')
    i = s.rfind('</body>')
    s = s[:i] + dict_js + s[i:]

    # ⑥ 言語切替の土台（lang.js）。既存の多言語ページと同じ読み込み方に揃える
    if 'js/lang.js' not in s:
        s = s.replace('</body>', '  <script src="js/lang.js?v=3" defer=""></script>\n</body>', 1)

    open(f, 'w', encoding='utf-8').write(s)
    done += 1
    report.append((f, hit, 'OK'))

print(f'  多言語化 {done}枚 / 既に辞書あり {skipped}枚')
ng = [r for r in report if r[2] != 'OK']
if ng:
    print('  ★ 要確認:')
    for r in ng[:10]:
        print(f'     {r[0]:30} キー{r[1]}件 {r[2]}')
else:
    lo = min(r[1] for r in report) if report else 0
    hi = max(r[1] for r in report) if report else 0
    print(f'  1枚あたりのキー数 {lo}〜{hi}')

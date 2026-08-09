# SEAM: 海外のお客様向けに構造化データを足す。
#
#   1. 物販の店舗ノードに Store を併記 → "beauty shop"/"化粧品店" 系の検索で拾われる余地を作る
#      (いまは HairSalon のみ＝美容室としてしか読まれない)
#   2. currenciesAccepted: JPY  … 日本円での販売であることを明示(海外客の判断材料)
#   3. 免税を amenityFeature で明示 … schema.org に免税の専用プロパティは無いので
#      LocationFeatureSpecification で表す。**物販の店舗ページ7枚すべて**(2026-08-09 全店免税化)
#
#   paymentAccepted と availableLanguage は事実が確認できないため入れない(捏造しない)。
import re, json, sys, os

ROOT = sys.argv[1]
STORE_FILES = [f'store-{s}.html' for s in
               ['ginza', 'omotesando', 'osaka', 'nagoya', 'fukuoka', 'sapporo', 'utsunomiya']]
BRAND_TOKYO = [f for f in os.listdir(ROOT) if f.endswith('-tokyo.html')]
SALON_LP = [f'salon-{s}.html' for s in ['ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka']]

TAXFREE = {
    "@type": "LocationFeatureSpecification",
    "name": "Tax-free shopping",
    "value": True,
    "description": "Tax-free from 5,000 yen for visitors from overseas. Please show your passport."
}
# オーナー確認済み(2026-08-01)「クレジットカード・交通系・QR どれも使えます」。
# 現金は言われていないので書かない。paymentAccepted は「使える手段の列挙」であって
# 書いていない手段を拒否する意味にはならないため、これで正しい。
PAYMENT = "Credit Card, Transportation IC card, QR code payment"

def enrich(node, is_retail, is_taxfree_store):
    changed = False
    if is_retail and node.get('@type') == 'HairSalon':
        node['@type'] = ['HairSalon', 'Store']
        changed = True
    if 'currenciesAccepted' not in node:
        node['currenciesAccepted'] = 'JPY'
        changed = True
    if node.get('paymentAccepted') != PAYMENT:
        node['paymentAccepted'] = PAYMENT
        changed = True
    if is_taxfree_store and not any(
            (a.get('name') == 'Tax-free shopping') for a in node.get('amenityFeature', [])):
        node.setdefault('amenityFeature', []).append(TAXFREE)
        changed = True
    return changed

def patch(path, is_retail):
    s = open(path, encoding='utf-8').read()
    # 【罠】ファイル名に ginza が入るだけで免税を付けると salon-ginza / headspa-ginza
    # (役務のノード)にも付いてしまう。日本の輸出免税は物品が対象なので、
    # 免税を書いてよいのは物販の店舗ページ store-*.html だけ。
    # 2026-08-09 全7店が免税店になったため銀座限定をやめた（それ以前は銀座のみ）。
    is_taxfree_store = os.path.basename(path) in STORE_FILES
    blocks = list(re.finditer(r'(<script type="application/ld\+json">)(.*?)(</script>)', s, re.S))
    hits = 0
    # 後ろから置換してオフセットのずれを避ける
    for m in reversed(blocks):
        try:
            d = json.loads(m.group(2))
        except Exception:
            continue
        nodes = d.get('@graph', []) if isinstance(d, dict) else (d if isinstance(d, list) else [d])
        ch = False
        for x in nodes:
            if not isinstance(x, dict):
                continue
            t = x.get('@type')
            t0 = t[0] if isinstance(t, list) else t
            if t0 in ('HairSalon', 'DaySpa', 'Store', 'HealthAndBeautyBusiness'):
                if enrich(x, is_retail, is_taxfree_store):
                    ch = True
        if ch:
            hits += 1
            body = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
            s = s[:m.start()] + m.group(1) + body + m.group(3) + s[m.end():]
    if hits:
        open(path, 'w', encoding='utf-8').write(s)
    return hits

total = 0
for f in STORE_FILES:
    n = patch(os.path.join(ROOT, f), is_retail=True)
    print(f'{f:26} 物販として拡張 {n}ブロック'); total += n
for f in sorted(BRAND_TOKYO):
    n = patch(os.path.join(ROOT, f), is_retail=True)
    print(f'{f:26} 物販として拡張 {n}ブロック'); total += n
for f in SALON_LP + ['headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html']:
    n = patch(os.path.join(ROOT, f), is_retail=False)   # サービス面なので Store は付けない
    print(f'{f:26} 通貨/免税のみ    {n}ブロック'); total += n
print('\n更新ブロック合計:', total)

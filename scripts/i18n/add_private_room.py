# SEAM: 「完全個室」を構造化データに入れる。
#
# 【なぜ】完全個室はオーナーが強めたいワードで、本文とtitleには入っているが
# 機械が読める形（構造化データ）には無かった。schema.org に個室の専用プロパティは
# 無いので、免税と同じく amenityFeature(LocationFeatureSpecification) で表す。
#
# 【対象】ヘッドスパの役務ノード（DaySpa）だけ。物販の店舗ページには付けない
# （個室は施術の話で、売場の話ではないため）。
#
# 冪等。既に入っていれば触らない。
import re, json, sys, os

ROOT = sys.argv[1]
FILES = ['headspa.html', 'headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html',
         'ginza-spa-journey.html']

FEATURE = {
    "@type": "LocationFeatureSpecification",
    "name": "Fully private room",
    "value": True,
    "description": "Every head spa treatment takes place in a fully private room, one guest at a time.",
}

def patch(path):
    if not os.path.exists(path):
        return 0, 'ファイル無し'
    s = open(path, encoding='utf-8').read()
    blocks = list(re.finditer(r'(<script type="application/ld\+json">)(.*?)(</script>)', s, re.S))
    hits = 0
    for m in reversed(blocks):           # 後ろから置換してオフセットのずれを避ける
        try:
            d = json.loads(m.group(2))
        except Exception:
            continue
        nodes = d.get('@graph', []) if isinstance(d, dict) else (d if isinstance(d, list) else [d])
        changed = False
        for x in nodes:
            if not isinstance(x, dict):
                continue
            t = x.get('@type')
            t0 = t[0] if isinstance(t, list) else t
            if t0 not in ('DaySpa', 'HealthAndBeautyBusiness'):
                continue
            feats = x.setdefault('amenityFeature', [])
            if any(isinstance(a, dict) and a.get('name') == FEATURE['name'] for a in feats):
                continue
            feats.append(dict(FEATURE))
            changed = True
        if changed:
            hits += 1
            body = json.dumps(d, ensure_ascii=False, separators=(',', ':'))
            s = s[:m.start()] + m.group(1) + body + m.group(3) + s[m.end():]
    if hits:
        open(path, 'w', encoding='utf-8').write(s)
    return hits, 'OK'

total = 0
for f in FILES:
    n, msg = patch(os.path.join(ROOT, f))
    print(f'  {f:26} {n}ブロック  {msg}')
    total += n
print('\n更新ブロック合計:', total)

# 店舗ごとのサロンのページ 4 枚に C 案の見た目を当てる（2026-10-02）
# 文と訳の鍵は動かさない 包むだけ。冪等（2 回流しても同じ）
# 使い方: python3 scripts/salon_store_c.py && node .github/scripts/build-i18n.js
import re
HERO = {'ginza': 'salon_ginza_room', 'osaka': 'store_osaka', 'sapporo': 'store_sapporo', 'fukuoka': 'store_fukuoka'}
HEAD = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&amp;family=Cormorant+Garamond:ital,wght@0,400;1,400&amp;display=swap">'
        '<link rel="stylesheet" href="css/salon-store-c.css?v=1">')
for city, img in HERO.items():
    p = f'salon-{city}.html'; s = open(p, encoding='utf-8').read()
    if 'css/salon-store-c.css' in s:
        print('skip', p); continue
    s = s.replace('</head>', HEAD + '\n</head>', 1)
    s = s.replace('<body>', '<body class="sc">', 1)
    # 見出し〜地名の札を写真の帯で包む
    m = re.search(r'(<h1 .*?</h1>.*?<div class="chips[^"]*"[^>]*>.*?</div>)', s, re.S)
    assert m, p
    pic = (f'<picture class="sc-hero-bg"><source srcset="images/stores/{img}.avif" type="image/avif">'
           f'<source srcset="images/stores/{img}.webp" type="image/webp"><img src="images/stores/{img}.jpg" alt="" fetchpriority="high"></picture>')
    s = s[:m.start()] + f'<div class="sc-hero">{pic}\n    ' + m.group(1) + '\n    </div>' + s[m.end():]
    # 当日の流れ → 落ち着いた帯 / 場所と営業時間 → 明るい帯
    for word, cls in (('当日の流れ', 'sc-dark'), ('の場所と営業時間', 'sc-light')):
        i = s.index(word); j = s.rfind('<section class="', 0, i)
        s = s[:j] + f'<section class="{cls} ' + s[j + len('<section class="'):]
    open(p, 'w', encoding='utf-8').write(s); print('ok', p)

# ショップの店舗ページ 7 枚に C 案の見た目を当てる（2026-10-04）
# 文と訳の鍵は動かさない。写真の上に店名と導入文を載せる。冪等
# 使い方: python3 scripts/store_c.py && node .github/scripts/build-i18n.js
import re, glob, json
HEAD = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;500&amp;family=Cormorant+Garamond:wght@400&amp;display=swap">'
        '<link rel="stylesheet" href="css/store-c.css?v=1">')
# 導入文（s3）の言い直し：根拠のない「最大級」や同じ言い回しをやめる
LEAD = {
 'fukuoka': ('天神大名の路面 一階に<br>九州のSEAMがあります', 'On a street-level corner of Tenjin Daimyo<br>SEAM in Kyushu', '天神大名的临街一楼<br>九州的SEAM在这里', '天神大名的臨街一樓<br>九州的SEAM在這裡', '덴진 다이묘의 거리 1층에<br>규슈의 SEAM이 있습니다'),
 'nagoya': ('矢場町駅のすぐそば<br>一階と二階に広がる SEAMのセレクション', 'Steps from Yabacho Station<br>the SEAM selection across two floors', '矢场町站旁<br>横跨一楼与二楼的SEAM精选', '矢場町站旁<br>橫跨一樓與二樓的SEAM精選', '야바초역 바로 옆<br>1층과 2층에 펼쳐진 SEAM 셀렉션'),
 'omotesando': ('表参道のヘアサロン gallica の中に<br>SEAMのセレクトを置いています', 'Inside gallica, a hair salon in Omotesando<br>a SEAM selection', '在表参道的美发沙龙 gallica 之中<br>陈列着SEAM的精选', '在表參道的美髮沙龍 gallica 之中<br>陳列著SEAM的精選', '오모테산도의 헤어살롱 gallica 안에<br>SEAM의 셀렉션을 두었습니다'),
 'osaka': ('堀江 オレンジストリートのそば<br>関西のSEAMは ここにあります', 'Near Orange Street in Horie<br>SEAM in Kansai is here', '堀江 橘子街旁<br>关西的SEAM就在这里', '堀江 橘子街旁<br>關西的SEAM就在這裡', '호리에 오렌지 스트리트 근처<br>간사이의 SEAM은 여기에 있습니다'),
 'sapporo': ('大通駅から一分<br>北海道のSEAMは ここにあります', 'One minute from Odori Station<br>SEAM in Hokkaido is here', '大通站步行一分钟<br>北海道的SEAM就在这里', '大通站步行一分鐘<br>北海道的SEAM就在這裡', '오도리역에서 1분<br>홋카이도의 SEAM은 여기에 있습니다'),
 'utsunomiya': ('宇都宮のヘアサロン gigi の中に<br>SEAMのセレクトを置いています', 'Inside gigi, a hair salon in Utsunomiya<br>a SEAM selection', '在宇都宫的美发沙龙 gigi 之中<br>陈列着SEAM的精选', '在宇都宮的美髮沙龍 gigi 之中<br>陳列著SEAM的精選', '우쓰노미야의 헤어살롱 gigi 안에<br>SEAM의 셀렉션을 두었습니다'),
}
for p in sorted(glob.glob('store-*.html')):
    city = p[6:-5]; s = open(p, encoding='utf-8').read()
    if 'css/store-c.css' in s: print('skip', p); continue
    s = s.replace('</head>', HEAD + '\n</head>', 1)
    s = re.sub(r'<body(?![^>]*class=)', '<body class="stc"', s, 1) if 'class="stc"' not in s else s
    if 'class="stc' not in s:
        s = re.sub(r'<body class="', '<body class="stc ', s, 1)
    # 写真の上に 店名＋導入文 を載せる
    lab = re.search(r'<div class="absolute left-5 bottom-4[^"]*"[^>]*>\s*<p[^>]*>([^<]+)</p>\s*</div>', s)
    hm = re.search(r'\n\s*(<h1 class="st-name.*?</h1>)\s*\n\s*(<p class="st-lead.*?</p>)', s, re.S)
    assert lab and hm, p
    copy = f'<div class="stc-copy"><p class="stc-city">{lab.group(1).strip()}</p>{hm.group(1)}{hm.group(2)}</div>'
    s = s[:hm.start()] + s[hm.end():]
    lab = re.search(r'<div class="absolute left-5 bottom-4[^"]*"[^>]*>\s*<p[^>]*>([^<]+)</p>\s*</div>', s)
    s = s[:lab.start()] + copy + s[lab.end():]
    if city in LEAD:
        ja, en, zh, tw, ko = LEAD[city]
        old = re.search(r'(<p class="st-lead[^>]*data-i18n="(s\d+)"[^>]*>)(.*?)(</p>)', s, re.S)
        key = old.group(2); s = s[:old.start(3)] + ja + s[old.end(3):]
        m = re.search(r'SEAM_PAGE_I18N\s*=\s*', s); i = m.end()
        D, end = json.JSONDecoder().raw_decode(s, i)
        for l, v in (('ja', ja), ('en', en), ('zh', zh), ('tw', tw), ('ko', ko)):
            if l in D and key in D[l]: D[l][key] = v
        s = s[:i] + json.dumps(D, ensure_ascii=False) + s[end:]
    open(p, 'w', encoding='utf-8').write(s); print('ok', p)

# SEAM: ブランドページに残っていたFAQの回答を5言語に（2026-08-17）
#
# 【なぜ】生成物 en/ を読むと <dd> が47種、日本語のまま出ていた。
#   ただし中身は**4つの型 × アクセス文 × ブランド名**に還元できるので、
#   1本ずつ訳すのではなく型から組み立てる。
#   アクセス文の訳は brand_pages_ui_i18n.py と同じものを使う（二重に持たない）。
#
# 店名（SEAM / SEAM GINZA / gallica / SEAM / gigi SEAM）は固有名詞なのでそのまま。
# ブランド名は各ページの bp.backHub から言語ごとに取り出す。
# 冪等。既に data-i18n が付いている <dd> は触らない。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

ACCESS = {
 '銀座一丁目駅 7番出口から徒歩1分（銀座駅・京橋駅からも歩けます）': {
   'en': '1 min walk from Exit 7, Ginza-itchome Station (also walkable from Ginza and Kyobashi Stations)',
   'zh': '从银座一丁目站7号出口步行1分钟（从银座站・京桥站也可步行前往）',
   'tw': '從銀座一丁目站7號出口步行1分鐘（從銀座站・京橋站也可步行前往）',
   'ko': '긴자잇초메역 7번 출구에서 도보 1분(긴자역·교바시역에서도 걸어오실 수 있습니다)'},
 '表参道駅 A4出口から徒歩3分（南青山エリア）': {
   'en': '3 min walk from Exit A4, Omotesando Station (Minami-Aoyama area)',
   'zh': '从表参道站A4出口步行3分钟（南青山地区）', 'tw': '從表參道站A4出口步行3分鐘（南青山地區）',
   'ko': '오모테산도역 A4 출구에서 도보 3분(미나미아오야마 지역)'},
 '地下鉄大通駅から徒歩1分': {
   'en': '1 min walk from Odori Subway Station', 'zh': '从地铁大通站步行1分钟',
   'tw': '從地鐵大通站步行1分鐘', 'ko': '지하철 오도리역에서 도보 1분'},
 '四ツ橋駅 6番出口から徒歩2分（南堀江）': {
   'en': '2 min walk from Exit 6, Yotsubashi Station (Minami-Horie)',
   'zh': '从四桥站6号出口步行2分钟（南堀江）', 'tw': '從四橋站6號出口步行2分鐘（南堀江）',
   'ko': '요쓰바시역 6번 출구에서 도보 2분(미나미호리에)'},
 '矢場町駅からすぐ（栄エリア・1階と2階のフロア）': {
   'en': 'Right by Yabacho Station (Sakae area, ground and second floors)',
   'zh': '矢场町站即到（荣地区・1楼与2楼）', 'tw': '矢場町站即到（榮地區・1樓與2樓）',
   'ko': '야바초역에서 바로(사카에 지역·1층과 2층)'},
 '西鉄天神駅から徒歩5分（大名）': {
   'en': '5 min walk from Nishitetsu Tenjin Station (Daimyo)',
   'zh': '从西铁天神站步行5分钟（大名）', 'tw': '從西鐵天神站步行5分鐘（大名）',
   'ko': '니시테쓰 텐진역에서 도보 5분(다이묘)'},
 '鶴田駅から徒歩6分（お車での来店もしやすい立地）': {
   'en': '6 min walk from Tsuruta Station (easy to visit by car as well)',
   'zh': '从鹤田站步行6分钟（开车前来也很方便）', 'tw': '從鶴田站步行6分鐘（開車前來也很方便）',
   'ko': '쓰루타역에서 도보 6분(차로 오시기에도 편한 위치입니다)'},
}
HUB_SUFFIX = {'ja': ' 正規取扱店トップ', 'en': ' authorized retailers',
              'zh': ' 正规代理店首页', 'tw': ' 正規代理店首頁', 'ko': ' 정규 취급점 톱'}

# 型（{ac} はアクセス文・{s} は店名・{b} はブランド名）
PAT = [
 (re.compile(r'^不要です (?P<ac>.+?) 営業時間内にそのままお越しください$'), {
   'en': 'No booking needed. {ac}. Just drop in during opening hours.',
   'zh': '无需预约。{ac}。在营业时间内直接前来即可。',
   'tw': '無需預約。{ac}。在營業時間內直接前來即可。',
   'ko': '예약은 필요 없습니다. {ac}. 영업시간 내에 그대로 오시면 됩니다.'}),
 (re.compile(r'^(?P<ac>.+?)です$'), {
   'en': '{ac}.', 'zh': '{ac}。', 'tw': '{ac}。', 'ko': '{ac}입니다.'}),
 (re.compile(r'^はい (?P<s>.+?)では施術やご予約がなくても (?P<b>.+?)をお買い求めいただけます お買い物だけのご来店を歓迎しています$'), {
   'en': 'Yes. At {s} you can buy {b} without any treatment or booking. You are welcome to come just to shop.',
   'zh': '是的。在{s}，即使不做施术、不预约也能购买{b}。只为购物到店也很欢迎。',
   'tw': '是的。在{s}，即使不做施術、不預約也能購買{b}。只為購物到店也很歡迎。',
   'ko': '네. {s}에서는 시술이나 예약 없이도 {b}를 구매하실 수 있습니다. 구매만을 위한 방문도 환영합니다.'}),
 (re.compile(r'^在庫は時期により変わります 確実にお求めの場合は (?P<s>.+?)のInstagramや店頭でご確認ください$'), {
   'en': "Stock changes with the season. If you want to be sure, check {s}'s Instagram or ask in store.",
   'zh': '库存因时期而异。如需确保购得，请通过{s}的Instagram或到店确认。',
   'tw': '庫存因時期而異。如需確保購得，請透過{s}的Instagram或到店確認。',
   'ko': '재고는 시기에 따라 달라집니다. 확실히 구매하시려면 {s}의 Instagram이나 매장에서 확인해 주세요.'}),
 (re.compile(r'^在庫・価格・選び方は店頭のスタッフがご案内します お買い物だけのご来店も歓迎です$'), {
   'en': 'Our staff in store can walk you through stock, prices and how to choose. You are welcome to come just to shop.',
   'zh': '库存、价格与挑选方式由店内工作人员为您介绍。只为购物到店也很欢迎。',
   'tw': '庫存、價格與挑選方式由店內工作人員為您介紹。只為購物到店也很歡迎。',
   'ko': '재고와 가격, 고르는 법은 매장 스태프가 안내해 드립니다. 구매만을 위한 방문도 환영합니다.'}),
]

n_pages = n_dd = 0
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    if 'bp.backHub' not in s and 'bp.buyin.' not in s:
        continue
    before = s
    dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not dm:
        continue
    try:
        d = json.loads(dm.group(2))
    except Exception:
        continue
    if set(d) != set(LANGS):
        continue
    dict_before = json.dumps(d, ensure_ascii=False, sort_keys=True)

    brand = {}
    for L in LANGS:
        v = re.sub(r'^[←\s]*', '', d[L].get('bp.backHub', ''))
        if v.endswith(HUB_SUFFIX[L]):
            v = v[:-len(HUB_SUFFIX[L])]
        brand[L] = v.strip()

    idx = 0
    def fix(mo):
        global idx, s
        attrs, txt = mo.group(1), mo.group(2).strip()
        if 'data-i18n' in attrs:
            return mo.group(0)
        for pat, tpl in PAT:
            pm = pat.match(txt)
            if not pm:
                continue
            g = pm.groupdict()
            ac_ja = g.get('ac')
            if 'ac' in g and ac_ja not in ACCESS:
                return mo.group(0)               # 知らないアクセス文には触らない
            idx += 1
            key = f'bp.faqA{idx}'
            for L in LANGS:
                if L == 'ja':
                    d[L][key] = txt; continue
                sub = {}
                if ac_ja:
                    sub['ac'] = ACCESS[ac_ja][L]
                if 's' in g:
                    sub['s'] = g['s']            # 店名は固有名詞なのでそのまま
                if 'b' in g:
                    sub['b'] = brand[L] or g['b']
                d[L][key] = tpl[L].format(**sub)
            return f'<dd{attrs} data-i18n="{key}">' + mo.group(2) + '</dd>'
        return mo.group(0)

    s = re.sub(r'<dd([^>]*)>([^<]{15,240})</dd>', fix, s)
    if idx == 0:
        continue

    dict_after = json.dumps(d, ensure_ascii=False, sort_keys=True)
    # 【罠】<dd> を書き換えたぶん位置がずれる。辞書の位置は取り直す
    dm2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not dm2:
        print(f'  {f:30} ★ 辞書を見失った → 書き戻さない'); continue
    s = s[:dm2.start()] + dm2.group(1) + dict_after + dm2.group(3) + s[dm2.end():]

    i = s.find('window.SEAM_PAGE_I18N')
    if not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)) or '</body>' not in s:
        print(f'  {f:30} ★ 構造が壊れた → 書き戻さない'); continue
    if not set(json.loads(dict_before)['ja']) <= set(d['ja']):
        print(f'  {f:30} ★ 既存キーが消えた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    n_pages += 1; n_dd += idx

print(f'  {n_pages}枚 / FAQ回答 {n_dd}件')

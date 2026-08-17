# SEAM: ブランドページのUI定型とアクセス文を5言語に（2026-08-17）
#
# 【なぜ】描画後の本文を機械で読んだところ、ブランドページ128枚で
#   ・フッタと導線（取扱ブランド／美容室専売品とは／全国の店舗一覧／
#     プライバシーポリシー／特定商取引法に基づく表記 など）が日本語のまま
#   ・「{ブランド}取扱店」の見出しが日本語のまま
#   ・**アクセス文が全言語で日本語のまま**（bp.a2 / bp.a3 の中身）
#     ja「…徒歩1分（…）です」→ en「…徒歩1分（…）.」と、語尾だけ替えて
#     本文は日本語のまま焼かれていた。「行き方」の答えが読めないのは痛い
#
# 【訳さないもの】商品名・ブランドの製品ライン名（アクアヴィア等）・住所。
#   住所は日本語のまま渡すほうがタクシーや配達で通じる。
#   駅名は en/ko はローマ字表記、zh/tw は漢字のまま（そのまま読めるため）。
#
# 辞書はJSON様式なので json で読み書きする（index/brand のJS単引用符様式とは別物）。
# 冪等。既に data-i18n が付いている要素は触らない。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
AREAS = ('ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya')

# ── アクセス文（店舗ごと）。日本語原文 → 各言語
ACCESS = {
 '銀座一丁目駅 7番出口から徒歩1分（銀座駅・京橋駅からも歩けます）': {
   'en': '1 min walk from Exit 7, Ginza-itchome Station (also walkable from Ginza and Kyobashi Stations)',
   'zh': '从银座一丁目站7号出口步行1分钟（从银座站・京桥站也可步行前往）',
   'tw': '從銀座一丁目站7號出口步行1分鐘（從銀座站・京橋站也可步行前往）',
   'ko': '긴자잇초메역 7번 출구에서 도보 1분(긴자역·교바시역에서도 걸어오실 수 있습니다)'},
 '表参道駅 A4出口から徒歩3分（南青山エリア）': {
   'en': '3 min walk from Exit A4, Omotesando Station (Minami-Aoyama area)',
   'zh': '从表参道站A4出口步行3分钟（南青山地区）',
   'tw': '從表參道站A4出口步行3分鐘（南青山地區）',
   'ko': '오모테산도역 A4 출구에서 도보 3분(미나미아오야마 지역)'},
 '地下鉄大通駅から徒歩1分': {
   'en': '1 min walk from Odori Subway Station',
   'zh': '从地铁大通站步行1分钟', 'tw': '從地鐵大通站步行1分鐘',
   'ko': '지하철 오도리역에서 도보 1분'},
 '四ツ橋駅 6番出口から徒歩2分（南堀江）': {
   'en': '2 min walk from Exit 6, Yotsubashi Station (Minami-Horie)',
   'zh': '从四桥站6号出口步行2分钟（南堀江）',
   'tw': '從四橋站6號出口步行2分鐘（南堀江）',
   'ko': '요쓰바시역 6번 출구에서 도보 2분(미나미호리에)'},
 '矢場町駅からすぐ（栄エリア・1階と2階のフロア）': {
   'en': 'Right by Yabacho Station (Sakae area, ground and second floors)',
   'zh': '矢场町站即到（荣地区・1楼与2楼）',
   'tw': '矢場町站即到（榮地區・1樓與2樓）',
   'ko': '야바초역에서 바로(사카에 지역·1층과 2층)'},
 '西鉄天神駅から徒歩5分（大名）': {
   'en': '5 min walk from Nishitetsu Tenjin Station (Daimyo)',
   'zh': '从西铁天神站步行5分钟（大名）', 'tw': '從西鐵天神站步行5分鐘（大名）',
   'ko': '니시테쓰 텐진역에서 도보 5분(다이묘)'},
 '鶴田駅から徒歩6分（お車での来店もしやすい立地）': {
   'en': '6 min walk from Tsuruta Station (easy to visit by car as well)',
   'zh': '从鹤田站步行6分钟（开车前来也很方便）',
   'tw': '從鶴田站步行6分鐘（開車前來也很方便）',
   'ko': '쓰루타역에서 도보 6분(차로 오시기에도 편한 위치입니다)'},
}

# ── フッタ・導線の定型
UI = {
 'bp.ui.brands':    ('取扱ブランド', {'en': 'Brands we carry', 'zh': '在售品牌', 'tw': '在售品牌', 'ko': '취급 브랜드'}),
 'bp.ui.senyo':     ('美容室専売品とは', {'en': 'What salon-exclusive means', 'zh': '什么是美容院专售品', 'tw': '什麼是美容院專售品', 'ko': '미용실 전용 제품이란'}),
 'bp.ui.shoponly':  ('販売のみのご来店', {'en': 'Visiting just to shop', 'zh': '仅购物的到店', 'tw': '僅購物的到店', 'ko': '구매만을 위한 방문'}),
 'bp.ui.memberShop':('会員制のネットショップ', {'en': 'Members-only online shop', 'zh': '会员制网店', 'tw': '會員制網店', 'ko': '회원제 온라인 숍'}),
 'bp.ui.memberShop2':('会員制ネットショップ', {'en': 'Members-only online shop', 'zh': '会员制网店', 'tw': '會員制網店', 'ko': '회원제 온라인 숍'}),
 'bp.ui.allStores': ('全国の店舗一覧', {'en': 'All stores', 'zh': '全国门店一览', 'tw': '全國門市一覽', 'ko': '전국 매장 목록'}),
 'bp.ui.privacy':   ('プライバシーポリシー', {'en': 'Privacy Policy', 'zh': '隐私政策', 'tw': '隱私政策', 'ko': '개인정보 처리방침'}),
 'bp.ui.tokusho':   ('特定商取引法に基づく表記', {'en': 'Legal notice under the Specified Commercial Transactions Act', 'zh': '基于特定商业交易法的标示', 'tw': '基於特定商業交易法的標示', 'ko': '특정상거래법에 근거한 표기'}),
 'bp.ui.shopNote':  ('販売のみ・ネットショップでのご購入について', {'en': 'Shopping only, and buying on the online shop', 'zh': '关于仅购物与在网店购买', 'tw': '關於僅購物與在網店購買', 'ko': '구매만 하실 때와 온라인 숍 구매에 대하여'}),
 'bp.ui.hairsalon': ('ヘアサロン', {'en': 'Hair salon', 'zh': '美发沙龙', 'tw': '美髮沙龍', 'ko': '헤어살롱'}),
 'bp.ui.official':  ('メーカー公認 正規取扱店（正規ルート品のみ）', {'en': 'Manufacturer-authorized retailer (genuine supply route only)', 'zh': '厂商公认 正规代理店（仅正规渠道商品）', 'tw': '廠商公認 正規代理店（僅正規通路商品）', 'ko': '제조사 공인 정규 취급점(정규 유통 상품만)'}),
 'bp.ui.where':     ('全国7店舗の店頭 ＋ 会員制オンラインショップ（ご登録は店頭のみ）', {'en': 'All 7 stores, plus the members-only online shop (sign-up in store only)', 'zh': '全国7家门店 ＋ 会员制网店（仅可在店内注册）', 'tw': '全國7家門市 ＋ 會員制網店（僅可在店內註冊）', 'ko': '전국 7개 매장 + 회원제 온라인 숍(가입은 매장에서만)'}),
 'bp.ui.maker':     ('メーカー', {'en': 'Manufacturer', 'zh': '厂商', 'tw': '廠商', 'ko': '제조사'}),
 'bp.ui.home':      ('ホーム', {'en': 'Home', 'zh': '首页', 'tw': '首頁', 'ko': '홈'}),
}
# 「{都市}の取扱店」
CITY = {'東京': {'en': 'Tokyo', 'zh': '东京', 'tw': '東京', 'ko': '도쿄'}}
STOCKIST = {'en': 'Stockists in {c}', 'zh': '{c}的在售门店', 'tw': '{c}的在售門市', 'ko': '{c}의 취급점'}
# 「{ブランド}取扱店」— ブランド名は backHub から取る
HUB_SUFFIX = {'ja': ' 正規取扱店トップ', 'en': ' authorized retailers',
              'zh': ' 正规代理店首页', 'tw': ' 正規代理店首頁', 'ko': ' 정규 취급점 톱'}
SHOP_OF = {'en': '{b} authorized retailer', 'zh': '{b} 正规代理店',
           'tw': '{b} 正規代理店', 'ko': '{b} 정규 취급점'}

def is_brand_page(f):
    if f.startswith(('salon-', 'headspa-', 'store-', 'recruit-')):
        return False
    t = open(f, encoding='utf-8').read()
    if 'window.SEAM_PAGE_I18N' not in t:
        return False
    # 地域ページは bp.backHub、ブランドのハブは bp.buyin.* / bp.hubA1 を持つ
    return ('bp.backHub' in t) or ('bp.buyin.' in t) or ('bp.hubA1' in t)



# ── ブランドのハブページに残っていたもの
HUB_UI = {
 'bp.ui.senyo2': ('サロン専売品とは', {'en': 'What salon-exclusive means', 'zh': '什么是沙龙专售品', 'tw': '什麼是沙龍專售品', 'ko': '살롱 전용 제품이란'}),
 'bp.ui.seamStores': ('SEAMの店舗', {'en': 'SEAM stores', 'zh': 'SEAM的门店', 'tw': 'SEAM的門市', 'ko': 'SEAM 매장'}),
 'bp.ui.hubWhere': ('SEAMの全国7店舗(銀座・表参道・札幌・大阪・名古屋・福岡・宇都宮)でお取り扱いしています 在庫状況は店舗・時期により異なるため 確実にお求めの場合は店舗へお問い合わせください',
   {'en': 'Available at all seven SEAM stores (Ginza, Omotesando, Sapporo, Osaka, Nagoya, Fukuoka and Utsunomiya). Stock varies by store and season, so please contact the store if you want to be sure.',
    'zh': '在SEAM全国7家门店（银座・表参道・札幌・大阪・名古屋・福冈・宇都宫）均有在售。库存因门店与时期而异，如需确保购得请先与门店联系。',
    'tw': '在SEAM全國7家門市（銀座・表參道・札幌・大阪・名古屋・福岡・宇都宮）皆有在售。庫存因門市與時期而異，如需確保購得請先與門市聯繫。',
    'ko': 'SEAM 전국 7개 매장(긴자·오모테산도·삿포로·오사카·나고야·후쿠오카·우쓰노미야)에서 취급하고 있습니다. 재고는 매장과 시기에 따라 다르므로 확실히 구매하시려면 매장으로 문의해 주세요.'}),
 'bp.ui.hubOnline': ('SEAMの会員制オンラインショップでお求めいただけます ご登録は店頭のみのご案内です フリマや非正規の出品は真贋や保管状態が分からないため 正規の取扱店をおすすめします',
   {'en': "You can buy it at SEAM's members-only online shop. Sign-up is handled in store only. On flea-market apps and unauthorized listings there is no way to tell whether an item is genuine or how it was stored, so we recommend an authorized retailer.",
    'zh': '可在SEAM的会员制网店购买。注册仅在店内办理。二手平台与非正规卖家的商品无法确认真伪与保管状态，建议您选择正规代理店。',
    'tw': '可在SEAM的會員制網店購買。註冊僅在店內辦理。二手平台與非正規賣家的商品無法確認真偽與保管狀態，建議您選擇正規代理店。',
    'ko': 'SEAM 회원제 온라인 숍에서 구매하실 수 있습니다. 가입은 매장에서만 안내드립니다. 중고 거래나 비정규 판매 상품은 진위와 보관 상태를 알 수 없으므로 정규 취급점을 권해 드립니다.'}),
}
# 「{N}点(SEAMセレクト掲載分)」— 数はページごとに違うので実数を読んで作る
COUNT = {'en': '{n} items (in the SEAM selection)', 'zh': '{n}件（SEAM精选收录）',
         'tw': '{n}件（SEAM精選收錄）', 'ko': '{n}점(SEAM 셀렉트 게재분)'}
# 「{ブランド} 取扱店」（間に空白が入る書き方）


# ── メーカー名。**推測で現地名を作らない**（間違えると企業名を誤記することになる）。
#   製品パッケージに載っているラテン表記を基本にし、
#   中国語圏でその表記が正だと確かなもの（資生堂）だけ漢字にする。
MAKER = {
 'ミルボン':            {'en': 'Milbon', 'zh': 'Milbon', 'tw': 'Milbon', 'ko': 'Milbon'},
 'ロレアル グループ':      {'en': "L'Oréal Group", 'zh': "L'Oréal 集团", 'tw': "L'Oréal 集團", 'ko': "L'Oréal 그룹"},
 'コンフォートジャパン':     {'en': 'Comfort Japan', 'zh': 'Comfort Japan', 'tw': 'Comfort Japan', 'ko': 'Comfort Japan'},
 'ドクタージュニア':       {'en': 'Doctor Junior', 'zh': 'Doctor Junior', 'tw': 'Doctor Junior', 'ko': 'Doctor Junior'},
 'ホーユー':            {'en': 'Hoyu', 'zh': 'Hoyu', 'tw': 'Hoyu', 'ko': 'Hoyu'},
 '資生堂プロフェッショナル':   {'en': 'Shiseido Professional', 'zh': '资生堂 Professional', 'tw': '資生堂 Professional', 'ko': 'Shiseido Professional'},
 '資生堂':             {'en': 'Shiseido', 'zh': '资生堂', 'tw': '資生堂', 'ko': 'Shiseido'},
 'テクノエイト':         {'en': 'Techno Eight', 'zh': 'Techno Eight', 'tw': 'Techno Eight', 'ko': 'Techno Eight'},
 'ウエラ':             {'en': 'Wella', 'zh': 'Wella', 'tw': 'Wella', 'ko': 'Wella'},
 'ルベル / タカラベルモント': {'en': 'Lebel / Takara Belmont', 'zh': 'Lebel / Takara Belmont', 'tw': 'Lebel / Takara Belmont', 'ko': 'Lebel / Takara Belmont'},
}

pages = sorted(f for f in glob.glob('*.html') if is_brand_page(f))

n_pages = n_keys = n_access = 0
for f in pages:
    s = open(f, encoding='utf-8').read()
    before = s
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not m:
        continue
    try:
        d = json.loads(m.group(2))
    except Exception:
        print(f'  {f:30} 辞書がJSONでない → 飛ばす'); continue
    if set(d) != set(LANGS):
        print(f'  {f:30} 5言語そろっていない → 飛ばす'); continue
    dict_before = json.dumps(d, ensure_ascii=False, sort_keys=True)

    # ① アクセス文（bp.a2 / bp.a3 の中の日本語を差し替え）
    for ja_ac, tr in ACCESS.items():
        if ja_ac not in d['ja'].get('bp.a2', '') and ja_ac not in d['ja'].get('bp.a3', ''):
            continue
        for L in ('en', 'zh', 'tw', 'ko'):
            for k in ('bp.a2', 'bp.a3'):
                if k in d[L] and ja_ac in d[L][k]:
                    d[L][k] = d[L][k].replace(ja_ac, tr[L]); n_access += 1

    # ② ブランド名（backHub から言語ごとに取り出す）
    brand = {}
    for L in LANGS:
        v = d[L].get('bp.backHub', '')
        v = re.sub(r'^[←\s]*', '', v)
        if v.endswith(HUB_SUFFIX[L]):
            v = v[:-len(HUB_SUFFIX[L])]
        brand[L] = v.strip()

    # ③ HTML に data-i18n を付け、辞書へキーを足す
    add = {}
    def tag(ja_text, key, vals):
        """<x ...>ja_text</x> に data-i18n を付ける。既に付いていれば触らない"""
        global s
        pat = re.compile(r'(<([a-z]+)\b(?![^>]*data-i18n=)[^>]*?)(>)' + re.escape(ja_text) + r'(</\2>)')
        if not pat.search(s):
            return
        s = pat.sub(lambda mo: mo.group(1) + f' data-i18n="{key}"' + mo.group(3) + ja_text + mo.group(4), s)
        add[key] = {'ja': ja_text, **vals}

    for key, (ja_text, vals) in list(UI.items()) + list(HUB_UI.items()):
        tag(ja_text, key, vals)
    # メーカー名（見出し「メーカー」の隣の値）
    for ja_maker, mv in MAKER.items():
        pat = re.compile(r'(>メーカー</div>\s*<div\b(?![^>]*data-i18n=)[^>]*?)(>)' + re.escape(ja_maker) + r'(</div>)')
        if pat.search(s):
            s = pat.sub(lambda mo: mo.group(1) + ' data-i18n="bp.ui.makerName"' + mo.group(2) + ja_maker + mo.group(3), s)
            add['bp.ui.makerName'] = {'ja': ja_maker, **mv}

    # 掲載点数（ページごとに数が違う）
    mc = re.search(r'>(\d+)点\(SEAMセレクト掲載分\)<', s)
    if mc:
        n_items = mc.group(1)
        tag(f'{n_items}点(SEAMセレクト掲載分)', 'bp.ui.itemCount',
            {L: COUNT[L].format(n=n_items) for L in ('en', 'zh', 'tw', 'ko')})
    for city_ja, cv in CITY.items():
        tag(city_ja + 'の取扱店', 'bp.ui.stockists',
            {L: STOCKIST[L].format(c=cv[L]) for L in ('en', 'zh', 'tw', 'ko')})
    for other in re.findall(r'>([ぁ-んァ-ヶー一-龯]{2,12}) 取扱店</a>', s):
        tag(other + ' 取扱店', 'bp.ui.shopOf.' + re.sub(r'\W', '', other),
            {L: SHOP_OF[L].format(b=other) for L in ('en', 'zh', 'tw', 'ko')})
    if brand['ja']:
        tag(brand['ja'] + '取扱店', 'bp.ui.shopOf',
            {L: SHOP_OF[L].format(b=brand[L]) for L in ('en', 'zh', 'tw', 'ko')})

    # 見出し「アクセス」の隣の値。ここが画面に見えるアクセス行で、訳が無かった
    for ja_ac, tr in ACCESS.items():
        pat = re.compile(r'(data-i18n="bp\.access">アクセス</div>\s*<div\b(?![^>]*data-i18n=)[^>]*?)(>)'
                         + re.escape(ja_ac) + r'(</div>)')
        if pat.search(s):
            s = pat.sub(lambda mo: mo.group(1) + ' data-i18n="bp.accessLine"' + mo.group(2) + ja_ac + mo.group(3), s)
            add['bp.accessLine'] = {'ja': ja_ac, **tr}

    for k, v in add.items():
        for L in LANGS:
            d[L].setdefault(k, v[L])

    dict_after = json.dumps(d, ensure_ascii=False, sort_keys=True)
    if dict_after != dict_before:
        # 【罠】HTML側に data-i18n を挿したぶん位置がずれている。
        #   最初に取った m の start/end で切ると辞書がHTMLの途中へ刺さって
        #   ページが壊れる（2026-08-17に112枚を壊した）。必ず取り直す
        m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if not m2:
            print(f'  {f:30} ★ 差し込み直前に辞書を見失った → 書き戻さない'); continue
        s = s[:m2.start()] + m2.group(1) + dict_after + m2.group(3) + s[m2.end():]
    if s == before:
        continue
    # 既存キーが消えていないか
    if not set(json.loads(dict_before)['ja']) <= set(d['ja']):
        print(f'  {f:30} ★ 既存キーが消えた → 書き戻さない'); continue
    # 構造が壊れていないか（辞書が script の中にあるか・末尾が残っているか）
    i = s.find('window.SEAM_PAGE_I18N')
    in_script = s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)
    if not in_script or '</body>' not in s or s.count('<footer') != before.count('<footer'):
        print(f'  {f:30} ★ 構造が壊れた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    n_pages += 1; n_keys += len(add)

print(f'  {n_pages}枚 / data-i18n {n_keys}件 / アクセス文 {n_access}箇所')

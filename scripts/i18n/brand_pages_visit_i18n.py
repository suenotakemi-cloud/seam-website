# SEAM: ブランドページ「{都市}での立ち寄り方」の未訳段落を5言語に（2026-08-17）
#
# 【なぜ】福岡・表参道・札幌は bp.para1/2/3 として訳済みだったのに、
#   銀座の3段落目と、名古屋・大阪・宇都宮の3段落すべてが素の <p> のままだった。
#   海外から来た人が「その街で どう立ち寄れるか」を読む場所なので、
#   ここが日本語だと店まで来る判断ができない。
#
# 対象は data-i18n="bp.visit" の見出しの直後にある <p> だけ。
# 段落の位置で bp.visitP1 / P2 / P3 を振る（1ページに1エリアなので衝突しない）。
# 冪等。既に data-i18n が付いている段落は触らない。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

T = {
 # 銀座 3段落目
 '施術もご予約もいりません。銀座での買い物や会食のついでに サロン専売ヘアケアだけを&quot;買うだけ&quot;で選べます。会員価格で続けたい方は 店頭でそのままメンバー登録も可能です。': {
  'en': 'No treatment, no booking. While you are in Ginza to shop or dine, you can simply come and buy salon-exclusive hair care. If you would like to keep buying at member prices, you can sign up on the spot in store.',
  'zh': '无需施术，也无需预约。在银座购物或聚餐的顺路，就能只买沙龙专售护发品。想以会员价长期购买的顾客，可直接在店内完成注册。',
  'tw': '無需施術，也無需預約。在銀座購物或聚餐的順路，就能只買沙龍專售護髮品。想以會員價長期購買的顧客，可直接在店內完成註冊。',
  'ko': '시술도 예약도 필요 없습니다. 긴자에서 쇼핑이나 식사를 하시는 김에 살롱 전용 헤어케어만 사러 오실 수 있습니다. 회원가로 계속 구매하고 싶으신 분은 매장에서 바로 회원 등록도 가능합니다.'},
 # 名古屋
 '栄は パルコや松坂屋が集まる名古屋随一の商業地です。矢場町駅からすぐの通り沿いに SEAMは1階と2階のフロアで構えています。': {
  'en': "Sakae, home to Parco and Matsuzakaya, is Nagoya's foremost shopping district. SEAM stands on the street right by Yabacho Station, across the ground and second floors.",
  'zh': '荣汇聚PARCO与松坂屋，是名古屋首屈一指的商业区。SEAM就在矢场町站旁的街道上，占据1楼与2楼。',
  'tw': '榮匯聚PARCO與松坂屋，是名古屋首屈一指的商業區。SEAM就在矢場町站旁的街道上，佔據1樓與2樓。',
  'ko': '사카에는 파르코와 마쓰자카야가 모인 나고야 제일의 상업지입니다. 야바초역 바로 앞 길가에 SEAM이 1층과 2층에 자리하고 있습니다.'},
 '栄での買い物の帰りに そのまま立ち寄れる動線の良さが特長です。': {
  'en': 'It is easy to fold into your route home after shopping in Sakae.',
  'zh': '在荣购物后回程即可顺道前来，动线便利是其特点。',
  'tw': '在榮購物後回程即可順道前來，動線便利是其特點。',
  'ko': '사카에에서 쇼핑을 마치고 돌아가는 길에 그대로 들를 수 있는 동선의 편리함이 특징입니다.'},
 '実際に手に取りながら サロン専売ヘアケアを選べます。施術は不要で お買い物だけのご来店も歓迎。会員価格で続けたい方は店頭で登録できます。': {
  'en': 'Pick up the bottles and choose salon-exclusive hair care for yourself. No treatment required, and you are welcome to come just to shop. If you would like member prices, you can sign up in store.',
  'zh': '可实际拿在手中挑选沙龙专售护发品。无需施术，只为购物到店也很欢迎。想以会员价购买的顾客可在店内注册。',
  'tw': '可實際拿在手中挑選沙龍專售護髮品。無需施術，只為購物到店也很歡迎。想以會員價購買的顧客可在店內註冊。',
  'ko': '직접 손에 들어 보며 살롱 전용 헤어케어를 고르실 수 있습니다. 시술은 필요 없고 구매만을 위한 방문도 환영합니다. 회원가로 이용하고 싶으신 분은 매장에서 등록하실 수 있습니다.'},
 # 大阪
 '南堀江は セレクトショップやカフェが並ぶ大阪・ミナミのおしゃれエリアです。アメリカ村や心斎橋・なんばからも歩ける距離にあります。': {
  'en': "Minami-Horie, lined with select shops and cafés, is the stylish corner of Osaka's Minami. It is within walking distance of Amerikamura, Shinsaibashi and Namba.",
  'zh': '南堀江买手店与咖啡馆林立，是大阪南区时尚的一带。距美国村、心斋桥与难波都在步行范围内。',
  'tw': '南堀江買手店與咖啡館林立，是大阪南區時尚的一帶。距美國村、心齋橋與難波都在步行範圍內。',
  'ko': '미나미호리에는 셀렉트숍과 카페가 늘어선 오사카 미나미의 세련된 지역입니다. 아메리카무라와 신사이바시·난바에서도 걸어올 수 있는 거리에 있습니다.'},
 'SEAMは四ツ橋駅 6番出口から徒歩2分。堀江での買い物やカフェめぐりの合間に立ち寄りやすい立地です。': {
  'en': 'SEAM is a 2-minute walk from Exit 6 of Yotsubashi Station, easy to visit between shopping and café stops in Horie.',
  'zh': 'SEAM距四桥站6号出口步行2分钟，在堀江购物或逛咖啡馆的间隙很容易顺道前来。',
  'tw': 'SEAM距四橋站6號出口步行2分鐘，在堀江購物或逛咖啡館的間隙很容易順道前來。',
  'ko': 'SEAM은 요쓰바시역 6번 출구에서 도보 2분, 호리에에서 쇼핑이나 카페 투어를 하시는 사이에 들르기 좋은 위치입니다.'},
 '施術・予約は不要。ホームケアをまとめて揃えたいときも サロン専売品だけを&quot;買うだけ&quot;で選べます。会員登録は店頭でご案内しています。': {
  'en': 'No treatment or booking required. Even when you want to restock your whole home-care routine, you can simply come and buy salon-exclusive products. Membership sign-up is handled in store.',
  'zh': '无需施术与预约。想一次备齐居家护理时，也能只买沙龙专售商品。会员注册在店内为您办理。',
  'tw': '無需施術與預約。想一次備齊居家護理時，也能只買沙龍專售商品。會員註冊在店內為您辦理。',
  'ko': '시술과 예약은 필요 없습니다. 홈케어를 한 번에 갖추고 싶으실 때도 살롱 전용 제품만 사러 오실 수 있습니다. 회원 등록은 매장에서 안내해 드립니다.'},
 # 宇都宮
 'SEAMの宇都宮店は 市内・鶴田エリアにあります。ロードサイドで駐車もしやすく お車での立ち寄りに向いた立地です。': {
  'en': 'SEAM Utsunomiya is in the Tsuruta area of the city. It sits on a roadside with easy parking, suited to visiting by car.',
  'zh': 'SEAM宇都宫店位于市内鹤田一带。临路且停车方便，适合开车前来。',
  'tw': 'SEAM宇都宮店位於市內鶴田一帶。臨路且停車方便，適合開車前來。',
  'ko': 'SEAM 우쓰노미야점은 시내 쓰루타 지역에 있습니다. 도로변에 있어 주차도 쉬워 차로 들르시기에 좋은 위치입니다.'},
 'JR鶴田駅からは徒歩6分。日々の買い物やお出かけの動線に組み込みやすい場所です。': {
  'en': 'It is a 6-minute walk from JR Tsuruta Station, easy to work into everyday shopping and errands.',
  'zh': '距JR鹤田站步行6分钟，很容易融入日常购物与外出的动线。',
  'tw': '距JR鶴田站步行6分鐘，很容易融入日常購物與外出的動線。',
  'ko': 'JR 쓰루타역에서 도보 6분, 일상적인 쇼핑이나 외출 동선에 넣기 좋은 곳입니다.'},
 'シャンプー・トリートメントの買い足しから 大容量サイズまで。施術なしで サロン専売ヘアケアだけを&quot;買うだけ&quot;で選べます。': {
  'en': 'From topping up shampoo and treatment to the large refill sizes. Without any treatment, you can simply come and buy salon-exclusive hair care.',
  'zh': '从补买洗发水、护发素到大容量规格。无需施术，也能只买沙龙专售护发品。',
  'tw': '從補買洗髮精、護髮素到大容量規格。無需施術，也能只買沙龍專售護髮品。',
  'ko': '샴푸·트리트먼트 보충부터 대용량 사이즈까지. 시술 없이 살롱 전용 헤어케어만 사러 오실 수 있습니다.'},
}

SEC = re.compile(r'(data-i18n="bp\.visit">[^<]*</h2>)((?:\s*<p[^>]*>[^<]*</p>){1,4})')
n_pages = n_tag = 0
for f in sorted(glob.glob('*.html')):
    s = open(f, encoding='utf-8').read()
    before = s
    m = SEC.search(s)
    if not m:
        continue
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

    # 【罠】番号は段落の位置で決めているので今は安定しているが、訳表を足したときに
    #   「付いていたら飛ばす」が効いて番号がずれる余地を残さないため、
    #   faq / desc と同じく **毎回いったん外してから振り直す**（2026-08-17のP1と同種）
    s = re.sub(r'\s+data-i18n="bp\.visitP\d+"', '', s)
    for L in LANGS:
        for k in [k for k in d[L] if re.fullmatch(r'bp\.visitP\d+', k)]:
            del d[L][k]
    m = SEC.search(s)
    if not m:
        continue

    block = m.group(2)
    out, idx, added = [], 0, 0
    for pm in re.finditer(r'(<p)([^>]*)(>)([^<]*)(</p>)', block):
        idx += 1
        attrs, txt = pm.group(2), pm.group(4)
        if 'data-i18n' in attrs or txt.strip() not in T:
            out.append(pm.group(0)); continue
        key = f'bp.visitP{idx}'
        out.append(pm.group(1) + attrs + f' data-i18n="{key}"' + pm.group(3) + txt + pm.group(5))
        vals = T[txt.strip()]
        for L in LANGS:
            d[L][key] = txt.strip() if L == 'ja' else vals[L]
        added += 1
    if not added and s == before:
        continue
    # 段落以外（空白）を保ったまま組み直す
    new_block = block
    for old_p, new_p in zip(re.findall(r'<p[^>]*>[^<]*</p>', block), out):
        new_block = new_block.replace(old_p, new_p, 1)
    s = s[:m.start(2)] + new_block + s[m.end(2):]

    dict_after = json.dumps(d, ensure_ascii=False, sort_keys=True)
    if dict_after != dict_before:
        # 【罠】<p> を書き換えたぶん位置がずれる。辞書の位置は取り直す
        dm2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if not dm2:
            print(f'  {f:30} ★ 辞書を見失った → 書き戻さない'); continue
        s = s[:dm2.start()] + dm2.group(1) + dict_after + dm2.group(3) + s[dm2.end():]


    # 【書込み前の検査】同じキーに違う本文が割り当てられていないか。
    #   採番のずれはこれでしか捕まらない（「未訳0件」でも構文パースでも通ってしまう）
    seen = {}
    dup = []
    for mm in re.finditer(r'data-i18n="([^"]+)"[^>]*>([^<]{1,240})<', s):
        k, t = mm.group(1), mm.group(2).strip()
        if k in seen and seen[k] != t:
            dup.append((k, seen[k][:24], t[:24]))
        seen.setdefault(k, t)
    if dup:
        print(f'  {f:30} ★ 同じキーに違う本文 {dup[:2]} → 書き戻さない'); continue

    i = s.find('window.SEAM_PAGE_I18N')
    if not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)) or '</body>' not in s:
        print(f'  {f:30} ★ 構造が壊れた → 書き戻さない'); continue
    # bp.visitP* は毎回振り直すので比較から外す
    def other(keys):
        return {k for k in keys if not re.fullmatch(r'bp\.visitP\d+', k)}
    if not other(json.loads(dict_before)['ja']) <= other(d['ja']):
        print(f'  {f:30} ★ 既存キーが消えた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    n_pages += 1; n_tag += added

print(f'  {n_pages}枚 / 段落 {n_tag}件')

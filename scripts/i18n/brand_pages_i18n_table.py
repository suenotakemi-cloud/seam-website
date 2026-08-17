# SEAM: ブランド×エリアページの翻訳表（2026-08-14）
#
# 【なぜ要るか】オーナー「TOKIOがアジアで人気・台湾語中国語で福岡/大阪/名古屋/銀座/表参道で一番に」
#   実測でブランド関連107枚のうち **96枚が日本語のみ**（辞書もdata-i18nもhreflangも無い）。
#   銀座・表参道は `{brand}-tokyo` が多言語なので TOKIO インカラミ銀座で2位を取れているが、
#   福岡・大阪・名古屋にはその仕組みが無い。
#
# 【訳すもの / 訳さないもの】
#   訳す  : 見出し・FAQ・UI・エリア紹介・パンくず
#   訳さない: 商品名・価格・住所・ブランド公式表記
#     → 商品名と価格は各国のお客様にもそのまま必要な情報で、
#       住所は現地で見せる用途があるので日本語のまま残すほうが役に立つ。
#
# プレースホルダ {B}=ブランド名 {C}=地名 {S}=店名(SEAM GINZA等・翻訳しない)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

# ── ブランド名（既存の {brand}-tokyo 辞書から抽出した実績値。勝手に作らない）
BRAND = {
 'aujua':                 {'ja': 'オージュア', 'en': 'Aujua', 'zh': 'Aujua', 'tw': 'Aujua', 'ko': 'Aujua'},
 'kerastase':             {'ja': 'ケラスターゼ', 'en': 'Kérastase', 'zh': 'Kérastase', 'tw': 'Kérastase', 'ko': 'Kérastase'},
 'tokio':                 {'ja': 'トキオ インカラミ', 'en': 'TOKIO IE', 'zh': 'TOKIO IE', 'tw': 'TOKIO IE', 'ko': 'TOKIO IE'},
 'bykarte':               {'ja': 'バイカルテ', 'en': 'BYKARTE', 'zh': 'BYKARTE', 'tw': 'BYKARTE', 'ko': 'BYKARTE'},
 'shu-uemura':            {'ja': 'シュウ ウエムラ', 'en': 'shu uemura', 'zh': 'shu uemura', 'tw': 'shu uemura', 'ko': 'shu uemura'},
 'lashaddict':            {'ja': 'ラッシュアディクト', 'en': 'LASHADDICT', 'zh': 'LASHADDICT', 'tw': 'LASHADDICT', 'ko': 'LASHADDICT'},
 'sublimic':              {'ja': 'サブリミック', 'en': 'SUBLIMIC', 'zh': 'SUBLIMIC', 'tw': 'SUBLIMIC', 'ko': 'SUBLIMIC'},
 'shiseido-professional': {'ja': '資生堂プロフェッショナル', 'en': 'Shiseido Professional', 'zh': 'Shiseido Professional', 'tw': 'Shiseido Professional', 'ko': 'Shiseido Professional'},
 'tsururincho':           {'ja': 'つるりんちょ。', 'en': 'Tsururincho', 'zh': 'Tsururincho', 'tw': 'Tsururincho', 'ko': 'Tsururincho'},
 'system-professional':   {'ja': 'システムプロフェッショナル', 'en': 'System Professional', 'zh': 'System Professional', 'tw': 'System Professional', 'ko': 'System Professional'},
 'milbon':                {'ja': 'ミルボン', 'en': 'Milbon', 'zh': 'Milbon', 'tw': 'Milbon', 'ko': 'Milbon'},
 'elujuda':               {'ja': 'エルジューダ', 'en': 'Elujuda', 'zh': 'Elujuda', 'tw': 'Elujuda', 'ko': 'Elujuda'},
 # 2026-08-14 追加。ブランド名はローマ字表記が国際的に通じるので各言語とも同じ
 'davines':               {'ja': 'ダヴィネス', 'en': 'Davines', 'zh': 'Davines', 'tw': 'Davines', 'ko': 'Davines'},
 'oggi-otto':             {'ja': 'オッジオット', 'en': 'Oggi otto', 'zh': 'Oggi otto', 'tw': 'Oggi otto', 'ko': 'Oggi otto'},
 'seesaw':                {'ja': 'SEE/SAW', 'en': 'SEE/SAW', 'zh': 'SEE/SAW', 'tw': 'SEE/SAW', 'ko': 'SEE/SAW'},
}

# ── 地名（store-*.html の既存辞書から取った実績値）
CITY = {
 'ginza':      {'ja': '銀座', 'en': 'Ginza', 'zh': '银座', 'tw': '銀座', 'ko': '긴자'},
 'omotesando': {'ja': '表参道', 'en': 'Omotesando', 'zh': '表参道', 'tw': '表參道', 'ko': '오모테산도'},
 'sapporo':    {'ja': '札幌', 'en': 'Sapporo', 'zh': '札幌', 'tw': '札幌', 'ko': '삿포로'},
 'osaka':      {'ja': '大阪', 'en': 'Osaka', 'zh': '大阪', 'tw': '大阪', 'ko': '오사카'},
 'nagoya':     {'ja': '名古屋', 'en': 'Nagoya', 'zh': '名古屋', 'tw': '名古屋', 'ko': '나고야'},
 'fukuoka':    {'ja': '福岡', 'en': 'Fukuoka', 'zh': '福冈', 'tw': '福岡', 'ko': '후쿠오카'},
 'utsunomiya': {'ja': '宇都宮', 'en': 'Utsunomiya', 'zh': '宇都宫', 'tw': '宇都宮', 'ko': '우쓰노미야'},
}

# ── 共通のUI・見出し・FAQ。{B}=ブランド {C}=地名 {S}=店名
T = {
 'bp.storeInfo': {
   'ja': '店舗のご案内', 'en': 'Store information', 'zh': '门店信息', 'tw': '門市資訊', 'ko': '매장 안내'},
 'bp.igLink': {
   'ja': '店舗アカウントを見る ↗', 'en': 'See the store account ↗', 'zh': '查看门店账号 ↗',
   'tw': '查看門市帳號 ↗', 'ko': '매장 계정 보기 ↗'},
 'bp.igNote': {
   'ja': '(在庫のお問い合わせもこちらへ)', 'en': '(Stock enquiries here too)', 'zh': '（库存咨询也请由此）',
   'tw': '（庫存諮詢也請由此）', 'ko': '(재고 문의도 이곳으로)'},
 'bp.storePage': {
   'ja': '店舗ページ(アクセス・写真) →', 'en': 'Store page (access, photos) →', 'zh': '门店页面（交通・照片）→',
   'tw': '門市頁面（交通・照片）→', 'ko': '매장 페이지 (오시는 길·사진) →'},
 'bp.visit': {
   'ja': '{C}での立ち寄り方', 'en': 'Dropping in while you are in {C}', 'zh': '在{C}顺路前来的方式',
   'tw': '在{C}順路前來的方式', 'ko': '{C}에서 들르는 방법'},
 'bp.lineup': {
   'ja': 'この店舗で出会える {B}', 'en': '{B} you can find at this store', 'zh': '本店可遇见的{B}',
   'tw': '本店可遇見的{B}', 'ko': '이 매장에서 만날 수 있는 {B}'},
 'bp.items': {
   'ja': '取扱アイテムと ひとこと詳細', 'en': 'Items we carry, with a note on each', 'zh': '在售商品与简要说明',
   'tw': '在售商品與簡要說明', 'ko': '취급 상품과 한마디 설명'},
 'bp.itemsNote': {
   'ja': '価格・仕様は変わる場合があります　このほかの{B}も店頭に揃っています',
   'en': 'Prices and specifications may change. Other {B} items are also in store.',
   'zh': '价格与规格可能变更　其他{B}商品也在门店备有。',
   'tw': '價格與規格可能變更　其他{B}商品也在門市備有。',
   'ko': '가격과 사양은 변경될 수 있습니다　이 외의 {B} 제품도 매장에 갖추고 있습니다.'},
 'bp.twoWays': {
   'ja': '買い方は 2とおり', 'en': 'Two ways to buy', 'zh': '两种购买方式', 'tw': '兩種購買方式', 'ko': '구매 방법은 두 가지'},
 'bp.inStoreCta': {
   'ja': '{S}の店頭で選ぶ →', 'en': 'Choose in store at {S} →', 'zh': '在{S}门店挑选 →',
   'tw': '在{S}門市挑選 →', 'ko': '{S} 매장에서 고르기 →'},
 'bp.inStoreNote': {
   'ja': 'どなたでも購入OK ・ 予約不要 ・ {B}を実際に手に取れます',
   'en': 'Anyone can buy · No booking needed · Pick up {B} and see it for yourself',
   'zh': '任何人都可购买 ・ 无需预约 ・ 可实际拿起{B}查看',
   'tw': '任何人都可購買 ・ 無需預約 ・ 可實際拿起{B}查看',
   'ko': '누구나 구매 가능 · 예약 불필요 · {B}를 직접 만져볼 수 있습니다'},
 'bp.membersCta': {
   'ja': '会員制オンラインショップ →', 'en': 'Members-only online shop →', 'zh': '会员制网店 →',
   'tw': '會員制網店 →', 'ko': '회원제 온라인 숍 →'},
 'bp.membersNote': {
   'ja': 'サロン専売品を会員価格で ・ ご登録は店頭のみ',
   'en': 'Salon-exclusive products at member prices · Registration in store only',
   'zh': '以会员价购买沙龙专售品 ・ 仅限门店登记',
   'tw': '以會員價購買沙龍專售品 ・ 僅限門市登記',
   'ko': '살롱 전용 제품을 회원가로 · 등록은 매장에서만'},
 'bp.finderTitle': {
   'ja': '来店前に 合うかどうか知りたい方へ', 'en': 'If you want to know what suits you before you come',
   'zh': '想在到店前先了解是否适合您', 'tw': '想在到店前先了解是否適合您', 'ko': '방문 전에 나에게 맞는지 알고 싶다면'},
 'bp.finderBody': {
   'ja': '無料の髪格診断で 髪質・履歴から あなたに合うアイテムを先にチェックできます',
   'en': 'Our free Hair Finder reads your hair type and history and shows what suits you in advance.',
   'zh': '免费的发质诊断会依据发质与护理史 先为您找出合适的商品。',
   'tw': '免費的髮質診斷會依據髮質與護理史 先為您找出合適的商品。',
   'ko': '무료 모발 진단이 모발 상태와 시술 이력을 보고 맞는 제품을 미리 알려드립니다.'},
 'bp.finderCta': {
   'ja': '無料で髪格診断する', 'en': 'Take the free Hair Finder', 'zh': '免费进行发质诊断',
   'tw': '免費進行髮質診斷', 'ko': '무료로 모발 진단하기'},
 'bp.intentTitle': {
   'ja': '販売のみ・ネットショップでのご購入について',
   'en': 'Retail-only visits and buying from the online shop',
   'zh': '关于只购物到店与网店购买', 'tw': '關於只購物到店與網店購買',
   'ko': '판매만 이용하는 방문과 온라인 숍 구매에 대해'},
 'bp.faq': {
   'ja': 'よくある質問', 'en': 'Frequently asked questions', 'zh': '常见问题', 'tw': '常見問題', 'ko': '자주 묻는 질문'},
 'bp.q1': {
   'ja': '{C}で{B}を買うだけの来店はできますか',
   'en': 'Can I visit just to buy {B} in {C}?',
   'zh': '可以只为购买{B}而到{C}的门店吗',
   'tw': '可以只為購買{B}而到{C}的門市嗎',
   'ko': '{C}에서 {B}만 구매하러 방문해도 되나요'},
 'bp.a1': {
   'ja': 'はい {S}では施術やご予約がなくても {B}をお買い求めいただけます お買い物だけのご来店を歓迎しています',
   'en': 'Yes. At {S} you can buy {B} without any treatment or booking. Shopping-only visits are welcome.',
   'zh': '可以。在{S}即使不接受护理、不预约 也能购买{B}。欢迎只购物的到访。',
   'tw': '可以。在{S}即使不接受護理、不預約 也能購買{B}。歡迎只購物的到訪。',
   'ko': '네. {S}에서는 시술이나 예약 없이도 {B}를 구매하실 수 있습니다. 쇼핑만을 위한 방문도 환영합니다.'},
 'bp.q2': {
   'ja': '{C}店へのアクセスは', 'en': 'How do I get to the {C} store?', 'zh': '{C}门店的交通方式',
   'tw': '{C}門市的交通方式', 'ko': '{C} 매장까지 가는 방법은'},
 'bp.q3': {
   'ja': '予約は必要ですか', 'en': 'Do I need a booking?', 'zh': '需要预约吗', 'tw': '需要預約嗎', 'ko': '예약이 필요한가요'},
 'bp.q4': {
   'ja': '会員でなくても買えますか', 'en': 'Can I buy without being a member?',
   'zh': '不是会员也能购买吗', 'tw': '不是會員也能購買嗎', 'ko': '회원이 아니어도 구매할 수 있나요'},
 'bp.a4': {
   'ja': '店頭はどなたでもご購入いただけます 会員制はオンラインショップのみで ご登録は店頭でご案内しています',
   'en': 'Anyone can buy in store. Membership applies only to the online shop, and registration is done in store.',
   'zh': '门店任何人都可购买。会员制仅适用于网店 登记在门店办理。',
   'tw': '門市任何人都可購買。會員制僅適用於網店 登記在門市辦理。',
   'ko': '매장에서는 누구나 구매하실 수 있습니다. 회원제는 온라인 숍에만 적용되며 등록은 매장에서 안내합니다.'},
 'bp.q5': {
   'ja': '{B}の在庫はありますか', 'en': 'Do you have {B} in stock?', 'zh': '有{B}的库存吗',
   'tw': '有{B}的庫存嗎', 'ko': '{B} 재고가 있나요'},
 'bp.a5': {
   'ja': '在庫は時期により変わります 確実にお求めの場合は {S}のInstagramや店頭でご確認ください',
   'en': 'Stock changes over time. To be sure, please check with {S} on Instagram or in store.',
   'zh': '库存会随时期变动。如需确认 请通过{S}的Instagram或门店查询。',
   'tw': '庫存會隨時期變動。如需確認 請透過{S}的Instagram或門市查詢。',
   'ko': '재고는 시기에 따라 달라집니다. 확실히 원하시면 {S}의 인스타그램이나 매장에서 확인해 주세요.'},
 'bp.otherAreas': {
   'ja': 'ほかのエリアで探す', 'en': 'Find another area', 'zh': '在其他地区寻找',
   'tw': '在其他地區尋找', 'ko': '다른 지역에서 찾기'},
 'bp.backHub': {
   'ja': '← {B} 正規取扱店トップ', 'en': '← {B} authorized retailers', 'zh': '← {B} 正规代理店首页',
   'tw': '← {B} 正規代理店首頁', 'ko': '← {B} 정규 취급점 톱'},
 'bp.storeName': {'ja': '店名', 'en': 'Store', 'zh': '店名', 'tw': '店名', 'ko': '매장명'},
 'bp.address':   {'ja': '住所', 'en': 'Address', 'zh': '地址', 'tw': '地址', 'ko': '주소'},
 'bp.access':    {'ja': 'アクセス', 'en': 'Access', 'zh': '交通', 'tw': '交通', 'ko': '오시는 길'},
 'bp.detail':    {'ja': 'くわしく', 'en': 'Details', 'zh': '详情', 'tw': '詳情', 'ko': '자세히'},
 'bp.buyOnly':   {'ja': 'Buy Only ・ Walk-in Welcome', 'en': 'Buy Only · Walk-in Welcome',
                  'zh': 'Buy Only · Walk-in Welcome', 'tw': 'Buy Only · Walk-in Welcome',
                  'ko': 'Buy Only · Walk-in Welcome'},
 'bp.noBooking': {'ja': '施術もご予約もいりません', 'en': 'No treatment and no booking needed',
                  'zh': '无需护理 也无需预约', 'tw': '無需護理 也無需預約', 'ko': '시술도 예약도 필요 없습니다'},
 'bp.welcome':   {'ja': 'お買い物だけのご来店を歓迎しています', 'en': 'Shopping-only visits are welcome',
                  'zh': '欢迎只购物的到访', 'tw': '歡迎只購物的到訪', 'ko': '쇼핑만을 위한 방문도 환영합니다'},
}

# ── エリア紹介の3段落（生成器の AREA_INFO と同じ文を訳したもの）
AREA_PARAS = {
 'ginza': [
  {'ja': '銀座は百貨店やラグジュアリーブランドが集まる 日本を代表する商業地です。美容室やコスメの路面店も多く ヘアケアを見比べながら選びたい方に向いた街です。',
   'en': 'Ginza is one of Japan\'s foremost shopping districts, lined with department stores and luxury brands. With many salons and cosmetics shops at street level, it suits anyone who likes to compare hair care before choosing.',
   'zh': '银座是汇集百货店与奢侈品牌的日本代表性商业区。街边的美发沙龙与美妆店众多，适合想比较后再挑选护发品的人。',
   'tw': '銀座是匯集百貨公司與精品品牌的日本代表性商業區。街邊的美髮沙龍與美妝店眾多，適合想比較後再挑選護髮品的人。',
   'ko': '긴자는 백화점과 럭셔리 브랜드가 모인 일본을 대표하는 상업지구입니다. 거리에 미용실과 코스메 매장이 많아, 헤어케어를 비교하며 고르고 싶은 분께 어울리는 거리입니다.'},
  {'ja': 'SEAM GINZAは銀座一丁目駅 7番出口から徒歩1分。銀座駅・京橋駅からも歩け 松屋や銀座三越といった百貨店エリアからも近い立地です。',
   'en': 'SEAM GINZA is one minute from Ginza-itchome Station, Exit 7. It is also walkable from Ginza and Kyobashi Stations, and close to the department stores such as Matsuya and Ginza Mitsukoshi.',
   'zh': 'SEAM GINZA距银座一丁目站7号出口步行1分钟。从银座站、京桥站也可步行前往，邻近松屋、银座三越等百货区。',
   'tw': 'SEAM GINZA距銀座一丁目站7號出口步行1分鐘。從銀座站、京橋站也可步行前往，鄰近松屋、銀座三越等百貨區。',
   'ko': 'SEAM GINZA는 긴자잇초메역 7번 출구에서 도보 1분입니다. 긴자역·교바시역에서도 걸어올 수 있고, 마쓰야와 긴자 미쓰코시 같은 백화점 구역과도 가깝습니다.'},
  {'ja': '施術もご予約もいりません。銀座での買い物や会食のついでに サロン専売ヘアケアだけを"買うだけ"で選べます。会員価格で続けたい方は 店頭でそのままメンバー登録も可能です。',
   'en': 'No treatment and no booking needed. While shopping or dining in Ginza, you can simply buy salon-exclusive hair care. If you would like member prices, you can register in store on the spot.',
   'zh': '无需护理也无需预约。在银座购物或聚餐的途中，也可以只购买沙龙专售护发品。想以会员价长期使用的人，可在门店当场登记。',
   'tw': '無需護理也無需預約。在銀座購物或聚餐的途中，也可以只購買沙龍專售護髮品。想以會員價長期使用的人，可在門市當場登記。',
   'ko': '시술도 예약도 필요 없습니다. 긴자에서 쇼핑이나 식사를 하는 김에 살롱 전용 헤어케어만 구매하실 수 있습니다. 회원가로 계속 쓰고 싶으시면 매장에서 바로 등록도 가능합니다.'},
 ],
 'omotesando': [
  {'ja': '表参道・南青山は ファッションとビューティの発信地です。感度の高いショップが軒を連ね 新しいヘアケアをいち早く手に取れる街として知られています。',
   'en': 'Omotesando and Minami-Aoyama are Tokyo\'s fashion and beauty district. Lined with sharp, well-chosen shops, it is known as the place to find new hair care first.',
   'zh': '表参道・南青山是时尚与美容的发信地。个性店铺林立，以能最早接触新护发品而闻名。',
   'tw': '表參道・南青山是時尚與美容的發信地。個性店鋪林立，以能最早接觸新護髮品而聞名。',
   'ko': '오모테산도·미나미아오야마는 패션과 뷰티의 발신지입니다. 감각적인 숍이 늘어서 있어 새로운 헤어케어를 가장 먼저 만날 수 있는 거리로 알려져 있습니다.'},
  {'ja': 'SEAMは表参道駅 A4出口から徒歩3分 青山通りやキャットストリートにも近い南青山エリアにあります。',
   'en': 'SEAM is three minutes from Omotesando Station, Exit A4, in Minami-Aoyama, close to Aoyama-dori and Cat Street.',
   'zh': 'SEAM距表参道站A4出口步行3分钟，位于邻近青山通与Cat Street的南青山一带。',
   'tw': 'SEAM距表參道站A4出口步行3分鐘，位於鄰近青山通與Cat Street的南青山一帶。',
   'ko': 'SEAM은 오모테산도역 A4 출구에서 도보 3분, 아오야마도리와 캣 스트리트에서도 가까운 미나미아오야마에 있습니다.'},
  {'ja': '美容室帰りや買い物の途中に 気になっていた一本を実際に見て選べます。予約は不要で お買い物だけのご来店を歓迎しています。',
   'en': 'On your way back from the salon or in the middle of shopping, you can see and choose the bottle you have been wondering about. No booking needed, and shopping-only visits are welcome.',
   'zh': '在美发后或购物途中，都可以实际看过再挑选一直在意的那一瓶。无需预约，欢迎只购物的到访。',
   'tw': '在美髮後或購物途中，都可以實際看過再挑選一直在意的那一瓶。無需預約，歡迎只購物的到訪。',
   'ko': '미용실에 다녀오는 길이나 쇼핑 중에, 궁금했던 한 병을 직접 보고 고르실 수 있습니다. 예약은 필요 없고 쇼핑만을 위한 방문도 환영합니다.'},
 ],
 'sapporo': [
  {'ja': '札幌の中心・大通は 大通公園や狸小路商店街に近い街の中心部です。地下歩行空間からもアクセスしやすく 天候を気にせず立ち寄れます。',
   'en': 'Odori, the heart of Sapporo, sits beside Odori Park and the Tanukikoji shopping street. It is easy to reach through the underground walkway, so the weather need not stop you.',
   'zh': '札幌中心的大通，紧邻大通公园与狸小路商店街。经由地下步行空间也很好抵达，不必在意天气。',
   'tw': '札幌中心的大通，緊鄰大通公園與狸小路商店街。經由地下步行空間也很好抵達，不必在意天氣。',
   'ko': '삿포로 중심인 오도리는 오도리 공원과 다누키코지 상점가에 인접한 도심입니다. 지하보행공간으로도 접근하기 쉬워 날씨에 상관없이 들르실 수 있습니다.'},
  {'ja': 'SEAMは地下鉄大通駅から徒歩1分。すすきの方面へも歩ける立地で 都心でのお出かけの動線に組み込みやすい場所です。',
   'en': 'SEAM is one minute from Odori subway station, within walking distance of Susukino — easy to fold into a day in the city centre.',
   'zh': 'SEAM距地铁大通站步行1分钟，也可步行前往薄野一带，很容易安排进市中心的行程。',
   'tw': 'SEAM距地鐵大通站步行1分鐘，也可步行前往薄野一帶，很容易安排進市中心的行程。',
   'ko': 'SEAM은 지하철 오도리역에서 도보 1분입니다. 스스키노 방면으로도 걸어갈 수 있어 도심 나들이 동선에 넣기 좋습니다.'},
  {'ja': '寒暖差や乾燥の気になる北海道では 保湿・補修のホームケアを切らさず揃えたいもの。施術なしで サロン専売品だけを買い足せます。',
   'en': 'In Hokkaido, where the temperature swings and the air is dry, it helps to keep moisturising and repairing home care in stock. You can top up on salon-exclusive products without any treatment.',
   'zh': '在温差与干燥都明显的北海道，保湿与修护的居家护理最好不要断货。无需接受护理，也能单独补货沙龙专售品。',
   'tw': '在溫差與乾燥都明顯的北海道，保濕與修護的居家護理最好不要斷貨。無需接受護理，也能單獨補貨沙龍專售品。',
   'ko': '기온차와 건조가 신경 쓰이는 홋카이도에서는 보습·보수 홈케어를 떨어뜨리지 않는 것이 좋습니다. 시술 없이 살롱 전용 제품만 보충하실 수 있습니다.'},
 ],
 'osaka': [
  {'ja': '南堀江は 大阪ミナミのなかでも落ち着いた雰囲気のエリアです。インテリアやアパレルの路面店が並び ゆっくり買い物を楽しめます。',
   'en': 'Minami-Horie is one of the calmer corners of Osaka\'s Minami district. Interior and apparel shops line the street, so shopping here can be unhurried.',
   'zh': '南堀江是大阪南区中气氛沉静的一带。家居与服饰的街边店铺林立，可以慢慢逛。',
   'tw': '南堀江是大阪南區中氣氛沉靜的一帶。家居與服飾的街邊店鋪林立，可以慢慢逛。',
   'ko': '미나미호리에는 오사카 미나미 중에서도 차분한 분위기의 지역입니다. 인테리어와 의류 로드숍이 늘어서 있어 느긋하게 쇼핑할 수 있습니다.'},
  {'ja': 'SEAMは四ツ橋駅 6番出口から徒歩2分。心斎橋やアメリカ村からも歩ける南堀江の一角にあります。',
   'en': 'SEAM is two minutes from Yotsubashi Station, Exit 6, in a corner of Minami-Horie within walking distance of Shinsaibashi and Amerika-mura.',
   'zh': 'SEAM距四桥站6号出口步行2分钟，位于从心斋桥、美国村也可步行抵达的南堀江一角。',
   'tw': 'SEAM距四橋站6號出口步行2分鐘，位於從心齋橋、美國村也可步行抵達的南堀江一角。',
   'ko': 'SEAM은 요쓰바시역 6번 출구에서 도보 2분, 신사이바시와 아메리카무라에서도 걸어올 수 있는 미나미호리에 한쪽에 있습니다.'},
  {'ja': 'ミナミでの買い物のついでに 気になっていたサロン専売品だけを選べます。予約も施術も不要です。',
   'en': 'While shopping in Minami, you can pick up just the salon-exclusive products you have been curious about. No booking and no treatment required.',
   'zh': '在南区购物的途中，也可以只挑选一直在意的沙龙专售品。无需预约，也无需护理。',
   'tw': '在南區購物的途中，也可以只挑選一直在意的沙龍專售品。無需預約，也無需護理。',
   'ko': '미나미에서 쇼핑하는 김에 궁금했던 살롱 전용 제품만 고르실 수 있습니다. 예약도 시술도 필요 없습니다.'},
 ],
 'nagoya': [
  {'ja': '栄・矢場町は 名古屋の中心的な繁華街です。百貨店や大型商業施設が集まり 買い物の合間に立ち寄りやすい場所です。',
   'en': 'Sakae and Yabacho form the heart of Nagoya\'s downtown, where department stores and large complexes gather — easy to drop into between errands.',
   'zh': '荣・矢场町是名古屋的中心闹市。百货店与大型商业设施集中，购物途中很容易顺路前来。',
   'tw': '榮・矢場町是名古屋的中心鬧區。百貨公司與大型商業設施集中，購物途中很容易順路前來。',
   'ko': '사카에·야바초는 나고야의 중심 번화가입니다. 백화점과 대형 상업시설이 모여 있어 쇼핑 사이에 들르기 좋습니다.'},
  {'ja': 'SEAMは矢場町駅からすぐ。栄・大須・上前津からも歩ける立地で ネイリックスの1階と2階を使った店舗です。',
   'en': 'SEAM is right by Yabacho Station, within walking distance of Sakae, Osu and Kamimaezu, occupying the first and second floors of the Nailics building.',
   'zh': 'SEAM就在矢场町站旁，从荣、大须、上前津也可步行抵达，使用Nailics大楼的1楼与2楼。',
   'tw': 'SEAM就在矢場町站旁，從榮、大須、上前津也可步行抵達，使用Nailics大樓的1樓與2樓。',
   'ko': 'SEAM은 야바초역 바로 앞에 있습니다. 사카에·오스·가미마에즈에서도 걸어올 수 있으며 네일릭스 빌딩 1층과 2층을 사용합니다.'},
  {'ja': 'サロン専売のヘアケアだけを買いに来ていただけます。予約は不要 施術がなくても大丈夫です。',
   'en': 'You are welcome to come only to buy salon-exclusive hair care. No booking needed, and no treatment required.',
   'zh': '欢迎只为购买沙龙专售护发品而来。无需预约，不接受护理也没问题。',
   'tw': '歡迎只為購買沙龍專售護髮品而來。無需預約，不接受護理也沒問題。',
   'ko': '살롱 전용 헤어케어만 구매하러 오셔도 좋습니다. 예약은 필요 없고 시술을 받지 않으셔도 됩니다.'},
 ],
 'fukuoka': [
  {'ja': '大名は 天神に隣接する福岡の流行発信地です。路面のセレクトショップやカフェが集まり 買い物の合間に立ち寄りやすいエリアです。',
   'en': 'Daimyo, next to Tenjin, is where Fukuoka\'s trends start. Select shops and cafés line the streets, so it is easy to drop in between errands.',
   'zh': '大名紧邻天神，是福冈的流行发信地。街边的选品店与咖啡馆集中，购物途中很容易顺路前来。',
   'tw': '大名緊鄰天神，是福岡的流行發信地。街邊的選品店與咖啡館集中，購物途中很容易順路前來。',
   'ko': '다이묘는 텐진과 인접한 후쿠오카의 유행 발신지입니다. 거리의 셀렉트숍과 카페가 모여 있어 쇼핑 사이에 들르기 좋습니다.'},
  {'ja': 'SEAMは西鉄天神駅から徒歩5分。天神の百貨店エリアからも歩ける大名の一角にあります。',
   'en': 'SEAM is five minutes from Nishitetsu Tenjin Station, in a corner of Daimyo within walking distance of Tenjin\'s department stores.',
   'zh': 'SEAM距西铁天神站步行5分钟，位于从天神百货区也可步行抵达的大名一角。',
   'tw': 'SEAM距西鐵天神站步行5分鐘，位於從天神百貨區也可步行抵達的大名一角。',
   'ko': 'SEAM은 니시테쓰 텐진역에서 도보 5분, 텐진 백화점 구역에서도 걸어올 수 있는 다이묘 한쪽에 있습니다.'},
  {'ja': 'アウトバスやスタイリングなど 気になっていたアイテムを実際に試しながら選べます。予約不要 お買い物だけのご来店も歓迎です。',
   'en': 'Leave-in treatments, styling products — you can try what you have been curious about and choose in person. No booking needed, and shopping-only visits are welcome.',
   'zh': '免冲洗护理、造型品等，都可以实际试用后再挑选。无需预约，也欢迎只购物的到访。',
   'tw': '免沖洗護理、造型品等，都可以實際試用後再挑選。無需預約，也歡迎只購物的到訪。',
   'ko': '아웃바스나 스타일링 등 궁금했던 제품을 직접 사용해 보며 고르실 수 있습니다. 예약 없이 쇼핑만을 위한 방문도 환영합니다.'},
 ],
 'utsunomiya': [
  {'ja': '宇都宮のインターパークは 大型商業施設が集まるエリアです。車で立ち寄りやすく まとめ買いにも向いています。',
   'en': 'Interpark in Utsunomiya is a cluster of large retail complexes. It is easy to reach by car and well suited to stocking up.',
   'zh': '宇都宫的Interpark是大型商业设施集中的区域。开车前来方便，也适合一次购足。',
   'tw': '宇都宮的Interpark是大型商業設施集中的區域。開車前來方便，也適合一次購足。',
   'ko': '우쓰노미야의 인터파크는 대형 상업시설이 모인 지역입니다. 차로 들르기 쉬워 한꺼번에 구매하기에도 좋습니다.'},
  {'ja': 'SEAMはインターパーク内にあり 駐車場からそのまま立ち寄れます。',
   'en': 'SEAM sits inside Interpark, so you can walk in straight from the car park.',
   'zh': 'SEAM位于Interpark内，可从停车场直接前来。',
   'tw': 'SEAM位於Interpark內，可從停車場直接前來。',
   'ko': 'SEAM은 인터파크 안에 있어 주차장에서 바로 들르실 수 있습니다.'},
  {'ja': '施術がなくても サロン専売のヘアケアだけをお買い求めいただけます。ご予約は不要です。',
   'en': 'You can buy salon-exclusive hair care without any treatment. No booking is needed.',
   'zh': '即使不接受护理，也能单独购买沙龙专售护发品。无需预约。',
   'tw': '即使不接受護理，也能單獨購買沙龍專售護髮品。無需預約。',
   'ko': '시술을 받지 않으셔도 살롱 전용 헤어케어만 구매하실 수 있습니다. 예약은 필요 없습니다.'},
 ],
}

# ── ブランドハブ（{brand}.html）専用。エリアページとは構造が違う
HUB = {
 'bp.hubBadge': {
   'ja': '（{E}）正規取扱店', 'en': '({E}) Authorized retailer', 'zh': '（{E}）正规代理店',
   'tw': '（{E}）正規代理店', 'ko': '({E}) 정규 취급점'},
 'bp.hubLines': {
   'ja': '主な取扱ライン', 'en': 'Main lines we carry', 'zh': '主要在售系列',
   'tw': '主要在售系列', 'ko': '주요 취급 라인'},
 'bp.hubAllBrands': {
   'ja': '全取扱ブランドを見る →', 'en': 'See every brand we carry →', 'zh': '查看全部在售品牌 →',
   'tw': '查看全部在售品牌 →', 'ko': '취급 브랜드 전체 보기 →'},
 'bp.hubItems': {
   'ja': '取扱アイテムの例', 'en': 'Examples of items we carry', 'zh': '在售商品示例',
   'tw': '在售商品範例', 'ko': '취급 상품 예시'},
 'bp.hubPriceNote': {
   'ja': '価格は変わる場合があります　最新は店頭・会員オンラインでご確認ください',
   'en': 'Prices may change. Please check in store or on the members\' online shop for the latest.',
   'zh': '价格可能变更　最新价格请在门店或会员网店确认。',
   'tw': '價格可能變更　最新價格請在門市或會員網店確認。',
   'ko': '가격은 변경될 수 있습니다　최신 가격은 매장이나 회원 온라인 숍에서 확인해 주세요.'},
 'bp.hubStores': {
   'ja': '{B}を取り扱う SEAMの店舗', 'en': 'SEAM stores that carry {B}', 'zh': '销售{B}的SEAM门店',
   'tw': '銷售{B}的SEAM門市', 'ko': '{B}를 취급하는 SEAM 매장'},
 'bp.hubStoreNote': {
   'ja': '取扱・在庫状況は店舗により異なります　お買い物だけのご来店も歓迎です',
   'en': 'Availability and stock differ by store. Shopping-only visits are welcome.',
   'zh': '各门店的销售与库存情况不同　也欢迎只购物的到访。',
   'tw': '各門市的銷售與庫存情況不同　也歡迎只購物的到訪。',
   'ko': '취급과 재고 상황은 매장마다 다릅니다　쇼핑만을 위한 방문도 환영합니다.'},
 'bp.hubStoreInfo': {
   'ja': '店舗情報 →', 'en': 'Store details →', 'zh': '门店信息 →', 'tw': '門市資訊 →', 'ko': '매장 정보 →'},
 'bp.hubAllStores': {
   'ja': '店舗一覧を見る →', 'en': 'See all stores →', 'zh': '查看门店一览 →',
   'tw': '查看門市一覽 →', 'ko': '매장 목록 보기 →'},
 'bp.hubBackBrands': {
   'ja': '← 取扱ブランド一覧', 'en': '← All brands', 'zh': '← 在售品牌一览',
   'tw': '← 在售品牌一覽', 'ko': '← 취급 브랜드 목록'},
 'bp.hubTokyo': {
   'ja': '東京で買える', 'en': 'Available in Tokyo', 'zh': '在东京可购买',
   'tw': '在東京可購買', 'ko': '도쿄에서 구매 가능'},
 'bp.hubQ1': {
   'ja': '{B}は正規品ですか', 'en': 'Are your {B} products genuine?', 'zh': '{B}是正品吗',
   'tw': '{B}是正品嗎', 'ko': '{B}는 정품인가요'},
 'bp.hubA1': {
   'ja': 'SEAMはメーカー公認の正規取扱店です {B}は正規ルートの商品のみをお取り扱いしています',
   'en': 'SEAM is a maker-approved authorized retailer. We carry {B} only through official channels.',
   'zh': 'SEAM是厂商公认的正规代理店。{B}仅经由正规渠道进货。',
   'tw': 'SEAM是廠商公認的正規代理店。{B}僅經由正規渠道進貨。',
   'ko': 'SEAM은 제조사 공인 정규 취급점입니다. {B}는 정규 유통 경로의 제품만 취급합니다.'},
 'bp.hubQ2': {
   'ja': '{B}はどの店舗で買えますか', 'en': 'Which stores sell {B}?', 'zh': '{B}在哪些门店可以买到',
   'tw': '{B}在哪些門市可以買到', 'ko': '{B}는 어느 매장에서 살 수 있나요'},
 'bp.hubQ3': {
   'ja': '{B}は通販で買えますか', 'en': 'Can I buy {B} online?', 'zh': '{B}可以网购吗',
   'tw': '{B}可以網購嗎', 'ko': '{B}는 온라인으로 구매할 수 있나요'},
 'bp.hubQ4': {
   'ja': '{B}が自分に合うか分かりません', 'en': 'I am not sure whether {B} suits me',
   'zh': '不确定{B}是否适合自己', 'tw': '不確定{B}是否適合自己', 'ko': '{B}가 저에게 맞을지 모르겠습니다'},
 'bp.hubA4': {
   'ja': '合うケアは髪の太さ 量 くせ カラーや矯正の履歴によって変わります SEAMの無料の髪格診断で 今の髪に合うアイテムをご提案します',
   'en': 'What suits you depends on hair thickness, density, wave, and your colour and straightening history. SEAM\'s free Hair Finder suggests what fits your hair right now.',
   'zh': '适合的护理会因发丝粗细、发量、卷曲程度以及染发与矫正的经历而不同。SEAM的免费发质诊断会为当下的头发推荐合适的商品。',
   'tw': '適合的護理會因髮絲粗細、髮量、捲曲程度以及染髮與矯正的經歷而不同。SEAM的免費髮質診斷會為當下的頭髮推薦合適的商品。',
   'ko': '맞는 케어는 모발의 굵기, 숱, 곱슬, 염색과 매직의 이력에 따라 달라집니다. SEAM의 무료 모발 진단이 지금의 머리에 맞는 제품을 제안해 드립니다.'},
 'bp.hubBuyIn': {
   'ja': '{C}で買うだけOK', 'en': 'Buy only, in {C}', 'zh': '在{C}只购物也可以',
   'tw': '在{C}只購物也可以', 'ko': '{C}에서 구매만 OK'},
}

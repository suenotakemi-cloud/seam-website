# -*- coding: utf-8 -*-
# 商品の一言説明。日本語の感覚語をそのまま移し、効能の断定は足さない（薬機法配慮）
D = {
'くせとダメージ、二重の悩みに2種のケラチンで応える泡。ゆがみがちな髪が、洗うたび少しずつ素直になっていく。': {
 'en': 'A lather with two keratins for hair dealing with both texture and damage. Wave that wants to wander settles a little more with every wash.',
 'zh': '以两种角蛋白回应卷曲与损伤双重烦恼的泡沫。容易走样的头发，每洗一次都更顺一点。',
 'tw': '以兩種角蛋白回應捲曲與損傷雙重煩惱的泡沫。容易走樣的頭髮，每洗一次都更順一點。',
 'ko': '곱슬과 손상, 두 가지 고민에 두 종류의 케라틴으로 답하는 거품. 흐트러지기 쉬운 머리카락이 씻을 때마다 조금씩 순해집니다.'},
'くせ・広がりを軽さで制するヘアシェイプケア。ふわっと流れるのにまとまる、が両立する。': {
 'en': 'Hair-shape care that tames wave and volume with lightness. It flows softly and still stays together.',
 'zh': '以轻盈驾驭卷曲与蓬乱的塑形护理。既能柔顺飘动，又能收拢成型。',
 'tw': '以輕盈駕馭捲曲與蓬亂的塑形護理。既能柔順飄動，又能收攏成型。',
 'ko': '곱슬과 부풀어 오름을 가벼움으로 다스리는 헤어 셰이프 케어. 사뿐히 흐르면서도 흐트러지지 않습니다.'},
'くせ毛の広がりをしっとり整えるバーム型。作り込まない「そのままでいい感じ」が手のひらひとつで完成する。': {
 'en': 'A balm that calms wavy hair with moisture. That undone, just-right look comes together with one palmful.',
 'zh': '以滋润收敛卷发蓬乱的膏状造型品。不刻意打理的自然感，一掌心便能完成。',
 'tw': '以滋潤收斂捲髮蓬亂的膏狀造型品。不刻意打理的自然感，一掌心便能完成。',
 'ko': '곱슬머리의 부풀어 오름을 촉촉하게 정돈하는 밤 타입. 꾸미지 않은 자연스러운 느낌이 손바닥 하나로 완성됩니다.'},
'ごわつく太い髪が、なじませるほどやわらかく。メロウオイルの名の通り、髪の頑固さがほどけていく。': {
 'en': 'Coarse, thick hair softens the more you work it in. True to the name Mellow Oil, the stubbornness unwinds.',
 'zh': '粗硬的头发越推开越柔软。正如Mellow Oil之名，头发的固执渐渐松开。',
 'tw': '粗硬的頭髮越推開越柔軟。正如Mellow Oil之名，頭髮的固執漸漸鬆開。',
 'ko': '뻣뻣하고 굵은 머리카락이 펴 바를수록 부드러워집니다. 멜로우 오일이라는 이름 그대로, 머리카락의 고집이 풀려 갑니다.'},
'イタリア産ルピナスシードの栄養で、ダメージ毛をやさしく洗う。93%自然由来の泡は、髪にも気分にも罪悪感がない。': {
 'en': 'Italian lupin seed nourishment washes damaged hair gently. A lather 93% of natural origin, easy on the hair and on the conscience.',
 'zh': '以意大利羽扇豆种子的养分温和清洗受损发丝。93%天然来源的泡沫，对头发与心情都毫无负担。',
 'tw': '以義大利羽扇豆種子的養分溫和清洗受損髮絲。93%天然來源的泡沫，對頭髮與心情都毫無負擔。',
 'ko': '이탈리아산 루핀 씨앗의 영양으로 손상모를 부드럽게 감아 줍니다. 93% 자연 유래 거품은 머리에도 기분에도 부담이 없습니다.'},
'カラーを続ける髪にCMADKの泡で毎晩の補修を。ローズ・ド・メイの香りに包まれると、バスタイムが小さなご褒美になる。': {
 'en': 'Nightly care with CMADK lather for hair you keep colouring. Wrapped in Rose de Mai, bath time becomes a small reward.',
 'zh': '为持续染发的头发带来CMADK泡沫的每晚养护。被五月玫瑰的香气包围，沐浴时光成了小小的犒赏。',
 'tw': '為持續染髮的頭髮帶來CMADK泡沫的每晚養護。被五月玫瑰的香氣包圍，沐浴時光成了小小的犒賞。',
 'ko': '컬러를 이어 가는 머리에 CMADK 거품으로 매일 밤의 케어를. 로즈 드 메 향에 감싸이면 목욕 시간이 작은 보상이 됩니다.'},
'キャピキシルやナールスゲンを贅沢に配した頭皮特化の泡。地肌から整える発想は、髪の未来への一番の近道。': {
 'en': 'A scalp-focused lather generous with Capixyl and Narsgen. Starting from the skin is the shortest route to the hair you want later.',
 'zh': '奢华配入Capixyl与Narsgen的头皮专用泡沫。从头皮着手的思路，是通往未来发质最近的一条路。',
 'tw': '奢華配入Capixyl與Narsgen的頭皮專用泡沫。從頭皮著手的思路，是通往未來髮質最近的一條路。',
 'ko': '캐피실과 나르스젠을 아낌없이 담은 두피 전용 거품. 두피부터 다스리는 발상이 앞으로의 머릿결에 가장 빠른 길입니다.'},
'ケラスターゼの頂点を冠する泡。アビシニアンオイルの贅沢な洗い心地は、毎晩を特別な時間に変える。': {
 'en': "The lather that crowns Kérastase's range. The luxury of abyssinian oil turns every night into something special.",
 'zh': '冠以Kérastase顶峰之名的泡沫。亚比西尼亚油的奢华洗感，让每一晚都成为特别的时光。',
 'tw': '冠以Kérastase頂峰之名的泡沫。亞比西尼亞油的奢華洗感，讓每一晚都成為特別的時光。',
 'ko': '케라스타즈의 정점에 오른 거품. 아비시니안 오일의 호사스러운 감촉이 매일 밤을 특별한 시간으로 바꿉니다.'},
'ケラチンを守りながら洗う、ラグジュアリーオイルの泡。バスルームに広がる香りから、もう上質。': {
 'en': 'A luxury-oil lather that washes while protecting keratin. The quality starts with the scent filling the bathroom.',
 'zh': '守护角蛋白的奢华油泡沫。从浴室里弥漫的香气开始，已是上乘。',
 'tw': '守護角蛋白的奢華油泡沫。從浴室裡瀰漫的香氣開始，已是上乘。',
 'ko': '케라틴을 지키며 감아 주는 럭셔리 오일 거품. 욕실에 퍼지는 향에서부터 이미 격이 다릅니다.'},
'サロン上位店限定のプラチナム最上位。ハイパーインカラミのさらさらは、試した日から基準が変わる。': {
 'en': 'The top of the Platinum line, for leading salons only. Once you feel Hyper Inkarami silkiness, your baseline shifts.',
 'zh': '仅限顶级沙龙的Platinum最高阶。体验过Hyper Inkarami的顺滑，标准就此改变。',
 'tw': '僅限頂級沙龍的Platinum最高階。體驗過Hyper Inkarami的順滑，標準就此改變。',
 'ko': '상위 살롱 한정 플래티넘 최상위. 하이퍼 인카라미의 보송함은 써 본 날부터 기준을 바꿉니다.'},
'シスチンで補修しながら洗う、硬毛のためのカルテ。ごわつく髪が、泡の中でやわらかい返事をし始める。': {
 'en': 'A prescription for coarse hair that repairs with cystine as it cleanses. Stiff hair starts to answer softly inside the lather.',
 'zh': '以胱氨酸边修护边清洗，为硬发而设的处方。粗硬的头发在泡沫中开始柔软地回应。',
 'tw': '以胱胺酸邊修護邊清洗，為硬髮而設的處方。粗硬的頭髮在泡沫中開始柔軟地回應。',
 'ko': '시스틴으로 케어하며 감아 주는, 경모를 위한 처방. 뻣뻣한 머리카락이 거품 속에서 부드럽게 답하기 시작합니다.'},
'セラミド2が細い髪の水分を閉じ込めるミルク。やわらかさが続く毛先は、触るたび少しうれしい。': {
 'en': 'A milk in which ceramide 2 holds moisture in fine hair. Ends that stay soft are a small pleasure every time you touch them.',
 'zh': '以神经酰胺2锁住细软发丝水分的护发乳。持续柔软的发梢，每次触碰都让人有点开心。',
 'tw': '以神經醯胺2鎖住細軟髮絲水分的護髮乳。持續柔軟的髮梢，每次觸碰都讓人有點開心。',
 'ko': '세라마이드2가 가는 머리카락의 수분을 가두는 밀크. 부드러움이 이어지는 모발 끝은 만질 때마다 조금 기쁩니다.'},
'タンパク質と多糖類のディープナリッシング。傷んだ髪ほど、すすいだ後の変化がわかりやすい。': {
 'en': 'Deep nourishing with proteins and polysaccharides. The more damaged the hair, the clearer the change after rinsing.',
 'zh': '蛋白质与多糖的深层滋养。头发越受损，冲洗后的变化越明显。',
 'tw': '蛋白質與多醣的深層滋養。頭髮越受損，沖洗後的變化越明顯。',
 'ko': '단백질과 다당류의 딥 너리싱. 손상된 머리일수록 헹군 뒤의 변화가 잘 느껴집니다.'},
'タンパク質・水分・脂質を同時に補うダブルリペアの泡。ガーデニアとピオニーの香りで、補修の夜が華やぐ。': {
 'en': 'A double-repair lather that tops up protein, moisture and lipids at once. Gardenia and peony make the repairing night feel bright.',
 'zh': '同时补充蛋白质、水分与脂质的双重修护泡沫。栀子与牡丹的香气，让养护的夜晚变得华美。',
 'tw': '同時補充蛋白質、水分與脂質的雙重修護泡沫。梔子與牡丹的香氣，讓養護的夜晚變得華美。',
 'ko': '단백질·수분·지질을 동시에 채우는 더블 리페어 거품. 가드니아와 피오니 향으로 케어하는 밤이 화사해집니다.'},
'ブルキナファソ産白ハイビスカスのデリケート処方。毎日洗うものだから、一番やさしいのを選ぶという答え。': {
 'en': 'A delicate formula with white hibiscus from Burkina Faso. Since you wash every day, choosing the gentlest one is its own answer.',
 'zh': '采用布基纳法索白木槿的温和配方。既然每天都洗，就选最温和的那一支。',
 'tw': '採用布吉納法索白木槿的溫和配方。既然每天都洗，就選最溫和的那一支。',
 'ko': '부르키나파소산 화이트 히비스커스의 델리케이트 처방. 매일 감는 것이니 가장 순한 것을 고른다는 답.'},
'プロビタミンの泡で、乾いた髪に毎日のうるおい充填。洗い上がりのしっとりが、翌日の夕方まで続く設計。': {
 'en': 'A provitamin lather that tops dry hair up with moisture each day, designed so the just-washed softness lasts into the next evening.',
 'zh': '以维他命原泡沫为干燥发丝每日补水。洗后的润泽，设计成可延续到隔天傍晚。',
 'tw': '以維他命原泡沫為乾燥髮絲每日補水。洗後的潤澤，設計成可延續到隔天傍晚。',
 'ko': '프로비타민 거품으로 건조한 머리에 매일 수분을 채웁니다. 감고 난 뒤의 촉촉함이 다음 날 저녁까지 이어지도록 설계했습니다.'},
'乳酸のやさしい酸処方で、カラーの鮮度を守りながら洗う。色が長持ちすると、サロン予約の間隔まで楽しみになる。': {
 'en': 'A gentle lactic-acid formula that washes while keeping colour fresh. When the shade lasts, even the wait between salon visits feels good.',
 'zh': '以乳酸的温和酸性配方清洗，同时守护发色鲜度。颜色持久了，连预约沙龙的间隔都变得令人期待。',
 'tw': '以乳酸的溫和酸性配方清洗，同時守護髮色鮮度。顏色持久了，連預約沙龍的間隔都變得令人期待。',
 'ko': '젖산의 순한 산성 처방으로 컬러의 선명함을 지키며 감아 줍니다. 색이 오래가면 살롱 예약 간격까지 기다려집니다.'},
'個性を惹き立てる1DKの看板オイル。さわやかさと甘さの間の香りは、性別を問わず「それ何使ってるの」と聞かれるやつ。': {
 'en': "1DK's signature oil, made to bring out what is already yours. The scent sits between fresh and sweet, and gets you asked what you are wearing.",
 'zh': '衬托个性的1DK招牌发油。介于清爽与甜美之间的香气，不分性别都会被问「你用的是什么」。',
 'tw': '襯托個性的1DK招牌髮油。介於清爽與甜美之間的香氣，不分性別都會被問「你用的是什麼」。',
 'ko': '개성을 돋보이게 하는 1DK의 간판 오일. 상쾌함과 달콤함 사이의 향은 성별을 가리지 않고 "그거 뭐 쓰세요"라는 말을 듣게 합니다.'},
'在庫・価格・選び方は店頭のスタッフがご案内します お買い物だけのご来店も歓迎です': {
 'en': 'Our staff in store can walk you through stock, prices and how to choose. You are welcome to come just to shop.',
 'zh': '库存、价格与挑选方式由店内工作人员为您介绍。只为购物到店也很欢迎。',
 'tw': '庫存、價格與挑選方式由店內工作人員為您介紹。只為購物到店也很歡迎。',
 'ko': '재고와 가격, 고르는 법은 매장 스태프가 안내해 드립니다. 구매만을 위한 방문도 환영합니다.'},
'広がりやすい髪をタイトに整える処方。根元から毛先まで向きがそろって、光の筋がきれいに通る。': {
 'en': 'A formula that draws unruly hair in tight. From root to tip everything faces the same way, and the light runs through cleanly.',
 'zh': '将易蓬乱的头发收拢紧致的配方。从发根到发梢方向一致，光泽的线条得以顺畅通过。',
 'tw': '將易蓬亂的頭髮收攏緊緻的配方。從髮根到髮梢方向一致，光澤的線條得以順暢通過。',
 'ko': '부풀기 쉬운 머리를 단정하게 정돈하는 처방. 뿌리부터 끝까지 결이 가지런해져 빛줄기가 곱게 지나갑니다.'},
'水鳥由来の反応型ケラチンとフラーレンを頭皮ケアに。TOKIOの補修哲学を、地肌から始める泡。': {
 'en': 'Reactive keratin of waterfowl origin and fullerene, brought to scalp care. A lather that starts TOKIO’s philosophy at the skin.',
 'zh': '将水禽来源的反应型角蛋白与富勒烯用于头皮护理。让TOKIO的修护哲学，从头皮开始的泡沫。',
 'tw': '將水禽來源的反應型角蛋白與富勒烯用於頭皮護理。讓TOKIO的修護哲學，從頭皮開始的泡沫。',
 'ko': '물새 유래 반응형 케라틴과 풀러렌을 두피 케어에. TOKIO의 케어 철학을 두피에서 시작하는 거품입니다.'},
'紫の泡がハイトーンの黄ばみを毎晩リセット。透明感が続くと、ブリーチの痛みさえ誇りに変わる。': {
 'en': 'Purple lather resets the yellow in high-tone hair each night. When the clarity holds, even the cost of bleaching starts to feel like a badge.',
 'zh': '紫色泡沫每晚重置浅色发的黄调。通透感得以延续，连漂发的代价都成了骄傲。',
 'tw': '紫色泡沫每晚重置淺色髮的黃調。通透感得以延續，連漂髮的代價都成了驕傲。',
 'ko': '보라색 거품이 하이톤의 노란기를 매일 밤 리셋합니다. 투명감이 이어지면 탈색의 대가마저 자랑이 됩니다.'},
'細い髪のためのフルーエントオイル。軽さの中に熱ケアを忍ばせて、ふわっと流れる毛先をつくる。': {
 'en': 'A fluent oil for fine hair. Heat care hides inside the lightness, and the ends move softly.',
 'zh': '为细软发丝而生的流动型发油。在轻盈之中藏入热防护，打造柔柔飘动的发梢。',
 'tw': '為細軟髮絲而生的流動型髮油。在輕盈之中藏入熱防護，打造柔柔飄動的髮梢。',
 'ko': '가는 머리카락을 위한 플루언트 오일. 가벼움 속에 열 케어를 숨겨 사뿐히 흐르는 모발 끝을 만듭니다.'},
'細くて絡まりやすい髪のためのスムース設計。すすぎの指がするっと通って、乾かすと空気を含む軽さ。': {
 'en': 'A smooth design for fine hair that tangles easily. Fingers slip through at the rinse, and it dries with air in it.',
 'zh': '为细软易打结的头发所设计的顺滑配方。冲洗时手指顺畅通过，吹干后带着含空气的轻盈。',
 'tw': '為細軟易打結的頭髮所設計的順滑配方。沖洗時手指順暢通過，吹乾後帶著含空氣的輕盈。',
 'ko': '가늘고 잘 엉키는 머리를 위한 스무스 설계. 헹굴 때 손가락이 스르륵 지나가고, 말리면 공기를 머금은 가벼움이 남습니다.'},
'細く柔らかい髪専用の補修泡。しなやかさを守りながら洗えるから、ぺたんとせずに立ち上がる。': {
 'en': 'A repairing lather made only for fine, soft hair. It washes while keeping the suppleness, so the roots lift instead of flattening.',
 'zh': '专为细软发质而设的修护泡沫。清洗时守护柔韧，因此不会塌陷而能立起。',
 'tw': '專為細軟髮質而設的修護泡沫。清洗時守護柔韌，因此不會塌陷而能立起。',
 'ko': '가늘고 부드러운 머리 전용 케어 거품. 유연함을 지키며 감아 주기에 납작해지지 않고 뿌리가 살아납니다.'},
'資生堂のアデノシン研究をルーツに持つ土台ケアの泡。根元の立ち上がりから、明日の印象を設計する。': {
 'en': "A foundation-care lather rooted in Shiseido's adenosine research. It designs tomorrow's impression starting at the lift of the roots.",
 'zh': '源自资生堂腺苷研究的根基护理泡沫。从发根的立起，设计明天的印象。',
 'tw': '源自資生堂腺苷研究的根基護理泡沫。從髮根的立起，設計明天的印象。',
 'ko': '시세이도의 아데노신 연구에 뿌리를 둔 기초 케어 거품. 뿌리가 서는 것에서부터 내일의 인상을 설계합니다.'},
'軽さで選ぶならこちら。ショートでも重くならず、指を通すたびさらっとほどけて夕方まで続く。': {
 'en': 'The one to pick if lightness matters. It never weighs short hair down, and falls loose through your fingers right into the evening.',
 'zh': '若以轻盈为标准，就选这一支。短发也不显厚重，每次穿过指间都清爽散开，一直持续到傍晚。',
 'tw': '若以輕盈為標準，就選這一支。短髮也不顯厚重，每次穿過指間都清爽散開，一直持續到傍晚。',
 'ko': '가벼움으로 고른다면 이것. 짧은 머리에도 무거워지지 않고, 손가락을 넣을 때마다 사르르 풀려 저녁까지 이어집니다.'},
'週2〜3回の集中保湿で、髪の内側までうるおいを届ける。カラカラだった毛先が、ふっくら息を吹き返す。': {
 'en': 'Intensive moisture two or three times a week, carried right inside the hair. Ends that were parched come back plump.',
 'zh': '每周2〜3次的集中保湿，将润泽送达发丝内部。干枯的发梢重新丰盈起来。',
 'tw': '每週2〜3次的集中保濕，將潤澤送達髮絲內部。乾枯的髮梢重新豐盈起來。',
 'ko': '주 2~3회의 집중 보습으로 머리카락 속까지 촉촉함을 전합니다. 바싹 말랐던 모발 끝이 도톰하게 되살아납니다.'},
'髪と頭皮のバランスを一本で。光反射テクノロジーの艶と、洗い上がりの澄んだ軽さが心地いい定番です。': {
 'en': 'Hair and scalp balanced in one bottle. Light-reflecting shine and a clean, light finish make it an easy staple.',
 'zh': '一支兼顾头发与头皮的平衡。光反射技术的光泽与洗后澄净的轻盈，是舒服的常备之选。',
 'tw': '一支兼顧頭髮與頭皮的平衡。光反射技術的光澤與洗後澄淨的輕盈，是舒服的常備之選。',
 'ko': '머리와 두피의 균형을 한 병에. 광 반사 테크놀로지의 윤기와 감고 난 뒤의 맑은 가벼움이 기분 좋은 스테디셀러입니다.'},
'髪の中でケラチンが結びつくインカラミ反応の泡。細い髪がシルキーな指通りへ洗い上がる。': {
 'en': 'A lather built on the Inkarami reaction, where keratin binds inside the hair. Fine hair washes up to a silky slip.',
 'zh': '让角蛋白在发丝内部结合的Inkarami反应泡沫。细软发丝洗后呈现丝滑手感。',
 'tw': '讓角蛋白在髮絲內部結合的Inkarami反應泡沫。細軟髮絲洗後呈現絲滑手感。',
 'ko': '머리카락 속에서 케라틴이 결합하는 인카라미 반응의 거품. 가는 머리가 실키한 손맛으로 마무리됩니다.'},
'髪の中の水分の偏りをそろえる、うねりケアの第一歩。お風呂の時点で指がすっと通って、明日の広がりが少し怖くなくなる。': {
 'en': 'The first step in wave care: evening out how moisture sits inside the hair. Fingers already glide in the bath, and tomorrow feels less daunting.',
 'zh': '让发丝内部水分分布均匀，是打理卷曲的第一步。在浴室里手指就能顺畅通过，明天的蓬乱不再那么可怕。',
 'tw': '讓髮絲內部水分分布均勻，是打理捲曲的第一步。在浴室裡手指就能順暢通過，明天的蓬亂不再那麼可怕。',
 'ko': '머리카락 속 수분의 치우침을 고르는, 곱슬 케어의 첫걸음. 욕실에서부터 손가락이 스르륵 지나가 내일의 부풀어 오름이 덜 두려워집니다.'},
'髪の水分保持の要・CMCを補いながら洗う美容液シャンプー。サロン専売の実力を、毎晩の泡で実感できる。': {
 'en': 'A serum shampoo that replenishes CMC, the key to how hair holds moisture, as it washes. Salon-exclusive quality, felt in the nightly lather.',
 'zh': '边清洗边补充头发保水关键CMC的精华洗发水。沙龙专售的实力，在每晚的泡沫中就能感受到。',
 'tw': '邊清洗邊補充頭髮保水關鍵CMC的精華洗髮精。沙龍專售的實力，在每晚的泡沫中就能感受到。',
 'ko': '머리카락의 수분 유지에 핵심인 CMC를 채우며 감아 주는 세럼 샴푸. 살롱 전용의 실력을 매일 밤 거품에서 느낄 수 있습니다.'},
'2024年の新テクノロジーを積んだ、うねり髪のための一本。洗いから始めるくせ対策の最前線。': {
 'en': 'Built on 2024 technology, made for hair that waves. Wave care that begins at the wash.',
 'zh': '搭载2024年新技术、为卷曲发丝而生的一支。从清洗开始的卷曲对策最前线。',
 'tw': '搭載2024年新技術、為捲曲髮絲而生的一支。從清洗開始的捲曲對策最前線。',
 'ko': '2024년의 새로운 테크놀로지를 담은, 곱슬머리를 위한 한 병. 감는 것에서 시작하는 곱슬 케어의 최전선입니다.'},
'PPTとCMCを髪の内側へ届ける集中マスク。サロン帰りのあの手触りが、自宅のお風呂で再現できる。': {
 'en': 'An intensive mask that carries PPT and CMC inside the hair. That just-left-the-salon feel, recreated in your own bath.',
 'zh': '将PPT与CMC送入发丝内部的集中发膜。刚从沙龙出来的那种手感，在家中的浴室就能重现。',
 'tw': '將PPT與CMC送入髮絲內部的集中髮膜。剛從沙龍出來的那種手感，在家中的浴室就能重現。',
 'ko': 'PPT와 CMC를 머리카락 속으로 전하는 집중 마스크. 살롱에서 막 나왔을 때의 그 감촉을 집 욕실에서 재현합니다.'},
}

# SEAM: 多言語のサロンLPに「選ぶ理由」をtitleへ入れる（2026-08-14）
#
# 【なぜ】オーナー「各地の名前と美容室でもトップに ヘアサロンなどでも」
#   実測（Bing）:
#     銀座 美髮沙龍（繁体字） → SEAM **10位**（tw/store-ginza）。食い込んではいる
#     大阪／福岡 美髮沙龍     → 圏外
#     銀座 美容室（日本語）   → HPBが1位・SEAM圏外
#     **銀座 美容室 サロン専売 → SEAM 2位**
#   今日ブランドで証明されたのと同じ法則：
#   **SEAMが持っているものが検索語に入っていれば勝てる。入っていないと勝てない。**
#
#   多言語のサロンLPは title が「銀座的美髮沙龍 | SEAM GINZA」だけで、
#   **選ぶ理由が1つも入っていない**。日本語側は
#   「銀座の縮毛矯正・髪質改善・カラー｜完全個室」に組み替え済みなのに、
#   多言語だけ置き去りになっていた。台湾・中国・韓国は競合が薄いので、ここが一番取りやすい。
#
# 【書いてよい語だけ使う】本文を数えて確かめた
#   ・包廂/個室  9〜14回 → 書ける。**ただし札幌と福岡は半個室**（実態どおり出し分ける）
#   ・縮毛矯正   6〜7回 / 染髮4回 / 燙髮5回 → 書ける
#   ・**免税は書かない**。役務ページ（salon-*）には出さない約束（物品が対象のため）
#   ・**英語対応も書かない**。言い切れるのは hairsalon の CHIKA だけで、各店では言えない
#
# 【名古屋】ヘアは受付休止中。多言語版がまだ「名古屋的美髮沙龍」と名乗っていた＝日本語側で
#   直した矛盾が多言語に残っていた。ヘッドスパとショップの店として名乗り直す。
#
# 冪等。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)
LANGS = ['en', 'zh', 'tw', 'ko']          # ja は既に組み替え済みなので触らない

CITY = {
 'ginza':   {'en': 'Ginza', 'zh': '银座', 'tw': '銀座', 'ko': '긴자'},
 'sapporo': {'en': 'Sapporo', 'zh': '札幌', 'tw': '札幌', 'ko': '삿포로'},
 'osaka':   {'en': 'Osaka', 'zh': '大阪', 'tw': '大阪', 'ko': '오사카'},
 'nagoya':  {'en': 'Nagoya', 'zh': '名古屋', 'tw': '名古屋', 'ko': '나고야'},
 'fukuoka': {'en': 'Fukuoka', 'zh': '福冈', 'tw': '福岡', 'ko': '후쿠오카'},
}
STORE = {'ginza': 'SEAM GINZA', 'sapporo': 'SEAM SAPPORO', 'osaka': 'SEAM OSAKA HORIE',
         'nagoya': 'SEAM NAGOYA', 'fukuoka': 'SEAM FUKUOKA'}
# 部屋の実態。既存本文の言い回しに合わせる
ROOM = {
 'full': {'en': 'fully private room', 'zh': '完全独立包间', 'tw': '完全獨立包廂', 'ko': '완전 개인실'},
 'semi': {'en': 'semi-private room', 'zh': '半独立包间', 'tw': '半獨立包廂', 'ko': '반개인실'},
}
SALON = {
 'ginza':   dict(room='full', hair=True),
 'sapporo': dict(room='semi', hair=True),
 'osaka':   dict(room='full', hair=True),
 'nagoya':  dict(room='full', hair=False),   # ヘア休止中
 'fukuoka': dict(room='semi', hair=True),
}

# 施術名（本文で数えて支えられている語だけ）
SVC = {
 'en': 'straightening, hair-improving treatment and colour',
 'zh': '缩毛矫正・发质改善・染发',
 'tw': '縮毛矯正・髮質改善・染髮',
 'ko': '매직 스트레이트·모발 개선·염색',
}
T_HAIR = {
 'en': 'Hair salon in {C} — {S2} | {R} | {ST}',
 'zh': '{C}的美发沙龙｜{S2}｜{R}｜{ST}',
 'tw': '{C}的美髮沙龍｜{S2}｜{R}｜{ST}',
 'ko': '{C}의 헤어살롱｜{S2}｜{R}｜{ST}',
}
D_HAIR = {
 'en': 'A {R} hair salon in {C} for {S2}. Our staff know 197 salon-exclusive brands. {ST}.',
 'zh': '在{C}提供{S2}的{R}美发沙龙。熟悉197个沙龙专售品牌的专业人员为您服务。{ST}。',
 'tw': '在{C}提供{S2}的{R}美髮沙龍。熟悉197個沙龍專售品牌的專業人員為您服務。{ST}。',
 'ko': '{C}에서 {S2}를 받으실 수 있는 {R} 헤어살롱입니다. 197개 살롱 전용 브랜드를 아는 스태프가 담당합니다. {ST}.',
}
# 名古屋（ヘア休止中）は施術を名乗らない
T_PAUSED = {
 'en': '{ST} {C} — head spa and salon-exclusive hair care',
 'zh': '{ST} {C}｜头皮SPA与沙龙专售护发',
 'tw': '{ST} {C}｜頭皮SPA與沙龍專售護髮',
 'ko': '{ST} {C}｜헤드스파와 살롱 전용 헤어케어',
}
D_PAUSED = {
 'en': 'Hair salon bookings are currently paused at {ST}. Our head spa and the shop with 197 salon-exclusive brands are open as usual.',
 'zh': '{ST}的美发沙龙目前暂停接受预约。头皮SPA与汇集197个沙龙专售品牌的商店照常营业。',
 'tw': '{ST}的美髮沙龍目前暫停接受預約。頭皮SPA與匯集197個沙龍專售品牌的商店照常營業。',
 'ko': '{ST}의 헤어살롱은 현재 예약 접수를 중지하고 있습니다. 헤드스파와 197개 살롱 전용 브랜드의 숍은 평소대로 영업합니다.',
}

n = 0
for slug, cfg in SALON.items():
    f = f'salon-{slug}.html'
    if not os.path.exists(f):
        print(f'  {f:22} 無し'); continue
    s = open(f, encoding='utf-8').read()
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    d = json.loads(m.group(2))
    before = json.dumps(d, ensure_ascii=False, sort_keys=True)

    for L in LANGS:
        c, st = CITY[slug][L], STORE[slug]
        if cfg['hair']:
            r = ROOM[cfg['room']][L]
            d[L]['meta.title'] = T_HAIR[L].format(C=c, S2=SVC[L], R=r, ST=st)
            d[L]['meta.description'] = D_HAIR[L].format(C=c, S2=SVC[L], R=r, ST=st)
        else:
            d[L]['meta.title'] = T_PAUSED[L].format(C=c, ST=st)
            d[L]['meta.description'] = D_PAUSED[L].format(C=c, ST=st)

    if json.dumps(d, ensure_ascii=False, sort_keys=True) == before:
        print(f'  {f:22} 変更なし'); continue
    s = (s[:m.start()] + m.group(1)
         + json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
         + m.group(3) + s[m.end():])
    open(f, 'w', encoding='utf-8').write(s)
    n += 1
    print(f'  {f:22} tw: {d["tw"]["meta.title"]}')
print(f'\n{n}枚（ja は既に組み替え済みなので触っていない）')

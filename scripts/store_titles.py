# 店舗ページの題名と説明に「美容室・ヘッドスパ」を入れる（2026-10-05）
# なぜ：Search Console で「銀座 美容室」2.0位 90回表示 0クリック／「堀江 美容室」1.6位 63回 0／「栄 美容院」2.4位 40回 0
#   出ているのは店舗ページなのに 題名が「ヘアケア専門店」で 美容室を探す人に選ばれていない
# その店に本当にあるものだけを書く（名古屋のヘアサロンは休止中なのでヘッドスパのみ）
import re, json
T = {
 'ginza': {
  'ja': ('銀座の完全個室美容室・ヘッドスパ｜サロン専売ヘアケア196ブランド｜SEAM GINZA', '銀座一丁目駅7番出口から徒歩1分 ONE GINZA 3F 完全個室のヘアサロンとヘッドスパ 196ブランドのサロン専売ヘアケアは予約なしで購入できます 免税対応'),
  'en': ('Private-Room Hair Salon & Head Spa in Ginza | Salon-Exclusive Hair Care | SEAM GINZA', 'One minute from Exit 7 of Ginza-itchome Station, ONE GINZA 3F. A fully private hair salon and head spa, with 196 salon-exclusive hair care brands to buy without booking. Tax-free.'),
  'zh': ('银座的完全私密包间美发沙龙・头皮SPA｜沙龙专售护发196个品牌｜SEAM GINZA', '银座一丁目站7号出口步行1分钟 ONE GINZA 3F 完全私密包间的美发沙龙与头皮SPA 196个品牌的沙龙专售护发无需预约即可购买 可免税'),
  'tw': ('銀座的完全私密包廂美髮沙龍・頭皮SPA｜沙龍專售護髮196個品牌｜SEAM GINZA', '銀座一丁目站7號出口步行1分鐘 ONE GINZA 3F 完全私密包廂的美髮沙龍與頭皮SPA 196個品牌的沙龍專售護髮無需預約即可購買 可免稅'),
  'ko': ('긴자의 완전 개인실 헤어살롱・헤드스파｜살롱 전용 헤어케어 196개 브랜드｜SEAM GINZA', '긴자잇초메역 7번 출구에서 도보 1분 ONE GINZA 3F 완전 개인실 헤어살롱과 헤드스파 196개 브랜드의 살롱 전용 헤어케어를 예약 없이 구매 가능 면세 대응')},
 'osaka': {
  'ja': ('大阪 堀江の完全個室美容室・ヘッドスパ｜サロン専売ヘアケア196ブランド｜SEAM OSAKA', '四ツ橋駅6番出口から徒歩2分 南堀江の完全個室ヘアサロンとヘッドスパ 縮毛矯正・髪質改善トリートメント 196ブランドのサロン専売ヘアケアは予約なしで購入できます 免税対応'),
  'en': ('Private-Room Hair Salon & Head Spa in Horie, Osaka | SEAM OSAKA', 'Two minutes from Exit 6 of Yotsubashi Station in Minami-Horie. A fully private hair salon and head spa, straightening and hair-improving treatments, and 196 salon-exclusive brands to buy without booking. Tax-free.'),
  'zh': ('大阪堀江的完全私密包间美发沙龙・头皮SPA｜沙龙专售护发196个品牌｜SEAM OSAKA', '四桥站6号出口步行2分钟 南堀江的完全私密包间美发沙龙与头皮SPA 缩毛矫正・发质改善护理 196个品牌的沙龙专售护发无需预约即可购买 可免税'),
  'tw': ('大阪堀江的完全私密包廂美髮沙龍・頭皮SPA｜沙龍專售護髮196個品牌｜SEAM OSAKA', '四橋站6號出口步行2分鐘 南堀江的完全私密包廂美髮沙龍與頭皮SPA 縮毛矯正・髮質改善護理 196個品牌的沙龍專售護髮無需預約即可購買 可免稅'),
  'ko': ('오사카 호리에의 완전 개인실 헤어살롱・헤드스파｜살롱 전용 헤어케어 196개 브랜드｜SEAM OSAKA', '요쓰바시역 6번 출구에서 도보 2분 미나미호리에의 완전 개인실 헤어살롱과 헤드스파 매직 스트레이트・모발 개선 트리트먼트 196개 브랜드를 예약 없이 구매 가능 면세 대응')},
 'sapporo': {
  'ja': ('札幌 大通の美容室・サロン専売ヘアケア196ブランド｜SEAM 札幌本店', '地下鉄大通駅から徒歩1分 半個室のヘアサロンと196ブランドのサロン専売ヘアケア 商品は予約なしで購入できます 免税対応'),
  'en': ('Hair Salon & Salon-Exclusive Hair Care in Odori, Sapporo | SEAM SAPPORO', 'One minute from Odori Subway Station. A semi-private hair salon and 196 salon-exclusive hair care brands to buy without booking. Tax-free.'),
  'zh': ('札幌大通的美发沙龙・沙龙专售护发196个品牌｜SEAM 札幌总店', '地铁大通站步行1分钟 半包间的美发沙龙与196个品牌的沙龙专售护发 商品无需预约即可购买 可免税'),
  'tw': ('札幌大通的美髮沙龍・沙龍專售護髮196個品牌｜SEAM 札幌總店', '地鐵大通站步行1分鐘 半包廂的美髮沙龍與196個品牌的沙龍專售護髮 商品無需預約即可購買 可免稅'),
  'ko': ('삿포로 오도리의 헤어살롱・살롱 전용 헤어케어 196개 브랜드｜SEAM 삿포로 본점', '지하철 오도리역에서 도보 1분 반개인실 헤어살롱과 196개 브랜드의 살롱 전용 헤어케어 상품은 예약 없이 구매 가능 면세 대응')},
 'fukuoka': {
  'ja': ('福岡 天神大名の美容室・サロン専売ヘアケア196ブランド｜SEAM FUKUOKA', '西鉄天神駅から徒歩5分 大名の半個室ヘアサロンと196ブランドのサロン専売ヘアケア 商品は予約なしで購入できます 免税対応'),
  'en': ('Hair Salon & Salon-Exclusive Hair Care in Tenjin Daimyo, Fukuoka | SEAM FUKUOKA', 'Five minutes from Nishitetsu Tenjin Station in Daimyo. A semi-private hair salon and 196 salon-exclusive hair care brands to buy without booking. Tax-free.'),
  'zh': ('福冈天神大名的美发沙龙・沙龙专售护发196个品牌｜SEAM FUKUOKA', '西铁天神站步行5分钟 大名的半包间美发沙龙与196个品牌的沙龙专售护发 商品无需预约即可购买 可免税'),
  'tw': ('福岡天神大名的美髮沙龍・沙龍專售護髮196個品牌｜SEAM FUKUOKA', '西鐵天神站步行5分鐘 大名的半包廂美髮沙龍與196個品牌的沙龍專售護髮 商品無需預約即可購買 可免稅'),
  'ko': ('후쿠오카 덴진 다이묘의 헤어살롱・살롱 전용 헤어케어 196개 브랜드｜SEAM FUKUOKA', '니시테쓰 덴진역에서 도보 5분 다이묘의 반개인실 헤어살롱과 196개 브랜드의 살롱 전용 헤어케어 상품은 예약 없이 구매 가능 면세 대응')},
 'nagoya': {
  'ja': ('名古屋 栄のヘッドスパ・サロン専売ヘアケア196ブランド｜SEAM NAGOYA', '矢場町駅すぐ 栄の完全個室ヘッドスパと196ブランドのサロン専売ヘアケア 商品は予約なしで購入できます 免税対応'),
  'en': ('Head Spa & Salon-Exclusive Hair Care in Sakae, Nagoya | SEAM NAGOYA', 'Steps from Yabacho Station in Sakae. A fully private head spa and 196 salon-exclusive hair care brands to buy without booking. Tax-free.'),
  'zh': ('名古屋荣的头皮SPA・沙龙专售护发196个品牌｜SEAM NAGOYA', '矢场町站旁 荣的完全私密包间头皮SPA与196个品牌的沙龙专售护发 商品无需预约即可购买 可免税'),
  'tw': ('名古屋榮的頭皮SPA・沙龍專售護髮196個品牌｜SEAM NAGOYA', '矢場町站旁 榮的完全私密包廂頭皮SPA與196個品牌的沙龍專售護髮 商品無需預約即可購買 可免稅'),
  'ko': ('나고야 사카에의 헤드스파・살롱 전용 헤어케어 196개 브랜드｜SEAM NAGOYA', '야바초역 바로 옆 사카에의 완전 개인실 헤드스파와 196개 브랜드의 살롱 전용 헤어케어 상품은 예약 없이 구매 가능 면세 대응')},
}
def attr(s, pat, val):
    return re.sub(pat, lambda m: m.group(1) + val.replace('"', '&quot;') + m.group(2), s, count=1)
for city, L in T.items():
    p = f'store-{city}.html'; s = open(p, encoding='utf-8').read()
    t, d = L['ja']
    s = re.sub(r'<title>[^<]*</title>', '<title>' + t + '</title>', s, count=1)
    s = attr(s, r'(<meta name="description" content=")[^"]*(")', d)
    s = attr(s, r'(<meta property="og:title" content=")[^"]*(")', t)
    s = attr(s, r'(<meta property="og:description" content=")[^"]*(")', d)
    s = attr(s, r'(<meta name="twitter:title" content=")[^"]*(")', t)
    s = attr(s, r'(<meta name="twitter:description" content=")[^"]*(")', d)
    m = re.search(r'SEAM_PAGE_I18N\s*=\s*', s); i = m.end()
    D, end = json.JSONDecoder().raw_decode(s, i)
    for l, (tt, dd) in L.items():
        if l in D: D[l]['meta.title'] = tt; D[l]['meta.description'] = dd
    s = s[:i] + json.dumps(D, ensure_ascii=False) + s[end:]
    open(p, 'w', encoding='utf-8').write(s); print('ok', p)

# SEAM: ヘッドスパLPに「首肩と目のまわり」の一節を足す（2026-08-22）
#
# 【なぜ】Bing実測で
#     「ヘッドスパ 目の疲れ 銀座」 → seam.site/headspa-ginza が **6位**
#     「銀座 ヘッドスパ」（一般語）  → 8位
#   より狭い語のほうが順位が良い。しかも「目の疲れ」はページ本文に **1回しか出ていない**
#   （当日の流れ s20 の中だけ）。ほぼ支えが無い状態で6位なので、ここは伸びしろがある。
#
# 【書いてよいことだけ書く】
#   ・s20 に「頭や首肩の張り 睡眠や目の疲れなど 今の状態をうかがいます」と既にある。
#     この**既に本当のこと**を見つけやすくするだけで、新しい施術や効能は足さない
#   ・薬機法: 効く・治る・改善しますは書かない（感覚と手順だけ）
#   ・日本語は句点「。」を使わない社内ルールに従う
#   ・診断データ（目の疲れが主訴の◯%）は売り物なので **公開面には数字を出さない**
#
# 対象は headspa-ginza / headspa-nagoya / headspa-osaka の3枚（スパを開けている店）。
# 名古屋はヘアが受付休止中だがスパは通常営業なので対象に含む。
# 冪等。マーカーで囲み、毎回いったん外してから入れ直す。
import re, json, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
FILES = ['headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html']
MARK_S, MARK_E = '<!-- seam:eye-block:start -->', '<!-- seam:eye-block:end -->'

T = {
 'eye.h': {
  'ja': '首肩と目のまわりが重い日に',
  'en': 'For days when your neck, shoulders and eyes feel heavy',
  'zh': '当颈肩与眼周感到沉重的日子',
  'tw': '當頸肩與眼周感到沉重的日子',
  'ko': '목·어깨와 눈가가 무거운 날에'},
 'eye.p1': {
  'ja': 'ヘッドスパにいらっしゃる方から最初にうかがうのは 頭や首肩の張り 眠りの浅さ 目の疲れです',
  'en': 'The first things we ask about are tension in the head, neck and shoulders, how you have been sleeping, and tired eyes.',
  'zh': '来做头皮SPA的客人，我们最先询问的是头部与颈肩的紧绷、睡眠的深浅，以及眼睛的疲劳。',
  'tw': '來做頭皮SPA的客人，我們最先詢問的是頭部與頸肩的緊繃、睡眠的深淺，以及眼睛的疲勞。',
  'ko': '헤드스파에 오신 분께 가장 먼저 여쭙는 것은 머리와 목·어깨의 뻐근함, 잠의 깊이, 그리고 눈의 피로입니다.'},
 'eye.p2': {
  'ja': 'うかがった内容にあわせて その日の進め方をご相談してから始めます',
  'en': 'We talk through how to spend the session based on what you tell us, and start from there.',
  'zh': '根据您所说的情况，先商量当天的进行方式，然后再开始。',
  'tw': '根據您所說的情況，先商量當天的進行方式，然後再開始。',
  'ko': '말씀해 주신 내용에 맞춰 그날의 진행 방식을 상의한 뒤에 시작합니다.'},
 'eye.p3': {
  'ja': '完全個室なので 人の目を気にせず 途中で眠ってしまってもそのままお休みいただけます',
  'en': 'The room is fully private, so no one is watching, and if you drift off you can simply stay asleep.',
  'zh': '因为是完全独立包间，不必在意他人视线，中途睡着了也可以就这样休息。',
  'tw': '因為是完全獨立包廂，不必在意他人視線，中途睡著了也可以就這樣休息。',
  'ko': '완전 개인실이라 남의 시선을 신경 쓸 필요가 없고, 도중에 잠이 드셔도 그대로 쉬셔도 됩니다.'},
}
# 半個室の店には使わない（この3枚はすべて完全個室なので p3 はそのまま使える）
FULL_PRIVATE = {'headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html'}

BLOCK = (MARK_S +
 '<section class="mt-11">'
 '<h2 class="font-serif text-[19px] text-ink" data-i18n="eye.h">%(h)s</h2>'
 '<p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;" data-i18n="eye.p1">%(p1)s</p>'
 '<p class="mt-2 text-[13.5px] text-charcoal/80" style="line-height:2;" data-i18n="eye.p2">%(p2)s</p>'
 '<p class="mt-2 text-[13.5px] text-charcoal/80" style="line-height:2;" data-i18n="eye.p3">%(p3)s</p>'
 '</section>' + MARK_E)

n = 0
for f in FILES:
    if not os.path.exists(f):
        print(f'  {f:22} 無し'); continue
    assert f in FULL_PRIVATE, f
    s = open(f, encoding='utf-8').read()
    before = s
    dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    if not dm:
        print(f'  {f:22} 辞書が無い → 触らない'); continue
    try:
        d = json.loads(dm.group(2))
    except Exception:
        print(f'  {f:22} 辞書がJSONでない → 触らない'); continue
    if set(d) != set(LANGS):
        print(f'  {f:22} 5言語そろっていない → 触らない'); continue
    dict_before = json.dumps(d, ensure_ascii=False, sort_keys=True)

    # ① 前回入れた分をいったん外す（付いていたら飛ばす、にしない）
    # 【罠】足した改行まで剥がさないと、流すたびに改行が1つずつ積み上がって冪等でなくなる
    s = re.sub(re.escape(MARK_S) + r'.*?' + re.escape(MARK_E) + r'\n?', '', s, flags=re.S)

    # ② 「コースと料金」の節の直前へ入れる
    i = s.find('data-i18n="s10"')
    if i < 0:
        print(f'  {f:22} 挿入点(s10)が見つからない → 触らない'); continue
    at = s.rfind('<section', 0, i)
    if at < 0:
        print(f'  {f:22} 節の開始が見つからない → 触らない'); continue
    s = s[:at] + BLOCK % {k[4:]: T[k]['ja'] for k in T} + '\n' + s[at:]

    # ③ 辞書へ（訳表を正とし、既にあっても上書きする）
    for k, v in T.items():
        for L in LANGS:
            d[L][k] = v[L]

    dict_after = json.dumps(d, ensure_ascii=False, sort_keys=True)
    if dict_after != dict_before:
        # 【罠】本文を足したぶん位置がずれる。辞書の位置は取り直す
        dm2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if not dm2:
            print(f'  {f:22} ★ 辞書を見失った → 書き戻さない'); continue
        s = s[:dm2.start()] + dm2.group(1) + dict_after + dm2.group(3) + s[dm2.end():]

    # ④ 書込み前のゲート
    seen, dup = {}, []
    for mm in re.finditer(r'data-i18n="([^"]+)"[^>]*>([^<]{1,240})<', s):
        k, t = mm.group(1), mm.group(2).strip()
        if k in seen and seen[k] != t:
            dup.append(k)
        seen.setdefault(k, t)
    if dup:
        print(f'  {f:22} ★ 同じキーに違う本文 {dup[:2]} → 書き戻さない'); continue
    j = s.find('window.SEAM_PAGE_I18N')
    if not (s.rfind('<script', 0, j) > s.rfind('</script>', 0, j)) or '</body>' not in s:
        print(f'  {f:22} ★ 構造が壊れた → 書き戻さない'); continue
    if not set(json.loads(dict_before)['ja']) <= set(d['ja']):
        print(f'  {f:22} ★ 既存キーが消えた → 書き戻さない'); continue
    if s.count(MARK_S) != 1 or s.count(MARK_E) != 1:
        print(f'  {f:22} ★ マーカーが1組でない → 書き戻さない'); continue
    if '。' in T['eye.p1']['ja'] + T['eye.p2']['ja'] + T['eye.p3']['ja']:
        print('  ★ 日本語に句点が混ざっている → 中止'); break

    if s == before:
        print(f'  {f:22} 変更なし'); continue
    open(f, 'w', encoding='utf-8').write(s)
    n += 1
    print(f'  {f:22} 追加')
print(f'  {n}枚')

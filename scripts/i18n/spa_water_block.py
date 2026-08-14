# SEAM: スパLPに「使う水」を書く（2026-08-11）
#
# 【なぜ】Bingで26クエリ測ったら、ヘッドスパ系はすべて圏外だった。
#   上位は headspa-zen / tokyo-ginza-spa / headconcierge / headspatokyo といった
#   ヘッドスパ専門の単目的サイト。可視文字数も SEAM 2,100 に対して 3,100〜5,300 ある。
#
#   一方で、**競合が誰も持っていない差別化がサイト内に眠っていた**。
#   `guide-mirai-soap.html`（MIRAI SOAP の機能水の話）がすでにあるのに、
#   **スパLP3枚からもハブの headspa.html からもリンクが0本**で、
#   「水素」「炭酸」「MIRAI」の語がスパLPに一度も出てこなかった。
#   検索で戦っているページに、いちばん強い素材が載っていない状態。
#
# 【薬機法】からだへの効果は書かない。
#   水の性質は**つくり手の技術説明として引用**し、体感は感覚語にとどめる
#   （[[seam-headspa-hydrogen.md]] の方針どおり）。
#   「還元力」「乳化力」はメーカーが自社の気体の個性をそう呼んでいる、という形で書く。
#
# 【文体】句点を打たない・読点は最小（[[seam-copy-style-rules]]）
#
# 冪等。マーカーで囲っているので2回流しても増えない。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)

MARK_S = '<!-- seam:spa-water:start -->'
MARK_E = '<!-- seam:spa-water:end -->'
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
PAGES = ['headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html']

TR = {
 'ja': {
  'water.eyebrow': 'The Water',
  'water.title': '手技の前に 使う水をえらんでいます',
  'water.lead': 'SEAMのヘッドスパで使うのは MIRAI SOAP の機能水です　神話の地・高千穂に湧く天然水をナノバブルで加工し そのすきまに水素と炭酸を練り込んだ水で 熱に弱い気体を守るため製法は非加熱です',
  'water.c1t': 'つくり手が呼ぶ 気体の個性',
  'water.c1b': '「水素の還元力 炭酸の乳化力」　メーカーが自社の水をそう説明しています',
  'water.c2t': '界面活性剤は約60%カット',
  'water.c2b': '泡はホイップのように濃厚で 摩擦が少なく 使う量も抑えられます',
  'water.c3t': '美容師の手を守るために生まれた',
  'water.c3b': '一日に何度もシャンプーをする 美容師の手のために開発された水です',
  'water.link': '水のはなしを読む →',
 },
 'en': {
  'water.eyebrow': 'The Water',
  'water.title': 'Before the hands, we choose the water',
  'water.lead': 'Our head spa uses MIRAI SOAP functional water. Natural spring water from Takachiho — a place of Japanese myth — is nano-bubbled, with hydrogen and carbonic acid worked into the gaps. It is never heated, so the gases stay intact.',
  'water.c1t': 'What the maker calls it',
  'water.c1b': '"The reducing power of hydrogen, the emulsifying power of carbonation" — the maker\'s own words for their water.',
  'water.c2t': 'About 60% less surfactant',
  'water.c2b': 'The lather is thick like whipped cream, so there is less friction and less product needed.',
  'water.c3t': 'Made to protect stylists\' hands',
  'water.c3b': 'It was developed for hairdressers who shampoo many times a day.',
  'water.link': 'Read the story of the water →',
 },
 'zh': {
  'water.eyebrow': 'The Water',
  'water.title': '在手技之前，我们先选水',
  'water.lead': 'SEAM的头皮SPA使用MIRAI SOAP的功能水。以神话之地高千穗涌出的天然水经纳米气泡加工，在其间隙中融入氢与碳酸。为保护不耐热的气体，制法为非加热。',
  'water.c1t': '制造者对气体个性的称呼',
  'water.c1b': '「氢的还原力，碳酸的乳化力」——这是厂商对自家水的说明。',
  'water.c2t': '表面活性剂减少约60%',
  'water.c2b': '泡沫如奶油般浓密，摩擦更少，用量也更省。',
  'water.c3t': '为守护美发师的手而生',
  'water.c3b': '这是为一天多次洗发的美发师的双手而开发的水。',
  'water.link': '阅读关于水的故事 →',
 },
 'tw': {
  'water.eyebrow': 'The Water',
  'water.title': '在手技之前，我們先選水',
  'water.lead': 'SEAM的頭皮SPA使用MIRAI SOAP的機能水。以神話之地高千穗湧出的天然水經奈米氣泡加工，在其間隙中融入氫與碳酸。為保護不耐熱的氣體，製法為非加熱。',
  'water.c1t': '製造者對氣體個性的稱呼',
  'water.c1b': '「氫的還原力，碳酸的乳化力」——這是廠商對自家水的說明。',
  'water.c2t': '界面活性劑減少約60%',
  'water.c2b': '泡沫如奶油般濃密，摩擦更少，用量也更省。',
  'water.c3t': '為守護美髮師的手而生',
  'water.c3b': '這是為一天多次洗髮的美髮師的雙手而開發的水。',
  'water.link': '閱讀關於水的故事 →',
 },
 'ko': {
  'water.eyebrow': 'The Water',
  'water.title': '손길보다 먼저, 물을 고릅니다',
  'water.lead': 'SEAM의 헤드스파에는 MIRAI SOAP의 기능수를 사용합니다. 신화의 땅 다카치호에서 솟는 천연수를 나노버블로 가공하고 그 틈에 수소와 탄산을 넣었습니다. 열에 약한 기체를 지키기 위해 비가열로 만듭니다.',
  'water.c1t': '만든 이가 부르는 기체의 개성',
  'water.c1b': '「수소의 환원력, 탄산의 유화력」 — 제조사가 자사의 물을 그렇게 설명합니다.',
  'water.c2t': '계면활성제 약 60% 감소',
  'water.c2b': '거품은 휘핑크림처럼 진하고 마찰이 적으며 사용량도 줄어듭니다.',
  'water.c3t': '미용사의 손을 지키기 위해 태어났습니다',
  'water.c3b': '하루에도 몇 번씩 샴푸를 하는 미용사의 손을 위해 개발된 물입니다.',
  'water.link': '물 이야기를 읽다 →',
 },
}

BLOCK = MARK_S + '''
    <section class="mt-12">
      <p class="font-mono text-[10px] tracking-widest2 text-gold" data-i18n="water.eyebrow">__eyebrow__</p>
      <h2 class="mt-1.5 font-serif text-[19px] text-ink" data-i18n="water.title">__title__</h2>
      <p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;" data-i18n="water.lead">__lead__</p>
      <div class="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div class="bg-cream border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="water.c1t">__c1t__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="water.c1b">__c1b__</p>
        </div>
        <div class="bg-cream border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="water.c2t">__c2t__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="water.c2b">__c2b__</p>
        </div>
        <div class="bg-cream border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="water.c3t">__c3t__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="water.c3b">__c3b__</p>
        </div>
      </div>
      <a href="guide-mirai-soap.html" class="mt-4 inline-block text-[12.5px] border-b border-line hover:text-ink" data-i18n="water.link">__link__</a>
    </section>''' + '\n    ' + MARK_E


def key_of(d, needles):
    for k, v in d['ja'].items():
        if k.startswith('meta.'):
            continue
        if any(n in re.sub(r'<[^>]+>', '', v) for n in needles):
            return k
    return None


for f in PAGES:
    s = open(f, encoding='utf-8').read()
    dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    d = json.loads(dm.group(2))

    blk = BLOCK
    for slot in re.findall(r'__([a-zA-Z0-9]+)__', BLOCK):
        blk = blk.replace(f'__{slot}__', TR['ja'][f'water.{slot}'])

    if MARK_S in s:
        s = re.sub(re.escape(MARK_S) + r'[\s\S]*?' + re.escape(MARK_E), lambda _: blk, s, count=1)
        msg = '更新'
    else:
        # 「当日の流れ」の節の直前に置く＝コースと料金のあと、流れの前
        k = key_of(d, ['当日の流れ'])
        assert k, f'{f}: 当日の流れが無い'
        at = s.find(f'data-i18n="{k}"')
        start = s.rfind('<section', 0, at)
        assert start > 0, f'{f}: sectionが見つからない'
        s = s[:start].rstrip('\n ') + '\n\n    ' + blk + '\n\n    ' + s[start:]
        msg = '追加'

    for L in LANGS:
        d[L].update(TR[L])
    dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    s = (s[:dm.start()] + dm.group(1)
         + json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
         + dm.group(3) + s[dm.end():])
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:22} {msg}')

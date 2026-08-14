# SEAM: サロンLP5枚に「先回り」と「色がきれいか」を足す（2026-08-14）
#
# 【なぜ】集客ページ136枚をレポートの基準で採点したら、サロンLP5枚だけ
#   ・先回りの気配り = 0件
#   ・カラーは「キレイ」= 0件
# だった。LPは検索と広告の着地先なのに、SEAM最大の武器(precare)が書かれていない。
#
# 【根拠】2万人レポート(2026-05・130サロン/2万人)
#   ・推薦者コメント 親切512 / 気遣い438 ＞ 会話が楽しい214・フレンドリー79
#     結論は「会話の上手さより、困る前に気づく接客が評価される」
#   ・推薦者コメントのメニュー別 カラー1286 は カット1742 に次ぐ2位
#   ・中立者は「染まっている」、推薦者は「色がきれい」と言う＝同じ施術でも言葉が変わる
#   ・カラーの不満1位は「色味がイメージと違う402」＝提案と説明の問題
#
# 【文体】句点を打たない・読点は最小（[[seam-copy-style-rules]]）
# 【薬機法】効能は断定しない
#
# 冪等。2回流しても増えない。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)
SLUGS = ['ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka']
CITY = {'ginza': '銀座', 'sapporo': '札幌', 'osaka': '大阪', 'nagoya': '名古屋', 'fukuoka': '福岡'}

TR = {
 'ja': {
  'lp.preT': '当日 たずねられるのは確認だけです',
  'lp.preB': 'ご予約のあと 今日のご希望をうかがうページをお送りします 強さも 香りも 気になっている場所も 落ち着いたところで選んでいただけます 席についてから思い出そうとしなくて大丈夫です',
  'lp.colT': '染まったか ではなく きれいに見えるか',
  'lp.colB': '同じ色でも 光の入り方で見え方は変わります 白髪をぼかすときも 暗くするだけにはしません お顔まわりの明るさとツヤの出かたまで見て決めます',
 },
 'en': {
  'lp.preT': 'On the day, we only confirm',
  'lp.preB': 'After you book we send you a page that asks what you would like today. Pressure, scent, the places that bother you — you can choose them somewhere calm. No need to remember it all once you are in the chair.',
  'lp.colT': 'Not whether it took, but whether it looks beautiful',
  'lp.colB': 'The same shade reads differently depending on how light falls on it. Even when covering greys we do not simply go darker. We decide by looking at the brightness around your face and how the shine sits.',
 },
 'zh': {
  'lp.preT': '当天 我们只做确认',
  'lp.preB': '预约后，我们会发送一个页面，询问您今天的期望。力度、香气、在意的部位，都可以在从容的地方慢慢选。坐上椅子后不必再努力回想。',
  'lp.colT': '不是染上了没有，而是看起来美不美',
  'lp.colB': '同样的颜色，光线不同看起来也不同。遮盖白发时，我们也不会只是一味调暗。会看您脸周的明度与光泽的呈现来决定。',
 },
 'tw': {
  'lp.preT': '當天 我們只做確認',
  'lp.preB': '預約後，我們會傳送一個頁面，詢問您今天的期望。力道、香氣、在意的部位，都可以在從容的地方慢慢選。坐上椅子後不必再努力回想。',
  'lp.colT': '不是染上了沒有，而是看起來美不美',
  'lp.colB': '同樣的顏色，光線不同看起來也不同。遮蓋白髮時，我們也不會只是一味調暗。會看您臉周的明度與光澤的呈現來決定。',
 },
 'ko': {
  'lp.preT': '당일에는 확인만 합니다',
  'lp.preB': '예약 후에 오늘의 희망을 여쭙는 페이지를 보내드립니다. 세기도 향도 신경 쓰이는 부위도 편안한 곳에서 고르실 수 있습니다. 자리에 앉으신 뒤에 떠올리려 애쓰지 않으셔도 됩니다.',
  'lp.colT': '물들었는지가 아니라, 예뻐 보이는지',
  'lp.colB': '같은 색이라도 빛이 닿는 방식에 따라 달라 보입니다. 새치를 가릴 때도 그저 어둡게만 하지 않습니다. 얼굴 주변의 밝기와 윤기가 나는 방식까지 보고 정합니다.',
 },
}

BLOCK = '''
        <!-- 先回りと 色の見え方（2万人レポートの学び・2026-08-14）
             ・推薦者が覚えているのは会話の上手さではなく「言う前に気づく気配り」
             ・カラーは中立者=染まっている / 推薦者=色がきれい と言葉が変わる -->
        <div class="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="bg-cream border border-line rounded-[12px] px-5 py-5">
            <p class="font-serif text-[15px] sm:text-[16px] text-ink font-medium leading-[1.6]" data-i18n="lp.preT">__PRE_T__</p>
            <p class="mt-2.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="lp.preB">__PRE_B__</p>
          </div>
          <div class="bg-cream border border-line rounded-[12px] px-5 py-5">
            <p class="font-serif text-[15px] sm:text-[16px] text-ink font-medium leading-[1.6]" data-i18n="lp.colT">__COL_T__</p>
            <p class="mt-2.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="lp.colB">__COL_B__</p>
          </div>
        </div>
'''

done = 0
for slug in SLUGS:
    f = f'salon-{slug}.html'
    if not os.path.exists(f):
        print(f'  {f:22} ファイル無し'); continue
    s = open(f, encoding='utf-8').read()
    if 'data-i18n="lp.preT"' in s:
        print(f'  {f:22} 既にあり'); continue

    # 「当日の流れ」の節の終わりに置く。無ければ予約CTAの手前
    m = re.search(r'(data-i18n="s17"[\s\S]{0,3000}?</section>)', s)
    if not m:
        print(f'  {f:22} ⚠ 当日の流れが見つからない'); continue
    blk = (BLOCK.replace('__PRE_T__', TR['ja']['lp.preT']).replace('__PRE_B__', TR['ja']['lp.preB'])
                .replace('__COL_T__', TR['ja']['lp.colT']).replace('__COL_B__', TR['ja']['lp.colB']))
    # </section> の直前に入れる（節の中に収める）
    end = m.end() - len('</section>')
    s = s[:end] + blk + s[end:]

    # 辞書（JSON様式）
    dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    d = json.loads(dm.group(2))
    for lang, kv in TR.items():
        assert lang in d, f'{f}: 言語 {lang} が無い'
        d[lang].update(kv)
    s = s[:dm.start()] + dm.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + dm.group(3) + s[dm.end():]

    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:22} 追加（{CITY[slug]}）')
    done += 1
print(f'\n{done} 枚に追加')

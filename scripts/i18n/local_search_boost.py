# SEAM: 各地の検索を強くする（2026-08-11）
#
# 【実測】DuckDuckGoで各地を測った結果
#   「{地名} 髪質改善」「{地名} ヘアサロン」「{地名} 美容室」「{地名} 縮毛矯正」… 全滅
#   当たっていたのは2つだけ 「銀座 ヘッドスパ 個室」7位 / 「名古屋 ヘッドスパ 個室」6位
#   しかもその2つは 旧サブドメイン ginza/nagoya.seam.site だった（今日301で本体へ向けた）
#
# 【なぜ当たっていたのが個室だけだったか】
#   当たった語には共通点がある ── 「個室」は競合が少なく SEAM が本当に持っているもの。
#   逆に「美容室」「ヘアサロン」は HPB と大手が埋めている土俵で 後発が同じ言葉で入っても勝てない。
#   つまり **勝てたのは 自分が持っているものを名乗ったときだけ** だった。
#
# 【ラッキーピエロの型】
#   函館のラッキーピエロはハンバーガーで全国チェーンと戦っていない。
#   「ここでしか食べられないもの」を名前で覚えさせ 地元の誇りと観光の必訪になった。
#   SEAM が同じ立ち方をするなら 名乗るのはこれ ──
#     完全個室 / 197のサロン専売ブランド / 凪（髪質改善）/ 首肩まで
#   どれも競合が言えない かつ SEAM が実際に持っている。
#
# 【この版でやること】3つ
#   A. サロンLP5枚の本文に「髪質改善」が ほぼ無かった（1,0,0,0,1回）ので 凪を移植する
#      → title に髪質改善を出す資格を 本文側に先に作る（本文が無い語をtitleに出すと直帰する）
#   B. title / description を 本文が支えられる語に組み替える（サロン5・スパ3）
#   C. メニュー見出しを「{地名}の料金例」にして 地名×料金の意図を拾う
#
# 【この版でやらないこと】
#   ・凪の価格は出さない（オーナー承認待ち・hairsalon と同じく「店舗によって異なります」）
#   ・多言語の title は触らない（海外向けは免税・個室で別に最適化済み）
#   ・H1「{地名}で髪を知る人に任せる」は変えない（オーナーの言葉・ブランドの声）
#
# 【罠】data-i18n の連番キーは店ごとにズレる
#   sapporo の s10 は受賞バッジ / nagoya の s10 は店舗説明 で 意味が揃っていない。
#   だから **キー番号では絶対に探さず 文言で探す**。
#
# 冪等。2回流しても増えない。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)

SALON = {
    'ginza':   ('銀座',   'SEAM GINZA',       '銀座・銀座一丁目・有楽町・京橋', '銀座一丁目駅 7番出口 徒歩1分'),
    'sapporo': ('札幌',   'SEAM SAPPORO',     '札幌・大通・狸小路・すすきの',   '地下鉄大通駅 徒歩1分'),
    'osaka':   ('大阪',   'SEAM OSAKA HORIE', '大阪・堀江・南堀江・心斎橋',     '四ツ橋駅 6番出口 徒歩2分'),
    'nagoya':  ('名古屋', 'SEAM NAGOYA',      '名古屋・栄・矢場町・大須',       '矢場町駅 すぐ'),
    'fukuoka': ('福岡',   'SEAM FUKUOKA',     '福岡・天神・大名・今泉',         '西鉄天神駅 徒歩5分'),
}
SPA = {
    'ginza':  ('銀座',   'SEAM GINZA',       '銀座・銀座一丁目・有楽町・京橋', '銀座一丁目駅 7番出口 徒歩1分', '¥12,000'),
    'nagoya': ('名古屋', 'SEAM NAGOYA',      '名古屋・栄・矢場町・大須',       '矢場町駅 すぐ',                 '¥8,800'),
    'osaka':  ('大阪',   'SEAM OSAKA HORIE', '大阪・堀江・南堀江・心斎橋',     '四ツ橋駅 6番出口 徒歩2分',      '¥11,800'),
}


def load(f):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    return s, m, json.loads(m.group(2))


def save(f, s, m, d):
    s = s[:m.start()] + m.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + m.group(3) + s[m.end():]
    open(f, 'w', encoding='utf-8').write(s)


def key_of(d, needle, lang='ja'):
    """文言からキーを引く。連番キーが店ごとにズレるので これ以外の探し方をしない"""
    for k, v in d[lang].items():
        if k.startswith('meta.'):
            continue
        if needle in re.sub(r'<[^>]+>', '', v):
            return k
    return None


# ── 凪（hairsalon.html から5言語ぶんそのまま持ってくる。JS単引用符様式なので正規表現で読む）
def read_nagi():
    t = open('hairsalon.html', encoding='utf-8').read()
    langs, cur = [], {}
    for m in re.finditer(r"'(nagi\.[A-Za-z0-9_]+)'\s*:\s*'((?:[^'\\]|\\.)*)'", t):
        k, v = m.group(1), m.group(2).replace("\\'", "'").replace('\\"', '"')
        if k in cur:            # eyebrow が再び出たら次の言語ブロック
            langs.append(cur); cur = {}
        cur[k] = v
    if cur:
        langs.append(cur)
    assert len(langs) == 5, f'凪の言語ブロックが5つでない: {len(langs)}'
    return dict(zip(['ja', 'en', 'zh', 'tw', 'ko'], langs))


NAGI = read_nagi()

NAGI_BLOCK = '''
    <!-- 凪＝髪質改善トリートメント（hairsalon.html から移植・2026-08-11）
         入れた理由: サロンLP5枚の本文に「髪質改善」がほぼ無く(1,0,0,0,1回)、
         この土地で髪質改善を探している人に返せるものがページ上に無かった。
         価格は載せない（オーナー承認待ち・各店で異なる） -->
    <section class="mt-12">
      <p class="font-mono text-[10px] tracking-widest2 text-gold" data-i18n="nagi.eyebrow">Nagi</p>
      <h2 class="mt-1.5 font-serif text-[19px] text-ink"><span data-i18n="nagi.title">凪</span> <span class="text-[13.5px] text-charcoal/70" data-i18n="nagi.sub">髪質改善トリートメント</span></h2>
      <p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;" data-i18n="nagi.lead">__LEAD__</p>
      <div class="mt-5 bg-cream border border-line rounded-[12px] px-5 py-4">
        <p class="text-[13px] text-ink font-medium" data-i18n="nagi.honestT">__HT__</p>
        <p class="mt-2 text-[12.5px] leading-[1.95] text-charcoal/70" data-i18n="nagi.honestB">__HB__</p>
      </div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="nagi.c1">__C1__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.c1d">__C1D__</p>
        </div>
        <div class="border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="nagi.c2">__C2__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.c2d">__C2D__</p>
        </div>
      </div>
      <p class="mt-3 text-[12px] text-charcoal/60" data-i18n="nagi.pick">__PICK__</p>
      <div class="mt-5 border-l-2 pl-4" style="border-color:#D9BE93;">
        <p class="text-[13px] text-ink font-medium" data-i18n="nagi.sameT">__ST__</p>
        <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.sameB">__SB__</p>
      </div>
      <p class="mt-4 text-[12px] text-charcoal/60" data-i18n="nagi.foot">__FOOT__</p>
    </section>
'''

SLOT = {'__LEAD__': 'nagi.lead', '__HT__': 'nagi.honestT', '__HB__': 'nagi.honestB',
        '__C1__': 'nagi.c1', '__C1D__': 'nagi.c1d', '__C2__': 'nagi.c2', '__C2D__': 'nagi.c2d',
        '__PICK__': 'nagi.pick', '__ST__': 'nagi.sameT', '__SB__': 'nagi.sameB', '__FOOT__': 'nagi.foot'}


def add_nagi(f, s, d):
    if 'data-i18n="nagi.lead"' in s:
        return s, '凪=既にあり'
    k = key_of(d, '当日の流れ')
    if not k:
        return s, '⚠ 当日の流れが無い'
    at = s.find(f'data-i18n="{k}"')
    start = s.rfind('<section', 0, at)       # その節の開始タグまで戻る
    if start < 0:
        return s, '⚠ section が見つからない'
    blk = NAGI_BLOCK
    for slot, key in SLOT.items():
        blk = blk.replace(slot, NAGI['ja'][key])
    s = s[:start] + blk.strip('\n') + '\n\n    ' + s[start:]
    for lang in ['ja', 'en', 'zh', 'tw', 'ko']:
        assert lang in d, f'{f}: {lang} が無い'
        d[lang].update(NAGI[lang])
    return s, '凪=追加'


# ── 実行
print('■ サロンLP 5枚')
for slug, (city, name, area, station) in SALON.items():
    f = f'salon-{slug}.html'
    s, m, d = load(f)
    s, nagi_msg = add_nagi(f, s, d)
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)  # 挿入で位置がずれた

    title = f'{city}の縮毛矯正・髪質改善・カラー｜完全個室 {name}'
    desc = (f'{city}で縮毛矯正・髪質改善・カラーができる完全個室の美容室｜'
            f'{area}エリアの{name}｜197のサロン専売ブランドを知るプロが担当します｜{station}')
    d['ja']['meta.title'] = title
    d['ja']['meta.description'] = desc

    # メニュー見出し（存在する店だけ・キー番号では探さない）
    mk = key_of(d, 'この店舗のメニュー例')
    menu_msg = 'メニュー見出し=無し'
    if mk:
        d['ja'][mk] = f'{city}の料金例'
        for lang, txt in [('en', f'Example prices in {city}'), ('zh', f'{city}的价格示例'),
                          ('tw', f'{city}的價格範例'), ('ko', f'{city} 요금 예시')]:
            if mk in d.get(lang, {}):
                d[lang][mk] = txt
        menu_msg = f'メニュー見出し={mk}'

    save(f, s, m, d)
    # <head> の実体も揃える（辞書だけ直すと日本語表示に戻したとき食い違う）
    s2 = open(f, encoding='utf-8').read()
    s2 = re.sub(r'(<title>)[^<]*(</title>)', lambda o: o.group(1) + title + o.group(2), s2, count=1)
    s2 = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda o: o.group(1) + desc + o.group(2), s2, count=1)
    open(f, 'w', encoding='utf-8').write(s2)
    print(f'  {f:20} {nagi_msg} / {menu_msg}')
    print(f'    → {title}')

print('\n■ スパLP 3枚')
for slug, (city, name, area, station, price) in SPA.items():
    f = f'headspa-{slug}.html'
    s, m, d = load(f)
    title = f'{city}のヘッドスパ｜首肩までほどける完全個室 {name}'
    desc = (f'{city}で首肩までほどける完全個室のヘッドスパ｜{area}エリアの{name}｜'
            f'{price}〜のコースをスパニストが担当します｜{station}')
    d['ja']['meta.title'] = title
    d['ja']['meta.description'] = desc
    save(f, s, m, d)
    s2 = open(f, encoding='utf-8').read()
    s2 = re.sub(r'(<title>)[^<]*(</title>)', lambda o: o.group(1) + title + o.group(2), s2, count=1)
    s2 = re.sub(r'(<meta name="description" content=")[^"]*(")', lambda o: o.group(1) + desc + o.group(2), s2, count=1)
    open(f, 'w', encoding='utf-8').write(s2)
    print(f'  {f:20} → {title}')

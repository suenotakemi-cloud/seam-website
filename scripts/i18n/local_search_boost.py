# SEAM: 各地の検索を強くする（2026-08-11・v2）
#
# 【実測】DuckDuckGoで各地を測ったところ
#   「{地名} 髪質改善」「{地名} ヘアサロン」「{地名} 美容室」「{地名} 縮毛矯正」は全滅。
#   当たっていたのは「銀座 ヘッドスパ 個室」7位 と「名古屋 ヘッドスパ 個室」6位 の2つだけで、
#   しかもその2つは旧サブドメイン ginza/nagoya.seam.site だった。
#
# 【なぜ個室だけ当たっていたか】
#   「個室」は競合が少なく SEAM が本当に持っているもの。
#   「美容室」「ヘアサロン」は HPB と大手が埋めている土俵で、後発が同じ言葉で入っても勝てない。
#   勝てていたのは、自分が持っているものを名乗ったときだけだった。
#
# ─────────────────────────────────────────────────────────
# 【v2 で直したこと】v1 は再実行すると事実誤認を本番に戻す危険があった
#
#   🔴 v1は STORES に実態を持っておらず、全店を「完全個室」「ヘア営業中」として扱っていた。
#      実際の修正は使い捨てスクリプトで後から当てたので、**このファイルを再実行すると
#      札幌・福岡が「完全個室」に戻り、名古屋にヘア施術のtitleと凪が復活する**状態だった。
#      → 実態を下の STORES に持たせ、このファイル単体で正しい状態に収束するようにした。
#
#   🔴 v1はメニュー見出しを辞書だけ書き換え、HTML本文を放置していた。
#      本番のja版は `data-i18n="s10">この店舗のメニュー例` のまま古い文言を返していた。
#      → 本文も同時に書き換える。
#
#   🔴 v1は見出しの多言語に日本語の地名をそのまま埋めていた。
#      本番の英語版が「Example prices in 銀座」、韓国語版が「銀座 요금 예시」になっていた。
#      → 地名の各言語表記は store-*.html の既存辞書から取った実績値を使う。
# ─────────────────────────────────────────────────────────
#
# 【この版でやらないこと】
#   ・凪の価格は出さない（オーナー承認待ち・hairsalon と同じく「店舗によって異なります」）
#   ・多言語の meta.title は触らない（海外向けは免税・個室で別に最適化済み）
#   ・H1「{地名}で髪を知る人に任せる」は変えない（オーナーの言葉・ブランドの声）
#
# 【罠】data-i18n の連番キーは店ごとにズレる
#   sapporo の s10 は受賞バッジ / nagoya の s10 は店舗説明 で意味が揃っていない。
#   だから **キー番号では絶対に探さず 文言で探す**。
#
# 冪等。何回流しても同じ状態に収束する。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)

# 地名の各言語表記。勝手に作らず store-*.html の既存辞書から取った実績値。
CITY = {
    'ginza':   {'ja': '銀座',   'en': 'Ginza',   'zh': '银座',   'tw': '銀座',   'ko': '긴자'},
    'sapporo': {'ja': '札幌',   'en': 'Sapporo', 'zh': '札幌',   'tw': '札幌',   'ko': '삿포로'},
    'osaka':   {'ja': '大阪',   'en': 'Osaka',   'zh': '大阪',   'tw': '大阪',   'ko': '오사카'},
    'nagoya':  {'ja': '名古屋', 'en': 'Nagoya',  'zh': '名古屋', 'tw': '名古屋', 'ko': '나고야'},
    'fukuoka': {'ja': '福岡',   'en': 'Fukuoka', 'zh': '福冈',   'tw': '福岡',   'ko': '후쿠오카'},
}

# 🔴 店の実態。ここが唯一の正。titleに書く語はすべてここから引く。
#   room  : 個室の実態。**札幌と福岡は半個室**（サイトのFAQにも明記されている）
#           一度これを「完全個室」と書いて嘘になった。実態と違う語をtitleに出さない。
#   hair  : ヘアサロンが予約を受けられるか。**名古屋は受付休止中**（スパとショップは通常営業）
#           休止中の店に施術名を名乗らせると、受けられない予約へ人を送ることになる。
SALON = {
    'ginza':   dict(name='SEAM GINZA',       room='完全個室', hair=True,
                    area='銀座・銀座一丁目・有楽町・京橋',   station='銀座一丁目駅 7番出口 徒歩1分'),
    'sapporo': dict(name='SEAM SAPPORO',     room='半個室',   hair=True,
                    area='札幌・大通・狸小路・すすきの',     station='地下鉄大通駅 徒歩1分'),
    'osaka':   dict(name='SEAM OSAKA HORIE', room='完全個室', hair=True,
                    area='大阪・堀江・南堀江・心斎橋',       station='四ツ橋駅 6番出口 徒歩2分'),
    'nagoya':  dict(name='SEAM NAGOYA',      room='完全個室', hair=False,
                    area='名古屋・栄・矢場町・大須',         station='矢場町駅 すぐ'),
    'fukuoka': dict(name='SEAM FUKUOKA',     room='半個室',   hair=True,
                    area='福岡・天神・大名・今泉',           station='西鉄天神駅 徒歩5分'),
}
SPA = {
    'ginza':  dict(name='SEAM GINZA',       area='銀座・銀座一丁目・有楽町・京橋',
                   station='銀座一丁目駅 7番出口 徒歩1分', price='¥12,000'),
    'nagoya': dict(name='SEAM NAGOYA',      area='名古屋・栄・矢場町・大須',
                   station='矢場町駅 すぐ',                 price='¥8,800'),
    'osaka':  dict(name='SEAM OSAKA HORIE', area='大阪・堀江・南堀江・心斎橋',
                   station='四ツ橋駅 6番出口 徒歩2分',      price='¥11,800'),
}

LANGS = ['ja', 'en', 'zh', 'tw', 'ko']


def load(f):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    return s, json.loads(m.group(2))


def put_dict(s, d):
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    return s[:m.start()] + m.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + m.group(3) + s[m.end():]


def key_of(d, needles, lang='ja'):
    """文言からキーを引く。連番キーが店ごとにズレるので これ以外の探し方をしない。
    再実行で文言が変わっている場合もあるので 旧文言と新文言の両方を受ける。"""
    for k, v in d[lang].items():
        if k.startswith('meta.'):
            continue
        plain = re.sub(r'<[^>]+>', '', v)
        if any(n in plain for n in needles):
            return k
    return None


def set_meta(s, d, title, desc):
    """title / description を ja辞書から <title> / meta / og / JSON-LD の4面に配る。
    【罠】og:description は meta description と別タグ。片方だけ直すと食い違う。
          JSON-LD の description は WebPage ノードにあり 正規表現でなくJSONで書き換える。"""
    d['ja']['meta.title'] = title
    d['ja']['meta.description'] = desc
    s = put_dict(s, d)
    s = re.sub(r'(<title>)[^<]*(</title>)', lambda o: o.group(1) + title + o.group(2), s, count=1)
    for attr, key, val in [('name', 'description', desc), ('property', 'og:title', title),
                           ('property', 'og:description', desc)]:
        s = re.sub(r'(<meta ' + attr + r'="' + re.escape(key) + r'" content=")[^"]*(")',
                   lambda o, v=val: o.group(1) + v.replace('"', '&quot;') + o.group(2), s, count=1)
    m = re.search(r'(<script type="application/ld\+json">)([\s\S]*?)(</script>)', s)
    if m:
        o = json.loads(m.group(2))

        def walk(n):
            if isinstance(n, dict):
                if 'WebPage' in ([].__class__(n.get('@type')) if isinstance(n.get('@type'), list) else [n.get('@type')]):
                    if 'description' in n: n['description'] = desc
                    if 'name' in n:        n['name'] = title
                for v in n.values(): walk(v)
            elif isinstance(n, list):
                for v in n: walk(v)
        walk(o)
        s = s[:m.start()] + m.group(1) + json.dumps(o, ensure_ascii=False, separators=(',', ':')) + m.group(3) + s[m.end():]
    return s


# ── 凪（hairsalon.html から5言語ぶんそのまま持ってくる。JS単引用符様式なので正規表現で読む）
def read_nagi():
    t = open('hairsalon.html', encoding='utf-8').read()
    blocks, cur = [], {}
    for m in re.finditer(r"'(nagi\.[A-Za-z0-9_]+)'\s*:\s*'((?:[^'\\]|\\.)*)'", t):
        k, v = m.group(1), m.group(2).replace("\\'", "'").replace('\\"', '"')
        if k in cur:
            blocks.append(cur); cur = {}
        cur[k] = v
    if cur:
        blocks.append(cur)
    assert len(blocks) == 5, f'凪の言語ブロックが5つでない: {len(blocks)}'
    return dict(zip(LANGS, blocks))


NAGI = read_nagi()

# 締め行だけ差し替える。hairsalon（全店まとめ）の「店舗によって異なります 各店の料金をご覧ください」は、
# その店にいる人に「各店を見て」と言うことになり 店舗LPでは意味が通らない。
NAGI_FOOT = {
    'ja': '凪の料金は最新のメニューでご確認ください　ご予約のときにご相談いただけます',
    'en': 'Please see the latest menu for Nagi pricing. You are welcome to ask when you book.',
    'zh': '凪的价格请见最新菜单　预约时也可以咨询。',
    'tw': '凪的價格請見最新菜單　預約時也可以諮詢。',
    'ko': '凪의 요금은 최신 메뉴에서 확인해 주세요　예약하실 때 상담하실 수 있습니다.',
}

NAGI_OPEN = '<!-- 凪＝髪質改善トリートメント'
NAGI_BLOCK = '''<!-- 凪＝髪質改善トリートメント（hairsalon.html から移植・2026-08-11）
         入れた理由: サロンLP5枚の本文に「髪質改善」がほぼ無く(1,0,0,0,1回)、
         この土地で髪質改善を探している人に返せるものがページ上に無かった。
         価格は載せない（オーナー承認待ち・各店で異なる） -->
    <section class="mt-12">
      <p class="font-mono text-[10px] tracking-widest2 text-gold" data-i18n="nagi.eyebrow">Nagi</p>
      <h2 class="mt-1.5 font-serif text-[19px] text-ink"><span data-i18n="nagi.title">凪</span> <span class="text-[13.5px] text-charcoal/70" data-i18n="nagi.sub">髪質改善トリートメント</span></h2>
      <p class="mt-3 text-[13.5px] text-charcoal/80" style="line-height:2;" data-i18n="nagi.lead">__lead__</p>
      <div class="mt-5 bg-cream border border-line rounded-[12px] px-5 py-4">
        <p class="text-[13px] text-ink font-medium" data-i18n="nagi.honestT">__honestT__</p>
        <p class="mt-2 text-[12.5px] leading-[1.95] text-charcoal/70" data-i18n="nagi.honestB">__honestB__</p>
      </div>
      <div class="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="nagi.c1">__c1__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.c1d">__c1d__</p>
        </div>
        <div class="border border-line rounded-[12px] px-5 py-4">
          <p class="text-[13px] text-ink font-medium" data-i18n="nagi.c2">__c2__</p>
          <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.c2d">__c2d__</p>
        </div>
      </div>
      <p class="mt-3 text-[12px] text-charcoal/60" data-i18n="nagi.pick">__pick__</p>
      <div class="mt-5 border-l-2 pl-4" style="border-color:#D9BE93;">
        <p class="text-[13px] text-ink font-medium" data-i18n="nagi.sameT">__sameT__</p>
        <p class="mt-1.5 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.sameB">__sameB__</p>
      </div>
      <p class="mt-4 text-[12px] text-charcoal/60" data-i18n="nagi.foot">__foot__</p>
    </section>'''


JOIN = '\n\n    '   # 節と節のあいだの正規の継ぎ目


def drop_nagi(s, d):
    """凪を外す。ヘア休止中の店に髪質改善を名乗らせないため。
    継ぎ目を JOIN にそろえるのが肝。切り貼りの前後で空白の残り方が変わると、
    「変更前から流したとき」と「今の状態から流したとき」で別の結果に落ちる（実際そうなった）。"""
    changed = False
    i = s.find(NAGI_OPEN)
    if i >= 0:
        i = s.rfind('\n', 0, i) + 1                     # その行の頭から切る（前のインデントごと）
        j = s.find('</section>', s.find('data-i18n="nagi.foot"')) + len('</section>')
        s = s[:i].rstrip('\n ') + JOIN + s[j:].lstrip('\n ')
        changed = True
    for L in LANGS:
        for k in [k for k in d.get(L, {}) if k.startswith('nagi.')]:
            del d[L][k]; changed = True
    return s, d, changed


def normalize_join(s, d):
    """凪を置く（置いた）場所の継ぎ目を JOIN にそろえる。
    凪を載せない店でも呼ぶ。使い捨てスクリプトで手作業に外した跡が残っていると、
    このファイルが触らない空白が食い違ったまま残り、収束を確かめられなくなる。"""
    k = key_of(d, ['当日の流れ'])
    if not k:
        return s
    at = s.find(f'data-i18n="{k}"')
    start = s.rfind('<section', 0, at)
    if start < 0:
        return s
    return s[:start].rstrip('\n ') + JOIN + s[start:]


def render_nagi():
    blk = NAGI_BLOCK
    for slot in re.findall(r'__([a-zA-Z0-9]+)__', NAGI_BLOCK):
        val = NAGI_FOOT['ja'] if slot == 'foot' else NAGI['ja'][f'nagi.{slot}']
        blk = blk.replace(f'__{slot}__', val)
    return blk


def add_nagi(s, d):
    """既にある場合も正規の形に置き換える。
    「あればスキップ」にすると、このファイルのブロックを直しても既存ページに反映されず、
    どこから流したかで結果が変わる（実際に、v1が入れた版とインデントが食い違った）。"""
    s, d, _ = drop_nagi(s, d)                 # いったん更地にしてから置く＝どの状態からでも同じ形になる
    k = key_of(d, ['当日の流れ'])
    if not k:
        return s, d, '⚠ 当日の流れが無い'
    at = s.find(f'data-i18n="{k}"')
    start = s.rfind('<section', 0, at)        # その節の開始タグまで戻る
    if start < 0:
        return s, d, '⚠ section が見つからない'
    s = s[:start].rstrip('\n ') + JOIN + render_nagi() + JOIN + s[start:]
    for L in LANGS:                            # 辞書もそろえ直す（締め行の差し替えを含む）
        assert L in d, f'{L} が無い'
        d[L].update(NAGI[L])
        d[L]['nagi.foot'] = NAGI_FOOT[L]
    return s, d, '凪'


# ══ 実行
print('■ サロンLP 5枚')
for slug, st in SALON.items():
    f = f'salon-{slug}.html'
    s, d = load(f)
    c = CITY[slug]

    if st['hair']:
        s, d, nmsg = add_nagi(s, d)
        # 本文が支えられる語だけを書く。room は STORES の実態から引く（勝手に完全個室と書かない）
        title = f"{c['ja']}の縮毛矯正・髪質改善・カラー｜{st['room']}の美容室 {st['name']}"
        desc = (f"{c['ja']}で縮毛矯正・髪質改善・カラーができる{st['room']}の美容室｜"
                f"{st['area']}エリアの{st['name']}｜197のサロン専売ブランドを知るプロが担当します｜{st['station']}")
    else:
        # ヘアが受付休止中の店。施術名を名乗らない。
        # headspa-{slug}（ヘッドスパ）と store-{slug}（サロン専売）とも食い合わない語を選ぶ。
        s, d, dropped = drop_nagi(s, d)
        s = normalize_join(s, d)
        nmsg = '凪を外した（ヘア休止中）' if dropped else '凪なし（ヘア休止中）'
        title = f"{st['name']} {c['ja']} 栄・矢場町｜ヘッドスパとヘアケアの店"
        desc = (f"{c['ja']} 栄・矢場町の{st['name']}｜ヘアサロンは現在受付を休止しています　"
                f"ヘッドスパと197のサロン専売ブランドのショップは通常どおり営業しています｜{st['station']}｜営業時間 11:00–19:00")

    s = set_meta(s, d, title, desc)

    # メニュー見出し（在る店だけ）。**辞書とHTML本文の両方**を直す。
    # 辞書だけ直すと ja版の初期HTMLが古い文言のまま返る（v1でやらかした）。
    mk = key_of(d, ['この店舗のメニュー例', 'の料金例'])
    hmsg = 'メニュー見出しなし'
    if mk:
        heads = {'ja': f"{c['ja']}の料金例", 'en': f"Example prices in {c['en']}",
                 'zh': f"{c['zh']}的价格示例", 'tw': f"{c['tw']}的價格範例", 'ko': f"{c['ko']} 요금 예시"}
        for L in LANGS:
            if mk in d.get(L, {}):
                d[L][mk] = heads[L]
        s = put_dict(s, d)
        s, n = re.subn(r'(data-i18n="' + re.escape(mk) + r'">)[^<]*', lambda o: o.group(1) + heads['ja'], s, count=1)
        assert n == 1, f'{f}: 見出し {mk} の本文を置換できなかった'
        hmsg = f'見出し {mk}（本文も同期）'

    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:20} {nmsg} / {hmsg}')
    print(f'    → {title}')

print('\n■ スパLP 3枚')
for slug, st in SPA.items():
    f = f'headspa-{slug}.html'
    s, d = load(f)
    c = CITY[slug]
    # 「首肩まで」は店のメニュー名（首肩までほどけるクリームヘッドスパ）から取った実文言。
    title = f"{c['ja']}のヘッドスパ｜首肩までほどける完全個室 {st['name']}"
    desc = (f"{c['ja']}で首肩までほどける完全個室のヘッドスパ｜{st['area']}エリアの{st['name']}｜"
            f"{st['price']}〜のコースをスパニストが担当します｜{st['station']}")
    s = set_meta(s, d, title, desc)
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:20} → {title}')

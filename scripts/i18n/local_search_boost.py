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
    # sort_keys=True にしている理由:
    #   キーの並びは辞書の意味に一切関係ない（build-i18n はJSONとして読む）のに、
    #   足す順番が実行経路で変わるため「変更前から流した結果」と「今から流した結果」が
    #   バイト一致しなくなっていた。並べてしまえば、どこから流しても同じになる。
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    body = json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    return s[:m.start()] + m.group(1) + body + m.group(3) + s[m.end():]


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

# 「できることと できないこと」を2列で先に見せるための文言。
# **新しい約束はしない**。nagi.honestB（オーナー承認済み）を分けただけ。
#   原文: 波のようにうねって広がる髪は かなり変わります
#         しっかり巻いたカールは のびません そこは正直にお伝えします
#         まっすぐにしたい方には 縮毛矯正のほうが向いています
NAGI_FIT = {
    'ja': ('向いている髪', '波のようにうねって広がる髪　湿気の日にふくらむ髪',
           '向いていない髪', 'しっかり巻いたカール　まっすぐにしたい方は縮毛矯正のほうが向いています'),
    'en': ('Suited to', 'Hair that waves and swells, and hair that puffs up on humid days',
           'Not suited to', 'A firm curl. If you want it straight, a straightening treatment suits you better.'),
    'zh': ('适合的发质', '像波浪般起伏、膨胀的头发，以及潮湿天里会膨胀的头发',
           '不适合的发质', '卷度明显的卷发。若您希望头发笔直，缩毛矫正更适合您。'),
    'tw': ('適合的髮質', '像波浪般起伏、膨脹的頭髮，以及潮濕天裡會膨脹的頭髮',
           '不適合的髮質', '捲度明顯的捲髮。若您希望頭髮筆直，縮毛矯正更適合您。'),
    'ko': ('어울리는 모발', '물결처럼 굽이치며 퍼지는 머리, 습한 날 부푸는 머리',
           '어울리지 않는 모발', '확실하게 말린 컬. 곧게 펴고 싶으시다면 매직 스트레이트가 더 맞습니다.'),
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
      <!-- 「できることと できないこと」を散文でなく2列で見せる。
           文章だけだと読むほど説明書に見えてくる、というレビュー指摘への対応。
           見出し(honestT)は残し、散文(honestB)は2列に分解した＝**新しい約束はしていない**。 -->
      <p class="mt-5 text-[13px] text-ink font-medium" data-i18n="nagi.honestT">__honestT__</p>
      <div class="mt-2.5 grid grid-cols-2 gap-3">
        <div class="rounded-[12px] px-4 py-4" style="border:1px solid rgba(184,148,90,.42);background:rgba(184,148,90,.06);">
          <p class="flex items-center gap-1.5 text-[11px] tracking-widest2" style="color:#8A6A3C;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
            <span data-i18n="nagi.fitT">__fitT__</span>
          </p>
          <p class="mt-2 text-[12.5px] leading-[1.9] text-charcoal/80" data-i18n="nagi.fitB">__fitB__</p>
        </div>
        <div class="rounded-[12px] px-4 py-4 border border-line">
          <p class="flex items-center gap-1.5 text-[11px] tracking-widest2 text-charcoal/60">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>
            <span data-i18n="nagi.unfitT">__unfitT__</span>
          </p>
          <p class="mt-2 text-[12.5px] leading-[1.9] text-charcoal/70" data-i18n="nagi.unfitB">__unfitB__</p>
        </div>
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


FIT_SLOT = {'fitT': 0, 'fitB': 1, 'unfitT': 2, 'unfitB': 3}


def nagi_val(slot, lang):
    if slot == 'foot':
        return NAGI_FOOT[lang]
    if slot in FIT_SLOT:
        return NAGI_FIT[lang][FIT_SLOT[slot]]
    return NAGI[lang][f'nagi.{slot}']


def render_nagi():
    blk = NAGI_BLOCK
    for slot in re.findall(r'__([a-zA-Z0-9]+)__', NAGI_BLOCK):
        blk = blk.replace(f'__{slot}__', nagi_val(slot, 'ja'))
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
    for L in LANGS:                            # 辞書もそろえ直す（締め行と2列比較を含む）
        assert L in d, f'{L} が無い'
        d[L].update(NAGI[L])
        d[L]['nagi.foot'] = NAGI_FOOT[L]
        for slot in FIT_SLOT:
            d[L][f'nagi.{slot}'] = nagi_val(slot, L)
        d[L].pop('nagi.honestB', None)     # 散文は2列に分解したので使わない（孤児キーを残さない）
    return s, d, '凪'


# ── ヘア休止中の店のヒーローと休止告知
#
# 【2026-08-11 に見つけた矛盾】休止のお知らせのすぐ上のリード文が
#   「カット・カラー・パーマ・縮毛矯正・トリートメントまで … 完全個室で仕上げます」
#   のままだった。受けられない施術を約束してから、その下で休止を告げていた。
#   見た目の弱さより、こちらのほうが重い。
#
# 【告知の見え方】薄い枠の小さな本文で、店舗紹介カードの一つに見えていた。
#   一方で画面下には「ヘッドスパを予約」の固定CTAがある。
#   → ラベル＋見出し＋本文の3段にして、何が休みで何が開いているかを一目で分ける。
#   赤い警告にはしない。金とクリームのままで十分伝わる。
PAUSED_LEAD = {
    'ja': '矢場町駅からすぐ 栄・大須・上前津からも歩ける栄エリアです<br>ヘッドスパと 197のサロン専売ブランドのショップをご用意しています',
    'en': 'Right by Yabacho Station, within walking distance of Sakae, Osu and Kamimaezu.<br>Here you will find our head spa and a shop carrying 197 salon-exclusive brands.',
    'zh': '矢场町站近在咫尺，从荣、大须、上前津步行可达。<br>这里为您准备了头部水疗与汇集197个沙龙专售品牌的商店。',
    'tw': '矢場町站近在咫尺，從榮、大須、上前津步行可達。<br>這裡為您準備了頭部水療與匯集197個沙龍專售品牌的商店。',
    'ko': '야바초역 바로 앞, 사카에·오스·가미마에즈에서도 걸어오실 수 있습니다.<br>헤드스파와 197개 살롱 전용 브랜드의 숍을 준비하고 있습니다.',
}
PAUSED = {
    'ja': ('ヘアサロン', '受付休止中', 'ヘッドスパとサロン専売品のショップは 通常どおり営業しています'),
    'en': ('Hair salon', 'Bookings paused', 'Our head spa and the salon-exclusive shop are open as usual.'),
    'zh': ('美发沙龙', '暂停接受预约', '头部水疗与沙龙专售商品的商店照常营业。'),
    'tw': ('美髮沙龍', '暫停接受預約', '頭部水療與沙龍專售商品的商店照常營業。'),
    'ko': ('헤어살롱', '예약 접수 중지', '헤드스파와 살롱 전용 제품 숍은 평소대로 영업하고 있습니다.'),
}
PAUSE_MARK = '<!-- seam:paused-notice -->'
PAUSE_BLOCK = PAUSE_MARK + '''<div class="mt-6 rounded-[10px] px-4 py-4" style="border:1px solid rgba(184,148,90,.42);background:rgba(184,148,90,.06);">
      <p class="flex items-center gap-2 text-[11px] tracking-widest2" style="color:#B8945A;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.2l3 1.8"/></svg>
        <span data-i18n="pause.label">__LABEL__</span>
      </p>
      <p class="mt-1.5 font-serif text-[15.5px] text-ink" data-i18n="pause.title">__TITLE__</p>
      <p class="mt-1.5 text-[13px]" style="color:#6B6358;line-height:1.95;" data-i18n="pause.body">__BODY__</p>
    </div>'''


# 休止中なのに「お受けしています」と言い切っていた2箇所（本文とFAQの回答）。
# ページ全体を書き替えるのではなく、**受けられないと言い切っている嘘だけ**を正す。
PAUSED_OFFER = {
    'ja': 'ヘアサロンは現在受付を休止しています　ヘッドスパと197のサロン専売ブランドのショップは通常どおり営業しています　最新の情報はホットペッパービューティーでご確認ください',
    'en': 'Hair salon bookings are currently paused. Our head spa and the shop carrying 197 salon-exclusive brands are open as usual. Please see Hot Pepper Beauty for the latest.',
    'zh': '美发沙龙目前暂停接受预约。头部水疗与汇集197个沙龙专售品牌的商店照常营业。最新信息请见Hot Pepper Beauty。',
    'tw': '美髮沙龍目前暫停接受預約。頭部水療與匯集197個沙龍專售品牌的商店照常營業。最新資訊請見Hot Pepper Beauty。',
    'ko': '헤어살롱은 현재 예약 접수를 중지하고 있습니다. 헤드스파와 197개 살롱 전용 브랜드의 숍은 평소대로 영업합니다. 최신 정보는 핫페퍼뷰티에서 확인해 주세요.',
}
PAUSED_FAQ_Q = {
    'ja': 'いまヘアサロンの予約はできますか',
    'en': 'Can I book the hair salon right now?',
    'zh': '现在可以预约美发沙龙吗',
    'tw': '現在可以預約美髮沙龍嗎',
    'ko': '지금 헤어살롱을 예약할 수 있나요',
}
PAUSED_FAQ_A = {
    'ja': 'ヘアサロンは受付を休止しています　ヘッドスパとサロン専売品のショップは通常どおり営業していますので そちらはご予約・ご来店いただけます',
    'en': 'Hair salon bookings are paused. Our head spa and the salon-exclusive shop are open as usual, so you are welcome to book or drop in for those.',
    'zh': '美发沙龙暂停接受预约。头部水疗与沙龙专售商品的商店照常营业，欢迎预约或到店。',
    'tw': '美髮沙龍暫停接受預約。頭部水療與沙龍專售商品的商店照常營業，歡迎預約或到店。',
    'ko': '헤어살롱은 예약 접수를 중지하고 있습니다. 헤드스파와 살롱 전용 제품 숍은 평소대로 영업하고 있으니 예약하시거나 들러 주세요.',
}


def swap_text(s, key, ja):
    """data-i18n の要素の中身を差し替える。中にタグを含む場合もあるので閉じタグまで見る。"""
    m = re.search(r'(data-i18n="' + re.escape(key) + r'"[^>]*>)([\s\S]*?)(</(?:p|span|h2|h3|li|div|summary)>)', s)
    if not m:
        return s, False
    return s[:m.start()] + m.group(1) + ja + m.group(3) + s[m.end():], True


def fix_paused_hero(f, s, d):
    # ① リード文から受けられない施術を消す
    lead_k = key_of(d, ['カット・カラー・パーマ'])
    if lead_k:
        for L in LANGS:
            d[L][lead_k] = PAUSED_LEAD[L]
        s = re.sub(r'(data-i18n="' + re.escape(lead_k) + r'">)[\s\S]*?(</p>)',
                   lambda o: o.group(1) + PAUSED_LEAD['ja'] + o.group(2), s, count=1)

    # ①-2 FAQ を先に処理する。設問→回答は**HTML上の並び**で特定する。
    #     値の一致で探すと、同じ文言に置き換えた別の要素を拾って本文とFAQが入れ替わる
    #     （最初の実装で実際にそうなった）。
    qk = key_of(d, ['縮毛矯正やパーマもできますか', 'いまヘアサロンの予約はできますか'])
    if qk:
        for L in LANGS:
            d[L][qk] = PAUSED_FAQ_Q[L]
        # 設問は <summary> 内で ＋ 記号を伴うのでテキストノードだけ差し替える
        s = re.sub(r'(data-i18n="' + re.escape(qk) + r'"[^>]*>)([^<]*)',
                   lambda o: o.group(1) + PAUSED_FAQ_Q['ja'], s, count=1)
        # 設問の直後に現れる data-i18n がその回答
        after = s.find(f'data-i18n="{qk}"')
        m = re.search(r'data-i18n="([A-Za-z0-9._]+)"', s[after + 20:])
        if m:
            ak = m.group(1)
            for L in LANGS:
                d[L][ak] = PAUSED_FAQ_A[L]
            s, _ = swap_text(s, ak, PAUSED_FAQ_A['ja'])

    # ①-3 残りの「までお受けしています」（本文の店舗紹介）をたたむ。
    #     休止中に書いてよい言葉ではない。
    while True:
        k = key_of(d, ['までお受けしています'])
        if not k:
            break
        for L in LANGS:
            d[L][k] = PAUSED_OFFER[L]
        s, ok = swap_text(s, k, PAUSED_OFFER['ja'])
        if not ok:
            break                                  # 本文に無ければ無限ループを避ける

    # ①-4 🔴 JSON-LD の FAQPage にも同じ嘘が残っていた。
    #     見えている本文だけ直して構造化データを放置すると、**検索結果のリッチリザルトに
    #     「縮毛矯正やパーマもできますか → お受けしています」が出続ける**。
    #     可視FAQとschemaは一致していることがGoogleの要件でもある。
    m = re.search(r'(<script type="application/ld\+json">)([\s\S]*?)(</script>)', s)
    if m:
        o = json.loads(m.group(2))
        hit = [0]

        def walk(n):
            if isinstance(n, dict):
                if n.get('@type') == 'Question':
                    ans = n.get('acceptedAnswer', {})
                    txt = ans.get('text', '')
                    if 'までお受けしています' in txt or '縮毛矯正やパーマもできますか' in n.get('name', ''):
                        n['name'] = PAUSED_FAQ_Q['ja']
                        ans['text'] = PAUSED_FAQ_A['ja']
                        hit[0] += 1
                for v in n.values():
                    walk(v)
            elif isinstance(n, list):
                for v in n:
                    walk(v)
        walk(o)
        if hit[0]:
            s = (s[:m.start()] + m.group(1)
                 + json.dumps(o, ensure_ascii=False, separators=(',', ':'))
                 + m.group(3) + s[m.end():])
    # ② 休止告知を「ラベル＋見出し＋本文」に置き換える（既にあれば入れ替え＝冪等）
    for L in LANGS:
        d[L]['pause.label'], d[L]['pause.title'], d[L]['pause.body'] = PAUSED[L]
    blk = (PAUSE_BLOCK.replace('__LABEL__', PAUSED['ja'][0])
                      .replace('__TITLE__', PAUSED['ja'][1])
                      .replace('__BODY__', PAUSED['ja'][2]))
    if PAUSE_MARK in s:
        # 【罠】末尾に \n? を付けると再実行のたびに改行を1つ食い、
        #       「変更前から流したとき」と結果が食い違う。閉じタグまでで止める。
        s = re.sub(re.escape(PAUSE_MARK) + r'[\s\S]*?</div>', lambda _: blk, s, count=1)
    else:
        note_k = key_of(d, ['受付を休止しています'])
        assert note_k, f'{f}: 休止のお知らせが見つからない'
        i = s.find(f'data-i18n="{note_k}"')
        start = s.rfind('<p', 0, i)
        end = s.find('</p>', i) + len('</p>')
        s = s[:start] + blk + s[end:]
        for L in LANGS:                       # 旧の1行版は使わなくなるので辞書から落とす
            d[L].pop(note_k, None)
    return s, d


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
        s, d = fix_paused_hero(f, s, d)
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

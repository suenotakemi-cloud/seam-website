# SEAM: 一番強いページから地域LPへリンクを通す（2026-08-14）
#
# 【実測でわかったこと】Bingで26クエリ測ったところ、SEAM自身のページは全滅だった。
#   当たっていたのは 旧サブドメイン ginza.seam.site(6位) と nagoya.seam.site(7位) だけ。
#   その2つは今日301で headspa-ginza / headspa-nagoya に向けたので、順位はいずれ移る。
#
# 【いま直せる最大の穴】内部リンクを数えたら、
#   **index.html（サイトで一番強いページ）から地域LPへのリンクが0本**だった。
#   shop.html も brand.html も0本。店舗ページ(store-*)には繋いでいるのに、
#   検索で狙っている salon-* / headspa-* には繋いでいない。
#   ＝サイトの力が、勝負しているページに流れていない。
#
# 【やること】index と shop のフッターに2行足す。
#   既存の「髪の悩みから探す」「全国の店舗」と同じ組み方に揃える。
#   アンカーの文字は地名だけにせず「銀座の個室ヘッドスパ」のように検索語を入れる
#   （リンクの文字そのものが順位に効くため）。
#
# 【名古屋のヘアは入れない】受付休止中なので「ヘアサロン」として案内しない。
#
# 【罠】この辞書は過去に本番SyntaxError事故を起こした場所（[[seam-i18n-edit-trap]]）。
#   index/shop の window.SEAM_PAGE_I18N は **JSON様式** なので、
#   文字列を継ぎ足さず json.loads → 書き戻しにする。実行後に構文ゲートを通すこと。
#
# 冪等。マーカーで囲っているので2回流しても増えない。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)

MARK_S = '<!-- seam:hub-lp-links:start -->'
MARK_E = '<!-- seam:hub-lp-links:end -->'
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

SPA = [('headspa-ginza', '銀座の個室ヘッドスパ'),
       ('headspa-nagoya', '名古屋の個室ヘッドスパ'),
       ('headspa-osaka', '大阪の個室ヘッドスパ')]
# 名古屋はヘア休止中なので入れない
SALON = [('salon-ginza', '銀座の髪質改善・縮毛矯正'),
         ('salon-sapporo', '札幌の髪質改善・縮毛矯正'),
         ('salon-osaka', '大阪の髪質改善・縮毛矯正'),
         ('salon-fukuoka', '福岡の髪質改善・縮毛矯正')]

# 見出しだけ多言語。リンクの文字は「地名＋施術」で、他言語でもそのまま意味が通る
LABELS = {
    'lphub.spa':   {'ja': '個室ヘッドスパ', 'en': 'PRIVATE-ROOM HEAD SPA', 'zh': '完全独立包间头皮SPA',
                    'tw': '完全獨立包廂頭皮SPA', 'ko': '완전 개인실 헤드스파'},
    'lphub.salon': {'ja': 'ヘアサロン（髪質改善・縮毛矯正）', 'en': 'HAIR SALON', 'zh': '美发沙龙',
                    'tw': '美髮沙龍', 'ko': '헤어살롱'},
}

ROW = ('      <p class="font-mono tracking-widest2 text-[10px] text-charcoal/60 uppercase mt-6 mb-3">'
       '{label}</p>\n'
       '      <div class="flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-charcoal/70">\n{links}      </div>\n')


def block():
    def row(key, items):
        links = ''.join(f'        <a href="{h}.html" class="hover:text-gold">{t}</a>\n' for h, t in items)
        return ROW.format(label=LABELS[key]['ja'], links=links)
    return MARK_S + '\n' + row('lphub.spa', SPA) + row('lphub.salon', SALON) + '      ' + MARK_E


def patch(f):
    """辞書は触らない。
    【なぜ】index/shop の window.SEAM_PAGE_I18N は **JS様式**（言語キーが裸・文字列キーが単引用符）で、
    カンマ様式が混在しており、過去に本番SyntaxError事故を起こした場所（[[seam-i18n-edit-trap]]）。
    ここで足したいのは小さな見出し2つだけなので、危険を冒す価値がない。
    既にある「髪の悩みから探す」のリンク行も同じくハードコードの日本語で、揃う。
    リンクの文字自体が「銀座の個室ヘッドスパ」＝日本語のページを指すので、日本語のままで正しい。"""
    s = open(f, encoding='utf-8').read()
    before = s

    if MARK_S in s:
        s = re.sub(re.escape(MARK_S) + r'[\s\S]*?' + re.escape(MARK_E), lambda _: block(), s, count=1)
        msg = '更新'
    else:
        # 置き場所: 「髪の悩みから探す」のリンク行の直後（＝index は「全国の店舗」の直前）。
        # ページごとに見出しの書き方が違う（index は data-i18n="g3"、shop は素のテキスト）ので
        # **文言で探す**。連番キーやクラス名に頼ると店ごと・ページごとにズレる。
        m = re.search(r'[ \t]*<p class="font-mono[^"]*"[^>]*>\s*(?:全国の店舗|All stores)\s*</p>', s)
        if not m:
            # 「髪の悩みから探す」の直後のリンク行が閉じたところに入れる
            h = re.search(r'<p class="font-mono[^"]*"[^>]*>\s*髪の悩みから探す\s*</p>', s)
            if not h:
                return f, '⚠ 挿入位置が見つからない'
            end = s.find('</div>', h.end())
            if end < 0:
                return f, '⚠ リンク行の終端が見つからない'
            end += len('</div>')
            s = s[:end] + '\n' + block() + s[end:]
            msg = '追加(悩みガイドの下)'
        else:
            s = s[:m.start()] + block() + '\n' + s[m.start():]
            msg = '追加(店舗の上)'

    # 辞書のバイト列が1文字も変わっていないことを確かめてから書く
    def dic(x):
        i = x.find('window.SEAM_PAGE_I18N')
        return x[i:i + 4000] if i > 0 else ''
    assert dic(s) == dic(before), f'{f}: 辞書に触れてしまった'

    open(f, 'w', encoding='utf-8').write(s)
    return f, msg


for f in ['index.html', 'shop.html']:
    if os.path.exists(f):
        print('  {:14} {}'.format(*patch(f)))

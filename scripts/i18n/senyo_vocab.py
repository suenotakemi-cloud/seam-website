# SEAM: 専売品の検索で使われている言葉を名乗る（2026-08-11）
#
# 【実測】Bingで測った結果
#   「サロン専売品 シャンプー」「サロン専売 トリートメント 買える」「美容室専売品 販売店」
#   すべて圏外。とくに「美容室専売品 販売店」は **shellbear系が2〜4位**を占めていて、
#   これは SEAM が以前ベンチマークにした形式そのもの。取扱ブランド数では SEAM が上なので、
#   勝てる見込みが一番高い土俵。
#
# 【何が足りなかったか】語彙の数え上げでわかった:
#   サイト全体では 美容室専売=222回/107ページ あるのに、
#   **受け皿になるべき shop.html と guide-salon-senyo.html が「美容室専売」を0回**しか
#   使っていなかった。「販売店」も shop=1 / guide=0。
#   SEAM は「正規取扱店」と名乗っているが、探されている言葉は「販売店」。
#
# 【やること】titleとdescriptionに、探されている言葉を入れる。
#   ページの中身は変えない（既に正規取扱の事実は書いてある）。
#
# 【罠】この2ページの辞書は **JS単引用符様式**（過去に本番SyntaxError事故）。
#   キーは足さず、**既にある1行の文字列だけ**を差し替える。
#   さらに <title> と og:title / meta description / og:description も同時に揃える
#   （og系は別タグなので片方だけ直すと食い違う）。
import re, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)

PLAN = {
 'shop.html': {
   'old_title': 'サロン専売ヘアケアの正規取扱店｜197ブランド｜SEAM',
   'new_title': 'サロン専売・美容室専売品の販売店｜197ブランド｜SEAM',
   'desc_add': '美容室専売品の販売店です　',
 },
 'guide-salon-senyo.html': {
   'old_title': 'サロン専売品とは｜市販との違い・どこで買える？｜SEAM',
   'new_title': 'サロン専売品とは｜美容室専売品の販売店・市販との違い｜SEAM',
   'desc_add': 'サロン専売品（美容室専売品）の販売店をお探しの方へ　',
 },
}

for f, p in PLAN.items():
    if not os.path.exists(f):
        print(f'  {f:26} ファイル無し'); continue
    s = open(f, encoding='utf-8').read()

    if p['new_title'] in s:
        print(f'  {f:26} 既に反映済み'); continue

    n = s.count(p['old_title'])
    # ガイド系は多言語辞書を持たないJA専用ページなので <title> の1箇所だけ。
    # shop など辞書を持つページは <title> と ja辞書 の2箇所。どちらも許す。
    assert n >= 1, f'{f}: 旧titleが見つからない'

    # ja の meta.title と <title>（と og:title があれば）をまとめて差し替え。
    # 他言語の meta.title は別文字列なので巻き込まれない。
    s = s.replace(p['old_title'], p['new_title'])

    # description の頭に、探されている言葉を足す（既存の説明は残す）
    m = re.search(r'(<meta name="description" content=")([^"]*)(")', s)
    assert m, f'{f}: meta description が無い'
    old_desc = m.group(2)
    if not old_desc.startswith(p['desc_add']):
        new_desc = p['desc_add'] + old_desc
        s = s.replace(old_desc, new_desc)      # <meta>・og・ja辞書の同一文字列をまとめて更新

    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:26} 差し替え {n}箇所')
    print(f'      → {p["new_title"]}')

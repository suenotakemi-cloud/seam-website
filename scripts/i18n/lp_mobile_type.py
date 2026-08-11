# SEAM: 地域LPのモバイル本文を読める大きさにする（2026-08-11）
#
# 【なぜ】外部レビュー(Codex)の指摘を実測で確かめたところ、事実だった。
#   salon-ginza を375pxで測ると本文サイズの分布はこうなっていた:
#     12px×20要素 / 13.5px×17要素 / 12.5px×7 / 11.5px×4 / 10px×6
#   PCでは繊細に見えるが、モバイルでは「高級感」より「小さくて読みづらい」が先に来る。
#   とくに 12px × text-charcoal/60(不透明度60%) の注記は実機で明確に弱い。
#   英中韓は画数が多いぶんさらに不利。
#
# 【やり方】モバイル(639px以下)だけを上げる。**PCの見え方は1pxも変えない**。
#   ・LPが読んでいるCSSは css/tailwind.css だけで、これはCI生成物なので触れない
#   ・新しいTailwindクラス(sm:text-[15px]等)を足す手もあるが、CIが回るまで
#     クラスが生成されない窓ができる → 各ページにscoped CSSを入れる方が確実
#   ・ユーティリティを上書きするので、詳細度を1つ上げて(main を前置)確実に勝たせる
#
# 【変えないもの】
#   ・見出し(font-serif の大きい字)はそのまま。バランスが崩れる
#   ・ラベル/eyebrow(10〜11.5px の英字)はそのまま。字間で読ませる意匠
#   ・色は「薄すぎる注記」だけ1段濃くする。85%や80%は十分読めるので触らない
#
# 冪等。マーカーで囲っているので2回流しても増えない。
import re, sys, os, glob

ROOT = sys.argv[1]
os.chdir(ROOT)

MARK_S = '<!-- seam:lp-mobile-type:start -->'
MARK_E = '<!-- seam:lp-mobile-type:end -->'

BLOCK = MARK_S + '''
  <style>
  /* モバイルの本文だけ大きく・濃くする（PCは不変）。2026-08-11
     数字はレビュー指摘（主本文15〜16 / 補足13〜14 / 行間1.75〜1.9）に合わせた。
     main を前置して Tailwind のユーティリティより詳細度を1段上げている。 */
  @media (max-width: 639px) {
    main .text-\\[13\\.5px\\] { font-size: 15px;   line-height: 1.85; }
    main .text-\\[13px\\]     { font-size: 14.5px; line-height: 1.85; }
    main .text-\\[12\\.5px\\] { font-size: 13.5px; line-height: 1.9;  }
    main .text-\\[12px\\]     { font-size: 13px;   line-height: 1.85; }
    main .text-\\[11\\.5px\\] { font-size: 12.5px; }
    /* 薄すぎる注記だけ1段濃く。85%/80%は実機で読めているので触らない */
    main .text-charcoal\\/60 { color: rgba(42,45,52,.75); }
    main .text-charcoal\\/65 { color: rgba(42,45,52,.78); }
    main .text-charcoal\\/70 { color: rgba(42,45,52,.8);  }
    /* タグ列は折り返す。横に切れて「読めない語」が出るのを防ぐ */
    main .chips { flex-wrap: wrap; }
  }
  </style>
''' + MARK_E


def targets():
    """地域LP＝スパ3・サロン5・{brand}-{area}系。store-* は別テンプレなので触らない。"""
    fs = [f'headspa-{s}.html' for s in ['ginza', 'nagoya', 'osaka']]
    fs += [f'salon-{s}.html' for s in ['ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka']]
    fs += sorted(glob.glob('*-tokyo.html'))
    return [f for f in fs if os.path.exists(f)]


n = 0
for f in targets():
    s = open(f, encoding='utf-8').read()
    if MARK_S in s:                                  # 既にある → 中身を入れ替える（冪等かつ更新できる）
        s = re.sub(re.escape(MARK_S) + r'[\s\S]*?' + re.escape(MARK_E), lambda _: BLOCK, s, count=1)
        msg = '更新'
    else:
        i = s.find('</head>')
        assert i > 0, f'{f}: </head> が無い'
        s = s[:i] + BLOCK + '\n' + s[i:]
        msg = '追加'
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:26} {msg}')
    n += 1
print(f'\n{n} 枚')

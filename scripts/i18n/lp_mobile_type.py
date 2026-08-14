# SEAM: 地域LPのモバイル本文を読める大きさにする（2026-08-14）
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
  /* 地域LPの読みやすさ。2026-08-14
     main を前置して Tailwind のユーティリティより詳細度を1段上げている。 */

  /* ── ① コントラスト（全幅で直す）
     コントラスト比を実測したら、小さい字の3種がWCAG AA(本文4.5:1)に届いていなかった:
       text-charcoal/55  3.37:1  ← 11.5px のキャプション
       text-charcoal/60  3.90:1  ← 12px の注記
       text-gold #B8945A 2.83:1  ← 10px のラベル(Nagi / HAIR SALON など)
     PCでも読みにくいので、モバイル限定にはしない。
     濃くしても金は金のまま（#8A6A3C は 4.99:1）でブランド感は落ちない。 */
  main .text-charcoal\\/55 { color: rgba(42,45,52,.70); }   /* → 5.25:1 */
  main .text-charcoal\\/60 { color: rgba(42,45,52,.75); }   /* → 6.12:1 */
  main .text-charcoal\\/65 { color: rgba(42,45,52,.78); }
  /* 金は「小さい字のときだけ」濃くする。大きめの金は意匠なので触らない */
  main .text-gold.text-\\[10px\\],
  main .text-gold.text-\\[11px\\],
  main .text-gold.text-\\[11\\.5px\\] { color: #8A6A3C; }
  /* 店舗情報の項目名（店舗/住所/アクセス…）は 3.96:1 しかなかった */
  main .kv .k { color: #8A6A3C; }
  /* FAQの開閉記号「＋」。文字ではないが操作の合図なので 3:1 を切ってはいけない(2.83だった) */
  main summary .text-gold { color: #8A6A3C; }
  /* パンくずも同じ理由で一段濃く */
  nav[aria-label] .text-charcoal\\/55 { color: rgba(42,45,52,.70); }

  /* ── ② 文字の大きさ（モバイルだけ・PCは1pxも変えない）
     実測の分布は 12px×20要素 / 13.5px×17 で、モバイルでは
     「高級感」より「小さくて読みづらい」が先に来ていた。
     英中韓は画数が多いぶんさらに不利。
     ラベル(.chips span / .kv .k)は11〜12pxのまま＝字間で読ませる意匠なので触らない。 */
  @media (max-width: 639px) {
    main .text-\\[13\\.5px\\] { font-size: 15px;   line-height: 1.85; }
    main .text-\\[13px\\]     { font-size: 14.5px; line-height: 1.85; }
    main .text-\\[12\\.5px\\] { font-size: 13.5px; line-height: 1.9;  }
    main .text-\\[12px\\]     { font-size: 13px;   line-height: 1.85; }
    main .text-\\[11\\.5px\\] { font-size: 12.5px; }
    main .text-charcoal\\/70 { color: rgba(42,45,52,.8); }
    /* タグ列は折り返す。横に切れて「読めない語」が出るのを防ぐ */
    main .chips { flex-wrap: wrap; }
  }

  /* ── ③ PCの余白（1440pxで「細い記事ページ」に見えていた）
     本文の行長は読みやすさの要なので広げない。
     **写真と料金表だけ**を少しはみ出させて、サロンの空間性を出す。 */
  @media (min-width: 1180px) {
    main > figure,
    main .menu { width: calc(100% + 120px); margin-left: -60px; }
    main .menu { padding-left: 60px; padding-right: 60px; }
  }

  /* ── ④ 追従CTAはページ末尾では引っ込める（通常CTAと二重に見えるため）
     JS側で .is-near-foot を付ける */
  .lp-sticky-cta { transition: opacity .25s ease, transform .25s ease; }
  .lp-sticky-cta.is-near-foot { opacity: 0; transform: translateY(100%); pointer-events: none; }
  </style>
''' + MARK_E


def targets():
    """地域LP＝スパ3・サロン5・{brand}-{area}系。store-* は別テンプレなので触らない。"""
    fs = [f'headspa-{s}.html' for s in ['ginza', 'nagoya', 'osaka']]
    fs += [f'salon-{s}.html' for s in ['ginza', 'sapporo', 'osaka', 'nagoya', 'fukuoka']]
    fs += sorted(glob.glob('*-tokyo.html'))
    return [f for f in fs if os.path.exists(f)]


# 追従CTAをページ末尾で引っ込めるスクリプト。
# 常に黒一色で出ているので、最下部では下の通常CTAと二重に見えていた。
# IntersectionObserver は Browser pane では発火しないことがあるが、実機では動く。
# 発火しなくても「常に出たまま」になるだけで、壊れない側に倒してある。
JS_MARK_S = '<!-- seam:lp-sticky-cta:start -->'
JS_MARK_E = '<!-- seam:lp-sticky-cta:end -->'
JS_BLOCK = JS_MARK_S + '''
<script>
(function(){
  var cta = document.querySelector('.lp-sticky-cta');
  if (!cta || !('IntersectionObserver' in window)) return;
  // ページ末尾の目印＝最後のsection（そこまで来たら通常CTAが見えている）
  var secs = document.querySelectorAll('main section');
  var last = secs[secs.length - 1];
  if (!last) return;
  new IntersectionObserver(function (es) {
    es.forEach(function (e) { cta.classList.toggle('is-near-foot', e.isIntersecting); });
  }, { rootMargin: '0px 0px -30% 0px' }).observe(last);
})();
</script>
''' + JS_MARK_E

n = 0
for f in targets():
    s = open(f, encoding='utf-8').read()

    # ① スタイル
    if MARK_S in s:                                  # 既にある → 中身を入れ替える（冪等かつ更新できる）
        s = re.sub(re.escape(MARK_S) + r'[\s\S]*?' + re.escape(MARK_E), lambda _: BLOCK, s, count=1)
        msg = '更新'
    else:
        i = s.find('</head>')
        assert i > 0, f'{f}: </head> が無い'
        s = s[:i] + BLOCK + '\n' + s[i:]
        msg = '追加'

    # ② 追従CTAに目印のクラスを付ける（無い店もあるので任意）
    cta = re.search(r'<div class="(fixed inset-x-0 bottom-0[^"]*)"', s)
    if cta and 'lp-sticky-cta' not in cta.group(1):
        s = s[:cta.start(1)] + cta.group(1) + ' lp-sticky-cta' + s[cta.end(1):]

    # ③ 末尾で引っ込めるスクリプト
    if JS_MARK_S in s:
        s = re.sub(re.escape(JS_MARK_S) + r'[\s\S]*?' + re.escape(JS_MARK_E), lambda _: JS_BLOCK, s, count=1)
    elif cta:
        j = s.rfind('</body>')
        s = s[:j] + JS_BLOCK + '\n' + s[j:]

    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:34} {msg}{" / 追従CTA" if cta else ""}')
    n += 1
print(f'\n{n} 枚')

# SEAM: 髪質診断のガイドを作る（2026-08-25）
#
# 【なぜ】自社語「髪格診断」では1位だが 一般語「髪質診断」は圏外。
#   上位10はMEDULLA/ロート/ホーユー/ケラスターゼ等の解説ページで
#   こちらの /finder は本文934字しかない（道具そのものなので当然）。
#   guide-* は12本あるのに 髪質診断だけ受け皿が無かった。
#
# 【やり方】guide-salon-senyo.html を型として写す（head/nav/footer/JSON-LDの骨格ごと）。
#   中身だけ差し替えるので 既存ページと1ミリもずれない。
#
# 冪等。既にあれば作り直す。
import re, sys, os, json

ROOT = sys.argv[1]; os.chdir(ROOT)
SRC, DST = 'guide-salon-senyo.html', 'guide-kamishitsu-shindan.html'
SLUG = 'guide-kamishitsu-shindan'

TITLE = '髪質診断とは｜自分の髪を知る5つの見方｜SEAM'
DESC  = '髪質診断とは何を見ているのか｜太さ・量・くせ・ダメージ・頭皮の5つを自分で確かめる方法と、診断でわかること・わからないことを整理します｜SEAM'
OGT   = '髪質診断とは｜自分の髪を知る5つの見方 | SEAM'

H1   = '髪質診断とは<br>自分の髪を知る5つの見方'
LEAD = ('髪質診断という言葉はよく見かけますが 何を見ているのかは案外知られていません<br>'
        'このページでは 自分で確かめられる見方と 診断でわかること わからないことを整理します')

FAQ = [
 ('髪質診断は無料でできますか',
  'SEAMの髪格診断は無料で 会員登録も要りません 3分ほどで終わります'),
 ('美容室でしてもらう診断と何が違いますか',
  '手で触れて確かめる部分は美容師にしかできません オンラインの診断は その前に見当をつけるためのものです お店では診断の結果を持ってご相談いただけます'),
 ('何度も受けてよいですか',
  '髪質は施術や年齢や季節で変わるので 半年ごとの見直しをおすすめします'),
 ('市販のシャンプーでは合わないということですか',
  'そうではありません 合う合わないは値段ではなく 髪の性質との相性で決まります 診断はその相性を見るためのものです'),
]

BODY = f'''<article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
<nav class="font-mono tracking-widest2 text-[10px] text-charcoal/50 uppercase mb-6"><a href="journal.html" class="hover:text-ink">Journal</a> <span class="mx-1">/</span> Hair Diagnosis Guide</nav>
<h1 class="font-serif text-[27px] sm:text-[34px] leading-[1.4] text-ink font-medium">{H1}</h1>
<p class="mt-6 text-[14px] sm:text-[15px] text-charcoal/80">{LEAD}</p>

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">髪質診断とは</h2>
<p class="mt-4 text-[14px] text-charcoal/80">髪質診断とは 髪の太さや量 くせの出方などを見て 自分の髪がどんな性質を持っているかを整理することです</p>
<p class="mt-3 text-[14px] text-charcoal/80">同じ「乾燥する」でも 細い髪と太い髪では起きていることが違います 細い髪は水分を抱えられずに乾き 太い髪は表面が硬くて水分が入らずに乾きます 打つ手も逆になります</p>
<p class="mt-3 text-[14px] text-charcoal/80">性質がわかると 合わないものを選ばずに済みます それが診断のいちばんの役目です</p>

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">自分で確かめる5つの見方</h2>
<p class="mt-4 text-[14px] text-charcoal/80">道具は要りません 手と鏡だけで確かめられます</p>

<h3 class="mt-7 font-serif text-[16px] text-ink">① 太さ</h3>
<p class="mt-3 text-[14px] text-charcoal/80">抜けた髪を一本 指の腹でつまんでみてください 触れているのがはっきりわかれば太い髪 つまんでいるのかわからなければ細い髪です 迷ったら普通と考えて差し支えありません</p>

<h3 class="mt-7 font-serif text-[16px] text-ink">② 量</h3>
<p class="mt-3 text-[14px] text-charcoal/80">乾いた髪を後ろでひとつに束ねて 根元の太さを見ます 親指ほどあれば多め 小指ほどなら少なめです 量が多い人は 洗い残しとすすぎ残しが起きやすくなります</p>

<h3 class="mt-7 font-serif text-[16px] text-ink">③ くせ</h3>
<p class="mt-3 text-[14px] text-charcoal/80">濡れているときと乾いたときを見比べてください 濡れるとまっすぐで 乾くとうねるなら 水分を含みやすい髪です 湿気の日にふくらむのはこの型です 濡れた状態でも曲がっているなら 毛の断面そのものに丸みがあります</p>

<h3 class="mt-7 font-serif text-[16px] text-ink">④ ダメージ</h3>
<p class="mt-3 text-[14px] text-charcoal/80">濡れた毛先を指で軽く挟んで すべらせてみます きしんで止まるようなら 内部が空いています 逆にぬるっと滑りすぎるのも 表面が失われているしるしです</p>

<h3 class="mt-7 font-serif text-[16px] text-ink">⑤ 頭皮</h3>
<p class="mt-3 text-[14px] text-charcoal/80">朝の根元と夕方の根元を比べます 夕方だけ重くぺたりとするなら皮脂が多め 一日を通してかさつくなら乾燥寄りです 洗う回数ではなく 洗う強さを変えるほうが効きます</p>

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">髪質は変わる</h2>
<p class="mt-4 text-[14px] text-charcoal/80">髪質は生まれつきのものだけではありません くり返す施術 年齢による変化 季節の湿度で 同じ人でも見え方が変わります</p>
<p class="mt-3 text-[14px] text-charcoal/80">とくに縮毛矯正やブリーチのあとは 太さも手ざわりも別物になります 昔の自分の髪質のまま選び続けると 合わないものを使い続けることになります 半年に一度 見直すくらいがちょうどよいものです</p>

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">診断でわかること わからないこと</h2>
<p class="mt-4 text-[14px] text-charcoal/80">わかるのは いまの髪に合う洗い方と 選ぶとよいものの方向 そして避けたほうがよいものです</p>
<p class="mt-3 text-[14px] text-charcoal/80">わからないこともあります 頭皮のかゆみが続く 抜け毛が急に増えた こうした変化の原因は診断ではわかりません 皮膚科や毛髪の専門医にご相談ください 診断はあくまで ケアを選ぶための道具です</p>

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">診断のあと 何を選ぶか</h2>
<p class="mt-4 text-[14px] text-charcoal/80">細い髪は 重いオイルで潰れます 軽いミルクから始めて 足りなければ足すほうが失敗しません</p>
<p class="mt-3 text-[14px] text-charcoal/80">太い髪は 表面が硬いぶん 水分を入れる前に開く手助けが要ります 洗い流さないものより 洗い流すトリートメントに時間をかけるほうが変わります</p>
<p class="mt-3 text-[14px] text-charcoal/80">くせのある髪は うねりを抑えるものより 乾かし方を先に変えるほうが早く効きます 根元から風を当てて 引っぱらずに乾かすだけで収まり方が変わります</p>
<p class="mt-3 text-[14px] text-charcoal/80">ブリーチをしている髪は 内部が空いています 補うものを先に 守るものをあとに という順番が要ります</p>

<div class="mt-10 rounded-[3px] border border-line bg-cream/40 px-5 py-6">
  <p class="font-mono tracking-widest2 text-[10px] uppercase text-gold">Free</p>
  <p class="mt-3 font-serif text-[17px] text-ink">SEAMの髪格診断</p>
  <p class="mt-3 text-[13.5px] text-charcoal/80">太さ 量 くせ の重なりから27の型に分けて いまの髪に合う一本をお出しします 無料で 会員登録も要りません 3分ほどで終わります</p>
  <a href="finder.html" class="mt-5 inline-flex items-center gap-2 rounded-full bg-obsidian px-6 py-3 text-[13px] text-white hover:opacity-90 transition-opacity">診断をはじめる</a>
</div>

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">よくある質問</h2>
{''.join(f'<h3 class="mt-7 font-serif text-[16px] text-ink">{q}</h3><p class="mt-3 text-[14px] text-charcoal/80">{a}</p>' for q, a in FAQ)}

<h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">あわせて読む</h2>
<ul class="mt-4 text-[14px] text-charcoal/80 space-y-2">
  <li><a href="guide-uneri.html" class="underline decoration-line underline-offset-4 hover:text-ink">うねり・くせ毛との付き合い方</a></li>
  <li><a href="guide-damage.html" class="underline decoration-line underline-offset-4 hover:text-ink">ダメージ・ブリーチ毛のいたわり方</a></li>
  <li><a href="guide-scalp.html" class="underline decoration-line underline-offset-4 hover:text-ink">頭皮から髪を整える</a></li>
  <li><a href="guide-salon-senyo.html" class="underline decoration-line underline-offset-4 hover:text-ink">サロン専売品とは 市販品と何が違う？</a></li>
</ul>
</article>'''

s = open(SRC, encoding='utf-8').read()

# ① head の差し替え
s = re.sub(r'<title[^>]*>[^<]*</title>', f'<title>{TITLE}</title>', s, count=1)
s = re.sub(r'(<meta[^>]*name="description"[^>]*content=")[^"]*(")', lambda m: m.group(1)+DESC+m.group(2), s, count=1)
s = s.replace('https://seam.site/guide-salon-senyo', f'https://seam.site/{SLUG}')
s = re.sub(r'(<meta[^>]*property="og:title"[^>]*content=")[^"]*(")', lambda m: m.group(1)+OGT+m.group(2), s, count=1)
s = re.sub(r'(<meta[^>]*property="og:description"[^>]*content=")[^"]*(")', lambda m: m.group(1)+DESC+m.group(2), s, count=1)
s = re.sub(r'(<meta[^>]*name="twitter:title"[^>]*content=")[^"]*(")', lambda m: m.group(1)+OGT+m.group(2), s, count=1)
s = re.sub(r'(<meta[^>]*name="twitter:description"[^>]*content=")[^"]*(")', lambda m: m.group(1)+DESC+m.group(2), s, count=1)

# ② article の差し替え
i = s.find('<article'); j = s.find('</article>') + len('</article>')
assert i > 0 and j > i, 'article が見つからない'
s = s[:i] + BODY + s[j:]

# ③ JSON-LD の Article と FAQPage を作り直す
def fix_ld(m):
    try: g = json.loads(m.group(1))
    except Exception: return m.group(0)
    for node in g.get('@graph', []):
        ty = node.get('@type')
        if ty == 'Article':
            node['headline'] = '髪質診断とは 自分の髪を知る5つの見方'
            node['description'] = DESC
            node['mainEntityOfPage'] = f'https://seam.site/{SLUG}'
            for k in ('url', '@id'):
                if k in node: node[k] = f'https://seam.site/{SLUG}'
        if ty == 'FAQPage':
            node['mainEntity'] = [{'@type': 'Question', 'name': q,
                                   'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in FAQ]
        if ty == 'WebPage':
            node['name'] = TITLE; node['description'] = DESC
            for k in ('url', '@id'):
                if k in node: node[k] = f'https://seam.site/{SLUG}'
        if ty == 'BreadcrumbList':
            for it in node.get('itemListElement', []):
                if it.get('position') == 3 or (isinstance(it.get('item'), str) and 'salon-senyo' in it.get('item','')):
                    it['name'] = '髪質診断とは'; it['item'] = f'https://seam.site/{SLUG}'
    return '<script type="application/ld+json">' + json.dumps(g, ensure_ascii=False) + '</script>'

s = re.sub(r'<script type="application/ld\+json"[^>]*>(.*?)</script>', fix_ld, s, flags=re.S)

open(DST, 'w', encoding='utf-8').write(s)

# ④ 検め
b = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
txt = re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', b))
print(f'  {DST} を書きました')
print(f'   本文 {len(txt)}字 / h2 {len(re.findall(r"<h2", b))}本 / h3 {len(re.findall(r"<h3", b))}本')
print(f'   「髪質診断」{txt.count("髪質診断")}回 / 句点「。」{b.count("。")}個')
print(f'   finder への導線 {s.count("finder.html")}本')

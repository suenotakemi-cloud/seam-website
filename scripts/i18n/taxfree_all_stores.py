# SEAM: 免税を全7店舗に展開する（2026-08-09 オーナー確認「SEAM全店舗が免税になりました」）
#
# それまでは銀座本店だけが免税店で、store-ginza.html にしか記載が無かった。
# 他6店に「この店舗でできること」の免税行・FAQ・構造化データ・meta descriptionを入れ、
# 銀座側の「銀座本店は」という言い回しも全店向けに直す。
#
# 【守っていること】
#  ・日本の輸出免税は物品が対象なので、書くのは物販の store-*.html だけ。
#    役務のページ（salon-* / headspa-*）には絶対に書かない。
#  ・キーは s11 のような連番に割り込まず、tf* という別名を使う。
#    連番に挿すと他店とズレて全訳を振り直すことになるため。
#  ・「できること」の説明文には句点を打たない／FAQの回答には打つ。既存の書き分けに合わせる。
#
# 冪等。2回流しても増えない。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)
SLUGS = ['ginza', 'omotesando', 'osaka', 'nagoya', 'fukuoka', 'sapporo', 'utsunomiya']

TF = {
 'ja': {
   'tfName': '免税対応 <span class="text-[11px] text-charcoal/55">Tax-Free</span>',
   'tfDesc': '海外からお越しのお客様は 5,000円以上のお買い上げでパスポートをご提示いただくと免税になります',
   'tfQ': '<span class="shrink-0 text-gold">Q</span><span>免税で購入できますか？</span>',
   'tfA': 'はい。SEAMは全店舗が免税対応店です。5,000円以上お買い上げの海外からのお客様は、パスポートをご提示いただくと免税になります。手続きはレジにて承ります。<br><span class="text-charcoal/60">Tax-free shopping is available at all SEAM stores for purchases of ¥5,000 or more. Please show your passport at the register.</span>',
   'metaSuffix': '／5,000円以上で免税',
 },
 'en': {
   'tfName': 'Tax-Free Shopping',
   'tfDesc': 'Visitors from overseas can shop tax-free on purchases of ¥5,000 or more, with a passport',
   'tfQ': '<span class="shrink-0 text-gold">Q</span><span>Can I shop tax-free?</span>',
   'tfA': 'Yes. Every SEAM store is a tax-free shop. Visitors from overseas spending ¥5,000 or more can shop tax-free by showing a passport. We handle the paperwork at the register.',
   'metaSuffix': ' Tax-free from ¥5,000.',
 },
 'zh': {
   'tfName': '支持免税 <span class="text-[11px] text-charcoal/55">Tax-Free</span>',
   'tfDesc': '海外顾客单次消费满5,000日元 出示护照即可免税',
   'tfQ': '<span class="shrink-0 text-gold">Q</span><span>可以免税购买吗？</span>',
   'tfA': '是的。SEAM全部门店均为免税店。海外顾客单次消费满5,000日元，出示护照即可免税。手续在收银台办理。<br><span class="text-charcoal/60">Tax-free shopping is available at all SEAM stores for purchases of ¥5,000 or more. Please show your passport at the register.</span>',
   'metaSuffix': '｜满5,000日元免税',
 },
 'tw': {
   'tfName': '支援免稅 <span class="text-[11px] text-charcoal/55">Tax-Free</span>',
   'tfDesc': '海外顧客單次消費滿5,000日圓 出示護照即可免稅',
   'tfQ': '<span class="shrink-0 text-gold">Q</span><span>可以免稅購買嗎？</span>',
   'tfA': '是的。SEAM全部門市皆為免稅店。海外顧客單次消費滿5,000日圓，出示護照即可免稅。手續於收銀台辦理。<br><span class="text-charcoal/60">Tax-free shopping is available at all SEAM stores for purchases of ¥5,000 or more. Please show your passport at the register.</span>',
   'metaSuffix': '｜滿5,000日圓免稅',
 },
 'ko': {
   'tfName': '면세 가능 <span class="text-[11px] text-charcoal/55">Tax-Free</span>',
   'tfDesc': '해외에서 오신 고객은 5,000엔 이상 구매 시 여권을 제시하면 면세가 됩니다',
   'tfQ': '<span class="shrink-0 text-gold">Q</span><span>면세로 구매할 수 있나요?</span>',
   'tfA': '네. SEAM은 전 매장이 면세점입니다. 5,000엔 이상 구매하시는 해외 고객은 여권을 제시하시면 면세가 됩니다. 수속은 계산대에서 도와드립니다.<br><span class="text-charcoal/60">Tax-free shopping is available at all SEAM stores for purchases of ¥5,000 or more. Please show your passport at the register.</span>',
   'metaSuffix': '｜5,000엔 이상 면세',
 },
}

ROW = ('<div class="py-4 flex gap-4"><span class="shrink-0 w-2 h-2 rounded-full mt-2" style="background:#B8945A;"></span>'
       '<div><p class="font-serif text-[14.5px] text-ink" data-i18n="tfName">' + TF['ja']['tfName'] + '</p>'
       '<p class="mt-1 text-[12.5px] leading-[1.85] text-charcoal/70" data-i18n="tfDesc">' + TF['ja']['tfDesc'] + '</p></div></div>')

FAQ = ('<details class="py-3.5 group"><summary class="flex items-start gap-3 cursor-pointer list-none font-serif text-[14px] text-ink" '
       'data-i18n="tfQ">' + TF['ja']['tfQ'] + '</summary>'
       '<p class="mt-2 pl-6 text-[12.5px] leading-[1.95] text-charcoal/75" data-i18n="tfA">' + TF['ja']['tfA'] + '</p></details>')

JSONLD_Q = {"@type": "Question", "name": "免税で購入できますか",
            "acceptedAnswer": {"@type": "Answer",
             "text": "はい SEAMは全店舗が免税対応店です 5,000円以上お買い上げの海外からのお客様はパスポートをご提示いただくと免税になります 手続きはレジにて承ります"}}

def patch(slug):
    f = f'store-{slug}.html'
    s = open(f, encoding='utf-8').read()
    done = []

    # ① 「この店舗でできること」の先頭に免税行（既にあれば触らない）
    if 'data-i18n="tfName"' not in s and 'data-i18n="s11">免税対応' not in s:
        # 【罠】見出しのキー番号は店ごとに違う（s10/s11/s12）。番号で探すと表参道等で外れる。
        # 見出しの文言そのもので探す。
        m = re.search(r'(この店舗でできること</h2>\s*<div class="mt-3 divide-y divide-line">\s*)', s)
        assert m, f'{f}: できること節が見つからない'
        s = s[:m.end()] + '\n            ' + ROW + s[m.end():]
        done.append('できること行')

    # ② FAQの先頭に免税Q&A（銀座は s28/s29 で既にある）
    if 'data-i18n="tfQ"' not in s and '免税で購入できますか' not in s:
        m = re.search(r'(<div class="mt-3 divide-y divide-line border-y border-line">)', s)
        assert m, f'{f}: FAQ節が見つからない'
        s = s[:m.end()] + FAQ + s[m.end():]
        done.append('FAQ')

    # ③ FAQPage の構造化データに免税Q&A
    def add_ld(mo):
        try:
            d = json.loads(mo.group(2))
        except Exception:
            return mo.group(0)
        nodes = d.get('@graph', []) if isinstance(d, dict) else (d if isinstance(d, list) else [d])
        ch = False
        for n in nodes:
            if isinstance(n, dict) and n.get('@type') == 'FAQPage':
                names = [q.get('name') for q in n.get('mainEntity', [])]
                if JSONLD_Q['name'] not in names:
                    n['mainEntity'].insert(0, json.loads(json.dumps(JSONLD_Q)))
                    ch = True
                else:  # 銀座: 既存の「銀座本店は」を全店向けに直す
                    for q in n['mainEntity']:
                        if q.get('name') == JSONLD_Q['name']:
                            if q['acceptedAnswer']['text'] != JSONLD_Q['acceptedAnswer']['text']:
                                q['acceptedAnswer']['text'] = JSONLD_Q['acceptedAnswer']['text']
                                ch = True
        if not ch:
            return mo.group(0)
        add_ld.hit = True
        return mo.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + mo.group(3)
    add_ld.hit = False
    s = re.sub(r'(<script type="application/ld\+json">)(.*?)(</script>)', add_ld, s, flags=re.S)
    if add_ld.hit:
        done.append('構造化データ')

    # ④ 辞書に tf* を追加 ＋ meta.description に免税を足す ＋ 銀座の言い回しを全店向けに
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    assert m, f'{f}: 辞書が見つからない'
    d = json.loads(m.group(2))
    changed = False
    for lang, kv in TF.items():
        assert lang in d, f'{f}: 言語 {lang} が無い'
        for k in ('tfName', 'tfDesc', 'tfQ', 'tfA'):
            if d[lang].get(k) != kv[k]:
                d[lang][k] = kv[k]
                changed = True
        # 銀座の既存キー（s11/s12/s28/s29）も全店向けの文言に揃える
        for k in list(d[lang]):
            v = d[lang][k]
            if not isinstance(v, str):
                continue
            for a, b in [('銀座本店は免税対応店舗です', 'SEAMは全店舗が免税対応店です'),
                         ('银座本店为免税店', 'SEAM全部门店均为免税店'),
                         ('銀座本店為免稅店', 'SEAM全部門市皆為免稅店'),
                         ('긴자 본점은 면세점입니다', 'SEAM은 전 매장이 면세점입니다'),
                         ('SEAM GINZA is a tax-free shop', 'Every SEAM store is a tax-free shop'),
                         ('available at SEAM GINZA for purchases', 'available at all SEAM stores for purchases')]:
                if a in v:
                    d[lang][k] = v = v.replace(a, b)
                    changed = True
        # meta.description の末尾に免税（既に免税に触れていれば足さない）
        md = d[lang].get('meta.description', '')
        if md and not re.search(r'免税|免稅|Tax-free|면세', md, re.I):
            d[lang]['meta.description'] = md.rstrip() + kv['metaSuffix']
            changed = True
    if changed:
        s = s[:m.start()] + m.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':')) + m.group(3) + s[m.end():]
        done.append('辞書/meta')

    # ⑤ <meta name="description"> 実体（jaページのhead）にも反映
    hm = re.search(r'(<meta name="description" content=")([^"]*)(")', s)
    if hm and not re.search(r'免税', hm.group(2)):
        s = s[:hm.start()] + hm.group(1) + hm.group(2) + TF['ja']['metaSuffix'] + hm.group(3) + s[hm.end():]
        done.append('head description')

    if done:
        open(f, 'w', encoding='utf-8').write(s)
    return f, done

total = 0
for slug in SLUGS:
    f, done = patch(slug)
    print(f'  {f:26} {", ".join(done) if done else "変更なし"}')
    total += len(done)
print(f'\n変更 {total} 箇所')

# -*- coding: utf-8 -*-
"""読みもの（guide-*.html）を1枚つくる（所有者 10/11「seam.site で公開するのはまかせます」）
使い方: python3 scripts/make_guide_page.py spec.json
spec: {slug,title,desc,crumb,h1,sub,date,image(任意・images/… の画像),sections:[{h,ps:[...],ul:[...],chips:[[href,label]],links:[[href,label]]}],faq:[[q,a]]}
雛形は tokyo.html（ヘッダー・フッター・書体・色）。作ったら build-i18n.js の jaUrls と llms.txt と journal.html の案内に足す。
"""
import json, re, sys
spec = json.load(open(sys.argv[1], encoding='utf8'))
src = open('tokyo.html', encoding='utf8').read()
head = src[:src.index('</head>') + 7]
hdr = src[src.index('  <header'):src.index('</header>') + 9]
footer = src[src.index('<footer'):src.index('</footer>') + 9]
S = spec['slug']; T = spec['title']; D = spec['desc']
ld = {"@context": "https://schema.org", "@graph": [
  {"@type": "Article", "@id": f"https://seam.site/{S}#article", "headline": spec['h1'], "inLanguage": "ja", "mainEntityOfPage": f"https://seam.site/{S}",
   "author": {"@id": "https://seam.site/#organization"}, "publisher": {"@id": "https://seam.site/#organization"}, "datePublished": spec['date'], "dateModified": spec['date'], **({"image": "https://seam.site/" + spec['image']} if spec.get('image') else {})},
  {"@type": "BreadcrumbList", "itemListElement": [{"@type": "ListItem", "position": 1, "name": "SEAM", "item": "https://seam.site/"},
    {"@type": "ListItem", "position": 2, "name": "読みもの", "item": "https://seam.site/journal"}, {"@type": "ListItem", "position": 3, "name": spec['crumb'], "item": f"https://seam.site/{S}"}]},
  {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in spec['faq']]}]}
h = re.sub(r'<title>[^<]*</title>', f'<title>{T}</title>', head)
for k in ['name="description"', 'property="og:description"']: h = re.sub(r'(<meta ' + k + r' content=")[^"]*', lambda m: m.group(1) + D, h)
h = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda m: m.group(1) + T, h)
if spec.get('image'): h = re.sub(r'(<meta property="og:image" content=")[^"]*', lambda m: m.group(1) + 'https://seam.site/' + spec['image'], h)
h = h.replace('https://seam.site/tokyo', f'https://seam.site/{S}')
h = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda m: '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>', h, flags=re.S)
P = lambda t: f'    <p class="mt-4 text-[13.5px] sm:text-[14px] text-charcoal/80">{t}</p>'
body = []
for sec in spec['sections']:
    if sec.get('h'): body.append(f'    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">{sec["h"]}</h2>')
    for p in sec.get('ps', []): body.append(P(p))
    if sec.get('ul'): body.append('    <ul class="mt-4 space-y-2 text-[13.5px] sm:text-[14px] text-charcoal/80">' + ''.join(f'<li>・ {x}</li>' for x in sec['ul']) + '</ul>')
    if sec.get('table'):
        rows = ''.join('<tr>' + ''.join(f'<td class="py-2 pr-3 align-top">{c}</td>' for c in r) + '</tr>' for r in sec['table'][1:])
        th = ''.join(f'<th class="py-2 pr-3 text-left font-normal text-gold">{c}</th>' for c in sec['table'][0])
        body.append(f'    <div class="mt-4 overflow-x-auto"><table class="w-full text-[13px] text-charcoal/80 border-t border-line"><thead><tr>{th}</tr></thead><tbody class="divide-y divide-line">{rows}</tbody></table></div>')
    if sec.get('chips'): body.append('    <div class="brandchips mt-5">' + ''.join(f'<a href="{a}">{b}</a>' for a, b in sec['chips']) + '</div>')
    if sec.get('links'): body.append(P('　'.join(f'<a href="{a}" class="text-gold">{b} →</a>' for a, b in sec['links'])))
faqh = ''.join(f'<div class="py-4"><dt class="font-serif text-[14.5px] text-ink">{q}</dt><dd class="mt-2 text-[13px] leading-[1.9] text-charcoal/75">{a}</dd></div>' for q, a in spec['faq'])
main = f'''<main id="seam-main">
  <article class="max-w-2xl mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-4 prose">
    <nav class="font-mono tracking-widest2 text-[10px] text-charcoal/50 uppercase mb-6"><a href="journal" class="hover:text-ink">Journal</a> <span class="mx-1">/</span> {spec['crumb']}</nav>
    <h1 class="font-serif text-[27px] sm:text-[34px] leading-[1.4] text-ink font-medium">{spec['h1']}<br><span class="text-[17px] sm:text-[20px] text-charcoal/70">{spec['sub']}</span></h1>
    <span class="tk-rule" aria-hidden="true"></span>
    <p class="text-[12px] text-charcoal/55">内容確認・最終更新 {spec['date_ja']}　SEAM（サロン専売ヘアケア 196ブランド正規取扱）</p>
{chr(10).join(body)}
    <h2 class="mt-12 font-serif text-[19px] sm:text-[22px] text-ink">よくある質問</h2>
    <dl class="mt-5 divide-y divide-line">{faqh}</dl>
    <div class="mt-12 flex items-center justify-between text-[12px] text-charcoal/60"><a href="journal" class="hover:text-ink">← 髪の読みもの一覧</a><a href="shop" class="hover:text-ink">店舗一覧 →</a></div>
  </article>
</main>'''
open(S + '.html', 'w', encoding='utf8').write(h + '\n<body>\n' + hdr + '\n' + main + '\n' + footer + '\n  <script src="js/seam-analytics.js?v=12" defer=""></script>\n</body></html>\n')
print('wrote', S + '.html')

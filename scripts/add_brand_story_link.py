# トキオ・オージュア・バイカルテのページから ブランドストーリー（*-story.html）へつなぐ（2026-10-02）
# 冪等：印のあいだを差し替える。build_brand_pages.py で作り直したら これも流す
# 使い方: python3 scripts/add_brand_story_link.py && node scripts/i18n_extract.js .
import re
S, E = '<!-- seam:story-link:start -->', '<!-- seam:story-link:end -->'
L = {
 'tokio': ('TOKIO INKARAMI', '銀座が生んだ ケラチンの美学'),
 'aujua': ('Aujua', 'アジアの髪を知り尽くす 八つのライン'),
 'bykarte': ('BYKARTE', 'あなたの髪のカルテから生まれた処方'),
}
for slug, (en, ja) in L.items():
    p = f'{slug}.html'; s = open(p, encoding='utf-8').read()
    block = (f'{S}\n    <a href="{slug}-story.html" class="mt-10 flex items-center justify-between gap-4 border border-line px-5 py-4 text-ink no-underline hover:border-ink" data-track-click="brand_story_{slug}">'
             f'<span><span class="block text-[11px] tracking-[.25em] text-charcoal/60">BRAND STORY</span>'
             f'<span class="block font-serif text-[17px] mt-1" style="word-break:keep-all;overflow-wrap:anywhere">{ja}</span>'
             f'<span class="block text-[12.5px] text-charcoal/70 mt-1">{en} の思想と技術 ラインの選び方を読む</span></span>'
             f'<span aria-hidden="true">→</span></a>\n    {E}\n')
    if S in s:
        s = re.sub(re.escape(S) + r'.*?' + re.escape(E) + r'\n', block, s, flags=re.S)
    else:
        s = s.replace('<!-- seam:line-guide:start -->', block + '\n    <!-- seam:line-guide:start -->', 1)
    assert S in s, slug
    open(p, 'w', encoding='utf-8').write(s)
    print('ok', p)

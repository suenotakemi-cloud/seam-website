# SEAM: 多言語化したブランド96枚の仕上げ（2026-08-11）
#
# 1枚目を本番で見て、2つ足りないことが分かった。
#
# 【① HTMLのhreflangが無かった】
#   build-i18n は **sitemap** に言語の組(xhtml:link)を書く。それは効いているが、
#   HTML側の `<link rel="alternate" hreflang>` は
#   **もとのページに書いてある前提**で、新しく多言語化した96枚には無かった。
#   既存の -tokyo と同じ形（ja/en/zh-Hans/zh-Hant/ko/x-default の6本）を入れる。
#   【罠】hreflangブロックは inject_jsonld.py の `seam:jsonld` マーカーの**外側**に置く。
#         内側に入れると再実行で丸ごと消える（brand.html で実際に起きた）。
#
# 【② アクセスのFAQ回答が日本語のままだった】
#   台湾語ページで「福岡門市的交通方式 → 西鉄天神駅から徒歩5分（大名）です」と出ていた。
#   駅名は日本語のまま役に立つ（現地で見せる・検索する）ので**駅名は訳さず**、
#   文の器だけを各言語にする。
#
# 冪等。
import re, json, sys, os, importlib.util

ROOT = sys.argv[1]
os.chdir(ROOT)
spec = importlib.util.spec_from_file_location('tbl', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'brand_pages_i18n_table.py'))
tbl = importlib.util.module_from_spec(spec); spec.loader.exec_module(tbl)
LANGS, BRAND, CITY = tbl.LANGS, tbl.BRAND, tbl.CITY
AREAS = ['ginza', 'omotesando', 'sapporo', 'osaka', 'nagoya', 'fukuoka', 'utsunomiya']

# 駅名・出口・徒歩分数は日本語のまま。前後の言い回しだけ訳す
ACCESS = {
 'ginza':      '銀座一丁目駅 7番出口から徒歩1分（銀座駅・京橋駅からも歩けます）',
 'omotesando': '表参道駅 A4出口から徒歩3分（南青山エリア）',
 'sapporo':    '地下鉄大通駅から徒歩1分',
 'osaka':      '四ツ橋駅 6番出口から徒歩2分（南堀江）',
 'nagoya':     '矢場町駅からすぐ（栄エリア・1階と2階のフロア）',
 'fukuoka':    '西鉄天神駅から徒歩5分（大名）',
 'utsunomiya': '鶴田駅から徒歩6分（お車での来店もしやすい立地）',
}
A2 = {'ja': '{X}です', 'en': '{X}.', 'zh': '{X}。', 'tw': '{X}。', 'ko': '{X}입니다.'}
A3 = {'ja': '不要です {X} 営業時間内にそのままお越しください',
      'en': 'No booking needed. {X} — just come during opening hours.',
      'zh': '无需预约。{X}，在营业时间内直接前来即可。',
      'tw': '無需預約。{X}，在營業時間內直接前來即可。',
      'ko': '예약은 필요 없습니다. {X} 영업시간 내에 그대로 오세요.'}

HREF = [('ja', ''), ('en', 'en/'), ('zh-Hans', 'zh/'), ('zh-Hant', 'tw/'), ('ko', 'ko/')]

BR = list(BRAND)
targets = [f'{b}.html' for b in BR if os.path.exists(f'{b}.html')]
targets += [f'{b}-{a}.html' for b in BR for a in AREAS if os.path.exists(f'{b}-{a}.html')]

n_h = n_a = 0
for f in targets:
    s = open(f, encoding='utf-8').read()
    slug = f[:-5]
    before = s

    # ① hreflang。jsonldマーカーの外＝</head> の直前に置く
    if 'rel="alternate"' not in s:
        links = ''.join(f'  <link rel="alternate" hreflang="{h}" href="https://seam.site/{d}{slug}">\n'
                        for h, d in HREF)
        links += f'  <link rel="alternate" hreflang="x-default" href="https://seam.site/{slug}">\n'
        i = s.find('</head>')
        assert i > 0, f'{f}: </head> が無い'
        s = s[:i] + links + s[i:]
        n_h += 1

    # ② アクセスのFAQ回答（エリアページのみ）
    a = slug.split('-', 1)[1] if '-' in slug and slug.split('-', 1)[1] in AREAS else None
    if a and 'SEAM_PAGE_I18N' in s:
        dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        d = json.loads(dm.group(2))
        ja2 = A2['ja'].replace('{X}', ACCESS[a])
        ja3 = A3['ja'].replace('{X}', ACCESS[a])
        touched = False
        for key, tmpl, ja in [('bp.a2', A2, ja2), ('bp.a3', A3, ja3)]:
            if f'data-i18n="{key}"' in s:
                continue
            pat = re.compile(r'(<(dd)((?:(?!data-i18n)[^>])*?))(>\s*)' + re.escape(ja) + r'(\s*</\2>)')
            m = pat.search(s)
            if not m:
                continue
            s = s[:m.start()] + m.group(1) + f' data-i18n="{key}"' + m.group(4) + ja + m.group(5) + s[m.end():]
            for L in LANGS:
                d[L][key] = tmpl[L].replace('{X}', ACCESS[a])
            touched = True
        if touched:
            dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
            s = (s[:dm.start()] + dm.group(1)
                 + json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
                 + dm.group(3) + s[dm.end():])
            n_a += 1

    if s != before:
        open(f, 'w', encoding='utf-8').write(s)

print(f'  hreflang を追加 {n_h}枚 / アクセスFAQを多言語化 {n_a}枚（対象 {len(targets)}枚）')

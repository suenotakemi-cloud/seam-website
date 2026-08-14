# SEAM: 札幌を「本店」として名乗らせる（2026-08-11）
#
# 【なぜ】オーナー「札幌にも入れてください 札幌が本店でもあるので」
#   ブランド×エリアの多言語化には札幌も入っている（48URLとも本番200を確認済み）。
#   足りていなかったのは **本店であることがどこにも書かれていない** ことだった。
#   日本語の「本店」はサイト全体で実質0回（226件ヒットするのは全部
#   中国語訳の「本店可遇见的〜」＝this store で、別物）。
#
# 【札幌が持っているもの】
#   ・**HPB ゴールド賞を2つ**（2026 BEST SALON GOLD Prize / 2025 サロン部門 GOLD Prize）
#     [[seam-headspa-store-menu]] のとおり **受賞したのは札幌だけ**なので、他店には出さない
#   ・株式会社hanico の本社も札幌（南1条西・札石ビル7F）
#   ・大通駅 徒歩1分・地下歩行空間で狸小路〜札幌駅とつながる
#
# 【やること】
#   ・salon-sapporo / store-sapporo の title と description に「本店」を入れる
#   ・本文にも1行入れる（5言語）。titleだけ変えて中身に無いのは前にやって直した失敗
#   ・**半個室は事実なので隠さない**（札幌・福岡は半個室）
#
# 冪等。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
MARK = '<!-- seam:sapporo-flagship -->'

# 【書いてよいことの線引き】
#   ・「本店」＝オーナーの言葉（2026-08-11）。これは名乗ってよい
#   ・「会社の本社も札幌」＝ tokushoho の株式会社hanico 本社住所（札幌・札石ビル7F）で裏が取れている
#   ・**「北海道で最初の店」は書かない**。創業の順番は確認できていない（一度書いて外した）
FLAG = {
 'ja': 'SEAMの本店です　会社の本社も札幌にあります',
 'en': 'This is the SEAM flagship store. Our company is also headquartered in Sapporo.',
 'zh': '这里是SEAM的本店。公司总部也设在札幌。',
 'tw': '這裡是SEAM的本店。公司總部也設在札幌。',
 'ko': 'SEAM의 본점입니다. 회사 본사도 삿포로에 있습니다.',
}

BLOCK = (MARK + '\n    <p class="mt-3 text-[13px] text-charcoal/80" style="line-height:2;" '
         'data-i18n="sap.flagship">' + FLAG['ja'] + '</p>')

PLAN = {
 'salon-sapporo.html': dict(
   old_t='札幌の縮毛矯正・髪質改善・カラー｜半個室の美容室 SEAM SAPPORO',
   new_t='札幌の縮毛矯正・髪質改善・カラー｜半個室 SEAM 札幌本店',
   desc_add='SEAMの本店です　',
   anchor='この店舗について'),
 'store-sapporo.html': dict(
   old_t='札幌のサロン専売ヘアケア取扱店｜SEAM SAPPORO',
   new_t='札幌のサロン専売・美容室専売品の販売店｜SEAM 札幌本店',
   desc_add='SEAMの本店です　',
   anchor='この店舗でできること'),
}

for f, p in PLAN.items():
    if not os.path.exists(f):
        print(f'  {f:24} 無し'); continue
    s = open(f, encoding='utf-8').read()
    changed = []

    # ① title（<title> と ja辞書の meta.title の両方。文字列が同じなので一括で置く）
    if p['new_t'] not in s and p['old_t'] in s:
        n = s.count(p['old_t'])
        s = s.replace(p['old_t'], p['new_t'])
        changed.append(f'title {n}箇所')

    # ② description の頭に足す
    m = re.search(r'(<meta name="description" content=")([^"]*)(")', s)
    if m and not m.group(2).startswith(p['desc_add']):
        s = s.replace(m.group(2), p['desc_add'] + m.group(2))
        changed.append('desc')

    # ③ 本文に1行（titleだけ変えて中身に無い状態を作らない）
    if MARK not in s:
        dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if dm:
            d = json.loads(dm.group(2))
            k = next((k for k, v in d['ja'].items()
                      if not k.startswith('meta.') and p['anchor'] in re.sub(r'<[^>]+>', '', v)), None)
            if k:
                at = s.find(f'data-i18n="{k}"')
                end = s.find('</', at)
                end = s.find('>', end) + 1
                s = s[:end] + '\n    ' + BLOCK + s[end:]
                for L in LANGS:
                    d[L]['sap.flagship'] = FLAG[L]
                dm = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
                s = (s[:dm.start()] + dm.group(1)
                     + json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True)
                     + dm.group(3) + s[dm.end():])
                changed.append('本文1行(5言語)')
            else:
                changed.append(f'⚠ 「{p["anchor"]}」が見つからず本文は未追加')

    if changed:
        open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:24} {" / ".join(changed) if changed else "変更なし"}')

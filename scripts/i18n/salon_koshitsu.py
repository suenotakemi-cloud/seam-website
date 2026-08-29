# SEAM: 「個室美容室」「個室ヘアサロン」を実態どおりに入れる（2026-08-25）
#
# 【なぜ】実測（Yahoo=Google索引）で 銀座/大阪/札幌 の「{地名} 個室 美容室」は全て圏外。
#   上位10のうち6〜7はHPB・楽天・オズモール等の集約ページ。
#   残る枠に入っている独立サロンは ROOMS(全席個室)・ルバート(完全個室)・room.(個室ヘアサロン)など
#   **個室そのものが看板**の店ばかり。
#
#   こちらは title に「完全個室の美容室」と入っていて 本文の個室は14回。密度は足りている。
#   足りていないのは2つ:
#     ① compound形「個室美容室」「個室ヘアサロン」が **0回**（検索はこの形で打たれる）
#     ② salon-{街} の被リンクが7〜9本（store-ginza は98本 hairsalon は81本）
#
# 【実態どおりに書く】
#   銀座・大阪 = 完全個室 → 「個室美容室」「個室ヘアサロン」と名乗ってよい
#   札幌・福岡 = 半個室   → 完全個室とは書かない
#   名古屋     = ヘア受付休止中 → **触らない**（予約できない店に送らない）
#
# 冪等。
import re, json, sys, os, glob

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

FULL = {  # 完全個室の店
  'salon-ginza.html':  ('銀座', 'Ginza', '银座', '銀座', '긴자'),
  'salon-osaka.html':  ('大阪', 'Osaka', '大阪', '大阪', '오사카'),
}
HALF = {  # 半個室の店
  'salon-sapporo.html': ('札幌', 'Sapporo', '札幌', '札幌', '삿포로'),
  'salon-fukuoka.html': ('福岡', 'Fukuoka', '福冈', '福岡', '후쿠오카'),
}

def line_full(n):
    return {
      'ja': f'<br>{n[0]}の個室美容室です まわりを気にせず過ごせる個室ヘアサロンをお探しの方にも',
      'en': f'<br>A private-room hair salon in {n[1]} — every seat in its own closed room',
      'zh': f'<br>{n[2]}的独立包间美容室，每个座位都是独立空间。',
      'tw': f'<br>{n[3]}的獨立包廂美容室，每個座位都是獨立空間。',
      'ko': f'<br>{n[4]}의 개인실 미용실입니다 좌석마다 독립된 공간을 준비하고 있습니다.',
    }

def line_half(n):
    return {
      'ja': f'<br>{n[0]}の半個室サロンです 隣を気にせず過ごせる席をご用意しています',
      'en': f'<br>A semi-private salon in {n[1]} — seats screened from one another',
      'zh': f'<br>{n[2]}的半包间沙龙，座位之间设有隔断。',
      'tw': f'<br>{n[3]}的半包廂沙龍，座位之間設有隔斷。',
      'ko': f'<br>{n[4]}의 반개인실 살롱입니다 좌석 사이에 칸막이가 있습니다.',
    }

HAS = {'ja': '個室美容室', 'en': 'private-room hair salon', 'zh': '独立包间美容室',
       'tw': '獨立包廂美容室', 'ko': '개인실 미용실'}
HAS_H = {'ja': '半個室サロン', 'en': 'semi-private salon', 'zh': '半包间沙龙',
         'tw': '半包廂沙龍', 'ko': '반개인실 살롱'}

n_body = n_dict = 0
for table, mk, has in ((FULL, line_full, HAS), (HALF, line_half, HAS_H)):
    for f, names in table.items():
        if not os.path.exists(f):
            print(f'  {f} 無し'); continue
        s = open(f, encoding='utf-8').read()
        before = s
        L = mk(names)

        # ① ja は HTML本体が正（辞書だけ直しても画面は変わらない）
        #    見るのは **その要素の中身だけ**（ファイル全体で見ると辞書に入っていて弾かれる）
        mp = re.search(r'(<p\b[^>]*data-i18n="s5"[^>]*>)(.*?)(</p>)', s, re.S)
        if mp and has['ja'] not in mp.group(2):
            s = s[:mp.end(2)] + L['ja'] + s[mp.end(2):]
            n_body += 1

        # ② 辞書は他言語ぶん
        m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
        if m:
            try: d = json.loads(m.group(2))
            except Exception: d = None
            if d and set(d) == set(LANGS):
                for lg in LANGS:
                    v = d[lg].get('s5', '')
                    if v and has[lg] not in v:
                        d[lg]['s5'] = v + L[lg]; n_dict += 1
                m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
                s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]

        if s == before:
            print(f'  {f:22} 変更なし'); continue
        i = s.find('window.SEAM_PAGE_I18N')
        if i > 0 and not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)):
            print(f'  {f:22} ★構造が壊れた → 書き戻さない'); continue
        if '</body>' not in s:
            print(f'  {f:22} ★</body>が消えた → 書き戻さない'); continue
        open(f, 'w', encoding='utf-8').write(s)
        print(f'  {f:22} 更新')

print(f'\n  本文 {n_body}件 / 辞書 {n_dict}件')

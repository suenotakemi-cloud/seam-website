# SEAM: 「ジャパニーズヘッドスパ」を5言語で入れる（2026-08-25）
#
# 【なぜ】旧サブドメイン ginza.seam.site の索引タイトルは
#   「SEAM GINZA | 銀座のジャパニーズヘッドスパ × TOKIOヘアケア」で、
#   この語で拾えていた形跡がある。ところが移行後の現行サイトには
#   **カタカナの「ジャパニーズヘッドスパ」が1枚も無かった**（英語 "Japanese head spa" は
#   meta にだけ有り、本文には無い）。海外の方が探すのはこの語なので入れ直す。
#
# 【どこに入れるか】
#   ・meta.description … ja / zh / tw / ko に不足（en は既に有り）
#   ・本文 s5（リード文）… 全言語で不足。**目に見える場所に無いと弱い**
#
# 【言い方】各言語で実際に検索される形にする。カタカナの直訳は使わない
#   zh 日式头皮SPA ／ tw 日式頭皮SPA ／ ko 재패니즈 헤드스파（일본식 헤드스파）
#   ja は句点を使わない社内ルールに合わせ 全角スペース区切り
#
# 冪等。既に入っていれば触らない。
import re, json, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
AREA = ['headspa-ginza.html', 'headspa-nagoya.html', 'headspa-osaka.html']

# ── 本文（s5 の末尾に足す1行）
LINE = {
 'ja': '<br>海外では ジャパニーズヘッドスパ と呼ばれる日本式の頭皮ケアです',
 'en': '<br>Overseas this is known as a Japanese head spa — scalp care in the Japanese way',
 'zh': '<br>这就是海外所说的日式头皮SPA，日本式的头皮护理。',
 'tw': '<br>這就是海外所說的日式頭皮SPA，日本式的頭皮護理。',
 'ko': '<br>해외에서 재패니즈 헤드스파라 불리는 일본식 두피 케어입니다.',
}
# 既に入っているかの判定語
HAS = {'ja': 'ジャパニーズヘッドスパ', 'en': 'Japanese head spa',
       'zh': '日式头皮SPA', 'tw': '日式頭皮SPA', 'ko': '재패니즈 헤드스파'}

# ── meta.description の言い換え（左を右に。無ければ触らない）
META = {
 'ja': [('完全個室のヘッドスパ', '完全個室のジャパニーズヘッドスパ')],
 'zh': [('完全包间头部水疗', '完全包间日式头皮SPA（头疗）')],
 'tw': [('完全包廂頭部水療', '完全包廂日式頭皮SPA（頭療）')],
 'ko': [('완전 개인실 헤드스파', '완전 개인실 재패니즈 헤드스파(일본식 헤드스파)')],
}

n_s5 = n_meta = 0
for f in AREA:
    if not os.path.exists(f):
        print(f'  {f} 無し'); continue
    s = open(f, encoding='utf-8').read()
    before = s
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    d = json.loads(m.group(2))
    if set(d) != set(LANGS):
        print(f'  {f} 5言語そろっていない → 触らない'); continue

    for L in LANGS:
        # 本文
        v = d[L].get('s5', '')
        if v and HAS[L] not in v:
            d[L]['s5'] = v + LINE[L]; n_s5 += 1
        # meta
        md = d[L].get('meta.description', '')
        if md and HAS[L] not in md:
            for a, b in META.get(L, []):
                if a in md:
                    d[L]['meta.description'] = md.replace(a, b, 1); n_meta += 1
                    break

    # 【罠】ja は **HTML本体が正**で、辞書の ja は言語切替のときにしか使われない。
    #   辞書だけ直しても日本語ページの画面と <meta> は変わらない（一度これで外した）。
    #   本文の <p data-i18n="s5"> と <meta name="description"> の実体も書き換える。
    # 【罠】判定をファイル全体でやると、辞書側に既に入っているせいで
    #   本文の書き換えが丸ごと飛ぶ（一度これで ja だけ入らなかった）。
    #   見るのは **その要素の中身だけ**
    mp = re.search(r'(<p\b[^>]*data-i18n="s5"[^>]*>)(.*?)(</p>)', s, re.S)
    if mp and HAS['ja'] not in mp.group(2):
        s = s[:mp.end(2)] + LINE['ja'] + s[mp.end(2):]
    md = re.search(r'(<meta[^>]*name="description"[^>]*content=")([^"]*)(")', s)
    if md and HAS['ja'] not in md.group(2):
        for a, b in META['ja']:
            if a in md.group(2):
                s = s[:md.start(2)] + md.group(2).replace(a, b, 1) + s[md.end(2):]
                break

    # 辞書の位置は書き換え後に取り直す（HTMLを触ったぶんずれるため）
    m2 = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    s = s[:m2.start()] + m2.group(1) + json.dumps(d, ensure_ascii=False, sort_keys=True) + m2.group(3) + s[m2.end():]
    if s == before:
        print(f'  {f:24} 変更なし'); continue
    # 構造チェック
    i = s.find('window.SEAM_PAGE_I18N')
    if not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)) or '</body>' not in s:
        print(f'  {f:24} ★ 構造が壊れた → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:24} 更新')

# ── ハブ（headspa.html）は **JS単引用符様式**なので値だけ差し替える
HUB = 'headspa.html'
if os.path.exists(HUB):
    s = open(HUB, encoding='utf-8').read()
    before = s
    # ja の meta.description だけ言い換える（en/zh/tw/ko は既に該当語あり）
    mm = re.search(r"('meta\.description'\s*:\s*')((?:[^'\\]|\\.)*)(')", s)
    if mm and 'ジャパニーズヘッドスパ' not in mm.group(2) and 'SEAMのヘッドスパ' in mm.group(2):
        s = s[:mm.start(2)] + mm.group(2).replace('SEAMのヘッドスパ', 'SEAMのジャパニーズヘッドスパ', 1) + s[mm.end(2):]
    # ハブも ja は HTML 本体が正。<meta> の実体も書き換える
    md = re.search(r'(<meta[^>]*name="description"[^>]*content=")([^"]*)(")', s)
    if md and 'ジャパニーズヘッドスパ' not in md.group(2) and 'SEAMのヘッドスパ' in md.group(2):
        s = s[:md.start(2)] + md.group(2).replace('SEAMのヘッドスパ', 'SEAMのジャパニーズヘッドスパ', 1) + s[md.end(2):]
    if s != before:
        i = s.find('window.SEAM_PAGE_I18N')
        if not (s.rfind('<script', 0, i) > s.rfind('</script>', 0, i)) or '</body>' not in s:
            print(f'  {HUB:24} ★ 構造が壊れた → 書き戻さない')
        else:
            open(HUB, 'w', encoding='utf-8').write(s)
            print(f'  {HUB:24} ja の meta を更新')
    else:
        print(f'  {HUB:24} 変更なし')

print(f'\n  本文 {n_s5}件 / meta {n_meta}件')

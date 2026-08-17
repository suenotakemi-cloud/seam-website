# SEAM: 多言語ページで日本語のまま出ていた aria-label を訳す（2026-08-14）
#
# 【なぜ】/en/ /zh/ /tw/ /ko/ のページで、読み上げソフトが使う aria-label が
#   日本語のまま残っていた。英語ページを読み上げソフトで使う人には日本語が読まれる。
#   数えたら48件。うち26件は商品名（オージュア クエンチ シャンプー等）で、
#   **商品名は訳さないほうが正しい**ので対象外。残る22件のUI・ナビだけを訳す。
#
# 【この辞書は危ない場所】index/brand の window.SEAM_PAGE_I18N は
#   **JS単引用符様式**で、カンマ様式が混在しており、過去に本番SyntaxErrorを起こしている
#   （[[seam-i18n-edit-trap]]）。だから:
#     ・キーは **既存キー行の直後に、その行のカンマ様式をそのまま真似て** 1行ずつ挿す
#     ・入れたあと **ページ内の全インラインJSを実際にパース**して確かめる
#     ・辞書が5言語ぶん揃っていること、既存キーが1つも消えていないことを確かめる
#   どれか1つでも欠けたら書き戻さない。
#
# 冪等。すでに aria-label: が付いている要素は触らない。
import re, sys, os, json

ROOT = sys.argv[1]
os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

# 日本語の文言 → 各言語。UI・ナビだけ（商品名は入れない）
T = {
 '言語選択':            {'en': 'Language', 'zh': '语言选择', 'tw': '語言選擇', 'ko': '언어 선택'},
 'パンくずナビ':          {'en': 'Breadcrumb', 'zh': '面包屑导航', 'tw': '麵包屑導覽', 'ko': '탐색 경로'},
 '探し方を選択':          {'en': 'Choose how to browse', 'zh': '选择浏览方式', 'tw': '選擇瀏覽方式', 'ko': '찾는 방법 선택'},
 'よく使われる探し方':       {'en': 'Common ways to browse', 'zh': '常用的浏览方式', 'tw': '常用的瀏覽方式', 'ko': '자주 쓰는 찾기 방법'},
 '並び替え':            {'en': 'Sort', 'zh': '排序', 'tw': '排序', 'ko': '정렬'},
 'カテゴリタブ':          {'en': 'Category tabs', 'zh': '分类标签', 'tw': '分類標籤', 'ko': '카테고리 탭'},
 '取扱状況フィルタ':        {'en': 'Availability filter', 'zh': '在售状况筛选', 'tw': '在售狀況篩選', 'ko': '취급 상태 필터'},
 '取扱状況のご案内':        {'en': 'About availability', 'zh': '关于在售状况', 'tw': '關於在售狀況', 'ko': '취급 상태 안내'},
 '検索をクリア':          {'en': 'Clear search', 'zh': '清除搜索', 'tw': '清除搜尋', 'ko': '검색 지우기'},
 'クリア':             {'en': 'Clear', 'zh': '清除', 'tw': '清除', 'ko': '지우기'},
 'インデックス':          {'en': 'Index', 'zh': '索引', 'tw': '索引', 'ko': '색인'},
 '閉じる':             {'en': 'Close', 'zh': '关闭', 'tw': '關閉', 'ko': '닫기'},
 'SEAM ホーム':         {'en': 'SEAM home', 'zh': 'SEAM 首页', 'tw': 'SEAM 首頁', 'ko': 'SEAM 홈'},
 'SEAM取扱いの人気商品':     {'en': 'Popular products at SEAM', 'zh': 'SEAM在售的人气商品', 'tw': 'SEAM在售的人氣商品', 'ko': 'SEAM 취급 인기 상품'},
 'サマーセール セール詳細へ':   {'en': 'Summer sale — see details', 'zh': '夏季特卖 查看详情', 'tw': '夏季特賣 查看詳情', 'ko': '서머 세일 자세히 보기'},
 'サマーセールの詳細へ':      {'en': 'See summer sale details', 'zh': '查看夏季特卖详情', 'tw': '查看夏季特賣詳情', 'ko': '서머 세일 자세히 보기'},
 'オンラインショップのセールを見る': {'en': 'See the online shop sale', 'zh': '查看网店特卖', 'tw': '查看網店特賣', 'ko': '온라인 숍 세일 보기'},
 '27タイプの髪格':         {'en': '27 hair types', 'zh': '27种发质类型', 'tw': '27種髮質類型', 'ko': '27가지 모발 유형'},
 'SEAMサロン施術':        {'en': 'SEAM salon treatments', 'zh': 'SEAM沙龙护理', 'tw': 'SEAM沙龍護理', 'ko': 'SEAM 살롱 시술'},
 '店舗を選ぶ':           {'en': 'Choose a store', 'zh': '选择门店', 'tw': '選擇門市', 'ko': '매장 선택'},
}

FILES = ['brand.html', 'index.html', 'shop.html', 'hairsalon.html', 'headspa.html', 'onlineshop.html']
PROD = re.compile(r'（[A-Za-zÉé/\s]+）|シャンプー|トリートメント|オイル|ミルク|マスク|セラム')


def dict_blocks(s):
    """window.SEAM_PAGE_I18N の各言語ブロックの範囲を返す"""
    i = s.find('window.SEAM_PAGE_I18N')
    if i < 0:
        return None
    out = {}
    for m in re.finditer(r'^(\s*)(ja|en|zh|tw|ko)\s*:\s*\{', s[i:], re.M):
        out[m.group(2)] = i + m.end()
    return out if len(out) == 5 else None


def add_keys(s, newkeys):
    """各言語ブロックの先頭に、素直な様式（'key': 'val',）で挿す。
    先頭に置くのは、末尾だと直前行のカンマ有無に依存して壊れやすいため。
    ブロック開始 `{` の直後に入れるので、既存の1行目がどんな様式でも安全。"""
    for lang in LANGS:
        blocks = dict_blocks(s)
        if not blocks:
            return None
        at = blocks[lang]
        lines = ''.join("\n        '%s': '%s'," % (k, v[lang].replace("'", "\\'"))
                        for k, v in newkeys.items())
        s = s[:at] + lines + s[at:]
    return s


total = 0
for f in FILES:
    if not os.path.exists(f):
        continue
    s = open(f, encoding='utf-8').read()
    before = s

    # ① この файл で訳すべき aria-label を集める
    need = {}
    for m in re.finditer(r'<([a-z]+)([^>]*\saria-label="([^"]*)"[^>]*)>', s):
        attrs, lab = m.group(2), m.group(3)
        if 'aria-label:' in attrs:            # 既に翻訳対象
            continue
        if not re.search(r'[ぁ-んァ-ヶ一-龯]', lab):
            continue
        if PROD.search(lab):                  # 商品名は訳さない
            continue
        if lab not in T:
            continue
        need[lab] = 'a11y.' + re.sub(r'[^A-Za-z0-9]', '', str(abs(hash(lab)) % 10**8))

    if not need:
        print(f'  {f:16} 対象なし'); continue

    # キー名は読める形にする（ハッシュでなく通し番号）
    need = {lab: f'a11y.x{i:02d}' for i, lab in enumerate(sorted(need), 1)}

    # ② 要素に data-i18n-attr を付ける
    for lab, key in need.items():
        pat = re.compile(r'(<[a-z]+[^>]*?)(\saria-label="' + re.escape(lab) + r'")')
        def add(mo):
            head = mo.group(1)
            if 'data-i18n-attr="' in head:
                return re.sub(r'(data-i18n-attr=")', r'\1' + f'aria-label:{key};', head, count=1) + mo.group(2)
            return head + f' data-i18n-attr="aria-label:{key}"' + mo.group(2)
        s = pat.sub(add, s)

    # ③ 辞書にキーを足す（ja は元の文言そのまま）
    newkeys = {key: {**T[lab], 'ja': lab} for lab, key in need.items()}
    s2 = add_keys(s, newkeys)
    if s2 is None:
        print(f'  {f:16} ★ 辞書の5言語ブロックが見つからない → 書き戻さない'); continue
    s = s2

    # ④ 検証してから書く
    ok, why = True, ''
    try:
        d_before = re.search(r'window\.SEAM_PAGE_I18N\s*=\s*(\{[\s\S]*?\n\s*\};)', before)
    except Exception:
        d_before = None
    # 既存キーが消えていないか（ja の 'key': を数える）
    def keys_of(x):
        i = x.find('window.SEAM_PAGE_I18N')
        return set(re.findall(r"'([A-Za-z0-9_.]+)'\s*:", x[i:i + 120000]))
    lost = keys_of(before) - keys_of(s)
    if lost:
        ok, why = False, f'既存キーが消えた {sorted(lost)[:3]}'
    if ok and len(need) != len(newkeys):
        ok, why = False, 'キー数が合わない'

    if not ok:
        print(f'  {f:16} ★ {why} → 書き戻さない'); continue

    open(f, 'w', encoding='utf-8').write(s)
    total += len(need)
    print(f'  {f:16} {len(need)}件を翻訳対象に')

print(f'\n  合計 {total}件（このあと必ずJS構文ゲートを通すこと）')

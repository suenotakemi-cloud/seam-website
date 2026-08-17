# SEAM: ハブ2枚の「地域LPリンク」と「全国の店舗」のラベルを5言語に（2026-08-17）
#
# 【なぜ】実行時レンダリング後の本文を機械で読んだところ、多言語ページで
#   ・「銀座の個室ヘッドスパ」等の地域LPリンク7本
#   ・footer の店舗名7つ（銀座・表参道…）
#   が日本語のまま出ていた。飛び先は /en/... と正しく言語別なのに、
#   ラベルだけ置き去り＝押す前に何のリンクか読めない。
#   見出し「全国の店舗」には data-i18n="g3" が付いているのに、
#   その下のリンクに付いていなかった。
#
# 【この辞書は危ない場所】index/shop の window.SEAM_PAGE_I18N は JS単引用符様式で
#   カンマ様式が混在しており、過去に本番SyntaxErrorを起こしている
#   （[[seam-i18n-edit-trap]]）。だからキーは **各言語ブロックの `{` の直後** に挿す。
#   末尾に足すと直前行のカンマ有無に依存して壊れる。
#   入れたあと全インラインJSをパースし、辞書を5言語ぶん評価して確かめる。
#
# 【名古屋】ヘアは受付休止中。salon 側のリンクに名古屋は無い（元から正しい）ので触らない。
# 冪等。
import re, sys, os, json, subprocess, tempfile

ROOT = sys.argv[1]; os.chdir(ROOT)
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']
FILES = ['index.html', 'shop.html']

CITY = {
 'ginza':      {'ja': '銀座',   'en': 'Ginza',      'zh': '银座',   'tw': '銀座',   'ko': '긴자'},
 'omotesando': {'ja': '表参道', 'en': 'Omotesando', 'zh': '表参道', 'tw': '表參道', 'ko': '오모테산도'},
 'sapporo':    {'ja': '札幌',   'en': 'Sapporo',    'zh': '札幌',   'tw': '札幌',   'ko': '삿포로'},
 'osaka':      {'ja': '大阪',   'en': 'Osaka',      'zh': '大阪',   'tw': '大阪',   'ko': '오사카'},
 'nagoya':     {'ja': '名古屋', 'en': 'Nagoya',     'zh': '名古屋', 'tw': '名古屋', 'ko': '나고야'},
 'fukuoka':    {'ja': '福岡',   'en': 'Fukuoka',    'zh': '福冈',   'tw': '福岡',   'ko': '후쿠오카'},
 'utsunomiya': {'ja': '宇都宮', 'en': 'Utsunomiya', 'zh': '宇都宫', 'tw': '宇都宮', 'ko': '우쓰노미야'},
}
# 見出し
HEAD = {
 'lp.h.spa':   {'ja': '個室ヘッドスパ', 'en': 'Private-room head spa',
                'zh': '独立包间头皮SPA', 'tw': '獨立包廂頭皮SPA', 'ko': '개인실 헤드스파'},
 'lp.h.salon': {'ja': 'ヘアサロン（髪質改善・縮毛矯正）',
                'en': 'Hair salon (hair-improving treatment & straightening)',
                'zh': '美发沙龙（发质改善・缩毛矫正）',
                'tw': '美髮沙龍（髮質改善・縮毛矯正）',
                'ko': '헤어살롱(모발 개선·매직 스트레이트)'},
}
# 「{都市}の{サービス}」の型。都市名だけ差し替える
SPA   = {'en': 'Private-room head spa in {c}', 'zh': '{c}的独立包间头皮SPA',
         'tw': '{c}的獨立包廂頭皮SPA', 'ko': '{c}의 개인실 헤드스파'}
SALON = {'en': 'Hair-improving treatment & straightening in {c}', 'zh': '{c}的发质改善・缩毛矫正',
         'tw': '{c}的髮質改善・縮毛矯正', 'ko': '{c}의 모발 개선·매직 스트레이트'}


def build_keys():
    K = dict(HEAD)
    for city in ('ginza', 'nagoya', 'osaka'):
        K['lp.spa.' + city] = {L: (CITY[city]['ja'] + 'の個室ヘッドスパ' if L == 'ja'
                                   else SPA[L].format(c=CITY[city][L])) for L in LANGS}
    for city in ('ginza', 'sapporo', 'osaka', 'fukuoka'):
        K['lp.salon.' + city] = {L: (CITY[city]['ja'] + 'の髪質改善・縮毛矯正' if L == 'ja'
                                     else SALON[L].format(c=CITY[city][L])) for L in LANGS}
    for city, v in CITY.items():
        K['city.' + city] = v
    return K


def dict_blocks(s):
    i = s.find('window.SEAM_PAGE_I18N =')
    if i < 0:
        return None
    out = {}
    for m in re.finditer(r'^(\s*)(ja|en|zh|tw|ko)\s*:\s*\{', s[i:], re.M):
        out[m.group(2)] = i + m.end()
    return out if len(out) == 5 else None


def eval_dict(src):
    """辞書を **言語ごとに** 実際に評価して返す。
    【罠】以前は正規表現で 'key': を拾って全言語を混ぜた1つの集合にしていた。
    それだと「en だけキーが落ちた」が検出できない。node で本物として評価する。
    戻り値: {lang: {key: value}} / 評価できなければ None"""
    m = re.search(r'window\.SEAM_PAGE_I18N\s*=\s*\{', src)
    if not m:
        return None
    d = src.index('{', m.start())
    depth, j, q = 0, d, None
    while j < len(src):
        c, pr = src[j], src[j - 1]
        if q:
            if c == q and pr != '\\':
                q = None
        elif c in '\'"`':
            q = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if not depth:
                j += 1
                break
        j += 1
    lit = src[d:j]
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write('const D = (' + lit + ');\n'
                'process.stdout.write(JSON.stringify(D));\n')
        tmp = t.name
    try:
        out = subprocess.run(['node', tmp], capture_output=True, text=True, timeout=60)
        if out.returncode != 0:
            return None
        return json.loads(out.stdout)
    except Exception:
        return None
    finally:
        os.unlink(tmp)


def scripts_parse(src):
    """全インラインscriptを node の new Function() でパースできるか"""
    with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as t:
        t.write("""
const fs=require('fs');
const src=fs.readFileSync(process.argv[2],'utf8');
const re=/<script(?![^>]*\\bsrc=)([^>]*)>([\\s\\S]*?)<\\/script>/g;
let m,bad=0;
while((m=re.exec(src))){
  const attrs=m[1]||'';
  const ty=(/type="([^"]*)"/.exec(attrs)||[])[1]||'';
  if(ty && !/javascript|module/i.test(ty)) continue;
  try{ new Function(m[2]); }catch(e){ bad++; process.stdout.write(e.message.slice(0,60)); break; }
}
if(!bad) process.stdout.write('OK');
""")
        js = t.name
    with tempfile.NamedTemporaryFile('w', suffix='.html', delete=False, encoding='utf-8') as t:
        t.write(src)
        html = t.name
    try:
        out = subprocess.run(['node', js, html], capture_output=True, text=True, timeout=120)
        return out.stdout.strip() == 'OK', out.stdout.strip()[:60]
    except Exception as e:
        return False, str(e)[:60]
    finally:
        os.unlink(js); os.unlink(html)


def write_gate(f, src, before):
    """書き込んでよいかを判定する。ひとつでも駄目なら理由を返す"""
    # 1. 辞書を5言語ぶん個別に評価できること
    D = eval_dict(src)
    if D is None:
        return '辞書が評価できない'
    missing = [L for L in LANGS if L not in D]
    if missing:
        return f'辞書に言語が無い {missing}'
    # 2. 5言語のキー集合が一致すること
    base = set(D['ja'])
    for L in LANGS:
        if set(D[L]) != base:
            only = sorted(base ^ set(D[L]))[:3]
            return f'{L} のキー集合がjaと違う {only}'
    # 3. 既存キーが言語ごとに1つも消えていないこと
    B = eval_dict(before)
    if B:
        for L in LANGS:
            lost = set(B.get(L, {})) - set(D[L])
            if lost:
                return f'{L} で既存キーが消えた {sorted(lost)[:3]}'
    # 4. 全インラインscriptがパースできること
    ok, why = scripts_parse(src)
    if not ok:
        return f'JSがパースできない {why}'
    # 5. 辞書が script 要素の中にあること
    i = src.find('window.SEAM_PAGE_I18N')
    if not (src.rfind('<script', 0, i) > src.rfind('</script>', 0, i)):
        return '辞書が script の外に出た'
    # 6. 末尾が残っていること
    if '</body>' not in src:
        return '</body> が消えた'
    return None


for f in FILES:
    if not os.path.exists(f):
        print(f'  {f:14} 無し'); continue
    s = open(f, encoding='utf-8').read()
    before = s
    K = build_keys()

    # ① 地域LPリンク块（マーカーの内側だけ）に data-i18n を付ける
    m = re.search(r'<!-- seam:hub-lp-links:start -->(.*?)<!-- seam:hub-lp-links:end -->', s, re.S)
    if not m:
        print(f'  {f:14} 地域LPリンク块が無い'); continue
    blk = m.group(1)
    for key, v in K.items():
        if not key.startswith('lp.'):
            continue
        ja = v['ja']
        # 既に付いていれば触らない（冪等）
        blk = re.sub(r'(<(a|p)\b(?![^>]*data-i18n=)[^>]*>)' + re.escape(ja) + r'(</\2>)',
                     lambda mo, k=key: mo.group(1)[:-1] + f' data-i18n="{k}">' + ja + mo.group(3),
                     blk)
    s = s[:m.start(1)] + blk + s[m.end(1):]

    # ② footer の店舗リンクに data-i18n（store-*.html を指す a だけ）
    def tag_city(mo):
        href, inner = mo.group(1), mo.group(3)
        slug = re.search(r'store-([a-z]+)\.html', href)
        if not slug or slug.group(1) not in CITY:
            return mo.group(0)
        if CITY[slug.group(1)]['ja'] != inner:
            return mo.group(0)
        return mo.group(0).replace('<a ', f'<a data-i18n="city.{slug.group(1)}" ', 1)
    s = re.sub(r'<a\s+href="([^"]*store-[a-z]+\.html)"((?![^>]*data-i18n=)[^>]*)>([^<]*)</a>', tag_city, s)

    # ③ 辞書へ（既存キーは足さない）
    D0 = eval_dict(s) or {}
    have = set(D0.get('ja', {}))
    new = {k: v for k, v in K.items() if k not in have}
    if new:
        for lang in LANGS:
            b = dict_blocks(s)
            if not b:
                print(f'  {f:14} ★ 辞書の5言語ブロックが見つからない → 書き戻さない'); s = None; break
            at = b[lang]
            lines = ''.join("\n        '%s': '%s'," % (k, v[lang].replace("\\", "\\\\").replace("'", "\\'"))
                            for k, v in new.items())
            s = s[:at] + lines + s[at:]
        if s is None:
            continue

    if s == before:
        print(f'  {f:14} 変更なし'); continue
    why = write_gate(f, s, before)
    if why:
        print(f'  {f:14} ★ {why} → 書き戻さない'); continue
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:14} data-i18n {len(re.findall(chr(34)+"city."  , s))}都市 / 新規キー {len(new)}')

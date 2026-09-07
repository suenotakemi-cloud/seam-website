# SEAM: a7d9991f が他言語の辞書から消してしまった「。」「、」を戻す（2026-09-07）
#
# 【何が起きたか】
#   fix_copy_style.py の①「タグの外の地の文」正規表現 (?<=>)[^<>]*[。、][^<>]*(?=<) が
#   <script>window.SEAM_PAGE_I18N = {...}</script> の中身も拾っていた。
#   JSON には < > が無いので まるごと一つの「地の文」に見える。
#   結果 ja だけでなく en/zh/tw/ko の値からも 。と、が消えた。
#   中国語(zh/tw)では「。」が正しい句点なので これは中文が壊れる。
#   実測 aujua.html の zh辞書 14個 → 0個 ／ zh/store-ginza の見える中文 22個 → 0個。
#
# 【戻し方の罠】
#   壊れ方は「消した」ではなく「。を半角スペースに置換」。しかも辞書まるごとを
#   ひとつの文字列として処理したので 文末処理も空白つぶしもブロック単位で効いている。
#   なので clean() を値ごとに再現しても一致しない（最初これで0件だった）。
#   → 句読点と空白を落とした形どうしで比べ 中身が同じものだけ戻す。
#
#   辞書がJS体（単引用符）で json.loads できないページは
#   fix_copy_style の②が元々何もできない＝jaも無傷なので ブロックごと戻す。
#
# 冪等。
import re, json, subprocess, sys, os

ROOT = sys.argv[1]; os.chdir(ROOT)
BEFORE = 'a7d9991f^'                    # 壊れる前
DICT_RE = re.compile(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', re.S)

# a7d9991f の時点で fix_copy_style.py が対象にしていた11枚だけが壊れうる
PAGES = ['tokio.html', 'bykarte.html', 'sublimic.html', 'system-professional.html',
         'milbon.html', 'oggi-otto.html', 'rekera.html', 'tsururincho.html',
         'aujua.html', 'kerastase.html', 'brand.html']


def bare(t):
    """句読点と空白を落とした芯。これが同じなら『句読点だけの違い』"""
    return re.sub(r'[\s。、]', '', t)


def show(rev, f):
    r = subprocess.run(['git', 'show', f'{rev}:{f}'], capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ''


n_page = n_val = n_block = 0
for f in PAGES:
    if not os.path.exists(f):
        continue
    now = open(f, encoding='utf-8').read()
    old_src = show(BEFORE, f)
    m_now, m_old = DICT_RE.search(now), DICT_RE.search(old_src)
    if not (m_now and m_old):
        continue

    try:
        d_now, d_old = json.loads(m_now.group(2)), json.loads(m_old.group(2))
    except Exception:
        # JS体：②が触れないので ja も無傷。ブロックごと戻す
        if m_now.group(2) != m_old.group(2):
            s = now[:m_now.start()] + m_now.group(1) + m_old.group(2) + m_now.group(3) + now[m_now.end():]
            assert '</body>' in s, f + ' が壊れた'
            open(f, 'w', encoding='utf-8').write(s)
            n_page += 1; n_block += 1
            print(f'  {f:<26} 辞書ブロックごと')
        continue

    fixed = 0
    for lang, vals in d_old.items():
        if lang == 'ja' or not isinstance(vals, dict) or lang not in d_now:
            continue
        for k, v_old in vals.items():
            v_now = d_now[lang].get(k)
            if (isinstance(v_old, str) and isinstance(v_now, str)
                    and v_now != v_old and bare(v_now) == bare(v_old)):
                d_now[lang][k] = v_old
                fixed += 1

    if fixed:
        s = (now[:m_now.start()] + m_now.group(1)
             + json.dumps(d_now, ensure_ascii=False, sort_keys=True)
             + m_now.group(3) + now[m_now.end():])
        assert '</body>' in s, f + ' が壊れた'
        open(f, 'w', encoding='utf-8').write(s)
        n_page += 1; n_val += fixed
        print(f'  {f:<26} {fixed}件')

print(f'  戻した {n_page}枚（値 {n_val}件 / ブロック {n_block}件）')

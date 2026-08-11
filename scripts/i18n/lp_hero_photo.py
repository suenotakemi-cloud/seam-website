# SEAM: サロンLPの最初の写真を「施術空間」にする（2026-08-11）
#
# 【なぜ】title を「{地名}の縮毛矯正・髪質改善・カラー」に変えたのに、
#   最初の大きな写真が商品棚（銀座）や外観（福岡）のままだった。
#   検索から来た人が最初に知りたいのは「どんな施術を、どんな空間で受けるか」。
#   店の写真としてはきれいでも、検索意図と最初の絵が食い違っている。
#
# 【オーナー確認済み】2026-08-11
#   ・images/stores/salon_private_room.jpg は **大阪店** の個室
#   ・**札幌と福岡以外は同じような個室**なので、この写真を使ってよい
#   ・名古屋はサロン休止中なので対象外
#   → 対象は 銀座 と 大阪 の2枚。札幌・福岡は半個室なので使わない（嘘になる）
#
# 【正直さ】銀座のページに出すのは大阪店の個室なので、キャプションに「写真は大阪店」と入れる。
#   使ってよいと言われていても、どの店の写真かを偽らない。大阪のページには注記は要らない。
#
# 【商品棚は捨てない】197ブランドはSEAM最大の差別化なので、
#   元のヒーロー写真は「{地名}店で買える主なブランド」の節へ移して残す。
#
# 冪等。マーカーで判定して2回流しても増えない。
import re, json, sys, os

ROOT = sys.argv[1]
os.chdir(ROOT)

MARK = '<!-- seam:lp-hero-room -->'

# 対象と、その店にどう書くか
TARGET = {
    'ginza': dict(
        store='store_ginza', note=True,
        cap={'ja': '完全個室でご案内します　写真は大阪店の個室です',
             'en': 'Treatments take place in a fully private room. Photo: our Osaka store.',
             'zh': '在完全独立包间为您服务。照片为大阪店的包间。',
             'tw': '在完全獨立包廂為您服務。照片為大阪店的包廂。',
             'ko': '완전 개인실에서 시술해 드립니다. 사진은 오사카점의 개인실입니다.'},
        alt={'ja': 'SEAMの完全個室（写真は大阪店）', 'en': 'A fully private room at SEAM (photo: Osaka)',
             'zh': 'SEAM的完全独立包间（照片为大阪店）', 'tw': 'SEAM的完全獨立包廂（照片為大阪店）',
             'ko': 'SEAM의 완전 개인실 (사진은 오사카점)'}),
    'osaka': dict(
        store='store_osaka', note=False,
        cap={'ja': 'SEAM OSAKA HORIE の完全個室',
             'en': 'The fully private room at SEAM OSAKA HORIE',
             'zh': 'SEAM OSAKA HORIE 的完全独立包间',
             'tw': 'SEAM OSAKA HORIE 的完全獨立包廂',
             'ko': 'SEAM OSAKA HORIE의 완전 개인실'},
        alt={'ja': 'SEAM OSAKA HORIE の完全個室', 'en': 'The private room at SEAM OSAKA HORIE',
             'zh': 'SEAM OSAKA HORIE 的完全独立包间', 'tw': 'SEAM OSAKA HORIE 的完全獨立包廂',
             'ko': 'SEAM OSAKA HORIE의 완전 개인실'}),
}
LANGS = ['ja', 'en', 'zh', 'tw', 'ko']

# 個室のヒーロー。1024x768 なので max-height で切れる分は object-position で上寄りに
ROOM_FIG = MARK + '''
    <figure class="mt-7 overflow-hidden rounded-[4px]">
      <picture>
        <source srcset="images/stores/salon_private_room.avif" type="image/avif">
        <source srcset="images/stores/salon_private_room.webp" type="image/webp">
        <img src="images/stores/salon_private_room.jpg" alt="__ALT__" width="1024" height="768"
             fetchpriority="high" decoding="async" class="w-full h-auto object-cover"
             style="max-height:380px;object-position:center 42%;" data-i18n-attr="alt:room.alt">
      </picture>
      <figcaption class="mt-2 text-[11.5px] text-charcoal/55" data-i18n="room.cap">__CAP__</figcaption>
    </figure>'''


def load(f):
    s = open(f, encoding='utf-8').read()
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    return s, json.loads(m.group(2))


def put_dict(s, d):
    m = re.search(r'(window\.SEAM_PAGE_I18N\s*=\s*)(\{.*?\})(\s*;)', s, re.S)
    return s[:m.start()] + m.group(1) + json.dumps(d, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + m.group(3) + s[m.end():]


def key_of(d, needle):
    for k, v in d['ja'].items():
        if not k.startswith('meta.') and needle in re.sub(r'<[^>]+>', '', v):
            return k
    return None


for slug, cfg in TARGET.items():
    f = f'salon-{slug}.html'
    s, d = load(f)

    if MARK in s:
        # 既にある → 中身だけ更新（写真やキャプションを直したら反映される）
        s = re.sub(re.escape(MARK) + r'[\s\S]*?</figure>', MARK + '\n<<PLACEHOLDER>>', s, count=1)
        fig = ROOM_FIG[len(MARK):].lstrip('\n')
        s = s.replace(MARK + '\n<<PLACEHOLDER>>', MARK + '\n' + fig, 1)
        msg = 'ヒーロー更新'
    else:
        # 既存のヒーロー figure（商品棚/外観）を取り出して、ブランドの節へ移す
        fm = re.search(r'[ \t]*<figure[\s\S]*?</figure>\n?', s)
        assert fm, f'{f}: ヒーローのfigureが無い'
        old = fm.group(0)
        assert cfg['store'] in old, f'{f}: 想定と違う写真 → {old[:120]}'
        s = s[:fm.start()] + ROOM_FIG + '\n' + s[fm.end():]

        # 「{地名}店で買える主なブランド」の節の末尾へ商品棚を置く
        bk = key_of(d, '店で買える主なブランド')
        if bk:
            at = s.find(f'data-i18n="{bk}"')
            end = s.find('</section>', at)
            s = s[:end] + old.rstrip('\n ') + '\n    ' + s[end:]
            msg = 'ヒーロー→個室 / 商品棚はブランドの節へ移設'
        else:
            msg = 'ヒーロー→個室（ブランドの節が無いので商品棚は削除せず末尾へ）'
            s = s.rstrip() + '\n'
            msg = 'ヒーロー→個室（ブランドの節が見つからず商品棚は移設せず）'

    for L in LANGS:
        d[L]['room.cap'] = cfg['cap'][L]
        d[L]['room.alt'] = cfg['alt'][L]
    s = put_dict(s, d)
    s = s.replace('__ALT__', cfg['alt']['ja']).replace('__CAP__', cfg['cap']['ja'])
    open(f, 'w', encoding='utf-8').write(s)
    print(f'  {f:20} {msg}')

print('\n札幌・福岡は半個室なので対象外（この写真を出すと嘘になる）')
print('名古屋はサロン休止中なので対象外')

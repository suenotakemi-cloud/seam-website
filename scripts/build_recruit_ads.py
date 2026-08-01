#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SEAM 求人 Meta広告のクリエイティブを作る（1080×1080）。

勝ちパターン（CTR 6.15% の求人ペラ一）から採るのは3つだけ:
  ① 二人称フック  ② 実写（生成画像は使わない）  ③ 事実に基づく希少性

【重要・過去の事故】
  1. 「東京・銀座店 募集終了」…… 銀座は現在4職種を募集中で、事実と違った
  2. 「※この募集は 一般公開していません」…… seam.site/recruit は公開ページで
     sitemapにも15URL載っており、しかも広告のリンク先そのもの。
     クリックした瞬間に嘘だとわかる。
  → **希少性は build_recruit_pages.py の ROLE_STORES から機械的に導く**。
     手で「限定」と書かない。

コピールール（[[seam-copy-style-rules]]）: 句点「。」は使わない・読点は最小限。
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'images', 'ads', 'recruit')
MINCHO = '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc'

# build_recruit_pages.py と同じ定義（ズレたら希少性の記述が嘘になるので必ず揃える）
STYLIST_STORES = ["ginza", "sapporo", "osaka", "nagoya", "fukuoka"]
SPANIST_STORES = ["ginza", "osaka", "nagoya"]
ASSISTANT_STORES = ["fukuoka"]
SHOPMGR_STORES = ["ginza", "omotesando", "sapporo"]
PARTTIME_STORES = ["ginza", "omotesando"]
ROLE_JA = {"stylist": "スタイリスト", "spanist": "スパニスト", "assistant": "アシスタント",
           "shopmanager": "ショップ管理者", "parttime": "アルバイト"}
ROLE_STORES = {"stylist": STYLIST_STORES, "spanist": SPANIST_STORES,
               "assistant": ASSISTANT_STORES, "shopmanager": SHOPMGR_STORES,
               "parttime": PARTTIME_STORES}

def roles_of(slug):
    return [r for r, ss in ROLE_STORES.items() if slug in ss]

# 見出しに立てる職種の優先順。単純に「いちばん少ない職種」を選ぶと
# 東京がアルバイトになり、求人広告として弱くなる（実際そうなった）。
# スパニストはSEAMの看板でいちばん探される職種なので先頭に置く。
HOOK_PRIORITY = ["spanist", "assistant", "shopmanager", "stylist", "parttime"]

def scarcity(slugs):
    """その広告で言える希少性を ROLE_STORES から導く。作らない・盛らない。
    優先度の高い職種のうち、いちばん店舗数が少ないものを見出しにする。"""
    present = {r for slug in slugs for r in roles_of(slug)}
    if not present:
        return ''
    r = sorted(present, key=lambda x: (HOOK_PRIORITY.index(x), len(ROLE_STORES[x])))[0]
    n = len(ROLE_STORES[r])
    if n == 1:
        return f'{ROLE_JA[r]}の募集は {ROLE_JA_AREA[ROLE_STORES[r][0]]}だけです'
    return f'{ROLE_JA[r]}の募集は {n}店のみ'

ROLE_JA_AREA = {"ginza": "銀座", "omotesando": "表参道", "sapporo": "札幌",
                "osaka": "大阪", "nagoya": "名古屋", "fukuoka": "福岡"}

# 広告セット＝エリア。東京は銀座＋表参道をひとつにまとめる（自己競合を避けるため）
ADS = [
    {"key": "tokyo",   "title": "SEAM 東京",   "slugs": ["ginza", "omotesando"],
     "photo": "images/stores/headspa_ginza_room.jpg"},
    {"key": "sapporo", "title": "SEAM 札幌",   "slugs": ["sapporo"],
     "photo": "images/stores/store_sapporo.jpg"},
    {"key": "osaka",   "title": "SEAM 大阪",   "slugs": ["osaka"],
     "photo": "images/stores/store_osaka.jpg"},
    {"key": "nagoya",  "title": "SEAM 名古屋", "slugs": ["nagoya"],
     "photo": "images/stores/store_nagoya.jpg"},
    {"key": "fukuoka", "title": "SEAM 福岡",   "slugs": ["fukuoka"],
     "photo": "images/stores/store_fukuoka.jpg"},
]

EYEBROW = 'いま 転職を考えていなくても'      # 二人称・事実の主張をしない
CLOSING = '見学・相談からで大丈夫です'        # 求人ページに見学導線が実在する

SIZE = 1080
BRIGHTNESS = 0.30      # 文字が確実に読める暗さ
GOLD = (198, 166, 106)


def cover(img, size):
    w, h = img.size
    s = max(size / w, size / h)
    img = img.resize((int(w * s + 1), int(h * s + 1)), Image.LANCZOS)
    w, h = img.size
    return img.crop(((w - size) // 2, (h - size) // 2,
                     (w - size) // 2 + size, (h - size) // 2 + size))


MAX_W = 900      # 左右に90pxずつ余白を残す（フィードで潰れないため）

def fit(size, text, max_w=MAX_W, floor=22):
    """はみ出す行は入るまで文字を小さくする。
    東京は職種が6つ並び、固定サイズだと端まで届いて窮屈になった。"""
    f = ImageFont.truetype(MINCHO, size)
    while size > floor:
        if ImageDraw.Draw(Image.new('RGB', (1, 1))).textbbox((0, 0), text, font=f)[2] <= max_w:
            break
        size -= 2
        f = ImageFont.truetype(MINCHO, size)
    return f

def draw_center(d, y, text, font, fill):
    w = d.textbbox((0, 0), text, font=font)[2]
    d.text(((SIZE - w) // 2, y), text, font=font, fill=fill)
    return d.textbbox((0, 0), text, font=font)[3]


def build(spec):
    src = os.path.join(ROOT, spec['photo'])
    assert os.path.exists(src), f'写真が無い: {src}'
    img = cover(Image.open(src).convert('RGB'), SIZE)
    img = ImageEnhance.Brightness(img).enhance(BRIGHTNESS)
    d = ImageDraw.Draw(img)

    f_eye = ImageFont.truetype(MINCHO, 30)
    f_ttl = ImageFont.truetype(MINCHO, 92)
    f_end = ImageFont.truetype(MINCHO, 28)

    # 役割の行（店舗が複数なら店ごとに1行）
    if len(spec['slugs']) > 1:
        role_lines = [f"{ROLE_JA_AREA[s]} " + '・'.join(ROLE_JA[r] for r in roles_of(s))
                      for s in spec['slugs']]
    else:
        role_lines = ['・'.join(ROLE_JA[r] for r in roles_of(spec['slugs'][0]))]

    hook = scarcity(spec['slugs'])

    # 縦位置は中央に寄せる
    y = 288
    y += draw_center(d, y, EYEBROW, f_eye, (255, 252, 246)) + 34
    y += draw_center(d, y, spec['title'], f_ttl, (255, 255, 255)) + 46

    d.line([(238, y), (842, y)], fill=(190, 168, 128), width=1)
    d.ellipse([(SIZE // 2 - 3, y - 3), (SIZE // 2 + 3, y + 3)], fill=GOLD)
    y += 34

    y += draw_center(d, y, hook, fit(46, hook), (255, 255, 255)) + 30
    for ln in role_lines:
        y += draw_center(d, y, ln, fit(32, ln, max_w=820), (236, 230, 220)) + 14
    y += 26
    draw_center(d, y, CLOSING, f_end, (214, 206, 194))

    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"seam_recruit_{spec['key']}_1080.jpg")
    img.save(p, quality=90, optimize=True)
    return p, hook, role_lines


if __name__ == '__main__':
    for spec in ADS:
        p, hook, roles = build(spec)
        print(f"{spec['key']:8} {os.path.basename(p)}")
        print(f"         {hook}  /  {' ／ '.join(roles)}")

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SEAM 求人 Meta広告のクリエイティブを作る（1080×1080）。

勝ちパターン（CTR 6.15% の求人ペラ一）から採るのは3つ:
  ① 二人称フック  ② 実写（生成画像は使わない）  ③ 具体的な条件を隠さない

【重要・過去の事故 3件】
  1. 「東京・銀座店 募集終了」…… 銀座は4職種を募集中で、事実と違った
  2. 「※この募集は 一般公開していません」…… seam.site/recruit は公開ページで
     しかも広告のリンク先そのもの。クリックした瞬間に嘘だとわかる
  3. 「ショップ管理者の募集は 3店のみ」…… *店舗数の少なさ* を言ったつもりが
     「ショップ管理者しか募集していない」と読まれた。札幌はスタイリストも募集中。
     オーナーからの指摘で発覚（2026-08-01）

  → **希少性を見出しにするのをやめた。**
     募集している職種と給与をそのまま並べるのがいちばん正確で いちばん強い。
     職種と給与は build_recruit_pages.py と同じ定義から機械的に引く。

コピールール（[[seam-copy-style-rules]]）: 句点「。」は使わない・読点は最小限。
"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'images', 'ads', 'recruit')
MINCHO = '/System/Library/Fonts/ヒラギノ明朝 ProN.ttc'

VER = 'v5'   # 差し替えるたびに上げる。同名だとCloudflareが旧画像を配信し続ける

# ── build_recruit_pages.py と同じ定義（ズレたら広告が嘘になる） ──────────
ROLE_STORES = {
    "スタイリスト":   ["ginza", "sapporo", "osaka", "nagoya", "fukuoka"],
    "スパニスト":     ["ginza", "osaka", "nagoya"],
    "アシスタント":   ["fukuoka"],
    "ショップ管理者": ["ginza", "omotesando", "sapporo"],
    "アルバイト":     ["ginza", "omotesando"],
}
PAY = {
    "スタイリスト":   "月給30万円〜 ／ 指名歩合50%",
    "スパニスト":     "月給30万円〜 ／ 指名歩合50%",
    "アシスタント":   "月給25万円〜",
    "ショップ管理者": "月給25万円〜 ／ 実績で賞与",
    "アルバイト":     "時給1,500円",
}
AREA = {"ginza": "銀座", "omotesando": "表参道", "sapporo": "札幌",
        "osaka": "大阪", "nagoya": "名古屋", "fukuoka": "福岡"}

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

# 【いちばん強い一言】新規のお客様は店から案内する＝「自分の客がいないと稼げない」という
# 最大の不安に答える。ただし「新規は追わなくていい」と書くと *すでに顧客がいる人* 向けになり、
# 転職を考えている側（顧客が少ない人）に響かない。店から案内する と書くこと。
GROWTH = '新規のお客様は 店からご案内します'

# 個室の一言。オーナー「贅沢な個室でお客さまの満足度アップ／美容師はお客様を大切にしたい生き物」
# 銀座・大阪・名古屋は完全個室、札幌・福岡は半個室（実態どおりに出し分ける）
ROOM = {
    'tokyo':   '完全個室だから 隣を気にせず お客様だけを見ていられます',
    'osaka':   '完全個室だから 隣を気にせず お客様だけを見ていられます',
    'nagoya':  '完全個室だから 隣を気にせず お客様だけを見ていられます',
    'sapporo': '半個室で ひとりのお客様に集中できます',
    'fukuoka': '半個室で ひとりのお客様に集中できます',
}

# エリア固有の注記。隠すより先に言ったほうが強い事実だけを置く
# 名古屋はオーナー確認: 休止ではなく「いまはスパが主軸」＝スタイリストにはチャンス
NOTES = {
    'nagoya': '名古屋はいまヘッドスパを主軸に営んでいます\nヘアサロンを担うスタイリストの方にはチャンスです',
}

EYEBROW = 'いま 転職を考えていなくても'
CLOSING = '見学・相談からで大丈夫です'
SIZE = 1080
BRIGHTNESS = 0.28
GOLD = (198, 166, 106)
MAX_W = 900


def rows_for(slugs):
    """(職種, 給与, 店舗表記) の行を作る。募集している職種を全部出す。
    複数店のセットでは どの店の募集かも書く（銀座だけの職種を表参道の話と誤解させない）。"""
    out = []
    for role, stores in ROLE_STORES.items():
        hit = [s for s in slugs if s in stores]
        if not hit:
            continue
        tag = '・'.join(AREA[s] for s in hit) if len(slugs) > 1 else ''
        out.append((role, PAY[role], tag))
    return out


def cover(img, size):
    w, h = img.size
    s = max(size / w, size / h)
    img = img.resize((int(w * s + 1), int(h * s + 1)), Image.LANCZOS)
    w, h = img.size
    return img.crop(((w - size) // 2, (h - size) // 2,
                     (w - size) // 2 + size, (h - size) // 2 + size))


_probe = ImageDraw.Draw(Image.new('RGB', (1, 1)))
def wof(text, font):
    return _probe.textbbox((0, 0), text, font=font)[2]

def fit(size, text, max_w=MAX_W, floor=20):
    f = ImageFont.truetype(MINCHO, size)
    while size > floor and wof(text, f) > max_w:
        size -= 2
        f = ImageFont.truetype(MINCHO, size)
    return f


def draw_center(d, y, text, font, fill):
    d.text(((SIZE - wof(text, font)) // 2, y), text, font=font, fill=fill)
    return _probe.textbbox((0, 0), text, font=font)[3]


def draw_row(d, y, role, pay, tag):
    """1行に「職種（明るく大きく）＋ 給与（控えめに）＋ 店舗」を横並びで置く。
    職種を目立たせるのは、スクロール中の美容師が自分ごとだと気づく手がかりだから。"""
    f_role = ImageFont.truetype(MINCHO, 34)
    f_pay = ImageFont.truetype(MINCHO, 25)
    f_tag = ImageFont.truetype(MINCHO, 21)
    gap = 16
    parts = [(role, f_role, (255, 255, 255)), (pay, f_pay, (226, 219, 208))]
    if tag:
        parts.append((tag, f_tag, (186, 176, 162)))
    # 入りきらないときは縮める
    while sum(wof(t, f) for t, f, _ in parts) + gap * (len(parts) - 1) > MAX_W:
        parts = [(t, ImageFont.truetype(MINCHO, max(18, f.size - 2)), c) for t, f, c in parts]
    total = sum(wof(t, f) for t, f, _ in parts) + gap * (len(parts) - 1)
    x = (SIZE - total) // 2
    base = max(_probe.textbbox((0, 0), t, font=f)[3] for t, f, _ in parts)
    for t, f, c in parts:
        h = _probe.textbbox((0, 0), t, font=f)[3]
        d.text((x, y + (base - h)), t, font=f, fill=c)   # ベースラインを揃える
        x += wof(t, f) + gap
    return base


def build(spec):
    src = os.path.join(ROOT, spec['photo'])
    assert os.path.exists(src), f'写真が無い: {src}'
    img = ImageEnhance.Brightness(cover(Image.open(src).convert('RGB'), SIZE)).enhance(BRIGHTNESS)
    d = ImageDraw.Draw(img)

    rows = rows_for(spec['slugs'])
    lead = f'{len(rows)}つの職種で募集しています'

    # 全体の高さを見てから開始位置を決める（行数が2〜4で変わるため）
    h_eye, h_ttl, h_lead, h_end = 30, 92, 34, 28
    room = ROOM.get(spec['key'], '')
    body = (h_eye + 34 + h_ttl + 44 + 34 + h_lead + 28 + (46 * len(rows))
            + 40 + (38 if room else 0) + 26 + h_end)
    y = max(230, (SIZE - body) // 2)

    y += draw_center(d, y, EYEBROW, ImageFont.truetype(MINCHO, h_eye), (255, 252, 246)) + 34
    y += draw_center(d, y, spec['title'], ImageFont.truetype(MINCHO, h_ttl), (255, 255, 255)) + 44
    d.line([(238, y), (842, y)], fill=(190, 168, 128), width=1)
    d.ellipse([(SIZE // 2 - 3, y - 3), (SIZE // 2 + 3, y + 3)], fill=GOLD)
    y += 34
    y += draw_center(d, y, lead, fit(h_lead, lead), (245, 240, 232)) + 28
    for role, pay, tag in rows:
        y += draw_row(d, y, role, pay, tag) + 18
    y += 16
    y += draw_center(d, y, GROWTH, fit(28, GROWTH), (255, 252, 246)) + 12
    if room:
        y += draw_center(d, y, room, fit(24, room), (226, 219, 208)) + 12
    y += 12
    draw_center(d, y, CLOSING, ImageFont.truetype(MINCHO, h_end), (214, 206, 194))

    os.makedirs(OUT, exist_ok=True)
    p = os.path.join(OUT, f"seam_recruit_{spec['key']}_1080_{VER}.jpg")
    img.save(p, quality=90, optimize=True)
    return p, rows


def ad_body(spec):
    """広告の本文。画像と同じ内容を、同じ順番で書く（食い違わせない）。"""
    rows = rows_for(spec['slugs'])
    head = f"{spec['title'].replace('SEAM ', '')}で {len(rows)}つの職種を募集しています"
    lines = [f"{r}　{p}" + (f"（{t}）" if t else '') for r, p, t in rows]
    # 試用期間は職種で長さが違う（スタイリスト等2ヶ月／ショップ管理者6ヶ月）が、
    # **どちらも期間中の給与は変わらない**（2026-08-01 オーナー確認）。
    # 長さを書くと職種ごとに分岐して読みにくいので「期間中も」で揃える。
    tail = ["新規のお客様は店からご案内します\n"
            "ご自身で集めていただく必要はないので\n"
            "顧客がまだ少なくても ゼロから積み上げていけます",
            "試用期間中も 給与は変わりません"]
    if spec['key'] in ROOM:
        tail.append(ROOM[spec['key']])
    if spec['key'] in NOTES:
        tail.insert(0, NOTES[spec['key']])
    tail.append("見学だけ 話を聞くだけでも大丈夫です")
    return head + "\n\n" + "\n".join(lines) + "\n\n" + "\n\n".join(tail)


if __name__ == '__main__':
    for spec in ADS:
        p, rows = build(spec)
        print(f"■ {spec['key']}  {os.path.basename(p)}")
        for r, pay, tag in rows:
            print(f"    {r}　{pay}" + (f"　（{tag}）" if tag else ''))

"""
SEAM 診断結果ページ → デザイナー共有用 PDF/画像出力スクリプト

複数のキャラタイプ(?type=XXX)で結果ページをレンダリングし、
モバイル幅(390px)でフルページPDF + フルページPNGを出力する。

Usage:
    python3 _export_result_pdf.py
"""

import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
OUT  = ROOT / "exports" / "result-page"
OUT.mkdir(parents=True, exist_ok=True)

BASE = "http://localhost:8765/finder.html"

# 代表的なキャラタイプを 3 つ出力 (片偏り少ない3型 + 万能型)
SAMPLES = [
    {"label": "ラリマー (細毛・繊細)",        "type": "ASB", "dir": "D"},  # Larimar Reflecting Sky
    {"label": "オニキス (艶系)",              "type": "VCC", "dir": "A"},  # Onyx of Stillness
    {"label": "ガーネット (量感・くせ毛)",    "type": "RBL", "dir": "B"},  # Proud Garnet
    {"label": "シトリン (バランス)",          "type": "ABM", "dir": "C"},  # Citrine of the Meadow
]

VIEWPORT = {"width": 390, "height": 844}   # iPhone 13 Pro 風サイズ

async def export_one(page, sample):
    url = f"{BASE}?type={sample['type']}&dir={sample['dir']}"
    print(f"\n→ {sample['label']}: {url}")
    await page.goto(url, wait_until="networkidle", timeout=60000)
    # 結果ヒーロー読み込み待機
    await page.wait_for_selector("#section-character", timeout=30000)
    # アニメーション/画像読み込み完了を念のため待つ
    await page.wait_for_timeout(2500)
    # ナビ等の sticky/fixed をオフにしてフル印刷向きに
    await page.add_style_tag(content="""
        .no-print, [class*="fixed"], nav.fixed, header.fixed { display:none !important; }
        body { padding-bottom: 0 !important; }
    """)
    # lazy ロード画像を全部即時ロード → ゆっくり下までスクロールして trigger
    await page.evaluate("""() => {
        document.querySelectorAll('img').forEach(im => { im.loading = 'eager'; });
    }""")
    # ゆっくり下までスクロール (lazy load を発火) → 上に戻す
    full_h = await page.evaluate("document.body.scrollHeight")
    step = 700
    pos = 0
    while pos < full_h:
        await page.evaluate(f"window.scrollTo(0, {pos})")
        await page.wait_for_timeout(150)
        pos += step
    await page.evaluate("window.scrollTo(0, 0)")
    # 全画像 complete まで待機 (最大15秒)
    await page.wait_for_function(
        """() => Array.from(document.querySelectorAll('img')).every(im => im.complete)""",
        timeout=15000,
    )
    await page.wait_for_timeout(800)
    base = f"result-{sample['type']}-{sample['dir']}"
    pdf  = OUT / f"{base}.pdf"
    png  = OUT / f"{base}.png"
    await page.emulate_media(media="screen")
    await page.pdf(
        path=str(pdf),
        width=f"{VIEWPORT['width']}px",
        height=None,
        print_background=True,
        margin={"top":"0","bottom":"0","left":"0","right":"0"},
        prefer_css_page_size=False,
    )
    await page.screenshot(path=str(png), full_page=True)
    print(f"  ✓ PDF: {pdf}")
    print(f"  ✓ PNG: {png}")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await ctx.new_page()
        for s in SAMPLES:
            try:
                await export_one(page, s)
            except Exception as e:
                print(f"  ✗ FAILED {s['label']}: {e}")
        await browser.close()
    print(f"\n出力先: {OUT}")

if __name__ == "__main__":
    asyncio.run(main())

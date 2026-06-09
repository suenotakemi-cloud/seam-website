"""
SEAM 診断結果ページ → 1枚の連続ページPDF出力 (デザイナー共有用)

VOGUE × Apple × 百貨店 路線にリニューアル後の最新版を、
モバイル幅 390px ・ 縦に途切れない1ページ連続PDFで出力します。

Usage:
    python3 _export_result_single_pdf.py
"""

import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent
OUT  = ROOT / "exports" / "result-page"
OUT.mkdir(parents=True, exist_ok=True)

URL = "http://localhost:8765/finder.html?type=ASB&dir=D"
VIEWPORT = {"width": 390, "height": 844}
PX_TO_PT = 0.75  # CSS px → PDF pt

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT, device_scale_factor=2)
        page = await ctx.new_page()

        print(f"→ Loading: {URL}")
        await page.goto(URL, wait_until="networkidle", timeout=60000)
        await page.wait_for_selector("#section-character", timeout=30000)
        await page.wait_for_timeout(3000)  # initial animation settle

        # fixed/sticky を除去 (PDFでの邪魔を消す)
        await page.add_style_tag(content="""
            .no-print, [class*='fixed'], nav.fixed, header.fixed { display:none !important; }
            body { padding-bottom: 0 !important; }
        """)
        # lazy → eager
        await page.evaluate("""() => {
            document.querySelectorAll('img').forEach(im => { im.loading = 'eager'; });
        }""")
        # ゆっくりスクロールして lazy load 発火
        full_h = await page.evaluate("document.body.scrollHeight")
        print(f"  body.scrollHeight = {full_h}px")
        pos = 0
        while pos < full_h:
            await page.evaluate(f"window.scrollTo(0, {pos})")
            await page.wait_for_timeout(150)
            pos += 700
        await page.evaluate("window.scrollTo(0, 0)")
        # 全画像 complete まで待機
        await page.wait_for_function(
            """() => Array.from(document.querySelectorAll('img')).every(im => im.complete)""",
            timeout=20000,
        )
        await page.wait_for_timeout(1200)

        # ページ全高を再計測 (lazy load 後)
        full_h = await page.evaluate("document.body.scrollHeight")
        print(f"  final body.scrollHeight = {full_h}px (after lazy load)")

        # PDF を「width=390px / height=全高」に指定して、1ページの連続PDFとして出力
        pdf_path = OUT / "result-ASB-D-SINGLE.pdf"
        await page.emulate_media(media="screen")
        await page.pdf(
            path=str(pdf_path),
            width=f"{VIEWPORT['width']}px",
            height=f"{full_h}px",  # ← ここがポイント: 全高指定で1ページ化
            print_background=True,
            margin={"top":"0","bottom":"0","left":"0","right":"0"},
            prefer_css_page_size=False,
        )
        print(f"\n✓ PDF saved: {pdf_path}")
        print(f"  size: 390px × {full_h}px (1 continuous page)")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())

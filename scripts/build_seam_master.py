#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
data/products-from-xlsx.json から data/products/seam-master.json を再生成。
- memberPrice / memberPriceLabel ("メンバー価格") を付与
- displayPrice 文字列を整形（例: "¥3,300〜"）
- officialUrl は sourceUrl を継承（既に各商品に格納済み）
- finder.html の seamPicks セクションが期待する schema 互換のため、
  recommendedFor / featureSummary / featurePoints / productPageUrl を
  新schemaの値からエイリアスとして書き出す
"""

import json
from collections import Counter
from pathlib import Path

SRC = "/Users/suenotakemi/Downloads/code_sandbox_light_a3728b14_1778910042/data/products-from-xlsx.json"
OUT = "/Users/suenotakemi/Downloads/code_sandbox_light_a3728b14_1778910042/data/products/seam-master.json"


def main():
    products = json.load(open(SRC, encoding="utf-8"))

    enriched = []
    for p in products:
        sizes = p.get("sizes", [])

        out = dict(p)  # シャローコピー

        # ─ メンバー価格 ─
        # 価格は来店誘導のため UI には出さない方針。memberPrice/displayPrice は出力しない。
        # サイズラベルだけを表示用に整える。
        if sizes:
            out["memberPriceLabel"] = "メンバー価格"
            out["primarySize"]      = sizes[0]["label"]
            out["sizeLabels"]       = [s["label"] for s in sizes]
            # 来店促進文言
            out["memberPriceNote"]  = "SEAM会員価格・来店登録"

        # ─ finder.html 互換のエイリアス ─
        out["productPageUrl"] = out.get("sourceUrl")
        # cardCopy / featureSummary
        out["featureSummary"] = out.get("solvesConcern") or out.get("pitchCopy") or out.get("officialSummary")
        out["cardCopy"]       = out.get("pitchCopy") or ""
        out["recommendedFor"] = out.get("targetPerson") or ""
        # featurePoints: 表示用に concernTags の日本語ラベルから生成
        out["featurePoints"]  = _label_concerns(out.get("concernTags", []))

        enriched.append(out)

    # ブランド集計
    brand_counter = Counter(p["brand"] for p in enriched)
    brands = {}
    for b, c in brand_counter.items():
        maker = next((p["maker"] for p in enriched if p["brand"] == b), "")
        brands[b] = {"brand": b, "maker": maker, "count": c}

    master = {
        "source":        "FWBUZR7u.xlsx 拡張版 (Wella ULTIME / Davines / Schwarzkopf Fibreplex 含む)",
        "version":       "2026-05-18",
        "totalProducts": len(enriched),
        "memberPrice":   {
            "label":     "メンバー価格",
            "note":      "SEAMメンバー登録後にご利用いただける、サロン専売の特別価格です。表示価格はメーカー希望小売価格（税込）。",
            "shopFlow":  "店頭で髪を拝見してメンバー登録 → SEAMオンラインショップで購入",
        },
        "brands":        brands,
        "products":      enriched,
    }

    Path(OUT).parent.mkdir(parents=True, exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(master, f, ensure_ascii=False, indent=2)

    print(f"Wrote {len(enriched)} products to {OUT}")
    print(f"ブランド数: {len(brands)}")
    print(f"  価格付き: {sum(1 for p in enriched if 'memberPrice' in p)}")


# ============================================================
# concernTag → 日本語短ラベル
# ============================================================
_CONCERN_LABEL = {
    "dry":            "乾燥ケア",
    "frizz":          "パサつき",
    "wave":           "うねり",
    "rough":          "ゴワつき",
    "tangle":         "絡まり",
    "no-shine":       "ツヤ不足",
    "split":          "枝毛・切れ毛",
    "damage":         "ダメージ補修",
    "color-fade":     "カラーケア",
    "gray-fade":      "白髪ケア",
    "volume-down":    "ボリューム",
    "top-flat":       "トップふんわり",
    "scalp-dry":      "頭皮の乾燥",
    "scalp-oily":     "頭皮のベタつき",
    "scalp-odor":     "頭皮ケア",
    "scalp-itch":     "頭皮ケア",
    "thinning":       "ハリ・コシ",
    "heat-damage":    "熱ダメージ",
    "shine-loss":     "ツヤケア",
    "no-firmness":    "ハリ・コシ",
    "spread":         "広がり",
    "no-smooth":      "まとまり",
}
def _label_concerns(tags):
    seen = set()
    out  = []
    for t in tags:
        lab = _CONCERN_LABEL.get(t)
        if lab and lab not in seen:
            seen.add(lab)
            out.append(lab)
    return out


if __name__ == "__main__":
    main()

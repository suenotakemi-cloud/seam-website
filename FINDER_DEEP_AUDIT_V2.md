# SEAM Hair Finder — 精密ディープ監査 (V2)

> 商品マッチを **質感×履歴×悩み×タグ** で総当たり検証

---

## 🎯 最終結果

| 検査項目 | 初回 | **最終** |
|---------|------|---------|
| 600パターン 問題シード | — | **0 / 600** ✅ |
| 推薦商品×ユーザー状態ミスマッチ | 85 件 | **0 件** ✅ |
| 27キャラ アフィニティID validity | 検証済 | **100% master 実在** ✅ |
| 構造的ミスマッチ (S/W キャラに wave-only) | 10 件 | **0 件** ✅ |

---

## 🔍 ディープサーチで発見した3つの問題

### 問題1: DAMAGE_RESCUE 38本 を damage>=7 で **無差別投入** していた

専門特化SKU(ブリーチ専用/熱専用/くせ毛専用)が、該当しないユーザーにも上位推薦されていた。

**85件の不適切推薦が発生**:
- ブリーチ歴 0 のユーザーに `aujua-ultia-*`, `aujua-repairity-*`, `globalmilbon-blondeplus-*`, `kerastase-blondabsolu-*`, `syspro-extra-lipidbooster` (全てブリーチ毛専用)
- 熱履歴 0 のユーザーに `globalmilbon-repairheat-*` (熱凝集タンパク補修)
- ストレートヘアに `aujua-inmetry-*` (くせ毛＋ダメージ専用)

### 問題2: アフィニティ商品3キャラに **真ストレート×Aquavia** 誤割当

`aujua-aquavia-sh/tr/mask` は targetHair に「くせでうねる髪」と明示されたくせ毛専用ライン。
NHS / TLS / TNS (全て S=真ストレート) のアフィニティに混入していた。

### 問題3 (検証側): 検出器が **wave-care タグ汎用商品** まで誤検出していた

`globalmilbon-antifrizz-*` や `elujuda-frizzfixer-out` は wave-care タグはあるが「軽い広がり対策」用途で W (軽ウェーブ) キャラには妥当。
**検出ロジックを「targetHair に "くせ" 明示」のものだけに厳密化**して誤検出を排除。

---

## 🔧 適用した修正

### 修正A: DAMAGE_RESCUE を 4サブセットに分割発火

```js
DAMAGE_RESCUE_UNIVERSAL // 汎用補修 — 常時 (リペア/リュクス/プルミエール/クロノロジスト/アルタイム)
DAMAGE_RESCUE_BLEACH    // bleachHistory>=2 で発火 (アルティール/リペアリティ/ブロンドプラス/ブロンドアブソリュ/リピッドブースター)
DAMAGE_RESCUE_HEAT      // 熱履歴あり で発火 (リペアヒート)
DAMAGE_RESCUE_WAVE      // wave軸=C で発火 (インメトリィ)
```

`damageRescueBoost(p)` は サブセット別に +35 を加算。状態に合うSKUだけが上位入りする。

### 修正B: NHS / TLS / TNS のアフィニティから Aquavia系を除去

| キャラ | Before | After |
|---|---|---|
| **NHS** (普通+多+ストレート) | Aquavia SH/TR/Mask + Graceon | **Nutritive SH/Mask + Moisture SH/TR** + Graceon |
| **TLS** (太+少+ストレート) | Aquavia SH/TR + Extrarepair | **Diorum SH/TR** + Extrarepair + UltimeSmooth |
| **TNS** (太+普通+ストレート) | Aquavia SH/TR/Mask + Tokio Premium | **Diorum SH/TR** + Tokio Premium + Graceon |

Aquavia を Diorum (エイジングハリツヤ) / Nutritive (乾燥保湿) / Moisture (うるおい) に置換。
ストレートの太/普通毛がしっとり保湿される選定に。

### 修正C: W キャラの GlobalMilbon Antifrizz / Elujuda FrizzFixer は **保持**

これらは「軽い広がり対策」用途で、軽ウェーブ(W) キャラには合理的。誤検出排除。

---

## 📊 27キャラ アフィニティ構成 (最終)

全 27 キャラで **SH / TR / Mask / Out** カテゴリが揃っており、サイズは 6〜9 SKU。
1キャラあたり 必ず：
- シャンプー (1〜4)
- トリートメント/マスク (1〜3)
- アウトバス (1〜3)
- スカルプエッセンス (細毛9・普通9 のFL/FN/NL/NN等に追加配備)

→ どのキャラでも「カテゴリ均等4本表示」が破綻しない。

---

## 🧪 600パターンで発火した補修系内訳

| 状態 | 発火率 | 投入される系統 |
|------|-------|---------------|
| damage≥7 のみ (履歴なし) | 〜30% | UNIVERSAL のみ (リペア / リュクス / プルミエール 等) |
| damage≥7 + bleach≥2 | 〜25% | + BLEACH (アルティール / ブロンドプラス 等) |
| damage≥7 + 熱履歴 | 〜15% | + HEAT (リペアヒート) |
| damage≥7 + くせ毛 | 〜12% | + WAVE (インメトリィ) |
| bleach≥4 (Fix#3) | 〜15% | BLEACH RESCUE (Tokio/Aquavia/ViEqualite UH) |

履歴の組合せで自然に重なるため、強ブリーチ×高ダメージ×くせ毛のユーザーには
**全系統の集中補修が同時推薦**される。

---

## ✅ 検査カバレッジ (全て 0 件 / 600)

- 🔴 商品0本 / シャンプー欠落 / トリートメント欠落
- 🟡 高ダメージ補修欠落
- 🟡 強ブリーチ補修欠落
- 🟡 頭皮悩み スカルプ欠落
- 🟡 くせ毛 アンチフリッズ欠落
- 🟡 細毛 軽量/うるおい欠落
- 🟡 太毛 集中補修欠落
- 🔴 ブリーチ歴無し × ブリーチ専用SKU
- 🔴 熱履歴無し × リペアヒート
- 🔴 ストレートキャラ × くせ毛専用SKU
- 🔴 構造アフィニティ S × wave-only

---

## 🚀 製品実装フェーズへ移行可能

`finder.html` / `/tmp/seam-preview/finder.html` / `/tmp/finder_simulator.py` 全て同期済み。

- 27キャラ全出現 ✓ (最少 1% / 最多 9.8%)
- 38本のSEAM厳選補修ラインを **状態適合発火** で精密推薦 ✓
- 質感/履歴/悩みの三軸全てで矛盾無し ✓

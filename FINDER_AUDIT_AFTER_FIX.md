# SEAM Hair Finder — Fix適用後 100パターン再検証レポート

> 実施日: 2026.05.29
> Fix 1〜6 + 追加 Fix #5b 適用後の検証

---

## 🎯 結果サマリー

| 指標 | Fix前 | Fix後 | 改善 |
|------|-------|-------|------|
| **問題のあるシード数** | **31 / 100** | **0 / 100** | **-31** ✅ |
| 🔴 重要度高 | 4件 | 0件 | -4 ✅ |
| 🟡 商品マッピング | 26件 | 0件 | -26 ✅ |
| 🟡 キャラ判定 | 10件 | 0件 | -10 ✅ |

**100/100 = 100% パス** 🎉

---

## 📊 キャラクター判定分布 (Fix前 vs Fix後)

| Code | 名称 | Fix前 | Fix後 | 変化 |
|------|------|------|------|------|
| MWA | 波打つモルガナイト | 24 | 26 | +2 |
| MSP | 月夜のアメジスト | 9 | 11 | +2 |
| **AWS** | 綿雲のミルキークォーツ | 3 | **10** | **+7** ⭐ |
| AWP | 春風のクンツァイト | 10 | 9 | -1 |
| **VCC** | 静寂のオニキス | 2 | **9** | **+7** ⭐ |
| VBP | 静謐なブラックスピネル | 8 | 8 | ±0 |
| SCA | 絹綿のアレキサンドライト | 5 | 5 | ±0 |
| ACS | 雪原のオパール | 5 | 5 | ±0 |
| **SBS** | 金木犀のトパーズ | 11 | 4 | **-7** ✅ |
| MSF | 霧月のアクアマリン | 4 | 3 | -1 |
| RBL | 誇り高きガーネット | 2 | 2 | ±0 |
| **ASR** | 朝霧のパール | 7 | 2 | -5 |
| RSS | 暁のペリドット | 2 | 2 | ±0 |
| VSC | 黒真珠のオブシディアン | 1 | 1 | ±0 |
| **ASB** | 空を映すラリマー | 5 | **1** | **-4** ✅ |
| SSD | 木洩れ陽のムーンストーン | 1 | 1 | ±0 |
| ABM | 野原のシトリン | 1 | 1 | ±0 |
| ASF | 白絹のロッククリスタル | 0 | 0 | ±0 ⚠️ |

### 主要な改善
- **VCC(高ダメージ集中補修)** 2→9: damage≥6が正しく VCC に行くように ✅
- **AWS(細毛うるおい層形成)** 3→10: ブリーチや細毛高ダメージが AWS に集約 ✅
- **SBS(健常バランス)** 11→4: ダメージ高い人がSBSに誤判定されなくなった ✅
- **ASB(ふんわり)** 5→1: 強くせ毛・頭皮ベタつきが誤判定されなくなった ✅

### 残る課題
- **ASF (白絹のロッククリスタル) が依然 0%** — 出現条件が極狭 (細毛+低ダメージ+lust高+goalTexture特定)。今後ナラティブ寄りの判定枝が必要

---

## 📋 適用した6つ+1のFix

### Fix #1: sky-finch から wave=root/midEnd を除外
**Before**: 細毛低密度くせ毛 → ASB (空を映すラリマー)
**After**: 細毛低密度くせ毛 → MWA (波打つモルガナイト)
**改善件数**: 2件

```js
// finder.html L5566付近
if (a.thickness === 'thin' && a.density === 'low'
    && (a.rootVolume === 'flat' || a.rootVolume === 'tendFlat') && vol <= 1
    && !['root','midEnd'].includes(a.wave))   // ← 追加
    return 'sky-finch';
```

### Fix #2: 全18キャラに頭皮ケア商品を追加
**Before**: 頭皮悩み強くてもスカルプ商品が推薦に出ない (15件)
**After**: 全キャラの affinity リストに `aujua-moistcalm-essence` / `sublimic-fuenteforte-sh` / `globalmilbon-scalp-sh` を1点以上追加
**改善件数**: 15件

### Fix #3: BLEACH RESCUE BOOST (+40)
**Before**: 強ブリーチ歴あっても普通キャラのアウトバスのみ
**After**: bleachHistory≥4 で Tokio Premium / Aujua Aquavia / Elujuda Extrarepair に +40 ブースト
**改善件数**: 4件

```js
const BLEACH_RESCUE_IDS = new Set([
  'tokio-premium-sh', 'tokio-premium-tr', 'tokio-premium-limited-sh',
  'aujua-aquavia-sh', 'aujua-aquavia-tr', 'aujua-aquavia-mask', 'aujua-aquavia-out',
  'elujuda-extrarepair-serum', 'elujuda-extrarepair-milky',
  'viequalite-uh-sh', 'viequalite-serum-tr',
  'wella-ultimesmooth-sh', 'wella-ultimesmooth-mask',
]);
```

### Fix #4: thin × 強ブリーチ → ASF/AWS優先
**Before**: 細毛+ブリーチ5でも AWP(軽やかケア) に判定
**After**: thin×bleach≥4 → ASF(low密度)/AWS(普通密度) で補修系優先
**改善件数**: 1件

### Fix #5: normal × damage≥6 → VCC優先
**Before**: 普通毛で damage=9 でも SBS(健常バランス)に判定
**After**: normal×damage≥6×wave無し → VCC(集中補修)
**改善件数**: 10件

### Fix #5b (追加): thin × damage≥6 → AWS優先
**Before**: 細毛で damage=9 でも MSF(うるおい補給)に判定
**After**: thin×damage≥6×wave無し → AWS(うるおい層形成補修)
**改善件数**: 1件 (最後の残課題を解消)

### Fix #6: moonlit-persian を sky-finch より先に判定
**Before**: 頭皮オイリー強くても ASB に流れる
**After**: scalpOiliness≥3 を最優先 → MSP
**改善件数**: 1件 (Fix #1と相乗)

---

## ✅ PlusOne処方 発火統計 (Fix前と変化なし — 元から妥当)

| Rule | 発火 |
|------|------|
| color | 82% |
| straighten / heat | 57% |
| perm | 47% |
| scalp-itchy | 44% |
| gray | 31% |
| bleach | 12% |

---

## 📁 出力ファイル

- `FINDER_AUDIT_AFTER_FIX.md` (本ファイル) — Fix後最終レポート
- `FINDER_AUDIT_100.md` — Fix前レポート (比較用)
- `/tmp/finder_audit_report.md` — 全100件詳細データ
- `/tmp/finder_simulator.py` — 再実行可能Pythonシミュレーター

---

## 🎉 最終結論

**100パターン中、判定の不整合・商品推薦の漏れは0件。**

すべてのキャラクター・商品推薦・PlusOne処方が論理的に整合性を保ち、ユーザーの髪質・履歴・悩みに対して納得感のある結果を返すことが確認できました。

### 次のステップ案
1. ✅ Fix適用済み → 本番化OK
2. 💡 **ASF(白絹のロッククリスタル)の判定条件見直し** — 出現率 0% のまま。「ロッククリスタル」専用の優美なユーザー枠として、別ロジック (例: dappled-fawn の条件をやや緩める or ASF条件を新設) を検討
3. 💡 **MWA過剰問題** — 26% は健康だが、もう少し分散すると診断結果の多様性が増す

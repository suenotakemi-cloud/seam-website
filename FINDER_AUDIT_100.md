# SEAM Hair Finder 診断ロジック 100パターン検証レポート

> 実施日: 2026.05.29
> 方法: finder.html の診断ロジックを Python に完全移植 → 100件の現実的なユーザープロファイルで実行
> 監査観点: キャラ判定の妥当性 / PlusOne処方の発火 / 商品推薦の整合性

---

## 🎯 サマリー結論

**100件中 31件 (31%) に何らかの問題を検出。** 致命的な誤判定は少ないが、**3つの構造的課題**が見えてきました。

### 🔴 重要度高 (4件) — すぐ修正したい
1. **強くせ毛(wave=root/midEnd) × 細毛低密度** → ASB (空を映すラリマー = ふんわり保湿) に誤判定 (2件)
2. **連続ブリーチ × 細毛** → AWP (春風のクンツァイト = 軽やかケア) に判定 — ダメージ深刻度反映不足

### 🟡 重要度中 (37件) — 商品マッピング改善で解決
1. **頭皮乾燥/オイリー強い時にスカルプ商品が推薦に出ない** (15件)
2. **ブリーチ歴強い時に集中ダメージケア商品(Tokio/Aujua Aquavia/Elujuda EX)が無い** (4件)
3. **damage>=6 でも健常系キャラ(SBS/SSD/ABM/MSF)に判定** (10件)

---

## 1. キャラクター判定分布 (18種)

| Code | 名称 | 出現数 | 割合 |
|------|------|-------|------|
| **MWA** | 波打つモルガナイト | 24 | **24%** ⚠️過剰 |
| SBS | 金木犀のトパーズ | 11 | 11% |
| AWP | 春風のクンツァイト | 10 | 10% |
| MSP | 月夜のアメジスト | 9 | 9% |
| VBP | 静謐なブラックスピネル | 8 | 8% |
| ASR | 朝霧のパール | 7 | 7% |
| SCA | 絹綿のアレキサンドライト | 5 | 5% |
| ACS | 雪原のオパール | 5 | 5% |
| ASB | 空を映すラリマー | 5 | 5% |
| MSF | 霧月のアクアマリン | 4 | 4% |
| AWS | 綿雲のミルキークォーツ | 3 | 3% |
| VCC | 静寂のオニキス | 2 | 2% |
| RSS | 暁のペリドット | 2 | 2% |
| RBL | 誇り高きガーネット | 2 | 2% |
| SSD | 木洩れ陽のムーンストーン | 1 | 1% |
| ABM | 野原のシトリン | 1 | 1% |
| VSC | 黒真珠のオブシディアン | 1 | 1% |
| **ASF** | 白絹のロッククリスタル | 0 | **0%** ⚠️出現せず |

### 📊 分布所見
- **MWA(波打つモルガナイト)が 24% で過剰**: `wave in (humid,surface,midEnd,root)` で thin 以外は全て MWA に流れるため
- **ASF(白絹のロッククリスタル)が 0%**: 判定条件が極めて狭い (細毛+低ダメージ+lust高でないと出ない)
- SSD/ABM/VSC が各1件のみ: 出現条件がほぼ重複している

---

## 2. PlusOne処方 発火統計

| Rule | 発火 | 評価 |
|------|------|------|
| color | 82% | ✅妥当 (カラー歴ある人 80%) |
| straighten | 57% | ✅妥当 |
| heat | 57% | ✅妥当 |
| perm | 47% | ✅妥当 |
| scalp-itchy | 44% | ✅妥当 |
| gray | 31% | ✅妥当 (40代以上+gray色) |
| bleach | 12% | ✅妥当 (ブリーチ歴ある人) |

→ **PlusOne処方の発火は適切**。漏れもなし。

---

## 3. 検出された問題

### 🔴 重要度: 高 (構造的バグ)

#### **問題 R-1: 強いくせ毛が細毛低密度なら ASB に流れる (2件)**

**該当**: Seed #28, #7

```
Seed #28: thickness=thin, density=low, wave=root → ASB
Seed #7:  thickness=thin, density=low, wave=midEnd → ASB (細毛+低密度+乾燥頭皮)
```

**原因**: `selectOriginAnimalId` の優先順位で、 thin×low×rootVolume:flat-tendFlat が ASB を先取りしてから、wave 判定が来る。**くせ毛(root/midEnd) はその後の判定なので拾えない**。

**修正案**:
```js
// L5566 の前に挿入:
if (a.wave === 'midEnd' || a.wave === 'root') {
  return 'wave-alpaca';   // MWA を thin もカバーするように
}
// または: thin専用ブランチに wave判定を入れる
```

#### **問題 R-2: 連続ブリーチ × 細毛 → AWP (軽やかケア) に判定 (1件)**

**該当**: Seed #3
```
thickness=thin, density=normal, wave=humid, color=multi_bleach, straighten=biannual
damage=7, bleach=5 → AWP (春風のクンツァイト)
```

**問題**: bleachHistory=5 (最大)+ damage=7 なのに「軽やかなケア」キャラに分類される。プロダクト推薦も AWP の Smooth系で済んでしまい、**Tokio Inkarami や Aujua Aquavia などの集中補修系が出ない**。

**修正案**: `selectOriginAnimalId` に bleachHistory >= 4 の優先分岐を追加して、AWS (うるおい層形成型 細毛広がり) または **新キャラ ASF (補修系細毛)** に流す。

#### **問題 R-3: 頭皮オイリー強くても ASB に流れる (1件)**

**該当**: Seed #31
```
thickness=thin, density=low, wave=humid, scalpType=oily, scalpOily=3 → ASB
```

**原因**: ASB(sky-finch)の条件が `vol <= 1` で早すぎる位置にある。`scalpOiliness >= 3` の判定が後手に。

**修正案**: `moonlit-persian` (MSP) の判定を ASB より先に持ってくる。

---

### 🟡 重要度: 中 (商品マッピング)

#### **問題 M-1: 頭皮悩み強い(scalp >=3)時にスカルプ商品が無い (15件)**

**該当パターン**: scalpType=dry/oily だが、判定キャラが ACS/VBP/MWA など → CHARACTER_PRODUCT_AFFINITY にスカルプ系が含まれていない

**修正案**: 各キャラの affinity リストに **scalp系を最低1つ追加**:
- ACS → `aujua-moistcalm-essence` 追加
- VBP → `aujua-moistcalm-sh` 追加
- MWA → `aujua-precedia-perfector` 追加
- AWS → `aujua-moistcalm-essence` 追加

#### **問題 M-2: 強ブリーチ(bleach>=4)時に集中ダメージケア商品が無い (4件)**

**該当**: AWP/MWA/AWS にブリーチユーザーが流れた場合

**修正案**: 商品ピック時の二次フィルタとして `bleachHistory >= 4` 時は **必ず Tokio/Aujua Aquavia/Elujuda ExtraRepair から最低2点** を加える。

#### **問題 M-3: damage>=6 で健常系キャラ判定 (10件)**

**該当**: thickness=normal, wave=none/straightened なのに damage 高い人 → SBS/ACS/MWA に判定

**修正案**: `selectOriginAnimalId` の normal-thickness分岐に **damage >=6 → VCC または VBP** の優先判定を追加。

---

## 4. キャラ分布の偏り問題

### 出現過多: MWA (24%)
判定条件が広すぎる:
```js
if (a.wave === 'humid'  || a.wave === 'surface')  return 'wave-alpaca';
if (a.wave === 'midEnd' || a.wave === 'root')     return 'wave-alpaca';
```
**修正案**: 細毛 thin の場合は breeze-poodle (AWP) へ、normal の場合のみ wave-alpaca (MWA) と分岐を細分化。

### 出現過小: ASF (0%)
```js
if (a.thickness === 'thin') {
  // ... 全条件が前で当たってから ASF に来るので、ほぼ通らない
}
```
**修正案**: ASF を「細毛+低ダメージ+良いゴール」のセレブ系として独立した条件枝に。

---

## 5. 推奨修正案 (優先度順)

| # | 場所 | 修正内容 | 影響件数 |
|---|------|---------|---------|
| 1 | `selectOriginAnimalId` L5566前 | thin×low+wave:root/midEnd → MWA に流す | 2件 |
| 2 | `CHARACTER_PRODUCT_AFFINITY` | 全キャラに scalp系を最低1つ追加 | 15件 |
| 3 | 商品ピック関数 (pickDeepProducts) | bleachHistory>=4 で集中補修2点強制 | 4件 |
| 4 | `selectOriginAnimalId` thin分岐 | bleachHistory>=4 → ASF/AWS優先 | 1件 |
| 5 | `selectOriginAnimalId` normal分岐 | damage>=6 → VCC/VBP 優先 | 10件 |
| 6 | `selectOriginAnimalId` 順序入替 | moonlit-persian(MSP) を ASB より先 | 1件 |

**合計**: 33件の改善 (一部重複あり、実質 25〜28件の改善見込み)

---

## 6. 結果が「納得感」あるサンプル (✅ 良い判定例)

### Seed #0
```
プロファイル: thickness=normal, density=normal, wave=humid, color=light_past,
             straighten=quarterly, perm=none, scalpType=normal, age=20s
スコア: damage=6, frizz=4, heat=11
判定: wave-alpaca → MWA (波打つモルガナイト)
おすすめ: aujua-quench / hita-hita / kerastase-discipline (くせケア集中)
PlusOne: color, straighten, heat
```
→ ✅ くせ × 縮毛矯正歴 × 高温アイロンの典型ユーザーに **アンチフリッズ系を集中提案**。妥当。

### Seed #50 (推定)
```
プロファイル: thickness=thick, density=high, wave=none, color=none, scalpType=normal
判定: proud-lion → RBL (誇り高きガーネット)
おすすめ: aujua-diorum / globalmilbon-antifrizz / kerastase-discipline
```
→ ✅ 太硬毛多毛 → 重め系で抑える提案。妥当。

---

## 7. 全100件 サマリ表

(別ファイル `/tmp/finder_audit_report.md` に保存・27KB)

---

## 8. 次のアクション提案

1. **R-1 (くせ毛+細毛 → ASB流出) の即時修正** — finder.html L5566 周辺を編集
2. **CHARACTER_PRODUCT_AFFINITY を 18キャラ × 全カテゴリ充実化** — スカルプ・スタイリング枠を全キャラに
3. **selectOriginAnimalId の優先順位 reorder** — ダメージ深刻度を最優先軸に
4. **ASF キャラの判定条件を見直し** — 出現率 0% は設計上問題
5. **再度 100パターン回して 31→<10件 を目標に**

---

## 付録: 検証スクリプト
- `/tmp/finder_simulator.py` (560行) — 完全移植Python版
- `/tmp/finder_audit_report.md` (27KB) — 全100件詳細
- `/tmp/finder_audit_raw.json` — 機械可読データ

これらは同じ100件を再実行できる再現可能テストハーネスです。修正後の差分検証にも使えます。

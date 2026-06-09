# SEAM HAIR SPIRITS — 27キャラ生成プロンプトテンプレート

ジェンダーレスでパターン1風のキャラを27体生成するためのプロンプト集。

---

## 🎨 共通スタイル指示 (全27キャラに適用)

```
Style: cute kawaii doodle character, soft pastel watercolor,
hand-drawn outline, simple black ink line, white background,
round chubby body (egg/water-drop shape), small dot eyes, tiny soft smile,
no gender, no clothing, no facial features other than eyes/mouth,
character size centered, square format, single character only,
matching family style across all 27 spirits, gentle and friendly mood
```

**画像比率**: 1:1 (正方形 1024×1024 推奨)
**背景**: 純白 #FFFFFF
**個性は「頭の上の髪の量・質・形」だけで表現**

---

## 📋 27キャラ プロンプト一覧

### 細毛 (Fine / F) — 9キャラ

#### `FLS.png` 細少ストレート
> base style + **a few thin straight wisps of light pastel blue hair flowing softly, very minimal hair, airy and translucent, sparkle accent ✨**

#### `FLW.png` 細少ウェーブ
> base style + **a few thin pastel mint hair with gentle wave, light and breezy, soft leaves floating around 🍃**

#### `FLC.png` 細少カーリー
> base style + **a few thin lavender purple curls dancing softly, dreamy and ethereal, small heart sparkles ♡**

#### `FNS.png` 細普通ストレート
> base style + **moderate amount of straight silky pale blue hair, smooth flow, single sparkle star ⭐**

#### `FNW.png` 細普通ウェーブ
> base style + **moderate amount of gentle wavy pastel green hair, fresh and soft, tiny leaves 🌿**

#### `FNC.png` 細普通カーリー
> base style + **moderate amount of light pink curly hair, bouncy and cute, small floral accents 🌸**

#### `FHS.png` 細多ストレート
> base style + **abundant straight pale blue hair flowing long, voluminous yet silky, soft glow**

#### `FHW.png` 細多ウェーブ
> base style + **abundant wavy mint pastel hair, lots of volume with airy waves, free and joyful**

#### `FHC.png` 細多カーリー
> base style + **abundant lavender curls forming a cloud-like crown, fluffy and magical, surrounded by sparkle stars ✨**

---

### 普通毛 (Normal / N) — 9キャラ

#### `NLS.png` 普通少ストレート
> base style + **slim straight golden-yellow hair, sleek and elegant, simple and balanced**

#### `NLW.png` 普通少ウェーブ
> base style + **slim wavy light yellow-green hair, soft and natural, small flower 🌼**

#### `NLC.png` 普通少カーリー
> base style + **slim pink curls with a tiny gold crown 👑, regal yet cute**

#### `NNS.png` 普通王道ストレート
> base style + **balanced amount of warm yellow straight hair, natural and harmonious, musical note ♪**

#### `NNW.png` 普通王道ウェーブ
> base style + **balanced amount of sage green wavy hair, calm and rhythmic, leaf 🌱**

#### `NNC.png` 普通王道カーリー
> base style + **balanced amount of pink curls, playful and warm, small heart ♡**

#### `NHS.png` 普通多ストレート
> base style + **abundant yellow long straight hair, healthy and shiny, classic beauty**

#### `NHW.png` 普通多ウェーブ
> base style + **abundant sage green wavy hair, gentle waves cascading, harmony**

#### `NHC.png` 普通多カーリー
> base style + **abundant pink curly hair, big bouncy curls, joyful and lush**

---

### 太毛 (Thick / T) — 9キャラ

#### `TLS.png` 太少ストレート
> base style + **strong straight brown hair, slim but sturdy, single bold line, water drop accent 💧**

#### `TLW.png` 太少ウェーブ
> base style + **strong wavy deep teal hair, confident and grounded**

#### `TLC.png` 太少カーリー
> base style + **strong purple curls, rare and rich, sparkle stars around ✨**

#### `TNS.png` 太普通ストレート
> base style + **balanced thick straight brown hair, deep and lustrous**

#### `TNW.png` 太普通ウェーブ
> base style + **balanced thick wavy teal hair, gentle but strong waves, drop accent**

#### `TNC.png` 太普通カーリー
> base style + **balanced thick purple curls, rich and bold, soft heart ♡**

#### `THS.png` 太多ストレート
> base style + **abundant thick straight brown hair, voluminous and majestic, sparkle ✨**

#### `THW.png` 太多ウェーブ
> base style + **abundant thick wavy teal hair, dramatic and full, multiple sparkles**

#### `THC.png` 太多カーリー
> base style + **abundant thick purple curls with a tiny gold crown 👑, queen-like presence, lush and magnificent**

---

## 🎯 生成手順 (Higgsfield/Midjourney/Stable Diffusion 共通)

1. **リファレンス画像**としてパターン1 (SEAM HAIR SPIRITS) の画像をアップロード
2. 各キャラのプロンプトを順に投入
3. ファイル名は **3文字コード.png** (例: `FLC.png`)
4. 27枚すべて生成完了後、ZIPで送付
5. 私が `seam-public/images/karte/spirits/` に配置 → 即反映

## 🎨 カラーパレット参考

| 軸 | 細毛 (F) | 普通 (N) | 太毛 (T) |
|---|---|---|---|
| 基調色 | 水色/薄紫 (透明感) | 黄色/サージュ (温かみ) | ブラウン/ティール/パープル (深み) |
| トーン | 軽やか・透明 | バランス・自然 | 強さ・存在感 |

| クセ | ストレート (S) | ウェーブ (W) | カーリー (C) |
|---|---|---|---|
| シルエット | 直線・縦長 | 曲線・揺れ | 渦・ボリューム |

---

## 💡 統一感のコツ

- **顔の表情は全員同じ** (・- ・ のような点目 + 小さい笑顔)
- **体の形は全員同じ** (丸〜涙型)
- **「同じ家族」「同じ妖精」のように見えること**
- 性別感を出すような服・装飾は禁止
- 髪の量・質・色だけで個性化

---

## 📂 配置先

```
seam-public/images/karte/spirits/
  FLS.png  FLW.png  FLC.png
  FNS.png  FNW.png  FNC.png
  FHS.png  FHW.png  FHC.png
  NLS.png  NLW.png  NLC.png
  NNS.png  NNW.png  NNC.png
  NHS.png  NHW.png  NHC.png
  TLS.png  TLW.png  TLC.png
  TNS.png  TNW.png  TNC.png
  THS.png  THW.png  THC.png
```

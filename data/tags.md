# SEAM Product Tag Dictionary v1

商品マスターと診断回答をマッチさせるためのタグ辞書。
finder.html の Q1〜Q15 の回答と各タグの対応を定義する。

---

## 1. category（カテゴリ）— 必須・単一値

| value | label | finder routineStep |
|---|---|---|
| `shampoo` | シャンプー | 1 |
| `treatment` | トリートメント | 2 |
| `hair-mask` | ヘアマスク（週1〜2回集中） | 3 |
| `out-bath-milk` | アウトバス ミルク | 4 |
| `out-bath-oil` | アウトバス オイル | 5 |
| `out-bath-mist` | アウトバス ミスト | 5 |
| `scalp-essence` | スカルプエッセンス | 6 |
| `scalp-shampoo` | スカルプシャンプー | 1 |
| `heat-protect` | ヒートプロテクト | アイロン前 |
| `styling` | スタイリング | 仕上げ |
| `beauty-tool` | 美容機器 | 7 |
| `hair-growth` | 育毛剤（医薬部外品） | スカルプ |

## 2. concernTags（悩み）— 複数値 — Q1直結

| value | label | Q1 option value |
|---|---|---|
| `dry` | 乾燥 | dry |
| `frizz` | 広がり | frizz |
| `wave` | うねり・くせ | wave |
| `rough` | パサつき | rough |
| `tangle` | 絡まり | tangle |
| `no-shine` | ツヤ不足 | noShine |
| `split` | 枝毛・切れ毛 | split |
| `damage` | ダメージ | damage |
| `color-fade` | カラー色落ち | colorFade |
| `gray-fade` | 白髪染め色落ち | grayFade |
| `volume-down` | ボリューム不足 | volumeDown |
| `top-flat` | トップぺたんこ | topFlat |
| `scalp-dry` | 頭皮乾燥・かゆみ | scalpDry |
| `scalp-oily` | 頭皮ベタつき・におい | scalpOily |
| `thinning` | 抜け毛・細毛 | thinning |
| `heat-damage` | 熱ダメージ（派生） | (Q10高温) |
| `bleach-damage` | ブリーチダメージ（派生） | (Q7) |
| `aging-care` | エイジング（派生） | (細毛・ハリコシ) |

## 3. hairType（髪質）— 構造化オブジェクト

```js
hairType: {
  thickness: ['thin', 'normal', 'thick'],   // Q3
  density:   ['low', 'normal', 'high'],      // Q4
  wave:      ['none','weak','medium','strong','straightened'] // Q5
}
```

## 4. damageTags（履歴対応）— Q6/Q7/Q8/Q9/Q10直結 ★最重要

```js
damageTags: {
  bleachOk:      'no' | 'light' | 'medium' | 'heavy' | 'multi-bleach',
  colorCare:     'no' | 'maintain' | 'fade-prevent' | 'gray-cover' | 'repair-after',
  straightenOk:  'no' | 'recent' | 'mid' | 'old' | 'acid' | 'kaizen',
  permOk:        'no' | 'normal' | 'digital' | 'loose-prevent',
  heatTolerance: '~140' | '~160' | '~180' | '~200' | '200+' | 'all',
  heatProtect:   true | false  // 商品自体の熱保護機能
}
```

## 5. finishTags（仕上がり）— Q14直結

```js
finishTags: {
  finish:  ['moist','glossy','firm','smooth','airy','soft'],
  weight:  'light' | 'medium' | 'heavy',     // パーマ毛は heavy 避ける
  texture: ['silky','volume','bonding','natural','sleek']
}
```

## 6. functionTags（処方・機能）— 複数値

| value | 説明 |
|---|---|
| `moisture` | 水分補給・保湿 |
| `internal-repair` | 内部補修（タンパク・CMC） |
| `surface-repair` | 表面・キューティクル補修 |
| `bonding` | ボンド系（結合修復） |
| `heat-protect` | ヒートプロテクト |
| `uv-protect` | 紫外線対策 |
| `color-lock` | カラー褪色防止 |
| `cool-tone-keep` | 寒色系キープ |
| `ph-balance` | pH調整 |
| `acid-heat` | 酸熱トリートメント |
| `volume-up` | ボリュームアップ |
| `clarify` | ディープクレンジング |
| `scalp-moisture` | 頭皮保湿 |
| `scalp-clean` | 頭皮洗浄 |
| `scalp-blood` | 頭皮血行 |
| `aging-care` | エイジングケア |
| `hair-growth` | 育毛サポート |
| `mild-cleanse` | 低刺激洗浄（アミノ酸系） |
| `ceramide` | セラミド補給 |
| `keratin` | ケラチン補修 |
| `hyaluronic` | ヒアルロン酸保湿 |

## 7. scalpFit（頭皮適合）— 複数値

`normal` | `dry-scalp` | `oily-scalp` | `sensitive` | `aging-scalp` | `thinning-scalp`

## 8. lengthFit（長さ適合）— Q2

`short` | `bob` | `medium` | `long` | `all`

## 9. lifestyleFit（環境・生活）— Q11 + Q12

| value | 説明 |
|---|---|
| `quick-morning` | 朝時短 |
| `night-care` | 夜じっくり |
| `humid-climate` | 湿気多い環境 |
| `dry-climate` | 乾燥地域 |
| `sun-exposure` | 海風・紫外線 |
| `indoor` | 室内中心 |
| `sleep-wet` | 乾かさず寝がち（補正） |

## 10. preferenceFit（好み）— Q13

| value | 説明 |
|---|---|
| `weight-light` | 軽い仕上がり優先 |
| `non-oily` | ベタつかない |
| `long-lasting` | 効果持続 |
| `mild-aroma` | 香り控えめ |
| `strong-aroma` | 香り強め |
| `no-aroma` | 無香 |
| `budget-friendly` | 続けやすい価格 |

## 11. aroma（香り）

```js
aroma: {
  type: 'floral'|'citrus'|'herbal'|'woody'|'musk'|'rose'|'green'|'fruity'|'unscented',
  strength: 'light'|'medium'|'strong'
}
```

## 12. goalFit（目標）— Q15

`grow-long` | `keep-color` | `hari-koshi` | `morning-easy` | `ends-matomari`

## 13. usageTiming（使用タイミング）— 複数値

| value | 説明 |
|---|---|
| `daily-in-bath` | 毎日のシャンプー |
| `daily-treatment` | 毎日のトリートメント |
| `weekly-mask` | 週1〜2回マスク |
| `before-dry` | 乾かす前 |
| `after-dry` | 乾かした後・仕上げ |
| `heat-before` | アイロン前 |
| `night-scalp` | 夜の頭皮ケア |
| `morning-style` | 朝のスタイリング |

## 14. priceTier（価格帯）

| value | 範囲 |
|---|---|
| `entry` | 〜2,500円 |
| `standard` | 2,500〜4,500円 |
| `premium` | 4,500〜7,000円 |
| `luxury` | 7,000円〜 |

## 15. specialTech（特殊技術）— 複数値

| value | 説明 |
|---|---|
| `aujua-system` | Aujuaシステム |
| `aujua-cmadk` | Aujua毛髪科学(CMADK) |
| `inkarami` | TOKIO インカラミ |
| `plex-bonding` | プレックス系結合修復 |
| `acid-heat` | 酸熱トリートメント |
| `ceramide` | セラミド |
| `keratin` | ケラチン |
| `cmc` | CMC補給 |
| `hyaluronic` | ヒアルロン酸 |
| `collagen` | コラーゲン |
| `argan` | アルガンオイル |
| `botanical` | オーガニック・植物由来 |
| `salt-free` | 塩化Na不使用 |
| `silicone-free` | ノンシリコン |

## 16. sensitiveFlags（敏感対応）— 複数値

`sensitive-ok` | `postpartum-ok` | `low-stimulant` | `fragrance-free` | `vegan` | `cruelty-free`

---

## 完全な商品データスキーマ

```js
{
  id: 'aujua-quench-sh-250',           // ユニークID
  brand: 'Aujua',
  maker: 'ミルボン',
  line: 'クエンチ',                     // ラインID
  name: 'クエンチ シャンプー',
  nameEn: 'Quench Shampoo',
  category: 'shampoo',                 // §1
  routineStep: 1,                       // 1-7
  image: 'images/brands/aujua_quench_shampoo.png',
  imageLine: 'images/brands/aujua_quench.png',
  size: '250mL',
  price: 3300,
  priceTier: 'standard',
  url: 'https://...',                  // 公式リンク（あれば）

  concernTags:  ['dry', 'rough', 'no-shine'],          // §2
  hairType: {                                           // §3
    thickness: ['normal', 'thick'],
    density:   ['normal', 'high'],
    wave:      ['none', 'weak']
  },
  damageTags: {                                         // §4
    bleachOk:      'light',
    colorCare:     'maintain',
    straightenOk:  'recent',
    permOk:        'normal',
    heatTolerance: '~180',
    heatProtect:   false
  },
  finishTags: {                                         // §5
    finish:  ['moist', 'smooth'],
    weight:  'medium',
    texture: ['silky']
  },
  functionTags:  ['moisture', 'hyaluronic', 'mild-cleanse'],  // §6
  scalpFit:      ['normal', 'dry-scalp'],                     // §7
  lengthFit:     'all',                                       // §8
  lifestyleFit:  ['dry-climate', 'night-care'],               // §9
  preferenceFit: ['mild-aroma', 'long-lasting'],              // §10
  aroma:         { type: 'floral', strength: 'medium' },      // §11
  goalFit:       ['ends-matomari', 'keep-color'],             // §12
  usageTiming:   ['daily-in-bath'],                           // §13
  specialTech:   ['aujua-system', 'hyaluronic'],              // §15
  sensitiveFlags:['sensitive-ok'],                            // §16

  // editorial / display
  reason:     '乾燥した中〜太毛をしっとりまとめる、ミルボンの保湿系定番。',
  description:'グリセリンとヒアルロン酸が髪の水分量を補い、まとまりのある質感に。',
  usage:      '毎日のシャンプー。週1回はクエンチ マスクと併用がおすすめ。',
  pairsWith:  ['aujua-quench-tr-250', 'aujua-quench-mask']    // セット推奨
}
```

---

## マッチングスコア（参考実装）

```js
function scoreProduct(product, answers, scores, flags) {
  let s = 0;

  // 履歴系（最重要）
  if (answers.bleach !== 'none' && ['heavy','multi-bleach'].includes(product.damageTags.bleachOk)) s += 30;
  if (answers.heatTemp === 't200' && product.functionTags.includes('heat-protect')) s += 25;
  if (answers.straighten && ['recent','mid'].includes(answers.straighten) && product.damageTags.straightenOk !== 'no') s += 15;

  // 悩み一致
  const concernHit = (answers.concerns || []).filter(c => product.concernTags.includes(c)).length;
  s += concernHit * 20;

  // 髪質
  if (product.hairType.thickness.includes(answers.thickness)) s += 10;
  if (product.hairType.density.includes(answers.density))     s += 10;
  if (product.hairType.wave.includes(answers.wave))           s += 8;

  // 仕上がり
  if (product.finishTags.finish.includes(answers.goalTexture)) s += 15;

  // パーマ毛 × 重い商品はペナルティ
  if (answers.perm && answers.perm !== 'none' && product.finishTags.weight === 'heavy') s -= 20;

  // 環境
  if (product.lifestyleFit.includes(answers.environment)) s += 5;

  // 価格懸念
  if ((answers.concernsItem || []).includes('price') && product.priceTier === 'luxury') s -= 10;

  return s;
}
```

カテゴリ別Top1を結果ページの7ステップに割り当てる。

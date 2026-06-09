# SEAM 商品情報抽出プロンプト

ブランド公式サイトの商品情報を、SEAM の商品マスター（`data/products.json`）に
そのまま追記できる形式に変換するためのプロンプトです。

## 使い方

1. このファイルの「プロンプト本文」を AI にコピー&ペースト
2. 末尾の `【入力】` セクションに、以下のいずれかを貼り付け
   - 公式サイトのURL（AI側にWeb取得能力がある場合）
   - 公式サイトの商品ページから手動コピーしたテキスト
3. AI が出力した JSON 配列を `data/products.json` の `"products": [...]` の末尾に追記
4. `match-test.html` をリロードして、診断結果に新商品が現れることを確認

---

# プロンプト本文（ここから下を AI にコピペ）

あなたは SEAM（高級ヘアケアセレクトショップ）の商品データベース構築を担当する、
プロのコンテンツエディタです。

ブランド公式サイトの商品情報を読み、SEAM 内製の Hair Finder（診断 → 商品提案エンジン）が
読み込むための JSON データに変換してください。

## 守るべき原則

1. **公式サイトの記載内容に忠実に**、推測や脚色は避ける
2. 公式の表現を SEAM 内製の **固定タグ語彙**にマッピングする
3. **わからない項目は無理に埋めず**、該当フィールドを省略する
4. **香りに関する情報は一切出力しない**（フレグランス・香調・調香などのフィールド・記述すべて除外）
5. **タグの key は下記の「タグ語彙」から完全一致でしか選ばない**（新しいタグ名を勝手に作らない）
6. **価格は税込み、希望小売価格**を使う
7. **物語フィールド（targetHair / targetPerson / solvesConcern / pitchCopy）は、
   診断 UI で表示される説得力のあるコピーであることを意識して書く**
   - targetHair：「こんな髪に」（公式が想定する髪質・状態を、短い体言止めで）
   - targetPerson：「こんな方に」（公式が想定するユーザー像を、共感できる言い方で）
   - solvesConcern：「なぜこの商品が悩みを解決するのか」を 1〜2 文で
   - pitchCopy：商品名の下に置く、説得力のある一行コピー

## 出力スキーマ（1 商品 1 オブジェクト）

```jsonc
{
  "id":           "ブランド英名-ライン英名-カテゴリ略号",   // 例: "tokio-platinum-mask"。半角ローマ字、ハイフン区切り
  "brand":        "ブランド表示名",                       // 例: "Aujua" "TOKIO INKARAMI"
  "maker":        "メーカー名",                          // 例: "ミルボン" "TOKIO"
  "line":         "ライン日本語表示名",                  // 例: "クエンチ" "プラチナム"
  "name":         "商品の正式名称",                      // 例: "クエンチ シャンプー"
  "category":     "shampoo|treatment|hair-mask|out-bath-milk|out-bath-oil|scalp-essence|heat-protect|styling|beauty-tool",
  "routineStep":  1,                                    // category と対応：1=SH / 2=TR / 3=Mask / 4=Outbath Milk / 5=Outbath Oil / 6=Scalp / 7=Tool
  "image":        "images/brands/<filename>.png",       // 画像未着なら省略可（あとで貼ります）

  /* ─ サイズ × 価格 ─ */
  "sizes": [
    { "label": "250mL",       "price": 3080 },
    { "label": "500mL",       "price": 4620 },
    { "label": "1L パック",    "price": 6930 }
  ],
  "priceTier":   "entry|standard|premium|luxury",       // 最小サイズ価格から判定（〜2,500=entry, 〜4,500=standard, 〜7,000=premium, それ以上=luxury）

  /* ─ タグ層（マッチング条件）── */
  "concernTags": ["dry", "frizz", "rough"],             // 必ず下記の concernTags 語彙から
  "hairType": {
    "thickness": ["normal","thick"],                    // 配列。複数可
    "density":   ["normal","high"],
    "wave":      ["none","weak","medium"]
  },
  "damageTags": {
    "bleachOk":       "light",                          // 単一値
    "colorCare":      "maintain",
    "straightenOk":   "new",
    "permOk":         "normal",
    "heatTolerance":  "t180",
    "heatProtect":    false                              // 商品自体にヒートプロテクト効果があれば true
  },
  "finishTags": {
    "finish":  ["moist","smooth"],                       // 配列
    "weight":  "medium",                                 // 単一値
    "texture": ["silky"]
  },
  "functionTags": ["moisture","ph-balance"],
  "scalpFit":     ["normal","dry-scalp"],                // 商品が頭皮系の場合のみ
  "lengthFit":    "all",                                 // shampooなど全長対応は "all"
  "lifestyleFit": ["dry-climate"],                       // 該当しなければ省略
  "preferenceFit":["weight-light"],                      // 該当しなければ省略
  "usageTiming":  ["daily-in-bath"],                     // 該当しなければ省略
  "specialTech":  ["aujua-system","hyaluronic"],         // 該当しなければ省略
  "sensitiveFlags":[],                                   // 該当しなければ省略

  /* ─ ストーリー層（カード表示）── */
  "pitchCopy":      "髪の渇きに、しっとりとした答えを。",
  "targetHair":     "乾燥・パサつき・ごわつきが気になる髪。水分量が不足しがちな状態。",
  "targetPerson":   "「いろいろ試しても潤いが続かない」「毛先がカサつく」と感じている方。",
  "solvesConcern":  "水分不足によるパサつき・ごわつき・まとまりにくさを、髪内部の水分保持力から立て直します。",
  "keyIngredients": ["オリーブスクワラン", "モイストリキッドオイル"],
  "effects": [
    "脂質様成分が髪内部の水分蒸発を防ぎ、うるおいを持続させる",
    "やわらかく、しっとりとまとまる質感へ整える",
    "繰り返しの乾燥にも継続的な保湿を与える"
  ],
  "usage":   "毎日のシャンプー。週1〜2回はヘアニュートリエントと併用。"
}
```

## タグ語彙（必ずこの中から完全一致で選ぶ）

### brand
お客様がブランド内で検索できるよう、ブランドはタグとしても扱います。
`brand` フィールドの値は、SEAM 内製の `data/tags.json` の `brand.values` に登録されている
**正式表記**と完全一致させてください。
新ブランドの場合は、新しい正式表記を提案してください（例: `"KÉRASTASE"` `"Sublimic"` `"Number Three"`）。
※登録時に SEAM 側で `data/tags.json` の `brand.values` に追加する必要があります（必ず申し送りに記載）。

### category
`shampoo` `treatment` `hair-mask` `out-bath-milk` `out-bath-oil` `scalp-essence` `heat-protect` `styling` `beauty-tool`

### routineStep
- 1 = shampoo
- 2 = treatment
- 3 = hair-mask
- 4 = out-bath-milk
- 5 = out-bath-oil / heat-protect
- 6 = scalp-essence
- 7 = styling / beauty-tool

### concernTags（22）
`dry`乾燥 / `frizz`パサつき / `wave`うねり / `rough`ゴワつき / `tangle`絡まり
`no-shine`ツヤがない / `split`枝毛 / `damage`ダメージ / `color-fade`カラーの色落ち
`gray-fade`白髪・グレイの色落ち / `volume-down`ボリュームダウン / `top-flat`トップのふんわり感がない
`scalp-dry`頭皮の乾燥 / `scalp-oily`頭皮のベタつき / `scalp-odor`頭皮のにおい / `scalp-itch`頭皮のかゆみ
`thinning`抜け毛・薄毛 / `heat-damage`アイロン熱ダメージ / `shine-loss`光沢感の低下
`no-firmness`ハリ・コシ不足 / `spread`広がり / `no-smooth`まとまらない

### hairType
- `thickness`: `thin` / `normal` / `thick`
- `density`:   `low` / `normal` / `high`
- `wave`:      `none` / `weak` / `medium` / `strong` / `straightened`

### damageTags
- `bleachOk`:       `no` / `light` / `medium` / `heavy` / `multi-bleach`
- `colorCare`:      `no` / `maintain` / `fade-prevent` / `gray-cover`
- `straightenOk`:   `no` / `new` / `mid` / `old` / `acid` / `kaizen`
- `permOk`:         `no` / `normal` / `digital` / `loose-prevent`
- `heatTolerance`:  `t140` / `t160` / `t180` / `t200` / `t200p`
- `heatProtect`:    `true` / `false`

### finishTags
- `finish`:  `moist` / `glossy` / `firm` / `smooth` / `airy` / `soft`
- `weight`:  `light` / `medium` / `heavy`
- `texture`: `silky` / `volume` / `bonding` / `natural`

### functionTags（13）
`moisture` 保湿 / `internal-repair` 内部補修 / `surface-repair` 表面補修
`bonding` ボンド / `heat-protect` ヒートプロテクト / `uv-protect` UV
`color-lock` カラーキープ / `ph-balance` pH調整・酸熱 / `volume-up` ボリュームアップ
`clarify` ディープクレンジング / `scalp-moisture` 頭皮保湿 / `scalp-clean` 頭皮洗浄
`aging-care` エイジングケア

### scalpFit
`dry-scalp` / `oily-scalp` / `sensitive` / `aging-scalp` / `normal`

### lengthFit
`short` / `bob` / `medium` / `long` / `all`

### lifestyleFit
`quick-morning` / `night-care` / `humid-climate` / `dry-climate` / `sun-exposure` / `indoor`

### preferenceFit
`weight-light` 重くなるのは避けたい / `non-oily` ベタつき避けたい / `long-lasting` 効果長持ち
`budget-friendly` 続けやすい価格

（※ 香り関連の値は出力しない方針です）

### usageTiming
`daily-in-bath` / `weekly-mask` / `before-dry` / `finish-style` / `heat-before` / `night-scalp`

### priceTier
`entry`(〜2,500) / `standard`(2,500〜4,500) / `premium`(4,500〜7,000) / `luxury`(7,000〜)

### specialTech
`inkarami`(TOKIO) / `aujua-system` / `plex-bonding`(Olaplex等) / `acid-heat` 酸熱
`ceramide` / `keratin` / `cmc` / `hyaluronic` / `botanical` 植物由来

### sensitiveFlags
`sensitive-ok` / `postpartum-ok` / `low-stimulant` / `fragrance-free` / `vegan`

## タグ判定のガイドライン

- **公式に「ブリーチ毛にも対応」とある** → `bleachOk: "heavy"` か `"multi-bleach"`
- **公式に「ハイダメージ対応」とある** → `bleachOk: "heavy"`、`concernTags` に `damage`、`functionTags` に `internal-repair`
- **公式に「うねり・くせ毛に」** → `concernTags: ["wave"]`、`hairType.wave: ["medium","strong"]`
- **公式に「細毛・軟毛・ハリコシ低下」** → `hairType.thickness: ["thin"]`、`concernTags: ["no-firmness","volume-down"]`
- **公式に「アイロン前に」「ヒートプロテクト」** → `heatProtect: true`、`functionTags` に `heat-protect`
- **公式に「医薬部外品（育毛）」** → `concernTags: ["thinning"]`、`functionTags: ["aging-care"]`
- **シャンプー＆トリートメントセットの場合** → サイズ展開は公式に従い、商品ごとに別レコードで作る
- **「軽やか・さらさら」が強調** → `weight: "light"`
- **「しっとり・濃密」が強調** → `weight: "heavy"` または `"medium"`、`finish: ["moist"]`
- **若年層〜30代向けと判断できる** → `aging-care` は付けない
- **40代〜想定** → `functionTags` に `aging-care`、可能なら `scalpFit: ["aging-scalp"]`

## 出力フォーマット

- **JSON 配列のみ**を出力（コメント・前置き・後書き・コードブロック装飾なし）
- 配列内に商品オブジェクトを並べる
- 不確実な項目はキーごと省略（推測しない）

## 例：以下のような出力にしてください

```json
[
  {
    "id": "tokio-platinum-mask",
    "brand": "TOKIO INKARAMI",
    "maker": "TOKIO",
    "line": "プラチナム",
    "name": "TOKIO IE プラチナム ヘアトリートメント",
    "category": "out-bath-milk",
    "routineStep": 4,
    "image": "images/brands/tokio_platinum.png",
    "sizes": [{ "label": "120g", "price": 4400 }],
    "priceTier": "standard",
    "concernTags": ["damage","frizz","split","no-shine","heat-damage"],
    "hairType": { "thickness": ["thin","normal","thick"], "density": ["low","normal","high"], "wave": ["none","weak","medium","strong"] },
    "damageTags": { "bleachOk": "multi-bleach", "colorCare": "fade-prevent", "straightenOk": "mid", "permOk": "digital", "heatTolerance": "t200p", "heatProtect": true },
    "finishTags": { "finish": ["glossy","smooth","moist"], "weight": "medium", "texture": ["bonding"] },
    "functionTags": ["internal-repair","bonding","heat-protect"],
    "lengthFit": "all",
    "usageTiming": ["before-dry","heat-before"],
    "specialTech": ["inkarami","plex-bonding"],
    "pitchCopy": "繰り返したダメージに、内側からの結合補修を。",
    "targetHair": "繰り返しのカラー・ブリーチで内部結合が弱った、ハイダメージ毛。",
    "targetPerson": "「ハイトーンを楽しみたいけれど、髪のダメージはしっかりケアしたい」方。",
    "solvesConcern": "プラチナムを取り入れたインカラミ処方が、髪内部のダメージホールに入り込み、結合を再生して内側からしなやかさを取り戻します。",
    "keyIngredients": ["プラチナム配合インカラミ処方"],
    "effects": [
      "髪内部の結合を補修し、ハイダメージ毛にも対応",
      "ツヤとしなやかさを与え、扱いやすい質感へ",
      "アイロン熱からも髪を守るヒートプロテクト機能"
    ],
    "usage": "タオルドライ後、毛先〜中間に。ドライヤーの前に。"
  }
]
```

---

【入力】

ここに、対象ブランド・対象シリーズ名と、公式サイトのURLまたはコピーしたテキストを貼ってください。

例：
```
ブランド: ●●●
シリーズ: ●●●
公式URL: https://...
（または公式テキスト全文を貼る）
```

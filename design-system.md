# SEAM Design System

## Design Keywords

- Luxury
- Clean
- Editorial
- Professional
- Calm
- Minimal
- Premium
- Trustworthy
- Beauty Expert
- Salon Select

## Layout

- 最大幅は基本 1200px〜1280px
- セクション上下余白はPCで96px〜160px
- スマホでは64px〜96px
- カード間の余白は24px以上
- 文字と画像を詰め込みすぎない
- グリッドは2〜4カラムを基本にする
- スマホでは1カラムを基本にする

## Typography Scale

- Hero Title: 48px〜72px
- Section Title: 32px〜48px
- Card Title: 18px〜24px
- Body: 15px〜17px
- Caption: 12px〜14px

日本語は行間を広めにし、読みやすさを優先する。

## Components

### Button

Primary:
- 黒またはチャコール背景
- 白文字
- 角丸は大きすぎない
- 高さは48px以上
- hoverで少し明るくする

Secondary:
- 白背景
- 黒枠
- 黒文字
- hoverで薄いグレー背景

### Card

- 背景は白またはオフホワイト
- 角丸は16px〜24px
- 境界線は薄いグレー
- 影は弱く、上品に
- 画像、タイトル、説明、CTAの順番を統一

### Product Card

必須要素：
- 商品画像
- ブランド名
- 商品名
- カテゴリ
- 対応する悩みタグ
- 短い説明
- 詳細ボタンまたは購入導線

### Brand Card

必須要素：
- ロゴ
- ブランド名
- 短い説明
- カテゴリ
- 商品を見る導線

### Store Card

必須要素：
- 店舗名
- エリア
- 特徴
- 住所
- 営業時間
- 予約・詳細ボタン

## Motion

- 0.2s〜0.6s程度の自然な動き
- ease-outを基本にする
- スクロール時に控えめなfade in
- 高級感を壊す派手な動きは禁止

## Accessibility

- 文字コントラストを十分に確保
- ボタンはタップしやすく
- 画像にはaltを設定
- キーボード操作も可能にする
- フォームはラベルを明確にする

## SEAM 共通カラートークン

| トークン | HEX | 用途 |
|---|---|---|
| ivory | `#FAF8F4` | メインベース背景 |
| cream | `#F4F0E8` | サブ背景・カード塗り |
| sand | `#ECE5D8` | アクセント背景 |
| bisque | `#D6C7B0` | 中間ベージュ |
| mocha | `#8C7A63` | 落ち着いた茶 |
| ink | `#1A1815` | 主テキスト・ボタン地 |
| charcoal | `#3D3833` | 本文テキスト |
| mist | `#E7E4DE` | 非アクティブ背景 |
| line | `#E2DDD3` | ハイラインの罫線 |
| roseBeige | `#E0C4B5` | 補助アクセント |
| roseAccent | `#C9A089` | 補助アクセント（強） |
| gold | `#B8945A` | 編集アクセント（メイン） |
| goldLight | `#D9BE93` | 暗背景上のアクセント |

## SEAM 共通フォント

- `font-serif` — Cormorant Garamond + Noto Serif JP（見出し・タイプ名）
- `font-sans`  — Noto Sans JP（本文・UIラベル）
- `font-mono`  — Montserrat（編集ラベル `tracking-widest2 uppercase`）

## 共通ルール

- 角丸は最大でも `rounded-[2px]` 〜 `rounded-sm`（編集デザイン的に控えめ）
- 影は `box-shadow: 0 1px 2px rgba(26,24,21,0.04), 0 8px 24px -16px rgba(26,24,21,0.08)` 以下
- ボタン地は黒（`#1A1815`）、文字は ivory
- 編集ラベルは `font-mono tracking-widest2 text-[10.5px] uppercase`
- セクション境目には `hairline-center` または編集ナンバリング（`01 — Concept`）
- アニメーションは `fadeUp 0.45s cubic-bezier(.2,.7,.2,1)` のみ

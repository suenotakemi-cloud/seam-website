# SEAM | ヘアケアセレクトショップ — 公式サイト

**BUILD: 20260516-v22 (Hair Karte v3.8)**

## プロジェクト概要

SEAM（シーム）は、20以上のプロブランドをメーカー横断で診断できるヘアケアセレクトショップ。
銀座・表参道・大阪・名古屋・福岡・札幌・宇都宮の全国7店舗＋Member Online Shopで展開。

---

## 現在完成している機能

### 🆕 SEAM Hair Karte v3.8（karte.html）

「タイプ分け」ではなく「今、髪に何が起きているかを言い当てる」診断システム。
履歴 ▸ 現象 ▸ 原因 ▸ 処方順序 ▸ 商品 ▸ 使い方 を一気通貫で提供。

#### エントリーポイント
- `/karte.html` — メイン診断ページ（全4スクリーン）
- `index.html` → 「Hair Karte 診断（v3.8 NEW）」ボタンからも遷移

#### ルールエンジン（js/karte-engine.js）
- **21推論ルール**: R01〜R21（CRITICAL/HIGH/MEDIUM/LOW優先度）
- **スコア計算式**: `final_score = priority_score × confidence × rule.weight`
  - `all_of` 条件全通過: `confidence += 0.5`
  - `any_of` いずれか通過: `confidence += 0.25`
  - `boost` 条件: 追加加算
  - `confidence ≥ 0.5` で発火
- **排他ルール（4ケース）**:
  - R05発火 → R19, R14 抑制
  - R09発火 → R08 抑制
  - R04発火 → R01 抑制
  - R12発火 → R10 抑制
- **Liteモード**: confidence を 0.70 にキャップ
- **16 Hair DNAタイプ**: Urban Mineral / Phoenix Reborn / Coastal Drift / Sahara Scalp / Aurora Gloss / Twilight Smoke / Wabi Sabi / Garden Rain / Sun Bleached / Velvet Porous / Wild Coil Resilient / Moonlit Veil / Midnight Silk / Bronze Ember / Steel Resolve / Crystal Bloom
- **Sub DNA判定**: スコア差20%以内のとき2番目のDNAを併記

#### 診断フロー（4スクリーン）
1. **Hero** — コンセプト、3メタ数値（21推論/16DNA/90秒）、CTA
2. **Quiz（Q1〜Q7 Lite → Bridge → Q8〜Q12 Standard）**
   - Q2: 3×3マトリクスUI（長さ×クセ）+ 毛の太さ選択
   - Q4: 症状8項目複数選択（排他オプションあり）
   - Q8〜Q12: オプション（スキップ可）
3. **Bridge** — Lite完了時の仮判定表示、信頼度バー、Standard続行 or Lite結果表示
4. **Karte Result（9セクション）**:
   - §1 Hair DNA（タイプ名 EN/JP・パレット・エッセンス・Sub DNA・タグ）
   - §2 今の髪に起きていること（上位3ルール・信頼度バー）
   - §3 なぜ今この状態なのか（動的ナラティブ・DNAタイプ別文章生成）
   - §4 やめるケア ／ 足すケア（2カラム）
   - §5 シーン別処方箋（Morning / Night / Weekly + Prescription Order）
   - §6 おすすめブランド（DNAタイプ別推奨ブランド）
   - §7 店頭メモ（コピペ可能・カルテIDつき）
   - §8 EC選び方ガイド（3ステップ）
   - §9 プロに相談CTA（3階層：オンラインショップ / 店舗 / Finder）

#### デザインシステム（css/karte.css）
- v3.8カラートークン準拠（Obsidian / Ivory / Champagne）
- SVGノイズグレイン（`mix-blend-mode: multiply`）
- Cormorant Garamond（英文イタリック） / Noto Serif JP（日本語） / Montserrat（UI）
- モバイル最優先（max-width: 520px）

#### データ構造（KarteEngineクラス）
```
KarteEngine.evaluate(answers, isLiteMode)
→ {
    karteId: string,          // "SK-XXXX-XXXXX"
    primaryDNA: HairDNAType,
    subDNA: HairDNAType | null,
    firedRules: Rule[],       // 上位3件
    allFiredRules: Rule[],
    isLiteMode: boolean,
    timestamp: number,
    answers: NormalizedAnswers
  }
```

---

### トップページ（index.html）v21 ★NEW

#### セクション構成（上から順）
1. **Ticker** — 横スクロールアニメーション帯
2. **Header** — Sticky固定ヘッダー（ロゴ + 言語切替 + 下段ナビ7項目 + ハンバーガー）
3. **FV Hero** — メーカー横断診断訴求（差別化バッジ・スケール数字・8ボタン CTA・右カラム FV クイックパネル）
4. **§1 Quick Diagnosis** (`#quick-search`) — 30秒クイック診断（8悩みグリッド + 入口バッジ + 結果表示）
5. **§2 詳細診断 4ステップ** (`#step-diagnosis`) — お悩み/改善点/仕上がり/プロフィール（5カテゴリタブUI）
6. **§3 Product Search** (`#product-search`) — インクリメンタル検索（debounce 200ms）+ カテゴリ/ブランドフィルター + 34件商品グリッド
7. **§4 Why SEAM?** (`#why-seam`) — 3カード
8. **§5 Curated Brands** (`#brands`) — 8ブランドグリッド
9. **§6 How It Works** (`#how-it-works`) — 4ステップガイド
10. **§7 Stores** (`#stores`) — 全国7店舗カード
11. **§8 Hair Salon & Head Spa** (`#salon-spa`) — 2カードグリッド
12. **§9 Japan's Hair Care** (`#japan-haircare`) — ブランドメッセージ（ダーク背景）
13. **§10 Guest Voices** (`#guest-voices`) — 自動スクロールカルーセル（6件×2ループ）
14. **§11 Comparison Table** (`#comparison`) — 他購入先との比較表（横スクロール対応）
15. **§12 FAQ / Join SEAM** (`#faq`) — アコーディオン FAQ（5問）+ Join カード
16. **Footer** — 4カラム（ブランド/Services/Stores/Info）

#### v21 診断エンジン主要機能
- **メーカー横断推薦**: `diversifyByBrand()` で同一ブランド最大2件に制限、上位5件推薦
- **5カテゴリタブUI**: Hick's Law対応（髪の質感/ボリューム/ダメージ/頭皮/エイジング）
- **Step2除外ロジック**: `refreshStep2Disabled()` でStep1選択値をStep2から動的除外
- **仕上がり専用Step3**: ツヤ感/まとまり/軽さ/しっとり/ふんわり/香り/持続/ハリコシ 8項目
- **Sticky Selection Summary**: `position:sticky; top:108px` で選択状態を常時表示
- **FV → QS連携**: FVパネルの選択がQSセクションに自動反映
- **入口バッジ**: ⚡30秒 / 🔍2分 の所要時間を明示

#### v21 Product Search機能
- **PRODUCTS配列**: 34件（Aujua 10件 / TOKIO 3件 / Milbon/エルジューダ 5件 / Sublimique 5件 / HITA 3件 / SEE/SAW 3件 / LOA 1件 / oggiotto 2件 / リケラ/バイカルテ 2件）
- **インクリメンタル検索**: debounce 200ms、商品名・ブランド・説明・タグ・悩みを横断検索
- **フィルター**: カテゴリ（6種）+ ブランド（6種）の複合フィルタリング
- **もっと見る**: 12件ずつページネーション（append方式）
- **クリアボタン**: フィルター使用時のみ表示

---

### finder.html（v21 UX改善済）

#### P0（致命的）修正
- **FV初期描画問題を解消** — `opacity:0` + `animation` 遅延を廃止
- **min-height:100svh の廃止** — PCで画面上半分が空白になる原因を除去
- **Step1: 5カテゴリ タブUI導入** — ヒックの法則対応

#### P1（高優先）修正
- **Step2: Step1選択済みを除外**
- **Step3: 仕上がり専用選択肢**（8項目に刷新）
- **進捗ラベル変更** — お悩み / 改善点 / 仕上がり / プロフィール
- **入口バッジ** — ⚡30秒 / 🔍2分 を明示
- **詳細診断ボタンを昇格** — パネル型ボタンに

#### P2（中優先）修正
- Step1 ヘルプテキスト（aria-describedby）
- タイル `<br>` 廃止 + min-height + word-break:keep-all
- 年齢帯を6区分に集約（10代〜60代以上）
- 「今の状況」アコーディオン化

### brand.html / salon.html / headspa.html
各ページは既存のまま維持。

---

## 機能エントリーポイント（URI / パス一覧）

| パス | 説明 |
|---|---|
| `/` または `index.html` | トップページ（v21） |
| `index.html#quick-search` | Quick Diagnosis（30秒） |
| `index.html#step-diagnosis` | 詳細診断 4ステップ |
| `index.html#product-search` | 商品検索 |
| `index.html#why-seam` | Why SEAM? |
| `index.html#brands` | 取扱ブランド |
| `index.html#how-it-works` | 使い方ガイド |
| `index.html#stores` | 全国7店舗 |
| `index.html#salon-spa` | Hair Salon & Head Spa |
| `index.html#japan-haircare` | Japan's Hair Care |
| `index.html#guest-voices` | Guest Voices カルーセル |
| `index.html#comparison` | 比較テーブル |
| `index.html#faq` | FAQ & Join SEAM |
| `brand.html` | ブランド一覧 |
| `salon.html` | ヘアサロン |
| `headspa.html` | ヘッドスパ |
| `finder.html` | ※ / へ 301リダイレクト |

---

## 使用技術・ライブラリ

- HTML5 / CSS3（`css/index.css` + `css/finder.css` + `css/lang.css`）
- JavaScript（Vanilla JS — `js/finder.js` + `js/finder-data.js` + `js/lang.js`）
- Google Fonts（Cormorant Garamond, Noto Serif JP, Montserrat, GFS Didot）
- Font Awesome 6.5.1（CDN via jsDelivr）
- RESTful Table API（データ永続化）

---

## ファイル構成

```
index.html               メインページ（v21）
index_backup_20260512.html  旧v20バックアップ
finder.html              診断専用ページ（v21 UX改善済）→ / へリダイレクト
brand.html               ブランド一覧
salon.html               ヘアサロン
headspa.html             ヘッドスパ
css/
  index.css              統合トップ用スタイル（v21新規）
  finder.css             診断ページ用スタイル
  lang.css               多言語用スタイル
js/
  finder.js              診断エンジン + Product Search（v21全面再設計）
  finder-data.js         CONCERN_MAP / CATEGORY_CONTENT / PRODUCT_DB（165件）
  lang.js                多言語対応（ja/en/zh）
  hairlines.js           HCSラインデータ
images/                  店舗写真・ブランドロゴ・OGP等
_redirects               Netlify リダイレクト設定
_headers                 Netlify ヘッダー設定
manifest.json            PWAマニフェスト
```

---

## データモデル

### js/finder-data.js（read-only）
| 変数 | 内容 |
|---|---|
| `CONCERNS_ALL` | 24項目の全悩みリスト |
| `CONCERN_MAP` | 悩み → カテゴリ優先度マッピング（shampoo/treatment/mask/outbath/essence） |
| `QUICK_TO_STEP1` | クイック検索 → step1 マッピング（8件） |
| `buildAssessment(c1,c2,c3)` | 診断総評テキスト生成関数 |
| `CATEGORY_CONTENT` | カテゴリ別コンテンツ（rules配列、各5件） |
| `PRODUCT_DB` | 商品データベース（165件） |

### js/finder.js（v21再設計）
| 定数/関数 | 内容 |
|---|---|
| `CONCERN_CATEGORIES` | 5カテゴリ定義（label + items） |
| `FINISH_OPTIONS` | 仕上がり8選択肢 |
| `PRODUCTS` | Product Search用商品配列（34件） |
| `state` | 診断状態 + productSearch状態の一元管理 |
| `diversifyByBrand()` | メーカー横断バランシング（同一ブランド最大2件） |
| `searchProducts()` | インクリメンタル検索（debounce 200ms） |
| `renderProductResults()` | 商品グリッドレンダリング |
| `clearFilters()` | フィルターリセット |
| `initConcernTabs()` | タブUI初期化（キーボード操作対応） |
| `bindTilesInPanel()` | タイル選択バインド（各パネル） |
| `refreshStep2Disabled()` | Step1選択値をStep2から動的除外 |
| `runDiagnosis()` | 診断実行 → CATEGORY_CONTENT参照 |
| `renderDiagnosisResult()` | 結果カード生成 |

---

## 未実装・今後の推奨課題

- [ ] FV Hero背景画像の設定（現在はCSS背景グラデーションのみ）
- [ ] Product Search: PRODUCT_DB（165件）との統合
- [ ] 商品カード画像の設定（現在はプレースホルダー表示）
- [ ] 英語（EN）・中国語（ZH）翻訳キーの新セクション対応
- [ ] OGP画像のv21対応更新
- [ ] 診断結果の保存・共有機能
- [ ] URLパラメータによる診断状態の復元
- [ ] Google Analytics / GTM 導入
- [ ] finder.html → / のリダイレクト動作確認（_redirects設定済み）

---

## 公開URL

- 本番サイト: https://seam.site/
- Instagram: https://www.instagram.com/seam_japan/
- Member Online Shop: https://seam.stores.jp/

---

## 更新履歴

| バージョン | 日付 | 主な変更 |
|---|---|---|
| v21 | 2026-05-13 | **index.html全面リニューアル**（メーカー横断診断ハブ化）: FV Hero・Quick Diagnosis・詳細4ステップ診断・Product Search（34件）・Why SEAM・Brands・Stores・FAQ等全セクション統合。css/index.css新規作成。js/finder.js全面再設計（PRODUCTS 34件・searchProducts・diversifyByBrand・5カテゴリタブUI）。_redirects: finder.html→/リダイレクト追加 |
| v21 | 2026-05-12 | finder.html UX改善: FV即時表示, タブUI(5カテゴリ), Step2除外ロジック, Step3仕上がり専用, 進捗ラベル刷新, 入口バッジ, ヘルプテキスト, 年齢6区分, 今の状況アコーディオン, sticky summary |
| v20 | 2026-05-12 | Finder統合Hero, Why SEAM, 日本のヘアケア, SEAM LAB, FAQ accordion, Mobile CTA, 3-step リデザイン |
| v19 | 2026-04-19 | brand.html ロゴ振り仮名CSS非表示（5:3クロップ） |
| v18以前 | — | 各種セクション追加・スタイル調整 |

# SEAM 商品マスタ統一（PIM）— 設定手順と使い方

メーカーごとにバラバラな形式で届く商品データ（CSV / Excel）を、
**JAN・商品名・価格・税込/税抜・内容量・画像(最大5枚・webp)** の1つの形に揃えて保存し、
同じ形で出力する仕組みです。スマホで JAN を読んで写真を登録する画面も含みます。

- スマホ登録: **https://seam.site/pim/**（JANスキャン → 商品呼び出し → 写真5枚）
- PC 取り込み・出力: **https://seam.site/pim/import.html**
- どちらも検索エンジンには出ません（noindex）。合言葉は診断ダッシュボードと同じ `ADMIN_KEY`。

---

## 仕組み（全体像）

```
メーカーCSV/Excel ─▶ pim/import.html（列を合わせて統一形に整形・JAN重複を検出）
                          │  保存                     │ 注意（重複は登録しない）
                          ▼                           ▼
                    D1 seam-db: pim_products     D1: pim_issues → 画面で「どちらを残す」
                          ▲
スマホ pim/index.html ─ JAN読取 → 商品呼び出し → 写真（何形式でも webp に変換）→ R2 PRODUCT_IMAGES
                          │
                          ▼
                    /api/pim/export → 統一CSV / JSON（画像は https://seam.site/pim-img/… のURL）
```

コード側（`db/pim-schema.sql` / `functions/api/pim/*` / `functions/pim-img/` / `pim/*.html` / `js/pim-*.js`）はデプロイ済みです。
あとは **Cloudflare 側で保存先を繋ぐ設定だけ** が必要です。

---

## 設定手順（Cloudflare ダッシュボード）

### ① D1（商品台帳）— 診断ダッシュボードで作った `seam-db` をそのまま使う
- まだ無ければ `db/SETUP_DASHBOARD.md` の①〜③を先に。
- テーブルは **初回アクセス時に自動で作られます**（`CREATE TABLE IF NOT EXISTS`）。
  手動で入れたい場合は `seam-db` → **Console** に `db/pim-schema.sql` を貼って Execute。

### ② R2（画像の実体）を作る
1. Cloudflare → **R2 Object Storage** → **Create bucket** → 名前 **`seam-product-images`**
2. **Workers & Pages** → サイト **seam-website** → **Settings** → **Functions** → **R2 bucket bindings** → **Add binding**
   - Variable name: **`PRODUCT_IMAGES`**（大文字・この名前のまま）
   - R2 bucket: `seam-product-images`
3. 保存

> R2 が未設定でも商品データの取り込み・出力は動きます。写真の保存だけができません（画面に案内が出ます）。

### ③ 合言葉
- 診断ダッシュボードの **`ADMIN_KEY`**（Environment variables）をそのまま使います。未設定なら `db/SETUP_DASHBOARD.md` の④。

### ④ 再デプロイ
- **Deployments** → 最新の **⋯** → **Retry deployment**（または次回の push で自動反映）

### （任意）webp 以外が届いたときのサーバ側変換
- ブラウザ側で必ず webp に変換して送るので通常は不要です。
- 古い端末からの保険として、Cloudflare Images の **Images binding**（Variable name `IMAGES`）を足すと、サーバ側でも変換します。

---

## 使い方

### A. メーカーの CSV / Excel を取り込む（PC）
1. `/pim/import.html` → **取り込み** タブ → ファイルをドロップ
   - 文字コード（UTF-8 / UTF-16 / Shift_JIS）・区切り（カンマ / タブ）・Excel のシートは自動判定
2. **列を合わせる** … 見出しの言葉が違っても自動で当てます（例: 「EC表示名」→商品名、「標準売上単価」→価格、「上代単価」→上代）。違っていれば直す。
   - 価格列が税込か税抜かは、列名・値に「税込/税抜」があればそれを優先。無ければここで選ぶ。
   - 内容量の列が無いときは、商品名の「250ml」「1Kg」などから取り出します。単位なしの数字（「〇〇 250」）は商品名の語（シャンプー→ml、トリートメント→g）から推定し、**注意** に印を付けます。
3. **確認する** … 揃えた結果の表と、注意の内訳（JANチェックデジット不一致・価格が読めない・単位推定 など）
4. **JANが被っているもの** … 登録済みと同じ JAN / 同じファイル内で重複している JAN を並べて表示。
   - 「登録済みを残す」「届いた方で上書き」「この行を採用」を選ぶ
   - **決めなかったものは登録されず「注意」タブに積まれます**（あとから決められます）
5. **保存** … 300件ずつ保存。履歴が下に残ります。

### B. スマホで写真を登録する（iPhone / Android）
1. `/pim/` を開く（ホーム画面に追加するとアプリのように使えます）→ 合言葉
2. カメラに商品のバーコードをかざす → 商品が呼び出される（未登録なら商品名だけ入れて登録）
3. 写真の枠をタップ → **「カメラで撮る」か「写真・ファイルから選ぶ」** → 1枚保存されると次の枠が光る → 繰り返し（最大5枚・1枚目がメイン）
4. **次の商品をスキャン**
- 写真は端末側で長辺 1600px・webp に変換してから送るので、通信量も保存形式も揃います。
- 写真をタップ → 撮り直し / 差し替え / 削除（削除すると後ろの写真が前に詰まります）

### C. メーカーから届いた画像フォルダをまとめて登録（PC）
- **画像まとめ登録** タブにフォルダの中身をドロップ。ファイル名の JAN と枚目を読みます。
  - `4901275230122.jpg` → 1枚目 / `4901275230122_2.png` / `4901275230122-3.jpeg` / `4901275230122 (4).heic`
  - 同じ JAN で枚目の無いファイルが複数あれば、名前順に 1, 2, 3… と入ります
- jpg / png / gif / bmp / webp / avif / heic（Safari）…何で来ても保存は webp。

### D. 出力する
- **出力** タブ → CSV（Excel で開ける UTF-8 BOM 付き）または JSON。メーカー・写真あり/なしで絞れます。
- 列（固定）: `JAN, 商品名, 価格(税抜), 価格(税込), 入力価格の税区分, 税率(%), 内容量, 単位, 内容量表記, 上代(税抜), 仕入価格, メーカー, ブランド, カテゴリ, 商品説明, 元商品コード, 画像1〜5, 画像枚数, 更新日時`
- 画像は `https://seam.site/pim-img/products/<JAN>/<枚目>.webp?v=…` の URL。EC 側からそのまま参照できます（CORS 許可済み）。

---

## API（EC 側と連携するとき）

すべて `x-seam-key: <ADMIN_KEY>` ヘッダが必要（画像配信 `/pim-img/*` だけ不要）。

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/pim/status` | 件数・設定状態 |
| GET | `/api/pim/products?jan=…` / `?q=…&maker=…&noimg=1&limit=&offset=` | 商品1件 / 一覧 |
| PUT | `/api/pim/products` | 商品1件の登録・更新（JSON） |
| DELETE | `/api/pim/products?jan=…` | 削除（画像も） |
| POST | `/api/pim/import` | 取り込み（`action: check / begin / commit / finish`） |
| GET/POST | `/api/pim/issues` | 注意の一覧 / 解決 |
| GET/POST/DELETE | `/api/pim/images?jan=…&slot=…` | 画像の一覧 / 登録(multipart, webp) / 削除 |
| GET | `/api/pim/export?format=csv\|json&maker=&only_images=1&noimg=1` | 統一フォーマット出力 |

---

## 困ったとき

- **「保存先の設定がまだです」** … D1 binding `DB` が無い。①を確認。
- **写真だけ保存できない** … R2 binding `PRODUCT_IMAGES` が無い。②を確認。
- **カメラが起動しない** … ブラウザのサイト設定で seam.site のカメラを「許可」に。iPhone は Safari 推奨。JAN は手入力でも呼び出せます。
- **JAN が `4.90128E+12` のように壊れている** … Excel が数値として保存したもの。取り込みで注意になります。元データを「文字列」列にして出し直してもらうか、Excel のまま（.xlsx）送ってもらえば正しく読めます。
- **同じ JAN が2つある** … 登録されず「注意」に積まれます。「注意」タブでどちらを残すか選んでください。

# SEAM サイト — デプロイ手順書

このサイトは**完全な静的サイト**（HTML / CSS / JS / 画像のみ、ビルド不要）です。
そのまま静的ホスティングにアップロードすれば公開できます。

公開URL想定: `https://seam.site/`

---

## 推奨ホスティング: Cloudflare Pages

**理由**：無料枠が大きい、HTTPS自動、CDN高速、`_headers` / `_redirects` をそのまま読んでくれる。

### 方法A: ダッシュボードから直接アップロード（最短）

1. https://dash.cloudflare.com/ にログイン → 左メニュー「Workers & Pages」
2. 「Create application」→「Pages」→「Upload assets」を選択
3. プロジェクト名を入力（例：`seam-site`）→ Create
4. このフォルダ **`code_sandbox_light_a3728b14_1778910042` の中身**（フォルダごとではなく、中身）をドラッグ＆ドロップ
   - 除外推奨ファイル（後述）は先に消すか別フォルダへ退避
5. Deploy → 数十秒で `https://seam-site.pages.dev` が発行される
6. カスタムドメイン `seam.site` を割り当てる:
   - Pagesプロジェクト → 「Custom domains」→ 「Set up a custom domain」
   - `seam.site` を入力 → Cloudflare側でDNSを自動設定（ドメインがCloudflareで管理されている場合）

### 方法B: GitHub 連携（おすすめ・継続運用向き）

1. GitHubに `seam-site` リポジトリを作る（Private可）
2. このフォルダの中身を push（`.gitignore` 同梱済みなので不要ファイルは自動除外）
3. Cloudflare Pages → Create → 「Connect to Git」→ リポジトリを選択
4. ビルド設定：
   - **Framework preset**: `None`
   - **Build command**: 空欄
   - **Build output directory**: `/`（ルート）
5. Save and Deploy

以降は git push する度に自動デプロイされます。

---

## 別案: Netlify

1. https://app.netlify.com/ → 「Add new site」→「Deploy manually」
2. フォルダの中身をドラッグ＆ドロップ
3. Site settings → Domain management で `seam.site` を割り当て

`_headers` と `_redirects` はNetlifyでも同じフォーマットで動作します。

---

## 別案: Vercel

1. https://vercel.com/new → 「Other」テンプレ → GitHub or直接アップロード
2. Framework Preset: `Other`、Build Command: 空、Output Directory: `.`
3. Deploy → カスタムドメイン設定

※ Vercel は `_redirects` を読まないので、必要なら `vercel.json` を追加してください（現状の規模ならルート直配信で問題ありません）。

---

## デプロイ前チェックリスト

- [ ] 公開不要ファイルが入っていないか
  - `index_backup_20260512.html`（旧バージョンのバックアップ・348KB）
  - `SEAM_Karte_Claude_Initial_Prompt.md`（開発メモ）
  - `images/test/`（テスト画像・約15MB）
  - `README.md`（社内ドキュメント。公開しても害はないが任意で）
  - `DEPLOY.md`（本書）
- [ ] `manifest.json` の `start_url` が `/` であること（OK）
- [ ] OGP画像 `images/ogp_image.svg` が表示できること
- [ ] `_redirects` の内容が想定通り
  - `/shop.html` → `https://seam.stores.jp/`
  - 404 fallback → `/index.html`
- [ ] HTML内の `https://seam.site/...` 形式の絶対URLが、本番ドメインと一致していること

`.gitignore` を同梱しているので、Git連携デプロイなら上記の除外は自動で行われます。

---

## カスタムドメイン (`seam.site`) 設定例

### Cloudflareでドメイン管理している場合
Pagesに割り当てると自動でDNS（CNAME）が引かれます。手作業不要。

### 他社（お名前.com / ムームー / Route53 など）の場合
- A レコード or CNAME を Cloudflare Pages の指定先に向ける
- 例（Pages）：`CNAME @  seam-site.pages.dev`
- 例（Netlify）：`CNAME @  seam-site.netlify.app`
- DNS伝播後、ホスティング側で「Verify」または自動検出
- HTTPS証明書は Let's Encrypt 等で自動発行（数分〜数十分）

---

## デプロイ後の動作確認

ブラウザで以下をすべて確認してください。

| URL | 期待される表示 |
|---|---|
| `https://seam.site/` | トップページ |
| `https://seam.site/karte.html` | Hair Karte v3.8 診断 |
| `https://seam.site/brand.html` | ブランド一覧 |
| `https://seam.site/salon.html` | サロン情報 |
| `https://seam.site/headspa.html` | ヘッドスパ |
| `https://seam.site/finder.html` | 旧Finder診断 |
| `https://seam.site/shop.html` | `seam.stores.jp` に302リダイレクト |
| `https://seam.site/does-not-exist` | index.html 内容で 404 ステータス |
| `https://seam.site/manifest.json` | JSONが返る |
| `https://seam.site/robots.txt` | プレーンテキスト |
| `https://seam.site/sitemap.xml` | XML |

### スマートフォンでの確認も推奨
- iOS Safari / Android Chrome
- karte.html の診断フロー（Q1〜Q12）が最後まで進むこと
- 画像が伸びていないか、フォントが化けていないか

---

## トラブルシュート

**Q. デプロイしたが画像が出ない**
- パスは相対参照（`images/...`）が多いので、ドラッグ＆ドロップ時に `images/` フォルダごと含めたか確認。

**Q. `karte.html` を直接開くと真っ白**
- ブラウザコンソールで `karte-engine.js` の404が出ていないか。`js/` フォルダごとデプロイされている必要があります。

**Q. ルートURL `/finder` だけ404になる**
- `_redirects` を読むホスティング（Cloudflare Pages / Netlify）でしか動きません。Vercel等で必要なら `vercel.json` で再定義してください。

**Q. 古いキャッシュが残る**
- `_headers` で `index.html` と `manifest.json` を `no-store` 指定済みなので、リロード（⌘+Shift+R）で更新されます。

---

最終更新: 2026-05-16  
構成: 静的6ページ + JS 5本 + CSS 4本 + 画像 約260点（≈54MB）

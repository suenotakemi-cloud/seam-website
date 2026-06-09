# SEAM — Hair Care Select Shop & Salon

高級ヘアケアセレクトショップ兼サロン **SEAM** の公式サイト（静的サイト）。
「髪は、出会いで変わる。」をコンセプトに、髪質診断（Hair Care Finder）から
自分に合うサロン専売品を提案します。

## ページ構成

| ファイル | 内容 |
|---|---|
| `index.html` | トップページ |
| `finder.html` | 髪質診断（27タイプ・React） |
| `brand.html` | 取扱ブランド／商品カタログ |
| `shop.html` | ヘアケアショップ・店舗一覧 |
| `haircareshop.html` | 全国7店舗ガイド |
| `onlineshop.html` | 会員制オンラインストア案内 |
| `hairsalon.html` | ヘアサロン |
| `headspa.html` | ヘッドスパ |
| `share/` | 診断結果のOGシェアページ（27タイプ） |

## 技術構成

- 静的HTML + Tailwind（`vendor/` に同梱）
- 診断は React 18 + Babel Standalone（`vendor/` に同梱、CDN不要）
- 商品データ：`data/products/seam-master.json`（394商品）
- PWA：`sw.js` / `manifest.json`（オフライン対応・ホーム追加）

## ローカルで確認

```bash
# 任意の静的サーバーで配信（例）
python3 -m http.server 3000
# → http://localhost:3000/
```

## デプロイ

リポジトリ直下に公開ファイルが揃っているため、そのまま配信できます。

- **GitHub Pages**：Settings → Pages → Branch を `main` / `/ (root)` に設定
- **Netlify / Vercel / Cloudflare Pages**：このリポジトリを連携し、出力ディレクトリをルートに

> `.nojekyll` を含めているため、GitHub Pages でも `vendor/` などがそのまま配信されます。

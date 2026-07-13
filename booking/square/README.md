# SEAM 銀座 — Square 実決済セットアップ

デモの「前金ステップ」を、実際の Square 決済に差し替えるための一式です。
日本のオンライン決済に必須の **3Dセキュア** に対応しています。

```
pay.html        … 顧客が見る決済フォーム（Square Web Payments SDK）
worker.js       … 課金を確定するバックエンド（Cloudflare Worker。秘密鍵はここだけ）
wrangler.toml   … Worker のデプロイ設定
```

## 全体像

```
顧客のブラウザ (pay.html)
   │ ①カード入力 → トークン化 ＋ ②3DS認証（APP_ID/LOCATION_IDだけで動く・秘密鍵不要）
   ▼
Cloudflare Worker (worker.js)
   │ ③Access Token(秘密) で Square Payments API を叩いて課金
   ▼
Square
```

> 🔑 **Access Token（秘密鍵）はサーバー(Worker)側だけ**に置きます。pay.html（フロント）には絶対に書きません。

---

## 手順

### 1. Square 側の準備（あなたの作業）
1. [Square Developer](https://developer.squareup.com/) にログイン → **＋** でアプリを1つ作成
2. アプリの **Sandbox** タブから次をコピー
   - **Application ID**（公開OK）
   - **Access Token**（＝秘密。共有しない）
3. **Location ID** を取得（Developer の「Locations」または Square 管理画面 → ビジネス → 店舗情報）
4. スタッフ（及川 大輝 / ANZU / CHIKA）とメニュー・料金を **Square 予約** に登録
   - ※予約の**書き込み同期**まで自動化する場合は **Appointments Plus（有料）** が必要。決済だけなら不要

### 2. フロント（pay.html）を設定
`pay.html` 冒頭の `CONFIG` を編集:
```js
ENV: 'sandbox',
APP_ID: '<Sandbox Application ID>',
LOCATION_ID: '<Location ID>',
PAY_ENDPOINT: '',   // まだ空でOK（この段階ではトークン化テストのみ）
AMOUNT: 1500,
```
ブラウザで開くと、カード入力欄が出ます。**PAY_ENDPOINT が空でも、トークン化＋3DSまで**動くので、ID が正しいか確認できます。

### 3. バックエンド（Worker）をデプロイ
```bash
cd booking/square
npx wrangler login
npx wrangler secret put SQUARE_ACCESS_TOKEN   # ← Sandbox の Access Token を貼る（秘密）
npx wrangler deploy
```
デプロイ後に表示される URL（例 `https://seam-square-pay.xxx.workers.dev`）に `/pay` を付けたものを、
`pay.html` の `PAY_ENDPOINT` に設定 → 再読み込み。

### 4. テスト決済（Sandbox）
テストカードで実際に課金フローを通します（サンドボックスなので実請求なし）:
- カード番号: `4111 1111 1111 1111`
- 有効期限: 任意の未来（例 `12/30`）
- CVV: `111`
- 郵便番号: `10003`（サンドボックス）

「支払う」→ 3DS → 成功で `payment id` が返れば OK。
Square Developer の **Sandbox Dashboard** に決済が記録されます。

### 5. 本番へ切り替え
1. `pay.html`: `ENV: 'production'` ＋ 本番の `APP_ID` / `LOCATION_ID`
2. Worker: `wrangler.toml` の `SQUARE_ENV = "production"`、`SQUARE_ACCESS_TOKEN` を**本番トークン**で登録し直し → `wrangler deploy`
3. `ALLOW_ORIGIN` を決済フォームの実オリジンに絞る（`*` のままにしない）

---

## 次の段階（予約同期）
Square で入った予約を一元台帳に取り込むには、Bookings API の Webhook
（`booking.created` / `booking.updated` / `booking.canceled`）を購読し、この Worker に受け口を足します。
決済が通ったら着手します。

## 注意
- **Access Token を pay.html やチャットに貼らないこと。** 必ず `wrangler secret put` でサーバーに登録。
- `Square-Version`（worker.js 内）は必要に応じて最新へ更新。

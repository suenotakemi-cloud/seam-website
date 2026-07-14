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

**かんたん版（推奨・1行）:**
```bash
bash ~/Downloads/code_sandbox_light_a3728b14_1778910042/booking/square/deploy.sh
```
`deploy.sh` がデプロイ → Access Token 登録の順で対話的に進めてくれます。

**手動版:**
```bash
cd booking/square
npx wrangler login                            # 済んでいれば不要
npx wrangler deploy                           # ← 先にデプロイ（Workerを作成）
npx wrangler secret put SQUARE_ACCESS_TOKEN   # ← 次に Sandbox の Access Token を貼る（秘密）
```
> ⚠️ `wrangler` 単体では動きません。必ず **`npx wrangler`** を使ってください（グローバル未インストールのため）。

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

## スタッフ別売上ブリッジ（Square POS → シフトアプリ）

`worker.js` に `GET /sales` を追加済み。Square POS の売上を**スタッフ別に集計**して返します。
シフト表（誰が入っているか）と並べると、人時売上・指名売上が見えます。

- **使うには Worker を再デプロイ**（`worker.js` を更新したため）:
  ```bash
  cd booking/square && npx wrangler deploy
  ```
- `wrangler.toml` の `SQUARE_LOCATION_ID`（銀座の Location ID）を集計対象に使用
- 動作確認: `sales.html` を開いて期間を選び「集計する」。または直接:
  ```
  https://<worker>.workers.dev/sales?from=2026-07-13&to=2026-07-13
  ```
- 返り値: `{ total, staff:[{ name, count, totalSales }] }`
- ⚠️ 売上がスタッフに紐づくには、**Square POS で「担当者を選んで会計」**していることが前提
- 前提: Square 側スタッフ（team_member_id）と、シフトアプリのスタッフ（及川/ANZU/CHIKA）の対応づけ

## LINE 本格連携（LIFF + Messaging API）

`worker.js` に `POST /line/push`（1件送信）と `POST /line/reminders`（一括リマインド）を追加済み。
予約ページ（`index.html`）には LIFF 連携を実装済み（`LINE_CFG` を設定すると有効化）。

### 1. LINE 側の準備（あなたの作業）
1. [LINE Developers](https://developers.line.biz/) で **Messaging API チャネル**を作成
2. **チャネルアクセストークン（長期）**を発行 → これが秘密鍵
3. **LIFF アプリ**を追加（エンドポイントURL = 予約ページのURL）→ **LIFF ID** を取得

### 2. Worker にトークンを登録＆再デプロイ
```bash
cd booking/square
npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN   # ← チャネルアクセストークンを貼る（秘密）
npx wrangler deploy                                  # /line/push /line/reminders を有効化
```

### 3. 予約ページ（index.html）に設定
```js
const LINE_CFG = {
  LIFF_ID: '<あなたのLIFF ID>',                       // 公開OK
  PUSH_ENDPOINT: 'https://<worker>.workers.dev/line/push',
};
```
これで、LINEから予約ページを開くと **自動ログイン（LIFF）→ お名前プリフィル → 予約時にLINEで確認メッセージ自動送信**。

### 4. 前日リマインドの自動化（Cron）
`wrangler.toml` に cron を追加し、`scheduled()` で「明日の予約」を D1 から読んで push:
```toml
[triggers]
crons = ["0 9 * * *"]   # 毎朝9時
```
D1 未導入の間は、予約DBを持つ側から `POST /line/reminders`（`{reservations:[{userId,date,time,menu,staff}]}`）を叩けば一括送信できます。

> 🔑 チャネルアクセストークンは **Worker のシークレット**にのみ。`index.html`（フロント）には LIFF_ID と PUSH_ENDPOINT だけ（どちらも公開OK）。

## 次の段階（予約同期）
Square で入った予約を一元台帳に取り込むには、Bookings API の Webhook
（`booking.created` / `booking.updated` / `booking.canceled`）を購読し、この Worker に受け口を足します。
決済が通ったら着手します。

## 注意
- **Access Token を pay.html やチャットに貼らないこと。** 必ず `wrangler secret put` でサーバーに登録。
- `Square-Version`（worker.js 内）は必要に応じて最新へ更新。

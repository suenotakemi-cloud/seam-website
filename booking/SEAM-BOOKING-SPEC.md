# SEAM 銀座 予約・POS システム — 仕様書（画面 / 機能 / API接続 / 独自実装）

> 作成: 2026-07-25 ／ 対象: `booking/`（顧客予約ページ＋店舗管理＋POS を1ファイルに同梱した SEAM 銀座 専用システム）
>
> **前提と責任の所在（エンジニア確認・2026-07-25）**
> - 現時点は **SEAM 銀座 単一テナント専用**。この構成のまま運用して問題ない。ただし設計・実装の責任は本システムの作者（AI）が持つ。
> - **将来、店子（他サロン）が増える際は CUEPON 側に統合**する。その時は **汎用性・セキュリティを最優先**とし、本システム側の都合（独自D1に寄せた実装など）は考慮されない。
> - よって本書は「今 SEAM 専用でどう動いているか」と「統合時に CUEPON API へ寄せる際の移行対象」を明確に分けて記録する。
> - 大原則（2026-07-16 エンジニア方針）: **`AI_API_REFERENCE` に実在する CUEPON API だけで作る／独自バックエンドに依存する機能は作らない／予約の“正”も CUEPON に置く**。本システムは予約はこれに準拠、**POS（会計・在庫・割引）は独自D1で先行実装しており、統合時に CUEPON ec系API へ移行する必要がある**（§6・§8）。

---

## 1. デプロイ構成

| 層 | 実体 | 備考 |
|---|---|---|
| フロント | `booking/index.html`（単一HTML・顧客/管理 同梱） | GitHub Pages `suenotakemi-cloud/seam-website`（本番 `https://suenotakemi-cloud.github.io/seam-website/booking/index.html`） |
| API | Cloudflare Worker `seam-square-pay`（`booking/square/worker.js`＋`salon-bridge.js`＋`util.js`） | `*.workers.dev` |
| DB | Cloudflare D1 `seam-booking`（`booking/square/schema.sql`） | 独自バックエンド（統合時 CUEPON へ移行対象） |
| 秘密情報 | wrangler secret：`ADMIN_TOKEN`／`SQUARE_ACCESS_TOKEN`／`RESEND_API_KEY`／`LINE_CHANNEL_ACCESS_TOKEN`／`SALON_LOGIN_ID/PASS`／`LINE_LOGIN_CLIENT_SECRET` | コード非コミット |
| 公開変数 | wrangler.toml [vars]：`ALLOW_ORIGIN`（CORS許可）・`SQUARE_ENV`・`SQUARE_LOCATION_ID`・`SALON_HOST/SHOP_ID/SPA_SHOP_ID`・`LINE_LOGIN_CLIENT_ID` 等 | |

- **顧客/管理の分岐はURLパラメータ**：`?src=`（line/google/instagram/own）付き＝顧客モード、無し＝管理モード。
- **管理モードは管理トークン認証必須**（§7）。顧客モードは PII を保持しない。

---

## 2. 画面仕様

### 2.1 顧客予約フロー（顧客モード `?src=`・SEAM世界観：白×ゴールド／スパはセージ）
1. **入口選択**：ヘアサロン / スパ（ヘッドスパ）の2択。以降そのセクションのメニューのみ表示（ヘア→ヘア店、スパ→スパ店へ振り分け）。
2. **メニュー選択**：クーポン13＋単品15。カテゴリ別。所要時間・税込価格表示。
3. **スタッフ選択**：指名なし（フリー）／各スタイリスト。
4. **日時選択**：営業時間・シフト・空き枠から。スマート割（隙間なく繋がる枠に特典）・最短予約。
5. **確認**：姓/名/セイ/メイ の4欄（HotPepper形式）・電話・合計・キャンセルポリシー。
6. **前金決済**（任意）：Square Web Payments。前金なしで店頭払いも可。
7. **完了**：LINE友だち追加 ／ ホームケア（会員制オンラインショップ `seam.site/onlineshop`）導線 ／ Googleクチコミ導線。
- ログイン：LINE Login(LIFF)／Google（海外客）。確認はLINE/メールでサーバ送信（§7）。

### 2.2 管理画面（管理モード・トークン認証後）
ヘッダー nav：**今日 / ダッシュボード / 予約台帳 / 顧客カルテ / レジ・会計 / 売上レポート / 商品・在庫 / シフト / 予約ページ / チャネル連携**＋ログアウト。

| タブ | 内容 |
|---|---|
| 今日 | スタッフ別の当日予約リスト（次客が上）・ステータス変更・詳細 |
| ダッシュボード | KPI（今日/今週予約・稼働率・自社比率）・**本日の売上パネル**・**予約リマインド状況**・要ブロック・キャンセル待ち・再来おすすめ・チャネル内訳 |
| 予約台帳 | スタッフ×時間の単日マスタ表・空き枠クリックで登録・予約クリックで詳細/カルテ/会計 |
| 顧客カルテ | 顧客一覧（LTV順）・**LTV（会計実績）/会計回数/平均単価**・来店履歴・施術メモ |
| レジ・会計 | お会計（§4.4）・本日の売上・未会計/会計一覧・**レジ締め**・Squareターミナル設定 |
| 売上レポート | 期間別・日別・スタッフ別（指名率）・**月間目標/前年同月比/歩合給**・CSV書き出し |
| 商品・在庫 | 商品マスタ（名/価格/バーコード/在庫）・在庫わずか警告・**入荷(仕入)履歴** |
| シフト | 営業時間11:00–20:00・不定休・サロン休業日/スタッフ個別休み（日付指定）・スマート割/お礼の率 |
| 予約ページ | 顧客フローのプレビュー |
| チャネル連携 | 各媒体の接続方式の案内・予約リンク生成・メール取込シミュレータ |

---

## 3. 機能仕様（要約）

- **予約**：作成/変更/キャンセル/削除、ステータス（booked/done/cancelled/noshow）、ダブルブッキング判定、キャンセルポリシー段階課金、ノーショー損害上限、キャンセル待ち自動連絡、スマート割（隙間解消）。
- **兼任スタッフ相互ブロック**：ANZU はヘア/スパ兼任。ヘア予約→スパに「予定」、スパ予約→ヘアに「予定」（ダブルブッキング防止）。ヘア/スパで別 account（`cu`/`cuSpa`）・別店舗（`SALON_SHOP_ID`/`SALON_SPA_SHOP_ID`）へ振り分け。ミラーは salon.town の account_link が自動生成。
- **営業時間/休日**：11:00–20:00・不定休（減算モデル＝全員毎日出勤ベース、休みは日付指定で引く）。
- **レジ・会計**：お会計（技術＋店販＋割引・支払方法 現金/カード/QR・指名/フリー）、バーコード店販＋在庫自動減算、本日売上、レジ締め（釣銭準備金→理論残高→実査→過不足、前日繰越）。
- **売上レポート**：期間/日別/スタッフ別（客単価・指名率）、月間目標（達成率・着地見込み）、前年同月比、歩合給（指名技術/フリー技術/店販に率）、CSV。
- **商品・在庫・仕入**：商品マスタ、在庫、入荷履歴（仕入原価）。
- **顧客カルテ / LTV**：会計を予約/氏名で顧客に紐付け、累計売上・会計回数・平均単価。
- **レシート**：印刷/PDF（店名・明細・合計・支払方法・指名）。
- **リマインド**：前日 LINE 自動送信（Cron）＋状況可視化＋手動送信。
- **Square端末決済**：Terminal API（sandbox実装済み・本番は端末ペアリング＋本番トークンで稼働）。
- **メール取込**：HotPepper予約通知を受信→パース→D1（channel=hpb）。
- **次回予約（店頭・2026-07-28）**：会計確定直後に「次回のご予約」を提案。メニュー周期（カット/カラー42日・パーマ56日・縮毛矯正90日・トリートメント30日・スパ21日）から目安日を算出し、同担当・同時刻が空く直近営業日を自動提案→フリガナ確認してワンタップ登録（通常予約と同経路でサロンボードまで同期・指名扱い・LINE通知）。

### 3.1 salon.town へ送る予約データ形式（2026-07-27 オーナー確定／2026-07-26 スパ設備追加・重要）
サロンボード書込（RPA・**予約のみ＝予定機能は廃止**）に必要な**赤丸必須項目のみ**を送る。**メニュー/クーポン名は送らない**（名称一致でRPA書込がエラーになるため）。
- 指名/フリー（`info_js.nominated`）・開始時間（`reserve_date`）・**所要時間**（`reserve_end_date`＝開始＋所要／`info_js.duration_min`）・氏名カナ（`name`欄＝「姓 名（セイ メイ）」／`private_js`にカナ）・担当（`account_id`＋`info_js.hbp_stylist_id`＝account.code）。
- `item_id`・`menu_id`・`hbp_menu_id` は**送らない**。`menu_label` は表示控えのみ（照合不使用）。
- **スパのみ追加＝設備（個室）**：スパのサロンボードは予約フォームで**「設備」が必須項目**（ヘアには無い・2026-07-26オーナー実機確認）。
  - **RPA実装確認済（2026-07-27・APK解析）**：RPAは`selectAvailableEquipment`で**SB設備プルダウンから空き部屋を自走選択**する（`hbp_facility`は読まない）。全部屋埋まりは「空いている設備が無いためミラー予約をスキップ」。ヘア（設備欄なし＝CLP）は`EQUIP_NOT_REQUIRED`で素通り。
  - こちらが送る `info_js.hbp_facility`（割当部屋）・`hbp_facility_list`（部屋一覧＝個室A/B）は**台帳側の参考情報**（RPA必須ではないが、どの部屋想定かの記録として送り続ける）。部屋は wrangler.toml `SPA_ROOMS`。

### 3.2 RPAアプリの実装仕様（APK `app-debug(4)` 解析・2026-07-27 学習）
エンジニアのRPA＝Androidアプリ（WebView＋注入JS・socket.ioでSaaSからジョブ受信）。フロー: ReserveFlow（予約登録）／SchedulePostFlow・ScheduleDeleteFlow（予定・廃止方向）／ScheduleSyncFlow（**SB→SaaSの逆同期あり**）／CancelFlow（キャンセル・キレイサロン対応）／Coupon・Menu・StylistSyncFlow（HBPスクレイプ→SaaSへ saveEcItem/saveEcDiscount/saveAccount）。
- **読むフィールド**：`hbp_stylist_id`（byCode解決）・`duration_min`・`block_for_reservation_id`・`customer_*`（姓/名/カナ/tel・nameのsplitName）・`payment_type`（prepay=オンライン事前決済/card-on-file/onsite=現地払い）。**`nominated`/`hbp_facility` は読まない**。
- **所要時間はHBPの30分刻みに自動で丸める**（「HBPは30分刻みのため◯分に丸め」）＝45分スパも問題なし。
- **メニューは備考欄に記載する運用**（メニュー設定はスキップ＝menu-less設計と整合）。
- **重複ガード**：枠に既存予約があると予約番号を確認（期待値=hbp_reserve_id照合・「同じ予約番号」）。受付可能数超過/重複の警告ダイアログはOKを最大2回押して進み、解消しなければ中断。
- **ミラー（予定あり(SUGU)/SUGU_BLOCKメモ）**：スタイリスト不在・枠塞がり・設備満室時はスキップして完了扱い（info_js刻印）。
- ロボット対策画面（CAPTCHA）検知あり。多店舗は `hbpStoreId`／`info_js.shops` で選択。

---

## 4. API接続箇所

### 4.1 CUEPON / salon.town（＝設計原則に準拠している部分）
Worker（`salon-bridge.js`）→ `SALON_HOST`（`sugu-api.salon.town`）。認証は `/login`→`user_id`+`token`。
| 用途 | エンドポイント | 実装 |
|---|---|---|
| 予約 作成/同期 | `POST /save/reservation` | `salon-bridge.js` salonPush |
| 予約 取得/キャンセル/削除 | `POST /get/reservation`・`/save/reservation`(cancel)・`/delete/reservation` | salonPull/salonCancel/salonDelete |
| メニュー登録（初期構築） | `POST /save/ec/item`・`/get/ec/item` | `salon-town/scripts/seam-setup.mjs`（一度きりの provisioning・現在の予約フローからは呼ばない） |
| 店舗（初期構築） | `/save/shop`・`/get/shop` | seam-setup.mjs（※店舗作成はコンソール推奨） |

### 4.2 外部API（Worker経由）
| 先 | 用途 | エンドポイント |
|---|---|---|
| Square | 前金決済 | `POST connect.square(sandbox).com/v2/payments`（`/pay`） |
| Square Terminal | 端末カード決済 | `/v2/devices/codes`（ペアリング）・`/v2/terminals/checkouts`（送信/状態/取消）（`/terminal/*`） |
| LINE | 予約確認・リマインドpush / プロフィール / ログインOAuth | `api.line.me/v2/bot/message/push`・`/v2/profile` |
| Resend | 予約確認メール・オーナー通知 | `api.resend.com/emails` |

### 4.3 自社 Worker エンドポイント（フロント↔D1・§6の独自実装）
公開（顧客導線・認証不要）：`POST /pay`・`POST /reservations`・**`GET /availability`**（空き判定用・PII無しの占有区間のみ＝顧客ページのキャパ超過防止）・`POST /line/login/state`・`GET /line/login/result`。
管理（`Authorization: Bearer ADMIN_TOKEN` 必須）：
`GET/PATCH/DELETE /reservations`／`GET/POST/DELETE /checkouts`／`GET/POST/DELETE /settlements`／`GET/POST /settings`／`GET/POST/DELETE /products`／`GET/POST/DELETE /intakes`／`GET /sales`／`POST /line/push`・`/line/reminders`・`/mail/confirm`・`/ai/chat`／`/salon/selftest|pull|whoami`／`/terminal/*`。
運用ツール（`CLEANUP_TOKEN`＝wrangler secret・オーナー/AI運用専用）：
`POST /admin/purge-test`（氏名「テスト%」×channel line/own のみD1＋salon.town削除）／`GET /admin/diag-resv`（両店予約の診断読取・add_info付き）／`POST /admin/salon-del?id=`（salon.town予約1件削除＝孤児ミラー掃除）／`POST /admin/salon-patch`（info_js更新＝個室後付け等。**部分dataでも他カラムは無傷を実証済**）／`GET|POST /salon/noname`（無記名ミラーの孤児判定つき掃除・**親生存チェックで本物予約のミラーは残す**）。
メール受信：Cloudflare Email Routing（`hpb@seam.site`）→ Worker `email()` → parseSalonBoard → **D1のみ**（台帳表示・空き枠×・オーナー通知。**salon.townへは書かない**）。
- 通知メールはヘア掲載「SEAM 銀座」/スパ掲載「SEAM 銀座店」の**両方**が届く。先頭サロン名行で店舗判定（`銀座店`を先に判定）・**SEAM 銀座以外の掲載は取込対象外**（他店舗混入ガード）・キャンセル連絡は予約番号一致で status=cancelled 反映。
- **salon.town への HPB 予約作成はエンジニア側 `reserve_<shop_id>@sugu.salon.town` が唯一の書き手**（役割分担・二重処理防止）。
- **同一ID（HPB予約番号）の重複は自動破棄**：D1のIDを `hpb-BF<番号>` とし `INSERT OR IGNORE`（オーナー方針「同じIDの予約は消去」準拠）。自社予約はサーバ409＋salon.town `check_slot_conflict:true` で二重予約拒否。

---

## 5. データモデル（D1 `seam-booking`・独自）

| テーブル | 役割 | CUEPON対応（統合時の移行先） |
|---|---|---|
| `reservations` | 予約台帳（全チャネル：own/line/google/instagram/hpb） | `reservation`（予約の“正”はCUEPON。現状は自社D1＋CUEPON同期の二重） |
| `checkouts` | お会計（技術/店販/割引/支払方法/指名） | `ec/order`（`/request/ec/order`・`/save/ec/order/state`） |
| `settlements` | レジ締め（釣銭/理論残高/過不足） | （CUEPON側の相当機能を要確認・売上は order 集計） |
| `settings` | 目標/歩合率/釣銭準備金/端末ID 等 | （汎用設定・統合時に再設計） |
| `products` | 店販商品マスタ（バーコード/在庫） | `ec/item`＋`ec/stock`（`item_stock`） |
| `intakes` | 入荷（仕入）履歴 | `ec/stock`（`/save/ec/stock` type:add・`stock_history`） |

---

## 6. 独自実装箇所（＝統合時に CUEPON へ移行が必要／設計原則からの逸脱）

**明確に記録する。以下は CUEPON API を使わず自社 Cloudflare Worker/D1 で先行実装しているもの。** オーナー依頼機能を速く出すため独自実装した経緯で、悪意はないが CUEPON と二重になっている。統合時は §8 の対応表で CUEPON ec系へ移行する。

1. **会計・レジ（`checkouts`/`settlements`）** — CUEPON `ec/order`・`ec/payment` 未使用。
2. **在庫・仕入（`products`/`intakes`）** — CUEPON `ec/stock`・`ec/item`(stock) 未使用。
3. **割引（スマート割・お礼・キャンセル料）** — CUEPON `ec/discount` 未使用（自社 `reservations.discount`・`settings` のみ）。
4. **売上レポート・歩合給・LTV・目標/前年比** — 自社D1集計（CUEPON側の集計/受注データを使っていない）。
5. **メニューの紐付け** — 予約に `item_id` を付けず所要時間だけ送る（2026-07-27・名称照合エラー回避のため）。※本来は `ec/item` の item_id で照合するのが正攻法。
6. **管理認証（`ADMIN_TOKEN`）** — CUEPON の permission/account 認証ではなく独自共有トークン。統合時は CUEPON の `account.permission`（service/shop/shop_staff…）＋RBAC に置換。
7. **メール取込パーサ（`parseSalonBoard`）** — HotPepper通知メールを自社パースしD1へ（channel=hpb）。エンジニア側 reserve_@ パーサとの二重処理に注意（要一本化）。
8. **前金決済/端末決済の集約** — Square は直接叩いている（CUEPON `ec/payment`・Square端末API `start/ec/square/terminal/pairing` 経由ではない）。

---

## 7. セキュリティ（2026-07-24 P0対応済み）

- **管理API認証**：管理系全エンドポイントに `Authorization: Bearer ADMIN_TOKEN`（wrangler secret）。公開は予約作成/決済/LINEログインのみ。無認証は 401。
- **管理画面ゲート**：管理モードはトークン入力→検証してから初めてD1（顧客PII/売上）をロード。未認証はゲートで全カバー。ログアウトあり。
- **顧客モードの隔離**：`?src` 付きは管理トークン不使用・顧客モードでは他人のPII/売上をメモリにもlocalStorageにも保持しない（共有端末対策）。
- **CORS**：`ALLOW_ORIGIN` ホワイトリスト（github.io/localhost）。`*` 廃止。
- **XSS**：`escH()`（`& < > " '`）で氏名/メモ/顧客名/レビュー/商品名/属性を全エスケープ（格納型XSS対策）。
- **確認送信**：予約確認LINE/メールは**予約作成時にサーバ側**で送信。フロント直叩き（/line/push・/mail/confirm）は管理専用化（なりすまし/踏み台防止）。
- **秘密情報**：フロントに機微トークンなし。すべて Worker secret。

**統合時の要件（エンジニア方針）**：汎用性・セキュリティ最優先。独自トークンは CUEPON の permission/RBAC（テナント分離・`affilicated_shop_id` スコープ）へ置換。本システム都合は考慮されない前提で設計する。

---

## 8. 統合時の移行対応表（独自D1 → CUEPON ec系API）

参照：`~/Downloads/AI_API_REFERENCE/AI_API_REFERENCE/`（04_ec_item / 05_ec_order / 06_ec_payment / 07_ec_misc）。

| 独自実装（現状） | 移行先 CUEPON API | 参照 |
|---|---|---|
| メニュー紐付け | `/save/ec/item`・`/get/ec/item`（**item_id で照合**＝名称エラー解消） | 04 |
| 会計・受注 | `/request/ec/order`（新規）・`/save/ec/order/state`（状態）・`/save/ec/order`（info/memo） | 05 |
| 決済 | `/save/ec/payment`＋Square端末 `/start/ec/square/terminal/pairing`・`/get/ec/square/terminal` | 06 |
| 割引・クーポン | `/save/ec/discount`（流派C＝JSONのbase64・multer無し）・`ec_discount` | 07 |
| 在庫・棚卸 | `/get・save/ec/stock`・`/check/ec/item/stock`・`/commit/ec/shop/stock` | 07 |
| 認証・権限 | `/login`＋`account.permission`（service/dealer/company/shop/shop_staff/一般）RBAC | 00/02 |

**移行順（影響小→大）**：①メニュー item_id 照合 → ②在庫 ec/stock → ③会計 ec/order → ④割引 ec/discount → ⑤決済 ec/payment → ⑥認証 permission。**着手はエンジニアの「移行OK」合図と、予約トークン(shop権限)で ec系を叩けるかの確認後**。

---

## 9. 既知の依存・課題

- **RPA（salon.town→サロンボード書込）**：エンジニア側インフラ。**予約のみ（予定機能は廃止・2026-07-26）**。停止するとサロンボードに予約が反映されない。処理結果は `info_js.hbp_success/hbp_processed_at/hbp_reserve_id` 刻印で確認する。
  - **RPAへの契約（本システム→RPA）**：§3.1 の最小データ（指名/時間/所要/氏名カナ/担当/スパは個室）。`hbp_facility` 無し予約は先頭の空き個室にフォールバック。メール取込のBF番号予約（既にサロンボードに存在）は**書き戻し不要＝スキップ**（キュー詰まり防止・依頼中）。
  - **兼任ミラー（block）**：salon.town account_link が自動生成（name「予定あり（他店舗のご予約）」・`info_js.is_block/block_for_reservation_id`）。予定機能廃止後のRPA側の扱いはエンジニア決定事項。
  - **⚠️孤児ミラー**：兼任スタッフ（ANZU）の予約を削除すると**ミラーは別レコードとして残り**、RPAが処理不能→90秒タイムアウト連発→**キュー全体が詰まる**（2026-07-25実障害）。予約削除時は `/salon/noname`（孤児判定つき）か `/admin/salon-del` でミラーも掃除する。
- **メール取込の役割分担（2026-07-26確定）**：salon.town予約の作成は `reserve_<shop_id>@sugu`（エンジニア）が唯一。`hpb@seam.site`（本システム）は**D1表示のみで書かない**。二重処理は発生しない。
- **多テナント非対応**：現状 SEAM 銀座 単一。テナント分離・汎用化は統合時に CUEPON 側で実施（本システムは寄せる側）。スパ個室の割当ロジック（メニューID直書き判定・`SPA_ROOMS`）もSEAM専用＝統合時に設備マスタへ汎用化。

---

*本書は現状のスナップショット。仕様変更時は本ファイルを更新する。*

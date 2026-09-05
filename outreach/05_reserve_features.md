# 05 「サロンタウンリザーブ」機能棚卸し（付録・リポジトリ調査 2026-09-05）

調査対象: `/home/user/seam-website/booking/`（`square/`, `line/` 含む）、`functions/`、`salontown/`、`正本はどこか.md`、`db/SETUP_DASHBOARD.md`、`README.md`、`.gitignore`、git履歴。

前提・注意（先に読むこと）
- 本リポジトリ内に **「サロンタウンリザーブ」という製品名は登場しない**（grep 一致は商品名「カラープリザーブ」のみ）。本書は booking/ 配下＝SEAM 銀座で動いている予約〜会計〜スタッフ系システムを「リザーブ」候補として棚卸ししたもの。**製品名との対応は要確認**。
- サーバー側（Cloudflare Worker `seam-square-pay`、`booking/square/worker.js`、料金計算の正本 `saas/checkout.js`）は **このリポジトリに含まれていない**（`.gitignore` で `booking/square/*.js` を除外、`正本はどこか.md` に「作業リポジトリ側が正本」と明記）。サーバー挙動は画面側コードとドキュメントの記述からの読み取りであり、**Worker の実装そのものは未検証**。
- 画面は全て `noindex,nofollow`。公開サイト（hairsalon.html 等）の予約CTAは現在も HotPepper Beauty へリンクしており、`/booking/` への公開導線は本リポジトリ内では確認できず（**要確認**）。

---

## 1. 機能一覧（カテゴリ別）

### 1-1. 予約導線（お客様向け）
| 機能 | できること | 根拠 |
|---|---|---|
| オンライン予約（3ステップ） | ヘア／ヘッドスパの入口を選び、メニュー→スタッフ→日時→確認→（前金）→完了。「予約は3つだけ」と進捗を言葉で表示 | `booking/index.html`（CUSTOMER BOOKING セクション、`H: メニューを選択/スタッフを選択/日時を選択`） |
| 実予約ベースの空き表示 | 自社・LINE・HPB取込の予約で埋まった枠を「×」表示し、サロンボード上の予約数を超えて受け付けない（PIIなしの占有区間だけを取得） | `booking/index.html`（「キャパ超過防止」コメント、`/availability`） |
| フリー指名の自動振替 | 指名なしは確定直前に空いている担当へ自動割当。真に満席のときだけ「別の時間を」案内 | `booking/index.html` |
| 確定シフト連動 | サーバの確定シフト・休業日を全端末で共有し、休みの日に予約が取れない | `booking/index.html`（`/shifts`、「確定シフトをサーバから受け取る」） |
| 枠の所要時間計算 | 施術＋準備・乾かし15分＋会員特典の時間で枠を押さえる | `booking/index.html` |
| スマート割・詰めのお願い | 前後の予約と隙間なく繋がる枠に特典を付けて誘導（枠は隠さない）。隙間ができる時間を選んだときだけ「◯◯さんからのお願い」で隣接時間を提案（強制なし）。特許 JP7617580 の構成を避ける旨を明記 | `booking/index.html` |
| リピーター呼び出し | 電話番号で前回内容を呼び出し。自分の端末なら前回入力を保持（店舗端末には記憶させない） | `booking/index.html`（`/precheck`、「この端末が覚えていること」） |
| 会員証で予約 | 会員証QR＋電話下4桁で氏名・電話入力を省略し、その場で「◯回目」「ランク」を表示 | `booking/index.html`（`/member/scan`、「会員証で入る」） |
| 本人確認・連絡先 | LINEログイン／Googleログイン／メールのワンタイムパスワード（6桁）。連絡先が結ばれるまで支払いへ進めない | `booking/index.html`（`/otp/send`, `/otp/verify`, `accounts.google.com/gsi/client`） |
| 予約確認・リマインド | 確認通知はサーバ側で送信（LINE／メール）。LINE連携客へ前日リマインドを自動送信（Cloudflare 定期実行）。予約時の言語で通知 | `booking/index.html`（`/mail/confirm`, `/line/push`, 「予約リマインド」） |
| キャンセルページ | 予約時の言語で表示。キャンセル料を押す前に提示、返金額と着金目安まで表示 | `booking/cancel.html`（`/reservations/cancel-info`, `/reservations/cancel`） |
| キャンセル待ち | 予約キャンセル時に条件に合う待ち客へ空き連絡（LINE→メール） | `booking/index.html`（「キャンセル待ち」） |
| 紹介リンク／流入元 | `?ref=スタッフ` で紹介を計測、`?src=line|google|instagram` で流入元を自動タグ付け | `booking/index.html`（`/ref/view`, `/referrals`） |
| Googleクチコミ導線 | 完了画面から Google の「クチコミを書く」へ誘導（サイト内では集めない） | `booking/index.html` |
| 予約完了→事前カウンセリングへの橋 | 完了画面から「今日のご希望」（precare）へ誘導 | `booking/index.html`, `booking/precare.html` |

### 1-2. 決済・前金・レジ
| 機能 | できること | 根拠 |
|---|---|---|
| 前金（デポジット）オンライン決済 | Square Web Payments SDK（カード番号は Square の iframe にのみ入力）、3Dセキュア対応。冪等キーで二重請求防止。予約が作れなかったときは全額自動返金。ノーショー履歴のある客は前金必須 | `booking/index.html`（「前金の決済」「迷子になった前金を返す」`/pay/refund-orphan`）、`booking/square/pay.html` |
| 前金の言語別設定 | 日本語客＝定額（既定¥3,000）、海外客＝料金の◯%（既定50%） | `booking/index.html`（「前金（デポジット）— 言語ごとに設定」） |
| 前金のサーバー側再計算 | 画面から送るのはメニュー・言語・割引で、サーバーが金額を計算し直し、違えば決済しない | `booking/index.html`、`正本はどこか.md`（版 6731a9f9） |
| 段階式キャンセルポリシー | 残日数で料率を決定。無断キャンセル上限＝(料金−材料費)×再販不可率、消費者契約法9条を意識した設計 | `booking/index.html` |
| Square ターミナル連携 | 端末ペアリング、金額送信→完了までポーリング→会計確定。実際に通った決済手段・ブランド・手数料を端末から受け取る。明細と担当を Square にも渡す | `booking/index.html`（`/terminal/*`）、`booking/shop.html` |
| iPad レジ（店販） | Bluetooth バーコードリーダー／カメラで JAN・会員QR・社員証QRを読取、現金のお預かり候補とおつり内訳、6決済手段、メンバー／セール価格切替、返品・返金、レジ締め（金種・免税・入出金） | `booking/shop.html` |
| 会計の一括確定 | 会計・免税預り・在庫・ポイントをサーバーで1リクエストで確定（途中切断による不整合を防止）。端末決済が通った後の保存失敗を控えて二重決済を防ぐ | `booking/shop.html` |
| お客様画面（2台目iPad） | 明細・合計・ポイント表示、支払方法をお客様自身が選択、値引き販売時の返品不可同意、返金時の着金目安表示。QRは端末内で生成（外部サービスに鍵を渡さない） | `booking/display.html`（`/display/state`, `/display/consent`） |
| 返金の控え | 決済手段別の返金案内（日英併記）を QR でお客様に渡す | `booking/refund.html`（`/refund/view`） |
| 免税 | 免税会計・免税袋の扱い・申請シート出力。2026-11-01 のリファンド方式へ日付で自動切替 | `booking/shop.html`（`TF_REFUND_FROM`）、`booking/report.html`（免税の返金待ち） |
| 価格設定 | メンバー価格・セール価格をブランド／サイズ単位の割引率で設定（細かい指定が優先） | `booking/prices.html` |
| 機器接続テスト | バーコードリーダー・Square 端末・社員証QR・出勤暗証番号を本番会計を作らずに検証 | `booking/setup.html` |
| レシート／領収 | 印刷／PDF レシート、LINE で領収のご案内 | `booking/index.html`（`/receipt/token`, `/receipt/line`） |
| HPB スマート支払い | HPB の事前決済予約は店頭で受け取らない扱いに自動設定 | `booking/index.html` |

### 1-3. カウンセリング・カルテ
| 機能 | できること | 根拠 |
|---|---|---|
| カウンセリングシート／同意書（ヘア） | 来店時 iPad で記入・手書き署名。写真（撮らない／カルテ用／SNS可）・音声AIの同意項目を店舗設定で出し分け。髪格診断（finder）の結果があれば重複質問を省略し、待ち時間に診断→自動紐付け | `booking/counseling.html`（`/counseling`, `/counseling/attach`, `/settings`） |
| ヘッドスパ同意書 | 薬剤ではなく水・温冷・姿勢の安全に特化した別シート（同じ保存先に kind:'spa'） | `booking/counseling-spa.html` |
| 多言語シート | 表示だけ翻訳し、保存データは常に日本語。スタッフ画面で「お客様の言葉で表示」に戻せる | `booking/cs-i18n.js`, `booking/counseling.html` |
| 顧客カルテ | 予約・会計・シート・髪格診断・同意・注意を1枚に集約。重要メモ／誕生月、来店周期、ポイント・回数券・ギフト保有、LTV、施術写真（1100pxに圧縮して保存）、CSV書き出し | `booking/index.html`（`/karte`, `/karte/photo(s)`, `/custnotes`, `/customer/profile`） |
| 施術カルテ（薬剤記録） | 塗布ごとの薬剤・g・比率・放置時間、頭と毛束の図で塗る場所を指定、バーコードで薬剤登録（菊池マスタ JAN→商品名 5,700件）、音声入力（話し言葉→薬剤・量・比率・部位に振り分け）、材料費をその場で表示 | `booking/staff-spa.html`, `booking/index.html`（「カルテ（施術の記録）」） |
| カウンセリング集計 | 月次ミーティング用の集計 | `booking/index.html`（`/counseling/stats`） |

### 1-4. 来店前後の体験
| 機能 | できること | 根拠 |
|---|---|---|
| 今日のご希望（precare／来店前） | 予約後にスマホで、強さ（10段階バー）・部位マップ・香り・灯り・音・アレルギー等を「選ぶだけ」で設計。第2章（詳細）は任意。業種別（hair／spa／eye／nail）の設問。2回目以降は「前回と同じ、ここだけ違う」クイック。5言語。公開モード（予約前に組み立て→予約後に担当へ引き継ぎ）、見本モード（研修用・保存なし） | `booking/precare.html`, `booking/pc-i18n.js`（`/precare`, `/precare/demo`） |
| 担当者の「今日のお客様」 | precare の内容をアレルギー最上段で表示、終了予定までの残り分数、ヘッドスパの工程を「譜面」として表示、放置タイマー、練習モード | `booking/staff-spa.html` |
| 翌朝のお便り（おわりに） | 施術後に担当が1行書くと翌朝お客様に届く（店内メモとは分離） | `booking/staff-spa.html`（「おわりに」「翌朝 ◯様に届きます」） |
| お持ち帰りの1枚（keepsake） | 当日選んだ言葉をその方の言語で紙のように1枚に。海外客向けの「人に話したくなる」設計 | `booking/keepsake.html`（`/precare`, `/visit/record`） |
| 推薦度（NPS）1問 | お帰りぎわに 0〜10 を1問だけ。答えない自由を同じ大きさで置く | `booking/ask.html`（`/nps`）、`booking/report.html`（推薦の集計） |
| 次回予約の店頭提案 | 会計直後に施術周期から目安日を計算し、同担当・同時刻の空きを提案 | `booking/index.html`（「次回予約（会計直後の店頭提案）」） |
| 再来リマインド／そろそろの方 | 来店データ駆動で再来おすすめを抽出。LINE未連携客を目立たせて人が動けるように | `booking/index.html`, `booking/staff-spa.html`, `booking/report.html` |
| 口コミ承認 | 美容師が公開を選ぶ承認制モデレーション | `booking/index.html`（「口コミ承認」） |

### 1-5. スタッフ・シフト・給与
| 機能 | できること | 根拠 |
|---|---|---|
| スタッフ用スマホ画面 | 次のご予約が決まっている率、歩合ゲージ（次の段まであといくら）、今月の内訳、シフト希望（60日分を出勤／休みで提出） | `booking/staff.html`（`/staff/me`, `/shifts/mine`） |
| 個人ログイン | スタッフごとの暗証番号／社員証QR（`SEAMSTAFF:<番号>:<合言葉6桁>`）でログイン、`X-Staff-Token` ヘッダーで送信。誰が書いたかをサーバーが決める | `booking/staff-spa.html`, `booking/setup.html` |
| 打刻・有給 | 打刻（丸めない）、時間有給の上限を画面とサーバーで制御（労基法39条4項に言及） | `booking/staff-spa.html` |
| アルバイト・業務委託画面 | 打刻と「いくらになったか」だけを表示、勤務中は1分ごとに更新 | `booking/part.html` |
| スタッフ登録（本人申告→承認） | HPB ID・所属・労務情報を本人がスマホで記入し本部が承認 | `booking/staff-apply.html`（`/staff/apply`）、`booking/report.html` |
| モデル募集 | 担当ごとのリンクで応募を受け付け、練習記録と次回予約まで残す | `booking/model.html`（`/model/apply`）、`booking/staff-spa.html` |
| シフト管理（管理画面） | 営業時間・休業日・スタッフ別シフトの確定、確定を LINE で通知 | `booking/index.html`（`/shifts`, `/shifts/notify`） |
| 歩合の段 | 段階式歩合率の設定、指名技術／フリー技術／店販に率を掛けて自動計算 | `booking/index.html`, `booking/report.html` |
| 給与 CSV | マネーフォワード クラウド給与向け CSV（従業員番号で紐付け、UTF-8 BOM） | `booking/report.html` |
| 申し送り板 | 消えない・誰が読んだか残る店内連絡 | `booking/report.html`, `booking/staff-spa.html` |
| salon.town シフト管理（別製品） | シフト自動作成（需要連動＋公平性レポート）、スマホで希望提出／QR打刻（時間回転トークン）、有給・半休・時間休、歩合・給与計算、サロンボード CSV 取込、HPB 予約メール取込、交代依頼、ヘルプ募集、公開前リスクスコア、店舗間備品シェア、Supabase 同期・テナント分離・暗号化ボード、LIFF ミニアプリ化 | `salontown/salontown-shift.html` |

### 1-6. オーナー管理画面・売上
| 機能 | できること | 根拠 |
|---|---|---|
| 管理画面（予約台帳） | 今日／ダッシュボード／カレンダー／顧客カルテ／カウンセリング／シフト／予約ページ／チャネル／商品・在庫／売上レポート／レジ。「つかう機能をえらぶ」で不要画面を消せる（ひとりサロン形も用意） | `booking/index.html` |
| 売上と発注（事務用） | 支払内訳・ブランド別手数料・値引き／ポイント／ギフト／免税・日別・メーカー別・レジ別・担当別・商品と利益・再来率・時間帯・曜日、発注書（仕入先別）、在庫アラート、備品、勤怠（年5日取得義務・みなし残業超過）、材料費、時間の守り方、NPS、口コミ、免税返金待ち、経理仕訳（マネーフォワード）、Square と台帳の照合、Square からの取り込み | `booking/report.html` |
| 幹部・事務スマホ画面 | 「今日、合っているか」だけを色で表示、休みの承認、レシート写真の投入 | `booking/boss.html` |
| 代表専用画面 | 人の時間・店ごと・担当ごとのサマリー（幹部とは別の鍵） | `booking/owner.html`（`/owner/summary`） |
| 商品・在庫 | 商品マスタ、店舗別在庫、棚卸し（読むだけ・理論在庫を隠す）、店舗間移動、入荷履歴、CSV取込（Square エクスポート対応） | `booking/index.html`（`/products`） |
| 自社ポイント・会員ランク | 付与率・ランク（3軸のいずれか）を設定。ポイント 1pt=商品1円／施術0.5円、有効期限半年 | `booking/index.html`（`/points`, `/rank/config`, `/customer/rank`） |
| ギフト券・回数券・月額会員 | 発行→販売→残高消込、券面印刷。回数券は1会計1回消化。月額会員は LINE 会員証で休会・解約を2タップ | `booking/index.html`（`/gifts`, `/passes`）、`booking/line.html`（`/member/subscription`） |
| チャネル連携 | LINE／Google／Instagram の予約リンク生成、HPB・楽天・minimo の予約通知メール取込（SALON BOARD 形式解析）、HPB「要ブロック」タスク、salon.town 経由サロンボード書込（RPA）の同期監視 | `booking/index.html`（CHANNELS、`/salon/health`, `/admin/salon-repush`） |
| 求人応募の表示 | 応募が届いたら事務ホームに表示 | `booking/index.html`（`/recruit/list`）、`functions/api/recruit.js` |
| 診断ダッシュボード（別系統） | 髪質診断のイベントを匿名集計（D1）、流入元・UTM・ファネル、CSV | `admin.html`, `functions/api/ev.js`, `functions/api/admin/stats.js`, `db/SETUP_DASHBOARD.md` |

### 1-7. LINE 連携
| 機能 | できること | 根拠 |
|---|---|---|
| LIFF 内予約 | LINE アプリ内で予約ページを開き、LINE 経由を UA／liff.state／referrer／`liff.isInClient()` で判定してお客様モードへ | `booking/index.html` |
| LINE ログイン | state 発行→LINE 認証→Worker が 302 で戻す。userId を URL に載せない設計 | `booking/line/login/result.html`（`/line/login/result`）、`booking/index.html`（`/line/login/state`） |
| LINE 会員証 | QR（salon.town 会員番号と同一値＝入場受付と共通）＋ Code39 バーコード、ランクと次ランクまでの距離、これからの予約、利用履歴・領収、月額会員、回数券の1回を LINE で贈る（未使用なら戻る） | `booking/line.html`（`/member/me`, `/member/gift*`, `/line/link`） |
| 店舗別 LINE 公式アカウント | 店舗ごとに LIFF／OA を持ち、サーバーから受け取って組む | `booking/line.html`, `booking/index.html`（`/line/shop-config`） |
| 会計後の LINE 導線 | レジ前で QR を読むと LINE と顧客台帳が結び付き、領収案内・会員証を配信 | `booking/index.html`（「会計後のLINE」） |
| プッシュ通知 | 予約確認・前日リマインド・シフト確定通知 | `booking/index.html`（`/line/push`, `/shifts/notify`） |

### 1-8. 多言語
| 機能 | できること | 根拠 |
|---|---|---|
| 予約フロー | 日本語／English／简体中文／繁體中文／한국어（`LANGS=['ja','en','zh','tw','ko']`）。メニュー名・スタッフ名は日本語維持 | `booking/index.html` |
| precare | 5言語辞書、組み立て文も関数で翻訳 | `booking/pc-i18n.js` |
| カウンセリング／スパ同意書 | 辞書で表示のみ翻訳、保存は日本語 | `booking/cs-i18n.js` |
| キャンセル・keepsake・返金 | 予約時の言語で表示／日英併記 | `booking/cancel.html`, `booking/keepsake.html`, `booking/refund.html` |
| 海外客向け配慮 | 日本語以外には会員・ポイントを出さず免税案内、前金は率方式、確認メールは Google／メール客向け | `booking/index.html` |

### 1-9. セキュリティ
| 機能 | できること | 根拠 |
|---|---|---|
| 権限分離トークン | 管理 Bearer トークン／`X-Staff-Token`（個人）／`X-Kiosk-Token`（カウンセリング端末は保存・読取・設定読取のみ）。お客様が触る iPad に全権トークンを置かない | `booking/counseling.html`, `booking/staff-spa.html`, `booking/shop.html`, `正本はどこか.md`（版 e3894a12, 56d3853a） |
| 確認コードの暗号乱数化 | 2026-08-15 に Worker 側で暗号乱数へ変更（ドキュメント記載） | `正本はどこか.md` |
| お客様モードで管理 DOM を物理削除 | LINE／`?src=` 経由では管理画面の DOM を削除し、PII・売上をメモリにも localStorage にも持たない | `booking/index.html` |
| 会員番号だけで名簿が抜けない設計 | 会員証 QR＋電話下4桁で照合 | `booking/index.html` |
| カード情報非保持 | Square の iframe／SDK に直接入力、サーバーは番号を受け取らない | `booking/index.html`, `booking/line.html`, `booking/square/pay.html` |
| XSS 対策 | 全ユーザー入力を innerHTML 前にエスケープ | `booking/index.html`（`escH`） |
| QR を外部サービスに渡さない | 控え URL の QR を端末内で描画 | `booking/display.html`, `booking/shop.html` |
| HTTP ヘッダー | HSTS／nosniff／X-Frame-Options／Permissions-Policy（カメラは /entrance, /pim のみ） | `_headers` |
| 個人情報の扱い | 診断ダッシュボードは PII なし、採用応募は別テーブル・GET はキー必須 | `db/SETUP_DASHBOARD.md`, `functions/api/recruit.js` |
| 入場受付 | セッショントークン方式、通信エラーと非会員を区別して会員を誤って弾かない | `functions/entrance/lookup.js`, `functions/entrance/session.js` |

### 1-10. EC・会員との連携
| 機能 | できること | 根拠 |
|---|---|---|
| salon.town 会員との共通化 | 物理会員カード（salon.town 24桁）と自社会員証（99+8桁）を同じ欄で読み、入場受付・ポイント・レジで共通利用 | `booking/index.html`, `booking/line.html`, `functions/entrance/*` |
| salon.town へのポイント連携 | 会計確定後に salon.town へポイントを送る（同一会計IDは二重送信不可） | `booking/shop.html` |
| 予約のサロンボード書込 | 予約は D1→salon.town→RPA→サロンボードの経路で登録（同期の見張りあり） | `booking/index.html`, `booking/report.html` |
| 髪質診断（finder）連携 | 診断結果をカウンセリングシート・会員条件に利用、予約完了画面からオンラインショップ（来店者限定ホームケア）へ誘導 | `booking/index.html`, `booking/counseling.html` |
| 商品マスタ／PIM | 店販商品は `data/products/seam-master.json`（394商品）、ディーラー向け PIM は別系統 | `README.md`, `functions/api/pim/*` |
| 入場受付キオスク | 会員 QR で入場、名前を表示 | `entrance.html`, `functions/entrance/*` |

---

## 2. 技術的な特徴（コード・ドキュメントから読み取れるもの）

- **フロント**: 静的 HTML＋バニラ JS（ビルド不要）。booking/index.html は約630KB の単一ファイルで管理画面と予約画面を同居させ、お客様モードでは管理 DOM を削除。
- **バックエンド**: Cloudflare Worker `seam-square-pay`（`https://seam-square-pay.suenotakemi.workers.dev`）が予約・決済・会員・カルテ・シフト等の API を一手に担う（`正本はどこか.md`、各画面の `API=` 定数）。Cloudflare Pages Functions（`functions/`）は診断集計・採用・入場受付・PIM。
- **データ**: Cloudflare D1（Worker 側、画面コメントに「D1同期」「D1→salon.town→RPA」）。画面は D1 未接続時 localStorage にフォールバック、保存失敗時は「送信箱」で再送。R2 は PIM の写真置き場として言及（`db/SETUP_PIM.md`・要確認）。salontown シフト管理は Supabase（realtime・RPC・暗号化ボード）。
- **決済**: Square Web Payments SDK（前金・月額会員のカード登録、3Dセキュア `verifyBuyer`）、Square Terminal API（店頭決済、実際の決済手段・ブランド・手数料を取得）、Square への明細・担当連携。前金金額はサーバーで再計算（`正本はどこか.md`：`saas/checkout.js` の `depositFor` を画面とサーバーが共用）。
- **LINE**: LIFF（店舗ごとの LIFF ID）、LINE ログイン（state 方式）、Messaging API プッシュ（Worker 経由）。
- **Google**: Google Identity Services ログイン（海外・LINE 以外の客向け）。
- **多言語 i18n**: 日本語で描画後に DOM テキストだけ差し替える方式。選択肢の値と保存データは常に日本語。予約 5 言語、precare 5 言語、カウンセリング 5 言語相当（`cs-i18n.js`）。
- **PWA**: サイト全体は `sw.js`／`manifest.json` でオフライン対応。`/booking` 等はプライベートパスとして SW キャッシュ対象外（`sw.js` の `PRIVATE_PATH`）。booking 画面自体の PWA 化は確認できず（要確認）。
- **バーコード／カメラ**: Bluetooth リーダー（キーボード方式、ALT+数字方式の吸収）、BarcodeDetector＋ZXing フォールバック、iPad 背面カメラで JAN・会員QR・社員証QR。
- **音声入力カルテ**: Web Speech API（iPhone Safari 非対応時は文字入力にフォールバック）。
- **アクセシビリティ配慮**: `prefers-reduced-motion` 対応、`:focus-visible`、44px 以上のタップ領域、16px 未満の入力禁止（iOS 拡大防止）など各画面に明記。
- **セキュリティ実装**: 上記 1-9。トークン種別の分離、暗号乱数の確認コード（ドキュメント）、`crypto.randomUUID` による冪等キー、`_headers` の HSTS 等。
- **法令・制度を意識した実装**: 段階式キャンセル料（消費者契約法9条）、ギフト券期限6か月（資金決済法の適用外に収める）、年5日有給取得義務・時間有給上限（労基法39条）、免税リファンド方式（2026-11-01 切替）、特商法表記・請求書番号欄。
- **特許回避の明記**: 隙間枠の自動非表示等（JP7617580 の構成）を実装しない旨をコード内に記載。
- **デプロイ**: GitHub push → Cloudflare Pages 自動デプロイ（正本は seam-public リポジトリ）。Worker は `wrangler deploy`、ロールバック手順あり。

---

## 3. 実装ステータスの判定

| 区分 | 対象 | 根拠 |
|---|---|---|
| **稼働中（本番運用の痕跡あり）** | 予約 Worker と booking 画面群（予約・前金・キャンセル・カウンセリング・カルテ・LINE 会員証・レジ・お客様画面・売上と発注・スタッフ画面） | `正本はどこか.md` に 2026-08-15 の本番デプロイ 4 版（CORS 追加、端末読取制限・暗号乱数、前金再計算、移行措置）とロールバック手順。コード内に「実際に起きた」「2026-08-14 指摘」「オーナー確認 2026-08-01」等、運用中の不具合修正記録が多数。SEAM 銀座の実在籍スタッフ・HPB 実メニューを掲載 |
| **稼働中** | 髪質診断ダッシュボード（D1 集計）、採用応募 API、入場受付（salon.town 連携） | `db/SETUP_DASHBOARD.md`「コード側はデプロイ済み」、`functions/*` |
| **稼働中（ただし公開導線は要確認）** | お客様向けオンライン予約ページ | 画面は完成しているが、公開サイトの予約 CTA は HPB リンクのまま。LINE／Google／Instagram のリンク経由で使われている可能性が高いが、本リポジトリからは確認できない（要確認） |
| **実装済み・設定待ち／店舗により未使用** | 月額会員（「未導入の店舗でも壊れないよう」）、Square ターミナルの本番切替（`setup.html` ⑤本番の切り替え）、担当者必須設定 `require_staff`、写真／音声AI 同意項目（店舗設定でON）、LINE 領収書 ON/OFF | `booking/line.html`, `booking/setup.html`, `booking/shop.html`, `booking/counseling.html` |
| **実装済みだがデモ挙動が残る** | 「詰めのお願い」メッセージ送信（toast「（デモ）」）、LINE 友だち追加遷移、Worker 未設定時の確認メール | `booking/index.html` 2924〜2944, 5744〜5753, 6417 行付近 |
| **構想のみ／将来** | かんざし SaaS 連携（HPB・楽天・minimo への自動書込）、Square Bookings API 双方向同期（チャネル説明に記載あるが実装呼び出しなし）、SyncProvider の差し替え | `booking/index.html`（`SyncProvider.push` は TODO、CH_INFO の status `['dev','将来']`） |
| **構想段階（価格表）** | 機能別の月額プラン（基本 ¥3,980、上限 ¥10,000、追加機能 ¥480〜¥1,480、初期設定 ¥10,000）は管理画面内に「値段の考え方（2026-08-07 オーナー）」として実装。対外公表済みかは要確認 | `booking/index.html` |
| **別製品として稼働（デモ表示）** | salon.town シフト管理は salontown/index.html から「デモです 保存はこの端末の中だけ」として公開。本番モード（Supabase 認証・テナント分離・暗号化）は実装あり、稼働状況は要確認 | `salontown/index.html`, `salontown/salontown-shift.html` |
| **要確認** | Worker の実装内容（本リポジトリに無い）、R2 の実利用範囲、`ARCHITECTURE.md`（参照されるが本リポジトリに無い）、予約経路 salon.town→RPA→サロンボードの現在の稼働率 | `.gitignore`, `正本はどこか.md` |

---

## 4. 対外的に言ってよさそうな「強み」候補（コード・ページに書かれていることに基づく）

1. **予約から会計・カルテ・再来までがひとつの台帳**：予約（Web／LINE／HPB取込）→来店→カウンセリング→施術カルテ→会計（Square）→次回予約提案→翌朝のお便りが同じ顧客データに紐付く（`booking/index.html`, `staff-spa.html`, `shop.html`）。
2. **前金・キャンセル料の設計が「守れる」形**：Square による事前決済（3Dセキュア、カード非保持）、金額はサーバーで再計算、予約失敗時の自動返金、段階式キャンセル料（消費者契約法を意識）、ノーショー履歴客への前金必須（`index.html`, `正本はどこか.md`）。
3. **インバウンド対応が予約〜会計〜キャンセルまで一貫**：予約 5 言語、来店前ヒアリング 5 言語、同意書多言語（保存は日本語）、海外客向け前金率設定、免税（リファンド方式対応）、返金案内の日英併記、お持ち帰りの1枚（`index.html`, `precare.html`, `cs-i18n.js`, `pc-i18n.js`, `shop.html`, `refund.html`, `keepsake.html`）。
4. **来店前に「今日のご希望」を組み立てる体験**：問診票ではなく強さ・部位・香り・音を選ぶだけで設計図ができ、担当の画面にアレルギー最優先で届く。2回目以降は差分だけ（`precare.html`, `staff-spa.html`）。
5. **LINE を軸にした自社会員基盤**：LINE 会員証（QR／バーコード）、ランク・ポイント、月額会員の休会・解約を2タップ、回数券の1回を贈れる、会計後の QR で LINE 連携→領収・リマインド（`line.html`, `index.html`）。
6. **店頭 iPad レジとお客様画面の作り込み**：バーコード／カメラ読取、支払方法をお客様自身が選ぶ、値引き販売の返品不可同意を記録、二重請求防止、レジ締め・免税申請までワンフロー（`shop.html`, `display.html`）。
7. **権限分離と個人情報最小化**：お客様が触る端末には限定トークンのみ、スタッフは個人トークン、顧客モードで管理 DOM 削除・PII 非保持、会員番号だけでは名簿が引けない設計、診断集計は PII ゼロ（`counseling.html`, `staff-spa.html`, `index.html`, `db/SETUP_DASHBOARD.md`）。
8. **HotPepper 併用を前提にした現実的な連携**：予約メール取込、要ブロック運用、サロンボードへの RPA 書込と同期監視、HPB と同じ刻み・掲載名に合わせる制約をコードで担保（`index.html`, `report.html`）。※「二重予約ゼロ」等の断定は避ける（手動ブロック運用が残るため）。

補足：salontown/index.html に掲載の実績数値（90サロン、5万人会員、年間EC 3億円、対面会員獲得率 90%、菊池 3,000+品目／発注手間 -45%）はランディングページ上の記載であり、根拠データは本リポジトリで確認できない（要確認）。

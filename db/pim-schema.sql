-- SEAM 商品マスタ統一（PIM）用 D1 スキーマ
-- 投入: Cloudflare ダッシュボード D1 コンソールに貼付 OR
--       npx wrangler d1 execute seam-db --remote --file=db/pim-schema.sql
--
-- 目的: メーカーごとにバラバラな形式で届く商品データを、
--       「JAN・商品名・価格・税込/税抜・内容量・画像(最大5枚, webp)」の1つの形に揃えて保存する。
--       ここに入っている形＝出力される形。入口が何であれ、出口は必ず同じ。
--
-- 1ディーラー = 1アカウント（pim_accounts）。商品・画像・注意・取り込み履歴はすべて account_id で分かれる。
-- ★ テーブルは API の初回アクセス時にも自動で作られる（functions/api/pim/_lib.js ensureSchema）。

-- ▼ ディーラーアカウント（スタッフは同じ ID を共用。パスワード変更で token_version が進み、全端末のログインが無効になる）
CREATE TABLE IF NOT EXISTS pim_accounts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id       TEXT NOT NULL UNIQUE,      -- 英数字（小文字に揃える）
  name           TEXT NOT NULL,             -- ディーラー名
  pass_hash      TEXT NOT NULL,             -- pbkdf2$iter$salt$hash（平文は保存しない）
  role           TEXT NOT NULL DEFAULT 'dealer',
  active         INTEGER NOT NULL DEFAULT 1,-- 0=停止（ログイン不可・トークン無効）
  token_version  INTEGER NOT NULL DEFAULT 1,-- パスワード変更/停止/全端末ログアウトで +1
  note           TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  pass_changed_at TEXT,
  last_login_at  TEXT,
  api_key        TEXT                       -- EC 連携用の読み取り専用キー（seam_…）。再発行で差し替え、NULL で無効
);
-- ▼ ログイン失敗の記録（10回で15分ロック）
CREATE TABLE IF NOT EXISTS pim_login_fail (login_id TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 0, last_at TEXT);

-- ▼ 商品（(account_id, jan) が主キー。JANが被るものはこの表に入れず pim_issues に積む）
CREATE TABLE IF NOT EXISTS pim_products (
  account_id     INTEGER NOT NULL,          -- どのディーラーの商品か
  jan            TEXT NOT NULL,             -- 13桁(JAN/EAN-13)・8桁(JAN-8)。12桁UPCは先頭0を足して13桁に揃える
  jan_valid      INTEGER NOT NULL DEFAULT 1,-- チェックデジットが合っていれば1（合わなくても登録は許す・注意扱い）
  name           TEXT NOT NULL,             -- 商品名（全角空白→半角・前後空白除去・連続空白を1つに）
  price          INTEGER,                   -- 入力された価格（円・整数）
  tax_included   INTEGER NOT NULL DEFAULT 0,-- price が税込なら1・税抜なら0
  tax_rate       INTEGER NOT NULL DEFAULT 10,-- 消費税率(%)
  price_ex       INTEGER,                   -- 税抜価格（price から算出）
  price_in       INTEGER,                   -- 税込価格（price から算出・端数切り捨て）
  retail_price   INTEGER,                   -- 上代（メーカー希望小売・税抜）任意
  cost_price     INTEGER,                   -- 仕入価格 任意
  amount         REAL,                      -- 内容量の数値（250 / 1000 など）
  unit           TEXT,                      -- 内容量の単位（g / ml / L / kg / 枚 / 本 / 個 / 包 / 粒 / 袋）
  maker          TEXT,                      -- メーカー名
  brand          TEXT,                      -- ブランド／シリーズ
  category       TEXT,                      -- カテゴリ（大＞中＞小 を「 > 」で結合）
  description    TEXT,                      -- 商品説明（HTMLタグ除去）
  sku            TEXT,                      -- 送り元の商品コード（任意・照合用）
  source         TEXT,                      -- 取り込み元（ファイル名やメーカー名）
  import_id      INTEGER,                   -- どの取り込みで入ったか
  image_count    INTEGER NOT NULL DEFAULT 0,-- 登録済み画像枚数（pim_images と同期）
  created_at     TEXT NOT NULL,             -- ISO8601
  updated_at     TEXT NOT NULL,             -- 楽観ロックの基準（編集時に「見ていた時刻」と違えば 409）
  updated_by     TEXT,                      -- 最後に触った担当者名（複数人同時登録の記録）
  raw            TEXT,                      -- 取り込んだ元CSVの1行（見出し→値の JSON）。「元CSVの形＋画像」出力に使う
  PRIMARY KEY (account_id, jan)
);
CREATE INDEX IF NOT EXISTS idx_pim_products_name  ON pim_products(account_id, name);
CREATE INDEX IF NOT EXISTS idx_pim_products_maker ON pim_products(account_id, maker);
CREATE INDEX IF NOT EXISTS idx_pim_products_imgs  ON pim_products(account_id, image_count);
CREATE INDEX IF NOT EXISTS idx_pim_products_upd   ON pim_products(account_id, updated_at);

-- ▼ 画像（1商品につき slot 1〜5・保存形式は必ず webp・実体は R2 "PRODUCT_IMAGES" に products/<account_id>/<jan>/<slot>.webp）
CREATE TABLE IF NOT EXISTS pim_images (
  account_id     INTEGER NOT NULL,
  jan            TEXT NOT NULL,
  slot           INTEGER NOT NULL,          -- 1..5（1がメイン画像）
  key            TEXT NOT NULL,             -- R2 オブジェクトキー
  bytes          INTEGER,                   -- 保存サイズ
  width          INTEGER,
  height         INTEGER,
  original_name  TEXT,                      -- 元ファイル名（jpg/png/heic など何で来たかの記録）
  original_type  TEXT,                      -- 元MIME
  created_at     TEXT NOT NULL,
  created_by     TEXT,                      -- 登録した担当者名
  review         TEXT,                      -- 検品: ok / retake / NULL(未検品)。撮り直すと NULL に戻る
  review_note    TEXT,                      -- 撮り直しの理由（スマホに表示）
  reviewed_by    TEXT,
  reviewed_at    TEXT,
  PRIMARY KEY (account_id, jan, slot)       -- ★この主キーが「同時登録の取り合い」を裁く（slot=auto は INSERT が通った人の番号）
);

-- ▼ 取り込み履歴（CSV 1ファイル＝1行）
CREATE TABLE IF NOT EXISTS pim_imports (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL,
  ts             TEXT NOT NULL,
  filename       TEXT,
  source         TEXT,                      -- メーカー名など（画面で入力）
  mapping        TEXT,                      -- 列の対応（JSON）
  headers        TEXT,                      -- 元CSVの見出し（JSON 配列）。「元CSVの形＋画像」出力の列順
  kind           TEXT,                      -- normal（通常）/ update（更新取り込み・列が少ないので出力の見出しには使わない）
  total          INTEGER NOT NULL DEFAULT 0,-- 読み込んだ行数
  inserted       INTEGER NOT NULL DEFAULT 0,
  updated        INTEGER NOT NULL DEFAULT 0,
  skipped        INTEGER NOT NULL DEFAULT 0,-- JAN重複などで保留にした行数
  invalid        INTEGER NOT NULL DEFAULT 0 -- JAN無し・価格無しなど登録できなかった行数
);

-- ▼ 注意（JAN重複など。登録せずにここへ積み、画面で「どちらを残すか」を決める）
CREATE TABLE IF NOT EXISTS pim_issues (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id     INTEGER NOT NULL,
  ts             TEXT NOT NULL,
  import_id      INTEGER,
  kind           TEXT NOT NULL,             -- dup_db（登録済みと重複）/ dup_file（同じファイル内で重複）/ invalid_jan / missing
  jan            TEXT,
  message        TEXT NOT NULL,             -- 人が読む説明「〇〇 と △△ が同じJANです」
  existing       TEXT,                      -- 登録済み側（JSON・dup_db のとき）
  incoming       TEXT,                      -- 届いた側（JSON。dup_file のときは配列）
  status         TEXT NOT NULL DEFAULT 'open', -- open / resolved
  resolution     TEXT,                      -- keep_existing / keep_incoming / keep_index:N / dismissed
  resolved_at    TEXT,
  resolved_by    TEXT                       -- 解決した担当者名（2人が同時に押しても勝った1人だけ記録される）
);
CREATE INDEX IF NOT EXISTS idx_pim_imports_acct  ON pim_imports(account_id, id);
CREATE INDEX IF NOT EXISTS idx_pim_issues_status ON pim_issues(account_id, status, ts);
CREATE INDEX IF NOT EXISTS idx_pim_issues_jan    ON pim_issues(account_id, jan);

-- ▼ 画像の実体（R2 "PRODUCT_IMAGES" が未設定のときだけ使う暫定置き場。読みは R2 → ここ の順）
CREATE TABLE IF NOT EXISTS pim_blobs (key TEXT PRIMARY KEY, data BLOB NOT NULL, bytes INTEGER, created_at TEXT NOT NULL);

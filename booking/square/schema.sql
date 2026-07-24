-- SEAM 予約 D1 スキーマ
CREATE TABLE IF NOT EXISTS reservations (
  id           TEXT PRIMARY KEY,
  date         TEXT NOT NULL,          -- YYYY-MM-DD
  staff_id     TEXT NOT NULL,
  start        INTEGER NOT NULL,       -- 分（10:00=600）
  end          INTEGER NOT NULL,
  menu_id      TEXT,
  name         TEXT,
  phone        TEXT DEFAULT '',
  email        TEXT DEFAULT '',
  note         TEXT DEFAULT '',
  channel      TEXT DEFAULT 'own',     -- own/line/google/instagram/square/hpb
  status       TEXT DEFAULT 'booked',  -- booked/done/cancelled/noshow
  hpb_blocked  INTEGER DEFAULT 0,      -- HPB手動ブロック済みか
  deposit      INTEGER DEFAULT 0,
  line_user_id TEXT DEFAULT '',        -- LINE push用
  salon_id     TEXT DEFAULT '',        -- salon.town(CUEPON)予約ID(同期時に対応づけ)
  created_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_res_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_res_staff_date ON reservations(staff_id, date);

-- 既存DBに salon_id 列を追加する場合(初回のみ・列が既にあればエラーになるが無視でOK):
--   npx wrangler d1 execute seam-booking --remote --command "ALTER TABLE reservations ADD COLUMN salon_id TEXT DEFAULT ''"

-- ===== レジ・会計（お会計・レジ締め）=====
-- お会計（技術＋店販＋割引・支払方法）。id はクライアント生成。予約に紐づく場合 resv_id。
CREATE TABLE IF NOT EXISTS checkouts (
  id           TEXT PRIMARY KEY,
  resv_id      TEXT DEFAULT '',        -- 紐づく予約ID（予約なし会計は空）
  date         TEXT NOT NULL,          -- YYYY-MM-DD（営業日）
  staff_id     TEXT DEFAULT '',
  customer     TEXT DEFAULT '',
  tech         INTEGER DEFAULT 0,      -- 技術（施術）売上
  retail       INTEGER DEFAULT 0,      -- 店販売上
  retail_items TEXT DEFAULT '[]',      -- JSON [{name,price}]
  discount     INTEGER DEFAULT 0,
  total        INTEGER DEFAULT 0,      -- 税込合計
  method       TEXT DEFAULT 'cash',    -- cash/card/qr
  nominated    INTEGER DEFAULT 0,      -- 指名=1 / フリー=0
  created_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_co_date ON checkouts(date);

-- レジ締め（1営業日1件・date が主キー）
CREATE TABLE IF NOT EXISTS settlements (
  date          TEXT PRIMARY KEY,      -- YYYY-MM-DD
  float         INTEGER DEFAULT 0,     -- 釣銭準備金
  cash_sales    INTEGER DEFAULT 0,
  expected_cash INTEGER DEFAULT 0,     -- 理論残高（float+cash_sales）
  counted_cash  INTEGER DEFAULT 0,     -- 実際に数えた現金
  diff          INTEGER DEFAULT 0,     -- 過不足（counted-expected）
  card          INTEGER DEFAULT 0,
  qr            INTEGER DEFAULT 0,
  total         INTEGER DEFAULT 0,
  count         INTEGER DEFAULT 0,     -- 会計件数
  memo          TEXT DEFAULT '',
  closed_at     TEXT
);

-- 設定（key/value）。cashFloat（釣銭準備金の既定値）などを端末間で共有。
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

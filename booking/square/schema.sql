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
  created_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_res_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_res_staff_date ON reservations(staff_id, date);

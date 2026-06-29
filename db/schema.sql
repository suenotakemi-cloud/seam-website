-- SEAM 診断イベント蓄積用 D1 スキーマ（個人情報なし・集計専用）
-- 投入: Cloudflare ダッシュボード D1 コンソールに貼付 OR
--       npx wrangler d1 execute seam-db --remote --file=db/schema.sql
CREATE TABLE IF NOT EXISTS events (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     INTEGER NOT NULL,        -- 受信時刻(unix ms)
  name   TEXT    NOT NULL,        -- finder_start / finder_complete / finder_cta
  path   TEXT,                    -- ページパス
  type   TEXT,                    -- 27髪格コード(例 NNW)
  advice TEXT,                    -- 主訴/adviceKey(scalp/frizz/volume/damage/dry/color)
  tier   INTEGER,                 -- ダメージTier 1-3
  mode   TEXT,                    -- 診断モード a / b
  gender TEXT,                    -- 性別
  target TEXT,                    -- finder_cta: reserve_hpb / shop / product 等
  label  TEXT,                    -- finder_cta 文脈: 店舗id / ブランド / 流入元
  meta   TEXT                     -- 予備(JSON: concerns[]/brands[] 等の拡張用)
);
CREATE INDEX IF NOT EXISTS idx_events_name_ts ON events(name, ts);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);

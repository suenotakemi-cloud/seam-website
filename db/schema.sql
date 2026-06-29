-- SEAM 診断イベント蓄積用 D1 スキーマ（個人情報なし・集計専用）
-- 投入: Cloudflare ダッシュボード D1 コンソールに貼付 OR
--       npx wrangler d1 execute seam-db --remote --file=db/schema.sql
--
-- ▼ まだテーブルを作っていない場合 = この CREATE をそのまま実行（流入カラム入りの最新版）
CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           INTEGER NOT NULL,   -- 受信時刻(unix ms)
  name         TEXT    NOT NULL,   -- finder_start / finder_complete / finder_cta
  path         TEXT,               -- ページパス
  type         TEXT,               -- 27髪格コード(例 NNW)
  advice       TEXT,               -- 主訴/adviceKey(scalp/frizz/volume/damage/dry/color/heat/calm)
  tier         INTEGER,            -- ダメージTier 1-3
  mode         TEXT,               -- 診断モード a / b
  gender       TEXT,               -- 性別
  target       TEXT,               -- finder_cta: reserve_hpb / shop / product 等
  label        TEXT,               -- finder_cta 文脈: 店舗id / ブランド / 流入元
  ref          TEXT,               -- 流入チャネル: google/instagram/x/line/direct/internal…
  utm_source   TEXT,               -- 広告/投稿タグ(自社で付与)
  utm_campaign TEXT,               -- キャンペーン名(自社で付与)
  device       TEXT,               -- mobile / desktop
  country      TEXT,               -- 国コード(CF付与・国レベル/非個人情報)
  landing      TEXT,               -- 初回入口パス
  meta         TEXT                -- 予備(JSON: utm_medium/lang/concerns[] 等)
);
CREATE INDEX IF NOT EXISTS idx_events_name_ts ON events(name, ts);
CREATE INDEX IF NOT EXISTS idx_events_type    ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_ts      ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_ref     ON events(ref);

-- ▼ すでに（流入カラム無しの）旧テーブルを作ってしまった場合 = 下の6行を1回だけ実行
--   ※ 新規 CREATE を実行済みなら下は不要（実行するとエラーになるだけで無害）
-- ALTER TABLE events ADD COLUMN ref          TEXT;
-- ALTER TABLE events ADD COLUMN utm_source   TEXT;
-- ALTER TABLE events ADD COLUMN utm_campaign TEXT;
-- ALTER TABLE events ADD COLUMN device       TEXT;
-- ALTER TABLE events ADD COLUMN country      TEXT;
-- ALTER TABLE events ADD COLUMN landing      TEXT;
-- CREATE INDEX IF NOT EXISTS idx_events_ref ON events(ref);

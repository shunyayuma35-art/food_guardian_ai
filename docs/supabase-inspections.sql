-- ============================================================
-- FoodEye 検査記録テーブル（inspections）
-- 実行環境: Supabase ダッシュボード → SQL Editor
-- 対象: 金属探知機・X線検査の始業/終業確認記録
-- ============================================================

-- ── 1. テーブル作成 ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inspections (
  -- 主キー（フロント側で uuidv4 を生成）
  id TEXT PRIMARY KEY,

  -- 絞り込み用に取り出したキー列
  created_by      TEXT        NOT NULL,           -- Firebase の user.uid
  inspection_date TEXT        NOT NULL,           -- YYYY-MM-DD
  device_type     TEXT        NOT NULL,           -- 'metal_detector' | 'xray'

  -- レコード本体（InspectionRecord 全体を JSON で保持）
  data            JSONB       NOT NULL,

  -- タイムスタンプ
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. インデックス（よく使うフィルタを高速化） ──────────────

CREATE INDEX IF NOT EXISTS idx_inspections_created_by
  ON public.inspections (created_by);

CREATE INDEX IF NOT EXISTS idx_inspections_date
  ON public.inspections (inspection_date);

CREATE INDEX IF NOT EXISTS idx_inspections_device_type
  ON public.inspections (device_type);

-- ── 3. 行レベルセキュリティ（RLS） ──────────────────────────
--
-- アプリのAPIルートはサービスロールキー（SUPABASE_SERVICE_ROLE_KEY）で
-- 接続するため、RLS を自動的にバイパスする。
-- ブラウザから anon キーで直接アクセスすることをブロックするために
-- RLS を有効化する（ポリシーなし = 全拒否が Supabase のデフォルト）。

ALTER TABLE public.inspections ENABLE ROW LEVEL SECURITY;

-- ポリシーを一切定義しないことで:
--   - サービスロールキー（APIルート）: アクセス可能
--   - anon キー（ブラウザ直接）: 全拒否
--
-- 現在のポリシー確認:
--   SELECT * FROM pg_policies WHERE tablename = 'inspections';

-- ── 4. 動作確認クエリ（実行後に確認する） ───────────────────

-- テーブルが作成されたか確認
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' AND table_name = 'inspections';

-- RLS が有効か確認
-- SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname = 'inspections';

-- データ件数確認（最初は 0）
-- SELECT COUNT(*) FROM public.inspections;

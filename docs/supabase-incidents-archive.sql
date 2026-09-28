-- ============================================================
-- incidents テーブルへのカラム追加
-- FoodEye: アーカイブ機能 + 言語バッジ対応
-- 実行方法: Supabase ダッシュボード > SQL Editor > このファイルを貼り付けて RUN
-- ============================================================

-- アーカイブ用カラム（NULL = 通常表示、NOT NULL = アーカイブ済み）
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS archived_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_by     TEXT,
  ADD COLUMN IF NOT EXISTS archive_reason  TEXT;

-- 保存時の言語（言語バッジ表示用）
ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS lang TEXT DEFAULT 'ja';

-- カラムのコメント（ドキュメント用）
COMMENT ON COLUMN incidents.archived_at     IS 'NULL = 通常表示。NOT NULL = アーカイブ済み。HACCPの記録保持のためデータは削除しない。';
COMMENT ON COLUMN incidents.archived_by     IS 'アーカイブを実施した担当者名。';
COMMENT ON COLUMN incidents.archive_reason  IS 'アーカイブ理由（HACCP記録保持方針に基づき必須）。';
COMMENT ON COLUMN incidents.lang            IS '保存時の言語コード: ja または en。';

-- ============================================================
-- RLS（Row Level Security）について
-- サービスロールキー（SUPABASE_SERVICE_ROLE_KEY）はRLSをバイパスするため、
-- サーバーサイドのAPIルートからの操作には追加のRLS設定は不要です。
-- ============================================================

-- 確認用クエリ（実行後にカラムが追加されているか確認）
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'incidents'
  AND column_name IN ('archived_at', 'archived_by', 'archive_reason', 'lang')
ORDER BY column_name;

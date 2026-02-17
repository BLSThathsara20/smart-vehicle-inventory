-- Fix get_space_usage: handle storage access errors and null metadata
CREATE OR REPLACE FUNCTION public.get_space_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  db_bytes bigint;
  storage_bytes bigint := 0;
  buckets_json jsonb := '[]'::jsonb;
  rec record;
BEGIN
  -- Database size (always works)
  SELECT pg_database_size(current_database()) INTO db_bytes;

  -- Storage: use loop to avoid aggregate issues, handle errors
  BEGIN
    FOR rec IN
      SELECT
        bucket_id,
        COALESCE(SUM(
          CASE
            WHEN metadata->>'size' ~ '^\d+$' THEN (metadata->>'size')::bigint
            ELSE 0
          END
        ), 0) AS size_bytes
      FROM storage.objects
      GROUP BY bucket_id
      ORDER BY 2 DESC
    LOOP
      storage_bytes := storage_bytes + rec.size_bytes;
      buckets_json := buckets_json || jsonb_build_object(
        'bucket_id', rec.bucket_id,
        'size_bytes', rec.size_bytes,
        'size_pretty', pg_size_pretty(rec.size_bytes)
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    storage_bytes := 0;
    buckets_json := '[]'::jsonb;
    -- Continue with db_size only
  END;

  RETURN jsonb_build_object(
    'db_size_bytes', db_bytes,
    'db_size_pretty', pg_size_pretty(db_bytes),
    'storage_size_bytes', storage_bytes,
    'storage_size_pretty', pg_size_pretty(storage_bytes),
    'buckets', buckets_json
  );
END;
$$;

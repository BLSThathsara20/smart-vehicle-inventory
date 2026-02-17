-- Function to get database and storage usage (for admin Space page)
-- Run as postgres to access pg_database and storage.objects
CREATE OR REPLACE FUNCTION public.get_space_usage()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  db_bytes bigint;
  storage_bytes bigint;
  buckets_json jsonb;
BEGIN
  -- Database size
  SELECT pg_database_size(current_database()) INTO db_bytes;

  -- Storage: total and per-bucket
  SELECT
    COALESCE(SUM((metadata->>'size')::bigint), 0),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'bucket_id', bucket_id,
          'size_bytes', size_bytes,
          'size_pretty', pg_size_pretty(size_bytes)
        ) ORDER BY size_bytes DESC
      ),
      '[]'::jsonb
    )
  INTO storage_bytes, buckets_json
  FROM (
    SELECT
      bucket_id,
      COALESCE(SUM((metadata->>'size')::bigint), 0) AS size_bytes
    FROM storage.objects
    GROUP BY bucket_id
  ) sub;

  RETURN jsonb_build_object(
    'db_size_bytes', db_bytes,
    'db_size_pretty', pg_size_pretty(db_bytes),
    'storage_size_bytes', COALESCE(storage_bytes, 0),
    'storage_size_pretty', pg_size_pretty(COALESCE(storage_bytes, 0)),
    'buckets', COALESCE(buckets_json, '[]'::jsonb)
  );
END;
$$;

-- Allow authenticated users and anon to call (read-only, safe)
GRANT EXECUTE ON FUNCTION public.get_space_usage() TO anon;
GRANT EXECUTE ON FUNCTION public.get_space_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_space_usage() TO service_role;

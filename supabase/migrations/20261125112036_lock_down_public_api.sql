-- Keep public Supabase Data API roles out of department data until a verified
-- identity and role/ownership model is implemented. The Streamlit server uses
-- its private PostgreSQL connection and is not granted access by these policies.
DO $$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT c.relname
    FROM pg_class AS c
    JOIN pg_namespace AS n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
  LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
      'deny_api_until_auth_model',
      target_table.relname
    );
  END LOOP;
END
$$;

CREATE INDEX IF NOT EXISTS attendance_student_id_idx
  ON public.attendance (student_id);

CREATE INDEX IF NOT EXISTS personal_tasks_user_id_idx
  ON public.personal_tasks (user_id);
-- Core data model for the Next.js department portal.
-- Existing Streamlit tables are kept intact while the new app is introduced.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA private TO authenticated;

CREATE TABLE public.department_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  registration_no text UNIQUE,
  full_name text NOT NULL DEFAULT 'Pending account',
  role text NOT NULL DEFAULT 'student'
    CHECK (role IN ('student', 'cr', 'gr', 'faculty', 'admin')),
  account_status text NOT NULL DEFAULT 'pending'
    CHECK (account_status IN ('pending', 'active', 'suspended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.academic_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  CHECK (ends_on >= starts_on)
);

CREATE TABLE public.department_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_code text NOT NULL UNIQUE,
  title text NOT NULL,
  credit_hours numeric(3,1) NOT NULL CHECK (credit_hours > 0 AND credit_hours <= 6),
  is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public.course_offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.department_courses (id) ON DELETE RESTRICT,
  term_id uuid NOT NULL REFERENCES public.academic_terms (id) ON DELETE RESTRICT,
  section_name text NOT NULL,
  faculty_id uuid REFERENCES public.department_profiles (id) ON DELETE SET NULL,
  cr_id uuid REFERENCES public.department_profiles (id) ON DELETE SET NULL,
  gr_id uuid REFERENCES public.department_profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_id, term_id, section_name)
);

CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.department_profiles (id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (course_offering_id, student_id)
);

CREATE TABLE public.timetable_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings (id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL,
  room text NOT NULL,
  CHECK (ends_at > starts_at)
);

CREATE TABLE public.class_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings (id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT (now() AT TIME ZONE 'Asia/Karachi')::date,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.department_profiles (id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE TABLE public.class_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.class_sessions (id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.department_profiles (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent', 'late', 'excused')),
  marked_by uuid NOT NULL REFERENCES public.department_profiles (id),
  marked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_id)
);

CREATE TABLE public.department_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  course_offering_id uuid REFERENCES public.course_offerings (id) ON DELETE CASCADE,
  posted_by uuid NOT NULL REFERENCES public.department_profiles (id),
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

CREATE TABLE public.department_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  resource_type text NOT NULL,
  resource_url text NOT NULL,
  course_offering_id uuid REFERENCES public.course_offerings (id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.department_profiles (id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX course_offerings_term_idx ON public.course_offerings (term_id);
CREATE INDEX course_offerings_faculty_idx ON public.course_offerings (faculty_id);
CREATE INDEX course_offerings_cr_idx ON public.course_offerings (cr_id);
CREATE INDEX course_offerings_gr_idx ON public.course_offerings (gr_id);
CREATE INDEX course_enrollments_student_idx ON public.course_enrollments (student_id);
CREATE INDEX timetable_slots_offering_idx ON public.timetable_slots (course_offering_id);
CREATE INDEX class_sessions_offering_date_idx ON public.class_sessions (course_offering_id, session_date DESC);
CREATE INDEX class_attendance_student_idx ON public.class_attendance (student_id, marked_at DESC);
CREATE INDEX department_announcements_published_idx ON public.department_announcements (published_at DESC);
CREATE INDEX department_resources_offering_idx ON public.department_resources (course_offering_id);

CREATE TABLE private.class_attendance_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attendance_id uuid NOT NULL,
  session_id uuid NOT NULL,
  student_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  old_status text,
  new_status text,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON private.class_attendance_audit FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION private.audit_class_attendance_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO private.class_attendance_audit
      (attendance_id, session_id, student_id, action, new_status, changed_by)
    VALUES (NEW.id, NEW.session_id, NEW.student_id, 'insert', NEW.status, (SELECT auth.uid()));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO private.class_attendance_audit
      (attendance_id, session_id, student_id, action, old_status, new_status, changed_by)
    VALUES (NEW.id, NEW.session_id, NEW.student_id, 'update', OLD.status, NEW.status, (SELECT auth.uid()));
    RETURN NEW;
  ELSE
    INSERT INTO private.class_attendance_audit
      (attendance_id, session_id, student_id, action, old_status, changed_by)
    VALUES (OLD.id, OLD.session_id, OLD.student_id, 'delete', OLD.status, (SELECT auth.uid()));
    RETURN OLD;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION private.audit_class_attendance_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER class_attendance_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.class_attendance
  FOR EACH ROW EXECUTE FUNCTION private.audit_class_attendance_change();

CREATE OR REPLACE FUNCTION private.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.role
  FROM public.department_profiles AS p
  WHERE p.id = (SELECT auth.uid())
    AND p.account_status = 'active'
$$;

CREATE OR REPLACE FUNCTION private.is_active_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.department_profiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND p.account_status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION private.can_manage_offering(target_offering uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.is_active_member() AND (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.course_offerings AS o
    WHERE o.id = target_offering
      AND (
        o.faculty_id = (SELECT auth.uid())
        OR o.cr_id = (SELECT auth.uid())
        OR o.gr_id = (SELECT auth.uid())
        OR private.current_role() = 'admin'
      )
  )
$$;

CREATE OR REPLACE FUNCTION private.is_enrolled(target_offering uuid, target_student uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND (
    target_student = (SELECT auth.uid())
    OR private.can_manage_offering(target_offering)
  ) AND EXISTS (
    SELECT 1 FROM public.course_enrollments AS e
    WHERE e.course_offering_id = target_offering
      AND e.student_id = target_student
  )
$$;

CREATE OR REPLACE FUNCTION private.can_view_profile(target_profile uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT target_profile = (SELECT auth.uid())
    OR private.current_role() = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.course_enrollments AS e
      WHERE e.student_id = target_profile
        AND private.can_manage_offering(e.course_offering_id)
    )
$$;

CREATE OR REPLACE FUNCTION private.bootstrap_department_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.department_profiles (id, full_name, role, account_status)
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''), 'Pending account'),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.current_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_active_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_offering(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_enrolled(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_view_profile(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.bootstrap_department_profile() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_active_member() TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_offering(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_enrolled(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(uuid) TO authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created_department_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_department_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION private.bootstrap_department_profile();

ALTER TABLE public.department_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_resources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.department_profiles, public.academic_terms, public.department_courses,
  public.course_offerings, public.course_enrollments, public.timetable_slots,
  public.class_sessions, public.class_attendance, public.department_announcements,
  public.department_resources FROM anon;
GRANT SELECT, UPDATE ON public.department_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academic_terms, public.department_courses,
  public.course_offerings, public.course_enrollments, public.timetable_slots,
  public.class_sessions, public.class_attendance, public.department_announcements,
  public.department_resources TO authenticated;

CREATE POLICY profile_read_self_or_course_staff ON public.department_profiles
  FOR SELECT TO authenticated
  USING (private.can_view_profile(id));
CREATE POLICY profile_update_admin_only ON public.department_profiles
  FOR UPDATE TO authenticated
  USING (private.current_role() = 'admin')
  WITH CHECK (private.current_role() = 'admin');

CREATE POLICY terms_read_active_members ON public.academic_terms
  FOR SELECT TO authenticated USING (private.is_active_member());
CREATE POLICY terms_admin_manage ON public.academic_terms
  FOR ALL TO authenticated
  USING (private.current_role() = 'admin')
  WITH CHECK (private.current_role() = 'admin');

CREATE POLICY courses_read_active_members ON public.department_courses
  FOR SELECT TO authenticated USING (private.is_active_member());
CREATE POLICY courses_admin_manage ON public.department_courses
  FOR ALL TO authenticated
  USING (private.current_role() = 'admin')
  WITH CHECK (private.current_role() = 'admin');

CREATE POLICY offerings_read_assigned_members ON public.course_offerings
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (private.can_manage_offering(id) OR private.is_enrolled(id, (SELECT auth.uid()))
      OR private.current_role() = 'admin')
  );
CREATE POLICY offerings_admin_manage ON public.course_offerings
  FOR ALL TO authenticated
  USING (private.current_role() = 'admin')
  WITH CHECK (private.current_role() = 'admin');

CREATE POLICY enrollments_read_self_or_course_staff ON public.course_enrollments
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (student_id = (SELECT auth.uid()) OR private.can_manage_offering(course_offering_id)
      OR private.current_role() = 'admin')
  );
CREATE POLICY enrollments_admin_manage ON public.course_enrollments
  FOR ALL TO authenticated
  USING (private.current_role() = 'admin')
  WITH CHECK (private.current_role() = 'admin');

CREATE POLICY timetable_read_assigned_members ON public.timetable_slots
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (private.can_manage_offering(course_offering_id)
      OR private.is_enrolled(course_offering_id, (SELECT auth.uid()))
      OR private.current_role() = 'admin')
  );
CREATE POLICY timetable_course_staff_manage ON public.timetable_slots
  FOR ALL TO authenticated
  USING (private.can_manage_offering(course_offering_id) OR private.current_role() = 'admin')
  WITH CHECK (private.can_manage_offering(course_offering_id) OR private.current_role() = 'admin');

CREATE POLICY sessions_read_assigned_members ON public.class_sessions
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (private.can_manage_offering(course_offering_id)
      OR private.is_enrolled(course_offering_id, (SELECT auth.uid()))
      OR private.current_role() = 'admin')
  );
CREATE POLICY sessions_course_staff_manage ON public.class_sessions
  FOR ALL TO authenticated
  USING (private.can_manage_offering(course_offering_id) OR private.current_role() = 'admin')
  WITH CHECK (
    (private.can_manage_offering(course_offering_id) OR private.current_role() = 'admin')
    AND created_by = (SELECT auth.uid())
  );

CREATE POLICY attendance_read_self_or_course_staff ON public.class_attendance
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (
      student_id = (SELECT auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.class_sessions AS s
        WHERE s.id = session_id AND private.can_manage_offering(s.course_offering_id)
      )
      OR private.current_role() = 'admin'
    )
  );
CREATE POLICY attendance_course_staff_manage ON public.class_attendance
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_sessions AS s
      WHERE s.id = session_id AND private.can_manage_offering(s.course_offering_id)
    ) OR private.current_role() = 'admin'
  )
  WITH CHECK (
    marked_by = (SELECT auth.uid())
    AND (
      private.current_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.class_sessions AS s
        WHERE s.id = session_id AND private.can_manage_offering(s.course_offering_id)
      )
    )
    AND private.is_enrolled(
      (SELECT s.course_offering_id FROM public.class_sessions AS s WHERE s.id = session_id),
      student_id
    )
  );

CREATE POLICY announcements_read_active_members ON public.department_announcements
  FOR SELECT TO authenticated
  USING (private.is_active_member() AND (expires_at IS NULL OR expires_at > now()));
CREATE POLICY announcements_staff_manage ON public.department_announcements
  FOR ALL TO authenticated
  USING (
    private.current_role() = 'admin'
    OR (
      private.current_role() IN ('faculty', 'cr', 'gr')
      AND course_offering_id IS NOT NULL
      AND private.can_manage_offering(course_offering_id)
    )
  )
  WITH CHECK (
    posted_by = (SELECT auth.uid())
    AND (
      private.current_role() = 'admin'
      OR (
        private.current_role() IN ('faculty', 'cr', 'gr')
        AND course_offering_id IS NOT NULL
        AND private.can_manage_offering(course_offering_id)
      )
    )
  );

CREATE POLICY resources_read_active_members ON public.department_resources
  FOR SELECT TO authenticated USING (private.is_active_member());
CREATE POLICY resources_staff_manage ON public.department_resources
  FOR ALL TO authenticated
  USING (
    private.current_role() = 'admin'
    OR (
      private.current_role() IN ('faculty', 'cr', 'gr')
      AND course_offering_id IS NOT NULL
      AND private.can_manage_offering(course_offering_id)
    )
  )
  WITH CHECK (
    uploaded_by = (SELECT auth.uid())
    AND (
      private.current_role() = 'admin'
      OR (
        private.current_role() IN ('faculty', 'cr', 'gr')
        AND course_offering_id IS NOT NULL
        AND private.can_manage_offering(course_offering_id)
      )
    )
  );

-- Keep legacy Streamlit tables closed to the public API. In particular, the
-- old users table contains password hashes and is not part of this app model.

COMMENT ON TABLE public.department_profiles IS 'Supabase Auth-linked profile; accounts remain pending until approved by a department administrator.';
COMMENT ON TABLE public.course_enrollments IS 'Administrator-managed course roster; students cannot enroll themselves.';
COMMENT ON TABLE public.class_attendance IS 'Official attendance records entered by assigned course staff.';

-- Cover foreign keys reported by Supabase's database performance advisor.
CREATE INDEX IF NOT EXISTS class_attendance_marked_by_idx
  ON public.class_attendance (marked_by);
CREATE INDEX IF NOT EXISTS class_sessions_created_by_idx
  ON public.class_sessions (created_by);
CREATE INDEX IF NOT EXISTS department_announcements_offering_idx
  ON public.department_announcements (course_offering_id);
CREATE INDEX IF NOT EXISTS department_announcements_posted_by_idx
  ON public.department_announcements (posted_by);
CREATE INDEX IF NOT EXISTS department_resources_uploaded_by_idx
  ON public.department_resources (uploaded_by);

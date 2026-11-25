-- Keep course-level announcements and resources within their assigned roster.
DROP POLICY announcements_read_active_members ON public.department_announcements;
CREATE POLICY announcements_read_active_members ON public.department_announcements
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (expires_at IS NULL OR expires_at > now())
    AND (
      course_offering_id IS NULL
      OR private.is_enrolled(course_offering_id, (SELECT auth.uid()))
      OR private.can_manage_offering(course_offering_id)
      OR private.current_role() = 'admin'
    )
  );

DROP POLICY resources_read_active_members ON public.department_resources;
CREATE POLICY resources_read_active_members ON public.department_resources
  FOR SELECT TO authenticated
  USING (
    private.is_active_member()
    AND (
      course_offering_id IS NULL
      OR private.is_enrolled(course_offering_id, (SELECT auth.uid()))
      OR private.can_manage_offering(course_offering_id)
      OR private.current_role() = 'admin'
    )
  );

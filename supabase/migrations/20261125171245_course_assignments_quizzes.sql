-- Course-level assignments, text/link submissions, and auto-graded multiple-choice quizzes.

CREATE TABLE public.course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 12000),
  due_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.department_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_assignment_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.course_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.department_profiles(id) ON DELETE CASCADE,
  response_text text NOT NULL CHECK (char_length(response_text) BETWEEN 1 AND 12000),
  submission_url text CHECK (submission_url IS NULL OR (char_length(submission_url) <= 2048 AND submission_url ~* '^https?://')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE TABLE public.course_assignment_grades (
  submission_id uuid PRIMARY KEY REFERENCES public.course_assignment_submissions(id) ON DELETE CASCADE,
  score numeric(6,2) NOT NULL CHECK (score >= 0),
  out_of numeric(6,2) NOT NULL CHECK (out_of > 0 AND score <= out_of),
  feedback text NOT NULL DEFAULT '' CHECK (char_length(feedback) <= 4000),
  graded_by uuid NOT NULL REFERENCES public.department_profiles(id),
  graded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.course_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_offering_id uuid NOT NULL REFERENCES public.course_offerings(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  instructions text NOT NULL DEFAULT '' CHECK (char_length(instructions) <= 4000),
  opens_at timestamptz NOT NULL DEFAULT now(),
  closes_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.department_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);

CREATE TABLE public.course_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 2000),
  options jsonb NOT NULL CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) BETWEEN 2 AND 6),
  sort_order smallint NOT NULL CHECK (sort_order BETWEEN 1 AND 30),
  UNIQUE (quiz_id, sort_order)
);

CREATE TABLE public.course_quiz_answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.course_quiz_questions(id) ON DELETE CASCADE,
  correct_option smallint NOT NULL CHECK (correct_option BETWEEN 0 AND 5)
);

CREATE TABLE public.course_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.course_quizzes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.department_profiles(id) ON DELETE CASCADE,
  answers jsonb NOT NULL CHECK (jsonb_typeof(answers) = 'object'),
  score smallint NOT NULL CHECK (score >= 0),
  max_score smallint NOT NULL CHECK (max_score > 0 AND score <= max_score),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id)
);

CREATE TABLE private.class_session_codes (
  session_id uuid PRIMARY KEY REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  passcode text NOT NULL CHECK (passcode ~ '^[0-9]{4}$'),
  expires_at timestamptz NOT NULL
);

CREATE TABLE private.class_session_pin_attempts (
  session_id uuid NOT NULL REFERENCES public.class_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.department_profiles(id) ON DELETE CASCADE,
  failed_attempts smallint NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 5),
  blocked_until timestamptz,
  PRIMARY KEY (session_id, student_id)
);
REVOKE ALL ON private.class_session_codes, private.class_session_pin_attempts FROM PUBLIC, anon, authenticated;

CREATE INDEX course_assignments_offering_due_idx ON public.course_assignments(course_offering_id, due_at);
CREATE INDEX course_assignment_submissions_student_idx ON public.course_assignment_submissions(student_id, submitted_at DESC);
CREATE INDEX course_quizzes_offering_open_idx ON public.course_quizzes(course_offering_id, opens_at, closes_at);
CREATE INDEX course_quiz_questions_quiz_sort_idx ON public.course_quiz_questions(quiz_id, sort_order);
CREATE INDEX course_quiz_attempts_student_idx ON public.course_quiz_attempts(student_id, submitted_at DESC);

ALTER TABLE public.course_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_assignment_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_quiz_attempts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.course_assignments, public.course_assignment_submissions,
  public.course_assignment_grades, public.course_quizzes, public.course_quiz_questions,
  public.course_quiz_answer_keys, public.course_quiz_attempts FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_assignments,
  public.course_quizzes, public.course_quiz_questions,
  public.course_quiz_answer_keys TO authenticated;
GRANT SELECT ON public.course_assignment_submissions TO authenticated;
GRANT INSERT (assignment_id, student_id, response_text, submission_url)
  ON public.course_assignment_submissions TO authenticated;
GRANT UPDATE (response_text, submission_url)
  ON public.course_assignment_submissions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.course_assignment_grades TO authenticated;
GRANT SELECT ON public.course_quiz_attempts TO authenticated;

CREATE POLICY assignments_member_read ON public.course_assignments
  FOR SELECT TO authenticated
  USING (private.can_manage_offering(course_offering_id)
    OR private.is_enrolled(course_offering_id, (SELECT auth.uid())));
CREATE POLICY assignments_staff_manage ON public.course_assignments
  FOR ALL TO authenticated
  USING (private.can_manage_offering(course_offering_id))
  WITH CHECK (private.can_manage_offering(course_offering_id));

CREATE POLICY submissions_student_or_staff_read ON public.course_assignment_submissions
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.course_assignments a
    WHERE a.id = assignment_id AND private.can_manage_offering(a.course_offering_id)
  ));
CREATE POLICY submissions_student_submit ON public.course_assignment_submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = (SELECT auth.uid()) AND private.is_active_member()
    AND EXISTS (
      SELECT 1 FROM public.course_assignments a
      WHERE a.id = assignment_id
        AND private.is_enrolled(a.course_offering_id, (SELECT auth.uid()))
        AND (a.due_at IS NULL OR now() <= a.due_at)
    ));
CREATE POLICY submissions_student_update ON public.course_assignment_submissions
  FOR UPDATE TO authenticated
  USING (student_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.course_assignments a
    WHERE a.id = assignment_id AND (a.due_at IS NULL OR now() <= a.due_at)
  ))
  WITH CHECK (student_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.course_assignments a
    WHERE a.id = assignment_id
      AND private.is_enrolled(a.course_offering_id, (SELECT auth.uid()))
      AND (a.due_at IS NULL OR now() <= a.due_at)
  ));

CREATE POLICY assignment_grades_student_or_staff_read ON public.course_assignment_grades
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_assignment_submissions submission
    JOIN public.course_assignments assignment ON assignment.id = submission.assignment_id
    WHERE submission.id = submission_id
      AND (submission.student_id = (SELECT auth.uid())
        OR private.can_manage_offering(assignment.course_offering_id))
  ));
CREATE POLICY assignment_grades_staff_manage ON public.course_assignment_grades
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_assignment_submissions submission
    JOIN public.course_assignments assignment ON assignment.id = submission.assignment_id
    WHERE submission.id = submission_id
      AND private.can_manage_offering(assignment.course_offering_id)
      AND private.current_role() IN ('faculty', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.course_assignment_submissions submission
    JOIN public.course_assignments assignment ON assignment.id = submission.assignment_id
    WHERE submission.id = submission_id
      AND private.can_manage_offering(assignment.course_offering_id)
      AND private.current_role() IN ('faculty', 'admin')
  ));

CREATE POLICY quizzes_member_read ON public.course_quizzes
  FOR SELECT TO authenticated
  USING (private.can_manage_offering(course_offering_id)
    OR private.is_enrolled(course_offering_id, (SELECT auth.uid())));
CREATE POLICY quizzes_staff_manage ON public.course_quizzes
  FOR ALL TO authenticated
  USING (private.can_manage_offering(course_offering_id))
  WITH CHECK (private.can_manage_offering(course_offering_id));

CREATE POLICY questions_member_read ON public.course_quiz_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_quizzes q
    WHERE q.id = quiz_id AND (
      private.can_manage_offering(q.course_offering_id)
      OR private.is_enrolled(q.course_offering_id, (SELECT auth.uid()))
    )
  ));
CREATE POLICY questions_staff_manage ON public.course_quiz_questions
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_quizzes q
    WHERE q.id = quiz_id AND private.can_manage_offering(q.course_offering_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.course_quizzes q
    WHERE q.id = quiz_id AND private.can_manage_offering(q.course_offering_id)
  ));

CREATE POLICY answer_keys_staff_only ON public.course_quiz_answer_keys
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.course_quiz_questions question
    JOIN public.course_quizzes quiz ON quiz.id = question.quiz_id
    WHERE question.id = question_id AND private.can_manage_offering(quiz.course_offering_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.course_quiz_questions question
    JOIN public.course_quizzes quiz ON quiz.id = question.quiz_id
    WHERE question.id = question_id AND private.can_manage_offering(quiz.course_offering_id)
  ));

CREATE POLICY attempts_student_or_staff_read ON public.course_quiz_attempts
  FOR SELECT TO authenticated
  USING (student_id = (SELECT auth.uid()) OR EXISTS (
    SELECT 1 FROM public.course_quizzes quiz
    WHERE quiz.id = quiz_id AND private.can_manage_offering(quiz.course_offering_id)
  ));

CREATE OR REPLACE FUNCTION public.open_live_attendance(target_offering uuid, duration_minutes integer DEFAULT 5)
RETURNS TABLE(session_id uuid, passcode text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
  created_session uuid;
  generated_passcode text;
  expiry timestamptz;
BEGIN
  IF caller IS NULL OR NOT private.is_active_member()
     OR NOT private.can_manage_offering(target_offering)
     OR duration_minutes IS NULL OR duration_minutes NOT BETWEEN 1 AND 15 THEN
    RAISE EXCEPTION 'Attendance session cannot be opened';
  END IF;

  generated_passcode := lpad(floor(random() * 10000)::integer::text, 4, '0');
  expiry := now() + make_interval(mins => duration_minutes);

  INSERT INTO public.class_sessions(course_offering_id, session_date, starts_at, ends_at, created_by)
  VALUES (target_offering, (now() AT TIME ZONE 'Asia/Karachi')::date, now(), expiry, caller)
  RETURNING id INTO created_session;

  INSERT INTO private.class_session_codes(session_id, passcode, expires_at)
  VALUES (created_session, generated_passcode, expiry);

  RETURN QUERY SELECT created_session, generated_passcode, expiry;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_live_attendance_pin(target_session uuid)
RETURNS TABLE(passcode text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT private.is_active_member()
     OR NOT EXISTS (
       SELECT 1 FROM public.class_sessions s
       WHERE s.id = target_session AND private.can_manage_offering(s.course_offering_id)
     ) THEN
    RAISE EXCEPTION 'Not authorized to view this attendance code';
  END IF;

  RETURN QUERY
  SELECT code.passcode, code.expires_at
  FROM private.class_session_codes code
  WHERE code.session_id = target_session AND code.expires_at > now();
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_attendance_pin(target_session uuid, entered_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
  target_offering uuid;
  expected_pin text;
  expiry timestamptz;
  failures smallint;
  blocked timestamptz;
  inserted_id uuid;
BEGIN
  IF caller IS NULL OR entered_pin !~ '^[0-9]{4}$' OR NOT private.is_active_member() THEN
    RETURN false;
  END IF;

  SELECT s.course_offering_id INTO target_offering
  FROM public.class_sessions s
  WHERE s.id = target_session AND s.ends_at > now();
  IF target_offering IS NULL OR NOT private.is_enrolled(target_offering, caller) THEN
    RETURN false;
  END IF;

  SELECT c.passcode, c.expires_at INTO expected_pin, expiry
  FROM private.class_session_codes c WHERE c.session_id = target_session;
  IF expected_pin IS NULL OR expiry <= now() THEN RETURN false; END IF;

  INSERT INTO private.class_session_pin_attempts(session_id, student_id)
  VALUES (target_session, caller) ON CONFLICT (session_id, student_id) DO NOTHING;
  SELECT a.failed_attempts, a.blocked_until INTO failures, blocked
  FROM private.class_session_pin_attempts a
  WHERE a.session_id = target_session AND a.student_id = caller FOR UPDATE;

  IF blocked IS NOT NULL AND blocked > now() THEN RETURN false; END IF;
  IF entered_pin <> expected_pin THEN
    UPDATE private.class_session_pin_attempts
    SET failed_attempts = LEAST(failed_attempts + 1, 5),
        blocked_until = CASE WHEN failed_attempts + 1 >= 5 THEN expiry ELSE blocked_until END
    WHERE session_id = target_session AND student_id = caller;
    RETURN false;
  END IF;

  INSERT INTO public.class_attendance(session_id, student_id, status, marked_by)
  VALUES (target_session, caller, 'present', caller)
  ON CONFLICT (session_id, student_id) DO NOTHING
  RETURNING id INTO inserted_id;
  IF inserted_id IS NULL THEN RETURN false; END IF;

  DELETE FROM private.class_session_pin_attempts
  WHERE session_id = target_session AND student_id = caller;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.open_live_attendance(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_live_attendance_pin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_attendance_pin(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_live_attendance(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_live_attendance_pin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_attendance_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_course_quiz(target_quiz uuid, submitted_answers jsonb)
RETURNS TABLE(score smallint, max_score smallint)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller uuid := (SELECT auth.uid());
  quiz_offering uuid;
  quiz_open timestamptz;
  quiz_close timestamptz;
  question_total integer;
  correct_total integer;
BEGIN
  IF caller IS NULL OR jsonb_typeof(submitted_answers) <> 'object'
     OR NOT private.is_active_member() THEN
    RAISE EXCEPTION 'Quiz submission is not allowed';
  END IF;

  SELECT q.course_offering_id, q.opens_at, q.closes_at
  INTO quiz_offering, quiz_open, quiz_close
  FROM public.course_quizzes q
  WHERE q.id = target_quiz;

  IF quiz_offering IS NULL OR NOT private.is_enrolled(quiz_offering, caller)
     OR now() < quiz_open OR now() > quiz_close THEN
    RAISE EXCEPTION 'Quiz is unavailable';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.course_quiz_attempts a
    WHERE a.quiz_id = target_quiz AND a.student_id = caller
  ) THEN
    RAISE EXCEPTION 'A quiz attempt was already submitted';
  END IF;

  SELECT count(*)::integer,
    count(*) FILTER (
      WHERE submitted_answers ->> question.id::text = answer.correct_option::text
    )::integer
  INTO question_total, correct_total
  FROM public.course_quiz_questions question
  JOIN public.course_quiz_answer_keys answer ON answer.question_id = question.id
  WHERE question.quiz_id = target_quiz
    AND submitted_answers ? question.id::text
    AND (submitted_answers ->> question.id::text) ~ '^[0-5]$'
    AND (submitted_answers ->> question.id::text)::integer < jsonb_array_length(question.options);

  IF question_total < 1 OR question_total <> (
    SELECT count(*) FROM public.course_quiz_questions q WHERE q.quiz_id = target_quiz
  ) OR (SELECT count(*) FROM jsonb_object_keys(submitted_answers)) <> question_total THEN
    RAISE EXCEPTION 'Complete every quiz question before submitting';
  END IF;

  INSERT INTO public.course_quiz_attempts(quiz_id, student_id, answers, score, max_score)
  VALUES (target_quiz, caller, submitted_answers, correct_total, question_total);

  RETURN QUERY SELECT correct_total::smallint, question_total::smallint;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_course_quiz(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_course_quiz(uuid, jsonb) TO authenticated;

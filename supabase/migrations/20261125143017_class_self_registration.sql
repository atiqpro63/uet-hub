-- Prepare the saved class roster for email-verified, administrator-approved access.
-- Password hashes and historical attendance are deliberately not copied here.

ALTER TABLE public.department_profiles
  ADD COLUMN email text;

UPDATE public.department_profiles AS p
SET email = u.email
FROM auth.users AS u
WHERE u.id = p.id;

CREATE UNIQUE INDEX department_profiles_email_lower_uidx
  ON public.department_profiles (lower(email))
  WHERE email IS NOT NULL;

CREATE TABLE public.department_roster (
  registration_no text PRIMARY KEY
    CHECK (registration_no ~ '^20[0-9]{2}-[A-Z]{2,3}-[0-9]{3}$'),
  full_name text NOT NULL,
  university_email text GENERATED ALWAYS AS
    (lower(replace(registration_no, '-', '')) || '@student.uet.edu.pk') STORED UNIQUE,
  legacy_role text NOT NULL CHECK (legacy_role IN ('Student', 'CR', 'GR')),
  imported_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.department_roster (registration_no, full_name, legacy_role)
SELECT upper(trim(reg_no)), trim(full_name), role
FROM public.users
WHERE reg_no ~ '^20[0-9]{2}-[A-Z]{2,3}-[0-9]{3}$'
  AND full_name IS NOT NULL
  AND role IN ('Student', 'CR', 'GR')
ON CONFLICT (registration_no) DO NOTHING;

ALTER TABLE public.department_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.department_roster FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_roster TO authenticated;

CREATE POLICY department_roster_admin_read ON public.department_roster
  FOR SELECT TO authenticated
  USING (private.current_role() = 'admin');

CREATE POLICY department_roster_admin_manage ON public.department_roster
  FOR ALL TO authenticated
  USING (private.current_role() = 'admin')
  WITH CHECK (private.current_role() = 'admin');

CREATE OR REPLACE FUNCTION private.bootstrap_department_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  matched_registration_no text;
  matched_full_name text;
BEGIN
  SELECT r.registration_no, r.full_name
  INTO matched_registration_no, matched_full_name
  FROM public.department_roster AS r
  WHERE r.registration_no = upper(trim(COALESCE(NEW.raw_user_meta_data ->> 'registration_no', '')))
    AND r.university_email = lower(COALESCE(NEW.email, ''));

  INSERT INTO public.department_profiles
    (id, email, registration_no, full_name, role, account_status)
  VALUES (
    NEW.id,
    lower(NEW.email),
    matched_registration_no,
    COALESCE(matched_full_name, 'Pending account'),
    'student',
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.bootstrap_department_profile() FROM PUBLIC, anon, authenticated;

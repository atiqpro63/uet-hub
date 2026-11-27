# UET Hub

UET Hub is becoming a department-wide academic portal. The web app uses Next.js
for the site, Supabase Auth for approved university accounts, and Supabase
Postgres for department data. The original Streamlit app remains in the repo as
a reference during the migration.

## Run the web app locally

1. Install Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local` and fill in the Supabase project URL and
   publishable key. Never put a database password or Supabase secret/service-role
   key in a `NEXT_PUBLIC_` variable.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:3000`.

## Local-only feature testing

Use a local Supabase stack to test the class portal without touching the hosted
department database. This requires Docker Desktop and the Supabase CLI. Do not
point this setup at the hosted project or use real student records.

1. Start Docker Desktop, install the Supabase CLI using its official Windows
   instructions, and open a terminal in this repository.
2. Run `supabase start`. The first start downloads the local services.
3. Open `http://127.0.0.1:54323` (local Supabase Studio) and run the SQL in
   `supabase/local-test-roster.sql` in its SQL Editor. These are fake test
   students, not real class records.
4. Run `supabase status`. Copy its local API URL and publishable key into a
   new `.env.local` file based on `.env.example`; use `http://localhost:3000`
   for `NEXT_PUBLIC_SITE_URL`. Do not use a hosted project's URL or key.
5. Run `npm install`, then `npm run dev`. Open `http://localhost:3000/login`.
6. Under **First time here?**, create the fake test admin account using
   `Local Test Admin`, `2099-DS-001`, and a new UET Hub-only password of at
   least 12 characters.
7. In local Supabase Studio's SQL Editor, promote only that fake profile so it
   can set up the class pilot:

   ```sql
   UPDATE public.department_profiles
   SET role = 'admin', account_status = 'active'
   WHERE registration_no = '2099-DS-001';
   ```

8. Sign in with `2099-DS-001` and the password you set. Create a test course
   section under **Class setup**, then use the fake student and representative records from
   `supabase/local-test-roster.sql` to try approval, classwork, quizzes, and
   attendance.

The test roster file is deliberately not configured as an automatic seed. Run
it only in the local Studio at `127.0.0.1:54323`, never in the hosted Supabase
dashboard. The local stack is isolated from Vercel and the hosted database.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
Vercel's Production, Preview, and Development environments. In Supabase Auth >
Providers > Email, keep password sign-in enabled and turn off email confirmation
for this pilot. Registration uses a registration-derived internal identifier;
it is not a mailbox and no mail is sent. Apply this setting only with department
approval of the in-person identity-check process.

## Account access

Students create an account with their full name, registration number, and a new
UET Hub password of at least 12 characters. It must not be reused from the LMS.
Supabase Auth uses an internal email-shaped identifier derived from the
registration number; it is never used to send email. New accounts remain pending
until an administrator verifies the student in person against the imported
class roster, chooses a role, and assigns a course section. Students cannot
promote themselves or enroll themselves in courses. Password recovery is
administrator-managed for this pilot; self-service recovery needs an approved
contact method.

The `class_self_registration` migration copies only registration numbers,
student names, and derived identifiers from the legacy `users` table into an
administrator-only roster. It does not copy legacy password hashes or past
attendance into new accounts. Never approve an account based only on its form.

## Database

The first migration keeps the legacy tables closed to the public API. The
department portal migration adds auth-linked profiles, terms, courses, course
offerings, managed rosters, timetables, class sessions, attendance records,
announcements, resources, and row-level access policies. The legacy Streamlit
tables remain private while the new app is introduced.

For the first administrator, create the account with their registration number
and a new UET Hub password, then use the Supabase SQL editor to activate the
generated profile and assign the admin role:

```sql
UPDATE public.department_profiles
SET role = 'admin', account_status = 'active'
WHERE registration_no = '<the administrator registration number>';
```

After the admin profile is activated, open **Class setup** in the portal to
create a term/course section and approve in-person verified classmates into that section.
Use Supabase Table Editor to add the section timetable. Assigned course staff
can open short attendance PIN sessions or record the roll manually. The web
portal also supports assignment posts with written/link submissions and
time-windowed multiple-choice quizzes. Uploaded assignment files, grading and
feedback workflows, and historical attendance import are not part of this
class-pilot baseline yet.

## Legacy files

`uet_hub.py` is the earlier Streamlit prototype. `uet_hub_system.db` is a local
legacy database and is not used by the web app. Do not commit it or real student
data. The legacy database file was removed from the current GitHub branch; its
old Git history still needs a separately approved history rewrite to erase it.
The prototype continues to use salted PBKDF2-SHA256 password storage and keeps
its database connection on the server. The department web portal uses Supabase
Auth instead of the prototype's local account table.

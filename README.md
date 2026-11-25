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

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for
Vercel's Production, Preview, and Development environments. Set
`NEXT_PUBLIC_SITE_URL` to the canonical site URL in Production and
`http://localhost:3000` in Development; Preview deployments use Vercel's own
deployment URL for email sign-in links. In Supabase Auth URL Configuration, set
the Site URL to the canonical production URL and allow `http://localhost:3000/**`,
the exact production `/auth/callback` URL, and the Vercel preview pattern
`https://*-uet-hub.vercel.app/**`.

## Account access

Students can request an account with their university student email and
registration number. The email must follow the UET student format derived from
the registration number (for example, `2026-DS-308` maps to
`2026ds308@student.uet.edu.pk`). Supabase sends a one-time verification link;
new accounts remain pending until a trusted administrator matches them against
the imported class roster, chooses a role, and assigns a course section.
Students cannot promote themselves or enroll themselves in courses.

The `class_self_registration` migration copies only registration numbers,
student names, and derived university emails from the legacy `users` table into
an administrator-only roster. It does not copy legacy password hashes or past
attendance into the new portal. The old records remain available in their
legacy tables while the class pilot is checked.

## Database

The first migration keeps the legacy tables closed to the public API. The
department portal migration adds auth-linked profiles, terms, courses, course
offerings, managed rosters, timetables, class sessions, attendance records,
announcements, resources, and row-level access policies. The legacy Streamlit
tables remain private while the new app is introduced.

For the first administrator, invite that person's university account in
Supabase Auth, then use the Supabase SQL editor to activate the generated profile
and assign the admin role:

```sql
UPDATE public.department_profiles
SET role = 'admin', account_status = 'active'
WHERE id = '<the invited Auth user UUID>';
```

After the admin profile is activated, open **Class setup** in the portal to
create a term/course section and approve verified classmates into that section.
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

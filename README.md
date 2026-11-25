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

The sign-in page sends a one-time email link and does not create accounts.
Department staff must invite university email accounts through Supabase Auth.
The database creates each invited account as a pending student profile. A
trusted administrator must approve it and assign its roster number and role.
Students cannot promote themselves or enroll themselves in courses.

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

After the admin profile is activated, use Supabase Table Editor to provision the
academic term, courses, sections, staff assignments, timetable, and approved
student roster before opening the portal to a class. Attendance staff must
choose a status for every student before a session can be saved.

## Legacy files

`uet_hub.py` is the earlier Streamlit prototype. `uet_hub_system.db` is a local
legacy database and is not used by the web app. Do not commit it or real student
data. The legacy database file was removed from the current GitHub branch; its
old Git history still needs a separately approved history rewrite to erase it.
The prototype continues to use salted PBKDF2-SHA256 password storage and keeps
its database connection on the server. The department web portal uses Supabase
Auth instead of the prototype's local account table.

# UET Hub

UET Hub is a Streamlit academic portal backed by PostgreSQL on Supabase.

## Run locally

1. Use Python 3.11 or newer and install `requirements.txt`.
2. Create `.streamlit/secrets.toml` with a `[postgres]` section containing the
   private PostgreSQL `host`, `port`, `dbname`, `user`, and `password` values.
3. Start the app with `streamlit run uet_hub.py`.

Never commit `.streamlit/secrets.toml`, database files, or real student data.
The legacy `uet_hub_system.db` is not used by the app; it was removed from the
repository's current branch after finding account and timetable records in it.

## Database state

The live Supabase database has a versioned baseline in
`supabase/migrations/20261125112036_lock_down_public_api.sql`. It denies access
to the public Data API roles (`anon` and `authenticated`) until the application
has a verified identity and authorization model, and adds indexes for the
attendance and personal-task foreign keys. The Streamlit app currently uses a
private PostgreSQL connection; do not put that connection credential or a
Supabase secret/service-role key in browser-visible code.

This is a development baseline, not approval for official department records.
Before rollout, replace the deny-all API policies with reviewed policies that
match the final identity, student roster, and staff role model. Also replace
self-selected CR/GR registration and SHA-256 password storage in the app.
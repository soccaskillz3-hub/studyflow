-- Small per-account preferences that aren't theme or sound, e.g. that the person said
-- "Not now" to adding their class schedule. A JSON object so new ones don't need a migration.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run). The existing
-- row level security on user_settings already keeps it private to each account.

alter table public.user_settings
  add column prefs jsonb not null default '{}'::jsonb
  constraint user_settings_prefs_is_object check (jsonb_typeof(prefs) = 'object');

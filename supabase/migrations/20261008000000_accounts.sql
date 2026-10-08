-- StudyFlow accounts: each person's schedule and settings, private to their account.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run).
--
-- Privacy is enforced by Postgres itself with Row Level Security: every policy below only
-- matches rows whose user_id is the signed-in user (auth.uid(), taken from their verified
-- login token). Logged-out visitors (the anon role) get no access to these tables at all.

-- ---------- Study sessions ----------

create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null, -- the day the session is planned for, in the user's local time
  subject text not null check (char_length(subject) between 1 and 200),
  starts_at time not null,
  ends_at time not null,
  is_break boolean not null default false,
  completed_at timestamptz, -- null until checked off
  created_at timestamptz not null default now(),
  constraint study_sessions_ends_after_start check (ends_at > starts_at)
);

create index study_sessions_user_day on public.study_sessions (user_id, day, starts_at);

alter table public.study_sessions enable row level security;

create policy "Read own sessions" on public.study_sessions
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Add own sessions" on public.study_sessions
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Change own sessions" on public.study_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Remove own sessions" on public.study_sessions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- Settings (theme, scene and sound) ----------

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  theme text check (theme in ('ocean', 'forest')),
  weather_override text check (weather_override in ('clear', 'cloudy', 'rain', 'storm', 'snow', 'fog')),
  time_override text check (time_override in ('sunrise', 'day', 'dusk', 'night')),
  sound jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

create policy "Read own settings" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Add own settings" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Change own settings" on public.user_settings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------- Table access ----------
-- Only signed-in users can reach these tables (and then only their own rows, per the policies).

revoke all on table public.study_sessions, public.user_settings from anon, public;
grant select, insert, update, delete on table public.study_sessions to authenticated;
grant select, insert, update on table public.user_settings to authenticated;

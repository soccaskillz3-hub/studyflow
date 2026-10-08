-- Classes imported from a pasted class schedule. Each row is one weekly meeting of a course,
-- e.g. CS 135's lecture on Mon/Wed/Fri 10:30-11:20, shown on the calendar on those days.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run), after
-- 20261008000000_accounts.sql. Private to each account in the same way.

create table public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  code text not null check (char_length(code) between 1 and 20), -- "CS 135"
  title text not null default '' check (char_length(title) <= 200),
  component text not null default '' check (char_length(component) <= 10), -- "LEC", "TUT", ...
  days smallint[] not null check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]), -- 0 = Sunday
  starts_at time not null,
  ends_at time not null,
  location text not null default '' check (char_length(location) <= 100),
  starts_on date, -- first and last day of classes; null = no limit
  ends_on date,
  created_at timestamptz not null default now(),
  constraint class_meetings_ends_after_start check (ends_at > starts_at),
  constraint class_meetings_dates_in_order check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index class_meetings_user on public.class_meetings (user_id);

alter table public.class_meetings enable row level security;

create policy "Read own classes" on public.class_meetings
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "Add own classes" on public.class_meetings
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "Change own classes" on public.class_meetings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Remove own classes" on public.class_meetings
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.class_meetings from anon, public;
grant select, insert, update, delete on table public.class_meetings to authenticated;

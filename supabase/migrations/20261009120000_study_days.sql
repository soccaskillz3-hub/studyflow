-- Each account's study totals, one row per day: what was planned and what got done. Powers the
-- Progress page (streaks, the history grid) without sending every session to the browser.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run).
--
-- security_invoker makes the view run with the permissions of whoever is asking, so the row
-- level security on study_sessions still applies and each account only sees its own days.
-- (Without it, a view runs as its owner and would skip those rules.)

create view public.study_days
with (security_invoker = on) as
select
  user_id,
  day,
  count(*) filter (where not is_break)::int as sessions,
  count(*) filter (where not is_break and completed_at is not null)::int as sessions_done,
  coalesce(sum(extract(epoch from ends_at - starts_at) / 60) filter (where not is_break), 0)::int
    as planned_minutes,
  coalesce(sum(extract(epoch from ends_at - starts_at) / 60) filter (where not is_break and completed_at is not null), 0)::int
    as done_minutes
from public.study_sessions
group by user_id, day;

revoke all on table public.study_days from anon, public;
grant select on table public.study_days to authenticated;

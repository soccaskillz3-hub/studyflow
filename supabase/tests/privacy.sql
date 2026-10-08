-- Privacy check: proves one account can't see or change another account's data.
--
-- Needs both migrations in supabase/migrations and at least two accounts (sign up twice in
-- the app). Run it in the Supabase dashboard (SQL Editor > New query > paste > Run). It acts
-- as the two oldest accounts and as a logged-out visitor, prints one PASS or FAIL per check,
-- and leaves no data behind.

create temp table if not exists privacy_results (n int, check_name text, result text);
truncate privacy_results;

do $$
declare
  a uuid;
  b uuid;
  test_id uuid := gen_random_uuid();
  class_id uuid := gen_random_uuid();
  n int;
  results jsonb := '[]';
begin
  select id into a from auth.users order by created_at limit 1;
  select id into b from auth.users where id <> a order by created_at limit 1;
  if b is null then
    raise exception 'Create two accounts in the app first, then run this again.';
  end if;

  -- As A (signed in the same way the app's requests are): add a session.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.study_sessions (id, user_id, day, subject, starts_at, ends_at)
  values (test_id, a, current_date, 'Privacy test', '09:00', '10:00');
  select count(*) into n from public.study_sessions where id = test_id;
  results := results || jsonb_build_object('check', 'A can see their own session', 'pass', n = 1);
  insert into public.class_meetings (id, user_id, code, days, starts_at, ends_at)
  values (class_id, a, 'TEST 101', array[1, 3, 5]::smallint[], '10:30', '11:20');
  select count(*) into n from public.class_meetings where id = class_id;
  results := results || jsonb_build_object('check', 'A can see their own class', 'pass', n = 1);

  -- As B: try to read, change and delete A's session, and to write into A's account.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.study_sessions where user_id = a;
  results := results || jsonb_build_object('check', 'B cannot see any of A''s sessions', 'pass', n = 0);

  update public.study_sessions set subject = 'Changed by B' where id = test_id;
  get diagnostics n = row_count;
  results := results || jsonb_build_object('check', 'B cannot change A''s session', 'pass', n = 0);

  delete from public.study_sessions where id = test_id;
  get diagnostics n = row_count;
  results := results || jsonb_build_object('check', 'B cannot delete A''s session', 'pass', n = 0);

  begin
    insert into public.study_sessions (user_id, day, subject, starts_at, ends_at)
    values (a, current_date, 'Planted by B', '11:00', '12:00');
    results := results || jsonb_build_object('check', 'B cannot add a session to A''s account', 'pass', false);
  exception when insufficient_privilege then
    results := results || jsonb_build_object('check', 'B cannot add a session to A''s account', 'pass', true);
  end;

  select count(*) into n from public.class_meetings where user_id = a;
  results := results || jsonb_build_object('check', 'B cannot see any of A''s classes', 'pass', n = 0);

  update public.class_meetings set code = 'HACK 101' where id = class_id;
  get diagnostics n = row_count;
  results := results || jsonb_build_object('check', 'B cannot change A''s class', 'pass', n = 0);

  delete from public.class_meetings where id = class_id;
  get diagnostics n = row_count;
  results := results || jsonb_build_object('check', 'B cannot delete A''s class', 'pass', n = 0);

  begin
    insert into public.class_meetings (user_id, code, days, starts_at, ends_at)
    values (a, 'PLANTED 1', array[2]::smallint[], '09:00', '10:00');
    results := results || jsonb_build_object('check', 'B cannot add a class to A''s account', 'pass', false);
  exception when insufficient_privilege then
    results := results || jsonb_build_object('check', 'B cannot add a class to A''s account', 'pass', true);
  end;

  select count(*) into n from public.user_settings where user_id = a;
  results := results || jsonb_build_object('check', 'B cannot see A''s settings', 'pass', n = 0);

  begin
    insert into public.user_settings (user_id, theme) values (a, 'forest')
    on conflict (user_id) do update set theme = 'forest';
    results := results || jsonb_build_object('check', 'B cannot change A''s settings', 'pass', false);
  exception when insufficient_privilege then
    results := results || jsonb_build_object('check', 'B cannot change A''s settings', 'pass', true);
  end;

  -- As a logged-out visitor: no access at all.
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  begin
    select count(*) into n from public.study_sessions;
    results := results || jsonb_build_object('check', 'Logged-out visitors cannot read sessions', 'pass', false);
  exception when insufficient_privilege then
    results := results || jsonb_build_object('check', 'Logged-out visitors cannot read sessions', 'pass', true);
  end;
  begin
    select count(*) into n from public.class_meetings;
    results := results || jsonb_build_object('check', 'Logged-out visitors cannot read classes', 'pass', false);
  exception when insufficient_privilege then
    results := results || jsonb_build_object('check', 'Logged-out visitors cannot read classes', 'pass', true);
  end;
  begin
    select count(*) into n from public.user_settings;
    results := results || jsonb_build_object('check', 'Logged-out visitors cannot read settings', 'pass', false);
  exception when insufficient_privilege then
    results := results || jsonb_build_object('check', 'Logged-out visitors cannot read settings', 'pass', true);
  end;

  -- Back to the admin role: remove anything the checks created and record the results.
  execute 'reset role';
  delete from public.study_sessions where id = test_id or (user_id = a and subject = 'Planted by B');
  delete from public.class_meetings where id = class_id or (user_id = a and code = 'PLANTED 1');
  insert into privacy_results (n, check_name, result)
  select i, r ->> 'check', case when (r ->> 'pass')::boolean then 'PASS' else 'FAIL' end
  from jsonb_array_elements(results) with ordinality as t (r, i);
end $$;

select check_name as "check", result from privacy_results order by n;

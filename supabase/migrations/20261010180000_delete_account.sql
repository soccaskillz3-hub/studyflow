-- Deleting your own account: Settings → Delete account.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run).
--
-- The app can't delete a login itself (that needs Supabase's secret key, which never leaves the
-- dashboard), so this function does it for whoever calls it, and only for them. It runs as its
-- owner (security definer) to reach auth.users, and removing the login removes everything that
-- belongs to it: study sessions, classes and settings are all "on delete cascade", and Supabase
-- removes the account's logins and connected AI apps along with it.
--
-- Connected AI assistants can't call it: their tokens carry a client_id (see the AI connector
-- migration), and deleting an account is only for the person themselves, in Zeflo.

create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not logged in.';
  end if;
  if (select auth.jwt() ->> 'client_id') is not null then
    raise exception 'Connected apps can''t delete an account.';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

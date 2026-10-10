-- AI connector: limits what a connected AI assistant can do with the access token it's given.
--
-- Run once in the Supabase dashboard (SQL Editor > New query > paste > Run).
--
-- Assistants connect through Supabase's OAuth server, and their access tokens carry the app's
-- client_id. Those tokens otherwise act as the user, so on their own they could change anything
-- the user can. These restrictive policies (combined with AND on top of the existing ones) keep
-- connected apps to reading classes and settings: only Zeflo itself, signed in normally, can add,
-- change or remove them. Study sessions stay fully open to assistants; planning them is the point.

create policy "Connected apps can't add classes" on public.class_meetings
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "Connected apps can't change classes" on public.class_meetings
  as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "Connected apps can't remove classes" on public.class_meetings
  as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "Connected apps can't add settings" on public.user_settings
  as restrictive for insert to authenticated
  with check ((select auth.jwt() ->> 'client_id') is null);

create policy "Connected apps can't change settings" on public.user_settings
  as restrictive for update to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

create policy "Connected apps can't remove settings" on public.user_settings
  as restrictive for delete to authenticated
  using ((select auth.jwt() ->> 'client_id') is null);

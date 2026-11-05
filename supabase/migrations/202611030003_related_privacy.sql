begin;
grant update(slot_template) on public.profiles to authenticated;
do $$ declare t text;r record;begin
 foreach t in array array['confirmed_sessions','session_slots','user_availability','rematch_intents','notifications','signaling'] loop
  for r in select policyname from pg_policies where schemaname='public' and tablename=t loop
   execute format('drop policy %I on public.%I',r.policyname,t);
  end loop;
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
 end loop;
end $$;
-- Scheduling writes continue through authenticated membership-checked APIs.
create policy own_confirmed on public.confirmed_sessions for select to authenticated using(user_id::text=auth.uid()::text);
create policy own_slots on public.session_slots for select to authenticated using(user_id::text=auth.uid()::text);
create policy own_availability on public.user_availability for select to authenticated using(user_id::text=auth.uid()::text);
create policy own_rematch on public.rematch_intents for select to authenticated using(user_id::text=auth.uid()::text);
grant select on public.confirmed_sessions,public.session_slots,public.user_availability,public.rematch_intents to authenticated;
create policy own_notifications on public.notifications for select to authenticated using(public.owns_legacy_id(session_id));
create policy own_notifications_seen on public.notifications for update to authenticated using(public.owns_legacy_id(session_id)) with check(public.owns_legacy_id(session_id));
grant select,update(seen) on public.notifications to authenticated;
-- Old WebRTC sessions use a channel containing their match and legacy IDs.
create policy old_signal_read on public.signaling for select to authenticated using(public.owns_legacy_id(to_id));
create policy old_signal_delete on public.signaling for delete to authenticated using(public.owns_legacy_id(to_id) or public.owns_legacy_id(from_id));
create policy old_signal_send on public.signaling for insert to authenticated with check(public.owns_legacy_id(from_id) and exists(
 select 1 from public.matches m where from_id in(m.session_id_a,m.session_id_b) and to_id in(m.session_id_a,m.session_id_b) and from_id<>to_id
 and channel='rtc:'||m.id::text||':'||least(m.session_id_a,m.session_id_b)||':'||greatest(m.session_id_a,m.session_id_b)));
grant select,insert,delete on public.signaling to authenticated;
commit;

-- Call history fix — audit item "4. 通話履歴"
--
-- Problem confirmed by both audits: ending a live_exchange conversation
-- (any path — explicit "end", the cancel/match race, or the automatic
-- stale-peer cleanup) updates live_conversations/live_calls but never
-- writes a durable history row anywhere. /exchanges and friends read the
-- unrelated legacy `session_logs` table, which live_exchange never
-- touches, so real completed calls show up nowhere in history.
--
-- Design:
--   - practice_sessions: one row per ended live_conversations row. A
--     `unique (conversation_id)` constraint + `on conflict do nothing` on
--     every insert makes recording idempotent no matter which of the
--     multiple end-paths fires, or how many times cleanup re-runs over a
--     conversation that's already ended (normal end, peer-left/one-side
--     disconnect, and duplicate end calls all land on the same row).
--   - live_calls gains connected_at/ended_at so an actual voice-call
--     duration can be computed (previously only created_at/expires_at
--     existed, which is invite time, not connection time).
--   - Only the existing SECURITY DEFINER live_exchange() function writes
--     practice_sessions — no direct client insert/update/delete grant.
--   - partner_type is included now (always 'human' today) so the AI-call
--     feature, when built, is additive to this table rather than needing
--     a second history table.
--
-- Additive and idempotent: safe to re-run; does not touch session_logs,
-- matches, or any legacy table.

alter table public.live_calls add column if not exists connected_at timestamptz;
alter table public.live_calls add column if not exists ended_at timestamptz;

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.live_conversations(id),
  partner_type text not null default 'human' check (partner_type in ('human','ai')),
  user_a uuid not null references auth.users(id),
  user_b uuid references auth.users(id),
  kind text not null check (kind in ('text','voice')),
  native_language_a text, learning_language_a text,
  native_language_b text, learning_language_b text,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_secs int not null,
  ended_reason text,
  call_connected_secs int,
  message_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (conversation_id)
);
alter table public.practice_sessions enable row level security;
drop policy if exists participant_read on public.practice_sessions;
create policy participant_read on public.practice_sessions for select to authenticated
  using (auth.uid() in (user_a, user_b));
grant select on public.practice_sessions to authenticated;
revoke insert, update, delete on public.practice_sessions from anon, authenticated;

-- Set connected_at the moment a call actually becomes usable — covers both
-- the explicit "accept" action and the auto-accepted call live_exchange()
-- creates when two people match directly into a voice conversation.
create or replace function public.live_exchange(p_action text, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
 me uuid := auth.uid(); peer uuid; cid uuid; callid uuid;
 c public.live_conversations%rowtype; v public.live_calls%rowtype;
 p public.profiles%rowtype; q public.live_queue%rowtype;
 current_call jsonb; partner jsonb; result jsonb; messages jsonb;
 action_result text; current_time_stamp timestamptz := clock_timestamp();
begin
 if me is null then raise exception 'not_authenticated'; end if;
 if exists(select 1 from public.profiles where lower(email)=lower(auth.jwt()->>'email') and banned_until > now()) then
  raise exception 'account_suspended';
 end if;
 perform pg_advisory_xact_lock(72601101);
 -- A peer disappearing cannot hold a session/queue indefinitely. Record
 -- history for every conversation this cleanup just ends, not only the
 -- caller's own — this is the only end-path that can end someone else's
 -- conversation out from under them.
 with ended as (
  update public.live_conversations x set status='ended',ended_at=now(),ended_reason='peer_left'
  where x.status='active' and exists(select 1 from public.live_members m
    where m.conversation_id=x.id and m.last_seen < current_time_stamp-interval '45 seconds')
  returning *
 )
 insert into public.practice_sessions(conversation_id,user_a,user_b,kind,started_at,ended_at,duration_secs,ended_reason,
   native_language_a,learning_language_a,native_language_b,learning_language_b,call_connected_secs,message_count)
 select e.id, e.user_a, e.user_b, e.kind, e.created_at, e.ended_at,
   greatest(0, extract(epoch from (e.ended_at - e.created_at))::int), e.ended_reason,
   pa.native_language, pa.learning_language, pb.native_language, pb.learning_language,
   (select extract(epoch from (lc.ended_at - lc.connected_at))::int from public.live_calls lc
     where lc.conversation_id=e.id and lc.connected_at is not null order by lc.created_at desc limit 1),
   (select count(*)::int from public.live_messages lm where lm.conversation_id=e.id)
 from ended e
 left join lateral (select native_language,learning_language from public.profiles where lower(email)=lower((select email from auth.users where id=e.user_a)) order by created_at desc limit 1) pa on true
 left join lateral (select native_language,learning_language from public.profiles where lower(email)=lower((select email from auth.users where id=e.user_b)) order by created_at desc limit 1) pb on true
 on conflict (conversation_id) do nothing;

 update public.live_calls x set status='ended',ended_at=coalesce(x.ended_at,now()),ended_reason='conversation_ended'
 where x.status in('ringing','accepted') and exists(select 1 from public.live_conversations c where c.id=x.conversation_id and c.status='ended');
 update public.live_calls set status='expired',ended_at=coalesce(ended_at,now()) where status='ringing' and expires_at<=current_time_stamp;
 delete from public.live_queue where expires_at<=current_time_stamp or last_seen<current_time_stamp-interval '30 seconds';
 insert into public.live_members(user_id,last_seen) values(me,current_time_stamp)
 on conflict(user_id) do update set last_seen=excluded.last_seen;
 update public.live_queue set last_seen=current_time_stamp where user_id=me;
 select conversation_id into cid from public.live_members where user_id=me;
 if cid is not null then select * into c from public.live_conversations where id=cid; end if;

 if p_action='join' then
  if p_data->>'kind' not in('text','voice') or p_data->>'kind' is null then raise exception 'invalid_kind'; end if;
  if c.status='active' then action_result:='already_matched';
  else
   select * into p from public.profiles where lower(email)=lower(auth.jwt()->>'email') order by created_at desc limit 1;
   if p.native_language is null or p.learning_language is null then raise exception 'complete_profile_first'; end if;
   if p.native_language=p.learning_language then raise exception 'choose_different_languages'; end if;
   select * into q from public.live_queue where user_id=me;
   if q.user_id is not null and q.kind<>p_data->>'kind' then delete from public.live_queue where user_id=me; end if;
   select x.user_id into peer from public.live_queue x
    where x.user_id<>me and x.kind=p_data->>'kind'
     and x.native_language=p.learning_language and x.learning_language=p.native_language
     and not exists(select 1 from public.live_members m join public.live_conversations cv on cv.id=m.conversation_id
       where m.user_id=x.user_id and cv.status='active')
    order by x.created_at,x.user_id limit 1;
   if peer is null then
    insert into public.live_queue(user_id,kind,native_language,learning_language)
     values(me,p_data->>'kind',p.native_language,p.learning_language)
     on conflict(user_id) do update set last_seen=current_time_stamp;
    cid:=null;
    delete from public.live_members where user_id=me;
    action_result:='waiting';
   else
    insert into public.live_conversations(user_a,user_b,kind) values(me,peer,p_data->>'kind') returning id into cid;
    insert into public.live_members(user_id,conversation_id,last_seen) values(me,cid,current_time_stamp),(peer,cid,current_time_stamp)
     on conflict(user_id) do update set conversation_id=excluded.conversation_id,last_seen=excluded.last_seen;
    delete from public.live_queue where user_id in(me,peer);
    if p_data->>'kind'='voice' then
     insert into public.live_calls(conversation_id,from_user,status,connected_at) values(cid,me,'accepted',now());
    end if;
    action_result:='matched';
   end if;
  end if;
 elsif p_action='cancel' then
  delete from public.live_queue where user_id=me;
  if c.status='active' then
   update public.live_conversations set status='ended',ended_at=now(),ended_reason='cancelled' where id=cid;
   update public.live_calls set status='ended',ended_at=coalesce(ended_at,now()),ended_reason='cancelled' where conversation_id=cid and status in('ringing','accepted');
  end if;
  action_result:='cancelled';
 elsif p_action='state' then null;
 else
  if cid is null or cid::text is distinct from p_data->>'conversationId' then raise exception 'not_a_participant'; end if;
  if c.status<>'active' then return jsonb_build_object('error','conversation_ended'); end if;
  peer:=case when c.user_a=me then c.user_b else c.user_a end;
  if p_action='message' then
   if length(btrim(coalesce(p_data->>'body',''))) not between 1 and 2000 then raise exception 'invalid_message'; end if;
   insert into public.live_messages(conversation_id,sender_id,client_id,body)
    values(cid,me,(p_data->>'clientId')::uuid,btrim(p_data->>'body')) on conflict(sender_id,client_id) do nothing;
  elsif p_action='invite' then
   select * into v from public.live_calls where conversation_id=cid and status in('ringing','accepted');
   if v.id is null then
    insert into public.live_calls(conversation_id,from_user) values(cid,me);
   end if;
  elsif p_action in('accept','decline','cancel_invite','end_call','signal') then
   select * into v from public.live_calls where id=(p_data->>'callId')::uuid and conversation_id=cid;
   if v.id is null then raise exception 'invalid_call'; end if;
   if p_action='accept' then
    if v.from_user=me then raise exception 'recipient_only'; end if;
    if v.status<>'ringing' then return jsonb_build_object('error','invite_no_longer_ringing'); end if;
    update public.live_calls set status='accepted',connected_at=now() where id=v.id;
   elsif p_action='decline' then
    if v.from_user=me then raise exception 'recipient_only'; end if;
    update public.live_calls set status='declined',ended_at=now() where id=v.id and status='ringing';
   elsif p_action='cancel_invite' then
    if v.from_user<>me then raise exception 'sender_only'; end if;
    update public.live_calls set status='cancelled',ended_at=now() where id=v.id and status='ringing';
   elsif p_action='end_call' then
    update public.live_calls set status='ended',ended_at=now(),ended_reason=left(coalesce(p_data->>'reason','hangup'),100)
     where id=v.id and status in('ringing','accepted');
   else
    if v.status<>'accepted' then return jsonb_build_object('error','call_not_active'); end if;
    insert into public.live_signals(call_id,sender_id,event,payload)
     values(v.id,me,p_data->>'event',coalesce(p_data->'payload','{}'));
    return jsonb_build_object('success',true);
   end if;
  elsif p_action='end' then
   update public.live_conversations set status='ended',ended_at=now(),ended_reason='user_left' where id=cid;
   update public.live_calls set status='ended',ended_at=coalesce(ended_at,now()),ended_reason='conversation_ended' where conversation_id=cid and status in('ringing','accepted');
  else raise exception 'invalid_action';
  end if;
 end if;
 -- Record history for the conversation this call just ended (covers the
 -- explicit "end", the cancel/match race, and end_call/decline/cancel
 -- paths above) — same idempotent on-conflict guard as the bulk case.
 if cid is not null then
  select * into c from public.live_conversations where id=cid;
  if c.status='ended' then
   insert into public.practice_sessions(conversation_id,user_a,user_b,kind,started_at,ended_at,duration_secs,ended_reason,
     native_language_a,learning_language_a,native_language_b,learning_language_b,call_connected_secs,message_count)
   select c.id, c.user_a, c.user_b, c.kind, c.created_at, c.ended_at,
     greatest(0, extract(epoch from (c.ended_at - c.created_at))::int), c.ended_reason,
     pa.native_language, pa.learning_language, pb.native_language, pb.learning_language,
     (select extract(epoch from (lc.ended_at - lc.connected_at))::int from public.live_calls lc
       where lc.conversation_id=c.id and lc.connected_at is not null order by lc.created_at desc limit 1),
     (select count(*)::int from public.live_messages lm where lm.conversation_id=c.id)
   from (select 1) dummy
   left join lateral (select native_language,learning_language from public.profiles where lower(email)=lower((select email from auth.users where id=c.user_a)) order by created_at desc limit 1) pa on true
   left join lateral (select native_language,learning_language from public.profiles where lower(email)=lower((select email from auth.users where id=c.user_b)) order by created_at desc limit 1) pb on true
   on conflict (conversation_id) do nothing;
  end if;
 end if;
 if cid is not null then
  select * into c from public.live_conversations where id=cid;
  peer:=case when c.user_a=me then c.user_b else c.user_a end;
  select jsonb_build_object('id',peer,'name',pr.name,'avatarUrl',pr.avatar_url,'countryCode',pr.country_code,
    'nativeLanguage',pr.native_language,'learningLanguage',pr.learning_language) into partner
   from public.profiles pr join auth.users u on lower(pr.email)=lower(u.email) where u.id=peer order by pr.created_at desc limit 1;
  select to_jsonb(x) into current_call from (select * from public.live_calls where conversation_id=cid order by created_at desc,id desc limit 1)x;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]') into messages from
   (select * from public.live_messages where conversation_id=cid order by id desc limit 100)x;
  result:=jsonb_build_object('conversation',to_jsonb(c),'partner',partner,'call',current_call,'messages',messages);
 else result:=jsonb_build_object('conversation',null,'messages','[]'::jsonb); end if;
 select * into q from public.live_queue where user_id=me;
 return result || jsonb_build_object('userId',me,'queue',case when q.user_id is null then null else to_jsonb(q) end,'result',action_result,
  'people', (select coalesce(jsonb_agg(to_jsonb(online)),'[]'::jsonb) from (
   select m.user_id as id, pr.name, pr.avatar_url as "avatarUrl", pr.country_code as "countryCode"
   from public.live_members m join auth.users u on u.id=m.user_id
   join lateral (select name,avatar_url,country_code from public.profiles where lower(email)=lower(u.email) order by created_at desc limit 1) pr on true
   where m.last_seen>current_time_stamp-interval '45 seconds' order by m.last_seen desc limit 64
  ) online));
end; $$;
revoke all on function public.live_exchange(text,jsonb) from public,anon;
grant execute on function public.live_exchange(text,jsonb) to authenticated;

-- ── Rollback ─────────────────────────────────────────────────────────────
-- drop table if exists public.practice_sessions;
-- alter table public.live_calls drop column if exists connected_at;
-- alter table public.live_calls drop column if exists ended_at;
-- (then re-apply 20261101052000_live_exchange.sql's original function body)

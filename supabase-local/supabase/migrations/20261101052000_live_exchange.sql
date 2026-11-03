-- Apply only to staging during this verification rollout.
alter table public.profiles add column if not exists country_code text;

-- Additive live exchange subsystem; independent of legacy scheduling/call tables.
create table public.live_conversations (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references auth.users(id), user_b uuid not null references auth.users(id),
 kind text not null check(kind in ('text','voice')),
 status text not null default 'active' check(status in ('active','ended')),
 created_at timestamptz not null default now(), ended_at timestamptz, ended_reason text,
 check(user_a <> user_b)
);
create table public.live_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 conversation_id uuid references public.live_conversations(id),
 last_seen timestamptz not null default now()
);
create table public.live_queue (
 user_id uuid primary key references auth.users(id) on delete cascade,
 kind text not null check(kind in ('text','voice')),
 native_language text not null, learning_language text not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '90 seconds',
 last_seen timestamptz not null default now()
);
create table public.live_messages (
 id bigint generated always as identity primary key,
 conversation_id uuid not null references public.live_conversations(id),
 sender_id uuid not null references auth.users(id), client_id uuid not null,
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(), unique(sender_id,client_id)
);
create index on public.live_messages(conversation_id,id);
create table public.live_calls (
 id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.live_conversations(id),
 from_user uuid not null references auth.users(id),
 status text not null default 'ringing' check(status in ('ringing','accepted','declined','cancelled','expired','ended')),
 created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '30 seconds',
 ended_reason text
);
create unique index live_one_call on public.live_calls(conversation_id) where status in ('ringing','accepted');
create table public.live_signals (
 id bigint generated always as identity primary key,
 call_id uuid not null references public.live_calls(id),
 sender_id uuid not null references auth.users(id),
 event text not null check(event in ('ready','offer','answer','ice')),
 payload jsonb not null default '{}', created_at timestamptz not null default now(),
 check(octet_length(payload::text) <= 65536)
);
create index on public.live_signals(call_id,id);

-- SELECT is participant-scoped. All writes go through one serialized RPC,
-- including signaling so call lifecycle checks cannot race an INSERT policy.
alter table public.live_conversations enable row level security;
alter table public.live_members enable row level security;
alter table public.live_queue enable row level security;
alter table public.live_messages enable row level security;
alter table public.live_calls enable row level security;
alter table public.live_signals enable row level security;
create policy participant_read on public.live_conversations for select to authenticated using(auth.uid() in(user_a,user_b));
create policy own_member_read on public.live_members for select to authenticated using(auth.uid()=user_id);
create policy own_queue_read on public.live_queue for select to authenticated using(auth.uid()=user_id);
create policy participant_read on public.live_messages for select to authenticated using(exists(
 select 1 from public.live_conversations c where c.id=conversation_id and auth.uid() in(c.user_a,c.user_b)));
create policy participant_read on public.live_calls for select to authenticated using(exists(
 select 1 from public.live_conversations c where c.id=conversation_id and auth.uid() in(c.user_a,c.user_b)));
create policy participant_read on public.live_signals for select to authenticated using(exists(
 select 1 from public.live_calls v join public.live_conversations c on c.id=v.conversation_id
 where v.id=call_id and auth.uid() in(c.user_a,c.user_b)));
grant select on public.live_conversations,public.live_members,public.live_queue,public.live_messages,public.live_calls,public.live_signals to authenticated;
revoke insert,update,delete on public.live_conversations,public.live_members,public.live_queue,public.live_messages,public.live_calls,public.live_signals from anon,authenticated;

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
 -- One short transaction at a time guarantees no double-pair or cancel/join race.
 -- Replace this global lock with ordered per-user locks before scaling traffic.
 perform pg_advisory_xact_lock(72601101);
 -- A peer disappearing cannot hold a session/queue indefinitely.
 update public.live_conversations x set status='ended',ended_at=now(),ended_reason='peer_left'
 where x.status='active' and exists(select 1 from public.live_members m
   where m.conversation_id=x.id and m.last_seen < current_time_stamp-interval '45 seconds');
 update public.live_calls x set status='ended',ended_reason='conversation_ended'
 where x.status in('ringing','accepted') and exists(select 1 from public.live_conversations c where c.id=x.conversation_id and c.status='ended');
 update public.live_calls set status='expired' where status='ringing' and expires_at<=current_time_stamp;
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
     insert into public.live_calls(conversation_id,from_user,status) values(cid,me,'accepted');
    end if;
    action_result:='matched';
   end if;
  end if;
 elsif p_action='cancel' then
  delete from public.live_queue where user_id=me;
  -- A match won the race with Cancel: release both sides rather than hiding it locally.
  if c.status='active' then
   update public.live_conversations set status='ended',ended_at=now(),ended_reason='cancelled' where id=cid;
   update public.live_calls set status='ended',ended_reason='cancelled' where conversation_id=cid and status in('ringing','accepted');
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
    update public.live_calls set status='accepted' where id=v.id;
   elsif p_action='decline' then
    if v.from_user=me then raise exception 'recipient_only'; end if;
    update public.live_calls set status='declined' where id=v.id and status='ringing';
   elsif p_action='cancel_invite' then
    if v.from_user<>me then raise exception 'sender_only'; end if;
    update public.live_calls set status='cancelled' where id=v.id and status='ringing';
   elsif p_action='end_call' then
    update public.live_calls set status='ended',ended_reason=left(coalesce(p_data->>'reason','hangup'),100)
     where id=v.id and status in('ringing','accepted');
   else
    if v.status<>'accepted' then return jsonb_build_object('error','call_not_active'); end if;
    insert into public.live_signals(call_id,sender_id,event,payload)
     values(v.id,me,p_data->>'event',coalesce(p_data->'payload','{}'));
    return jsonb_build_object('success',true);
   end if;
  elsif p_action='end' then
   update public.live_conversations set status='ended',ended_at=now(),ended_reason='user_left' where id=cid;
   update public.live_calls set status='ended',ended_reason='conversation_ended' where conversation_id=cid and status in('ringing','accepted');
  else raise exception 'invalid_action';
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

alter publication supabase_realtime add table public.live_conversations,public.live_messages,public.live_calls;

begin;
create or replace function public.practice_action(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare me uuid:=auth.uid();s public.voice_sessions%rowtype;c public.live_conversations%rowtype;v public.live_calls%rowtype;
 p public.profiles%rowtype;peer_profile public.profiles%rowtype;sid uuid;tid uuid;rid uuid;ids uuid[];valid integer;role_name text;outcome jsonb;
begin
 if me is null then raise exception 'not_authenticated';end if;
 perform pg_advisory_xact_lock(72601101);
 if exists(select 1 from public.profiles where public.owns_legacy_id(session_id) and banned_until>now()) then raise exception 'account_suspended';end if;
 perform public.cleanup_voice_sessions();
 if p_action='state' then
  select vs.* into s from public.voice_members m join public.voice_sessions vs on vs.id=m.session_id where m.user_id=me and vs.status<>'ended';
  if s.id is not null then update public.voice_members set last_seen=now() where user_id=me;end if;
  return jsonb_build_object('voice',case when s.id is null then null else to_jsonb(s) end);
 elsif p_action='ai_begin' then
  if p_data->>'consentVersion' is distinct from 'voice-log-v1' or coalesce((p_data->>'consent')::boolean,false)=false then raise exception 'consent_required';end if;
  if coalesce(p_data->>'topic','Casual conversation') not in('Casual conversation','Travel','Work','Culture','Daily life') or coalesce(p_data->>'level','') not in('','Beginner','Intermediate','Advanced') then raise exception 'invalid_conditions';end if;
  -- Same lock as human join: a match that already won cannot be displaced by AI.
  if exists(select 1 from public.live_members m join public.live_conversations lc on lc.id=m.conversation_id where m.user_id=me and lc.status='active') then raise exception 'human_match_already_active';end if;
  select vs.* into s from public.voice_members m join public.voice_sessions vs on vs.id=m.session_id where m.user_id=me and vs.status<>'ended';
  if s.id is not null then return to_jsonb(s);end if;
  select * into p from public.profiles where public.owns_legacy_id(session_id) order by created_at desc limit 1;
  if p.native_language is null or p.native_language='' or p.learning_language is null or p.learning_language='' then raise exception 'complete_profile_first';end if;
  delete from public.live_queue where user_id=me;
  insert into public.voice_sessions(user_a,partner_type,native_language_a,learning_language_a,topic,practice_level,consent_version,request_id)
   values(me,'ai',p.native_language,p.learning_language,left(coalesce(p_data->>'topic','Casual conversation'),120),nullif(left(p_data->>'level',40),''),'voice-log-v1',(p_data->>'requestId')::uuid)
   on conflict(user_a,request_id) do nothing returning * into s;
  if s.id is null then select * into s from public.voice_sessions where user_a=me and request_id=(p_data->>'requestId')::uuid;if s.status='ended' then raise exception 'request_already_ended';end if;end if;
  insert into public.voice_members(user_id,session_id) values(me,s.id) on conflict(user_id) do update set session_id=excluded.session_id,connected_at=null,last_seen=now();
  return to_jsonb(s);
 elsif p_action='connected' and p_data ? 'callId' then
  select * into v from public.live_calls where id=(p_data->>'callId')::uuid and status='accepted';
  select * into c from public.live_conversations where id=v.conversation_id and status='active';
  if c.id is null or me not in(c.user_a,c.user_b) then raise exception 'not_a_participant';end if;
  select * into p from public.profiles where session_id in(select legacy_session_id from public.legacy_identity_links where user_id=c.user_a) order by created_at desc limit 1;
  select * into peer_profile from public.profiles where session_id in(select legacy_session_id from public.legacy_identity_links where user_id=c.user_b) order by created_at desc limit 1;
  insert into public.voice_sessions(call_id,conversation_id,user_a,user_b,partner_type,native_language_a,learning_language_a,native_language_b,learning_language_b)
   values(v.id,c.id,c.user_a,c.user_b,'human',coalesce(p.native_language,''),coalesce(p.learning_language,''),peer_profile.native_language,peer_profile.learning_language)
   on conflict(call_id) do nothing;
  select * into s from public.voice_sessions where call_id=v.id;
  if s.status='ended' then raise exception 'call_not_active';end if;
  insert into public.voice_members(user_id,session_id,connected_at) values(me,s.id,now())
   on conflict(user_id) do update set session_id=excluded.session_id,connected_at=case when public.voice_members.session_id=excluded.session_id then coalesce(public.voice_members.connected_at,now()) else now() end,last_seen=now();
  if(select count(*) from public.voice_members where session_id=s.id and connected_at is not null)=2 then
   update public.voice_sessions set status='active',started_at=coalesce(started_at,clock_timestamp()),
    transcript_status=case when(select count(*) from public.voice_consents where conversation_id=c.id and allowed)=2 then 'collecting' else 'disabled' end,
    consent_version=case when(select count(*) from public.voice_consents where conversation_id=c.id and allowed)=2 then 'voice-log-v1' else null end where id=s.id returning * into s;
   update public.live_calls set connected_at=s.started_at where id=v.id;
  end if;
  return to_jsonb(s);
 end if;
 sid:=(p_data->>'sessionId')::uuid;
 select * into s from public.voice_sessions where id=sid and me in(user_a,user_b);
 if s.id is null then raise exception 'not_a_participant';end if;
 if p_action='connected' then
  if s.partner_type<>'ai' then raise exception 'call_ack_required';end if;
  if s.status='ended' then raise exception 'call_not_active';end if;
  update public.voice_sessions set status='active',started_at=coalesce(started_at,clock_timestamp()),transcript_status='collecting' where id=sid returning * into s;
  update public.voice_members set connected_at=coalesce(connected_at,now()),last_seen=now() where user_id=me and session_id=sid;
  return to_jsonb(s);
 elsif p_action='heartbeat' then
  update public.voice_members set last_seen=now() where user_id=me and session_id=sid;
  return to_jsonb(s);
 elsif p_action='end' then
  perform public.finish_voice_session(sid,coalesce(p_data->>'reason','hangup'));return jsonb_build_object('success',true);
 elsif p_action='transcript_status' then
  if p_data->>'status' not in('ready','partial','disabled') then raise exception 'invalid_status';end if;
  update public.voice_sessions set transcript_status=case when transcript_status='partial' then 'partial' else p_data->>'status' end where id=sid;
  return jsonb_build_object('success',true);
 elsif p_action='utterance' then
  if s.consent_version is null then raise exception 'consent_required';end if;
  if s.ended_at<now()-interval '2 minutes' then raise exception 'transcript_window_closed';end if;
  role_name:=coalesce(p_data->>'role','human');
  if role_name not in('human','assistant') or(role_name='assistant' and s.partner_type<>'ai') then raise exception 'invalid_speaker';end if;
  if length(coalesce(p_data->>'itemId','')) not between 1 and 200 or length(coalesce(p_data->>'body',''))>12000 then raise exception 'invalid_utterance';end if;
  insert into public.voice_utterances(session_id,speaker_id,speaker_role,provider_item_id,sequence,offset_ms,body,final)
   values(sid,me,role_name,p_data->>'itemId',(p_data->>'sequence')::integer,(p_data->>'offsetMs')::bigint,p_data->>'body',coalesce((p_data->>'final')::boolean,true))
   on conflict(session_id,speaker_id,speaker_role,provider_item_id) do update
    set body=excluded.body,final=excluded.final where not public.voice_utterances.final;
  return jsonb_build_object('success',true);
 elsif p_action='detail' then
  select id into tid from public.reflection_threads where session_id=sid and owner_id=me;
  return jsonb_build_object('session',to_jsonb(s),'utterances',(select coalesce(jsonb_agg(to_jsonb(u) order by coalesce(u.offset_ms,0),u.sequence,u.created_at,u.id),'[]') from public.voice_utterances u where u.session_id=sid),
   'thread',tid,'reflection',(select coalesce(jsonb_agg(to_jsonb(m) order by m.ordinal),'[]') from public.reflection_messages m where m.thread_id=tid));
 elsif p_action='review_prepare' then
  if length(btrim(coalesce(p_data->>'question',''))) not between 1 and 2000 then raise exception 'invalid_question';end if;
  if not exists(select 1 from public.voice_utterances where session_id=sid and final) then raise exception 'no_transcript';end if;
  ids:=array(select jsonb_array_elements_text(coalesce(p_data->'quotedIds','[]'))::uuid);
  if cardinality(ids)>10 then raise exception 'too_many_quotes';end if;
  select count(distinct id) into valid from public.voice_utterances where session_id=sid and id=any(ids) and final;
  if valid<>cardinality(ids) then raise exception 'invalid_quote';end if;
  insert into public.reflection_threads(session_id,owner_id) values(sid,me) on conflict(session_id,owner_id) do nothing;
  select id into tid from public.reflection_threads where session_id=sid and owner_id=me;
  rid:=(p_data->>'requestId')::uuid;
  if exists(select 1 from public.reflection_messages where thread_id=tid and role='assistant' and status='pending' and updated_at>now()-interval '90 seconds') then raise exception 'response_pending';end if;
  insert into public.reflection_messages(thread_id,request_id,role,body,quoted_utterance_ids)
   values(tid,rid,'user',btrim(p_data->>'question'),ids) on conflict(thread_id,request_id,role) do nothing;
  insert into public.reflection_messages(thread_id,request_id,role,status) values(tid,rid,'assistant','pending')
   on conflict(thread_id,request_id,role) do update set status='pending',error_code=null,updated_at=now() where public.reflection_messages.status<>'completed';
  return jsonb_build_object('threadId',tid,'session',to_jsonb(s),'utterances',(select coalesce(jsonb_agg(to_jsonb(u) order by coalesce(offset_ms,0),sequence,created_at),'[]') from public.voice_utterances u where session_id=sid and final),
   'messages',(select coalesce(jsonb_agg(to_jsonb(m) order by ordinal),'[]') from public.reflection_messages m where thread_id=tid));
 else raise exception 'invalid_action';end if;
end $$;

commit;

-- yonder: 「地球儀 × 今すぐ話す」(Phase 2以降)実装のための新規マイグレーション
-- Supabase SQLエディタで実行する(このリポジトリに自動実行の仕組みはないため手動実行)。
--
-- 既存の matches / scheduler 関連テーブルには一切触れない。
--
-- 【招待フロー(/auth/welcome)関連の変更は invite-flow-fix-migration.sql に分離済み】
-- このファイルは即時通話機能(地球儀・今すぐ話す・AI通話)専用。招待フローの
-- needs_welcome 列はそちらに含まれる。適用順序の制約はなく、どちらを先に適用してもよい。
--
-- 【適用状況メモ — 2026-10-31時点】
-- 以下の2行(goal/comm_styleのNOT NULL解除)は既に本番(mutuaプロジェクト)に
-- 適用済み・反映確認済み(is_nullable='YES'を確認済み)。再実行しても
-- 冪等(DROP NOT NULLは既にNULL許容な列に対しても安全にno-op)なので、
-- このファイルを後から通しで実行しても問題はない。
alter table profiles alter column goal        drop not null;
alter table profiles alter column comm_style  drop not null;

-- ── 事前確認(読み取り専用。2026-10-31時点で本番に対して実行し、結果を確認済み)──
-- 以下の6テーブル名が既存テーブルと衝突しないことを確認済み(結果: 0件 = 衝突なし)。
-- select table_name from information_schema.tables where table_schema='public'
--   and table_name in ('call_presence','call_status','call_invites','random_queue',
--                       'instant_sessions','instant_signaling');
-- 対象行数: このファイルは既存データを書き換えない(country_code列の追加は既存行に
-- NULLを埋めるだけで、新規テーブル群は全て空から始まるため、「対象件数」という
-- 意味でのリスクは実質ゼロ)。

-- ── Phase 2〜4 で必要な変更(地球儀・即時通話・AI通話。ここから先は本番未適用)────

alter table profiles add column if not exists country_code text;

-- 通話受付状態(地球儀に表示される「今話せる人」) — discoverabilityのみ。
-- 通話成立・失敗で is_available が変更されることは絶対にない。
create table if not exists call_presence (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  -- Internal join key only (never returned by the public API) — bridges to
  -- `profiles` for display fields, the same email-based pattern used
  -- throughout this codebase since profiles.id is unrelated to auth.uid().
  email              text        not null,
  is_available       boolean     not null default false,
  native_language    text,
  learning_language  text,
  country_code       text,
  updated_at         timestamptz not null default now(),
  last_heartbeat_at  timestamptz not null default now()
);
alter table call_presence enable row level security;
drop policy if exists call_presence_self on call_presence;
create policy call_presence_self on call_presence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 接続意思・状態(全認証ユーザーが対象。is_availableがfalseでも持てる)
create table if not exists call_status (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  status     text not null default 'idle', -- idle | ringing_out | ringing_in | queued_random | in_call
  updated_at timestamptz not null default now()
);
alter table call_status enable row level security;
drop policy if exists call_status_select_self on call_status;
create policy call_status_select_self on call_status for select using (auth.uid() = user_id);

-- 招待(相手を指名した呼び出し)
create table if not exists call_invites (
  id            uuid primary key default gen_random_uuid(),
  from_user_id  uuid not null references auth.users(id),
  to_user_id    uuid not null references auth.users(id),
  status        text not null default 'ringing', -- ringing | accepted | declined | cancelled
  session_id    uuid,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz
);
alter table call_invites enable row level security;
drop policy if exists call_invites_select_participant on call_invites;
create policy call_invites_select_participant on call_invites
  for select using (auth.uid() = from_user_id or auth.uid() = to_user_id);

-- ランダム待機(「今すぐ話す」用、相手を指名しない)
create table if not exists random_queue (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  native_language    text not null,
  learning_language  text not null,
  queued_at          timestamptz not null default now()
);
alter table random_queue enable row level security;
drop policy if exists random_queue_select_self on random_queue;
create policy random_queue_select_self on random_queue for select using (auth.uid() = user_id);

-- 通話セッション本体(matchesの代わり。予約データには一切依存しない)
create table if not exists instant_sessions (
  id           uuid primary key default gen_random_uuid(),
  user_a_id    uuid not null references auth.users(id),
  user_b_id    uuid references auth.users(id), -- AI通話時はnull
  is_ai        boolean not null default false,
  status       text not null default 'active', -- active | ended
  created_at   timestamptz not null default now(),
  ended_at     timestamptz,
  ended_reason text
);
alter table instant_sessions enable row level security;
drop policy if exists instant_sessions_select_participant on instant_sessions;
create policy instant_sessions_select_participant on instant_sessions
  for select using (auth.uid() = user_a_id or auth.uid() = user_b_id);

-- 専用シグナリング(既存signalingとは分離。最初から本物のRLSで権限を保証する)
create table if not exists instant_signaling (
  id         bigint generated always as identity primary key,
  session_id uuid not null references instant_sessions(id) on delete cascade,
  from_user  uuid not null,
  to_user    uuid not null,
  event      text not null,
  payload    jsonb,
  created_at timestamptz not null default now()
);
alter table instant_signaling enable row level security;
drop policy if exists instant_signaling_select on instant_signaling;
create policy instant_signaling_select on instant_signaling for select using (
  exists (select 1 from instant_sessions s where s.id = instant_signaling.session_id
    and (auth.uid() = s.user_a_id or auth.uid() = s.user_b_id)));
drop policy if exists instant_signaling_insert on instant_signaling;
create policy instant_signaling_insert on instant_signaling for insert with check (
  from_user = auth.uid() and
  exists (select 1 from instant_sessions s where s.id = instant_signaling.session_id
    and (auth.uid() = s.user_a_id or auth.uid() = s.user_b_id)));
drop policy if exists instant_signaling_delete on instant_signaling;
create policy instant_signaling_delete on instant_signaling for delete using (
  exists (select 1 from instant_sessions s where s.id = instant_signaling.session_id
    and (auth.uid() = s.user_a_id or auth.uid() = s.user_b_id)));
-- updateポリシーは与えない(メッセージは常にinsert/deleteのみ)

-- ── RPC群:すべて auth.uid() を内部で使い、「自分」は引数で受け取らない ──────────

create or replace function send_call_invite(p_to uuid)
returns uuid language plpgsql security definer as $$
declare v_me uuid := auth.uid(); v_invite_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if v_me = p_to then raise exception 'cannot_invite_self'; end if;

  insert into call_status (user_id, status) values (v_me, 'ringing_out')
    on conflict (user_id) do update set status = 'ringing_out', updated_at = now()
    where call_status.status = 'idle';
  if not found then raise exception 'self_busy'; end if;

  insert into call_status (user_id, status) values (p_to, 'ringing_in')
    on conflict (user_id) do update set status = 'ringing_in', updated_at = now()
    where call_status.status = 'idle';
  if not found then
    raise exception 'target_busy';
  end if;

  if not exists (select 1 from call_presence where user_id = p_to and is_available = true
                 and last_heartbeat_at > now() - interval '30 seconds') then
    raise exception 'target_unavailable';
  end if;

  insert into call_invites (from_user_id, to_user_id) values (v_me, p_to) returning id into v_invite_id;
  return v_invite_id;
end; $$;

-- Returns 'accepted:<session_id>' | 'declined' | 'expired'.
-- IMPORTANT: expiry is a routine, expected outcome — NOT signaled via
-- `raise exception`. A raised exception rolls back everything this function
-- invocation did, including its own cleanup updates (confirmed by testing:
-- an earlier version that did `update ...; raise exception 'invite_expired'`
-- left call_invites stuck at 'ringing' and call_status stuck busy forever,
-- because the cleanup updates were rolled back along with the exception).
-- `not_found`/`not_the_recipient` stay real exceptions — those indicate a
-- caller bug or stale/tampered client state, never a routine outcome.
create or replace function respond_call_invite(p_invite_id uuid, p_accept boolean)
returns text language plpgsql security definer as $$
declare v_me uuid := auth.uid(); v_from uuid; v_to uuid; v_created timestamptz; v_session_id uuid;
begin
  select from_user_id, to_user_id, created_at into v_from, v_to, v_created from call_invites
    where id = p_invite_id and status = 'ringing' for update;
  if v_to is null then raise exception 'invite_not_found_or_resolved'; end if;
  if v_to <> v_me then raise exception 'not_the_recipient'; end if;

  -- Lazy expiry: a ring older than 25s is treated as unanswered. Release both
  -- sides back to idle (never touches is_available) instead of processing
  -- the (stale) accept/decline.
  if v_created < now() - interval '25 seconds' then
    update call_invites set status = 'expired', responded_at = now() where id = p_invite_id;
    update call_status set status = 'idle' where user_id in (v_from, v_to);
    return 'expired';
  end if;

  if p_accept then
    insert into instant_sessions (user_a_id, user_b_id) values (v_from, v_to) returning id into v_session_id;
    update call_invites set status = 'accepted', session_id = v_session_id, responded_at = now() where id = p_invite_id;
    update call_status set status = 'in_call' where user_id in (v_from, v_to);
    return 'accepted:' || v_session_id::text;
  else
    update call_invites set status = 'declined', responded_at = now() where id = p_invite_id;
    update call_status set status = 'idle' where user_id in (v_from, v_to);
    return 'declined';
  end if;
end; $$;

create or replace function cancel_call_invite(p_invite_id uuid)
returns void language plpgsql security definer as $$
declare v_me uuid := auth.uid(); v_from uuid; v_to uuid;
begin
  select from_user_id, to_user_id into v_from, v_to from call_invites
    where id = p_invite_id and status = 'ringing' for update;
  if v_from is null then return; end if;
  if v_from <> v_me then raise exception 'not_the_caller'; end if;
  update call_invites set status = 'cancelled', responded_at = now() where id = p_invite_id;
  update call_status set status = 'idle' where user_id in (v_from, v_to);
end; $$;

create or replace function join_random_queue(p_native text, p_learning text)
returns uuid language plpgsql security definer as $$
declare v_me uuid := auth.uid(); v_target uuid; v_session_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;

  insert into call_status (user_id, status) values (v_me, 'queued_random')
    on conflict (user_id) do update set status = 'queued_random', updated_at = now()
    where call_status.status = 'idle';
  if not found then raise exception 'self_busy'; end if;

  insert into random_queue (user_id, native_language, learning_language) values (v_me, p_native, p_learning)
    on conflict (user_id) do update set native_language = p_native, learning_language = p_learning, queued_at = now();

  select rq.user_id into v_target from random_queue rq
    join call_status cs on cs.user_id = rq.user_id and cs.status = 'queued_random'
    where rq.user_id <> v_me and rq.native_language = p_learning and rq.learning_language = p_native
    order by rq.queued_at asc limit 1 for update skip locked;

  if v_target is null then return null; end if;

  insert into instant_sessions (user_a_id, user_b_id) values (v_me, v_target) returning id into v_session_id;
  update call_status set status = 'in_call' where user_id in (v_me, v_target);
  delete from random_queue where user_id in (v_me, v_target);
  return v_session_id;
end; $$;

create or replace function cancel_random_queue()
returns void language plpgsql security definer as $$
declare v_me uuid := auth.uid();
begin
  delete from random_queue where user_id = v_me;
  update call_status set status = 'idle' where user_id = v_me and status = 'queued_random';
end; $$;

create or replace function end_instant_session(p_session_id uuid, p_reason text)
returns void language plpgsql security definer as $$
declare v_me uuid := auth.uid(); v_a uuid; v_b uuid;
begin
  select user_a_id, user_b_id into v_a, v_b from instant_sessions where id = p_session_id;
  if v_a is null or (v_me <> v_a and v_me <> v_b) then raise exception 'not_a_participant'; end if;
  update instant_sessions set status = 'ended', ended_at = now(), ended_reason = p_reason where id = p_session_id;
  update call_status set status = 'idle' where user_id in (v_a, v_b);
  delete from instant_signaling where session_id = p_session_id;
end; $$;

-- ── 適用順序 ──
-- invite-flow-fix-migration.sql とは独立。前後どちらでもよい。
-- このファイル内では上から順に実行する必要がある(RPC群が新規テーブルを参照するため)。

-- ── 失敗時の復旧手順 ──
-- 途中で失敗した場合、作成済みの分だけ取り消す(存在しないオブジェクトのDROPは
-- IF EXISTSによりエラーにならないため、以下を一括で流してよい):
--
-- drop function if exists end_instant_session(uuid, text);
-- drop function if exists cancel_random_queue();
-- drop function if exists join_random_queue(text, text);
-- drop function if exists cancel_call_invite(uuid);
-- drop function if exists respond_call_invite(uuid, boolean);
-- drop function if exists send_call_invite(uuid);
-- drop table if exists instant_signaling;
-- drop table if exists instant_sessions;
-- drop table if exists random_queue;
-- drop table if exists call_invites;
-- drop table if exists call_status;
-- drop table if exists call_presence;
-- -- country_code は既存profilesへの追加列なので、他機能(国選択UI等)が
-- -- 既に使っていない前提でのみ: alter table profiles drop column if exists country_code;
-- -- goal/comm_styleのNOT NULL解除は取り消さない(Phase 1の既存ユーザー互換性維持に必須のため)。

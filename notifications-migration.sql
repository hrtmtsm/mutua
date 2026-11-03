-- Notifications table
-- Each row is a discrete event shown in the notifications feed.

create table if not exists notifications (
  id           uuid        primary key default gen_random_uuid(),
  session_id   text        not null,   -- recipient
  match_id     uuid        references matches(id) on delete cascade,
  type         text        not null,   -- 'matched' | 'partner_availability' | 'scheduled' | 'no_overlap' | 'session_soon' | 'new_message'
  actor_name   text,                   -- partner's display name
  actor_avatar text,                   -- partner's avatar_url
  body         text        not null,   -- notification message text
  link         text,                   -- where to navigate on tap
  seen         boolean     not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists notifications_session_id_idx on notifications (session_id, created_at desc);

alter table notifications enable row level security;
create policy "notifications_select" on notifications for select using (true);
create policy "notifications_insert" on notifications for insert with check (true);
create policy "notifications_update" on notifications for update using (true);

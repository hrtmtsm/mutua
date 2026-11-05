begin;
-- Shorten the text/voice matching queue from 90s to 30s before a searcher
-- sees the "no partner found, try AI?" modal — product decision 2026-11-04.
alter table public.live_queue alter column expires_at set default now() + interval '30 seconds';
commit;

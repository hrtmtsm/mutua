insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('call-recordings', 'call-recordings', false, 3500000, array['audio/webm', 'audio/mp4'])
on conflict (id) do nothing;

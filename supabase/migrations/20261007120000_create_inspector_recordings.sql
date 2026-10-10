alter table public.inspector_attempts
  add column if not exists recording_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspector-recordings',
  'inspector-recordings',
  false,
  104857600,
  array['video/webm', 'video/mp4']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.chat_messages (
  id text primary key default gen_random_uuid()::text,
  subject_id text not null references public.subjects(id) on delete cascade,
  username text not null,
  display_name text not null,
  role text not null,
  message text not null check (char_length(message) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists idx_chat_subject_date on public.chat_messages(subject_id, created_at);
alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from public, anon, authenticated;
grant all on public.chat_messages to service_role;


create table if not exists public.canvas_sessions (
  token_hash text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_canvas_sessions_expiry on public.canvas_sessions(expires_at);
alter table public.canvas_sessions enable row level security;
revoke all on public.canvas_sessions from anon, authenticated, public;

create or replace function public.canvas_hash_password(p_password text)
returns text
language sql
security definer
set search_path = public, extensions
as $$
  select extensions.crypt(p_password, extensions.gen_salt('bf', 12));
$$;

create or replace function public.canvas_authenticate(
  p_username text,
  p_password text,
  p_roles text[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare u public.app_users%rowtype;
begin
  select * into u
  from public.app_users
  where lower(username) = lower(trim(p_username))
    and (p_roles is null or role = any(p_roles))
  limit 1;

  if not found or u.status <> 'Activo'
     or extensions.crypt(p_password, u.password_hash) <> u.password_hash then
    raise exception 'Usuario o contraseña incorrectos.';
  end if;

  return jsonb_build_object(
    'id', u.id, 'usuario', u.username, 'nombre', u.full_name,
    'grupo', u.group_name, 'rol', u.role, 'email', u.email
  );
end;
$$;

revoke all on function public.canvas_hash_password(text) from public, anon, authenticated;
revoke all on function public.canvas_authenticate(text,text,text[]) from public, anon, authenticated;
grant execute on function public.canvas_hash_password(text) to service_role;
grant execute on function public.canvas_authenticate(text,text,text[]) to service_role;
revoke all on function public.canvas_login(text,text) from public, anon, authenticated;
grant all on public.canvas_sessions to service_role;

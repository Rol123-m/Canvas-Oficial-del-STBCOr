create extension if not exists pgcrypto with schema extensions;

create table if not exists public.app_users (
 id uuid primary key default gen_random_uuid(), username text not null unique,
 full_name text not null, password_hash text not null,
 role text not null check (role in ('estudiante','profesor','rector','decano','secretaria')),
 group_name text, email text, status text not null default 'Activo',
 created_at timestamptz not null default now()
);
create table if not exists public.subjects (
 id text primary key, name text not null, description text not null default '',
 color text not null default '#14385c',
 professor_username text references public.app_users(username) on update cascade on delete set null,
 professor_name text not null default '', chat_open boolean not null default false,
 created_at timestamptz not null default now()
);
create table if not exists public.enrollments (
 id text primary key default gen_random_uuid()::text,
 subject_id text not null references public.subjects(id) on delete cascade,
 student_username text not null references public.app_users(username) on update cascade on delete cascade,
 group_name text not null default '', enrolled_at timestamptz not null default now(),
 unique(subject_id, student_username)
);
create table if not exists public.modules (
 id text primary key default gen_random_uuid()::text,
 subject_id text not null references public.subjects(id) on delete cascade,
 title text not null, icon text not null default 'fa-book', kind text not null default 'contenido',
 content text not null default '', sort_order integer not null default 1, visible boolean not null default true
);
create table if not exists public.exams (
 id text primary key default gen_random_uuid()::text,
 subject_id text not null references public.subjects(id) on delete cascade,
 title text not null, description text not null default '', visible boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.questions (
 id text primary key default gen_random_uuid()::text,
 exam_id text not null references public.exams(id) on delete cascade,
 kind text not null default 'sm', prompt text not null, options jsonb not null default '[]'::jsonb,
 correct_answer integer not null default 0, points numeric not null default 1, sort_order integer not null default 1
);
create table if not exists public.exam_attempts (
 id text primary key default gen_random_uuid()::text,
 exam_id text not null references public.exams(id) on delete cascade,
 student_username text not null references public.app_users(username) on update cascade on delete cascade,
 student_name text not null, attempted_at timestamptz not null default now(),
 score numeric not null default 0, total numeric not null default 0, answers jsonb not null default '[]'::jsonb
);
create table if not exists public.progress (
 id text primary key default gen_random_uuid()::text,
 subject_id text not null references public.subjects(id) on delete cascade,
 student_username text not null references public.app_users(username) on update cascade on delete cascade,
 student_name text not null, item_type text not null, item_id text not null,
 completed boolean not null default false, updated_at timestamptz not null default now(),
 unique(subject_id,student_username,item_type,item_id)
);
create table if not exists public.announcements (
 id text primary key default gen_random_uuid()::text,
 subject_id text not null references public.subjects(id) on delete cascade,
 title text not null, body text not null, tag text not null default 'Aviso',
 author text not null, published_at timestamptz not null default now(), pinned boolean not null default false
);
create table if not exists public.forum_messages (
 id text primary key default gen_random_uuid()::text,
 subject_id text not null references public.subjects(id) on delete cascade,
 username text not null, display_name text not null, role text not null,
 message text not null check (char_length(message) <= 1000),
 created_at timestamptz not null default now()
);

create index if not exists idx_enrollments_student on public.enrollments(student_username);
create index if not exists idx_modules_subject on public.modules(subject_id,sort_order);
create index if not exists idx_exams_subject on public.exams(subject_id);
create index if not exists idx_questions_exam on public.questions(exam_id,sort_order);
create index if not exists idx_attempts_exam_user on public.exam_attempts(exam_id,student_username);
create index if not exists idx_attempts_student on public.exam_attempts(student_username);
create index if not exists idx_progress_subject_user on public.progress(subject_id,student_username);
create index if not exists idx_progress_student on public.progress(student_username);
create index if not exists idx_subjects_professor on public.subjects(professor_username);
create index if not exists idx_announcements_subject on public.announcements(subject_id,published_at desc);
create index if not exists idx_forum_subject_date on public.forum_messages(subject_id,created_at);

alter table public.app_users enable row level security;
alter table public.subjects enable row level security;
alter table public.enrollments enable row level security;
alter table public.modules enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.progress enable row level security;
alter table public.announcements enable row level security;
alter table public.forum_messages enable row level security;

revoke all on public.app_users, public.subjects, public.enrollments, public.modules, public.exams, public.questions, public.exam_attempts, public.progress, public.announcements, public.forum_messages from anon, authenticated;

create or replace function public.canvas_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare u public.app_users%rowtype;
begin
 select * into u from public.app_users where lower(username)=lower(trim(p_username));
 if not found or u.status <> 'Activo' or extensions.crypt(p_password,u.password_hash) <> u.password_hash then
   raise exception 'Usuario o contraseña incorrectos.';
 end if;
 return jsonb_build_object('nombre',u.full_name,'usuario',u.username,'grupo',u.group_name,'rol',u.role,'email',u.email);
end; $$;
revoke all on function public.canvas_login(text,text) from public;
grant execute on function public.canvas_login(text,text) to anon, authenticated;

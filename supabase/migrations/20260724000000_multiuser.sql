-- Multi-user schema for the study-plan tracker product pivot.
-- Every user-owned table carries user_id uuid not null default auth.uid(),
-- RLS enabled, one "for all" policy scoped to the authenticated user.
-- NO api_key column anywhere: users' AI provider keys live in localStorage only.
--
-- Run this in a FRESH Supabase project. The existing personal project
-- (REDACTED_SUPABASE_REF) keeps its open-RLS tables so the personal app is unaffected.

-- gen_random_uuid() lives in pgcrypto (present by default on Supabase, but be explicit).
create extension if not exists pgcrypto;

-- ── shared updated_at trigger ──────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── profiles ───────────────────────────────────────────────────────────────
-- One row per user. chosen_provider is the NAME of the AI provider only
-- ("anthropic" | "openai" | ...). The actual API key is NEVER stored here.
create table public.profiles (
  user_id              uuid primary key
                         references auth.users(id) on delete cascade
                         default auth.uid(),
  name                 text,
  college              text,
  chosen_provider      text,
  attendance_threshold int  not null default 75,
  timezone             text not null default 'Asia/Kolkata',
  prefs                jsonb not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ── subjects ─────────────────────────────────────────────────────────────
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  code        text,                         -- e.g. CE301
  name        text not null,                -- e.g. Distributed Computing
  credits     numeric,
  color       text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ── plans (jsonb blob per named plan) ─────────────────────────────────────
create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name        text not null default 'default',
  data        jsonb not null default '{}'::jsonb,   -- the generated schedule / plan
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── progress (task done-state, keyed by task id text) ─────────────────────
create table public.progress (
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id          text not null,                -- task id, e.g. p-904.
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ── pushed (rescheduled tasks) ────────────────────────────────────────────
create table public.pushed (
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id          text not null,                -- task id
  to_date     date not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, id)
);

-- ── attendance ────────────────────────────────────────────────────────────
create table public.attendance (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  subject_id  uuid references public.subjects(id) on delete cascade,
  on_date     date not null,
  status      text not null default 'present'
                check (status in ('present','absent','cancelled','holiday')),
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, subject_id, on_date)
);

-- ── exams ─────────────────────────────────────────────────────────────────
create table public.exams (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade default auth.uid(),
  subject_id   uuid references public.subjects(id) on delete cascade,
  title        text not null,
  exam_date    date,
  kind         text default 'theory'
                 check (kind in ('theory','practical','viva','ise','other')),
  total_marks  numeric,
  scored_marks numeric,
  created_at   timestamptz not null default now()
);

-- ── opportunities ─────────────────────────────────────────────────────────
create table public.opportunities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title       text not null,
  due_date    date,
  url         text,
  why         text,
  kind        text not null default 'deadline'
                check (kind in ('deadline','event','admin')),
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ── updated_at triggers ───────────────────────────────────────────────────
create trigger t_profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger t_plans_updated before update on public.plans
  for each row execute function public.set_updated_at();
create trigger t_progress_updated before update on public.progress
  for each row execute function public.set_updated_at();
create trigger t_pushed_updated before update on public.pushed
  for each row execute function public.set_updated_at();

-- ── indexes ───────────────────────────────────────────────────────────────
-- progress & pushed already have user_id as the leading PK column (indexed).
create index idx_subjects_user       on public.subjects(user_id);
create index idx_plans_user          on public.plans(user_id);
create index idx_attendance_user     on public.attendance(user_id);
create index idx_attendance_subject  on public.attendance(user_id, subject_id, on_date);
create index idx_exams_user          on public.exams(user_id);
create index idx_exams_date          on public.exams(user_id, exam_date);
create index idx_opportunities_user  on public.opportunities(user_id);
create index idx_opportunities_due   on public.opportunities(user_id, due_date);

-- ── enable RLS ────────────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.subjects       enable row level security;
alter table public.plans          enable row level security;
alter table public.progress       enable row level security;
alter table public.pushed         enable row level security;
alter table public.attendance     enable row level security;
alter table public.exams          enable row level security;
alter table public.opportunities  enable row level security;

-- ── per-user policies ─────────────────────────────────────────────────────
-- (select auth.uid()) so the uid is evaluated once per query, not per row.
-- Scoped to the authenticated role so the anon role never matches.
create policy p_profiles on public.profiles
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_subjects on public.subjects
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_plans on public.plans
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_progress on public.progress
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_pushed on public.pushed
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_attendance on public.attendance
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_exams on public.exams
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy p_opportunities on public.opportunities
  for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ── auto-create a profile row when a user signs up ────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Canonical local reference for the generic per-user Tracker tables.
-- Apply migrations/20260724000000_multiuser.sql to a fresh Supabase project.
-- No anonymous policies or domain-specific tables belong in the product schema.

create table if not exists public.progress (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.pushed (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  to_date date not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.progress enable row level security;
alter table public.pushed enable row level security;

create policy p_progress on public.progress for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy p_pushed on public.pushed for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

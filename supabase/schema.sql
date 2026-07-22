-- Campaign tracker: one row per completed thing, keyed by a device-shared user id.
create table if not exists progress (
  id          text primary key,          -- task id, e.g. p-904. Fruit Into Baskets
  done        boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists pushed (
  id          text primary key,          -- task id
  to_date     date not null,
  updated_at  timestamptz not null default now()
);

-- Opportunities Claude can insert into later (hackathons, deadlines, programs).
create table if not exists opportunities (
  id          bigserial primary key,
  title       text not null,
  due_date    date,
  url         text,
  why         text,
  kind        text default 'deadline',   -- deadline | event | admin
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table progress      enable row level security;
alter table pushed        enable row level security;
alter table opportunities enable row level security;

-- Single-user personal tracker: anon key may read/write. No auth flow to babysit.
drop policy if exists p_all on progress;
drop policy if exists u_all on pushed;
drop policy if exists o_all on opportunities;
create policy p_all on progress      for all using (true) with check (true);
create policy u_all on pushed        for all using (true) with check (true);
create policy o_all on opportunities for all using (true) with check (true);

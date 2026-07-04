-- ════════════════════════════════════════════════════════════════════
-- Executive OS — initial schema
-- AI-powered executive command centre for a CEO.
--
-- This migration creates the core domain tables, enums, row-level
-- security policies, and a pgvector-ready `embeddings` column so the
-- database can later power semantic search / AI retrieval.
-- ════════════════════════════════════════════════════════════════════

-- ── Extensions ──────────────────────────────────────────────────────
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "vector";      -- pgvector (embeddings)

-- ── Enums ───────────────────────────────────────────────────────────
do $$ begin
  create type task_status as enum ('todo', 'in_progress', 'blocked', 'done');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_priority as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

do $$ begin
  create type decision_status as enum ('proposed', 'approved', 'rejected', 'deferred');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meeting_status as enum ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type opportunity_stage as enum (
    'prospect', 'qualified', 'proposal', 'negotiation', 'won', 'lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type risk_level as enum ('low', 'medium', 'high', 'critical');
exception when duplicate_object then null; end $$;

-- ── Helper: updated_at trigger ──────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ════════════════════════════════════════════════════════════════════
-- profiles — 1:1 with auth.users
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text,
  title        text,
  company_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Automatically create a profile row when a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ════════════════════════════════════════════════════════════════════
-- companies
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  industry    text,
  website     text,
  location    text,
  size        text,
  description text,
  logo_url    text,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- contacts
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete set null,
  full_name   text not null,
  role        text,
  email       text,
  phone       text,
  linkedin_url text,
  notes       text,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- meetings
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete set null,
  title       text not null,
  status      meeting_status not null default 'scheduled',
  location    text,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz,
  attendees   text[] not null default '{}',
  agenda      text,
  notes       text,
  summary     text,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- tasks
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  company_id  uuid references public.companies (id) on delete set null,
  title       text not null,
  description text,
  status      task_status not null default 'todo',
  priority    task_priority not null default 'medium',
  due_date    date,
  assignee    text,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- decisions
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.decisions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  company_id    uuid references public.companies (id) on delete set null,
  title         text not null,
  context       text,
  options       text,
  decision      text,
  rationale     text,
  status        decision_status not null default 'proposed',
  decided_at    date,
  embedding     vector(1536),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- opportunities
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.opportunities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  company_id    uuid references public.companies (id) on delete set null,
  name          text not null,
  stage         opportunity_stage not null default 'prospect',
  value         numeric(14, 2),
  currency      text not null default 'USD',
  probability   int check (probability between 0 and 100),
  close_date    date,
  owner         text,
  notes         text,
  embedding     vector(1536),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- risks — surfaced on the dashboard
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.risks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  title        text not null,
  description  text,
  level        risk_level not null default 'medium',
  mitigation   text,
  is_open      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ════════════════════════════════════════════════════════════════════
-- daily_briefs — one AI-generated brief per day
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.daily_briefs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  brief_date   date not null default current_date,
  headline     text,
  summary      text,
  highlights   text[] not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, brief_date)
);

-- ════════════════════════════════════════════════════════════════════
-- ai_agents — the executive's AI staff
-- ════════════════════════════════════════════════════════════════════
create table if not exists public.ai_agents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  role         text not null,
  description  text,
  status       text not null default 'active',
  accent       text,
  last_active  timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ── updated_at triggers ─────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','companies','contacts','meetings','tasks','decisions',
    'opportunities','risks','daily_briefs','ai_agents'
  ] loop
    execute format(
      'drop trigger if exists set_%1$s_updated_at on public.%1$s;', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ── Indexes ─────────────────────────────────────────────────────────
create index if not exists idx_companies_user       on public.companies (user_id);
create index if not exists idx_contacts_user        on public.contacts (user_id);
create index if not exists idx_contacts_company     on public.contacts (company_id);
create index if not exists idx_meetings_user        on public.meetings (user_id);
create index if not exists idx_meetings_starts_at   on public.meetings (starts_at);
create index if not exists idx_tasks_user           on public.tasks (user_id);
create index if not exists idx_tasks_status         on public.tasks (status);
create index if not exists idx_decisions_user       on public.decisions (user_id);
create index if not exists idx_opportunities_user   on public.opportunities (user_id);
create index if not exists idx_opportunities_stage  on public.opportunities (stage);
create index if not exists idx_risks_user           on public.risks (user_id);
create index if not exists idx_daily_briefs_user    on public.daily_briefs (user_id);
create index if not exists idx_ai_agents_user       on public.ai_agents (user_id);

-- ── pgvector indexes (approximate nearest neighbour) ────────────────
-- Ready for semantic search once embeddings are populated.
create index if not exists idx_companies_embedding
  on public.companies using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_contacts_embedding
  on public.contacts using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_meetings_embedding
  on public.meetings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_tasks_embedding
  on public.tasks using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_decisions_embedding
  on public.decisions using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_opportunities_embedding
  on public.opportunities using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ════════════════════════════════════════════════════════════════════
-- Row Level Security — every row is owned by a user.
-- ════════════════════════════════════════════════════════════════════
alter table public.profiles       enable row level security;
alter table public.companies      enable row level security;
alter table public.contacts       enable row level security;
alter table public.meetings       enable row level security;
alter table public.tasks          enable row level security;
alter table public.decisions      enable row level security;
alter table public.opportunities  enable row level security;
alter table public.risks          enable row level security;
alter table public.daily_briefs   enable row level security;
alter table public.ai_agents      enable row level security;

-- profiles: a user can see & edit only their own profile.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

-- Generic owner-based policies for every domain table.
do $$
declare t text;
begin
  foreach t in array array[
    'companies','contacts','meetings','tasks','decisions',
    'opportunities','risks','daily_briefs','ai_agents'
  ] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_select_own" on public.%1$s
         for select using (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_insert_own" on public.%1$s
         for insert with check (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_update_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_update_own" on public.%1$s
         for update using (auth.uid() = user_id);', t);

    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s;', t);
    execute format(
      'create policy "%1$s_delete_own" on public.%1$s
         for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

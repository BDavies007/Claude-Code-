-- ════════════════════════════════════════════════════════════════════
-- Executive OS — integrations foundation (Phase 0)
--
-- Additive migration for Google Calendar / Gmail / Drive ingestion, an
-- n8n-driven sync layer, and pgvector-backed document search (RAG).
-- Nothing in 0001_init.sql changes. See docs/INTEGRATIONS.md.
-- ════════════════════════════════════════════════════════════════════

-- ── Connected external accounts (one per user per provider) ─────────
create table if not exists public.integration_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  provider      text not null,                    -- 'google'
  email         text,
  scopes        text[] not null default '{}',
  access_token  text,                             -- encrypted at rest
  refresh_token text,                             -- encrypted at rest
  expires_at    timestamptz,
  status        text not null default 'connected',-- connected|error|revoked
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- ── Per-connector sync cursor + status ──────────────────────────────
create table if not exists public.sync_state (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  connector      text not null,                   -- 'gcal'|'gmail'|'gdrive'
  cursor         text,                            -- syncToken/historyId/pageToken
  last_synced_at timestamptz,
  status         text not null default 'idle',    -- idle|running|error
  last_error     text,
  updated_at     timestamptz not null default now(),
  unique (user_id, connector)
);

-- ── Audit trail of sync runs (observability) ────────────────────────
create table if not exists public.sync_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  connector      text not null,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running', -- running|success|error
  items_upserted int not null default 0,
  error          text
);

-- ── Generic external-id map: idempotency + de-dupe across any table ──
create table if not exists public.external_links (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  provider     text not null,                     -- 'google'
  source       text not null,                     -- 'gcal'|'gmail'|'gdrive'
  external_id  text not null,                     -- event/message/file id
  entity_table text not null,                     -- 'meetings'|'tasks'|'contacts'|'documents'
  entity_id    uuid not null,
  raw          jsonb,
  synced_at    timestamptz not null default now(),
  unique (user_id, source, external_id)
);

-- ── Drive-backed documents ──────────────────────────────────────────
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null,
  source        text,                             -- 'gdrive'
  mime_type     text,
  drive_file_id text,
  web_url       text,
  content       text,
  embedding     vector(1536),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Chunk-level embeddings for RAG ──────────────────────────────────
create table if not exists public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index int not null,
  content     text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);

-- ── Human-in-the-loop suggestions (Gmail triage, etc.) ──────────────
create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  source      text not null,                      -- 'gmail'|...
  kind        text not null,                      -- 'task'|'contact'
  title       text not null,
  detail      text,
  payload     jsonb not null default '{}',        -- proposed row fields
  status      text not null default 'pending',    -- pending|accepted|dismissed
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── updated_at triggers (reuse public.set_updated_at from 0001) ──────
do $$
declare t text;
begin
  foreach t in array array[
    'integration_accounts','sync_state','documents','suggestions'
  ] loop
    execute format(
      'drop trigger if exists set_%1$s_updated_at on public.%1$s;', t);
    execute format(
      'create trigger set_%1$s_updated_at before update on public.%1$s
         for each row execute function public.set_updated_at();', t);
  end loop;
end $$;

-- ── Indexes ─────────────────────────────────────────────────────────
create index if not exists idx_integration_accounts_user on public.integration_accounts (user_id);
create index if not exists idx_sync_state_user            on public.sync_state (user_id);
create index if not exists idx_sync_runs_user             on public.sync_runs (user_id);
create index if not exists idx_external_links_user        on public.external_links (user_id);
create index if not exists idx_external_links_lookup      on public.external_links (user_id, source, external_id);
create index if not exists idx_documents_user             on public.documents (user_id);
create index if not exists idx_document_chunks_document   on public.document_chunks (document_id);
create index if not exists idx_suggestions_user_status    on public.suggestions (user_id, status);

create index if not exists idx_documents_embedding
  on public.documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_document_chunks_embedding
  on public.document_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── Row Level Security (owner-only, same pattern as 0001) ───────────
alter table public.integration_accounts enable row level security;
alter table public.sync_state           enable row level security;
alter table public.sync_runs            enable row level security;
alter table public.external_links       enable row level security;
alter table public.documents            enable row level security;
alter table public.document_chunks      enable row level security;
alter table public.suggestions          enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'integration_accounts','sync_state','sync_runs','external_links',
    'documents','document_chunks','suggestions'
  ] loop
    execute format('drop policy if exists "%1$s_select_own" on public.%1$s;', t);
    execute format('create policy "%1$s_select_own" on public.%1$s
      for select using (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$s;', t);
    execute format('create policy "%1$s_insert_own" on public.%1$s
      for insert with check (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$s;', t);
    execute format('create policy "%1$s_update_own" on public.%1$s
      for update using (auth.uid() = user_id);', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$s;', t);
    execute format('create policy "%1$s_delete_own" on public.%1$s
      for delete using (auth.uid() = user_id);', t);
  end loop;
end $$;

-- ════════════════════════════════════════════════════════════════════
-- RAG retrieval: cosine-similarity search over a user's document chunks.
-- Runs with the caller's auth context; RLS still restricts rows to the
-- owner, and we filter by user_id explicitly for the index path.
-- ════════════════════════════════════════════════════════════════════
create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_user_id   uuid,
  match_count     int default 6
)
returns table (
  document_id uuid,
  chunk_index int,
  content     text,
  similarity  float
)
language sql stable
as $$
  select
    dc.document_id,
    dc.chunk_index,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.user_id = match_user_id
    and dc.embedding is not null
  order by dc.embedding <=> query_embedding
  limit match_count;
$$;

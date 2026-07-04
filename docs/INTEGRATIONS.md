# Executive OS — Integration Architecture

**Status:** Design / plan (pre-implementation)
**Goal:** Turn Executive OS from a seed-data MVP into a live command centre that
ingests from **Google Calendar, Gmail, and Google Drive**, generates a **live AI
daily brief**, and stays private-by-default — without breaking the existing
schema, RLS model, or type-safe data layer.

This document is the contract we build against. Implementation is phased
(§11) so value lands early and each phase is independently shippable.

---

## 1. Principles

1. **One normalized core.** External data is *ingested and normalized* into the
   existing domain tables (`meetings`, `tasks`, `contacts`, …). The rest of the
   app never talks to Google directly — it reads our own tables. Swapping or
   adding a provider later touches only the connector layer.
2. **Read-only first, human-in-the-loop.** Start with least-privilege read
   scopes. Anything that *creates* work (a task from an email, an event from a
   meeting) is a **suggestion the CEO approves**, never a silent write.
3. **Idempotent + incremental.** Every sync is safe to re-run. We track a cursor
   per source (Calendar `syncToken`, Gmail `historyId`, Drive `pageToken`) and
   upsert by external ID, so no duplicates and no full re-pulls.
4. **Provenance everywhere.** Every ingested row records where it came from, so
   we can attribute, de-dupe, re-sync, and purge.
5. **RLS is never bypassed for reads.** Sync writes run server-side with elevated
   privilege, but every row is stamped with `user_id`; the app still reads
   through row-level security.
6. **Fail visibly, degrade gracefully.** A provider outage pauses one connector
   and surfaces status in Settings → Integrations; it never takes down the app
   or the brief (which already has a local fallback).

---

## 2. High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Google Cloud (per-user OAuth grant)                                 │
│    Calendar API   ·   Gmail API   ·   Drive API   ·   Pub/Sub push   │
└───────────────┬───────────────┬───────────────┬─────────────────────┘
                │  pull (cursor) │               │  push (webhook)
                ▼               ▼               ▼
┌────────────────────────────────────────────────────────────────────┐
│  Integration layer  (src/lib/integrations/*)                         │
│  ┌──────────┐   ┌──────────────┐   ┌───────────────┐                 │
│  │ Connector│──▶│ Normalizer   │──▶│ Upsert + link │                 │
│  │ (per src)│   │ (→ domain)   │   │ (idempotent)  │                 │
│  └──────────┘   └──────────────┘   └───────────────┘                 │
│        ▲                                   │                          │
│   OAuth tokens                        embeddings (pgvector)           │
└────────┼───────────────────────────────────┼────────────────────────┘
         │                                    ▼
┌────────┴─────────────┐        ┌─────────────────────────────────────┐
│ integration_accounts │        │ Supabase Postgres                    │
│ sync_state / sync_runs│       │ meetings · tasks · contacts ·        │
│ external_links        │       │ documents · embeddings · daily_briefs│
└──────────────────────┘        └─────────────────────────────────────┘
         ▲                                    ▲
   Scheduler (Vercel Cron / pg_cron)     AI brief (RAG + provider abstraction)
```

**Where sync runs:** internal API routes under `src/app/api/sync/*`, invoked by
(a) **Vercel Cron** (or Supabase scheduled Edge Functions) on an interval, and
(b) **Google push webhooks** for freshness. Both paths call the same connector
code — cron is the safety net, webhooks are the fast path. (n8n can later
orchestrate multi-step flows, per the product spec, but is not required for v1.)

---

## 3. Auth model

Calendar, Gmail, and Drive share one Google identity, so a **single Google OAuth
grant** with multiple scopes covers all three. We use a dedicated OAuth flow
(not Supabase's social login) because we need **offline access** (refresh
tokens) and **incremental authorization** (add scopes as the user enables each
connector).

- **Scopes (read-only first):**
  - `calendar.readonly`
  - `gmail.readonly` (upgrade to `gmail.modify` only if we add label/triage writes)
  - `drive.readonly` (or `drive.metadata.readonly` + per-file content on demand)
- **Flow:** `GET /api/integrations/google/connect` → Google consent →
  `GET /api/integrations/google/callback` exchanges the code, stores tokens.
- **Token storage:** `integration_accounts` (§4). Refresh tokens are
  **encrypted at rest** (pgsodium/KMS, or app-level AES-GCM with a server-only
  key) and **only ever read server-side** with the service role. They are never
  exposed to the browser or to RLS-scoped reads.
- **Disconnect:** revokes the Google grant and deletes tokens + optionally the
  ingested data (user choice).

> In this Claude session the Google connectors (Calendar/Gmail/Drive) are
> available as MCP tools, which lets us prototype ingestion against real data
> before the production OAuth flow is built.

---

## 4. Schema additions (proposed `0002_integrations.sql`)

Additive only — nothing in `0001_init.sql` changes.

```sql
-- Connected external accounts (one row per user per provider)
create table integration_accounts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,                 -- 'google'
  email         text,
  scopes        text[] not null default '{}',
  access_token  text,                          -- encrypted
  refresh_token text,                          -- encrypted
  expires_at    timestamptz,
  status        text not null default 'connected',  -- connected|error|revoked
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, provider)
);

-- Per-connector sync cursor + last run
create table sync_state (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  connector   text not null,                   -- 'gcal'|'gmail'|'gdrive'
  cursor      text,                            -- syncToken / historyId / pageToken
  last_synced_at timestamptz,
  status      text not null default 'idle',    -- idle|running|error
  last_error  text,
  unique (user_id, connector)
);

-- Audit trail of sync runs (observability)
create table sync_runs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  connector    text not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running',
  items_upserted int default 0,
  error        text
);

-- Generic external-id map: idempotency + de-dupe across any table
create table external_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  provider      text not null,                 -- 'google'
  source        text not null,                 -- 'gcal'|'gmail'|'gdrive'
  external_id   text not null,                 -- event id / message id / file id
  entity_table  text not null,                 -- 'meetings'|'tasks'|'contacts'|'documents'
  entity_id     uuid not null,
  raw           jsonb,                         -- last raw payload (for re-normalize)
  synced_at     timestamptz not null default now(),
  unique (user_id, source, external_id)
);

-- Drive-backed documents (was hinted in the original scaffold)
create table documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  source      text,                            -- 'gdrive'
  mime_type   text,
  drive_file_id text,
  web_url     text,
  content     text,
  embedding   vector(1536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Chunk-level embeddings for RAG (documents can be long)
create table document_chunks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  chunk_index int not null,
  content     text not null,
  embedding   vector(1536)
);
```

Plus: RLS owner-policies on every new table (same pattern as `0001`); ivfflat
indexes on `documents.embedding` and `document_chunks.embedding`; a lightweight
`source` / `external_id` convenience column on `meetings` (hot path) is optional
since `external_links` already covers it.

---

## 5. Connector interface

A small, uniform contract every source implements. The orchestrator doesn't know
or care which provider it's driving.

```ts
// src/lib/integrations/types.ts
export interface SyncContext {
  userId: string;
  cursor: string | null;          // from sync_state
  since?: Date;
}

export interface SyncResult {
  cursor: string | null;          // next cursor to persist
  upserts: number;
  suggestions?: number;           // human-in-loop items created
}

export interface Connector {
  key: "gcal" | "gmail" | "gdrive";
  /** Pull changes since `cursor`, normalize, upsert, return next cursor. */
  sync(ctx: SyncContext): Promise<SyncResult>;
  /** Validate the OAuth grant / required scopes. */
  healthCheck(userId: string): Promise<{ ok: boolean; reason?: string }>;
}
```

Layout:

```
src/lib/integrations/
  types.ts
  google/
    client.ts          # authorized Google API client from stored tokens
    calendar.ts        # Connector: events → meetings
    gmail.ts           # Connector: threads → task/contact suggestions
    drive.ts           # Connector: files → documents (+ chunk + embed)
  orchestrator.ts      # runs a connector: sync_runs + cursor + error handling
  tokens.ts            # encrypt/decrypt + refresh
  normalize/           # pure mappers (event→Meeting, message→Task, …) + unit tests
```

---

## 6. Per-source sync design

### 6.1 Google Calendar → Meetings
- **Read:** `events.list` with `syncToken` (incremental); full sync on first run
  or on `410 Gone` (token expired) → reset cursor.
- **Map:** event → `meetings` { title=summary, starts_at, ends_at, location,
  attendees[]=attendee emails/names, agenda=description, conferencing link }.
- **Idempotency:** `external_links(source='gcal', external_id=event.id)`.
- **Deletions/cancellations:** `status=cancelled` → mark meeting cancelled.
- **Freshness:** Calendar **watch** channel → webhook → incremental sync.
- **Later (two-way):** create/patch Google events from the Meetings UI.

### 6.2 Google Drive → Documents (+ semantic search)
- **Read:** `changes.list` with `pageToken` (incremental); seed from
  `files.list` scoped to relevant folders/MIME types.
- **Extract:** export Google Docs/Sheets/Slides as text; parse PDFs/text for
  content; store metadata for everything.
- **Embed:** chunk content → embeddings → `document_chunks` (pgvector). Powers
  RAG for the brief and a future global semantic search.
- **Idempotency:** `external_links(source='gdrive', external_id=file.id)`;
  re-embed only when `modifiedTime` changes.

### 6.3 Gmail → Task & Contact suggestions (human-in-loop)
- **Read:** incremental via `history.list` (`historyId`); seed with a bounded
  `messages.list` query (e.g. important/unread, last N days).
- **Classify:** lightweight rules + an LLM pass to detect *follow-ups /
  commitments / asks* → **proposed tasks**; extract sender identity → **contact
  enrichment suggestions**.
- **Human-in-loop:** suggestions land in a review surface (a `suggestions`
  table + a "Triage" inbox / badge), and only become `tasks`/`contacts` rows on
  approval. No silent writes; no scanning full mailbox content beyond what's
  needed.
- **Scope discipline:** `gmail.readonly` until/unless the user opts into
  labeling (`gmail.modify`).

---

## 7. Live AI brief (RAG)

The provider abstraction (`src/lib/ai/`) and `generateAndSaveBrief()` already
exist. Integration upgrades it from "structured data only" to **structured data
+ retrieved context**:

1. Gather today's normalized data (tasks, meetings, risks, opportunities) — as
   today.
2. **Retrieve** the most relevant document chunks via
   `match_document_chunks(query_embedding, user_id, k)` (pgvector cosine).
3. Compose the prompt (existing `buildUserPrompt` + retrieved snippets).
4. Call Anthropic/OpenAI (keys enable it; local fallback otherwise).
5. Persist to `daily_briefs`; **schedule** a 07:00 run per user (Vercel Cron /
   pg_cron hitting `POST /api/daily-brief` with a service token).

---

## 8. Scheduling & webhooks

| Concern            | Choice                                                              |
| ------------------ | ------------------------------------------------------------------ |
| Periodic sync      | **Vercel Cron** → `POST /api/sync/{connector}` (per user, batched) |
| 07:00 brief        | **Vercel Cron** → brief generator                                  |
| Freshness (push)   | Google **watch** channels → `POST /api/webhooks/google/{source}`   |
| Heavy/async work   | Queue table + worker, or **n8n** for multi-step flows (spec)       |
| Local dev          | On-demand "Sync now" button in Settings → Integrations             |

All scheduled routes authenticate with a shared secret (`CRON_SECRET`) and act
per `user_id`; webhooks verify Google's channel token before enqueuing.

---

## 9. Security & privacy

- **Least privilege:** read-only scopes first; request write scopes only when a
  feature needs them (incremental auth).
- **Token encryption** at rest; server-only access; never in client bundles or
  RLS-scoped reads. Service-role key stays server-side.
- **Data minimization:** store only what powers a feature; allow the user to
  **disconnect + purge** ingested data per source.
- **Provenance & audit:** `external_links.raw` + `sync_runs` give a full trail.
- **RLS** owner-policies on every new table; sync writes stamp `user_id`.
- **PII care** for Gmail: classify on minimal content, prefer metadata, keep the
  human in the loop.

---

## 10. Reliability & observability

- Idempotent upserts + per-connector cursors → safe re-runs, no dupes.
- Retries with exponential backoff; respect Google quota (`429`/`403 rateLimit`).
- `sync_runs` records status/counts/errors; Settings → Integrations shows last
  sync, item counts, and any error with a "Reconnect" / "Sync now" action.
- Cursor-reset handling (`410 Gone` on Calendar, expired Drive token) → auto
  full re-sync.

---

## 11. Phased rollout

Each phase is independently shippable and demoable.

| Phase | Scope | Key deliverables |
| ----- | ----- | ---------------- |
| **0 — Foundation** | OAuth + accounts + UI shell | `0002_integrations.sql`, Google OAuth connect/callback, `integration_accounts`, token encrypt/refresh, **Settings → Integrations** page (connect / disconnect / status / "Sync now") |
| **1 — Calendar → Meetings** | First live data | Calendar connector, normalizer, orchestrator, `external_links`, cron sync + watch webhook. Meetings & dashboard populate from real events |
| **2 — Drive → Documents + search** | Knowledge base | Drive connector, `documents`/`document_chunks`, embeddings pipeline, `match_document_chunks` RPC, global semantic search UI |
| **3 — Live AI brief** | RAG brief | Retrieval in the brief generator, 07:00 scheduled run, provider keys wired |
| **4 — Gmail → suggestions** | Inbox triage | Gmail connector, `suggestions` table + Triage inbox, approve-to-create tasks/contacts, contact enrichment |
| **5 — Two-way + orchestration** | Write-back | Create Google events from Meetings, Gmail labeling/drafts, n8n flows, opportunity scoring |

**Recommended first PR: Phase 0 + Phase 1** — it stands up the whole integration
spine (auth, accounts, sync orchestrator, UI) and proves it end-to-end with the
cleanest mapping (Calendar → Meetings). Everything after is "add a connector."

---

## 12. Environment variables (added)

```env
# Google OAuth (Calendar + Gmail + Drive)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URL=https://<app>/api/integrations/google/callback

# Server-only
SUPABASE_SERVICE_ROLE_KEY=          # sync writes (already reserved in .env.example)
INTEGRATION_TOKEN_ENC_KEY=          # 32-byte key for token encryption
CRON_SECRET=                        # authenticates scheduled sync routes
GOOGLE_PUBSUB_VERIFICATION_TOKEN=   # verifies Gmail/Calendar push webhooks

# Embeddings (RAG). Falls back to skipping semantic retrieval if unset.
OPENAI_API_KEY=                     # or an embeddings-capable provider
EMBEDDINGS_MODEL=text-embedding-3-small
```

---

## 13. Decisions to confirm before building

1. **Hosting for sync/cron:** Vercel Cron + webhooks (recommended) vs. Supabase
   Edge Functions + `pg_cron` vs. n8n as the primary orchestrator.
2. **Embeddings provider:** OpenAI `text-embedding-3-small` (cheap, 1536-dim —
   matches our `vector(1536)`) vs. another. Affects the Drive/RAG phases.
3. **Gmail depth:** read-only suggestions only, or eventually labeling/drafts
   (needs `gmail.modify`).
4. **Multi-user vs. single-CEO:** the schema is multi-tenant (per `user_id`)
   already; confirm we're building for one CEO now but keeping it multi-tenant.

Once these are settled I'll open **Phase 0 + 1** as the first implementation PR.

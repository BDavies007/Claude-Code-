# Executive OS

**An AI-powered executive command centre for a CEO.**

Executive OS turns scattered information into daily decisions, action, and
compounding execution — one dashboard for today's priorities, meetings, tasks,
decisions, pipeline, and a team of AI agents working alongside you.

Built as a production-quality MVP with **Next.js · TypeScript · Tailwind CSS ·
shadcn/ui · Supabase (Postgres + Auth) · pgvector-ready schema**.

---

## ✨ Features

- **Authentication** — email/password sign-in & sign-up via Supabase Auth, with
  middleware-protected routes and row-level security on every table.
- **Dashboard** — today's priorities, upcoming meetings, recent decisions, open
  risks, pipeline value, and an AI daily-brief teaser.
- **Daily Brief** — an AI-generated morning brief with a **provider abstraction**
  for Anthropic and OpenAI (plus a zero-config local fallback so it works with no
  API key).
- **Full CRUD** for Tasks, Decisions, Meetings, Contacts, Companies, and
  Opportunities — via a single reusable, typed `ResourceManager` component.
- **AI Agents** — Amelia, Atlas, Orbit, Sentinel, Forge, Vector, and Pulse
  represented as first-class system actors.
- **Settings** — editable profile, account details, and system/AI configuration.
- **Clean executive UI** — dark navy canvas, white text, electric-blue accents,
  fully mobile responsive.
- **pgvector-ready** — every core table ships an `embedding vector(1536)` column
  and ANN indexes, ready for semantic search / AI retrieval.
- **Seed data** — a fully-populated demo for the CEO of **LightSummit**, a
  clean-tech company.

---

## 🗂 Project structure

```
.
├── src/
│   ├── app/
│   │   ├── (app)/                  # Authenticated shell (sidebar + topbar)
│   │   │   ├── dashboard/
│   │   │   ├── daily-brief/
│   │   │   ├── meetings/  tasks/  decisions/
│   │   │   ├── contacts/  companies/  opportunities/
│   │   │   ├── agents/   settings/
│   │   │   ├── layout.tsx           # Auth guard + app chrome
│   │   │   ├── loading.tsx  error.tsx
│   │   ├── api/daily-brief/route.ts # AI brief generator endpoint
│   │   ├── auth/callback/  auth/signout/
│   │   ├── login/                   # Auth screen
│   │   ├── layout.tsx  page.tsx  globals.css
│   ├── components/
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── layout/                  # Sidebar, topbar, brand, nav
│   │   ├── dashboard/               # Stat & section cards
│   │   ├── shared/                  # ResourceManager, PageHeader, badges…
│   │   ├── daily-brief/  settings/
│   ├── lib/
│   │   ├── supabase/                # Browser, server & middleware clients
│   │   ├── actions/                 # Typed server actions (CRUD)
│   │   ├── ai/                      # Provider abstraction + brief generator
│   │   ├── data/                    # Dashboard queries, agent roster
│   │   ├── types/database.ts        # Typed DB models + Database type
│   │   ├── navigation.ts  utils.ts
├── supabase/
│   ├── migrations/0001_init.sql     # Schema, enums, RLS, pgvector
│   ├── seed.sql                     # LightSummit demo data
│   └── config.toml
├── middleware.ts                    # Session refresh + route protection
└── … config (tailwind, tsconfig, components.json, .env.example)
```

---

## 🚀 Getting started

### 1. Prerequisites

- Node.js 18.18+ (Node 20/22 recommended)
- A [Supabase](https://supabase.com) project — either the hosted platform or the
  local [Supabase CLI](https://supabase.com/docs/guides/cli).

### 2. Install

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env.local
```

Fill in your Supabase values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional — enable a hosted AI provider for the daily brief.
# If neither is set, a built-in local generator is used.
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
```

### 4. Set up the database

**Option A — Supabase CLI (local, recommended for dev):**

```bash
npm run db:start     # starts local Supabase (Postgres, Auth, Studio)
npm run db:reset     # applies migrations + seed data
```

`db:reset` runs `supabase/migrations/0001_init.sql` then `supabase/seed.sql`.

**Option B — Hosted Supabase:**

1. Open the **SQL Editor** in your Supabase dashboard.
2. Run the contents of `supabase/migrations/0001_init.sql`.
3. (Optional) Run `supabase/seed.sql` for the LightSummit demo data.

> The seed enables the `vector` extension. On hosted Supabase, enable
> **Database → Extensions → vector** first if it isn't already on.

### 5. Run

```bash
npm run dev
```

Open <http://localhost:3000>.

### 6. Sign in with the demo account

If you loaded the seed data, sign in as the demo CEO (the login screen has a
one-click **"Use demo CEO credentials"** button):

```
Email:    ceo@lightsummit.io
Password: ExecutiveOS!2026
```

Otherwise, create a new account from the login screen — a profile row and the
default AI-agent roster appear automatically.

---

## 🧠 AI daily brief

The brief is generated by an endpoint with a small provider abstraction:

- **`POST /api/daily-brief`** gathers your open tasks, upcoming meetings, risks,
  and live opportunities, asks the configured provider for a JSON brief, and
  upserts it as today's `daily_briefs` row.
- Provider selection (`src/lib/ai/index.ts`):
  1. `ANTHROPIC_API_KEY` → Anthropic Messages API
  2. else `OPENAI_API_KEY` → OpenAI Chat Completions
  3. else → deterministic **local generator** (no key required)

Model overrides: `ANTHROPIC_MODEL`, `OPENAI_MODEL`.

---

## 🗄 Data model

Core tables (all with `user_id`, RLS, `created_at/updated_at`, and — where
useful — an `embedding vector(1536)` column):

`profiles · companies · contacts · meetings · tasks · decisions ·
opportunities · risks · daily_briefs · ai_agents`

Typed models live in `src/lib/types/database.ts` and are wired into the Supabase
client generics for end-to-end type safety.

---

## 🔐 Security

- **Row-level security** on every table — each row is owned by `auth.uid()`.
- Auth is enforced in **middleware** (session refresh + redirects) and again in
  the authenticated layout (defence in depth).
- The service-role key is never referenced from client code.

---

## 🧭 Scripts

| Script              | Description                    |
| ------------------- | ----------------------------- |
| `npm run dev`       | Start the dev server          |
| `npm run build`     | Production build              |
| `npm run start`     | Start the production server   |
| `npm run lint`      | ESLint                        |
| `npm run typecheck` | TypeScript, no emit           |
| `npm run db:start`  | Start local Supabase (CLI)    |
| `npm run db:reset`  | Apply migrations + seed (CLI) |

---

## 🗺 Roadmap (next integrations)

Gmail triage · Google Calendar briefing · meeting-transcript processing ·
scheduled 07:00 executive brief · investor CRM enrichment · opportunity scoring
· live AI-agent execution (n8n). The schema and agent model are already shaped
for these.

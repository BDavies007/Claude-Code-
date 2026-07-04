# n8n orchestration for Executive OS

n8n is the **orchestrator** for Executive OS integrations (decided in
[`docs/INTEGRATIONS.md`](../docs/INTEGRATIONS.md) §13). It owns scheduling,
Google push webhooks, retries, and multi-step flows; the Next.js app stays the
system of record and exposes secured endpoints that n8n drives.

```
n8n (schedule / webhook)  ──HTTP POST──▶  Executive OS API  ──▶  Supabase
   Calendar/Gmail/Drive sync              /api/sync/{connector}     (normalized)
   07:00 daily brief                      /api/daily-brief
```

## Endpoints n8n calls

| Endpoint                       | Purpose                                  | Auth                    |
| ------------------------------ | ---------------------------------------- | ----------------------- |
| `POST /api/sync/gcal`          | Sync Google Calendar → Meetings          | `x-n8n-secret` header   |
| `POST /api/sync/gdrive`        | Sync Drive → Documents (+ embeddings)    | `x-n8n-secret` header   |
| `POST /api/sync/gmail`         | Triage Gmail → suggestions               | `x-n8n-secret` header   |
| `POST /api/daily-brief`        | Generate the 07:00 brief                 | `x-n8n-secret` header   |

Each request body carries `{ "userId": "<uuid>" }` (n8n iterates connected
users). The app authenticates the shared secret, then runs the connector for
that user with the same code a manual "Sync now" uses.

> Phase 0 ships the connect flow, schema, and orchestrator scaffolding. The
> `/api/sync/*` routes are wired to live connectors in Phase 1 — see the
> integration doc's rollout table.

## Setup

1. **Run n8n** — Docker is simplest:
   ```bash
   docker run -it --rm -p 5678:5678 \
     -e N8N_SECURE_COOKIE=false \
     -v n8n_data:/home/node/.n8n \
     docker.n8n.io/n8nio/n8n
   ```
2. **Import workflows** — in n8n: *Workflows → Import from File* → pick the
   JSON files in [`workflows/`](./workflows).
3. **Set credentials / variables** in n8n:
   - `EXEC_OS_BASE_URL` — your app URL (e.g. `https://your-app.vercel.app`)
   - `N8N_WEBHOOK_SECRET` — must match the app's env of the same name
4. **Set the matching secret in the app** (Vercel / `.env.local`):
   ```env
   N8N_WEBHOOK_SECRET=<same-value-as-in-n8n>
   ```
5. **Activate** the workflows. The schedule triggers begin firing; enable the
   Google push webhooks (Phase 1) for near-real-time updates.

## Workflows

- **`workflows/google-sync.json`** — schedule trigger (every 15 min) → fan out
  to `/api/sync/gcal`, `/api/sync/gdrive`, `/api/sync/gmail`.
- **`workflows/daily-brief.json`** — schedule trigger (07:00 daily) →
  `/api/daily-brief`.

These are starting templates: adjust cadence, add per-user iteration from your
`integration_accounts`, and add error-notification nodes (Slack/email) to taste.

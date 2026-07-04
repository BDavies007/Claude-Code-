# Deploying Executive OS

Executive OS is a standard Next.js 14 app and deploys cleanly to **Vercel**.
This guide covers the full path: Supabase setup → Vercel deploy → auth redirects.

---

## 1. Provision Supabase (production)

1. Create a project at [supabase.com](https://supabase.com).
2. **Database → Extensions**: enable `vector` (and confirm `pgcrypto`).
3. **SQL Editor**: run `supabase/migrations/0001_init.sql`.
4. *(Optional)* run `supabase/seed.sql` for the LightSummit demo data.
5. **Authentication → Providers → Email**: keep "Confirm email" on for
   production (users confirm via email), or off for a frictionless demo.
6. **Project Settings → API**: copy the **Project URL** and **anon public** key.

---

## 2. Deploy to Vercel

### Option A — Dashboard

1. Push this repo to GitHub (already done).
2. In Vercel: **Add New → Project → Import** this repository.
3. Framework preset is auto-detected as **Next.js** (see `vercel.json`).
4. Add the environment variables below, then **Deploy**.

### Option B — CLI

```bash
npm i -g vercel
vercel            # link & configure
vercel --prod     # production deploy
```

---

## 3. Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**
(Production + Preview):

| Variable                        | Required | Notes                                            |
| ------------------------------- | -------- | ------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅       | Supabase Project URL                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅       | Supabase anon/public key                         |
| `NEXT_PUBLIC_SITE_URL`          | ✅       | Your deployed URL, e.g. `https://your-app.vercel.app` |
| `ANTHROPIC_API_KEY`             | ⬜       | Enables the Anthropic daily-brief provider       |
| `OPENAI_API_KEY`                | ⬜       | Enables the OpenAI provider (used if no Anthropic key) |
| `ANTHROPIC_MODEL`               | ⬜       | Override default model                           |
| `OPENAI_MODEL`                  | ⬜       | Override default model                           |

> Without an AI key, the daily brief uses the built-in local generator — the
> app is fully functional either way.

> **Never** put the Supabase `service_role` key in Vercel env for this app —
> it isn't used by any client/runtime code here.

---

## 4. Wire up auth redirects

In **Supabase → Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add `https://your-app.vercel.app/auth/callback`

This lets email confirmation / OAuth callbacks return to the deployed app.

---

## 5. Verify

1. Visit your deployment → you should be redirected to `/login`.
2. Sign up (or use the seeded demo login) and land on the dashboard.
3. Open **Daily Brief → Generate brief** to confirm the AI endpoint works.

---

## Continuous integration

Every push and pull request runs `.github/workflows/ci.yml`:
**typecheck → lint → build**. Vercel builds each PR as a Preview Deployment and
promotes `main` to Production (`vercel.json → git.deploymentEnabled.main`).

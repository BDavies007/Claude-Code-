# Atlas Hub

A personal **life + business command center** desktop app. Centralizes health,
calendar, inbox, finance, CRM, and lead-gen signals into a single Morning Brief,
and gives you a workspace for the rest of the day.

> Status: **v0.1 scaffold**. The full app shell, theming, PIN lock, and Morning
> Brief work end-to-end with mock data. Third-party integrations are stubbed —
> wire them up one at a time using the adapter interface in `src/integrations/`.

## Stack

- **Electron 33** desktop shell (main + sandboxed preload, context isolation)
- **React 18 + TypeScript + Vite** renderer
- **Tailwind CSS** with custom light/dark tokens
- **react-router-dom** hash routing
- **electron-store** for encrypted local settings/tokens
- **lucide-react** icons

## Run it

```bash
npm install
npm run dev:electron   # launches Vite dev server + Electron window with HMR
```

Build a production bundle:

```bash
npm run build
npm start
```

On first launch you'll be prompted to **create a device PIN**. It's hashed
(SHA-256) and stored locally — it protects this device only, not your
third-party accounts.

## What's in v0.2

| Module        | State    | Notes                                                                   |
| ------------- | -------- | ----------------------------------------------------------------------- |
| Morning Brief | Working  | Synthesizes recovery + calendar + inbox into a daily recommendation     |
| Dashboard     | Mock     | KPI tiles + pipeline placeholder                                        |
| Health        | **Working** | Whoop live, Garmin via manual entry form, persistent                 |
| Inbox         | **Working** | Unified Outlook (Graph) + Gmail, priority-ranked                     |
| Calendar      | **Working** | Outlook + Google Calendar, 7-day merged view                         |
| Finance       | **Working** | Income/expense ledger with add/delete, persists across launches      |
| CRM           | **Working** | Accounts pipeline with add/delete                                    |
| Leads/Social  | Mock     | Channel performance — no upstream API yet                               |
| Projects      | **Working** | Status board with add/delete                                         |
| Settings      | Working  | Theme, PIN reset, per-provider configuration                            |
| OAuth: Gmail  | **Working** | PKCE + loopback, auto-refresh                                        |
| OAuth: Outlook | **Working** | PKCE + loopback (Microsoft Identity Platform v2.0)                  |
| OAuth: Whoop  | **Working** | PKCE + loopback (Whoop developer API)                                |
| Garmin        | Manual   | API gated; manual daily-metric entry feeds the brief                    |

## Integrations

All OAuth flows run entirely in the Electron main process
(`electron/oauth/*.ts`). Tokens never reach the renderer. Each access token
is automatically refreshed when within 60 seconds of expiry, using the
stored refresh token. All three OAuth providers share a single PKCE
implementation (`electron/oauth/pkce.ts`) — a one-shot loopback HTTP
server on a random localhost port captures the redirect, validates state,
and exchanges the code with the verifier.

### Gmail + Google Calendar

1. [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
   → create an **OAuth client ID** of type **Desktop app**.
2. Enable [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
   and [Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
3. Atlas Hub → Settings → **Gmail & Google Calendar** → Configure → paste
   Client ID + Secret → Save → Connect.
4. Approve `gmail.readonly` + `calendar.readonly`. Inbox, Calendar, and
   Morning Brief now read real data.

### Outlook (Microsoft 365 / Microsoft Graph)

1. [Azure Portal → App Registrations](https://entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)
   → New registration.
2. Under **Authentication**, add a **Mobile and desktop applications**
   redirect URI of `http://localhost`. Enable **"Allow public client flows"**.
3. Under **API permissions**, add Microsoft Graph delegated scopes:
   `User.Read`, `Mail.Read`, `Calendars.Read`, `offline_access`.
4. Atlas Hub → Settings → **Outlook** → Configure → paste Application
   (Client) ID. Leave Client Secret blank for a public PKCE client.
   Tenant defaults to `common` (works for personal + work accounts).
5. Click Save → Connect.

### Whoop

1. [Whoop Developer Dashboard](https://developer-dashboard.whoop.com/) →
   create a new app.
2. Required scopes: `offline`, `read:recovery`, `read:cycles`,
   `read:sleep`, `read:profile`. The `offline` scope is mandatory for
   refresh tokens.
3. Register redirect URI(s). If the dashboard accepts a wildcard port
   for desktop apps, use `http://localhost`. Otherwise pick a fixed port
   (we'll match it).
4. Atlas Hub → Settings → **Whoop** → Configure → paste Client ID +
   Secret → Save → Connect.
5. Approve, and the Morning Brief + Health page now use live recovery,
   cycle (strain), and sleep records.

### Garmin Connect — manual entry

Garmin doesn't expose a public OAuth flow. The official Garmin Health API
requires a paid partner agreement, and the unofficial Connect web-login
flow (used by `python-garminconnect` / `garth`) is fragile and arguably
violates Garmin's TOS.

Instead, Atlas Hub treats Garmin as a **manual ingestion source**: open
the Health page and log your morning Body Battery / HRV / resting HR /
sleep from your watch. Those entries feed the Morning Brief identically
to how the API would. To swap in a real API later, only the methods on
`GarminAdapter` need to change.

### Adding an adapter

1. Create `src/integrations/<name>.ts` implementing `IntegrationAdapter` and
   any feature interface (`HealthAdapter`, `MailAdapter`, `CalendarAdapter`)
2. Export an instance from `src/integrations/index.ts`
3. The Settings page picks it up automatically via `allAdapters`
4. Pages that consume that data type will start showing real data

## Project layout

```
electron/             Main process + preload (built to dist-electron/)
src/
  components/         UI shell: Sidebar, Topbar, AuthGate, Layout, ui/*
  integrations/       Adapter interface + per-provider implementations
  lib/                theme, formatting, brief synthesis
  pages/              One file per route
  styles/globals.css  Tailwind + CSS variables for light/dark
  types/atlas.d.ts    Renderer-side type for window.atlas (preload bridge)
index.html
vite.config.ts
tailwind.config.js
tsconfig.json         Renderer
tsconfig.electron.json
```

## Security notes

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`
- All IPC is whitelisted in `electron/main.ts`
- Tokens stored via `electron-store` with `encryptionKey` (OS-level encryption
  varies by platform — on macOS Keychain integration is recommended for
  production)
- External links are routed through `shell.openExternal` instead of opening
  inside the app window

## Persistence

`Finance`, `CRM`, `Projects`, and the Garmin manual log persist via
`electron-store` (encrypted JSON, one file per table:
`atlas-hub-finance.json`, etc.). Each table exposes a tiny CRUD API on
`window.atlas.db.<table>`. Records survive app restarts.

When the schema outgrows JSON, swap the four `db:*` IPC handlers in
`electron/main.ts` for a SQLite-backed implementation (e.g. `sql.js` or
`better-sqlite3`) — the renderer keeps its current interface.

## Next steps

1. **Background sync worker** — run hourly Gmail / Outlook / Whoop pulls
   from the main process instead of on-demand.
2. **Notes / Journal module** — currently the only obvious missing piece.
3. **Leads & Social** — wire LinkedIn, X, or Buffer if you want real
   channel data; otherwise add manual entry like Garmin.
4. **AI-assisted brief** — replace the rule-based `recommend()` in
   `src/lib/brief.ts` with an LLM call that takes recovery + calendar
   density + unread priority and produces a recommendation.
5. **Package for distribution** with `electron-builder` (Mac DMG /
   Windows NSIS / Linux AppImage).

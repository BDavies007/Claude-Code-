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

## What's in v0.1

| Module        | State    | Notes                                                                   |
| ------------- | -------- | ----------------------------------------------------------------------- |
| Morning Brief | Working  | Synthesizes recovery + calendar + inbox into a daily recommendation     |
| Dashboard     | Mock     | KPI tiles + pipeline placeholder                                        |
| Health        | Mock     | Whoop + Garmin cards driven by adapter stubs                            |
| Inbox         | Mock     | Unified Outlook + Gmail list                                            |
| Calendar      | Mock     | Merged 7-day view                                                       |
| Finance       | Mock     | Income/expense ledger                                                   |
| CRM           | Mock     | Accounts table                                                          |
| Leads/Social  | Mock     | Channel performance                                                     |
| Projects      | Mock     | Status board                                                            |
| Settings      | Working  | Theme, PIN reset, configurable integrations                             |
| Gmail OAuth   | **Working** | PKCE + loopback flow in main process, auto-refresh, live API calls   |

## Integration roadmap

Each adapter lives in `src/integrations/<provider>.ts` and implements an
interface from `src/integrations/types.ts`. The UI already calls these — when
you replace the mock with a real API client, the entire app lights up.

### 1. Whoop (`src/integrations/whoop.ts`)

- Register a Whoop developer app at developer.whoop.com
- OAuth 2.0 PKCE flow — open the auth URL in a child `BrowserWindow` from
  `electron/main.ts`, capture the redirect, exchange code for tokens
- Store tokens under `integrations.whoop` via `settings.set`
- API base: `https://api.prod.whoop.com/developer/v1/`
- Useful endpoints: `/recovery`, `/cycle`, `/sleep`

### 2. Garmin Connect (`src/integrations/garmin.ts`)

Two paths:
- **Official Garmin Health API** — requires a Connect IQ partner agreement.
  Cleanest but gated.
- **Unofficial Connect web auth** — replicate what `python-garminconnect`
  does (SSO POST, ticket exchange). Works for personal use; fragile.

### 3. Outlook (`src/integrations/outlook.ts`)

- Register an Azure AD app (multi-tenant, public client)
- Redirect URI: `http://localhost:51820/auth/callback` (loopback)
- Add an IPC handler in `electron/main.ts` that opens the system browser and
  spins up a tiny HTTP listener for the redirect
- Scopes: `offline_access Mail.Read Calendars.Read User.Read`
- Use Microsoft Graph: `/me/messages`, `/me/calendarView`

### 4. Gmail + Google Calendar (`src/integrations/gmail.ts`) — ✅ wired

This one is done. Setup, end-to-end:

1. **Create an OAuth client** in
   [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials).
   Type: **Desktop app**. Note the Client ID + Client Secret.
2. **Enable the APIs** in the same project: Gmail API and Google Calendar API.
3. Launch Atlas Hub → **Settings → Gmail & Google Calendar → Configure**.
   Paste the Client ID and Client Secret, click Save, then Connect.
4. A system browser tab opens; sign in and approve `gmail.readonly` +
   `calendar.readonly`. The Electron main process runs a one-shot loopback
   HTTP server (`http://127.0.0.1:<random>/oauth2callback`) to capture the
   code, exchanges it for tokens using PKCE, and stores them encrypted on
   this device.
5. Inbox, Calendar, and Morning Brief now read real data.

Implementation details:
- OAuth runs entirely in the main process (`electron/oauth/google.ts`).
  Tokens never reach the renderer.
- Access tokens are auto-refreshed when they're within 60 seconds of expiry.
- The renderer adapter (`src/integrations/gmail.ts`) calls IPC and normalizes
  Gmail's `messages.list` + `messages.get` and Calendar's `events.list`
  responses into the shared `InboxMessage` / `CalendarEvent` shape — so when
  you later add Outlook, the UI doesn't change.
- Falls back to mock data when not connected, so the UI is always populated.

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

## Next steps (suggested order)

1. Wire **one** OAuth flow end-to-end (Gmail is the easiest to test)
2. Add a background sync worker in `electron/main.ts` (every N minutes)
3. Replace mock data in `Finance` / `CRM` with a SQLite store
   (`better-sqlite3` — requires native rebuild)
4. Add a Notes / Journal module
5. Package with `electron-builder` for Mac/Windows

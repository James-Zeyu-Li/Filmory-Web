# Grainfolio Web

Grainfolio is a local-first workspace for film photographers. It keeps the daily workflow fast and resilient offline while providing optional Supabase services for accounts, private photo storage, and cross-device synchronization.

The repository is named `Filmory-Web`; **Grainfolio** is the product name used by the application.

## What it does

- Manage cameras, lenses, film stocks, and 120 film backs
- Create, edit, archive, and search shooting records
- Track film inventory, costs, and active-roll limits
- Import and export workspace data with Excel
- Store roll covers and photo assets in private cloud storage
- Continue working locally offline and sync when Cloud mode is enabled
- Switch between Chinese and English UI and install the PWA shell

## Current status

The core workspace, local-first data layer, gear and roll workflows, Excel import/export, Auth flows, private Storage, RLS, and Cloud sync paths are implemented. Auth, database, Storage, and synchronization have been validated with Cloud smoke tests and targeted automated frontend coverage.

The following are not complete production features yet:

- Production deployment and production-domain redirect configuration
- OAuth provider setup
- Automated payment and membership activation
- Full conflict handling for concurrent inventory changes across devices
- Final sync hardening and operational observability

## Architecture

| Layer | Responsibility |
| --- | --- |
| React 19 + TypeScript | UI, routing, contexts, and feature workflows |
| Dexie / IndexedDB | Local-first persistence and immediate offline reads/writes |
| SyncService | Per-user push/pull, Realtime subscription, retry handling, and local queue processing |
| Supabase Auth | Account sessions, email confirmation, recovery, and account deletion |
| Supabase Postgres + RLS | Cloud data, tenant isolation, migrations, and server-side business constraints |
| Supabase private Storage | Photo assets accessed through signed URLs |
| Vite + PWA | Development server, production build, installable offline shell, and update prompt |

The normal data path is:

```text
React feature -> Dexie transaction -> local UI update
                         |
                         v
                 SyncService -> Supabase
```

Local data is the immediate read/write source for the browser. Supabase is the cloud source for cross-device recovery and synchronization; RLS remains the security boundary.

## Run locally

Requirements: a recent Node.js version compatible with Vite 8 and npm.

```bash
cd frontend
npm install
npm run dev
```

The development server is available at `http://localhost:5173`.

The repository also includes `./grainfolio.sh`, a small local control panel for starting and stopping the Vite frontend and, when needed, a local Supabase CLI/Docker stack. Local Supabase is optional for normal frontend development.

## Environment

Copy the example file and fill in the values for the environment you want to use:

```bash
cp frontend/.env.example frontend/.env.local
```

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_key
VITE_ENABLE_SUPABASE_SYNC=false
```

Keep `.env.local`, service-role keys, and other credentials out of Git. Cloud synchronization is opt-in:

- `false`: the app remains local-first and does not automatically start Cloud sync.
- `true`: an authenticated session can push and pull the user’s data through Supabase.

When a browser has no local sync watermark, the first Cloud sync protects the local profile by pulling the Cloud profile before normal synchronization. Later cycles use the regular push/pull path. Trial mode does not start Cloud sync.

For local Auth, migrations, RLS, or Mailpit testing, start the local Supabase stack and use the local URL/key values documented in `frontend/.env.example`.

## Checks and tests

Run commands from `frontend/`:

```bash
npm run lint
npm run test
npm run build
npm run e2e
```

- `lint`: ESLint checks
- `test`: Vitest unit and integration tests
- `build`: TypeScript project build followed by the Vite production build
- `e2e`: Playwright browser tests; requires a usable test environment and running app configuration

## Supabase deployment

Migrations are versioned in `supabase/migrations/`. After linking the intended Supabase project, apply them from the repository root:

```bash
supabase db push
```

The `grainfolio-assets` Storage bucket must remain private. Photo reads use signed URLs, and database access is protected by RLS policies and user ownership fields.

## Documentation

The detailed architecture and operational notes are maintained locally rather than published in the repository:

- `.local-docs/architecture/`: architecture guides, API contract, database schema, and call-chain references
- `docs/ROADMAP_TODO.md`: local implementation roadmap and verification notes

These paths are intentionally ignored by Git, so a fresh clone will not contain the maintainer documentation set.

## Repository rules

- UI components persist business data through Dexie; `SyncService` owns Cloud synchronization.
- Every Cloud schema change must be represented by a Supabase migration.
- Do not commit credentials, generated output, test artifacts, local checklists, or `.agents/`.
- Keep local-only maintainer instructions in the ignored `.agents/` directory.

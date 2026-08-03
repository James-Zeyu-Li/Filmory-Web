# Grainfolio Web

Grainfolio is a local-first workspace for film photographers. It tracks cameras, lenses, film inventory, shooting records, 120 film backs, notes, costs, and roll covers. The browser remains responsive offline through Dexie/IndexedDB; Supabase provides optional account, cloud sync, private photo storage, and row-level isolation.

## Current Status

- Core workspace, gear catalog, 120 camera/back workflow, shooting records, Excel import/export, settings, VIP active-roll limit, and Chinese/English UI are implemented.
- Supabase Cloud migrations, Auth email confirmation/password recovery/account deletion, private `grainfolio-assets` Storage, signed URLs, RLS, and Cloud sync have been smoke-tested with real accounts.
- Cloud sync remains opt-in through `VITE_ENABLE_SUPABASE_SYNC=true`. The app still works entirely locally when it is `false`.
- Production deployment, production-domain redirect URLs, OAuth providers, payment automation, and sync hardening for concurrent inventory changes remain roadmap work.

## Stack

- React 19, TypeScript, Vite
- Dexie / IndexedDB for local-first reads and writes
- Supabase Auth, Postgres, RLS, private Storage, Realtime, and migrations
- PWA update prompt, Vitest, Testing Library, and Playwright

## Run Locally

```bash
cd frontend
npm install
npm run dev
```

Run the checks from `frontend/`:

```bash
npm run lint
npm run test
npm run build
npm run e2e
```

`./grainfolio.sh` offers local frontend and Supabase CLI/Docker actions. Local Supabase is optional for normal Cloud development; use it when testing local migrations, Mailpit, RLS, or local sync.

## Environment

Copy `frontend/.env.example` to `frontend/.env.local`. Keep all local environment files and service-role keys out of Git.

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your_key
VITE_ENABLE_SUPABASE_SYNC=false
```

Set sync to `true` only with a valid Supabase project and a real authenticated account. A Cloud sync session starts with a per-user full pull when no local watermark exists, then uses normal push/pull cycles. Trial mode never starts Cloud sync.

## Supabase Deployment

Run migrations from the repository root after linking the intended project:

```bash
supabase db push
```

The migration history is versioned in `supabase/migrations/`. The `grainfolio-assets` bucket must stay private; object reads use signed URLs and RLS policies rather than public URLs.

## Documentation

- Local architecture specifications and code guide: `.local-docs/architecture/` (intentionally ignored by Git)
- Local implementation roadmap: `docs/ROADMAP_TODO.md` (intentionally ignored by Git)

## Repository Rules

- UI components write business data through Dexie; `SyncService` owns cloud synchronization.
- Add every Cloud schema change as a migration and update the relevant shared document.
- Do not commit credentials, generated output, test artifacts, local checklists, or `.agents/`.

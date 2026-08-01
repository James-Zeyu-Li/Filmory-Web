# Grainfolio Web

Grainfolio Web is a local-first film photography workspace for managing rolls, cameras, lenses, film stock, albums, finance records, and shooting notes.

The app runs primarily in the browser with IndexedDB/Dexie for fast offline-first data access. Supabase migrations, Auth, RLS, private Storage, and sync code are kept in the repo for local integration testing and future cloud deployment.

## Tech Stack

- React 19 + TypeScript + Vite
- Dexie / IndexedDB local-first data layer
- Supabase for Auth, Postgres, Storage, RLS, and sync readiness
- PWA support with user-controlled update prompts
- Vitest + Testing Library for unit tests
- Playwright for E2E tests

## Project Structure

```text
Grainfolio-Web/
├── frontend/      # React app, tests, catalog data, and browser data layer
├── supabase/      # Local Supabase config and migrations
├── docs/          # Shared implementation notes such as schema and architecture
├── scripts/       # Helper scripts
└── grainfolio.sh     # Local development control script
```

## Getting Started

Install dependencies:

```bash
cd frontend
npm install
```

Start the frontend:

```bash
npm run dev
```

Or use the root helper script for the local development menu:

```bash
./grainfolio.sh
```

`grainfolio.sh` keeps the frontend and local Supabase Docker environment independent: use the frontend-only actions for normal Cloud Supabase development, and start local Supabase only for local Auth, Mailpit, migration, RLS, or sync testing. The convenience “local full stack” actions start or stop both. It does not manage the legacy `docker-compose.yml` services.

If local Supabase is started, Studio is available at `http://127.0.0.1:54323` and Mailpit is available at `http://127.0.0.1:54324` for auth emails such as signup confirmation and password reset.

## Environment

Use `frontend/.env.example` as the template for local environment variables.

Local secrets and machine-specific files should stay in ignored files such as:

```text
frontend/.env.local
.env.local
supabase/.env.local
```

## Common Commands

Run from `frontend/`:

```bash
npm run dev
npm run lint
npm run test
npm run build
npm run e2e
```

## Documentation

- Database model: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- Supabase contract: [docs/Detailed-Specs/API_CONTRACT.md](docs/Detailed-Specs/API_CONTRACT.md)
- Architecture notes: [docs/Detailed-Specs/WEB_ARCHITECTURE.md](docs/Detailed-Specs/WEB_ARCHITECTURE.md)
- Agent and project rules: [.agents/AGENTS.md](.agents/AGENTS.md)

## Development Notes

- Keep user data writes local-first through Dexie unless a task explicitly targets Supabase integration.
- Keep schema changes in `supabase/migrations/` and update shared implementation docs when the data model changes.
- Do not commit local credentials, generated build output, test artifacts, or one-off debugging screenshots.
- Keep local roadmap, audit notes, and manual verification checklists in ignored local files.

# Filmory Web

Filmory Web is a local-first film photography workspace for managing rolls, cameras, lenses, film stock, albums, finance records, and shooting notes.

The app runs primarily in the browser with IndexedDB/Dexie for fast offline-first data access. Supabase migrations, Auth, RLS, private Storage, and sync code are kept in the repo for local integration testing and future cloud deployment.

## Tech Stack

- React 19 + TypeScript + Vite
- Dexie / IndexedDB local-first data layer
- Supabase for Auth, Postgres, Storage, RLS, and sync readiness
- Vitest + Testing Library for unit tests
- Playwright for E2E tests

## Project Structure

```text
Filmory-Web/
├── frontend/      # React app, tests, catalog data, and browser data layer
├── supabase/      # Local Supabase config and migrations
├── docs/          # Roadmap, schema, architecture, and product notes
├── scripts/       # Helper scripts
└── filmory.sh     # Local development control script
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
./filmory.sh
```

If local Supabase is started, Mailpit is available at `http://127.0.0.1:54324` for auth emails such as signup confirmation and password reset.

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

- Roadmap and active tasks: [docs/ROADMAP_TODO.md](docs/ROADMAP_TODO.md)
- Database model: [docs/DATABASE_SCHEMA.md](docs/DATABASE_SCHEMA.md)
- Supabase contract: [docs/Detailed-Specs/API_CONTRACT.md](docs/Detailed-Specs/API_CONTRACT.md)
- Architecture notes: [docs/Detailed-Specs/WEB_ARCHITECTURE.md](docs/Detailed-Specs/WEB_ARCHITECTURE.md)
- Agent and project rules: [.agents/AGENTS.md](.agents/AGENTS.md)

## Development Notes

- Keep user data writes local-first through Dexie unless a task explicitly targets Supabase integration.
- Keep schema changes in `supabase/migrations/` and update docs when the data model changes.
- Do not commit local credentials, generated build output, test artifacts, or one-off debugging screenshots.

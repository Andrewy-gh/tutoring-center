# Private Tutor / Learning Center Manager

**Industry:** Private Education / Tutoring

**The expensive problem:** Churn and revenue leakage — parents leave when they don't see progress, and centers lose money on untracked sessions.

**The solution (MVP):** Inventory of time. Parents buy "Credit Blocks" (e.g., 10 hours). The system auto-deducts credits per session.

- **ROI dashboard** — Visual progress tracker (grades/goals) so parents see the value.
- **Session continuity notes** — Tutors log notes so the next tutor knows exactly where to pick up.
- **Business value** — Increases customer LTV and prevents unbilled hours.

---

## Tech Stack

![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white) ![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB) ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white) ![Drizzle ORM](https://img.shields.io/badge/drizzle-ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=000000) ![Postgres](https://img.shields.io/badge/postgres-4169E1?style=for-the-badge&logo=postgresql&logoColor=white) ![Vitest](https://img.shields.io/badge/vitest-6D4AFF?style=for-the-badge&logo=vitest&logoColor=white) ![ESLint](https://img.shields.io/badge/eslint-4B32C3?style=for-the-badge&logo=eslint&logoColor=white) ![Prettier](https://img.shields.io/badge/prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=white) ![Husky](https://img.shields.io/badge/husky-FF6B35?style=for-the-badge&logo=husky&logoColor=white)

---

This repo is a minimal **Next.js 15 App Router + TypeScript** app with enforced **linting** and **Husky** hooks.

## Linting

- **ESLint** — Runs the Next.js config (core-web-vitals, TypeScript) plus Prettier compatibility. Catches bugs, accessibility issues, and style problems. Rule `no-console` is set to `warn`.
- **Prettier** — Enforces consistent formatting (quotes, semicolons, line length, import order). Use `prettier:check` to verify and `prettier:fix` to fix.

Both run in CI and locally via the scripts below.

## Husky

[Husky](https://typicode.github.io/husky/) runs Git hooks for this repo. When you run `git commit`, Husky runs scripts at specific times so only valid, lint-clean code gets committed.

**When each hook runs:**

1. **`pre-commit`** — Runs **before** the commit is created. It runs `npm run lint` and `npm run prettier:check`. If either fails, the commit is cancelled and nothing is committed.
2. **`commit-msg`** — Runs **after** you write the message (e.g. in your editor). It runs Commitlint against that message. If the message doesn’t follow the rules below, the commit is rejected and you’re asked to amend the message.

So: staged code must pass lint and Prettier, and the commit message must follow the Conventional Commits format.

**Commit message structure (Commitlint)**

Every commit message must follow [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>(<optional scope>): <subject>

<optional body>

<optional footer>
```

- **Type** (required) — One of: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `revert`, `build`, `ci`.
- **Scope** (optional) — Short context, e.g. `auth`, `api`, `ui`.
- **Subject** (required) — Short summary in imperative mood. No period at the end.
- **Body** (optional) — Longer description; line length max 200.
- **Footer** (optional) — e.g. `BREAKING CHANGE:`, `Refs: TICKET-123`; line length max 200.

**Length limits:** Header (first line) max **120** characters. Body and footer lines max **200** characters each.

**Examples of valid commit messages:**

```text
feat: add credit block purchase flow
fix(api): correct session credit deduction
chore: update dependencies
docs: document ROI dashboard API
feat(auth): add login form

fix: prevent double deduction on session end

Refs: TUTOR-42
```

**Examples that would be rejected:**

- `Added new feature` — missing type and colon.
- `feat: Add new feature` — subject should be imperative (“add”, not “added”); capital A is allowed but lowercase is preferred.
- `FEAT: add feature` — type must be lowercase.

Run `npm run prepare` after clone so Husky installs these hooks into `.git/hooks`.

## Setup

Prerequisites:

- Node `24.14.0` (`.nvmrc` and `.node-version` are pinned to this version)

```bash
cp .env.example .env
npm install
npm run db:migrate
npm run prepare
```

## Local Postgres / Docker

This repo supports a plain local Postgres container for app and schema work. Supabase remains a production dependency, not a required local runtime.

Prerequisites:

- Docker Desktop running
- `npm install`

Useful commands:

- `npm run db:start` - starts the local Postgres container and waits for health
- `npm run db:status` - shows container status
- `npm run db:logs` - tails Postgres logs
- `npm run db:stop` - stops and removes the local Postgres container
- `npm run local:db:bootstrap` - starts Postgres, then applies the tracked Drizzle migrations
- `npm run gate:local` - bootstraps local Postgres from Drizzle migrations, then runs typecheck, lint, Prettier, and build

Notes:

- The local container is pinned to `postgres:17.6`.
- `DATABASE_URL` for local Docker-backed Postgres is `postgresql://postgres:postgres@127.0.0.1:5433/tutoring_center`.
- The overlap constraint migration is tracked in `drizzle/0001_booking_invariants.sql`, including `CREATE EXTENSION IF NOT EXISTS btree_gist;`.
- `npm run gate:local` does not cover tests that require the Supabase HTTP API and keys. Those remain a separate integration concern.

## Scripts

- `npm run dev` — dev server
- `npm run build` — production build
- `npm run start` — production server
- `npm run typecheck` — TypeScript typecheck
- `npm run db:generate` / `npm run db:migrate` / `npm run db:push` / `npm run db:studio` — schema and database workflows
- `npm run db:start` / `npm run db:stop` — local Postgres lifecycle
- `npm run db:migrate` — apply tracked Drizzle migrations with the runtime migrator
- `npm run local:db:bootstrap` — local Drizzle migration bootstrap
- `npm run gate:local` — local Postgres-backed validation
- `npm run lint` — ESLint
- `npm run prettier:check` / `npm run prettier:fix` — Prettier
- `npm run test` - runs tests

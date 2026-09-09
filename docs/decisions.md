# Decisions

## Decision 1

- **Chose:** Next.js App Router as a single full-stack application.
- **Rejected:** Separate React frontend plus Express backend.
- **Why:** The assessment is time-boxed, and one deployable codebase reduces routing, CORS, and deployment overhead.

## Decision 2

- **Chose:** PostgreSQL with Prisma.
- **Rejected:** MongoDB or browser-only storage.
- **Why:** The requirements are relationship-heavy and need reliable transactions, constraints, and server-side filtering.

## Decision 3

- **Chose:** Append-only stock movements with derived quantities.
- **Rejected:** Storing editable on-hand quantities on items.
- **Why:** The brief explicitly requires the ledger to be the source of truth.

## Decision 4

- **Chose:** Simple JWT session cookies for the assessment.
- **Rejected:** A larger auth provider integration on Day 1.
- **Why:** The app needs role enforcement more than social login or account recovery.

## Decision 5

- **Chose:** Keep Prisma 7 and adapt the app to its config and PostgreSQL adapter requirements.
- **Rejected:** Downgrading to older Prisma APIs after the first validation error.
- **Why:** The installed Prisma CLI and client now match, and the required changes are small: move `DATABASE_URL` into `prisma.config.ts` and instantiate Prisma Client with `@prisma/adapter-pg`.

- **Later reversed:** This reversed the initial assumption that the database URL should stay inside `schema.prisma`.

## Decision 6

- **Chose:** Store transfers as one ledger row with both source and destination locations.
- **Rejected:** Creating separate issue and receipt rows for every transfer.
- **Why:** One row keeps the transfer atomic and easier to audit while the stock helper still calculates per-location balances correctly.

## Decision 7

- **Chose:** Enforce inventory rules in Server Actions, not only in the UI.
- **Rejected:** Hiding buttons as the only permission control.
- **Why:** Server Actions are reachable by POST requests, so each mutation re-checks authentication, role, location assignment, archived item state, and negative-stock rules.

## Decision 8

- **Chose:** Process CSV imports one row at a time and return a result for every row.
- **Rejected:** Abort the entire file when one row is invalid.
- **Why:** Assessment reviewers can see exactly which rows succeeded and fix only the failed data without losing valid work.

## Decision 9

- **Chose:** Use URL query parameters for item search, filters, sorting, and pagination.
- **Rejected:** Load the complete catalog and filter only in browser state.
- **Why:** URLs remain shareable, refresh-safe, and compatible with server-side database filtering as the catalog grows.

## Decision 10

- **Chose:** Keep item timeline entries append-only and expose only an add-note action.
- **Rejected:** Add edit and delete controls for audit history.
- **Why:** Creation, field changes, and staff notes must remain trustworthy after they are recorded.

## Decision 11

- **Chose:** Use a small PostgreSQL pool with bounded queries and one retry for transient reads.
- **Rejected:** Open many parallel connections or automatically retry uncertain stock writes.
- **Why:** Supabase session-pooler connections are limited, while duplicate inventory mutations would be more harmful than a visible retry message.

## Decision 12

- **Chose:** Enable RLS and remove Supabase client-role grants on the server-owned inventory tables.
- **Rejected:** Public API access or broad `USING (true)` policies to silence the security advisor.
- **Why:** This app authenticates with its own JWT cookies and accesses PostgreSQL through Prisma. Supabase API roles do not represent the application's manager/staff sessions. Denying their table access closes an alternate path around server authorization while preserving the existing server connection and records. Private default grants and a read-only security check help catch regressions.

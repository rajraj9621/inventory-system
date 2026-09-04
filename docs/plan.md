# Plan

## Five-day build plan

- Day 1: Set up the Next.js project, Prisma/PostgreSQL schema, auth helpers, manager/staff roles, demo users, protected layout, and starter documentation.
- Day 2: Build item/category/location management and stock movement recording with append-only ledger rules.
- Day 3: Add staff-location assignment enforcement and the server-side searchable/filterable/paginated item list.
- Day 4: Add CSV import/export, dashboard reporting, and item timeline entries.
- Day 5: Finish low-stock alert dismiss/reappear behavior, test the main workflows, deploy, and complete submission docs.

## Day 1 actual work

- Normalized Prisma CLI/client versions to the same release.
- Updated Prisma configuration for Prisma 7, where the database URL belongs in `prisma.config.ts` and the app uses the PostgreSQL driver adapter.
- Added the database schema for all required entities up front to avoid later migrations that rewrite core relationships.
- Added seed data for manager and staff demo accounts, categories, locations, assignments, items, starting movements, and timeline entries.
- Added JWT cookie auth with password hashing and server-side role helpers.
- Added protected app navigation and placeholder pages for the next build days.

## Day 2 actual work

- Added manager-only create/edit/archive/restore actions for items.
- Added manager-only creation for categories and locations.
- Added receipt, issue, transfer, and adjustment actions backed by append-only `StockMovement` rows.
- Added server-side validation for active items, active locations, staff location assignments, adjustment reasons, and non-negative stock.
- Updated item, movement, dashboard, alert, and staff pages so the visible app feels like an operations tool instead of a scaffold.

## Cut line

Stretch ideas are intentionally out of scope. If time runs short, the priority is correct server-side inventory rules over visual polish.

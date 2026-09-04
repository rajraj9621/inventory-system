# Submission

## Links

- **GitHub repository:** https://github.com/rajraj9621/inventory-system
- **Live application:** https://inventory-system-peach-omega.vercel.app

## Notes for the reviewer

The application uses Supabase PostgreSQL and may take a little longer on the first request while the remote database connection warms. Use the seeded demo credentials below to compare manager and staff permissions.

## Demo credentials

| Role | Email | Password |
|------|-------|----------|
| Inventory manager | manager@example.com | Password123! |
| Warehouse staff 1 | staff@example.com | Password123! |
| Warehouse staff 2 | staff2@example.com | Password123! |

## Stack

| Layer | What you used | Why |
|-------|---------------|-----|
| Frontend | Next.js App Router, React, Tailwind CSS | Fast full-stack workflow and simple deployment |
| Backend | Next.js server actions and server components | Keeps auth and role checks on the server |
| Database | Supabase PostgreSQL with Prisma | Relational model fits inventory, ledger, and reports |
| Hosting | Vercel and Supabase | Free tiers and direct Next.js deployment |

## Goal checklist

Mark each honestly. Partial is fine.

| # | Goal | Status | Notes |
|---|------|--------|-------|
| 1 | Accounts and roles | Done | Email/password login, registration, hashed passwords, JWT session cookie, manager/staff roles, staff manager selection, and protected app layout |
| 2 | Items | Done | Manager can create, edit, archive, and restore items; categories are manager-maintained |
| 3 | Stock movements | Done | Receipt, issue, transfer, and adjustment forms are implemented with server-side validation |
| 4 | Stock ledger | Done | On-hand stock is derived from append-only movements; negative stock is rejected server-side |
| 5 | Location assignment | Done | Managers assign their staff to active locations; server actions enforce those assignments for every movement |
| 6 | Finding items | Done | Server-side name/SKU search, category/location/status/stock filters, sorting, pagination, and item details |
| 7 | Bulk import and export | Done | Item and receipt CSV imports report every row; current location balances export to CSV |
| 8 | Dashboard | Done | Operational cards, recent movements, low-stock preview, category/location charts, and eight-week volume |
| 9 | History you cannot rewrite | Done | Append-only movement history and item timeline with create/edit/archive/restore events and permanent notes |
| 10 | Low-stock alerts | Partial | Automatic alert badge and low-stock list are complete; explicit dismiss/reappear controls are not included |

## How much time did you actually spend?

Built across five focused implementation and verification stages.

## What would you do next, with another 12 hours?

- Add automated browser integration tests for manager and staff workflows.
- Add optional low-stock alert dismissal and reappearance controls.
- Add structured production monitoring for Supabase latency and failed server actions.
- Add organization-level tenancy if multiple independent companies need to share one deployment.

## What are you least happy with in this codebase, and why?

The dashboard intentionally performs several independent reporting queries against a remote database. They are parallelized through a conservative connection pool, but the first cold request is still more sensitive to Supabase network latency than the smaller operational pages.

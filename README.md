# Inventory Stock Control

Inventory Stock Control is a full-stack inventory application for teams that manage stock across multiple locations. It provides a permanent stock ledger, role-based access, low-stock monitoring, CSV tools, operational dashboards, and complete item history.

## What The Application Does

- Maintains an item catalog with unique SKUs, categories, units, and reorder levels.
- Tracks stock independently at each active location.
- Calculates on-hand quantities from an append-only movement ledger.
- Records receipts, issues, transfers, and manager adjustments.
- Prevents issues or transfers that would create negative stock.
- Automatically identifies items at or below their reorder level.
- Lets managers assign staff members to specific locations.
- Provides server-side inventory search, filtering, sorting, and pagination.
- Imports items and stock receipts from CSV files with a result for every row.
- Exports current item and location balances to CSV.
- Shows dashboard totals, category/location charts, and eight-week movement volume.
- Preserves item changes, stock movements, and notes as an audit history.

## Roles And Permissions

### Manager

A manager controls the inventory workspace and can:

- Create and edit items.
- Archive and restore items.
- Create categories and locations.
- Record receipts, issues, transfers, and adjustments.
- Change item reorder levels.
- View stock and movement history across all locations.
- View low-stock alerts and dashboard reports.
- Assign linked staff members to active locations.
- Import items and stock receipts from CSV files.
- Export current stock to CSV.
- Add permanent notes to item timelines.

### Staff

A staff member belongs to a selected manager and can:

- View and search the inventory catalog.
- View item details, stock history, and timeline entries.
- Record receipts and issues only at assigned locations.
- Transfer stock only when both locations are assigned to them.
- Add permanent notes to item timelines.
- Export stock for assigned locations.

Staff members cannot create or edit catalog records, archive items, perform adjustments, manage users, change location assignments, or import CSV files. These restrictions are enforced on the server as well as in the interface.

## Demo Accounts

These accounts are created by `npm run db:seed`. Both staff accounts are linked to the demo manager.

| Role | Name | Email | Password | Linked account |
| --- | --- | --- | --- | --- |
| Manager | Demo Manager | `manager@example.com` | `Password123!` | Manages Demo Staff 1 and Demo Staff 2 |
| Staff | Demo Staff 1 | `staff@example.com` | `Password123!` | Managed by Demo Manager; Main Warehouse and Retail Floor A |
| Staff | Demo Staff 2 | `staff2@example.com` | `Password123!` | Managed by Demo Manager; Retail Floor A only |

> These credentials are intentionally public demo credentials. Do not reuse them for a real production account.

### Seeded Demo Inventory

The seed provides these ready-to-test balances in addition to the original bolt and carton examples:

| SKU | Item | Main Warehouse | Retail Floor A | Total | Reorder | Status |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `DEMO-PAPER-A4` | Demo A4 Copy Paper | 35 | 15 | 50 | 12 | Healthy |
| `DEMO-MOUSE-WL` | Demo Wireless Mouse | 16 | 8 | 24 | 6 | Healthy |
| `DEMO-TAPE-48` | Demo Packing Tape | 24 | 12 | 36 | 10 | Healthy |
| `DEMO-INK-BLK` | Demo Black Ink Cartridge | 4 | 0 | 4 | 5 | Low stock |
| `DEMO-GLOVE-L` | Demo Work Gloves Large | 14 | 6 | 20 | 8 | Healthy |

Demo Staff 1 can record movements at both seeded locations. Demo Staff 2 can operate only at Retail Floor A and should be blocked from Main Warehouse. The ink cartridge starts below its reorder level so the Alerts page has an immediate test case.

## Stock Movement Rules

| Movement | Effect | Who can record it |
| --- | --- | --- |
| Receipt | Adds stock to one location | Manager or assigned staff |
| Issue | Removes stock from one location | Manager or assigned staff |
| Transfer | Moves stock between two locations without changing total stock | Manager or staff assigned to both locations |
| Adjustment | Corrects stock after a count, loss, or damage; a reason is required | Manager only |

Archived items reject new movements. Issue, transfer, and negative adjustment requests are rejected when they would make a location balance negative. Movement validation runs in serializable database transactions to protect stock during concurrent requests.

## Low-Stock Alerts

An active item appears in Alerts when:

```text
on-hand quantity <= reorder level
```

Receiving enough stock to raise the quantity above the reorder level clears the alert automatically. Changing the reorder level also recalculates the status.

## CSV Import And Export

Managers can download templates from the Data page and import these formats:

**Item import**

```csv
sku,name,description,unitOfMeasure,reorderLevel,category
```

**Receipt import**

```csv
sku,quantity,location,reason
```

Imports are limited to 1 MB and 500 data rows. Each row reports success or failure with a reason. Sample valid and invalid files are available in `tests/fixtures/`.

## Technology

- Next.js 16 App Router and React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- Supabase PostgreSQL
- PostgreSQL connection pooling through `@prisma/adapter-pg`
- bcrypt password hashing
- Signed HTTP-only JWT session cookies
- Zod server-side validation
- Recharts dashboard charts
- Papa Parse CSV processing
- Vercel hosting

## Project Structure

```text
app/                    Next.js routes, layouts, pages, and API endpoints
lib/                    Authentication, database, stock calculations, and actions
prisma/                 Prisma schema, migrations, and seed data
docs/                   Architecture, schema, decisions, plan, and AI notes
tests/fixtures/          CSV files for manual import validation
```

## Local Setup

### Prerequisites

- Node.js 20 or newer
- npm
- A Supabase PostgreSQL project

### 1. Install dependencies

```powershell
cd "C:\Projects\inventory-system"
npm install
```

### 2. Configure environment variables

Create `.env` from `.env.example` and provide:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
JWT_SECRET="a-random-secret-containing-at-least-32-characters"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Use the Supabase pooler connection string when direct IPv6 connectivity is unavailable. Never commit `.env`; it is excluded by `.gitignore`.

### 3. Prepare the database

```powershell
npm run db:generate
npm run db:migrate -- --name init
npm run db:seed
```

### 4. Start development

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production-style local run

```powershell
npm run build
npm run start
```

## Verification

```powershell
npm run lint
npm run build
```

The application has also been checked against the connected Supabase database for negative balances, malformed transfers, duplicate SKUs, invalid adjustments, archived-item activity, manager/staff access, and production page response times.

## Deployment

The application is designed for Vercel with Supabase as the persistent database.

1. Push the repository to GitHub.
2. Import the GitHub repository into Vercel.
3. Add `DATABASE_URL`, `JWT_SECRET`, and `NEXT_PUBLIC_APP_URL` in Vercel Project Settings.
4. Deploy the project.
5. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS deployment URL and redeploy if necessary.

Database migrations and seed data should be applied from a trusted development environment before the first production deployment.

## Additional Documentation

- [`docs/architecture.md`](docs/architecture.md)
- [`docs/schema.md`](docs/schema.md)
- [`docs/decisions.md`](docs/decisions.md)
- [`docs/ai-prompts.md`](docs/ai-prompts.md)

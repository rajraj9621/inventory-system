# Architecture

## Moving pieces

- Next.js App Router serves React pages, route handlers, and Server Actions from one deployable codebase.
- Prisma 7 with the PostgreSQL adapter is the database access layer.
- Supabase PostgreSQL stores users, catalog data, assignments, stock ledger rows, timeline entries, and alert dismissals.
- Signed JWTs in HTTP-only cookies identify the current user. Every mutation validates the user again on the server.
- Tailwind CSS provides the application UI and Recharts renders dashboard reports.
- Papa Parse reads manager-uploaded CSV files and writes stock export files.

## Application boundaries

- Public: login and registration.
- Protected: dashboard, catalog, item history, movements, alerts, and CSV stock export.
- Manager-only: catalog mutations, adjustments, staff-location assignment, and CSV imports.
- Staff: receipt, issue, and transfer actions only for assigned active locations. Staff cannot create catalog records or adjustments.

The UI hides unavailable controls, but Server Actions are the authorization boundary. A crafted POST request is subject to the same role, ownership, assignment, archive, and stock checks.

## Inventory flow

`StockMovement` is append-only. Receipts add stock, issues subtract stock, transfers move stock between two locations without changing the item total, and signed adjustments require a reason. On-hand totals are calculated with grouped database queries and shared stock helpers. Serializable movement transactions prevent concurrent issue or transfer requests from producing negative stock.

## Catalog discovery

The items page accepts URL query parameters for name/SKU search, category, visible location, archive status, low-stock status, sort order, and page. The server applies catalog filters in PostgreSQL, derives stock-dependent filters from grouped ledger totals, sorts the result, and returns an eight-row page with a total count. Item detail pages load complete movement history and an immutable creation/change/note timeline.

## CSV and reporting

Manager CSV imports are capped at 1 MB and 500 rows. Each row is validated and saved independently, producing a row number, success state, and failure reason. Current-stock export is generated from ledger balances at request time and is restricted to locations visible to the signed-in user. Dashboard charts use the same derived totals for category, location, and eight-week receipt/issue volume.

## Resilience

The PostgreSQL pool is deliberately small for Supabase's session pooler. Read operations retry one transient disconnect, queries and transactions have bounded timeouts, and protected pages show a retryable error boundary. Stock mutations do not blindly retry after an uncertain write.

## Representative request path

A user signs in through the login form, which calls a Server Action. The action validates credentials through Prisma, verifies the password hash, writes an HTTP-only session cookie, and redirects into the protected layout. A stock issue then validates the session, role and location assignment, locks the rules into a serializable transaction, checks the current location balance, appends a ledger row, and revalidates affected pages.

## Not building yet

Separate backend services, background jobs, social login, purchase orders, barcode scanning, and other stretch features remain out of scope for this assessment.

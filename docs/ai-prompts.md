# AI prompts

## Planning the build

### Prompt

Asked for a five-day plan for completing the ten required inventory assessment goals.

### What you got

A day-by-day split covering foundation, inventory ledger, permissions/search, import/export/dashboard/timeline, and final alerts/deployment.

### What you corrected

Clarified that stretch ideas should be ignored so the plan focuses only on the ten required goals.

## Choosing the stack

### Prompt

Asked what stack would be fastest for the assessment.

### What you got

Recommendation to use Next.js, Supabase PostgreSQL, Prisma, Tailwind CSS, Recharts, and Vercel.

### What you corrected

Kept the stack small and avoided adding separate backend services for Day 1.

## Day 1 foundation

### Prompt

Asked Codex to go through Day 1 foundation using the agreed plan.

### What you got

Schema, seed data, auth helpers, protected navigation, starter pages, and documentation scaffolding.

### What you corrected

Prisma initially installed a beta CLI version, so it was changed to match `@prisma/client`.

## Day 2 inventory core

### Prompt

Asked Codex to implement manager catalog controls and receipt, issue, transfer, and adjustment workflows.

### What you got

Append-only stock movements, derived item/location balances, archive protection, required adjustment reasons, and server-side negative-stock checks.

### What you corrected

Moved the working project out of OneDrive and stabilized the Supabase session-pooler connection after repeated connection termination errors.

## Day 3 permissions and item discovery

### Prompt

Asked Codex to implement staff-location restrictions, server-side item finding, pagination, and full item history.

### What you got

Manager assignment controls, server-enforced staff access, URL-based search/filter/sort/pagination, and item detail pages with complete movement and immutable timeline history.

### What you corrected

Kept authentication uncached per request after testing showed that request-level identity must never be reused between manager and staff sessions.

## Day 4 imports and reporting

### Prompt

Asked Codex to implement CSV item/receipt import, per-row results, stock export, dashboard charts, and item notes while checking errors during the build.

### What you got

Bounded CSV processing, row-level success/failure reasons, ledger-derived export, three dashboard reports, and append-only notes.

### What you corrected

Kept imports manager-only, limited file size and row count, escaped spreadsheet formula prefixes in exports, and reused the same stock calculation helpers throughout the application.

## Supabase security warning

Investigated a Supabase `rls_disabled_in_public` warning. Added a permissions-only migration enabling RLS and revoking direct client access on inventory and migration tables, while retaining server-side Prisma access. Added repeatable checks for actual API-role permission denials and private default grants. Existing application records must be preserved when applying this change.

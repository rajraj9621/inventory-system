# Schema

## Tables

- `User`: login/registration account with `email`, `passwordHash`, `name`, `role`, optional `managerId`, `active`, and timestamps.
- `Category`: manager-maintained item category list.
- `Location`: physical stock location with name, optional description, active flag, and timestamps.
- `StaffLocationAssignment`: many-to-many join between staff users and locations, including who assigned it.
- `Item`: SKU, name, description, unit of measure, reorder level, category, optional creator, archive timestamp, and timestamps.
- `StockMovement`: append-only ledger row for receipt, issue, transfer, or adjustment. It stores item, quantity, primary location, optional transfer source/destination, optional adjustment reason, recorder, and timestamp.
- `ItemTimelineEntry`: append-only item history for creation, field changes, and notes.
- `LowStockAlertDismissal`: records manager dismissals for low-stock alerts and when a dismissal has been resolved by stock recovering.

## Relationships

- One category has many items.
- One item has many stock movements, timeline entries, and alert dismissals.
- One user records many stock movements.
- One user can create many items.
- One manager can have many staff users; each staff user can choose one manager during registration.
- Staff users and locations are many-to-many through `StaffLocationAssignment`.
- Locations appear on stock movements as the primary location and, for transfers, source/destination locations.

## Constraint split

The database enforces uniqueness, required fields, foreign keys, and many-to-many uniqueness. Application code enforces conditional business rules: adjustment reason required, archived items cannot receive movements, staff can only use assigned locations, transfer source/destination rules, and movements cannot drive stock negative.

## Denormalisation

The schema does not store item on-hand quantity. Stock is derived from ledger rows. `LowStockAlertDismissal.stockAtDismissal` is intentionally stored as a snapshot so reviewers can see why an alert was dismissed at that time.

## Ledger Stock Math

- `RECEIPT`: adds quantity to `locationId`.
- `ISSUE`: subtracts quantity from `locationId`.
- `TRANSFER`: subtracts quantity from `sourceLocationId` and adds quantity to `destinationLocationId`; total item stock does not change.
- `ADJUSTMENT`: adds the signed quantity to `locationId` and must include a reason.

## 100x data concern

The first pressure point will be deriving stock totals from raw ledger rows for every item. At larger scale, the app would need indexed summary tables or materialized views fed by the append-only ledger.

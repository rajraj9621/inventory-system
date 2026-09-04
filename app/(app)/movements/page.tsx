import { ArrowRightLeft, ClipboardList, MinusCircle, PackagePlus, SlidersHorizontal } from "lucide-react";
import { MovementKind, Prisma, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { recordMovementAction } from "@/lib/actions/inventory";
import { db, withDatabaseRetry } from "@/lib/db";
import { calculateLocationTotalsByItem } from "@/lib/stock";

export const dynamic = "force-dynamic";

type MovementsPageProps = {
  searchParams: Promise<{ success?: string | string[]; error?: string | string[] }>;
};

type ItemOption = {
  id: string;
  sku: string;
  name: string;
};

type LocationOption = {
  id: string;
  name: string;
};

const fieldClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";
const labelClass = "space-y-1 text-sm font-medium text-slate-700";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function FlashMessage({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) {
    return null;
  }

  return (
    <div
      className={`rounded-md border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? success}
    </div>
  );
}

function ItemSelect({ items }: { items: ItemOption[] }) {
  return (
    <select name="itemId" className={fieldClass} defaultValue="" required>
      <option value="" disabled>
        Select item
      </option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.sku} - {item.name}
        </option>
      ))}
    </select>
  );
}

function LocationSelect({
  locations,
  name = "locationId",
  label = "Select location",
}: {
  locations: LocationOption[];
  name?: string;
  label?: string;
}) {
  return (
    <select name={name} className={fieldClass} defaultValue="" required>
      <option value="" disabled>
        {label}
      </option>
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.name}
        </option>
      ))}
    </select>
  );
}

function signedQuantity(kind: MovementKind, quantity: number) {
  if (kind === MovementKind.RECEIPT) {
    return `+${quantity}`;
  }

  if (kind === MovementKind.ISSUE) {
    return `-${quantity}`;
  }

  if (kind === MovementKind.ADJUSTMENT && quantity > 0) {
    return `+${quantity}`;
  }

  return String(quantity);
}

export default async function MovementsPage({ searchParams }: MovementsPageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const locationWhere: Prisma.LocationWhereInput =
    user.role === UserRole.MANAGER
      ? { active: true }
      : { active: true, staffAssignments: { some: { staffId: user.id } } };

  const [items, locations, stockTotals, recentMovements] = await withDatabaseRetry(() =>
    Promise.all([
      db.item.findMany({
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          sku: true,
          name: true,
          reorderLevel: true,
        },
      }),
      db.location.findMany({
        where: locationWhere,
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.stockMovement.groupBy({
        by: ["itemId", "kind", "locationId", "sourceLocationId", "destinationLocationId"],
        _sum: {
          quantity: true,
        },
      }),
      db.stockMovement.findMany({
        take: 12,
        orderBy: { createdAt: "desc" },
        include: {
          item: { select: { sku: true, name: true } },
          location: { select: { name: true } },
          sourceLocation: { select: { name: true } },
          destinationLocation: { select: { name: true } },
          recordedBy: { select: { name: true } },
        },
      }),
    ]),
  );

  const balancesByItem = calculateLocationTotalsByItem(stockTotals);
  const stockRows = items
    .flatMap((item) => {
      const balances = balancesByItem.get(item.id);
      return locations.map((location) => ({
        item,
        location,
        quantity: balances?.get(location.id) ?? 0,
      }));
    })
    .filter((row) => row.quantity !== 0);

  const canRecord = items.length > 0 && locations.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Stock ledger</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Movements</h1>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200">
            Items: {items.length}
          </span>
          <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200">
            Locations: {locations.length}
          </span>
        </div>
      </div>

      <FlashMessage success={firstParam(params.success)} error={firstParam(params.error)} />

      {!canRecord ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Add at least one active item and one active location before recording movements.
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <form action={recordMovementAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="kind" value={MovementKind.RECEIPT} />
          <div className="flex items-center gap-2">
            <PackagePlus className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Receipt</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Item
              <ItemSelect items={items} />
            </label>
            <label className={labelClass}>
              Location
              <LocationSelect locations={locations} />
            </label>
            <label className={labelClass}>
              Quantity
              <input name="quantity" type="number" min="1" className={fieldClass} required />
            </label>
          </div>
          <button
            type="submit"
            disabled={!canRecord}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Save receipt
          </button>
        </form>

        <form action={recordMovementAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="kind" value={MovementKind.ISSUE} />
          <div className="flex items-center gap-2">
            <MinusCircle className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Issue</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Item
              <ItemSelect items={items} />
            </label>
            <label className={labelClass}>
              Location
              <LocationSelect locations={locations} />
            </label>
            <label className={labelClass}>
              Quantity
              <input name="quantity" type="number" min="1" className={fieldClass} required />
            </label>
          </div>
          <button
            type="submit"
            disabled={!canRecord}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Save issue
          </button>
        </form>

        <form action={recordMovementAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="kind" value={MovementKind.TRANSFER} />
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-teal-700" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-950">Transfer</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Item
              <ItemSelect items={items} />
            </label>
            <label className={labelClass}>
              Quantity
              <input name="quantity" type="number" min="1" className={fieldClass} required />
            </label>
            <label className={labelClass}>
              Source
              <LocationSelect locations={locations} name="sourceLocationId" label="Source location" />
            </label>
            <label className={labelClass}>
              Destination
              <LocationSelect locations={locations} name="destinationLocationId" label="Destination location" />
            </label>
          </div>
          <button
            type="submit"
            disabled={!canRecord}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            Save transfer
          </button>
        </form>

        {user.role === UserRole.MANAGER ? (
          <form action={recordMovementAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="kind" value={MovementKind.ADJUSTMENT} />
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-teal-700" aria-hidden="true" />
              <h2 className="text-base font-semibold text-slate-950">Adjustment</h2>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Item
                <ItemSelect items={items} />
              </label>
              <label className={labelClass}>
                Location
                <LocationSelect locations={locations} />
              </label>
              <label className={labelClass}>
                Signed quantity
                <input name="quantity" type="number" className={fieldClass} placeholder="-3 or 8" required />
              </label>
              <label className={labelClass}>
                Reason
                <input name="reason" className={fieldClass} placeholder="Cycle count correction" required />
              </label>
            </div>
            <button
              type="submit"
              disabled={!canRecord}
              className="mt-4 inline-flex h-10 items-center rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              Save adjustment
            </button>
          </form>
        ) : null}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-950">On-hand by location</h2>
        </div>
        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Location</th>
                <th className="px-4 py-3 font-semibold">On hand</th>
                <th className="px-4 py-3 font-semibold">Reorder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {stockRows.length > 0 ? (
                stockRows.map((row) => (
                  <tr key={`${row.item.id}-${row.location.id}`}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-950">{row.item.name}</span>
                      <span className="text-xs text-slate-500">{row.item.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.location.name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-950">{row.quantity}</td>
                    <td className="px-4 py-3 text-slate-600">{row.item.reorderLevel}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={4}>
                    No stock balances for your visible locations yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-950">Recent ledger entries</h2>
        </div>

        <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
          {recentMovements.length > 0 ? (
            recentMovements.map((movement) => {
              const place =
                movement.kind === MovementKind.TRANSFER
                  ? `${movement.sourceLocation?.name ?? "Unknown"} -> ${movement.destinationLocation?.name ?? "Unknown"}`
                  : movement.location.name;

              return (
                <div
                  key={movement.id}
                  className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)_90px_140px]"
                >
                  <span className="font-medium text-slate-900">{movement.kind}</span>
                  <span className="text-slate-600">
                    {movement.item.sku} - {movement.item.name}
                  </span>
                  <span className="text-slate-600">{place}</span>
                  <span className="font-semibold text-slate-950">{signedQuantity(movement.kind, movement.quantity)}</span>
                  <span className="text-slate-500">{movement.recordedBy.name}</span>
                </div>
              );
            })
          ) : (
            <p className="px-4 py-3 text-sm text-slate-500">No movements yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

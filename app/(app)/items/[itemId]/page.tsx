import Link from "next/link";
import { ArrowLeft, ClipboardList, Clock3, MapPin, MessageSquarePlus } from "lucide-react";
import { MovementKind, TimelineEntryType } from "@prisma/client";
import { notFound } from "next/navigation";
import { addItemNoteAction } from "@/lib/actions/inventory";
import { requireUser } from "@/lib/auth";
import { db, withDatabaseRetry } from "@/lib/db";
import { calculateItemTotalsByItem, calculateLocationTotalsByItem } from "@/lib/stock";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ itemId: string }>;
  searchParams: Promise<{ success?: string | string[]; error?: string | string[] }>;
};

const firstParam = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;

function signedQuantity(kind: MovementKind, quantity: number) {
  if (kind === MovementKind.RECEIPT) return `+${quantity}`;
  if (kind === MovementKind.ISSUE) return `-${quantity}`;
  if (kind === MovementKind.ADJUSTMENT && quantity > 0) return `+${quantity}`;
  return String(quantity);
}

function timelineDescription(entry: {
  type: TimelineEntryType;
  fieldName: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
}) {
  if (entry.type === TimelineEntryType.CREATED) return entry.note ?? "Item created.";
  if (entry.type === TimelineEntryType.NOTE) return entry.note ?? "Note added.";
  const field = entry.fieldName === "reorderLevel" ? "reorder level" : entry.fieldName ?? "item";
  return `${field} changed from ${entry.oldValue ?? "blank"} to ${entry.newValue ?? "blank"}.`;
}

export default async function ItemDetailPage({ params, searchParams }: Props) {
  await requireUser();
  const { itemId } = await params;
  const query = await searchParams;

  const [item, movements, timeline, stockTotals, locationTotals, locations] = await withDatabaseRetry(() =>
    Promise.all([
      db.item.findUnique({
        where: { id: itemId },
        include: { category: { select: { name: true } }, createdBy: { select: { name: true } } },
      }),
      db.stockMovement.findMany({
        where: { itemId },
        orderBy: { createdAt: "desc" },
        include: {
          location: { select: { name: true } },
          sourceLocation: { select: { name: true } },
          destinationLocation: { select: { name: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      db.itemTimelineEntry.findMany({
        where: { itemId },
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      }),
      db.stockMovement.groupBy({
        by: ["itemId", "kind"],
        where: { itemId, kind: { in: [MovementKind.RECEIPT, MovementKind.ISSUE, MovementKind.ADJUSTMENT] } },
        _sum: { quantity: true },
      }),
      db.stockMovement.groupBy({
        by: ["itemId", "kind", "locationId", "sourceLocationId", "destinationLocationId"],
        where: { itemId },
        _sum: { quantity: true },
      }),
      db.location.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    ]),
  );

  if (!item) notFound();

  const onHand = calculateItemTotalsByItem(stockTotals).get(item.id) ?? 0;
  const balances = calculateLocationTotalsByItem(locationTotals).get(item.id) ?? new Map<string, number>();
  const locationRows = locations
    .map((location) => ({ ...location, quantity: balances.get(location.id) ?? 0 }))
    .filter((location) => location.quantity !== 0);
  const success = firstParam(query.success);
  const error = firstParam(query.error);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/items" className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Back to catalog</Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-teal-700">{item.sku}</p><h1 className="mt-2 text-2xl font-semibold text-slate-950">{item.name}</h1><p className="mt-2 text-sm text-slate-600">{item.category.name} - {item.unitOfMeasure}{item.description ? ` - ${item.description}` : ""}</p></div>
          <span className={`w-fit rounded-full px-3 py-1.5 text-xs font-semibold ${item.archivedAt ? "bg-slate-200 text-slate-700" : "bg-emerald-100 text-emerald-700"}`}>{item.archivedAt ? "Archived" : "Active"}</span>
        </div>
      </div>

      {success || error ? <div className={`rounded-md border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error ?? success}</div> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">On hand</p><p className="mt-2 text-3xl font-semibold text-slate-950">{onHand}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Reorder level</p><p className="mt-2 text-3xl font-semibold text-slate-950">{item.reorderLevel}</p></div>
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm text-slate-500">Stock status</p><p className={`mt-2 text-xl font-semibold ${onHand <= item.reorderLevel ? "text-amber-700" : "text-emerald-700"}`}>{onHand <= item.reorderLevel ? "Low stock" : "Healthy"}</p></div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.7fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2"><ClipboardList className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Full movement history</h2></div>
          <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Location</th><th className="px-4 py-3 font-semibold">Qty</th><th className="px-4 py-3 font-semibold">Recorded by</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {movements.length ? movements.map((movement) => {
                  const place = movement.kind === MovementKind.TRANSFER ? `${movement.sourceLocation?.name ?? "Unknown"} -> ${movement.destinationLocation?.name ?? "Unknown"}` : movement.location.name;
                  return <tr key={movement.id}><td className="whitespace-nowrap px-4 py-3 text-slate-500">{movement.createdAt.toLocaleString()}</td><td className="px-4 py-3 font-medium text-slate-900">{movement.kind}</td><td className="px-4 py-3 text-slate-600">{place}</td><td className="px-4 py-3 font-semibold text-slate-950">{signedQuantity(movement.kind, movement.quantity)}</td><td className="px-4 py-3 text-slate-600">{movement.recordedBy.name}</td></tr>;
                }) : <tr><td colSpan={5} className="px-4 py-3 text-slate-500">No movements recorded.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Stock by location</h2></div>
            <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">{locationRows.length ? locationRows.map((location) => <div key={location.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="text-slate-700">{location.name}</span><span className="font-semibold text-slate-950">{location.quantity}</span></div>) : <p className="px-4 py-3 text-sm text-slate-500">No location balances yet.</p>}</div>
          </div>
          <form action={addItemNoteAction} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="itemId" value={item.id} />
            <div className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Add staff note</h2></div>
            <label className="mt-4 block text-sm font-medium text-slate-700">Note<textarea name="note" required maxLength={1000} className="mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" placeholder="Add receiving, inspection, or purchasing context" /></label>
            <button type="submit" className="mt-3 inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"><MessageSquarePlus className="h-4 w-4" aria-hidden="true" />Add note</button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Immutable item timeline</h2></div>
        <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
          {timeline.length ? timeline.map((entry) => <div key={entry.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[150px_minmax(0,1fr)_160px]"><span className="text-slate-500">{entry.createdAt.toLocaleString()}</span><span className="text-slate-800">{timelineDescription(entry)}</span><span className="text-slate-500">{entry.actor?.name ?? "System"}</span></div>) : <p className="px-4 py-3 text-sm text-slate-500">No timeline entries yet.</p>}
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";
import { AlertTriangle, ClipboardList } from "lucide-react";
import { MovementKind } from "@prisma/client";
import { db, withDatabaseRetry } from "@/lib/db";
import { calculateItemTotalsByItem } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const [items, stockTotals] = await withDatabaseRetry(() =>
    Promise.all([
      db.item.findMany({
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          reorderLevel: true,
          category: { select: { name: true } },
        },
      }),
      db.stockMovement.groupBy({
        by: ["itemId", "kind"],
        where: {
          kind: {
            in: [MovementKind.RECEIPT, MovementKind.ISSUE, MovementKind.ADJUSTMENT],
          },
        },
        _sum: {
          quantity: true,
        },
      }),
    ]),
  );

  const onHandByItem = calculateItemTotalsByItem(stockTotals);
  const lowStockItems = items
    .map((item) => ({
      ...item,
      onHand: onHandByItem.get(item.id) ?? 0,
    }))
    .filter((item) => item.onHand <= item.reorderLevel);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Reorder queue</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Low-stock alerts</h1>
        </div>
        <Link
          href="/movements"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          <ClipboardList className="h-4 w-4" aria-hidden="true" />
          Record stock
        </Link>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-950">Active alerts</h2>
        </div>

        <div className="mt-4 overflow-x-auto rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Item</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">On hand</th>
                <th className="px-4 py-3 font-semibold">Reorder</th>
                <th className="px-4 py-3 font-semibold">Shortfall</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {lowStockItems.length > 0 ? (
                lowStockItems.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-950">{item.name}</span>
                      <span className="text-xs text-slate-500">{item.sku}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{item.category.name}</td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{item.onHand}</td>
                    <td className="px-4 py-3 text-slate-600">{item.reorderLevel}</td>
                    <td className="px-4 py-3 text-slate-600">{Math.max(item.reorderLevel - item.onHand, 0)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-3 text-slate-500" colSpan={5}>
                    No active low-stock items.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

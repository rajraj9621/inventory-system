import Link from "next/link";
import { AlertTriangle, Boxes, ClipboardList, Layers3, MapPin, UsersRound } from "lucide-react";
import { MovementKind } from "@prisma/client";
import { db, withDatabaseRetry } from "@/lib/db";
import { calculateItemTotalsByItem, calculateLocationTotalsByItem } from "@/lib/stock";
import { DashboardCharts } from "./dashboard-charts";

export const dynamic = "force-dynamic";

function movementQuantity(kind: MovementKind, quantity: number) {
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

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);

  const chartStart = new Date();
  chartStart.setHours(0, 0, 0, 0);
  chartStart.setDate(chartStart.getDate() - 49);

  const [
    categories,
    locations,
    users,
    movementsToday,
    movedThisWeek,
    activeStockItems,
    stockTotals,
    recentMovements,
    activeLocations,
    locationStockTotals,
    volumeMovements,
  ] = await withDatabaseRetry(() =>
    Promise.all([
      db.category.count(),
      db.location.count({ where: { active: true } }),
      db.user.count({ where: { active: true } }),
      db.stockMovement.count({ where: { createdAt: { gte: today } } }),
      db.stockMovement.findMany({
        where: { createdAt: { gte: weekStart } },
        distinct: ["itemId"],
        select: { itemId: true },
      }),
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
      db.stockMovement.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: {
          item: { select: { sku: true, name: true } },
          location: { select: { name: true } },
          sourceLocation: { select: { name: true } },
          destinationLocation: { select: { name: true } },
          recordedBy: { select: { name: true } },
        },
      }),
      db.location.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      db.stockMovement.groupBy({
        by: ["itemId", "kind", "locationId", "sourceLocationId", "destinationLocationId"],
        _sum: { quantity: true },
      }),
      db.stockMovement.findMany({
        where: {
          createdAt: { gte: chartStart },
          kind: { in: [MovementKind.RECEIPT, MovementKind.ISSUE] },
        },
        select: { kind: true, quantity: true, createdAt: true },
      }),
    ]),
  );

  const onHandByItem = calculateItemTotalsByItem(stockTotals);
  const lowStockItems = activeStockItems
    .map((item) => ({ ...item, onHand: onHandByItem.get(item.id) ?? 0 }))
    .filter((item) => item.onHand <= item.reorderLevel);
  const lowStockPreview = lowStockItems.slice(0, 8);
  const activeItems = activeStockItems.length;
  const categoryMap = new Map<string, number>();
  for (const item of activeStockItems) {
    categoryMap.set(item.category.name, (categoryMap.get(item.category.name) ?? 0) + (onHandByItem.get(item.id) ?? 0));
  }
  const categoryStock = [...categoryMap.entries()]
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity);
  const balancesByItem = calculateLocationTotalsByItem(locationStockTotals);
  const locationStock = activeLocations.map((location) => ({
    name: location.name,
    quantity: activeStockItems.reduce(
      (total, item) => total + (balancesByItem.get(item.id)?.get(location.id) ?? 0),
      0,
    ),
  }));
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeklyVolume = Array.from({ length: 8 }, (_, index) => {
    const start = new Date(chartStart.getTime() + index * weekMs);
    return {
      week: start.toLocaleDateString("en", { month: "short", day: "numeric" }),
      receipts: 0,
      issues: 0,
    };
  });
  for (const movement of volumeMovements) {
    const bucket = Math.floor((movement.createdAt.getTime() - chartStart.getTime()) / weekMs);
    if (bucket < 0 || bucket >= weeklyVolume.length) continue;
    if (movement.kind === MovementKind.RECEIPT) weeklyVolume[bucket].receipts += movement.quantity;
    if (movement.kind === MovementKind.ISSUE) weeklyVolume[bucket].issues += movement.quantity;
  }

  const stats = [
    { label: "Active items", value: activeItems, icon: Boxes },
    { label: "Low-stock items", value: lowStockItems.length, icon: AlertTriangle },
    { label: "Movements today", value: movementsToday, icon: ClipboardList },
    { label: "Items moved this week", value: movedThisWeek.length, icon: Layers3 },
    { label: "Categories", value: categories, icon: Layers3 },
    { label: "Locations", value: locations, icon: MapPin },
    { label: "Active users", value: users, icon: UsersRound },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Operations</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Inventory control dashboard</h1>
        </div>
        <div className="flex gap-2">
          <Link
            href="/items"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Boxes className="h-4 w-4" aria-hidden="true" />
            Catalog
          </Link>
          <Link
            href="/movements"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            <ClipboardList className="h-4 w-4" aria-hidden="true" />
            Movement
          </Link>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-slate-500">{stat.label}</p>
                <Icon className="h-4 w-4 text-teal-700" aria-hidden="true" />
              </div>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{stat.value}</p>
            </div>
          );
        })}
      </section>

      <DashboardCharts categoryStock={categoryStock} locationStock={locationStock} weeklyVolume={weeklyVolume} />

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Low-stock exceptions</h2>
            <Link href="/alerts" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              View all
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
            {lowStockPreview.length > 0 ? (
              lowStockPreview.map((item) => (
                <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-950">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.sku} - {item.category.name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-amber-700">{item.onHand}</p>
                    <p className="text-xs text-slate-500">Reorder {item.reorderLevel}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">No active low-stock items.</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-950">Recent activity</h2>
            <Link href="/movements" className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Ledger
            </Link>
          </div>
          <div className="mt-4 divide-y divide-slate-200 rounded-md border border-slate-200">
            {recentMovements.length > 0 ? (
              recentMovements.map((movement) => {
                const place =
                  movement.kind === MovementKind.TRANSFER
                    ? `${movement.sourceLocation?.name ?? "Unknown"} -> ${movement.destinationLocation?.name ?? "Unknown"}`
                    : movement.location.name;

                return (
                  <div key={movement.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[110px_minmax(0,1fr)_90px]">
                    <span className="font-medium text-slate-950">{movement.kind}</span>
                    <span className="text-slate-600">
                      {movement.item.sku} - {place}
                    </span>
                    <span className="font-semibold text-slate-950">{movementQuantity(movement.kind, movement.quantity)}</span>
                  </div>
                );
              })
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">No movements yet.</p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

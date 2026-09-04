import Papa from "papaparse";
import { Prisma, UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db, withDatabaseRetry } from "@/lib/db";
import { calculateLocationTotalsByItem } from "@/lib/stock";

export const dynamic = "force-dynamic";

function safeCell(value: string) {
  return /^[=+@-]/.test(value) ? `'${value}` : value;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const locationWhere: Prisma.LocationWhereInput =
    user.role === UserRole.MANAGER
      ? { active: true }
      : { active: true, staffAssignments: { some: { staffId: user.id } } };

  const [items, locations, totals] = await withDatabaseRetry(() =>
    Promise.all([
      db.item.findMany({
        where: { archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, sku: true, name: true, unitOfMeasure: true, reorderLevel: true, category: { select: { name: true } } },
      }),
      db.location.findMany({ where: locationWhere, orderBy: { name: "asc" }, select: { id: true, name: true } }),
      db.stockMovement.groupBy({
        by: ["itemId", "kind", "locationId", "sourceLocationId", "destinationLocationId"],
        _sum: { quantity: true },
      }),
    ]),
  );

  const balances = calculateLocationTotalsByItem(totals);
  const rows = items.flatMap((item) => locations.map((location) => ({
    sku: safeCell(item.sku),
    item: safeCell(item.name),
    category: safeCell(item.category.name),
    unitOfMeasure: safeCell(item.unitOfMeasure),
    location: safeCell(location.name),
    onHand: balances.get(item.id)?.get(location.id) ?? 0,
    reorderLevel: item.reorderLevel,
  })));
  const csv = Papa.unparse(rows, {
    columns: ["sku", "item", "category", "unitOfMeasure", "location", "onHand", "reorderLevel"],
  });
  const date = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="inventory-stock-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

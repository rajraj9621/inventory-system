import { MovementKind, type Prisma } from "@prisma/client";
import { db, withDatabaseRetry } from "@/lib/db";

type StockMovementForTotal = {
  kind: MovementKind;
  quantity: number;
  locationId?: string | null;
  sourceLocationId?: string | null;
  destinationLocationId?: string | null;
};

type StockReader = Prisma.TransactionClient | typeof db;

type GroupedLocationMovement = {
  itemId: string;
  kind: MovementKind;
  locationId: string | null;
  sourceLocationId: string | null;
  destinationLocationId: string | null;
  _sum: { quantity: number | null };
};

function addToBalance(balances: Map<string, number>, locationId: string | null | undefined, quantity: number) {
  if (!locationId) {
    return;
  }

  balances.set(locationId, (balances.get(locationId) ?? 0) + quantity);
}

export function calculateItemTotal(movements: StockMovementForTotal[]) {
  return movements.reduce((total, movement) => {
    if (movement.kind === MovementKind.RECEIPT) {
      return total + movement.quantity;
    }

    if (movement.kind === MovementKind.ISSUE) {
      return total - movement.quantity;
    }

    if (movement.kind === MovementKind.ADJUSTMENT) {
      return total + movement.quantity;
    }

    return total;
  }, 0);
}

export function calculateItemTotalsByItem(
  totals: Array<{
    itemId: string;
    kind: MovementKind;
    _sum: { quantity: number | null };
  }>,
) {
  const onHandByItem = new Map<string, number>();

  for (const total of totals) {
    if (total.kind === MovementKind.TRANSFER) {
      continue;
    }

    const quantity = total._sum.quantity ?? 0;
    const change = total.kind === MovementKind.ISSUE ? -quantity : quantity;
    onHandByItem.set(total.itemId, (onHandByItem.get(total.itemId) ?? 0) + change);
  }

  return onHandByItem;
}

export function calculateLocationBalances(movements: StockMovementForTotal[]) {
  const balances = new Map<string, number>();

  for (const movement of movements) {
    if (movement.kind === MovementKind.RECEIPT) {
      addToBalance(balances, movement.locationId, movement.quantity);
      continue;
    }

    if (movement.kind === MovementKind.ISSUE) {
      addToBalance(balances, movement.locationId, -movement.quantity);
      continue;
    }

    if (movement.kind === MovementKind.ADJUSTMENT) {
      addToBalance(balances, movement.locationId, movement.quantity);
      continue;
    }

    addToBalance(balances, movement.sourceLocationId, -movement.quantity);
    addToBalance(balances, movement.destinationLocationId, movement.quantity);
  }

  return balances;
}

export function calculateLocationTotalsByItem(totals: GroupedLocationMovement[]) {
  const balancesByItem = new Map<string, Map<string, number>>();

  for (const total of totals) {
    const balances = balancesByItem.get(total.itemId) ?? new Map<string, number>();
    const quantity = total._sum.quantity ?? 0;

    if (total.kind === MovementKind.RECEIPT) {
      addToBalance(balances, total.locationId, quantity);
    } else if (total.kind === MovementKind.ISSUE) {
      addToBalance(balances, total.locationId, -quantity);
    } else if (total.kind === MovementKind.ADJUSTMENT) {
      addToBalance(balances, total.locationId, quantity);
    } else {
      addToBalance(balances, total.sourceLocationId, -quantity);
      addToBalance(balances, total.destinationLocationId, quantity);
    }

    balancesByItem.set(total.itemId, balances);
  }

  return balancesByItem;
}

export async function getLocationOnHand(client: StockReader, itemId: string, locationId: string) {
  const totals = await client.stockMovement.groupBy({
    by: ["itemId", "kind", "locationId", "sourceLocationId", "destinationLocationId"],
    where: {
      itemId,
      OR: [
        { locationId },
        { sourceLocationId: locationId },
        { destinationLocationId: locationId },
      ],
    },
    _sum: {
      quantity: true,
    },
  });

  return calculateLocationTotalsByItem(totals).get(itemId)?.get(locationId) ?? 0;
}

export async function getLowStockAlertCount() {
  const [items, stockTotals] = await withDatabaseRetry(() =>
    Promise.all([
      db.item.findMany({
        where: { archivedAt: null },
        select: {
          id: true,
          reorderLevel: true,
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

  return items.filter((item) => (onHandByItem.get(item.id) ?? 0) <= item.reorderLevel).length;
}

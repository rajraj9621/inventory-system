import { UserRole } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth";
import { db, withDatabaseRetry } from "@/lib/db";

export function isManager(user: Pick<CurrentUser, "role">) {
  return user.role === UserRole.MANAGER;
}

export function canManageCatalog(user: Pick<CurrentUser, "role">) {
  return isManager(user);
}

export function canRecordAdjustment(user: Pick<CurrentUser, "role">) {
  return isManager(user);
}

export async function canUseLocation(user: Pick<CurrentUser, "id" | "role">, locationId: string) {
  if (isManager(user)) {
    return true;
  }

  const assignment = await withDatabaseRetry(() =>
    db.staffLocationAssignment.findUnique({
      where: {
        staffId_locationId: {
          staffId: user.id,
          locationId,
        },
      },
      select: { id: true },
    }),
  );

  return Boolean(assignment);
}

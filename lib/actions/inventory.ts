"use server";

import { MovementKind, Prisma, TimelineEntryType, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireManager, requireUser, type CurrentUser } from "@/lib/auth";
import { db, isTransientConnectionError } from "@/lib/db";
import { calculateItemTotalsByItem, getLocationOnHand } from "@/lib/stock";

const ITEMS_PATH = "/items";
const MOVEMENTS_PATH = "/movements";
const STAFF_PATH = "/staff";

class ActionError extends Error {}

const trimmedString = (message: string, max = 120) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().min(1, message).max(max),
  );

const optionalText = (max = 500) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().max(max).optional(),
  ).transform((value) => (value ? value : null));

const optionalId = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().optional(),
);

const categorySchema = z.object({
  name: trimmedString("Category name is required.", 80),
});

const locationSchema = z.object({
  name: trimmedString("Location name is required.", 80),
  description: optionalText(240),
});

const itemSchema = z.object({
  sku: trimmedString("SKU is required.", 64),
  name: trimmedString("Item name is required.", 120),
  description: optionalText(600),
  unitOfMeasure: trimmedString("Unit of measure is required.", 32),
  reorderLevel: z.coerce.number().int().min(0, "Reorder level cannot be negative."),
  categoryId: trimmedString("Choose a category."),
});

const updateItemSchema = itemSchema.extend({
  itemId: trimmedString("Choose an item."),
});

const itemIdSchema = z.object({
  itemId: trimmedString("Choose an item."),
});

const itemNoteSchema = z.object({
  itemId: trimmedString("Choose an item."),
  note: trimmedString("Note is required.", 1000),
});

const staffAssignmentSchema = z.object({
  staffId: trimmedString("Choose a staff member."),
  locationIds: z.array(z.string()).max(100),
});

const movementSchema = z.object({
  kind: z.enum(["RECEIPT", "ISSUE", "TRANSFER", "ADJUSTMENT"]),
  itemId: trimmedString("Choose an item."),
  locationId: optionalId,
  sourceLocationId: optionalId,
  destinationLocationId: optionalId,
  quantity: z.coerce.number().int(),
  reason: optionalText(300),
});

function formEntries(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

function pathWithToast(path: string, type: "success" | "error", message: string) {
  return `${path}?${type}=${encodeURIComponent(message)}`;
}

function actionErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ActionError) {
    return error.message;
  }

  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? fallback;
  }

  if (isTransientConnectionError(error)) {
    return "The database connection was interrupted. Try the operation again.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return "That value already exists. Use a unique SKU, category, or location name.";
    }

    if (error.code === "P2003") {
      return "Choose valid related records before saving.";
    }

    if (error.code === "P2028") {
      return "The database was busy for too long. Try the operation again.";
    }
  }

  return fallback;
}

async function runInventoryAction(path: string, successMessage: string, operation: () => Promise<void>) {
  try {
    await operation();
    revalidatePath("/dashboard");
    revalidatePath("/items");
    revalidatePath("/movements");
    revalidatePath("/alerts");
    return pathWithToast(path, "success", successMessage);
  } catch (error) {
    return pathWithToast(path, "error", actionErrorMessage(error, "Could not save changes."));
  }
}

function requireLocationId(value: string | undefined, message: string) {
  if (!value) {
    throw new ActionError(message);
  }

  return value;
}

async function assertActiveLocation(tx: Prisma.TransactionClient, locationId: string) {
  const location = await tx.location.findFirst({
    where: { id: locationId, active: true },
    select: { id: true },
  });

  if (!location) {
    throw new ActionError("Choose an active location.");
  }
}

async function assertUserCanUseLocation(
  tx: Prisma.TransactionClient,
  user: Pick<CurrentUser, "id" | "role">,
  locationId: string,
) {
  if (user.role === UserRole.MANAGER) {
    return;
  }

  const assignment = await tx.staffLocationAssignment.findUnique({
    where: {
      staffId_locationId: {
        staffId: user.id,
        locationId,
      },
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new ActionError("You can only record stock for your assigned locations.");
  }
}

async function resolveRecoveredDismissals(tx: Prisma.TransactionClient, itemId: string, reorderLevel: number) {
  const totals = await tx.stockMovement.groupBy({
    by: ["itemId", "kind"],
    where: {
      itemId,
      kind: {
        in: [MovementKind.RECEIPT, MovementKind.ISSUE, MovementKind.ADJUSTMENT],
      },
    },
    _sum: {
      quantity: true,
    },
  });
  const total = calculateItemTotalsByItem(totals).get(itemId) ?? 0;

  if (total > reorderLevel) {
    await tx.lowStockAlertDismissal.updateMany({
      where: { itemId, resolvedAt: null },
      data: { resolvedAt: new Date() },
    });
  }
}

async function runSerializableMovement(operation: (tx: Prisma.TransactionClient) => Promise<void>) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await db.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 15_000,
        timeout: 20_000,
      });
      return;
    } catch (error) {
      const canRetry =
        attempt === 0 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";

      if (!canRetry) {
        throw error;
      }
    }
  }
}

export async function createCategoryAction(formData: FormData) {
  await requireManager();
  const target = await runInventoryAction(ITEMS_PATH, "Category created.", async () => {
    const data = categorySchema.parse(formEntries(formData));
    await db.category.create({ data });
  });

  redirect(target);
}

export async function createLocationAction(formData: FormData) {
  await requireManager();
  const target = await runInventoryAction(ITEMS_PATH, "Location created.", async () => {
    const data = locationSchema.parse(formEntries(formData));
    await db.location.create({ data });
  });

  redirect(target);
}

export async function createItemAction(formData: FormData) {
  const user = await requireManager();
  const target = await runInventoryAction(ITEMS_PATH, "Item created.", async () => {
    const data = itemSchema.parse(formEntries(formData));

    await db.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          ...data,
          createdById: user.id,
        },
        select: { id: true },
      });

      await tx.itemTimelineEntry.create({
        data: {
          itemId: item.id,
          type: TimelineEntryType.CREATED,
          note: "Item created.",
          actorId: user.id,
        },
      });
    });
  });

  redirect(target);
}

export async function updateItemAction(formData: FormData) {
  const user = await requireManager();
  const target = await runInventoryAction(ITEMS_PATH, "Item updated.", async () => {
    const data = updateItemSchema.parse(formEntries(formData));

    await db.$transaction(async (tx) => {
      const current = await tx.item.findUnique({
        where: { id: data.itemId },
        select: {
          sku: true,
          name: true,
          description: true,
          unitOfMeasure: true,
          reorderLevel: true,
          categoryId: true,
          category: { select: { name: true } },
        },
      });

      if (!current) {
        throw new ActionError("Item was not found.");
      }

      const changes: Array<{ fieldName: string; oldValue: string | null; newValue: string | null }> = [];
      const track = (fieldName: string, oldValue: string | number | null, newValue: string | number | null) => {
        const oldText = oldValue === null ? null : String(oldValue);
        const newText = newValue === null ? null : String(newValue);

        if (oldText !== newText) {
          changes.push({ fieldName, oldValue: oldText, newValue: newText });
        }
      };

      track("sku", current.sku, data.sku);
      track("name", current.name, data.name);
      track("description", current.description, data.description);
      track("unitOfMeasure", current.unitOfMeasure, data.unitOfMeasure);
      track("reorderLevel", current.reorderLevel, data.reorderLevel);
      if (current.categoryId !== data.categoryId) {
        const nextCategory = await tx.category.findUnique({
          where: { id: data.categoryId },
          select: { name: true },
        });
        track("category", current.category.name, nextCategory?.name ?? data.categoryId);
      }

      await tx.item.update({
        where: { id: data.itemId },
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description,
          unitOfMeasure: data.unitOfMeasure,
          reorderLevel: data.reorderLevel,
          categoryId: data.categoryId,
        },
      });

      if (changes.length > 0) {
        await tx.itemTimelineEntry.createMany({
          data: changes.map((change) => ({
            ...change,
            itemId: data.itemId,
            type: TimelineEntryType.FIELD_CHANGED,
            actorId: user.id,
          })),
        });
      }
    });
  });

  redirect(target);
}

export async function archiveItemAction(formData: FormData) {
  const user = await requireManager();
  const target = await runInventoryAction(ITEMS_PATH, "Item archived.", async () => {
    const { itemId } = itemIdSchema.parse(formEntries(formData));

    await db.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: itemId },
        data: { archivedAt: new Date() },
      });

      await tx.itemTimelineEntry.create({
        data: {
          itemId,
          type: TimelineEntryType.FIELD_CHANGED,
          fieldName: "archivedAt",
          oldValue: null,
          newValue: "archived",
          actorId: user.id,
        },
      });
    });
  });

  redirect(target);
}

export async function restoreItemAction(formData: FormData) {
  const user = await requireManager();
  const target = await runInventoryAction(ITEMS_PATH, "Item restored.", async () => {
    const { itemId } = itemIdSchema.parse(formEntries(formData));

    await db.$transaction(async (tx) => {
      await tx.item.update({
        where: { id: itemId },
        data: { archivedAt: null },
      });

      await tx.itemTimelineEntry.create({
        data: {
          itemId,
          type: TimelineEntryType.FIELD_CHANGED,
          fieldName: "archivedAt",
          oldValue: "archived",
          newValue: null,
          actorId: user.id,
        },
      });
    });
  });

  redirect(target);
}

export async function recordMovementAction(formData: FormData) {
  const user = await requireUser();
  const target = await runInventoryAction(MOVEMENTS_PATH, "Stock movement recorded.", async () => {
    const data = movementSchema.parse(formEntries(formData));
    const kind = data.kind as MovementKind;

    if (kind !== MovementKind.ADJUSTMENT && data.quantity <= 0) {
      throw new ActionError("Quantity must be greater than zero.");
    }

    if (kind === MovementKind.ADJUSTMENT) {
      if (user.role !== UserRole.MANAGER) {
        throw new ActionError("Only managers can record adjustments.");
      }

      if (data.quantity === 0) {
        throw new ActionError("Adjustment quantity cannot be zero.");
      }

      if (!data.reason) {
        throw new ActionError("Adjustment reason is required.");
      }
    }

    await runSerializableMovement(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id: data.itemId },
        select: {
          id: true,
          archivedAt: true,
          reorderLevel: true,
        },
      });

      if (!item) {
        throw new ActionError("Choose a valid item.");
      }

      if (item.archivedAt) {
        throw new ActionError("Archived items cannot receive new stock movements.");
      }

      if (kind === MovementKind.TRANSFER) {
        const sourceLocationId = requireLocationId(data.sourceLocationId, "Choose a source location.");
        const destinationLocationId = requireLocationId(data.destinationLocationId, "Choose a destination location.");

        if (sourceLocationId === destinationLocationId) {
          throw new ActionError("Transfer source and destination must be different.");
        }

        await assertActiveLocation(tx, sourceLocationId);
        await assertActiveLocation(tx, destinationLocationId);
        await assertUserCanUseLocation(tx, user, sourceLocationId);
        await assertUserCanUseLocation(tx, user, destinationLocationId);

        const sourceOnHand = await getLocationOnHand(tx, item.id, sourceLocationId);
        if (sourceOnHand - data.quantity < 0) {
          throw new ActionError("Transfer would make the source location negative.");
        }

        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            kind,
            quantity: data.quantity,
            locationId: sourceLocationId,
            sourceLocationId,
            destinationLocationId,
            recordedById: user.id,
          },
        });
      } else {
        const locationId = requireLocationId(data.locationId, "Choose a location.");
        await assertActiveLocation(tx, locationId);
        await assertUserCanUseLocation(tx, user, locationId);

        const locationOnHand = await getLocationOnHand(tx, item.id, locationId);

        if (kind === MovementKind.ISSUE && locationOnHand - data.quantity < 0) {
          throw new ActionError("Issue would make stock negative at that location.");
        }

        if (kind === MovementKind.ADJUSTMENT && locationOnHand + data.quantity < 0) {
          throw new ActionError("Adjustment would make stock negative at that location.");
        }

        await tx.stockMovement.create({
          data: {
            itemId: item.id,
            kind,
            quantity: data.quantity,
            locationId,
            reason: kind === MovementKind.ADJUSTMENT ? data.reason : null,
            recordedById: user.id,
          },
        });
      }

      await resolveRecoveredDismissals(tx, item.id, item.reorderLevel);
    });
  });

  redirect(target);
}

export async function updateStaffLocationsAction(formData: FormData) {
  const manager = await requireManager();
  const target = await runInventoryAction(STAFF_PATH, "Location assignments updated.", async () => {
    const data = staffAssignmentSchema.parse({
      staffId: formData.get("staffId"),
      locationIds: formData.getAll("locationIds").filter((value): value is string => typeof value === "string"),
    });

    await db.$transaction(async (tx) => {
      const staff = await tx.user.findFirst({
        where: {
          id: data.staffId,
          role: UserRole.STAFF,
          managerId: manager.id,
          active: true,
        },
        select: { id: true },
      });

      if (!staff) {
        throw new ActionError("That staff member is not managed by your account.");
      }

      if (data.locationIds.length > 0) {
        const activeLocations = await tx.location.count({
          where: { id: { in: data.locationIds }, active: true },
        });

        if (activeLocations !== new Set(data.locationIds).size) {
          throw new ActionError("Choose only active locations.");
        }
      }

      await tx.staffLocationAssignment.deleteMany({ where: { staffId: staff.id } });

      if (data.locationIds.length > 0) {
        await tx.staffLocationAssignment.createMany({
          data: [...new Set(data.locationIds)].map((locationId) => ({
            staffId: staff.id,
            locationId,
            assignedById: manager.id,
          })),
        });
      }
    });
  });

  redirect(target);
}

export async function addItemNoteAction(formData: FormData) {
  const user = await requireUser();
  let itemId = typeof formData.get("itemId") === "string" ? String(formData.get("itemId")) : "";
  let target: string;

  try {
    const data = itemNoteSchema.parse(formEntries(formData));
    itemId = data.itemId;

    await db.$transaction(async (tx) => {
      const item = await tx.item.findUnique({
        where: { id: data.itemId },
        select: { id: true },
      });

      if (!item) {
        throw new ActionError("Item was not found.");
      }

      await tx.itemTimelineEntry.create({
        data: {
          itemId: item.id,
          type: TimelineEntryType.NOTE,
          note: data.note,
          actorId: user.id,
        },
      });
    });

    revalidatePath(`/items/${data.itemId}`);
    target = pathWithToast(`/items/${data.itemId}`, "success", "Note added.");
  } catch (error) {
    target = pathWithToast(
      itemId ? `/items/${itemId}` : ITEMS_PATH,
      "error",
      actionErrorMessage(error, "Could not add the note."),
    );
  }

  redirect(target);
}

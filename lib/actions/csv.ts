"use server";

import Papa from "papaparse";
import { MovementKind, Prisma, TimelineEntryType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth";
import { db, isTransientConnectionError } from "@/lib/db";
import { calculateItemTotalsByItem } from "@/lib/stock";

export type ImportRowResult = {
  row: number;
  success: boolean;
  reference: string;
  reason: string;
};

export type CsvImportState = {
  message?: string;
  error?: string;
  results: ImportRowResult[];
};

const MAX_FILE_SIZE = 1024 * 1024;
const MAX_ROWS = 500;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requiredHeaders(actual: string[] | undefined, required: string[]) {
  const headers = new Set(actual ?? []);
  return required.filter((header) => !headers.has(header));
}

function rowError(error: unknown) {
  if (isTransientConnectionError(error)) return "Database connection was interrupted. Try this row again.";
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "SKU already exists.";
  return error instanceof Error ? error.message : "Row could not be imported.";
}

async function readCsv(formData: FormData, headers: string[]) {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) throw new Error("Choose a CSV file.");
  if (file.size > MAX_FILE_SIZE) throw new Error("CSV file must be 1 MB or smaller.");

  const parsed = Papa.parse<Record<string, string>>(await file.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  const missing = requiredHeaders(parsed.meta.fields, headers);
  if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}.`);
  if (parsed.data.length > MAX_ROWS) throw new Error(`CSV files are limited to ${MAX_ROWS} data rows.`);
  return parsed.data;
}

function validateItemRow(row: Record<string, string>) {
  const sku = text(row.sku);
  const name = text(row.name);
  const unitOfMeasure = text(row.unitOfMeasure);
  const category = text(row.category);
  const description = text(row.description) || null;
  const reorderLevel = Number(text(row.reorderLevel));

  if (!sku || sku.length > 64) throw new Error("SKU is required and must be 64 characters or fewer.");
  if (!name || name.length > 120) throw new Error("Name is required and must be 120 characters or fewer.");
  if (!unitOfMeasure || unitOfMeasure.length > 32) throw new Error("Unit of measure is required and must be 32 characters or fewer.");
  if (!category || category.length > 80) throw new Error("Category is required and must be 80 characters or fewer.");
  if (!Number.isInteger(reorderLevel) || reorderLevel < 0) throw new Error("Reorder level must be a non-negative whole number.");
  if (description && description.length > 600) throw new Error("Description must be 600 characters or fewer.");
  return { sku, name, unitOfMeasure, category, description, reorderLevel };
}

export async function importItemsCsvAction(_state: CsvImportState, formData: FormData): Promise<CsvImportState> {
  let manager;
  try {
    manager = await requireManager();
  } catch (error) {
    if (isTransientConnectionError(error)) {
      return { error: "The database is temporarily unavailable. Try the import again.", results: [] };
    }
    throw error;
  }

  try {
    const rows = await readCsv(formData, ["sku", "name", "unitOfMeasure", "reorderLevel", "category"]);
    const results: ImportRowResult[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const raw = rows[index];
      const reference = text(raw.sku) || `Row ${index + 2}`;
      try {
        const row = validateItemRow(raw);
        await db.$transaction(async (tx) => {
          const existingItem = await tx.item.findFirst({
            where: { sku: { equals: row.sku, mode: Prisma.QueryMode.insensitive } },
            select: { id: true },
          });
          if (existingItem) throw new Error("SKU already exists.");

          let category = await tx.category.findFirst({
            where: { name: { equals: row.category, mode: Prisma.QueryMode.insensitive } },
            select: { id: true },
          });
          category ??= await tx.category.create({ data: { name: row.category }, select: { id: true } });
          const item = await tx.item.create({
            data: {
              sku: row.sku,
              name: row.name,
              description: row.description,
              unitOfMeasure: row.unitOfMeasure,
              reorderLevel: row.reorderLevel,
              categoryId: category.id,
              createdById: manager.id,
            },
            select: { id: true },
          });
          await tx.itemTimelineEntry.create({
            data: { itemId: item.id, type: TimelineEntryType.CREATED, note: "Item imported from CSV.", actorId: manager.id },
          });
        });
        results.push({ row: index + 2, success: true, reference, reason: "Imported" });
      } catch (error) {
        results.push({ row: index + 2, success: false, reference, reason: rowError(error) });
      }
    }

    revalidatePath("/items");
    revalidatePath("/dashboard");
    const successCount = results.filter((result) => result.success).length;
    return { message: `${successCount} of ${results.length} item rows imported.`, results };
  } catch (error) {
    return { error: rowError(error), results: [] };
  }
}

function validateReceiptRow(row: Record<string, string>) {
  const sku = text(row.sku);
  const location = text(row.location);
  const reason = text(row.reason) || null;
  const quantity = Number(text(row.quantity));
  if (!sku) throw new Error("SKU is required.");
  if (!location) throw new Error("Location is required.");
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error("Quantity must be a positive whole number.");
  if (reason && reason.length > 300) throw new Error("Reason must be 300 characters or fewer.");
  return { sku, location, reason, quantity };
}

export async function importReceiptsCsvAction(_state: CsvImportState, formData: FormData): Promise<CsvImportState> {
  let manager;
  try {
    manager = await requireManager();
  } catch (error) {
    if (isTransientConnectionError(error)) {
      return { error: "The database is temporarily unavailable. Try the import again.", results: [] };
    }
    throw error;
  }

  try {
    const rows = await readCsv(formData, ["sku", "quantity", "location"]);
    const results: ImportRowResult[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const raw = rows[index];
      const reference = text(raw.sku) || `Row ${index + 2}`;
      try {
        const row = validateReceiptRow(raw);
        await db.$transaction(async (tx) => {
          const item = await tx.item.findFirst({
            where: { sku: { equals: row.sku, mode: Prisma.QueryMode.insensitive }, archivedAt: null },
            select: { id: true, reorderLevel: true },
          });
          if (!item) throw new Error("Active item SKU was not found.");
          const location = await tx.location.findFirst({
            where: { name: { equals: row.location, mode: Prisma.QueryMode.insensitive }, active: true },
            select: { id: true },
          });
          if (!location) throw new Error("Active location was not found.");

          await tx.stockMovement.create({
            data: {
              itemId: item.id,
              kind: MovementKind.RECEIPT,
              quantity: row.quantity,
              locationId: location.id,
              reason: row.reason,
              recordedById: manager.id,
            },
          });
          const totals = await tx.stockMovement.groupBy({
            by: ["itemId", "kind"],
            where: { itemId: item.id, kind: { in: [MovementKind.RECEIPT, MovementKind.ISSUE, MovementKind.ADJUSTMENT] } },
            _sum: { quantity: true },
          });
          if ((calculateItemTotalsByItem(totals).get(item.id) ?? 0) > item.reorderLevel) {
            await tx.lowStockAlertDismissal.updateMany({
              where: { itemId: item.id, resolvedAt: null },
              data: { resolvedAt: new Date() },
            });
          }
        });
        results.push({ row: index + 2, success: true, reference, reason: "Receipt recorded" });
      } catch (error) {
        results.push({ row: index + 2, success: false, reference, reason: rowError(error) });
      }
    }

    revalidatePath("/movements");
    revalidatePath("/items");
    revalidatePath("/dashboard");
    revalidatePath("/alerts");
    const successCount = results.filter((result) => result.success).length;
    return { message: `${successCount} of ${results.length} receipt rows imported.`, results };
  } catch (error) {
    return { error: rowError(error), results: [] };
  }
}

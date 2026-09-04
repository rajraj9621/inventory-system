import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Filter,
  FolderPlus,
  MapPin,
  PackagePlus,
  Save,
  Search,
} from "lucide-react";
import { MovementKind, Prisma, UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import {
  archiveItemAction,
  createCategoryAction,
  createItemAction,
  createLocationAction,
  restoreItemAction,
  updateItemAction,
} from "@/lib/actions/inventory";
import { db, withDatabaseRetry } from "@/lib/db";
import { isManager } from "@/lib/permissions";
import { calculateItemTotalsByItem, calculateLocationTotalsByItem } from "@/lib/stock";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;
type ItemsPageProps = { searchParams: Promise<SearchParams> };

const PAGE_SIZE = 8;
const fieldClass =
  "h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";
const textAreaClass =
  "min-h-20 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";
const labelClass = "space-y-1 text-sm font-medium text-slate-700";

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pageHref(params: URLSearchParams, page: number) {
  const next = new URLSearchParams(params);
  next.set("page", String(page));
  return `/items?${next.toString()}`;
}

function FlashMessage({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;

  return (
    <div className={`rounded-md border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
      {error ?? success}
    </div>
  );
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const user = await requireUser();
  const manager = isManager(user);
  const params = await searchParams;
  const q = firstParam(params.q)?.trim() ?? "";
  const categoryId = firstParam(params.category) ?? "";
  const locationId = firstParam(params.location) ?? "";
  const status = firstParam(params.status) ?? "active";
  const stock = firstParam(params.stock) ?? "all";
  const sort = firstParam(params.sort) ?? "name-asc";
  const requestedPage = positiveInteger(firstParam(params.page), 1);

  const itemWhere: Prisma.ItemWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: Prisma.QueryMode.insensitive } },
            { sku: { contains: q, mode: Prisma.QueryMode.insensitive } },
          ],
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(status === "archived" ? { archivedAt: { not: null } } : status === "all" ? {} : { archivedAt: null }),
  };
  const locationWhere: Prisma.LocationWhereInput =
    user.role === UserRole.MANAGER
      ? { active: true }
      : { active: true, staffAssignments: { some: { staffId: user.id } } };

  const [candidateItems, categories, locations, activeItems, archivedItems, stockTotals, locationTotals] =
    await withDatabaseRetry(async () => {
      const [itemRows, categoryRows, locationRows, activeCount, archivedCount] = await Promise.all([
        db.item.findMany({ where: itemWhere, include: { category: true } }),
        db.category.findMany({ orderBy: { name: "asc" } }),
        db.location.findMany({ where: locationWhere, orderBy: { name: "asc" } }),
        db.item.count({ where: { archivedAt: null } }),
        db.item.count({ where: { archivedAt: { not: null } } }),
      ]);
      const ids = itemRows.map((item) => item.id);
      const [stockRows, locationRowsByItem] = await Promise.all([
        db.stockMovement.groupBy({
            by: ["itemId", "kind"],
            where: { itemId: { in: ids }, kind: { in: [MovementKind.RECEIPT, MovementKind.ISSUE, MovementKind.ADJUSTMENT] } },
            _sum: { quantity: true },
          }),
        db.stockMovement.groupBy({
            by: ["itemId", "kind", "locationId", "sourceLocationId", "destinationLocationId"],
            where: { itemId: { in: ids } },
            _sum: { quantity: true },
          }),
      ]);

      return [itemRows, categoryRows, locationRows, activeCount, archivedCount, stockRows, locationRowsByItem] as const;
    });

  const onHandByItem = calculateItemTotalsByItem(stockTotals);
  const balancesByItem = calculateLocationTotalsByItem(locationTotals);
  const filteredItems = candidateItems
    .map((item) => ({ ...item, onHand: onHandByItem.get(item.id) ?? 0 }))
    .filter((item) => !locationId || (balancesByItem.get(item.id)?.get(locationId) ?? 0) !== 0)
    .filter((item) => stock === "low" ? item.onHand <= item.reorderLevel : stock === "healthy" ? item.onHand > item.reorderLevel : true)
    .sort((a, b) => {
      if (sort === "name-desc") return b.name.localeCompare(a.name);
      if (sort === "onhand-asc") return a.onHand - b.onHand || a.name.localeCompare(b.name);
      if (sort === "onhand-desc") return b.onHand - a.onHand || a.name.localeCompare(b.name);
      if (sort === "reorder-asc") return a.reorderLevel - b.reorderLevel || a.name.localeCompare(b.name);
      if (sort === "reorder-desc") return b.reorderLevel - a.reorderLevel || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
  const totalCount = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const items = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const preservedParams = new URLSearchParams();
  for (const key of ["q", "category", "location", "status", "stock", "sort"]) {
    const value = firstParam(params[key]);
    if (value) preservedParams.set(key, value);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Inventory catalog</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Items, categories, and locations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Find stock from the server and review ledger-calculated quantities.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200">Active: {activeItems}</span>
          <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200">Archived: {archivedItems}</span>
        </div>
      </div>

      <FlashMessage success={firstParam(params.success)} error={firstParam(params.error)} />

      {manager ? (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2"><PackagePlus className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Create item</h2></div>
            <form action={createItemAction} className="mt-4 grid gap-4 md:grid-cols-2">
              <label className={labelClass}>SKU<input name="sku" className={fieldClass} placeholder="BOLT-M8-100" required /></label>
              <label className={labelClass}>Name<input name="name" className={fieldClass} placeholder="M8 bolt pack" required /></label>
              <label className={labelClass}>Unit<input name="unitOfMeasure" className={fieldClass} placeholder="pcs" required /></label>
              <label className={labelClass}>Reorder level<input name="reorderLevel" type="number" min="0" className={fieldClass} defaultValue="0" required /></label>
              <label className={labelClass}>Category<select name="categoryId" className={fieldClass} required defaultValue=""><option value="" disabled>Select category</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className={`${labelClass} md:col-span-2`}>Description<textarea name="description" className={textAreaClass} placeholder="Optional purchasing or warehouse notes" /></label>
              <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 md:col-span-2"><PackagePlus className="h-4 w-4" aria-hidden="true" />Create item</button>
            </form>
          </div>
          <div className="space-y-4">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><FolderPlus className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Categories</h2></div>
              <form action={createCategoryAction} className="mt-4 flex gap-2"><input name="name" className={fieldClass} placeholder="New category" required /><button type="submit" className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Add</button></form>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-600">{categories.map((category) => <span key={category.id} className="rounded-full bg-slate-100 px-3 py-1">{category.name}</span>)}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Locations</h2></div>
              <form action={createLocationAction} className="mt-4 space-y-3"><input name="name" className={fieldClass} placeholder="New location" required /><input name="description" className={fieldClass} placeholder="Optional description" /><button type="submit" className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Add location</button></form>
              <div className="mt-4 space-y-2 text-xs text-slate-600">{locations.map((location) => <div key={location.id} className="rounded-md bg-slate-100 px-3 py-2"><span className="font-medium text-slate-800">{location.name}</span>{location.description ? <span className="block text-slate-500">{location.description}</span> : null}</div>)}</div>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><Filter className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Find inventory</h2></div>
        <form method="get" className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className={`${labelClass} xl:col-span-2`}>Name or SKU<div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" /><input name="q" defaultValue={q} className={`${fieldClass} pl-9`} placeholder="Search catalog" /></div></label>
          <label className={labelClass}>Category<select name="category" defaultValue={categoryId} className={fieldClass}><option value="">All categories</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label className={labelClass}>Location<select name="location" defaultValue={locationId} className={fieldClass}><option value="">All locations</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select></label>
          <label className={labelClass}>Status<select name="status" defaultValue={status} className={fieldClass}><option value="active">Active</option><option value="archived">Archived</option><option value="all">All</option></select></label>
          <label className={labelClass}>Stock<select name="stock" defaultValue={stock} className={fieldClass}><option value="all">All stock</option><option value="low">Low stock</option><option value="healthy">Above reorder</option></select></label>
          <label className={`${labelClass} md:col-span-2 xl:col-span-2`}>Sort<select name="sort" defaultValue={sort} className={fieldClass}><option value="name-asc">Name A-Z</option><option value="name-desc">Name Z-A</option><option value="onhand-desc">On hand: high first</option><option value="onhand-asc">On hand: low first</option><option value="reorder-desc">Reorder: high first</option><option value="reorder-asc">Reorder: low first</option></select></label>
          <div className="flex items-end gap-2 md:col-span-2"><button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"><Search className="h-4 w-4" aria-hidden="true" />Apply</button><Link href="/items" className="inline-flex h-10 items-center rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Reset</Link></div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Boxes className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Item stock</h2></div><p className="text-sm text-slate-500">{totalCount} result{totalCount === 1 ? "" : "s"} - Page {page} of {totalPages}</p></div>
        <div className="mt-4 space-y-4">
          {items.length ? items.map((item) => (
            <article key={item.id} className="rounded-lg border border-slate-200 p-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-slate-950">{item.name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{item.sku}</span><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${item.archivedAt ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{item.archivedAt ? "Archived" : "Active"}</span></div><p className="mt-2 text-sm text-slate-600">{item.category.name} - {item.unitOfMeasure}{item.description ? ` - ${item.description}` : ""}</p><Link href={`/items/${item.id}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-800">Full history<ExternalLink className="h-4 w-4" aria-hidden="true" /></Link></div>
                <div className="grid grid-cols-3 gap-2 text-sm"><div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">On hand</span><span className="font-semibold text-slate-950">{item.onHand}</span></div><div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Reorder</span><span className="font-semibold text-slate-950">{item.reorderLevel}</span></div><div className="rounded-md bg-slate-50 px-3 py-2"><span className="block text-xs text-slate-500">Status</span><span className={item.onHand <= item.reorderLevel ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>{item.onHand <= item.reorderLevel ? "Low" : "OK"}</span></div></div>
              </div>
              {manager ? <div className="mt-5 border-t border-slate-200 pt-5"><form action={updateItemAction} className="grid gap-3 md:grid-cols-6"><input type="hidden" name="itemId" value={item.id} /><label className={`${labelClass} md:col-span-2`}>SKU<input name="sku" className={fieldClass} defaultValue={item.sku} required /></label><label className={`${labelClass} md:col-span-2`}>Name<input name="name" className={fieldClass} defaultValue={item.name} required /></label><label className={labelClass}>Unit<input name="unitOfMeasure" className={fieldClass} defaultValue={item.unitOfMeasure} required /></label><label className={labelClass}>Reorder<input name="reorderLevel" type="number" min="0" className={fieldClass} defaultValue={item.reorderLevel} required /></label><label className={`${labelClass} md:col-span-2`}>Category<select name="categoryId" className={fieldClass} defaultValue={item.categoryId} required>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label className={`${labelClass} md:col-span-4`}>Description<input name="description" className={fieldClass} defaultValue={item.description ?? ""} /></label><button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 md:col-span-3"><Save className="h-4 w-4" aria-hidden="true" />Save changes</button></form><form action={item.archivedAt ? restoreItemAction : archiveItemAction} className="mt-3"><input type="hidden" name="itemId" value={item.id} /><button type="submit" className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">{item.archivedAt ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}{item.archivedAt ? "Restore item" : "Archive item"}</button></form></div> : null}
            </article>
          )) : <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">No items match these filters.</p>}
        </div>
        {totalPages > 1 ? <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-4"><Link aria-disabled={page === 1} href={page > 1 ? pageHref(preservedParams, page - 1) : pageHref(preservedParams, 1)} className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${page === 1 ? "pointer-events-none border-slate-200 text-slate-400" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}><ChevronLeft className="h-4 w-4" aria-hidden="true" />Previous</Link><span className="text-sm text-slate-500">Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, totalCount)}</span><Link aria-disabled={page === totalPages} href={page < totalPages ? pageHref(preservedParams, page + 1) : pageHref(preservedParams, totalPages)} className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold ${page === totalPages ? "pointer-events-none border-slate-200 text-slate-400" : "border-slate-300 text-slate-700 hover:bg-slate-50"}`}>Next<ChevronRight className="h-4 w-4" aria-hidden="true" /></Link></div> : null}
      </section>
    </div>
  );
}

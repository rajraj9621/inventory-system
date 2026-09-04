import { UserRole } from "@prisma/client";
import { MapPin, Save, UsersRound } from "lucide-react";
import { updateStaffLocationsAction } from "@/lib/actions/inventory";
import { requireManager } from "@/lib/auth";
import { db, withDatabaseRetry } from "@/lib/db";

export const dynamic = "force-dynamic";

type StaffPageProps = {
  searchParams: Promise<{ success?: string | string[]; error?: string | string[] }>;
};

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffPage({ searchParams }: StaffPageProps) {
  const manager = await requireManager();
  const params = await searchParams;

  const [staffUsers, locations] = await withDatabaseRetry(() =>
    Promise.all([
      db.user.findMany({
        where: { role: UserRole.STAFF, managerId: manager.id },
        orderBy: { name: "asc" },
        include: {
          assignedLocations: {
            select: { id: true, locationId: true },
            orderBy: { location: { name: "asc" } },
          },
        },
      }),
      db.location.findMany({
        where: { active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, description: true },
      }),
    ]),
  );
  const success = firstParam(params.success);
  const error = firstParam(params.error);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Access control</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Staff assignments</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Assign the locations where each staff member is allowed to receive, issue, and transfer stock.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200">Staff: {staffUsers.length}</span>
          <span className="rounded-md bg-white px-3 py-2 text-slate-700 shadow-sm ring-1 ring-slate-200">Locations: {locations.length}</span>
        </div>
      </div>

      {success || error ? (
        <div className={`rounded-md border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {error ?? success}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <UsersRound className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <h2 className="text-base font-semibold text-slate-950">Warehouse staff</h2>
        </div>

        <div className="mt-4 space-y-4">
          {staffUsers.length > 0 ? staffUsers.map((staff) => {
            const assignedIds = new Set(staff.assignedLocations.map((assignment) => assignment.locationId));

            return (
              <form key={staff.id} action={updateStaffLocationsAction} className="rounded-md border border-slate-200 p-4">
                <input type="hidden" name="staffId" value={staff.id} />
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{staff.name}</p>
                    <p className="text-sm text-slate-500">{staff.email}</p>
                    {!staff.active ? <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Inactive</span> : null}
                  </div>
                  <button type="submit" disabled={!staff.active} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400">
                    <Save className="h-4 w-4" aria-hidden="true" />
                    Save assignments
                  </button>
                </div>

                <fieldset className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3" disabled={!staff.active}>
                  <legend className="sr-only">Locations for {staff.name}</legend>
                  {locations.map((location) => (
                    <label key={location.id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-md border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" name="locationIds" value={location.id} defaultChecked={assignedIds.has(location.id)} className="mt-0.5 h-4 w-4 accent-teal-700" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-slate-800"><MapPin className="h-3.5 w-3.5 text-teal-700" aria-hidden="true" />{location.name}</span>
                        {location.description ? <span className="mt-0.5 block text-xs text-slate-500">{location.description}</span> : null}
                      </span>
                    </label>
                  ))}
                  {locations.length === 0 ? <p className="text-sm text-slate-500">Create an active location before assigning staff.</p> : null}
                </fieldset>
              </form>
            );
          }) : <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-500">No staff users have selected you as their manager yet.</p>}
        </div>
      </section>
    </div>
  );
}

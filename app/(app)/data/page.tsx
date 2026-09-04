import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { CsvTools } from "./csv-tools";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">Data operations</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Imports and exports</h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100"><FileSpreadsheet className="h-5 w-5 text-teal-700" aria-hidden="true" /></span>
            <div><h2 className="text-base font-semibold text-slate-950">Current stock</h2><p className="text-sm text-slate-500">Item and location balances</p></div>
          </div>
          <a href="/api/export/stock" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"><Download className="h-4 w-4" aria-hidden="true" />Export CSV</a>
        </div>
      </section>

      {user.role === UserRole.MANAGER ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2"><Upload className="h-5 w-5 text-teal-700" aria-hidden="true" /><h2 className="text-base font-semibold text-slate-950">Bulk import</h2></div>
          <CsvTools />
        </section>
      ) : null}
    </div>
  );
}

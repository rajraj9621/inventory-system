import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  Boxes,
  ClipboardList,
  Database,
  Gauge,
  LogOut,
  MapPin,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { UserRole } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions/auth";
import { getLowStockAlertCount } from "@/lib/stock";

export const dynamic = "force-dynamic";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/items", label: "Items", icon: Boxes },
  { href: "/movements", label: "Movements", icon: ClipboardList },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/data", label: "Data", icon: Database },
  { href: "/staff", label: "Staff", icon: UsersRound, managerOnly: true },
];

export default async function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireUser();
  const alertCount = await getLowStockAlertCount().catch((error) => {
    console.error("Could not load the low-stock alert count.", error);
    return null;
  });
  const visibleNavItems = navItems.filter((item) => !item.managerOnly || user.role === UserRole.MANAGER);

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 lg:block">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-teal-700 text-white">
            <MapPin className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-950">Inventory</span>
            <span className="block text-xs text-slate-500">Stock control</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const showBadge = item.href === "/alerts" && alertCount !== null && alertCount > 0;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-10 items-center justify-between rounded-md px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950"
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </span>
                {showBadge ? (
                  <span className="min-w-6 rounded-full bg-amber-100 px-2 py-0.5 text-center text-xs font-semibold text-amber-800">
                    {alertCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="absolute inset-x-4 bottom-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
            <ShieldCheck className="h-4 w-4 text-teal-700" aria-hidden="true" />
            {user.role === UserRole.MANAGER ? "Manager access" : "Staff access"}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">{user.email}</p>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-950">{user.name}</p>
              <p className="text-xs text-slate-500">{user.role === UserRole.MANAGER ? "Inventory manager" : "Warehouse staff"}</p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/alerts"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                <span>{alertCount ?? "-"}</span>
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Logout
                </button>
              </form>
            </div>
          </div>

          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              const showBadge = item.href === "/alerts" && alertCount !== null && alertCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  {showBadge ? (
                    <span className="min-w-5 rounded-full bg-amber-100 px-1.5 text-center text-xs font-semibold text-amber-800">
                      {alertCount}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

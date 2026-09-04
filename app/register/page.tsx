import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { db, withDatabaseRetry } from "@/lib/db";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  const managers = await withDatabaseRetry(() =>
    db.user.findMany({
      where: {
        role: UserRole.MANAGER,
        active: true,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
  );

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Inventory Stock Control
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Create your account
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Staff accounts join an existing manager team. Managers can create a new team.
          </p>
        </div>

        <RegisterForm managers={managers} initialRole={managers.length > 0 ? "STAFF" : "MANAGER"} />
      </section>
    </main>
  );
}

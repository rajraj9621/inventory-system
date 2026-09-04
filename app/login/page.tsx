import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { RegistrationMessage } from "./registration-message";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Inventory Stock Control
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
            Sign in to continue
          </h1>
        </div>

        <Suspense fallback={null}>
          <RegistrationMessage />
        </Suspense>

        <LoginForm />

        <div className="mt-6 border-t border-slate-200 pt-6">
          <Link
            href="/register"
            className="inline-flex h-11 w-full items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Create new account
          </Link>
        </div>
      </section>
    </main>
  );
}

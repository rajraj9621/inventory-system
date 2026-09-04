"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ShieldCheck, UserPlus, UsersRound } from "lucide-react";
import { registerAction, type RegisterFormState } from "@/lib/actions/auth";

type ManagerOption = {
  id: string;
  name: string;
  email: string;
};

type RegisterFormProps = {
  managers: ManagerOption[];
  initialRole: "STAFF" | "MANAGER";
};

const fieldClass =
  "h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100";

export function RegisterForm({ managers, initialRole }: RegisterFormProps) {
  const [state, formAction, pending] = useActionState<RegisterFormState, FormData>(registerAction, {
    role: initialRole,
  });
  const [role, setRole] = useState<"STAFF" | "MANAGER">(state.role ?? initialRole);
  const canRegisterStaff = managers.length > 0;

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
            role === "STAFF" ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"
          } ${!canRegisterStaff ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input
            type="radio"
            name="role"
            value="STAFF"
            checked={role === "STAFF"}
            disabled={!canRegisterStaff}
            onChange={() => setRole("STAFF")}
            className="h-4 w-4 accent-teal-700"
          />
          <UsersRound className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-slate-950">Staff</span>
            <span className="block text-xs text-slate-500">Join a manager team</span>
          </span>
        </label>

        <label
          className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 transition ${
            role === "MANAGER" ? "border-teal-600 bg-teal-50" : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <input
            type="radio"
            name="role"
            value="MANAGER"
            checked={role === "MANAGER"}
            onChange={() => setRole("MANAGER")}
            className="h-4 w-4 accent-teal-700"
          />
          <ShieldCheck className="h-5 w-5 text-teal-700" aria-hidden="true" />
          <span>
            <span className="block text-sm font-semibold text-slate-950">Manager</span>
            <span className="block text-xs text-slate-500">Create a new team</span>
          </span>
        </label>
      </div>

      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Full name
        </label>
        <input
          id="name"
          name="name"
          autoComplete="name"
          defaultValue={state.name}
          className={fieldClass}
          placeholder="Your full name"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          className={fieldClass}
          placeholder="you@example.com"
          required
        />
      </div>

      {role === "STAFF" ? (
        <div className="space-y-2">
          <label htmlFor="managerId" className="block text-sm font-medium text-slate-700">
            Manager
          </label>
          <select
            id="managerId"
            name="managerId"
            defaultValue={state.managerId ?? ""}
            className={fieldClass}
            required
          >
            <option value="" disabled>
              Choose your manager
            </option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name} - {manager.email}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            placeholder="At least 8 characters"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            className={fieldClass}
            placeholder="Repeat password"
            required
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      {!canRegisterStaff ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Register the first manager account before creating staff accounts.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-teal-700 px-4 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-slate-400"
      >
        <UserPlus className="h-4 w-4" aria-hidden="true" />
        {pending ? "Creating account..." : "Create account"}
      </button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-teal-700 hover:text-teal-800">
          Sign in
        </Link>
      </p>
    </form>
  );
}

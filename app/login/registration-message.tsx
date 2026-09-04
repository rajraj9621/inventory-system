"use client";

import { useSearchParams } from "next/navigation";

export function RegistrationMessage() {
  const searchParams = useSearchParams();

  if (searchParams.get("registered") !== "1") {
    return null;
  }

  return (
    <div
      role="status"
      className="mb-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
    >
      Account created successfully. Sign in with your email and password.
    </div>
  );
}

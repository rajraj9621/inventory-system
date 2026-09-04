"use client";

import { useEffect } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="mx-auto max-w-xl border border-red-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-semibold text-slate-950">This page could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The database connection was interrupted. Wait a moment and try the page again.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Try again
      </button>
    </section>
  );
}

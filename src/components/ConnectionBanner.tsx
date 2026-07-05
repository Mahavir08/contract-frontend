"use client";
import { useOrg } from "@/lib/org";

// App-wide banner shown when organisations fail to load (e.g. the backend or
// its database is down). Keeps the UI usable and offers a one-click retry
// instead of surfacing a raw 500 / blank screen.
export function ConnectionBanner() {
  const { error, loading, reload } = useOrg();
  if (!error) return null;

  return (
    <div
      role="alert"
      className="border-b border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="shrink-0 text-amber-600"
          >
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          <span>{error}</span>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Retrying…" : "Retry"}
        </button>
      </div>
    </div>
  );
}

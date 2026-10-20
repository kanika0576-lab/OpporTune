import type { ReactNode } from "react";

export function SkeletonCards({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="card animate-pulse p-6"
          data-testid="skeleton-card"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="h-5 w-20 rounded-full bg-navy-100" />
            <div className="h-5 w-28 rounded-full bg-navy-100" />
          </div>
          <div className="mb-2 h-5 w-3/4 rounded bg-navy-100" />
          <div className="mb-5 h-4 w-1/2 rounded bg-navy-100" />
          <div className="mb-2 h-3 w-full rounded bg-navy-100" />
          <div className="h-3 w-2/3 rounded bg-navy-100" />
          <div className="mt-5 flex gap-3">
            <div className="h-9 w-28 rounded-lg bg-navy-100" />
            <div className="h-9 w-24 rounded-lg bg-navy-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "◎",
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-600">
        {icon}
      </div>
      <h3 className="text-lg font-bold text-navy-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-navy-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Search failed",
  message,
  onRetry,
  retryLabel = "Retry",
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200 bg-rose-50 p-6"
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-lg text-rose-700">
          !
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-rose-900">{title}</h3>
          <p className="mt-1 text-sm text-rose-800">{message}</p>
          {children}
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="btn btn-sm mt-4 bg-rose-700 text-white hover:bg-rose-800"
            >
              ↻ {retryLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

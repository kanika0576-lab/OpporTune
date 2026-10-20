import type { View } from "../types";

export interface HeaderProps {
  view: View;
  onNavigate: (view: View) => void;
  savedCount: number;
  apiStatus: "checking" | "ok" | "misconfigured" | "unreachable";
}

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "search", label: "Search" },
  { id: "profile", label: "My profile" },
  { id: "saved", label: "Saved" },
];

function statusMeta(status: HeaderProps["apiStatus"]) {
  switch (status) {
    case "ok":
      return { label: "Live data connected", tone: "bg-teal-50 text-teal-700 border-teal-200" };
    case "misconfigured":
      return { label: "API key not configured", tone: "bg-amber-50 text-amber-800 border-amber-200" };
    case "unreachable":
      return { label: "API unreachable", tone: "bg-rose-50 text-rose-700 border-rose-200" };
    default:
      return { label: "Checking API…", tone: "bg-navy-50 text-navy-600 border-navy-200" };
  }
}

export default function Header({
  view,
  onNavigate,
  savedCount,
  apiStatus,
}: HeaderProps) {
  const meta = statusMeta(apiStatus);

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onNavigate("home")}
          className="flex items-center gap-2.5 text-left"
          aria-label="OpporTune home"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-900 text-lg font-black text-teal-300">
            ⌾
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-extrabold tracking-wide text-navy-900">
              OpporTune
            </span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-400">
              Evidence-first
            </span>
          </span>
        </button>

        <nav
          aria-label="Main"
          className="ml-auto flex items-center gap-1 overflow-x-auto scroll-thin"
        >
          {NAV_ITEMS.map((item) => {
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  active
                    ? "bg-navy-900 text-white"
                    : "text-navy-600 hover:bg-navy-50 hover:text-navy-900"
                }`}
              >
                {item.label}
                {item.id === "saved" && savedCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold text-navy-950">
                    {savedCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <span
          className={`hidden items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold sm:inline-flex ${meta.tone}`}
          title="Server-side status of the TinyFish integration"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {meta.label}
        </span>
      </div>
    </header>
  );
}

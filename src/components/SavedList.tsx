import type { Opportunity, StudentProfile } from "../types";
import { checkEligibility, verdictLabel, verdictTone } from "../lib/eligibility";
import { formatDeadline } from "../lib/format";
import { EmptyState } from "./States";

interface SavedListProps {
  opportunities: Opportunity[];
  profile: StudentProfile;
  onOpen: (opportunity: Opportunity) => void;
  onRemove: (opportunity: Opportunity) => void;
  onGoSearch: () => void;
}

const TONE_CLASS: Record<"good" | "warn" | "bad", string> = {
  good: "border-teal-200 bg-teal-50 text-teal-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function SavedList({
  opportunities,
  profile,
  onOpen,
  onRemove,
  onGoSearch,
}: SavedListProps) {
  if (opportunities.length === 0) {
    return (
      <EmptyState
        icon="★"
        title="No saved opportunities yet"
        description="Save an opportunity while browsing results and it will appear here. Saved items live in this browser only."
        action={
          <button type="button" onClick={onGoSearch} className="btn btn-primary">
            Search live opportunities
          </button>
        }
      />
    );
  }

  return (
    <ul className="space-y-4">
      {opportunities.map((opportunity) => {
        const eligibility = checkEligibility(profile, opportunity);
        const tone = verdictTone(eligibility.verdict);
        return (
          <li key={opportunity.id} className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-navy-900 text-white capitalize">
                {opportunity.category === "government_scheme"
                  ? "Government scheme"
                  : opportunity.category}
              </span>
              <span className={`chip border ${TONE_CLASS[tone]}`}>
                {verdictLabel(eligibility.verdict)}
              </span>
            </div>
            <h3 className="mt-2.5 text-base font-extrabold text-navy-900">
              {opportunity.title}
            </h3>
            <p className="mt-1 text-sm text-navy-500">
              {opportunity.organizer} · Deadline:{" "}
              {formatDeadline(opportunity.deadline)}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpen(opportunity)}
                className="btn btn-secondary btn-sm"
              >
                View details
              </button>
              <a
                href={opportunity.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm"
              >
                Source page ↗
              </a>
              <button
                type="button"
                onClick={() => onRemove(opportunity)}
                className="btn btn-ghost btn-sm text-rose-600 hover:bg-rose-50"
              >
                Remove
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

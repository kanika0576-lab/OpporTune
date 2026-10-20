import type { EligibilityResult, Opportunity } from "../types";
import { formatDeadline } from "../lib/format";
import { verdictLabel, verdictTone } from "../lib/eligibility";

interface OpportunityCardProps {
  opportunity: Opportunity;
  eligibility: EligibilityResult;
  saved: boolean;
  onOpen: (opportunity: Opportunity) => void;
  onToggleSave: (opportunity: Opportunity) => void;
}

const TONE_CLASS: Record<"good" | "warn" | "bad", string> = {
  good: "border-teal-200 bg-teal-50 text-teal-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  bad: "border-rose-200 bg-rose-50 text-rose-700",
};

export default function OpportunityCard({
  opportunity,
  eligibility,
  saved,
  onOpen,
  onToggleSave,
}: OpportunityCardProps) {
  const tone = verdictTone(eligibility.verdict);

  return (
    <article className="card p-5 transition hover:border-teal-300 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip bg-navy-900 text-white capitalize">
          {opportunity.category}
        </span>
        <span
          className={`chip border ${TONE_CLASS[tone]}`}
          title="Based on the rules engine — unknown criteria are not counted as eligible"
        >
          {verdictLabel(eligibility.verdict)}
        </span>
        <span className="text-xs text-navy-400">
          {opportunity.organizer}
        </span>
      </div>

      <h3 className="mt-3 text-lg font-extrabold leading-snug text-navy-900">
        <button
          type="button"
          onClick={() => onOpen(opportunity)}
          className="text-left hover:text-teal-700"
        >
          {opportunity.title}
        </button>
      </h3>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-navy-400">
            Deadline
          </dt>
          <dd
            className={`mt-0.5 font-semibold ${
              opportunity.deadline ? "text-navy-800" : "text-amber-700"
            }`}
          >
            {formatDeadline(opportunity.deadline)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-navy-400">
            Team size
          </dt>
          <dd className="mt-0.5 font-semibold text-navy-800">
            {opportunity.teamSize ?? "Not stated"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-navy-400">
            Relevance
          </dt>
          <dd className="mt-0.5 font-semibold text-navy-800">
            {eligibility.relevanceScore}/100
          </dd>
        </div>
      </dl>

      <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-navy-500">
        {opportunity.eligibilityText ||
          "No eligibility statement was found in the retrieved content."}
      </p>

      <p className="mt-2 text-[11px] leading-relaxed text-navy-400">
        Relevance measures interest and skill overlap only. It is not evidence
        that you are eligible.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpen(opportunity)}
          className="btn btn-secondary btn-sm"
        >
          View details
        </button>
        <button
          type="button"
          onClick={() => onToggleSave(opportunity)}
          aria-pressed={saved}
          className={`btn btn-sm ${
            saved
              ? "bg-teal-500 text-navy-950 hover:bg-teal-400"
              : "border border-navy-200 bg-white text-navy-600 hover:border-teal-400 hover:text-teal-700"
          }`}
        >
          {saved ? "✓ Saved" : "+ Save"}
        </button>
        <a
          href={opportunity.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost btn-sm"
        >
          Official page ↗
        </a>
      </div>
    </article>
  );
}

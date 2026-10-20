import type { EligibilityResult } from "../types";
import { verdictLabel, verdictTone } from "../lib/eligibility";

const STATUS_STYLES: Record<string, string> = {
  MET: "bg-teal-50 text-teal-800 border-teal-200",
  NOT_MET: "bg-rose-50 text-rose-700 border-rose-200",
  UNKNOWN: "bg-amber-50 text-amber-800 border-amber-200",
};

const STATUS_MARK: Record<string, string> = {
  MET: "✓",
  NOT_MET: "✕",
  UNKNOWN: "?",
};

export default function EligibilityChecklist({
  eligibility,
}: {
  eligibility: EligibilityResult;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`chip border ${
            verdictTone(eligibility.verdict) === "good"
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : verdictTone(eligibility.verdict) === "warn"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-rose-200 bg-rose-50 text-rose-700"
          }`}
        >
          {verdictLabel(eligibility.verdict)}
        </span>
        <span className="text-xs font-semibold text-navy-500">
          {eligibility.metCount} met · {eligibility.notMetCount} not met ·{" "}
          {eligibility.unknownCount} unknown
        </span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-navy-500">
        Skills affect relevance ranking only. “Stated checks met” means each
        checkable rule found on the retrieved page matched your profile; it
        does not confirm requirements the page did not disclose.
      </p>

      {eligibility.unknownCount > 0 ? (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
          Unchecked criteria stay <strong>unknown</strong> — they are never
          counted as proof that you are eligible. Open the source page to
          confirm them yourself.
        </p>
      ) : null}

      {eligibility.notChecked.length > 0 ? (
        <p className="mt-3 rounded-xl border border-navy-100 bg-navy-50 px-4 py-3 text-xs leading-relaxed text-navy-600">
          <strong>Not checked:</strong>{" "}
          {eligibility.notChecked.join(", ")}. The retrieved source did not
          state a rule for these, so they are not scored either way.
        </p>
      ) : null}

      <ul className="mt-4 space-y-3">
        {eligibility.criteria.map((criterion) => (
          <li
            key={criterion.id}
            className="rounded-xl border border-navy-100 bg-white p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-navy-900">
                {criterion.label}
              </span>
              <span
                className={`chip border ${STATUS_STYLES[criterion.status]}`}
              >
                {STATUS_MARK[criterion.status]} {criterion.status.replace("_", " ")}
              </span>
            </div>

            <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
              <div>
                <dt className="font-bold uppercase tracking-wide text-navy-500">
                  Requirement
                </dt>
                <dd className="mt-0.5 text-navy-700">
                  {criterion.requirement ?? "Not stated in the source"}
                </dd>
              </div>
              <div>
                <dt className="font-bold uppercase tracking-wide text-navy-500">
                  Your profile
                </dt>
                <dd className="mt-0.5 text-navy-700">
                  {criterion.profileValue ?? "Not set"}
                </dd>
              </div>
            </dl>

            <p className="mt-3 text-xs leading-relaxed text-navy-600">
              {criterion.explanation}
            </p>

            {criterion.evidence.length > 0 ? (
              <div className="mt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
                  Evidence
                </p>
                <ul className="mt-1.5 space-y-2">
                  {criterion.evidence.map((item, index) => (
                    <li
                      key={`${item.url}-${index}`}
                      className="rounded-lg border border-navy-100 bg-navy-50/60 p-3"
                    >
                      {item.quote ? (
                        <p className="text-xs italic leading-relaxed text-navy-700">
                          “{item.quote}”
                        </p>
                      ) : null}
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1.5 inline-block text-[11px] font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-900"
                      >
                        View source ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

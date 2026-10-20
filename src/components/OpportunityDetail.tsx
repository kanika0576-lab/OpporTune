import type { EligibilityResult, Opportunity } from "../types";
import { formatDeadline, formatTimestamp } from "../lib/format";
import { buildNextSteps } from "../lib/nextSteps";
import EligibilityChecklist from "./EligibilityChecklist";

interface OpportunityDetailProps {
  opportunity: Opportunity;
  eligibility: EligibilityResult;
  saved: boolean;
  onBack: () => void;
  onToggleSave: (opportunity: Opportunity) => void;
}

const STEP_TONE: Record<string, string> = {
  urgent: "border-rose-200 bg-rose-50",
  action: "border-teal-200 bg-teal-50",
  verify: "border-amber-200 bg-amber-50",
  info: "border-navy-200 bg-navy-50",
};

export default function OpportunityDetail({
  opportunity,
  eligibility,
  saved,
  onBack,
  onToggleSave,
}: OpportunityDetailProps) {
  const steps = buildNextSteps(opportunity, eligibility);

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-sm">
        ← Back to results
      </button>

      <header className="card p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip bg-navy-900 text-white capitalize">
            {opportunity.category === "government_scheme"
              ? "Government scheme"
              : opportunity.category}
          </span>
          <span className="text-xs font-semibold text-navy-500">
            {opportunity.organizer}
          </span>
        </div>

        <h2 className="mt-3 text-2xl font-extrabold leading-tight text-navy-900 sm:text-3xl">
          {opportunity.title}
        </h2>

        <div className="mt-4 flex flex-wrap gap-2">
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
            {saved ? "✓ Saved to this browser" : "+ Save opportunity"}
          </button>
          <a
            href={opportunity.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
          >
            Open source page ↗
          </a>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
              Deadline
            </dt>
            <dd className="mt-1 text-sm font-semibold text-navy-800">
              {formatDeadline(opportunity.deadline)}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
              Team size
            </dt>
            <dd className="mt-1 text-sm font-semibold text-navy-800">
              {opportunity.teamSize ?? "Not stated in source"}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
              Relevance
            </dt>
            <dd className="mt-1 text-sm font-semibold text-navy-800">
              {eligibility.relevanceScore}/100
              <span className="block text-[11px] font-medium text-navy-500">
                interest + skill overlap only
              </span>
            </dd>
          </div>
        </dl>
      </header>

      <section className="card p-5 sm:p-7">
        <h3 className="text-lg font-extrabold text-navy-900">
          Eligibility checklist
        </h3>
        <p className="mt-1 text-sm text-navy-500">
          Each rule is checked against the retrieved page and your profile.
          Unknown never counts as a pass.
        </p>
        <div className="mt-5">
          <EligibilityChecklist eligibility={eligibility} />
        </div>
      </section>

      <section className="card p-5 sm:p-7">
        <h3 className="text-lg font-extrabold text-navy-900">
          Next steps for you
        </h3>
        <ul className="mt-4 space-y-3">
          {steps.map((step) => (
            <li
              key={step.id}
              className={`rounded-xl border p-4 ${STEP_TONE[step.kind]}`}
            >
              <p className="text-sm font-bold text-navy-900">{step.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-navy-600">
                {step.detail}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-5 sm:p-7">
        <h3 className="text-lg font-extrabold text-navy-900">
          What the source says
        </h3>

        <div className="mt-4 space-y-4">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
              Eligibility statement
            </h4>
            <p className="mt-1 text-sm leading-relaxed text-navy-700">
              {opportunity.eligibilityText ||
                "No eligibility statement was found in the retrieved content."}
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
              Education requirements found
            </h4>
            {opportunity.educationRequirements.length > 0 ? (
              <ul className="mt-1 space-y-1 text-sm text-navy-700">
                {opportunity.educationRequirements.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                None found in the retrieved content.
              </p>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
              Skills found
            </h4>
            {opportunity.skills.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {opportunity.skills.map((skill) => (
                  <li key={skill} className="chip bg-navy-50 text-navy-700">
                    {skill}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                None found in the retrieved content.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 border-t border-navy-100 pt-5">
          <h4 className="text-[11px] font-bold uppercase tracking-wide text-navy-500">
            Source evidence ({opportunity.sourceEvidence.length})
          </h4>
          {opportunity.sourceEvidence.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {opportunity.sourceEvidence.map((item, index) => (
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
                    className="mt-1.5 inline-block break-all text-[11px] font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-900"
                  >
                    {item.url} ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-amber-700">
              No quoted evidence was extracted from this result.
            </p>
          )}
        </div>

        <p className="mt-5 text-[11px] text-navy-500">
          Retrieved {formatTimestamp(opportunity.retrievedAt)} · Source:{" "}
          <a
            href={opportunity.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-teal-700 underline underline-offset-2"
          >
            {opportunity.officialUrl}
          </a>
        </p>
      </section>
    </div>
  );
}

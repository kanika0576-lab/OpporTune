import {
  OPPORTUNITY_CATEGORIES,
  type OpportunityCategory,
} from "../types";

interface SearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  category: OpportunityCategory;
  onCategoryChange: (value: OpportunityCategory) => void;
  onSearch: () => void;
  loading: boolean;
  resultCount: number | null;
}

const CATEGORY_LABELS: Record<OpportunityCategory, string> = {
  hackathon: "Hackathons",
  scholarship: "Scholarships",
  internship: "Internships",
  fellowship: "Fellowships",
};

const CATEGORY_HINTS: Record<OpportunityCategory, string> = {
  hackathon: "Build something in 24–72 hours with a team.",
  scholarship: "Funding for tuition, courses or research.",
  internship: "Paid or credit-based work experience.",
  fellowship: "Research, policy or leadership fellowships.",
};

export default function SearchPanel({
  query,
  onQueryChange,
  category,
  onCategoryChange,
  onSearch,
  loading,
  resultCount,
}: SearchPanelProps) {
  return (
    <section className="card p-5 sm:p-6" aria-label="Opportunity search">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          onSearch();
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1">
            <label className="label" htmlFor="search-query">
              What are you looking for?
            </label>
            <input
              id="search-query"
              className="field"
              value={query}
              placeholder="e.g. ai hackathons for undergraduate students in Delhi"
              onChange={(event) => onQueryChange(event.target.value)}
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="btn btn-primary w-full sm:w-auto"
              disabled={loading}
            >
              {loading ? "Searching…" : "Search live web"}
            </button>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="label">Category</legend>
          <div className="flex flex-wrap gap-2">
            {OPPORTUNITY_CATEGORIES.map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => onCategoryChange(item)}
                  aria-pressed={active}
                  title={CATEGORY_HINTS[item]}
                  className={`rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-teal-500 bg-teal-50 text-teal-800"
                      : "border-navy-200 bg-white text-navy-600 hover:border-navy-300"
                  }`}
                >
                  {CATEGORY_LABELS[item]}
                </button>
              );
            })}
          </div>
        </fieldset>
      </form>

      {resultCount !== null ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-sm font-semibold text-navy-500"
        >
          {resultCount} result{resultCount === 1 ? "" : "s"} from the live web
          {loading ? " · refreshing…" : ""}
        </p>
      ) : null}
    </section>
  );
}

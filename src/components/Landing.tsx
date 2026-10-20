import type { View } from "../types";

interface LandingProps {
  onNavigate: (view: View) => void;
  hasProfile: boolean;
  savedCount: number;
}

const STEPS = [
  {
    n: "01",
    title: "Tell us about you",
    body: "Education level, interests, skills, location and how big your team is. It stays in your browser.",
  },
  {
    n: "02",
    title: "We search the live web",
    body: "OpporTune queries the TinyFish Search API, then fetches the real organiser pages to read requirements and deadlines.",
  },
  {
    n: "03",
    title: "You get evidence",
    body: "Every match comes with a checklist, the source link, and a quote backing each requirement. Unknown stays unknown.",
  },
];

export default function Landing({
  onNavigate,
  hasProfile,
  savedCount,
}: LandingProps) {
  return (
    <div>
      <section className="relative overflow-hidden bg-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <span className="chip border border-teal-200 bg-teal-50 text-teal-800">
              ● Live web results · not a mockup
            </span>
            <h1 className="mt-6 text-4xl font-extrabold leading-[1.08] text-navy-900 sm:text-5xl lg:text-6xl">
              Stop Searching.{" "}
              <span className="text-teal-700">Start Qualifying.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-navy-600 sm:text-lg">
              OpporTune searches real hackathons, scholarships, internships and
              fellowships with the TinyFish Search and Fetch APIs — then shows
              you exactly which requirements you meet, which you do not, and
              which nobody has published yet. Every claim is linked to the page
              it came from.
            </p>
            <p className="mt-3 text-sm font-semibold tracking-wide text-navy-700">
              Your Potential Deserves an Opportunity.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => onNavigate("search")}
                className="btn btn-primary"
              >
                Search live opportunities →
              </button>
              <button
                type="button"
                onClick={() => onNavigate("profile")}
                className="btn btn-secondary"
              >
                {hasProfile ? "Edit my profile" : "Build my profile"}
              </button>
            </div>

            <dl className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                { k: "Sources", v: "Every card links to the organiser's page" },
                { k: "Unknown", v: "Never counted as eligible" },
                { k: "Storage", v: "Profile stays in your browser" },
              ].map((item) => (
                <div
                  key={item.k}
                  className="rounded-2xl border border-navy-100 bg-slate-50 p-4"
                >
                  <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                    {item.k}
                  </dt>
                  <dd className="mt-1.5 text-sm text-navy-700">{item.v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-extrabold text-navy-900 sm:text-3xl">
          How it works
        </h2>
        <p className="mt-2 max-w-2xl text-navy-500">
          Three steps, no sign-up, no database, no fabricated results.
        </p>

        <ol className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((step) => (
            <li key={step.n} className="card p-6">
              <span className="text-sm font-black text-teal-500">{step.n}</span>
              <h3 className="mt-2 text-lg font-bold text-navy-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-5 lg:grid-cols-2">
          <div className="card p-6">
            <h3 className="text-lg font-bold text-navy-900">
              What "evidence-first" actually means
            </h3>
            <ul className="mt-4 space-y-3 text-sm text-navy-600">
              <li className="flex gap-3">
                <span className="mt-0.5 font-black text-teal-500">✓</span>
                A deadline appears only if a date was found next to a deadline
                keyword in the retrieved page.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-black text-teal-500">✓</span>
                Every requirement carries the quote it was read from and a link
                to the page.
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 font-black text-teal-500">✓</span>
                A relevance score rates interest and skill overlap — it is
                never shown as proof that you are eligible.
              </li>
            </ul>
          </div>

          <div className="card p-6">
            <h3 className="text-lg font-bold text-navy-900">
              Built on TinyFish
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-navy-500">
              The browser never touches the search provider. Requests go to a
              Vercel serverless function that holds the API key, calls the
              documented{" "}
              <code className="rounded bg-navy-50 px-1 py-0.5 text-xs text-navy-700">
                GET /api.search.tinyfish.ai
              </code>{" "}
              and{" "}
              <code className="rounded bg-navy-50 px-1 py-0.5 text-xs text-navy-700">
                POST /api.fetch.tinyfish.ai
              </code>{" "}
              endpoints, and returns normalized, source-backed records.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onNavigate("search")}
                className="btn btn-secondary btn-sm"
              >
                Start a search
              </button>
              {savedCount > 0 ? (
                <button
                  type="button"
                  onClick={() => onNavigate("saved")}
                  className="btn btn-ghost btn-sm"
                >
                  {savedCount} saved opportunit{savedCount === 1 ? "y" : "ies"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import Landing from "./components/Landing";
import OpportunityCard from "./components/OpportunityCard";
import OpportunityDetail from "./components/OpportunityDetail";
import ProfileForm from "./components/ProfileForm";
import SavedList from "./components/SavedList";
import SearchPanel from "./components/SearchPanel";
import { EmptyState, ErrorState, SkeletonCards } from "./components/States";
import { checkHealth, searchOpportunities } from "./lib/api";
import { checkEligibility } from "./lib/eligibility";
import {
  loadProfile,
  loadSavedOpportunities,
  saveOpportunities,
  saveProfile,
} from "./lib/storage";
import type {
  Opportunity,
  OpportunityCategory,
  StudentProfile,
  View,
} from "./types";

type SearchStatus = "idle" | "loading" | "success" | "error";
type ApiStatus = "checking" | "ok" | "misconfigured" | "unreachable";

interface SearchRequestState {
  query: string;
  category: OpportunityCategory;
}

const RESULT_LIMIT = 10;

export default function App() {
  const [view, setView] = useState<View>("home");
  const [profile, setProfile] = useState<StudentProfile>(() => loadProfile());
  const [saved, setSaved] = useState<Opportunity[]>(() =>
    loadSavedOpportunities(),
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<OpportunityCategory>("hackathon");
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [results, setResults] = useState<Opportunity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] =
    useState<SearchRequestState | null>(null);

  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [profileSaved, setProfileSaved] = useState(false);
  const [apiStatus, setApiStatus] = useState<ApiStatus>("checking");

  useEffect(() => {
    let cancelled = false;
    checkHealth().then((result) => {
      if (!cancelled) setApiStatus(result.status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasProfile = useMemo(
    () =>
      Boolean(
        profile.educationLevel ||
          profile.graduationYear ||
          profile.location ||
          profile.skills.length ||
          profile.interests.length,
      ),
    [profile],
  );

  const runSearch = useCallback(
    async (override?: SearchRequestState) => {
      const request = override ?? { query: query.trim(), category };
      setLastRequest(request);

      if (request.query.length < 2) {
        setStatus("error");
        setResults([]);
        setError(
          "Describe what you are looking for in at least two characters, for example “ai hackathons for students”.",
        );
        return;
      }

      setStatus("loading");
      setError(null);
      setSelected(null);

      const outcome = await searchOpportunities({
        query: request.query,
        category: request.category,
        profile,
        limit: RESULT_LIMIT,
      });

      if (outcome.ok) {
        setResults(outcome.opportunities);
        setStatus("success");
      } else {
        setResults([]);
        setError(outcome.message);
        setStatus("error");
      }
    },
    [category, profile, query],
  );

  const retry = useCallback(() => {
    void runSearch(lastRequest ?? undefined);
  }, [lastRequest, runSearch]);

  const navigate = useCallback((next: View) => {
    setView(next);
    setSelected(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleSaveProfile = useCallback(() => {
    saveProfile(profile);
    setProfileSaved(true);
    window.setTimeout(() => setProfileSaved(false), 4000);
  }, [profile]);

  const toggleSave = useCallback(
    (opportunity: Opportunity) => {
      const exists = saved.some((item) => item.id === opportunity.id);
      const next = exists
        ? saved.filter((item) => item.id !== opportunity.id)
        : [opportunity, ...saved];
      setSaved(next);
      saveOpportunities(next);
    },
    [saved],
  );

  const openDetail = useCallback((opportunity: Opportunity) => {
    setSelected(opportunity);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const profileSummary = [
    profile.educationLevel ? profile.educationLevel.replace("_", " ") : null,
    profile.graduationYear ? `Graduating ${profile.graduationYear}` : null,
    profile.location || null,
    profile.skills.length ? `${profile.skills.length} skills` : null,
    profile.interests.length ? `${profile.interests.length} interests` : null,
  ].filter(Boolean) as string[];

  function renderContent() {
    if (selected) {
      return (
        <OpportunityDetail
          opportunity={selected}
          eligibility={checkEligibility(profile, selected)}
          saved={saved.some((item) => item.id === selected.id)}
          onBack={() => setSelected(null)}
          onToggleSave={toggleSave}
        />
      );
    }

    if (view === "home") {
      return (
        <Landing
          onNavigate={navigate}
          hasProfile={hasProfile}
          savedCount={saved.length}
        />
      );
    }

    if (view === "profile") {
      return (
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-extrabold text-navy-900 sm:text-3xl">
            Your student profile
          </h1>
          <p className="mt-2 text-sm text-navy-500">
            OpporTune compares every opportunity against this profile. It is
            stored in this browser with localStorage and is never sent to a
            server.
          </p>
          <div className="mt-6">
            <ProfileForm
              profile={profile}
              onChange={setProfile}
              onSave={handleSaveProfile}
              saved={profileSaved}
            />
          </div>
        </div>
      );
    }

    if (view === "saved") {
      return (
        <div className="mx-auto max-w-3xl">
          <h1 className="text-2xl font-extrabold text-navy-900 sm:text-3xl">
            Saved opportunities
          </h1>
          <p className="mt-2 text-sm text-navy-500">
            {saved.length} saved in this browser.
          </p>
          <div className="mt-6">
            <SavedList
              opportunities={saved}
              profile={profile}
              onOpen={openDetail}
              onRemove={toggleSave}
              onGoSearch={() => navigate("search")}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-900 sm:text-3xl">
            Search live opportunities
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-navy-500">
            Results come from the real web through the TinyFish Search and
            Fetch APIs. Nothing is generated locally — if the search fails you
            will see the error, not fake data.
          </p>
        </div>

        {!hasProfile ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm text-amber-900">
              <strong>No profile yet.</strong> Most checks will stay
              &quot;unknown&quot; until you add your education level, skills and
              location.
            </p>
            <button
              type="button"
              onClick={() => navigate("profile")}
              className="btn btn-sm bg-amber-700 text-white hover:bg-amber-800"
            >
              Set up profile
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-navy-100 bg-white px-5 py-3 text-sm">
            <span className="font-bold text-navy-800">
              Matching against:
            </span>
            {profileSummary.map((item) => (
              <span key={item} className="chip bg-navy-50 capitalize text-navy-700">
                {item}
              </span>
            ))}
            <button
              type="button"
              onClick={() => navigate("profile")}
              className="btn btn-ghost btn-sm ml-auto"
            >
              Edit profile
            </button>
          </div>
        )}

        <SearchPanel
          query={query}
          onQueryChange={setQuery}
          category={category}
          onCategoryChange={setCategory}
          onSearch={() => void runSearch()}
          loading={status === "loading"}
          resultCount={status === "success" ? results.length : null}
        />

        {status === "loading" ? <SkeletonCards count={3} /> : null}

        {status === "error" && error ? (
          <ErrorState
            title="Live search failed"
            message={error}
            onRetry={retry}
            retryLabel="Retry search"
          >
            <p className="mt-3 text-xs text-rose-700">
              Tip: if the message mentions missing credentials, the server needs
              <code className="mx-1 rounded bg-rose-100 px-1 py-0.5">
                TINYFISH_API_KEY
              </code>
              set in <code>.env.local</code> or in the Vercel project settings.
            </p>
          </ErrorState>
        ) : null}

        {status === "idle" ? (
          <EmptyState
            icon="⌕"
            title="Start a search"
            description="Enter what you are looking for and choose a category. OpporTune will query the live web and return source-backed results."
          />
        ) : null}

        {status === "success" && results.length === 0 ? (
          <EmptyState
            icon="∅"
            title="No opportunities found"
            description="The live search returned nothing usable. Try a broader phrase, another category, or add more detail to your profile."
            action={
              <button
                type="button"
                onClick={retry}
                className="btn btn-secondary"
              >
                ↻ Search again
              </button>
            }
          />
        ) : null}

        {status === "success" && results.length > 0 ? (
          <div className="space-y-4">
            {results.map((opportunity) => (
              <OpportunityCard
                key={opportunity.id}
                opportunity={opportunity}
                eligibility={checkEligibility(profile, opportunity)}
                saved={saved.some((item) => item.id === opportunity.id)}
                onOpen={openDetail}
                onToggleSave={toggleSave}
              />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        view={view}
        onNavigate={navigate}
        savedCount={saved.length}
        apiStatus={apiStatus}
      />

      <main className="flex-1">
        <div
          className={
            view === "home" ? "" : "mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10"
          }
        >
          {renderContent()}
        </div>
      </main>

      <footer className="border-t border-navy-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-navy-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            <strong className="text-navy-600">OpporTune</strong> — Evidence-First
            Opportunity Navigator. Built with React, Vite, Tailwind and the
            TinyFish Search + Fetch APIs.
          </p>
          <p>
            Summaries come from retrieved public pages. Always confirm details
            on the organiser&rsquo;s own page before applying.
          </p>
        </div>
      </footer>
    </div>
  );
}

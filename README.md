# OpporTune — Evidence-First Opportunity Navigator

**OpporTune** helps students find real hackathons, scholarships, internships and fellowships, then checks each one against the student's own profile — with evidence from the source page, never a guess.

Students enter their education level, interests, skills, location and team size. OpporTune searches the live web (via TinyFish Search + Fetch), extracts requirements and deadlines from real organiser pages, compares them against the profile, and shows source-backed matches: eligibility criteria marked **MET / NOT_MET / UNKNOWN**, a separate relevance score, and actionable next steps.

This is a **Vercel Serverless Functions** MVP: there is no separate backend, no FastAPI/Express server, and no database. The browser never calls TinyFish directly — the API key stays server-side.

## Live demo

The main search workflow calls a real serverless API (`/api/search`) and renders the returned data. It is **not a static mockup**. If `TINYFISH_API_KEY` is not configured, the app shows an honest error with a Retry button instead of fabricating results.

## Architecture

```mermaid
graph TD
    A[Student Browser] -->|profile form / search| B[React + Vite + TypeScript]
    B -->|POST /api/search| C[/api/search serverless function]
    C -->|GET + X-API-Key| D[TinyFish Search API<br/>api.search.tinyfish.ai]
    C -->|POST + X-API-Key| E[TinyFish Fetch API<br/>api.fetch.tinyfish.ai]
    D -->|ranked results| C
    E -->|page text & metadata| C
    C -->|normalized, source-backed opportunities| B
    B -->|read/write| F[(browser localStorage<br/>profile + saved opportunities)]

    subgraph Client (browser)
        B
        F
    end

    subgraph Serverless (Vercel /api)
        C
        H[/api/health — reachability only]
    end

    subgraph External public APIs
        D
        E
    end
```

- `TINYFISH_API_KEY` is read **only** inside the serverless function (`process.env`). It is never prefixed with `VITE_`, never sent to the browser, and never logged.
- Fetched page content is treated as untrusted input; only facts present in the retrieved text are extracted.

## Tech stack

- React 18 + Vite + TypeScript
- Tailwind CSS (teal-and-navy theme, responsive)
- Vitest (unit tests)
- Vercel Serverless Functions (`/api/*.ts`, Node runtime)
- localStorage for profile and saved opportunities

## Project structure

```
opportune/
├── api/
│   ├── health.ts          # reachability check (no secrets)
│   └── search.ts          # validation → TinyFish Search → TinyFish Fetch → normalize
│   └── lib/
│       ├── validation.ts  # request + SSRF-safe URL validation
│       ├── tinyfish.ts    # TinyFish Search/Fetch wrappers + query building
│       └── normalize.ts   # fact extraction into Opportunity records
├── src/
│   ├── App.tsx            # views: home / search / profile / saved + detail
│   ├── types.ts           # Opportunity, StudentProfile, EligibilityResult, …
│   ├── lib/
│   │   ├── api.ts         # client fetch to /api/search & /api/health
│   │   ├── eligibility.ts # transparent MET / NOT_MET / UNKNOWN rules
│   │   ├── nextSteps.ts   # evidence-derived next steps
│   │   ├── format.ts      # date helpers
│   │   ├── storage.ts     # localStorage helpers
│   │   └── teamSize.ts    # team-size parsing
│   ├── components/        # Header, Landing, ProfileForm, SearchPanel,
│   │                      # OpportunityCard, OpportunityDetail,
│   │                      # EligibilityChecklist, SavedList, States
│   ├── index.css
│   └── main.tsx
├── tests/                 # eligibility, normalization, validation, upstream failures
├── vercel.json            # Vercel project config
├── .env.example           # placeholder only — copy to .env.local
├── .gitignore             # excludes .env.local, *.log, .vercel, node_modules, dist
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── README.md
```

## Features

- **Live web search**: real hackathons, scholarships, internships, fellowships via TinyFish Search + Fetch (server-side only).
- **Student profile**: education level, interests, skills, location, team size — stored in the browser.
- **Transparent eligibility**: every criterion is `MET`, `NOT_MET` or `UNKNOWN`. `UNKNOWN` never counts as verified eligibility.
- **Evidence display**: each criterion shows the requirement, your profile value, the verdict explanation, and the source quote + link.
- **Relevance score (0–100)**: interest + skill overlap. Explicitly **not** proof of eligibility.
- **Saved opportunities**: toggle save/remove, persisted in localStorage.
- **Polished UI**: skeletons, empty states, API errors with Retry, accessible labels, mobile-friendly.
- **Health endpoint**: `/api/health` confirms reachability without revealing credentials.

## Environment variables

| Variable | Scope | Required | Notes |
|---|---|---|---|
| `TINYFISH_API_KEY` | server-side only | Yes (for live search) | Get one at https://agent.tinyfish.ai/api-keys |

**Never** create `VITE_TINYFISH_API_KEY` or any other frontend-exposed secret. The key must never reach the browser bundle.

### Local development (Windows PowerShell)

1. Install Node.js (v18+) and npm if you don't have them.
2. Open this folder in PowerShell:

```powershell
cd C:\Users\kanik\OneDrive\Documents\Default Project\opportune
```

3. Install dependencies:

```powershell
npm install
```

4. Configure the API key:

```powershell
Copy-Item .env.example .env.local
# Then open .env.local and paste your real key:
# notepad .env.local
```

`.env.local` contains `TINYFISH_API_KEY=your_tinyfish_api_key_here` — replace the placeholder with your real key. `.env.local` is in `.gitignore` and is **never** committed.

5. Run locally with the Vercel CLI so `/api` serverless functions execute **alongside** Vite:

> **Important:** running Vite alone (`npm run dev`) will **not** execute the Vercel serverless functions. Use the command below.

```powershell
npx vercel dev --local
```

- Vite serves the frontend on `http://localhost:5173`
- The Vercel dev server runs on `http://localhost:3000` and proxies `/api/*` to the local serverless functions
- Open `http://localhost:3000` in your browser

6. Test a live search: fill in the profile, enter a query like `ai hackathons for students`, pick a category, and click **Search live web**. Results come from the real TinyFish Search/Fetch APIs.

Without a valid key, `/api/health` reports `apiKeyConfigured: false` and search shows a clear error with a **Retry** button.

## TinyFish integration (per official docs)

The implementation follows the documented TinyFish contracts exactly:

**Search** — `GET https://api.search.tinyfish.ai`
- Required query param: `query` (1–2000 chars).
- Optional: `purpose`, `location`, `language`, `page`, `include_domains`, `exclude_domains`, `domain_type`, `recency_minutes`, `after_date`, `before_date`.
- Auth: `X-API-Key` header.
- Response: `{ query, results[{position, site_name, title, snippet, url, date, …}], total_results, page }`.

**Fetch** — `POST https://api.fetch.tinyfish.ai`
- Body: `{ urls: string[] (1–10), format: "markdown"\|"html"\|"json", … }`.
- Auth: `X-API-Key` header.
- Response: `{ results[{url, final_url, title, description, language, text, …}], errors[] }`.
- Per-URL failures appear in `errors[]` and do not fail the batch.

The serverless function:
1. Validates the incoming query/category/limit and rejects invalid bodies with `400`.
2. Reads `TINYFISH_API_KEY` from server-side env; returns `503` if missing (key never exposed).
3. Builds a focused query from category + profile and calls TinyFish Search.
4. Selects only **SSRF-safe public HTTP/HTTPS URLs** (rejects localhost, private IPs, link-local, cloud metadata), then calls TinyFish Fetch in batches of ≤10.
5. Extracts only facts present in retrieved text (deadline near a deadline keyword, education/skill/team mentions) — missing values stay `null`.
6. Returns normalized opportunity records with `sourceEvidence` (URL + verbatim quote) and `retrievedAt`.
7. Handles missing credentials, rate limits (429), timeouts, invalid JSON and upstream errors with clear HTTP responses.
8. Never logs or returns the API key.

## Tests

```powershell
npm test          # vitest run — all unit tests
npm run typecheck # tsc --noEmit
npm run build     # typecheck + production Vite build
```

Test coverage:
- **eligibility** — `MET`/`NOT_MET`/`UNKNOWN` verdicts; `UNKNOWN` never counts as verified; unmet rules → `not_eligible`; criteria the source never mentions are reported as `notChecked`.
- **normalization** — deadline extraction only next to deadline keywords; education/skills/team-size extraction; missing facts left unknown; no invented dates/links.
- **validation** — query length/category/limit checks, profile sanitisation, and SSRF-safe URL validation (localhost/private/metadata rejected).
- **upstream failures** — missing key (`503`), upstream 401/402/429/500, invalid JSON, network errors, fetch-stage failures, unsafe-URL filtering — all verified by invoking the real `/api/search` handler with mocked `fetch`.

Tests that touch TinyFish require a real `TINYFISH_API_KEY` to hit the live service; the suite otherwise verifies all request validation, normalization and failure handling with mocked responses.

## Deployment (Vercel from GitHub)

1. Push this repo to GitHub (`.env.local` is excluded by `.gitignore` — never commit a real key).
2. Import the project in Vercel.
3. In **Vercel Project Settings → Environment Variables**, add:
   - `TINYFISH_API_KEY` = your real key (Production, Preview, Development)
4. Redeploy. The `/api/search` and `/api/health` functions will run server-side with the key.

The key must **never** be committed to GitHub.

## Limitations (honest)

- Results depend on what TinyFish returns and what organiser pages actually publish. If a page doesn't state a deadline, OpporTune shows "Not stated in source" — it never guesses.
- `UNKNOWN` criteria are explicitly not counted as eligible; many results will show "Needs review" until you complete your profile or check the source.
- TinyFish free allowances apply (search: 12,000 requests/day; fetch: 1,000 URLs/day, resetting at 00:00 UTC).
- localStorage persists profile and saved items only in the current browser/device.

## Demo script (Kritical Hacks submission)

1. Open the app (local: `vercel dev --local`, then `http://localhost:3000`).
2. **Home**: read the "evidence-first" explainer; click **Search live opportunities**.
3. **Profile**: fill in education level (e.g. Undergraduate), skills (Python, React), location, team size; save.
4. **Search**: enter `ai hackathons for students`, choose a category, click **Search live web**.
5. **Results**: cards show title, organiser, deadline, eligibility verdict and relevance score. Click **View details**.
6. **Detail**: see the eligibility checklist — each criterion MET/NOT_MET/UNKNOWN with the source quote and link. Note "Unknown is not a pass." Read next steps and open the official page.
7. **Save**: toggle a save; it persists in localStorage. Visit **Saved** to see it.
8. **Health**: the header shows "Live data connected" only when `TINYFISH_API_KEY` is configured on the server.

> Remind judges: OpporTune queries the real web via TinyFish and shows source-backed evidence — no fabricated opportunities, deadlines or eligibility claims.

## License

MIT

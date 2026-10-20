import type { OpportunityCategory, StudentProfile } from "../../src/types";
import type { TinyFishFetchResult, TinyFishSearchResult } from "./normalize.js";
import { isSafeUrl } from "./validation.js";

const SEARCH_ENDPOINT = "https://api.search.tinyfish.ai";
const FETCH_ENDPOINT = "https://api.fetch.tinyfish.ai";
const UPSTREAM_TIMEOUT_MS = 55_000;
const MAX_FETCH_URLS = 10;

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "UpstreamError";
    this.code = code;
    this.status = status;
  }
}

export function getApiKey(): string | null {
  const key = process.env.TINYFISH_API_KEY;
  if (!key || !key.trim()) return null;
  return key.trim();
}

export interface TinyFishSearchResponse {
  query: string;
  results: TinyFishSearchResult[];
  total_results: number;
  page: number;
}

export interface TinyFishFetchResponse {
  results: TinyFishFetchResult[];
  errors: { url: string; error: string; status?: number }[];
}

function mapHttpError(status: number, context: string): UpstreamError {
  switch (status) {
    case 400:
      return new UpstreamError(
        "INVALID_INPUT",
        `TinyFish rejected the ${context} request.`,
        502,
      );
    case 401:
    case 403:
      return new UpstreamError(
        "AUTH_ERROR",
        "The upstream search service rejected the API credentials.",
        502,
      );
    case 402:
      return new UpstreamError(
        "QUOTA_EXCEEDED",
        "The upstream search allowance has been exhausted. Try again later.",
        502,
      );
    case 404:
      return new UpstreamError(
        "UPSTREAM_ERROR",
        "The upstream search service is unavailable.",
        502,
      );
    case 429:
      return new UpstreamError(
        "RATE_LIMITED",
        "The upstream search service is rate limiting requests. Retry shortly.",
        502,
      );
    default:
      return new UpstreamError(
        "UPSTREAM_ERROR",
        `The upstream search service returned an error (${status}).`,
        502,
      );
  }
}

async function requestJson(
  url: string,
  init: RequestInit,
  context: string,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();

    if (!response.ok) {
      throw mapHttpError(response.status, context);
    }

    if (!text) {
      throw new UpstreamError(
        "INVALID_JSON",
        `The ${context} service returned an empty response.`,
        502,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new UpstreamError(
        "INVALID_JSON",
        `The ${context} service returned invalid JSON.`,
        502,
      );
    }
  } catch (error) {
    if (error instanceof UpstreamError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new UpstreamError(
        "TIMEOUT",
        `The ${context} service timed out.`,
        504,
      );
    }
    throw new UpstreamError(
      "NETWORK_ERROR",
      `Could not reach the ${context} service.`,
      502,
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET https://api.search.tinyfish.ai
 * Contract: query (required), purpose/location/language/page optional.
 */
export async function tinyfishSearch(params: {
  query: string;
  purpose?: string;
  location?: string;
  language?: string;
  page?: number;
}): Promise<TinyFishSearchResponse> {
  const key = getApiKey();
  if (!key) {
    throw new UpstreamError(
      "MISSING_CREDENTIALS",
      "Server is missing the TINYFISH_API_KEY environment variable.",
      500,
    );
  }

  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("query", params.query);
  if (params.purpose) url.searchParams.set("purpose", params.purpose);
  if (params.location) url.searchParams.set("location", params.location);
  if (params.language) url.searchParams.set("language", params.language);
  if (params.page !== undefined) url.searchParams.set("page", String(params.page));

  const data = (await requestJson(
    url.toString(),
    { method: "GET", headers: { "X-API-Key": key } },
    "search",
  )) as Partial<TinyFishSearchResponse>;

  if (!Array.isArray(data.results)) {
    throw new UpstreamError(
      "INVALID_JSON",
      "The search service returned an unexpected response shape.",
      502,
    );
  }

  return {
    query: typeof data.query === "string" ? data.query : params.query,
    results: data.results as TinyFishSearchResult[],
    total_results: typeof data.total_results === "number" ? data.total_results : data.results.length,
    page: typeof data.page === "number" ? data.page : 0,
  };
}

/**
 * POST https://api.fetch.tinyfish.ai
 * Contract: { urls: string[] (1-10), format: "markdown" | "html" | "json" }.
 * Per-URL failures are returned in errors[] and do not fail the request.
 */
export async function tinyfishFetch(urls: string[]): Promise<TinyFishFetchResponse> {
  const key = getApiKey();
  if (!key) {
    throw new UpstreamError(
      "MISSING_CREDENTIALS",
      "Server is missing the TINYFISH_API_KEY environment variable.",
      500,
    );
  }

  const safeUrls = urls.filter(isSafeUrl).slice(0, MAX_FETCH_URLS);
  if (safeUrls.length === 0) {
    return { results: [], errors: [] };
  }

  const data = (await requestJson(
    FETCH_ENDPOINT,
    {
      method: "POST",
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ urls: safeUrls, format: "markdown", per_url_timeout_ms: 25_000 }),
    },
    "fetch",
  )) as Partial<TinyFishFetchResponse>;

  return {
    results: Array.isArray(data.results) ? data.results : [],
    errors: Array.isArray(data.errors) ? data.errors : [],
  };
}

const CATEGORY_TEMPLATES: Record<OpportunityCategory, string> = {
  hackathon: "hackathon for students registration open",
  scholarship: "scholarship for students application open",
  government_scheme: "government student scheme benefits application official",
  internship: "internship for students application open",
  fellowship: "fellowship for students application open",
};

/** Builds a focused query from the category, student query and profile. */
export function buildSearchQuery(
  category: OpportunityCategory,
  query: string,
  profile: StudentProfile,
): { query: string; purpose: string } {
  const base = query.trim();
  const extras: string[] = [];
  if (profile.educationLevel === "undergraduate") extras.push("undergraduate");
  else if (profile.educationLevel === "graduate") extras.push("graduate");
  else if (profile.educationLevel === "phd") extras.push("phd");
  else if (profile.educationLevel === "high_school") extras.push("high school");
  if (profile.location.trim()) extras.push(profile.location.trim());

  const combined = [CATEGORY_TEMPLATES[category], base, ...extras]
    .filter(Boolean)
    .join(" ")
    .slice(0, 2000);

  const interests = profile.interests.join(", ");
  const purpose = `Find real, currently open ${category} opportunities for a student${
    interests ? ` interested in ${interests}` : ""
  }${profile.skills.length ? ` with skills in ${profile.skills.join(", ")}` : ""}.`
    .slice(0, 2000);

  return { query: combined, purpose };
}

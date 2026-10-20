import type { VercelRequest, VercelResponse } from "@vercel/node";
import type {
  Opportunity,
  OpportunityCategory,
  SearchResponse,
} from "../src/types";
import { isSafeUrl } from "./lib/validation.js";
import { checkEligibility } from "../src/lib/eligibility.js";
import { validateSearchRequest } from "./lib/validation.js";
import {
  buildSearchQuery,
  getApiKey,
  tinyfishFetch,
  tinyfishSearch,
  UpstreamError,
} from "./lib/tinyfish.js";
import {
  normalizeOpportunity,
  type TinyFishFetchResult,
  type TinyFishSearchResult,
} from "./lib/normalize.js";

const FETCH_BATCH_SIZE = 10;
const SOCIAL_OR_VIDEO_HOSTS = ["youtube.com", "youtu.be", "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com"];

function isUsefulOpportunityUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return isSafeUrl(url) && !SOCIAL_OR_VIDEO_HOSTS.some((host) => hostname === host || hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

function sendError(
  res: VercelResponse,
  status: number,
  code: string,
  message: string,
): void {
  res.status(status).json({ error: { code, message } });
}

function upstreamStatus(code: string): number {
  switch (code) {
    case "MISSING_CREDENTIALS":
      return 503;
    case "RATE_LIMITED":
      return 429;
    case "QUOTA_EXCEEDED":
      return 502;
    case "TIMEOUT":
      return 504;
    case "INVALID_JSON":
    case "NETWORK_ERROR":
    case "UPSTREAM_ERROR":
      return 502;
    default:
      return 502;
  }
}

async function fetchContentFor(
  candidates: TinyFishSearchResult[],
): Promise<Map<string, TinyFishFetchResult>> {
  const byUrl = new Map<string, TinyFishFetchResult>();
  const urls = candidates
    .map((result) => result.url)
    .filter((url): url is string => Boolean(url))
    .filter(isSafeUrl);

  for (let i = 0; i < urls.length; i += FETCH_BATCH_SIZE) {
    const batch = urls.slice(i, i + FETCH_BATCH_SIZE);
    const response = await tinyfishFetch(batch);
    for (const result of response.results) {
      byUrl.set(result.url, result);
    }
  }
  return byUrl;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method === "GET") {
      sendError(
        res,
        405,
        "METHOD_NOT_ALLOWED",
        "Use POST with a JSON body containing query, category, profile and limit.",
      );
      return;
    }

    if (req.method !== "POST") {
      sendError(res, 405, "METHOD_NOT_ALLOWED", "Only POST is supported.");
      return;
    }

    const validation = validateSearchRequest(req.body);
    if (!validation.ok) {
      sendError(res, 400, "INVALID_REQUEST", validation.message);
      return;
    }

    const { query, category, profile, limit } = validation.value;

    if (!getApiKey()) {
      sendError(
        res,
        503,
        "MISSING_CREDENTIALS",
        "Live search is unavailable because the server is missing TINYFISH_API_KEY. Ask the owner to configure it.",
      );
      return;
    }

    const { query: searchQuery, purpose } = buildSearchQuery(
      category,
      query,
      profile,
    );

    let search;
    try {
      search = await tinyfishSearch({ query: searchQuery, purpose });
    } catch (error) {
      const upstream = error as UpstreamError;
      sendError(
        res,
        upstreamStatus(upstream.code),
        upstream.code,
        upstream.message,
      );
      return;
    }

    const candidates = search.results
      .filter(
        (result): result is TinyFishSearchResult & { url: string } =>
          typeof result.url === "string" && isUsefulOpportunityUrl(result.url),
      )
      .slice(0, limit);

    let fetchMap = new Map<string, TinyFishFetchResult>();
    if (candidates.length > 0) {
      try {
        fetchMap = await fetchContentFor(candidates);
      } catch {
        fetchMap = new Map();
      }
    }

    const retrievedAt = new Date().toISOString();
    const opportunities: Opportunity[] = candidates
      .map((result) =>
        normalizeOpportunity({
          category: category as OpportunityCategory,
          search: result,
          fetch: fetchMap.get(result.url),
          retrievedAt,
        }),
      )
      .filter((opportunity): opportunity is Opportunity => opportunity !== null)
      .filter((opportunity) => !opportunity.deadline || opportunity.deadline >= new Date().toISOString().slice(0, 10))
      .sort((a, b) => checkEligibility(profile, b).relevanceScore - checkEligibility(profile, a).relevanceScore)
      .slice(0, limit);

    const response: SearchResponse = {
      ok: true,
      opportunities,
      query: search.query,
      retrievedAt,
      demo: false,
    };

    res.status(200).json(response);
  } catch (error) {
    // Never return a raw 500 for an unexpected failure — respond with a safe,
    // structured error that never leaks the API key.
    sendError(res, 502, "INTERNAL_ERROR", "The search service failed unexpectedly.");
  }
}

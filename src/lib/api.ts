import type {
  ApiError,
  OpportunityCategory,
  SearchResponse,
  StudentProfile,
} from "../types";

const DEFAULT_TIMEOUT_MS = 45_000;

export interface SearchParams {
  query: string;
  category: OpportunityCategory;
  profile: StudentProfile;
  limit: number;
}

export type SearchOutcome = SearchResponse | ApiError;

function makeError(
  code: string,
  message: string,
  status = 500,
): ApiError {
  return { ok: false, code, message, status, error: message };
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("The server returned invalid JSON.");
  }
}

/**
 * Calls the real serverless search endpoint. The TinyFish API key is never
 * sent to or read by the browser.
 */
export async function searchOpportunities(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<SearchOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  const onExternalAbort = () => controller.abort();
  signal?.addEventListener("abort", onExternalAbort);

  try {
    const response = await fetch("/api/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: controller.signal,
    });

    const data = await parseJson(response);

    if (!response.ok) {
      const err = (data as { error?: { message?: string }; message?: string } | null)?.error;
      const message =
        err?.message ||
        (data as { message?: string } | null)?.message ||
        `Search failed with status ${response.status}.`;
      return makeError(
        response.status === 400
          ? "INVALID_REQUEST"
          : response.status === 429
            ? "RATE_LIMITED"
            : "UPSTREAM_ERROR",
        message,
        response.status,
      );
    }

    return data as SearchResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return makeError(
        "TIMEOUT",
        "The search took too long. Please try again.",
        408,
      );
    }
    return makeError(
      "NETWORK_ERROR",
      "Could not reach the search service. Check your connection and retry.",
      503,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onExternalAbort);
  }
}

export async function checkHealth(): Promise<{
  ok: boolean;
  status: "ok" | "misconfigured" | "unreachable";
}> {
  try {
    const response = await fetch("/api/health", { cache: "no-store" });
    const data = (await parseJson(response)) as {
      status?: string;
      apiKeyConfigured?: boolean;
    } | null;
    if (response.ok && data?.status === "ok") {
      return {
        ok: data.apiKeyConfigured === true,
        status: data.apiKeyConfigured ? "ok" : "misconfigured",
      };
    }
    return { ok: false, status: "unreachable" };
  } catch {
    return { ok: false, status: "unreachable" };
  }
}

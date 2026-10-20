import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import healthHandler from "../api/health";
import searchHandler from "../api/search";

const TEST_KEY = "tf_test_secret_key_123";

interface Captured {
  statusCode: number;
  body: any;
  headers: Record<string, string>;
}

function createRes() {
  const captured: Captured = { statusCode: 200, body: undefined, headers: {} };
  const res: any = {
    setHeader: (key: string, value: string) => {
      captured.headers[key] = value;
    },
    status: (code: number) => {
      captured.statusCode = code;
      return res;
    },
    json: (payload: any) => {
      captured.body = payload;
      return res;
    },
  };
  return { res, captured };
}

interface UpstreamReply {
  status?: number;
  body?: unknown;
  text?: string;
}

function mockFetch(
  handler: (url: string, init?: RequestInit) => UpstreamReply,
): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: any, init?: RequestInit) => {
    const reply = handler(String(input), init);
    const status = reply.status ?? 200;
    const text =
      reply.text !== undefined ? reply.text : JSON.stringify(reply.body ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => text,
    };
  });
  globalThis.fetch = fn as unknown as typeof fetch;
  return fn;
}

const SEARCH_URL = "https://api.search.tinyfish.ai";

const validBody = {
  query: "student hackathons",
  category: "hackathon",
  profile: {
    name: "Kanika",
    educationLevel: "undergraduate",
    interests: ["artificial intelligence"],
    skills: ["python"],
    location: "Delhi, India",
    teamSize: "small",
  },
  limit: 5,
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  process.env.TINYFISH_API_KEY = TEST_KEY;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TINYFISH_API_KEY;
  vi.restoreAllMocks();
});

describe("/api/search — request validation", () => {
  it("rejects a request with a missing query", async () => {
    const { res, captured } = createRes();
    await searchHandler({ method: "POST", body: { ...validBody, query: "" } } as any, res);

    expect(captured.statusCode).toBe(400);
    expect(captured.body.error.code).toBe("INVALID_REQUEST");
    expect(captured.body.error.message).toBeTruthy();
  });

  it("rejects an unknown category", async () => {
    const { res, captured } = createRes();
    await searchHandler({ method: "POST", body: { ...validBody, category: "grant" } } as any, res);

    expect(captured.statusCode).toBe(400);
    expect(captured.body.error.code).toBe("INVALID_REQUEST");
  });

  it("rejects unsupported HTTP methods", async () => {
    const { res, captured } = createRes();
    await searchHandler({ method: "GET" } as any, res);

    expect(captured.statusCode).toBe(405);
    expect(captured.body.error.code).toBe("METHOD_NOT_ALLOWED");
  });
});

describe("/api/search — missing credentials", () => {
  it("returns 503 and never leaks the key when TINYFISH_API_KEY is absent", async () => {
    delete process.env.TINYFISH_API_KEY;
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(503);
    expect(captured.body.error.code).toBe("MISSING_CREDENTIALS");
    expect(JSON.stringify(captured.body)).not.toContain("tf_");
  });
});

describe("/api/search — upstream failures", () => {
  it("maps an upstream 401 to an authentication error", async () => {
    mockFetch(() => ({ status: 401, body: { error: { code: "INVALID_API_KEY" } } }));
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(502);
    expect(captured.body.error.code).toBe("AUTH_ERROR");
    expect(JSON.stringify(captured.body)).not.toContain(TEST_KEY);
  });

  it("maps an upstream 429 to a rate-limit response", async () => {
    mockFetch(() => ({ status: 429, body: { error: { code: "RATE_LIMIT_EXCEEDED" } } }));
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(429);
    expect(captured.body.error.code).toBe("RATE_LIMITED");
  });

  it("maps an upstream 402 to a quota error", async () => {
    mockFetch(() => ({ status: 402, body: { error: { code: "INSUFFICIENT_CREDITS" } } }));
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(502);
    expect(captured.body.error.code).toBe("QUOTA_EXCEEDED");
  });

  it("maps an upstream 500 to a generic upstream error", async () => {
    mockFetch(() => ({ status: 500, body: { error: { code: "INTERNAL_ERROR" } } }));
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(502);
    expect(captured.body.error.code).toBe("UPSTREAM_ERROR");
  });

  it("reports invalid JSON from the upstream service", async () => {
    mockFetch(() => ({ status: 200, text: "{not json" }));
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(502);
    expect(captured.body.error.code).toBe("INVALID_JSON");
  });

  it("reports a network failure to the upstream service", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("socket hang up");
    }) as unknown as typeof fetch;
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(502);
    expect(captured.body.error.code).toBe("NETWORK_ERROR");
  });

  it("still returns search results when fetch is unavailable (best-effort fetch)", async () => {
    mockFetch((url) => {
      if (url.startsWith(SEARCH_URL)) {
        return {
          status: 200,
          body: {
            query: "student hackathons",
            total_results: 1,
            page: 0,
            results: [
              {
                position: 1,
                site_name: "example.org",
                title: "Student Hackathon",
                snippet: "A hackathon",
                url: "https://example.org/hack",
              },
            ],
          },
        };
      }
      return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
    });
    const { res, captured } = createRes();

    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.ok).toBe(true);
    expect(captured.body.opportunities).toHaveLength(1);
    expect(captured.body.opportunities[0].title).toBe("Student Hackathon");
    expect(captured.body.opportunities[0].deadline).toBeNull();
    expect(JSON.stringify(captured.body)).not.toContain(TEST_KEY);
  });
});

describe("/api/search — success path", () => {
  it("returns normalized, source-backed opportunities", async () => {
    const fetchMock = mockFetch((url) => {
      if (url.startsWith(SEARCH_URL)) {
        return {
          status: 200,
          body: {
            query: "student hackathons",
            total_results: 1,
            page: 0,
            results: [
              {
                position: 1,
                site_name: "example.org",
                title: "Global AI Build Challenge",
                snippet: "Annual student hackathon",
                url: "https://example.org/ai-build",
              },
            ],
          },
        };
      }
      return {
        status: 200,
        body: {
          results: [
            {
              url: "https://example.org/ai-build",
              final_url: "https://example.org/ai-build",
              title: "Global AI Build Challenge",
              description: null,
              language: "en",
              format: "markdown",
              author: null,
              published_date: null,
              text: "Open to undergraduate students. Applications close on 2026-03-15. Teams of 2-4 members. Bring Python skills.",
            },
          ],
          errors: [],
        },
      };
    });

    const { res, captured } = createRes();
    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.ok).toBe(true);
    expect(captured.body.demo).toBe(false);
    expect(captured.body.opportunities).toHaveLength(1);

    const opportunity = captured.body.opportunities[0];
    expect(opportunity.title).toBe("Global AI Build Challenge");
    expect(opportunity.deadline).toBe("2026-03-15");
    expect(opportunity.teamSize).toBe("Teams of 2-4");
    expect(opportunity.skills).toContain("python");
    expect(opportunity.sourceEvidence.length).toBeGreaterThan(0);
    expect(opportunity.sourceEvidence[0].url).toBe("https://example.org/ai-build");
    expect(opportunity.retrievedAt).toBeTruthy();

    // the API key travels in the header, never in the response body
    const searchCall = fetchMock.mock.calls.find((call) =>
      String(call[0]).startsWith(SEARCH_URL),
    );
    const headers = (searchCall?.[1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-API-Key"]).toBe(TEST_KEY);
    expect(JSON.stringify(captured.body)).not.toContain(TEST_KEY);
  });

  it("drops search results that point at unsafe urls", async () => {
    mockFetch((url) => {
      if (url.startsWith(SEARCH_URL)) {
        return {
          status: 200,
          body: {
            query: "student hackathons",
            total_results: 3,
            page: 0,
            results: [
              {
                position: 1,
                site_name: "localhost",
                title: "Internal",
                snippet: "internal",
                url: "http://localhost:3000/secret",
              },
              {
                position: 2,
                site_name: "metadata",
                title: "Metadata",
                snippet: "metadata",
                url: "http://169.254.169.254/latest/meta-data",
              },
              {
                position: 3,
                site_name: "example.org",
                title: "Public Hackathon",
                snippet: "public",
                url: "https://example.org/public",
              },
            ],
          },
        };
      }
      return { status: 200, body: { results: [], errors: [] } };
    });

    const { res, captured } = createRes();
    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.opportunities).toHaveLength(1);
    expect(captured.body.opportunities[0].officialUrl).toBe(
      "https://example.org/public",
    );
  });

  it("returns an empty list instead of fabricating results when nothing is found", async () => {
    mockFetch((url) => {
      if (url.startsWith(SEARCH_URL)) {
        return {
          status: 200,
          body: { query: "student hackathons", total_results: 0, page: 0, results: [] },
        };
      }
      return { status: 200, body: { results: [], errors: [] } };
    });

    const { res, captured } = createRes();
    await searchHandler({ method: "POST", body: validBody } as any, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.opportunities).toEqual([]);
    expect(captured.body.ok).toBe(true);
  });
});

describe("/api/health", () => {
  it("confirms reachability without revealing the key", async () => {
    const { res, captured } = createRes();
    await healthHandler({ method: "GET" } as any, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.status).toBe("ok");
    expect(captured.body.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(captured.body)).not.toContain(TEST_KEY);
  });

  it("reports that credentials are missing without failing", async () => {
    delete process.env.TINYFISH_API_KEY;
    const { res, captured } = createRes();
    await healthHandler({ method: "GET" } as any, res);

    expect(captured.statusCode).toBe(200);
    expect(captured.body.apiKeyConfigured).toBe(false);
    expect(captured.body.status).toBe("ok");
  });
});

import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  isSafeUrl,
  validateSearchRequest,
} from "../api/lib/validation";
import { buildSearchQuery } from "../api/lib/tinyfish";
import type { StudentProfile } from "../src/types";

const profile: StudentProfile = {
  name: "Kanika",
  educationLevel: "undergraduate",
  interests: ["artificial intelligence"],
  skills: ["python"],
  location: "Delhi, India",
  teamSize: "small",
};

function body(overrides: Record<string, unknown> = {}) {
  return {
    query: "student hackathons",
    category: "hackathon",
    profile,
    limit: 5,
    ...overrides,
  };
}

describe("validateSearchRequest", () => {
  it("accepts government schemes as a search category", () => {
    const result = validateSearchRequest(body({ category: "government_scheme" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.category).toBe("government_scheme");
  });
  it("accepts a valid request", () => {
    const result = validateSearchRequest(body());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.query).toBe("student hackathons");
    expect(result.value.category).toBe("hackathon");
    expect(result.value.limit).toBe(5);
    expect(result.value.profile.educationLevel).toBe("undergraduate");
  });

  it("rejects a non-object body", () => {
    expect(validateSearchRequest("nope").ok).toBe(false);
    expect(validateSearchRequest(null).ok).toBe(false);
    expect(validateSearchRequest(undefined).ok).toBe(false);
  });

  it("rejects a missing or too-short query", () => {
    const missing = validateSearchRequest(body({ query: undefined }));
    expect(missing.ok).toBe(false);

    const tooShort = validateSearchRequest(body({ query: "a" }));
    expect(tooShort.ok).toBe(false);
    if (!tooShort.ok) {
      expect(tooShort.message).toContain("at least");
    }
  });

  it("rejects a query longer than the documented maximum", () => {
    const result = validateSearchRequest(body({ query: "x".repeat(2001) }));
    expect(result.ok).toBe(false);
  });

  it("rejects an unknown category", () => {
    const result = validateSearchRequest(body({ category: "grant" }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("Category");
    }
  });

  it("rejects a non-integer or non-positive limit", () => {
    expect(validateSearchRequest(body({ limit: 0 })).ok).toBe(false);
    expect(validateSearchRequest(body({ limit: -3 })).ok).toBe(false);
    expect(validateSearchRequest(body({ limit: 2.5 })).ok).toBe(false);
    expect(validateSearchRequest(body({ limit: "five" })).ok).toBe(false);
  });

  it("clamps the limit to the server maximum", () => {
    const result = validateSearchRequest(body({ limit: 500 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.limit).toBe(MAX_LIMIT);
  });

  it("falls back to the default limit when none is supplied", () => {
    const result = validateSearchRequest(body({ limit: undefined }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.limit).toBe(DEFAULT_LIMIT);
  });

  it("sanitises a hostile profile", () => {
    const result = validateSearchRequest(
      body({
        profile: {
          name: 42,
          educationLevel: "wizard",
          interests: ["ai", 7, null, "ai", "x".repeat(500)],
          skills: "not-an-array",
          location: { nope: true },
          teamSize: "enormous",
        },
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sanitized = result.value.profile;
    expect(sanitized.name).toBe("");
    expect(sanitized.educationLevel).toBe("");
    expect(sanitized.teamSize).toBe("any");
    expect(sanitized.skills).toEqual([]);
    expect(sanitized.location).toBe("");
    expect(sanitized.interests).toContain("ai");
    expect(sanitized.interests).not.toContain(42 as never);
    expect(sanitized.interests.every((i) => i.length <= 60)).toBe(true);
  });

  it("trims the query", () => {
    const result = validateSearchRequest(body({ query: "  ai hackathons  " }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.query).toBe("ai hackathons");
  });
});

describe("isSafeUrl", () => {
  it("allows public http and https urls", () => {
    expect(isSafeUrl("https://example.com")).toBe(true);
    expect(isSafeUrl("http://example.org/page?a=1")).toBe(true);
    expect(isSafeUrl("https://sub.domain.example.co.uk/a/b")).toBe(true);
  });

  it("rejects localhost and loopback", () => {
    expect(isSafeUrl("http://localhost")).toBe(false);
    expect(isSafeUrl("http://localhost:3000/admin")).toBe(false);
    expect(isSafeUrl("http://foo.localhost")).toBe(false);
    expect(isSafeUrl("http://127.0.0.1")).toBe(false);
    expect(isSafeUrl("http://127.0.0.1:8080/x")).toBe(false);
    expect(isSafeUrl("http://[::1]/x")).toBe(false);
  });

  it("rejects private network addresses", () => {
    expect(isSafeUrl("http://10.0.0.1")).toBe(false);
    expect(isSafeUrl("http://10.255.255.255")).toBe(false);
    expect(isSafeUrl("http://172.16.0.1")).toBe(false);
    expect(isSafeUrl("http://172.31.255.1")).toBe(false);
    expect(isSafeUrl("http://192.168.1.1")).toBe(false);
  });

  it("rejects link-local and cloud metadata addresses", () => {
    expect(isSafeUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isSafeUrl("http://metadata.google.internal")).toBe(false);
  });

  it("rejects reserved and multicast ranges", () => {
    expect(isSafeUrl("http://0.0.0.0")).toBe(false);
    expect(isSafeUrl("http://100.64.0.1")).toBe(false);
    expect(isSafeUrl("http://198.18.0.1")).toBe(false);
    expect(isSafeUrl("http://224.0.0.1")).toBe(false);
    expect(isSafeUrl("http://[fd00::1]")).toBe(false);
    expect(isSafeUrl("http://[fe80::1]")).toBe(false);
  });

  it("rejects non-http schemes and embedded credentials", () => {
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("ftp://example.com/file")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<h1>x</h1>")).toBe(false);
    expect(isSafeUrl("https://user:pass@example.com")).toBe(false);
  });

  it("rejects malformed and oversized urls", () => {
    expect(isSafeUrl("not a url")).toBe(false);
    expect(isSafeUrl("")).toBe(false);
    expect(isSafeUrl(`https://example.com/${"a".repeat(3000)}`)).toBe(false);
  });
});

describe("buildSearchQuery", () => {
  it("combines the category, the user query and profile hints", () => {
    const { query, purpose } = buildSearchQuery(
      "hackathon",
      "ai for good",
      profile,
    );
    expect(query).toContain("hackathon");
    expect(query).toContain("ai for good");
    expect(query).toContain("undergraduate");
    expect(query).toContain("Delhi, India");
    expect(query.length).toBeLessThanOrEqual(2000);
    expect(purpose.length).toBeLessThanOrEqual(2000);
    expect(purpose).toContain("hackathon");
  });

  it("never exceeds the documented query length limit", () => {
    const { query, purpose } = buildSearchQuery("scholarship", "x".repeat(5000), {
      ...profile,
      interests: Array.from({ length: 50 }, (_, i) => `interest-${i}`),
    });
    expect(query.length).toBeLessThanOrEqual(2000);
    expect(purpose.length).toBeLessThanOrEqual(2000);
  });
});

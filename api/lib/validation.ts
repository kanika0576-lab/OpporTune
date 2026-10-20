import {
  EDUCATION_LEVELS,
  OPPORTUNITY_CATEGORIES,
  type EducationLevel,
  type OpportunityCategory,
  type StudentProfile,
  type TeamSize,
} from "../../src/types";

export const MAX_QUERY_LENGTH = 2000;
export const MIN_QUERY_LENGTH = 2;
export const MAX_LIMIT = 20;
export const DEFAULT_LIMIT = 10;

export interface ValidatedSearchRequest {
  query: string;
  category: OpportunityCategory;
  profile: StudentProfile;
  limit: number;
}

export type ValidationResult =
  | { ok: true; value: ValidatedSearchRequest }
  | { ok: false; message: string };

function asString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function asStringArray(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, maxLen))
    .filter((item) => item.length > 0)
    .slice(0, maxItems);
}

function sanitizeProfile(input: unknown): StudentProfile {
  const raw = (input ?? {}) as Record<string, unknown>;
  const educationLevel = EDUCATION_LEVELS.includes(raw.educationLevel as EducationLevel)
    ? (raw.educationLevel as EducationLevel)
    : "";
  const teamSize = (["solo", "small", "large", "any"] as TeamSize[]).includes(
    raw.teamSize as TeamSize,
  )
    ? (raw.teamSize as TeamSize)
    : "any";
  return {
    name: asString(raw.name, 80) ?? "",
    educationLevel,
    interests: asStringArray(raw.interests, 12, 60),
    skills: asStringArray(raw.skills, 20, 60),
    location: asString(raw.location, 80) ?? "",
    teamSize,
  };
}

export function validateSearchRequest(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, message: "Request body must be a JSON object." };
  }

  const raw = body as Record<string, unknown>;

  const query = typeof raw.query === "string" ? raw.query.trim() : "";
  if (query.length < MIN_QUERY_LENGTH) {
    return {
      ok: false,
      message: `The search query must be at least ${MIN_QUERY_LENGTH} characters.`,
    };
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return {
      ok: false,
      message: `The search query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
    };
  }

  const category = raw.category as OpportunityCategory;
  if (!OPPORTUNITY_CATEGORIES.includes(category)) {
    return {
      ok: false,
      message: `Category must be one of: ${OPPORTUNITY_CATEGORIES.join(", ")}.`,
    };
  }

  let limit = DEFAULT_LIMIT;
  if (raw.limit !== undefined && raw.limit !== null) {
    const parsed = Number(raw.limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, message: "Limit must be a positive integer." };
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  return {
    ok: true,
    value: {
      query,
      category,
      profile: sanitizeProfile(raw.profile),
      limit,
    },
  };
}

function isPrivateIPv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (parts.some((p) => p < 0 || p > 255)) return true;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIPv6(hostname: string): boolean {
  const value = hostname.toLowerCase();
  if (value === "::1" || value === "::") return true;
  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    const parts = mapped.split(".").map((p) => parseInt(p, 10));
    if (parts.length === 4) return isPrivateIPv4(parts);
  }
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  return false;
}

function isIPv4(host: string): boolean {
  const parts = host.split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    const n = parseInt(p, 10);
    if (!Number.isFinite(n) || n < 0 || n > 255 || String(n) !== p) return false;
  }
  return true;
}

function isIPv6(host: string): boolean {
  return /:/.test(host);
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (host === "metadata.google.internal") return true;

  const hostWithoutBrackets = host.replace(/^\[|\]$/g, "");
  if (isIPv4(hostWithoutBrackets)) {
    return isPrivateIPv4(hostWithoutBrackets.split(".").map((p) => parseInt(p, 10)));
  }
  if (isIPv6(hostWithoutBrackets)) {
    return isPrivateIPv6(hostWithoutBrackets);
  }
  return false;
}

/**
 * Only public http(s) URLs are allowed. Rejects localhost, private, link-local,
 * loopback, reserved, multicast and cloud-metadata addresses.
 */
export function isSafeUrl(candidate: string): boolean {
  if (typeof candidate !== "string" || candidate.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
  if (parsed.username || parsed.password) return false;
  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");
  if (!hostname) return false;
  return !isPrivateHostname(hostname);
}

import { EMPTY_PROFILE, type StudentProfile } from "../types";
import type { Opportunity } from "../types";

const PROFILE_KEY = "opportune.profile.v1";
const SAVED_KEY = "opportune.saved.v1";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return (parsed as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export function loadProfile(): StudentProfile {
  const stored = safeParse<Partial<StudentProfile>>(
    typeof window === "undefined" ? null : window.localStorage.getItem(PROFILE_KEY),
    {},
  );
  return { ...EMPTY_PROFILE, ...stored };
}

export function saveProfile(profile: StudentProfile): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable or full — ignore */
  }
}

export function loadSavedOpportunities(): Opportunity[] {
  return safeParse<Opportunity[]>(
    typeof window === "undefined" ? null : window.localStorage.getItem(SAVED_KEY),
    [],
  );
}

export function saveOpportunities(opportunities: Opportunity[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(opportunities));
  } catch {
    /* storage unavailable or full — ignore */
  }
}

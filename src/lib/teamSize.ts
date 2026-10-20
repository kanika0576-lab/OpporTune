export type ParsedTeamSize = "solo" | "small" | "large" | null;

/**
 * Parses a human readable team-size requirement into a comparable bucket.
 *
 * "Team of 2-4"  -> small
 * "Team of 4"    -> small
 * "5+ members"   -> large
 * "Individuals"  -> solo
 * "Any size"     -> null (not interpretable)
 */
export function parseTeamSize(text: string): ParsedTeamSize {
  if (!text) return null;
  const lower = text.toLowerCase();

  const range = /(\d+)\s*(?:-|–|to)\s*(\d+)/.exec(lower);
  if (range) {
    const low = parseInt(range[1], 10);
    const high = parseInt(range[2], 10);
    if (low >= 5 || high >= 5) return "large";
    if (low >= 2) return "small";
    return "solo";
  }

  const sized = /(\d+)\+?\s*(?:person|people|member|participant|student|developer|designer|contestant)s?\b/.exec(
    lower,
  );
  if (sized) {
    const count = parseInt(sized[1], 10);
    if (count >= 5) return "large";
    if (count >= 2) return "small";
    return "solo";
  }

  const teamOf = /teams?\s+of\s+(?:up to\s+)?(\d+)/.exec(lower);
  if (teamOf) {
    const count = parseInt(teamOf[1], 10);
    if (count >= 5) return "large";
    if (count >= 2) return "small";
    return "solo";
  }

  if (/\b(?:individual|individually|solo)\b/.test(lower)) return "solo";

  return null;
}

/** Normalised label for the profile's team-size preference. */
export const TEAM_SIZE_LABELS: Record<string, string> = {
  solo: "solo",
  small: "a small team (2-4)",
  large: "a large team (5+)",
  any: "any team size",
};

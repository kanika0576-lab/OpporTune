import type {
  CriterionResult,
  EducationLevel,
  EligibilityResult,
  EligibilityVerdict,
  Opportunity,
  StudentProfile,
} from "../types";
import { parseTeamSize } from "./teamSize.js";

interface EducationKeywordRule {
  pattern: RegExp;
  keyword: string;
  allowed: EducationLevel[];
  /** Generic rules only apply when no specific level was mentioned. */
  generic?: boolean;
}

const ALL_LEVELS: EducationLevel[] = [
  "high_school",
  "undergraduate",
  "graduate",
  "phd",
];

const EDUCATION_RULES: EducationKeywordRule[] = [
  {
    pattern: /\bph\.?d\b|doctoral|doctorate/i,
    keyword: "phd",
    allowed: ["phd"],
  },
  {
    pattern: /\bmaster'?s?\b|\bgraduate\b|\bpost[-\s]?grad/i,
    keyword: "graduate",
    allowed: ["graduate", "phd"],
  },
  {
    pattern: /\bbachelor'?s?\b|\bundergraduate\b|\bcollege\b|\bdegree\b/i,
    keyword: "undergraduate",
    allowed: ["undergraduate", "graduate", "phd"],
  },
  {
    pattern: /\bhigh school\b|\bsecondary school\b|\bsenior secondary\b/i,
    keyword: "high school",
    allowed: ["high_school"],
  },
  {
    pattern: /\bstudent\b|\benrolled\b/i,
    keyword: "student",
    allowed: ALL_LEVELS,
    generic: true,
  },
];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Returns the set of education levels that satisfy a single requirement
 * phrase. A specific level ("undergraduate") always wins over a generic one
 * ("student"), so a high-school student is never auto-qualified for an
 * undergraduate-only requirement.
 */
export function educationLevelsForRequirement(
  requirement: string,
): EducationLevel[] {
  const levels = new Set<EducationLevel>();
  let specificFound = false;

  for (const rule of EDUCATION_RULES) {
    if (!rule.pattern.test(requirement)) continue;
    if (rule.generic) continue;
    specificFound = true;
    rule.allowed.forEach((level) => levels.add(level));
  }

  if (!specificFound) {
    for (const rule of EDUCATION_RULES) {
      if (rule.generic && rule.pattern.test(requirement)) {
        rule.allowed.forEach((level) => levels.add(level));
      }
    }
  }

  return Array.from(levels);
}

/** The education keywords found in a requirement, used to locate evidence. */
export function educationKeywords(requirement: string): string[] {
  return EDUCATION_RULES.filter((rule) => rule.pattern.test(requirement)).map(
    (rule) => rule.keyword,
  );
}

function evidenceFor(
  opportunity: Opportunity,
  predicate: (quote?: string) => boolean,
) {
  return opportunity.sourceEvidence.filter((e) => predicate(e.quote));
}

/** True when a quote mentions at least one meaningful word of a phrase. */
export function quoteMentions(quote: string | undefined, phrase: string): boolean {
  const haystack = (quote ?? "").toLowerCase();
  if (!haystack) return false;
  const tokens = phrase
    .toLowerCase()
    .split(/[^a-z0-9+.]+/)
    .filter((token) => token.length > 2);
  if (tokens.length === 0) return false;
  return tokens.some((token) => haystack.includes(token));
}

/**
 * A criterion is only produced when the retrieved source actually states
 * something that can be checked. Criteria the source never mentions are
 * reported in `notChecked` instead of being scored as a silent pass.
 */
function checkEducation(
  profile: StudentProfile,
  opportunity: Opportunity,
): CriterionResult | null {
  const requirements = opportunity.educationRequirements.filter(
    (r) => r && r.trim().length > 0,
  );

  if (requirements.length === 0) return null;

  if (!profile.educationLevel) {
    return {
      id: "education",
      label: "Education level",
      status: "UNKNOWN",
      requirement: requirements.join("; "),
      profileValue: null,
      explanation:
        "Your education level is not set, so this could not be checked. Add it in your profile to resolve it.",
      evidence: evidenceFor(opportunity, (q) =>
        requirements.some((r) => quoteMentions(q, r)),
      ),
    };
  }

  const allowed = unique(requirements.flatMap(educationLevelsForRequirement));
  const matched = allowed.includes(profile.educationLevel);

  return {
    id: "education",
    label: "Education level",
    status: matched ? "MET" : "NOT_MET",
    requirement: requirements.join("; "),
    profileValue: profile.educationLevel,
    explanation: matched
      ? `Your level (${profile.educationLevel}) satisfies a stated requirement.`
      : `The source asks for ${requirements.join(
          "; ",
        )}, which does not include your level (${profile.educationLevel}).`,
    evidence: evidenceFor(opportunity, (q) =>
      requirements.some((r) => quoteMentions(q, r)),
    ),
  };
}

function checkTeamSize(
  profile: StudentProfile,
  opportunity: Opportunity,
): CriterionResult | null {
  const requirement = opportunity.teamSize;
  if (!requirement) return null;

  if (profile.teamSize === "any") {
    return {
      id: "teamSize",
      label: "Team size",
      status: "UNKNOWN",
      requirement,
      profileValue: "any",
      explanation:
        "You have not chosen a team size, so this could not be checked. Pick one in your profile.",
      evidence: evidenceFor(opportunity, (q) => quoteMentions(q, requirement)),
    };
  }

  const parsed = parseTeamSize(requirement);
  if (!parsed) {
    return {
      id: "teamSize",
      label: "Team size",
      status: "UNKNOWN",
      requirement,
      profileValue: profile.teamSize,
      explanation: `The requirement "${requirement}" could not be interpreted automatically. Verify it on the official page.`,
      evidence: evidenceFor(opportunity, (q) => quoteMentions(q, requirement)),
    };
  }

  const matched = parsed === profile.teamSize;
  return {
    id: "teamSize",
    label: "Team size",
    status: matched ? "MET" : "NOT_MET",
    requirement,
    profileValue: profile.teamSize,
    explanation: matched
      ? `Your team size (${profile.teamSize}) matches the stated requirement.`
      : `The source asks for a ${parsed} team, but your profile says ${profile.teamSize}.`,
    evidence: evidenceFor(opportunity, (q) => quoteMentions(q, requirement)),
  };
}

function checkGraduationYear(
  profile: StudentProfile,
  opportunity: Opportunity,
): CriterionResult | null {
  const years = opportunity.graduationYears ?? [];
  if (!years.length) return null;
  const year = Number(profile.graduationYear);
  if (!Number.isInteger(year) || year < 2000 || year > 2099) {
    return {
      id: "graduation-year",
      label: "Graduation year",
      status: "UNKNOWN",
      requirement: years.join(", "),
      profileValue: profile.graduationYear || null,
      explanation: "The source limits eligible graduation years. Add your expected graduation year to check this requirement.",
      evidence: evidenceFor(opportunity, (q) => years.some((y) => q?.includes(String(y)))),
    };
  }
  const matched = years.includes(year);
  return {
    id: "graduation-year",
    label: "Graduation year",
    status: matched ? "MET" : "NOT_MET",
    requirement: years.join(", "),
    profileValue: String(year),
    explanation: matched
      ? `Your expected graduation year (${year}) is listed by the source.`
      : `The source lists ${years.join(", ")}; your expected graduation year is ${year}.`,
    evidence: evidenceFor(opportunity, (q) => years.some((y) => q?.includes(String(y)))),
  };
}

const UNMODELED_REQUIREMENTS: { label: string; pattern: RegExp }[] = [
  { label: "Citizenship or residency", pattern: /\b(?:citizenship|citizen of|nationality|domicile|resident of|residency)\b/i },
  { label: "Age", pattern: /\b(?:age limit|aged between|years of age|born (?:on|after|before)|under \d{1,2}|over \d{1,2})\b/i },
  { label: "Income or financial need", pattern: /\b(?:family income|annual income|income limit|financial need|need[- ]based)\b/i },
  { label: "Caste or community", pattern: /\b(?:SC|ST|OBC|MBC|DNT|EWS|caste|tribe|community category)\b/i },
  { label: "Gender", pattern: /\b(?:women only|female applicants|male applicants|gender requirement)\b/i },
  { label: "Disability status", pattern: /\b(?:person with disabilit\w*|disability certificate|disabled applicants)\b/i },
  { label: "Current enrollment", pattern: /\b(?:currently enrolled|enrolled at|enrolled in|enrollment required)\b/i },
  { label: "Institution restriction", pattern: /\b(?:government college|recognized university|accredited institution|approved institution)\b/i },
  { label: "Field of study", pattern: /\b(?:degree|major|course|discipline)\s+(?:in|of)\b|\bstudying\s+(?:for|in)\b/i },
];

/** Keep uncovered requirements visible as UNKNOWN instead of silently passing them. */
function checkUnmodeledRequirements(
  opportunity: Opportunity,
): CriterionResult | null {
  const text = [
    opportunity.eligibilityText,
    ...opportunity.educationRequirements,
    ...opportunity.sourceEvidence.map((item) => item.quote ?? ""),
  ].join(" ");
  const found = UNMODELED_REQUIREMENTS.filter(({ pattern }) => pattern.test(text));
  if (found.length === 0) return null;

  const labels = found.map(({ label }) => label);
  const evidence = opportunity.sourceEvidence.filter((item) =>
    found.some(({ pattern }) => pattern.test(item.quote ?? "")),
  );
  return {
    id: "additional-requirements",
    label: "Additional requirements",
    status: "UNKNOWN",
    requirement: labels.join("; "),
    profileValue: null,
    explanation: `The source mentions ${labels.join(", ").toLowerCase()} conditions that OpporTune cannot verify from your profile. Confirm them on the official page.`,
    evidence,
  };
}

const LOCATION_RESTRICTION =
  /\b(?:open to|available to|limited to|restricted to|residents? of|citizens? of|based in|located in|only for)\b[^.]{0,60}\b(?:applicants?|students?|candidates?|residents?|citizens?|people|teams?)\b/i;
const REMOTE_SIGNAL =
  /\b(?:remote|virtual|online[- ]only|work from home|fully online)\b/i;

/**
 * Location is only ever MET or UNKNOWN — geographic matching is too fuzzy to
 * safely reject a student, so an unmatched restriction is reported as
 * unverified rather than as a failure.
 */
function checkLocation(
  profile: StudentProfile,
  opportunity: Opportunity,
): CriterionResult | null {
  const text = `${opportunity.title} ${opportunity.eligibilityText}`;

  if (REMOTE_SIGNAL.test(text)) {
    return {
      id: "location",
      label: "Location",
      status: "MET",
      requirement: "Remote / online",
      profileValue: profile.location || null,
      explanation:
        "The source describes this opportunity as remote or online, so your location does not block it.",
      evidence: [],
    };
  }

  if (!LOCATION_RESTRICTION.test(text)) return null;

  const words = profile.location
    .trim()
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((word) => word.length > 2);
  const overlap = words.find((word) => text.toLowerCase().includes(word));

  return {
    id: "location",
    label: "Location",
    status: overlap ? "MET" : "UNKNOWN",
    requirement: "Location restricted",
    profileValue: profile.location || null,
    explanation: overlap
      ? `Your location overlaps with the location mentioned by the source (${overlap}).`
      : "The source states a location condition that could not be matched automatically. Treat this as unverified and check the official page.",
    evidence: [],
  };
}

/**
 * Transparent, rules-based eligibility check.
 *
 * Every produced criterion is MET, NOT_MET or UNKNOWN. UNKNOWN never counts
 * as verified eligibility: a result is only "eligible" when every checkable
 * criterion is MET and none are UNKNOWN.
 */
export function checkEligibility(
  profile: StudentProfile,
  opportunity: Opportunity,
): EligibilityResult {
  const notChecked: string[] = [];

  const education = checkEducation(profile, opportunity);
  if (!education) notChecked.push("Education level");
  // Skills are a relevance signal, not a universal eligibility requirement.
  // A broad skill mention on a page must never disqualify a student.
  const teamSize = checkTeamSize(profile, opportunity);
  if (!teamSize) notChecked.push("Team size");
  const graduationYear = checkGraduationYear(profile, opportunity);
  if (!graduationYear) notChecked.push("Graduation year");
  const additional = checkUnmodeledRequirements(opportunity);
  if (!additional) notChecked.push("Additional requirements");
  const location = checkLocation(profile, opportunity);
  if (!location) notChecked.push("Location");

  const criteria: CriterionResult[] = [
    education,
    teamSize,
    graduationYear,
    additional,
    location,
  ].filter((criterion): criterion is CriterionResult => criterion !== null);

  const metCount = criteria.filter((c) => c.status === "MET").length;
  const notMetCount = criteria.filter((c) => c.status === "NOT_MET").length;
  const unknownCount = criteria.filter((c) => c.status === "UNKNOWN").length;

  let verdict: EligibilityVerdict = "needs_review";
  if (notMetCount > 0) {
    verdict = "not_eligible";
  } else if (criteria.length > 0 && unknownCount === 0) {
    verdict = "eligible";
  }

  return {
    verdict,
    criteria,
    notChecked,
    relevanceScore: computeRelevanceScore(profile, opportunity),
    metCount,
    notMetCount,
    unknownCount,
    fullyVerified: criteria.length > 0 && unknownCount === 0 && notMetCount === 0,
  };
}

/** Separate, explainable relevance score (0-100). Not proof of eligibility. */
export function computeRelevanceScore(
  profile: StudentProfile,
  opportunity: Opportunity,
): number {
  const aliases: Record<string, string[]> = {
    "artificial intelligence": ["ai"],
    ai: ["artificial intelligence"],
    "machine learning": ["ml"],
    ml: ["machine learning"],
    "web development": ["web dev", "frontend", "back end", "backend"],
  };
  const equivalent = (left: string, right: string) =>
    left === right || (aliases[left] ?? []).includes(right) || (aliases[right] ?? []).includes(left);
  const skillText = opportunity.skills.map(normalize);
  const profileSkills = profile.skills.map(normalize);

  const skillScore =
    skillText.length === 0
      ? 0
      : (skillText.filter((s) => profileSkills.some((p) => equivalent(s, p))).length / skillText.length) *
        100;

  const haystack = `${opportunity.title} ${opportunity.eligibilityText} ${opportunity.educationRequirements.join(
    " ",
  )} ${opportunity.skills.join(" ")}`.toLowerCase();
  const interests = profile.interests.map(normalize).filter(Boolean);
  const interestMatches = (interest: string) => {
    const variants = [interest, ...(aliases[interest] ?? [])];
    return variants.some((variant) => {
      if (variant.length <= 2) {
        return variant === "ai" ? /\bai\b/i.test(haystack) : haystack.includes(variant);
      }
      return haystack.includes(variant);
    });
  };
  const interestScore =
    interests.length === 0
      ? 0
      : (interests.filter(interestMatches).length / interests.length) *
        100;

  if (skillText.length === 0 && interests.length === 0) return 0;

  const score =
    skillText.length === 0
      ? interestScore
      : interests.length === 0
        ? skillScore
        : skillScore * 0.55 + interestScore * 0.45;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function verdictLabel(verdict: EligibilityVerdict): string {
  switch (verdict) {
    case "eligible":
      return "Stated checks met";
    case "needs_review":
      return "Needs review";
    case "not_eligible":
      return "Likely not eligible";
  }
}

export function verdictTone(verdict: EligibilityVerdict): "good" | "warn" | "bad" {
  switch (verdict) {
    case "eligible":
      return "good";
    case "needs_review":
      return "warn";
    case "not_eligible":
      return "bad";
  }
}

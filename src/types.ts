export type View = "home" | "search" | "profile" | "saved";

export type OpportunityCategory =
  | "hackathon"
  | "scholarship"
  | "internship"
  | "fellowship";

export const OPPORTUNITY_CATEGORIES: OpportunityCategory[] = [
  "hackathon",
  "scholarship",
  "internship",
  "fellowship",
];

export type EducationLevel =
  | "high_school"
  | "undergraduate"
  | "graduate"
  | "phd"
  | "other";

export const EDUCATION_LEVELS: EducationLevel[] = [
  "high_school",
  "undergraduate",
  "graduate",
  "phd",
  "other",
];

export type TeamSize = "solo" | "small" | "large" | "any";

export interface StudentProfile {
  name: string;
  educationLevel: EducationLevel | "";
  interests: string[];
  skills: string[];
  location: string;
  teamSize: TeamSize;
}

export const EMPTY_PROFILE: StudentProfile = {
  name: "",
  educationLevel: "",
  interests: [],
  skills: [],
  location: "",
  teamSize: "any",
};

/** A single verifiable piece of evidence pulled from a retrieved source. */
export interface SourceEvidence {
  /** Public URL the fact was read from. */
  url: string;
  /** Page title when available. */
  title?: string;
  /** Short verbatim quote that supports the fact. */
  quote?: string;
}

export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  category: OpportunityCategory;
  officialUrl: string;
  /** ISO date string (YYYY-MM-DD) or null when the source did not state one. */
  deadline: string | null;
  eligibilityText: string;
  educationRequirements: string[];
  skills: string[];
  /** Human readable team-size requirement, or null when unknown. */
  teamSize: string | null;
  sourceEvidence: SourceEvidence[];
  /** ISO timestamp of when the record was retrieved. */
  retrievedAt: string;
}

export type CriterionStatus = "MET" | "NOT_MET" | "UNKNOWN";

export interface CriterionResult {
  id: string;
  label: string;
  status: CriterionStatus;
  /** What the opportunity requires, as supported by evidence. */
  requirement: string | null;
  /** What the student's profile reports. */
  profileValue: string | null;
  /** Why this verdict was reached, in plain language. */
  explanation: string;
  /** Sources backing the verdict (may be empty for UNKNOWN). */
  evidence: SourceEvidence[];
}

export type EligibilityVerdict = "eligible" | "needs_review" | "not_eligible";

export interface EligibilityResult {
  verdict: EligibilityVerdict;
  criteria: CriterionResult[];
  /**
   * Criteria the retrieved source never mentioned. These are not scored —
   * they are reported so it is clear what could not be checked and why.
   */
  notChecked: string[];
  /** 0-100 explainable relevance score (interest + skill overlap). */
  relevanceScore: number;
  /** Number of criteria that are MET. */
  metCount: number;
  /** Number of criteria that are NOT_MET. */
  notMetCount: number;
  /** Number of criteria that are UNKNOWN. */
  unknownCount: number;
  /** True only when every checkable criterion is MET and none are UNKNOWN. */
  fullyVerified: boolean;
}

export interface SearchRequest {
  query: string;
  category: OpportunityCategory;
  profile: StudentProfile;
  limit: number;
}

export interface SearchResponse {
  ok: true;
  opportunities: Opportunity[];
  /** Echo of the query that was executed. */
  query: string;
  /** When the search completed (ISO timestamp). */
  retrievedAt: string;
  /** True when results came from the labelled sample/demo dataset. */
  demo: boolean;
}

export interface ApiError {
  ok: false;
  error: string;
  message: string;
  code: string;
  status: number;
}

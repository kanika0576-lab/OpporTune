import type {
  Opportunity,
  OpportunityCategory,
  SourceEvidence,
} from "../../src/types";

export interface TinyFishSearchResult {
  position?: number;
  site_name?: string;
  title?: string;
  snippet?: string;
  url?: string;
  date?: string;
}

export interface TinyFishFetchResult {
  url: string;
  final_url?: string | null;
  title?: string | null;
  description?: string | null;
  text?: string | null;
  published_date?: string | null;
}

export interface NormalizationInput {
  category: OpportunityCategory;
  search: TinyFishSearchResult;
  fetch?: TinyFishFetchResult;
  retrievedAt: string;
}

interface Fact {
  value: string;
  quote: string;
}

const MONTHS: Record<string, string> = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12",
};

const MONTH_ALT = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const DEADLINE_KEYWORDS =
  /\b(?:deadline|apply by|applications? (?:close|close on|end|due)|closes?|last date|due date|submission(?:s)? (?:close|due)|ends? on|register by|registration (?:close|deadline)|apply before)\b/i;

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function sentenceAround(sentences: string[], index: number): string {
  let offset = 0;
  for (const sentence of sentences) {
    const start = offset;
    const end = start + sentence.length;
    if (index >= start && index <= end) return sentence;
    offset = end + 1;
  }
  return sentences[0] ?? "";
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

function normalizeMonthDate(
  monthRaw: string,
  dayRaw: string,
  yearRaw: string,
): string | null {
  const month = MONTHS[monthRaw.toLowerCase()];
  const day = parseInt(dayRaw, 10);
  const year = parseInt(yearRaw, 10);
  if (!month || !day || day < 1 || day > 31 || !year) return null;
  const parsed = new Date(Date.UTC(year, Number(month) - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== day) return null;
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
}

/** Extracts a deadline only when a date sits near an explicit deadline keyword. */
export function extractDeadline(text: string): Fact | null {
  const sentences = splitSentences(text);
  const patterns: RegExp[] = [
    new RegExp(`\\b(20\\d{2})-(\\d{2})-(\\d{2})\\b`, "g"),
    new RegExp(
      `\\b(${MONTH_ALT})\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(20\\d{2})\\b`,
      "gi",
    ),
    new RegExp(
      `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_ALT}),?\\s+(20\\d{2})\\b`,
      "gi",
    ),
    new RegExp(`\\b(\\d{1,2})[\\/\\.](\\d{1,2})[\\/\\.](20\\d{2})\\b`, "g"),
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const index = match.index;
      const windowStart = Math.max(0, index - 90);
      const windowEnd = Math.min(text.length, index + match[0].length + 60);
      const window = text.slice(windowStart, windowEnd);
      if (!DEADLINE_KEYWORDS.test(window)) continue;

      let value: string | null = null;
      if (match.length === 4 && /^\d{4}$/.test(match[1])) {
        const parsed = new Date(`${match[0]}T00:00:00.000Z`);
        value = Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== match[0]
          ? null
          : match[0];
      } else if (/^\d{4}$/.test(match[3])) {
        value = normalizeMonthDate(match[1], match[2], match[3]);
        if (!value) {
          value = normalizeMonthDate(match[2], match[1], match[3]);
        }
      }

      if (value) {
        return { value, quote: truncate(sentenceAround(sentences, index), 320) };
      }
    }
  }
  return null;
}

const EDUCATION_PATTERNS: RegExp[] = [
  /\bhigh school(?:ers)?\b/gi,
  /\bundergraduate(?:s)?\b|\bbachelor'?s?\b/gi,
  /\bgraduate(?:s)?\b|\bmaster'?s?\b/gi,
  /\bph\.?\s?d\.?\b|\bdoctoral\b|\bdoctorate\b/gi,
  /\bcurrently enrolled\b|\benrolled\b/gi,
  /\bcollege student\b|\buniversity student\b/gi,
];
const REQUIREMENT_CONTEXT = /\b(?:eligib\w*|who can apply|open to|applicant|candidate|must be|requirement|currently enrolled|student|batch|graduat\w*|pass.?out)\b/i;

/** Education requirement phrases, each backed by a supporting quote. */
export function extractEducationRequirements(text: string): Fact[] {
  const sentences = splitSentences(text);
  const facts: Fact[] = [];
  const seen = new Set<string>();

  for (const pattern of EDUCATION_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const sentence = sentenceAround(sentences, match.index);
      if (!REQUIREMENT_CONTEXT.test(sentence)) continue;
      const keyword = match[0].toLowerCase();
      if (seen.has(keyword)) continue;
      seen.add(keyword);
      const start = Math.max(0, match.index - 40);
      const end = Math.min(text.length, match.index + match[0].length + 40);
      const phrase = truncate(text.slice(start, end), 120);
      facts.push({
        value: phrase,
        quote: truncate(sentenceAround(sentences, match.index), 320),
      });
    }
  }
  return facts;
}

const SKILL_VOCABULARY: string[] = [
  "python",
  "javascript",
  "typescript",
  "java",
  "c++",
  "c#",
  "react",
  "node.js",
  "html",
  "css",
  "sql",
  "git",
  "figma",
  "machine learning",
  "artificial intelligence",
  "data analysis",
  "excel",
  "communication",
  "leadership",
  "writing",
  "research",
  "public speaking",
  "aws",
  "docker",
  "kubernetes",
  "ui/ux",
  "product management",
  "teamwork",
  "problem solving",
  "r",
  "swift",
  "kotlin",
  "flutter",
  "mongodb",
  "postgresql",
];

const SKILL_CONTEXT = /\b(?:skills?|proficien|experience|knowledge|familiar|expertise|bring your)\b/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Skills explicitly named in the retrieved content. */
export function extractSkills(text: string): Fact[] {
  const sentences = splitSentences(text);
  const facts: Fact[] = [];
  for (const skill of SKILL_VOCABULARY) {
    const pattern = new RegExp(
      `(?<![A-Za-z0-9])${escapeRegExp(skill)}(?![A-Za-z0-9])`,
      "gi",
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const sentence = sentenceAround(sentences, match.index);
      if (!SKILL_CONTEXT.test(sentence)) continue;
      facts.push({
        value: skill,
        quote: truncate(sentence, 320),
      });
      break;
    }
  }
  return facts;
}

/** Graduation batches are extracted only from sentences that explicitly describe eligibility. */
export function extractGraduationYears(text: string): Fact[] {
  const facts: Fact[] = [];
  for (const sentence of splitSentences(text)) {
    if (!/\b(?:eligible|eligibility|batch(?:es)?|graduat(?:e|ing|ion)|pass.?out)\b/i.test(sentence)) continue;
    const years = [...sentence.matchAll(/\b20\d{2}\b/g)].map((match) => Number(match[0]));
    if (!years.length) continue;
    facts.push({ value: [...new Set(years)].join(", "), quote: truncate(sentence, 320) });
  }
  return facts;
}

const TEAM_PHRASE_PATTERNS: RegExp[] = [
  /\bteams?\s+of\s+(?:up to\s+)?(?<![\d,.])\d{1,3}(?:\s*(?:-|–|to)\s*\d{1,3})?/i,
  /(?<![\d,.])\b\d{1,2}\s*(?:-|–|to)\s*\d{1,2}\s*(?:person|people|member)s?\b/i,
  /(?<![\d,.])\b\d{1,2}\+?\s*(?:person|people|member|participant)s?\b/i,
  /\bindividuals?\b|\bsolo\b/i,
];

function normalizeTeamLabel(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (/individual|solo/i.test(cleaned)) return "Individual";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/** Team-size requirement, only when the page states one. */
export function extractTeamSize(text: string): Fact | null {
  const sentences = splitSentences(text);
  for (const pattern of TEAM_PHRASE_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (!match) continue;
    return {
      value: normalizeTeamLabel(match[0]),
      quote: truncate(sentenceAround(sentences, match.index), 320),
    };
  }
  return null;
}

const ELIGIBILITY_HINT =
  /\beligib|requirement|who can apply|open to|applicants? must|candidates? must|must be enrolled/i;

/** A short evidence-backed description of who the opportunity is for. */
export function extractEligibilityText(text: string): Fact | null {
  const sentences = splitSentences(text);
  const joined = sentences.join(" ");
  for (const sentence of sentences) {
    if (ELIGIBILITY_HINT.test(sentence)) {
      return { value: truncate(sentence, 320), quote: sentence };
    }
  }
  const fallback = truncate(joined, 320);
  return fallback ? { value: fallback, quote: fallback } : null;
}

function hostnameOf(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "Unknown organizer";
  } catch {
    return "Unknown organizer";
  }
}

function makeId(url: string): string {
  let hash = 5381;
  for (let i = 0; i < url.length; i += 1) {
    hash = ((hash << 5) + hash + url.charCodeAt(i)) | 0;
  }
  return `opp-${Math.abs(hash).toString(36)}`;
}

/**
 * Builds a normalized Opportunity from retrieved content. Only facts that are
 * actually present in the source text are emitted; anything missing stays
 * null/empty. Never invents deadlines, links or eligibility claims.
 */
export function normalizeOpportunity(
  input: NormalizationInput,
): Opportunity | null {
  const { search, fetch, category, retrievedAt } = input;
  const url = fetch?.final_url || search.url;
  if (!url) return null;

  const title = (fetch?.title || search.title || "").trim();
  if (!title) return null;

  const body = (fetch?.text || "").trim();
  const searchable = body || (search.snippet || "").trim();
  const deadlineFact = searchable ? extractDeadline(searchable) : null;
  const educationFacts = searchable ? extractEducationRequirements(searchable) : [];
  const graduationFacts = searchable ? extractGraduationYears(searchable) : [];
  const skillFacts = searchable ? extractSkills(searchable) : [];
  const teamFact = searchable ? extractTeamSize(searchable) : null;
  const eligibilityFact = searchable ? extractEligibilityText(searchable) : null;

  const evidence: SourceEvidence[] = [];
  const seen = new Set<string>();
  const pushEvidence = (fact?: Fact | null) => {
    if (!fact) return;
    const key = `${url}::${fact.quote}`;
    if (seen.has(key)) return;
    seen.add(key);
    evidence.push({ url, title: title || undefined, quote: fact.quote });
  };

  pushEvidence(deadlineFact);
  educationFacts.forEach(pushEvidence);
  graduationFacts.forEach(pushEvidence);
  skillFacts.forEach(pushEvidence);
  pushEvidence(teamFact);
  pushEvidence(eligibilityFact);

  return {
    id: makeId(url),
    title,
    organizer: search.site_name || hostnameOf(url),
    category,
    officialUrl: url,
    deadline: deadlineFact?.value ?? null,
    eligibilityText: eligibilityFact?.value ?? "",
    educationRequirements: educationFacts.map((f) => f.value),
    graduationYears: [...new Set(graduationFacts.flatMap((fact) => fact.value.split(", ").map(Number)))],
    skills: skillFacts.map((f) => f.value),
    teamSize: teamFact?.value ?? null,
    sourceEvidence: evidence,
    retrievedAt,
  };
}

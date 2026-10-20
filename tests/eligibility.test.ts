import { describe, expect, it } from "vitest";
import {
  checkEligibility,
  computeRelevanceScore,
  educationLevelsForRequirement,
} from "../src/lib/eligibility";
import { parseTeamSize } from "../src/lib/teamSize";
import type { Opportunity, StudentProfile } from "../src/types";

const SOURCE_URL = "https://example.org/ai-build";

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp-1",
    title: "Global AI Build Challenge 2026",
    organizer: "example.org",
    category: "hackathon",
    officialUrl: SOURCE_URL,
    deadline: "2027-03-15",
    eligibilityText: "Participants must be enrolled at a university.",
    educationRequirements: ["undergraduate students enrolled at a university"],
    skills: ["python", "react"],
    teamSize: "Team of 2-4",
    sourceEvidence: [
      {
        url: SOURCE_URL,
        title: "Global AI Build Challenge 2026",
        quote:
          "Open to undergraduate students. Participants must be enrolled at a university. Teams of 2-4 members. Skills: Python, React.",
      },
    ],
    retrievedAt: "2026-01-05T10:00:00.000Z",
    ...overrides,
  };
}

const matchingProfile: StudentProfile = {
  name: "Kanika",
  educationLevel: "undergraduate",
  interests: ["artificial intelligence", "web development"],
  skills: ["python", "javascript", "react"],
  location: "Delhi, India",
  teamSize: "small",
};

describe("education requirement matching", () => {
  it("maps requirement phrases to the levels they allow", () => {
    expect(educationLevelsForRequirement("undergraduate students")).toContain(
      "undergraduate",
    );
    expect(educationLevelsForRequirement("high school seniors")).toContain(
      "high_school",
    );
    expect(educationLevelsForRequirement("phd candidates")).toContain("phd");
    expect(educationLevelsForRequirement("master's students")).toContain(
      "graduate",
    );
  });

  it("returns no levels for an unrelated phrase", () => {
    expect(educationLevelsForRequirement("apply before Friday")).toEqual([]);
  });
});

describe("team size parsing", () => {
  it("parses common team-size statements", () => {
    expect(parseTeamSize("Team of 2-4")).toBe("small");
    expect(parseTeamSize("Team of 4")).toBe("small");
    expect(parseTeamSize("Teams of up to 6 members")).toBe("large");
    expect(parseTeamSize("5+ members")).toBe("large");
    expect(parseTeamSize("Individual")).toBe("solo");
    expect(parseTeamSize("Any size")).toBeNull();
  });
});

describe("checkEligibility", () => {
  it("marks every checkable criterion MET when the profile satisfies them", () => {
    const result = checkEligibility(matchingProfile, makeOpportunity());

    expect(result.criteria.every((c) => c.status === "MET")).toBe(true);
    expect(result.metCount).toBe(result.criteria.length);
    expect(result.notMetCount).toBe(0);
    expect(result.unknownCount).toBe(0);
    expect(result.verdict).toBe("eligible");
    expect(result.fullyVerified).toBe(true);
  });

  it("never counts UNKNOWN as verified eligibility", () => {
    const opportunity = makeOpportunity({
      teamSize: "Team of 2-4",
    });
    const profile: StudentProfile = {
      ...matchingProfile,
      educationLevel: "",
      teamSize: "any",
    };

    const result = checkEligibility(profile, opportunity);

    expect(result.unknownCount).toBeGreaterThan(0);
    expect(result.fullyVerified).toBe(false);
    expect(result.verdict).toBe("needs_review");
    expect(result.metCount + result.notMetCount).toBeLessThan(
      result.criteria.length,
    );
  });

  it("marks an unmet education requirement NOT_MET", () => {
    const profile: StudentProfile = {
      ...matchingProfile,
      educationLevel: "high_school",
    };

    const result = checkEligibility(profile, makeOpportunity());

    const education = result.criteria.find((c) => c.id === "education");
    expect(education?.status).toBe("NOT_MET");
    expect(result.verdict).toBe("not_eligible");
    expect(result.fullyVerified).toBe(false);
  });

  it("does not treat missing skill overlap as an eligibility failure", () => {
    const profile: StudentProfile = {
      ...matchingProfile,
      skills: ["cooking"],
    };

    const result = checkEligibility(profile, makeOpportunity());

    expect(result.criteria.find((c) => c.id === "skills")).toBeUndefined();
    expect(result.verdict).toBe("eligible");
  });

  it("keeps skills as a relevance signal when the student has not listed any", () => {
    const profile: StudentProfile = { ...matchingProfile, skills: [] };

    const result = checkEligibility(profile, makeOpportunity());

    const skills = result.criteria.find((c) => c.id === "skills");
    expect(skills).toBeUndefined();
    expect(result.fullyVerified).toBe(true);
  });

  it("marks team size NOT_MET when it does not match", () => {
    const profile: StudentProfile = { ...matchingProfile, teamSize: "solo" };

    const result = checkEligibility(profile, makeOpportunity());

    const team = result.criteria.find((c) => c.id === "teamSize");
    expect(team?.status).toBe("NOT_MET");
  });

  it("checks a graduation batch when the opportunity states eligible years", () => {
    const opportunity = makeOpportunity({ graduationYears: [2026, 2027] });
    const matched = checkEligibility({ ...matchingProfile, graduationYear: "2027" }, opportunity);
    const unmatched = checkEligibility({ ...matchingProfile, graduationYear: "2029" }, opportunity);
    expect(matched.criteria.find((c) => c.id === "graduation-year")?.status).toBe("MET");
    expect(unmatched.criteria.find((c) => c.id === "graduation-year")?.status).toBe("NOT_MET");
  });

  it("omits criteria the source never mentioned and reports them as not checked", () => {
    const bare = makeOpportunity({
      educationRequirements: [],
      skills: [],
      teamSize: null,
      eligibilityText: "Come and build something great.",
    });

    const result = checkEligibility(matchingProfile, bare);

    expect(result.criteria).toHaveLength(0);
    expect(result.notChecked).toContain("Education level");
    expect(result.notChecked).toContain("Team size");
    expect(result.verdict).toBe("needs_review");
    expect(result.fullyVerified).toBe(false);
  });

  it("treats a remote-only opportunity as location MET", () => {
    const remote = makeOpportunity({
      title: "Online AI Build Challenge 2026",
      eligibilityText: "Fully online hackathon for undergraduate students.",
    });

    const result = checkEligibility(matchingProfile, remote);

    const location = result.criteria.find((c) => c.id === "location");
    expect(location?.status).toBe("MET");
  });

  it("never rejects on location alone — an unmatched restriction stays UNKNOWN", () => {
    const restricted = makeOpportunity({
      eligibilityText:
        "Open to applicants in Kerala. Participants must be enrolled at a university.",
    });

    const result = checkEligibility(matchingProfile, restricted);

    const location = result.criteria.find((c) => c.id === "location");
    expect(location?.status).toBe("UNKNOWN");
    expect(result.notMetCount).toBe(0);
  });

  it("attaches source evidence to criteria that have supporting quotes", () => {
    const result = checkEligibility(matchingProfile, makeOpportunity());

    const education = result.criteria.find((c) => c.id === "education");
    expect(education?.evidence.length).toBeGreaterThan(0);
    expect(education?.evidence[0].url).toBe(SOURCE_URL);
  });

  it("produces a stable verdict shape for an empty opportunity", () => {
    const result = checkEligibility(
      { ...matchingProfile, skills: [], educationLevel: "" },
      makeOpportunity({ skills: [], educationRequirements: [], teamSize: null }),
    );

    expect(result.verdict).toBe("needs_review");
    expect(result.relevanceScore).toBeGreaterThanOrEqual(0);
    expect(result.relevanceScore).toBeLessThanOrEqual(100);
  });
});

describe("relevance score", () => {
  it("is zero when the student has no skills or interests", () => {
    const score = computeRelevanceScore(
      { ...matchingProfile, skills: [], interests: [] },
      makeOpportunity(),
    );
    expect(score).toBe(0);
  });

  it("rises with interest and skill overlap", () => {
    const high = computeRelevanceScore(matchingProfile, makeOpportunity());
    const low = computeRelevanceScore(
      { ...matchingProfile, skills: ["cooking"], interests: ["gardening"] },
      makeOpportunity(),
    );
    expect(high).toBeGreaterThan(low);
    expect(high).toBeLessThanOrEqual(100);
  });

  it("matches common AI wording equivalents", () => {
    const score = computeRelevanceScore(
      { ...matchingProfile, interests: ["artificial intelligence"], skills: [] },
      makeOpportunity({ title: "AI student challenge", skills: [] }),
    );
    expect(score).toBe(100);
  });

  it("is independent of eligibility — a perfect overlap with an unmet rule still scores", () => {
    const profile: StudentProfile = {
      ...matchingProfile,
      educationLevel: "high_school",
    };
    const opportunity = makeOpportunity();

    const eligibility = checkEligibility(profile, opportunity);
    const relevance = computeRelevanceScore(profile, opportunity);

    expect(eligibility.verdict).toBe("not_eligible");
    expect(relevance).toBeGreaterThan(0);
  });
});

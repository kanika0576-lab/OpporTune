import { describe, expect, it } from "vitest";
import {
  extractDeadline,
  extractEducationRequirements,
  extractGraduationYears,
  extractEligibilityText,
  extractSkills,
  extractTeamSize,
  normalizeOpportunity,
} from "../api/lib/normalize";

const RETRIEVED_AT = "2026-01-05T10:00:00.000Z";

describe("extractDeadline", () => {
  it("extracts an ISO date next to a deadline keyword", () => {
    const fact = extractDeadline(
      "Applications close on 2026-03-15. Teams of 2-4 members are allowed.",
    );
    expect(fact?.value).toBe("2026-03-15");
    expect(fact?.quote).toContain("Applications close");
  });

  it("extracts a written date next to a deadline keyword", () => {
    const fact = extractDeadline(
      "The last date to apply is March 15, 2026 for all teams.",
    );
    expect(fact?.value).toBe("2026-03-15");
  });

  it("extracts a day-first written date", () => {
    const fact = extractDeadline("Deadline: 28 February 2026 at midnight.");
    expect(fact?.value).toBe("2026-02-28");
  });

  it("returns null when a date appears without any deadline keyword", () => {
    const fact = extractDeadline(
      "The event is being held on 2026-03-15 at the main campus auditorium.",
    );
    expect(fact).toBeNull();
  });

  it("returns null when no date is present at all", () => {
    expect(extractDeadline("Applications are open now.")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(extractDeadline("")).toBeNull();
  });
});

describe("extractEducationRequirements", () => {
  it("finds education phrases and backs them with a quote", () => {
    const facts = extractEducationRequirements(
      "Open to undergraduate and graduate students. Teams of 2-4 members.",
    );
    expect(facts.length).toBeGreaterThan(0);
    expect(facts[0].quote).toContain("undergraduate");
  });

  it("returns an empty list when the page says nothing about education", () => {
    expect(extractEducationRequirements("Build fast. Ship fast.")).toEqual([]);
  });
});

describe("extractSkills", () => {
  it("finds skills mentioned on the page", () => {
    const facts = extractSkills("Bring your Python and React skills to the hackathon.");
    const values = facts.map((f) => f.value);
    expect(values).toContain("python");
    expect(values).toContain("react");
  });

  it("returns an empty list when no known skill is named", () => {
    expect(extractSkills("Bring your ideas and a notebook.")).toEqual([]);
  });

  it("does not treat unrelated page navigation as a skill requirement", () => {
    expect(extractSkills("HTML | CSS | Home | About | Python tutorials")).toEqual([]);
  });
});

describe("extractGraduationYears", () => {
  it("extracts batch years stated as eligibility", () => {
    expect(extractGraduationYears("Eligible batches: 2026, 2027 and 2028 graduates.")[0]?.value).toBe("2026, 2027, 2028");
  });
  it("ignores years that are not tied to eligibility or batch requirements", () => {
    expect(extractGraduationYears("The event takes place in 2027.")).toEqual([]);
  });
});

describe("extractTeamSize", () => {
  it("extracts a team range using the source's own wording", () => {
    const fact = extractTeamSize("Entries may be made by teams of 2-4 members.");
    expect(fact?.value).toBe("Teams of 2-4");
    expect(fact?.quote).toContain("teams of 2-4");
  });

  it("extracts a maximum team size", () => {
    const fact = extractTeamSize("Teams of up to 6 members may apply.");
    expect(fact?.value).toBe("Teams of up to 6");
  });

  it("extracts an individual-only rule", () => {
    const fact = extractTeamSize("This is an individual competition only.");
    expect(fact?.value).toBe("Individual");
  });

  it("returns null when no team rule is stated", () => {
    expect(extractTeamSize("Come and build something great.")).toBeNull();
  });
});

describe("extractEligibilityText", () => {
  it("prefers a sentence that mentions eligibility", () => {
    const fact = extractEligibilityText(
      "Build fast. Eligibility: open to undergraduates only. See you there.",
    );
    expect(fact?.value).toContain("Eligibility");
  });

  it("falls back to the opening content when nothing matches", () => {
    const fact = extractEligibilityText("A weekend of building things together.");
    expect(fact?.value).toBe("A weekend of building things together.");
  });
});

describe("normalizeOpportunity", () => {
  it("builds a fully populated record from retrieved content", () => {
    const opportunity = normalizeOpportunity({
      category: "hackathon",
      retrievedAt: RETRIEVED_AT,
      search: {
        title: "Global AI Build Challenge",
        url: "https://example.org/ai-build",
        snippet: "Annual student hackathon",
        site_name: "example.org",
      },
      fetch: {
        url: "https://example.org/ai-build",
        final_url: "https://example.org/ai-build",
        title: "Global AI Build Challenge",
        text: "Open to undergraduate students. Applications close on 2026-03-15. Teams of 2-4 members. Bring Python and React skills.",
      },
    });

    expect(opportunity).not.toBeNull();
    expect(opportunity?.title).toBe("Global AI Build Challenge");
    expect(opportunity?.category).toBe("hackathon");
    expect(opportunity?.officialUrl).toBe("https://example.org/ai-build");
    expect(opportunity?.organizer).toBe("example.org");
    expect(opportunity?.deadline).toBe("2026-03-15");
    expect(opportunity?.teamSize).toBe("Teams of 2-4");
    expect(opportunity?.skills).toContain("python");
    expect(opportunity?.educationRequirements.length).toBeGreaterThan(0);
    expect(opportunity?.graduationYears).toEqual([]);
    expect(opportunity?.sourceEvidence.length).toBeGreaterThan(0);
    expect(opportunity?.retrievedAt).toBe(RETRIEVED_AT);
    expect(opportunity?.id).toMatch(/^opp-/);
  });

  it("leaves missing facts unknown instead of inventing them", () => {
    const opportunity = normalizeOpportunity({
      category: "scholarship",
      retrievedAt: RETRIEVED_AT,
      search: {
        title: "Open Merit Scholarship",
        url: "https://example.org/scholarship",
        snippet: "Financial aid for students",
      },
      fetch: {
        url: "https://example.org/scholarship",
        final_url: "https://example.org/scholarship",
        title: "Open Merit Scholarship",
        text: "Financial support for students who need it.",
      },
    });

    expect(opportunity?.deadline).toBeNull();
    expect(opportunity?.teamSize).toBeNull();
    expect(opportunity?.skills).toEqual([]);
    expect(opportunity?.educationRequirements).toEqual([]);
  });

  it("falls back to the search snippet when the page could not be fetched", () => {
    const opportunity = normalizeOpportunity({
      category: "internship",
      retrievedAt: RETRIEVED_AT,
      search: {
        title: "Backend Internship",
        url: "https://example.org/internship",
        snippet: "Apply by 2026-05-01 for our backend internship.",
      },
    });

    expect(opportunity?.deadline).toBe("2026-05-01");
    expect(opportunity?.officialUrl).toBe("https://example.org/internship");
  });

  it("includes only explicitly stated eligible graduation years", () => {
    const opportunity = normalizeOpportunity({
      category: "internship",
      retrievedAt: RETRIEVED_AT,
      search: { title: "Student internship", url: "https://example.org/intern" },
      fetch: {
        url: "https://example.org/intern",
        title: "Student internship",
        text: "Eligible batches: 2026, 2027 and 2028 graduates. Apply by 2026-12-01.",
      },
    });
    expect(opportunity?.graduationYears).toEqual([2026, 2027, 2028]);
  });

  it("returns null when there is no usable title or url", () => {
    const noTitle = normalizeOpportunity({
      category: "fellowship",
      retrievedAt: RETRIEVED_AT,
      search: { url: "https://example.org/x" },
    });
    expect(noTitle).toBeNull();

    const noUrl = normalizeOpportunity({
      category: "fellowship",
      retrievedAt: RETRIEVED_AT,
      search: { title: "Something" },
    });
    expect(noUrl).toBeNull();
  });

  it("derives the organizer from the url when the site name is missing", () => {
    const opportunity = normalizeOpportunity({
      category: "hackathon",
      retrievedAt: RETRIEVED_AT,
      search: {
        title: "Regional Hackathon",
        url: "https://www.hack.example.edu/regional",
      },
    });

    expect(opportunity?.organizer).toBe("hack.example.edu");
  });
});

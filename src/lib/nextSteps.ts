import type { EligibilityResult, Opportunity } from "../types";
import { daysUntil, formatDeadline } from "./format";

export interface NextStep {
  id: string;
  label: string;
  detail: string;
  kind: "urgent" | "action" | "verify" | "info";
}

/**
 * Actionable next steps derived only from retrieved facts and the rules
 * engine. Nothing here is invented — every step points back to a fact.
 */
export function buildNextSteps(
  opportunity: Opportunity,
  eligibility: EligibilityResult,
): NextStep[] {
  const steps: NextStep[] = [];
  const remaining = daysUntil(opportunity.deadline);

  if (opportunity.deadline && remaining !== null) {
    if (remaining < 0) {
      steps.push({
        id: "deadline-passed",
        kind: "info",
        label: "This cycle's date has passed",
        detail: `The source states a deadline of ${formatDeadline(
          opportunity.deadline,
        )}, which is in the past. Look for the next edition on the official page.`,
      });
    } else if (remaining <= 14) {
      steps.push({
        id: "deadline-soon",
        kind: "urgent",
        label: `Deadline in ${remaining} day${remaining === 1 ? "" : "s"}`,
        detail: `The source states a deadline of ${formatDeadline(
          opportunity.deadline,
        )}. Prepare your application now and verify the date on the official page.`,
      });
    } else {
      steps.push({
        id: "deadline",
        kind: "action",
        label: `Deadline: ${formatDeadline(opportunity.deadline)}`,
        detail: `The source states a deadline of ${formatDeadline(
          opportunity.deadline,
        )} (about ${remaining} days away). Work backwards from that date.`,
      });
    }
  } else {
    steps.push({
      id: "deadline-unknown",
      kind: "verify",
      label: "No deadline found in the retrieved content",
      detail:
        "Open the official page to confirm the application deadline. OpporTune does not guess dates that the source did not state.",
    });
  }

  if (eligibility.notMetCount > 0) {
    const failing = eligibility.criteria.filter((c) => c.status === "NOT_MET");
    steps.push({
      id: "not-met",
      kind: "urgent",
      label: "A stated requirement is not met by your profile",
      detail: `Check ${failing
        .map((c) => c.label)
        .join(", ")} on the official page. You can update your profile if the source is wrong, but do not apply claiming eligibility you do not have.`,
    });
  }

  if (eligibility.unknownCount > 0) {
    const unknown = eligibility.criteria.filter((c) => c.status === "UNKNOWN");
    steps.push({
      id: "unknown",
      kind: "verify",
      label: `${eligibility.unknownCount} check${eligibility.unknownCount === 1 ? "" : "s"} could not be verified`,
      detail: `Unverified: ${unknown
        .map((c) => c.label)
        .join(", ")}. Read the source page and complete your profile so these can be checked.`,
    });
  }

  if (opportunity.teamSize) {
    steps.push({
      id: "team",
      kind: "action",
      label: `Team requirement: ${opportunity.teamSize}`,
      detail:
        "Confirm whether you need to find teammates and check the registration form for team rules.",
    });
  }

  if (opportunity.educationRequirements.length > 0) {
    steps.push({
      id: "education",
      kind: "verify",
      label: "Confirm your enrolment status",
      detail: `The source mentions: ${opportunity.educationRequirements.join(
        "; ",
      )}. Have proof of your current level ready.`,
    });
  }

  steps.push({
    id: "verify",
    kind: "verify",
    label: "Verify everything on the official page",
    detail:
      "OpporTune summarises retrieved pages. Requirements and deadlines change — the organiser's own page is the source of truth.",
  });

  return steps;
}

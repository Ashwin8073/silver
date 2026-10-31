export interface LaunchEvidence {
  active_plans: number;
  current_prices: number;
  enabled_integrations: number;
  verified_launch_checks: number;
  unresolved_launch_checks: number;
}

export function evaluateLaunchEligibility(
  evidence: LaunchEvidence
) {
  const blockers: string[] = [];

  const validCount = (value: number): boolean =>
    Number.isSafeInteger(value) && value >= 0;

  const counts = Object.values(evidence);

  if (!counts.every(validCount)) {
    blockers.push("INVALID_LAUNCH_EVIDENCE");
  } else {
    if (evidence.active_plans < 1) {
      blockers.push("NO_ACTIVE_PLAN");
    }

    if (evidence.current_prices < 1) {
      blockers.push("NO_CURRENT_PRICE");
    }

    if (evidence.enabled_integrations < 1) {
      blockers.push("NO_ENABLED_INTEGRATION");
    }

    if (evidence.verified_launch_checks < 1) {
      blockers.push("NO_VERIFIED_LAUNCH_CHECK");
    }

    if (evidence.unresolved_launch_checks > 0) {
      blockers.push("UNRESOLVED_LAUNCH_CHECKS");
    }
  }

  // These requirements cannot be established from counts alone.
  blockers.push("MANDATORY_CHECKLIST_NOT_VALIDATED");
  blockers.push("SUPER_ADMIN_APPROVAL_NOT_VERIFIED");

  return {
    status: "BLOCKED" as const,
    eligible: false,
    activation_enabled: false,
    blockers,
    message:
      "Evidence assessment only. Launch approval and activation are disabled."
  };
}

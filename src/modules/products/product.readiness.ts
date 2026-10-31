export interface LaunchCounts {
  plans: number;
  prices: number;
  integrations: number;
  launch_checks: number;
  trial_policies: number;
}

export type ReadinessStatus =
  | "MISSING_CONFIGURATION"
  | "REVIEW_REQUIRED";

export function evaluateProductReadiness(
  counts: LaunchCounts
) {
  const requirements = [
    {
      code: "PLANS",
      configured: counts.plans > 0,
      required: true
    },
    {
      code: "PRICING",
      configured: counts.prices > 0,
      required: true
    },
    {
      code: "INTEGRATIONS",
      configured: counts.integrations > 0,
      required: true
    },
    {
      code: "LAUNCH_CHECKLIST",
      configured: counts.launch_checks > 0,
      required: true
    },
    {
      code: "TRIAL_POLICY",
      configured: counts.trial_policies > 0,
      required: false
    }
  ];

  const missing = requirements
    .filter(item => item.required && !item.configured)
    .map(item => item.code);

  const status: ReadinessStatus =
    missing.length > 0
      ? "MISSING_CONFIGURATION"
      : "REVIEW_REQUIRED";

  return {
    status,
    activation_enabled: false,
    missing_requirements: missing,
    requirements: requirements.map(item => ({
      code: item.code,
      required: item.required,
      status: item.configured
        ? "PRESENT_UNVERIFIED"
        : "MISSING"
    })),
    message:
      "Configuration presence only. Validity and approvals are not yet verified."
  };
}

import {
  MANDATORY_LAUNCH_CHECKS
} from "./product.launch.checklist.js";

import type {
  LaunchConfigurationSnapshot
} from "./product.launch.snapshot.js";

export interface ConfigurationAssessment {
  configuration_checks_passed: boolean;
  approval_eligible: false;
  activation_enabled: false;
  blockers: string[];
}

function validDate(value: string): number | null {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3,6}Z$/.test(value)
  ) {
    return null;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}

function validHttpsUrl(value: string | null): boolean {
  if (value === null) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function assessLaunchConfiguration(
  snapshot: LaunchConfigurationSnapshot,
  now: Date
): ConfigurationAssessment {
  const blockers: string[] = [];

  if (
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime())
  ) {
    return {
      configuration_checks_passed: false,
      approval_eligible: false,
      activation_enabled: false,
      blockers: ["INVALID_ASSESSMENT_TIME"]
    };
  }

  const product = snapshot.product;

  if (
    product.status !== "DRAFT" ||
    !/^[A-Z][A-Z0-9_]{1,39}$/.test(product.product_code) ||
    !product.product_name.trim() ||
    !["API", "MANUAL"].includes(product.provisioning_mode) ||
    !validHttpsUrl(product.application_url) ||
    !validHttpsUrl(product.onboarding_url)
  ) {
    blockers.push("INVALID_PRODUCT_CONFIGURATION");
  }

  const activePlans = snapshot.plans.filter(
    plan => plan.status === "ACTIVE"
  );

  if (activePlans.length === 0) {
    blockers.push("NO_ACTIVE_PLAN");
  }

  const currentPrice = activePlans.some(plan =>
    plan.prices.some(price => {
      const from = validDate(price.valid_from);

      const until = price.valid_until === null
        ? null
        : validDate(price.valid_until);

      return (
        Number.isSafeInteger(price.amount_minor) &&
        price.amount_minor >= 0 &&
        Number.isSafeInteger(price.version_no) &&
        price.version_no > 0 &&
        price.currency.length === 3 &&
        price.billing_interval.length > 0 &&
        from !== null &&
        from <= now.getTime() &&
        (
          price.valid_until === null ||
          (
            until !== null &&
            until > now.getTime()
          )
        )
      );
    })
  );

  if (!currentPrice) {
    blockers.push("NO_VALID_CURRENT_PRICE");
  }

  const enabledIntegrations = snapshot.integrations.filter(
    integration => (
      integration.status === "ENABLED" ||
      integration.status === "ACTIVE"
    ) &&
    integration.integration_code.trim().length > 0 &&
    integration.api_audience.trim().length > 0
  );

  if (enabledIntegrations.length === 0) {
    blockers.push("NO_ENABLED_INTEGRATION");
  }

  for (const code of MANDATORY_LAUNCH_CHECKS) {
    const matches = snapshot.launch_checks.filter(
      check => check.check_code === code
    );

    if (matches.length !== 1) {
      blockers.push("MANDATORY_CHECK_MISSING_OR_DUPLICATE:" + code);
      continue;
    }

    const check = matches[0]!;

    if (
      check.status !== "PASSED" ||
      check.verified_by_staff_id === null ||
      !Number.isSafeInteger(check.verified_by_staff_id) ||
      check.verified_by_staff_id <= 0 ||
      check.verified_at === null ||
      validDate(check.verified_at) === null
    ) {
      blockers.push("MANDATORY_CHECK_NOT_VERIFIED:" + code);
    }
  }

  if (
    snapshot.launch_checks.some(
      check => (
        check.status !== "PASSED" ||
        check.verified_by_staff_id === null ||
        check.verified_at === null ||
        validDate(check.verified_at) === null
      )
    )
  ) {
    blockers.push("UNRESOLVED_LAUNCH_CHECKS");
  }

  const trial = snapshot.trial_policy;

  if (
    trial !== null &&
    (
      !Number.isSafeInteger(trial.trial_days) ||
      trial.trial_days < 0 ||
      (trial.enabled && trial.trial_days === 0)
    )
  ) {
    blockers.push("INVALID_TRIAL_POLICY");
  }

  return {
    configuration_checks_passed: blockers.length === 0,
    approval_eligible: false,
    activation_enabled: false,
    blockers
  };
}

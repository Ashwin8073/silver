import { createHash } from "node:crypto";

export interface LaunchConfigurationSnapshot {
  product: {
    product_code: string;
    product_name: string;
    status: string;
    provisioning_mode: string;
    application_url: string | null;
    onboarding_url: string | null;
  };

  plans: Array<{
    plan_code: string;
    plan_name: string;
    status: string;
    tier_rank: number | null;
    prices: Array<{
      currency: string;
      billing_interval: string;
      amount_minor: number;
      version_no: number;
      valid_from: string;
      valid_until: string | null;
    }>;
  }>;

  integrations: Array<{
    integration_code: string;
    api_audience: string;
    status: string;
    secret_reference: string | null;
  }>;

  trial_policy: {
    enabled: boolean;
    trial_days: number;
  } | null;

  launch_checks: Array<{
    check_code: string;
    status: string;
    verified_by_staff_id: number | null;
    verified_at: string | null;
    details_json: string | null;
  }>;
}

function sortRecords<T>(records: T[]): T[] {
  return [...records].sort((a, b) => {
    const left = JSON.stringify(a);
    const right = JSON.stringify(b);

    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  });
}

export function canonicalLaunchConfiguration(
  input: LaunchConfigurationSnapshot
): string {
  const plans = input.plans.map(plan => ({
    plan_code: plan.plan_code,
    plan_name: plan.plan_name,
    status: plan.status,
    tier_rank: plan.tier_rank,
    prices: sortRecords(
      plan.prices.map(price => ({
        currency: price.currency,
        billing_interval: price.billing_interval,
        amount_minor: price.amount_minor,
        version_no: price.version_no,
        valid_from: price.valid_from,
        valid_until: price.valid_until
      }))
    )
  }));

  const integrations = input.integrations.map(
    integration => ({
      integration_code: integration.integration_code,
      api_audience: integration.api_audience,
      status: integration.status,
      secret_reference: integration.secret_reference
    })
  );

  const checks = input.launch_checks.map(check => ({
    check_code: check.check_code,
    status: check.status,
    verified_by_staff_id: check.verified_by_staff_id,
    verified_at: check.verified_at,
    details_json: check.details_json
  }));

  const snapshot = {
    schema_version: 1,
    product: {
      product_code: input.product.product_code,
      product_name: input.product.product_name,
      status: input.product.status,
      provisioning_mode: input.product.provisioning_mode,
      application_url: input.product.application_url,
      onboarding_url: input.product.onboarding_url
    },
    plans: sortRecords(plans),
    integrations: sortRecords(integrations),
    trial_policy: input.trial_policy === null
      ? null
      : {
          enabled: input.trial_policy.enabled,
          trial_days: input.trial_policy.trial_days
        },
    launch_checks: sortRecords(checks)
  };

  return JSON.stringify(snapshot);
}

export function hashLaunchConfiguration(
  input: LaunchConfigurationSnapshot
): string {
  return createHash("sha256")
    .update(canonicalLaunchConfiguration(input), "utf8")
    .digest("hex");
}

export function isLaunchConfigurationCurrent(
  input: LaunchConfigurationSnapshot,
  expectedHash: string
): boolean {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    return false;
  }

  return hashLaunchConfiguration(input) === expectedHash;
}

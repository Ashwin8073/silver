import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import {
  hashLaunchConfiguration
} from "./product.launch.snapshot.js";

import type {
  LaunchConfigurationSnapshot
} from "./product.launch.snapshot.js";

interface ProductDbRow extends RowDataPacket {
  product_code: string;
  product_name: string;
  status: string;
  provisioning_mode: string;
  application_url: string | null;
  onboarding_url: string | null;
}

interface PlanDbRow extends RowDataPacket {
  id: number | string;
  plan_code: string;
  plan_name: string;
  status: string;
  tier_rank: number | string;
}

interface PriceDbRow extends RowDataPacket {
  plan_id: number | string;
  currency: string;
  billing_interval: string;
  amount_minor: number | string;
  version_no: number | string;
  valid_from: string;
  valid_until: string | null;
}

interface IntegrationDbRow extends RowDataPacket {
  integration_code: string;
  api_audience: string;
  status: string;
  secret_reference: string | null;
}

interface TrialDbRow extends RowDataPacket {
  enabled: number | boolean;
  trial_days: number | string;
}

interface CheckDbRow extends RowDataPacket {
  check_code: string;
  status: string;
  verified_by_staff_id: number | string | null;
  verified_at: string | null;
  details_json: string | null;
}

function safeInteger(
  value: unknown,
  label: string
): number {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new Error("INVALID_SNAPSHOT_NUMBER:" + label);
  }

  if (
    typeof value === "string" &&
    !/^\d+$/.test(value)
  ) {
    throw new Error("INVALID_SNAPSHOT_NUMBER:" + label);
  }

  const result = Number(value);

  if (
    !Number.isSafeInteger(result) ||
    result < 0
  ) {
    throw new Error("INVALID_SNAPSHOT_NUMBER:" + label);
  }

  return result;
}

function dateText(
  value: unknown,
  label: string
): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)
  ) {
    throw new Error("INVALID_SNAPSHOT_DATE:" + label);
  }

  return value;
}

function nullableDateText(
  value: unknown,
  label: string
): string | null {
  if (value === null) {
    return null;
  }

  return dateText(value, label);
}

export async function readLaunchConfigurationSnapshot(
  connection: PoolConnection,
  productId: number
): Promise<LaunchConfigurationSnapshot> {
  if (
    !Number.isSafeInteger(productId) ||
    productId <= 0
  ) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const [products] = await connection.execute<ProductDbRow[]>(
    [
      "SELECT product_code, product_name, status,",
      "  provisioning_mode, application_url, onboarding_url",
      "FROM products",
      "WHERE id = ?"
    ].join("\n"),
    [productId]
  );

  if (products.length !== 1) {
    throw new Error("SNAPSHOT_PRODUCT_NOT_FOUND");
  }

  const product = products[0]!;

  const [plans] = await connection.execute<PlanDbRow[]>(
    [
      "SELECT id, plan_code, plan_name, status, tier_rank",
      "FROM plans",
      "WHERE product_id = ?"
    ].join("\n"),
    [productId]
  );

  const [prices] = await connection.execute<PriceDbRow[]>(
    [
      "SELECT pp.plan_id, pp.currency,",
      "  pp.billing_interval, pp.amount_minor, pp.version_no,",
      "  DATE_FORMAT(pp.valid_from,",
      "    '%Y-%m-%dT%H:%i:%s.%fZ') AS valid_from,",
      "  DATE_FORMAT(pp.valid_until,",
      "    '%Y-%m-%dT%H:%i:%s.%fZ') AS valid_until",
      "FROM plan_prices pp",
      "JOIN plans p ON p.id = pp.plan_id",
      "WHERE p.product_id = ?"
    ].join("\n"),
    [productId]
  );

  const [integrations] =
    await connection.execute<IntegrationDbRow[]>(
      [
        "SELECT integration_code, api_audience,",
        "  status, secret_reference",
        "FROM product_integrations",
        "WHERE product_id = ?"
      ].join("\n"),
      [productId]
    );

  const [policies] = await connection.execute<TrialDbRow[]>(
    [
      "SELECT enabled, trial_days",
      "FROM trial_policies",
      "WHERE product_id = ?"
    ].join("\n"),
    [productId]
  );

  const [checks] = await connection.execute<CheckDbRow[]>(
    [
      "SELECT check_code, status,",
      "  verified_by_staff_id,",
      "  DATE_FORMAT(verified_at,",
      "    '%Y-%m-%dT%H:%i:%s.%fZ') AS verified_at,",
      "  details_json",
      "FROM product_launch_checks",
      "WHERE product_id = ?"
    ].join("\n"),
    [productId]
  );

  if (policies.length > 1) {
    throw new Error("DUPLICATE_TRIAL_POLICY");
  }

  const planIds = new Set(
    plans.map(plan => String(plan.id))
  );

  const pricesByPlan = new Map<
    string,
    LaunchConfigurationSnapshot["plans"][number]["prices"]
  >();

  for (const price of prices) {
    const planId = String(price.plan_id);

    if (!planIds.has(planId)) {
      throw new Error("SNAPSHOT_PRICE_PLAN_MISMATCH");
    }

    const entries = pricesByPlan.get(planId) ?? [];

    entries.push({
      currency: price.currency,
      billing_interval: price.billing_interval,
      amount_minor: safeInteger(
        price.amount_minor,
        "amount_minor"
      ),
      version_no: safeInteger(
        price.version_no,
        "version_no"
      ),
      valid_from: dateText(
        price.valid_from,
        "valid_from"
      ),
      valid_until: nullableDateText(
        price.valid_until,
        "valid_until"
      )
    });

    pricesByPlan.set(planId, entries);
  }

  return {
    product: {
      product_code: product.product_code,
      product_name: product.product_name,
      status: product.status,
      provisioning_mode: product.provisioning_mode,
      application_url: product.application_url,
      onboarding_url: product.onboarding_url
    },

    plans: plans.map(plan => ({
      plan_code: plan.plan_code,
      plan_name: plan.plan_name,
      status: plan.status,
      tier_rank: safeInteger(
        plan.tier_rank,
        "tier_rank"
      ),
      prices: pricesByPlan.get(String(plan.id)) ?? []
    })),

    integrations: integrations.map(integration => ({
      integration_code: integration.integration_code,
      api_audience: integration.api_audience,
      status: integration.status,
      secret_reference: integration.secret_reference
    })),

    trial_policy: policies[0]
      ? {
          enabled: safeInteger(
            policies[0].enabled,
            "trial_enabled"
          ) === 1,
          trial_days: safeInteger(
            policies[0].trial_days,
            "trial_days"
          )
        }
      : null,

    launch_checks: checks.map(check => ({
      check_code: check.check_code,
      status: check.status,
      verified_by_staff_id:
        check.verified_by_staff_id === null
          ? null
          : safeInteger(
              check.verified_by_staff_id,
              "verified_by_staff_id"
            ),
      verified_at: nullableDateText(
        check.verified_at,
        "verified_at"
      ),
      details_json: check.details_json
    }))
  };
}

export async function readLaunchConfigurationHash(
  connection: PoolConnection,
  productId: number
): Promise<string> {
  const snapshot = await readLaunchConfigurationSnapshot(
    connection,
    productId
  );

  return hashLaunchConfiguration(snapshot);
}

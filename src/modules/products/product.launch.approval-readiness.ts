import type { PoolConnection } from "mysql2/promise";

import {
  readLaunchConfigurationSnapshot
} from "./product.launch.snapshot.repository.js";

import {
  hashLaunchConfiguration
} from "./product.launch.snapshot.js";

import {
  assessLaunchConfiguration
} from "./product.launch.configuration-policy.js";

export async function readAssessedLaunchConfiguration(
  connection: PoolConnection,
  productId: number,
  now: Date
) {
  const snapshot = await readLaunchConfigurationSnapshot(
    connection,
    productId
  );

  const hash = hashLaunchConfiguration(snapshot);

  const assessment = assessLaunchConfiguration(
    snapshot,
    now
  );

  return {
    hash,
    assessment
  };
}

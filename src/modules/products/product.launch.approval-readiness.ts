import type { RowDataPacket } from "mysql2";
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

interface TimeZoneRow extends RowDataPacket {
  offset_minutes: number;
}

export async function readAssessedLaunchConfiguration(
  connection: PoolConnection,
  productId: number,
  now: Date
) {
  const [timeRows] = await connection.query<TimeZoneRow[]>(
    [
      "SELECT TIMESTAMPDIFF(",
      "  MINUTE, UTC_TIMESTAMP(), NOW()",
      ") AS offset_minutes"
    ].join("\n")
  );

  if (
    timeRows.length !== 1 ||
    !Number.isSafeInteger(timeRows[0]?.offset_minutes) ||
    timeRows[0]?.offset_minutes !== 0
  ) {
    throw new Error("LAUNCH_REQUIRES_UTC_SESSION");
  }

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

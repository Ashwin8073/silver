import type { RowDataPacket } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

interface ApprovedRequestRow extends RowDataPacket {
  id: number;
}

/**
 * Call only inside an active configuration transaction,
 * after locking the parent products row FOR UPDATE.
 *
 * A historical APPROVED launch request permanently locks
 * this draft configuration until a separate, explicitly
 * authorized amendment workflow is implemented.
 */
export async function hasApprovedLaunchRequest(
  connection: PoolConnection,
  productId: number
): Promise<boolean> {
  if (
    !Number.isSafeInteger(productId) ||
    productId <= 0
  ) {
    throw new Error("INVALID_PRODUCT_ID");
  }

  const [requests] =
    await connection.execute<ApprovedRequestRow[]>(
      [
        "SELECT id",
        "FROM platform_change_requests",
        "WHERE product_id = ?",
        "  AND operation_code = 'PRODUCT_LAUNCH'",
        "  AND target_type = 'PRODUCT'",
        "  AND status = 'APPROVED'",
        "LIMIT 1",
        "FOR UPDATE"
      ].join("\n"),
      [productId]
    );

  return requests.length > 0;
}

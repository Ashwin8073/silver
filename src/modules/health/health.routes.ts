import { Router } from "express";
import { pool } from "../../database/pool.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    service: "dgate-platform-api",
    status: "running"
  });
});

healthRouter.get("/db", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT DATABASE() AS database_name"
    );

    res.status(200).json({
      success: true,
      status: "connected",
      result: rows
    });
  } catch {
    res.status(503).json({
      success: false,
      status: "database_unavailable"
    });
  }
});

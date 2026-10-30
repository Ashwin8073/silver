import { app } from "./app.js";
import { env } from "./config/env.js";
import { pool } from "./database/pool.js";

const server = app.listen(env.PORT, "127.0.0.1", () => {
  console.log(
    `D-GATE Platform API running at http://127.0.0.1:${env.PORT}`
  );
});

async function shutdown() {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

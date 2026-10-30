import { errorHandler } from "./middleware/errorHandler.js";
import { clerkMiddleware } from "@clerk/express";
import express from "express";
import helmet from "helmet";
import { v1Router } from "./routes/v1.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(clerkMiddleware());


app.use(helmet());
app.use(express.json({ limit: "1mb" }));

app.use("/api/v1", v1Router);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

app.use(errorHandler);




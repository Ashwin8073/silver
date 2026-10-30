import { productGrantsRouter } from "../modules/product-grants/grant.routes.js";
import { publicProductsRouter } from "../modules/products/product.public.routes.js";
import { productsRouter } from "../modules/products/product.routes.js";
import { staffAuthRouter } from "../modules/auth/auth.routes.js";
import { Router } from "express";
import { healthRouter } from "../modules/health/health.routes.js";

export const v1Router = Router();

v1Router.use("/health", healthRouter);

v1Router.use("/staff/auth", staffAuthRouter);
v1Router.use("/staff/products", productsRouter);
v1Router.use("/public/products", publicProductsRouter);
v1Router.use("/staff/product-grants", productGrantsRouter);


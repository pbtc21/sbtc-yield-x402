import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, YieldInput } from "./types";
import { calculateYield } from "./yield";
import { x402Middleware } from "./x402";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

app.get("/", (c) => {
  return c.json({
    service: "sBTC Yield Calculator",
    version: "2.0.0",
    endpoint: "POST /calculate-yield",
    pricing: "0.001 STX per request",
    x402: true,
  });
});

app.post("/calculate-yield", x402Middleware, async (c) => {
  const body = await c.req.json<YieldInput>();

  // Validate input
  if (!body.initialCollateral || body.initialCollateral <= 0) {
    return c.json({ error: "initialCollateral must be a positive number" }, 400);
  }

  if (body.borrowRatio !== undefined && (body.borrowRatio <= 0 || body.borrowRatio >= 1)) {
    return c.json({ error: "borrowRatio must be between 0 and 1" }, 400);
  }

  if (body.iterations !== undefined && (body.iterations < 1 || body.iterations > 20)) {
    return c.json({ error: "iterations must be between 1 and 20" }, 400);
  }

  if (body.baseApy !== undefined && body.baseApy < 0) {
    return c.json({ error: "baseApy must be non-negative" }, 400);
  }

  const result = calculateYield(body);
  return c.json(result);
});

export default app;

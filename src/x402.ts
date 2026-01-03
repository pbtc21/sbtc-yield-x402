import type { Context, Next } from "hono";
import type { Env, PaymentInfo } from "./types";

export function createPaymentResponse(env: Env): { error: string; payment: PaymentInfo } {
  return {
    error: "Payment Required",
    payment: {
      amount: env.PAYMENT_AMOUNT,
      token: "STX",
      address: env.PAYMENT_ADDRESS,
      memo: "yield-calc",
    },
  };
}

export async function x402Middleware(c: Context<{ Bindings: Env }>, next: Next) {
  const paymentProof = c.req.header("X-Payment-Proof");

  if (!paymentProof) {
    return c.json(createPaymentResponse(c.env), 402);
  }

  // v1: Accept any non-empty proof (mock validation)
  // v2: Verify STX transaction on-chain via Stacks API
  if (paymentProof.length < 10) {
    return c.json({ error: "Invalid payment proof" }, 400);
  }

  await next();
}

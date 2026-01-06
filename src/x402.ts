import type { Context, Next } from "hono";
import type { Env } from "./types";
import { deserializeTransaction, broadcastTransaction } from "@stacks/transactions";

// Standard x402 payment response
function createX402Response(env: Env) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  return {
    maxAmountRequired: env.PAYMENT_AMOUNT,
    resource: "/calculate-yield",
    payTo: env.PAYMENT_ADDRESS,
    network: "mainnet",
    nonce,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    tokenType: "STX",
  };
}

async function verifyAndBroadcastPayment(
  rawTxHex: string,
  minAmount: number
): Promise<{ success: boolean; txid?: string; error?: string }> {
  try {
    const tx = deserializeTransaction(rawTxHex);

    if (tx.payload.payloadType !== 0) {
      return { success: false, error: "Transaction is not a STX transfer" };
    }

    const payload = tx.payload as any;
    const amount = Number(payload.amount);

    if (amount < minAmount) {
      return { success: false, error: `Insufficient payment: got ${amount}, need ${minAmount}` };
    }

    const broadcastResult = await broadcastTransaction({
      transaction: tx,
      network: "mainnet",
    });

    if ("error" in broadcastResult) {
      return { success: false, error: `Broadcast failed: ${broadcastResult.error}` };
    }

    return { success: true, txid: broadcastResult.txid };
  } catch (error: any) {
    return { success: false, error: `Payment verification failed: ${error.message}` };
  }
}

export async function x402Middleware(c: Context<{ Bindings: Env }>, next: Next) {
  const paymentProof = c.req.header("X-Payment");

  if (!paymentProof) {
    return c.json(createX402Response(c.env), 402);
  }

  const minAmount = parseInt(c.env.PAYMENT_AMOUNT) || 1000;
  const result = await verifyAndBroadcastPayment(paymentProof, minAmount);

  if (!result.success) {
    return c.json({
      error: "Payment verification failed",
      details: result.error,
    }, 402);
  }

  c.set("paymentTxid", result.txid);
  await next();
}

import type { Context, Next } from "hono";
import type { Env, PaymentInfo } from "./types";
import { deserializeTransaction, broadcastTransaction } from "@stacks/transactions";

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

async function verifyAndBroadcastPayment(
  rawTxHex: string,
  minAmount: number
): Promise<{ success: boolean; txid?: string; error?: string }> {
  try {
    const tx = deserializeTransaction(rawTxHex);

    // Check it's a token transfer
    if (tx.payload.payloadType !== 0) {
      return { success: false, error: "Transaction is not a STX transfer" };
    }

    const payload = tx.payload as any;
    const amount = Number(payload.amount);

    if (amount < minAmount) {
      return { success: false, error: `Insufficient payment: got ${amount}, need ${minAmount}` };
    }

    // Broadcast the transaction
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
  // Check both X-Payment and X-Payment-Proof for compatibility
  const paymentProof = c.req.header("X-Payment") || c.req.header("X-Payment-Proof");

  if (!paymentProof) {
    return c.json(createPaymentResponse(c.env), 402);
  }

  // Verify and broadcast the payment
  const minAmount = parseInt(c.env.PAYMENT_AMOUNT) || 50000; // 0.05 STX default
  const result = await verifyAndBroadcastPayment(paymentProof, minAmount);

  if (!result.success) {
    return c.json({
      error: "Payment verification failed",
      details: result.error,
    }, 402);
  }

  // Attach payment info to context for downstream use
  c.set("paymentTxid", result.txid);

  await next();
}

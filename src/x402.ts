import type { Context, Next } from "hono";
import type { Env } from "./types";
import { deserializeTransaction, broadcastTransaction } from "@stacks/transactions";

// sBTC contract
const SBTC_CONTRACT = {
  address: 'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9',
  name: 'token-sbtc',
};

type PaymentTokenType = 'STX' | 'sBTC';

function getPaymentTokenType(c: Context): PaymentTokenType {
  const queryToken = c.req.query('tokenType');
  const headerToken = c.req.header('X-PAYMENT-TOKEN-TYPE');
  const tokenStr = (headerToken || queryToken || 'STX').toUpperCase();
  return tokenStr === 'SBTC' ? 'sBTC' : 'STX';
}

// Standard x402 payment response (supports STX and sBTC)
function createX402Response(env: Env, c: Context) {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const tokenType = getPaymentTokenType(c);
  const sbtcAmount = Math.max(1, Math.ceil(parseInt(env.PAYMENT_AMOUNT) / 100000)); // Convert to rough sat equivalence

  const baseResponse = {
    resource: "/calculate-yield",
    payTo: env.PAYMENT_ADDRESS,
    network: "mainnet",
    nonce,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  };

  if (tokenType === 'sBTC') {
    return {
      ...baseResponse,
      maxAmountRequired: sbtcAmount.toString(),
      tokenType: 'sBTC',
      tokenContract: SBTC_CONTRACT,
    };
  }

  return {
    ...baseResponse,
    maxAmountRequired: env.PAYMENT_AMOUNT,
    tokenType: "STX",
    paymentOptions: {
      stx: { amount: env.PAYMENT_AMOUNT },
      sbtc: { amount: sbtcAmount, tokenContract: SBTC_CONTRACT },
    },
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
    return c.json(createX402Response(c.env, c), 402);
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

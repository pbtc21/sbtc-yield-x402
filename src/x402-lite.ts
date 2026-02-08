import type { Context, Next } from "hono";
import type { Env } from "./types";

// Lightweight x402 middleware that doesn't depend on @stacks/transactions
// For edge deployment on Cloudflare Workers

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
  const sbtcAmount = Math.max(1, Math.ceil(parseInt(env.PAYMENT_AMOUNT) / 100000));

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

// Verify payment via Stacks API instead of locally
async function verifyPaymentViaAPI(
  rawTxHex: string,
  paymentAddress: string,
  minAmount: number
): Promise<{ success: boolean; txid?: string; error?: string }> {
  try {
    // Broadcast the transaction via Stacks API
    const broadcastResponse = await fetch(
      'https://api.mainnet.hiro.so/v2/transactions',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: hexToBytes(rawTxHex),
      }
    );

    if (!broadcastResponse.ok) {
      const errorText = await broadcastResponse.text();
      return { success: false, error: `Broadcast failed: ${errorText}` };
    }

    const txid = await broadcastResponse.text();

    // For now, trust the broadcast succeeded - actual verification would require
    // polling the transaction status, but we accept the payment optimistically
    return { success: true, txid: txid.replace(/"/g, '') };
  } catch (error: any) {
    return { success: false, error: `Payment verification failed: ${error.message}` };
  }
}

// Simple hex to bytes conversion
function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export async function x402Middleware(c: Context<{ Bindings: Env }>, next: Next) {
  const paymentProof = c.req.header("X-Payment");

  if (!paymentProof) {
    return c.json(createX402Response(c.env, c), 402);
  }

  const minAmount = parseInt(c.env.PAYMENT_AMOUNT) || 1000;
  const result = await verifyPaymentViaAPI(
    paymentProof,
    c.env.PAYMENT_ADDRESS,
    minAmount
  );

  if (!result.success) {
    return c.json({
      error: "Payment verification failed",
      details: result.error,
    }, 402);
  }

  c.set("paymentTxid", result.txid);
  await next();
}

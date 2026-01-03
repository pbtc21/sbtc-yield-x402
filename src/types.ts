export interface YieldInput {
  initialCollateral: number;
  borrowRatio?: number;
  iterations?: number;
  baseApy?: number;
}

export interface YieldResult {
  effectiveApy: string;
  collateralMultiple: string;
  liquidationRisk: string;
  inputs: Required<YieldInput>;
  disclaimer: string;
}

export interface PaymentInfo {
  amount: string;
  token: string;
  address: string;
  memo: string;
}

export interface Env {
  PAYMENT_ADDRESS: string;
  PAYMENT_AMOUNT: string;
}

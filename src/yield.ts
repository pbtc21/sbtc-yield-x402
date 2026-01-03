import type { YieldInput, YieldResult } from "./types";

const DEFAULTS = {
  borrowRatio: 0.8,
  iterations: 5,
  baseApy: 5.0,
};

export function calculateYield(input: YieldInput): YieldResult {
  const initialCollateral = input.initialCollateral;
  const borrowRatio = input.borrowRatio ?? DEFAULTS.borrowRatio;
  const iterations = input.iterations ?? DEFAULTS.iterations;
  const baseApy = input.baseApy ?? DEFAULTS.baseApy;

  // Simulate looping: deposit sBTC -> borrow -> swap to sBTC -> redeposit
  let collateral = initialCollateral;
  let totalBorrowed = 0;

  for (let i = 0; i < iterations; i++) {
    const borrowAmount = collateral * borrowRatio;
    totalBorrowed += borrowAmount;
    collateral += borrowAmount;
  }

  const collateralMultiple = collateral / initialCollateral;

  // Effective APY = base yield * leverage - borrow cost (assume ~2% borrow rate)
  const borrowCostRate = 0.02;
  const effectiveApy = baseApy * collateralMultiple - borrowCostRate * (collateralMultiple - 1) * 100;

  // Liquidation risk: how much BTC can drop before liquidation
  // With higher leverage, smaller drops trigger liquidation
  const liquidationThreshold = (1 / collateralMultiple) * 100;

  return {
    effectiveApy: effectiveApy.toFixed(2),
    collateralMultiple: collateralMultiple.toFixed(2),
    liquidationRisk: `${liquidationThreshold.toFixed(2)}% BTC price drop`,
    inputs: {
      initialCollateral,
      borrowRatio,
      iterations,
      baseApy,
    },
    disclaimer: "Simulation only. Real yields vary. Not financial advice.",
  };
}

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, YieldInput } from "./types";
import { calculateYield } from "./yield";
import { x402Middleware } from "./x402-lite";

const app = new Hono<{ Bindings: Env }>();

app.use("*", cors());

// Frontend HTML
function getFrontendHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>sBTC Yield Calculator | Looped Leverage Strategy</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #0a0a0f;
      --surface: #12121a;
      --surface-2: #1a1a25;
      --border: #2a2a3a;
      --text: #e4e4e7;
      --text-muted: #71717a;
      --accent: #f97316;
      --accent-2: #fb923c;
      --green: #22c55e;
      --orange: #f97316;
      --blue: #3b82f6;
      --red: #ef4444;
      --btc: #f7931a;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 3rem 1.5rem;
    }

    header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--surface);
      border: 1px solid var(--btc);
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      font-size: 0.85rem;
      color: var(--btc);
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--text) 0%, var(--btc) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1rem;
    }

    .subtitle {
      font-size: 1.1rem;
      color: var(--text-muted);
      max-width: 500px;
      margin: 0 auto;
    }

    .calculator {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
    }

    .form-group {
      margin-bottom: 1.5rem;
    }

    label {
      display: block;
      font-size: 0.9rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .label-hint {
      font-weight: 400;
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    input[type="number"], input[type="range"] {
      width: 100%;
      font-family: 'JetBrains Mono', monospace;
      font-size: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      outline: none;
      transition: border-color 0.2s;
    }

    input[type="number"]:focus {
      border-color: var(--btc);
    }

    input[type="range"] {
      padding: 0;
      height: 8px;
      -webkit-appearance: none;
      background: var(--surface-2);
      border-radius: 4px;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 20px;
      height: 20px;
      background: var(--btc);
      border-radius: 50%;
      cursor: pointer;
    }

    .range-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.5rem;
    }

    .range-value {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.25rem;
      color: var(--btc);
      margin-top: 0.5rem;
    }

    button {
      width: 100%;
      font-family: inherit;
      font-size: 1rem;
      font-weight: 600;
      padding: 1rem;
      border-radius: 0.5rem;
      border: none;
      background: var(--btc);
      color: #000;
      cursor: pointer;
      transition: all 0.2s;
    }

    button:hover { background: var(--accent-2); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    .results {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
      display: none;
    }

    .results.visible { display: block; }

    .results h2 {
      font-size: 1.25rem;
      margin-bottom: 1.5rem;
    }

    .result-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .result-stat {
      background: var(--surface-2);
      border-radius: 0.5rem;
      padding: 1rem;
      text-align: center;
    }

    .result-value {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text);
    }

    .result-value.highlight { color: var(--green); }
    .result-value.warning { color: var(--orange); }
    .result-value.danger { color: var(--red); }

    .result-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .loop-breakdown {
      margin-top: 1.5rem;
    }

    .loop-breakdown h3 {
      font-size: 0.9rem;
      margin-bottom: 1rem;
      color: var(--text-muted);
    }

    .loop-item {
      display: flex;
      justify-content: space-between;
      padding: 0.75rem;
      background: var(--surface-2);
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
    }

    .loop-num {
      color: var(--btc);
      font-weight: 600;
    }

    .warning-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid var(--red);
      border-radius: 0.5rem;
      padding: 1rem;
      margin-top: 1.5rem;
      font-size: 0.85rem;
    }

    .warning-box h4 {
      color: var(--red);
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }

    .info-section {
      background: linear-gradient(135deg, var(--surface) 0%, var(--surface-2) 100%);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2rem;
      margin-bottom: 2rem;
    }

    .info-section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
    }

    .info-section p {
      color: var(--text-muted);
      font-size: 0.9rem;
      margin-bottom: 1rem;
    }

    .formula {
      font-family: 'JetBrains Mono', monospace;
      background: var(--surface);
      padding: 1rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      overflow-x: auto;
    }

    footer {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    footer a {
      color: var(--btc);
      text-decoration: none;
    }

    @media (max-width: 640px) {
      h1 { font-size: 2rem; }
      .container { padding: 2rem 1rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="badge">
        <span>sBTC</span>
        <span>•</span>
        <span>Yield Calculator</span>
      </div>
      <h1>sBTC Looped Yield</h1>
      <p class="subtitle">Calculate potential yields from looped leverage strategies using sBTC collateral.</p>
    </header>

    <div class="calculator">
      <div class="form-group">
        <label>Initial sBTC Collateral <span class="label-hint">(in BTC)</span></label>
        <input type="number" id="collateral" value="1" min="0.001" step="0.1" />
      </div>

      <div class="form-group">
        <label>Borrow Ratio <span class="label-hint">(LTV)</span></label>
        <input type="range" id="borrowRatio" min="0.1" max="0.8" step="0.05" value="0.5" />
        <div class="range-labels">
          <span>10% (Safe)</span>
          <span>50%</span>
          <span>80% (Risky)</span>
        </div>
        <div class="range-value" id="borrowRatioDisplay">50%</div>
      </div>

      <div class="form-group">
        <label>Loop Iterations <span class="label-hint">(1-10)</span></label>
        <input type="range" id="iterations" min="1" max="10" step="1" value="3" />
        <div class="range-labels">
          <span>1x</span>
          <span>5x</span>
          <span>10x</span>
        </div>
        <div class="range-value" id="iterationsDisplay">3 loops</div>
      </div>

      <div class="form-group">
        <label>Base APY <span class="label-hint">(%)</span></label>
        <input type="number" id="baseApy" value="5" min="0" max="100" step="0.5" />
      </div>

      <button onclick="calculate()">Calculate Yield</button>
    </div>

    <div id="results" class="results">
      <h2>Yield Analysis</h2>
      <div class="result-grid">
        <div class="result-stat">
          <div class="result-value highlight" id="effectiveApy">-</div>
          <div class="result-label">Effective APY</div>
        </div>
        <div class="result-stat">
          <div class="result-value" id="totalExposure">-</div>
          <div class="result-label">Total Exposure</div>
        </div>
        <div class="result-stat">
          <div class="result-value" id="leverageMultiple">-</div>
          <div class="result-label">Leverage</div>
        </div>
        <div class="result-stat">
          <div class="result-value" id="annualYield">-</div>
          <div class="result-label">Annual Yield</div>
        </div>
      </div>

      <div class="loop-breakdown">
        <h3>Loop Breakdown</h3>
        <div id="loopDetails"></div>
      </div>

      <div id="warningBox" class="warning-box" style="display: none;">
        <h4>Liquidation Risk</h4>
        <p id="warningText"></p>
      </div>
    </div>

    <div class="info-section">
      <h2>How It Works</h2>
      <p>Looped leverage uses sBTC as collateral to borrow stablecoins, which are then used to acquire more sBTC, creating a leveraged position that amplifies yield.</p>
      <div class="formula">
        Total Exposure = Initial × (1 - ratio^iterations) / (1 - ratio)<br>
        Effective APY = Base APY × Leverage Multiple
      </div>
      <p style="margin-top: 1rem; color: var(--orange);">Warning: Higher leverage increases liquidation risk. Always maintain healthy collateral ratios.</p>
    </div>

    <footer>
      <p>Part of the <a href="https://pbtc21.dev">pbtc21.dev</a> ecosystem</p>
      <p style="margin-top: 0.5rem;">Powered by Stacks • x402 Protocol</p>
    </footer>
  </div>

  <script>
    // Update range displays
    document.getElementById('borrowRatio').addEventListener('input', (e) => {
      document.getElementById('borrowRatioDisplay').textContent = Math.round(e.target.value * 100) + '%';
    });

    document.getElementById('iterations').addEventListener('input', (e) => {
      document.getElementById('iterationsDisplay').textContent = e.target.value + ' loops';
    });

    function calculate() {
      const collateral = parseFloat(document.getElementById('collateral').value);
      const borrowRatio = parseFloat(document.getElementById('borrowRatio').value);
      const iterations = parseInt(document.getElementById('iterations').value);
      const baseApy = parseFloat(document.getElementById('baseApy').value);

      // Calculate looped exposure
      let totalExposure = 0;
      let currentCollateral = collateral;
      const loops = [];

      for (let i = 0; i < iterations; i++) {
        totalExposure += currentCollateral;
        const borrowed = currentCollateral * borrowRatio;
        loops.push({
          loop: i + 1,
          collateral: currentCollateral.toFixed(6),
          borrowed: borrowed.toFixed(6),
          cumulative: totalExposure.toFixed(6)
        });
        currentCollateral = borrowed;
      }

      const leverageMultiple = totalExposure / collateral;
      const effectiveApy = baseApy * leverageMultiple;
      const annualYield = collateral * (effectiveApy / 100);

      // Update display
      document.getElementById('results').className = 'results visible';
      document.getElementById('effectiveApy').textContent = effectiveApy.toFixed(2) + '%';
      document.getElementById('totalExposure').textContent = totalExposure.toFixed(4) + ' BTC';
      document.getElementById('leverageMultiple').textContent = leverageMultiple.toFixed(2) + 'x';
      document.getElementById('annualYield').textContent = annualYield.toFixed(6) + ' BTC';

      // Loop details
      const loopDetails = document.getElementById('loopDetails');
      loopDetails.innerHTML = loops.map(l => \`
        <div class="loop-item">
          <span class="loop-num">Loop \${l.loop}</span>
          <span>+\${l.collateral} BTC</span>
          <span style="color: var(--text-muted);">Total: \${l.cumulative}</span>
        </div>
      \`).join('');

      // Warning for high leverage
      const warningBox = document.getElementById('warningBox');
      if (leverageMultiple > 3 || borrowRatio > 0.7) {
        warningBox.style.display = 'block';
        document.getElementById('warningText').textContent =
          \`At \${leverageMultiple.toFixed(1)}x leverage with \${Math.round(borrowRatio * 100)}% LTV, a \${Math.round((1 - borrowRatio) * 100 / leverageMultiple)}% price drop could trigger liquidation.\`;
        document.getElementById('effectiveApy').className = 'result-value warning';
      } else {
        warningBox.style.display = 'none';
        document.getElementById('effectiveApy').className = 'result-value highlight';
      }
    }
  </script>
</body>
</html>`;
}

app.get("/", (c) => {
  const accept = c.req.header('Accept') || '';
  if (accept.includes('text/html')) {
    return c.html(getFrontendHtml());
  }
  return c.json({
    service: "sBTC Yield Calculator",
    version: "2.0.0",
    endpoint: "POST /calculate-yield",
    pricing: "0.001 STX per request",
    x402: true,
  });
});

// x402 discovery endpoint
app.get("/calculate-yield", (c) => {
  const paymentAddress = c.env.PAYMENT_ADDRESS;
  const paymentAmount = c.env.PAYMENT_AMOUNT;

  return c.json({
    x402Version: 1,
    name: "sBTC Yield Calculator",
    accepts: [{
      scheme: "exact",
      network: "stacks",
      maxAmountRequired: paymentAmount,
      resource: "/calculate-yield",
      description: "Looped leverage yield calculator for sBTC collateral",
      mimeType: "application/json",
      payTo: paymentAddress,
      maxTimeoutSeconds: 300,
      asset: "STX",
      outputSchema: {
        input: {
          type: "object",
          properties: {
            initialCollateral: { type: "number", description: "Initial sBTC collateral amount" },
            borrowRatio: { type: "number", description: "LTV ratio (0-1)", default: 0.8 },
            iterations: { type: "number", description: "Number of loop iterations", default: 5 },
            baseApy: { type: "number", description: "Base APY percentage", default: 5.0 }
          },
          required: ["initialCollateral"]
        },
        output: {
          type: "object",
          properties: {
            effectiveApy: { type: "string", description: "Effective APY after leverage" },
            collateralMultiple: { type: "string", description: "Total leverage multiple" },
            liquidationRisk: { type: "string", description: "BTC price drop to trigger liquidation" },
            inputs: { type: "object", description: "Resolved input parameters" },
            disclaimer: { type: "string" }
          }
        }
      }
    }]
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

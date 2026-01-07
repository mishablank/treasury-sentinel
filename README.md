# 🛡️ Treasury Sentinel

**Treasury Sentinel** is a **DAO CFO–style treasury risk monitoring agent** for EVM treasuries.

It continuously monitors on-chain treasury positions and escalates analysis depth **only when risk justifies the cost**, using **real HTTP 402 micropayments settled in USDC on Base**.

👉 *Advisory only. No trades. No fund movement.*

---

## ✨ What It Does

- Monitors **on-chain treasury addresses** across multiple EVM networks
- Detects **volatility regimes** locally
- Pays for **institutional market data (Kaiko)** only when needed
- Models **liquidity & slippage risk** using explainable logic
- Produces **clear, advisory recommendations** — including *doing nothing*

---

## 🧠 Core Idea

> **Thinking harder should cost money — and sometimes you should choose not to think harder at all.**

Treasury Sentinel behaves like a **budget-constrained risk officer**, not a trading bot.

---

## 🔗 Supported Networks

**Treasury monitoring (multi-chain):**
- Ethereum
- Gnosis
- Arbitrum
- Optimism
- Base

**Micropayments (single chain):**
- **Base**
- **USDC only**

---

## 💸 Real HTTP 402 Micropayments

- Fixed demo budget: **10.00 USDC**
- Payments settled **on-chain** (ERC-20 transfer on Base)
- Each paid request is gated by **HTTP 402 Payment Required**
- If budget runs out → agent stops escalating

---

## 📊 Market Data (Kaiko Only)

- **Kaiko REST** is the **only** external data source
- Accessed via an internal **Kaiko Metering Gateway**
- No Amberdata. No other vendors.

### Paid Endpoints

| Endpoint | Description | Cost |
|-------|------------|------|
| `/depth` | Order book depth (±1 / 2 / 5 / 10%) | Cheap |
| `/impact` | Historical trade-size vs price-impact curves | Expensive |

Pricing is **per endpoint** and enforced via HTTP 402.

---

## 🧩 Agent Escalation Ladder

The agent follows an **explicit state machine**.  

- MONITORING
↓ (schedule / price move)
- REGIME_DETECTION
↓ (volatility ≥ threshold)
- DEPTH_REQUIRED → [402 → /depth]
↓ (LCR < threshold)
- IMPACT_REQUIRED → [402 → /impact]
↓
- STRESS_SIMULATION
↓
- RECOMMENDATION


### Terminal States
- `BUDGET_BLOCKED`
- `ERROR / RETRY`

---

## 🔍 Guard Conditions (Visible in UI)

Edges in the state graph are labeled with guards such as:

- `volatility_percentile ≥ 90`
- `liquidity_coverage_ratio < 1.5`
- `remaining_budget < endpoint_cost`

The UI highlights **exactly which guards fired** for each run.

---

## 📈 Risk Metrics (Raw & Explainable)

All modeling is local and deterministic.

- **Liquidity Coverage Ratio (LCR)**
- **Exit Half-Life**
- **Expected vs Worst-Case Slippage**
- **Volatility Regime (percentile-based)**
- **Depth bands (±1 / 2 / 5 / 10%)**
- **Impact / slippage curves**

No ML. No black boxes.

---

## 🧪 Stress Scenarios

- ETH −20%
- ETH −40%
- Stress-adjusted liquidity haircuts
- Single-shot vs time-sliced execution

---

## 🖥️ UI Overview

Built with **Next.js + Tailwind**.

### Key Screens

- **Treasury**
  - On-chain addresses
  - Per-chain balances

- **Risk Metrics**
  - Depth charts
  - Impact curves
  - Volatility regime

- **Runs**
  - 15-minute agent runs
  - Budget usage

- **Run Detail**
  - **State machine graph (React Flow)**
  - Guard-labeled edges
  - Highlighted execution path
  - Payment ledger (quotes + tx hashes)

- **Export**
  - Mermaid diagram of the state machine

---

## ⏱️ Runtime

- Runs automatically **every 15 minutes**
- Manual trigger supported
- Each run persists:
  - Treasury snapshot
  - Metrics
  - State transitions
  - Payment receipts

---

## 🔒 Advisory-Only by Design

Treasury Sentinel **never**:
- Executes trades
- Rebalances funds
- Moves treasury assets

It only:
- Analyzes risk
- Explains trade-offs
- Recommends actions **or inaction**

---

## ⚙️ Tech Stack

- **Backend:** FastAPI, SQLAlchemy, SQLite
- **Agent:** Deterministic state machine
- **Scheduler:** APScheduler (cron)
- **Frontend:** Next.js, Tailwind, React Flow, Recharts
- **Payments:** USDC (ERC-20) on Base
- **Docs:** OpenAPI / Swagger

---

## 🧪 Testing

Includes unit tests for:
- Liquidity Coverage Ratio
- Exit Half-Life
- Volatility regime detection
- Payment quote creation
- On-chain receipt verification

---

## 🔐 Environment Setup

A `.env.example` is provided with:
- RPC URLs (all chains)
- Base USDC contract
- Kaiko credentials
- Gateway recipient address
- Demo private key
- Budget & pricing constants
- Risk thresholds
- Cron schedule

---

## ⚠️ Disclaimer

This project is:
- A demo / research tool
- Not financial advice
- Not a trading system
- Not production-ready custody software

---

## 📄 License

MIT

Each transition is guarded by a boolean condition and persisted.


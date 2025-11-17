# treasury-sentinel

A DAO CFO risk console with self-funding HTTP 402 micropayments for market data escalation

## Installation

```bash
npm install
```

## Usage

```bash
npx ts-node src/index.ts
```

## Features

- Multi-chain EVM treasury monitoring (Ethereum, Gnosis, Arbitrum, Optimism, Base) with ERC-20 balance snapshots
- Kaiko Metering Gateway with HTTP 402 payment-required enforcement and Base USDC settlement verification
- Explicit state machine escalation ladder (L0-L5) with guard conditions visualized in React Flow with edge labels
- Real liquidity risk metrics: LCR, exit half-life, volatility regime detection, depth bands, and impact curves
- APScheduler cron-based 15-minute agent runs with SQLite persistence and full run replay capability
- Next.js dashboard with Recharts visualization, payment ledger tracking, and Mermaid diagram export
- Strict 10 USDC demo budget enforcement with automatic BUDGET_BLOCKED state transitions

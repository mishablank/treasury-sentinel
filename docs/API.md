# Treasury Sentinel API Documentation

## Overview

Treasury Sentinel provides a comprehensive API for DAO treasury monitoring with real-time risk assessment and automated escalation management.

## Core Services

### TreasuryMonitor

Monitors multi-chain EVM treasuries and captures balance snapshots.

```typescript
import { TreasuryMonitor } from '@/services/treasury';

const monitor = new TreasuryMonitor({
  chains: ['ethereum', 'gnosis', 'arbitrum', 'optimism', 'base'],
  tokens: ['USDC', 'USDT', 'DAI', 'WETH'],
  snapshotInterval: 900000, // 15 minutes
});

// Take a snapshot
const snapshot = await monitor.takeSnapshot();

// Get historical snapshots
const history = await monitor.getHistory({
  startTime: Date.now() - 86400000,
  endTime: Date.now(),
});
```

### KaikoGateway

Handles market data requests with HTTP 402 payment enforcement.

```typescript
import { KaikoGateway } from '@/services/kaiko';

const gateway = new KaikoGateway({
  apiKey: process.env.KAIKO_API_KEY,
  budgetLimit: 10_000000, // 10 USDC in micro units
});

// Fetch market data
try {
  const data = await gateway.fetchMarketData({
    pair: 'ETH/USDC',
    exchange: 'coinbase',
  });
} catch (error) {
  if (error.code === 'PAYMENT_REQUIRED') {
    // Handle 402 response
    const paymentRequest = error.paymentDetails;
    await handlePayment(paymentRequest);
  }
}
```

### LiquidityMetrics

Calculates real liquidity risk metrics.

```typescript
import { LiquidityMetrics } from '@/services/liquidity';

const metrics = new LiquidityMetrics();

// Calculate Liquidity Coverage Ratio
const lcr = await metrics.calculateLCR(treasurySnapshot);

// Calculate exit half-life
const halfLife = await metrics.calculateExitHalfLife({
  positions: treasurySnapshot.positions,
  marketDepth: orderBookData,
});

// Detect volatility regime
const regime = await metrics.detectVolatilityRegime(priceHistory);
```

### EscalationStateMachine

Manages escalation state transitions with guard conditions.

```typescript
import { EscalationStateMachine } from '@/state-machine';

const machine = new EscalationStateMachine({
  initialState: 'L0_IDLE',
  budgetLimit: 10_000000,
});

// Transition states
await machine.transition('ESCALATE');

// Check current state
const state = machine.getState();

// Get available transitions
const available = machine.getAvailableTransitions();
```

## Escalation Levels

| Level | Name | Description | Cost Impact |
|-------|------|-------------|-------------|
| L0 | IDLE | Normal monitoring | None |
| L1 | ALERT | Elevated risk detected | Low |
| L2 | WARNING | Significant risk | Medium |
| L3 | CRITICAL | Critical risk level | High |
| L4 | EMERGENCY | Emergency response | Very High |
| L5 | LOCKDOWN | Full treasury lockdown | Maximum |

## State Transitions

```
L0_IDLE -> L1_ALERT (volatility spike)
L1_ALERT -> L2_WARNING (LCR below threshold)
L2_WARNING -> L3_CRITICAL (exit half-life exceeded)
L3_CRITICAL -> L4_EMERGENCY (liquidity crisis)
L4_EMERGENCY -> L5_LOCKDOWN (full lockdown required)

Any State -> BUDGET_BLOCKED (budget exhausted)
```

## Payment Flow

1. Request market data from Kaiko
2. Receive HTTP 402 Payment Required response
3. Parse payment request details
4. Execute Base USDC payment
5. Include payment proof in retry request
6. Verify settlement on-chain
7. Access granted to market data

## Configuration

### Environment Variables

```bash
# Required
KAIKO_API_KEY=your_api_key
RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/...
RPC_BASE=https://mainnet.base.org

# Optional
BUDGET_LIMIT_USDC=10
SNAPSHOT_INTERVAL_MS=900000
LOG_LEVEL=info
```

### Budget Configuration

```typescript
export const budgetConfig = {
  limitUsdc: 10,
  warningThreshold: 0.8, // 80% of budget
  criticalThreshold: 0.95, // 95% of budget
  autoBlockEnabled: true,
};
```

## Error Handling

All services throw typed errors:

```typescript
import { TreasuryError, PaymentError, EscalationError } from '@/utils/errors';

try {
  await service.operation();
} catch (error) {
  if (error instanceof PaymentError) {
    // Handle payment failure
  } else if (error instanceof TreasuryError) {
    // Handle treasury monitoring failure
  } else if (error instanceof EscalationError) {
    // Handle state machine error
  }
}
```

## Events

Subscribe to system events:

```typescript
import { eventEmitter } from '@/events';

eventEmitter.on('escalation:transition', (event) => {
  console.log(`State changed: ${event.from} -> ${event.to}`);
});

eventEmitter.on('payment:completed', (event) => {
  console.log(`Payment: ${event.amount} USDC for ${event.service}`);
});

eventEmitter.on('budget:warning', (event) => {
  console.log(`Budget warning: ${event.usedPercent}% used`);
});
```

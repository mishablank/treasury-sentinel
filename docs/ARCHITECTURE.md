# Treasury Sentinel Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Dashboard                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ React Flow   │  │  Recharts    │  │  Ledger      │           │
│  │ Visualization│  │  Charts      │  │  Tracking    │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Service Container                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Event Emitter                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  Treasury    │  │  Kaiko       │  │  Liquidity   │           │
│  │  Monitor     │  │  Gateway     │  │  Metrics     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│         │                  │                  │                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Escalation State Machine                    │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Data Layer                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │  SQLite      │  │  Multi-chain │  │  Base USDC   │           │
│  │  Persistence │  │  RPC         │  │  Settlement  │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### Frontend Layer

#### React Flow Visualization
- Renders escalation state machine as interactive graph
- Displays guard conditions on edges
- Shows current state highlighting
- Supports Mermaid diagram export

#### Recharts Dashboard
- Treasury balance history charts
- Risk metric time series
- Budget utilization gauges
- Liquidity depth visualizations

#### Payment Ledger
- Transaction history table
- Real-time payment tracking
- Settlement status indicators
- Export functionality

### Service Layer

#### TreasuryMonitor
- Multi-chain EVM wallet monitoring
- ERC-20 balance snapshots
- Historical data aggregation
- Position tracking

#### KaikoGateway
- Market data fetching
- HTTP 402 payment handling
- Rate limiting
- Response caching

#### LiquidityMetrics
- LCR calculation
- Exit half-life estimation
- Volatility regime detection
- Impact curve modeling

#### EscalationStateMachine
- State management
- Guard condition evaluation
- Transition logging
- Budget enforcement

### Data Layer

#### SQLite Repositories
- PaymentRepository: Payment records
- TreasuryRepository: Balance snapshots
- AgentRunRepository: Scheduler runs

#### Chain Integrations
- Ethereum mainnet
- Gnosis Chain
- Arbitrum One
- Optimism
- Base

## Data Flow

### Monitoring Cycle

```
1. APScheduler triggers AgentRunner (15-min cron)
2. TreasuryMonitor fetches multi-chain balances
3. LiquidityMetrics calculates risk scores
4. EscalationStateMachine evaluates guards
5. If data needed: KaikoGateway with 402 handling
6. State transition if guards pass
7. Persist to SQLite
8. Emit events for UI updates
```

### Payment Flow

```
1. KaikoGateway sends data request
2. Kaiko returns HTTP 402 with payment details
3. Http402Handler parses payment request
4. BudgetManager checks available funds
5. BaseService executes USDC transfer
6. SettlementVerifier confirms on-chain
7. Retry original request with payment proof
8. Store payment record in ledger
```

## State Machine Design

### States

```typescript
type EscalationState =
  | 'L0_IDLE'
  | 'L1_ALERT'
  | 'L2_WARNING'
  | 'L3_CRITICAL'
  | 'L4_EMERGENCY'
  | 'L5_LOCKDOWN'
  | 'BUDGET_BLOCKED';
```

### Guard Conditions

```typescript
interface GuardCondition {
  name: string;
  evaluate: (context: EscalationContext) => boolean;
  description: string;
}

const guards = {
  volatilitySpike: (ctx) => ctx.metrics.volatility > 0.3,
  lcrBelowThreshold: (ctx) => ctx.metrics.lcr < 1.0,
  exitHalfLifeExceeded: (ctx) => ctx.metrics.exitHalfLife > 24,
  liquidityCrisis: (ctx) => ctx.metrics.depth < ctx.positions.value * 0.1,
  budgetExhausted: (ctx) => ctx.budget.remaining <= 0,
};
```

## Database Schema

### Payments Table

```sql
CREATE TABLE payments (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  service TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  metadata TEXT
);
```

### Treasury Snapshots Table

```sql
CREATE TABLE treasury_snapshots (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  chain TEXT NOT NULL,
  token TEXT NOT NULL,
  balance TEXT NOT NULL,
  usd_value REAL
);
```

### Agent Runs Table

```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  status TEXT NOT NULL,
  state_before TEXT,
  state_after TEXT,
  payments_made INTEGER DEFAULT 0,
  error TEXT
);
```

## Security Considerations

1. **Budget Enforcement**: Strict 10 USDC limit with automatic blocking
2. **RPC Security**: Rate limiting and retry policies
3. **API Key Protection**: Environment variable storage
4. **Payment Verification**: On-chain settlement confirmation
5. **State Integrity**: Immutable transition logging

## Performance Optimizations

1. **Caching**: Market data cached with TTL
2. **Batch Queries**: Multi-call for ERC-20 balances
3. **Connection Pooling**: SQLite WAL mode
4. **Event Debouncing**: UI update batching
5. **Lazy Loading**: Chart data pagination

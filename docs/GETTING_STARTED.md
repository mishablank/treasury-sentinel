# Getting Started with Treasury Sentinel

## Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Git

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/treasury-sentinel.git
cd treasury-sentinel
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Create a `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```bash
# Kaiko API Configuration
KAIKO_API_KEY=your_kaiko_api_key

# RPC Endpoints
RPC_ETHEREUM=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_GNOSIS=https://rpc.gnosis.gateway.fm
RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
RPC_OPTIMISM=https://mainnet.optimism.io
RPC_BASE=https://mainnet.base.org

# Treasury Wallet Address
TREASURY_ADDRESS=0xYourTreasuryAddress

# Budget Configuration (in USDC)
BUDGET_LIMIT_USDC=10

# Database Path (optional)
DATABASE_PATH=./data/treasury.db
```

### 4. Initialize Database

```bash
npm run db:init
```

### 5. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
treasury-sentinel/
├── docs/                    # Documentation
├── src/
│   ├── components/          # React components
│   │   ├── charts/          # Recharts visualizations
│   │   ├── dashboard/       # Main dashboard
│   │   ├── flow/            # React Flow components
│   │   ├── layout/          # Layout components
│   │   └── ledger/          # Payment ledger
│   ├── config/              # Configuration modules
│   ├── db/                  # Database layer
│   │   └── repositories/    # Data repositories
│   ├── events/              # Event system
│   ├── export/              # Export functionality
│   │   └── mermaid/         # Mermaid diagram export
│   ├── hooks/               # React hooks
│   ├── services/            # Core services
│   │   ├── base/            # Base service classes
│   │   ├── container/       # Dependency injection
│   │   ├── kaiko/           # Kaiko API gateway
│   │   ├── liquidity/       # Liquidity metrics
│   │   ├── payments/        # HTTP 402 handling
│   │   ├── scheduler/       # APScheduler agent
│   │   ├── settlement/      # On-chain settlement
│   │   └── treasury/        # Treasury monitoring
│   ├── state-machine/       # Escalation state machine
│   ├── types/               # TypeScript types
│   └── utils/               # Utility functions
├── package.json
├── tsconfig.json
└── turbo.json
```

## Running the Agent

### Manual Run

```bash
npm run agent:run
```

### Scheduled Run (15-minute intervals)

```bash
npm run agent:start
```

### Replay Historical Run

```bash
npm run agent:replay -- --run-id=<run-id>
```

## Dashboard Features

### Escalation Flow View

Visualize the state machine with:
- Current state highlighting
- Guard conditions on edges
- Transition history
- Export to Mermaid format

### Treasury Charts

- Multi-chain balance history
- Risk metric trends
- Volatility indicators
- Liquidity depth bands

### Payment Ledger

- All HTTP 402 payments
- Settlement verification status
- Running budget total
- Export to CSV

## Common Tasks

### Add a New Chain

1. Add chain config in `src/config/chains.ts`
2. Add RPC endpoint to environment
3. Update treasury monitor tokens list

### Adjust Escalation Thresholds

Edit `src/state-machine/guards.ts`:

```typescript
export const THRESHOLDS = {
  volatilitySpike: 0.3,      // 30% volatility
  lcrWarning: 1.2,           // LCR below 120%
  lcrCritical: 1.0,          // LCR below 100%
  exitHalfLifeHours: 24,     // 24 hour exit time
};
```

### Modify Budget Limit

Edit `src/config/budget.ts` or set `BUDGET_LIMIT_USDC` environment variable.

## Troubleshooting

### "BUDGET_BLOCKED" State

The system automatically blocks when budget is exhausted:
1. Check current spend in Payment Ledger
2. Reset budget: `npm run budget:reset`
3. Or increase `BUDGET_LIMIT_USDC`

### RPC Connection Errors

1. Verify RPC endpoints are accessible
2. Check rate limits on your RPC provider
3. Review retry configuration in `src/services/base/RetryableService.ts`

### Database Errors

1. Check database file permissions
2. Run migrations: `npm run db:migrate`
3. Reset database: `npm run db:reset` (destructive)

## Development Commands

```bash
# Run type checking
npm run type-check

# Run linting
npm run lint

# Run tests
npm run test

# Build for production
npm run build

# Start production server
npm run start
```

## Next Steps

- Read the [API Documentation](./API.md)
- Review the [Architecture Guide](./ARCHITECTURE.md)
- Check [Contributing Guidelines](../CONTRIBUTING.md)

/**
 * Dependency injection container types for treasury-sentinel services
 */

import { TreasuryMonitor } from '../treasury/TreasuryMonitor';
import { KaikoGateway } from '../kaiko/KaikoGateway';
import { LiquidityMetrics } from '../liquidity/LiquidityMetrics';
import { AgentRunner } from '../scheduler/AgentRunner';
import { Http402Handler } from '../payments/Http402Handler';
import { SettlementVerifier } from '../settlement/SettlementVerifier';
import { PaymentRepository } from '../../db/repositories/PaymentRepository';
import { TreasuryRepository } from '../../db/repositories/TreasuryRepository';
import { AgentRunRepository } from '../../db/repositories/AgentRunRepository';

export interface ServiceRegistry {
  treasuryMonitor: TreasuryMonitor;
  kaikoGateway: KaikoGateway;
  liquidityMetrics: LiquidityMetrics;
  agentRunner: AgentRunner;
  http402Handler: Http402Handler;
  settlementVerifier: SettlementVerifier;
}

export interface RepositoryRegistry {
  paymentRepository: PaymentRepository;
  treasuryRepository: TreasuryRepository;
  agentRunRepository: AgentRunRepository;
}

export interface ServiceContainerConfig {
  autoInitialize?: boolean;
  enableLogging?: boolean;
  environment?: 'development' | 'staging' | 'production';
}

export interface ServiceHealth {
  serviceName: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime?: number;
  errorMessage?: string;
}

export interface ContainerHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  timestamp: Date;
}

export type ServiceFactory<T> = () => T | Promise<T>;

export interface ServiceDefinition<T> {
  factory: ServiceFactory<T>;
  singleton?: boolean;
  lazy?: boolean;
  dependencies?: string[];
}

export type ServiceKey = keyof ServiceRegistry | keyof RepositoryRegistry;

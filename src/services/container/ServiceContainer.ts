/**
 * Dependency injection container for treasury-sentinel
 * Manages service lifecycle and dependencies
 */

import {
  ServiceRegistry,
  RepositoryRegistry,
  ServiceContainerConfig,
  ServiceHealth,
  ContainerHealth,
  ServiceDefinition,
  ServiceKey,
} from './types';
import { TreasuryMonitor } from '../treasury/TreasuryMonitor';
import { KaikoGateway } from '../kaiko/KaikoGateway';
import { LiquidityMetrics } from '../liquidity/LiquidityMetrics';
import { AgentRunner } from '../scheduler/AgentRunner';
import { Http402Handler } from '../payments/Http402Handler';
import { SettlementVerifier } from '../settlement/SettlementVerifier';
import { PaymentRepository } from '../../db/repositories/PaymentRepository';
import { TreasuryRepository } from '../../db/repositories/TreasuryRepository';
import { AgentRunRepository } from '../../db/repositories/AgentRunRepository';

export class ServiceContainer {
  private static instance: ServiceContainer | null = null;
  
  private services: Map<string, unknown> = new Map();
  private definitions: Map<string, ServiceDefinition<unknown>> = new Map();
  private initialized: boolean = false;
  private config: ServiceContainerConfig;

  private constructor(config: ServiceContainerConfig = {}) {
    this.config = {
      autoInitialize: true,
      enableLogging: true,
      environment: 'development',
      ...config,
    };
  }

  static getInstance(config?: ServiceContainerConfig): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer(config);
    }
    return ServiceContainer.instance;
  }

  static resetInstance(): void {
    if (ServiceContainer.instance) {
      ServiceContainer.instance.dispose();
      ServiceContainer.instance = null;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      this.log('Container already initialized');
      return;
    }

    this.log('Initializing service container...');

    // Register all service definitions
    this.registerServiceDefinitions();
    this.registerRepositoryDefinitions();

    // Initialize non-lazy singletons
    for (const [key, definition] of this.definitions) {
      if (definition.singleton && !definition.lazy) {
        await this.resolve(key as ServiceKey);
      }
    }

    this.initialized = true;
    this.log('Service container initialized successfully');
  }

  private registerServiceDefinitions(): void {
    this.register<TreasuryMonitor>('treasuryMonitor', {
      factory: () => new TreasuryMonitor(),
      singleton: true,
      lazy: false,
    });

    this.register<KaikoGateway>('kaikoGateway', {
      factory: () => new KaikoGateway(),
      singleton: true,
      lazy: false,
    });

    this.register<LiquidityMetrics>('liquidityMetrics', {
      factory: () => {
        const kaikoGateway = this.services.get('kaikoGateway') as KaikoGateway;
        return new LiquidityMetrics(kaikoGateway);
      },
      singleton: true,
      lazy: false,
      dependencies: ['kaikoGateway'],
    });

    this.register<Http402Handler>('http402Handler', {
      factory: () => new Http402Handler(),
      singleton: true,
      lazy: false,
    });

    this.register<SettlementVerifier>('settlementVerifier', {
      factory: () => new SettlementVerifier(),
      singleton: true,
      lazy: false,
    });

    this.register<AgentRunner>('agentRunner', {
      factory: () => new AgentRunner(),
      singleton: true,
      lazy: true, // Lazy since it's only needed when scheduler runs
    });
  }

  private registerRepositoryDefinitions(): void {
    this.register<PaymentRepository>('paymentRepository', {
      factory: () => new PaymentRepository(),
      singleton: true,
      lazy: false,
    });

    this.register<TreasuryRepository>('treasuryRepository', {
      factory: () => new TreasuryRepository(),
      singleton: true,
      lazy: false,
    });

    this.register<AgentRunRepository>('agentRunRepository', {
      factory: () => new AgentRunRepository(),
      singleton: true,
      lazy: false,
    });
  }

  register<T>(key: string, definition: ServiceDefinition<T>): void {
    this.definitions.set(key, definition as ServiceDefinition<unknown>);
  }

  async resolve<K extends keyof ServiceRegistry>(key: K): Promise<ServiceRegistry[K]>;
  async resolve<K extends keyof RepositoryRegistry>(key: K): Promise<RepositoryRegistry[K]>;
  async resolve(key: ServiceKey): Promise<unknown> {
    const definition = this.definitions.get(key);
    
    if (!definition) {
      throw new Error(`Service '${key}' is not registered`);
    }

    // Return cached singleton if available
    if (definition.singleton && this.services.has(key)) {
      return this.services.get(key);
    }

    // Resolve dependencies first
    if (definition.dependencies) {
      for (const dep of definition.dependencies) {
        if (!this.services.has(dep)) {
          await this.resolve(dep as ServiceKey);
        }
      }
    }

    // Create instance
    this.log(`Creating service: ${key}`);
    const instance = await definition.factory();

    // Cache singleton
    if (definition.singleton) {
      this.services.set(key, instance);
    }

    return instance;
  }

  get<K extends keyof ServiceRegistry>(key: K): ServiceRegistry[K];
  get<K extends keyof RepositoryRegistry>(key: K): RepositoryRegistry[K];
  get(key: ServiceKey): unknown {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`Service '${key}' not initialized. Call resolve() first or ensure container is initialized.`);
    }
    return service;
  }

  has(key: ServiceKey): boolean {
    return this.services.has(key);
  }

  async healthCheck(): Promise<ContainerHealth> {
    const serviceHealths: ServiceHealth[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    for (const [key] of this.services) {
      const startTime = Date.now();
      const health: ServiceHealth = {
        serviceName: key,
        status: 'healthy',
        lastCheck: new Date(),
      };

      try {
        // Basic health check - service exists and is truthy
        const service = this.services.get(key);
        if (!service) {
          health.status = 'unhealthy';
          health.errorMessage = 'Service not found';
          overallStatus = 'unhealthy';
        }
        health.responseTime = Date.now() - startTime;
      } catch (error) {
        health.status = 'unhealthy';
        health.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        health.responseTime = Date.now() - startTime;
        overallStatus = 'unhealthy';
      }

      serviceHealths.push(health);
    }

    // Check if any services are degraded
    const degradedCount = serviceHealths.filter(h => h.status === 'degraded').length;
    if (degradedCount > 0 && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      overall: overallStatus,
      services: serviceHealths,
      timestamp: new Date(),
    };
  }

  getServiceNames(): string[] {
    return Array.from(this.services.keys());
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  dispose(): void {
    this.log('Disposing service container...');
    this.services.clear();
    this.definitions.clear();
    this.initialized = false;
  }

  private log(message: string): void {
    if (this.config.enableLogging) {
      console.log(`[ServiceContainer] ${message}`);
    }
  }
}

export const container = ServiceContainer.getInstance();

import { v4 as uuidv4 } from 'uuid';
import {
  EventType,
  TreasurySentinelEvent,
  EventHandler,
  EventSubscription,
  EventEmitterOptions,
} from './types';

export class TreasurySentinelEventEmitter {
  private subscriptions: Map<string, EventSubscription[]> = new Map();
  private options: Required<EventEmitterOptions>;
  private eventHistory: TreasurySentinelEvent[] = [];
  private maxHistorySize = 1000;

  constructor(options: EventEmitterOptions = {}) {
    this.options = {
      maxListeners: options.maxListeners ?? 100,
      enableLogging: options.enableLogging ?? false,
      asyncHandlers: options.asyncHandlers ?? true,
    };
  }

  on<T extends TreasurySentinelEvent>(
    eventType: T['type'] | '*',
    handler: EventHandler<T>
  ): () => void {
    return this.subscribe(eventType, handler as EventHandler, false);
  }

  once<T extends TreasurySentinelEvent>(
    eventType: T['type'] | '*',
    handler: EventHandler<T>
  ): () => void {
    return this.subscribe(eventType, handler as EventHandler, true);
  }

  private subscribe(
    eventType: EventType | '*',
    handler: EventHandler,
    once: boolean
  ): () => void {
    const subscription: EventSubscription = {
      id: uuidv4(),
      eventType,
      handler,
      once,
    };

    const existing = this.subscriptions.get(eventType) ?? [];
    
    if (existing.length >= this.options.maxListeners) {
      console.warn(
        `Max listeners (${this.options.maxListeners}) reached for event type: ${eventType}`
      );
    }

    this.subscriptions.set(eventType, [...existing, subscription]);

    return () => this.unsubscribe(eventType, subscription.id);
  }

  private unsubscribe(eventType: EventType | '*', subscriptionId: string): void {
    const existing = this.subscriptions.get(eventType) ?? [];
    this.subscriptions.set(
      eventType,
      existing.filter((sub) => sub.id !== subscriptionId)
    );
  }

  async emit<T extends TreasurySentinelEvent>(event: T): Promise<void> {
    if (this.options.enableLogging) {
      console.log(`[Event] ${event.type}:`, event);
    }

    this.recordEvent(event);

    const handlers = this.getHandlersForEvent(event.type);
    const onceHandlerIds: string[] = [];

    const executeHandlers = handlers.map(async (subscription) => {
      try {
        if (this.options.asyncHandlers) {
          await subscription.handler(event);
        } else {
          subscription.handler(event);
        }

        if (subscription.once) {
          onceHandlerIds.push(subscription.id);
        }
      } catch (error) {
        console.error(
          `Error in event handler for ${event.type}:`,
          error
        );
      }
    });

    await Promise.all(executeHandlers);

    // Clean up once handlers
    onceHandlerIds.forEach((id) => {
      this.removeSubscriptionById(id);
    });
  }

  private getHandlersForEvent(eventType: EventType): EventSubscription[] {
    const specificHandlers = this.subscriptions.get(eventType) ?? [];
    const wildcardHandlers = this.subscriptions.get('*') ?? [];
    return [...specificHandlers, ...wildcardHandlers];
  }

  private removeSubscriptionById(id: string): void {
    for (const [eventType, subs] of this.subscriptions.entries()) {
      const filtered = subs.filter((sub) => sub.id !== id);
      if (filtered.length !== subs.length) {
        this.subscriptions.set(eventType, filtered);
        break;
      }
    }
  }

  private recordEvent(event: TreasurySentinelEvent): void {
    this.eventHistory.push(event);
    
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  getEventHistory(filter?: {
    eventType?: EventType;
    since?: Date;
    limit?: number;
  }): TreasurySentinelEvent[] {
    let events = [...this.eventHistory];

    if (filter?.eventType) {
      events = events.filter((e) => e.type === filter.eventType);
    }

    if (filter?.since) {
      events = events.filter((e) => e.timestamp >= filter.since!);
    }

    if (filter?.limit) {
      events = events.slice(-filter.limit);
    }

    return events;
  }

  getListenerCount(eventType?: EventType | '*'): number {
    if (eventType) {
      return this.subscriptions.get(eventType)?.length ?? 0;
    }

    let total = 0;
    for (const subs of this.subscriptions.values()) {
      total += subs.length;
    }
    return total;
  }

  removeAllListeners(eventType?: EventType | '*'): void {
    if (eventType) {
      this.subscriptions.delete(eventType);
    } else {
      this.subscriptions.clear();
    }
  }

  clearHistory(): void {
    this.eventHistory = [];
  }

  createCorrelatedEvent<T extends Omit<TreasurySentinelEvent, 'timestamp' | 'correlationId'>>(
    eventData: T,
    correlationId?: string
  ): T & { timestamp: Date; correlationId: string } {
    return {
      ...eventData,
      timestamp: new Date(),
      correlationId: correlationId ?? uuidv4(),
    } as T & { timestamp: Date; correlationId: string };
  }
}

// Singleton instance for application-wide event bus
let globalEventEmitter: TreasurySentinelEventEmitter | null = null;

export function getEventEmitter(): TreasurySentinelEventEmitter {
  if (!globalEventEmitter) {
    globalEventEmitter = new TreasurySentinelEventEmitter({
      enableLogging: process.env.NODE_ENV === 'development',
      asyncHandlers: true,
    });
  }
  return globalEventEmitter;
}

export function resetEventEmitter(): void {
  if (globalEventEmitter) {
    globalEventEmitter.removeAllListeners();
    globalEventEmitter.clearHistory();
    globalEventEmitter = null;
  }
}

/**
 * Serialization utilities for treasury sentinel
 */

import { TreasurySnapshot, TokenBalance } from '../types/treasury';
import { EscalationState } from '../types/escalation';
import { PaymentRecord } from '../services/payments/types';
import { AgentRun } from '../types/scheduler';

export interface SerializationOptions {
  pretty?: boolean;
  excludeFields?: string[];
}

function replacer(excludeFields: string[]) {
  return function(key: string, value: unknown): unknown {
    if (excludeFields.includes(key)) {
      return undefined;
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  };
}

function reviver(key: string, value: unknown): unknown {
  if (typeof value === 'string') {
    // ISO date string pattern
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
  }
  return value;
}

export function serialize<T>(data: T, options: SerializationOptions = {}): string {
  const { pretty = false, excludeFields = [] } = options;
  const space = pretty ? 2 : undefined;
  return JSON.stringify(data, replacer(excludeFields), space);
}

export function deserialize<T>(json: string): T {
  return JSON.parse(json, reviver) as T;
}

export function serializeTreasurySnapshot(snapshot: TreasurySnapshot): string {
  return serialize({
    ...snapshot,
    balances: snapshot.balances.map(balance => ({
      ...balance,
      balance: balance.balance.toString(),
      valueUSD: balance.valueUSD
    }))
  }, { pretty: true });
}

export function deserializeTreasurySnapshot(json: string): TreasurySnapshot {
  const parsed = deserialize<Record<string, unknown>>(json);
  return {
    ...parsed,
    timestamp: new Date(parsed.timestamp as string),
    balances: (parsed.balances as Array<Record<string, unknown>>).map(b => ({
      ...b,
      balance: BigInt(b.balance as string)
    }))
  } as TreasurySnapshot;
}

export function serializeEscalationState(state: EscalationState): string {
  return serialize(state, { pretty: true });
}

export function deserializeEscalationState(json: string): EscalationState {
  return deserialize<EscalationState>(json);
}

export function serializePaymentRecord(record: PaymentRecord): string {
  return serialize(record, { pretty: true });
}

export function deserializePaymentRecord(json: string): PaymentRecord {
  return deserialize<PaymentRecord>(json);
}

export function serializeAgentRun(run: AgentRun): string {
  return serialize(run, { pretty: true });
}

export function deserializeAgentRun(json: string): AgentRun {
  const parsed = deserialize<Record<string, unknown>>(json);
  return {
    ...parsed,
    startTime: new Date(parsed.startTime as string),
    endTime: parsed.endTime ? new Date(parsed.endTime as string) : undefined
  } as AgentRun;
}

export function toBase64(data: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64');
  }
  return btoa(data);
}

export function fromBase64(encoded: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
  return atob(encoded);
}

export function compactSerialize<T>(data: T): string {
  return toBase64(serialize(data));
}

export function compactDeserialize<T>(encoded: string): T {
  return deserialize<T>(fromBase64(encoded));
}

export function deepClone<T>(obj: T): T {
  return deserialize<T>(serialize(obj));
}

export function isSerializable(value: unknown): boolean {
  try {
    serialize(value);
    return true;
  } catch {
    return false;
  }
}

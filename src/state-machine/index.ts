export { EscalationStateMachine } from './EscalationStateMachine';
export type { StateMachineConfig, TransitionGuard } from './EscalationStateMachine';

export {
  createLCRGuard,
  createVolatilityGuard,
  createExitHalfLifeGuard,
  createCooldownGuard,
  createCompositeGuard,
  createAnyOfGuard,
  DEFAULT_RISK_THRESHOLDS,
} from './guards';
export type { RiskThresholds } from './guards';

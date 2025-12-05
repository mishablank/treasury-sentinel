export { EscalationStateMachine } from './EscalationStateMachine';
export {
  canEscalate,
  canDeescalate,
  shouldBlockForBudget,
  getGuardConditions,
} from './guards';
export {
  STATE_CONFIGS,
  TRANSITION_CONFIGS,
  getStateConfig,
  getTransitionsFrom,
  getTransitionsTo,
  findTransition,
  getTransitionCost,
} from './config';
export type { StateConfig, TransitionConfig } from './config';

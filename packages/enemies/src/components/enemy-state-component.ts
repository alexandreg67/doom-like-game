import type { Component } from '@doom-like/game-logic';
import { EnemyState } from '../types';

/**
 * EnemyState component - manages FSM state for enemy AI
 * Contains current state and timing information
 */
export interface EnemyStateComponent extends Component {
  id: 'enemyState';

  /** Current FSM state */
  currentState: EnemyState;

  /** Previous state (for transitions) */
  previousState: EnemyState;

  /** When current state was entered (timestamp) */
  stateStartTime: number;

  /** How long we've been in current state (seconds) */
  timeInState: number;

  /** Whether state has changed this frame */
  stateChanged: boolean;

  /** Next scheduled state (for timed transitions) */
  nextState?: EnemyState | undefined;

  /** Time until next state transition (if scheduled) */
  nextStateTimer?: number | undefined;
}

/**
 * Factory function to create EnemyState component
 */
export function createEnemyStateComponent(
  initialState: EnemyState = EnemyState.IDLE
): EnemyStateComponent {
  const now = performance.now();

  return {
    id: 'enemyState',
    currentState: initialState,
    previousState: initialState,
    stateStartTime: now,
    timeInState: 0,
    stateChanged: false,
  };
}

/**
 * Utility functions for state management
 */
function transitionTo(
  stateComponent: EnemyStateComponent,
  newState: EnemyState,
  currentTime: number = performance.now()
): void {
  if (stateComponent.currentState === newState) {
    return; // No change needed
  }

  stateComponent.previousState = stateComponent.currentState;
  stateComponent.currentState = newState;
  stateComponent.stateStartTime = currentTime;
  stateComponent.timeInState = 0;
  stateComponent.stateChanged = true;

  // Clear any scheduled transition
  stateComponent.nextState = undefined;
  stateComponent.nextStateTimer = undefined;
}

function scheduleTransition(
  stateComponent: EnemyStateComponent,
  nextState: EnemyState,
  delay: number
): void {
  stateComponent.nextState = nextState;
  stateComponent.nextStateTimer = delay;
}

function updateState(
  stateComponent: EnemyStateComponent,
  deltaTime: number,
  currentTime: number = performance.now()
): void {
  // Reset state change flag
  stateComponent.stateChanged = false;

  // Update time in current state
  stateComponent.timeInState = (currentTime - stateComponent.stateStartTime) / 1000;

  // Handle scheduled transitions
  if (stateComponent.nextState && stateComponent.nextStateTimer !== undefined) {
    stateComponent.nextStateTimer -= deltaTime;

    if (stateComponent.nextStateTimer <= 0) {
      const next = stateComponent.nextState;
      stateComponent.nextState = undefined;
      stateComponent.nextStateTimer = undefined;

      transitionTo(stateComponent, next, currentTime);
    }
  }
}

function isInState(stateComponent: EnemyStateComponent, ...states: EnemyState[]): boolean {
  return states.includes(stateComponent.currentState);
}

function justEnteredState(stateComponent: EnemyStateComponent, state: EnemyState): boolean {
  return stateComponent.stateChanged && stateComponent.currentState === state;
}

function hasBeenInStateFor(
  stateComponent: EnemyStateComponent,
  state: EnemyState,
  minTime: number
): boolean {
  return stateComponent.currentState === state && stateComponent.timeInState >= minTime;
}

export const EnemyStateUtils = {
  transitionTo,
  scheduleTransition,
  updateState,
  isInState,
  justEnteredState,
  hasBeenInStateFor,
} as const;
